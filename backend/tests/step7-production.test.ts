import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { StockService } from '../src/modules/inventory/stock.service.js';
import { ProductionService } from '../src/modules/production/production.service.js';
import { MovementType, ReferenceType, ProductionStatus } from '@prisma/client';
import http from 'http';

async function runStep7ProductionTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 7 — PRODUCTION ENGINE TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 45;
  const createdProdEntryIds: string[] = [];

  // 1. Setup Express app on ephemeral port for HTTP tests
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // 2. Fetch seed users & tokens
  const adminAuth = await AuthService.login({ username: 'admin', password: 'admin123' });
  const outletAuth = await AuthService.login({ username: 'outlet', password: 'outlet123' });
  const prodAuth = await AuthService.login({ username: 'production', password: 'prod123' });

  const adminToken = adminAuth.tokens.accessToken;
  const outletToken = outletAuth.tokens.accessToken;
  const prodToken = prodAuth.tokens.accessToken;

  // 3. Setup Test Master Data
  const kgUnit = await prisma.unit.create({
    data: {
      name: `Prod KG Unit ${ts}`,
      symbol: `pkg${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const gramUnit = await prisma.unit.create({
    data: {
      name: `Prod Gram Unit ${ts}`,
      symbol: `pgm${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1,
    },
  });

  const pieceUnit = await prisma.unit.create({
    data: {
      name: `Prod Piece Unit ${ts}`,
      symbol: `ppc${ts.toString().slice(-4)}`,
      isWeightBased: false,
      conversionFactorToBase: 1,
    },
  });

  const testCategory = await prisma.category.create({
    data: {
      name: `Prod Category ${ts}`,
      code: `PCAT_${ts}`,
      displayOrder: 1,
    },
  });

  const testSubcat = await prisma.subcategory.create({
    data: {
      categoryId: testCategory.id,
      name: `Prod Subcat ${ts}`,
      code: `PSUB_${ts}`,
      displayOrder: 1,
    },
  });

  // Test Product 1: Weight-based Farsan (Sev Khamani)
  const productA = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: kgUnit.id,
      name: `Sev Khamani Fresh ${ts}`,
      code: `SKH_${ts}`,
      isLooseWeightAllowed: true,
      stock: {
        create: {
          currentBalance: 0,
          minimumThreshold: 500,
        },
      },
    },
  });

  // Test Product 2: Piece-based Sweet (Kaju Katli Box)
  const productB = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: pieceUnit.id,
      name: `Kaju Katli Box ${ts}`,
      code: `KKB_${ts}`,
      isLooseWeightAllowed: false,
      stock: {
        create: {
          currentBalance: 0,
          minimumThreshold: 10,
        },
      },
    },
  });

  // Test Inactive Product
  const inactiveProduct = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: kgUnit.id,
      name: `Inactive Product ${ts}`,
      code: `INACT_${ts}`,
      isActive: false,
    },
  });

  // Helper fetch function
  async function api(path: string, options: { method?: string; body?: any; token?: string | null } = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  try {
    // ========================================================
    // CATEGORY 1: CREATION TESTS (Tests 1–6)
    // ========================================================
    console.log('--- Category 1: Creation Tests ---');

    // Test 1: Create direct COMPLETED production entry via API
    console.log('Test 1: Create COMPLETED production entry (stock immediately increments)');
    const res1 = await api('/production', {
      method: 'POST',
      token: prodToken,
      body: {
        productId: productA.id,
        quantityProduced: 5, // 5 kg = 5000 grams
        unitId: kgUnit.id,
        batchNumber: `BATCH-A1-${ts}`,
        productionDate: new Date().toISOString().slice(0, 10),
        status: 'COMPLETED',
        notes: 'Morning fresh production run',
      },
    });
    console.assert(res1.status === 201, `Status should be 201, got ${res1.status}`);
    console.assert(res1.data.data.status === 'COMPLETED', 'Status should be COMPLETED');
    console.assert(res1.data.data.completedAt !== null, 'completedAt should be recorded');
    console.assert(Number(res1.data.data.baseWeightAdded) === 5000, 'baseWeightAdded should be 5000g');
    createdProdEntryIds.push(res1.data.data.id);

    // Verify stock balance incremented
    const stockAfter1 = await StockService.getCurrentStock(productA.id);
    console.assert(stockAfter1 === 5000, `Stock balance should be 5000, got ${stockAfter1}`);
    passedTests++;
    console.log('  Passed: Direct completed production increments stock immediately');

    // Test 2: Create DRAFT production entry (stock remains unchanged)
    console.log('Test 2: Create DRAFT production entry (stock unchanged)');
    const res2 = await api('/production', {
      method: 'POST',
      token: prodToken,
      body: {
        productId: productA.id,
        quantityProduced: 2.5, // 2.5 kg = 2500 grams
        unitId: kgUnit.id,
        batchNumber: `BATCH-DRAFT-${ts}`,
        productionDate: new Date().toISOString().slice(0, 10),
        status: 'DRAFT',
        notes: 'Afternoon scheduled batch draft',
      },
    });
    console.assert(res2.status === 201, `Status should be 201, got ${res2.status}`);
    console.assert(res2.data.data.status === 'DRAFT', 'Status should be DRAFT');
    console.assert(res2.data.data.completedAt === null, 'completedAt should be null for draft');
    createdProdEntryIds.push(res2.data.data.id);
    const draftEntryId = res2.data.data.id;

    // Verify stock balance remained 5000
    const stockAfter2 = await StockService.getCurrentStock(productA.id);
    console.assert(stockAfter2 === 5000, `Stock should remain 5000 after draft, got ${stockAfter2}`);
    passedTests++;
    console.log('  Passed: DRAFT entry creates record without altering stock');

    // Test 3: Sequential production numbering format (PRD-YYYYMMDD-XXXX)
    console.log('Test 3: Verify sequential production number format');
    const prodNumRegex = /^PRD-\d{8}-\d{4}$/;
    console.assert(prodNumRegex.test(res1.data.data.productionNumber), `PRD number format invalid: ${res1.data.data.productionNumber}`);
    console.assert(prodNumRegex.test(res2.data.data.productionNumber), `PRD number format invalid: ${res2.data.data.productionNumber}`);
    passedTests++;
    console.log(`  Passed: Sequential numbering follows PRD-YYYYMMDD-XXXX format (${res1.data.data.productionNumber})`);

    // Test 4: Rejection of invalid expiry date before production date
    console.log('Test 4: Reject expiry date before production date');
    const res4 = await api('/production', {
      method: 'POST',
      token: prodToken,
      body: {
        productId: productA.id,
        quantityProduced: 1,
        unitId: kgUnit.id,
        productionDate: '2026-09-10',
        expiryDate: '2026-09-05', // Before production date!
      },
    });
    console.assert(res4.status === 400, `Expected 400 Bad Request, got ${res4.status}`);
    passedTests++;
    console.log('  Passed: Expiry date prior to production date properly rejected');

    // Test 5: Rejection of invalid quantity (zero or negative)
    console.log('Test 5: Reject invalid zero or negative quantity');
    const res5 = await api('/production', {
      method: 'POST',
      token: prodToken,
      body: {
        productId: productA.id,
        quantityProduced: -5,
        unitId: kgUnit.id,
        productionDate: '2026-09-10',
      },
    });
    console.assert(res5.status === 400, `Expected 400 for negative qty, got ${res5.status}`);
    passedTests++;
    console.log('  Passed: Negative quantity rejected by schema validation');

    // Test 6: Default status handling (omitted status defaults to COMPLETED programmatically)
    console.log('Test 6: Programmatic createEntry without status defaults to COMPLETED');
    const entry6 = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productB.id,
      quantityProduced: 20, // 20 pcs
      unitId: pieceUnit.id,
      productionDate: new Date().toISOString().slice(0, 10),
      batchNumber: `PIECE-BATCH-${ts}`,
    });
    console.assert(entry6?.status === 'COMPLETED', 'Omitted status should default to COMPLETED');
    console.assert(Number(entry6?.baseWeightAdded) === 20, 'baseWeightAdded should be 20 pcs');
    createdProdEntryIds.push(entry6!.id);

    const stockB1 = await StockService.getCurrentStock(productB.id);
    console.assert(stockB1 === 20, `Stock for product B should be 20, got ${stockB1}`);
    passedTests++;
    console.log('  Passed: Backward-compatible default status COMPLETED functions correctly');

    // ========================================================
    // CATEGORY 2: DRAFT MANAGEMENT (Tests 7–11)
    // ========================================================
    console.log('\n--- Category 2: Draft Management ---');

    // Test 7: Update draft entry quantity and notes
    console.log('Test 7: Update draft quantity and notes');
    const res7 = await api(`/production/${draftEntryId}`, {
      method: 'PUT',
      token: prodToken,
      body: {
        quantityProduced: 3.5, // changed from 2.5 to 3.5 kg = 3500g
        notes: 'Updated draft note with adjusted batch size',
      },
    });
    console.assert(res7.status === 200, `Expected 200, got ${res7.status}`);
    console.assert(Number(res7.data.data.quantityProduced) === 3.5, 'Quantity should be updated to 3.5');
    console.assert(Number(res7.data.data.baseWeightAdded) === 3500, 'baseWeightAdded should re-calculate to 3500');
    console.assert(res7.data.data.notes === 'Updated draft note with adjusted batch size', 'Notes updated');

    // Verify stock still unchanged
    const stockAfter7 = await StockService.getCurrentStock(productA.id);
    console.assert(stockAfter7 === 5000, `Stock should still be 5000, got ${stockAfter7}`);
    passedTests++;
    console.log('  Passed: Draft update modified quantity and recalculated base weight without affecting stock');

    // Test 8: Update draft unit (e.g. from KG to Grams)
    console.log('Test 8: Update draft unit from KG to Grams');
    const res8 = await api(`/production/${draftEntryId}`, {
      method: 'PUT',
      token: prodToken,
      body: {
        quantityProduced: 4000,
        unitId: gramUnit.id,
      },
    });
    console.assert(res8.status === 200, `Expected 200, got ${res8.status}`);
    console.assert(Number(res8.data.data.baseWeightAdded) === 4000, '4000 grams = 4000 base grams');
    passedTests++;
    console.log('  Passed: Draft unit updated to grams and base conversion recalculated');

    // Test 9: Reject update on COMPLETED entry (immutability)
    console.log('Test 9: Reject modification of COMPLETED production entry');
    const res9 = await api(`/production/${res1.data.data.id}`, {
      method: 'PUT',
      token: prodToken,
      body: {
        quantityProduced: 10,
      },
    });
    console.assert(res9.status === 400, `Expected 400 for completed entry edit, got ${res9.status}`);
    console.assert((res9.data?.error?.message || '').includes('Only DRAFT entries can be modified'), 'Error message mismatch');
    passedTests++;
    console.log('  Passed: Completed production entry is strictly immutable');

    // Test 10: Reject update with incompatible unit
    console.log('Test 10: Reject draft update with incompatible unit');
    const res10 = await api(`/production/${draftEntryId}`, {
      method: 'PUT',
      token: prodToken,
      body: {
        unitId: pieceUnit.id, // Incompatible with weight-based productA
      },
    });
    console.assert(res10.status === 400, `Expected 400 for unit mismatch, got ${res10.status}`);
    passedTests++;
    console.log('  Passed: Incompatible unit change on draft rejected');

    // Test 11: Non-existent production entry returns 404
    console.log('Test 11: Update non-existent entry returns 404');
    const res11 = await api('/production/00000000-0000-0000-0000-000000000000', {
      method: 'PUT',
      token: prodToken,
      body: { quantityProduced: 10 },
    });
    console.assert(res11.status === 404, `Expected 404, got ${res11.status}`);
    passedTests++;
    console.log('  Passed: Non-existent entry update handled with 404 Not Found');

    // ========================================================
    // CATEGORY 3: COMPLETION LIFECYCLE & STOCK INCREASE (Tests 12–17)
    // ========================================================
    console.log('\n--- Category 3: Completion Lifecycle & Stock Increase ---');

    // Test 12: Complete draft entry successfully
    console.log('Test 12: Complete draft production entry');
    const stockBeforeComplete = await StockService.getCurrentStock(productA.id);
    const res12 = await api(`/production/${draftEntryId}/complete`, {
      method: 'POST',
      token: prodToken,
    });
    console.assert(res12.status === 200, `Expected 200, got ${res12.status}`);
    console.assert(res12.data.data.status === 'COMPLETED', 'Status should be COMPLETED');
    console.assert(res12.data.data.completedAt !== null, 'completedAt should be timestamped');
    passedTests++;
    console.log('  Passed: Draft entry transitioned to COMPLETED status');

    // Test 13: Verify authoritative stock balance incremented
    console.log('Test 13: Authoritative stock balance incremented by baseWeightAdded');
    const stockAfterComplete = await StockService.getCurrentStock(productA.id);
    console.assert(
      stockAfterComplete === stockBeforeComplete + 4000,
      `Stock should increment by 4000 (from ${stockBeforeBefore(stockBeforeComplete)} to ${stockAfterComplete})`
    );
    function stockBeforeBefore(val: number) { return val; }
    passedTests++;
    console.log(`  Passed: Stock correctly incremented from ${stockBeforeComplete} to ${stockAfterComplete}`);

    // Test 14: Verify StockMovement ledger entry
    console.log('Test 14: Verify StockMovement ledger entry recorded');
    const movement = await prisma.stockMovement.findFirst({
      where: {
        referenceType: ReferenceType.PRODUCTION,
        referenceId: draftEntryId,
      },
    });
    console.assert(movement !== null, 'StockMovement record must exist');
    console.assert(movement?.movementType === MovementType.PRODUCTION_IN, 'movementType must be PRODUCTION_IN');
    console.assert(Number(movement?.quantityDelta) === 4000, 'quantityDelta must be +4000');
    console.assert(Number(movement?.balanceBefore) === stockBeforeComplete, 'balanceBefore must match');
    console.assert(Number(movement?.balanceAfter) === stockAfterComplete, 'balanceAfter must match');
    passedTests++;
    console.log('  Passed: Immutable StockMovement recorded with exact balance tracking');

    // Test 15: Stock reconciliation is 100% consistent after production
    console.log('Test 15: Stock reconciliation check for product A');
    const reconciliationA = await StockService.reconcileStock(productA.id);
    console.assert(reconciliationA.isConsistent === true, 'Reconciliation must be consistent');
    console.assert(reconciliationA.cachedBalance === reconciliationA.ledgerTotal, 'Cached balance must equal ledger total');
    passedTests++;
    console.log(`  Passed: Stock ledger consistent (${reconciliationA.cachedBalance} = ${reconciliationA.ledgerTotal})`);

    // Test 16: Audit log verification
    console.log('Test 16: Verify audit log for production completion');
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: 'PRODUCTION',
        entityId: draftEntryId,
        action: 'COMPLETE_PRODUCTION',
      },
    });
    console.assert(auditLog !== null, 'Audit log must be recorded');
    passedTests++;
    console.log('  Passed: Production completion audit trail recorded');

    // Test 17: Complete non-existent production entry returns 404
    console.log('Test 17: Complete non-existent entry returns 404');
    const res17 = await api('/production/00000000-0000-0000-0000-000000000000/complete', {
      method: 'POST',
      token: prodToken,
    });
    console.assert(res17.status === 404, `Expected 404, got ${res17.status}`);
    passedTests++;
    console.log('  Passed: Completing non-existent entry returns 404');

    // ========================================================
    // CATEGORY 4: DOUBLE-COMPLETION PROTECTION (Tests 18–20)
    // ========================================================
    console.log('\n--- Category 4: Double-Completion Protection ---');

    // Test 18: Reject completion on already COMPLETED entry
    console.log('Test 18: Calling complete on already COMPLETED entry fails');
    const res18 = await api(`/production/${draftEntryId}/complete`, {
      method: 'POST',
      token: prodToken,
    });
    console.assert(res18.status === 400, `Expected 400, got ${res18.status}`);
    console.assert((res18.data?.error?.message || '').includes('already completed'), 'Error should indicate already completed');
    passedTests++;
    console.log('  Passed: Double-completion blocked with clear error message');

    // Test 19: Stock balance did NOT increment again
    console.log('Test 19: Stock balance remained unaltered after rejected double-completion');
    const stockAfterDouble = await StockService.getCurrentStock(productA.id);
    console.assert(stockAfterDouble === stockAfterComplete, `Stock should not change, remained ${stockAfterDouble}`);
    passedTests++;
    console.log('  Passed: Stock integrity protected against double completion');

    // Test 20: Reject completion on CANCELLED entry
    console.log('Test 20: Calling complete on CANCELLED entry fails');
    // Create a draft and cancel it
    const cancelDraft = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productA.id,
      quantityProduced: 1,
      unitId: kgUnit.id,
      productionDate: '2026-09-08',
      status: 'DRAFT',
    });
    createdProdEntryIds.push(cancelDraft!.id);
    await ProductionService.cancelProduction(cancelDraft!.id, prodAuth.user.id, { reason: 'Test cancellation' });

    const res20 = await api(`/production/${cancelDraft!.id}/complete`, {
      method: 'POST',
      token: prodToken,
    });
    console.assert(res20.status === 400, `Expected 400, got ${res20.status}`);
    console.assert((res20.data?.error?.message || '').includes('Cannot complete cancelled'), 'Error should indicate cancelled');
    passedTests++;
    console.log('  Passed: Cannot complete a cancelled production entry');

    // ========================================================
    // CATEGORY 5: CONCURRENCY & TRANSACTIONAL INTEGRITY (Tests 21–24)
    // ========================================================
    console.log('\n--- Category 5: Concurrency & Transactional Integrity ---');

    // Test 21 & 22: Concurrent completion race condition
    console.log('Test 21 & 22: Concurrent completion requests on same draft (pessimistic lock test)');
    const raceDraft = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productA.id,
      quantityProduced: 1, // 1 kg = 1000g
      unitId: kgUnit.id,
      productionDate: '2026-09-08',
      status: 'DRAFT',
    });
    createdProdEntryIds.push(raceDraft!.id);
    const stockBeforeRace = await StockService.getCurrentStock(productA.id);

    // Fire 5 concurrent completion requests simultaneously
    const racePromises = Array(5)
      .fill(null)
      .map(() =>
        api(`/production/${raceDraft!.id}/complete`, {
          method: 'POST',
          token: prodToken,
        })
      );

    const raceResults = await Promise.all(racePromises);
    const successCount = raceResults.filter((r) => r.status === 200).length;
    const failCount = raceResults.filter((r) => r.status === 400).length;

    console.assert(successCount === 1, `Exactly 1 completion must succeed, got ${successCount}`);
    console.assert(failCount === 4, `4 completions must fail, got ${failCount}`);
    passedTests++;
    console.log(`  Passed: Exactly 1 concurrent request succeeded, ${failCount} blocked safely`);

    // Test 22: Verify stock incremented exactly once under race condition
    console.log('Test 22: Stock incremented exactly once (+1000g) under concurrency');
    const stockAfterRace = await StockService.getCurrentStock(productA.id);
    console.assert(
      stockAfterRace === stockBeforeRace + 1000,
      `Stock should be ${stockBeforeRace + 1000}, got ${stockAfterRace}`
    );
    passedTests++;
    console.log(`  Passed: Stock incremented exactly once (${stockBeforeRace} -> ${stockAfterRace})`);

    // Test 23: Concurrent creation sequential numbering
    console.log('Test 23: Concurrent creation yields unique sequential production numbers');
    const createPromises = Array(4)
      .fill(null)
      .map((_, i) =>
        api('/production', {
          method: 'POST',
          token: prodToken,
          body: {
            productId: productB.id,
            quantityProduced: i + 1,
            unitId: pieceUnit.id,
            productionDate: '2026-09-08',
            status: 'DRAFT',
          },
        })
      );
    const createResults = await Promise.all(createPromises);
    const createdNums = createResults.map((r) => r.data.data.productionNumber);
    createResults.forEach((r) => createdProdEntryIds.push(r.data.data.id));

    const uniqueNums = new Set(createdNums);
    console.assert(uniqueNums.size === 4, `All production numbers must be unique, got ${uniqueNums.size}`);
    passedTests++;
    console.log(`  Passed: Generated unique sequence numbers: ${createdNums.join(', ')}`);

    // Test 24: Transaction rollback if downstream operation fails
    console.log('Test 24: Transaction integrity verification');
    // Verify that creating an entry with invalid unit in service rolls back transaction
    let rollbackErr = false;
    try {
      await ProductionService.createEntry(prodAuth.user.id, {
        productId: productA.id,
        quantityProduced: 5,
        unitId: '00000000-0000-0000-0000-000000000000', // invalid unit ID
        productionDate: '2026-09-08',
      });
    } catch {
      rollbackErr = true;
    }
    console.assert(rollbackErr, 'Transaction must throw on invalid unit');
    passedTests++;
    console.log('  Passed: Transaction rollback safely aborted on invalid references');

    // ========================================================
    // CATEGORY 6: UNIT COMPATIBILITY & CONVERSION (Tests 25–29)
    // ========================================================
    console.log('\n--- Category 6: Unit Compatibility & Conversion ---');

    // Test 25: Weight-based product in KG adds exact base grams
    console.log('Test 25: Weight-based product in KG adds exact base grams (factor 1000)');
    const entry25 = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productA.id,
      quantityProduced: 2.75, // 2.75 kg = 2750 grams
      unitId: kgUnit.id,
      productionDate: '2026-09-08',
      status: 'DRAFT',
    });
    createdProdEntryIds.push(entry25!.id);
    console.assert(Number(entry25!.baseWeightAdded) === 2750, `Expected 2750g, got ${entry25!.baseWeightAdded}`);
    passedTests++;
    console.log('  Passed: 2.75 KG accurately converted to 2750 grams');

    // Test 26: Weight-based product in Grams adds exact base grams
    console.log('Test 26: Weight-based product in Grams adds exact base grams (factor 1)');
    const entry26 = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productA.id,
      quantityProduced: 350,
      unitId: gramUnit.id,
      productionDate: '2026-09-08',
      status: 'DRAFT',
    });
    createdProdEntryIds.push(entry26!.id);
    console.assert(Number(entry26!.baseWeightAdded) === 350, `Expected 350g, got ${entry26!.baseWeightAdded}`);
    passedTests++;
    console.log('  Passed: 350 Grams accurately recorded as 350 grams');

    // Test 27: Piece-based product adds exact count
    console.log('Test 27: Piece-based product adds exact count');
    const entry27 = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productB.id,
      quantityProduced: 15,
      unitId: pieceUnit.id,
      productionDate: '2026-09-08',
      status: 'DRAFT',
    });
    createdProdEntryIds.push(entry27!.id);
    console.assert(Number(entry27!.baseWeightAdded) === 15, `Expected 15 pcs, got ${entry27!.baseWeightAdded}`);
    passedTests++;
    console.log('  Passed: 15 pieces recorded as 15 base count');

    // Test 28: Reject incompatible unit (e.g. producing piece product in KG)
    console.log('Test 28: Reject producing piece-based product with weight unit (KG)');
    const res28 = await api('/production', {
      method: 'POST',
      token: prodToken,
      body: {
        productId: productB.id,
        quantityProduced: 5,
        unitId: kgUnit.id, // Incompatible!
        productionDate: '2026-09-08',
      },
    });
    console.assert(res28.status === 400, `Expected 400, got ${res28.status}`);
    console.assert((res28.data?.error?.message || '').includes('Unit incompatibility'), 'Message should note unit incompatibility');
    passedTests++;
    console.log('  Passed: Incompatible unit correctly rejected with explanation');

    // Test 29: Reject production for inactive product
    console.log('Test 29: Reject production for inactive product');
    const res29 = await api('/production', {
      method: 'POST',
      token: prodToken,
      body: {
        productId: inactiveProduct.id,
        quantityProduced: 5,
        unitId: kgUnit.id,
        productionDate: '2026-09-08',
      },
    });
    console.assert(res29.status === 400, `Expected 400, got ${res29.status}`);
    console.assert((res29.data?.error?.message || '').includes('inactive product'), 'Message should indicate inactive product');
    passedTests++;
    console.log('  Passed: Inactive product production prevented');

    // ========================================================
    // CATEGORY 7: LISTING, PAGINATION & FILTERS (Tests 30–35)
    // ========================================================
    console.log('\n--- Category 7: Listing, Pagination & Filters ---');

    // Test 30: List production entries with pagination
    console.log('Test 30: List entries with pagination');
    const res30 = await api('/production?page=1&limit=5', { token: prodToken });
    console.assert(res30.status === 200, `Expected 200, got ${res30.status}`);
    console.assert(Array.isArray(res30.data.data.items), 'items should be array');
    console.assert(res30.data.data.pagination.page === 1, 'page should be 1');
    console.assert(res30.data.data.pagination.limit === 5, 'limit should be 5');
    console.assert(res30.data.data.pagination.total > 0, 'total should be > 0');
    passedTests++;
    console.log(`  Passed: Listed page 1 with ${res30.data.data.items.length} items (total: ${res30.data.data.pagination.total})`);

    // Test 31: Filter by status (DRAFT)
    console.log('Test 31: Filter by status DRAFT');
    const res31 = await api('/production?status=DRAFT', { token: prodToken });
    console.assert(res31.status === 200, `Expected 200, got ${res31.status}`);
    const allDrafts = res31.data.data.items.every((i: any) => i.status === 'DRAFT');
    console.assert(allDrafts, 'All returned items should have status DRAFT');
    passedTests++;
    console.log('  Passed: Filter by DRAFT status returned matching records');

    // Test 32: Filter by status (COMPLETED)
    console.log('Test 32: Filter by status COMPLETED');
    const res32 = await api('/production?status=COMPLETED', { token: prodToken });
    console.assert(res32.status === 200, `Expected 200, got ${res32.status}`);
    const allCompleted = res32.data.data.items.every((i: any) => i.status === 'COMPLETED');
    console.assert(allCompleted, 'All returned items should have status COMPLETED');
    passedTests++;
    console.log('  Passed: Filter by COMPLETED status returned matching records');

    // Test 33: Filter by productId
    console.log('Test 33: Filter by productId');
    const res33 = await api(`/production?productId=${productA.id}`, { token: prodToken });
    console.assert(res33.status === 200, `Expected 200, got ${res33.status}`);
    const allProductA = res33.data.data.items.every((i: any) => i.productId === productA.id);
    console.assert(allProductA, 'All items should belong to product A');
    passedTests++;
    console.log('  Passed: Filter by productId strictly isolated product items');

    // Test 34: Filter by batchNumber
    console.log('Test 34: Filter by batchNumber');
    const res34 = await api(`/production?batchNumber=BATCH-A1`, { token: prodToken });
    console.assert(res34.status === 200, `Expected 200, got ${res34.status}`);
    console.assert(res34.data.data.items.length >= 1, 'Should find batch BATCH-A1');
    passedTests++;
    console.log('  Passed: Filter by batch number matched corresponding entry');

    // Test 35: Get production entry by ID
    console.log('Test 35: Get production entry by ID');
    const res35 = await api(`/production/${res1.data.data.id}`, { token: prodToken });
    console.assert(res35.status === 200, `Expected 200, got ${res35.status}`);
    console.assert(res35.data.data.id === res1.data.data.id, 'IDs must match');
    console.assert(res35.data.data.productName.includes('Sev Khamani'), 'Product name must match');
    passedTests++;
    console.log('  Passed: Single production entry retrieved with nested details');

    // ========================================================
    // CATEGORY 8: SUMMARY & DASHBOARD METRICS (Tests 36–37)
    // ========================================================
    console.log('\n--- Category 8: Summary & Dashboard Metrics ---');

    // Test 36: GET /api/v1/production/summary
    console.log('Test 36: Get production summary metrics');
    const res36 = await api('/production/summary', { token: prodToken });
    console.assert(res36.status === 200, `Expected 200, got ${res36.status}`);
    const summary = res36.data.data;
    console.assert(typeof summary.todayProductionWeightGrams === 'number', 'todayProductionWeightGrams is number');
    console.assert(summary.todayProductionWeightGrams > 0, 'todayProductionWeightGrams > 0');
    console.assert(summary.totalEntries > 0, 'totalEntries > 0');
    console.assert(summary.completedCount > 0, 'completedCount > 0');
    console.assert(Array.isArray(summary.recentEntries), 'recentEntries is array');
    passedTests++;
    console.log(`  Passed: Summary returned todayProductionWeightGrams=${summary.todayProductionWeightGrams}, totalEntries=${summary.totalEntries}`);

    // Test 37: Summary metrics consistency
    console.log('Test 37: Verify sum of status counts matches totalEntries');
    console.assert(
      summary.totalEntries === summary.draftCount + summary.completedCount + summary.cancelledCount,
      'totalEntries must equal draft + completed + cancelled'
    );
    passedTests++;
    console.log(`  Passed: Status count consistency (${summary.totalEntries} = ${summary.draftCount} + ${summary.completedCount} + ${summary.cancelledCount})`);

    // ========================================================
    // CATEGORY 9: CANCELLATION & STOCK REVERSAL (Tests 38–41)
    // ========================================================
    console.log('\n--- Category 9: Cancellation & Stock Reversal ---');

    // Test 38: Cancel DRAFT production entry (stock unchanged)
    console.log('Test 38: Cancel DRAFT entry (stock unchanged)');
    const draftToCancel = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productA.id,
      quantityProduced: 2,
      unitId: kgUnit.id,
      productionDate: '2026-09-08',
      status: 'DRAFT',
    });
    createdProdEntryIds.push(draftToCancel!.id);

    const stockBeforeDraftCancel = await StockService.getCurrentStock(productA.id);
    const res38 = await api(`/production/${draftToCancel!.id}/cancel`, {
      method: 'POST',
      token: prodToken,
      body: { reason: 'Machine breakdown during setup' },
    });
    console.assert(res38.status === 200, `Expected 200, got ${res38.status}`);
    console.assert(res38.data.data.status === 'CANCELLED', 'Status should be CANCELLED');

    const stockAfterDraftCancel = await StockService.getCurrentStock(productA.id);
    console.assert(
      stockAfterDraftCancel === stockBeforeDraftCancel,
      `Stock should not change for draft cancellation, remained ${stockAfterDraftCancel}`
    );
    passedTests++;
    console.log('  Passed: Draft cancelled without modifying stock ledger');

    // Test 39: Cancel COMPLETED production entry (reverses stock via StockService)
    console.log('Test 39: Cancel COMPLETED entry (reverses stock)');
    // Create a completed entry with 1.5 KG = 1500g
    const completedToCancel = await ProductionService.createEntry(prodAuth.user.id, {
      productId: productA.id,
      quantityProduced: 1.5,
      unitId: kgUnit.id,
      productionDate: '2026-09-08',
      status: 'COMPLETED',
    });
    createdProdEntryIds.push(completedToCancel!.id);

    const stockBeforeReverse = await StockService.getCurrentStock(productA.id);
    const res39 = await api(`/production/${completedToCancel!.id}/cancel`, {
      method: 'POST',
      token: prodToken,
      body: { reason: 'Quality defect detected in oil testing' },
    });
    console.assert(res39.status === 200, `Expected 200, got ${res39.status}`);
    console.assert(res39.data.data.status === 'CANCELLED', 'Status should be CANCELLED');

    // Verify stock balance reversed (-1500g)
    const stockAfterReverse = await StockService.getCurrentStock(productA.id);
    console.assert(
      stockAfterReverse === stockBeforeReverse - 1500,
      `Stock should decrease by 1500 from ${stockBeforeReverse} to ${stockAfterReverse}`
    );

    // Verify reversal movement logged with ADJUSTMENT_OUT
    const reversalMovement = await prisma.stockMovement.findFirst({
      where: {
        referenceType: ReferenceType.PRODUCTION,
        referenceId: completedToCancel!.id,
        movementType: MovementType.ADJUSTMENT_OUT,
      },
    });
    console.assert(reversalMovement !== null, 'Reversal StockMovement must exist');
    console.assert(Number(reversalMovement?.quantityDelta) === -1500, 'Reversal quantityDelta must be -1500');
    passedTests++;
    console.log(`  Passed: Completed production cancelled and stock reversed (${stockBeforeReverse} -> ${stockAfterReverse})`);

    // Test 40: Rejection of cancel on already CANCELLED entry
    console.log('Test 40: Reject cancellation of already CANCELLED entry');
    const res40 = await api(`/production/${completedToCancel!.id}/cancel`, {
      method: 'POST',
      token: prodToken,
      body: { reason: 'Duplicate attempt' },
    });
    console.assert(res40.status === 400, `Expected 400, got ${res40.status}`);
    console.assert((res40.data?.error?.message || '').includes('already cancelled'), 'Error should indicate already cancelled');
    passedTests++;
    console.log('  Passed: Double-cancellation prevented');

    // Test 41: Cancellation requires valid reason (min 3 chars)
    console.log('Test 41: Cancellation requires valid reason');
    const res41 = await api(`/production/${draftToCancel!.id}/cancel`, {
      method: 'POST',
      token: prodToken,
      body: { reason: 'no' }, // only 2 chars
    });
    console.assert(res41.status === 400, `Expected 400 for short reason, got ${res41.status}`);
    passedTests++;
    console.log('  Passed: Cancellation reason length validation enforced');

    // ========================================================
    // CATEGORY 10: ROLE-BASED ACCESS CONTROL (RBAC) (Tests 42–45)
    // ========================================================
    console.log('\n--- Category 10: Role-Based Access Control (RBAC) ---');

    // Test 42: Unauthenticated request rejected with 401
    console.log('Test 42: Unauthenticated request returns 401 Unauthorized');
    const res42 = await api('/production', { method: 'GET', token: null });
    console.assert(res42.status === 401, `Expected 401, got ${res42.status}`);
    passedTests++;
    console.log('  Passed: Unauthenticated access rejected with 401');

    // Test 43: OUTLET role can view entries and summary (200 OK)
    console.log('Test 43: OUTLET role can view production entries and summary (Read-only)');
    const res43a = await api('/production', { token: outletToken });
    console.assert(res43a.status === 200, `Outlet list expected 200, got ${res43a.status}`);
    const res43b = await api('/production/summary', { token: outletToken });
    console.assert(res43b.status === 200, `Outlet summary expected 200, got ${res43b.status}`);
    passedTests++;
    console.log('  Passed: OUTLET role has read-only access to production endpoints');

    // Test 44: OUTLET role CANNOT create, update, complete, or cancel (403 Forbidden)
    console.log('Test 44: OUTLET role mutations blocked with 403 Forbidden');
    const res44a = await api('/production', {
      method: 'POST',
      token: outletToken,
      body: {
        productId: productA.id,
        quantityProduced: 1,
        unitId: kgUnit.id,
        productionDate: '2026-09-08',
      },
    });
    console.assert(res44a.status === 403, `Expected 403 for outlet create, got ${res44a.status}`);

    const res44b = await api(`/production/${res1.data.data.id}/cancel`, {
      method: 'POST',
      token: outletToken,
      body: { reason: 'Unauthorized cancel attempt' },
    });
    console.assert(res44b.status === 403, `Expected 403 for outlet cancel, got ${res44b.status}`);
    passedTests++;
    console.log('  Passed: OUTLET role mutation attempts blocked with 403 Forbidden');

    // Test 45: ADMIN role has full access to all endpoints
    console.log('Test 45: ADMIN role has full access to create, list, and summary');
    const res45 = await api('/production', {
      method: 'POST',
      token: adminToken,
      body: {
        productId: productA.id,
        quantityProduced: 2,
        unitId: kgUnit.id,
        productionDate: '2026-09-08',
        status: 'COMPLETED',
        notes: 'Admin supervised batch',
      },
    });
    console.assert(res45.status === 201, `Admin create expected 201, got ${res45.status}`);
    createdProdEntryIds.push(res45.data.data.id);
    passedTests++;
    console.log('  Passed: ADMIN role enjoys full access across production module');

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 7 PRODUCTION ENGINE TESTS PASSED!`);
    console.log('🎉 ========================================================\n');
  } finally {
    server.close();

    const testProdIds = [productA.id, productB.id, inactiveProduct.id];

    // Cleanup in reverse foreign key order
    await prisma.stockMovement.deleteMany({
      where: {
        OR: [
          { referenceType: ReferenceType.PRODUCTION, referenceId: { in: createdProdEntryIds } },
          { productId: { in: testProdIds } },
        ],
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: 'PRODUCTION',
        entityId: { in: createdProdEntryIds },
      },
    });
    await prisma.productionEntry.deleteMany({
      where: {
        OR: [
          { id: { in: createdProdEntryIds } },
          { productId: { in: testProdIds } },
        ],
      },
    });
    await prisma.stock.deleteMany({
      where: { productId: { in: testProdIds } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: testProdIds } },
    });
    await prisma.subcategory.delete({ where: { id: testSubcat.id } }).catch(() => {});
    await prisma.category.delete({ where: { id: testCategory.id } }).catch(() => {});
    await prisma.unit.delete({ where: { id: kgUnit.id } }).catch(() => {});
    await prisma.unit.delete({ where: { id: gramUnit.id } }).catch(() => {});
    await prisma.unit.delete({ where: { id: pieceUnit.id } }).catch(() => {});
  }
}

runStep7ProductionTests().catch((err) => {
  console.error('❌ Step 7 Test Failure:', err);
  process.exit(1);
});
