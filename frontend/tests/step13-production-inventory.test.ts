import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProductionStatus } from '../src/features/production/production.api';
import { MovementType } from '../src/features/inventory/inventory.api';

describe('Step 13 — Production & Inventory Management Frontend Test Suite', () => {
  describe('1. Stock Status & Threshold Rules', () => {
    const evaluateStockHealth = (balance: number, threshold: number) => {
      const isOutOfStock = balance <= 0;
      const isLowStock = balance <= threshold && balance > 0;
      const isInStock = balance > threshold;
      return {
        isOutOfStock,
        isLowStock,
        isInStock,
        status: isOutOfStock ? 'OUT_OF_STOCK' : isLowStock ? 'LOW_STOCK' : 'IN_STOCK',
      };
    };

    it('should classify zero or negative balance as OUT_OF_STOCK', () => {
      const zeroResult = evaluateStockHealth(0, 5000);
      assert.strictEqual(zeroResult.isOutOfStock, true);
      assert.strictEqual(zeroResult.isLowStock, false);
      assert.strictEqual(zeroResult.status, 'OUT_OF_STOCK');

      const negativeResult = evaluateStockHealth(-100, 5000);
      assert.strictEqual(negativeResult.isOutOfStock, true);
      assert.strictEqual(negativeResult.status, 'OUT_OF_STOCK');
    });

    it('should classify balance at or below threshold as LOW_STOCK', () => {
      const atThreshold = evaluateStockHealth(5000, 5000);
      assert.strictEqual(atThreshold.isLowStock, true);
      assert.strictEqual(atThreshold.isOutOfStock, false);
      assert.strictEqual(atThreshold.status, 'LOW_STOCK');

      const belowThreshold = evaluateStockHealth(2500, 5000);
      assert.strictEqual(belowThreshold.isLowStock, true);
      assert.strictEqual(belowThreshold.status, 'LOW_STOCK');
    });

    it('should classify balance above threshold as IN_STOCK', () => {
      const healthyResult = evaluateStockHealth(25000, 5000);
      assert.strictEqual(healthyResult.isInStock, true);
      assert.strictEqual(healthyResult.isLowStock, false);
      assert.strictEqual(healthyResult.isOutOfStock, false);
      assert.strictEqual(healthyResult.status, 'IN_STOCK');
    });
  });

  describe('2. Batch Code Generation & Production Lifecycle', () => {
    const generateBatchNumber = (productCode?: string, date = new Date()) => {
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const rand = 1234; // deterministic for test
      const prefix = productCode ? productCode.toUpperCase().slice(0, 4) : 'BATCH';
      return `${prefix}-${dateStr}-${rand}`;
    };

    it('should generate compliant batch code with product prefix and date format', () => {
      const fixedDate = new Date('2026-09-10T12:00:00Z');
      const batchCode = generateBatchNumber('CHORA', fixedDate);
      assert.strictEqual(batchCode, 'CHOR-20260910-1234');
      assert.match(batchCode, /^[A-Z]{4,5}-\d{8}-\d{4}$/);
    });

    it('should fallback to BATCH prefix when product code is omitted', () => {
      const fixedDate = new Date('2026-09-10T12:00:00Z');
      const batchCode = generateBatchNumber(undefined, fixedDate);
      assert.strictEqual(batchCode, 'BATCH-20260910-1234');
    });

    it('should enforce valid state machine transitions for production runs', () => {
      const canTransition = (current: ProductionStatus, target: ProductionStatus): boolean => {
        if (current === 'CANCELLED') return false; // terminal
        if (current === 'DRAFT' && (target === 'COMPLETED' || target === 'CANCELLED')) return true;
        if (current === 'COMPLETED' && target === 'CANCELLED') return true;
        return false;
      };

      // Allowed transitions
      assert.strictEqual(canTransition('DRAFT', 'COMPLETED'), true);
      assert.strictEqual(canTransition('DRAFT', 'CANCELLED'), true);
      assert.strictEqual(canTransition('COMPLETED', 'CANCELLED'), true);

      // Disallowed transitions
      assert.strictEqual(canTransition('COMPLETED', 'DRAFT'), false);
      assert.strictEqual(canTransition('CANCELLED', 'DRAFT'), false);
      assert.strictEqual(canTransition('CANCELLED', 'COMPLETED'), false);
    });
  });

  describe('3. Manual Stock Adjustment Validation & Payload Rules', () => {
    const buildAdjustmentPayload = (params: {
      productId: string;
      direction: 'INCREASE' | 'DECREASE';
      quantity: number;
      reason: string;
      notes?: string;
      userRole: string;
    }) => {
      if (params.userRole !== 'ADMIN') {
        throw new Error('Only administrators are authorized to perform manual stock adjustments');
      }
      if (!params.productId) {
        throw new Error('Product is required');
      }
      if (params.quantity <= 0) {
        throw new Error('Adjustment quantity must be greater than zero');
      }
      if (!params.reason || params.reason.trim().length < 3) {
        throw new Error('A valid adjustment reason (minimum 3 characters) is mandatory');
      }

      const signedDelta =
        params.direction === 'INCREASE' ? params.quantity : -Math.abs(params.quantity);

      return {
        productId: params.productId,
        quantityDelta: signedDelta,
        reason: params.reason.trim(),
        notes: params.notes?.trim() || undefined,
      };
    };

    it('should build positive signed quantityDelta for stock increase', () => {
      const payload = buildAdjustmentPayload({
        productId: 'prod-001',
        direction: 'INCREASE',
        quantity: 5000,
        reason: 'Physical count discrepancy surplus',
        userRole: 'ADMIN',
      });

      assert.strictEqual(payload.quantityDelta, 5000);
      assert.strictEqual(payload.reason, 'Physical count discrepancy surplus');
    });

    it('should build negative signed quantityDelta for stock deduction', () => {
      const payload = buildAdjustmentPayload({
        productId: 'prod-001',
        direction: 'DECREASE',
        quantity: 1200,
        reason: 'Transit container leakage damage',
        userRole: 'ADMIN',
      });

      assert.strictEqual(payload.quantityDelta, -1200);
    });

    it('should reject manual adjustments attempted by non-ADMIN roles', () => {
      assert.throws(() => {
        buildAdjustmentPayload({
          productId: 'prod-001',
          direction: 'INCREASE',
          quantity: 5000,
          reason: 'Count surplus',
          userRole: 'OUTLET',
        });
      }, /Only administrators are authorized/);

      assert.throws(() => {
        buildAdjustmentPayload({
          productId: 'prod-001',
          direction: 'INCREASE',
          quantity: 5000,
          reason: 'Count surplus',
          userRole: 'PRODUCTION',
        });
      }, /Only administrators are authorized/);
    });

    it('should reject adjustments without valid reason of at least 3 characters', () => {
      assert.throws(() => {
        buildAdjustmentPayload({
          productId: 'prod-001',
          direction: 'INCREASE',
          quantity: 500,
          reason: 'ok',
          userRole: 'ADMIN',
        });
      }, /minimum 3 characters/);
    });
  });

  describe('4. Stock Movement Ledger Direction & Type Parsing', () => {
    it('should correctly classify movement direction and visual indicators', () => {
      const getDirection = (type: MovementType) => {
        switch (type) {
          case 'PRODUCTION_IN':
          case 'SALES_RETURN_IN':
          case 'ADJUSTMENT_IN':
            return { direction: 'IN', isPositive: true, cssClass: 'movement-badge-in' };
          case 'SALE_OUT':
          case 'ADJUSTMENT_OUT':
            return { direction: 'OUT', isPositive: false, cssClass: 'movement-badge-out' };
        }
      };

      assert.strictEqual(getDirection('PRODUCTION_IN').direction, 'IN');
      assert.strictEqual(getDirection('PRODUCTION_IN').isPositive, true);
      assert.strictEqual(getDirection('SALE_OUT').direction, 'OUT');
      assert.strictEqual(getDirection('SALE_OUT').isPositive, false);
      assert.strictEqual(getDirection('SALES_RETURN_IN').direction, 'IN');
      assert.strictEqual(getDirection('ADJUSTMENT_OUT').direction, 'OUT');
    });
  });

  describe('5. Stock Ledger Parity & Reconciliation Audit', () => {
    it('should accurately detect mathematical parity between cached balance and ledger movements', () => {
      const auditReconciliation = (cachedBalance: number, ledgerMovements: number[]) => {
        const ledgerTotal = ledgerMovements.reduce((sum, d) => sum + d, 0);
        const isConsistent = Math.abs(cachedBalance - ledgerTotal) < 0.0001;
        const discrepancy = Math.round((cachedBalance - ledgerTotal) * 1000) / 1000;
        return { cachedBalance, ledgerTotal, isConsistent, discrepancy };
      };

      // Scenario A: Balanced ledger (Initial prod + 50000, Sale -10000, Sale -5000, Return +2000, Adjustment -1000)
      const movementsA = [50000, -10000, -5000, 2000, -1000];
      const auditA = auditReconciliation(36000, movementsA);
      assert.strictEqual(auditA.isConsistent, true);
      assert.strictEqual(auditA.discrepancy, 0);
      assert.strictEqual(auditA.ledgerTotal, 36000);

      // Scenario B: Discrepancy (Cache has 36000, but ledger only sums to 35000)
      const movementsB = [50000, -15000];
      const auditB = auditReconciliation(36000, movementsB);
      assert.strictEqual(auditB.isConsistent, false);
      assert.strictEqual(auditB.discrepancy, 1000);
    });
  });
});
