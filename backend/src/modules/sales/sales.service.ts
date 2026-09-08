import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError, InsufficientStockError } from '../../common/errors/app-error.js';
import { PricingService } from '../pricing/pricing.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateSaleInput, CreateSaleItemInput, SalesQueryInput, CancelSaleInput } from './sales.validation.js';
import { StockService } from '../inventory/stock.service.js';
import { MovementType, ReferenceType, PaymentStatus, SaleStatus, Prisma } from '@prisma/client';

export class SalesService {
  /**
   * Helper: Merges duplicate items for the same product and variant/weight in the incoming request
   */
  private static mergeDuplicateItems(items: CreateSaleItemInput[]): CreateSaleItemInput[] {
    const mergedMap = new Map<string, CreateSaleItemInput>();

    for (const item of items) {
      const key = `${item.productId}_${item.packConfigId ?? 'loose'}`;
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        if (item.looseWeightInGrams && existing.looseWeightInGrams) {
          existing.looseWeightInGrams += item.looseWeightInGrams;
        } else {
          existing.quantity += item.quantity;
        }
      } else {
        mergedMap.set(key, { ...item });
      }
    }

    return Array.from(mergedMap.values());
  }

  /**
   * ATOMIC POS CHECKOUT TRANSACTION
   * 1. Merges duplicate items
   * 2. Resolves authoritative server pricing via Step 4 Pricing Engine (Indian vs NRI)
   * 3. Locks CompanySettings row for concurrent serialized bill numbering
   * 4. Locks Stock rows with row-level locks (FOR UPDATE) to prevent race conditions & double-selling
   * 5. Creates Sale header + line items with immutable price snapshot
   * 6. Records multi-mode payments
   * 7. Appends to immutable stock movement ledger and updates cached balance
   * 8. Records comprehensive audit log
   */
  static async createSale(
    userId: string,
    userRoleOrInput: string | CreateSaleInput,
    inputOrIp?: CreateSaleInput | string | null,
    ipAddress?: string | null
  ) {
    let userRole = 'OUTLET';
    let input: CreateSaleInput;
    let ip: string | null = null;

    if (typeof userRoleOrInput === 'string') {
      userRole = userRoleOrInput;
      input = inputOrIp as CreateSaleInput;
      ip = ipAddress || null;
    } else {
      input = userRoleOrInput;
      ip = (inputOrIp as string) || null;
    }

    // 1. Merge duplicate line items
    const mergedItems = this.mergeDuplicateItems(input.items);

    // 2. Authoritative Price Resolution via Step 4 Pricing Engine
    const resolvedCart = await PricingService.resolveCart({
      customerId: input.customerId || undefined,
      customerType: input.customerType || undefined,
      items: mergedItems,
    });

    const discountAmount = Math.round(Number(input.discountAmount || 0) * 100) / 100;
    const finalTotalAmount = Math.max(0, Math.round(resolvedCart.finalTotalAmount - discountAmount));

    // 3. Validate Payments Sum
    const totalPaymentsReceived = Math.round(input.payments.reduce((acc, p) => acc + p.amount, 0) * 100) / 100;
    if (totalPaymentsReceived < finalTotalAmount) {
      throw new BadRequestError(
        `Total payments (₹${totalPaymentsReceived}) is less than the bill total (₹${finalTotalAmount})`
      );
    }

    const changeReturned = Math.max(0, Math.round((input.paidAmount - finalTotalAmount) * 100) / 100);

    // 4. Execute atomic transaction
    return prisma.$transaction(async (tx) => {
      // 4.1 Acquire exclusive lock on CompanySettings to serialize sequential bill number assignment
      const settingsRows = await tx.$queryRaw<
        Array<{ id: string; invoice_prefix: string; allow_negative_stock: boolean }>
      >`SELECT id, invoice_prefix, allow_negative_stock FROM company_settings LIMIT 1 FOR UPDATE`;

      const settings = settingsRows && settingsRows.length > 0 ? settingsRows[0] : null;
      const prefix = settings?.invoice_prefix ?? 'VGU';
      const allowNegative = settings?.allow_negative_stock ?? false;

      // 4.2 Generate Sequential Bill Number (e.g. VGU-YYYYMMDD-0001)
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const latestSaleToday = await tx.sale.findFirst({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        orderBy: { billNumber: 'desc' },
        select: { billNumber: true },
      });

      let nextSeq = 1;
      if (latestSaleToday && latestSaleToday.billNumber) {
        const parts = latestSaleToday.billNumber.split('-');
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }

      const sequenceNumber = String(nextSeq).padStart(4, '0');
      const billNumber = `${prefix}-${datePart}-${sequenceNumber}`;

      // 4.3 Create Sale Header
      const sale = await tx.sale.create({
        data: {
          billNumber,
          customerId: resolvedCart.customerId,
          customerNameSnapshot: resolvedCart.customerName,
          customerMobileSnapshot: resolvedCart.customerMobile,
          customerTypeSnapshot: resolvedCart.customerType,
          totalItemsCount: resolvedCart.items.length,
          subtotalAmount: new Prisma.Decimal(resolvedCart.subtotalAmount),
          discountAmount: new Prisma.Decimal(discountAmount),
          taxAmount: new Prisma.Decimal(0.0), // Pre-calculated inclusive GST
          finalTotalAmount: new Prisma.Decimal(finalTotalAmount),
          paidAmount: new Prisma.Decimal(input.paidAmount),
          changeReturned: new Prisma.Decimal(changeReturned),
          paymentStatus: PaymentStatus.PAID,
          saleStatus: SaleStatus.COMPLETED,
          createdBy: userId,
        },
      });

      // 4.4 Create Sale Line Items
      for (const item of resolvedCart.items) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            packConfigId: item.packConfigId,
            productNameSnapshot: item.productName,
            unitSymbolSnapshot: item.unitSymbol,
            weightOrPackSnapshot: item.weightOrPackName,
            quantity: new Prisma.Decimal(item.quantity),
            baseWeightDeducted: new Prisma.Decimal(item.baseWeightDeducted),
            unitRate: new Prisma.Decimal(item.unitRate),
            subtotal: new Prisma.Decimal(item.totalAmount),
            discount: new Prisma.Decimal(0.0),
            total: new Prisma.Decimal(item.totalAmount),
          },
        });
      }

      // 4.5 Deduct Stock via Centralized StockService (with row locks & sufficiency checks)
      await StockService.batchDecreaseStock(
        resolvedCart.items.map((item) => ({
          productId: item.productId,
          quantityDelta: item.baseWeightDeducted,
          productName: item.productName,
        })),
        {
          movementType: MovementType.SALE_OUT,
          referenceType: ReferenceType.SALE,
          referenceId: sale.id,
          billNumber,
          userId,
          allowNegativeStock: allowNegative,
        },
        tx
      );

      // 4.6 Record Payments
      for (const payment of input.payments) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            paymentMode: payment.paymentMode,
            amount: new Prisma.Decimal(payment.amount),
            transactionReference: payment.transactionReference,
            notes: payment.notes,
            createdBy: userId,
          },
        });
      }

      // 4.7 Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: 'CREATE_SALE',
        entityType: 'SALE',
        entityId: sale.id,
        newValues: {
          billNumber,
          finalTotalAmount,
          itemsCount: resolvedCart.items.length,
          customerId: resolvedCart.customerId,
          payments: input.payments,
        },
        ipAddress: ip,
      });

      // 4.8 Return complete sale with relations
      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          payments: true,
          customer: true,
          user: {
            select: { id: true, username: true, fullName: true, role: true },
          },
        },
      });
    });
  }

  /**
   * Cancel an existing completed sale:
   * Reverses stock movements and marks sale as CANCELLED.
   */
  static async cancelSale(
    saleId: string,
    userId: string,
    userRole: string,
    input: CancelSaleInput,
    ipAddress?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!sale) {
        throw new NotFoundError('Sale not found');
      }

      if (sale.saleStatus === SaleStatus.CANCELLED) {
        throw new BadRequestError('Sale is already cancelled');
      }

      // 1. Reverse stock movements for each line item via centralized StockService
      for (const item of sale.items) {
        await StockService.increaseStock(
          {
            productId: item.productId,
            quantityDelta: Number(item.baseWeightDeducted),
            movementType: MovementType.ADJUSTMENT_IN,
            referenceType: ReferenceType.SALE,
            referenceId: sale.id,
            notes: `Cancelled Bill #${sale.billNumber}: ${input.reason}`,
            userId,
          },
          tx
        );
      }

      // 2. Mark Sale as CANCELLED
      const cancelledSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          saleStatus: SaleStatus.CANCELLED,
          cancellationReason: input.reason,
        },
        include: {
          items: true,
          payments: true,
          customer: true,
        },
      });

      // 3. Audit Log
      await AuditService.log({
        userId,
        userRole,
        action: 'CANCEL_SALE',
        entityType: 'SALE',
        entityId: sale.id,
        oldValues: { saleStatus: sale.saleStatus },
        newValues: { saleStatus: SaleStatus.CANCELLED, cancellationReason: input.reason },
        ipAddress,
      });

      return cancelledSale;
    });
  }

  static async getSaleById(id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        customer: true,
        user: { select: { id: true, username: true, fullName: true, role: true } },
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
        user: { select: { id: true, username: true, fullName: true, role: true } },
      },
    });

    if (!sale) throw new NotFoundError(`Bill #${billNumber} not found`);
    return sale;
  }

  static async listSales(query: SalesQueryInput) {
    const {
      billNumber,
      customerId,
      customerType,
      paymentMode,
      saleStatus,
      date,
      startDate,
      endDate,
      createdBy,
      page,
      limit,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {};
    if (billNumber) where.billNumber = { contains: billNumber, mode: 'insensitive' };
    if (customerId) where.customerId = customerId;
    if (customerType) where.customerTypeSnapshot = customerType;
    if (saleStatus) where.saleStatus = saleStatus;
    if (createdBy) where.createdBy = createdBy;

    if (paymentMode) {
      where.payments = {
        some: { paymentMode },
      };
    }

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
          customer: { select: { id: true, name: true, mobile: true } },
          user: { select: { id: true, fullName: true, role: true } },
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
   * Generates formatted receipt data ready for direct 3-inch thermal printing.
   * Note: Customer tier (INDIAN/NRI) is intentionally omitted from the printed bill.
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
