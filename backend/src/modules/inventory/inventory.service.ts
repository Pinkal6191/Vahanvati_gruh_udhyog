import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { StockQueryInput, MovementQueryInput, AdjustStockInput } from './inventory.validation.js';
import { MovementType, ReferenceType } from '@prisma/client';

export class InventoryService {
  static async getStockStatus(query: StockQueryInput) {
    const { lowStockOnly, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      product: { isActive: true },
    };

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
              subcategory: true,
            },
          },
        },
      }),
      prisma.stock.count({ where }),
    ]);

    const formatted = stocks
      .filter((s) => (lowStockOnly ? Number(s.currentBalance) <= Number(s.minimumThreshold) : true))
      .map((s) => ({
        id: s.id,
        productId: s.productId,
        productName: s.product.name,
        productCode: s.product.code,
        subcategoryName: s.product.subcategory.name,
        currentBalance: Number(s.currentBalance),
        minimumThreshold: Number(s.minimumThreshold),
        isLowStock: Number(s.currentBalance) <= Number(s.minimumThreshold),
        unitSymbol: s.product.primaryUnit.symbol,
        lastUpdatedAt: s.lastUpdatedAt,
      }));

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getMovements(query: MovementQueryInput) {
    const { productId, movementType, startDate, endDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;

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
          user: { select: { fullName: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async adjustStock(userId: string, input: AdjustStockInput) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });

    if (!product) throw new NotFoundError('Product not found');

    return prisma.$transaction(async (tx) => {
      const movementType =
        input.quantityDelta > 0 ? MovementType.ADJUSTMENT_IN : MovementType.ADJUSTMENT_OUT;

      const updatedStock = await tx.stock.upsert({
        where: { productId: input.productId },
        update: {
          currentBalance: { increment: input.quantityDelta },
        },
        create: {
          productId: input.productId,
          currentBalance: input.quantityDelta,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          movementType,
          referenceType: ReferenceType.MANUAL,
          referenceId: updatedStock.id,
          quantityDelta: input.quantityDelta,
          balanceAfter: updatedStock.currentBalance,
          notes: `Manual adjustment: ${input.reason}`,
          createdBy: userId,
        },
      });

      return {
        productName: product.name,
        newBalance: Number(updatedStock.currentBalance),
        movement,
      };
    });
  }

  /**
   * RECONCILIATION AUDIT
   * Verifies that the authoritative cache balance in stocks equals the sum of quantity_delta in stock_movements.
   */
  static async reconcileStock(productId: string) {
    const stock = await prisma.stock.findUnique({
      where: { productId },
      include: { product: true },
    });

    if (!stock) throw new NotFoundError('Stock record not found');

    const movementsSum = await prisma.stockMovement.aggregate({
      where: { productId },
      _sum: { quantityDelta: true },
    });

    const ledgerTotal = Number(movementsSum._sum.quantityDelta ?? 0);
    const cachedBalance = Number(stock.currentBalance);
    const isConsistent = Math.abs(ledgerTotal - cachedBalance) < 0.001;

    return {
      productId,
      productName: stock.product.name,
      cachedBalance,
      ledgerTotal,
      isConsistent,
      discrepancy: cachedBalance - ledgerTotal,
    };
  }
}
