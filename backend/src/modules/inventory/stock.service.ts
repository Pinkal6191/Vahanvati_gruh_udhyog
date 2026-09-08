import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError, InsufficientStockError, ForbiddenError } from '../../common/errors/app-error.js';
import { StockQueryInput, MovementQueryInput, AdjustStockInput } from './inventory.validation.js';
import { AuditService } from '../audit/audit.service.js';
import { MovementType, ReferenceType, Prisma } from '@prisma/client';

export interface IncreaseStockParams {
  productId: string;
  quantityDelta: number;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string;
  notes?: string | null;
  userId?: string | null;
}

export interface DecreaseStockParams {
  productId: string;
  quantityDelta: number;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string;
  notes?: string | null;
  userId?: string | null;
  allowNegativeStock?: boolean;
}

export interface BatchDecreaseItem {
  productId: string;
  quantityDelta: number;
  productName?: string;
}

export interface BatchDecreaseMeta {
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string;
  billNumber?: string;
  notes?: string | null;
  userId?: string | null;
  allowNegativeStock?: boolean;
}

export class StockService {
  /**
   * ATOMIC STOCK INCREASE
   * 1. Validates product
   * 2. Locks stock row (FOR UPDATE)
   * 3. Calculates new balance and updates cached stock
   * 4. Appends to immutable movement ledger
   */
  static async increaseStock(params: IncreaseStockParams, externalTx?: Prisma.TransactionClient) {
    if (params.quantityDelta <= 0) {
      throw new BadRequestError('Quantity to increase must be greater than zero');
    }

    const run = async (tx: Prisma.TransactionClient) => {
      // 1. Verify product exists
      const product = await tx.product.findUnique({
        where: { id: params.productId },
        select: { id: true, name: true, isActive: true },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${params.productId} not found`);
      }

      // 2. Ensure stock record exists
      await tx.stock.upsert({
        where: { productId: params.productId },
        update: {},
        create: {
          productId: params.productId,
          currentBalance: new Prisma.Decimal(0.0),
          minimumThreshold: new Prisma.Decimal(0.0),
        },
      });

      // 3. Acquire pessimistic row lock
      const lockedRows = await tx.$queryRaw<{ id: string; current_balance: Prisma.Decimal }[]>`
        SELECT id, current_balance FROM stocks WHERE product_id = ${params.productId}::uuid FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundError(`Stock record for product ${params.productId} could not be locked`);
      }

      // 4. Update cached balance
      const updatedStock = await tx.stock.update({
        where: { productId: params.productId },
        data: {
          currentBalance: { increment: params.quantityDelta },
        },
      });

      // 5. Append to immutable movement ledger
      const movement = await tx.stockMovement.create({
        data: {
          productId: params.productId,
          movementType: params.movementType,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          quantityDelta: new Prisma.Decimal(params.quantityDelta),
          balanceAfter: updatedStock.currentBalance,
          notes: params.notes || null,
          createdBy: params.userId || null,
        },
      });

      return {
        stock: updatedStock,
        movement,
        productName: product.name,
      };
    };

    if (externalTx) {
      return run(externalTx);
    }
    return prisma.$transaction(async (tx) => run(tx));
  }

  /**
   * ATOMIC STOCK DECREASE
   * 1. Validates product
   * 2. Locks stock row (FOR UPDATE)
   * 3. Enforces sufficiency checks against negative stock policy
   * 4. Updates cached balance and appends to movement ledger
   */
  static async decreaseStock(params: DecreaseStockParams, externalTx?: Prisma.TransactionClient) {
    if (params.quantityDelta <= 0) {
      throw new BadRequestError('Quantity to decrease must be greater than zero');
    }

    const run = async (tx: Prisma.TransactionClient) => {
      // 1. Verify product exists
      const product = await tx.product.findUnique({
        where: { id: params.productId },
        select: { id: true, name: true, isActive: true },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${params.productId} not found`);
      }

      // 2. Ensure stock record exists
      await tx.stock.upsert({
        where: { productId: params.productId },
        update: {},
        create: {
          productId: params.productId,
          currentBalance: new Prisma.Decimal(0.0),
          minimumThreshold: new Prisma.Decimal(0.0),
        },
      });

      // 3. Determine negative stock policy
      let allowNegative = params.allowNegativeStock;
      if (allowNegative === undefined) {
        const settings = await tx.companySettings.findFirst({
          select: { allowNegativeStock: true },
        });
        allowNegative = settings?.allowNegativeStock ?? false;
      }

      // 4. Acquire pessimistic row lock
      const lockedRows = await tx.$queryRaw<{ id: string; current_balance: Prisma.Decimal }[]>`
        SELECT id, current_balance FROM stocks WHERE product_id = ${params.productId}::uuid FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundError(`Stock record for product ${params.productId} could not be locked`);
      }

      const currentBalance = Number(lockedRows[0].current_balance);

      // 5. Sufficiency check
      if (!allowNegative && currentBalance < params.quantityDelta) {
        throw new InsufficientStockError(
          `Insufficient stock for ${product.name}. Required: ${params.quantityDelta}, Available: ${currentBalance}`
        );
      }

      // 6. Update cached balance
      const updatedStock = await tx.stock.update({
        where: { productId: params.productId },
        data: {
          currentBalance: { decrement: params.quantityDelta },
        },
      });

      // 7. Append to immutable movement ledger
      const movement = await tx.stockMovement.create({
        data: {
          productId: params.productId,
          movementType: params.movementType,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          quantityDelta: new Prisma.Decimal(-params.quantityDelta),
          balanceAfter: updatedStock.currentBalance,
          notes: params.notes || null,
          createdBy: params.userId || null,
        },
      });

      return {
        stock: updatedStock,
        movement,
        productName: product.name,
      };
    };

    if (externalTx) {
      return run(externalTx);
    }
    return prisma.$transaction(async (tx) => run(tx));
  }

  /**
   * DEADLOCK-SAFE BATCH STOCK DECREASE (Used by POS Billing)
   * Deduplicates products and acquires row locks in strictly sorted key order.
   */
  static async batchDecreaseStock(
    items: BatchDecreaseItem[],
    meta: BatchDecreaseMeta,
    externalTx?: Prisma.TransactionClient
  ) {
    // 1. Group items by product ID
    const productDeltas = new Map<string, number>();
    for (const item of items) {
      const current = productDeltas.get(item.productId) || 0;
      productDeltas.set(item.productId, current + item.quantityDelta);
    }

    // 2. Sort product IDs ascending to eliminate deadlock risks across concurrent checkouts
    const sortedProductIds = Array.from(productDeltas.keys()).sort();

    const run = async (tx: Prisma.TransactionClient) => {
      // Determine negative stock policy
      let allowNegative = meta.allowNegativeStock;
      if (allowNegative === undefined) {
        const settings = await tx.companySettings.findFirst({
          select: { allowNegativeStock: true },
        });
        allowNegative = settings?.allowNegativeStock ?? false;
      }

      const results = [];

      // 3. Acquire row locks and verify sufficiency in sorted order
      for (const productId of sortedProductIds) {
        const requiredDelta = productDeltas.get(productId)!;

        // Ensure stock row exists
        await tx.stock.upsert({
          where: { productId },
          update: {},
          create: {
            productId,
            currentBalance: new Prisma.Decimal(0.0),
            minimumThreshold: new Prisma.Decimal(0.0),
          },
        });

        const locked = await tx.$queryRaw<{ id: string; current_balance: Prisma.Decimal }[]>`
          SELECT id, current_balance FROM stocks WHERE product_id = ${productId}::uuid FOR UPDATE
        `;

        const currentBalance = Number(locked[0]?.current_balance ?? 0);

        if (!allowNegative && currentBalance < requiredDelta) {
          const prod = await tx.product.findUnique({
            where: { id: productId },
            select: { name: true },
          });
          throw new InsufficientStockError(
            `Insufficient stock for ${prod?.name || productId}. Required: ${requiredDelta}, Available: ${currentBalance}`
          );
        }

        // Decrement cached balance
        const updatedStock = await tx.stock.update({
          where: { productId },
          data: {
            currentBalance: { decrement: requiredDelta },
          },
        });

        // Insert stock movement ledger record
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            movementType: meta.movementType,
            referenceType: meta.referenceType,
            referenceId: meta.referenceId,
            quantityDelta: new Prisma.Decimal(-requiredDelta),
            balanceAfter: updatedStock.currentBalance,
            notes: meta.notes || (meta.billNumber ? `Sold in Bill #${meta.billNumber}` : null),
            createdBy: meta.userId || null,
          },
        });

        results.push({ stock: updatedStock, movement });
      }

      return results;
    };

