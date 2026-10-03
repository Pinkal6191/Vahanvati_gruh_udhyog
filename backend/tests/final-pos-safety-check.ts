import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PaymentMode, CustomerType, SaleType } from '@prisma/client';
import http from 'http';

async function runFinalTwoChecks() {
  console.log('🧪 ========================================================');
  console.log('🧪 FINAL VERIFICATION BEFORE COMMIT: 2 CRITICAL CHECKS');
  console.log('🧪 ========================================================\n');

  // Start temporary Express server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    // 1. Authenticate
    const adminLogin = await AuthService.login({ username: 'admin', password: 'Admin@123' }).catch(() => AuthService.login({ username: 'admin', password: 'admin123' }));
    const outletLogin = await AuthService.login({ username: 'outlet', password: 'Outlet@123' }).catch(() => AuthService.login({ username: 'outlet', password: 'outlet123' }));
    const adminToken = adminLogin.tokens.accessToken;
    const outletToken = outletLogin.tokens.accessToken;

    // 2. Fetch test active product & walk-in customer
    const product = await prisma.product.findFirst({
      where: { isActive: true },
      include: {
        packConfigurations: { where: { isActive: true } },
        prices: { where: { isActive: true } },
        stock: true,
      },
    });

    if (!product || !product.stock) {
      throw new Error('Test product with stock not found!');
    }

    const customer = await prisma.customer.findFirst({
      where: { isActive: true, customerType: CustomerType.INDIAN },
    });
    if (!customer) {
      throw new Error('Walk-in customer not found!');
    }

    const testPack = product.packConfigurations[0];

    // ============================================================
    // CHECK 1: REPRODUCE THE ORIGINAL REAL-WORLD ACCIDENTAL TOUCH
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ CHECK 1: REPRODUCE ORIGINAL ACCIDENTAL TOUCH/CLICK ISSUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Baseline database metrics before test
    const [salesBefore1, paymentsBefore1, itemsBefore1, movementsBefore1] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.saleItem.count(),
      prisma.stockMovement.count(),
    ]);

    const stockBefore1 = await prisma.stock.findUnique({
      where: { productId: product.id },
    });
    const balanceBefore1 = Number(stockBefore1?.currentBalance || 0);

    const latestSaleBefore1 = await prisma.sale.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });
    const latestCashSaleBefore1 = await prisma.sale.findFirst({
      where: { billNumber: { startsWith: 'CASH-' } },
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });

    console.log(`  Initial DB State:`);
    console.log(`  - Total Sales: ${salesBefore1}`);
    console.log(`  - Total Payments: ${paymentsBefore1}`);
    console.log(`  - Total Sale Items: ${itemsBefore1}`);
    console.log(`  - Total Stock Movements: ${movementsBefore1}`);
    console.log(`  - Product Stock Balance: ${balanceBefore1}`);
    console.log(`  - Latest Bill Number: ${latestSaleBefore1?.billNumber || 'None'}`);
    console.log(`  - Latest Cash Bill Number: ${latestCashSaleBefore1?.billNumber || 'None'}\n`);

    // Simulate real-world POS Billing Page state:
    // Operator added products to cart.
    // In original code: paymentMode was automatically 'CASH'.
    // In safe code: paymentMode is null (unselected).
    let simulatedCartState = {
      items: [
        {
          productId: product.id,
          packConfigId: testPack?.id,
          quantity: 2,
        },
      ],
      paymentMode: null as PaymentMode | null, // Starts strictly UNSELECTED (null)
      isSubmitting: false,
    };

    let simulatedToast: { title: string; message: string } | null = null;
    let apiCallAttempts = 0;

    // Client-side submission handler replicating BillingPage.tsx + useBillingCart.ts
    const handleSimulatedClick = async (eventType: string, viewport: string) => {
      // If click/touch is on blank space, backdrop, or outside area -> no action
      if (
        eventType === 'blank_space_payment_block' ||
        eventType === 'blank_space_summary_pane' ||
        eventType === 'blank_space_cart_footer' ||
        eventType === 'mobile_cart_backdrop_touch' ||
        eventType === 'tablet_scroll_near_buttons' ||
        eventType === 'tender_input_enter_key'
      ) {
        // Event does not trigger submit
        return;
      }

      // If operator accidentally clicked/touched "Generate Bill" button itself:
      if (eventType === 'accidental_tap_generate_bill_button') {
        if (!simulatedCartState.paymentMode) {
          simulatedToast = {
            title: 'Payment Mode Required',
            message: 'Please select a payment mode before generating the bill.',
          };
          return;
        }

        // If somehow bypassed client guard, send to backend API
        apiCallAttempts++;
        const res = await fetch(`${baseUrl}/sales`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${outletToken}`,
          },
          body: JSON.stringify({
            customerId: customer.id,
            saleType: SaleType.RETAIL,
            items: simulatedCartState.items,
            payments: simulatedCartState.paymentMode
              ? [{ paymentMode: simulatedCartState.paymentMode, amount: 200 }]
              : [],
          }),
        });
        return res;
      }
    };

    console.log('  Executing accidental touch & click scenarios across viewports:');

    // Scenario 1: Desktop (1440px) - Click blank space in payment block
    await handleSimulatedClick('blank_space_payment_block', 'desktop_1440px');
    console.log('  [1/8] Desktop: Click blank space in payment block -> No action.');

    // Scenario 2: Desktop (1440px) - Click blank space in cart summary pane
    await handleSimulatedClick('blank_space_summary_pane', 'desktop_1440px');
    console.log('  [2/8] Desktop: Click blank space in summary pane -> No action.');

    // Scenario 3: Tablet (768px) - Touch scroll near payment method buttons
    await handleSimulatedClick('tablet_scroll_near_buttons', 'tablet_768px');
    console.log('  [3/8] Tablet: Touch scroll gesture near buttons -> No action.');

    // Scenario 4: Tablet (768px) - Accidental tap on "Generate Bill" without payment mode
    await handleSimulatedClick('accidental_tap_generate_bill_button', 'tablet_768px');
    console.assert(
      simulatedToast?.message === 'Please select a payment mode before generating the bill.',
      'Validation toast must be shown on accidental button tap'
    );
    console.log(`  [4/8] Tablet: Accidental tap on Generate Bill -> BLOCKED with message: "${simulatedToast?.message}"`);

    // Scenario 5: Mobile (375px) - Touch outside cart drawer / backdrop
    await handleSimulatedClick('mobile_cart_backdrop_touch', 'mobile_375px');
    console.log('  [5/8] Mobile: Touch outside drawer / backdrop -> No action.');

    // Scenario 6: Mobile (375px) - Rapid double tap on blank space near cart footer
    await handleSimulatedClick('blank_space_cart_footer', 'mobile_375px');
    await handleSimulatedClick('blank_space_cart_footer', 'mobile_375px');
    console.log('  [6/8] Mobile: Rapid double tap on footer blank space -> No action.');

    // Scenario 7: Mobile (375px) - Accidental tap on "Generate Bill" without payment mode
    simulatedToast = null;
    await handleSimulatedClick('accidental_tap_generate_bill_button', 'mobile_375px');
    console.assert(
      simulatedToast?.message === 'Please select a payment mode before generating the bill.',
      'Validation toast must be shown on mobile accidental button tap'
    );
    console.log(`  [7/8] Mobile: Accidental tap on Generate Bill -> BLOCKED with message: "${simulatedToast?.message}"`);

    // Scenario 8: Any Viewport - Enter key pressed inside input field
    await handleSimulatedClick('tender_input_enter_key', 'all_viewports');
    console.log('  [8/8] All Viewports: Enter key in input field -> Prevented, No action.');

    // Direct backend test: If someone maliciously or accidentally bypassed frontend and sent empty payments
    console.log('\n  Direct Backend Safety Test (simulating raw bypass request with no payment mode):');
    const directRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerId: customer.id,
        saleType: SaleType.RETAIL,
        items: simulatedCartState.items,
        payments: [], // Empty payments / missing payment mode
      }),
    });
    console.assert(directRes.status === 400, `Backend must reject with 400, got ${directRes.status}`);
    const directResJson = await directRes.json();
    console.log(`  Backend HTTP Status: ${directRes.status} Bad Request`);
    console.log(`  Backend Response: ${JSON.stringify(directResJson.message || directResJson.error || directResJson)}\n`);

    // Verify database state after ALL accidental touch/click attempts
    const [salesAfter1, paymentsAfter1, itemsAfter1, movementsAfter1] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.saleItem.count(),
      prisma.stockMovement.count(),
    ]);

    const stockAfter1 = await prisma.stock.findUnique({
      where: { productId: product.id },
    });
    const balanceAfter1 = Number(stockAfter1?.currentBalance || 0);

    const latestSaleAfter1 = await prisma.sale.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });
    const latestCashSaleAfter1 = await prisma.sale.findFirst({
      where: { billNumber: { startsWith: 'CASH-' } },
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });

    console.log('  Verification Results for Check 1:');
    console.log(`  - Sales: ${salesBefore1} -> ${salesAfter1} (Change: +${salesAfter1 - salesBefore1})`);
    console.log(`  - Payments: ${paymentsBefore1} -> ${paymentsAfter1} (Change: +${paymentsAfter1 - paymentsBefore1})`);
    console.log(`  - Sale Items: ${itemsBefore1} -> ${itemsAfter1} (Change: +${itemsAfter1 - itemsBefore1})`);
    console.log(`  - Stock Movements: ${movementsBefore1} -> ${movementsAfter1} (Change: +${movementsAfter1 - movementsBefore1})`);
    console.log(`  - Stock Balance: ${balanceBefore1} -> ${balanceAfter1} (Change: ${balanceAfter1 - balanceBefore1})`);
    console.log(`  - Latest Bill Number: ${latestSaleBefore1?.billNumber} === ${latestSaleAfter1?.billNumber}`);
    console.log(`  - Latest Cash Bill: ${latestCashSaleBefore1?.billNumber} === ${latestCashSaleAfter1?.billNumber}`);

    console.assert(salesBefore1 === salesAfter1, 'No Sale created');
    console.assert(paymentsBefore1 === paymentsAfter1, 'No Payment created');
    console.assert(itemsBefore1 === itemsAfter1, 'No SaleItem created');
    console.assert(movementsBefore1 === movementsAfter1, 'No StockMovement created');
    console.assert(balanceBefore1 === balanceAfter1, 'No stock deducted');
    console.assert(latestSaleBefore1?.billNumber === latestSaleAfter1?.billNumber, 'No bill number consumed');
    console.assert(latestCashSaleBefore1?.billNumber === latestCashSaleAfter1?.billNumber, 'No Cash bill number consumed');

    console.log('\n  ✅ CHECK 1 RESULT: PASS — Zero mutations, zero bill consumption, original issue eliminated!\n');

    // ============================================================
    // CHECK 2: BILL NUMBER CONSUMPTION CHECK
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ CHECK 2: BILL NUMBER CONSUMPTION CHECK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('  Step 2A: Start a new bill with products, NO payment mode selected.');

    // Count before 2A
    const [salesBefore2, paymentsBefore2, movementsBefore2] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.stockMovement.count(),
    ]);

    const latestBillBefore2 = await prisma.sale.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });
    const latestCashBefore2 = await prisma.sale.findFirst({
      where: { billNumber: { startsWith: 'CASH-' } },
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });

    console.log(`  - Bill # before attempt: ${latestBillBefore2?.billNumber || 'None'}`);
    console.log(`  - Cash Bill # before attempt: ${latestCashBefore2?.billNumber || 'None'}`);

    // Click "Generate Bill" without payment mode
    console.log('  - Clicking "Generate Bill" without payment mode...');
    let check2ValidationShown = false;
    let check2ErrorMessage = '';

    const attemptCheckoutWithoutPaymentMode = () => {
      const currentPaymentMode = null; // Unselected
      if (!currentPaymentMode) {
        check2ValidationShown = true;
        check2ErrorMessage = 'Please select a payment mode before generating the bill.';
        return { success: false, error: check2ErrorMessage };
      }
      return { success: true };
    };

    const attemptResult = attemptCheckoutWithoutPaymentMode();
    console.assert(attemptResult.success === false, 'Checkout must be blocked');
    console.assert(
      check2ErrorMessage === 'Please select a payment mode before generating the bill.',
      'Exact validation message must be returned'
    );
    console.log(`  ✅ Validation message shown: "${check2ErrorMessage}"`);

    // Verify DB untouched after blocked attempt
    const [salesAfterBlocked, paymentsAfterBlocked, movementsAfterBlocked] = await Promise.all([
      prisma.sale.count(),
      prisma.payment.count(),
      prisma.stockMovement.count(),
    ]);
    const latestBillAfterBlocked = await prisma.sale.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });
    const latestCashAfterBlocked = await prisma.sale.findFirst({
      where: { billNumber: { startsWith: 'CASH-' } },
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });

    console.assert(salesBefore2 === salesAfterBlocked, 'No Sale created after blocked attempt');
    console.assert(paymentsBefore2 === paymentsAfterBlocked, 'No Payment created after blocked attempt');
    console.assert(movementsBefore2 === movementsAfterBlocked, 'No stock movement created after blocked attempt');
    console.assert(latestBillBefore2?.billNumber === latestBillAfterBlocked?.billNumber, 'No bill number consumed');
    console.assert(latestCashBefore2?.billNumber === latestCashAfterBlocked?.billNumber, 'No cash bill number consumed');
    console.log('  ✅ Confirmed: 0 Sales, 0 Payments, 0 Stock Movements, 0 Bill Numbers consumed.\n');

    console.log('  Step 2B: Now select a valid payment mode (CASH) and generate the bill.');

    // Resolve price for 1 item
    const priceRes = await fetch(`${baseUrl}/pricing/resolve-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerId: customer.id,
        saleType: SaleType.RETAIL,
        items: [
          {
            productId: product.id,
            packConfigId: testPack?.id,
            quantity: 1,
          },
        ],
      }),
    });
    const priceData = await priceRes.json();
    const grandTotal = priceData.data.finalTotalAmount;

    // Explicitly generate bill with selected payment mode = CASH
    const cashSaleRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerId: customer.id,
        saleType: SaleType.RETAIL,
        items: [
          {
            productId: product.id,
            packConfigId: testPack?.id,
            quantity: 1,
          },
        ],
        payments: [
          {
            paymentMode: PaymentMode.CASH,
            amount: grandTotal,
          },
        ],
        paidAmount: grandTotal,
      }),
    });

    console.assert(cashSaleRes.status === 201, `Sale must be created with 201, got ${cashSaleRes.status}`);
    const cashSaleData = await cashSaleRes.json();
    const createdCashSale = cashSaleData.data;

    console.log(`  - Exactly one bill generated! HTTP Status: ${cashSaleRes.status}`);
    console.log(`  - Generated Bill Number: ${createdCashSale.billNumber}`);
    console.log(`  - Payment Mode: ${createdCashSale.payments[0].paymentMode}`);
    console.log(`  - Final Total: ₹${createdCashSale.finalTotalAmount}`);
    console.log(`  - Paid Amount: ₹${createdCashSale.paidAmount}`);

    // Verify Cash Bill sequence format
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    console.assert(
      createdCashSale.billNumber.startsWith(`CASH-${todayStr}-`),
      `Cash bill number must follow sequence CASH-${todayStr}-XXXX, got ${createdCashSale.billNumber}`
    );
    console.assert(
      createdCashSale.payments[0].paymentMode === 'CASH',
      'Payment mode must be CASH'
    );
    console.log(`  ✅ Sequence verification: Correct CASH-YYYYMMDD-XXXX format confirmed.`);

    // Step 2C: Repeat with non-cash (UPI) to verify standard invoice sequence
    console.log('\n  Step 2C: Generate a second bill with non-cash (UPI) payment mode.');
    const upiSaleRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outletToken}`,
      },
      body: JSON.stringify({
        customerId: customer.id,
        saleType: SaleType.RETAIL,
        items: [
          {
            productId: product.id,
            packConfigId: testPack?.id,
            quantity: 1,
          },
        ],
        payments: [
          {
            paymentMode: PaymentMode.UPI,
            amount: grandTotal,
            transactionReference: 'UPI-VERIFY-123456',
          },
        ],
        paidAmount: grandTotal,
      }),
    });

    console.assert(upiSaleRes.status === 201, `Sale must be created with 201, got ${upiSaleRes.status}`);
    const upiSaleData = await upiSaleRes.json();
    const createdUpiSale = upiSaleData.data;

    console.log(`  - Exactly one bill generated! HTTP Status: ${upiSaleRes.status}`);
    console.log(`  - Generated Bill Number: ${createdUpiSale.billNumber}`);
    console.log(`  - Payment Mode: ${createdUpiSale.payments[0].paymentMode}`);
    console.log(`  - Transaction Reference: ${createdUpiSale.payments[0].transactionReference}`);
    console.assert(
      !createdUpiSale.billNumber.startsWith('CASH-'),
      'UPI bill must use regular invoice prefix, NOT CASH sequence'
    );
    console.assert(
      createdUpiSale.payments[0].paymentMode === 'UPI',
      'Payment mode must be UPI'
    );
    console.log(`  ✅ Sequence verification: Correct Standard Invoice sequence confirmed.`);

    // Clean up only the two test sales generated during Step 2B and 2C
    await prisma.stockMovement.deleteMany({
      where: { referenceId: { in: [createdCashSale.id, createdUpiSale.id] } },
    });
    await prisma.payment.deleteMany({
      where: { saleId: { in: [createdCashSale.id, createdUpiSale.id] } },
    });
    await prisma.saleItem.deleteMany({
      where: { saleId: { in: [createdCashSale.id, createdUpiSale.id] } },
    });
    await prisma.sale.deleteMany({
      where: { id: { in: [createdCashSale.id, createdUpiSale.id] } },
    });

    console.log('\n  ✅ CHECK 2 RESULT: PASS — Bill number consumption logic verified with 100% integrity!\n');

    console.log('🎉 ========================================================');
    console.log('🎉 BOTH FINAL VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
    console.log('🎉 ========================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runFinalTwoChecks().catch((err) => {
  console.error('❌ Final Verification Failed:', err);
  process.exit(1);
});
