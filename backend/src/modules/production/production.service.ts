import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { CreateProductionInput, ProductionQueryInput } from './production.validation.js';
import { MovementType, ReferenceType } from '@prisma/client';

export class ProductionService {
  /**
   * ATOMIC PRODUCTION ENTRY
   * 1. Validates product and unit
   * 2. Converts entered quantity to base weight/count units
   * 3. Creates production entry record
   * 4. Updates authoritative stock balance
   * 5. Appends to immutable movement ledger (PRODUCTION_IN)
   */
  static async createEntry(userId: string, input: CreateProductionInput) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: { primaryUnit: true },
    });

    if (!product) throw new NotFoundError('Product not found');

    const unit = await prisma.unit.findUnique({
      where: { id: input.unitId },
    });

    if (!unit) throw new NotFoundError('Unit not found');

    // Calculate base weight in grams/pieces
    const baseMultiplier = Number(unit.conversionFactorToBase);
    const baseWeightAdded = input.quantityProduced * baseMultiplier;

    return prisma.$transaction(async (tx) => {
      // 1. Generate Production Number (PRD-YYYYMMDD-0001)
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.productionEntry.count();
      const productionNumber = `PRD-${datePart}-${String(count + 1).padStart(4, '0')}`;

      // 2. Create Production Entry
      const entry = await tx.productionEntry.create({
        data: {
          productionNumber,
          batchNumber: input.batchNumber || null,
          productId: input.productId,
          quantityProduced: input.quantityProduced,
          unitId: input.unitId,
          baseWeightAdded,
          productionDate: new Date(input.productionDate),
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          notes: input.notes || null,
          createdBy: userId,
        },
      });

      // 3. Increment stock balance
      const updatedStock = await tx.stock.upsert({
        where: { productId: input.productId },
        update: {
          currentBalance: { increment: baseWeightAdded },
        },
        create: {
          productId: input.productId,
          currentBalance: baseWeightAdded,
        },
      });

      // 4. Record stock movement ledger
      await tx.stockMovement.create({
        data: {
          productId: input.productId,
          movementType: MovementType.PRODUCTION_IN,
          referenceType: ReferenceType.PRODUCTION,
          referenceId: entry.id,
          quantityDelta: baseWeightAdded,
          balanceAfter: updatedStock.currentBalance,
          notes: `Production entry #${productionNumber}${input.batchNumber ? ` (Batch: ${input.batchNumber})` : ''}`,
          createdBy: userId,
        },
      });

      return tx.productionEntry.findUnique({
        where: { id: entry.id },
        include: {
          product: { select: { name: true, code: true } },
          unit: true,
          user: { select: { fullName: true } },
        },
      });
    });
  }

  static async listEntries(query: ProductionQueryInput) {
    const { productId, batchNumber, date, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (productId) where.productId = productId;
    if (batchNumber) where.batchNumber = { contains: batchNumber, mode: 'insensitive' };
    if (date) where.productionDate = new Date(date);

    const [items, total] = await Promise.all([
      prisma.productionEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, code: true } },
          unit: true,
          user: { select: { fullName: true } },
        },
      }),
      prisma.productionEntry.count({ where }),
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

  static async getById(id: string) {
    const entry = await prisma.productionEntry.findUnique({
      where: { id },
      include: {
        product: true,
        unit: true,
        user: { select: { fullName: true } },
      },
    });

    if (!entry) throw new NotFoundError('Production entry not found');
    return entry;
  }
}
