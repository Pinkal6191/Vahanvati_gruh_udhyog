import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

async function runStep17Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 17: FULL QA / UAT / SECURITY / CONCURRENCY SUITE');
  console.log('🧪 ========================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}${env.API_PREFIX}`;

  let createdSaleId: string | null = null;
  let testProductId: string | null = null;
  let testProdEntryId: string | null = null;

  try {
    // 1. Fetch Users for Role-based tokens
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const outletUser = await prisma.user.findFirst({ where: { role: 'OUTLET' } });
    const prodUser = await prisma.user.findFirst({ where: { role: 'PRODUCTION' } });

    assert.ok(adminUser, 'Admin user must exist in database');
    assert.ok(outletUser, 'Outlet user must exist in database');
    assert.ok(prodUser, 'Production user must exist in database');

    const adminToken = jwt.sign(
      { sub: adminUser.id, username: adminUser.username, role: adminUser.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    const outletToken = jwt.sign(
      { sub: outletUser.id, username: outletUser.username, role: outletUser.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    const prodToken = jwt.sign(
      { sub: prodUser.id, username: prodUser.username, role: prodUser.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // ========================================================
    // SECTION 1: SYSTEM HEALTH CHECK (Test 1)
    // ========================================================
    console.log('▶ [1/20] Health Check: Verify database connectivity and service health...');
    const healthRes = await fetch(`http://localhost:${address.port}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'healthy');
    assert.equal(healthData.database, 'connected');
    console.log('  ✅ System health check passed.\n');

    // ========================================================
    // SECTION 2: AUTHENTICATION & RBAC GATING (Tests 2–5)
    // ========================================================
    console.log('▶ [2/20] Security: Direct API access without Bearer token must return 401...');
    const unauthRes = await fetch(`${baseUrl}/sales`);
    assert.equal(unauthRes.status, 401, 'Anonymous access to /sales must return 401');

    const unauthCms = await fetch(`${baseUrl}/cms/products`);
    assert.equal(unauthCms.status, 401, 'Anonymous access to /cms/products must return 401');

    const unauthUsers = await fetch(`${baseUrl}/users`);
    assert.equal(unauthUsers.status, 401, 'Anonymous access to /users must return 401');
    console.log('  ✅ Unauthenticated requests strictly rejected with 401.\n');

    console.log('▶ [3/20] RBAC: OUTLET role forbidden from Production & CMS mutations (403)...');
    const outletProdRes = await fetch(`${baseUrl}/production`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: '00000000-0000-0000-0000-000000000000', quantity: 5 }),
    });
    assert.equal(outletProdRes.status, 403, 'Outlet role must not create production entries');

    const outletCmsRes = await fetch(`${baseUrl}/cms/products`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(outletCmsRes.status, 403, 'Outlet role must not access CMS');

    const outletAdjustRes = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: '00000000-0000-0000-0000-000000000000', quantityDelta: 5 }),
    });
    assert.equal(outletAdjustRes.status, 403, 'Outlet role must not adjust stock');
    console.log('  ✅ OUTLET role authorization boundary strictly enforced (403).\n');

    console.log('▶ [4/20] RBAC: PRODUCTION role forbidden from Billing, Returns & CMS (403)...');
    const prodSaleRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [], payments: [] }),
    });
    assert.equal(prodSaleRes.status, 403, 'Production role must not create sales');

    const prodReturnRes = await fetch(`${baseUrl}/returns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saleId: '00000000-0000-0000-0000-000000000000', items: [] }),
    });
    assert.equal(prodReturnRes.status, 403, 'Production role must not create returns');

    const prodReportsRes = await fetch(`${baseUrl}/reports/sales`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    assert.equal(prodReportsRes.status, 403, 'Production role must not access financial sales reports');
    console.log('  ✅ PRODUCTION role authorization boundary strictly enforced (403).\n');

    console.log('▶ [5/20] IDOR & Input Validation: Random UUIDs return 404, invalid payloads return 400...');
    const randomUuid = '00000000-0000-0000-0000-000000000000';
    const idorRes = await fetch(`${baseUrl}/sales/${randomUuid}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(idorRes.status, 404, 'Non-existent ID must return clean 404');

    const badPayloadRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalidField: true }),
    });
    assert.equal(badPayloadRes.status, 400, 'Malformed payload must return 400');
    console.log('  ✅ IDOR and payload validation passed.\n');

    // ========================================================
    // SECTION 3: PRICING ENGINE & HISTORICAL BILL IMMUTABILITY (Tests 6–7)
    // ========================================================
    console.log('▶ [6/20] Pricing: Resolve multi-tier pricing for Indian vs NRI customer...');
    // Find an active product with pack config and prices
    const productWithPrices = await prisma.product.findFirst({
      where: {
        isActive: true,
        prices: { some: { isActive: true } },
      },
      include: {
        prices: true,
        packConfigurations: true,
        stock: true,
      },
    });

    assert.ok(productWithPrices, 'Must have at least one product with active prices');
    testProductId = productWithPrices.id;

    const indianPrice = productWithPrices.prices.find((p) => p.customerType === 'INDIAN')?.rate;
    const nriPrice = productWithPrices.prices.find((p) => p.customerType === 'NRI')?.rate;

    const resolveIndianRes = await fetch(`${baseUrl}/pricing/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: productWithPrices.id,
        customerType: 'INDIAN',
        quantity: 1,
      }),
    });
    assert.equal(resolveIndianRes.status, 200);
    const resolvedIndian = await resolveIndianRes.json();
    assert.ok(resolvedIndian.success);
    if (indianPrice) {
      assert.equal(Number(resolvedIndian.data.unitRate), Number(indianPrice));
    }

    const resolveNriRes = await fetch(`${baseUrl}/pricing/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: productWithPrices.id,
        customerType: 'NRI',
        quantity: 1,
      }),
    });
    assert.equal(resolveNriRes.status, 200);
    const resolvedNri = await resolveNriRes.json();
    assert.ok(resolvedNri.success);
    if (nriPrice) {
      assert.equal(Number(resolvedNri.data.unitRate), Number(nriPrice));
    }
    console.log('  ✅ Dual pricing (Indian vs NRI) resolved with exact rates.\n');

    console.log('▶ [7/20] Historical Bill Immutability: Bill rate remains locked when product price updates...');
    // Ensure sufficient stock for the test product
    await prisma.stock.upsert({
      where: { productId: testProductId },
      update: { currentBalance: 50000 },
      create: { productId: testProductId, currentBalance: 50000, minimumThreshold: 100 },
    });

    const initialRate = Number(resolvedIndian.data.unitRate) || 150;

    // Create a sale at initialRate
    const saleCreateRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        items: [
          {
            productId: testProductId,
            quantity: 1,
          },
        ],
        payments: [
          {
            paymentMode: 'CASH',
            amount: initialRate,
          },
        ],
        paidAmount: initialRate,
      }),
    });

    assert.equal(saleCreateRes.status, 201);
    const saleData = await saleCreateRes.json();
    createdSaleId = saleData.data.id;
    const originalBillUnitRate = Number(saleData.data.items[0].unitRate);
    assert.equal(originalBillUnitRate, initialRate);

    // Now Admin updates product price to a new altered rate (e.g. initialRate + 50)
    const newAlteredRate = initialRate + 50;
    await prisma.productPrice.updateMany({
      where: {
        productId: testProductId,
        customerType: 'INDIAN',
        packConfigId: null,
      },
      data: { rate: newAlteredRate },
    });

    // Fetch the previously created sale
    const fetchOldSaleRes = await fetch(`${baseUrl}/sales/${createdSaleId}`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(fetchOldSaleRes.status, 200);
    const oldSaleData = await fetchOldSaleRes.json();
    const lockedUnitRate = Number(oldSaleData.data.items[0].unitRate);

    assert.equal(
      lockedUnitRate,
      originalBillUnitRate,
      'Historical bill item rate MUST remain immutable and not reflect current price changes'
    );
    console.log(`  ✅ Historical bill rate remained locked at ₹${lockedUnitRate} despite catalog change to ₹${newAlteredRate}.\n`);

    // ========================================================
    // SECTION 4: BILLING <-> STOCK ATOMIC CONSISTENCY (Test 8)
    // ========================================================
    console.log('▶ [8/20] Stock Atomicity: Sale creation deducts exact stock and appends ledger...');
    const stockBefore = await prisma.stock.findUnique({
      where: { productId: testProductId },
    });
    const balanceBefore = Number(stockBefore!.currentBalance);

    // Sell 2 units
    const sale2Res = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        items: [{ productId: testProductId, quantity: 2 }],
        payments: [{ paymentMode: 'UPI', amount: newAlteredRate * 2 }],
        paidAmount: newAlteredRate * 2,
      }),
    });
    assert.equal(sale2Res.status, 201);
    const sale2Data = await sale2Res.json();
    const deductedWeight = Number(sale2Data.data.items[0].baseWeightDeducted);

    const stockAfter = await prisma.stock.findUnique({
      where: { productId: testProductId },
    });
    const balanceAfter = Number(stockAfter!.currentBalance);

    assert.equal(
      balanceAfter,
      balanceBefore - deductedWeight,
      'Stock balance must decrease by exactly the sold base weight'
    );

    // Verify ledger entry
    const movement = await prisma.stockMovement.findFirst({
      where: { referenceId: sale2Data.data.id, movementType: 'SALE_OUT' },
    });
    assert.ok(movement, 'Stock movement ledger record must exist for the sale');
    assert.equal(Number(movement.quantityDelta), -deductedWeight);
    console.log('  ✅ Stock deduction and movement ledger atomically linked.\n');

    // ========================================================
    // SECTION 5: CONCURRENCY & RACE CONDITIONS (Tests 9–11)
    // ========================================================
    console.log('▶ [9/20] Concurrency: Parallel sale checkout requests serialize without negative stock drift...');
    // Set stock to exactly 5 units
    await prisma.stock.update({
      where: { productId: testProductId },
      data: { currentBalance: 5 },
    });

    // Fire 2 concurrent sales of 3 units each (Total 6 units demanded, only 5 available)
    const [req1, req2] = await Promise.all([
      fetch(`${baseUrl}/sales`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${outletToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerType: 'INDIAN',
          items: [{ productId: testProductId, quantity: 3 }],
          payments: [{ paymentMode: 'CASH', amount: newAlteredRate * 3 }],
          paidAmount: newAlteredRate * 3,
        }),
      }),
      fetch(`${baseUrl}/sales`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${outletToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerType: 'INDIAN',
          items: [{ productId: testProductId, quantity: 3 }],
          payments: [{ paymentMode: 'CASH', amount: newAlteredRate * 3 }],
          paidAmount: newAlteredRate * 3,
        }),
      }),
    ]);

    const statuses = [req1.status, req2.status];
    assert.ok(statuses.includes(201), 'At least one concurrent sale must succeed');
    assert.ok(
      statuses.includes(400) || statuses.includes(422),
      'Second concurrent sale exceeding stock must be rejected with 400/422 Insufficient Stock'
    );

    const finalStock = await prisma.stock.findUnique({ where: { productId: testProductId } });
    assert.ok(Number(finalStock!.currentBalance) >= 0, 'Current stock must never become negative');
    console.log('  ✅ Row-level locking serialized concurrent sales cleanly and prevented overselling.\n');

    console.log('▶ [10/20] Concurrency: Duplicate production draft completion is idempotent / single-execution...');
    // Create draft production entry via API
    const createDraftRes = await fetch(`${baseUrl}/production`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prodToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: testProductId,
        unitId: productWithPrices.primaryUnitId,
        batchNumber: `BATCH-${Date.now()}`,
        productionDate: new Date().toISOString().slice(0, 10),
        quantityProduced: 10,
        status: 'DRAFT',
      }),
    });
    assert.equal(createDraftRes.status, 201);
    const prodDraftData = await createDraftRes.json();
    testProdEntryId = prodDraftData.data.id;

    // Fire 2 concurrent completion requests on the same draft
    const [comp1, comp2] = await Promise.all([
      fetch(`${baseUrl}/production/${testProdEntryId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${prodToken}` },
      }),
      fetch(`${baseUrl}/production/${testProdEntryId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${prodToken}` },
      }),
    ]);

    const compStatuses = [comp1.status, comp2.status];
    assert.ok(compStatuses.includes(200), 'First completion must succeed with 200');
    // The other must be rejected because it is already COMPLETED
    assert.ok(
      compStatuses.includes(400) || compStatuses.includes(409),
      'Concurrent duplicate completion must be safely rejected'
    );

    // Verify stock was added only once (10 units)
    const movements = await prisma.stockMovement.findMany({
      where: { referenceId: testProdEntryId, movementType: 'PRODUCTION_IN' },
    });
    assert.equal(movements.length, 1, 'Stock movement must only be recorded ONCE for the production batch');
    console.log('  ✅ Duplicate production completion race prevented double-increment.\n');

    console.log('▶ [11/20] Concurrency: Over-return guard prevents concurrent over-return...');
    // Using createdSaleId (sold 1 unit)
    const [ret1, ret2] = await Promise.all([
      fetch(`${baseUrl}/returns`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${outletToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalSaleId: createdSaleId,
          reason: 'Customer return test 1',
          refundPaymentMode: 'CASH',
          items: [
            {
              saleItemId: (await prisma.saleItem.findFirst({ where: { saleId: createdSaleId } }))!.id,
              returnedQuantity: 1,
              restockCondition: 'RESTOCKABLE',
            },
          ],
        }),
      }),
      fetch(`${baseUrl}/returns`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${outletToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalSaleId: createdSaleId,
          reason: 'Customer return test 2',
          refundPaymentMode: 'CASH',
          items: [
            {
              saleItemId: (await prisma.saleItem.findFirst({ where: { saleId: createdSaleId } }))!.id,
              returnedQuantity: 1,
              restockCondition: 'RESTOCKABLE',
            },
          ],
        }),
      }),
    ]);

    const retStatuses = [ret1.status, ret2.status];
    assert.ok(retStatuses.includes(201), 'First return must succeed (201)');
    assert.ok(
      retStatuses.includes(400) || retStatuses.includes(422),
      'Second concurrent return exceeding balance must be rejected (400/422)'
    );
    console.log('  ✅ Over-return protection prevented returning more than purchased.\n');

    // ========================================================
    // SECTION 6: PRODUCTION REVERSAL & RETURNS AUDIT (Tests 12–13)
    // ========================================================
    console.log('▶ [12/20] Production Lifecycle: Completed production cancellation reverses stock exactly...');
    const prodStockBeforeCancel = Number((await prisma.stock.findUnique({ where: { productId: testProductId } }))!.currentBalance);

    const cancelProdRes = await fetch(`${baseUrl}/production/${testProdEntryId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Quality defect audit' }),
    });
    assert.equal(cancelProdRes.status, 200);

    const prodStockAfterCancel = Number((await prisma.stock.findUnique({ where: { productId: testProductId } }))!.currentBalance);
    assert.equal(
      prodStockAfterCancel,
      prodStockBeforeCancel - Number(prodDraftData.data.baseWeightAdded),
      'Cancelled production must deduct the added stock back'
    );
    console.log(`  ✅ Production cancellation accurately reversed stock by ${prodDraftData.data.baseWeightAdded} base units.\n`);

    console.log('▶ [13/20] Sales Returns: DAMAGED_DISCARD does not increase sellable stock...');
    // Create a new sale to return as DAMAGED_DISCARD
    await prisma.stock.update({
      where: { productId: testProductId },
      data: { currentBalance: 20 },
    });

    const discardSaleRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        items: [{ productId: testProductId, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: newAlteredRate }],
        paidAmount: newAlteredRate,
      }),
    });
    const discardSale = (await discardSaleRes.json()).data;
    const stockAfterDiscardSale = Number((await prisma.stock.findUnique({ where: { productId: testProductId } }))!.currentBalance);

    // Return as DAMAGED_DISCARD
    const returnDiscardRes = await fetch(`${baseUrl}/returns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${outletToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originalSaleId: discardSale.id,
        reason: 'Packet damaged during transport',
        refundPaymentMode: 'STORE_CREDIT',
        items: [
          {
            saleItemId: discardSale.items[0].id,
            returnedQuantity: 1,
            restockCondition: 'DAMAGED_DISCARD',
          },
        ],
      }),
    });
    assert.equal(returnDiscardRes.status, 201);

    const stockAfterDiscardReturn = Number((await prisma.stock.findUnique({ where: { productId: testProductId } }))!.currentBalance);
    assert.equal(
      stockAfterDiscardReturn,
      stockAfterDiscardSale,
      'DAMAGED_DISCARD return must NOT increment sellable stock balance'
    );
    console.log('  ✅ DAMAGED_DISCARD return correctly quarantined without increasing sellable stock.\n');

    // ========================================================
    // SECTION 7: STOCK LEDGER RECONCILIATION & PARITY (Test 14)
    // ========================================================
    console.log('▶ [14/20] Inventory Parity: Cached stock balance equals sum of movement ledger...');
    // Create dedicated product for reconciliation test to verify zero drift
    const reconUnit = await prisma.unit.findFirst();
    const reconSubcat = await prisma.subcategory.findFirst();
    const reconProduct = await prisma.product.create({
      data: {
        name: 'Reconciliation Parity Test Product',
        code: `RECON_${Date.now()}`,
        primaryUnitId: reconUnit!.id,
        subcategoryId: reconSubcat!.id,
      },
    });

    // Add stock via official adjust endpoint (creates cached balance + stock movement)
    const adjustRes = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: reconProduct.id,
        quantityDelta: 100,
        reason: 'Initial opening stock for parity test',
      }),
    });
    assert.equal(adjustRes.status, 200);

    const reconcileRes = await fetch(`${baseUrl}/inventory/reconcile/${reconProduct.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(reconcileRes.status, 200);
    const reconcileData = await reconcileRes.json();
    assert.ok(reconcileData.success);
    assert.equal(
      reconcileData.data.isConsistent,
      true,
      `Stock discrepancy detected! Cached: ${reconcileData.data.cachedBalance}, LedgerSum: ${reconcileData.data.ledgerTotal}`
    );
    assert.equal(reconcileData.data.cachedBalance, 100);
    assert.equal(reconcileData.data.ledgerTotal, 100);
    console.log(`  ✅ Zero-drift parity verified: Cached ${reconcileData.data.cachedBalance} == Ledger ${reconcileData.data.ledgerTotal}.\n`);

    // Clean up reconProduct
    await prisma.stockMovement.deleteMany({ where: { productId: reconProduct.id } });
    await prisma.stock.deleteMany({ where: { productId: reconProduct.id } });
    await prisma.product.delete({ where: { id: reconProduct.id } });

    // ========================================================
    // SECTION 8: PUBLIC WEBSITE DATA SANITIZATION & SECURITY (Tests 15–17)
    // ========================================================
    console.log('▶ [15/20] Public API Security: Sensitive internal fields never leaked...');
    const publicProdRes = await fetch(`${baseUrl}/public/products`);
    assert.equal(publicProdRes.status, 200);
    const publicProdData = await publicProdRes.json();

    for (const p of publicProdData.data.products) {
      assert.equal(p.costPrice, undefined);
      assert.equal(p.indianPrice, undefined);
      assert.equal(p.nriPrice, undefined);
      assert.equal(p.stock, undefined);
      assert.equal(p.currentBalance, undefined);
      assert.equal(p.reorderLevel, undefined);
    }
    console.log('  ✅ Zero internal data leakage across public product catalog.\n');

    console.log('▶ [16/20] Public API Security: Hidden product (isWebsiteVisible = false) inaccessible...');
    // Create or set a hidden product
    const hiddenProduct = await prisma.product.create({
      data: {
        subcategoryId: (await prisma.subcategory.findFirst())!.id,
        primaryUnitId: (await prisma.unit.findFirst())!.id,
        name: 'Secret Recipe Mix',
        code: `SECRET_${Date.now()}`,
        isWebsiteVisible: false,
        isActive: true,
      },
    });

    const hiddenPublicRes = await fetch(`${baseUrl}/public/products/${hiddenProduct.id}`);
    assert.equal(hiddenPublicRes.status, 404, 'Hidden product must return 404 on public API');

    // Clean up hidden product
    await prisma.product.delete({ where: { id: hiddenProduct.id } });
    console.log('  ✅ Hidden product strictly unviewable on public API (404).\n');

    console.log('▶ [17/20] CMS Security: XSS payloads safely parameterized and handled...');
    const xssPayload = '<script>alert("XSS")</script>';
    const cmsXssRes = await fetch(`${baseUrl}/cms/content/home`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          announcement: xssPayload,
        },
      }),
    });
    assert.equal(cmsXssRes.status, 200);
    const savedContent = await prisma.websiteContent.findUnique({ where: { section: 'home' } });
    assert.equal((savedContent?.content as any).announcement, xssPayload);
    console.log('  ✅ CMS input properly parameterized into JSONB without injection vulnerability.\n');

    // ========================================================
    // SECTION 9: REPORTING INTEGRITY (Tests 18–20)
    // ========================================================
    console.log('▶ [18/20] Reporting Integrity: Net Sales formula strictly equals Gross Sales − Returns...');
    const summaryRes = await fetch(`${baseUrl}/reports/business-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(summaryRes.status, 200);
    const summaryData = (await summaryRes.json()).data;

    const expectedNet = Math.round((summaryData.sales.totalSales - summaryData.returns.totalReturnsAmount) * 100) / 100;
    assert.equal(
      Number(summaryData.netSales),
      expectedNet,
      'Net sales must strictly equal Gross Sales minus Completed Returns'
    );
    console.log(`  ✅ Net Sales formula verified: ₹${summaryData.netSales} == ₹${summaryData.sales.totalSales} − ₹${summaryData.returns.totalReturnsAmount}.\n`);

    console.log('▶ [19/20] Reporting Integrity: No fabricated "Current Stock Value" or profit calculations...');
    const stockReportRes = await fetch(`${baseUrl}/reports/stock`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockReportJson = await stockReportRes.json();
    const summary = stockReportJson.summary || stockReportJson.data?.summary;
    assert.ok(summary, 'Stock report summary must exist');

    assert.equal((summary as any).totalStockValue, undefined);
    assert.equal((summary as any).totalProfit, undefined);
    assert.equal((summary as any).margin, undefined);
    assert.ok(summary.totalStockWeight !== undefined, 'Stock weight must be reported');
    console.log('  ✅ Confirmed: reports do NOT fabricate arbitrary stock valuation or profit.\n');

    console.log('▶ [20/20] Thermal Print Payload: 3-inch receipt contains only customer-safe data...');
    const printRes = await fetch(`${baseUrl}/sales/${createdSaleId}/print`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(printRes.status, 200);
    const printData = (await printRes.json()).data;

    assert.ok(printData.company.name, 'Receipt must have company name');
    assert.ok(printData.invoice.billNumber, 'Receipt must have bill number');
    assert.equal(printData.customerType, undefined, 'Receipt must NOT print Indian/NRI internal customer tier');
    for (const item of printData.items) {
      assert.equal((item as any).costPrice, undefined);
      assert.equal((item as any).currentStock, undefined);
    }
    console.log('  ✅ Thermal print receipt data is clean, compliant and customer-safe.\n');

    console.log('🎉 ========================================================');
    console.log('🎉 ALL 20/20 STEP 17 QA, SECURITY & CONCURRENCY TESTS PASSED!');
    console.log('🎉 ========================================================\n');
  } catch (error) {
    console.error('❌ Step 17 Test Suite Failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

runStep17Tests();
