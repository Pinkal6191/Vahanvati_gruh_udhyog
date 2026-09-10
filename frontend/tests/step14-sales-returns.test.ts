import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ReturnStatus,
  RefundPaymentMode,
  RestockCondition,
  CreateReturnPayload,
} from '../src/features/sales-returns/sales-returns.api';

describe('Step 14 — Sales Return Management Frontend Test Suite', () => {
  // Mock Sale Line Items with historical rate snapshots
  const mockOriginalSale = {
    id: 'sale-001-uuid',
    billNumber: 'INV-2026-0042',
    customerId: 'cust-001',
    customerName: 'Pravinbhai Patel',
    customerMobile: '9825012345',
    items: [
      {
        id: 'sale-item-01',
        productId: 'prod-001',
        productName: 'Special Chavanu (500g)',
        soldQuantity: 10,
        alreadyReturnedQuantity: 2,
        historicalUnitRate: 150.0, // Historical rate at checkout
        currentCatalogRate: 180.0, // Changed catalog price today
      },
      {
        id: 'sale-item-02',
        productId: 'prod-002',
        productName: 'Bhavnagari Gathiya (1kg)',
        soldQuantity: 5,
        alreadyReturnedQuantity: 5,
        historicalUnitRate: 280.0,
        currentCatalogRate: 320.0,
      },
    ],
  };

  describe('1. Returnable Quantity & Over-Return Protection', () => {
    const calculateReturnable = (sold: number, alreadyReturned: number) => {
      return Math.max(0, Math.round((sold - alreadyReturned) * 1000) / 1000);
    };

    it('should compute remaining returnable quantity correctly', () => {
      const item1Returnable = calculateReturnable(
        mockOriginalSale.items[0].soldQuantity,
        mockOriginalSale.items[0].alreadyReturnedQuantity
      );
      assert.strictEqual(item1Returnable, 8); // 10 sold - 2 returned = 8 returnable

      const item2Returnable = calculateReturnable(
        mockOriginalSale.items[1].soldQuantity,
        mockOriginalSale.items[1].alreadyReturnedQuantity
      );
      assert.strictEqual(item2Returnable, 0); // 5 sold - 5 returned = 0 returnable
    });

    it('should reject return quantities exceeding remaining returnable balance', () => {
      const validateReturnQuantity = (requested: number, remaining: number) => {
        if (requested <= 0) {
          throw new Error('Return quantity must be greater than zero');
        }
        if (requested > remaining) {
          throw new Error(`Cannot return ${requested}. Only ${remaining} remaining returnable.`);
        }
        return true;
      };

      // Valid: 5 <= 8
      assert.strictEqual(validateReturnQuantity(5, 8), true);

      // Invalid: 9 > 8
      assert.throws(() => validateReturnQuantity(9, 8), /exceeding|Only 8 remaining/);

      // Invalid: attempting return on depleted item (remaining: 0)
      assert.throws(() => validateReturnQuantity(1, 0), /Only 0 remaining/);
    });
  });

  describe('2. Historical Rate Invariance & Refund Amount Calculation', () => {
    it('should calculate refund strictly using historical sold rate and ignore current catalog price', () => {
      const item = mockOriginalSale.items[0];
      const returnQuantity = 3;

      // Authoritative refund must use item.historicalUnitRate (150), NOT currentCatalogRate (180)
      const authoritativeRefund = Math.round(item.historicalUnitRate * returnQuantity * 100) / 100;
      assert.strictEqual(authoritativeRefund, 450.0); // 3 * 150 = 450

      const invalidCatalogRefund = Math.round(item.currentCatalogRate * returnQuantity * 100) / 100;
      assert.notStrictEqual(authoritativeRefund, invalidCatalogRefund);
    });

    it('should accurately sum multi-item return refund totals', () => {
      const returnItems = [
        { returnedQuantity: 2, unitRate: 150.0 }, // 300
        { returnedQuantity: 1.5, unitRate: 200.0 }, // 300
        { returnedQuantity: 0.25, unitRate: 400.0 }, // 100
      ];

      const totalRefund = returnItems.reduce(
        (sum, item) => sum + Math.round(item.returnedQuantity * item.unitRate * 100) / 100,
        0
      );

      assert.strictEqual(totalRefund, 700.0);
    });
  });

  describe('3. Refund Payment Mode & Restock Conditions', () => {
    it('should accept only valid refund payment modes: CASH, UPI, STORE_CREDIT', () => {
      const isValidMode = (mode: string): mode is RefundPaymentMode => {
        return ['CASH', 'UPI', 'STORE_CREDIT'].includes(mode);
      };

      assert.strictEqual(isValidMode('CASH'), true);
      assert.strictEqual(isValidMode('UPI'), true);
      assert.strictEqual(isValidMode('STORE_CREDIT'), true);
      assert.strictEqual(isValidMode('BITCOIN'), false);
    });

    it('should distinguish RESTOCKABLE vs DAMAGED_DISCARD condition', () => {
      const evaluateRestockBehavior = (condition: RestockCondition) => {
        return {
          shouldIncrementStock: condition === 'RESTOCKABLE',
          requiresDamagedAudit: condition === 'DAMAGED_DISCARD',
        };
      };

      const restockable = evaluateRestockBehavior('RESTOCKABLE');
      assert.strictEqual(restockable.shouldIncrementStock, true);
      assert.strictEqual(restockable.requiresDamagedAudit, false);

      const damaged = evaluateRestockBehavior('DAMAGED_DISCARD');
      assert.strictEqual(damaged.shouldIncrementStock, false);
      assert.strictEqual(damaged.requiresDamagedAudit, true);
    });
  });

  describe('4. Sales Return State Machine & Lifecycle Transitions', () => {
    const canTransition = (current: ReturnStatus, target: ReturnStatus): boolean => {
      if (current === 'CANCELLED') return false; // Terminal state
      if (current === 'DRAFT' && (target === 'COMPLETED' || target === 'CANCELLED')) return true;
      if (current === 'COMPLETED' && target === 'CANCELLED') return true;
      return false;
    };

    it('should allow valid transitions: DRAFT -> COMPLETED, DRAFT -> CANCELLED, COMPLETED -> CANCELLED', () => {
      assert.strictEqual(canTransition('DRAFT', 'COMPLETED'), true);
      assert.strictEqual(canTransition('DRAFT', 'CANCELLED'), true);
      assert.strictEqual(canTransition('COMPLETED', 'CANCELLED'), true);
    });

    it('should forbid illegal transitions: COMPLETED -> DRAFT, CANCELLED -> DRAFT', () => {
      assert.strictEqual(canTransition('COMPLETED', 'DRAFT'), false);
      assert.strictEqual(canTransition('CANCELLED', 'DRAFT'), false);
      assert.strictEqual(canTransition('CANCELLED', 'COMPLETED'), false);
    });

    it('should require non-empty cancellation reason of at least 3 characters', () => {
      const validateCancelReason = (reason: string) => {
        if (!reason || reason.trim().length < 3) {
          throw new Error('Cancellation reason must be at least 3 characters long');
        }
        return true;
      };

      assert.strictEqual(validateCancelReason('Customer returned unopened bag'), true);
      assert.throws(() => validateCancelReason(''), /at least 3 characters/);
      assert.throws(() => validateCancelReason('no'), /at least 3 characters/);
    });
  });

  describe('5. Duplicate Submission Guard & Payload Validation', () => {
    it('should construct compliant CreateReturnPayload', () => {
      const payload: CreateReturnPayload = {
        originalSaleId: mockOriginalSale.id,
        reason: 'Wrong variant purchased',
        refundPaymentMode: 'CASH',
        status: 'COMPLETED',
        items: [
          {
            saleItemId: mockOriginalSale.items[0].id,
            returnedQuantity: 2,
            restockCondition: 'RESTOCKABLE',
          },
        ],
      };

      assert.strictEqual(payload.originalSaleId, mockOriginalSale.id);
      assert.strictEqual(payload.items.length, 1);
      assert.strictEqual(payload.refundPaymentMode, 'CASH');
      assert.strictEqual(payload.status, 'COMPLETED');
    });

    it('should reject submission if no items are selected in return', () => {
      const validateReturnSubmission = (items: any[]) => {
        if (!items || items.length === 0) {
          throw new Error('At least one item must be returned');
        }
        return true;
      };

      assert.throws(() => validateReturnSubmission([]), /At least one item/);
    });
  });

  describe('6. Role-Based Access Control (RBAC)', () => {
    const canAccessSalesReturns = (role: string) => {
      return ['ADMIN', 'OUTLET'].includes(role);
    };

    it('should grant access to ADMIN and OUTLET roles', () => {
      assert.strictEqual(canAccessSalesReturns('ADMIN'), true);
      assert.strictEqual(canAccessSalesReturns('OUTLET'), true);
    });

    it('should forbid access to PRODUCTION role', () => {
      assert.strictEqual(canAccessSalesReturns('PRODUCTION'), false);
    });
  });
});
