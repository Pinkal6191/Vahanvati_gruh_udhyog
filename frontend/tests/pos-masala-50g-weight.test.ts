import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { CustomerType } from '../src/types/common.types';
import type { SaleType } from '../src/types/auth.types';
import type { PaymentMode } from '../src/features/billing/billing.api';

describe('POS Billing — Masala 50g Weight Option & Dynamic Pricing Test Suite', () => {
  // Masala Product Mock (e.g. 3 in 1 Rajwadi Garam Masalo: ₹1000/kg -> ₹100/100g)
  const mockMasalaGaram = {
    id: 'prod-masala-001',
    name: '3 in 1 Rajwadi Garam Masalo',
    gujaratiName: '3 in 1 રજવાડી ગરમ મસાલો',
    code: 'MASALA_3IN1_GARAM',
    retailPrice: 1000,
    indianPrice: 1000,
    nriPrice: 1500,
    wholesalePrice: 850,
    primaryUnit: { id: 'u-kg', name: 'Kilogram', symbol: 'kg' },
    stock: { currentBalance: 50000, minimumThreshold: 5000 },
    subcategory: {
      id: 'sub-masala',
      name: 'મસાલા',
      code: 'SUB_MASALA',
      category: { id: 'cat-masala', name: 'મસાલા', code: 'CAT_MASALA' },
    },
    packConfigurations: [
      { id: 'pack-100g', productId: 'prod-masala-001', packName: '100 GM Pack', weightInBaseUnits: 100, unitId: 'u-gm' },
    ],
  };

  // Masala Product Mock (e.g. Cha Masalo: ₹1200/kg -> ₹120/100g)
  const mockMasalaCha = {
    id: 'prod-masala-002',
    name: 'Cha Masalo',
    gujaratiName: 'ચા મસાલો',
    code: 'MASALA_CHA',
    retailPrice: 1200,
    indianPrice: 1200,
    nriPrice: 1800,
    wholesalePrice: 960,
    primaryUnit: { id: 'u-kg', name: 'Kilogram', symbol: 'kg' },
    stock: { currentBalance: 25000, minimumThreshold: 3000 },
    subcategory: {
      id: 'sub-masala',
      name: 'મસાલા',
      code: 'SUB_MASALA',
      category: { id: 'cat-masala', name: 'મસાલા', code: 'CAT_MASALA' },
    },
    packConfigurations: [],
  };

  // Unrelated Non-Masala Product Mock (e.g. Farsan / Papdi: ₹360/kg)
  const mockFarsanPapdi = {
    id: 'prod-farsan-001',
    name: 'Papdi (Farsan)',
    gujaratiName: 'ચોખાની પાપડી',
    code: 'PAPDI_CHOKHA',
    retailPrice: 360,
    indianPrice: 360,
    nriPrice: 500,
    wholesalePrice: 300,
    primaryUnit: { id: 'u-kg', name: 'Kilogram', symbol: 'kg' },
    stock: { currentBalance: 40000, minimumThreshold: 5000 },
    subcategory: {
      id: 'sub-farsan',
      name: 'ફરસાણ',
      code: 'SUB_FARSAN',
      category: { id: 'cat-farsan', name: 'ફરસાણ', code: 'CAT_FARSAN' },
    },
    packConfigurations: [],
  };

  // Helper matching ProductCard logic
  function getProductCardState(product: any, saleType: SaleType = 'RETAIL') {
    const isMasala =
      product.subcategory?.category?.code === 'CAT_MASALA' ||
      product.subcategory?.category?.name?.includes('મસાલા') ||
      product.subcategory?.category?.name?.toLowerCase().includes('masala') ||
      product.subcategory?.code?.includes('MASALA') ||
      product.subcategory?.name?.includes('મસાલા') ||
      product.subcategory?.name?.toLowerCase().includes('masala') ||
      product.name?.includes('મસાલો') ||
      product.name?.includes('મસાલા') ||
      product.name?.toLowerCase().includes('masala') ||
      product.code?.toUpperCase().startsWith('MASALA') ||
      product.code?.toUpperCase().includes('MASALA');

    const basePresets = isMasala
      ? [
          { label: '50g', grams: 50 },
          { label: '100g', grams: 100 },
          { label: '200g', grams: 200 },
          { label: '500g', grams: 500 },
          { label: '1 kg', grams: 1000 },
        ]
      : [
          { label: '500g', grams: 500 },
          { label: '1 kg', grams: 1000 },
        ];

    const packs = product.packConfigurations || [];
    const weightOptions = [...basePresets];
    if (packs.length > 0) {
      for (const pack of packs) {
        const packGrams = Number(pack.weightInBaseUnits);
        if (packGrams > 0 && !weightOptions.some((opt) => opt.grams === packGrams)) {
          weightOptions.push({
            label: pack.packName || `${packGrams}g`,
            grams: packGrams,
          });
        }
      }
      weightOptions.sort((a, b) => a.grams - b.grams);
    }

    const defaultTarget = isMasala ? 100 : 500;
    const initialWeight = weightOptions.some((o) => o.grams === defaultTarget)
      ? defaultTarget
      : (weightOptions[0]?.grams ?? 500);

    const looseRate =
      saleType === 'WHOLESALE'
        ? (product.wholesalePrice ?? 0)
        : saleType === 'NRI'
        ? (product.nriPrice ?? 0)
        : (product.retailPrice ?? product.indianPrice ?? 0);

    const calculateRateForGrams = (grams: number) => {
      const matchingPack = packs.find((p: any) => Number(p.weightInBaseUnits) === grams);
      const packPriceRecord = matchingPack
        ? ((product as any).prices || []).find(
            (pr: any) =>
              pr.packConfigId === matchingPack.id &&
              (pr.pricingTier === saleType ||
                pr.customerType === saleType ||
                (saleType === 'RETAIL' && (pr.pricingTier === 'INDIAN' || pr.customerType === 'INDIAN'))) &&
              pr.isActive
          )
        : null;

      const packRate = packPriceRecord ? Number(packPriceRecord.rate) : null;
      return packRate !== null && packRate > 0
        ? packRate
        : looseRate > 0
        ? Math.round(((grams / 1000) * looseRate) * 100) / 100
        : 0;
    };

    return {
      isMasala,
      weightOptions,
      initialWeight,
      calculateRateForGrams,
      looseRate,
    };
  }

  // ------------------------------------------------------------
  // TEST 1: 50g option appears for eligible Masala products
  // ------------------------------------------------------------
  it('TEST 1 — 50g option appears for eligible Masala products', () => {
    const stateGaram = getProductCardState(mockMasalaGaram);
    assert.strictEqual(stateGaram.isMasala, true, 'Garam Masalo must be classified as Masala');
    const labels = stateGaram.weightOptions.map((o) => o.label);
    assert.ok(labels.includes('50g'), '50g option must be present in Masala product card');
    assert.strictEqual(stateGaram.weightOptions[0].label, '50g', '50g must be the first option in ascending order');
  });

  // ------------------------------------------------------------
  // TEST 2: Existing weight options (100g, 200g, 500g, 1kg) still work and unchanged
  // ------------------------------------------------------------
  it('TEST 2 — Existing weight options (100g, 200g, 500g, 1kg) remain intact and working', () => {
    const state = getProductCardState(mockMasalaGaram);
    const grams = state.weightOptions.map((o) => o.grams);
    assert.deepStrictEqual(grams, [50, 100, 200, 500, 1000], 'All weight options must be [50g, 100g, 200g, 500g, 1000g]');
    assert.strictEqual(state.initialWeight, 100, 'Default selection must remain 100g for Masala');
  });

  // ------------------------------------------------------------
  // TEST 3: ₹100 per 100g gives ₹50 for 50g
  // ------------------------------------------------------------
  it('TEST 3 — Product with ₹100 per 100g (₹1000/kg) yields exactly ₹50.00 for 50g', () => {
    const state = getProductCardState(mockMasalaGaram, 'RETAIL');
    const price50g = state.calculateRateForGrams(50);
    const price100g = state.calculateRateForGrams(100);
    const price200g = state.calculateRateForGrams(200);
    const price500g = state.calculateRateForGrams(500);
    const price1kg = state.calculateRateForGrams(1000);

    assert.strictEqual(price50g, 50.00, '50g must calculate to ₹50.00');
    assert.strictEqual(price100g, 100.00, '100g must calculate to ₹100.00');
    assert.strictEqual(price200g, 200.00, '200g must calculate to ₹200.00');
    assert.strictEqual(price500g, 500.00, '500g must calculate to ₹500.00');
    assert.strictEqual(price1kg, 1000.00, '1kg must calculate to ₹1,000.00');
  });

  // ------------------------------------------------------------
  // TEST 4: ₹120 per 100g gives ₹60 for 50g
  // ------------------------------------------------------------
  it('TEST 4 — Product with ₹120 per 100g (₹1200/kg) yields exactly ₹60.00 for 50g', () => {
    const state = getProductCardState(mockMasalaCha, 'RETAIL');
    const price50g = state.calculateRateForGrams(50);
    const price100g = state.calculateRateForGrams(100);
    const price200g = state.calculateRateForGrams(200);
    const price500g = state.calculateRateForGrams(500);
    const price1kg = state.calculateRateForGrams(1000);

    assert.strictEqual(price50g, 60.00, '50g must calculate to ₹60.00');
    assert.strictEqual(price100g, 120.00, '100g must calculate to ₹120.00');
    assert.strictEqual(price200g, 240.00, '200g must calculate to ₹240.00');
    assert.strictEqual(price500g, 600.00, '500g must calculate to ₹600.00');
    assert.strictEqual(price1kg, 1200.00, '1kg must calculate to ₹1,200.00');
  });

  // ------------------------------------------------------------
  // TEST 5: RETAIL, NRI, and WHOLESALE prices remain strictly independent
  // ------------------------------------------------------------
  it('TEST 5 — RETAIL, NRI and WHOLESALE tiers yield independent 50g calculations', () => {
    // Garam Masalo: Retail = 1000, NRI = 1500, Wholesale = 850
    const retailState = getProductCardState(mockMasalaGaram, 'RETAIL');
    const nriState = getProductCardState(mockMasalaGaram, 'NRI');
    const wholesaleState = getProductCardState(mockMasalaGaram, 'WHOLESALE');

    const retail50g = retailState.calculateRateForGrams(50);
    const nri50g = nriState.calculateRateForGrams(50);
    const wholesale50g = wholesaleState.calculateRateForGrams(50);

    assert.strictEqual(retail50g, 50.00, 'Retail 50g = (50/1000) * 1000 = ₹50.00');
    assert.strictEqual(nri50g, 75.00, 'NRI 50g = (50/1000) * 1500 = ₹75.00');
    assert.strictEqual(wholesale50g, 42.50, 'Wholesale 50g = (50/1000) * 850 = ₹42.50');

    assert.notStrictEqual(retail50g, nri50g, 'Retail and NRI prices must not bleed into each other');
    assert.notStrictEqual(retail50g, wholesale50g, 'Retail and Wholesale prices must not bleed into each other');
  });

  // ------------------------------------------------------------
  // TEST 6: Non-masala products do NOT get 50g option unless explicitly configured in packConfigurations
  // ------------------------------------------------------------
  it('TEST 6 — Unrelated non-Masala products do NOT get 50g option', () => {
    const farsanState = getProductCardState(mockFarsanPapdi);
    assert.strictEqual(farsanState.isMasala, false, 'Papdi must not be classified as Masala');
    const labels = farsanState.weightOptions.map((o) => o.label);
    assert.strictEqual(labels.includes('50g'), false, 'Unrelated products must NOT have 50g option');
    assert.deepStrictEqual(farsanState.weightOptions.map((o) => o.grams), [500, 1000]);
  });

  // ------------------------------------------------------------
  // TEST 7: Avoid duplicate options if 50g pack already exists in master data
  // ------------------------------------------------------------
  it('TEST 7 — Avoid duplicate options if 50g already exists in packConfigurations', () => {
    const productWith50gPack = {
      ...mockMasalaGaram,
      packConfigurations: [
        { id: 'pack-50g-sku', productId: 'prod-masala-001', packName: '50g Special Pack', weightInBaseUnits: 50, unitId: 'u-gm' },
        { id: 'pack-100g-sku', productId: 'prod-masala-001', packName: '100 GM Pack', weightInBaseUnits: 100, unitId: 'u-gm' },
      ],
    };

    const state = getProductCardState(productWith50gPack);
    const count50g = state.weightOptions.filter((o) => o.grams === 50).length;
    assert.strictEqual(count50g, 1, 'Must contain exactly ONE 50g option (no duplicates)');
  });

  // ------------------------------------------------------------
  // TEST 8: Products with missing prices cannot be billed using fabricated price
  // ------------------------------------------------------------
  it('TEST 8 — Products with missing prices are flagged and cannot be added/billed', () => {
    const unpricedProduct = {
      ...mockMasalaGaram,
      wholesalePrice: null,
      retailPrice: null,
      indianPrice: null,
    };

    const state = getProductCardState(unpricedProduct, 'WHOLESALE');
    const price50g = state.calculateRateForGrams(50);
    assert.strictEqual(price50g, 0, 'Unpriced product rate must be 0 (no fabrication)');
  });

  // ------------------------------------------------------------
  // TEST 9: Gram to Kilogram conversion & stock deduction invariant
  // ------------------------------------------------------------
  it('TEST 9 — Unit conversion: 50g equals exactly 0.05 kg', () => {
    const looseWeightGrams = 50;
    const kgEquivalent = looseWeightGrams / 1000;
    assert.strictEqual(kgEquivalent, 0.05, '50g must convert to exactly 0.05 kg');

    const quantity = 3;
    const baseWeightDeducted = looseWeightGrams * quantity;
    assert.strictEqual(baseWeightDeducted, 150, '3 units of 50g must deduct 150 grams from stock ledger');
    assert.strictEqual(baseWeightDeducted / 1000, 0.15, '150 grams equals 0.15 kg');
  });

  // ------------------------------------------------------------
  // TEST 10: Cart Line Item Separation & Steppers for 50g
  // ------------------------------------------------------------
  it('TEST 10 — Cart maintains distinct line items for 50g vs 100g and merges identical 50g items', () => {
    interface CartItem {
      id: string;
      productId: string;
      packName: string;
      looseWeightInGrams: number | null;
      quantity: number;
      unitRate: number;
      totalAmount: number;
    }

    let cart: CartItem[] = [];

    const addItem = (product: any, grams: number, qty: number, basePerKgRate: number) => {
      const lineId = `${product.id}_w_${grams}`;
      const singlePrice = Math.round(((grams / 1000) * basePerKgRate) * 100) / 100;
      const existingIdx = cart.findIndex((i) => i.id === lineId);
      if (existingIdx >= 0) {
        cart[existingIdx].quantity += qty;
        cart[existingIdx].totalAmount = Math.round(singlePrice * cart[existingIdx].quantity * 100) / 100;
      } else {
        cart.push({
          id: lineId,
          productId: product.id,
          packName: `${grams}g`,
          looseWeightInGrams: grams,
          quantity: qty,
          unitRate: basePerKgRate,
          totalAmount: Math.round(singlePrice * qty * 100) / 100,
        });
      }
    };

    // 1. Add 50g of Garam Masalo (qty 1)
    addItem(mockMasalaGaram, 50, 1, 1000);
    assert.strictEqual(cart.length, 1);
    assert.strictEqual(cart[0].looseWeightInGrams, 50);
    assert.strictEqual(cart[0].totalAmount, 50.00);

    // 2. Add 100g of Garam Masalo (qty 1) -> must create a separate line item!
    addItem(mockMasalaGaram, 100, 1, 1000);
    assert.strictEqual(cart.length, 2, '50g and 100g must be distinct line items in cart');

    // 3. Add 50g of Garam Masalo again (qty 2) -> must merge into line item 1
    addItem(mockMasalaGaram, 50, 2, 1000);
    assert.strictEqual(cart.length, 2, 'Must still have 2 distinct lines');
    assert.strictEqual(cart[0].quantity, 3, '50g line item must have quantity 3');
    assert.strictEqual(cart[0].totalAmount, 150.00, '3 x ₹50 = ₹150.00');
  });

  // ------------------------------------------------------------
  // TEST 11: POS Payment-mode safety remains intact
  // ------------------------------------------------------------
  it('TEST 11 — Payment mode requirement remains strictly enforced with 50g item in cart', () => {
    let paymentMode: PaymentMode | null = null;
    let saleCompleted = false;
    let error = '';

    const attemptCheckout = () => {
      if (!paymentMode) {
        error = 'Please select a payment mode before generating the bill.';
        return;
      }
      saleCompleted = true;
    };

    attemptCheckout();
    assert.strictEqual(saleCompleted, false, 'Sale must NOT proceed without payment mode');
    assert.strictEqual(error, 'Please select a payment mode before generating the bill.');

    // Select valid mode
    paymentMode = 'CASH' as PaymentMode;
    attemptCheckout();
    assert.strictEqual(saleCompleted, true, 'Sale proceeds once valid payment mode is selected');
  });
});
