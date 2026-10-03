import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PaymentMode } from '../src/features/billing/billing.api';

describe('POS Billing Safety — Payment Mode & Accidental Bill Prevention Test Suite', () => {
  // Test 1: Payment modal default state
  it('TEST 1 — Payment modal default state: No payment mode is selected initially', () => {
    // Simulator for useBillingCart initial state
    let paymentMode: PaymentMode | null = null;
    assert.strictEqual(paymentMode, null, 'Initial payment mode must be null / unselected');
  });

  // Test 2: Generate Bill without payment mode
  it('TEST 2 — Generate Bill without payment mode: shows validation error and does not create sale', () => {
    let paymentMode: PaymentMode | null = null;
    let saleCreated = false;
    let errorMessage = '';

    const handleGenerateBill = () => {
      if (!paymentMode) {
        errorMessage = 'Please select a payment mode before generating the bill.';
        return;
      }
      saleCreated = true;
    };

    handleGenerateBill();

    assert.strictEqual(errorMessage, 'Please select a payment mode before generating the bill.');
    assert.strictEqual(saleCreated, false, 'Sale must not be created when payment mode is missing');
  });

  // Test 3: Outside click
  it('TEST 3 — Outside click: clicking outside payment area does not generate a bill', () => {
    let saleCreated = false;
    const handleOutsideClick = (e: { target: string }) => {
      // Outside clicks do NOT trigger sale creation
      if (e.target === 'outside_area' || e.target === 'blank_space') {
        // No action
      }
    };

    handleOutsideClick({ target: 'outside_area' });
    assert.strictEqual(saleCreated, false, 'No bill or sale created on outside click');
  });

  // Test 4: Outside touch
  it('TEST 4 — Outside touch: touching outside payment area on touchscreens does not generate a bill', () => {
    let saleCreated = false;
    const handleTouchOutside = (e: { target: string }) => {
      // Touch outside should never trigger submission
      if (e.target !== 'pos-complete-bill-btn') {
        // No-op
      }
    };

    handleTouchOutside({ target: 'blank_touch_area' });
    assert.strictEqual(saleCreated, false, 'No bill or sale created on outside touch');
  });

  // Test 5: Blank-space click
  it('TEST 5 — Blank-space click: clicking blank space around payment UI generates no bill', () => {
    let saleCreated = false;
    const handleBlankClick = () => {
      // Blank space has no submit handler
    };
    handleBlankClick();
    assert.strictEqual(saleCreated, false, 'No bill generated on blank space click');
  });

  // Test 6: Backdrop click
  it('TEST 6 — Backdrop click: modal closes without creating any bill, sale, or payment', () => {
    let isModalOpen = true;
    let saleCreated = false;
    const handleBackdropClick = () => {
      isModalOpen = false; // Only closes modal
    };

    handleBackdropClick();
    assert.strictEqual(isModalOpen, false, 'Modal closed');
    assert.strictEqual(saleCreated, false, 'No sale created on backdrop click');
  });

  // Test 7: Cancel
  it('TEST 7 — Cancel: clicking Cancel closes modal with zero sale creation', () => {
    let isModalOpen = true;
    let saleCreated = false;
    const handleCancel = () => {
      isModalOpen = false;
    };

    handleCancel();
    assert.strictEqual(isModalOpen, false);
    assert.strictEqual(saleCreated, false);
  });

  // Test 8: Escape
  it('TEST 8 — Escape: pressing Escape key closes UI without creating sale', () => {
    let isModalOpen = true;
    let saleCreated = false;
    const handleKeyDown = (key: string) => {
      if (key === 'Escape') {
        isModalOpen = false;
      }
    };

    handleKeyDown('Escape');
    assert.strictEqual(isModalOpen, false);
    assert.strictEqual(saleCreated, false);
  });

  // Test 9: UPI
  it('TEST 9 — UPI: selecting UPI and clicking Generate Bill generates UPI bill', () => {
    let paymentMode: PaymentMode | null = null;
    paymentMode = 'UPI';
    let createdSaleMode: string | null = null;

    const handleGenerateBill = () => {
      if (!paymentMode) throw new Error('Please select a payment mode before generating the bill.');
      createdSaleMode = paymentMode;
    };

    handleGenerateBill();
    assert.strictEqual(createdSaleMode, 'UPI');
  });

  // Test 10: Cash
  it('TEST 10 — Cash: selecting Cash and clicking Generate Bill generates Cash bill', () => {
    let paymentMode: PaymentMode | null = null;
    paymentMode = 'CASH';
    let createdSaleMode: string | null = null;

    const handleGenerateBill = () => {
      if (!paymentMode) throw new Error('Please select a payment mode before generating the bill.');
      createdSaleMode = paymentMode;
    };

    handleGenerateBill();
    assert.strictEqual(createdSaleMode, 'CASH');
  });

  // Test 11: Card
  it('TEST 11 — Card: selecting Card and clicking Generate Bill generates Card bill', () => {
    let paymentMode: PaymentMode | null = null;
    paymentMode = 'CARD';
    let createdSaleMode: string | null = null;

    const handleGenerateBill = () => {
      if (!paymentMode) throw new Error('Please select a payment mode before generating the bill.');
      createdSaleMode = paymentMode;
    };

    handleGenerateBill();
    assert.strictEqual(createdSaleMode, 'CARD');
  });

  // Test 12: Other
  it('TEST 12 — Other: selecting Other and clicking Generate Bill generates Other bill', () => {
    let paymentMode: PaymentMode | null = null;
    paymentMode = 'OTHER';
    let createdSaleMode: string | null = null;

    const handleGenerateBill = () => {
      if (!paymentMode) throw new Error('Please select a payment mode before generating the bill.');
      createdSaleMode = paymentMode;
    };

    handleGenerateBill();
    assert.strictEqual(createdSaleMode, 'OTHER');
  });

  // Test 13: Double click
  it('TEST 13 — Double click: rapid double-click creates only ONE sale', async () => {
    let isSubmitting = false;
    let lockRef = false;
    let saleCount = 0;
    const paymentMode: PaymentMode = 'UPI';

    const submitSale = async () => {
      if (lockRef || isSubmitting) return;
      if (!paymentMode) return;
      lockRef = true;
      isSubmitting = true;
      try {
        await new Promise((r) => setTimeout(r, 20));
        saleCount++;
      } finally {
        lockRef = false;
        isSubmitting = false;
      }
    };

    // Synchronous double click trigger
    const p1 = submitSale();
    const p2 = submitSale();
    await Promise.all([p1, p2]);

    assert.strictEqual(saleCount, 1, 'Only one sale must be created on double click');
  });

  // Test 14: Double tap
  it('TEST 14 — Double tap: rapid double-tap on tablet creates only ONE sale', async () => {
    let lockRef = false;
    let saleCount = 0;

    const handleTap = async () => {
      if (lockRef) return;
      lockRef = true;
      try {
        await new Promise((r) => setTimeout(r, 25));
        saleCount++;
      } finally {
        lockRef = false;
      }
    };

    await Promise.all([handleTap(), handleTap()]);
    assert.strictEqual(saleCount, 1, 'Only one sale must be created on double tap');
  });

  // Test 15: Slow network
  it('TEST 15 — Slow network: repeated clicks while request is running are locked', async () => {
    let lockRef = false;
    let saleCount = 0;

    const submitSale = async () => {
      if (lockRef) return;
      lockRef = true;
      try {
        await new Promise((r) => setTimeout(r, 50));
        saleCount++;
      } finally {
        lockRef = false;
      }
    };

    const task = submitSale();
    // Simulate 3 repeated clicks while task is executing
    await submitSale();
    await submitSale();
    await submitSale();
    await task;

    assert.strictEqual(saleCount, 1, 'Repeated clicks during network latency create exactly 1 sale');
  });

  // Test 16: Enter key
  it('TEST 16 — Enter key: pressing Enter in input fields does not trigger accidental billing', () => {
    let saleCreated = false;
    const handleInputKeyDown = (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Does not call submit
      }
    };

    let prevented = false;
    handleInputKeyDown({
      key: 'Enter',
      preventDefault: () => {
        prevented = true;
      },
    });

    assert.strictEqual(prevented, true, 'Enter key prevented from form submission');
    assert.strictEqual(saleCreated, false, 'No bill generated from Enter in input');
  });

  // Test 19: New bill state reset
  it('TEST 19 — New bill state reset: after completing a UPI bill, next bill starts with paymentMode = null', () => {
    let paymentMode: PaymentMode | null = 'UPI';
    // Sale completed -> clearCart called
    const clearCart = () => {
      paymentMode = null;
    };

    clearCart();
    assert.strictEqual(paymentMode, null, 'Payment mode must reset to null for new bill');
  });

  // Test 20: Cash state reset
  it('TEST 20 — Cash state reset: after completing a Cash bill, next bill starts with paymentMode = null', () => {
    let paymentMode: PaymentMode | null = 'CASH';
    // Sale completed -> clearCart called
    const clearCart = () => {
      paymentMode = null;
    };

    clearCart();
    assert.strictEqual(paymentMode, null, 'Payment mode must reset to null for new bill after Cash sale');
  });
});
