import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { CustomerType, Prisma } from '@prisma/client';
import {
  CreatePriceInput,
  UpdatePriceInput,
  ResolvePriceInput,
  ResolvePricesInput,
  PriceQueryInput,
} from './pricing.validation.js';
import { AuditService } from '../audit/audit.service.js';

export interface ResolvedItemOutput {
  productId: string;
  productName: string;
  gujaratiName?: string | null;
  packConfigId?: string | null;
  weightOrPackName: string;
  unitSymbol: string;
  quantity: number;
  baseWeightDeducted: number; // In base units (Grams or Pieces)
  unitRate: number; // Snapshot authoritative rate
  totalAmount: number;
  customerType: CustomerType;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  priceId: string;
}

export interface ResolvedCartOutput {
  customerId: string;
  customerType: CustomerType;
  customerName: string;
  customerMobile?: string | null;
  items: ResolvedItemOutput[];
  subtotalAmount: number;
  finalTotalAmount: number;
}

export class PricingService {
  /**
   * Helper: Validates whether a given date range overlaps with existing active price records
   * for the same product, pack variant, and customer tier.
   */
  static async checkDateOverlap(
    tx: Prisma.TransactionClient,
    productId: string,
    packConfigId: string | null | undefined,
    customerType: CustomerType,
    effectiveFrom: Date,
    effectiveTo: Date | null | undefined,
    excludePriceId?: string
  ): Promise<void> {
    const fromTime = effectiveFrom.getTime();
    const toTime = effectiveTo ? effectiveTo.getTime() : null;

    if (toTime !== null && toTime <= fromTime) {
      throw new BadRequestError('effectiveTo must be strictly after effectiveFrom');
    }

    // Find all active prices for same product + pack variant + customer tier
    const existingPrices = await tx.productPrice.findMany({
      where: {
        productId,
        packConfigId: packConfigId ?? null,
        customerType,
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
          `Overlapping effective price period detected for product, variant, and ${customerType} tier (conflicts with existing price from ${new Date(ep.effectiveFrom).toISOString()})`
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

      // 3. Overlap validation
      await this.checkDateOverlap(
        tx,
        input.productId,
        input.packConfigId ?? null,
        input.customerType,
        effectiveFrom,
        effectiveTo
      );

      // 4. Create price record
      const newPrice = await tx.productPrice.create({
        data: {
          productId: input.productId,
          packConfigId: input.packConfigId ?? null,
          customerType: input.customerType,
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
          customerType: newPrice.customerType,
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
      const effectiveTo = input.effectiveTo !== undefined ? (input.effectiveTo ? new Date(input.effectiveTo) : null) : existing.effectiveTo;

      // Check overlap if dates or active status changed
      if (input.effectiveFrom || input.effectiveTo !== undefined || input.isActive === true) {
        await this.checkDateOverlap(
          tx,
          existing.productId,
          existing.packConfigId,
          existing.customerType,
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
          existing.customerType,
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
   * - NRI missing price -> 400 Bad Request ("Applicable NRI price is not configured for this product")
   * - Indian missing price -> 400 Bad Request ("Applicable Indian price is not configured for this product")
   * - Never fallback to Indian for NRI!
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
      weightOrPackName = input.looseWeightInGrams >= 1000
        ? `${input.looseWeightInGrams / 1000} kg`
        : `${input.looseWeightInGrams}g`;
      baseWeightDeducted = input.looseWeightInGrams * quantity;
    } else {
      weightOrPackName = `${quantity} ${product.primaryUnit.symbol}`;
      baseWeightDeducted = quantity;
    }

    // 2. Query applicable price matching customer tier & target date
    const priceRecord = await prisma.productPrice.findFirst({
      where: {
        productId: product.id,
        packConfigId: input.packConfigId ?? null,
        customerType: input.customerType,
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // 3. STRICT RULE: NO FALLBACK TO ANOTHER TIER!
    if (!priceRecord) {
      if (input.customerType === CustomerType.NRI) {
        throw new BadRequestError('Applicable NRI price is not configured for this product');
      } else {
        throw new BadRequestError('Applicable Indian price is not configured for this product');
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
      customerType: input.customerType,
      effectiveFrom: priceRecord.effectiveFrom,
      effectiveTo: priceRecord.effectiveTo,
      priceId: priceRecord.id,
    };
  }

  /**
   * Authoritative Cart Price Resolver:
   * Resolves exact rates for all items in a cart based on customer tier.
   * Never exposes tier names or differential margins to invoice outputs.
   */
  static async resolveCart(input: ResolvePricesInput): Promise<ResolvedCartOutput> {
    let customerType: CustomerType = input.customerType || CustomerType.INDIAN;
    let customerId = input.customerId || null;
    let customerName = 'Walk-in Customer';
    let customerMobile: string | null = null;

    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }
      customerType = customer.customerType;
      customerName = customer.name;
      customerMobile = customer.mobile;
    } else {
      // Find or fallback to walk-in customer
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
      } else {
        const created = await prisma.customer.create({
          data: {
            name: customerType === CustomerType.NRI ? 'NRI Walk-in Customer' : 'Walk-in Customer',
            customerType,
          },
        });
        customerId = created.id;
        customerName = created.name;
      }
    }

    const resolvedItems: ResolvedItemOutput[] = [];
    let subtotalAmount = 0;

    for (const item of input.items) {
      const resolved = await this.resolveApplicablePrice({
        productId: item.productId,
        customerType,
        packConfigId: item.packConfigId ?? null,
        quantity: item.quantity,
        looseWeightInGrams: item.looseWeightInGrams ?? null,
        targetDate: input.targetDate,
      });

      subtotalAmount += resolved.totalAmount;
      resolvedItems.push(resolved);
    }

    // Round total amount to nearest integer rupee (ROUND_HALF_UP) as approved in BD-4
    const finalTotalAmount = Math.round(subtotalAmount);

    return {
      customerId,
      customerType,
      customerName,
      customerMobile,
      items: resolvedItems,
      subtotalAmount: Math.round(subtotalAmount * 100) / 100,
      finalTotalAmount,
    };
  }

  /**
   * Admin / Outlet: Retrieve current applicable prices for a product or variant.
   */
  static async getCurrentPrices(query: PriceQueryInput) {
    const targetDate = query.date ? new Date(query.date) : new Date();

    const where: Prisma.ProductPriceWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.customerType ? { customerType: query.customerType } : {}),
      ...(query.packConfigId !== undefined ? { packConfigId: query.packConfigId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : { isActive: true }),
      effectiveFrom: { lte: targetDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
    };

    return prisma.productPrice.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { customerType: 'asc' }, { effectiveFrom: 'desc' }],
      include: {
        product: { select: { id: true, name: true, code: true, isActive: true } },
        packConfig: true,
      },
    });
  }

  /**
   * Admin: View chronological price history for a product.
   */
  static async getPriceHistory(productId: string, customerType?: CustomerType) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return prisma.productPrice.findMany({
      where: {
        productId,
        ...(customerType ? { customerType } : {}),
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

        // Overlap check
        await this.checkDateOverlap(
          tx,
          item.productId,
          item.packConfigId ?? null,
          item.customerType,
          effectiveFrom,
          effectiveTo
        );

        const created = await tx.productPrice.create({
          data: {
            productId: item.productId,
            packConfigId: item.packConfigId ?? null,
            customerType: item.customerType,
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
