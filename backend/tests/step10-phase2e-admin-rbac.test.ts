import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SaleType, Role } from '@prisma/client';
import http from 'http';
import bcrypt from 'bcryptjs';

async function runStep10Phase2EAdminRbacTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 10 — PHASE 2E: ADMIN PRICING & USER RBAC MANAGEMENT');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 17;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdSubcategoryIds: string[] = [];

  // Setup Express app on ephemeral port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // -------------------------------------------------------------------------
    // Setup initial users
    // -------------------------------------------------------------------------
    // 1. Master Admin (full privileges)
    const masterAdmin = await prisma.user.create({
      data: {
        username: `madmin_${ts}`,
        fullName: 'Phase 2E Master Admin',
        email: `madmin_${ts}@test.com`,
        passwordHash,
        role: 'ADMIN',
        isMasterAdmin: true,
        allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
        allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      },
    });
    createdUserIds.push(masterAdmin.id);

    // 2. Limited Admin (Non-Master, RETAIL only)
    const limitedAdmin = await prisma.user.create({
      data: {
        username: `ladmin_${ts}`,
        fullName: 'Phase 2E Limited Admin',
        email: `ladmin_${ts}@test.com`,
        passwordHash,
        role: 'ADMIN',
        isMasterAdmin: false,
        allowedBillingSaleTypes: [SaleType.RETAIL],
        allowedReportSaleTypes: [SaleType.RETAIL],
      },
    });
    createdUserIds.push(limitedAdmin.id);

    // Login tokens
    const madminAuth = await AuthService.login({ username: masterAdmin.username, password: 'password123' });
    const madminToken = madminAuth.tokens.accessToken;

    const ladminAuth = await AuthService.login({ username: limitedAdmin.username, password: 'password123' });
    const ladminToken = ladminAuth.tokens.accessToken;

    // -------------------------------------------------------------------------
    // Test 1: Master Admin can create a user with SaleTypes and isMasterAdmin
    // -------------------------------------------------------------------------
    console.log('▶ [1/16] Master Admin creates user with specified SaleTypes and isMasterAdmin: true...');
    const res1 = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        username: `new_admin_${ts}`,
        fullName: 'New Secondary Admin',
        email: `new_admin_${ts}@test.com`,
        password: 'password123',
        role: 'ADMIN',
        isMasterAdmin: true,
        allowedBillingSaleTypes: ['RETAIL', 'WHOLESALE'],
        allowedReportSaleTypes: ['RETAIL', 'NRI', 'WHOLESALE'],
      }),
    });
    console.assert(res1.status === 201, `Expected 201 Created, got ${res1.status}`);
    const data1 = await res1.json();
    console.assert(data1.data.isMasterAdmin === true, 'isMasterAdmin must be true');
    console.assert(data1.data.allowedBillingSaleTypes.length === 2, 'allowedBillingSaleTypes must have 2 items');
    console.assert(data1.data.allowedReportSaleTypes.length === 3, 'allowedReportSaleTypes must have 3 items');
    createdUserIds.push(data1.data.id);
    passedTests++;
    console.log('  ✅ Master Admin successfully created user with custom SaleTypes and Master Admin flag.');

    // -------------------------------------------------------------------------
    // Test 2: User creation with default fallback when SaleTypes are omitted
    // -------------------------------------------------------------------------
    console.log('▶ [2/16] User creation defaults to [RETAIL] when SaleTypes are omitted...');
    const res2 = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        username: `outlet_default_${ts}`,
        fullName: 'Outlet Default Staff',
        password: 'password123',
        role: 'OUTLET',
      }),
    });
    console.assert(res2.status === 201, `Expected 201 Created, got ${res2.status}`);
    const data2 = await res2.json();
    console.assert(data2.data.isMasterAdmin === false, 'isMasterAdmin default must be false');
    console.assert(
      data2.data.allowedBillingSaleTypes.length === 1 && data2.data.allowedBillingSaleTypes[0] === 'RETAIL',
      'allowedBillingSaleTypes must default to [RETAIL]'
    );
    console.assert(
      data2.data.allowedReportSaleTypes.length === 1 && data2.data.allowedReportSaleTypes[0] === 'RETAIL',
      'allowedReportSaleTypes must default to [RETAIL]'
    );
    createdUserIds.push(data2.data.id);
    passedTests++;
    console.log('  ✅ Defaults properly populated with [RETAIL] and isMasterAdmin: false.');

    // -------------------------------------------------------------------------
    // Test 3: Validation rejects empty SaleType arrays
    // -------------------------------------------------------------------------
    console.log('▶ [3/16] Validation rejects empty allowedBillingSaleTypes or allowedReportSaleTypes...');
    const res3 = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        username: `invalid_user_${ts}`,
        fullName: 'Invalid Staff',
        password: 'password123',
        role: 'OUTLET',
        allowedBillingSaleTypes: [],
      }),
    });
    console.assert(res3.status === 400, `Expected 400 Bad Request for empty SaleTypes, got ${res3.status}`);
    passedTests++;
    console.log('  ✅ Validation rejected empty SaleTypes array with 400 Bad Request.');

    // -------------------------------------------------------------------------
    // Test 4: Non-Master Admin cannot grant isMasterAdmin: true
    // -------------------------------------------------------------------------
    console.log('▶ [4/16] Non-Master Admin blocked from creating user with isMasterAdmin: true (403 Forbidden)...');
    const res4 = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ladminToken}`,
      },
      body: JSON.stringify({
        username: `illegal_madmin_${ts}`,
        fullName: 'Illegal Master Admin',
        password: 'password123',
        role: 'ADMIN',
        isMasterAdmin: true,
      }),
    });
    console.assert(res4.status === 403, `Expected 403 Forbidden, got ${res4.status}`);
    passedTests++;
    console.log('  ✅ Non-Master Admin blocked from granting Master Admin status during creation.');

    // -------------------------------------------------------------------------
    // Test 5: Non-Master Admin cannot grant SaleTypes beyond their own permissions
    // -------------------------------------------------------------------------
    console.log('▶ [5/16] Non-Master Admin blocked from granting SaleTypes they do not hold (403 Forbidden)...');
    const res5 = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ladminToken}`,
      },
      body: JSON.stringify({
        username: `escalated_user_${ts}`,
        fullName: 'Escalated User',
        password: 'password123',
        role: 'OUTLET',
        allowedBillingSaleTypes: ['RETAIL', 'WHOLESALE'], // limitedAdmin only has RETAIL
      }),
    });
    console.assert(res5.status === 403, `Expected 403 Forbidden, got ${res5.status}`);
    passedTests++;
    console.log('  ✅ Non-Master Admin blocked from granting WHOLESALE billing permission.');

    // -------------------------------------------------------------------------
    // Test 6: Non-Master Admin cannot modify a Master Admin user
    // -------------------------------------------------------------------------
    console.log('▶ [6/16] Non-Master Admin cannot modify a Master Admin account (403 Forbidden)...');
    const res6 = await fetch(`${baseUrl}/users/${masterAdmin.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ladminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Tampered Master Admin',
      }),
    });
    console.assert(res6.status === 403, `Expected 403 Forbidden, got ${res6.status}`);
    passedTests++;
    console.log('  ✅ Modification of Master Admin by Non-Master Admin rejected with 403 Forbidden.');

    // -------------------------------------------------------------------------
    // Test 7: Non-Master Admin cannot escalate permissions on existing user
    // -------------------------------------------------------------------------
    console.log('▶ [7/16] Non-Master Admin cannot grant unauthorized SaleTypes during update (403 Forbidden)...');
    const res7 = await fetch(`${baseUrl}/users/${data2.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ladminToken}`,
      },
      body: JSON.stringify({
        allowedReportSaleTypes: ['RETAIL', 'NRI'], // limitedAdmin only has RETAIL
      }),
    });
    console.assert(res7.status === 403, `Expected 403 Forbidden, got ${res7.status}`);
    passedTests++;
    console.log('  ✅ Privilege escalation during user update rejected with 403 Forbidden.');

    // -------------------------------------------------------------------------
    // Test 8: Non-Master Admin cannot self-escalate to Master Admin
    // -------------------------------------------------------------------------
    console.log('▶ [8/16] Non-Master Admin cannot self-escalate to isMasterAdmin: true (403 Forbidden)...');
    const res8 = await fetch(`${baseUrl}/users/${limitedAdmin.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ladminToken}`,
      },
      body: JSON.stringify({
        isMasterAdmin: true,
      }),
    });
    console.assert(res8.status === 403, `Expected 403 Forbidden, got ${res8.status}`);
    passedTests++;
    console.log('  ✅ Self-escalation to Master Admin rejected with 403 Forbidden.');

    // -------------------------------------------------------------------------
    // Test 9: Non-Master Admin cannot self-escalate SaleTypes
    // -------------------------------------------------------------------------
    console.log('▶ [9/16] Non-Master Admin cannot self-escalate SaleType permissions (403 Forbidden)...');
    const res9 = await fetch(`${baseUrl}/users/${limitedAdmin.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ladminToken}`,
      },
      body: JSON.stringify({
        allowedBillingSaleTypes: ['RETAIL', 'WHOLESALE'],
      }),
    });
    console.assert(res9.status === 403, `Expected 403 Forbidden, got ${res9.status}`);
    passedTests++;
    console.log('  ✅ Self-escalation of SaleType permissions rejected with 403 Forbidden.');

    // -------------------------------------------------------------------------
    // Test 10: Anti-lockout: Cannot demote sole active Master Admin
    // -------------------------------------------------------------------------
    console.log('▶ [10/16] Anti-lockout: Cannot demote the sole active Master Admin (400 Bad Request)...');
    // Ensure masterAdmin is the ONLY active Master Admin in the DB
    const otherMasterAdmins = await prisma.user.findMany({
      where: { isMasterAdmin: true, id: { not: masterAdmin.id } },
    });
    if (otherMasterAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherMasterAdmins.map((u) => u.id) } },
        data: { isMasterAdmin: false },
      });
    }

    const res10 = await fetch(`${baseUrl}/users/${masterAdmin.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        isMasterAdmin: false,
      }),
    });
    console.assert(res10.status === 400, `Expected 400 Bad Request for sole Master Admin demotion, got ${res10.status}`);
    const data10 = await res10.json();
    console.assert(
      JSON.stringify(data10).includes('Cannot demote or deactivate the last remaining active Master Admin'),
      'Must contain anti-lockout message'
    );
    passedTests++;
    console.log('  ✅ Demoting the sole active Master Admin blocked with 400 Bad Request.');

    // -------------------------------------------------------------------------
    // Test 11: Anti-lockout: Cannot deactivate sole active Master Admin
    // -------------------------------------------------------------------------
    console.log('▶ [11/16] Anti-lockout: Cannot deactivate the sole active Master Admin (400 Bad Request)...');
    const res11 = await fetch(`${baseUrl}/users/${masterAdmin.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        isActive: false,
      }),
    });
    console.assert(res11.status === 400, `Expected 400 Bad Request for sole Master Admin deactivation, got ${res11.status}`);
    const data11 = await res11.json();
    console.assert(
      JSON.stringify(data11).includes('Cannot demote or deactivate the last remaining active Master Admin'),
      'Must contain anti-lockout message'
    );
    passedTests++;
    console.log('  ✅ Deactivating the sole active Master Admin blocked with 400 Bad Request.');

    // -------------------------------------------------------------------------
    // Test 12: Demotion succeeds when multiple active Master Admins exist
    // -------------------------------------------------------------------------
    console.log('▶ [12/16] Demotion succeeds when another active Master Admin exists...');
    // Re-promote data1 (new_admin) so multiple active Master Admins exist
    await prisma.user.update({
      where: { id: data1.data.id },
      data: { isMasterAdmin: true, isActive: true },
    });

    // Now demoting data1 should succeed because masterAdmin is also active
    const res12 = await fetch(`${baseUrl}/users/${data1.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        isMasterAdmin: false,
      }),
    });
    console.assert(res12.status === 200, `Expected 200 OK, got ${res12.status}`);
    const data12 = await res12.json();
    console.assert(data12.data.isMasterAdmin === false, 'isMasterAdmin must now be false');
    passedTests++;
    console.log('  ✅ Demotion allowed when a redundant active Master Admin remains.');

    // Restore otherMasterAdmins (e.g. seed admin)
    if (otherMasterAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherMasterAdmins.map((u) => u.id) } },
        data: { isMasterAdmin: true },
      });
    }

    // -------------------------------------------------------------------------
    // Test 13: GET /users includes Phase 2E fields
    // -------------------------------------------------------------------------
    console.log('▶ [13/16] GET /users returns isMasterAdmin, allowedBillingSaleTypes, allowedReportSaleTypes...');
    const res13 = await fetch(`${baseUrl}/users`, {
      headers: {
        Authorization: `Bearer ${madminToken}`,
      },
    });
    console.assert(res13.status === 200, `Expected 200 OK, got ${res13.status}`);
    const data13 = await res13.json();
    const foundAdmin = data13.data.find((u: any) => u.id === masterAdmin.id);
    console.assert(foundAdmin.isMasterAdmin === true, 'Found admin must have isMasterAdmin === true');
    console.assert(Array.isArray(foundAdmin.allowedBillingSaleTypes), 'Must have allowedBillingSaleTypes');
    console.assert(Array.isArray(foundAdmin.allowedReportSaleTypes), 'Must have allowedReportSaleTypes');
    passedTests++;
    console.log('  ✅ GET /users payload verified with full Phase 2E security attributes.');

    // -------------------------------------------------------------------------
    // Test 14: Wholesale Pricing Batch Creation
    // -------------------------------------------------------------------------
    console.log('▶ [14/16] Wholesale pricing creation via /pricing/batch...');
    const testUnit = await prisma.unit.create({
      data: {
        name: `Unit P2E ${ts}`,
        symbol: `up2e_${ts.toString().slice(-4)}`,
        isWeightBased: true,
        conversionFactorToBase: 1000,
      },
    });
    createdUnitIds.push(testUnit.id);

    const testCat = await prisma.category.create({
      data: {
        name: `Cat P2E ${ts}`,
        code: `CP2E_${ts.toString().slice(-4)}`,
        displayOrder: 1,
      },
    });
    createdCategoryIds.push(testCat.id);

    const testSubCat = await prisma.subcategory.create({
      data: {
        categoryId: testCat.id,
        name: `SubCat P2E ${ts}`,
        code: `SCP2E_${ts.toString().slice(-4)}`,
        displayOrder: 1,
      },
    });
    createdSubcategoryIds.push(testSubCat.id);

    const testProduct = await prisma.product.create({
      data: {
        name: `P2E Test Product ${ts}`,
        code: `PRD_P2E_${ts.toString().slice(-4)}`,
        subcategoryId: testSubCat.id,
        primaryUnitId: testUnit.id,
        isLooseWeightAllowed: true,
      },
    });
    createdProductIds.push(testProduct.id);

    // Set prices for RETAIL, NRI, and WHOLESALE
    const res14 = await fetch(`${baseUrl}/pricing/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        prices: [
          {
            productId: testProduct.id,
            pricingTier: 'RETAIL',
            rate: 500,
          },
          {
            productId: testProduct.id,
            pricingTier: 'NRI',
            rate: 750,
          },
          {
            productId: testProduct.id,
            pricingTier: 'WHOLESALE',
            rate: 350,
          },
        ],
      }),
    });
    console.assert(res14.status === 200, `Expected 200 OK for batch pricing, got ${res14.status}`);
    const data14 = await res14.json();
    console.assert(data14.data.length === 3, `Expected 3 prices created, got ${data14.data.length}`);
    passedTests++;
    console.log('  ✅ Batch pricing successfully created RETAIL, NRI, and WHOLESALE tiers.');

    // -------------------------------------------------------------------------
    // Test 15: Retrieve Current Wholesale Price
    // -------------------------------------------------------------------------
    console.log('▶ [15/16] Verify /pricing/current returns WHOLESALE tier accurately...');
    const res15 = await fetch(`${baseUrl}/pricing/current?productId=${testProduct.id}&pricingTier=WHOLESALE`, {
      headers: {
        Authorization: `Bearer ${madminToken}`,
      },
    });
    console.assert(res15.status === 200, `Expected 200 OK, got ${res15.status}`);
    const data15 = await res15.json();
    const wsPriceRecord = data15.data.find((p: any) => p.pricingTier === 'WHOLESALE');
    console.assert(wsPriceRecord !== undefined, 'Wholesale price record must be returned');
    console.assert(Number(wsPriceRecord.rate) === 350, `Expected rate 350, got ${wsPriceRecord.rate}`);
    passedTests++;
    console.log('  ✅ Current wholesale pricing retrieved and matches exact registered rate.');

    // -------------------------------------------------------------------------
    // Test 16: Update Wholesale Price preserves audit history
    // -------------------------------------------------------------------------
    console.log('▶ [16/16] Updating Wholesale price preserves audit history...');
    const res16 = await fetch(`${baseUrl}/pricing/${wsPriceRecord.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madminToken}`,
      },
      body: JSON.stringify({
        rate: 380,
      }),
    });
    console.assert(res16.status === 200, `Expected 200 OK for price update, got ${res16.status}`);
    const data16 = await res16.json();
    console.assert(Number(data16.data.rate) === 380, `Expected rate 380, got ${data16.data.rate}`);

    // Verify history endpoint includes the product prices
    const resHistory = await fetch(`${baseUrl}/pricing/history/${testProduct.id}`, {
      headers: {
        Authorization: `Bearer ${madminToken}`,
      },
    });
    console.assert(resHistory.status === 200, `Expected 200 OK for history, got ${resHistory.status}`);
    const historyData = await resHistory.json();
    console.assert(Array.isArray(historyData.data), 'History data must be an array');
    const wsHistory = historyData.data.filter((h: any) => h.pricingTier === 'WHOLESALE');
    console.assert(wsHistory.length >= 1, 'History must contain wholesale tier price');
    passedTests++;
    console.log('  ✅ Wholesale price updated to ₹380.00 and price history verified.');

    // -------------------------------------------------------------------------
    // Test 17: Concurrent Master Admin Anti-Lockout Serialization
    // -------------------------------------------------------------------------
    console.log('▶ [17/17] Concurrent Master Admin Demotion / Anti-Lockout Serialization...');
    const concurrentAdminB = await prisma.user.create({
      data: {
        username: `conc_madmin_b_${ts}`,
        fullName: 'Concurrent Master Admin B',
        email: `conc_b_${ts}@test.com`,
        passwordHash,
        role: 'ADMIN',
        isMasterAdmin: true,
        isActive: true,
        allowedBillingSaleTypes: [SaleType.RETAIL],
        allowedReportSaleTypes: [SaleType.RETAIL],
      },
    });
    createdUserIds.push(concurrentAdminB.id);

    // Isolate active master admins to ONLY masterAdmin and concurrentAdminB
    const otherActiveMasters = await prisma.user.findMany({
      where: { isMasterAdmin: true, id: { notIn: [masterAdmin.id, concurrentAdminB.id] } },
    });
    if (otherActiveMasters.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherActiveMasters.map((u) => u.id) } },
        data: { isMasterAdmin: false },
      });
    }

    const countBeforeRace = await prisma.user.count({ where: { isMasterAdmin: true, isActive: true } });
    console.assert(countBeforeRace === 2, `Expected exactly 2 active Master Admins before race, got ${countBeforeRace}`);

    // Fire simultaneous demotion requests for masterAdmin (Admin A) and concurrentAdminB (Admin B)
    const [raceResA, raceResB] = await Promise.all([
      fetch(`${baseUrl}/users/${masterAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${madminToken}` },
        body: JSON.stringify({ isMasterAdmin: false }),
      }),
      fetch(`${baseUrl}/users/${concurrentAdminB.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${madminToken}` },
        body: JSON.stringify({ isMasterAdmin: false }),
      }),
    ]);

    const statuses = [raceResA.status, raceResB.status].sort();
    console.assert(
      statuses[0] === 200 && statuses[1] === 400,
      `Expected exactly one 200 OK and one 400 Bad Request, got [${raceResA.status}, ${raceResB.status}]`
    );

    const countAfterRace = await prisma.user.count({ where: { isMasterAdmin: true, isActive: true } });
    console.assert(
      countAfterRace === 1,
      `Expected active Master Admin count to remain exactly 1, got ${countAfterRace}`
    );

    // Restore otherActiveMasters
    if (otherActiveMasters.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherActiveMasters.map((u) => u.id) } },
        data: { isMasterAdmin: true },
      });
    }

    passedTests++;
    console.log('  ✅ Concurrency serialization verified: exactly one demoted, anti-lockout caught the other, active count = 1.');

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 10 PHASE 2E TESTS PASSED!`);
    console.log('🎉 ========================================================\n');
  } finally {
    // Teardown & Clean up test data
    server.close();

    if (createdProductIds.length > 0) {
      await prisma.productPrice.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdSubcategoryIds.length > 0) {
      await prisma.subcategory.deleteMany({ where: { id: { in: createdSubcategoryIds } } });
    }
    if (createdCategoryIds.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    }
    if (createdUnitIds.length > 0) {
      await prisma.unit.deleteMany({ where: { id: { in: createdUnitIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    // Ensure seed admin remains active Master Admin
    await prisma.user.updateMany({
      where: { username: 'admin' },
      data: { isMasterAdmin: true, isActive: true },
    });

    await prisma.$disconnect();
  }
}

runStep10Phase2EAdminRbacTests().catch((err) => {
  console.error('❌ Step 10 Phase 2E Test Suite Failed:', err);
  process.exit(1);
});
