import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { CustomerType, SaleType, Prisma } from '@prisma/client';
import {
  CreatePriceInput,
  UpdatePriceInput,
  ResolvePriceInput,
  ResolvePricesInput,
  PriceQueryInput,
} from './pricing.validation.js';
import { AuditService } from '../audit/audit.service.js';
import {
  mapSaleTypeToPricingTier,
  ResolvedItemOutput,
  ResolvedCartOutput,
} from './pricing.types.js';

export { ResolvedItemOutput, ResolvedCartOutput };

export class PricingService {
  /**
   * Helper: Validates whether a given date range overlaps with existing active price records
   * for the same product, pack variant, and pricing tier.
   */
  static async checkDateOverlap(
    tx: Prisma.TransactionClient,
    productId: string,
    packConfigId: string | null | undefined,
    pricingTier: SaleType,
    effectiveFrom: Date,
    effectiveTo: Date | null | undefined,
    excludePriceId?: string
  ): Promise<void> {
    const fromTime = effectiveFrom.getTime();
    const toTime = effectiveTo ? effectiveTo.getTime() : null;

    if (toTime !== null && toTime <= fromTime) {
      throw new BadRequestError('effectiveTo must be strictly after effectiveFrom');
    }

    // Find all active prices for same product + pack variant + pricing tier
    const existingPrices = await tx.productPrice.findMany({
      where: {
        productId,
        packConfigId: packConfigId ?? null,
        pricingTier,
        isActive: true,
        ...(excludePriceId ? { id: { not: excludePriceId } } : {}),
      },
    });

    for (const ep of existingPrices) {
      const epFromTime = new Date(ep.effectiveFrom).getTime();
      const epToTime = ep.effectiveTo ? new Date(ep.effectiveTo).getTime() : null;

      // Overlap condition:
      // Ep starts before candidate ends (or candidate never ends)
      // AND Candidate starts before Ep ends (or Ep never ends)
      const candidateEndsAfterEpStarts = toTime === null || toTime >= epFromTime;
      const epEndsAfterCandidateStarts = epToTime === null || epToTime >= fromTime;

      if (candidateEndsAfterEpStarts && epEndsAfterCandidateStarts) {
        throw new BadRequestError(
          `Overlapping effective price period detected for product, variant, and ${pricingTier} tier (conflicts with existing price from ${new Date(ep.effectiveFrom).toISOString()})`
        );
      }
    }
  }

