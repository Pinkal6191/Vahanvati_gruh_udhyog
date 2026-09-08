import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { StockService } from '../inventory/stock.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateProductionInput,
  UpdateProductionInput,
  CancelProductionInput,
  ProductionQueryInput,
} from './production.validation.js';
import { MovementType, ReferenceType, ProductionStatus, Prisma } from '@prisma/client';

export class ProductionService {
  /**
   * CREATE PRODUCTION ENTRY
   * - Supports DRAFT (saved without affecting stock)
   * - Supports COMPLETED (immediately increments stock via StockService and logs movement)
   */
  static async createEntry(
    userId: string,
    input: CreateProductionInput,
    userRole: string = 'PRODUCTION',
    ipAddress?: string | null
  ) {
    // 1. Verify Product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: { primaryUnit: true },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${input.productId} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestError(`Cannot record production for inactive product: ${product.name}`);
    }

    // 2. Verify Unit exists and is active
    const unit = await prisma.unit.findUnique({
      where: { id: input.unitId },
    });

    if (!unit) {
      throw new NotFoundError(`Unit with ID ${input.unitId} not found`);
    }

    if (!unit.isActive) {
      throw new BadRequestError(`Unit ${unit.name} is inactive`);
    }

    // 3. Unit Compatibility Validation
    if (product.primaryUnit.isWeightBased !== unit.isWeightBased) {
      throw new BadRequestError(
        `Unit incompatibility: Product "${product.name}" is ${
          product.primaryUnit.isWeightBased ? 'weight-based' : 'quantity-based'
        } but unit "${unit.name}" is ${unit.isWeightBased ? 'weight-based' : 'quantity-based'}`
      );
    }

    // 4. Calculate base weight/count units
    const baseMultiplier = Number(unit.conversionFactorToBase);
    const baseWeightAdded = Math.round(input.quantityProduced * baseMultiplier * 1000) / 1000;

    // Default to COMPLETED if not specified (preserves existing verify-all behavior)
    const status = input.status ?? ProductionStatus.COMPLETED;
    const isCompleted = status === ProductionStatus.COMPLETED;

    return prisma.$transaction(async (tx) => {
      // 5. Concurrency-Safe Sequential Production Number (PRD-YYYYMMDD-XXXX)
      await tx.$queryRaw`SELECT id, invoice_prefix FROM company_settings LIMIT 1 FOR UPDATE`;

      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const latestToday = await tx.productionEntry.findFirst({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        orderBy: { productionNumber: 'desc' },
        select: { productionNumber: true },
      });

      let nextSeq = 1;
      if (latestToday?.productionNumber) {
        const parts = latestToday.productionNumber.split('-');
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }

      const sequenceNumber = String(nextSeq).padStart(4, '0');
      const productionNumber = `PRD-${datePart}-${sequenceNumber}`;

      // 6. Create Production Entry
      const entry = await tx.productionEntry.create({
        data: {
          productionNumber,
          batchNumber: input.batchNumber?.trim() || null,
          productId: input.productId,
          quantityProduced: new Prisma.Decimal(input.quantityProduced),
          unitId: input.unitId,
          baseWeightAdded: new Prisma.Decimal(baseWeightAdded),
          status,
          productionDate: new Date(input.productionDate),
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          completedAt: isCompleted ? new Date() : null,
          notes: input.notes?.trim() || null,
          createdBy: userId,
        },
      });

      // 7. If COMPLETED, increment stock balance via centralized StockService
      if (isCompleted) {
        await StockService.increaseStock(
          {
            productId: input.productId,
            quantityDelta: baseWeightAdded,
            movementType: MovementType.PRODUCTION_IN,
            referenceType: ReferenceType.PRODUCTION,
            referenceId: entry.id,
            notes: `Production entry #${productionNumber}${
              input.batchNumber ? ` (Batch: ${input.batchNumber})` : ''
            }`,
            userId,
          },
          tx
        );
      }

      // 8. Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: isCompleted ? 'CREATE_PRODUCTION' : 'CREATE_PRODUCTION_DRAFT',
        entityType: 'PRODUCTION',
        entityId: entry.id,
        newValues: {
          productionNumber,
          productId: input.productId,
          productName: product.name,
          quantityProduced: input.quantityProduced,
          unitSymbol: unit.symbol,
          baseWeightAdded,
          status,
        },
        ipAddress,
      });

