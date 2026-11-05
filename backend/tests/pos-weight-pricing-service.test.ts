import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../src/config/database.js';
import { PricingService } from '../src/modules/pricing/pricing.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { SaleType, CustomerType, PaymentMode } from '@prisma/client';

describe('Backend — PricingService Authoritative Weight & Pack Resolution Real Execution Suite', () => {
  let masalaProduct: any = null;
  const ts = Date.now();
  let strictPackOnlyProduct: any = null;
  let testSaleId: string | null = null;
  let initialMasalaStock: number | null = null;

  before(async () => {
    // Locate the actual 3-in-1 Garam Masala in the database
    masalaProduct = await prisma.product.findFirst({
      where: { code: 'MASALA_3IN1_GARAM' },
      include: {
        packConfigurations: true,
        prices: true,
      },
    });

    // Create a temporary test product that has isLooseWeightAllowed: false
    const primaryUnit = await prisma.unit.findFirst();
    const subcategory = await prisma.subcategory.findFirst();
    if (primaryUnit && subcategory) {
      strictPackOnlyProduct = await prisma.product.create({
        data: {
          name: `Strict Pack Product ${ts}`,
          code: `STRICT_PACK_${ts}`,
          isLooseWeightAllowed: false,
          primaryUnitId: primaryUnit.id,
          subcategoryId: subcategory.id,
          isActive: true,
        },
      });

      // Add a pack configuration with no price
      const unpricedPack = await prisma.productPackConfiguration.create({
        data: {
          productId: strictPackOnlyProduct.id,
          packName: 'Unpriced 250g Pack',
          weightInBaseUnits: 250,
          unitId: primaryUnit.id,
          displayOrder: 1,
          isActive: true,
        },
      });
      strictPackOnlyProduct.unpricedPackId = unpricedPack.id;
    }
  });

  after(async () => {
    if (testSaleId) {
      await prisma.stockMovement.deleteMany({ where: { referenceId: testSaleId } });
      await prisma.payment.deleteMany({ where: { saleId: testSaleId } });
      await prisma.saleItem.deleteMany({ where: { saleId: testSaleId } });
      await prisma.sale.delete({ where: { id: testSaleId } });
    }
    if (masalaProduct && initialMasalaStock !== null) {
      await prisma.stock.update({
        where: { productId: masalaProduct.id },
        data: { currentBalance: initialMasalaStock },
      });
    }
    if (strictPackOnlyProduct) {
      await prisma.productPackConfiguration.deleteMany({ where: { productId: strictPackOnlyProduct.id } });
      await prisma.productPrice.deleteMany({ where: { productId: strictPackOnlyProduct.id } });
      await prisma.product.delete({ where: { id: strictPackOnlyProduct.id } });
    }
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // 1. Masala Product Verification
  // -------------------------------------------------------------------------
  it('1. Confirms MASALA_3IN1_GARAM exists with duplicate 100g pack configurations', () => {
    assert.ok(masalaProduct, 'MASALA_3IN1_GARAM product must exist in database');
    const pack100s = masalaProduct.packConfigurations.filter((p: any) => Number(p.weightInBaseUnits) === 100);
    assert.strictEqual(pack100s.length, 2, 'MASALA_3IN1_GARAM must have exactly 2 duplicate 100g pack configurations in master data');

    const pricedPack = masalaProduct.prices.find((pr: any) => pr.packConfigId !== null);
    assert.ok(pricedPack, 'Must have a priced pack record');
  });

  // -------------------------------------------------------------------------
  // 2. Select 100g via the UNPRICED duplicate packConfigId
  // -------------------------------------------------------------------------
  it('2. PricingService.resolveApplicablePrice: Resolves ₹100.00 even when caller passes unpriced duplicate pack ID', async () => {
    const unpricedPack = masalaProduct.packConfigurations.find(
      (p: any) => Number(p.weightInBaseUnits) === 100 && !masalaProduct.prices.some((pr: any) => pr.packConfigId === p.id)
    );
    assert.ok(unpricedPack, 'Must identify the unpriced duplicate pack');

    const result = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: unpricedPack.id, // Pass the UNPRICED pack ID
      quantity: 1,
      saleType: SaleType.RETAIL,
    });

    assert.strictEqual(result.unitRate, 100, 'Must resolve unitRate to ₹100 (via alternative duplicate pack)');
    assert.strictEqual(result.totalAmount, 100, 'Must resolve totalAmount to ₹100.00, NOT ₹1,000.00');
  });

  // -------------------------------------------------------------------------
  // 3. Select 100g via the PRICED packConfigId
  // -------------------------------------------------------------------------
  it('3. PricingService.resolveApplicablePrice: Resolves ₹100.00 for the priced 100g pack config', async () => {
    const pricedPack = masalaProduct.packConfigurations.find(
      (p: any) => Number(p.weightInBaseUnits) === 100 && masalaProduct.prices.some((pr: any) => pr.packConfigId === p.id)
    );
    assert.ok(pricedPack, 'Must identify the priced pack');

    const result = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: pricedPack.id,
      quantity: 1,
      saleType: SaleType.RETAIL,
    });

    assert.strictEqual(result.unitRate, 100);
    assert.strictEqual(result.totalAmount, 100);
  });

  // -------------------------------------------------------------------------
  // 4. Loose weight pricing (50g, 200g, 500g, 1000g)
  // -------------------------------------------------------------------------
  it('4. PricingService.resolveApplicablePrice: Loose weights calculate proportionally from per-kg base rate (₹1,000/kg)', async () => {
    // 50g -> ₹50
    const res50g = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: null,
      looseWeightInGrams: 50,
      quantity: 1,
      saleType: SaleType.RETAIL,
    });
    assert.strictEqual(res50g.totalAmount, 50.00, '50g must be ₹50.00');
    assert.strictEqual(res50g.baseWeightDeducted, 50);

    // 200g -> ₹200
    const res200g = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: null,
      looseWeightInGrams: 200,
      quantity: 1,
      saleType: SaleType.RETAIL,
    });
    assert.strictEqual(res200g.totalAmount, 200.00, '200g must be ₹200.00');
    assert.strictEqual(res200g.baseWeightDeducted, 200);

    // 500g -> ₹500
    const res500g = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: null,
      looseWeightInGrams: 500,
      quantity: 1,
      saleType: SaleType.RETAIL,
    });
    assert.strictEqual(res500g.totalAmount, 500.00, '500g must be ₹500.00');
    assert.strictEqual(res500g.baseWeightDeducted, 500);

    // 1000g (1kg) -> ₹1,000
    const res1kg = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: null,
      looseWeightInGrams: 1000,
      quantity: 1,
      saleType: SaleType.RETAIL,
    });
    assert.strictEqual(res1kg.totalAmount, 1000.00, '1kg must be ₹1,000.00');
    assert.strictEqual(res1kg.baseWeightDeducted, 1000);
  });

  // -------------------------------------------------------------------------
  // 5. Quantity > 1 calculation
  // -------------------------------------------------------------------------
  it('5. PricingService.resolveApplicablePrice: Multi-quantity calculation for 100g pack and 50g loose', async () => {
    // 3 x 100g pack = ₹300, stock deduction = 300g
    const res3Packs = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: masalaProduct.packConfigurations[0].id,
      quantity: 3,
      saleType: SaleType.RETAIL,
    });
    assert.strictEqual(res3Packs.totalAmount, 300.00);
    assert.strictEqual(res3Packs.baseWeightDeducted, 300);

    // 4 x 50g loose = ₹200, stock deduction = 200g
    const res4Loose = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: null,
      looseWeightInGrams: 50,
      quantity: 4,
      saleType: SaleType.RETAIL,
    });
    assert.strictEqual(res4Loose.totalAmount, 200.00);
    assert.strictEqual(res4Loose.baseWeightDeducted, 200);
  });

  // -------------------------------------------------------------------------
  // 6. NRI & Wholesale Tiers via PricingService
  // -------------------------------------------------------------------------
  it('6. PricingService.resolveApplicablePrice: NRI and WHOLESALE tiers resolve correctly', async () => {
    // NRI: 100g pack rate is ₹150
    const resNri = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: masalaProduct.packConfigurations[0].id,
      quantity: 1,
      saleType: SaleType.NRI,
    });
    assert.strictEqual(resNri.totalAmount, 150.00, 'NRI 100g pack must be ₹150.00');

    // WHOLESALE: 100g pack rate is ₹100
    const resWholesale = await PricingService.resolveApplicablePrice({
      productId: masalaProduct.id,
      packConfigId: masalaProduct.packConfigurations[0].id,
      quantity: 1,
      saleType: SaleType.WHOLESALE,
    });
    assert.strictEqual(resWholesale.totalAmount, 100.00, 'Wholesale 100g pack must be ₹100.00');
  });

  // -------------------------------------------------------------------------
  // 7. Authoritative Cart Resolution (PricingService.resolveCart)
  // -------------------------------------------------------------------------
  it('7. PricingService.resolveCart: Authoritative cart resolution aggregates line items, rounding and subtotal', async () => {
    const cartResult = await PricingService.resolveCart({
      customerType: CustomerType.INDIAN,
      saleType: SaleType.RETAIL,
      items: [
        { productId: masalaProduct.id, packConfigId: masalaProduct.packConfigurations[0].id, quantity: 2 }, // 2 x 100 = 200
        { productId: masalaProduct.id, packConfigId: null, looseWeightInGrams: 50, quantity: 1 },           // 1 x 50 = 50
        { productId: masalaProduct.id, packConfigId: null, looseWeightInGrams: 200, quantity: 1 },          // 1 x 200 = 200
      ],
    });

    assert.strictEqual(cartResult.items.length, 3);
    assert.strictEqual(cartResult.subtotalAmount, 450.00, 'Cart subtotal must be ₹450.00 (200 + 50 + 200)');
    assert.strictEqual(cartResult.finalTotalAmount, 450, 'Final total must be ₹450');
  });

  // -------------------------------------------------------------------------
  // 8. Strict Fallback Safety: Loose weight not allowed -> Error, not silent price
  // -------------------------------------------------------------------------
  it('8. Fallback Safety: Loose weight selling throws BadRequestError when not allowed on product', async () => {
    if (!strictPackOnlyProduct) return;

    await assert.rejects(
      async () => {
        await PricingService.resolveApplicablePrice({
          productId: strictPackOnlyProduct.id,
          packConfigId: null,
          looseWeightInGrams: 100,
          quantity: 1,
          saleType: SaleType.RETAIL,
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('Loose weight selling is not allowed'));
        return true;
      }
    );
  });

  // -------------------------------------------------------------------------
  // 9. Strict Fallback Safety: Missing pack price -> Error, never silent substitution
  // -------------------------------------------------------------------------
  it('9. Fallback Safety: Missing pack price throws BadRequestError instead of substituting a fabricated price', async () => {
    if (!strictPackOnlyProduct) return;

    await assert.rejects(
      async () => {
        await PricingService.resolveApplicablePrice({
          productId: strictPackOnlyProduct.id,
          packConfigId: strictPackOnlyProduct.unpricedPackId,
          quantity: 1,
          saleType: SaleType.RETAIL,
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('PRICE_NOT_CONFIGURED'));
        return true;
      }
    );
  });

  // -------------------------------------------------------------------------
  // 10. End-to-End Sale Persistence Flow
  // -------------------------------------------------------------------------
  it('10. End-to-End Sale Persistence: Creates actual sale and verifies sale_items columns in database', async () => {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
    assert.ok(adminUser, 'Admin user must exist to execute createSale');

    const currentStockRec = await prisma.stock.findUnique({ where: { productId: masalaProduct.id } });
    initialMasalaStock = currentStockRec ? Number(currentStockRec.currentBalance) : 50000;

    const unpricedPack = masalaProduct.packConfigurations.find(
      (p: any) => Number(p.weightInBaseUnits) === 100 && !masalaProduct.prices.some((pr: any) => pr.packConfigId === p.id)
    );
    assert.ok(unpricedPack, 'Must identify unpriced pack');

    // Create sale with 100g pack (₹100) + 50g loose (₹50) = ₹150 total
    const saleResult: any = await SalesService.createSale(
      adminUser.id,
      adminUser.role,
      {
        saleType: SaleType.RETAIL,
        customerType: CustomerType.INDIAN,
        paidAmount: 150,
        payments: [{ paymentMode: PaymentMode.CASH, amount: 150 }],
        items: [
          { productId: masalaProduct.id, packConfigId: unpricedPack.id, quantity: 1 },
          { productId: masalaProduct.id, packConfigId: null, looseWeightInGrams: 50, quantity: 1 },
        ],
      },
      '127.0.0.1'
    );

    assert.ok(saleResult);
    testSaleId = saleResult.id;

    assert.strictEqual(Number(saleResult.finalTotalAmount), 150.00, 'Sale finalTotalAmount must be ₹150.00');

    // Query persisted sale_items directly from Postgres
    const persistedItems = await prisma.saleItem.findMany({
      where: { saleId: saleResult.id },
      orderBy: { weightOrPackSnapshot: 'asc' },
    });

    assert.strictEqual(persistedItems.length, 2, 'Must have 2 persisted sale_items rows');

    const packItem = persistedItems.find((i: any) => i.packConfigId !== null);
    const looseItem = persistedItems.find((i: any) => i.packConfigId === null);

    assert.ok(packItem, 'Pack sale_item must exist');
    assert.strictEqual(packItem.productId, masalaProduct.id);
    assert.strictEqual(Number(packItem.unitRate), 100.00, 'Pack unitRate must be ₹100.00');
    assert.strictEqual(Number(packItem.quantity), 1);
    assert.strictEqual(Number(packItem.total), 100.00, 'Pack total must be ₹100.00');
    assert.strictEqual(Number(packItem.baseWeightDeducted), 100.000, 'Base weight deducted must be 100g');

    assert.ok(looseItem, 'Loose sale_item must exist');
    assert.strictEqual(looseItem.productId, masalaProduct.id);
    assert.strictEqual(Number(looseItem.unitRate), 1000.00, 'Loose unitRate must be base rate ₹1000.00/kg');
    assert.strictEqual(Number(looseItem.quantity), 1);
    assert.strictEqual(Number(looseItem.total), 50.00, 'Loose total must be ₹50.00');
    assert.strictEqual(Number(looseItem.baseWeightDeducted), 50.000, 'Base weight deducted must be 50g');
  });

  // -------------------------------------------------------------------------
  // 11. Effective-Date Pricing: Rejects Expired Price Records
  // -------------------------------------------------------------------------
  it('11. Effective-Date Pricing: Price with effectiveTo in the past is rejected', async () => {
    // Create a temporary price on strictPackOnlyProduct with effectiveTo in past
    const primaryUnit = await prisma.unit.findFirst();
    const expiredPrice = await prisma.productPrice.create({
      data: {
        productId: strictPackOnlyProduct.id,
        packConfigId: strictPackOnlyProduct.unpricedPackId,
        pricingTier: SaleType.RETAIL,
        rate: 55,
        isActive: true,
        effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        effectiveTo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired
      },
    });

    try {
      await assert.rejects(
        async () => {
          await PricingService.resolveApplicablePrice({
            productId: strictPackOnlyProduct.id,
            packConfigId: strictPackOnlyProduct.unpricedPackId,
            quantity: 1,
            saleType: SaleType.RETAIL,
          });
        },
        (err: any) => {
          assert.ok(err.message.includes('PRICE_NOT_CONFIGURED'), 'Must reject because expired price cannot be used');
          return true;
        }
      );
    } finally {
      await prisma.productPrice.delete({ where: { id: expiredPrice.id } });
    }
  });

  // -------------------------------------------------------------------------
  // 12. Effective-Date Pricing: Rejects Future-Dated Price Records
  // -------------------------------------------------------------------------
  it('12. Effective-Date Pricing: Price with effectiveFrom in the future is not applied', async () => {
    // Create a current price (rate 70) and a future price (rate 99)
    const currentPrice = await prisma.productPrice.create({
      data: {
        productId: strictPackOnlyProduct.id,
        packConfigId: strictPackOnlyProduct.unpricedPackId,
        pricingTier: SaleType.RETAIL,
        rate: 70,
        isActive: true,
        effectiveFrom: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        effectiveTo: null,
      },
    });

    const futurePrice = await prisma.productPrice.create({
      data: {
        productId: strictPackOnlyProduct.id,
        packConfigId: strictPackOnlyProduct.unpricedPackId,
        pricingTier: SaleType.RETAIL,
        rate: 99,
        isActive: true,
        effectiveFrom: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Future
        effectiveTo: null,
      },
    });

    try {
      const res = await PricingService.resolveApplicablePrice({
        productId: strictPackOnlyProduct.id,
        packConfigId: strictPackOnlyProduct.unpricedPackId,
        quantity: 1,
        saleType: SaleType.RETAIL,
      });

      assert.strictEqual(res.unitRate, 70, 'Must pick current active price (₹70), NOT future price (₹99)');
    } finally {
      await prisma.productPrice.deleteMany({
        where: { id: { in: [currentPrice.id, futurePrice.id] } },
      });
    }
  });
});
