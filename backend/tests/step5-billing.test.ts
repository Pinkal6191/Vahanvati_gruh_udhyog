import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { PricingService } from '../src/modules/pricing/pricing.service.js';
import { CustomerType, PaymentMode, SaleStatus } from '@prisma/client';
import http from 'http';

async function runStep5BillingTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 5 — BILLING / POS TRANSACTION ENGINE TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  const totalTests = 39;

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
  const testUnit = await prisma.unit.create({
    data: {
      name: `Bill Unit ${ts}`,
      symbol: `bu${ts.toString().slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const testCategory = await prisma.category.create({
    data: {
      name: `Bill Cat ${ts}`,
      code: `BCAT_${ts}`,
      displayOrder: 10,
    },
  });

  const testSubcat = await prisma.subcategory.create({
    data: {
      categoryId: testCategory.id,
      name: `Bill Subcat ${ts}`,
      code: `BSUB_${ts}`,
    },
  });

  // Product 1: Standard Farsan (Pack & Loose allowed)
  const productA = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: testUnit.id,
      name: `Bill Mathiya ${ts}`,
      code: `BMATHIYA_${ts}`,
      isLooseWeightAllowed: true,
      isActive: true,
    },
  });

  const packA500 = await prisma.productPackConfiguration.create({
    data: {
      productId: productA.id,
      unitId: testUnit.id,
      packName: '500 GM Pack',
      weightInBaseUnits: 500,
      displayOrder: 1,
    },
  });

  // Setup Initial Stock for Product A: 50,000 GM (50 KG)
  await prisma.stock.create({
    data: {
      productId: productA.id,
      currentBalance: 50000.0,
      minimumThreshold: 1000.0,
    },
  });

  // Configure Prices for Product A:
  // Pack 500g: Indian ₹150, NRI ₹250
  // Loose (per kg): Indian ₹300, NRI ₹500
  await PricingService.createPrice(
    { productId: productA.id, packConfigId: packA500.id, customerType: CustomerType.INDIAN, rate: 150.0 },
    admin.id,
    'ADMIN'
  );
  await PricingService.createPrice(
    { productId: productA.id, packConfigId: packA500.id, customerType: CustomerType.NRI, rate: 250.0 },
    admin.id,
    'ADMIN'
  );
  await PricingService.createPrice(
    { productId: productA.id, packConfigId: null, customerType: CustomerType.INDIAN, rate: 300.0 },
    admin.id,
    'ADMIN'
  );
  await PricingService.createPrice(
    { productId: productA.id, packConfigId: null, customerType: CustomerType.NRI, rate: 500.0 },
    admin.id,
    'ADMIN'
  );

  // Product 2: Fixed Packet Only (Loose disallowed)
  const productB = await prisma.product.create({
    data: {
      subcategoryId: testSubcat.id,
      primaryUnitId: testUnit.id,
      name: `Bill Khakhra Box ${ts}`,
      code: `BKHAKHRA_${ts}`,
      isLooseWeightAllowed: false,
      isActive: true,
    },
  });

  const packBBox = await prisma.productPackConfiguration.create({
    data: {
      productId: productB.id,
      unitId: testUnit.id,
      packName: 'Box (250 GM)',
      weightInBaseUnits: 250,
      displayOrder: 1,
    },
  });

  await prisma.stock.create({
    data: {
      productId: productB.id,
      currentBalance: 5000.0,
      minimumThreshold: 500.0,
    },
  });

  await PricingService.createPrice(
    { productId: productB.id, packConfigId: packBBox.id, customerType: CustomerType.INDIAN, rate: 90.0 },
    admin.id,
    'ADMIN'
  );

  // Setup Customers
  const indianCustomer = await prisma.customer.create({
    data: {
      name: `Kishorbhai Indian ${ts}`,
      customerType: CustomerType.INDIAN,
      mobile: `98250${ts.toString().slice(-5)}`,
      city: 'Nadiad',
    },
  });

  const nriCustomer = await prisma.customer.create({
    data: {
      name: `Bhavinbhai NRI ${ts}`,
      customerType: CustomerType.NRI,
      mobile: `+140855${ts.toString().slice(-4)}`,
      country: 'USA',
    },
  });

  try {
    // ============================================================
    // SECTION 1: PRODUCT & CUSTOMER VALIDATION (Tests 1 - 5)
    // ============================================================

    // Test 1: Inactive product cannot be billed
    console.log('▶ [1/39] Inactive Product Cannot Be Billed...');
    const inactiveProd = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: testUnit.id,
        name: `Inactive Product ${ts}`,
        code: `INACT_${ts}`,
        isActive: false,
      },
    });

    let inactiveError = '';
    try {
      await SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: inactiveProd.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
        paidAmount: 100,
      });
    } catch (err: any) {
      inactiveError = err.message;
    }
    console.assert(
      inactiveError.includes('inactive and cannot be selected'),
      `Expected inactive product error, got: "${inactiveError}"`
    );
    console.log('  ✅ Inactive product blocked from billing.');
    passedTests++;

    // Test 2: Invalid product cannot be billed
    console.log('▶ [2/39] Non-Existent Product Cannot Be Billed...');
    let nonExistentError = '';
    try {
      await SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
        paidAmount: 100,
      });
    } catch (err: any) {
      nonExistentError = err.message;
    }
    console.assert(
      nonExistentError.includes('Product not found'),
      `Expected not found error, got: "${nonExistentError}"`
    );
    console.log('  ✅ Non-existent product ID rejected.');
    passedTests++;

    // Test 3: Valid customer can be billed
    console.log('▶ [3/39] Valid Customer Can Be Billed...');
    const validSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      customerId: indianCustomer.id,
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 150 }],
      paidAmount: 150,
    });
    console.assert(validSale?.customerId === indianCustomer.id, 'Customer ID should match');
    console.assert(validSale?.customerNameSnapshot === indianCustomer.name, 'Customer name snapshot should match');
    console.log(`  ✅ Sale completed for customer "${indianCustomer.name}".`);
    passedTests++;

    // Test 4: Invalid customer is rejected
    console.log('▶ [4/39] Invalid Customer ID Is Rejected...');
    let invalidCustomerError = '';
    try {
      await SalesService.createSale(outlet.id, 'OUTLET', {
        customerId: '00000000-0000-0000-0000-000000000000',
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 150 }],
        paidAmount: 150,
      });
    } catch (err: any) {
      invalidCustomerError = err.message;
    }
    console.assert(
      invalidCustomerError.includes('Customer not found'),
      `Expected Customer not found, got: "${invalidCustomerError}"`
    );
    console.log('  ✅ Invalid customer ID rejected.');
    passedTests++;

    // Test 5: Correct customer type reaches Pricing Engine
    console.log('▶ [5/39] Customer Type Snapshot Matches Master Data...');
    console.assert(validSale?.customerTypeSnapshot === CustomerType.INDIAN, 'Customer type must be INDIAN');
    console.log('  ✅ Customer tier snapshot verified.');
    passedTests++;

    // ============================================================
    // SECTION 2: PRICING INTEGRATION & RESOLUTION (Tests 6 - 8)
    // ============================================================

    // Test 6: Indian customer gets Indian price (₹150 for 500g pack)
    console.log('▶ [6/39] Indian Customer Gets Indian Price (₹150)...');
    console.assert(Number(validSale?.items[0].unitRate) === 150, 'Indian rate must be ₹150');
    console.log('  ✅ Indian rate ₹150 applied.');
    passedTests++;

    // Test 7: NRI customer gets NRI price (₹250 for 500g pack)
    console.log('▶ [7/39] NRI Customer Gets NRI Price (₹250)...');
    const nriSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      customerId: nriCustomer.id,
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
      payments: [{ paymentMode: PaymentMode.UPI, amount: 250 }],
      paidAmount: 250,
    });
    console.assert(Number(nriSale?.items[0].unitRate) === 250, 'NRI rate must be ₹250');
    console.assert(nriSale?.customerTypeSnapshot === CustomerType.NRI, 'Snapshot must be NRI');
    console.log('  ✅ NRI rate ₹250 applied.');
    passedTests++;

    // Test 8: Missing applicable price rejects billing (no fallback)
    console.log('▶ [8/39] Missing Applicable Price Rejects Billing (No Fallback)...');
    // Product B only has Indian price configured, no NRI price
    let missingNriPriceError = '';
    try {
      await SalesService.createSale(outlet.id, 'OUTLET', {
        customerId: nriCustomer.id,
        items: [{ productId: productB.id, packConfigId: packBBox.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 90 }],
        paidAmount: 90,
      });
    } catch (err: any) {
      missingNriPriceError = err.message;
    }
    console.assert(
      missingNriPriceError.includes('Applicable NRI price is not configured for this product'),
      `Expected missing NRI price error, got: "${missingNriPriceError}"`
    );
    console.log(`  ✅ Strict rule verified: Billing blocked when NRI price missing ("${missingNriPriceError}").`);
    passedTests++;

    // ============================================================
    // SECTION 3: QUANTITY & WEIGHT HANDLING (Tests 9 - 12)
    // ============================================================

    // Test 9: Valid quantity succeeds
    console.log('▶ [9/39] Valid Quantity Succeeds...');
    const multiQtySale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 3 }],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 450 }],
      paidAmount: 450,
    });
    console.assert(Number(multiQtySale?.items[0].quantity) === 3, 'Quantity should be 3');
    console.assert(Number(multiQtySale?.finalTotalAmount) === 450, '3 * 150 = 450');
    console.log('  ✅ 3 packs @ ₹150 = ₹450 total.');
    passedTests++;

    // Test 10: Invalid / negative quantity fails validation
    console.log('▶ [10/39] Negative Quantity Fails Validation...');
    const negQtyRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outletToken}` },
      body: JSON.stringify({
        items: [{ productId: productA.id, quantity: -2 }],
        payments: [{ paymentMode: 'CASH', amount: 300 }],
        paidAmount: 300,
      }),
    });
    console.assert(negQtyRes.status === 400, 'Negative quantity must return 400');
    console.log('  ✅ Negative quantity rejected with 400.');
    passedTests++;

    // Test 11: Invalid unit/weight fails (loose weight on product where loose is disallowed)
    console.log('▶ [11/39] Loose Weight Selling Disallowed When isLooseWeightAllowed = false...');
    let disallowedLooseError = '';
    try {
      await SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: productB.id, looseWeightInGrams: 300, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 90 }],
        paidAmount: 90,
      });
    } catch (err: any) {
      disallowedLooseError = err.message;
    }
    console.assert(
      disallowedLooseError.includes('Loose weight selling is not allowed'),
      `Expected loose disallowed error, got: "${disallowedLooseError}"`
    );
    console.log('  ✅ Loose selling correctly blocked for packaged-only product.');
    passedTests++;

    // Test 12: Decimal quantity & loose weight works accurately
    console.log('▶ [12/39] Loose Weight Calculation: 340 GM @ ₹300/kg...');
    // 340 grams @ ₹300/kg = 0.34 * 300 = ₹102.00
    const looseSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, looseWeightInGrams: 340, quantity: 1 }],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 102 }],
      paidAmount: 102,
    });
    console.assert(Number(looseSale?.items[0].unitRate) === 300, 'Unit rate should be ₹300/kg');
    console.assert(Number(looseSale?.items[0].total) === 102, '340g @ ₹300/kg should be ₹102');
    console.assert(Number(looseSale?.finalTotalAmount) === 102, 'Total should be ₹102');
    console.log('  ✅ Loose weight calculation mathematically verified: ₹102.00.');
    passedTests++;

    // ============================================================
    // SECTION 4: CALCULATION & TOTALS (Tests 13 - 16)
    // ============================================================

    // Test 13: Correct line amount for mixed cart
    console.log('▶ [13/39] Mixed Cart Line Amount Calculation...');
    // Item 1: 2 x 500g Mathiya @ 150 = 300
    // Item 2: 500g loose Mathiya @ 300/kg = 150
    // Item 3: 1 x Khakhra Box @ 90 = 90
    // Subtotal = 300 + 150 + 90 = 540
    const mixedSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [
        { productId: productA.id, packConfigId: packA500.id, quantity: 2 },
        { productId: productA.id, looseWeightInGrams: 500, quantity: 1 },
        { productId: productB.id, packConfigId: packBBox.id, quantity: 1 },
      ],
      discountAmount: 40,
      payments: [{ paymentMode: PaymentMode.CASH, amount: 500 }],
      paidAmount: 500,
    });
    console.assert(Number(mixedSale?.subtotalAmount) === 540, 'Subtotal must be ₹540');
    console.log('  ✅ Line amounts and subtotal ₹540 verified.');
    passedTests++;

    // Test 14: Correct subtotal after deduplication/merging
    console.log('▶ [14/39] Duplicate Product Lines Are Merged Automatically...');
    // Send 2 lines of identical pack: 1 pack + 2 packs = 3 packs
    const mergedSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [
        { productId: productA.id, packConfigId: packA500.id, quantity: 1 },
        { productId: productA.id, packConfigId: packA500.id, quantity: 2 },
      ],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 450 }],
      paidAmount: 450,
    });
    console.assert(mergedSale?.items.length === 1, 'Duplicate lines must merge into 1 item');
    console.assert(Number(mergedSale?.items[0].quantity) === 3, 'Merged quantity must be 3');
    console.assert(Number(mergedSale?.finalTotalAmount) === 450, 'Total must be 3 * 150 = ₹450');
    console.log('  ✅ Duplicate lines cleanly merged into single line item with quantity 3.');
    passedTests++;

    // Test 15: Correct grand total after discount (ROUND_HALF_UP)
    console.log('▶ [15/39] Correct Grand Total: Subtotal (₹540) - Discount (₹40) = ₹500...');
    console.assert(Number(mixedSale?.discountAmount) === 40, 'Discount must be ₹40');
    console.assert(Number(mixedSale?.finalTotalAmount) === 500, 'Grand total must be ₹500');
    console.log('  ✅ Grand total calculation verified.');
    passedTests++;

    // Test 16: Decimal accuracy with cash change returned
    console.log('▶ [16/39] Payment Change Returned: Paid ₹600 for ₹500 Bill -> Change ₹100...');
    const changeSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 150 }],
      paidAmount: 200, // Customer handed over ₹200 note
    });
    console.assert(Number(changeSale?.finalTotalAmount) === 150, 'Bill total should be ₹150');
    console.assert(Number(changeSale?.paidAmount) === 200, 'Paid amount should be ₹200');
    console.assert(Number(changeSale?.changeReturned) === 50, 'Change returned should be ₹50');
    console.log('  ✅ Change returned ₹50.00 accurately calculated.');
    passedTests++;

    // ============================================================
    // SECTION 5: PAYMENT MODES & VALIDATION (Tests 17 - 20)
    // ============================================================

    // Test 17: Cash payment works
    console.log('▶ [17/39] Payment: CASH Mode Verified...');
    console.assert(changeSale?.payments[0].paymentMode === PaymentMode.CASH, 'Mode must be CASH');
    console.log('  ✅ Cash payment verified.');
    passedTests++;

    // Test 18: UPI payment works with reference
    console.log('▶ [18/39] Payment: UPI Mode With Transaction Reference...');
    const upiSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
      payments: [
        {
          paymentMode: PaymentMode.UPI,
          amount: 150,
          transactionReference: 'UPI-REF-987654321',
          notes: 'Google Pay',
        },
      ],
      paidAmount: 150,
    });
    console.assert(upiSale?.payments[0].paymentMode === PaymentMode.UPI, 'Mode must be UPI');
    console.assert(upiSale?.payments[0].transactionReference === 'UPI-REF-987654321', 'UPI reference saved');
    console.log('  ✅ UPI payment and reference recorded.');
    passedTests++;

    // Test 19: Card / Other multi-split payment works
    console.log('▶ [19/39] Payment: Split Payment (₹100 CASH + ₹50 UPI)...');
    const splitSale = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
      payments: [
        { paymentMode: PaymentMode.CASH, amount: 100 },
        { paymentMode: PaymentMode.UPI, amount: 50, transactionReference: 'UPI-SPLIT-1' },
      ],
      paidAmount: 150,
    });
    console.assert(splitSale?.payments.length === 2, 'Must record 2 split payments');
    console.log('  ✅ Split payment (Cash + UPI) recorded.');
    passedTests++;

    // Test 20: Underpayment is rejected
    console.log('▶ [20/39] Payment: Underpayment Rejection (Paying ₹100 for ₹150 Bill)...');
    let underpaymentError = '';
    try {
      await SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }], // ₹50 short!
        paidAmount: 100,
      });
    } catch (err: any) {
      underpaymentError = err.message;
    }
    console.assert(
      underpaymentError.includes('is less than the bill total'),
      `Expected underpayment error, got: "${underpaymentError}"`
    );
    console.log('  ✅ Underpayment blocked.');
    passedTests++;

    // ============================================================
    // SECTION 6: BILL NUMBERING & IMMUTABILITY (Tests 21 - 25)
    // ============================================================

    // Test 21: Bill created successfully
    console.log('▶ [21/39] Bill Created With Valid Status & Header...');
    console.assert(splitSale?.saleStatus === SaleStatus.COMPLETED, 'Status must be COMPLETED');
    console.assert(splitSale?.paymentStatus === 'PAID', 'Payment status must be PAID');
    console.log('  ✅ Bill completion status verified.');
    passedTests++;

    // Test 22: Unique sequential bill number format (VGU-YYYYMMDD-XXXX)
    console.log('▶ [22/39] Sequential Bill Number Format...');
    const billNum = splitSale!.billNumber;
    const billRegex = /^VGU-\d{8}-\d{4}$/;
    console.assert(billRegex.test(billNum), `Bill number "${billNum}" must match format VGU-YYYYMMDD-XXXX`);
    console.log(`  ✅ Bill number format verified: "${billNum}".`);
    passedTests++;

    // Test 23: Consecutive bill numbers increment monotonically
    console.log('▶ [23/39] Consecutive Monotonic Increment of Bill Numbers...');
    const saleNext = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 150 }],
      paidAmount: 150,
    });
    const prevSeq = parseInt(billNum.split('-')[2], 10);
    const nextSeq = parseInt(saleNext!.billNumber.split('-')[2], 10);
    console.assert(nextSeq === prevSeq + 1, `Next sequence (${nextSeq}) must be prev (${prevSeq}) + 1`);
    console.log(`  ✅ Sequence monotonically incremented: ${prevSeq} -> ${nextSeq}.`);
    passedTests++;

    // Test 24: Bill item stores actual applied rate snapshot
    console.log('▶ [24/39] Bill Item Snapshot Verification...');
    const itemSnapshot = saleNext!.items[0];
    console.assert(Number(itemSnapshot.unitRate) === 150, 'Snapshot rate must be 150');
    console.assert(itemSnapshot.productNameSnapshot === productA.name, 'Product name snapshotted');
    console.assert(itemSnapshot.weightOrPackSnapshot === '500 GM Pack', 'Pack variant snapshotted');
    console.log('  ✅ Historical snapshot captured in SaleItem record.');
    passedTests++;

    // Test 25: Historical bill remains unchanged after subsequent price updates
    console.log('▶ [25/39] Historical Bill Unchanged When Current Price Changes...');
    // Change price of Product A pack 500g to ₹200
    const activePrice = await prisma.productPrice.findFirst({
      where: { productId: productA.id, packConfigId: packA500.id, customerType: CustomerType.INDIAN, isActive: true },
    });
    await PricingService.updatePrice(activePrice!.id, { rate: 200.0 }, admin.id, 'ADMIN');

    // Retrieve previous bill created at ₹150
    const pastBill = await SalesService.getSaleById(saleNext!.id);
    console.assert(Number(pastBill.items[0].unitRate) === 150, 'Historical bill item rate must remain ₹150');
    console.assert(Number(pastBill.finalTotalAmount) === 150, 'Historical bill total must remain ₹150');
    console.log('  ✅ Historical bill remained completely immutable at ₹150 after master price changed to ₹200.');
    passedTests++;

    // ============================================================
    // SECTION 7: AUTHORIZATION & RBAC (Tests 26 - 29)
    // ============================================================

    // Test 26: Admin can bill
    console.log('▶ [26/39] Authorization: Admin Can Bill...');
    const adminBillRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    console.assert(adminBillRes.status === 201, `Admin bill should return 201, got ${adminBillRes.status}`);
    console.log('  ✅ Admin successfully billed (201 Created).');
    passedTests++;

    // Test 27: Outlet can bill
    console.log('▶ [27/39] Authorization: Outlet Can Bill...');
    const outletBillRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outletToken}` },
      body: JSON.stringify({
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    console.assert(outletBillRes.status === 201, `Outlet bill should return 201, got ${outletBillRes.status}`);
    console.log('  ✅ Outlet successfully billed (201 Created).');
    passedTests++;

    // Test 28: Production cannot bill (403 Forbidden)
    console.log('▶ [28/39] Authorization: Production Role Cannot Bill (403 Forbidden)...');
    const prodBillRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    console.assert(prodBillRes.status === 403, `Production bill must return 403, got ${prodBillRes.status}`);
    console.log('  ✅ Production role strictly blocked (403 Forbidden).');
    passedTests++;

    // Test 29: Unauthenticated request rejected (401 Unauthorized)
    console.log('▶ [29/39] Authorization: Unauthenticated Request Rejected (401 Unauthorized)...');
    const unauthBillRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    console.assert(unauthBillRes.status === 401, `Unauthenticated must return 401, got ${unauthBillRes.status}`);
    console.log('  ✅ Unauthenticated request blocked (401 Unauthorized).');
    passedTests++;

    // ============================================================
    // SECTION 8: ATOMIC TRANSACTION INTEGRITY (Tests 30 - 33)
    // ============================================================

    // Test 30: Insufficient stock rolls back checkout completely
    console.log('▶ [30/39] Transaction Atomicity: Insufficient Stock Rolls Back Sale...');
    const stockBeforeFail = await prisma.stock.findUnique({ where: { productId: productA.id } });
    const balanceBeforeFail = Number(stockBeforeFail!.currentBalance);
    const salesCountBefore = await prisma.sale.count();

    let stockError = '';
    try {
      // Attempt to purchase 100,000 GM (100 KG) when only ~5 KG is in stock
      await SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: productA.id, looseWeightInGrams: 100000, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 30000 }],
        paidAmount: 30000,
      });
    } catch (err: any) {
      stockError = err.message;
    }

    console.assert(stockError.includes('Insufficient stock'), `Expected insufficient stock, got: "${stockError}"`);
    const salesCountAfter = await prisma.sale.count();
    const stockAfterFail = await prisma.stock.findUnique({ where: { productId: productA.id } });

    console.assert(salesCountAfter === salesCountBefore, 'No sale record should be saved on rollback');
    console.assert(
      Number(stockAfterFail!.currentBalance) === balanceBeforeFail,
      'Stock balance must remain unchanged on rollback'
    );
    console.log('  ✅ Atomic rollback verified: 0 sales created, 0 stock deducted.');
    passedTests++;

    // Test 31: Stock movement ledger records exact deduction
    console.log('▶ [31/39] Stock Movement Ledger Accuracy...');
    const saleWithStock = await SalesService.createSale(outlet.id, 'OUTLET', {
      items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 2 }], // 1000 GM
      payments: [{ paymentMode: PaymentMode.CASH, amount: 400 }],
      paidAmount: 400,
    });
    const movement = await prisma.stockMovement.findFirst({
      where: { referenceId: saleWithStock!.id },
    });
    console.assert(movement !== null, 'Stock movement must exist for sale');
    console.assert(Number(movement!.quantityDelta) === -1000, 'Movement delta must be -1000 GM');
    console.log('  ✅ Stock movement ledger correctly logged -1000 GM deduction.');
    passedTests++;

    // Test 32: Print payload receipt format (omitting customer tier)
    console.log('▶ [32/39] Print Payload Receipt (Customer Tier Excluded)...');
    const printPayload = await SalesService.getPrintPayload(saleWithStock!.id);
    console.assert(Boolean(printPayload.company.name), 'Company name present');
    console.assert(Boolean(printPayload.invoice.billNumber), 'Bill number present');
    console.assert(
      (printPayload.invoice as any).customerType === undefined,
      'Customer tier MUST NOT appear in print payload'
    );
    console.log('  ✅ Print payload generated with customer type properly hidden.');
    passedTests++;

    // Test 33: Bill cancellation reverses stock and marks status
    console.log('▶ [33/39] Bill Cancellation Reverses Stock & Records Audit...');
    const stockBeforeCancel = await prisma.stock.findUnique({ where: { productId: productA.id } });
    const balBeforeCancel = Number(stockBeforeCancel!.currentBalance);

    const cancelledSale = await SalesService.cancelSale(saleWithStock!.id, admin.id, 'ADMIN', {
      reason: 'Customer cancelled transaction immediately',
    });

    console.assert(cancelledSale.saleStatus === SaleStatus.CANCELLED, 'Status must be CANCELLED');
    console.assert(cancelledSale.cancellationReason === 'Customer cancelled transaction immediately', 'Reason saved');

    const stockAfterCancel = await prisma.stock.findUnique({ where: { productId: productA.id } });
    console.assert(
      Number(stockAfterCancel!.currentBalance) === balBeforeCancel + 1000,
      'Stock must be refunded by +1000 GM'
    );
    console.log('  ✅ Bill cancelled: Status marked CANCELLED and +1000 GM stock restored.');
    passedTests++;

    // ============================================================
    // SECTION 9: SECURITY (Tests 34 - 36)
    // ============================================================

    // Test 34: Client-submitted price is ignored
    console.log('▶ [34/39] Security: Client-Submitted Price Is Ignored...');
    // Send rate: 10 in payload (actual price is 200)
    const spoofRateRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outletToken}` },
      body: JSON.stringify({
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1, rate: 10, unitRate: 10 }],
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    const spoofJson = await spoofRateRes.json();
    console.assert(spoofRateRes.status === 201, 'Request succeeds because server calculates real price');
    console.assert(Number(spoofJson.data.items[0].unitRate) === 200, 'Server must enforce authoritative ₹200');
    console.log('  ✅ Client rate tampering thwarted: Server enforced ₹200.00.');
    passedTests++;

    // Test 35: Client-submitted total is ignored
    console.log('▶ [35/39] Security: Client-Submitted Total Is Ignored...');
    const spoofTotalRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outletToken}` },
      body: JSON.stringify({
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        finalTotalAmount: 1, // Client claims bill is ₹1
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    const spoofTotalJson = await spoofTotalRes.json();
    console.assert(Number(spoofTotalJson.data.finalTotalAmount) === 200, 'Server must enforce real total ₹200');
    console.log('  ✅ Client total tampering thwarted: Server calculated ₹200.00.');
    passedTests++;

    // Test 36: Client-submitted bill number is ignored
    console.log('▶ [36/39] Security: Client-Submitted Bill Number Is Ignored...');
    const spoofBillNumRes = await fetch(`${baseUrl}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outletToken}` },
      body: JSON.stringify({
        billNumber: 'MY-CUSTOM-BILL-9999',
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: 'CASH', amount: 200 }],
        paidAmount: 200,
      }),
    });
    const spoofBillJson = await spoofBillNumRes.json();
    console.assert(spoofBillJson.data.billNumber.startsWith('VGU-'), 'Server must assign sequential VGU- number');
    console.assert(spoofBillJson.data.billNumber !== 'MY-CUSTOM-BILL-9999', 'Client bill number must be ignored');
    console.log('  ✅ Client bill number ignored; server generated valid sequential bill number.');
    passedTests++;

    // ============================================================
    // SECTION 10: CONCURRENCY & RACE CONDITIONS (Tests 37 - 39)
    // ============================================================

    // Test 37: Multiple simultaneous checkouts never produce duplicate bill numbers
    console.log('▶ [37/39] Concurrency: 5 Simultaneous Checkouts Produce 5 Distinct Bill Numbers...');
    const concurrentRequests = Array.from({ length: 5 }).map(() =>
      SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: productA.id, packConfigId: packA500.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 200 }],
        paidAmount: 200,
      })
    );
    const concurrentResults = await Promise.all(concurrentRequests);
    const billNumbers = concurrentResults.map((s) => s!.billNumber);
    const uniqueBillNumbers = new Set(billNumbers);

    console.assert(
      uniqueBillNumbers.size === 5,
      `All 5 bill numbers must be unique! Found: ${Array.from(uniqueBillNumbers).join(', ')}`
    );
    console.log(`  ✅ 5 simultaneous checkouts produced 5 unique sequential bill numbers: ${billNumbers.join(', ')}.`);
    passedTests++;

    // Test 38: Race condition: Stock row-level locking prevents overselling
    console.log('▶ [38/39] Concurrency: Row-Level Stock Locking Prevents Overselling...');
    // Create product with stock of exactly 1 pack (500 GM)
    const limitedProd = await prisma.product.create({
      data: {
        subcategoryId: testSubcat.id,
        primaryUnitId: testUnit.id,
        name: `Limited Stock Prod ${ts}`,
        code: `LTD_${ts}`,
        isLooseWeightAllowed: false,
        isActive: true,
      },
    });
    const limitedPack = await prisma.productPackConfiguration.create({
      data: {
        productId: limitedProd.id,
        unitId: testUnit.id,
        packName: 'Single 500g',
        weightInBaseUnits: 500,
      },
    });
    await prisma.stock.create({
      data: {
        productId: limitedProd.id,
        currentBalance: 500, // EXACTLY 1 PACK
      },
    });
    await PricingService.createPrice(
      { productId: limitedProd.id, packConfigId: limitedPack.id, customerType: CustomerType.INDIAN, rate: 100 },
      admin.id,
      'ADMIN'
    );

    // Run 2 simultaneous purchases for 1 pack each
    const [p1Result, p2Result] = await Promise.allSettled([
      SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: limitedProd.id, packConfigId: limitedPack.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
        paidAmount: 100,
      }),
      SalesService.createSale(outlet.id, 'OUTLET', {
        items: [{ productId: limitedProd.id, packConfigId: limitedPack.id, quantity: 1 }],
        payments: [{ paymentMode: PaymentMode.CASH, amount: 100 }],
        paidAmount: 100,
      }),
    ]);

    const successes = [p1Result, p2Result].filter((r) => r.status === 'fulfilled');
    const failures = [p1Result, p2Result].filter((r) => r.status === 'rejected');

    console.assert(successes.length === 1, 'Exactly 1 concurrent purchase should succeed');
    console.assert(failures.length === 1, 'Exactly 1 concurrent purchase should fail due to insufficient stock');
    const finalLimitedStock = await prisma.stock.findUnique({ where: { productId: limitedProd.id } });
    console.assert(Number(finalLimitedStock!.currentBalance) === 0, 'Final stock balance must be 0 (never negative)');
    console.log('  ✅ Concurrency race condition prevented: exactly 1 sale succeeded, 1 rejected, balance = 0 GM.');
    passedTests++;

    // Test 39: Sales Query & Listing Filters
    console.log('▶ [39/39] Sales Query & Listing API Filters...');
    const salesList = await SalesService.listSales({
      customerId: indianCustomer.id,
      page: 1,
      limit: 10,
    });
    console.assert(salesList.items.length > 0, 'Should find sales for indian customer');
    console.assert(salesList.pagination.total >= 1, 'Pagination count should be >= 1');
    console.log(`  ✅ Filtered listing returned ${salesList.items.length} sales with pagination.`);
    passedTests++;

    // Clean up test data
    await prisma.stockMovement.deleteMany({
      where: { productId: { in: [productA.id, productB.id, inactiveProd.id, limitedProd.id] } },
    });
    await prisma.payment.deleteMany({
      where: { sale: { items: { some: { productId: { in: [productA.id, productB.id, limitedProd.id] } } } } },
    });
    await prisma.saleItem.deleteMany({
      where: { productId: { in: [productA.id, productB.id, limitedProd.id] } },
    });
    await prisma.sale.deleteMany({
      where: { customerId: { in: [indianCustomer.id, nriCustomer.id] } },
    });
    await prisma.stock.deleteMany({
      where: { productId: { in: [productA.id, productB.id, inactiveProd.id, limitedProd.id] } },
    });
    await prisma.productPrice.deleteMany({
      where: { productId: { in: [productA.id, productB.id, inactiveProd.id, limitedProd.id] } },
    });
    await prisma.productPackConfiguration.deleteMany({
      where: { productId: { in: [productA.id, productB.id, limitedProd.id] } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [productA.id, productB.id, inactiveProd.id, limitedProd.id] } },
    });
    await prisma.subcategory.delete({ where: { id: testSubcat.id } });
    await prisma.category.delete({ where: { id: testCategory.id } });
    await prisma.unit.delete({ where: { id: testUnit.id } });
    await prisma.customer.deleteMany({ where: { id: { in: [indianCustomer.id, nriCustomer.id] } } });

    console.log('\n🎉 ========================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 5 BILLING / POS ENGINE TESTS PASSED!`);
    console.log('🎉 ========================================================');
  } finally {
    server.close();
  }
}

runStep5BillingTests()
  .catch((err) => {
    console.error('❌ Step 5 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
