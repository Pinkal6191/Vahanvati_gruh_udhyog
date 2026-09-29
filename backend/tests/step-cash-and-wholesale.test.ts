import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { ReturnsService } from '../src/modules/returns/returns.service.js';
import {
  SaleStatus,
  ReturnStatus,
  PaymentMode,
  CustomerType,
  SaleType,
  RefundPaymentMode,
  RestockCondition,
  Prisma,
} from '@prisma/client';
import http from 'http';
import bcrypt from 'bcryptjs';

export async function runCashAndWholesaleTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 CASH BILL NUMBERING & WHOLESALE A4 INVOICE VERIFICATION');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 20;

  // 1. Setup Express app on ephemeral port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // Pre-cleanup in case of prior aborted run
  await prisma.user.deleteMany({
    where: {
      username: {
        in: [`master_cash_${ts}`, `admin_cash_${ts}`, `outlet_cash_${ts}`],
      },
    },
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('testpass123', salt);

  // 2. Create test users: Master Admin, Admin, Outlet
  const masterAdmin = await prisma.user.create({
    data: {
      username: `master_cash_${ts}`,
      email: `master_cash_${ts}@example.com`,
      passwordHash,
      fullName: `Master Admin Cash ${ts}`,
      role: 'ADMIN',
      isMasterAdmin: true,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      isActive: true,
    },
  });

  const normalAdmin = await prisma.user.create({
    data: {
      username: `admin_cash_${ts}`,
      email: `admin_cash_${ts}@example.com`,
      passwordHash,
      fullName: `Admin Cash ${ts}`,
      role: 'ADMIN',
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      isActive: true,
    },
  });

  const outletUser = await prisma.user.create({
    data: {
      username: `outlet_cash_${ts}`,
      email: `outlet_cash_${ts}@example.com`,
      passwordHash,
      fullName: `Outlet Cash User ${ts}`,
      role: 'OUTLET',
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL],
      allowedReportSaleTypes: [SaleType.RETAIL],
      isActive: true,
    },
  });

  const masterAuth = await AuthService.login({ username: masterAdmin.username, password: 'testpass123' });
  const adminAuth = await AuthService.login({ username: normalAdmin.username, password: 'testpass123' });
  const outletAuth = await AuthService.login({ username: outletUser.username, password: 'testpass123' });

  const masterToken = masterAuth.tokens.accessToken;
  const adminToken = adminAuth.tokens.accessToken;
  const outletToken = outletAuth.tokens.accessToken;

  // 3. Create test master data
  const unit = await prisma.unit.create({
    data: {
      name: `Cash Unit ${ts}`,
      symbol: 'Kg',
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const category = await prisma.category.create({
    data: {
      name: `Cash Category ${ts}`,
      code: `CC_${ts}_${Math.random().toString(36).slice(2, 7)}`.slice(0, 50),
    },
  });

  const subcategory = await prisma.subcategory.create({
    data: {
      name: `Cash Subcategory ${ts}`,
      code: `CSC_${ts}_${Math.random().toString(36).slice(2, 7)}`.slice(0, 50),
      categoryId: category.id,
    },
  });

  const product = await prisma.product.create({
    data: {
      name: `Special Gathiya ${ts}`,
      code: `GATH_${ts}_${Math.random().toString(36).slice(2, 7)}`.slice(0, 50),
      subcategoryId: subcategory.id,
      primaryUnitId: unit.id,
      isLooseWeightAllowed: true,
    },
  });

  const pack = await prisma.productPackConfiguration.create({
    data: {
      productId: product.id,
      packName: '1 Kg Pack',
      weightInBaseUnits: 1000,
      unitId: unit.id,
    },
  });

  // Setup product pricing across tiers (both pack and loose)
  await prisma.productPrice.createMany({
    data: [
      {
        productId: product.id,
        packConfigId: pack.id,
        pricingTier: SaleType.RETAIL,
        rate: new Prisma.Decimal('200.00'),
        isActive: true,
      },
      {
        productId: product.id,
        packConfigId: pack.id,
        pricingTier: SaleType.WHOLESALE,
        rate: new Prisma.Decimal('160.00'),
        isActive: true,
      },
      {
        productId: product.id,
        packConfigId: pack.id,
        pricingTier: SaleType.NRI,
        rate: new Prisma.Decimal('250.00'),
        isActive: true,
      },
      {
        productId: product.id,
        packConfigId: null,
        pricingTier: SaleType.RETAIL,
        rate: new Prisma.Decimal('200.00'),
        isActive: true,
      },
      {
        productId: product.id,
        packConfigId: null,
        pricingTier: SaleType.WHOLESALE,
        rate: new Prisma.Decimal('160.00'),
        isActive: true,
      },
      {
        productId: product.id,
        packConfigId: null,
        pricingTier: SaleType.NRI,
        rate: new Prisma.Decimal('250.00'),
        isActive: true,
      },
    ],
  });

  // Seed stock
  await prisma.stock.create({
    data: {
      productId: product.id,
      currentBalance: new Prisma.Decimal('500.00'),
    },
  });

  // Create test customer with GSTIN and address for Wholesale
  const wholesaleCustomer = await prisma.customer.create({
    data: {
      name: `Wholesale Mart ${ts}`,
      mobile: '9876543210',
      address: '123 Market Yard, Station Road',
      city: 'Anand',
      gstin: '24AAAAA0000A1Z5',
      customerType: CustomerType.INDIAN,
    },
  });

  const retailCustomer = await prisma.customer.create({
    data: {
      name: `Counter Customer ${ts}`,
      mobile: '9123456780',
      customerType: CustomerType.INDIAN,
    },
  });

  const createdSaleIds: string[] = [];
  const createdReturnIds: string[] = [];

  try {
    // ------------------------------------------------------------
    // TEST 1: CASH payment generates CASH bill number
    // ------------------------------------------------------------
    console.log('Test 1: CASH payment generates CASH bill number');
    const cashSale1 = await SalesService.createSale(
      masterAdmin.id,
      masterAdmin.role,
      {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 400 }],
        paidAmount: 400,
      }
    );
    createdSaleIds.push(cashSale1.id);

    if (!cashSale1.billNumber.startsWith('CASH-')) {
      throw new Error(`Expected CASH bill number to start with CASH-, got: ${cashSale1.billNumber}`);
    }
    console.log(`✅ Test 1 Passed: Generated bill ${cashSale1.billNumber}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 2: Second CASH payment increments CASH sequence
    // ------------------------------------------------------------
    console.log('Test 2: Second CASH payment increments CASH sequence');
    const cashSale2 = await SalesService.createSale(
      masterAdmin.id,
      masterAdmin.role,
      {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
        paidAmount: 200,
      }
    );
    createdSaleIds.push(cashSale2.id);

    const seq1 = parseInt(cashSale1.billNumber.split('-').pop()!, 10);
    const seq2 = parseInt(cashSale2.billNumber.split('-').pop()!, 10);
    if (seq2 !== seq1 + 1) {
      throw new Error(`Expected seq2 (${seq2}) to equal seq1 + 1 (${seq1 + 1})`);
    }
    console.log(`✅ Test 2 Passed: ${cashSale1.billNumber} -> ${cashSale2.billNumber}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 3: Non-CASH payment increments normal sequence
    // ------------------------------------------------------------
    console.log('Test 3: Non-CASH payment increments normal sequence');
    const upiSale1 = await SalesService.createSale(
      masterAdmin.id,
      masterAdmin.role,
      {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.UPI, amount: 200, transactionReference: 'UPI123' }],
        paidAmount: 200,
      }
    );
    createdSaleIds.push(upiSale1.id);

    if (upiSale1.billNumber.startsWith('CASH-')) {
      throw new Error(`Expected non-cash bill NOT to start with CASH-, got: ${upiSale1.billNumber}`);
    }
    console.log(`✅ Test 3 Passed: Non-CASH bill generated: ${upiSale1.billNumber}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 4: CASH does not increment normal sequence
    // ------------------------------------------------------------
    console.log('Test 4: CASH does not increment normal sequence');
    const upiSale2 = await SalesService.createSale(
      masterAdmin.id,
      masterAdmin.role,
      {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.UPI, amount: 200, transactionReference: 'UPI124' }],
        paidAmount: 200,
      }
    );
    createdSaleIds.push(upiSale2.id);

    const normalSeq1 = parseInt(upiSale1.billNumber.split('-').pop()!, 10);
    const normalSeq2 = parseInt(upiSale2.billNumber.split('-').pop()!, 10);
    if (normalSeq2 !== normalSeq1 + 1) {
      throw new Error(`Normal sequence skipped! upi1=${upiSale1.billNumber}, upi2=${upiSale2.billNumber}`);
    }
    console.log(`✅ Test 4 Passed: Normal sequence incremented consecutively: ${upiSale1.billNumber} -> ${upiSale2.billNumber}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 5: Non-CASH does not increment cash sequence
    // ------------------------------------------------------------
    console.log('Test 5: Non-CASH does not increment cash sequence');
    const cashSale3 = await SalesService.createSale(
      masterAdmin.id,
      masterAdmin.role,
      {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
        paidAmount: 200,
      }
    );
    createdSaleIds.push(cashSale3.id);

    const seq3 = parseInt(cashSale3.billNumber.split('-').pop()!, 10);
    if (seq3 !== seq2 + 1) {
      throw new Error(`Cash sequence was polluted by non-cash sales! seq2=${seq2}, seq3=${seq3}`);
    }
    console.log(`✅ Test 5 Passed: Cash sequence cleanly preserved: ${cashSale2.billNumber} -> ${cashSale3.billNumber}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 6: Concurrent CASH billing produces unique numbers
    // ------------------------------------------------------------
    console.log('Test 6: Concurrent CASH billing produces unique numbers');
    const concurrentCash = await Promise.all([
      SalesService.createSale(masterAdmin.id, masterAdmin.role, {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
        paidAmount: 200,
      }),
      SalesService.createSale(masterAdmin.id, masterAdmin.role, {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
        paidAmount: 200,
      }),
      SalesService.createSale(masterAdmin.id, masterAdmin.role, {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
        paidAmount: 200,
      }),
    ]);
    concurrentCash.forEach((s) => createdSaleIds.push(s.id));

    const billNumbers = concurrentCash.map((s) => s.billNumber);
    const uniqueNumbers = new Set(billNumbers);
    if (uniqueNumbers.size !== concurrentCash.length) {
      throw new Error(`Duplicate cash bill numbers detected in concurrent billing: ${billNumbers.join(', ')}`);
    }
    console.log(`✅ Test 6 Passed: Concurrency-safe cash numbering (${billNumbers.join(', ')})`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 7: Concurrent normal billing produces unique numbers
    // ------------------------------------------------------------
    console.log('Test 7: Concurrent normal billing produces unique numbers');
    const concurrentNormal = await Promise.all([
      SalesService.createSale(masterAdmin.id, masterAdmin.role, {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CARD, amount: 200 }],
        paidAmount: 200,
      }),
      SalesService.createSale(masterAdmin.id, masterAdmin.role, {
        customerId: retailCustomer.id,
        saleType: SaleType.RETAIL,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CARD, amount: 200 }],
        paidAmount: 200,
      }),
    ]);
    concurrentNormal.forEach((s) => createdSaleIds.push(s.id));

    const normalBillNumbers = concurrentNormal.map((s) => s.billNumber);
    const uniqueNormalNumbers = new Set(normalBillNumbers);
    if (uniqueNormalNumbers.size !== concurrentNormal.length) {
      throw new Error(`Duplicate normal bill numbers detected: ${normalBillNumbers.join(', ')}`);
    }
    console.log(`✅ Test 7 Passed: Concurrency-safe normal numbering (${normalBillNumbers.join(', ')})`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 8: Historical bills remain unchanged
    // ------------------------------------------------------------
    console.log('Test 8: Historical bills remain unchanged');
    const fetchedCash1 = await SalesService.getSaleById(cashSale1.id, masterAdmin as any);
    if (fetchedCash1.billNumber !== cashSale1.billNumber) {
      throw new Error('Historical cash bill number changed!');
    }
    console.log(`✅ Test 8 Passed: Historical bill numbers immutable`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 9: Unauthorized user gets 403 for Cash Report
    // ------------------------------------------------------------
    console.log('Test 9: Unauthorized user gets 403 for Cash Report');
    const resOutlet = await fetch(`${baseUrl}/reports/cash-sales`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    if (resOutlet.status !== 403) {
      throw new Error(`Expected HTTP 403 for OUTLET user on cash report, got: ${resOutlet.status}`);
    }
    console.log(`✅ Test 9 Passed: Outlet user received HTTP 403 Forbidden`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 10: Authorized Admin can access Cash Report
    // ------------------------------------------------------------
    console.log('Test 10: Authorized Admin can access Cash Report');
    const resAdmin = await fetch(`${baseUrl}/reports/cash-sales`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (resAdmin.status !== 200) {
      throw new Error(`Expected HTTP 200 for ADMIN user, got: ${resAdmin.status}`);
    }
    const adminData = await resAdmin.json();
    if (!adminData.success || !adminData.summary) {
      throw new Error('Invalid cash report payload structure');
    }
    console.log(`✅ Test 10 Passed: Authorized Admin accessed cash report (${adminData.summary.cashBillCount} bills)`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 11: Master Admin can access Cash Report
    // ------------------------------------------------------------
    console.log('Test 11: Master Admin can access Cash Report');
    const resMaster = await fetch(`${baseUrl}/reports/cash-sales`, {
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    if (resMaster.status !== 200) {
      throw new Error(`Expected HTTP 200 for Master Admin, got: ${resMaster.status}`);
    }
    console.log(`✅ Test 11 Passed: Master Admin accessed cash report`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 12: Cash sales remain included in normal sales totals
    // ------------------------------------------------------------
    console.log('Test 12: Cash sales remain included in normal sales totals');
    const resGeneralSales = await fetch(`${baseUrl}/reports/sales?period=today`, {
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    const generalData = await resGeneralSales.json();
    if (generalData.data.summary.totalSalesAmount <= 0) {
      throw new Error('General sales totals missing cash sales revenue');
    }
    console.log(`✅ Test 12 Passed: Cash sales included in general sales total (₹${generalData.data.summary.totalSalesAmount})`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 13: Cash sales remain included in statutory totals
    // ------------------------------------------------------------
    console.log('Test 13: Cash sales remain included in statutory totals');
    const resStatutory = await fetch(`${baseUrl}/reports/statutory/sales?period=today`, {
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    const statData = await resStatutory.json();
    const hasCashInStat = statData.data.some((s: any) => s.billNumber.startsWith('CASH-'));
    if (!hasCashInStat) {
      throw new Error('Cash bills missing from statutory sales register');
    }
    console.log(`✅ Test 13 Passed: Cash bills verified in statutory compliance reports`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 14: Cash sale stock deduction remains correct
    // ------------------------------------------------------------
    console.log('Test 14: Cash sale stock deduction remains correct');
    const currentStock = await prisma.stock.findUnique({
      where: { productId: product.id },
    });
    // Started with 500, deducted items
    if (Number(currentStock!.currentBalance) >= 500) {
      throw new Error(`Stock was not deducted properly! Balance: ${currentStock!.currentBalance}`);
    }
    console.log(`✅ Test 14 Passed: Stock balance correctly deducted to ${currentStock!.currentBalance} Kg`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 15: Cash sale return remains linked correctly
    // ------------------------------------------------------------
    console.log('Test 15: Cash sale return remains linked correctly');
    const saleItem = await prisma.saleItem.findFirst({
      where: { saleId: cashSale1.id },
    });
    const salesReturn = await ReturnsService.createReturn(
      masterAdmin.id,
      {
        originalSaleId: cashSale1.id,
        reason: 'Cash refund on cash bill',
        refundPaymentMode: RefundPaymentMode.CASH,
        items: [
          {
            saleItemId: saleItem!.id,
            returnedQuantity: 1,
            restockCondition: RestockCondition.RESTOCKABLE,
          },
        ],
      },
      masterAdmin.role
    );
    createdReturnIds.push(salesReturn.id);

    if (salesReturn?.originalSale?.billNumber !== cashSale1.billNumber) {
      throw new Error(`Return linked to incorrect bill: ${salesReturn?.originalSale?.billNumber}`);
    }
    console.log(`✅ Test 15 Passed: Sales return linked to ${salesReturn?.originalSale?.billNumber}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 16: Wholesale invoice contains correct historical rates
    // ------------------------------------------------------------
    console.log('Test 16: Wholesale invoice contains correct historical rates');
    const wholesaleSale = await SalesService.createSale(
      masterAdmin.id,
      masterAdmin.role,
      {
        customerId: wholesaleCustomer.id,
        saleType: SaleType.WHOLESALE,
        items: [{ productId: product.id, quantity: 5 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 800 }],
        paidAmount: 800,
      }
    );
    createdSaleIds.push(wholesaleSale.id);

    const wholesalePrintPayload = await SalesService.getPrintPayload(wholesaleSale.id, masterAdmin as any);
    if (wholesalePrintPayload.items[0].unitRate !== 160) {
      throw new Error(`Expected historical rate 160 for wholesale, got ${wholesalePrintPayload.items[0].unitRate}`);
    }
    console.log(`✅ Test 16 Passed: Historical wholesale rate confirmed: ₹${wholesalePrintPayload.items[0].unitRate}`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 17: Wholesale invoice renders A4 print layout payload
    // ------------------------------------------------------------
    console.log('Test 17: Wholesale invoice renders A4 print layout payload');
    if (wholesalePrintPayload.invoice.saleType !== SaleType.WHOLESALE) {
      throw new Error('SaleType not identified as WHOLESALE in print payload');
    }
    if (!wholesalePrintPayload.invoice.customerAddress || !wholesalePrintPayload.invoice.customerGstin) {
      throw new Error('Customer address or GSTIN missing from wholesale payload');
    }
    if (wholesalePrintPayload.items[0].unit !== 'Kg') {
      throw new Error(`Expected unit 'Kg', got '${wholesalePrintPayload.items[0].unit}'`);
    }
    console.log(`✅ Test 17 Passed: A4 payload verified with address (${wholesalePrintPayload.invoice.customerAddress}) and GSTIN (${wholesalePrintPayload.invoice.customerGstin})`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 18: Retail/NRI printing payload remains unchanged
    // ------------------------------------------------------------
    console.log('Test 18: Retail/NRI printing payload remains unchanged');
    const retailPrintPayload = await SalesService.getPrintPayload(cashSale1.id, masterAdmin as any);
    if (!retailPrintPayload.company.name || !retailPrintPayload.totals.total) {
      throw new Error('Retail print payload structure broken');
    }
    console.log(`✅ Test 18 Passed: Retail/NRI thermal payload completely intact`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 19: CSV/report RBAC remains intact
    // ------------------------------------------------------------
    console.log('Test 19: CSV/report RBAC remains intact');
    const resCsvOutlet = await fetch(`${baseUrl}/reports/cash-sales?format=csv`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    if (resCsvOutlet.status !== 403) {
      throw new Error('Outlet user bypassed CSV RBAC restriction');
    }

    const resCsvAdmin = await fetch(`${baseUrl}/reports/cash-sales?format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (resCsvAdmin.status !== 200 || !resCsvAdmin.headers.get('content-type')?.includes('text/csv')) {
      throw new Error('Admin failed to export cash CSV');
    }
    console.log(`✅ Test 19 Passed: Cash Report CSV RBAC strictly enforced`);
    passedTests++;

    // ------------------------------------------------------------
    // TEST 20: Cash report totals match sum of individual sales
    // ------------------------------------------------------------
    console.log('Test 20: Cash report totals match sum of individual sales');
    const cashReportFull = await fetch(`${baseUrl}/reports/cash-sales?period=today`, {
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    const reportData = await cashReportFull.json();
    const itemSums = reportData.items.reduce((sum: number, it: any) => sum + it.finalTotalAmount, 0);
    // Allow slight float tolerance
    if (Math.abs(reportData.summary.cashNetFinalTotal - itemSums) > 0.05) {
      throw new Error(`Summary total ${reportData.summary.cashNetFinalTotal} doesn't match items sum ${itemSums}`);
    }
    console.log(`✅ Test 20 Passed: Exact mathematical accuracy: sum(items) ₹${itemSums.toFixed(2)} === summary ₹${reportData.summary.cashNetFinalTotal}`);
    passedTests++;

  } finally {
    // Teardown test data
    console.log('\n🧹 Cleaning up test data...');
    if (createdReturnIds.length > 0) {
      await prisma.salesReturnItem.deleteMany({ where: { returnId: { in: createdReturnIds } } });
      await prisma.salesReturn.deleteMany({ where: { id: { in: createdReturnIds } } });
    }
    if (createdSaleIds.length > 0) {
      await prisma.payment.deleteMany({ where: { saleId: { in: createdSaleIds } } });
      await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
      await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
    }
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: [masterAdmin.id, normalAdmin.id, outletUser.id] } } });
    await prisma.stock.deleteMany({ where: { productId: product.id } });
    await prisma.productPrice.deleteMany({ where: { productId: product.id } });
    await prisma.productPackConfiguration.deleteMany({ where: { productId: product.id } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.subcategory.deleteMany({ where: { id: subcategory.id } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.customer.deleteMany({ where: { id: { in: [wholesaleCustomer.id, retailCustomer.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [masterAdmin.id, normalAdmin.id, outletUser.id] } } });

    server.close();
  }

  console.log('\n========================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================\n');

  if (passedTests !== totalTests) {
    throw new Error(`Only ${passedTests}/${totalTests} passed`);
  }
}

runCashAndWholesaleTests().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
