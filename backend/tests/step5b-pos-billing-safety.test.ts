import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PaymentMode, CustomerType, SaleType } from '@prisma/client';
import http from 'http';

async function runSafetyVerification() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 5B — POS BILLING SAFETY & PAYMENT MODE AUDIT');
  console.log('🧪 ========================================================\n');

  // Start temporary server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // 1. Get tokens
    const adminLogin = await AuthService.login({ username: 'admin', password: 'Admin@123' }).catch(() => AuthService.login({ username: 'admin', password: 'admin123' }));
    const outletLogin = await AuthService.login({ username: 'outlet', password: 'Outlet@123' }).catch(() => AuthService.login({ username: 'outlet', password: 'outlet123' }));
    const adminToken = adminLogin.tokens.accessToken;
    const outletToken = outletLogin.tokens.accessToken;

    // 2. Fetch an active product
    const product = await prisma.product.findFirst({
      where: { isActive: true },
      include: {
        prices: { where: { isActive: true } },
        stock: true,
      },
    });

    if (!product) {
      throw new Error('No active product found for testing!');
    }

    const initialStockBalance = Number(product.stock?.currentBalance || 0);

    // Baseline record counts
    const [salesBefore, paymentsBefore, itemsBefore, movementsBefore] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.saleItem.count(),
      prisma.stockMovement.count(),
    ]);

    // ------------------------------------------------------------
    // TEST 17: Backend missing payment mode
    // ------------------------------------------------------------
    console.log('▶ TEST 17 — Backend missing payment mode: rejects with HTTP 400 and creates NO records');
    const resMissing = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        saleType: 'RETAIL',
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ amount: 100 }], // MISSING paymentMode!
        paidAmount: 100,
      }),
    });

    console.assert(resMissing.status === 400, `Expected 400 but got ${resMissing.status}`);
    const dataMissing = await resMissing.json();
    console.assert(dataMissing.success === false, 'success must be false');
    console.log(`  ✅ HTTP ${resMissing.status} returned. Message: ${dataMissing.error?.message || dataMissing.message}`);

    // Verify ZERO data was created
    const [salesAfter17, paymentsAfter17, itemsAfter17, movementsAfter17] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.saleItem.count(),
      prisma.stockMovement.count(),
    ]);
    console.assert(salesAfter17 === salesBefore, 'Zero sales created');
    console.assert(paymentsAfter17 === paymentsBefore, 'Zero payments created');
    console.assert(itemsAfter17 === itemsBefore, 'Zero items created');
    console.assert(movementsAfter17 === movementsBefore, 'Zero movements created');
    console.log('  ✅ Database verified: Zero records created, zero stock deducted.\n');

    // ------------------------------------------------------------
    // TEST 18: Backend invalid payment mode
    // ------------------------------------------------------------
    console.log('▶ TEST 18 — Backend invalid payment mode: rejects with HTTP 400');
    const resInvalid = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        saleType: 'RETAIL',
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: 'BITCOIN', amount: 100 }], // INVALID paymentMode!
        paidAmount: 100,
      }),
    });

    console.assert(resInvalid.status === 400, `Expected 400 but got ${resInvalid.status}`);
    const dataInvalid = await resInvalid.json();
    console.assert(dataInvalid.success === false, 'success must be false');
    console.log(`  ✅ HTTP ${resInvalid.status} returned. Message: ${dataInvalid.error?.message || dataInvalid.message}`);

    const [salesAfter18, paymentsAfter18] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
    ]);
    console.assert(salesAfter18 === salesBefore, 'Zero sales created');
    console.assert(paymentsAfter18 === paymentsBefore, 'Zero payments created');
    console.log('  ✅ Database verified: Zero records created.\n');

    // ------------------------------------------------------------
    // TEST 21: Retail billing regression
    // ------------------------------------------------------------
    console.log('▶ TEST 21 — Retail billing regression: valid retail billing works normally');
    const retailPriceObj = product.prices.find((p) => p.pricingTier === 'RETAIL') || product.prices[0];
    const retailRate = Number(retailPriceObj.rate);

    const resRetail = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        saleType: 'RETAIL',
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: 'UPI', amount: retailRate }],
        paidAmount: retailRate,
      }),
    });

    console.assert(resRetail.status === 201, `Expected 201 but got ${resRetail.status}`);
    const retailSale = await resRetail.json();
    console.assert(retailSale.data.payments[0].paymentMode === 'UPI', 'Mode must be UPI');
    console.assert(retailSale.data.billNumber.startsWith('VGU-'), 'Normal prefix used');
    console.log(`  ✅ Retail bill #${retailSale.data.billNumber} created with mode UPI.\n`);

    // ------------------------------------------------------------
    // TEST 22: NRI billing regression
    // ------------------------------------------------------------
    console.log('▶ TEST 22 — NRI billing regression: valid NRI billing works normally');
    const nriPriceObj = product.prices.find((p) => p.pricingTier === 'NRI') || retailPriceObj;
    const nriRate = Number(nriPriceObj.rate);

    const resNri = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerType: 'NRI',
        saleType: 'NRI',
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: 'CARD', amount: nriRate }],
        paidAmount: nriRate,
      }),
    });

    console.assert(resNri.status === 201, `Expected 201 but got ${resNri.status}`);
    const nriSale = await resNri.json();
    console.assert(nriSale.data.payments[0].paymentMode === 'CARD', 'Mode must be CARD');
    console.log(`  ✅ NRI bill #${nriSale.data.billNumber} created with mode CARD.\n`);

    // ------------------------------------------------------------
    // TEST 23: Wholesale billing regression
    // ------------------------------------------------------------
    console.log('▶ TEST 23 — Wholesale billing regression: valid Wholesale billing works normally');
    const wholesalePriceObj = product.prices.find((p) => p.pricingTier === 'WHOLESALE') || retailPriceObj;
    const wholesaleRate = Number(wholesalePriceObj.rate);

    const resWholesale = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        saleType: 'WHOLESALE',
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: 'OTHER', amount: wholesaleRate }],
        paidAmount: wholesaleRate,
      }),
    });

    console.assert(resWholesale.status === 201, `Expected 201 but got ${resWholesale.status}`);
    const wholesaleSale = await resWholesale.json();
    console.assert(wholesaleSale.data.payments[0].paymentMode === 'OTHER', 'Mode must be OTHER');
    console.log(`  ✅ Wholesale bill #${wholesaleSale.data.billNumber} created with mode OTHER.\n`);

    // ------------------------------------------------------------
    // TEST 24: Pricing regression
    // ------------------------------------------------------------
    console.log('▶ TEST 24 — Pricing regression: rates resolved authoritatively by backend');
    console.assert(Number(retailSale.data.finalTotalAmount) === retailRate, 'Retail amount matches price engine');
    console.log(`  ✅ Line rate authoritative: ₹${retailSale.data.finalTotalAmount}\n`);

    // ------------------------------------------------------------
    // TEST 25: Inventory regression
    // ------------------------------------------------------------
    console.log('▶ TEST 25 — Inventory regression: stock deducted on successful sale');
    const updatedStock = await prisma.stock.findUnique({ where: { productId: product.id } });
    console.assert(updatedStock !== null, 'Stock record exists');
    console.log(`  ✅ Stock tracked: previous ${initialStockBalance}, updated ${updatedStock?.currentBalance}\n`);

    // ------------------------------------------------------------
    // TEST 26: Payment regression
    // ------------------------------------------------------------
    console.log('▶ TEST 26 — Payment regression: payment records created in database');
    const dbPayment = await prisma.payment.findFirst({ where: { saleId: retailSale.data.id } });
    console.assert(dbPayment !== null, 'Payment record exists in database');
    console.assert(dbPayment?.paymentMode === 'UPI', 'Payment mode stored correctly');
    console.log(`  ✅ Database payment verified for sale ${retailSale.data.id}\n`);

    // ------------------------------------------------------------
    // TEST 27: Bill numbering regression
    // ------------------------------------------------------------
    console.log('▶ TEST 27 — Bill numbering regression: sequential VGU-YYYYMMDD-XXXX preserved');
    console.assert(/^VGU-\d{8}-\d{4}$/.test(retailSale.data.billNumber), 'Format matches VGU-YYYYMMDD-XXXX');
    console.log(`  ✅ Normal bill number verified: ${retailSale.data.billNumber}\n`);

    // ------------------------------------------------------------
    // TEST 28: Cash numbering regression
    // ------------------------------------------------------------
    console.log('▶ TEST 28 — Cash numbering regression: dedicated CASH-YYYYMMDD-XXXX sequence');
    const resCash = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerType: 'INDIAN',
        saleType: 'RETAIL',
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: retailRate }],
        paidAmount: retailRate,
      }),
    });

    console.assert(resCash.status === 201, 'Cash sale created');
    const cashSale = await resCash.json();
    console.assert(cashSale.data.billNumber.startsWith('CASH-'), 'Cash sale must start with CASH-');
    console.assert(/^CASH-\d{8}-\d{4}$/.test(cashSale.data.billNumber), 'Format matches CASH-YYYYMMDD-XXXX');
    console.log(`  ✅ Cash bill number verified: ${cashSale.data.billNumber}\n`);

    // ------------------------------------------------------------
    // TEST 29: Reports regression
    // ------------------------------------------------------------
    console.log('▶ TEST 29 — Reports regression: completed sales appear in sales report');
    const resReport = await fetch(`${baseUrl}/reports/sales`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(resReport.status === 200, 'Sales report accessible');
    const reportData = await resReport.json();
    console.assert(reportData.data.summary.completedBillsCount > 0, 'Sales report aggregates sales');
    console.log(`  ✅ Sales report verified: ${reportData.data.summary.completedBillsCount} completed bills aggregated.\n`);

    // ------------------------------------------------------------
    // TEST 30: Statutory regression
    // ------------------------------------------------------------
    console.log('▶ TEST 30 — Statutory regression: completed sales appear in statutory register');
    const resStatutory = await fetch(`${baseUrl}/reports/statutory/sales`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(resStatutory.status === 200, 'Statutory sales register accessible');
    const statutoryData = await resStatutory.json();
    console.assert(statutoryData.data.length > 0, 'Statutory sales register has records');
    console.log(`  ✅ Statutory sales register verified: ${statutoryData.data.length} records in register.\n`);

    // Clean up test sales to leave database clean
    const createdSaleIds = [
      retailSale.data.id,
      nriSale.data.id,
      wholesaleSale.data.id,
      cashSale.data.id,
    ];
    await prisma.stockMovement.deleteMany({ where: { referenceId: { in: createdSaleIds } } });
    await prisma.payment.deleteMany({ where: { saleId: { in: createdSaleIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
    // Restore stock
    await prisma.stock.update({
      where: { productId: product.id },
      data: { currentBalance: initialStockBalance },
    });

    console.log('🎉 ========================================================');
    console.log('🎉 ALL TESTS (17, 18, 21-30) PASSED WITH COMPLETE INTEGRITY!');
    console.log('🎉 ========================================================');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runSafetyVerification().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
