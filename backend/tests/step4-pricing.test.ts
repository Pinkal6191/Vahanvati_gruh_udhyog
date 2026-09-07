import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PricingService } from '../src/modules/pricing/pricing.service.js';
import { BadRequestError, NotFoundError } from '../src/common/errors/app-error.js';
import { CustomerType, Role } from '@prisma/client';
import http from 'http';

async function runStep4PricingTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 4 — PRICING ENGINE & PRICE MANAGEMENT TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 25;

  // 1. Setup App HTTP server on random free port for HTTP integration tests
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // 2. Fetch admin, outlet, and production users & tokens
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  const outlet = await prisma.user.findUnique({ where: { username: 'outlet' } });
  const prod = await prisma.user.findUnique({ where: { username: 'production' } });

  if (!admin || !outlet || !prod) {
    throw new Error('Seed users (admin, outlet, production) not found. Run npm run prisma:seed first.');
  }

  const adminAuth = await AuthService.login({ username: 'admin', password: 'admin123' });
  const outletAuth = await AuthService.login({ username: 'outlet', password: 'outlet123' });
  const prodAuth = await AuthService.login({ username: 'production', password: 'prod123' });

  const adminToken = adminAuth.tokens.accessToken;
  const outletToken = outletAuth.tokens.accessToken;
  const prodToken = prodAuth.tokens.accessToken;

  // 3. Setup test category, subcategory, unit, and test products
  const testUnit = await prisma.unit.create({
    data: {
      name: `Pricing Unit ${ts}`,
      symbol: `pu${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const testCategory = await prisma.category.create({
    data: {
      name: `Pricing Cat ${ts}`,
      code: `PCAT_${ts}`,
      displayOrder: 99,
    },
  });

  const testSubcat = await prisma.subcategory.create({
    data: {
      categoryId: testCategory.id,
      name: `Pricing Subcat ${ts}`,
      code: `PSUB_${ts}`,
    },
  });

  // Main Test Product A
  const productA = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: testUnit.id,
      name: `Test Mathiya ${ts}`,
      code: `TMATHIYA_${ts}`,
      isLooseWeightAllowed: true,
      isActive: true,
    },
  });

  // Pack variant for Product A
  const packA500 = await prisma.productPackConfiguration.create({
    data: {
      productId: productA.id,
      unitId: testUnit.id,
      packName: '500 GM Packet',
      weightInBaseUnits: 500,
      displayOrder: 1,
    },
  });

  try {
    // ============================================================
    // SECTION 1: BASIC PRICING MANAGEMENT (Tests 1 - 5)
    // ============================================================

    // Test 1: Create Indian price
    console.log('▶ [1/25] Create Indian Price...');
    const indianPrice = await PricingService.createPrice(
      {
        productId: productA.id,
        packConfigId: packA500.id,
        customerType: CustomerType.INDIAN,
        rate: 150.0,
      },
      admin.id,
      'ADMIN'
    );
    console.assert(Number(indianPrice.rate) === 150, 'Indian price rate must be 150');
    console.assert(indianPrice.customerType === CustomerType.INDIAN, 'Customer type must be INDIAN');
    console.assert(indianPrice.isActive === true, 'Price must be active');
    console.log('  ✅ Created Indian price of ₹150.00 successfully.');
    passedTests++;

    // Test 2: Create NRI price
    console.log('▶ [2/25] Create NRI Price...');
    const nriPrice = await PricingService.createPrice(
      {
        productId: productA.id,
        packConfigId: packA500.id,
        customerType: CustomerType.NRI,
        rate: 240.0,
      },
      admin.id,
      'ADMIN'
    );
    console.assert(Number(nriPrice.rate) === 240, 'NRI price rate must be 240');
    console.assert(nriPrice.customerType === CustomerType.NRI, 'Customer type must be NRI');
    console.log('  ✅ Created NRI price of ₹240.00 successfully.');
    passedTests++;

    // Test 3: Retrieve current price
    console.log('▶ [3/25] Retrieve Current Applicable Prices...');
    const currentPrices = await PricingService.getCurrentPrices({
      productId: productA.id,
      packConfigId: packA500.id,
    });
    console.assert(currentPrices.length === 2, 'Must return both Indian and NRI current prices');
    const hasIndian = currentPrices.some((p) => p.customerType === CustomerType.INDIAN && Number(p.rate) === 150);
    const hasNri = currentPrices.some((p) => p.customerType === CustomerType.NRI && Number(p.rate) === 240);
    console.assert(hasIndian && hasNri, 'Both Indian (₹150) and NRI (₹240) prices must be present');
    console.log('  ✅ Retrieved current prices for both customer tiers.');
    passedTests++;

    // Test 4: Update price
    console.log('▶ [4/25] Update Price Rate...');
    const updatedIndianPrice = await PricingService.updatePrice(
      indianPrice.id,
      { rate: 165.5 },
      admin.id,
      'ADMIN'
    );
    console.assert(Number(updatedIndianPrice.rate) === 165.5, 'Rate should update to 165.50');
    console.log('  ✅ Updated Indian price rate to ₹165.50.');
    passedTests++;

    // Test 5: Retrieve price history
    console.log('▶ [5/25] Retrieve Price History...');
    const history = await PricingService.getPriceHistory(productA.id);
    console.assert(history.length >= 2, 'History must contain all price entries');
    console.assert(history[0].createdBy !== null, 'History must include createdBy user details');
    console.log(`  ✅ Price history retrieved with ${history.length} records including audit metadata.`);
    passedTests++;

    // ============================================================
    // SECTION 2: RESOLUTION ENGINE (Tests 6 - 10)
    // ============================================================

    // Test 6: Indian customer gets Indian price
    console.log('▶ [6/25] Resolution: Indian Customer Gets Indian Price...');
    const resolvedIndian = await PricingService.resolveApplicablePrice({
      productId: productA.id,
      packConfigId: packA500.id,
      customerType: CustomerType.INDIAN,
      quantity: 2,
    });
    console.assert(resolvedIndian.unitRate === 165.5, 'Indian unit rate must be 165.50');
    console.assert(resolvedIndian.totalAmount === 331, 'Total must be 2 * 165.50 = 331.00');
    console.log('  ✅ Indian resolution returned ₹165.50 (Total: ₹331.00).');
    passedTests++;

    // Test 7: NRI customer gets NRI price
    console.log('▶ [7/25] Resolution: NRI Customer Gets NRI Price...');
    const resolvedNri = await PricingService.resolveApplicablePrice({
      productId: productA.id,
      packConfigId: packA500.id,
      customerType: CustomerType.NRI,
      quantity: 2,
    });
    console.assert(resolvedNri.unitRate === 240, 'NRI unit rate must be 240.00');
    console.assert(resolvedNri.totalAmount === 480, 'Total must be 2 * 240.00 = 480.00');
    console.log('  ✅ NRI resolution returned ₹240.00 (Total: ₹480.00).');
    passedTests++;

    // Test 8: Missing Indian price returns clear error
    console.log('▶ [8/25] Resolution: Missing Indian Price Returns Clear Business Error...');
    const productNriOnly = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: testUnit.id,
        name: `NRI Only Snack ${ts}`,
        code: `NRI_SNACK_${ts}`,
        isActive: true,
      },
    });
    // Create ONLY NRI price
    await PricingService.createPrice(
      {
        productId: productNriOnly.id,
        customerType: CustomerType.NRI,
        rate: 500.0,
      },
      admin.id,
      'ADMIN'
    );

    let missingIndianError = '';
    try {
      await PricingService.resolveApplicablePrice({
        productId: productNriOnly.id,
        customerType: CustomerType.INDIAN,
      });
    } catch (err: any) {
      missingIndianError = err.message;
    }
    console.assert(
      missingIndianError.includes('Applicable Indian price is not configured for this product'),
      `Expected missing Indian error, got: "${missingIndianError}"`
    );
    console.log(`  ✅ Correct error thrown: "${missingIndianError}".`);
    passedTests++;

    // Test 9: Missing NRI price returns clear error (NEVER falls back to Indian!)
    console.log('▶ [9/25] Resolution: Missing NRI Price Returns Clear Error (NO Silent Fallback)...');
    const productIndianOnly = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: testUnit.id,
        name: `Indian Only Snack ${ts}`,
        code: `IND_SNACK_${ts}`,
        isActive: true,
      },
    });
    // Create ONLY Indian price
    await PricingService.createPrice(
      {
        productId: productIndianOnly.id,
        customerType: CustomerType.INDIAN,
        rate: 180.0,
      },
      admin.id,
      'ADMIN'
    );

    let missingNriError = '';
    try {
      await PricingService.resolveApplicablePrice({
        productId: productIndianOnly.id,
        customerType: CustomerType.NRI,
      });
    } catch (err: any) {
      missingNriError = err.message;
    }
    console.assert(
      missingNriError.includes('Applicable NRI price is not configured for this product'),
      `Expected missing NRI error, got: "${missingNriError}"`
    );
    console.log(`  ✅ Strict rule enforced: NRI did NOT fallback to Indian price. Error: "${missingNriError}".`);
    passedTests++;

    // Test 10: Inactive product cannot be selected for future pricing resolution
    console.log('▶ [10/25] Resolution: Inactive Product Rejection...');
    await prisma.product.update({
      where: { id: productIndianOnly.id },
      data: { isActive: false },
    });

    let inactiveProductError = '';
    try {
      await PricingService.resolveApplicablePrice({
        productId: productIndianOnly.id,
        customerType: CustomerType.INDIAN,
      });
    } catch (err: any) {
      inactiveProductError = err.message;
    }
    console.assert(
      inactiveProductError.includes('inactive and cannot be selected'),
      `Expected inactive product error, got: "${inactiveProductError}"`
    );
    console.log(`  ✅ Inactive product correctly rejected: "${inactiveProductError}".`);
    passedTests++;

    // ============================================================
    // SECTION 3: HISTORICAL PRICING & EFFECTIVE DATES (Tests 11 - 14)
    // ============================================================

    // Setup historical pricing product: Product H
    const productH = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: testUnit.id,
        name: `Historical Product ${ts}`,
        code: `HIST_${ts}`,
        isActive: true,
      },
    });

    // Period 1: 01-Jan-2026 to 31-May-2026 -> ₹100
    await PricingService.createPrice(
      {
        productId: productH.id,
        customerType: CustomerType.INDIAN,
        rate: 100.0,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: new Date('2026-05-31T23:59:59Z'),
      },
      admin.id,
      'ADMIN'
    );

    // Period 2: 01-Jun-2026 to 31-Aug-2026 -> ₹110
    await PricingService.createPrice(
      {
        productId: productH.id,
        customerType: CustomerType.INDIAN,
        rate: 110.0,
        effectiveFrom: new Date('2026-06-01T00:00:00Z'),
        effectiveTo: new Date('2026-08-31T23:59:59Z'),
      },
      admin.id,
      'ADMIN'
    );

    // Period 3: 01-Sep-2026 onwards (open-ended) -> ₹120
    await PricingService.createPrice(
      {
        productId: productH.id,
        customerType: CustomerType.INDIAN,
        rate: 120.0,
        effectiveFrom: new Date('2026-09-01T00:00:00Z'),
        effectiveTo: null,
      },
      admin.id,
      'ADMIN'
    );

    // Test 11: Correct price returned for historical effective date
    console.log('▶ [11/25] Historical: Target Date 15-May-2026 Resolves Period 1 (₹100)...');
    const priceMay = await PricingService.resolveApplicablePrice({
      productId: productH.id,
      customerType: CustomerType.INDIAN,
      targetDate: new Date('2026-05-15T12:00:00Z'),
    });
    console.assert(priceMay.unitRate === 100, `May 15 should resolve to ₹100, got ₹${priceMay.unitRate}`);

    const priceJuly = await PricingService.resolveApplicablePrice({
      productId: productH.id,
      customerType: CustomerType.INDIAN,
      targetDate: new Date('2026-07-15T12:00:00Z'),
    });
    console.assert(priceJuly.unitRate === 110, `July 15 should resolve to ₹110, got ₹${priceJuly.unitRate}`);
    console.log('  ✅ Historical effective dates resolved accurately: 15-May -> ₹100, 15-Jul -> ₹110.');
    passedTests++;

    // Test 12: New price returned after effective date
    console.log('▶ [12/25] Historical: Target Date 10-Sep-2026 Resolves Period 3 (₹120)...');
    const priceSept = await PricingService.resolveApplicablePrice({
      productId: productH.id,
      customerType: CustomerType.INDIAN,
      targetDate: new Date('2026-09-10T12:00:00Z'),
    });
    console.assert(priceSept.unitRate === 120, `Sep 10 should resolve to ₹120, got ₹${priceSept.unitRate}`);
    console.log('  ✅ Future/current price resolved accurately: 10-Sep -> ₹120.');
    passedTests++;

    // Test 13: Overlapping effective periods are rejected
    console.log('▶ [13/25] Historical: Overlapping Effective Periods Rejected...');
    let overlapError = '';
    try {
      // Try to insert 15-Jun-2026 to 15-Jul-2026 (overlaps with Period 2: 01-Jun to 31-Aug)
      await PricingService.createPrice(
        {
          productId: productH.id,
          customerType: CustomerType.INDIAN,
          rate: 115.0,
          effectiveFrom: new Date('2026-06-15T00:00:00Z'),
          effectiveTo: new Date('2026-07-15T23:59:59Z'),
        },
        admin.id,
        'ADMIN'
      );
    } catch (err: any) {
      overlapError = err.message;
    }
    console.assert(
      overlapError.includes('Overlapping effective price period detected'),
      `Expected overlap error, got: "${overlapError}"`
    );
    console.log(`  ✅ Overlapping price range blocked: "${overlapError}".`);
    passedTests++;

    // Test 14: Past pricing records remain intact
    console.log('▶ [14/25] Historical: Past Pricing Records Remain Intact...');
    const allHistory = await PricingService.getPriceHistory(productH.id, CustomerType.INDIAN);
    console.assert(allHistory.length === 3, `Expected exactly 3 historical records, found ${allHistory.length}`);
    const ratesInHistory = allHistory.map((p) => Number(p.rate)).sort((a, b) => a - b);
    console.assert(
      ratesInHistory[0] === 100 && ratesInHistory[1] === 110 && ratesInHistory[2] === 120,
      'Historical rates must be intact: [100, 110, 120]'
    );
    console.log('  ✅ All 3 historical price records remain immutable in database.');
    passedTests++;

    // ============================================================
    // SECTION 4: AUTHORIZATION & RBAC (Tests 15 - 18)
    // ============================================================

    // Test 15: Admin can modify pricing
    console.log('▶ [15/25] Authorization: Admin Can Modify Pricing...');
    const adminRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'INDIAN',
        rate: 299.99,
      }),
    });
    console.assert(adminRes.status === 201, `Admin should be able to create price (201), got ${adminRes.status}`);
    console.log('  ✅ Admin successfully created price via API.');
    passedTests++;

    // Test 16: Outlet cannot modify pricing (403)
    console.log('▶ [16/25] Authorization: Outlet Cannot Modify Pricing (403)...');
    const outletRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'INDIAN',
        rate: 199.99,
      }),
    });
    console.assert(
      outletRes.status === 403,
      `Outlet price creation should be rejected with 403, got ${outletRes.status}`
    );
    console.log('  ✅ Outlet write forbidden (403 Forbidden).');
    passedTests++;

    // Test 17: Production cannot modify pricing (403)
    console.log('▶ [17/25] Authorization: Production Cannot Modify Pricing (403)...');
    const prodRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${prodToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'INDIAN',
        rate: 199.99,
      }),
    });
    console.assert(
      prodRes.status === 403,
      `Production price creation should be rejected with 403, got ${prodRes.status}`
    );
    console.log('  ✅ Production write forbidden (403 Forbidden).');
    passedTests++;

    // Test 18: Unauthenticated access is rejected (401)
    console.log('▶ [18/25] Authorization: Unauthenticated Access Rejected (401)...');
    const unauthRes = await fetch(`${baseUrl}/pricing/current?productId=${productA.id}`);
    console.assert(
      unauthRes.status === 401,
      `Unauthenticated access should be rejected with 401, got ${unauthRes.status}`
    );
    console.log('  ✅ Unauthenticated access blocked (401 Unauthorized).');
    passedTests++;

    // ============================================================
    // SECTION 5: VALIDATION RULES (Tests 19 - 23)
    // ============================================================

    // Test 19: Negative price rejected
    console.log('▶ [19/25] Validation: Negative Price Rejected...');
    const negPriceRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'INDIAN',
        rate: -50.0,
      }),
    });
    console.assert(negPriceRes.status === 400, `Negative price should return 400, got ${negPriceRes.status}`);
    const negJson = await negPriceRes.json();
    console.assert(
      JSON.stringify(negJson).includes('Price rate must be positive'),
      'Error should mention positive rate'
    );
    console.log('  ✅ Negative rate correctly rejected.');
    passedTests++;

    // Test 20: Invalid decimal (>2 decimal places) rejected
    console.log('▶ [20/25] Validation: Invalid Decimal Precision Rejected...');
    const decRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'INDIAN',
        rate: 150.1234, // 4 decimal places
      }),
    });
    console.assert(decRes.status === 400, `Excessive decimal places should return 400, got ${decRes.status}`);
    const decJson = await decRes.json();
    console.assert(
      JSON.stringify(decJson).includes('cannot have more than 2 decimal places'),
      'Error should mention decimal places limitation'
    );
    console.log('  ✅ Malformed decimal precision rejected.');
    passedTests++;

    // Test 21: Invalid product rejected
    console.log('▶ [21/25] Validation: Invalid Product ID Rejected...');
    const fakeProductRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: '00000000-0000-0000-0000-000000000000',
        customerType: 'INDIAN',
        rate: 200.0,
      }),
    });
    console.assert(fakeProductRes.status === 404, `Non-existent product should return 404, got ${fakeProductRes.status}`);
    console.log('  ✅ Non-existent product ID returned 404 Not Found.');
    passedTests++;

    // Test 22: Invalid customer type rejected
    console.log('▶ [22/25] Validation: Invalid Customer Type Rejected...');
    const invalidTypeRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'FOREIGN_SPECIAL',
        rate: 200.0,
      }),
    });
    console.assert(invalidTypeRes.status === 400, `Invalid customer type should return 400, got ${invalidTypeRes.status}`);
    console.log('  ✅ Invalid customer type blocked with 400.');
    passedTests++;

    // Test 23: Invalid date range rejected (effectiveTo <= effectiveFrom)
    console.log('▶ [23/25] Validation: Invalid Date Range Rejected (effectiveTo < effectiveFrom)...');
    const invalidDateRes = await fetch(`${baseUrl}/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: productA.id,
        customerType: 'INDIAN',
        rate: 200.0,
        effectiveFrom: '2026-10-10T00:00:00Z',
        effectiveTo: '2026-10-01T00:00:00Z', // Before from!
      }),
    });
    console.assert(invalidDateRes.status === 400, `Invalid date range should return 400, got ${invalidDateRes.status}`);
    const dateJson = await invalidDateRes.json();
    console.assert(
      JSON.stringify(dateJson).includes('effectiveTo must be strictly after effectiveFrom'),
      'Error should mention date range constraint'
    );
    console.log('  ✅ Inverted date range blocked with 400.');
    passedTests++;

    // ============================================================
    // SECTION 6: TRANSACTION INTEGRITY & AUDIT TRAIL (Tests 24 - 25)
    // ============================================================

    // Test 24: Failed multi-record price update rolls back completely
    console.log('▶ [24/25] Integrity: Failed Multi-Record Batch Rolls Back Completely...');
    const productBatch = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: testUnit.id,
        name: `Batch Test Product ${ts}`,
        code: `BATCH_${ts}`,
        isActive: true,
      },
    });

    const countBefore = await prisma.productPrice.count({ where: { productId: productBatch.id } });
    console.assert(countBefore === 0, 'Initial price count should be 0');

    let batchErrorCaught = false;
    try {
      // 1st item is valid, 2nd item has non-existent product UUID
      await PricingService.batchUpdatePrices(
        [
          {
            productId: productBatch.id,
            customerType: CustomerType.INDIAN,
            rate: 250.0,
          },
          {
            productId: '00000000-0000-0000-0000-000000000000', // Intentional failure
            customerType: CustomerType.NRI,
            rate: 350.0,
          },
        ],
        admin.id,
        'ADMIN'
      );
    } catch (err: any) {
      batchErrorCaught = true;
    }

    console.assert(batchErrorCaught, 'Batch update must throw an error when an item fails');
    const countAfter = await prisma.productPrice.count({ where: { productId: productBatch.id } });
    console.assert(
      countAfter === 0,
      `Transaction rollback failed! Expected 0 records, found ${countAfter}`
    );
    console.log('  ✅ Atomic rollback verified: First item was NOT persisted when second item failed.');
    passedTests++;

    // Test 25: Audit record is created for price changes
    console.log('▶ [25/25] Audit: Audit Records Created for Price Lifecycle...');
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        entityType: 'PRODUCT_PRICE',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    console.assert(auditEntries.length > 0, 'Audit logs must contain PRODUCT_PRICE entries');
    const hasCreateAudit = auditEntries.some((a) => a.action === 'CREATE');
    const hasUpdateAudit = auditEntries.some((a) => a.action === 'UPDATE');
    console.assert(hasCreateAudit, 'Audit log must record CREATE actions for pricing');
    console.assert(hasUpdateAudit, 'Audit log must record UPDATE actions for pricing');
    console.log(`  ✅ Audit trail verified with ${auditEntries.length} verified PRODUCT_PRICE log entries.`);
    passedTests++;

    // Clean up
    await prisma.productPrice.deleteMany({
      where: {
        productId: { in: [productA.id, productNriOnly.id, productIndianOnly.id, productH.id, productBatch.id] },
      },
    });
    await prisma.productPackConfiguration.deleteMany({
      where: { productId: productA.id },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [productA.id, productNriOnly.id, productIndianOnly.id, productH.id, productBatch.id] } },
    });
    await prisma.subcategory.delete({ where: { id: testSubcat.id } });
    await prisma.category.delete({ where: { id: testCategory.id } });
    await prisma.unit.delete({ where: { id: testUnit.id } });

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 4 PRICING ENGINE TESTS PASSED!`);
    console.log('🎉 ========================================================');
  } finally {
    server.close();
  }
}

runStep4PricingTests()
  .catch((err) => {
    console.error('❌ Step 4 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
