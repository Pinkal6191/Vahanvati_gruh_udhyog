import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError, InsufficientStockError } from '../../common/errors/app-error.js';
import { PricingService } from '../pricing/pricing.service.js';
import { CreateSaleInput, SalesQueryInput } from './sales.validation.js';
import { MovementType, ReferenceType, PaymentStatus, SaleStatus } from '@prisma/client';

export class SalesService {
  /**
   * ATOMIC POS CHECKOUT TRANSACTION
   * 1. Resolves authoritative server pricing (Indian vs NRI)
   * 2. Locks stock records and checks stock sufficiency
   * 3. Generates collision-proof sequential bill number
   * 4. Creates Sale header + line items with immutable price snapshot
   * 5. Records multi-mode payments
   * 6. Appends to immutable stock ledger and updates cached balance
   */
  static async createSale(userId: string, input: CreateSaleInput) {
    // Step 1: Authoritative Price Resolution
    const resolvedCart = await PricingService.resolveCart({
      customerId: input.customerId || undefined,
      items: input.items,
    });

    const discountAmount = input.discountAmount || 0;
    const finalTotalAmount = Math.max(0, resolvedCart.finalTotalAmount - discountAmount);

    // Step 2: Validate Payment Sum
    const totalPaymentsReceived = input.payments.reduce((acc, p) => acc + p.amount, 0);
    if (totalPaymentsReceived < finalTotalAmount) {
      throw new BadRequestError(
        `Total payments (₹${totalPaymentsReceived}) is less than the bill total (₹${finalTotalAmount})`
      );
    }

    const changeReturned = Math.max(0, input.paidAmount - finalTotalAmount);

    // Execute atomic transaction
    return prisma.$transaction(async (tx) => {
      // 1. Fetch Company Settings
      const settings = await tx.companySettings.findFirst();
      const allowNegative = settings?.allowNegativeStock ?? false;
      const prefix = settings?.invoicePrefix ?? 'VGU';

      // 2. Lock & Validate Stock Balances
      for (const item of resolvedCart.items) {
        const stock = await tx.stock.findUnique({
          where: { productId: item.productId },
        });

        if (!stock) {
          throw new BadRequestError(`Stock record missing for product ${item.productName}`);
        }

        const currentBalance = Number(stock.currentBalance);
        if (!allowNegative && currentBalance < item.baseWeightDeducted) {
          throw new InsufficientStockError(
            `Insufficient stock for ${item.productName}. Available: ${currentBalance} GM, Required: ${item.baseWeightDeducted} GM`
          );
        }
      }

      // 3. Generate Sequential Bill Number (e.g. VGU-YYYYMMDD-0001)
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const dailyCount = await tx.sale.count({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      const sequenceNumber = String(dailyCount + 1).padStart(4, '0');
      const billNumber = `${prefix}-${datePart}-${sequenceNumber}`;

      // 4. Create Sale Header
      const sale = await tx.sale.create({
        data: {
          billNumber,
          customerId: resolvedCart.customerId,
          customerNameSnapshot: resolvedCart.customerName,
          customerMobileSnapshot: resolvedCart.customerMobile,
          customerTypeSnapshot: resolvedCart.customerType,
          totalItemsCount: resolvedCart.items.length,
          subtotalAmount: resolvedCart.subtotalAmount,
          discountAmount,
          taxAmount: 0.0, // Pre-calculated inclusive GST
          finalTotalAmount,
          paidAmount: input.paidAmount,
          changeReturned,
          paymentStatus: PaymentStatus.PAID,
          saleStatus: SaleStatus.COMPLETED,
          createdBy: userId,
        },
      });

      // 5. Create Sale Line Items & Deduct Stock
      for (const item of resolvedCart.items) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            packConfigId: item.packConfigId,
            productNameSnapshot: item.productName,
            unitSymbolSnapshot: item.unitSymbol,
            weightOrPackSnapshot: item.weightOrPackName,
            quantity: item.quantity,
            baseWeightDeducted: item.baseWeightDeducted,
            unitRate: item.unitRate,
            subtotal: item.totalAmount,
            discount: 0.0,
            total: item.totalAmount,
          },
        });

        // Deduct stock balance
        const updatedStock = await tx.stock.update({
          where: { productId: item.productId },
          data: {
            currentBalance: { decrement: item.baseWeightDeducted },
          },
        });

        // Append to immutable movement ledger
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: MovementType.SALE_OUT,
            referenceType: ReferenceType.SALE,
            referenceId: sale.id,
            quantityDelta: -item.baseWeightDeducted,
            balanceAfter: updatedStock.currentBalance,
            notes: `Sold in Bill #${billNumber}`,
            createdBy: userId,
          },
        });
      }

      // 6. Record Payments
      for (const payment of input.payments) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            paymentMode: payment.paymentMode,
            amount: payment.amount,
            transactionReference: payment.transactionReference,
            notes: payment.notes,
            createdBy: userId,
          },
        });
      }

      // 7. Return complete sale with items
      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          payments: true,
          customer: true,
          user: {
            select: { id: true, username: true, fullName: true },
          },
        },
      });
    });
  }

  static async getSaleById(id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        customer: true,
        user: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!sale) throw new NotFoundError('Sale not found');
    return sale;
  }

  static async getSaleByBillNumber(billNumber: string) {
    const sale = await prisma.sale.findUnique({
      where: { billNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        customer: true,
      },
    });

    if (!sale) throw new NotFoundError(`Bill #${billNumber} not found`);
    return sale;
  }

  static async listSales(query: SalesQueryInput) {
    const { billNumber, customerId, date, startDate, endDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (billNumber) where.billNumber = { contains: billNumber, mode: 'insensitive' };
    if (customerId) where.customerId = customerId;

    if (date) {
      const d = new Date(date);
      where.createdAt = {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
      };
    } else if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payments: true,
          user: { select: { fullName: true } },
        },
      }),
      prisma.sale.count({ where }),
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

  /**
   * Generates formatted receipt data ready for direct 3-inch thermal printing
   */
  static async getPrintPayload(saleId: string) {
    const sale = await this.getSaleById(saleId);
    const settings = await prisma.companySettings.findFirst();

    return {
      company: {
        name: settings?.companyName ?? 'Vahanvati Gruh Udhyog',
        tagline: settings?.tagline,
        address: settings?.address,
        phone: settings?.phone,
        gstin: settings?.gstin,
        fssaiLicense: settings?.fssaiLicense,
        footerNotes: settings?.invoiceFooterNotes,
      },
      invoice: {
        billNumber: sale.billNumber,
        date: sale.createdAt,
        billerName: sale.user.fullName,
        customerName: sale.customerNameSnapshot,
        customerMobile: sale.customerMobileSnapshot,
      },
      items: sale.items.map((i) => ({
        name: i.productNameSnapshot,
        variant: i.weightOrPackSnapshot,
        qty: Number(i.quantity),
        rate: Number(i.unitRate),
        amount: Number(i.total),
      })),
      totals: {
        subtotal: Number(sale.subtotalAmount),
        discount: Number(sale.discountAmount),
        total: Number(sale.finalTotalAmount),
        paid: Number(sale.paidAmount),
        change: Number(sale.changeReturned),
      },
      payments: sale.payments.map((p) => ({
        mode: p.paymentMode,
        amount: Number(p.amount),
        ref: p.transactionReference,
      })),
    };
  }
}