  /**
   * Admin: Create a new price record with overlap check and audit logging.
   */
  static async createPrice(
    input: CreatePriceInput,
    userId?: string | null,
    userRole: string = 'ADMIN',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify product exists
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        include: { primaryUnit: true },
      });
      if (!product) {
        throw new NotFoundError('Product not found');
      }

      // 2. Verify pack config if provided
      if (input.packConfigId) {
        const packConfig = await tx.productPackConfiguration.findUnique({
          where: { id: input.packConfigId },
        });
        if (!packConfig || packConfig.productId !== input.productId) {
          throw new BadRequestError('Pack configuration does not belong to this product');
        }
      }

      const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
      const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

      // Authoritative pricing tier resolution (with legacy customerType support)
      const pricingTier =
        input.pricingTier ??
        (input.customerType === CustomerType.NRI ? SaleType.NRI : SaleType.RETAIL);

      // 3. Overlap validation
      await this.checkDateOverlap(
        tx,
        input.productId,
        input.packConfigId ?? null,
        pricingTier,
        effectiveFrom,
        effectiveTo
      );

      // 4. Create price record
      const newPrice = await tx.productPrice.create({
        data: {
          productId: input.productId,
          packConfigId: input.packConfigId ?? null,
          pricingTier,
          rate: new Prisma.Decimal(input.rate),
          effectiveFrom,
          effectiveTo,
          isActive: input.isActive ?? true,
          createdById: userId ?? null,
        },
        include: {
          product: { select: { id: true, name: true, code: true } },
          packConfig: true,
          createdBy: { select: { id: true, username: true, fullName: true, role: true } },
        },
      });

      // 5. Audit log
      await AuditService.log({
        userId,
        userRole,
        action: 'CREATE',
        entityType: 'PRODUCT_PRICE',
        entityId: newPrice.id,
        newValues: {
          productId: newPrice.productId,
          packConfigId: newPrice.packConfigId,
          pricingTier: newPrice.pricingTier,
          rate: Number(newPrice.rate),
          effectiveFrom: newPrice.effectiveFrom,
          effectiveTo: newPrice.effectiveTo,
        },
        ipAddress,
      });

      return newPrice;
    });
  }

  /**
   * Admin: Update an existing price record with overlap validation and audit logging.
   */
  static async updatePrice(
    priceId: string,
    input: UpdatePriceInput,
    userId?: string | null,
    userRole: string = 'ADMIN',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productPrice.findUnique({
        where: { id: priceId },
      });
      if (!existing) {
        throw new NotFoundError('Price record not found');
      }

      const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : existing.effectiveFrom;
      const effectiveTo =
        input.effectiveTo !== undefined
          ? input.effectiveTo
            ? new Date(input.effectiveTo)
            : null
          : existing.effectiveTo;

      // Check overlap if dates or active status changed
      if (input.effectiveFrom || input.effectiveTo !== undefined || input.isActive === true) {
        await this.checkDateOverlap(
          tx,
          existing.productId,
          existing.packConfigId,
          existing.pricingTier,
          effectiveFrom,
          effectiveTo,
          existing.id
        );
      }

      const updated = await tx.productPrice.update({
        where: { id: priceId },
        data: {
          ...(input.rate !== undefined ? { rate: new Prisma.Decimal(input.rate) } : {}),
          ...(input.effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(input.effectiveTo !== undefined ? { effectiveTo } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: {
          product: { select: { id: true, name: true, code: true } },
          packConfig: true,
          createdBy: { select: { id: true, username: true, fullName: true, role: true } },
        },
      });

      // Audit log
      await AuditService.log({
        userId,
        userRole,
        action: 'UPDATE',
        entityType: 'PRODUCT_PRICE',
        entityId: updated.id,
        oldValues: {
          rate: Number(existing.rate),
          effectiveFrom: existing.effectiveFrom,
          effectiveTo: existing.effectiveTo,
          isActive: existing.isActive,
        },
        newValues: {
          rate: Number(updated.rate),
          effectiveFrom: updated.effectiveFrom,
          effectiveTo: updated.effectiveTo,
          isActive: updated.isActive,
        },
        ipAddress,
      });

      return updated;
    });
  }

  /**
   * Admin: Toggle active status of a price.
   */
  static async togglePriceStatus(
    priceId: string,
    isActive: boolean,
    userId?: string | null,
    userRole: string = 'ADMIN',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productPrice.findUnique({ where: { id: priceId } });
      if (!existing) {
        throw new NotFoundError('Price record not found');
      }

      if (isActive && !existing.isActive) {
        // Check for overlap before reactivating
        await this.checkDateOverlap(
          tx,
          existing.productId,
          existing.packConfigId,
          existing.pricingTier,
          existing.effectiveFrom,
          existing.effectiveTo,
          existing.id
        );
      }

      const updated = await tx.productPrice.update({
        where: { id: priceId },
        data: { isActive },
      });

      await AuditService.log({
        userId,
        userRole,
        action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
        entityType: 'PRODUCT_PRICE',
        entityId: updated.id,
        oldValues: { isActive: existing.isActive },
        newValues: { isActive: updated.isActive },
        ipAddress,
      });

      return updated;
    });
  }

  /**
   * Core Reusable Engine: Resolve single item applicable price.
   *
   * STRICT RULES:
   * - Inactive product cannot be selected -> 400 Bad Request
   * - Missing Wholesale price -> 400 Bad Request ("WHOLESALE_PRICE_NOT_CONFIGURED")
   * - Missing NRI price -> 400 Bad Request ("NRI_PRICE_NOT_CONFIGURED")
   * - Missing Retail price -> 400 Bad Request ("RETAIL_PRICE_NOT_CONFIGURED")
   * - Never fallback to another tier!
   * - Respects targetDate vs [effectiveFrom, effectiveTo]
   */
  static async resolveApplicablePrice(input: ResolvePriceInput): Promise<ResolvedItemOutput> {
    const targetDate = input.targetDate ? new Date(input.targetDate) : new Date();

    // 1. Verify product existence & active status
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        primaryUnit: true,
        packConfigurations: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestError(`Product "${product.name}" is inactive and cannot be selected for pricing or sale`);
    }

    let packConfig: any = null;
    let baseWeightDeducted = 0;
    let weightOrPackName = '';
    const quantity = input.quantity || 1;

    if (input.packConfigId) {
      packConfig = product.packConfigurations.find((p) => p.id === input.packConfigId);
      if (!packConfig || !packConfig.isActive) {
        throw new BadRequestError(`Invalid or inactive pack configuration for product: ${product.name}`);
      }
      weightOrPackName = packConfig.packName;
      baseWeightDeducted = Number(packConfig.weightInBaseUnits) * quantity;
    } else if (input.looseWeightInGrams) {
      if (!product.isLooseWeightAllowed) {
        throw new BadRequestError(`Loose weight selling is not allowed for product: ${product.name}`);
      }
      weightOrPackName =
        input.looseWeightInGrams >= 1000
          ? `${input.looseWeightInGrams / 1000} kg`
          : `${input.looseWeightInGrams}g`;
      baseWeightDeducted = input.looseWeightInGrams * quantity;
    } else {
      weightOrPackName = `${quantity} ${product.primaryUnit.symbol}`;
      baseWeightDeducted = quantity;
    }

    // Resolve authoritative pricing tier (with legacy customerType fallback if saleType/pricingTier omitted)
    const resolvedSaleType: SaleType =
      input.saleType ??
      input.pricingTier ??
      (input.customerType === CustomerType.NRI ? SaleType.NRI : SaleType.RETAIL);

    const pricingTier = mapSaleTypeToPricingTier(resolvedSaleType);

    // 2. Query applicable price matching pricing tier & target date
    const priceRecord = await prisma.productPrice.findFirst({
      where: {
        productId: product.id,
        packConfigId: input.packConfigId ?? null,
        pricingTier,
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // 3. STRICT RULE: NO FALLBACK TO ANOTHER TIER!
    if (!priceRecord) {
      if (pricingTier === SaleType.WHOLESALE) {
        throw new BadRequestError('WHOLESALE_PRICE_NOT_CONFIGURED: Applicable Wholesale price is not configured for this product');
      } else if (pricingTier === SaleType.NRI) {
        throw new BadRequestError('NRI_PRICE_NOT_CONFIGURED: Applicable NRI price is not configured for this product');
      } else {
        throw new BadRequestError('RETAIL_PRICE_NOT_CONFIGURED: Applicable Retail price is not configured for this product');
      }
    }

    const unitRate = Number(priceRecord.rate);
    let totalAmount = 0;

    if (input.looseWeightInGrams) {
      // Loose calculation: (grams / 1000) * base per-kg rate * quantity
      totalAmount = Math.round(((input.looseWeightInGrams / 1000) * unitRate * quantity) * 100) / 100;
    } else {
      totalAmount = Math.round(unitRate * quantity * 100) / 100;
    }

    return {
      productId: product.id,
      productName: product.name,
      gujaratiName: product.gujaratiName,
      packConfigId: input.packConfigId ?? null,
      weightOrPackName,
      unitSymbol: product.primaryUnit.symbol,
      quantity,
      baseWeightDeducted,
      unitRate,
      totalAmount,
      pricingTier,
      saleType: resolvedSaleType,
      effectiveFrom: priceRecord.effectiveFrom,
      effectiveTo: priceRecord.effectiveTo,
      priceId: priceRecord.id,
    };
  }

  /**
   * Authoritative Cart Price Resolver:
   * Resolves exact rates for all items in a cart based on authoritative SaleType.
   * CustomerType remains demographic only.
   */
  static async resolveCart(input: ResolvePricesInput): Promise<ResolvedCartOutput> {
    // Authoritative saleType resolution
    // Legacy fallback ONLY if saleType is omitted: CustomerType.NRI -> SaleType.NRI else SaleType.RETAIL
    const resolvedSaleType: SaleType =
      input.saleType ??
      (input.customerType === CustomerType.NRI ? SaleType.NRI : SaleType.RETAIL);

    // Demographic resolution (remains CustomerType INDIAN / NRI)
    let customerType: CustomerType = input.customerType || CustomerType.INDIAN;
    let customerId = input.customerId || null;
    let customerName = 'Walk-in Customer';
    let customerMobile: string | null = null;
    let customerGstin: string | null = null;

    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }
      customerType = customer.customerType;
      customerName = customer.name;
      customerMobile = customer.mobile;
      customerGstin = customer.gstin;
    } else {
      // Find or fallback to walk-in customer based on demographic customerType
      const defaultCustomer =
        (await prisma.customer.findFirst({
          where: { customerType, name: { contains: 'Walk-in' } },
        })) ||
        (await prisma.customer.findFirst({
          where: { name: 'Walk-in Customer' },
        })) ||
        (await prisma.customer.findFirst());

      if (defaultCustomer) {
        customerId = defaultCustomer.id;
        customerName = defaultCustomer.name;
        customerMobile = defaultCustomer.mobile;
        customerGstin = defaultCustomer.gstin;
      } else {
        const created = await prisma.customer.create({
          data: {
            name: customerType === CustomerType.NRI ? 'NRI Walk-in Customer' : 'Walk-in Customer',
            customerType,
          },
        });
        customerId = created.id;
        customerName = created.name;
        customerGstin = created.gstin;
      }
    }

    const resolvedItems: ResolvedItemOutput[] = [];
    let subtotalAmount = 0;

    for (const item of input.items) {
      const resolved = await this.resolveApplicablePrice({
        productId: item.productId,
        saleType: resolvedSaleType,
        packConfigId: item.packConfigId ?? null,
        quantity: item.quantity,
        looseWeightInGrams: item.looseWeightInGrams ?? null,
        targetDate: input.targetDate,
      });

      subtotalAmount += resolved.totalAmount;
      resolvedItems.push(resolved);
    }

    // Preserve existing monetary rounding:
    // Subtotal rounded to 2 decimals
    // Final total amount rounded to nearest integer rupee (ROUND_HALF_UP) as approved in BD-4
    subtotalAmount = Math.round(subtotalAmount * 100) / 100;
    const finalTotalAmount = Math.round(subtotalAmount);

    return {
      customerId,
      customerType,
      saleType: resolvedSaleType,
      customerName,
      customerMobile,
      customerGstin,
      items: resolvedItems,
      subtotalAmount,
      finalTotalAmount,
    };
  }

  /**
   * Admin / Outlet: Retrieve current applicable prices for a product or variant.
   */
  static async getCurrentPrices(query: PriceQueryInput) {
    const targetDate = query.date ? new Date(query.date) : new Date();

    const pricingTier =
      query.pricingTier ??
      (query.customerType ? (query.customerType === 'NRI' ? SaleType.NRI : SaleType.RETAIL) : undefined);

    const where: Prisma.ProductPriceWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(pricingTier ? { pricingTier } : {}),
      ...(query.packConfigId !== undefined ? { packConfigId: query.packConfigId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : { isActive: true }),
      effectiveFrom: { lte: targetDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
    };

    return prisma.productPrice.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { pricingTier: 'asc' }, { effectiveFrom: 'desc' }],
      include: {
        product: { select: { id: true, name: true, code: true, isActive: true } },
        packConfig: true,
      },
    });
  }

  /**
   * Admin: View chronological price history for a product.
   */
  static async getPriceHistory(
    productId: string,
    tierOrCustomerType?: SaleType | CustomerType
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    let pricingTier: SaleType | undefined;
    if (tierOrCustomerType) {
      if (tierOrCustomerType === CustomerType.INDIAN) {
        pricingTier = SaleType.RETAIL;
      } else if (tierOrCustomerType === CustomerType.NRI) {
        pricingTier = SaleType.NRI;
      } else {
        pricingTier = tierOrCustomerType as SaleType;
      }
    }

    return prisma.productPrice.findMany({
      where: {
        productId,
        ...(pricingTier ? { pricingTier } : {}),
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: {
        packConfig: true,
        createdBy: { select: { id: true, username: true, fullName: true, role: true } },
      },
    });
  }

  /**
   * Admin: Atomic batch creation/update of prices.
   * If any item fails validation or overlap, entire batch rolls back completely.
   */
  static async batchUpdatePrices(
    prices: CreatePriceInput[],
    userId?: string | null,
    userRole: string = 'ADMIN',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of prices) {
        // Validate product
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new NotFoundError(`Product ${item.productId} not found`);
        }

        if (item.packConfigId) {
          const pack = await tx.productPackConfiguration.findUnique({ where: { id: item.packConfigId } });
          if (!pack || pack.productId !== item.productId) {
            throw new BadRequestError(`Pack configuration does not belong to product ${item.productId}`);
          }
        }

        const effectiveFrom = item.effectiveFrom ? new Date(item.effectiveFrom) : new Date();
        const effectiveTo = item.effectiveTo ? new Date(item.effectiveTo) : null;

        const pricingTier =
          item.pricingTier ??
          (item.customerType === CustomerType.NRI ? SaleType.NRI : SaleType.RETAIL);

        // Overlap check
        await this.checkDateOverlap(
          tx,
          item.productId,
          item.packConfigId ?? null,
          pricingTier,
          effectiveFrom,
          effectiveTo
        );

        const created = await tx.productPrice.create({
          data: {
            productId: item.productId,
            packConfigId: item.packConfigId ?? null,
            pricingTier,
            rate: new Prisma.Decimal(item.rate),
            effectiveFrom,
            effectiveTo,
            isActive: item.isActive ?? true,
            createdById: userId ?? null,
          },
        });

        results.push(created);
      }

      // Audit batch operation
      await AuditService.log({
        userId,
        userRole,
        action: 'BATCH_CREATE_PRICES',
        entityType: 'PRODUCT_PRICE',
        entityId: 'BATCH',
        newValues: { count: results.length, priceIds: results.map((r) => r.id) },
        ipAddress,
      });

      return results;
    });
  }
}
