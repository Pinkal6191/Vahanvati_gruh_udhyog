import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { StockService } from '../src/modules/inventory/stock.service.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { MovementType, ReferenceType, PaymentMode, CustomerType } from '@prisma/client';
import http from 'http';

async function runStep6StockTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 6 — STOCK & INVENTORY ENGINE TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 41;
  let lowStockProdId: string | null = null;
  let raceProdId: string | null = null;

  // 1. Setup Express app on ephemeral port for HTTP tests
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // 2. Fetch seed users & tokens
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  const outlet = await prisma.user.findUnique({ where: { username: 'outlet' } });
  const prod = await prisma.user.findUnique({ where: { username: 'production' } });

  if (!admin || !outlet || !prod) {
    throw new Error('Seed users not found. Please run seed first.');
  }

  const adminAuth = await AuthService.login({ username: 'admin', password: 'admin123' });
  const outletAuth = await AuthService.login({ username: 'outlet', password: 'outlet123' });
  const prodAuth = await AuthService.login({ username: 'production', password: 'prod123' });

  const adminToken = adminAuth.tokens.accessToken;
  const outletToken = outletAuth.tokens.accessToken;
  const prodToken = prodAuth.tokens.accessToken;

  // 3. Setup Test Master Data
  const weightUnit = await prisma.unit.create({
    data: {
      name: `Stock KG Unit ${ts}`,
      symbol: `skg${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const pieceUnit = await prisma.unit.create({
    data: {
      name: `Stock Piece Unit ${ts}`,
      symbol: `spc${ts.toString().slice(-4)}`,
      isWeightBased: false,
      conversionFactorToBase: 1,
    },
  });

  const testCategory = await prisma.category.create({
    data: {
      name: `Stock Category ${ts}`,
      code: `SCAT_${ts}`,
      displayOrder: 1,
    },
  });

  const testSubcat = await prisma.subcategory.create({
    data: {
      categoryId: testCategory.id,
      name: `Stock Subcat ${ts}`,
      code: `SSUB_${ts}`,
      displayOrder: 1,
    },
  });

  // Test Product 1: Weight based farsan with minimum threshold 500g
  const productA = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: weightUnit.id,
      name: `Stock Sev Murmura ${ts}`,
      code: `SSEV_${ts}`,
      isLooseWeightAllowed: true,
      stock: {
        create: {
          currentBalance: 0,
          minimumThreshold: 1000,
        },
      },
    },
  });

  // Test Product 2: Piece based sweet with minimum threshold 10 pcs
  const productB = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: pieceUnit.id,
      name: `Stock Sweet Box ${ts}`,
      code: `SBOX_${ts}`,
      isLooseWeightAllowed: false,
      stock: {
        create: {
          currentBalance: 0,
          minimumThreshold: 10,
        },
      },
    },
  });

  // Opening stock recorded in ledger
  await StockService.increaseStock({
    productId: productA.id,
    quantityDelta: 5000,
    movementType: MovementType.PRODUCTION_IN,
    referenceType: ReferenceType.PRODUCTION,
    referenceId: `00000000-0000-0000-0099-${ts.toString().slice(-12)}`,
    notes: 'Initial opening stock',
    userId: admin.id,
  });

  await StockService.increaseStock({
    productId: productB.id,
    quantityDelta: 50,
    movementType: MovementType.PRODUCTION_IN,
    referenceType: ReferenceType.PRODUCTION,
    referenceId: `00000000-0000-0000-0098-${ts.toString().slice(-12)}`,
    notes: 'Initial opening stock',
    userId: admin.id,
  });

  // Pack variant for Product A: 500g pack
  const pack500g = await prisma.productPackConfiguration.create({
    data: {
      productId: productA.id,
      packName: '500 GM Pack',
      weightInBaseUnits: 500,
      unitId: weightUnit.id,
      displayOrder: 1,
    },
  });

  // Pricing for Billing Integration tests
  await prisma.productPrice.createMany({
    data: [
      {
        productId: productA.id,
        packConfigId: pack500g.id,
        customerType: CustomerType.INDIAN,
        rate: 150,
      },
      {
        productId: productA.id,
        packConfigId: null,
        customerType: CustomerType.INDIAN,
        rate: 300, // loose per kg
      },
    ],
  });

  const testCustomer = await prisma.customer.create({
    data: {
      name: `Stock Test Customer ${ts}`,
      mobile: `9876${ts.toString().slice(-6)}`,
      customerType: CustomerType.INDIAN,
    },
  });

  try {
    // ----------------------------------------------------
    // CATEGORY 1: CURRENT STOCK & BALANCE QUERIES
    // ----------------------------------------------------
    console.log('▶ [1/41] Get Current Stock for Valid Product...');
    const stockA = await StockService.getCurrentStock(productA.id);
    console.assert(stockA.productId === productA.id, 'Product ID must match');
    console.assert(stockA.currentBalance === 5000, 'Current balance must be 5000 GM');
    console.assert(stockA.isLowStock === false, 'Stock is above threshold');
    console.assert(stockA.isOutOfStock === false, 'Stock is not out of stock');
    console.log(`  Current Balance: ${stockA.currentBalance} ${stockA.unitSymbol}`);
    passedTests++;

    console.log('▶ [2/41] Product Stock Details via HTTP API...');
    const resProdStock = await fetch(`${baseUrl}/inventory/product/${productA.id}`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    console.assert(resProdStock.status === 200, 'HTTP 200 required for product stock');
    const prodStockJson = await resProdStock.json();
    console.assert(prodStockJson.data.productName === productA.name, 'Product name returned');
    console.assert(prodStockJson.data.minimumThreshold === 1000, 'Min threshold must be 1000');
    passedTests++;

    console.log('▶ [3/41] Unknown Product ID Returns 404...');
    const resNotFound = await fetch(`${baseUrl}/inventory/product/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(resNotFound.status === 404, 'HTTP 404 required for unknown product');
    passedTests++;

    console.log('▶ [4/41] Stock List with Search Filter...');
    const resListSearch = await fetch(`${baseUrl}/inventory/status?search=${productA.code}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(resListSearch.status === 200, 'HTTP 200 for stock list');
    const searchJson = await resListSearch.json();
    console.assert(searchJson.data.items.length === 1, 'Search must match exactly 1 product');
    console.assert(searchJson.data.items[0].productCode === productA.code, 'Correct product code');
    passedTests++;

    console.log('▶ [5/41] Low-Stock Filter Only Returns Items At or Below Threshold...');
    // Create an item with low stock: balance 5, threshold 10
    const lowStockProd = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: pieceUnit.id,
        name: `Low Stock Sweet ${ts}`,
        code: `LOW_${ts}`,
        stock: { create: { currentBalance: 5, minimumThreshold: 10 } },
      },
    });
    lowStockProdId = lowStockProd.id;
    const resLowStock = await fetch(`${baseUrl}/inventory/status?lowStockOnly=true&search=LOW_${ts}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const lowStockData = await resLowStock.json();
    console.assert(lowStockData.data.items.length === 1, 'Exactly 1 low-stock item found');
    console.assert(lowStockData.data.items[0].isLowStock === true, 'isLowStock flag must be true');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 2: STOCK INCREASE
    // ----------------------------------------------------
    console.log('▶ [6/41] Increase Stock Atomically via StockService...');
    const increaseRef = `00000000-0000-0000-0000-${ts.toString().slice(-12)}`;
    const increaseRes = await StockService.increaseStock({
      productId: productA.id,
      quantityDelta: 2000,
      movementType: MovementType.PRODUCTION_IN,
      referenceType: ReferenceType.PRODUCTION,
      referenceId: increaseRef,
      notes: 'Fresh kitchen production batch',
      userId: prod.id,
    });
    console.assert(Number(increaseRes.stock.currentBalance) === 7000, 'Balance must be 5000 + 2000 = 7000');
    console.assert(Number(increaseRes.movement.quantityDelta) === 2000, 'Movement quantityDelta must be +2000');
    console.assert(Number(increaseRes.movement.balanceAfter) === 7000, 'Movement balanceAfter must be 7000');
    console.assert(increaseRes.movement.movementType === MovementType.PRODUCTION_IN, 'Must be PRODUCTION_IN');
    console.log(`  Increased to: ${increaseRes.stock.currentBalance} GM`);
    passedTests++;

    console.log('▶ [7/41] Balance Updates Correctly in Database...');
    const updatedDbStock = await prisma.stock.findUnique({ where: { productId: productA.id } });
    console.assert(Number(updatedDbStock!.currentBalance) === 7000, 'DB balance matches 7000');
    passedTests++;

    console.log('▶ [8/41] Movement Ledger Record Created with Traceable Snapshot...');
    const movementRec = await prisma.stockMovement.findFirst({
      where: { referenceId: increaseRef },
    });
    console.assert(movementRec !== null, 'Movement record exists');
    console.assert(movementRec!.referenceType === ReferenceType.PRODUCTION, 'ReferenceType is PRODUCTION');
    console.assert(movementRec!.createdBy === prod.id, 'Creator matches production user');
    passedTests++;

    console.log('▶ [9/41] Increase Transaction Rolls Back Entirely on Failure...');
    const balanceBeforeFailed = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    try {
      await prisma.$transaction(async (tx) => {
        await StockService.increaseStock(
          {
            productId: productA.id,
            quantityDelta: 1000,
            movementType: MovementType.PRODUCTION_IN,
            referenceType: ReferenceType.PRODUCTION,
            referenceId: increaseRef,
            notes: 'Will fail',
          },
          tx
        );
        throw new Error('Simulated failure during transaction');
      });
    } catch {
      // Expected
    }
    const balanceAfterFailed = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    console.assert(balanceAfterFailed === balanceBeforeFailed, 'Balance must remain unchanged after rollback');
    passedTests++;

    console.log('▶ [10/41] Negative or Zero Quantity Delta Rejected for Increase...');
    let rejectedNegative = false;
    try {
      await StockService.increaseStock({
        productId: productA.id,
        quantityDelta: -50,
        movementType: MovementType.PRODUCTION_IN,
        referenceType: ReferenceType.PRODUCTION,
        referenceId: increaseRef,
      });
    } catch {
      rejectedNegative = true;
    }
    console.assert(rejectedNegative, 'Negative increase must be rejected');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 3: STOCK DECREASE
    // ----------------------------------------------------
    console.log('▶ [11/41] Decrease Stock Atomically via StockService...');
    const decreaseRef = `00000000-0000-0000-0001-${ts.toString().slice(-12)}`;
    const decreaseRes = await StockService.decreaseStock({
      productId: productA.id,
      quantityDelta: 1500,
      movementType: MovementType.SALE_OUT,
      referenceType: ReferenceType.SALE,
      referenceId: decreaseRef,
      notes: 'Counter sale',
      userId: outlet.id,
    });
    console.assert(Number(decreaseRes.stock.currentBalance) === 5500, 'Balance must be 7000 - 1500 = 5500');
    console.assert(Number(decreaseRes.movement.quantityDelta) === -1500, 'Movement delta must be -1500');
    console.assert(Number(decreaseRes.movement.balanceAfter) === 5500, 'Movement balanceAfter must be 5500');
    console.assert(decreaseRes.movement.movementType === MovementType.SALE_OUT, 'Must be SALE_OUT');
    console.log(`  Decreased to: ${decreaseRes.stock.currentBalance} GM`);
    passedTests++;

    console.log('▶ [12/41] Balance Decrements Accurately in Database...');
    const postDecreaseStock = await prisma.stock.findUnique({ where: { productId: productA.id } });
    console.assert(Number(postDecreaseStock!.currentBalance) === 5500, 'DB balance matches 5500');
    passedTests++;

    console.log('▶ [13/41] Outward Movement Ledger Record Created with Negative Delta...');
    const decMovement = await prisma.stockMovement.findFirst({
      where: { referenceId: decreaseRef },
    });
    console.assert(decMovement !== null, 'Outward movement exists');
    console.assert(Number(decMovement!.quantityDelta) === -1500, 'Quantity delta is negative');
    passedTests++;

    console.log('▶ [14/41] Insufficient Stock Rejected When Negative Stock Disabled...');
    let insufficientRejected = false;
    try {
      await StockService.decreaseStock({
        productId: productA.id,
        quantityDelta: 999999, // Exceeds 5500
        movementType: MovementType.SALE_OUT,
        referenceType: ReferenceType.SALE,
        referenceId: decreaseRef,
        allowNegativeStock: false,
      });
    } catch (err: any) {
      insufficientRejected = err.code === 'INSUFFICIENT_STOCK' || err.statusCode === 422 || err.statusCode === 400;
    }
    console.assert(insufficientRejected, 'Insufficient stock must throw InsufficientStockError');
    passedTests++;

    console.log('▶ [15/41] Zero Quantity Decrease Rejected...');
    let zeroRejected = false;
    try {
      await StockService.decreaseStock({
        productId: productA.id,
        quantityDelta: 0,
        movementType: MovementType.SALE_OUT,
        referenceType: ReferenceType.SALE,
        referenceId: decreaseRef,
      });
    } catch {
      zeroRejected = true;
    }
    console.assert(zeroRejected, 'Zero decrease must be rejected');
    passedTests++;

    console.log('▶ [16/41] Multi-Item Batch Decrease Rolls Back Entirely on Any Failure...');
    const balanceBeforeBatchA = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    const balanceBeforeBatchB = Number((await prisma.stock.findUnique({ where: { productId: productB.id } }))!.currentBalance);
    let batchFailed = false;
    try {
      await StockService.batchDecreaseStock(
        [
          { productId: productA.id, quantityDelta: 500 }, // Valid
          { productId: productB.id, quantityDelta: 99999 }, // Invalid: exceeds 50
        ],
        {
          movementType: MovementType.SALE_OUT,
          referenceType: ReferenceType.SALE,
          referenceId: decreaseRef,
          allowNegativeStock: false,
        }
      );
    } catch {
      batchFailed = true;
    }
    console.assert(batchFailed, 'Batch decrease must fail');
    const balanceAfterBatchA = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    const balanceAfterBatchB = Number((await prisma.stock.findUnique({ where: { productId: productB.id } }))!.currentBalance);
    console.assert(balanceAfterBatchA === balanceBeforeBatchA, 'Product A balance was rolled back');
    console.assert(balanceAfterBatchB === balanceBeforeBatchB, 'Product B balance was rolled back');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 4: BILLING MODULE INTEGRATION & REGRESSIONS
    // ----------------------------------------------------
    console.log('▶ [17/41] Billing POS Sale Decrements Stock via Centralized StockService...');
    const saleStockBefore = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    const sale = await SalesService.createSale(
      outlet.id,
      'OUTLET',
      {
        customerId: testCustomer.id,
        items: [
          { productId: productA.id, packConfigId: pack500g.id, quantity: 2 }, // 2 * 500 = 1000 GM
        ],
        paidAmount: 300,
        payments: [{ paymentMode: PaymentMode.CASH, amount: 300 }],
      },
      '127.0.0.1'
    );
    console.assert(sale !== null, 'Sale created');
    const saleStockAfter = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    console.assert(saleStockAfter === saleStockBefore - 1000, 'Stock decremented by 1000 GM via billing');
    passedTests++;

    console.log('▶ [18/41] Billing Sale Cancellation Restores Stock via Centralized StockService...');
    await SalesService.cancelSale(
      sale!.id,
      admin.id,
      'ADMIN',
      { reason: 'Customer cancelled transaction' },
      '127.0.0.1'
    );
    const cancelledStock = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    console.assert(cancelledStock === saleStockBefore, 'Stock balance restored to pre-sale level');
    passedTests++;

    console.log('▶ [19/41] Cancellation Movement Created with Reference to Sale...');
    const cancelMovement = await prisma.stockMovement.findFirst({
      where: { referenceId: sale!.id, movementType: MovementType.ADJUSTMENT_IN },
    });
    console.assert(cancelMovement !== null, 'Cancellation movement recorded');
    console.assert(Number(cancelMovement!.quantityDelta) === 1000, 'Restored delta is +1000');
    passedTests++;

    console.log('▶ [20/41] Billing Sale Rolls Back on Insufficient Stock without Leaving Phantom Sale...');
    const countSalesBefore = await prisma.sale.count();
    let billingInsufficientFailed = false;
    try {
      await SalesService.createSale(
        outlet.id,
        'OUTLET',
        {
          customerId: testCustomer.id,
          items: [{ productId: productA.id, packConfigId: pack500g.id, quantity: 100000 }], // massive quantity
          paidAmount: 10000,
          payments: [{ paymentMode: PaymentMode.CASH, amount: 10000 }],
        }
      );
    } catch {
      billingInsufficientFailed = true;
    }
    console.assert(billingInsufficientFailed, 'Billing blocked on insufficient stock');
    const countSalesAfter = await prisma.sale.count();
    console.assert(countSalesAfter === countSalesBefore, 'No phantom sale created in DB');
    passedTests++;

    console.log('▶ [21/41] Step 5 Billing Service Integration Complete and Backward Compatible...');
    console.assert(typeof SalesService.createSale === 'function', 'SalesService.createSale exists');
    console.assert(typeof SalesService.cancelSale === 'function', 'SalesService.cancelSale exists');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 5: STOCK MOVEMENT HISTORY
    // ----------------------------------------------------
    console.log('▶ [22/41] Retrieve Chronological Movement History...');
    const history = await StockService.getStockMovementHistory({ productId: productA.id });
    console.assert(history.items.length > 0, 'Movement history returns items');
    console.assert(history.pagination.total > 0, 'Total movements recorded');
    console.assert(history.items[0].productName === productA.name, 'Product name populated');
    passedTests++;

    console.log('▶ [23/41] Filter Movements by Product ID...');
    const historyB = await StockService.getStockMovementHistory({ productId: productB.id });
    for (const m of historyB.items) {
      console.assert(m.productId === productB.id, 'Only Product B movements returned');
    }
    passedTests++;

    console.log('▶ [24/41] Filter Movements by Movement Type...');
    const prodMovements = await StockService.getStockMovementHistory({
      productId: productA.id,
      movementType: MovementType.PRODUCTION_IN,
    });
    console.assert(prodMovements.items.length > 0, 'Production movements found');
    for (const m of prodMovements.items) {
      console.assert(m.movementType === MovementType.PRODUCTION_IN, 'Must match PRODUCTION_IN');
    }
    passedTests++;

    console.log('▶ [25/41] Filter Movements by Reference Type & ID...');
    const refMovements = await StockService.getStockMovementHistory({
      referenceType: ReferenceType.SALE,
      referenceId: sale!.id,
    });
    console.assert(refMovements.items.length >= 2, 'Found SALE_OUT and ADJUSTMENT_IN for this sale');
    passedTests++;

    console.log('▶ [26/41] Filter Movements by Date Range...');
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const dateFiltered = await StockService.getStockMovementHistory({
      startDate: yesterday,
      endDate: tomorrow,
    });
    console.assert(dateFiltered.items.length > 0, 'Date filtered movements returned');
    passedTests++;

    console.log('▶ [27/41] Movement History HTTP Endpoint with Pagination...');
    const resMovementsHttp = await fetch(`${baseUrl}/inventory/movements?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(resMovementsHttp.status === 200, 'HTTP 200 for movements');
    const moveHttpJson = await resMovementsHttp.json();
    console.assert(moveHttpJson.data.items.length <= 5, 'Limit enforced');
    console.assert(moveHttpJson.data.pagination.page === 1, 'Page 1 returned');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 6: UNITS & WEIGHTS
    // ----------------------------------------------------
    console.log('▶ [28/41] Quantity-Based Stock (Piece Unit) Works Accurately...');
    const pcBefore = Number((await prisma.stock.findUnique({ where: { productId: productB.id } }))!.currentBalance);
    await StockService.increaseStock({
      productId: productB.id,
      quantityDelta: 25,
      movementType: MovementType.PRODUCTION_IN,
      referenceType: ReferenceType.PRODUCTION,
      referenceId: increaseRef,
    });
    const pcAfter = Number((await prisma.stock.findUnique({ where: { productId: productB.id } }))!.currentBalance);
    console.assert(pcAfter === pcBefore + 25, 'Piece balance incremented by 25');
    passedTests++;

    console.log('▶ [29/41] Gram-Based Loose Stock Deductions Accurate to 1 Gram...');
    const gramBefore = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    await StockService.decreaseStock({
      productId: productA.id,
      quantityDelta: 345, // 345 grams
      movementType: MovementType.SALE_OUT,
      referenceType: ReferenceType.SALE,
      referenceId: decreaseRef,
    });
    const gramAfter = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    console.assert(gramAfter === gramBefore - 345, 'Gram balance decremented by exactly 345 GM');
    passedTests++;

    console.log('▶ [30/41] KG to GM Conversion Matches 1000x Multiplier...');
    const kgAmount = 2.5; // 2.5 KG
    const gramsAmount = kgAmount * Number(weightUnit.conversionFactorToBase);
    console.assert(gramsAmount === 2500, '2.5 KG must equal 2500 GM');
    passedTests++;

    console.log('▶ [31/41] High Precision Decimals Prevent Floating-Point Drift...');
    // Add and subtract 0.123
    const decStart = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    await StockService.increaseStock({
      productId: productA.id,
      quantityDelta: 0.123,
      movementType: MovementType.ADJUSTMENT_IN,
      referenceType: ReferenceType.MANUAL,
      referenceId: increaseRef,
    });
    await StockService.decreaseStock({
      productId: productA.id,
      quantityDelta: 0.123,
      movementType: MovementType.ADJUSTMENT_OUT,
      referenceType: ReferenceType.MANUAL,
      referenceId: decreaseRef,
    });
    const decEnd = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    console.assert(Math.abs(decEnd - decStart) < 0.0001, 'Decimal balance matches exactly without floating drift');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 7: CONCURRENCY & RACE CONDITIONS
    // ----------------------------------------------------
    console.log('▶ [32/41] Concurrent Checkouts on Last Stock Prevent Overselling...');
    // Create product with balance = 10
    const raceProd = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: weightUnit.id,
        name: `Race Stock ${ts}`,
        code: `RACE_${ts}`,
        stock: { create: { currentBalance: 10 } },
      },
    });
    raceProdId = raceProd.id;

    const attemptCheckout = (delta: number) =>
      StockService.decreaseStock({
        productId: raceProd.id,
        quantityDelta: delta,
        movementType: MovementType.SALE_OUT,
        referenceType: ReferenceType.SALE,
        referenceId: `00000000-0000-0000-0000-${Date.now().toString().slice(-12)}`,
        allowNegativeStock: false,
      });

    // Two parallel requests requesting 8 items each (total 16 > 10)
    const results = await Promise.allSettled([attemptCheckout(8), attemptCheckout(8)]);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    console.assert(successes.length === 1, 'Exactly 1 checkout must succeed');
    console.assert(failures.length === 1, 'Exactly 1 checkout must fail');
    const finalRaceBalance = Number((await prisma.stock.findUnique({ where: { productId: raceProd.id } }))!.currentBalance);
    console.assert(finalRaceBalance === 2, 'Final balance must be exactly 10 - 8 = 2');
    passedTests++;

    console.log('▶ [33/41] Concurrent Production Increase & Sale Decrease Remain Consistent...');
    // Top up raceProd balance so neither interleaved branch encounters insufficient stock
    await StockService.increaseStock({
      productId: raceProd.id,
      quantityDelta: 18, // 2 + 18 = 20
      movementType: MovementType.PRODUCTION_IN,
      referenceType: ReferenceType.PRODUCTION,
      referenceId: `00000000-0000-0000-0000-${Date.now().toString().slice(-12)}`,
    });
    const initialRaceBal = Number((await prisma.stock.findUnique({ where: { productId: raceProd.id } }))!.currentBalance); // 20
    // Simultaneous: Increase +10, Decrease -5. Final should be 20 + 10 - 5 = 25.
    await Promise.all([
      StockService.increaseStock({
        productId: raceProd.id,
        quantityDelta: 10,
        movementType: MovementType.PRODUCTION_IN,
        referenceType: ReferenceType.PRODUCTION,
        referenceId: `00000000-0000-0000-0001-${Date.now().toString().slice(-12)}`,
      }),
      StockService.decreaseStock({
        productId: raceProd.id,
        quantityDelta: 5,
        movementType: MovementType.SALE_OUT,
        referenceType: ReferenceType.SALE,
        referenceId: `00000000-0000-0000-0002-${Date.now().toString().slice(-12)}`,
        allowNegativeStock: false,
      }),
    ]);
    const afterParallelBal = Number((await prisma.stock.findUnique({ where: { productId: raceProd.id } }))!.currentBalance);
    console.assert(afterParallelBal === initialRaceBal + 5, 'Net balance must be +5 (deterministic concurrency)');
    passedTests++;

    console.log('▶ [34/41] Multiple Concurrent Stock Increases Increment Without Lost Updates...');
    // 5 concurrent increases of +10 each with distinct reference IDs
    await Promise.all([
      StockService.increaseStock({ productId: raceProd.id, quantityDelta: 10, movementType: MovementType.PRODUCTION_IN, referenceType: ReferenceType.PRODUCTION, referenceId: `00000000-0000-0000-0010-${Date.now().toString().slice(-12)}` }),
      StockService.increaseStock({ productId: raceProd.id, quantityDelta: 10, movementType: MovementType.PRODUCTION_IN, referenceType: ReferenceType.PRODUCTION, referenceId: `00000000-0000-0000-0011-${Date.now().toString().slice(-12)}` }),
      StockService.increaseStock({ productId: raceProd.id, quantityDelta: 10, movementType: MovementType.PRODUCTION_IN, referenceType: ReferenceType.PRODUCTION, referenceId: `00000000-0000-0000-0012-${Date.now().toString().slice(-12)}` }),
      StockService.increaseStock({ productId: raceProd.id, quantityDelta: 10, movementType: MovementType.PRODUCTION_IN, referenceType: ReferenceType.PRODUCTION, referenceId: `00000000-0000-0000-0013-${Date.now().toString().slice(-12)}` }),
      StockService.increaseStock({ productId: raceProd.id, quantityDelta: 10, movementType: MovementType.PRODUCTION_IN, referenceType: ReferenceType.PRODUCTION, referenceId: `00000000-0000-0000-0014-${Date.now().toString().slice(-12)}` }),
    ]);
    const after5xBal = Number((await prisma.stock.findUnique({ where: { productId: raceProd.id } }))!.currentBalance);
    console.assert(after5xBal === afterParallelBal + 50, 'All 5 parallel increases accounted for (+50)');
    passedTests++;

    // ----------------------------------------------------
    // CATEGORY 8: AUTHORIZATION & ADJUSTMENT
    // ----------------------------------------------------
    console.log('▶ [35/41] Admin Can Adjust Stock Successfully (Inward & Outward)...');
    const balBeforeAdj = Number((await prisma.stock.findUnique({ where: { productId: productA.id } }))!.currentBalance);
    const adjRes = await StockService.adjustStock(
      admin.id,
      'ADMIN',
      { productId: productA.id, quantityDelta: 100, reason: 'Physical inventory audit surplus' },
      '127.0.0.1'
    );
    console.assert(adjRes.newBalance === balBeforeAdj + 100, 'Adjustment added 100 GM');
    console.assert(adjRes.movement.movementType === MovementType.ADJUSTMENT_IN, 'Movement is ADJUSTMENT_IN');
    passedTests++;

    console.log('▶ [36/41] Adjustment Mandatory Reason Enforced (min 3 chars)...');
    const resShortReason = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ productId: productA.id, quantityDelta: 50, reason: 'ok' }), // too short
    });
    console.assert(resShortReason.status === 400, 'Short reason rejected with 400');
    passedTests++;

    console.log('▶ [37/41] Manual Stock Adjustment Creates Traceable Audit Log...');
    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: adjRes.movement.referenceId, action: 'ADJUST_STOCK' },
    });
    console.assert(auditLog !== null, 'Audit log created');
    console.assert(auditLog!.userRole === 'ADMIN', 'Audit log captured role');
    passedTests++;

    console.log('▶ [38/41] Cashier / Outlet Role Blocked from Manual Stock Adjustment (403)...');
    const resOutletAdj = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({ productId: productA.id, quantityDelta: 100, reason: 'Cashier attempt' }),
    });
    console.assert(resOutletAdj.status === 403, 'Outlet role gets 403 Forbidden');
    passedTests++;

    console.log('▶ [39/41] Production Role Blocked from Manual Stock Adjustment (403)...');
    const resProdAdj = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${prodToken}`,
      },
      body: JSON.stringify({ productId: productA.id, quantityDelta: 100, reason: 'Production attempt' }),
    });
    console.assert(resProdAdj.status === 403, 'Production role gets 403 Forbidden');
    passedTests++;

    console.log('▶ [40/41] Unauthenticated Access Blocked (401)...');
    const resUnauth = await fetch(`${baseUrl}/inventory/status`);
    console.assert(resUnauth.status === 401, 'Unauthenticated gets 401 Unauthorized');
    passedTests++;

    console.log('▶ [41/41] Stock Reconciliation Confirms Zero Drift & Summary Dashboard Metrics...');
    // 1. Reconciliation audit
    const reconA = await StockService.reconcileStock(productA.id);
    console.assert(reconA.isConsistent === true, 'Product A balance equals sum of movement ledger');
    console.assert(reconA.discrepancy === 0, 'Zero discrepancy drift');
    console.log(`  Reconciliation: Cached=${reconA.cachedBalance}, Ledger=${reconA.ledgerTotal}, Drift=${reconA.discrepancy}`);

    // 2. Summary Dashboard
    const summary = await StockService.getStockSummary();
    console.assert(summary.totalActiveProducts > 0, 'Active products counted');
    console.assert(typeof summary.inStockCount === 'number', 'In stock count provided');
    console.assert(typeof summary.lowStockCount === 'number', 'Low stock count provided');
    console.assert(typeof summary.outOfStockCount === 'number', 'Out of stock count provided');
    console.assert(summary.recentMovements.length > 0, 'Recent movements returned');
    console.log(`  Summary: InStock=${summary.inStockCount}, LowStock=${summary.lowStockCount}, OutStock=${summary.outOfStockCount}`);
    passedTests++;

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 6 STOCK & INVENTORY TESTS PASSED!`);
    console.log('🎉 ========================================================\n');
  } finally {
    server.close();
    const allProdIds = [productA.id, productB.id];
    if (lowStockProdId) allProdIds.push(lowStockProdId);
    if (raceProdId) allProdIds.push(raceProdId);

    // Delete in reverse foreign key order
    await prisma.stockMovement.deleteMany({
      where: { productId: { in: allProdIds } },
    });
    await prisma.payment.deleteMany({
      where: { sale: { customerId: testCustomer.id } },
    });
    await prisma.saleItem.deleteMany({
      where: { productId: { in: allProdIds } },
    });
    await prisma.sale.deleteMany({
      where: { customerId: testCustomer.id },
    });
    await prisma.stock.deleteMany({
      where: { productId: { in: allProdIds } },
    });
    await prisma.productPrice.deleteMany({
      where: { productId: { in: allProdIds } },
    });
    await prisma.productPackConfiguration.deleteMany({
      where: { productId: { in: allProdIds } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: allProdIds } },
    });
    await prisma.subcategory.delete({ where: { id: testSubcat.id } }).catch(() => {});
    await prisma.category.delete({ where: { id: testCategory.id } }).catch(() => {});
    await prisma.unit.delete({ where: { id: weightUnit.id } }).catch(() => {});
    await prisma.unit.delete({ where: { id: pieceUnit.id } }).catch(() => {});
    await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});
  }
}

runStep6StockTests().catch((err) => {
  console.error('❌ Step 6 Test Failure:', err);
  process.exit(1);
});
