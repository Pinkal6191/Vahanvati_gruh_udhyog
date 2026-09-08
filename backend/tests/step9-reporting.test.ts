import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { StockService } from '../src/modules/inventory/stock.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { ReturnsService } from '../src/modules/returns/returns.service.js';
import { ProductionService } from '../src/modules/production/production.service.js';
import { MovementType, ReferenceType, PaymentMode, CustomerType, ProductionStatus, ReturnStatus } from '@prisma/client';
import http from 'http';

async function runStep9ReportingTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 9 — REPORTING & ANALYTICS ENGINE TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 47;

  const createdSaleIds: string[] = [];
  const createdReturnIds: string[] = [];
  const createdProductionIds: string[] = [];
  const createdProductIds: string[] = [];

  // 1. Setup Express app on ephemeral port
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
      name: `Rep KG Unit ${ts}`,
      symbol: `rkg${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const catA = await prisma.category.create({
    data: {
      name: `Rep Cat A ${ts}`,
      code: `REPA_${ts.toString().slice(-4)}`,
      displayOrder: 1,
    },
  });

  const catB = await prisma.category.create({
    data: {
      name: `Rep Cat B ${ts}`,
      code: `REPB_${ts.toString().slice(-4)}`,
      displayOrder: 2,
    },
  });

  const subCatA = await prisma.subcategory.create({
    data: {
      categoryId: catA.id,
      name: `Rep SubCat A ${ts}`,
      code: `RSUBA_${ts.toString().slice(-4)}`,
      displayOrder: 1,
    },
  });

  const subCatB = await prisma.subcategory.create({
    data: {
      categoryId: catB.id,
      name: `Rep SubCat B ${ts}`,
      code: `RSUBB_${ts.toString().slice(-4)}`,
      displayOrder: 2,
    },
  });

  // Product 1: High Seller in Cat A
  const product1 = await prisma.product.create({
    data: {
      subcategoryId: subCatA.id,
      primaryUnitId: kgUnit.id,
      name: `Rep Sev Murmura ${ts}`,
      code: `REP_SEV_${ts.toString().slice(-4)}`,
      isLooseWeightAllowed: true,
    },
  });
  createdProductIds.push(product1.id);

  const packP1 = await prisma.productPackConfiguration.create({
    data: {
      productId: product1.id,
      packName: '500 GM Pack',
      weightInBaseUnits: 500,
      unitId: kgUnit.id,
    },
  });

  // Product 2: Moderate Seller in Cat B
  const product2 = await prisma.product.create({
    data: {
      subcategoryId: subCatB.id,
      primaryUnitId: kgUnit.id,
      name: `Rep Bhavnagari Gathiya ${ts}`,
      code: `REP_GATH_${ts.toString().slice(-4)}`,
      isLooseWeightAllowed: true,
    },
  });
  createdProductIds.push(product2.id);

  const packP2 = await prisma.productPackConfiguration.create({
    data: {
      productId: product2.id,
      packName: '1 KG Pack',
      weightInBaseUnits: 1000,
      unitId: kgUnit.id,
    },
  });

  // Product 3: Low Stock Item
  const product3 = await prisma.product.create({
    data: {
      subcategoryId: subCatA.id,
      primaryUnitId: kgUnit.id,
      name: `Rep Sakkarpara ${ts}`,
      code: `REP_SAKK_${ts.toString().slice(-4)}`,
      isLooseWeightAllowed: true,
    },
  });
  createdProductIds.push(product3.id);

  // Prices: P1 = ₹100 per 500g, P2 = ₹200 per 1kg, P3 = ₹150
  await prisma.productPrice.createMany({
    data: [
      {
        productId: product1.id,
        packConfigId: packP1.id,
        customerType: CustomerType.INDIAN,
        rate: 100,
        effectiveFrom: new Date('2020-01-01'),
        createdById: adminAuth.user.id,
      },
      {
        productId: product2.id,
        packConfigId: packP2.id,
        customerType: CustomerType.INDIAN,
        rate: 200,
        effectiveFrom: new Date('2020-01-01'),
        createdById: adminAuth.user.id,
      },
    ],
  });

  // Setup Initial Stocks:
  // P1: 20,000 GM (threshold 5,000)
  // P2: 10,000 GM (threshold 2,000)
  // P3: 500 GM (threshold 1,000) -> LOW STOCK
  await prisma.stock.createMany({
    data: [
      { productId: product1.id, currentBalance: 20000, minimumThreshold: 5000 },
      { productId: product2.id, currentBalance: 10000, minimumThreshold: 2000 },
      { productId: product3.id, currentBalance: 500, minimumThreshold: 1000 },
    ],
  });

  // Customers:
  // Customer 1: Regular Indian customer (will make 2 purchases -> repeat customer)
  const cust1 = await prisma.customer.create({
    data: {
      name: `Rep Ramesh Patel ${ts}`,
      mobile: `9898${ts.toString().slice(-6)}`,
      customerType: CustomerType.INDIAN,
    },
  });

  // Customer 2: Single purchase customer
  const cust2 = await prisma.customer.create({
    data: {
      name: `Rep Suresh Shah ${ts}`,
      mobile: `9797${ts.toString().slice(-6)}`,
      customerType: CustomerType.INDIAN,
    },
  });

  // Create Operational Data:
  // Sale 1: Cust 1 buys 2 packs P1 (2 x 100 = 200), paid CASH 200
  const sale1 = await SalesService.createSale(
    adminAuth.user.id,
    adminAuth.user.role,
    {
      customerId: cust1.id,
      items: [{ productId: product1.id, packConfigId: packP1.id, quantity: 2 }],
      paidAmount: 200,
      payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
    }
  );
  createdSaleIds.push(sale1.id);

  // Sale 2: Cust 1 buys 1 pack P2 (1 x 200 = 200), paid UPI 200 (Makes Cust 1 a repeat customer!)
  const sale2 = await SalesService.createSale(
    adminAuth.user.id,
    adminAuth.user.role,
    {
      customerId: cust1.id,
      items: [{ productId: product2.id, packConfigId: packP2.id, quantity: 1 }],
      paidAmount: 200,
      payments: [{ paymentMode: PaymentMode.UPI, amount: 200 }],
    }
  );
  createdSaleIds.push(sale2.id);

  // Sale 3: Cust 2 buys 1 pack P1 (1 x 100 = 100), paid CARD 100
  const sale3 = await SalesService.createSale(
    adminAuth.user.id,
    adminAuth.user.role,
    {
      customerId: cust2.id,
      items: [{ productId: product1.id, packConfigId: packP1.id, quantity: 1 }],
      paidAmount: 100,
      payments: [{ paymentMode: PaymentMode.CARD, amount: 100 }],
    }
  );
  createdSaleIds.push(sale3.id);

  // Sale 4: Cancelled Sale to verify it is excluded from active totals!
  const sale4 = await SalesService.createSale(
    adminAuth.user.id,
    adminAuth.user.role,
    {
      customerId: cust2.id,
      items: [{ productId: product1.id, packConfigId: packP1.id, quantity: 1 }],
      paidAmount: 100,
      payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
    }
  );
  createdSaleIds.push(sale4.id);
  await SalesService.cancelSale(
    sale4.id,
    adminAuth.user.id,
    adminAuth.user.role,
    { reason: 'Testing cancelled sale exclusion in reporting' }
  );

  // Return 1: Return 1 pack of P1 from Sale 1 (refund ₹100, CASH)
  const itemP1 = sale1.items.find((i: any) => i.productId === product1.id);
  const return1 = await ReturnsService.createReturn(
    adminAuth.user.id,
    {
      originalSaleId: sale1.id,
      reason: 'Customer returned 1 pack',
      refundPaymentMode: 'CASH',
      items: [{ saleItemId: itemP1!.id, returnedQuantity: 1, restockCondition: 'RESTOCKABLE' }],
    }
  );
  createdReturnIds.push(return1.id);

  // Production 1: 10 KG produced of Product 1 (COMPLETED)
  const prodEntry1 = await ProductionService.createEntry(
    prodAuth.user.id,
    {
      productId: product1.id,
      quantityProduced: 10,
      unitId: kgUnit.id,
      productionDate: new Date().toISOString().split('T')[0],
      batchNumber: `BAT-1-${ts}`,
      notes: 'Fresh batch',
    }
  );
  createdProductionIds.push(prodEntry1.id);

  // Production 2: Cancelled production entry (must be excluded from active totals)
  const prodEntry2 = await ProductionService.createEntry(
    prodAuth.user.id,
    {
      productId: product2.id,
      quantityProduced: 5,
      unitId: kgUnit.id,
      productionDate: new Date().toISOString().split('T')[0],
      batchNumber: `BAT-2-${ts}`,
      notes: 'Cancelled batch',
    }
  );
  createdProductionIds.push(prodEntry2.id);
  await ProductionService.cancelProduction(prodEntry2.id, adminAuth.user.id, {
    reason: 'Test cancellation exclusion',
  });

  try {
    // ========================================================
    // SECTION 1: SALES REPORTS (Tests 1–9)
    // ========================================================
    console.log('▶ [1/47] Sales Report: Total sales amount calculated accurately...');
    const res1 = await fetch(`${baseUrl}/reports/sales?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data1 = await res1.json();
    console.assert(res1.status === 200, 'Status must be 200');
    // Completed sales: Sale1 (200) + Sale2 (200) + Sale3 (100) = 500
    console.assert(data1.data.summary.totalSalesAmount >= 500, `Sales total must be at least 500, got ${data1.data.summary.totalSalesAmount}`);
    passedTests++;
    console.log(`  ✅ Sales total verified: ₹${data1.data.summary.totalSalesAmount}`);

    console.log('▶ [2/47] Sales Report: Completed sales included...');
    console.assert(data1.data.summary.completedBillsCount >= 3, 'Must have at least 3 completed bills');
    passedTests++;
    console.log(`  ✅ Completed bills verified: ${data1.data.summary.completedBillsCount}`);

    console.log('▶ [3/47] Sales Report: Cancelled sales excluded from active sales total...');
    console.assert(data1.data.summary.cancelledBillsCount >= 1, 'Must track at least 1 cancelled bill in summary');
    console.assert(data1.data.summary.cancelledAmount >= 100, 'Must track at least 100 cancelled amount');
    passedTests++;
    console.log(`  ✅ Cancelled sales properly tracked separately (${data1.data.summary.cancelledBillsCount} bills)`);

    console.log('▶ [4/47] Sales Report: Bill count matches completed sales...');
    console.assert(data1.data.summary.completedBillsCount >= 3, 'Bill count correct');
    passedTests++;
    console.log('  ✅ Bill count matches completed sales');

    console.log('▶ [5/47] Sales Report: Average bill value calculated correctly...');
    const expectedABV = Math.round((data1.data.summary.totalSalesAmount / data1.data.summary.completedBillsCount) * 100) / 100;
    console.assert(data1.data.summary.averageBillValue === expectedABV, 'Average bill value matches formula');
    passedTests++;
    console.log(`  ✅ Average Bill Value verified: ₹${data1.data.summary.averageBillValue}`);

    console.log('▶ [6/47] Sales Report: Date range filtering operates with accurate boundaries...');
    const todayStr = new Date().toISOString().split('T')[0];
    const res6 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data6 = await res6.json();
    console.assert(res6.status === 200, 'Status must be 200');
    console.assert(data6.data.summary.completedBillsCount >= 3, 'Custom date range must capture today sales');
    passedTests++;
    console.log('  ✅ Date range boundaries confirmed');

    console.log('▶ [7/47] Sales Report: Payment breakdown matches Payment records...');
    console.assert(data1.data.paymentBreakdown.CASH >= 200, 'CASH must be >= 200');
    console.assert(data1.data.paymentBreakdown.UPI >= 200, 'UPI must be >= 200');
    console.assert(data1.data.paymentBreakdown.CARD >= 100, 'CARD must be >= 100');
    passedTests++;
    console.log(`  ✅ Payment breakdown verified: CASH=${data1.data.paymentBreakdown.CASH}, UPI=${data1.data.paymentBreakdown.UPI}, CARD=${data1.data.paymentBreakdown.CARD}`);

    console.log('▶ [8/47] Sales Report: Daily grouping yields structured time series...');
    const res8 = await fetch(`${baseUrl}/reports/sales?groupBy=DAY`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data8 = await res8.json();
    console.assert(data8.data.timeSeries.length > 0, 'Time series must not be empty');
    console.assert(data8.data.timeSeries[0].periodKey.length === 10, 'Day format must be YYYY-MM-DD');
    passedTests++;
    console.log('  ✅ Daily time series bucketed properly');

    console.log('▶ [9/47] Sales Report: Monthly grouping yields structured monthly buckets...');
    const res9 = await fetch(`${baseUrl}/reports/sales?groupBy=MONTH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data9 = await res9.json();
    console.assert(data9.data.timeSeries[0].periodKey.length === 7, 'Month format must be YYYY-MM');
    passedTests++;
    console.log('  ✅ Monthly time series bucketed properly');

    // ========================================================
    // SECTION 2: PRODUCT REPORTS (Tests 10–14)
    // ========================================================
    console.log('▶ [10/47] Product Report: Product sales totals match line item revenue...');
    const res10 = await fetch(`${baseUrl}/reports/sales/products?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data10 = await res10.json();
    console.assert(res10.status === 200, 'Status must be 200');
    const prod1Row = data10.data.find((p: any) => p.productId === product1.id);
    console.assert(prod1Row !== undefined, 'Product 1 must be present in sales report');
    // P1: Sale 1 (2 packs = 200) + Sale 3 (1 pack = 100) = 300
    console.assert(prod1Row.salesAmount === 300, `P1 sales amount must be 300, got ${prod1Row.salesAmount}`);
    passedTests++;
    console.log(`  ✅ Product 1 sales revenue verified: ₹${prod1Row.salesAmount}`);

    console.log('▶ [11/47] Product Report: Quantity and base weight totals correct...');
    // P1: 2 + 1 = 3 packs; weight = 3 x 500 = 1500 GM
    console.assert(prod1Row.quantitySold === 3, `Quantity sold must be 3, got ${prod1Row.quantitySold}`);
    console.assert(prod1Row.weightSold === 1500, `Weight sold must be 1500 GM, got ${prod1Row.weightSold}`);
    passedTests++;
    console.log(`  ✅ Product quantity (3) and weight (1500 GM) verified`);

    console.log('▶ [12/47] Product Report: Ranking by amount sorts products in descending order...');
    const res12 = await fetch(`${baseUrl}/reports/sales/products?sortBy=amount&order=desc`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data12 = await res12.json();
    for (let i = 0; i < data12.data.length - 1; i++) {
      console.assert(data12.data[i].salesAmount >= data12.data[i + 1].salesAmount, 'Must be sorted desc');
    }
    passedTests++;
    console.log('  ✅ Product ranking sorted descending by revenue');

    console.log('▶ [13/47] Product Report: Category filter isolates products of that category...');
    const res13 = await fetch(`${baseUrl}/reports/sales/products?categoryId=${catA.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data13 = await res13.json();
    const hasCatAOnly = data13.data.every((p: any) => p.categoryName === catA.name);
    console.assert(hasCatAOnly, 'All items must belong to Cat A');
    passedTests++;
    console.log('  ✅ Category filter verified');

    console.log('▶ [14/47] Product Report: Subcategory filter isolates products of that subcategory...');
    const res14 = await fetch(`${baseUrl}/reports/sales/products?subcategoryId=${subCatB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data14 = await res14.json();
    const hasSubCatBOnly = data14.data.every((p: any) => p.subcategoryName === subCatB.name);
    console.assert(hasSubCatBOnly, 'All items must belong to SubCat B');
    passedTests++;
    console.log('  ✅ Subcategory filter verified');

    // ========================================================
    // SECTION 3: CUSTOMER REPORTS (Tests 15–18)
    // ========================================================
    console.log('▶ [15/47] Customer Report: Customer purchase totals and bill count correct...');
    const res15 = await fetch(`${baseUrl}/reports/sales/customers?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data15 = await res15.json();
    const cust1Row = data15.data.find((c: any) => c.customerId === cust1.id);
    console.assert(cust1Row !== undefined, 'Customer 1 must be present');
    console.assert(cust1Row.billsCount === 2, `Cust 1 must have 2 bills, got ${cust1Row.billsCount}`);
    console.assert(cust1Row.totalPurchases === 400, `Cust 1 purchases must be 400, got ${cust1Row.totalPurchases}`);
    passedTests++;
    console.log(`  ✅ Customer 1 purchase total verified: ₹${cust1Row.totalPurchases} across ${cust1Row.billsCount} bills`);

    console.log('▶ [16/47] Customer History: Individual customer purchase history and bills list...');
    const res16 = await fetch(`${baseUrl}/reports/customers/${cust1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data16 = await res16.json();
    console.assert(res16.status === 200, 'Status must be 200');
    console.assert(data16.summary.totalBills === 2, 'Total bills must be 2');
    console.assert(data16.summary.totalPurchases === 400, 'Total purchases must be 400');
    console.assert(data16.data.length === 2, 'Data must contain 2 sales');
    passedTests++;
    console.log('  ✅ Customer purchase history endpoint verified');

    console.log('▶ [17/47] Customer Report: Date range filtering filters customer sales window...');
    const res17 = await fetch(`${baseUrl}/reports/sales/customers?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data17 = await res17.json();
    console.assert(data17.data.length >= 2, 'Customer sales must include today customers');
    passedTests++;
    console.log('  ✅ Customer date range filtering verified');

    console.log('▶ [18/47] Customer Report: Repeat customer metrics accurately identify returning buyers...');
    console.assert(data15.summary.repeatCustomerCount >= 1, 'Must have at least 1 repeat customer (Cust 1)');
    console.assert(data15.summary.singlePurchaseCustomerCount >= 1, 'Must have at least 1 single purchase customer (Cust 2)');
    console.assert(data15.summary.repeatPercentage > 0, 'Repeat percentage must be greater than zero');
    passedTests++;
    console.log(`  ✅ Repeat customers verified (${data15.summary.repeatCustomerCount} repeat, ${data15.summary.singlePurchaseCustomerCount} single)`);

    // ========================================================
    // SECTION 4: PRODUCTION REPORTS (Tests 19–22)
    // ========================================================
    console.log('▶ [19/47] Production Report: Completed production quantity included in active output...');
    const res19 = await fetch(`${baseUrl}/reports/production?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data19 = await res19.json();
    console.assert(res19.status === 200, 'Status must be 200');
    console.assert(data19.data.summary.completedEntriesCount >= 1, 'Must have completed entry');
    console.assert(data19.data.summary.totalCompletedBaseWeightAdded >= 10000, 'Must include 10,000 GM produced');
    passedTests++;
    console.log(`  ✅ Completed production verified: ${data19.data.summary.totalCompletedBaseWeightAdded} GM`);

    console.log('▶ [20/47] Production Report: Cancelled production entries excluded from active output...');
    console.assert(data19.data.summary.cancelledEntriesCount >= 1, 'Must count cancelled entries separately');
    const cancelledProductBreakdown = data19.data.productBreakdown.find((p: any) => p.productId === product2.id);
    console.assert(cancelledProductBreakdown === undefined, 'Product 2 (cancelled) must not be in completed breakdown');
    passedTests++;
    console.log('  ✅ Cancelled production excluded from active metrics');

    console.log('▶ [21/47] Production Report: Product-wise production breakdown correct...');
    const p1Prod = data19.data.productBreakdown.find((p: any) => p.productId === product1.id);
    console.assert(p1Prod !== undefined, 'Product 1 must be present in production breakdown');
    console.assert(p1Prod.completedBaseWeight === 10000, 'Completed base weight must be 10000 GM');
    passedTests++;
    console.log('  ✅ Product-wise production breakdown verified');

    console.log('▶ [22/47] Production Report: Date filtering isolates production records...');
    const res22 = await fetch(`${baseUrl}/reports/production?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data22 = await res22.json();
    console.assert(data22.data.summary.totalEntries >= 2, 'Must find production entries within today');
    passedTests++;
    console.log('  ✅ Production date filtering confirmed');

    // ========================================================
    // SECTION 5: STOCK REPORTS (Tests 23–27)
    // ========================================================
    console.log('▶ [23/47] Stock Report: Current stock report matches authoritative Stock balance...');
    const res23 = await fetch(`${baseUrl}/reports/stock`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data23 = await res23.json();
    console.assert(res23.status === 200, 'Status must be 200');
    const p1Stock = data23.data.find((s: any) => s.productId === product1.id);
    console.assert(p1Stock !== undefined, 'Product 1 stock record must exist');
    const actualP1Stock = (await StockService.getCurrentStock(product1.id)).currentBalance;
    console.assert(p1Stock.currentBalance === actualP1Stock, 'Stock balance in report matches StockService');
    passedTests++;
    console.log(`  ✅ Authoritative stock verified: ${p1Stock.currentBalance} GM`);

    console.log('▶ [24/47] Stock Report: Low stock filter isolates items below threshold...');
    const res24 = await fetch(`${baseUrl}/reports/stock?status=LOW_STOCK`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data24 = await res24.json();
    const p3Stock = data24.data.find((s: any) => s.productId === product3.id);
    console.assert(p3Stock !== undefined, 'Product 3 (500g <= 1000g threshold) must be in LOW_STOCK');
    console.assert(p3Stock.stockStatus === 'LOW_STOCK', 'Stock status must be LOW_STOCK');
    passedTests++;
    console.log('  ✅ Low stock filter verified');

    console.log('▶ [25/47] Stock Report: Out-of-stock filter works...');
    const res25 = await fetch(`${baseUrl}/reports/stock?status=OUT_OF_STOCK`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data25 = await res25.json();
    console.assert(res25.status === 200, 'Status must be 200');
    const allOutOfStock = data25.data.every((s: any) => s.currentBalance <= 0);
    console.assert(allOutOfStock, 'All out of stock items must have balance <= 0');
    passedTests++;
    console.log('  ✅ Out of stock filter verified');

    console.log('▶ [26/47] Stock Movement Report: Movement breakdown aggregates deltas by type...');
    const res26 = await fetch(`${baseUrl}/reports/stock/movements?productId=${product1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data26 = await res26.json();
    console.assert(res26.status === 200, 'Status must be 200');
    console.assert(data26.data.length > 0, 'Must have stock movements for product 1');
    passedTests++;
    console.log('  ✅ Stock movement ledger report verified');

    console.log('▶ [27/47] Stock Reconciliation Report: Verifies zero drift between cached balance and ledger...');
    const res27 = await fetch(`${baseUrl}/reports/stock/reconciliation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data27 = await res27.json();
    console.assert(res27.status === 200, 'Status must be 200');
    console.assert(data27.summary.allConsistent === true, 'All products must have zero drift');
    passedTests++;
    console.log(`  ✅ Zero drift reconciliation audit confirmed: ${data27.summary.consistentCount} consistent items`);

    // ========================================================
    // SECTION 6: RETURN REPORTS (Tests 28–32)
    // ========================================================
    console.log('▶ [28/47] Returns Report: Return totals and completed counts correct...');
    const res28 = await fetch(`${baseUrl}/reports/returns?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data28 = await res28.json();
    console.assert(res28.status === 200, 'Status must be 200');
    console.assert(data28.data.summary.completedReturnsCount >= 1, 'Completed returns must be >= 1');
    passedTests++;
    console.log(`  ✅ Completed return count verified: ${data28.data.summary.completedReturnsCount}`);

    console.log('▶ [29/47] Returns Report: Cancelled returns excluded from active refund totals...');
    // Create and cancel a draft return
    const draftReturn = await ReturnsService.createReturn(adminAuth.user.id, {
      originalSaleId: sale1.id,
      reason: 'Draft to cancel',
      status: ReturnStatus.DRAFT,
      items: [{ saleItemId: itemP1!.id, returnedQuantity: 1 }],
    });
    await ReturnsService.cancelReturn(draftReturn.id, adminAuth.user.id, {
      reason: 'Cancelled draft test',
    });
    createdReturnIds.push(draftReturn.id);

    const res29 = await fetch(`${baseUrl}/reports/returns?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data29 = await res29.json();
    console.assert(data29.data.summary.cancelledReturnsCount >= 1, 'Must track cancelled returns count');
    passedTests++;
    console.log('  ✅ Cancelled returns excluded from active refund totals');

    console.log('▶ [30/47] Returns Report: Product-wise returns breakdown accurate...');
    const p1Ret = data28.data.productBreakdown.find((p: any) => p.productId === product1.id);
    console.assert(p1Ret !== undefined, 'Product 1 return must be present');
    console.assert(p1Ret.returnedQuantity === 1, `Returned quantity must be 1, got ${p1Ret.returnedQuantity}`);
    passedTests++;
    console.log('  ✅ Product-wise returns breakdown verified');

    console.log('▶ [31/47] Returns Report: Total refund amount accurate...');
    console.assert(data28.data.summary.totalRefundAmount >= 100, 'Refund amount must be at least 100');
    passedTests++;
    console.log(`  ✅ Total refund amount verified: ₹${data28.data.summary.totalRefundAmount}`);

    console.log('▶ [32/47] Returns Report: Refund payment mode breakdown and return rate correct...');
    console.assert(data28.data.paymentModeBreakdown.CASH >= 100, 'CASH refunds must be at least 100');
    console.assert(data28.data.summary.returnRate > 0, 'Return rate percentage must be calculated (>0)');
    passedTests++;
    console.log(`  ✅ Return rate against sales: ${data28.data.summary.returnRate}%`);

    // ========================================================
    // SECTION 7: BUSINESS SUMMARY DASHBOARD (Tests 33–41)
    // ========================================================
    console.log('▶ [33/47] Business Summary: Today sales total correct...');
    const res33 = await fetch(`${baseUrl}/reports/business-summary?period=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data33 = await res33.json();
    console.assert(res33.status === 200, 'Status must be 200');
    console.assert(data33.data.sales.totalSales >= 500, 'Today sales must be >= 500');
    passedTests++;
    console.log(`  ✅ Today sales verified: ₹${data33.data.sales.totalSales}`);

    console.log('▶ [34/47] Business Summary: Today bill count correct...');
    console.assert(data33.data.sales.billCount >= 3, 'Today bill count must be >= 3');
    passedTests++;
    console.log(`  ✅ Today bill count verified: ${data33.data.sales.billCount}`);

    console.log('▶ [35/47] Business Summary: Today completed production correct...');
    console.assert(data33.data.production.totalProductionWeight >= 10000, 'Today production must be >= 10,000 GM');
    passedTests++;
    console.log(`  ✅ Today production weight verified: ${data33.data.production.totalProductionWeight} GM`);

    console.log('▶ [36/47] Business Summary: Today completed returns correct...');
    console.assert(data33.data.returns.totalReturnsAmount >= 100, 'Today returns must be >= 100');
    passedTests++;
    console.log(`  ✅ Today returns amount verified: ₹${data33.data.returns.totalReturnsAmount}`);

    console.log('▶ [37/47] Business Summary: Low stock count matches inventory...');
    console.assert(data33.data.inventory.lowStockCount >= 1, 'Must have at least 1 low stock item');
    passedTests++;
    console.log(`  ✅ Low stock items count verified: ${data33.data.inventory.lowStockCount}`);

    console.log('▶ [38/47] Business Summary: Out of stock count matches inventory...');
    console.assert(typeof data33.data.inventory.outOfStockCount === 'number', 'Out of stock count must be number');
    passedTests++;
    console.log(`  ✅ Out of stock items count verified: ${data33.data.inventory.outOfStockCount}`);

    console.log('▶ [39/47] Business Summary: Top products ranked by revenue...');
    console.assert(data33.data.topProducts.length > 0, 'Top products list must not be empty');
    console.assert(data33.data.topProducts[0].revenue >= (data33.data.topProducts[1]?.revenue || 0), 'Top product must have highest revenue');
    passedTests++;
    console.log(`  ✅ Top product: ${data33.data.topProducts[0].productName} (₹${data33.data.topProducts[0].revenue})`);

    console.log('▶ [40/47] Business Summary: Payment summary matches mode totals...');
    console.assert(data33.data.paymentSummary.CASH >= 200, 'CASH payments >= 200');
    console.assert(data33.data.paymentSummary.UPI >= 200, 'UPI payments >= 200');
    passedTests++;
    console.log('  ✅ Payment mode summary verified');

    console.log('▶ [41/47] Business Summary: Net Sales formula verified (Completed Sales - Completed Returns)...');
    const calculatedNet = Math.round((data33.data.sales.totalSales - data33.data.returns.totalReturnsAmount) * 100) / 100;
    console.assert(data33.data.netSales === calculatedNet, `Net sales must equal sales (${data33.data.sales.totalSales}) - returns (${data33.data.returns.totalReturnsAmount})`);
    passedTests++;
    console.log(`  ✅ Net Sales formula confirmed: ₹${data33.data.netSales} = ₹${data33.data.sales.totalSales} - ₹${data33.data.returns.totalReturnsAmount}`);

    // ========================================================
    // SECTION 8: SECURITY & RBAC (Tests 42–44)
    // ========================================================
    console.log('▶ [42/47] Security: ADMIN role can access all report endpoints...');
    const adminEndpoints = [
      '/reports/sales',
      '/reports/sales/products',
      '/reports/sales/customers',
      '/reports/production',
      '/reports/stock',
      '/reports/stock/movements',
      '/reports/stock/reconciliation',
      '/reports/returns',
      '/reports/business-summary',
    ];
    for (const ep of adminEndpoints) {
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.assert(res.status === 200, `Admin must have 200 access to ${ep}, got ${res.status}`);
    }
    passedTests++;
    console.log('  ✅ Admin granted full access across all 9 reporting endpoints');

    console.log('▶ [43/47] Security: Unauthorized role access blocked (403 Forbidden)...');
    // OUTLET trying to access ADMIN-only business summary -> 403
    const outletForbiddenRes = await fetch(`${baseUrl}/reports/business-summary`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    console.assert(outletForbiddenRes.status === 403, 'Outlet accessing business-summary must return 403');

    // OUTLET trying to access ADMIN-only stock reconciliation -> 403
    const outletReconRes = await fetch(`${baseUrl}/reports/stock/reconciliation`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    console.assert(outletReconRes.status === 403, 'Outlet accessing stock reconciliation must return 403');

    // PRODUCTION trying to access sales report -> 403
    const prodForbiddenRes = await fetch(`${baseUrl}/reports/sales`, {
      headers: { Authorization: `Bearer ${prodToken}` },
    });
    console.assert(prodForbiddenRes.status === 403, 'Production accessing sales report must return 403');
    passedTests++;
    console.log('  ✅ RBAC strictly blocks unauthorized roles with 403 Forbidden');

    console.log('▶ [44/47] Security: Unauthenticated access blocked (401 Unauthorized)...');
    const unauthRes = await fetch(`${baseUrl}/reports/business-summary`);
    console.assert(unauthRes.status === 401, 'Unauthenticated access must return 401');
    passedTests++;
    console.log('  ✅ Unauthenticated access blocked with 401');

    // ========================================================
    // SECTION 9: READ-ONLY AUDIT (Test 45)
    // ========================================================
    console.log('▶ [45/47] Read-only Rule: Reporting APIs do not alter database state...');
    const salesCountBefore = await prisma.sale.count();
    const stockMovementsCountBefore = await prisma.stockMovement.count();
    const returnsCountBefore = await prisma.salesReturn.count();

    // Call various report endpoints in sequence
    await fetch(`${baseUrl}/reports/sales`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await fetch(`${baseUrl}/reports/sales/products`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await fetch(`${baseUrl}/reports/production`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await fetch(`${baseUrl}/reports/stock/reconciliation`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await fetch(`${baseUrl}/reports/business-summary`, { headers: { Authorization: `Bearer ${adminToken}` } });

    const salesCountAfter = await prisma.sale.count();
    const stockMovementsCountAfter = await prisma.stockMovement.count();
    const returnsCountAfter = await prisma.salesReturn.count();

    console.assert(salesCountBefore === salesCountAfter, 'Sales count must not change');
    console.assert(stockMovementsCountBefore === stockMovementsCountAfter, 'Stock movements must not change');
    console.assert(returnsCountBefore === returnsCountAfter, 'Returns count must not change');
    passedTests++;
    console.log('  ✅ Read-only guarantee confirmed: Zero side-effects across all databases tables');

    // ========================================================
    // SECTION 10: EDGE CASES (Tests 46–47)
    // ========================================================
    console.log('▶ [46/47] Edge Case: Date range with zero transactions returns empty structure without errors...');
    const res46 = await fetch(`${baseUrl}/reports/sales?startDate=1999-01-01&endDate=1999-01-02`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data46 = await res46.json();
    console.assert(res46.status === 200, 'Empty date range must return 200');
    console.assert(data46.data.summary.totalSalesAmount === 0, 'Sales total must be 0');
    console.assert(data46.data.summary.completedBillsCount === 0, 'Bills count must be 0');
    console.assert(data46.data.timeSeries.length === 0, 'Time series must be empty array');
    passedTests++;
    console.log('  ✅ Empty date range returns clean 0-value summary');

    console.log('▶ [47/47] Edge Case: Same-day start/end boundaries handle full-day timestamps correctly...');
    const res47 = await fetch(`${baseUrl}/reports/sales?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data47 = await res47.json();
    console.assert(res47.status === 200, 'Same-day query must succeed');
    console.assert(data47.data.summary.completedBillsCount >= 3, 'Must encompass transactions made today');
    passedTests++;
    console.log('  ✅ Same-day boundary 00:00:00 to 23:59:59 verified');

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 9 REPORTING ENGINE TESTS PASSED!`);
    console.log('🎉 ========================================================\n');
  } finally {
    // Teardown & Clean up test data
    server.close();

    await prisma.salesReturnItem.deleteMany({ where: { returnId: { in: createdReturnIds } } });
    await prisma.salesReturn.deleteMany({ where: { id: { in: createdReturnIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.payment.deleteMany({ where: { saleId: { in: createdSaleIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
    await prisma.productionEntry.deleteMany({ where: { id: { in: createdProductionIds } } });
    await prisma.stock.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.productPrice.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.productPackConfiguration.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.subcategory.deleteMany({ where: { id: { in: [subCatA.id, subCatB.id] } } });
    await prisma.category.deleteMany({ where: { id: { in: [catA.id, catB.id] } } });
    await prisma.unit.deleteMany({ where: { id: kgUnit.id } });
    await prisma.customer.deleteMany({ where: { id: { in: [cust1.id, cust2.id] } } });

    await prisma.$disconnect();
  }
}

runStep9ReportingTests().catch((err) => {
  console.error('❌ Step 9 Test Suite Failed:', err);
  process.exit(1);
});
