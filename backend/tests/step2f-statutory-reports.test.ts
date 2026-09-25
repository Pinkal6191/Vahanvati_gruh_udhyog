import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import {
  SaleStatus,
  ReturnStatus,
  PaymentMode,
  RefundPaymentMode,
  CustomerType,
  SaleType,
  Prisma,
} from '@prisma/client';
import http from 'http';
import bcrypt from 'bcryptjs';

export async function runStep2fStatutoryReportsTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PHASE 2F — STATUTORY / CA COMPLIANCE REPORTING & EXPORT');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 26;

  // 1. Setup Express app on ephemeral port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // 2. Fetch seed users & tokens
  const adminAuth = await AuthService.login({ username: 'admin', password: 'admin123' });
  const adminToken = adminAuth.tokens.accessToken;
  const adminUser = adminAuth.user;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('testpass123', salt);

  // Create restricted test user:
  // allowedBillingSaleTypes: [RETAIL, NRI, WHOLESALE]
  // allowedReportSaleTypes: [RETAIL]
  const restrictedUser = await prisma.user.create({
    data: {
      username: `ca_restricted_${ts}`,
      email: `ca_restricted_${ts}@example.com`,
      passwordHash,
      fullName: `CA Restricted User ${ts}`,
      role: 'OUTLET',
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL],
      isActive: true,
    },
  });

  const restrictedAuth = await AuthService.login({
    username: restrictedUser.username,
    password: 'testpass123',
  });
  const restrictedToken = restrictedAuth.tokens.accessToken;

  // 3. Create test unit, categories, products
  const kgUnit = await prisma.unit.create({
    data: {
      name: `CA KG Unit ${ts}`,
      symbol: `ckg${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const cat = await prisma.category.create({
    data: {
      name: `CA Cat ${ts}`,
      code: `CAC_${ts.toString().slice(-4)}`,
      displayOrder: 1,
    },
  });

  const subCat = await prisma.subcategory.create({
    data: {
      categoryId: cat.id,
      name: `CA SubCat ${ts}`,
      code: `CAS_${ts.toString().slice(-4)}`,
      displayOrder: 1,
    },
  });

  const prodA = await prisma.product.create({
    data: {
      subcategoryId: subCat.id,
      primaryUnitId: kgUnit.id,
      name: `Special =Math Sev, "Gujarati" ${ts}`, // formula trigger + commas + quotes to test escaping
      code: `SEV_${ts.toString().slice(-4)}`,
      isLooseWeightAllowed: true,
    },
  });

  const prodB = await prisma.product.create({
    data: {
      subcategoryId: subCat.id,
      primaryUnitId: kgUnit.id,
      name: `Wholesale Gathiya ${ts}`,
      code: `GAT_${ts.toString().slice(-4)}`,
      isLooseWeightAllowed: true,
    },
  });

  const packA = await prisma.productPackConfiguration.create({
    data: {
      productId: prodA.id,
      packName: '500g Pack',
      weightInBaseUnits: 500,
      unitId: kgUnit.id,
    },
  });

  // Current ProductPrice
  const priceA = await prisma.productPrice.create({
    data: {
      productId: prodA.id,
      packConfigId: packA.id,
      pricingTier: SaleType.RETAIL,
      rate: 100.0,
      effectiveFrom: new Date('2020-01-01'),
      createdById: adminUser.id,
    },
  });

  // 4. Create Customers: B2B with GSTIN, B2C without GSTIN
  const custB2B = await prisma.customer.create({
    data: {
      name: `=SUM(A1) B2B Trader Ltd ${ts}`, // formula trigger
      mobile: `98765${ts.toString().slice(-5)}`,
      customerType: CustomerType.INDIAN,
      gstin: '24AAACV1234A1Z5',
    },
  });

  const custB2C = await prisma.customer.create({
    data: {
      name: `Regular Retailer Patel, "Ahmedabad" ${ts}`,
      mobile: `98764${ts.toString().slice(-5)}`,
      customerType: CustomerType.INDIAN,
      gstin: null,
    },
  });

  const custNRI = await prisma.customer.create({
    data: {
      name: `NRI International Guest ${ts}`,
      mobile: `12345${ts.toString().slice(-5)}`,
      customerType: CustomerType.NRI,
      gstin: null,
    },
  });

  // 5. Create Test Sales with exact timestamps and authoritative snapshots
  const testSaleIds: string[] = [];
  const testReturnIds: string[] = [];

  // Sale 1: RETAIL, B2B, COMPLETED (Subtotal: 1000, Discount: 100, Tax: 50, Total: 950)
  const sale1 = await prisma.sale.create({
    data: {
      billNumber: `CA-RET-B2B-${ts}`,
      customerId: custB2B.id,
      customerNameSnapshot: custB2B.name,
      customerMobileSnapshot: custB2B.mobile,
      customerTypeSnapshot: CustomerType.INDIAN,
      customerGstinSnapshot: custB2B.gstin,
      saleType: SaleType.RETAIL,
      totalItemsCount: 1,
      subtotalAmount: new Prisma.Decimal(1000.0),
      discountAmount: new Prisma.Decimal(100.0),
      taxAmount: new Prisma.Decimal(50.0),
      finalTotalAmount: new Prisma.Decimal(950.0),
      paidAmount: new Prisma.Decimal(950.0),
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: adminUser.id,
      createdAt: new Date('2027-02-15T10:00:00.000Z'),
      items: {
        create: [
          {
            productId: prodA.id,
            packConfigId: packA.id,
            productNameSnapshot: prodA.name,
            unitSymbolSnapshot: 'kg',
            weightOrPackSnapshot: '500g Pack',
            saleTypeSnapshot: SaleType.RETAIL,
            quantity: new Prisma.Decimal(10),
            baseWeightDeducted: new Prisma.Decimal(5000),
            unitRate: new Prisma.Decimal(100.0),
            subtotal: new Prisma.Decimal(1000.0),
            discount: new Prisma.Decimal(0.0),
            total: new Prisma.Decimal(1000.0),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.UPI,
            amount: new Prisma.Decimal(950.0),
            transactionReference: 'UPI-REF-001',
          },
        ],
      },
    },
    include: { items: true },
  });
  testSaleIds.push(sale1.id);

  // Sale 2: NRI, B2C, COMPLETED (Subtotal: 2000, Discount: 0, Tax: 100, Total: 2100)
  const sale2 = await prisma.sale.create({
    data: {
      billNumber: `CA-NRI-B2C-${ts}`,
      customerId: custNRI.id,
      customerNameSnapshot: custNRI.name,
      customerMobileSnapshot: custNRI.mobile,
      customerTypeSnapshot: CustomerType.NRI,
      customerGstinSnapshot: null,
      saleType: SaleType.NRI,
      totalItemsCount: 1,
      subtotalAmount: new Prisma.Decimal(2000.0),
      discountAmount: new Prisma.Decimal(0.0),
      taxAmount: new Prisma.Decimal(100.0),
      finalTotalAmount: new Prisma.Decimal(2100.0),
      paidAmount: new Prisma.Decimal(2100.0),
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: adminUser.id,
      createdAt: new Date('2027-02-15T11:00:00.000Z'),
      items: {
        create: [
          {
            productId: prodA.id,
            packConfigId: packA.id,
            productNameSnapshot: prodA.name,
            unitSymbolSnapshot: 'kg',
            weightOrPackSnapshot: '500g Pack',
            saleTypeSnapshot: SaleType.NRI,
            quantity: new Prisma.Decimal(20),
            baseWeightDeducted: new Prisma.Decimal(10000),
            unitRate: new Prisma.Decimal(100.0),
            subtotal: new Prisma.Decimal(2000.0),
            discount: new Prisma.Decimal(0.0),
            total: new Prisma.Decimal(2000.0),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.CARD,
            amount: new Prisma.Decimal(2100.0),
          },
        ],
      },
    },
    include: { items: true },
  });
  testSaleIds.push(sale2.id);

  // Sale 3: WHOLESALE, B2B, COMPLETED (Subtotal: 5000, Discount: 200, Tax: 250, Total: 5050)
  const sale3 = await prisma.sale.create({
    data: {
      billNumber: `CA-WHL-B2B-${ts}`,
      customerId: custB2B.id,
      customerNameSnapshot: custB2B.name,
      customerMobileSnapshot: custB2B.mobile,
      customerTypeSnapshot: CustomerType.INDIAN,
      customerGstinSnapshot: custB2B.gstin,
      saleType: SaleType.WHOLESALE,
      totalItemsCount: 1,
      subtotalAmount: new Prisma.Decimal(5000.0),
      discountAmount: new Prisma.Decimal(200.0),
      taxAmount: new Prisma.Decimal(250.0),
      finalTotalAmount: new Prisma.Decimal(5050.0),
      paidAmount: new Prisma.Decimal(5050.0),
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: adminUser.id,
      createdAt: new Date('2027-02-15T12:00:00.000Z'),
      items: {
        create: [
          {
            productId: prodB.id,
            productNameSnapshot: prodB.name,
            unitSymbolSnapshot: 'kg',
            weightOrPackSnapshot: 'Bulk Loose',
            saleTypeSnapshot: SaleType.WHOLESALE,
            quantity: new Prisma.Decimal(50),
            baseWeightDeducted: new Prisma.Decimal(50000),
            unitRate: new Prisma.Decimal(100.0),
            subtotal: new Prisma.Decimal(5000.0),
            discount: new Prisma.Decimal(0.0),
            total: new Prisma.Decimal(5000.0),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.CASH,
            amount: new Prisma.Decimal(5050.0),
          },
        ],
      },
    },
    include: { items: true },
  });
  testSaleIds.push(sale3.id);

  // Sale 4: RETAIL, CANCELLED SALE (Subtotal: 800, Discount: 0, Total: 800)
  const sale4 = await prisma.sale.create({
    data: {
      billNumber: `CA-CAN-RET-${ts}`,
      customerId: custB2C.id,
      customerNameSnapshot: custB2C.name,
      customerMobileSnapshot: custB2C.mobile,
      customerTypeSnapshot: CustomerType.INDIAN,
      customerGstinSnapshot: null,
      saleType: SaleType.RETAIL,
      totalItemsCount: 1,
      subtotalAmount: new Prisma.Decimal(800.0),
      discountAmount: new Prisma.Decimal(0.0),
      taxAmount: new Prisma.Decimal(0.0),
      finalTotalAmount: new Prisma.Decimal(800.0),
      paidAmount: new Prisma.Decimal(0.0),
      paymentStatus: 'UNPAID',
      saleStatus: SaleStatus.CANCELLED,
      cancellationReason: '@IMPORTDATA("http://malicious.com")', // formula trigger in cancellation reason
      createdBy: adminUser.id,
      createdAt: new Date('2027-02-15T13:00:00.000Z'),
      items: {
        create: [
          {
            productId: prodA.id,
            packConfigId: packA.id,
            productNameSnapshot: prodA.name,
            unitSymbolSnapshot: 'kg',
            weightOrPackSnapshot: '500g Pack',
            saleTypeSnapshot: SaleType.RETAIL,
            quantity: new Prisma.Decimal(8),
            baseWeightDeducted: new Prisma.Decimal(4000),
            unitRate: new Prisma.Decimal(100.0),
            subtotal: new Prisma.Decimal(800.0),
            discount: new Prisma.Decimal(0.0),
            total: new Prisma.Decimal(800.0),
          },
        ],
      },
    },
    include: { items: true },
  });
  testSaleIds.push(sale4.id);

  // 6. Create Sales Return for Sale 1 (Return 2 items = ₹200)
  const return1 = await prisma.salesReturn.create({
    data: {
      returnNumber: `CA-RET-NUM-${ts}`,
      originalSaleId: sale1.id,
      customerId: custB2B.id,
      saleTypeSnapshot: SaleType.RETAIL,
      totalReturnAmount: new Prisma.Decimal(200.0),
      refundPaymentMode: RefundPaymentMode.CASH,
      status: ReturnStatus.COMPLETED,
      reason: '+CMD|calc.exe', // formula trigger in return reason
      createdBy: adminUser.id,
      createdAt: new Date('2027-02-15T14:00:00.000Z'),
      completedAt: new Date('2027-02-15T14:05:00.000Z'),
      items: {
        create: [
          {
            saleItemId: sale1.items[0].id,
            productId: prodA.id,
            returnedQuantity: new Prisma.Decimal(2),
            unitRateSnapshot: new Prisma.Decimal(100.0),
            refundAmount: new Prisma.Decimal(200.0),
            restockCondition: 'RESTOCKABLE',
          },
        ],
      },
    },
  });
  testReturnIds.push(return1.id);

  // Alter current product price to verify historical integrity is NOT broken
  await prisma.productPrice.update({
    where: { id: priceA.id },
    data: { rate: 999.0 },
  });

  const testDateQuery = 'startDate=2027-02-15&endDate=2027-02-15';

  try {
    // ----------------------------------------------------
    // TEST 1: Bill-level Sales Register
    // ----------------------------------------------------
    console.log('Test 1: Bill-level Sales Register');
    const res1 = await fetch(`${baseUrl}/reports/statutory/sales?${testDateQuery}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data1 = await res1.json();
    if (res1.status === 200 && data1.success && data1.summary.totalRecordedBills === 4) {
      console.log('✅ Test 1 Passed: Bill-level Sales Register retrieved accurately');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed:', res1.status, data1);
    }

    // ----------------------------------------------------
    // TEST 2: Itemized Sales Register
    // ----------------------------------------------------
    console.log('Test 2: Itemized Sales Register');
    const res2 = await fetch(`${baseUrl}/reports/statutory/sales/itemized?${testDateQuery}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data2 = await res2.json();
    if (res2.status === 200 && data2.success && data2.summary.totalItemsCount === 4) {
      console.log('✅ Test 2 Passed: Itemized Sales Register retrieved accurately');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed:', res2.status, data2);
    }

    // ----------------------------------------------------
    // TEST 3: Returns Register
    // ----------------------------------------------------
    console.log('Test 3: Returns Register');
    const res3 = await fetch(`${baseUrl}/reports/statutory/returns?${testDateQuery}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data3 = await res3.json();
    if (
      res3.status === 200 &&
      data3.success &&
      data3.summary.completedReturns === 1 &&
      data3.summary.totalRefundAmount === 200.0 &&
      data3.data[0].originalBillNumber === sale1.billNumber
    ) {
      console.log('✅ Test 3 Passed: Returns Register accurately tracks refund and bill cross-ref');
      passedTests++;
    } else {
      console.error('❌ Test 3 Failed:', res3.status, data3);
    }

    // ----------------------------------------------------
    // TEST 4: GST / Tax Summary
    // ----------------------------------------------------
    console.log('Test 4: GST / Tax Summary');
    const res4 = await fetch(`${baseUrl}/reports/statutory/gst-summary?${testDateQuery}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data4 = await res4.json();
    if (
      res4.status === 200 &&
      data4.success &&
      data4.summary.completedBills === 3 &&
      data4.summary.grossSubtotalAmount === 8000.0 &&
      data4.summary.discountAmount === 300.0 &&
      data4.summary.taxAmount === 400.0 &&
      data4.summary.finalTotalAmount === 8100.0 &&
      data4.summary.netFinalAmount === 7900.0
    ) {
      console.log('✅ Test 4 Passed: GST Summary metrics and netting accurate');
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed:', res4.status, data4);
    }

    // ----------------------------------------------------
    // TEST 5: Retail filtering
    // ----------------------------------------------------
    console.log('Test 5: Retail filtering');
    const res5 = await fetch(`${baseUrl}/reports/statutory/sales?${testDateQuery}&saleType=RETAIL`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data5 = await res5.json();
    if (
      res5.status === 200 &&
      data5.data.every((s: any) => s.saleType === 'RETAIL') &&
      data5.summary.completedBills === 1
    ) {
      console.log('✅ Test 5 Passed: Retail filtering returns only RETAIL records');
      passedTests++;
    } else {
      console.error('❌ Test 5 Failed:', res5.status, data5);
    }

    // ----------------------------------------------------
    // TEST 6: NRI filtering
    // ----------------------------------------------------
    console.log('Test 6: NRI filtering');
    const res6 = await fetch(`${baseUrl}/reports/statutory/sales?${testDateQuery}&saleType=NRI`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data6 = await res6.json();
    if (
      res6.status === 200 &&
      data6.data.every((s: any) => s.saleType === 'NRI') &&
      data6.summary.completedBills === 1
    ) {
      console.log('✅ Test 6 Passed: NRI filtering returns only NRI records');
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed:', res6.status, data6);
    }

    // ----------------------------------------------------
    // TEST 7: Wholesale filtering
    // ----------------------------------------------------
    console.log('Test 7: Wholesale filtering');
    const res7 = await fetch(
      `${baseUrl}/reports/statutory/sales?${testDateQuery}&saleType=WHOLESALE`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const data7 = await res7.json();
    if (
      res7.status === 200 &&
      data7.data.every((s: any) => s.saleType === 'WHOLESALE') &&
      data7.summary.completedBills === 1
    ) {
      console.log('✅ Test 7 Passed: Wholesale filtering returns only WHOLESALE records');
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed:', res7.status, data7);
    }

    // ----------------------------------------------------
    // TEST 8: Master Admin unrestricted access
    // ----------------------------------------------------
    console.log('Test 8: Master Admin unrestricted access');
    if (data4.summary.isMasterAdmin === true && data4.summary.isScoped === false) {
      console.log('✅ Test 8 Passed: Master Admin is recognized as unrestricted');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed:', data4.summary);
    }

    // ----------------------------------------------------
    // TEST 9: Restricted user scoping
    // ----------------------------------------------------
    console.log('Test 9: Restricted user scoping');
    const res9 = await fetch(`${baseUrl}/reports/statutory/sales?${testDateQuery}`, {
      headers: { Authorization: `Bearer ${restrictedToken}` },
    });
    const data9 = await res9.json();
    if (
      res9.status === 200 &&
      data9.summary.isScoped === true &&
      data9.data.every((s: any) => s.saleType === 'RETAIL')
    ) {
      console.log('✅ Test 9 Passed: Restricted user strictly scoped to [RETAIL]');
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed:', res9.status, data9);
    }

    // ----------------------------------------------------
    // TEST 10: Explicit unauthorized SaleType → 403
    // ----------------------------------------------------
    console.log('Test 10: Explicit unauthorized SaleType → 403');
    const res10a = await fetch(
      `${baseUrl}/reports/statutory/sales?${testDateQuery}&saleType=WHOLESALE`,
      {
        headers: { Authorization: `Bearer ${restrictedToken}` },
      }
    );
    const res10b = await fetch(
      `${baseUrl}/reports/statutory/sales?${testDateQuery}&saleType=NRI`,
      {
        headers: { Authorization: `Bearer ${restrictedToken}` },
      }
    );
    if (res10a.status === 403 && res10b.status === 403) {
      console.log('✅ Test 10 Passed: Explicit unauthorized SaleTypes rejected with HTTP 403');
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Expected 403, got', res10a.status, res10b.status);
    }

    // ----------------------------------------------------
    // TEST 11: Billing/report permission separation
    // ----------------------------------------------------
    console.log('Test 11: Billing/report permission separation');
    // Restricted user has allowedBillingSaleTypes = [RETAIL, NRI, WHOLESALE]
    // but allowedReportSaleTypes = [RETAIL]
    const res11 = await fetch(
      `${baseUrl}/reports/statutory/gst-summary?${testDateQuery}&saleType=WHOLESALE`,
      {
        headers: { Authorization: `Bearer ${restrictedToken}` },
      }
    );
    if (res11.status === 403) {
      console.log('✅ Test 11 Passed: Billing permission does NOT grant reporting permission');
      passedTests++;
    } else {
      console.error('❌ Test 11 Failed:', res11.status);
    }

    // ----------------------------------------------------
    // TEST 12: Historical SaleType
    // ----------------------------------------------------
    console.log('Test 12: Historical SaleType');
    const itemSale3 = data2.data.find((it: any) => it.billNumber === sale3.billNumber);
    if (itemSale3 && itemSale3.saleType === 'WHOLESALE') {
      console.log('✅ Test 12 Passed: Historical SaleType accurately preserved on item');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed:', itemSale3);
    }

    // ----------------------------------------------------
    // TEST 13: Historical rate
    // ----------------------------------------------------
    console.log('Test 13: Historical rate');
    // We changed ProductPrice to 999.0, but SaleItem was created at 100.0
    const itemSale1 = data2.data.find((it: any) => it.billNumber === sale1.billNumber);
    if (itemSale1 && itemSale1.unitRate === 100.0) {
      console.log('✅ Test 13 Passed: Current ProductPrice mutation does NOT corrupt historical unit rate');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed:', itemSale1);
    }

    // ----------------------------------------------------
    // TEST 14: Historical GSTIN snapshot
    // ----------------------------------------------------
    console.log('Test 14: Historical GSTIN snapshot');
    const billSale1 = data1.data.find((b: any) => b.billNumber === sale1.billNumber);
    if (billSale1 && billSale1.customerGstin === '24AAACV1234A1Z5' && billSale1.isB2B === true) {
      console.log('✅ Test 14 Passed: Historical customer GSTIN snapshot used for B2B status');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed:', billSale1);
    }

    // ----------------------------------------------------
    // TEST 15: Returns historical rate
    // ----------------------------------------------------
    console.log('Test 15: Returns historical rate');
    if (
      data3.data[0].items[0].unitRate === 100.0 &&
      data3.data[0].items[0].refundAmount === 200.0
    ) {
      console.log('✅ Test 15 Passed: Sales Return preserves historical rate snapshot');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed:', data3.data[0].items);
    }

    // ----------------------------------------------------
    // TEST 16: Cancelled sales handling
    // ----------------------------------------------------
    console.log('Test 16: Cancelled sales handling');
    const canBill = data1.data.find((b: any) => b.billNumber === sale4.billNumber);
    if (
      canBill &&
      canBill.saleStatus === 'CANCELLED' &&
      data1.summary.cancelledBills === 1 &&
      data1.summary.cancelledAmount === 800.0 &&
      // GST Summary completedBills should NOT include cancelled bill
      data4.summary.completedBills === 3 &&
      data4.summary.cancelledBills === 1 &&
      data4.summary.cancelledFinalAmount === 800.0
    ) {
      console.log('✅ Test 16 Passed: Cancelled sales segregated from turnover totals');
      passedTests++;
    } else {
      console.error('❌ Test 16 Failed:', canBill, data1.summary, data4.summary);
    }

    // ----------------------------------------------------
    // TEST 17: Date boundaries
    // ----------------------------------------------------
    console.log('Test 17: Date boundaries');
    const res17SameDay = await fetch(
      `${baseUrl}/reports/statutory/sales?startDate=2027-02-15&endDate=2027-02-15`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const data17SameDay = await res17SameDay.json();

    const res17Past = await fetch(
      `${baseUrl}/reports/statutory/sales?startDate=2025-01-01&endDate=2025-01-02`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const data17Past = await res17Past.json();

    if (
      data17SameDay.summary.totalRecordedBills === 4 &&
      data17Past.summary.totalRecordedBills === 0
    ) {
      console.log('✅ Test 17 Passed: Same-day and out-of-range date boundaries match correctly');
      passedTests++;
    } else {
      console.error('❌ Test 17 Failed:', data17SameDay.summary, data17Past.summary);
    }

    // ----------------------------------------------------
    // TEST 18: Financial reconciliation
    // ----------------------------------------------------
    console.log('Test 18: Financial reconciliation');
    // Total Subtotal (8000) - Discount (300) + Tax (400) = Final (8100)
    const sub = data4.summary.grossSubtotalAmount;
    const disc = data4.summary.discountAmount;
    const tax = data4.summary.taxAmount;
    const finalTot = data4.summary.finalTotalAmount;
    const net = data4.summary.netFinalAmount;
    const retAmt = data4.summary.returnAmount;

    if (
      sub - disc + tax === finalTot &&
      finalTot - retAmt === net &&
      data4.summary.taxableAmount === sub - disc
    ) {
      console.log('✅ Test 18 Passed: Financial invariants and netting hold exactly');
      passedTests++;
    } else {
      console.error('❌ Test 18 Failed:', { sub, disc, tax, finalTot, net, retAmt });
    }

    // ----------------------------------------------------
    // TEST 19: CSV escaping
    // ----------------------------------------------------
    console.log('Test 19: CSV escaping');
    const res19 = await fetch(`${baseUrl}/reports/statutory/sales?${testDateQuery}&format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const csv19 = await res19.text();
    // Customer name had comma and quote: Regular Retailer Patel, "Ahmedabad"
    // RFC 4180 must quote and escape as ""
    if (csv19.includes('"Regular Retailer Patel, ""Ahmedabad""')) {
      console.log('✅ Test 19 Passed: Commas and quotes escaped per RFC 4180');
      passedTests++;
    } else {
      console.error('❌ Test 19 Failed: CSV content snippet missing expected escape:', csv19.slice(0, 500));
    }

    // ----------------------------------------------------
    // TEST 20: CSV BOM
    // ----------------------------------------------------
    console.log('Test 20: CSV BOM');
    const res20 = await fetch(`${baseUrl}/reports/statutory/sales?${testDateQuery}&format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bytes20 = new Uint8Array(await res20.arrayBuffer());
    if (bytes20[0] === 0xef && bytes20[1] === 0xbb && bytes20[2] === 0xbf) {
      console.log('✅ Test 20 Passed: UTF-8 BOM (0xEF, 0xBB, 0xBF) present at offset 0');
      passedTests++;
    } else {
      console.error('❌ Test 20 Failed: First bytes are', bytes20.slice(0, 3));
    }

    // ----------------------------------------------------
    // TEST 21: CSV formula injection protection
    // ----------------------------------------------------
    console.log('Test 21: CSV formula injection protection');
    // custB2B name began with =SUM(A1)
    // Cancellation reason began with @IMPORTDATA
    // Return reason began with +CMD|calc.exe
    const res21Ret = await fetch(`${baseUrl}/reports/statutory/returns?${testDateQuery}&format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const csv21Ret = await res21Ret.text();

    const hasFormulaSanitized1 = csv19.includes("'=SUM(A1)");
    const hasFormulaSanitized2 = csv19.includes("'@IMPORTDATA");
    const hasFormulaSanitized3 = csv21Ret.includes("'+CMD|calc.exe");

    if (hasFormulaSanitized1 && hasFormulaSanitized2 && hasFormulaSanitized3) {
      console.log('✅ Test 21 Passed: OWASP formula triggers (=, @, +) sanitized with single quote');
      passedTests++;
    } else {
      console.error('❌ Test 21 Failed:', {
        hasFormulaSanitized1,
        hasFormulaSanitized2,
        hasFormulaSanitized3,
      });
    }

    // ----------------------------------------------------
    // TEST 22: No unauthorized data leakage
    // ----------------------------------------------------
    console.log('Test 22: No unauthorized data leakage');
    const res22Csv = await fetch(
      `${baseUrl}/reports/statutory/sales?${testDateQuery}&format=csv`,
      {
        headers: { Authorization: `Bearer ${restrictedToken}` },
      }
    );
    const csv22 = await res22Csv.text();
    // Restricted user must NOT see WHOLESALE or NRI sales in CSV
    if (
      !csv22.includes('WHOLESALE') &&
      !csv22.includes('NRI International') &&
      !csv22.includes(sale3.billNumber)
    ) {
      console.log('✅ Test 22 Passed: No unauthorized data leakage in CSV export');
      passedTests++;
    } else {
      console.error('❌ Test 22 Failed: Unauthorized data found in restricted CSV export');
    }

    // ----------------------------------------------------
    // TEST 23: Empty-result behavior
    // ----------------------------------------------------
    console.log('Test 23: Empty-result behavior');
    const res23 = await fetch(
      `${baseUrl}/reports/statutory/sales?startDate=2010-01-01&endDate=2010-01-02`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const data23 = await res23.json();
    if (
      res23.status === 200 &&
      data23.success &&
      data23.summary.totalRecordedBills === 0 &&
      Array.isArray(data23.data) &&
      data23.data.length === 0
    ) {
      console.log('✅ Test 23 Passed: Empty-result handled gracefully');
      passedTests++;
    } else {
      console.error('❌ Test 23 Failed:', res23.status, data23);
    }

    // ----------------------------------------------------
    // TEST 24: Payment mode summary
    // ----------------------------------------------------
    console.log('Test 24: Payment mode summary');
    const bill1 = data1.data.find((b: any) => b.billNumber === sale1.billNumber);
    const bill2 = data1.data.find((b: any) => b.billNumber === sale2.billNumber);
    const bill3 = data1.data.find((b: any) => b.billNumber === sale3.billNumber);
    if (
      bill1.paymentModes.includes('UPI') &&
      bill2.paymentModes.includes('CARD') &&
      bill3.paymentModes.includes('CASH')
    ) {
      console.log('✅ Test 24 Passed: Actual stored payment modes accurately reported');
      passedTests++;
    } else {
      console.error('❌ Test 24 Failed:', { bill1, bill2, bill3 });
    }

    // ----------------------------------------------------
    // TEST 25: B2B/B2C GSTIN classification
    // ----------------------------------------------------
    console.log('Test 25: B2B/B2C GSTIN classification');
    const b2bSeg = data4.byGstClassification.B2B;
    const b2cSeg = data4.byGstClassification.B2C;
    // B2B: Sale 1 (RETAIL B2B: Sub 1000, Tot 950) + Sale 3 (WHL B2B: Sub 5000, Tot 5050) -> Bills: 2, FinalTotal: 6000
    // B2C: Sale 2 (NRI B2C: Sub 2000, Tot 2100) -> Bills: 1, FinalTotal: 2100
    if (
      b2bSeg.billsCount === 2 &&
      b2bSeg.finalTotalAmount === 6000.0 &&
      b2cSeg.billsCount === 1 &&
      b2cSeg.finalTotalAmount === 2100.0 &&
      b2bSeg.finalTotalAmount + b2cSeg.finalTotalAmount === data4.summary.finalTotalAmount
    ) {
      console.log('✅ Test 25 Passed: B2B and B2C segmentation by GSTIN snapshot accurate');
      passedTests++;
    } else {
      console.error('❌ Test 25 Failed:', { b2bSeg, b2cSeg, total: data4.summary.finalTotalAmount });
    }

    // ----------------------------------------------------
    // TEST 26: Retail + NRI + Wholesale totals = Unrestricted Total
    // ----------------------------------------------------
    console.log('Test 26: Retail + NRI + Wholesale totals = Unrestricted Total');
    const retFinal = data4.bySaleType.RETAIL.finalTotalAmount;
    const nriFinal = data4.bySaleType.NRI.finalTotalAmount;
    const whlFinal = data4.bySaleType.WHOLESALE.finalTotalAmount;
    const sumBySaleType = retFinal + nriFinal + whlFinal;

    if (sumBySaleType === data4.summary.finalTotalAmount) {
      console.log('✅ Test 26 Passed: Retail + NRI + Wholesale equals company total for Master Admin');
      passedTests++;
    } else {
      console.error('❌ Test 26 Failed:', {
        retFinal,
        nriFinal,
        whlFinal,
        sumBySaleType,
        total: data4.summary.finalTotalAmount,
      });
    }
  } finally {
    // Cleanup test data
    await prisma.salesReturnItem.deleteMany({
      where: { returnId: { in: testReturnIds } },
    });
    await prisma.salesReturn.deleteMany({
      where: { id: { in: testReturnIds } },
    });
    await prisma.payment.deleteMany({
      where: { saleId: { in: testSaleIds } },
    });
    await prisma.saleItem.deleteMany({
      where: { saleId: { in: testSaleIds } },
    });
    await prisma.sale.deleteMany({
      where: { id: { in: testSaleIds } },
    });
    await prisma.productPrice.deleteMany({
      where: { productId: { in: [prodA.id, prodB.id] } },
    });
    await prisma.productPackConfiguration.deleteMany({
      where: { productId: { in: [prodA.id, prodB.id] } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [prodA.id, prodB.id] } },
    });
    await prisma.subcategory.deleteMany({
      where: { id: subCat.id },
    });
    await prisma.category.deleteMany({
      where: { id: cat.id },
    });
    await prisma.unit.deleteMany({
      where: { id: kgUnit.id },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [custB2B.id, custB2C.id, custNRI.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: restrictedUser.id },
    });

    server.close();
  }

  console.log('\n========================================================');
  console.log(`📊 PHASE 2F TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================\n');

  if (passedTests !== totalTests) {
    throw new Error(`Step 2F test suite failed: ${passedTests}/${totalTests} passed`);
  }
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('step2f-statutory-reports.test.ts')) {
  runStep2fStatutoryReportsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
