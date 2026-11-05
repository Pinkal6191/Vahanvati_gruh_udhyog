import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { SaleType } from '../src/types/auth.types';
import {
  resolveApplicablePackPrice,
  resolveApplicableBasePrice,
  isPriceRecordApplicable,
} from '../src/features/billing/utils/pricingUtils';

describe('POS Billing — Product Weight Selection & 100g Price Calculation Bug Fix Test Suite', () => {
  // Realistic mock of 3 in 1 Rajwadi Garam Masala matching exact production master data
  // Base retail price: ₹1000/kg
  // Has TWO pack configurations for 100 GM Pack (one unpriced, one priced at ₹100)
  const mock3In1GaramMasala = {
    id: 'd8fff29f-0590-4aab-a408-dec0da882efc',
    name: '3 in 1 રજવાડી ગરમ મસાલો',
    gujaratiName: '3 in 1 રજવાડી ગરમ મસાલો',
    code: 'MASALA_3IN1_GARAM',
    retailPrice: 1000,
    indianPrice: 1000,
    nriPrice: 1500,
    wholesalePrice: 1000,
    isLooseWeightAllowed: true,
    primaryUnit: { id: 'u-kg', name: 'Kilogram', symbol: 'kg' },
    stock: { currentBalance: 50000, minimumThreshold: 5000 },
    subcategory: {
      id: 'sub-masala',
      name: 'મસાલા',
      code: 'SUB_MASALA',
      category: { id: 'cat-masala', name: 'મસાલા', code: 'CAT_MASALA' },
    },
    // Duplicate pack configurations matching production database
    packConfigurations: [
      {
        id: 'a8da196c-1987-4bfa-8cec-f34a12a4e2b7', // Unpriced duplicate pack
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packName: '100 GM Pack',
        weightInBaseUnits: 100,
        unitId: '00000000-0000-0000-0000-000000000001',
        displayOrder: 1,
        isActive: true,
      },
      {
        id: '02703f4f-b64c-43ef-b34a-a1d4138550a9', // Priced pack
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packName: '100 GM Pack',
        weightInBaseUnits: 100,
        unitId: '00000000-0000-0000-0000-000000000001',
        displayOrder: 1,
        isActive: true,
      },
    ],
    // Prices matching production database
    prices: [
      {
        id: '51db88cc-7793-4f30-bd16-67f63d981b99',
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packConfigId: '02703f4f-b64c-43ef-b34a-a1d4138550a9',
        pricingTier: 'RETAIL',
        rate: 100,
        isActive: true,
      },
      {
        id: 'ae119c68-e06f-46dd-9a4c-118205b34c1f',
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packConfigId: '02703f4f-b64c-43ef-b34a-a1d4138550a9',
        pricingTier: 'NRI',
        rate: 150,
        isActive: true,
      },
      {
        id: '62704381-56af-40d4-b350-06fcc8dc2386',
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packConfigId: '02703f4f-b64c-43ef-b34a-a1d4138550a9',
        pricingTier: 'WHOLESALE',
        rate: 100,
        isActive: true,
      },
      {
        id: 'd768926b-26fa-4930-8376-813315804812',
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packConfigId: null, // Base per-kg price
        pricingTier: 'RETAIL',
        rate: 1000,
        isActive: true,
      },
      {
        id: 'b72a2845-0cd5-4560-bb40-bfe0e48f0774',
        productId: 'd8fff29f-0590-4aab-a408-dec0da882efc',
        packConfigId: null, // Base per-kg price
        pricingTier: 'NRI',
        rate: 1500,
        isActive: true,
      },
    ],
  };

  // Another product: Sambhar Masala (₹800/kg, only loose weight, no pack configurations)
  const mockSambharMasala = {
    id: 'prod-sambhar-001',
    name: 'Sambhar Masalo',
    gujaratiName: 'સાંભાર મસાલો',
    code: 'MASALA_SAMBHAR',
    retailPrice: 800,
    indianPrice: 800,
    nriPrice: 1200,
    wholesalePrice: 700,
    isLooseWeightAllowed: true,
    primaryUnit: { id: 'u-kg', name: 'Kilogram', symbol: 'kg' },
    stock: { currentBalance: 30000, minimumThreshold: 3000 },
    subcategory: {
      id: 'sub-masala',
      name: 'મસાલા',
      code: 'SUB_MASALA',
      category: { id: 'cat-masala', name: 'મસાલા', code: 'CAT_MASALA' },
    },
    packConfigurations: [],
    prices: [
      { id: 'pr-s-ret', productId: 'prod-sambhar-001', packConfigId: null, pricingTier: 'RETAIL', rate: 800, isActive: true },
    ],
  };

  // Non-masala product: Papdi Farsan (₹360/kg, 500g and 1kg presets)
  const mockPapdiFarsan = {
    id: 'prod-farsan-papdi',
    name: 'Papdi (Farsan)',
    gujaratiName: 'પાપડી',
    code: 'PAPDI',
    retailPrice: 360,
    indianPrice: 360,
    nriPrice: 500,
    wholesalePrice: 300,
    isLooseWeightAllowed: true,
    primaryUnit: { id: 'u-kg', name: 'Kilogram', symbol: 'kg' },
    stock: { currentBalance: 40000, minimumThreshold: 5000 },
    subcategory: {
      id: 'sub-farsan',
      name: 'ફરસાણ',
      code: 'SUB_FARSAN',
      category: { id: 'cat-farsan', name: 'ફરસાણ', code: 'CAT_FARSAN' },
    },
    packConfigurations: [],
    prices: [
      { id: 'pr-p-ret', productId: 'prod-farsan-papdi', packConfigId: null, pricingTier: 'RETAIL', rate: 360, isActive: true },
    ],
  };

  // Helper simulating the exact ProductCard state and calculations
  function simulateProductCard(product: any, saleType: SaleType = 'RETAIL') {
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

    const basePriceRecord = resolveApplicableBasePrice((product as any).prices, saleType);
    const looseRate =
      basePriceRecord
        ? Number(basePriceRecord.rate)
        : saleType === 'WHOLESALE'
        ? (product.wholesalePrice ?? 0)
        : saleType === 'NRI'
        ? (product.nriPrice ?? 0)
        : (product.retailPrice ?? product.indianPrice ?? 0);

    const resolvePriceForWeight = (selectedWeightGrams: number) => {
      const matchingPacks = packs.filter((p: any) => Number(p.weightInBaseUnits) === selectedWeightGrams);
      const matchingPackWithPrice = matchingPacks.find(
        (p: any) => resolveApplicablePackPrice((product as any).prices, p.id, saleType) !== null
      );
      const matchingPack = matchingPackWithPrice || matchingPacks[0] || null;

      const packPriceRecord = matchingPack
        ? resolveApplicablePackPrice((product as any).prices, matchingPack.id, saleType)
        : null;

      const packRate = packPriceRecord ? Number(packPriceRecord.rate) : null;
      const isPackPriced = packRate !== null && packRate > 0;
      const isLooseAllowed = product.isLooseWeightAllowed ?? true;
      const applicableRate =
        isPackPriced
          ? packRate
          : isLooseAllowed && looseRate > 0
          ? Math.round(((selectedWeightGrams / 1000) * looseRate) * 100) / 100
          : 0;

      const selectedOpt = weightOptions.find((o) => o.grams === selectedWeightGrams);
      const label = selectedOpt ? selectedOpt.label : `${selectedWeightGrams}g`;

      const addToCartPayload = {
        packConfigId: isPackPriced ? matchingPack?.id : null,
        packName: label,
        looseWeightInGrams: isPackPriced ? null : selectedWeightGrams,
        quantity: 1,
      };

      return {
        selectedWeightGrams,
        applicableRate,
        isPackPriced,
        matchingPackId: matchingPack?.id || null,
        addToCartPayload,
      };
    };

    return {
      isMasala,
      weightOptions,
      looseRate,
      resolvePriceForWeight,
    };
  }

  // Simulator for Cart Item & Price Calculation
  interface CartItem {
    id: string;
    productId: string;
    packConfigId: string | null;
    packName: string;
    looseWeightInGrams: number | null;
    quantity: number;
    unitRate: number;
    totalAmount: number;
    hasPriceError?: boolean;
    priceErrorMessage?: string;
  }

  function simulateCart(saleType: SaleType = 'RETAIL') {
    let items: CartItem[] = [];

    const addItem = (product: any, options: { packConfigId?: string | null; packName?: string; looseWeightInGrams?: number | null; quantity?: number }) => {
      const qtyToAdd = options?.quantity && options.quantity > 0 ? options.quantity : 1;
      const packId = options?.packConfigId || null;
      const weightGrams = options?.looseWeightInGrams || null;
      const itemId = `${product.id}_${packId || (weightGrams ? `w_${weightGrams}` : 'loose')}`;

      const existingIndex = items.findIndex((i) => i.id === itemId);
      if (existingIndex >= 0) {
        items = items.map((it, idx) => {
          if (idx === existingIndex) {
            const nextQty = it.quantity + qtyToAdd;
            const singleItemPrice = it.looseWeightInGrams && !it.packConfigId
              ? Math.round(((it.looseWeightInGrams / 1000) * it.unitRate) * 100) / 100
              : it.unitRate;
            return {
              ...it,
              quantity: nextQty,
              totalAmount: Math.round(singleItemPrice * nextQty * 100) / 100,
            };
          }
          return it;
        });
      } else {
        let defaultRate = 0;
        let singleItemPrice = 0;
        let isMissingPrice = false;
        let priceErrorMessage: string | undefined = undefined;
        let resolvedPackConfigId: string | null = null;
        let resolvedLooseWeight: number | null = null;

        if (packId) {
          let packPriceObj = resolveApplicablePackPrice((product as any).prices, packId, saleType);
          let targetPackId = packId;

          if (!packPriceObj) {
            const passedPack = (product.packConfigurations || []).find((p: any) => p.id === packId);
            if (passedPack) {
              const altPacks = (product.packConfigurations || []).filter(
                (p: any) => p.id !== packId && Number(p.weightInBaseUnits) === Number(passedPack.weightInBaseUnits) && p.isActive
              );
              for (const altPack of altPacks) {
                const altPrice = resolveApplicablePackPrice((product as any).prices, altPack.id, saleType);
                if (altPrice) {
                  targetPackId = altPack.id;
                  packPriceObj = altPrice;
                  break;
                }
              }
            }
          }

          if (packPriceObj) {
            defaultRate = Number(packPriceObj.rate);
            singleItemPrice = defaultRate;
            resolvedPackConfigId = targetPackId;
            resolvedLooseWeight = null;
          } else {
            isMissingPrice = true;
            priceErrorMessage = `No active ${saleType} price configured for this pack`;
            defaultRate = 0;
            singleItemPrice = 0;
            resolvedPackConfigId = packId;
            resolvedLooseWeight = null;
          }
        } else if (weightGrams) {
          const isLooseAllowed = product.isLooseWeightAllowed ?? true;
          if (!isLooseAllowed) {
            isMissingPrice = true;
            priceErrorMessage = `Loose weight selling is not allowed for ${product.name}`;
            defaultRate = 0;
            singleItemPrice = 0;
          } else {
            const basePriceObj = resolveApplicableBasePrice((product as any).prices, saleType);
            if (basePriceObj) {
              defaultRate = Number(basePriceObj.rate);
            } else if (saleType === 'WHOLESALE') {
              defaultRate = product.wholesalePrice ?? 0;
            } else if (saleType === 'NRI') {
              defaultRate = product.nriPrice ?? 0;
            } else {
              defaultRate = product.retailPrice ?? product.indianPrice ?? 0;
            }

            if (defaultRate <= 0) {
              isMissingPrice = true;
              priceErrorMessage = `No active ${saleType} price configured for ${product.name}`;
              singleItemPrice = 0;
            } else {
              singleItemPrice = Math.round(((weightGrams / 1000) * defaultRate) * 100) / 100;
              resolvedLooseWeight = weightGrams;
            }
          }
        } else {
          const basePriceObj = resolveApplicableBasePrice((product as any).prices, saleType);
          if (basePriceObj) {
            defaultRate = Number(basePriceObj.rate);
          } else if (saleType === 'WHOLESALE') {
            defaultRate = product.wholesalePrice ?? 0;
          } else if (saleType === 'NRI') {
            defaultRate = product.nriPrice ?? 0;
          } else {
            defaultRate = product.retailPrice ?? product.indianPrice ?? 0;
          }

          if (defaultRate <= 0) {
            isMissingPrice = true;
            priceErrorMessage = `No active ${saleType} price configured for ${product.name}`;
            singleItemPrice = 0;
          } else {
            singleItemPrice = defaultRate;
          }
        }

        items.push({
          id: itemId,
          productId: product.id,
          packConfigId: resolvedPackConfigId,
          packName: options?.packName || (resolvedPackConfigId ? 'Pack' : resolvedLooseWeight ? (resolvedLooseWeight >= 1000 ? `${resolvedLooseWeight / 1000} kg` : `${resolvedLooseWeight}g`) : 'Standard'),
          quantity: qtyToAdd,
          looseWeightInGrams: resolvedLooseWeight,
          unitRate: defaultRate,
          totalAmount: Math.round(singleItemPrice * qtyToAdd * 100) / 100,
          hasPriceError: isMissingPrice,
          priceErrorMessage,
        });
      }
    };

    const getSubtotal = () => Math.round(items.reduce((sum, it) => sum + (it.hasPriceError ? 0 : it.totalAmount), 0) * 100) / 100;

    return {
      items: () => items,
      addItem,
      getSubtotal,
    };
  }

  // =========================================================================
  // TEST 1: Select 50g -> correct configured price (₹50)
  // =========================================================================
  it('TEST 1 — Select 50g yields exactly ₹50.00 for ₹1000/kg product', () => {
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');
    const result50g = card.resolvePriceForWeight(50);

    assert.strictEqual(result50g.applicableRate, 50.00, '50g must be ₹50.00');
    assert.strictEqual(result50g.addToCartPayload.packConfigId, null, '50g has no packConfigId');
    assert.strictEqual(result50g.addToCartPayload.looseWeightInGrams, 50, '50g sends looseWeightInGrams 50');
  });

  // =========================================================================
  // TEST 2: Select 100g -> correct configured price (₹100), NOT ₹1,000!
  // =========================================================================
  it('TEST 2 — Select 100g yields ₹100.00 (configured pack price), NOT the 1kg price ₹1,000.00', () => {
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');
    const result100g = card.resolvePriceForWeight(100);

    assert.strictEqual(result100g.applicableRate, 100.00, '100g must be ₹100.00, NOT ₹1000.00');
    assert.notStrictEqual(result100g.applicableRate, 1000.00, 'CRITICAL: Must NEVER display ₹1,000 for 100g');
    assert.strictEqual(result100g.isPackPriced, true, '100g must resolve as configured pack price');
    assert.strictEqual(result100g.matchingPackId, '02703f4f-b64c-43ef-b34a-a1d4138550a9', 'Must pick the priced pack config, not the unpriced duplicate');
  });

  // =========================================================================
  // TEST 3: Select 200g -> correct configured price (₹200)
  // =========================================================================
  it('TEST 3 — Select 200g yields exactly ₹200.00 for ₹1000/kg product', () => {
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');
    const result200g = card.resolvePriceForWeight(200);

    assert.strictEqual(result200g.applicableRate, 200.00, '200g must be ₹200.00');
    assert.strictEqual(result200g.addToCartPayload.looseWeightInGrams, 200);
  });

  // =========================================================================
  // TEST 4: Select 500g -> correct configured price (₹500)
  // =========================================================================
  it('TEST 4 — Select 500g yields exactly ₹500.00 for ₹1000/kg product', () => {
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');
    const result500g = card.resolvePriceForWeight(500);

    assert.strictEqual(result500g.applicableRate, 500.00, '500g must be ₹500.00');
    assert.strictEqual(result500g.addToCartPayload.looseWeightInGrams, 500);
  });

  // =========================================================================
  // TEST 5: Select 1kg -> correct configured price (₹1,000)
  // =========================================================================
  it('TEST 5 — Select 1kg yields exactly ₹1,000.00 for ₹1000/kg product', () => {
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');
    const result1kg = card.resolvePriceForWeight(1000);

    assert.strictEqual(result1kg.applicableRate, 1000.00, '1kg must be ₹1,000.00');
    assert.strictEqual(result1kg.addToCartPayload.looseWeightInGrams, 1000);
  });

  // =========================================================================
  // TEST 6: Change weight repeatedly -> no stale price or incorrect state
  // =========================================================================
  it('TEST 6 — Change weight repeatedly (100g -> 50g -> 1kg -> 200g -> 100g) without stale price', () => {
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');

    assert.strictEqual(card.resolvePriceForWeight(100).applicableRate, 100.00);
    assert.strictEqual(card.resolvePriceForWeight(50).applicableRate, 50.00);
    assert.strictEqual(card.resolvePriceForWeight(1000).applicableRate, 1000.00);
    assert.strictEqual(card.resolvePriceForWeight(200).applicableRate, 200.00);
    assert.strictEqual(card.resolvePriceForWeight(500).applicableRate, 500.00);
    assert.strictEqual(card.resolvePriceForWeight(100).applicableRate, 100.00, 'Final 100g must be ₹100.00');
  });

  // =========================================================================
  // TEST 7: Add multiple weights of the same product to the cart
  // =========================================================================
  it('TEST 7 — Add multiple weights of the same product creates distinct line items', () => {
    const cart = simulateCart('RETAIL');
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');

    // Add 50g
    cart.addItem(mock3In1GaramMasala, card.resolvePriceForWeight(50).addToCartPayload);
    // Add 100g
    cart.addItem(mock3In1GaramMasala, card.resolvePriceForWeight(100).addToCartPayload);
    // Add 200g
    cart.addItem(mock3In1GaramMasala, card.resolvePriceForWeight(200).addToCartPayload);

    const items = cart.items();
    assert.strictEqual(items.length, 3, 'Must have 3 distinct line items in cart');

    const item50g = items.find((i) => i.looseWeightInGrams === 50);
    const item100g = items.find((i) => i.packConfigId === '02703f4f-b64c-43ef-b34a-a1d4138550a9');
    const item200g = items.find((i) => i.looseWeightInGrams === 200);

    assert.ok(item50g, '50g item must exist in cart');
    assert.strictEqual(item50g!.totalAmount, 50.00);

    assert.ok(item100g, '100g item must exist in cart');
    assert.strictEqual(item100g!.totalAmount, 100.00, '100g item in cart must be ₹100.00, NOT ₹1000.00');

    assert.ok(item200g, '200g item must exist in cart');
    assert.strictEqual(item200g!.totalAmount, 200.00);
  });

  // =========================================================================
  // TEST 8: Verify cart subtotal and bill total
  // =========================================================================
  it('TEST 8 — Cart subtotal and bill total calculate correctly across multiple weights', () => {
    const cart = simulateCart('RETAIL');
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');

    // 50g (₹50) + 100g x 2 (₹200) + 500g (₹500) = ₹750.00
    cart.addItem(mock3In1GaramMasala, card.resolvePriceForWeight(50).addToCartPayload);
    cart.addItem(mock3In1GaramMasala, { ...card.resolvePriceForWeight(100).addToCartPayload, quantity: 2 });
    cart.addItem(mock3In1GaramMasala, card.resolvePriceForWeight(500).addToCartPayload);

    const subtotal = cart.getSubtotal();
    assert.strictEqual(subtotal, 750.00, 'Subtotal must be exactly ₹750.00 (50 + 200 + 500)');
  });

  // =========================================================================
  // TEST 9: Verify different products with different pricing configurations
  // =========================================================================
  it('TEST 9 — Different products calculate according to their own pricing configurations', () => {
    // 1. Sambhar Masala (₹800/kg loose)
    const sambharCard = simulateProductCard(mockSambharMasala, 'RETAIL');
    assert.strictEqual(sambharCard.resolvePriceForWeight(50).applicableRate, 40.00, '50g Sambhar = (50/1000)*800 = ₹40.00');
    assert.strictEqual(sambharCard.resolvePriceForWeight(100).applicableRate, 80.00, '100g Sambhar = (100/1000)*800 = ₹80.00');
    assert.strictEqual(sambharCard.resolvePriceForWeight(500).applicableRate, 400.00, '500g Sambhar = (500/1000)*800 = ₹400.00');

    // 2. Papdi Farsan (₹360/kg loose)
    const papdiCard = simulateProductCard(mockPapdiFarsan, 'RETAIL');
    assert.strictEqual(papdiCard.resolvePriceForWeight(500).applicableRate, 180.00, '500g Papdi = (500/1000)*360 = ₹180.00');
    assert.strictEqual(papdiCard.resolvePriceForWeight(1000).applicableRate, 360.00, '1kg Papdi = ₹360.00');

    // Cart combining all products
    const cart = simulateCart('RETAIL');
    cart.addItem(mock3In1GaramMasala, simulateProductCard(mock3In1GaramMasala).resolvePriceForWeight(100).addToCartPayload); // 100
    cart.addItem(mockSambharMasala, sambharCard.resolvePriceForWeight(100).addToCartPayload); // 80
    cart.addItem(mockPapdiFarsan, papdiCard.resolvePriceForWeight(500).addToCartPayload); // 180

    assert.strictEqual(cart.getSubtotal(), 360.00, 'Combined subtotal: 100 + 80 + 180 = ₹360.00');
  });

  // =========================================================================
  // TEST 10: Fallback safety if caller passes unpriced duplicate packConfigId
  // =========================================================================
  it('TEST 10 — Resilient fallback: Even if unpriced packId is passed, alternative priced pack or loose rate is used', () => {
    const cart = simulateCart('RETAIL');

    // Intentionally pass the UNPRICED duplicate pack ID ('a8da196c-1987-4bfa-8cec-f34a12a4e2b7')
    cart.addItem(mock3In1GaramMasala, {
      packConfigId: 'a8da196c-1987-4bfa-8cec-f34a12a4e2b7',
      packName: '100 GM Pack',
      looseWeightInGrams: 100,
      quantity: 1,
    });

    const item = cart.items()[0];
    assert.ok(item);
    assert.strictEqual(item.totalAmount, 100.00, 'Must resolve to ₹100.00 via alternative priced pack config, NOT ₹1,000.00');
    assert.notStrictEqual(item.totalAmount, 1000.00, 'CRITICAL: Must never charge ₹1000 for 100g');
  });

  // =========================================================================
  // TEST 11: NRI and WHOLESALE sale tiers for 100g
  // =========================================================================
  it('TEST 11 — NRI and WHOLESALE tiers resolve appropriate configured prices for 100g', () => {
    // NRI: Configured rate is ₹150 for 100g pack
    const nriCard = simulateProductCard(mock3In1GaramMasala, 'NRI');
    const nriResult = nriCard.resolvePriceForWeight(100);
    assert.strictEqual(nriResult.applicableRate, 150.00, 'NRI 100g pack must be ₹150.00');

    // WHOLESALE: Configured rate is ₹100 for 100g pack
    const wsCard = simulateProductCard(mock3In1GaramMasala, 'WHOLESALE');
    const wsResult = wsCard.resolvePriceForWeight(100);
    assert.strictEqual(wsResult.applicableRate, 100.00, 'Wholesale 100g pack must be ₹100.00');
  });

  // =========================================================================
  // TEST 12: Strict Fallback: Unpriced pack with NO duplicate alternative flags error
  // =========================================================================
  it('TEST 12 — Strict Fallback: Unpriced pack configuration with NO alternative priced pack flags a clear price error and NEVER substitutes per-kg price', () => {
    const unpricedPackProduct = {
      id: 'prod-unpriced-pack',
      name: 'Special Pack Only Item',
      retailPrice: 500,
      isLooseWeightAllowed: false,
      packConfigurations: [
        { id: 'pack-no-price-ever', weightInBaseUnits: 250, packName: '250g Special' },
      ],
      prices: [], // No prices at all
    };

    const cart = simulateCart('RETAIL');
    cart.addItem(unpricedPackProduct, {
      packConfigId: 'pack-no-price-ever',
      packName: '250g Special',
      quantity: 1,
    });

    const item = cart.items()[0];
    assert.ok(item);
    assert.strictEqual(item.hasPriceError, true, 'Must flag hasPriceError: true');
    assert.strictEqual(item.totalAmount, 0, 'Total amount must be 0 for unpriced pack');
    assert.ok(item.priceErrorMessage?.includes('No active RETAIL price configured for this pack'));
  });

  // =========================================================================
  // TEST 13: Strict Fallback: Loose weight selling rejected if product disallows loose
  // =========================================================================
  it('TEST 13 — Strict Fallback: Product with isLooseWeightAllowed: false flags clear price error when loose weight is added', () => {
    const strictPackProduct = {
      id: 'prod-strict-pack',
      name: 'Strict Pack Box',
      retailPrice: 300,
      isLooseWeightAllowed: false,
      packConfigurations: [],
      prices: [{ packConfigId: null, pricingTier: 'RETAIL', rate: 300, isActive: true }],
    };

    const cart = simulateCart('RETAIL');
    cart.addItem(strictPackProduct, {
      packConfigId: null,
      looseWeightInGrams: 500,
      quantity: 1,
    });

    const item = cart.items()[0];
    assert.ok(item);
    assert.strictEqual(item.hasPriceError, true, 'Must flag hasPriceError: true when loose selling not allowed');
    assert.strictEqual(item.totalAmount, 0);
    assert.ok(item.priceErrorMessage?.includes('Loose weight selling is not allowed'));
  });

  // =========================================================================
  // TEST 14: Cart Subtotal, Discount & Tax Precision
  // =========================================================================
  it('TEST 14 — Subtotal, Discount & Rounding integrity across multiple line items', () => {
    const cart = simulateCart('RETAIL');
    const card = simulateProductCard(mock3In1GaramMasala, 'RETAIL');

    // Add 100g pack x 3 @ ₹100 = ₹300
    cart.addItem(mock3In1GaramMasala, { ...card.resolvePriceForWeight(100).addToCartPayload, quantity: 3 });
    // Add 50g loose x 2 @ ₹50 = ₹100
    cart.addItem(mock3In1GaramMasala, { ...card.resolvePriceForWeight(50).addToCartPayload, quantity: 2 });

    const subtotal = cart.getSubtotal();
    assert.strictEqual(subtotal, 400.00, 'Subtotal: 300 + 100 = 400.00');

    // Simulate discount of ₹25.50
    const discountAmount = 25.50;
    const finalBillTotal = Math.max(0, Math.round(subtotal - discountAmount));
    assert.strictEqual(finalBillTotal, 375, 'Final total after rounding: 400 - 25.50 = 374.50 -> rounded to 375');
  });

  // =========================================================================
  // TEST 15: Effective-Date Resolution: Expired price record is ignored
  // =========================================================================
  it('TEST 15 — Effective-Date: Expired price record (effectiveTo in past) is ignored', () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expiredProduct = {
      id: 'prod-expired-test',
      name: 'Expired Price Product',
      retailPrice: null,
      isLooseWeightAllowed: false,
      packConfigurations: [
        { id: 'pack-expired-100', weightInBaseUnits: 100, packName: '100g Pack', isActive: true },
      ],
      prices: [
        {
          id: 'price-expired',
          packConfigId: 'pack-expired-100',
          pricingTier: 'RETAIL',
          rate: 80,
          isActive: true,
          effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          effectiveTo: pastDate.toISOString(), // Expired
        },
      ],
    };

    const resolved = resolveApplicablePackPrice(expiredProduct.prices, 'pack-expired-100', 'RETAIL');
    assert.strictEqual(resolved, null, 'Expired price must not be resolved');

    const card = simulateProductCard(expiredProduct, 'RETAIL');
    const priceRes = card.resolvePriceForWeight(100);
    assert.strictEqual(priceRes.isPackPriced, false);
    assert.strictEqual(priceRes.applicableRate, 0);

    const cart = simulateCart('RETAIL');
    cart.addItem(expiredProduct, { packConfigId: 'pack-expired-100', quantity: 1 });
    assert.strictEqual(cart.items()[0].hasPriceError, true, 'Cart must flag error for expired pack price');
  });

  // =========================================================================
  // TEST 16: Effective-Date Resolution: Future-dated price record is ignored
  // =========================================================================
  it('TEST 16 — Effective-Date: Future-dated price record (effectiveFrom in future) is ignored', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futurePricedProduct = {
      id: 'prod-future-test',
      name: 'Future Price Product',
      retailPrice: null,
      isLooseWeightAllowed: false,
      packConfigurations: [
        { id: 'pack-future-100', weightInBaseUnits: 100, packName: '100g Pack', isActive: true },
      ],
      prices: [
        {
          id: 'price-current',
          packConfigId: 'pack-future-100',
          pricingTier: 'RETAIL',
          rate: 100,
          isActive: true,
          effectiveFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          effectiveTo: null,
        },
        {
          id: 'price-future',
          packConfigId: 'pack-future-100',
          pricingTier: 'RETAIL',
          rate: 120, // Future rate
          isActive: true,
          effectiveFrom: futureDate.toISOString(), // Starts next week
          effectiveTo: null,
        },
      ],
    };

    const resolved = resolveApplicablePackPrice(futurePricedProduct.prices, 'pack-future-100', 'RETAIL');
    assert.ok(resolved);
    assert.strictEqual(resolved.id, 'price-current', 'Must select current active price, not future price');
    assert.strictEqual(Number(resolved.rate), 100, 'Must apply current ₹100 rate');
  });

  // =========================================================================
  // TEST 17: Effective-Date Resolution: Latest effectiveFrom takes precedence
  // =========================================================================
  it('TEST 17 — Effective-Date: Deterministic precedence selects latest effectiveFrom record', () => {
    const date1 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const date2 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const multiPriceProduct = {
      id: 'prod-multi-price-test',
      name: 'Multi Price Product',
      retailPrice: null,
      isLooseWeightAllowed: false,
      packConfigurations: [
        { id: 'pack-multi-100', weightInBaseUnits: 100, packName: '100g Pack', isActive: true },
      ],
      prices: [
        {
          id: 'price-older',
          packConfigId: 'pack-multi-100',
          pricingTier: 'RETAIL',
          rate: 90,
          isActive: true,
          effectiveFrom: date1.toISOString(),
          effectiveTo: null,
        },
        {
          id: 'price-newer',
          packConfigId: 'pack-multi-100',
          pricingTier: 'RETAIL',
          rate: 110,
          isActive: true,
          effectiveFrom: date2.toISOString(),
          effectiveTo: null,
        },
      ],
    };

    const resolved = resolveApplicablePackPrice(multiPriceProduct.prices, 'pack-multi-100', 'RETAIL');
    assert.ok(resolved);
    assert.strictEqual(resolved.id, 'price-newer', 'Must select the price with the latest effectiveFrom date');
    assert.strictEqual(Number(resolved.rate), 110, 'Must apply ₹110 rate from newer effective date');
  });

  // =========================================================================
  // TEST 18: Inactive Price Record (isActive: false) is strictly ignored
  // =========================================================================
  it('TEST 18 — Inactive Price Record: isActive: false is ignored even if dates are valid', () => {
    const inactiveProduct = {
      id: 'prod-inactive-test',
      name: 'Inactive Price Product',
      retailPrice: null,
      isLooseWeightAllowed: false,
      packConfigurations: [
        { id: 'pack-inactive-100', weightInBaseUnits: 100, packName: '100g Pack', isActive: true },
      ],
      prices: [
        {
          id: 'price-deactivated',
          packConfigId: 'pack-inactive-100',
          pricingTier: 'RETAIL',
          rate: 85,
          isActive: false, // Deactivated
          effectiveFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          effectiveTo: null,
        },
      ],
    };

    const resolved = resolveApplicablePackPrice(inactiveProduct.prices, 'pack-inactive-100', 'RETAIL');
    assert.strictEqual(resolved, null, 'Deactivated price record must not be resolved');
  });
});
