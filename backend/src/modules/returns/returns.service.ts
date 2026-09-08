import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { StockService } from '../inventory/stock.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateReturnInput,
  UpdateReturnInput,
  CancelReturnInput,
  ReturnsQueryInput,
} from './returns.validation.js';
import {
  MovementType,
  ReferenceType,
  ReturnStatus,
  RestockCondition,
  SaleStatus,
  Prisma,
} from '@prisma/client';

export class ReturnsService {
  /**
   * CREATE SALES RETURN TRANSACTION
   * - Validates original sale exists and is in COMPLETED status
   * - Concurrency-safe sequential numbering: RET-YYYYMMDD-XXXX
   * - Pessimistic row-level locking on target SaleItem rows (SELECT ... FOR UPDATE)
   * - Validates remaining returnable quantity: (quantity - returnedQuantity) >= requested
   * - Uses original historical sale item unitRate snapshot
   * - Supports DRAFT and COMPLETED statuses (defaults to COMPLETED for backward compatibility)
   * - If COMPLETED: increments sale_items.returned_quantity and calls StockService.increaseStock
   * - Records comprehensive audit trail
   */
  static async createReturn(
    userId: string,
    input: CreateReturnInput,
    userRole: string = 'OUTLET',
    ipAddress?: string | null
  ) {
    // 1. Verify Original Sale exists
    const originalSale = await prisma.sale.findUnique({
      where: { id: input.originalSaleId },
      include: { customer: true },
    });

    if (!originalSale) {
      throw new NotFoundError('Original sale record not found');
    }

    if (originalSale.saleStatus === SaleStatus.CANCELLED) {
      throw new BadRequestError('Cannot process returns against a cancelled sale');
    }

    const status = input.status ?? ReturnStatus.COMPLETED;
    const isCompleted = status === ReturnStatus.COMPLETED;

    return prisma.$transaction(async (tx) => {
      // 2. Concurrency-Safe Sequential Return Number (RET-YYYYMMDD-XXXX)
      await tx.$queryRaw`SELECT id, invoice_prefix FROM company_settings LIMIT 1 FOR UPDATE`;

      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const latestToday = await tx.salesReturn.findFirst({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        orderBy: { returnNumber: 'desc' },
        select: { returnNumber: true },
      });

      let nextSeq = 1;
      if (latestToday?.returnNumber) {
        const parts = latestToday.returnNumber.split('-');
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }

      const returnNumber = `RET-${datePart}-${String(nextSeq).padStart(4, '0')}`;

      // 3. Concurrency-Safe Lock on Target SaleItems
      const uniqueSaleItemIds = [...new Set(input.items.map((i) => i.saleItemId))].sort();

      const lockedSaleItems = await tx.$queryRaw<
        Array<{
          id: string;
          sale_id: string;
          product_id: string;
          quantity: Prisma.Decimal;
          returned_quantity: Prisma.Decimal;
          base_weight_deducted: Prisma.Decimal;
          unit_rate: Prisma.Decimal;
          product_name_snapshot: string;
          unit_symbol_snapshot: string;
          weight_or_pack_snapshot: string;
        }>
      >`
        SELECT id, sale_id, product_id, quantity, returned_quantity, base_weight_deducted, unit_rate,
               product_name_snapshot, unit_symbol_snapshot, weight_or_pack_snapshot
        FROM sale_items
        WHERE id IN (${Prisma.join(uniqueSaleItemIds.map((id) => Prisma.raw(`'${id}'::uuid`)))})
        ORDER BY id ASC
        FOR UPDATE
      `;

      const lockedMap = new Map(lockedSaleItems.map((item) => [item.id, item]));

      // 4. Validate items against original sale and check returnable quantities
      let totalRefundAmount = 0;
      const preparedItems = [];

      for (const reqItem of input.items) {
        const originalItem = lockedMap.get(reqItem.saleItemId);

        if (!originalItem) {
          throw new NotFoundError(`Sale item ID ${reqItem.saleItemId} not found`);
        }

        if (originalItem.sale_id !== originalSale.id) {
          throw new BadRequestError(
            `Sale item ${reqItem.saleItemId} (${originalItem.product_name_snapshot}) does not belong to sale #${originalSale.billNumber}`
          );
        }

        const soldQty = Number(originalItem.quantity);
        const alreadyReturnedQty = Number(originalItem.returned_quantity);
        const returnableQty = Math.round((soldQty - alreadyReturnedQty) * 1000) / 1000;

        if (reqItem.returnedQuantity > returnableQty) {
          throw new BadRequestError(
            `Cannot return ${reqItem.returnedQuantity} of ${originalItem.product_name_snapshot}. Remaining returnable: ${returnableQty} (Sold: ${soldQty}, Already returned: ${alreadyReturnedQty})`
          );
        }

        // Calculate refund using historical original sale rate snapshot
        const unitRate = Number(originalItem.unit_rate);
        const refundAmount = Math.round(unitRate * reqItem.returnedQuantity * 100) / 100;
        totalRefundAmount += refundAmount;

        // Calculate base weight to restock proportionally
        const baseRatio = Number(originalItem.base_weight_deducted) / soldQty;
        const baseWeightToRestock = Math.round(baseRatio * reqItem.returnedQuantity * 1000) / 1000;

        preparedItems.push({
          saleItemId: originalItem.id,
          productId: originalItem.product_id,
          productName: originalItem.product_name_snapshot,
          returnedQuantity: reqItem.returnedQuantity,
          unitRateSnapshot: unitRate,
          refundAmount,
          restockCondition: reqItem.restockCondition ?? RestockCondition.RESTOCKABLE,
          baseWeightToRestock,
        });
      }

      totalRefundAmount = Math.round(totalRefundAmount * 100) / 100;

      // 5. Create SalesReturn Header
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          originalSaleId: originalSale.id,
          customerId: originalSale.customerId,
          totalReturnAmount: new Prisma.Decimal(totalRefundAmount),
          refundPaymentMode: input.refundPaymentMode,
          status,
          reason: input.reason.trim(),
          createdBy: userId,
          completedAt: isCompleted ? new Date() : null,
        },
      });