    if (externalTx) {
      return run(externalTx);
    }
    return prisma.$transaction(async (tx) => run(tx));
  }

  /**
   * Retrieve current stock balance for a single product
   */
  static async getCurrentStock(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        primaryUnit: true,
        subcategory: { include: { category: true } },
        stock: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }

    const currentBalance = Number(product.stock?.currentBalance ?? 0);
    const minimumThreshold = Number(product.stock?.minimumThreshold ?? 0);

    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      subcategoryName: product.subcategory.name,
      categoryName: product.subcategory.category.name,
      currentBalance,
      minimumThreshold,
      unitSymbol: product.primaryUnit.symbol,
      isWeightBased: product.primaryUnit.isWeightBased,
      isLowStock: currentBalance <= minimumThreshold && currentBalance > 0,
      isOutOfStock: currentBalance <= 0,
      lastUpdatedAt: product.stock?.lastUpdatedAt || product.createdAt,
    };
  }

  /**
   * List stocks with rich multi-field filters and pagination
   */
  static async listStock(query: StockQueryInput) {
    const {
      lowStockOnly,
      outOfStockOnly,
      search,
      subcategoryId,
      categoryId,
      isActive,
      page = 1,
      limit = 50,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      product: {
        isActive: isActive !== undefined ? isActive : true,
      },
    };

    if (subcategoryId) {
      where.product = { ...where.product, subcategoryId };
    }

    if (categoryId) {
      where.product = {
        ...where.product,
        subcategory: { categoryId },
      };
    }

    if (search) {
      where.product = {
        ...where.product,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { currentBalance: 'asc' },
        include: {
          product: {
            include: {
              primaryUnit: true,
              subcategory: { include: { category: true } },
            },
          },
        },
      }),
      prisma.stock.count({ where }),
    ]);

    let formatted = stocks.map((s) => {
      const currentBalance = Number(s.currentBalance);
      const minimumThreshold = Number(s.minimumThreshold);
      return {
        id: s.id,
        productId: s.productId,
        productName: s.product.name,
        productCode: s.product.code,
        subcategoryName: s.product.subcategory.name,
        categoryName: s.product.subcategory.category.name,
        currentBalance,
        minimumThreshold,
        unitSymbol: s.product.primaryUnit.symbol,
        isWeightBased: s.product.primaryUnit.isWeightBased,
        isLowStock: currentBalance <= minimumThreshold && currentBalance > 0,
        isOutOfStock: currentBalance <= 0,
        lastUpdatedAt: s.lastUpdatedAt,
      };
    });

    if (lowStockOnly) {
      formatted = formatted.filter((s) => s.isLowStock);
    } else if (outOfStockOnly) {
      formatted = formatted.filter((s) => s.isOutOfStock);
    }

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        total: lowStockOnly || outOfStockOnly ? formatted.length : total,
        totalPages: Math.ceil((lowStockOnly || outOfStockOnly ? formatted.length : total) / limit) || 1,
      },
    };
  }

  /**
   * Query chronological stock movement ledger
   */
  static async getStockMovementHistory(query: MovementQueryInput) {
    const {
      productId,
      movementType,
      referenceType,
      referenceId,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;
    if (referenceType) where.referenceType = referenceType;
    if (referenceId) where.referenceId = referenceId;
    if (userId) where.createdBy = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, code: true, primaryUnit: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    const formatted = items.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product.name,
      productCode: m.product.code,
      unitSymbol: m.product.primaryUnit.symbol,
      movementType: m.movementType,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      quantityDelta: Number(m.quantityDelta),
      balanceAfter: Number(m.balanceAfter),
      notes: m.notes,
      createdBy: m.user ? { id: m.user.id, fullName: m.user.fullName, username: m.user.username } : null,
      createdAt: m.createdAt,
    }));

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Aggregate stock summary for management & dashboard
   */
  static async getStockSummary() {
    const [activeProductsCount, allStocks, recentMovements] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.stock.findMany({
        include: { product: { select: { isActive: true } } },
      }),
      prisma.stockMovement.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, code: true } },
          user: { select: { fullName: true } },
        },
      }),
    ]);

    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const s of allStocks) {
      if (!s.product.isActive) continue;
      const bal = Number(s.currentBalance);
      const thresh = Number(s.minimumThreshold);

      if (bal <= 0) {
        outOfStockCount++;
      } else if (bal <= thresh) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    }

    return {
      totalActiveProducts: activeProductsCount,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        movementType: m.movementType,
        quantityDelta: Number(m.quantityDelta),
        balanceAfter: Number(m.balanceAfter),
        notes: m.notes,
        createdByName: m.user?.fullName || 'System',
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Controlled Admin-Only Manual Stock Adjustment
   */
  static async adjustStock(
    userId: string,
    userRole: string,
    input: AdjustStockInput,
    ipAddress?: string | null
  ) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenError('Only administrators are authorized to perform manual stock adjustments');
    }

    if (input.quantityDelta === 0) {
      throw new BadRequestError('Adjustment quantity cannot be zero');
    }

    if (!input.reason || input.reason.trim().length < 3) {
      throw new BadRequestError('A valid adjustment reason (minimum 3 characters) is mandatory');
    }

    return prisma.$transaction(async (tx) => {
      const isIncrease = input.quantityDelta > 0;
      const absDelta = Math.abs(input.quantityDelta);

      // Lock current stock
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true, name: true, isActive: true },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${input.productId} not found`);
      }

      await tx.stock.upsert({
        where: { productId: input.productId },
        update: {},
        create: {
          productId: input.productId,
          currentBalance: new Prisma.Decimal(0.0),
          minimumThreshold: new Prisma.Decimal(0.0),
        },
      });

      const locked = await tx.$queryRaw<{ id: string; current_balance: Prisma.Decimal }[]>`
        SELECT id, current_balance FROM stocks WHERE product_id = ${input.productId}::uuid FOR UPDATE
      `;

      const previousBalance = Number(locked[0].current_balance);

      let updatedStock;
      let movementType: MovementType;

      if (isIncrease) {
        movementType = MovementType.ADJUSTMENT_IN;
        updatedStock = await tx.stock.update({
          where: { productId: input.productId },
          data: { currentBalance: { increment: absDelta } },
        });
      } else {
        movementType = MovementType.ADJUSTMENT_OUT;
        // Check sufficiency if negative stock is disabled
        const settings = await tx.companySettings.findFirst({ select: { allowNegativeStock: true } });
        if (!settings?.allowNegativeStock && previousBalance < absDelta) {
          throw new InsufficientStockError(
            `Insufficient stock for ${product.name}. Required: ${absDelta}, Available: ${previousBalance}`
          );
        }
        updatedStock = await tx.stock.update({
          where: { productId: input.productId },
          data: { currentBalance: { decrement: absDelta } },
        });
      }

      // Record movement ledger entry
      const movement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          movementType,
          referenceType: ReferenceType.MANUAL,
          referenceId: updatedStock.id,
          quantityDelta: new Prisma.Decimal(input.quantityDelta),
          balanceAfter: updatedStock.currentBalance,
          notes: `Manual adjustment: ${input.reason.trim()}`,
          createdBy: userId,
        },
      });

      // Audit trail
      await AuditService.log({
        userId,
        userRole,
        action: 'ADJUST_STOCK',
        entityType: 'STOCK',
        entityId: updatedStock.id,
        oldValues: { currentBalance: previousBalance },
        newValues: {
          currentBalance: Number(updatedStock.currentBalance),
          quantityDelta: input.quantityDelta,
          reason: input.reason.trim(),
        },
        ipAddress,
      });

      return {
        productId: product.id,
        productName: product.name,
        previousBalance,
        newBalance: Number(updatedStock.currentBalance),
        quantityDelta: input.quantityDelta,
        movement,
      };
    });
  }

  /**
   * RECONCILIATION AUDIT
   * Verifies mathematical parity:
   * Cached stock balance == SUM(quantity_delta) from stock_movements
   */
  static async reconcileStock(productId: string) {
    const stock = await prisma.stock.findUnique({
      where: { productId },
      include: { product: true },
    });

    if (!stock) {
      throw new NotFoundError(`Stock record for product ${productId} not found`);
    }

    const movementsSum = await prisma.stockMovement.aggregate({
      where: { productId },
      _sum: { quantityDelta: true },
    });

    const ledgerTotal = Number(movementsSum._sum.quantityDelta ?? 0);
    const cachedBalance = Number(stock.currentBalance);
    const isConsistent = Math.abs(ledgerTotal - cachedBalance) < 0.0001;

    return {
      productId,
      productName: stock.product.name,
      cachedBalance,
      ledgerTotal,
      isConsistent,
      discrepancy: Math.round((cachedBalance - ledgerTotal) * 1000) / 1000,
    };
  }
}