      return tx.productionEntry.findUnique({
        where: { id: entry.id },
        include: {
          product: { select: { id: true, name: true, code: true } },
          unit: true,
          user: { select: { id: true, fullName: true, username: true } },
        },
      });
    });
  }

  /**
   * UPDATE DRAFT PRODUCTION ENTRY
   * Strictly permits modifications only while entry is in DRAFT status.
   */
  static async updateEntry(
    id: string,
    userId: string,
    input: UpdateProductionInput,
    userRole: string = 'PRODUCTION',
    ipAddress?: string | null
  ) {
    const existing = await prisma.productionEntry.findUnique({
      where: { id },
      include: { product: { include: { primaryUnit: true } }, unit: true },
    });

    if (!existing) {
      throw new NotFoundError(`Production entry with ID ${id} not found`);
    }

    if (existing.status !== ProductionStatus.DRAFT) {
      throw new BadRequestError(
        `Cannot edit production entry in ${existing.status} status. Only DRAFT entries can be modified.`
      );
    }

    let unit = existing.unit;
    if (input.unitId && input.unitId !== existing.unitId) {
      const foundUnit = await prisma.unit.findUnique({ where: { id: input.unitId } });
      if (!foundUnit) throw new NotFoundError(`Unit with ID ${input.unitId} not found`);
      if (existing.product.primaryUnit.isWeightBased !== foundUnit.isWeightBased) {
        throw new BadRequestError('Unit type mismatch for product');
      }
      unit = foundUnit;
    }

    const qty = input.quantityProduced ?? Number(existing.quantityProduced);
    const baseMultiplier = Number(unit.conversionFactorToBase);
    const baseWeightAdded = Math.round(qty * baseMultiplier * 1000) / 1000;

    const updated = await prisma.productionEntry.update({
      where: { id },
      data: {
        quantityProduced: input.quantityProduced ? new Prisma.Decimal(input.quantityProduced) : undefined,
        unitId: input.unitId ?? undefined,
        baseWeightAdded: new Prisma.Decimal(baseWeightAdded),
        batchNumber: input.batchNumber !== undefined ? input.batchNumber?.trim() || null : undefined,
        productionDate: input.productionDate ? new Date(input.productionDate) : undefined,
        expiryDate: input.expiryDate !== undefined ? (input.expiryDate ? new Date(input.expiryDate) : null) : undefined,
        notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
        unit: true,
        user: { select: { id: true, fullName: true, username: true } },
      },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'UPDATE_PRODUCTION_DRAFT',
      entityType: 'PRODUCTION',
      entityId: id,
      oldValues: {
        quantityProduced: Number(existing.quantityProduced),
        unitId: existing.unitId,
      },
      newValues: {
        quantityProduced: Number(updated.quantityProduced),
        unitId: updated.unitId,
        baseWeightAdded,
      },
      ipAddress,
    });

    return updated;
  }

  /**
   * COMPLETE PRODUCTION DRAFT
   * - Row-level locking protects against race conditions
   * - Double-completion protection guarantees stock is incremented exactly once
   * - Stock increment and movement created via centralized StockService
   */
  static async completeProduction(
    id: string,
    userId: string,
    userRole: string = 'PRODUCTION',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Pessimistic row-level lock on ProductionEntry
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          product_id: string;
          base_weight_added: Prisma.Decimal;
          production_number: string;
          batch_number: string | null;
        }>
      >`SELECT id, status, product_id, base_weight_added, production_number, batch_number FROM production_entries WHERE id = ${id}::uuid FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundError(`Production entry with ID ${id} not found`);
      }

      const locked = lockedRows[0];

      // 2. Double-completion & Status Protection
      if (locked.status === ProductionStatus.COMPLETED) {
        throw new BadRequestError(`Production entry #${locked.production_number} is already completed`);
      }

      if (locked.status === ProductionStatus.CANCELLED) {
        throw new BadRequestError(`Cannot complete cancelled production entry #${locked.production_number}`);
      }

      const baseWeightAdded = Number(locked.base_weight_added);

      // 3. Mark COMPLETED
      const completedEntry = await tx.productionEntry.update({
        where: { id },
        data: {
          status: ProductionStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          product: { select: { id: true, name: true, code: true } },
          unit: true,
          user: { select: { id: true, fullName: true, username: true } },
        },
      });

      // 4. Increment stock via centralized StockService
      await StockService.increaseStock(
        {
          productId: locked.product_id,
          quantityDelta: baseWeightAdded,
          movementType: MovementType.PRODUCTION_IN,
          referenceType: ReferenceType.PRODUCTION,
          referenceId: id,
          notes: `Completed Production #${locked.production_number}${
            locked.batch_number ? ` (Batch: ${locked.batch_number})` : ''
          }`,
          userId,
        },
        tx
      );

      // 5. Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: 'COMPLETE_PRODUCTION',
        entityType: 'PRODUCTION',
        entityId: id,
        newValues: {
          productionNumber: locked.production_number,
          productId: locked.product_id,
          baseWeightAdded,
          status: ProductionStatus.COMPLETED,
        },
        ipAddress,
      });

      return completedEntry;
    });
  }

  /**
   * CANCEL PRODUCTION ENTRY
   * - If DRAFT: marks CANCELLED without affecting stock
   * - If COMPLETED: reverses stock via StockService.decreaseStock (ADJUSTMENT_OUT)
   */
  static async cancelProduction(
    id: string,
    userId: string,
    input: CancelProductionInput,
    userRole: string = 'PRODUCTION',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock ProductionEntry row FOR UPDATE
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          product_id: string;
          base_weight_added: Prisma.Decimal;
          production_number: string;
        }>
      >`SELECT id, status, product_id, base_weight_added, production_number FROM production_entries WHERE id = ${id}::uuid FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundError(`Production entry with ID ${id} not found`);
      }

      const locked = lockedRows[0];

      if (locked.status === ProductionStatus.CANCELLED) {
        throw new BadRequestError(`Production entry #${locked.production_number} is already cancelled`);
      }

      const wasCompleted = locked.status === ProductionStatus.COMPLETED;
      const baseWeightAdded = Number(locked.base_weight_added);

      // 2. Mark as CANCELLED
      const cancelledEntry = await tx.productionEntry.update({
        where: { id },
        data: {
          status: ProductionStatus.CANCELLED,
          notes: input.reason.trim(),
        },
        include: {
          product: { select: { id: true, name: true, code: true } },
          unit: true,
          user: { select: { id: true, fullName: true, username: true } },
        },
      });

      // 3. If it was COMPLETED, reverse the stock using StockService.decreaseStock
      if (wasCompleted) {
        await StockService.decreaseStock(
          {
            productId: locked.product_id,
            quantityDelta: baseWeightAdded,
            movementType: MovementType.ADJUSTMENT_OUT,
            referenceType: ReferenceType.PRODUCTION,
            referenceId: id,
            notes: `Cancelled Production #${locked.production_number}: ${input.reason.trim()}`,
            userId,
          },
          tx
        );
      }

      // 4. Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: 'CANCEL_PRODUCTION',
        entityType: 'PRODUCTION',
        entityId: id,
        oldValues: { status: locked.status },
        newValues: {
          status: ProductionStatus.CANCELLED,
          reason: input.reason.trim(),
          stockReversed: wasCompleted,
        },
        ipAddress,
      });

      return cancelledEntry;
    });
  }

  /**
   * PRODUCTION SUMMARY DASHBOARD
   */
  static async getProductionSummary() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [totalEntries, draftCount, completedCount, cancelledCount, todayCompleted, recentEntries] =
      await Promise.all([
        prisma.productionEntry.count(),
        prisma.productionEntry.count({ where: { status: ProductionStatus.DRAFT } }),
        prisma.productionEntry.count({ where: { status: ProductionStatus.COMPLETED } }),
        prisma.productionEntry.count({ where: { status: ProductionStatus.CANCELLED } }),
        prisma.productionEntry.findMany({
          where: {
            status: ProductionStatus.COMPLETED,
            productionDate: { gte: todayStart, lte: todayEnd },
          },
          select: { baseWeightAdded: true },
        }),
        prisma.productionEntry.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { name: true, code: true } },
            unit: { select: { symbol: true } },
            user: { select: { fullName: true } },
          },
        }),
      ]);

    const todayTotalBaseWeight = todayCompleted.reduce(
      (sum, e) => sum + Number(e.baseWeightAdded),
      0
    );

    return {
      todayProductionWeightGrams: todayTotalBaseWeight,
      totalEntries,
      draftCount,
      completedCount,
      cancelledCount,
      recentEntries: recentEntries.map((e) => ({
        id: e.id,
        productionNumber: e.productionNumber,
        productName: e.product.name,
        quantityProduced: Number(e.quantityProduced),
        unitSymbol: e.unit.symbol,
        status: e.status,
        productionDate: e.productionDate,
        createdByName: e.user.fullName,
      })),
    };
  }

  /**
   * LIST PRODUCTION ENTRIES WITH RICH FILTERS
   */
  static async listEntries(query: ProductionQueryInput) {
    const { productId, batchNumber, status, date, startDate, endDate, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductionEntryWhereInput = {};
    if (productId) where.productId = productId;
    if (batchNumber) where.batchNumber = { contains: batchNumber, mode: 'insensitive' };
    if (status) where.status = status;

    if (date) {
      where.productionDate = new Date(date);
    } else if (startDate || endDate) {
      where.productionDate = {};
      if (startDate) where.productionDate.gte = new Date(startDate);
      if (endDate) where.productionDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.productionEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, code: true } },
          unit: true,
          user: { select: { id: true, fullName: true, username: true } },
        },
      }),
      prisma.productionEntry.count({ where }),
    ]);

    const formatted = items.map((e) => ({
      id: e.id,
      productionNumber: e.productionNumber,
      productId: e.productId,
      productName: e.product.name,
      productCode: e.product.code,
      quantityProduced: Number(e.quantityProduced),
      unitId: e.unitId,
      unitName: e.unit.name,
      unitSymbol: e.unit.symbol,
      baseWeightAdded: Number(e.baseWeightAdded),
      status: e.status,
      batchNumber: e.batchNumber,
      productionDate: e.productionDate,
      expiryDate: e.expiryDate,
      completedAt: e.completedAt,
      notes: e.notes,
      createdBy: e.user ? { id: e.user.id, fullName: e.user.fullName, username: e.user.username } : null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
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
   * GET PRODUCTION ENTRY BY ID
   */
  static async getById(id: string) {
    const entry = await prisma.productionEntry.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, code: true, primaryUnit: true } },
        unit: true,
        user: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!entry) {
      throw new NotFoundError(`Production entry with ID ${id} not found`);
    }

    return {
      id: entry.id,
      productionNumber: entry.productionNumber,
      productId: entry.productId,
      productName: entry.product.name,
      productCode: entry.product.code,
      quantityProduced: Number(entry.quantityProduced),
      unitId: entry.unitId,
      unitName: entry.unit.name,
      unitSymbol: entry.unit.symbol,
      baseWeightAdded: Number(entry.baseWeightAdded),
      status: entry.status,
      batchNumber: entry.batchNumber,
      productionDate: entry.productionDate,
      expiryDate: entry.expiryDate,
      completedAt: entry.completedAt,
      notes: entry.notes,
      createdBy: entry.user ? { id: entry.user.id, fullName: entry.user.fullName, username: entry.user.username } : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