      // 6. Create SalesReturnItems
      for (const item of preparedItems) {
        await tx.salesReturnItem.create({
          data: {
            returnId: salesReturn.id,
            saleItemId: item.saleItemId,
            productId: item.productId,
            returnedQuantity: new Prisma.Decimal(item.returnedQuantity),
            unitRateSnapshot: new Prisma.Decimal(item.unitRateSnapshot),
            refundAmount: new Prisma.Decimal(item.refundAmount),
            restockCondition: item.restockCondition,
          },
        });

        // 7. If COMPLETED: increment returned_quantity and restock via StockService
        if (isCompleted) {
          await tx.saleItem.update({
            where: { id: item.saleItemId },
            data: {
              returnedQuantity: { increment: item.returnedQuantity },
            },
          });

          if (item.restockCondition === RestockCondition.RESTOCKABLE) {
            await StockService.increaseStock(
              {
                productId: item.productId,
                quantityDelta: item.baseWeightToRestock,
                movementType: MovementType.SALES_RETURN_IN,
                referenceType: ReferenceType.SALES_RETURN,
                referenceId: salesReturn.id,
                notes: `Sales return #${returnNumber} (Original Bill: #${originalSale.billNumber}) - ${item.productName}`,
                userId,
              },
              tx
            );
          }
        }
      }

