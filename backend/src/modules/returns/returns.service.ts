import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { CreateReturnInput, ReturnsQueryInput } from './returns.validation.js';
import { MovementType, ReferenceType } from '@prisma/client';

export class ReturnsService {
  /**
   * ATOMIC SALES RETURN TRANSACTION
   * 1. Validates original sale and items
   * 2. Checks return quantity <= remaining eligible quantity
   * 3. Calculates refund using historical snapshot rate from original sale
   * 4. Updates sale_items.returned_quantity
   * 5. If restockable, increments stock balance and logs to movement ledger
   */
  static async createReturn(userId: string, input: CreateReturnInput) {
    const originalSale = await prisma.sale.findUnique({
      where: { id: input.originalSaleId },
      include: { items: true, customer: true },
    });

    if (!originalSale) {
      throw new NotFoundError('Original sale record not found');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Generate Return Number (e.g., RET-YYYYMMDD-0001)
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const returnCount = await tx.salesReturn.count();
      const returnNumber = `RET-${datePart}-${String(returnCount + 1).padStart(4, '0')}`;

      let totalRefundAmount = 0;

      // 2. Validate items
      const preparedReturnItems = [];

      for (const returnReq of input.items) {
        const originalItem = originalSale.items.find((i) => i.id === returnReq.saleItemId);
        if (!originalItem) {
          throw new BadRequestError(`Item ID ${returnReq.saleItemId} is not part of this sale`);
        }

        const eligibleQty = Number(originalItem.quantity) - Number(originalItem.returnedQuantity);
        if (returnReq.returnedQuantity > eligibleQty) {
          throw new BadRequestError(
            `Cannot return ${returnReq.returnedQuantity} of ${originalItem.productNameSnapshot}. Max eligible: ${eligibleQty}`
          );
        }

        // Calculate refund: unitRate * returnedQty
        const unitRate = Number(originalItem.unitRate);
        const refundAmount = Math.round(unitRate * returnReq.returnedQuantity * 100) / 100;
        totalRefundAmount += refundAmount;

        // Calculate base weight to restock proportionally
        const baseRatio = Number(originalItem.baseWeightDeducted) / Number(originalItem.quantity);
        const baseWeightToRestock = baseRatio * returnReq.returnedQuantity;

        preparedReturnItems.push({
          saleItemId: originalItem.id,
          productId: originalItem.productId,
          productName: originalItem.productNameSnapshot,
          returnedQuantity: returnReq.returnedQuantity,
          unitRateSnapshot: unitRate,
          refundAmount,
          restockCondition: returnReq.restockCondition,
          baseWeightToRestock,
        });
      }

      // 3. Create Sales Return Header
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          originalSaleId: originalSale.id,
          customerId: originalSale.customerId,
          totalReturnAmount: totalRefundAmount,
          refundPaymentMode: input.refundPaymentMode,
          reason: input.reason,
          createdBy: userId,
        },
      });

      // 4. Create Return Items and Restock
      for (const retItem of preparedReturnItems) {
        await tx.salesReturnItem.create({
          data: {
            returnId: salesReturn.id,
            saleItemId: retItem.saleItemId,
            productId: retItem.productId,
            returnedQuantity: retItem.returnedQuantity,
            unitRateSnapshot: retItem.unitRateSnapshot,
            refundAmount: retItem.refundAmount,
            restockCondition: retItem.restockCondition,
          },
        });

        // Update returned quantity on original sale item
        await tx.saleItem.update({
          where: { id: retItem.saleItemId },
          data: {
            returnedQuantity: { increment: retItem.returnedQuantity },
          },
        });

        // If restockable, update stock and movement ledger
        if (retItem.restockCondition === 'RESTOCKABLE') {
          const updatedStock = await tx.stock.update({
            where: { productId: retItem.productId },
            data: {
              currentBalance: { increment: retItem.baseWeightToRestock },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: retItem.productId,
              movementType: MovementType.SALES_RETURN_IN,
              referenceType: ReferenceType.SALES_RETURN,
              referenceId: salesReturn.id,
              quantityDelta: retItem.baseWeightToRestock,
              balanceAfter: updatedStock.currentBalance,
              notes: `Returned via #${returnNumber} (Original: #${originalSale.billNumber})`,
              createdBy: userId,
            },
          });
        }
      }

      return tx.salesReturn.findUnique({
        where: { id: salesReturn.id },
        include: {
          items: true,
          originalSale: { select: { billNumber: true, createdAt: true } },
          customer: true,
        },
      });
    });
  }

  static async getById(id: string) {
    const record = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        originalSale: true,
        customer: true,
      },
    });

    if (!record) throw new NotFoundError('Sales return not found');
    return record;
  }

  static async listReturns(query: ReturnsQueryInput) {
    const { returnNumber, originalBillNumber, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (returnNumber) where.returnNumber = { contains: returnNumber, mode: 'insensitive' };
    if (originalBillNumber) {
      where.originalSale = { billNumber: { contains: originalBillNumber, mode: 'insensitive' } };
    }

    const [items, total] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          originalSale: { select: { billNumber: true } },
          customer: { select: { name: true, mobile: true } },
          user: { select: { fullName: true } },
        },
      }),
      prisma.salesReturn.count({ where }),
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
}
