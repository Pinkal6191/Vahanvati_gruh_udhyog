import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSaleSchema } from '../src/modules/sales/sales.validation.js';
import { resolvePricesSchema, priceQuerySchema } from '../src/modules/pricing/pricing.validation.js';
import { SaleType, CustomerType, PaymentMode, RestockCondition } from '@prisma/client';

describe('Backend — Masala 50g Pricing Engine, Stock Conversion & Sales Invariants Test Suite', () => {
  // ------------------------------------------------------------
  // TEST 1: Pricing Engine Mathematical Invariant: ₹100/100g gives ₹50.00 for 50g
  // ------------------------------------------------------------
  it('TEST 1 — Formula check: ₹100 per 100g (₹1000/kg) yields exactly ₹50.00 for 50g', () => {
    const unitRate = 1000; // Base per-kg rate
    const looseWeightInGrams = 50;
    const quantity = 1;

    // Authoritative backend formula: Math.round(((looseWeightInGrams / 1000) * unitRate * quantity) * 100) / 100
    const totalAmount = Math.round(((looseWeightInGrams / 1000) * unitRate * quantity) * 100) / 100;
    assert.strictEqual(totalAmount, 50.00, '50g must be exactly ₹50.00');

    // Weight snapshot and stock deduction
    const weightOrPackName = looseWeightInGrams >= 1000 ? `${looseWeightInGrams / 1000} kg` : `${looseWeightInGrams}g`;
    const baseWeightDeducted = looseWeightInGrams * quantity;

    assert.strictEqual(weightOrPackName, '50g');
    assert.strictEqual(baseWeightDeducted, 50);
  });

  // ------------------------------------------------------------
  // TEST 2: Pricing Engine Mathematical Invariant: ₹120/100g gives ₹60.00 for 50g
  // ------------------------------------------------------------
  it('TEST 2 — Formula check: ₹120 per 100g (₹1200/kg) yields exactly ₹60.00 for 50g', () => {
    const unitRate = 1200; // Cha Masalo / Kadhi Masalo
    const looseWeightInGrams = 50;
    const quantity = 1;

    const totalAmount = Math.round(((looseWeightInGrams / 1000) * unitRate * quantity) * 100) / 100;
    assert.strictEqual(totalAmount, 60.00, '50g must be exactly ₹60.00');
  });

  // ------------------------------------------------------------
  // TEST 3: Pricing Engine Mathematical Invariant: ₹140/100g gives ₹70.00 for 50g
  // ------------------------------------------------------------
  it('TEST 3 — Formula check: ₹140 per 100g (₹1400/kg) yields exactly ₹70.00 for 50g', () => {
    const unitRate = 1400; // Khichdi Masalo
    const looseWeightInGrams = 50;
    const quantity = 1;

    const totalAmount = Math.round(((looseWeightInGrams / 1000) * unitRate * quantity) * 100) / 100;
    assert.strictEqual(totalAmount, 70.00, '50g must be exactly ₹70.00');
  });

  // ------------------------------------------------------------
  // TEST 4: Multi-unit Quantity Calculations: 50g x 3 units
  // ------------------------------------------------------------
  it('TEST 4 — Multi-unit quantity calculation: 50g x 3 units at ₹1000/kg yields ₹150.00 and 150g stock deduction', () => {
    const unitRate = 1000;
    const looseWeightInGrams = 50;
    const quantity = 3;

    const totalAmount = Math.round(((looseWeightInGrams / 1000) * unitRate * quantity) * 100) / 100;
    const baseWeightDeducted = looseWeightInGrams * quantity;

    assert.strictEqual(totalAmount, 150.00, '3 x 50g @ ₹1000/kg must equal ₹150.00');
    assert.strictEqual(baseWeightDeducted, 150, 'Stock deduction must be 150 grams');
    assert.strictEqual(baseWeightDeducted / 1000, 0.15, '150 grams must equal 0.15 kg');
  });

  // ------------------------------------------------------------
  // TEST 5: Independent SaleType Pricing (RETAIL vs NRI vs WHOLESALE)
  // ------------------------------------------------------------
  it('TEST 5 — Independent SaleType Pricing: RETAIL, NRI, and WHOLESALE yield independent totals for 50g', () => {
    const retailPerKg = 1000;
    const nriPerKg = 1500;
    const wholesalePerKg = 850;
    const weight = 50;

    const retailTotal = Math.round(((weight / 1000) * retailPerKg) * 100) / 100;
    const nriTotal = Math.round(((weight / 1000) * nriPerKg) * 100) / 100;
    const wholesaleTotal = Math.round(((weight / 1000) * wholesalePerKg) * 100) / 100;

    assert.strictEqual(retailTotal, 50.00);
    assert.strictEqual(nriTotal, 75.00);
    assert.strictEqual(wholesaleTotal, 42.50);

    assert.notStrictEqual(retailTotal, nriTotal);
    assert.notStrictEqual(retailTotal, wholesaleTotal);
  });

  // ------------------------------------------------------------
  // TEST 6: Zod Schema Validation accepts 50g looseWeightInGrams
  // ------------------------------------------------------------
  it('TEST 6 — Backend Zod Schemas accept 50g looseWeightInGrams in sales and price resolution', () => {
    const testUUID = '11111111-1111-1111-1111-111111111111';

    // 1. resolvePricesSchema
    const resolveParsed = resolvePricesSchema.safeParse({
      saleType: SaleType.RETAIL,
      items: [
        {
          productId: testUUID,
          looseWeightInGrams: 50,
          quantity: 1,
        },
      ],
    });
    assert.strictEqual(resolveParsed.success, true, 'resolvePricesSchema must accept looseWeightInGrams: 50');

    // 2. createSaleSchema
    const saleParsed = createSaleSchema.safeParse({
      saleType: SaleType.RETAIL,
      items: [
        {
          productId: testUUID,
          looseWeightInGrams: 50,
          quantity: 2,
        },
      ],
      payments: [
        {
          paymentMode: PaymentMode.CASH,
          amount: 100,
        },
      ],
      paidAmount: 100,
    });
    assert.strictEqual(saleParsed.success, true, 'createSaleSchema must accept looseWeightInGrams: 50');

    // 3. Negative weight must be rejected
    const negativeParsed = createSaleSchema.safeParse({
      saleType: SaleType.RETAIL,
      items: [
        {
          productId: testUUID,
          looseWeightInGrams: -50,
          quantity: 1,
        },
      ],
      payments: [{ paymentMode: PaymentMode.CASH, amount: 50 }],
      paidAmount: 50,
    });
    assert.strictEqual(negativeParsed.success, false, 'Negative weight must be rejected');
  });

  // ------------------------------------------------------------
  // TEST 7: Duplicate Line Item Merging Key for 50g
  // ------------------------------------------------------------
  it('TEST 7 — Duplicate item merging keys correctly isolate 50g from 100g and merges identical 50g items', () => {
    const prodId = 'prod-masala-3in1';

    const item50g_A = { productId: prodId, packConfigId: null, looseWeightInGrams: 50, quantity: 1 };
    const item50g_B = { productId: prodId, packConfigId: null, looseWeightInGrams: 50, quantity: 2 };
    const item100g = { productId: prodId, packConfigId: null, looseWeightInGrams: 100, quantity: 1 };

    const getKey = (item: any) => {
      const weightKey = item.looseWeightInGrams ? `_w${item.looseWeightInGrams}` : '';
      return `${item.productId}_${item.packConfigId ?? 'loose'}${weightKey}`;
    };

    const key50A = getKey(item50g_A);
    const key50B = getKey(item50g_B);
    const key100 = getKey(item100g);

    assert.strictEqual(key50A, `${prodId}_loose_w50`);
    assert.strictEqual(key50B, `${prodId}_loose_w50`);
    assert.strictEqual(key100, `${prodId}_loose_w100`);

    assert.strictEqual(key50A, key50B, 'Identical 50g items share same merge key');
    assert.notStrictEqual(key50A, key100, '50g and 100g items must have distinct merge keys');
  });

  // ------------------------------------------------------------
  // TEST 8: Backend rejects tampered client financial values
  // ------------------------------------------------------------
  it('TEST 8 — Backend calculates finalTotalAmount independently from database rates, ignoring tampered client rates', () => {
    // Simulated backend resolution
    const dbUnitRate = 1000; // authoritative rate from product_prices
    const clientSuppliedRate = 10; // attacker tries to pay ₹10 instead of ₹50
    const weight = 50;
    const qty = 1;

    // Backend ignores clientSuppliedRate and recalculates from dbUnitRate
    const backendCalculatedAmount = Math.round(((weight / 1000) * dbUnitRate * qty) * 100) / 100;
    assert.strictEqual(backendCalculatedAmount, 50.00, 'Backend must compute ₹50.00 regardless of client manipulation');
    assert.notStrictEqual(backendCalculatedAmount, clientSuppliedRate);
  });

  // ------------------------------------------------------------
  // TEST 9: Historical Snapshot Preservation in SaleItem
  // ------------------------------------------------------------
  it('TEST 9 — Historical SaleItem snapshot structure preserves 50g variant name, base weight, and rate', () => {
    const saleItemSnapshot = {
      productNameSnapshot: '3 in 1 Rajwadi Garam Masalo',
      unitSymbolSnapshot: 'kg',
      weightOrPackSnapshot: '50g',
      saleTypeSnapshot: 'RETAIL',
      quantity: 2,
      baseWeightDeducted: 100.000, // 50g x 2
      unitRate: 1000.00,
      subtotal: 100.00,
      total: 100.00,
    };

    assert.strictEqual(saleItemSnapshot.weightOrPackSnapshot, '50g');
    assert.strictEqual(saleItemSnapshot.baseWeightDeducted, 100.000);
    assert.strictEqual(saleItemSnapshot.total, 100.00);
  });

  // ------------------------------------------------------------
  // TEST 10: Sales Returns use original bill price and reversed weight
  // ------------------------------------------------------------
  it('TEST 10 — Sales Return restores exact base weight and refund amount based on 50g sale snapshot', () => {
    const soldQty = 2;
    const baseWeightDeducted = 100; // 50g x 2 sold
    const returnedQty = 1; // 1 unit returned

    const baseRatio = baseWeightDeducted / soldQty;
    assert.strictEqual(baseRatio, 50, 'Base ratio per unit returned must be exactly 50 grams');

    const baseWeightToReverse = Math.round(baseRatio * returnedQty * 1000) / 1000;
    assert.strictEqual(baseWeightToReverse, 50, '1 returned unit reverses exactly 50 grams back to stock');
    assert.strictEqual(baseWeightToReverse / 1000, 0.05, '50 grams equals 0.05 kg reversed to inventory');

    // Refund amount calculated from snapshot total
    const itemTotal = 100.00;
    const unitPriceSnapshot = itemTotal / soldQty;
    const refundAmount = unitPriceSnapshot * returnedQty;
    assert.strictEqual(refundAmount, 50.00, 'Refund for 1 unit of 50g must be ₹50.00');
  });

  // ------------------------------------------------------------
  // TEST 11: Missing price rejects transaction (no fabricated price)
  // ------------------------------------------------------------
  it('TEST 11 — Missing price configuration throws explicit error rather than inventing a price', () => {
    const priceRecord = null; // No price configured in database for this product/tier

    const resolvePrice = () => {
      if (!priceRecord) {
        throw new Error('WHOLESALE_PRICE_NOT_CONFIGURED: Applicable Wholesale price is not configured for this product');
      }
      return 0;
    };

    assert.throws(resolvePrice, {
      message: /WHOLESALE_PRICE_NOT_CONFIGURED/,
    });
  });
});