      // 8. Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: isCompleted ? 'CREATE_SALES_RETURN' : 'CREATE_SALES_RETURN_DRAFT',
        entityType: 'SALES_RETURN',
        entityId: salesReturn.id,
        newValues: {
          returnNumber,
          originalBillNumber: originalSale.billNumber,
          totalReturnAmount: totalRefundAmount,
          itemCount: preparedItems.length,
          status,
        },
        ipAddress,
      });

      return tx.salesReturn.findUnique({
        where: { id: salesReturn.id },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              saleItem: { select: { id: true, unitSymbolSnapshot: true, weightOrPackSnapshot: true } },
            },
          },
          originalSale: { select: { id: true, billNumber: true, createdAt: true, saleStatus: true } },
          customer: { select: { id: true, name: true, mobile: true, customerType: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
      });
    });
  }

  /**
   * UPDATE DRAFT SALES RETURN
   * Strictly permits modifications only while return is in DRAFT status.
   */
  static async updateReturn(
    id: string,
    userId: string,
    input: UpdateReturnInput,
    userRole: string = 'OUTLET',
    ipAddress?: string | null
  ) {
    const existing = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        originalSale: true,
        items: true,
      },
    });

    if (!existing) {
      throw new NotFoundError(`Sales return with ID ${id} not found`);
    }

    if (existing.status !== ReturnStatus.DRAFT) {
      throw new BadRequestError(
        `Cannot update sales return in ${existing.status} status. Only DRAFT returns can be modified.`
      );
    }

    return prisma.$transaction(async (tx) => {
      let totalRefundAmount = Number(existing.totalReturnAmount);

      if (input.items && input.items.length > 0) {
        // Concurrency-safe lock on target sale items
        const uniqueSaleItemIds = [...new Set(input.items.map((i) => i.saleItemId))].sort();

        const lockedSaleItems = await tx.$queryRaw<
          Array<{
            id: string;
            sale_id: string;
            product_id: string;
            quantity: Prisma.Decimal;
            returned_quantity: Prisma.Decimal;
            base_weight_deducted: Prisma.Decimal;
            unit_rate: Prisma.Decimal;
            product_name_snapshot: string;
          }>
        >`
          SELECT id, sale_id, product_id, quantity, returned_quantity, base_weight_deducted, unit_rate, product_name_snapshot
          FROM sale_items
          WHERE id IN (${Prisma.join(uniqueSaleItemIds.map((id) => Prisma.raw(`'${id}'::uuid`)))})
          ORDER BY id ASC
          FOR UPDATE
        `;

        const lockedMap = new Map(lockedSaleItems.map((item) => [item.id, item]));

        // Delete existing items
        await tx.salesReturnItem.deleteMany({ where: { returnId: id } });

        totalRefundAmount = 0;
        for (const reqItem of input.items) {
          const originalItem = lockedMap.get(reqItem.saleItemId);
          if (!originalItem) throw new NotFoundError(`Sale item ID ${reqItem.saleItemId} not found`);
          if (originalItem.sale_id !== existing.originalSaleId) {
            throw new BadRequestError(`Item ${reqItem.saleItemId} does not belong to original sale`);
          }

          const soldQty = Number(originalItem.quantity);
          const alreadyReturnedQty = Number(originalItem.returned_quantity);
          const returnableQty = Math.round((soldQty - alreadyReturnedQty) * 1000) / 1000;

          if (reqItem.returnedQuantity > returnableQty) {
            throw new BadRequestError(
              `Cannot return ${reqItem.returnedQuantity} of ${originalItem.product_name_snapshot}. Remaining returnable: ${returnableQty}`
            );
          }

          const unitRate = Number(originalItem.unit_rate);
          const refundAmount = Math.round(unitRate * reqItem.returnedQuantity * 100) / 100;
          totalRefundAmount += refundAmount;

          await tx.salesReturnItem.create({
            data: {
              returnId: id,
              saleItemId: originalItem.id,
              productId: originalItem.product_id,
              returnedQuantity: new Prisma.Decimal(reqItem.returnedQuantity),
              unitRateSnapshot: new Prisma.Decimal(unitRate),
              refundAmount: new Prisma.Decimal(refundAmount),
              restockCondition: reqItem.restockCondition ?? RestockCondition.RESTOCKABLE,
            },
          });
        }

        totalRefundAmount = Math.round(totalRefundAmount * 100) / 100;
      }

      const updated = await tx.salesReturn.update({
        where: { id },
        data: {
          reason: input.reason ? input.reason.trim() : undefined,
          refundPaymentMode: input.refundPaymentMode ?? undefined,
          totalReturnAmount: new Prisma.Decimal(totalRefundAmount),
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              saleItem: { select: { id: true, unitSymbolSnapshot: true, weightOrPackSnapshot: true } },
            },
          },
          originalSale: { select: { id: true, billNumber: true, createdAt: true, saleStatus: true } },
          customer: { select: { id: true, name: true, mobile: true, customerType: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
      });

      await AuditService.log({
        userId,
        userRole,
        action: 'UPDATE_SALES_RETURN_DRAFT',
        entityType: 'SALES_RETURN',
        entityId: id,
        newValues: {
          totalReturnAmount: totalRefundAmount,
          reason: updated.reason,
        },
        ipAddress,
      });

      return updated;
    });
  }

  /**
   * COMPLETE SALES RETURN DRAFT
   * - Row-level locking on sales_returns protects against double completion
   * - Row-level locking on sale_items verifies returnable quantity under lock
   * - Increments sale_items.returned_quantity
   * - Increases stock exclusively via StockService.increaseStock
   */
  static async completeReturn(
    id: string,
    userId: string,
    userRole: string = 'OUTLET',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Pessimistic row-level lock on SalesReturn
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          return_number: string;
          original_sale_id: string;
          customer_id: string;
          total_return_amount: Prisma.Decimal;
        }>
      >`SELECT id, status, return_number, original_sale_id, customer_id, total_return_amount FROM sales_returns WHERE id = ${id}::uuid FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundError(`Sales return with ID ${id} not found`);
      }

      const locked = lockedRows[0];

      if (locked.status === ReturnStatus.COMPLETED) {
        throw new BadRequestError(`Sales return #${locked.return_number} is already completed`);
      }

      if (locked.status === ReturnStatus.CANCELLED) {
        throw new BadRequestError(`Cannot complete cancelled sales return #${locked.return_number}`);
      }

      // 2. Fetch return items
      const returnItems = await tx.salesReturnItem.findMany({
        where: { returnId: id },
        include: { product: true, saleItem: true },
      });

      if (returnItems.length === 0) {
        throw new BadRequestError(`Sales return #${locked.return_number} contains no items`);
      }

      // 3. Concurrency-Safe Lock on Target SaleItems
      const uniqueSaleItemIds = [...new Set(returnItems.map((i) => i.saleItemId))].sort();

      const lockedSaleItems = await tx.$queryRaw<
        Array<{
          id: string;
          quantity: Prisma.Decimal;
          returned_quantity: Prisma.Decimal;
          base_weight_deducted: Prisma.Decimal;
          product_name_snapshot: string;
        }>
      >`
        SELECT id, quantity, returned_quantity, base_weight_deducted, product_name_snapshot
        FROM sale_items
        WHERE id IN (${Prisma.join(uniqueSaleItemIds.map((itemId) => Prisma.raw(`'${itemId}'::uuid`)))})
        ORDER BY id ASC
        FOR UPDATE
      `;

      const lockedMap = new Map(lockedSaleItems.map((item) => [item.id, item]));

      // 4. Validate returnable quantities and restock
      for (const retItem of returnItems) {
        const originalItem = lockedMap.get(retItem.saleItemId);
        if (!originalItem) {
          throw new NotFoundError(`Original sale item ${retItem.saleItemId} not found`);
        }

        const soldQty = Number(originalItem.quantity);
        const alreadyReturnedQty = Number(originalItem.returned_quantity);
        const returnableQty = Math.round((soldQty - alreadyReturnedQty) * 1000) / 1000;
        const requestedQty = Number(retItem.returnedQuantity);

        if (requestedQty > returnableQty) {
          throw new BadRequestError(
            `Cannot complete return: item ${originalItem.product_name_snapshot} requested ${requestedQty}, but only ${returnableQty} remains returnable`
          );
        }

        // Increment returned quantity on original sale item
        await tx.saleItem.update({
          where: { id: retItem.saleItemId },
          data: {
            returnedQuantity: { increment: requestedQty },
          },
        });

        // Restock via centralized StockService if RESTOCKABLE
        if (retItem.restockCondition === RestockCondition.RESTOCKABLE) {
          const baseRatio = Number(originalItem.base_weight_deducted) / soldQty;
          const baseWeightToRestock = Math.round(baseRatio * requestedQty * 1000) / 1000;

          await StockService.increaseStock(
            {
              productId: retItem.productId,
              quantityDelta: baseWeightToRestock,
              movementType: MovementType.SALES_RETURN_IN,
              referenceType: ReferenceType.SALES_RETURN,
              referenceId: id,
              notes: `Completed Return #${locked.return_number} - ${retItem.product.name}`,
              userId,
            },
            tx
          );
        }
      }

      // 5. Mark COMPLETED
      const completedReturn = await tx.salesReturn.update({
        where: { id },
        data: {
          status: ReturnStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              saleItem: { select: { id: true, unitSymbolSnapshot: true, weightOrPackSnapshot: true } },
            },
          },
          originalSale: { select: { id: true, billNumber: true, createdAt: true } },
          customer: { select: { id: true, name: true, mobile: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
      });

      // 6. Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: 'COMPLETE_SALES_RETURN',
        entityType: 'SALES_RETURN',
        entityId: id,
        newValues: {
          returnNumber: locked.return_number,
          status: ReturnStatus.COMPLETED,
          totalReturnAmount: Number(locked.total_return_amount),
        },
        ipAddress,
      });

      return completedReturn;
    });
  }

  /**
   * CANCEL SALES RETURN
   * - If DRAFT: marks CANCELLED without affecting stock or returned_quantity
   * - If COMPLETED: reverses returned_quantity and reverses stock via StockService.decreaseStock
   */
  static async cancelReturn(
    id: string,
    userId: string,
    input: CancelReturnInput,
    userRole: string = 'OUTLET',
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock SalesReturn row FOR UPDATE
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          return_number: string;
          original_sale_id: string;
        }>
      >`SELECT id, status, return_number, original_sale_id FROM sales_returns WHERE id = ${id}::uuid FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundError(`Sales return with ID ${id} not found`);
      }

      const locked = lockedRows[0];

      if (locked.status === ReturnStatus.CANCELLED) {
        throw new BadRequestError(`Sales return #${locked.return_number} is already cancelled`);
      }

      const wasCompleted = locked.status === ReturnStatus.COMPLETED;

      // 2. Fetch return items
      const returnItems = await tx.salesReturnItem.findMany({
        where: { returnId: id },
        include: { saleItem: true, product: true },
      });

      // 3. If was COMPLETED: reverse returned_quantity on SaleItems and decrease stock
      if (wasCompleted) {
        for (const item of returnItems) {
          const returnedQty = Number(item.returnedQuantity);

          await tx.saleItem.update({
            where: { id: item.saleItemId },
            data: {
              returnedQuantity: { decrement: returnedQty },
            },
          });

          if (item.restockCondition === RestockCondition.RESTOCKABLE) {
            const soldQty = Number(item.saleItem.quantity);
            const baseRatio = Number(item.saleItem.baseWeightDeducted) / soldQty;
            const baseWeightToReverse = Math.round(baseRatio * returnedQty * 1000) / 1000;

            await StockService.decreaseStock(
              {
                productId: item.productId,
                quantityDelta: baseWeightToReverse,
                movementType: MovementType.ADJUSTMENT_OUT,
                referenceType: ReferenceType.SALES_RETURN,
                referenceId: id,
                notes: `Cancelled Sales Return #${locked.return_number}: ${input.reason.trim()} - ${item.product.name}`,
                userId,
              },
              tx
            );
          }
        }
      }

      // 4. Mark CANCELLED
      const cancelledReturn = await tx.salesReturn.update({
        where: { id },
        data: {
          status: ReturnStatus.CANCELLED,
          cancellationReason: input.reason.trim(),
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              saleItem: { select: { id: true, unitSymbolSnapshot: true, weightOrPackSnapshot: true } },
            },
          },
          originalSale: { select: { id: true, billNumber: true, createdAt: true } },
          customer: { select: { id: true, name: true, mobile: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
      });

      // 5. Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: 'CANCEL_SALES_RETURN',
        entityType: 'SALES_RETURN',
        entityId: id,
        oldValues: { status: locked.status },
        newValues: {
          status: ReturnStatus.CANCELLED,
          cancellationReason: input.reason.trim(),
          stockReversed: wasCompleted,
        },
        ipAddress,
      });

      return cancelledReturn;
    });
  }

  /**
   * RETURN PREVIEW FOR A BILL
   * Inspects sold items, already returned quantities, remaining returnables, and max refunds.
   */
  static async getReturnPreview(saleIdentifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleIdentifier);

    const sale = await prisma.sale.findFirst({
      where: isUuid ? { id: saleIdentifier } : { billNumber: saleIdentifier },
      include: {
        customer: true,
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, isActive: true } },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundError(`Sale record "${saleIdentifier}" not found`);
    }

    if (sale.saleStatus === SaleStatus.CANCELLED) {
      throw new BadRequestError(`Sale #${sale.billNumber} has been cancelled and cannot be returned`);
    }

    const items = sale.items.map((item) => {
      const soldQuantity = Number(item.quantity);
      const alreadyReturnedQuantity = Number(item.returnedQuantity);
      const remainingReturnableQuantity = Math.max(
        0,
        Math.round((soldQuantity - alreadyReturnedQuantity) * 1000) / 1000
      );
      const unitRate = Number(item.unitRate);
      const maxReturnAmount = Math.round(unitRate * remainingReturnableQuantity * 100) / 100;

      return {
        saleItemId: item.id,
        productId: item.productId,
        productName: item.productNameSnapshot,
        productCode: item.product.code,
        unitSymbol: item.unitSymbolSnapshot,
        weightOrPack: item.weightOrPackSnapshot,
        soldQuantity,
        alreadyReturnedQuantity,
        remainingReturnableQuantity,
        unitRate,
        maxReturnAmount,
        isEligibleForReturn: remainingReturnableQuantity > 0,
      };
    });

    const totalEligibleAmount = items.reduce((sum, item) => sum + item.maxReturnAmount, 0);

    return {
      originalSaleId: sale.id,
      billNumber: sale.billNumber,
      saleDate: sale.createdAt,
      customerId: sale.customerId,
      customerName: sale.customerNameSnapshot,
      customerMobile: sale.customerMobileSnapshot,
      customerType: sale.customerTypeSnapshot,
      totalBillAmount: Number(sale.finalTotalAmount),
      totalEligibleAmount: Math.round(totalEligibleAmount * 100) / 100,
      items,
    };
  }

  /**
   * RETURN SUMMARY METRICS DASHBOARD
   */
  static async getReturnSummary() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      totalReturnCount,
      draftCount,
      completedCount,
      cancelledCount,
      todayCompletedReturns,
      allCompletedReturns,
      recentReturns,
    ] = await Promise.all([
      prisma.salesReturn.count(),
      prisma.salesReturn.count({ where: { status: ReturnStatus.DRAFT } }),
      prisma.salesReturn.count({ where: { status: ReturnStatus.COMPLETED } }),
      prisma.salesReturn.count({ where: { status: ReturnStatus.CANCELLED } }),
      prisma.salesReturn.findMany({
        where: {
          status: ReturnStatus.COMPLETED,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        select: { totalReturnAmount: true },
      }),
      prisma.salesReturn.findMany({
        where: { status: ReturnStatus.COMPLETED },
        select: { totalReturnAmount: true },
      }),
      prisma.salesReturn.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          originalSale: { select: { billNumber: true } },
          customer: { select: { name: true, mobile: true } },
          user: { select: { fullName: true } },
        },
      }),
    ]);

    const todayReturnAmount = todayCompletedReturns.reduce(
      (sum, r) => sum + Number(r.totalReturnAmount),
      0
    );

    const totalReturnAmount = allCompletedReturns.reduce(
      (sum, r) => sum + Number(r.totalReturnAmount),
      0
    );

    return {
      todayReturnCount: todayCompletedReturns.length,
      todayReturnAmount: Math.round(todayReturnAmount * 100) / 100,
      totalReturnCount,
      totalReturnAmount: Math.round(totalReturnAmount * 100) / 100,
      draftCount,
      completedCount,
      cancelledCount,
      recentReturns: recentReturns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        originalBillNumber: r.originalSale.billNumber,
        customerName: r.customer.name,
        totalReturnAmount: Number(r.totalReturnAmount),
        status: r.status,
        createdAt: r.createdAt,
        createdByName: r.user.fullName,
      })),
    };
  }

  /**
   * GET SALES RETURN BY ID
   */
  static async getById(id: string) {
    const record = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, primaryUnit: true } },
            saleItem: { select: { id: true, quantity: true, unitRate: true, unitSymbolSnapshot: true, weightOrPackSnapshot: true } },
          },
        },
        originalSale: {
          select: {
            id: true,
            billNumber: true,
            createdAt: true,
            finalTotalAmount: true,
            paymentStatus: true,
            saleStatus: true,
          },
        },
        customer: { select: { id: true, name: true, mobile: true, customerType: true } },
        user: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!record) {
      throw new NotFoundError(`Sales return with ID ${id} not found`);
    }

    return {
      id: record.id,
      returnNumber: record.returnNumber,
      originalSaleId: record.originalSaleId,
      originalBillNumber: record.originalSale.billNumber,
      saleDate: record.originalSale.createdAt,
      customerId: record.customerId,
      customerName: record.customer.name,
      customerMobile: record.customer.mobile,
      customerType: record.customer.customerType,
      totalReturnAmount: Number(record.totalReturnAmount),
      refundPaymentMode: record.refundPaymentMode,
      status: record.status,
      reason: record.reason,
      cancellationReason: record.cancellationReason,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.user ? { id: record.user.id, fullName: record.user.fullName, username: record.user.username } : null,
      items: record.items.map((item) => ({
        id: item.id,
        saleItemId: item.saleItemId,
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.code,
        returnedQuantity: Number(item.returnedQuantity),
        originalSoldQuantity: Number(item.saleItem.quantity),
        unitRateSnapshot: Number(item.unitRateSnapshot),
        refundAmount: Number(item.refundAmount),
        restockCondition: item.restockCondition,
        unitSymbol: item.saleItem.unitSymbolSnapshot,
        weightOrPack: item.saleItem.weightOrPackSnapshot,
      })),
    };
  }

  /**
   * LIST SALES RETURNS WITH RICH FILTERS & PAGINATION
   */
  static async listReturns(query: ReturnsQueryInput) {
    const {
      returnNumber,
      originalBillNumber,
      customerId,
      productId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.SalesReturnWhereInput = {};

    if (returnNumber) {
      where.returnNumber = { contains: returnNumber, mode: 'insensitive' };
    }

    if (originalBillNumber) {
      where.originalSale = { billNumber: { contains: originalBillNumber, mode: 'insensitive' } };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (productId) {
      where.items = {
        some: { productId },
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [items, total] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          originalSale: { select: { id: true, billNumber: true } },
          customer: { select: { id: true, name: true, mobile: true } },
          user: { select: { id: true, fullName: true, username: true } },
          items: {
            select: {
              id: true,
              productId: true,
              returnedQuantity: true,
              refundAmount: true,
              product: { select: { name: true, code: true } },
            },
          },
        },
      }),
      prisma.salesReturn.count({ where }),
    ]);

    const formatted = items.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      originalSaleId: r.originalSaleId,
      originalBillNumber: r.originalSale.billNumber,
      customerId: r.customerId,
      customerName: r.customer.name,
      customerMobile: r.customer.mobile,
      totalReturnAmount: Number(r.totalReturnAmount),
      refundPaymentMode: r.refundPaymentMode,
      status: r.status,
      reason: r.reason,
      cancellationReason: r.cancellationReason,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      createdBy: r.user ? { id: r.user.id, fullName: r.user.fullName, username: r.user.username } : null,
      itemCount: r.items.length,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        productCode: i.product.code,
        returnedQuantity: Number(i.returnedQuantity),
        refundAmount: Number(i.refundAmount),
      })),
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
}
