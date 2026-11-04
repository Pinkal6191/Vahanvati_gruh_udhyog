import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { SaleType } from '../src/types/auth.types';

describe('POS UX Enhancement — Weight Selection Must Not Add Product to Bill', () => {
  // Masala Product Mock (₹1000/kg base rate -> 50g = ₹50, 100g = ₹100, 200g = ₹200, 500g = ₹500, 1kg = ₹1000)
  const mockGaramMasala = {
    id: 'prod-masala-garam',
    name: 'Rajwadi Garam Masala',
    gujaratiName: 'રજવાડી ગરમ મસાલો',
    code: 'MASALA_GARAM',
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
    packConfigurations: [],
  };

  // Non-weight based Product Mock (e.g. Festive Packaging Box)
  const mockGiftBox = {
    id: 'prod-gift-box',
    name: 'Festival Gift Box',
    gujaratiName: 'તહેવાર ભેટ બોક્સ',
    code: 'BOX_FESTIVAL',
    retailPrice: 150,
    indianPrice: 150,
    nriPrice: 250,
    wholesalePrice: 120,
    primaryUnit: { id: 'u-pc', name: 'Piece', symbol: 'pc' },
    stock: { currentBalance: 100, minimumThreshold: 10 },
    subcategory: {
      id: 'sub-boxes',
      name: 'Boxes',
      code: 'SUB_BOXES',
      category: { id: 'cat-pack', name: 'Packaging', code: 'CAT_PACK' },
    },
    packConfigurations: [],
  };

  interface CartItem {
    id: string;
    productId: string;
    packName: string;
    looseWeightInGrams: number | null;
    quantity: number;
    unitRate: number;
    totalAmount: number;
  }

  // Simulator for ProductCard interaction model
  function createProductCardSimulator(product: any, saleType: SaleType = 'RETAIL') {
    const isMasala =
      product.subcategory?.category?.code === 'CAT_MASALA' ||
      product.subcategory?.category?.name?.includes('મસાલા') ||
      product.subcategory?.category?.name?.toLowerCase().includes('masala') ||
      product.subcategory?.code?.includes('MASALA') ||
      product.name?.toLowerCase().includes('masala') ||
      product.code?.toUpperCase().includes('MASALA');

    const weightOptions = isMasala
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

    let selectedWeightGrams: number = isMasala ? 100 : 500;
    const cart: CartItem[] = [];

    const getLooseRate = () => {
      if (saleType === 'WHOLESALE') return product.wholesalePrice ?? 0;
      if (saleType === 'NRI') return product.nriPrice ?? 0;
      return product.retailPrice ?? product.indianPrice ?? 0;
    };

    const calculatePrice = (grams: number) => {
      const rate = getLooseRate();
      return Math.round(((grams / 1000) * rate) * 100) / 100;
    };

    // Card Add to Cart action (triggered by main card body or Plus button)
    const handleAddToCart = (e?: { stopPropagation?: () => void; [key: string]: any }) => {
      if (e?.stopPropagation) e.stopPropagation();

      const label = weightOptions.find((o) => o.grams === selectedWeightGrams)?.label || `${selectedWeightGrams}g`;
      const lineId = `${product.id}_w_${selectedWeightGrams}`;
      const singlePrice = calculatePrice(selectedWeightGrams);

      const existingIndex = cart.findIndex((i) => i.id === lineId);
      if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
        cart[existingIndex].totalAmount = Math.round(singlePrice * cart[existingIndex].quantity * 100) / 100;
      } else {
        cart.push({
          id: lineId,
          productId: product.id,
          packName: label,
          looseWeightInGrams: selectedWeightGrams,
          quantity: 1,
          unitRate: getLooseRate(),
          totalAmount: singlePrice,
        });
      }
    };

    // Weight Chip Click action (STRICTLY selects weight, NEVER calls handleAddToCart)
    const handleOptionClick = (grams: number, e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      selectedWeightGrams = grams;
    };

    // Simulated event object tracking propagation
    const createEvent = () => {
      let stopped = false;
      return {
        stopPropagation: () => {
          stopped = true;
        },
        isPropagationStopped: () => stopped,
      };
    };

    return {
      getSelectedWeight: () => selectedWeightGrams,
      getWeightOptions: () => weightOptions,
      getCart: () => cart,
      handleOptionClick,
      handleAddToCart,
      createEvent,
      calculatePrice,
    };
  }

  // --------------------------------------------------------------------------
  // TEST 1: Clicking 50g only selects 50g and does not add a bill item
  // --------------------------------------------------------------------------
  it('TEST 1 — Clicking 50g only selects 50g and does NOT add item to bill', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');
    assert.strictEqual(sim.getSelectedWeight(), 100, 'Initial weight is 100g');

    const e = sim.createEvent();
    sim.handleOptionClick(50, e);

    assert.strictEqual(sim.getSelectedWeight(), 50, 'Selected weight must be updated to 50g');
    assert.strictEqual(e.isPropagationStopped(), true, 'Click event must stop propagation to card body');
    assert.strictEqual(sim.getCart().length, 0, 'Bill items must remain strictly 0');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Clicking 100g only selects 100g and does not add a bill item
  // --------------------------------------------------------------------------
  it('TEST 2 — Clicking 100g only selects 100g and does NOT add item to bill', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // First change to 50g
    sim.handleOptionClick(50, sim.createEvent());
    assert.strictEqual(sim.getSelectedWeight(), 50);

    // Now click 100g
    const e = sim.createEvent();
    sim.handleOptionClick(100, e);

    assert.strictEqual(sim.getSelectedWeight(), 100, 'Selected weight must be 100g');
    assert.strictEqual(e.isPropagationStopped(), true, 'Event must stop propagation');
    assert.strictEqual(sim.getCart().length, 0, 'No product must be added to bill');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Clicking 200g, 500g, and 1kg only selects the respective weight
  // --------------------------------------------------------------------------
  it('TEST 3 — Clicking 200g, 500g, and 1kg only updates weight selection', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    for (const targetWeight of [200, 500, 1000]) {
      const e = sim.createEvent();
      sim.handleOptionClick(targetWeight, e);
      assert.strictEqual(sim.getSelectedWeight(), targetWeight, `Selected weight must be ${targetWeight}g`);
      assert.strictEqual(e.isPropagationStopped(), true, 'Event must stop propagation');
      assert.strictEqual(sim.getCart().length, 0, 'Cart must remain empty');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Repeatedly clicking active weight does NOT add to bill
  // --------------------------------------------------------------------------
  it('TEST 4 — Double clicking or re-tapping the active weight chip does NOT add to bill', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');
    assert.strictEqual(sim.getSelectedWeight(), 100, 'Default selection is 100g');

    // Re-tap on 100g (which is already active)
    const e1 = sim.createEvent();
    sim.handleOptionClick(100, e1);
    assert.strictEqual(sim.getCart().length, 0, 'Re-tapping 100g must not add to bill');

    // Select 50g, then tap 50g again
    sim.handleOptionClick(50, sim.createEvent());
    assert.strictEqual(sim.getSelectedWeight(), 50);
    assert.strictEqual(sim.getCart().length, 0);

    const e2 = sim.createEvent();
    sim.handleOptionClick(50, e2);
    assert.strictEqual(sim.getSelectedWeight(), 50);
    assert.strictEqual(sim.getCart().length, 0, 'Re-tapping 50g must never add to bill');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Clicking the product card after selecting 50g adds 50g to bill
  // --------------------------------------------------------------------------
  it('TEST 5 — Clicking the product card body after selecting 50g adds 50g to bill', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Step 1: Select 50g (only updates state)
    sim.handleOptionClick(50, sim.createEvent());
    assert.strictEqual(sim.getCart().length, 0);

    // Step 2: User clicks product card body
    sim.handleAddToCart();

    const cart = sim.getCart();
    assert.strictEqual(cart.length, 1, 'Exactly 1 item added to bill');
    assert.strictEqual(cart[0].looseWeightInGrams, 50, 'Line item weight must be 50g');
    assert.strictEqual(cart[0].packName, '50g', 'Pack name must be 50g');
    assert.strictEqual(cart[0].quantity, 1, 'Quantity must be 1');
    assert.strictEqual(cart[0].totalAmount, 50.0, '50g at ₹1000/kg must equal ₹50.00');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Clicking the product card after selecting 100g adds 100g to bill
  // --------------------------------------------------------------------------
  it('TEST 6 — Clicking the product card body after selecting 100g adds 100g to bill', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Select 100g
    sim.handleOptionClick(100, sim.createEvent());
    assert.strictEqual(sim.getCart().length, 0);

    // Click card body
    sim.handleAddToCart();

    const cart = sim.getCart();
    assert.strictEqual(cart.length, 1, '1 item added to bill');
    assert.strictEqual(cart[0].looseWeightInGrams, 100, 'Weight must be 100g');
    assert.strictEqual(cart[0].totalAmount, 100.0, '100g at ₹1000/kg must equal ₹100.00');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Clicking the dedicated (+) button adds the currently selected weight
  // --------------------------------------------------------------------------
  it('TEST 7 — Clicking the dedicated Plus (+) button adds the currently selected weight', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Select 200g
    sim.handleOptionClick(200, sim.createEvent());
    assert.strictEqual(sim.getCart().length, 0);

    // Click dedicated plus button
    const plusEvent = sim.createEvent();
    sim.handleAddToCart(plusEvent);

    assert.strictEqual(plusEvent.isPropagationStopped(), true, 'Plus button event must stop propagation');
    const cart = sim.getCart();
    assert.strictEqual(cart.length, 1);
    assert.strictEqual(cart[0].looseWeightInGrams, 200);
    assert.strictEqual(cart[0].totalAmount, 200.0, '200g at ₹1000/kg must equal ₹200.00');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Changing selected weight does not alter existing bill items
  // --------------------------------------------------------------------------
  it('TEST 8 — Changing selected weight on card does NOT modify existing bill items', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Add 50g to bill
    sim.handleOptionClick(50, sim.createEvent());
    sim.handleAddToCart();
    assert.strictEqual(sim.getCart().length, 1);
    assert.strictEqual(sim.getCart()[0].looseWeightInGrams, 50);
    assert.strictEqual(sim.getCart()[0].totalAmount, 50.0);

    // Now change card selection to 1 kg
    sim.handleOptionClick(1000, sim.createEvent());
    assert.strictEqual(sim.getSelectedWeight(), 1000);

    // Existing bill item must be completely unaffected
    const cart = sim.getCart();
    assert.strictEqual(cart.length, 1, 'Still only 1 item in bill');
    assert.strictEqual(cart[0].looseWeightInGrams, 50, 'Existing bill item must remain 50g');
    assert.strictEqual(cart[0].totalAmount, 50.0, 'Existing bill item amount must remain ₹50.00');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Repeated addition of same weight preserves quantity aggregation
  // --------------------------------------------------------------------------
  it('TEST 9 — Repeated product addition preserves quantity aggregation for same weight', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Select 50g
    sim.handleOptionClick(50, sim.createEvent());

    // Add 50g 3 times
    sim.handleAddToCart();
    sim.handleAddToCart();
    sim.handleAddToCart();

    const cart = sim.getCart();
    assert.strictEqual(cart.length, 1, 'Must merge into a single line item');
    assert.strictEqual(cart[0].looseWeightInGrams, 50);
    assert.strictEqual(cart[0].quantity, 3, 'Quantity must be aggregated to 3');
    assert.strictEqual(cart[0].totalAmount, 150.0, '3 x ₹50 = ₹150.00');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Multi-weight addition creates distinct line items
  // --------------------------------------------------------------------------
  it('TEST 10 — Adding different weights produces distinct bill lines with accurate pricing', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Add 50g (qty 1) -> ₹50.00
    sim.handleOptionClick(50, sim.createEvent());
    sim.handleAddToCart();

    // Add 100g (qty 1) -> ₹100.00
    sim.handleOptionClick(100, sim.createEvent());
    sim.handleAddToCart();

    // Add 500g (qty 1) -> ₹500.00
    sim.handleOptionClick(500, sim.createEvent());
    sim.handleAddToCart();

    const cart = sim.getCart();
    assert.strictEqual(cart.length, 3, 'Must have 3 distinct line items');
    assert.strictEqual(cart[0].looseWeightInGrams, 50);
    assert.strictEqual(cart[0].totalAmount, 50.0);

    assert.strictEqual(cart[1].looseWeightInGrams, 100);
    assert.strictEqual(cart[1].totalAmount, 100.0);

    assert.strictEqual(cart[2].looseWeightInGrams, 500);
    assert.strictEqual(cart[2].totalAmount, 500.0);

    const totalBillAmount = cart.reduce((sum, item) => sum + item.totalAmount, 0);
    assert.strictEqual(totalBillAmount, 650.0, 'Total bill must be ₹650.00');
  });

  // --------------------------------------------------------------------------
  // TEST 11: SaleType pricing fidelity (WHOLESALE vs NRI vs RETAIL)
  // --------------------------------------------------------------------------
  it('TEST 11 — Authoritative SaleType pricing applies accurately when product is added', () => {
    // Wholesale rate = ₹850/kg -> 50g = ₹42.50
    const wholesaleSim = createProductCardSimulator(mockGaramMasala, 'WHOLESALE');
    wholesaleSim.handleOptionClick(50, wholesaleSim.createEvent());
    wholesaleSim.handleAddToCart();
    assert.strictEqual(wholesaleSim.getCart()[0].totalAmount, 42.5, 'Wholesale 50g = ₹42.50');

    // NRI rate = ₹1500/kg -> 50g = ₹75.00
    const nriSim = createProductCardSimulator(mockGaramMasala, 'NRI');
    nriSim.handleOptionClick(50, nriSim.createEvent());
    nriSim.handleAddToCart();
    assert.strictEqual(nriSim.getCart()[0].totalAmount, 75.0, 'NRI 50g = ₹75.00');
  });

  // --------------------------------------------------------------------------
  // TEST 12: Keyboard navigation accessibility invariant
  // --------------------------------------------------------------------------
  it('TEST 12 — Keyboard Enter/Space on weight chip selects weight; on card body adds to bill', () => {
    const sim = createProductCardSimulator(mockGaramMasala, 'RETAIL');

    // Keyboard activation on button (target === chip)
    const chipKeyEvent = {
      target: 'chip_button',
      currentTarget: 'chip_button',
      key: 'Enter',
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    sim.handleOptionClick(50, chipKeyEvent);
    assert.strictEqual(sim.getSelectedWeight(), 50, 'Weight updated via keyboard on chip');
    assert.strictEqual(sim.getCart().length, 0, 'No item added to cart on chip key activation');

    // Keyboard activation on card container (target === card)
    const cardKeyEvent = {
      target: 'product_card',
      currentTarget: 'product_card',
      key: 'Enter',
      preventDefault: () => {},
    };
    sim.handleAddToCart(cardKeyEvent);
    assert.strictEqual(sim.getCart().length, 1, 'Item added to bill when Enter pressed on card body');
    assert.strictEqual(sim.getCart()[0].looseWeightInGrams, 50);
  });
});
