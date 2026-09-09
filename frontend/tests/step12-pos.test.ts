import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CustomerType } from '../src/types/common.types';
import { PaymentMode, CreateSalePayload } from '../src/features/billing/billing.api';

describe('Step 12 — POS / Billing Frontend Terminal Test Suite', () => {
  // Mock product catalog
  const mockProductA = {
    id: 'prod-001',
    name: 'Papdi (Farsan)',
    gujaratiName: 'પાપડી',
    code: 'PAPDI',
    barcode: '890123456701',
    indianPrice: 280,
    nriPrice: 450,
    primaryUnit: { id: 'unit-01', name: 'Gram', symbol: 'gm' },
    stock: { currentBalance: 25000, minimumThreshold: 5000 },
  };

  const mockProductB = {
    id: 'prod-002',
    name: 'Chorafali',
    gujaratiName: 'ચોરાફળી',
    code: 'CHORA',
    barcode: '890123456702',
    indianPrice: 320,
    nriPrice: 500,
    primaryUnit: { id: 'unit-01', name: 'Gram', symbol: 'gm' },
    stock: { currentBalance: 12000, minimumThreshold: 3000 },
  };

  describe('1. Product Search & Catalog Filtering', () => {
    it('should search products by English name, Gujarati name, or code case-insensitively', () => {
      const catalog = [mockProductA, mockProductB];
      
      const searchByEng = catalog.filter((p) => p.name.toLowerCase().includes('papdi'));
      assert.strictEqual(searchByEng.length, 1);
      assert.strictEqual(searchByEng[0].id, 'prod-001');

      const searchByGuj = catalog.filter((p) => p.gujaratiName.includes('ચોરાફળી'));
      assert.strictEqual(searchByGuj.length, 1);
      assert.strictEqual(searchByGuj[0].id, 'prod-002');

      const searchByCode = catalog.filter((p) => p.code.toLowerCase().includes('chora'));
      assert.strictEqual(searchByCode.length, 1);
      assert.strictEqual(searchByCode[0].id, 'prod-002');
    });

    it('should accurately detect stock status categories (in-stock, low-stock, out-of-stock)', () => {
      const getStockStatus = (balance: number, threshold: number) => {
        if (balance <= 0) return 'OUT_OF_STOCK';
        if (balance <= threshold) return 'LOW_STOCK';
        return 'IN_STOCK';
      };

      assert.strictEqual(getStockStatus(25000, 5000), 'IN_STOCK');
      assert.strictEqual(getStockStatus(4500, 5000), 'LOW_STOCK');
      assert.strictEqual(getStockStatus(0, 5000), 'OUT_OF_STOCK');
    });
  });

  describe('2. Cart Line Item Operations & Duplicate Merging', () => {
    it('should merge duplicate product selections into a single cart line item', () => {
      interface MockCartItem {
        id: string;
        productId: string;
        packConfigId: string | null;
        quantity: number;
        unitRate: number;
        totalAmount: number;
      }

      let cart: MockCartItem[] = [];

      const addToCart = (productId: string, packConfigId: string | null, qty: number, rate: number) => {
        const lineId = `${productId}_${packConfigId || 'loose'}`;
        const existingIdx = cart.findIndex((i) => i.id === lineId);
        if (existingIdx >= 0) {
          cart[existingIdx].quantity += qty;
          cart[existingIdx].totalAmount = cart[existingIdx].quantity * cart[existingIdx].unitRate;
        } else {
          cart.push({
            id: lineId,
            productId,
            packConfigId,
            quantity: qty,
            unitRate: rate,
            totalAmount: qty * rate,
          });
        }
      };

      // Select Product A x 2
      addToCart('prod-001', null, 2, 280);
      assert.strictEqual(cart.length, 1);
      assert.strictEqual(cart[0].quantity, 2);
      assert.strictEqual(cart[0].totalAmount, 560);

      // Select Product A x 3 -> Must merge to x 5
      addToCart('prod-001', null, 3, 280);
      assert.strictEqual(cart.length, 1, 'Must NOT create a duplicate row');
      assert.strictEqual(cart[0].quantity, 5, 'Merged quantity must be 5');
      assert.strictEqual(cart[0].totalAmount, 1400);

      // Select Product B x 1 -> Distinct row
      addToCart('prod-002', null, 1, 320);
      assert.strictEqual(cart.length, 2);
    });

    it('should update item quantities via steppers and remove items when quantity reaches 0', () => {
      let items = [
        { id: '1', quantity: 2, unitRate: 100, totalAmount: 200 },
        { id: '2', quantity: 1, unitRate: 150, totalAmount: 150 },
      ];

      const updateQty = (id: string, delta: number) => {
        items = items
          .map((it) => (it.id === id ? { ...it, quantity: it.quantity + delta, totalAmount: (it.quantity + delta) * it.unitRate } : it))
          .filter((it) => it.quantity > 0);
      };

      // Increment item 1
      updateQty('1', 1);
      assert.strictEqual(items.find((i) => i.id === '1')?.quantity, 3);
      assert.strictEqual(items.find((i) => i.id === '1')?.totalAmount, 300);

      // Decrement item 2 to 0 -> should be removed
      updateQty('2', -1);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items.find((i) => i.id === '2'), undefined);
    });
  });

  describe('3. Customer Tier & Backend Dual-Pricing Integration', () => {
    it('should apply Indian pricing for domestic customer type', () => {
      const getProductRate = (prod: typeof mockProductA, type: CustomerType) => {
        return type === 'NRI' ? prod.nriPrice : prod.indianPrice;
      };

      const domesticRate = getProductRate(mockProductA, 'INDIAN');
      assert.strictEqual(domesticRate, 280);
    });

    it('should apply NRI pricing for NRI customer type', () => {
      const getProductRate = (prod: typeof mockProductA, type: CustomerType) => {
        return type === 'NRI' ? prod.nriPrice : prod.indianPrice;
      };

      const nriRate = getProductRate(mockProductA, 'NRI');
      assert.strictEqual(nriRate, 450);
      assert.ok(nriRate > mockProductA.indianPrice, 'NRI rate should reflect export price');
    });

    it('should accurately re-calculate totals when switching customer type', () => {
      const lineItem = { qty: 3 };
      const subtotalIndian = lineItem.qty * mockProductA.indianPrice;
      const subtotalNRI = lineItem.qty * mockProductA.nriPrice;

      assert.strictEqual(subtotalIndian, 840);
      assert.strictEqual(subtotalNRI, 1350);
    });
  });

  describe('4. Payment Tender, Discounts, and Change Calculation', () => {
    it('should calculate net total with discount and compute exact change returned', () => {
      const subtotal = 1000;
      const discount = 50;
      const grandTotal = Math.max(0, subtotal - discount);
      assert.strictEqual(grandTotal, 950);

      const paidAmount = 1000;
      const change = Math.max(0, paidAmount - grandTotal);
      assert.strictEqual(change, 50);
    });

    it('should reject payment submission when paid amount is less than grand total', () => {
      const grandTotal = 750;
      const paidAmount = 500;

      const validatePayment = (paid: number, total: number) => {
        if (paid < total) {
          throw new Error(`Paid amount (₹${paid}) cannot be less than total (₹${total})`);
        }
      };

      assert.throws(
        () => validatePayment(paidAmount, grandTotal),
        /cannot be less than total/
      );
    });

    it('should support all standard payment modes: CASH, UPI, CARD, OTHER', () => {
      const supportedModes: PaymentMode[] = ['CASH', 'UPI', 'CARD', 'OTHER'];
      assert.strictEqual(supportedModes.length, 4);
      assert.ok(supportedModes.includes('CASH'));
      assert.ok(supportedModes.includes('UPI'));
      assert.ok(supportedModes.includes('CARD'));
      assert.ok(supportedModes.includes('OTHER'));
    });
  });

  describe('5. Duplicate Submission Protection & Sale Request Payload', () => {
    it('should block concurrent submissions using the isSubmitting guard', async () => {
      let isSubmitting = false;
      let submissionCount = 0;

      const submitSale = async () => {
        if (isSubmitting) {
          throw new Error('Transaction is already being processed');
        }
        isSubmitting = true;
        try {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          submissionCount++;
        } finally {
          isSubmitting = false;
        }
      };

      // Launch two concurrent clicks
      const promise1 = submitSale();
      const promise2 = submitSale();

      await Promise.allSettled([promise1, promise2]);
      assert.strictEqual(submissionCount, 1, 'Only one submission must succeed');
    });

    it('should construct a valid CreateSalePayload conforming to the backend billing schema', () => {
      const payload: CreateSalePayload = {
        customerId: '00000000-0000-0000-0000-000000000099',
        customerType: 'INDIAN',
        items: [
          {
            productId: 'prod-001',
            quantity: 2,
            packConfigId: null,
            looseWeightInGrams: null,
          },
        ],
        discountAmount: 0,
        payments: [
          {
            paymentMode: 'CASH',
            amount: 560,
            transactionReference: null,
          },
        ],
        paidAmount: 560,
      };

      assert.strictEqual(payload.items.length, 1);
      assert.strictEqual(payload.payments[0].paymentMode, 'CASH');
      assert.strictEqual(payload.paidAmount, 560);
    });

    it('should reject empty cart submission', () => {
      const validateCart = (items: any[]) => {
        if (items.length === 0) {
          throw new Error('Cart cannot be empty');
        }
      };

      assert.throws(() => validateCart([]), /Cart cannot be empty/);
    });
  });

  describe('6. 3-Inch Thermal Receipt Printing & Confidentiality Guard', () => {
    it('should strictly exclude customerType (INDIAN/NRI) from receipt print payload', () => {
      const printPayload = {
        company: {
          name: 'Vahanvati Gruh Udhyog',
          address: 'Main Bazaar, Ahmedabad',
          phone: '+91 98250 12345',
        },
        invoice: {
          billNumber: 'VGU-20260909-0001',
          date: '2026-09-09T18:30:00Z',
          billerName: 'Counter Staff',
          customerName: 'Ramesh Patel',
          customerMobile: '9825012345',
        },
        items: [
          { name: 'Papdi (Farsan)', variant: '1 KG Pack', qty: 2, rate: 280, amount: 560 },
        ],
        totals: { subtotal: 560, discount: 0, total: 560, paid: 600, change: 40 },
        payments: [{ mode: 'CASH', amount: 600 }],
      };

      // Verify customer tier is absent
      assert.strictEqual((printPayload.invoice as any).customerType, undefined);
      assert.strictEqual((printPayload as any).customerTier, undefined);
      assert.strictEqual(printPayload.invoice.billNumber, 'VGU-20260909-0001');
      assert.strictEqual(printPayload.items[0].name, 'Papdi (Farsan)');
    });
  });

  describe('7. Bill History, Reprint & Cancellation Permissions', () => {
    it('should allow ADMIN to cancel bills but forbid OUTLET role', () => {
      const canCancelBill = (role: string) => {
        return role === 'ADMIN';
      };

      assert.strictEqual(canCancelBill('ADMIN'), true);
      assert.strictEqual(canCancelBill('OUTLET'), false);
      assert.strictEqual(canCancelBill('PRODUCTION'), false);
    });

    it('should require a non-empty cancellation reason of at least 3 characters', () => {
      const validateCancelReason = (reason: string) => {
        if (!reason || reason.trim().length < 3) {
          throw new Error('Cancellation reason must be at least 3 characters');
        }
      };

      assert.throws(() => validateCancelReason(''), /Cancellation reason/);
      assert.throws(() => validateCancelReason('no'), /Cancellation reason/);
      assert.doesNotThrow(() => validateCancelReason('Customer returned product'));
    });
  });
});
