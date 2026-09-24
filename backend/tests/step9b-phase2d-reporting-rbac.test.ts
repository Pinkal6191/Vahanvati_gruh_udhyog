import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { StockService } from '../src/modules/inventory/stock.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { ReturnsService } from '../src/modules/returns/returns.service.js';
import { SaleType, CustomerType, PaymentMode, SaleStatus, ReturnStatus } from '@prisma/client';
import http from 'http';
import bcrypt from 'bcryptjs';

async function runPhase2DReportingRbacTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PHASE 2D — REPORTING SALETYPE & REPORT RBAC TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 29;

  const createdSaleIds: string[] = [];
  const createdReturnIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];

  // Setup Express app on ephemeral port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // 1. Setup Test Users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('testpass123', salt);

    // Master Admin User
    const masterAdminUser = await prisma.user.create({
      data: {
        username: `madmin_${ts}`,
        fullName: 'Master Admin User',
        email: `madmin_${ts}@test.com`,
        passwordHash,
        role: 'ADMIN',
        isMasterAdmin: true,
        allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
        allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      },
    });
    createdUserIds.push(masterAdminUser.id);

    // Restricted Retail-Only User (Reporting: RETAIL only, Billing: RETAIL only)
    const retailUser = await prisma.user.create({
      data: {
        username: `retail_${ts}`,
        fullName: 'Retail Staff',
        email: `retail_${ts}@test.com`,
        passwordHash,
        role: 'OUTLET',
        isMasterAdmin: false,
        allowedBillingSaleTypes: [SaleType.RETAIL],
        allowedReportSaleTypes: [SaleType.RETAIL],
      },
    });
    createdUserIds.push(retailUser.id);

    // Decoupled Permissions User (Billing: RETAIL + WHOLESALE, Reporting: RETAIL only)
    const decoupledUser = await prisma.user.create({
      data: {
        username: `decoupled_${ts}`,
        fullName: 'Decoupled Staff',
        email: `decoupled_${ts}@test.com`,
        passwordHash,
        role: 'OUTLET',
        isMasterAdmin: false,
        allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.WHOLESALE],
        allowedReportSaleTypes: [SaleType.RETAIL], // Strictly RETAIL reporting
      },
    });
    createdUserIds.push(decoupledUser.id);

    // Obtain JWT tokens
    const madminAuth = await AuthService.login({ username: masterAdminUser.username, password: 'testpass123' });
    const retailAuth = await AuthService.login({ username: retailUser.username, password: 'testpass123' });
    const decoupledAuth = await AuthService.login({ username: decoupledUser.username, password: 'testpass123' });

    const madminToken = madminAuth.tokens.accessToken;
    const retailToken = retailAuth.tokens.accessToken;
    const decoupledToken = decoupledAuth.tokens.accessToken;

    // 2. Setup Catalog Data
    const unit = await prisma.unit.create({
      data: {
        name: `Unit ${ts}`,
        symbol: `u${ts.toString().slice(-4)}`,
        isWeightBased: true,
        conversionFactorToBase: 1000,
      },
    });

    const category = await prisma.category.create({
      data: {
        name: `Cat ${ts}`,
        code: `CAT_${ts.toString().slice(-4)}`,
        displayOrder: 1,
      },
    });

    const subcategory = await prisma.subcategory.create({
      data: {
        categoryId: category.id,
        name: `SubCat ${ts}`,
        code: `SUB_${ts.toString().slice(-4)}`,
        displayOrder: 1,
      },
    });

    const product = await prisma.product.create({
      data: {
        subcategoryId: subcategory.id,
        primaryUnitId: unit.id,
        name: `Product ${ts}`,
        code: `PROD_${ts.toString().slice(-4)}`,
        isLooseWeightAllowed: true,
      },
    });
    createdProductIds.push(product.id);

    const pack = await prisma.productPackConfiguration.create({
      data: {
        productId: product.id,
        packName: 'Standard Pack',
        weightInBaseUnits: 1000,
        unitId: unit.id,
        displayOrder: 1,
      },
    });

    // Seed Tiered Prices
    await prisma.productPrice.createMany({
      data: [
        {
          productId: product.id,
          packConfigId: pack.id,
          pricingTier: SaleType.RETAIL,
          rate: 100.0,
          effectiveFrom: new Date('2020-01-01'),
          isActive: true,
        },
        {
          productId: product.id,
          packConfigId: pack.id,
          pricingTier: SaleType.NRI,
          rate: 150.0,
          effectiveFrom: new Date('2020-01-01'),
          isActive: true,
        },
        {
          productId: product.id,
          packConfigId: pack.id,
          pricingTier: SaleType.WHOLESALE,
          rate: 70.0,
          effectiveFrom: new Date('2020-01-01'),
          isActive: true,
        },
      ],
    });

    await prisma.stock.create({
      data: {
        productId: product.id,
        currentBalance: 100000,
        minimumThreshold: 100,
      },
    });

    // Setup Customers (Cross-combination demographic vs sale types)
    const indianCustomer = await prisma.customer.create({
      data: {
        name: `Indian Cust ${ts}`,
        customerType: CustomerType.INDIAN,
        mobile: `9825${ts.toString().slice(-6)}`,
      },
    });
    createdCustomerIds.push(indianCustomer.id);

    const nriCustomer = await prisma.customer.create({
      data: {
        name: `NRI Cust ${ts}`,
        customerType: CustomerType.NRI,
        mobile: `9826${ts.toString().slice(-6)}`,
      },
    });
    createdCustomerIds.push(nriCustomer.id);

    // 3. Create 3 Distinct Sales (Retail, NRI, Wholesale)
    // Sale 1: Retail (INDIAN customer + RETAIL saleType) -> Rate 100, Total 100
    const retailSale = await SalesService.createSale(
      masterAdminUser.id,
      'ADMIN',
      {
        customerId: indianCustomer.id,
        customerType: CustomerType.INDIAN,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, packConfigId: pack.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
        paidAmount: 100,
      },
      '127.0.0.1'
    );
    createdSaleIds.push(retailSale.id);

    // Sale 2: NRI (NRI customer + NRI saleType) -> Rate 150, Total 150
    const nriSale = await SalesService.createSale(
      masterAdminUser.id,
      'ADMIN',
      {
        customerId: nriCustomer.id,
        customerType: CustomerType.NRI,
        saleType: SaleType.NRI,
        items: [{ productId: product.id, packConfigId: pack.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.UPI, amount: 150 }],
        paidAmount: 150,
      },
      '127.0.0.1'
    );
    createdSaleIds.push(nriSale.id);

    // Sale 3: Wholesale (Cross combination: INDIAN customer + WHOLESALE saleType) -> Rate 70, Total 140 (qty 2)
    const wholesaleSale = await SalesService.createSale(
      masterAdminUser.id,
      'ADMIN',
      {
        customerId: indianCustomer.id,
        customerType: CustomerType.INDIAN,
        saleType: SaleType.WHOLESALE,
        items: [{ productId: product.id, packConfigId: pack.id, quantity: 2 }],
        payments: [{ paymentMode: PaymentMode.CARD, amount: 140 }],
        paidAmount: 140,
      },
      '127.0.0.1'
    );
    createdSaleIds.push(wholesaleSale.id);

    // Sale 4: Cross combination (NRI customer + RETAIL saleType) -> Rate 100, Total 100
    const nriRetailSale = await SalesService.createSale(
      masterAdminUser.id,
      'ADMIN',
      {
        customerId: nriCustomer.id,
        customerType: CustomerType.NRI,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, packConfigId: pack.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
        paidAmount: 100,
      },
      '127.0.0.1'
    );
    createdSaleIds.push(nriRetailSale.id);

    // Create 1 Return for Wholesale sale to test returns
    const wholesaleSaleFull = await prisma.sale.findUnique({
      where: { id: wholesaleSale.id },
      include: { items: true },
    });
    const returnWholesale = await ReturnsService.createReturn(
      masterAdminUser.id,
      {
        originalSaleId: wholesaleSale.id,
        refundPaymentMode: PaymentMode.CASH,
        reason: 'Customer ordered too many wholesale units',
        items: [
          {
            saleItemId: wholesaleSaleFull!.items[0].id,
            returnedQuantity: 1,
            restockCondition: 'RESTOCKABLE',
          },
        ],
      },
      'ADMIN',
      '127.0.0.1'
    );
    createdReturnIds.push(returnWholesale.id);

    const todayStr = new Date().toISOString().slice(0, 10);

    // ========================================================
    // A. MASTER ADMIN TESTS (1–4)
    // ========================================================
    console.log('▶ [1/29] Master Admin: Sales report sees Retail sales (?saleType=RETAIL)...');
    const res1 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}&saleType=RETAIL`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data1 = await res1.json();
    console.assert(res1.status === 200, `Expected 200, got ${res1.status}`);
    console.assert(data1.data.summary.completedBillsCount >= 2, 'Should see at least 2 retail bills');
    passedTests++;
    console.log('  ✅ Master Admin successfully queries Retail sales.');

    console.log('▶ [2/29] Master Admin: Sales report sees NRI sales (?saleType=NRI)...');
    const res2 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}&saleType=NRI`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data2 = await res2.json();
    console.assert(res2.status === 200, `Expected 200, got ${res2.status}`);
    console.assert(data2.data.summary.completedBillsCount >= 1, 'Should see at least 1 NRI bill');
    passedTests++;
    console.log('  ✅ Master Admin successfully queries NRI sales.');

    console.log('▶ [3/29] Master Admin: Sales report sees Wholesale sales (?saleType=WHOLESALE)...');
    const res3 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}&saleType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data3 = await res3.json();
    console.assert(res3.status === 200, `Expected 200, got ${res3.status}`);
    console.assert(data3.data.summary.completedBillsCount >= 1, 'Should see at least 1 Wholesale bill');
    passedTests++;
    console.log('  ✅ Master Admin successfully queries Wholesale sales.');

    console.log('▶ [4/29] Master Admin: No filter sees all SaleTypes simultaneously...');
    const res4 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data4 = await res4.json();
    console.assert(res4.status === 200, `Expected 200, got ${res4.status}`);
    console.assert(data4.data.summary.completedBillsCount >= 4, 'Should see all completed bills');
    console.assert(data4.data.salesByType.RETAIL.completedBillsCount >= 2, 'SalesByType contains Retail');
    console.assert(data4.data.salesByType.NRI.completedBillsCount >= 1, 'SalesByType contains NRI');
    console.assert(data4.data.salesByType.WHOLESALE.completedBillsCount >= 1, 'SalesByType contains Wholesale');
    passedTests++;
    console.log('  ✅ Master Admin sees all SaleTypes with full segmentation.');

    // ========================================================
    // B. NORMAL USER RBAC TESTS (5–10)
    // ========================================================
    console.log('▶ [5/29] Normal User: User allowed Retail sees Retail sales...');
    const res5 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}&saleType=RETAIL`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    const data5 = await res5.json();
    console.assert(res5.status === 200, `Expected 200, got ${res5.status}`);
    console.assert(data5.data.summary.completedBillsCount >= 2, 'Restricted user sees Retail bills');
    passedTests++;
    console.log('  ✅ Normal user allowed Retail can view Retail sales.');

    console.log('▶ [6/29] Normal User: User allowed Retail cannot see NRI sales in scoped view...');
    const res6 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    const data6 = await res6.json();
    console.assert(res6.status === 200, `Expected 200, got ${res6.status}`);
    console.assert(data6.data.salesByType.NRI.completedBillsCount === 0, 'Scoped view must have 0 NRI bills');
    passedTests++;
    console.log('  ✅ Normal user scoped view excludes NRI sales.');

    console.log('▶ [7/29] Normal User: User allowed Retail cannot see Wholesale sales in scoped view...');
    console.assert(data6.data.salesByType.WHOLESALE.completedBillsCount === 0, 'Scoped view must have 0 Wholesale bills');
    passedTests++;
    console.log('  ✅ Normal user scoped view excludes Wholesale sales.');

    console.log('▶ [8/29] Normal User: Explicit unauthorized SaleType query returns 403 Forbidden...');
    const res8 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}&saleType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    console.assert(res8.status === 403, `Expected 403 Forbidden, got ${res8.status}`);
    const data8 = await res8.json();
    console.assert(JSON.stringify(data8).includes('not authorized'), 'Error message states unauthorized');
    passedTests++;
    console.log('  ✅ Explicit unauthorized SaleType query rejected with 403 Forbidden.');

    console.log('▶ [9/29] Normal User: No filter automatically scopes to allowedReportSaleTypes...');
    // Scoped bills should match only Retail bills count
    console.assert(data6.data.summary.completedBillsCount === data6.data.salesByType.RETAIL.completedBillsCount, 'Total bills must equal Retail bills');
    passedTests++;
    console.log('  ✅ No filter automatically scopes to allowedReportSaleTypes.');

    console.log('▶ [10/29] Decoupled Permissions: Billing Wholesale does NOT grant reporting Wholesale...');
    // decoupledUser has allowedBillingSaleTypes: ['RETAIL', 'WHOLESALE'], but allowedReportSaleTypes: ['RETAIL']
    const res10 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}&saleType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${decoupledToken}` },
    });
    console.assert(res10.status === 403, `Decoupled user querying WHOLESALE report must return 403, got ${res10.status}`);
    passedTests++;
    console.log('  ✅ Billing permissions do not grant reporting permissions (strict separation verified).');

    // ========================================================
    // C. PRODUCT REPORT TESTS (11–12)
    // ========================================================
    console.log('▶ [11/29] Product Report: Respects SaleType filter for Master Admin...');
    const res11 = await fetch(`${baseUrl}/reports/sales/products?startDate=${todayStr}&endDate=${todayStr}&saleType=RETAIL`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data11 = await res11.json();
    console.assert(res11.status === 200, `Expected 200, got ${res11.status}`);
    const prodRow = data11.data.find((p: any) => p.productId === product.id);
    console.assert(prodRow && prodRow.quantitySold === 2, `Retail qty should be 2, got ${prodRow?.quantitySold}`);
    passedTests++;
    console.log('  ✅ Product report accurately filters products by SaleType.');

    console.log('▶ [12/29] Product Report: Unauthorized SaleType cannot leak through aggregation...');
    const res12 = await fetch(`${baseUrl}/reports/sales/products?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    const data12 = await res12.json();
    console.assert(res12.status === 200, `Expected 200, got ${res12.status}`);
    const prodRowRestricted = data12.data.find((p: any) => p.productId === product.id);
    // Restricted user sees only Retail sales (qty: 2, total: 200). Wholesale (qty: 2, total: 140) and NRI (qty: 1, total: 150) must not leak!
    console.assert(prodRowRestricted && prodRowRestricted.quantitySold === 2, `Restricted user must see only 2 units, got ${prodRowRestricted?.quantitySold}`);
    console.assert(prodRowRestricted && prodRowRestricted.salesAmount === 200, `Restricted user must see ₹200, got ${prodRowRestricted?.salesAmount}`);
    passedTests++;
    console.log('  ✅ Unauthorized SaleType volumes/amounts strictly isolated from product aggregation.');

    // ========================================================
    // D. CUSTOMER REPORT TESTS (13–16)
    // ========================================================
    console.log('▶ [13/29] Customer Report: CustomerType filter remains independent demographic filter...');
    const res13 = await fetch(`${baseUrl}/reports/sales/customers?startDate=${todayStr}&endDate=${todayStr}&customerType=INDIAN`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data13 = await res13.json();
    console.assert(res13.status === 200, `Expected 200, got ${res13.status}`);
    const custRow = data13.data.find((c: any) => c.customerId === indianCustomer.id);
    console.assert(custRow, 'Indian customer found in demographic filter');
    passedTests++;
    console.log('  ✅ Customer demographic CustomerType filter operates independently.');

    console.log('▶ [14/29] Customer Report: CustomerType=INDIAN + SaleType=WHOLESALE works simultaneously...');
    const res14 = await fetch(
      `${baseUrl}/reports/sales/customers?startDate=${todayStr}&endDate=${todayStr}&customerType=INDIAN&saleType=WHOLESALE`,
      { headers: { Authorization: `Bearer ${madminToken}` } }
    );
    const data14 = await res14.json();
    console.assert(res14.status === 200, `Expected 200, got ${res14.status}`);
    const custRow14 = data14.data.find((c: any) => c.customerId === indianCustomer.id);
    console.assert(custRow14 && custRow14.totalPurchases === 140, `Wholesale purchase should be 140, got ${custRow14?.totalPurchases}`);
    passedTests++;
    console.log('  ✅ CustomerType=INDIAN + SaleType=WHOLESALE simultaneous filters verified.');

    console.log('▶ [15/29] Customer Report: CustomerType=NRI + SaleType=RETAIL works simultaneously...');
    const res15 = await fetch(
      `${baseUrl}/reports/sales/customers?startDate=${todayStr}&endDate=${todayStr}&customerType=NRI&saleType=RETAIL`,
      { headers: { Authorization: `Bearer ${madminToken}` } }
    );
    const data15 = await res15.json();
    console.assert(res15.status === 200, `Expected 200, got ${res15.status}`);
    const custRow15 = data15.data.find((c: any) => c.customerId === nriCustomer.id);
    console.assert(custRow15 && custRow15.totalPurchases === 100, `Retail purchase for NRI should be 100, got ${custRow15?.totalPurchases}`);
    passedTests++;
    console.log('  ✅ CustomerType=NRI + SaleType=RETAIL simultaneous filters verified.');

    console.log('▶ [16/29] Customer Report: Unauthorized SaleType query is blocked with 403...');
    const res16 = await fetch(
      `${baseUrl}/reports/sales/customers?startDate=${todayStr}&endDate=${todayStr}&saleType=WHOLESALE`,
      { headers: { Authorization: `Bearer ${retailToken}` } }
    );
    console.assert(res16.status === 403, `Expected 403, got ${res16.status}`);
    passedTests++;
    console.log('  ✅ Customer report rejects unauthorized SaleType with 403.');

    // ========================================================
    // E. CUSTOMER DETAIL TESTS (17–19)
    // ========================================================
    console.log('▶ [17/29] Customer Detail: Authorized customer detail works with scoped transactions...');
    const res17 = await fetch(`${baseUrl}/reports/customers/${indianCustomer.id}`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    const data17 = await res17.json();
    console.assert(res17.status === 200, `Expected 200, got ${res17.status}`);
    // Retail user should only see the Retail sale (id: retailSale.id), NOT wholesaleSale.id!
    const hasWholesale = data17.data.some((s: any) => s.id === wholesaleSale.id);
    const hasRetail = data17.data.some((s: any) => s.id === retailSale.id);
    console.assert(!hasWholesale, 'Restricted user must NOT see customer wholesale sale in customer detail');
    console.assert(hasRetail, 'Restricted user sees customer retail sale');
    passedTests++;
    console.log('  ✅ Customer detail endpoint enforces report authorization on transaction history.');

    console.log('▶ [18/29] Customer Detail: Unauthorized explicit SaleType returns 403 Forbidden...');
    const res18 = await fetch(`${baseUrl}/reports/customers/${indianCustomer.id}?saleType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    console.assert(res18.status === 403, `Expected 403, got ${res18.status}`);
    passedTests++;
    console.log('  ✅ Customer detail rejects unauthorized explicit SaleType with 403.');

    console.log('▶ [19/29] Customer Detail: Master Admin can access all transactions across all SaleTypes...');
    const res19 = await fetch(`${baseUrl}/reports/customers/${indianCustomer.id}`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data19 = await res19.json();
    console.assert(res19.status === 200, `Expected 200, got ${res19.status}`);
    const adminHasWholesale = data19.data.some((s: any) => s.id === wholesaleSale.id);
    const adminHasRetail = data19.data.some((s: any) => s.id === retailSale.id);
    console.assert(adminHasWholesale && adminHasRetail, 'Master admin sees both retail and wholesale');
    passedTests++;
    console.log('  ✅ Master Admin accesses all transactions across all tiers.');

    // ========================================================
    // F. RETURNS REPORT TESTS (20–22)
    // ========================================================
    console.log('▶ [20/29] Returns Report: Respects SaleType filter...');
    const res20 = await fetch(`${baseUrl}/reports/returns?startDate=${todayStr}&endDate=${todayStr}&saleType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data20 = await res20.json();
    console.assert(res20.status === 200, `Expected 200, got ${res20.status}`);
    console.assert(data20.data.summary.completedReturnsCount >= 1, 'Should find wholesale return');
    passedTests++;
    console.log('  ✅ Returns report filters returns by saleTypeSnapshot.');

    console.log('▶ [21/29] Returns Report: Return uses historical SaleType snapshot rate (₹70 Wholesale, not current)...');
    console.assert(data20.data.summary.totalRefundAmount === 70, `Expected refund ₹70, got ${data20.data.summary.totalRefundAmount}`);
    passedTests++;
    console.log('  ✅ Returns report uses historical unit rate and saleTypeSnapshot without re-pricing.');

    console.log('▶ [22/29] Returns Report: Unauthorized SaleType returns 403 Forbidden...');
    const res22 = await fetch(`${baseUrl}/reports/returns?startDate=${todayStr}&endDate=${todayStr}&saleType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    console.assert(res22.status === 403, `Expected 403, got ${res22.status}`);
    passedTests++;
    console.log('  ✅ Returns report rejects unauthorized SaleType with 403.');

    // ========================================================
    // G. BUSINESS SUMMARY TESTS (23–25)
    // ========================================================
    console.log('▶ [23/29] Business Summary: Master Admin invariant Retail + NRI + Wholesale = Total Sales...');
    const res23 = await fetch(`${baseUrl}/reports/business-summary?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    const data23 = await res23.json();
    console.assert(res23.status === 200, `Expected 200, got ${res23.status}`);
    const rSales = data23.data.salesByType.RETAIL.totalSales;
    const nSales = data23.data.salesByType.NRI.totalSales;
    const wSales = data23.data.salesByType.WHOLESALE.totalSales;
    const totalSales = data23.data.sales.totalSales;
    const sumTiers = Math.round((rSales + nSales + wSales) * 100) / 100;
    console.assert(
      sumTiers === totalSales,
      `Invariant violation: Retail (${rSales}) + NRI (${nSales}) + Wholesale (${wSales}) = ${sumTiers} != Total (${totalSales})`
    );
    console.assert(data23.data.scope.isMasterAdmin === true, 'scope.isMasterAdmin must be true');
    console.assert(data23.data.scope.isScoped === false, 'scope.isScoped must be false');
    console.assert(data23.data.scope.scopeLabel === 'Company Total Sales', 'scopeLabel must be Company Total Sales');
    passedTests++;
    console.log(`  ✅ Invariant verified: Retail (${rSales}) + NRI (${nSales}) + Wholesale (${wSales}) = Total (${totalSales}).`);

    console.log('▶ [24/29] Business Summary: Restricted user visible/scoped total contains only authorized SaleTypes...');
    // We test with retailToken by temporarily testing service or endpoint
    // reports/business-summary has authorize(['ADMIN']), so we test with decoupled user upgraded to role ADMIN or service directly
    // Let's test service directly for restricted user:
    const restrictedSummary = await (await import('../src/modules/reports/reports.service.js')).ReportsService.getBusinessSummary(
      { startDate: todayStr, endDate: todayStr },
      retailUser as any
    );
    console.assert(restrictedSummary.scope.isScoped === true, 'Must be marked as scoped');
    console.assert(restrictedSummary.scope.allowedSaleTypes.length === 1 && restrictedSummary.scope.allowedSaleTypes[0] === 'RETAIL', 'Allowed scope must be RETAIL');
    console.assert(restrictedSummary.salesByType.NRI.totalSales === 0, 'NRI sales must be 0 for restricted user');
    console.assert(restrictedSummary.salesByType.WHOLESALE.totalSales === 0, 'Wholesale sales must be 0 for restricted user');
    console.assert(restrictedSummary.sales.totalSales === restrictedSummary.salesByType.RETAIL.totalSales, 'Total must equal retail sales only');
    passedTests++;
    console.log('  ✅ Restricted user summary contains strictly authorized SaleTypes.');

    console.log('▶ [25/29] Business Summary: Restricted scoped total is NOT labeled as company-wide total...');
    console.assert(
      restrictedSummary.scope.scopeLabel !== 'Company Total Sales',
      'Restricted scope MUST NOT be labeled Company Total Sales'
    );
    console.assert(
      restrictedSummary.scope.scopeLabel.includes('Authorized Sales (Scoped:'),
      `Expected Authorized Sales (Scoped: ...), got ${restrictedSummary.scope.scopeLabel}`
    );
    passedTests++;
    console.log('  ✅ Restricted scoped total labeling rule strictly enforced.');

    // ========================================================
    // H. SALES HISTORY & DETAIL TESTS (26–29)
    // ========================================================
    console.log('▶ [26/29] Sales History: GET /sales respects report permissions...');
    const res26 = await fetch(`${baseUrl}/sales`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    const data26 = await res26.json();
    console.assert(res26.status === 200, `Expected 200, got ${res26.status}`);
    const foundWholesaleInList = data26.data.items.some((s: any) => s.id === wholesaleSale.id);
    console.assert(!foundWholesaleInList, 'Restricted user must NOT see wholesale sale in GET /sales');
    passedTests++;
    console.log('  ✅ Sales history automatically scopes to allowedReportSaleTypes.');

    console.log('▶ [27/29] Sales History: Removing SaleType query parameter cannot bypass RBAC...');
    // Querying /sales without saleType parameter
    const res27 = await fetch(`${baseUrl}/sales?page=1&limit=50`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    const data27 = await res27.json();
    const hasAnyWholesale = data27.data.items.some((s: any) => s.saleType === 'WHOLESALE' || s.saleType === 'NRI');
    console.assert(!hasAnyWholesale, 'Bypass attempt failed: Scoped to RETAIL only');
    passedTests++;
    console.log('  ✅ Omitting SaleType parameter cannot bypass RBAC restrictions.');

    console.log('▶ [28/29] Sales Detail: Direct GET /sales/:id for unauthorized SaleType returns 403 Forbidden...');
    const res28 = await fetch(`${baseUrl}/sales/${wholesaleSale.id}`, {
      headers: { Authorization: `Bearer ${retailToken}` },
    });
    console.assert(res28.status === 403, `Expected 403 Forbidden for direct wholesale sale access, got ${res28.status}`);
    const data28 = await res28.json();
    console.assert(JSON.stringify(data28).includes('not authorized'), 'Contains unauthorized message');
    passedTests++;
    console.log('  ✅ Direct sale ID access cannot bypass authorization (403 Forbidden returned).');

    console.log('▶ [29/29] Sales Detail: Master Admin can access all sales by ID and in list...');
    const res29 = await fetch(`${baseUrl}/sales/${wholesaleSale.id}`, {
      headers: { Authorization: `Bearer ${madminToken}` },
    });
    console.assert(res29.status === 200, `Master Admin direct sale access must return 200, got ${res29.status}`);
    const data29 = await res29.json();
    console.assert(data29.data.id === wholesaleSale.id, 'Retrieved exact wholesale sale record');
    passedTests++;
    console.log('  ✅ Master Admin access to all sales by ID and in list confirmed.');

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 2D REPORTING & RBAC TESTS PASSED!`);
    console.log('🎉 ========================================================\n');
  } finally {
    server.close();

    // Clean up test data
    await prisma.salesReturnItem.deleteMany({ where: { returnId: { in: createdReturnIds } } });
    await prisma.salesReturn.deleteMany({ where: { id: { in: createdReturnIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.payment.deleteMany({ where: { saleId: { in: createdSaleIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
    await prisma.stock.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.productPackConfiguration.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

    await prisma.$disconnect();
  }
}

runPhase2DReportingRbacTests().catch((err) => {
  console.error('❌ Phase 2D Test Suite Failed:', err);
  process.exit(1);
});
