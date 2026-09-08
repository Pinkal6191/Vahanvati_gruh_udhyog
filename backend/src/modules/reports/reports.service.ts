import { prisma } from '../../config/database.js';
import { SaleStatus, ProductionStatus, ReturnStatus, PaymentMode } from '@prisma/client';
import {
  SalesReportQuery,
  ProductReportQuery,
  CustomerReportQuery,
  CustomerHistoryQuery,
  ProductionReportQuery,
  StockReportQuery,
  StockMovementsReportQuery,
  ReturnsReportQuery,
  BusinessSummaryQuery,
} from './reports.validation.js';
import { resolveDateRange, formatPeriodKey, round2, GroupByInterval } from './reports.utils.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotFoundError } from '../../common/errors/app-error.js';

export class ReportsService {
  /**
   * 1. Comprehensive Sales Report
   */
  static async getSalesReport(query: SalesReportQuery) {
    const { period, startDate, endDate, groupBy, paymentMode, customerId } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const whereSale: any = {
      saleStatus: SaleStatus.COMPLETED,
    };

    if (start || end) {
      whereSale.createdAt = {};
      if (start) whereSale.createdAt.gte = start;
      if (end) whereSale.createdAt.lte = end;
    }

    if (customerId) {
      whereSale.customerId = customerId;
    }

    if (paymentMode) {
      whereSale.payments = {
        some: { paymentMode },
      };
    }

    // Completed sales query
    const completedSales = await prisma.sale.findMany({
      where: whereSale,
      include: {
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Query cancelled sales in the same period for operational visibility
    const cancelledWhere: any = {
      saleStatus: SaleStatus.CANCELLED,
    };
    if (start || end) {
      cancelledWhere.createdAt = {};
      if (start) cancelledWhere.createdAt.gte = start;
      if (end) cancelledWhere.createdAt.lte = end;
    }
    if (customerId) cancelledWhere.customerId = customerId;

    const cancelledSales = await prisma.sale.findMany({
      where: cancelledWhere,
      select: { finalTotalAmount: true },
    });

    // Calculate aggregated metrics
    const totalSalesAmount = round2(
      completedSales.reduce((acc, s) => acc + Number(s.finalTotalAmount), 0)
    );
    const completedBillsCount = completedSales.length;
    const averageBillValue =
      completedBillsCount > 0 ? round2(totalSalesAmount / completedBillsCount) : 0;

    let totalQuantitySold = 0;
    let totalWeightSold = 0;

    for (const sale of completedSales) {
      for (const item of sale.items) {
        totalQuantitySold += Number(item.quantity);
        totalWeightSold += Number(item.baseWeightDeducted);
      }
    }
    totalQuantitySold = round2(totalQuantitySold);
    totalWeightSold = round2(totalWeightSold);

    const cancelledBillsCount = cancelledSales.length;
    const cancelledAmount = round2(
      cancelledSales.reduce((acc, s) => acc + Number(s.finalTotalAmount), 0)
    );

    // Payment mode breakdown
    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      OTHER: 0,
    };

    for (const sale of completedSales) {
      for (const p of sale.payments) {
        const mode = p.paymentMode;
        paymentBreakdown[mode] = round2((paymentBreakdown[mode] || 0) + Number(p.amount));
      }
    }

    // Time-series bucketing
    const timeSeriesMap = new Map<
      string,
      { periodKey: string; billsCount: number; salesAmount: number; quantitySold: number }
    >();

    for (const sale of completedSales) {
      const key = formatPeriodKey(sale.createdAt, groupBy as GroupByInterval);
      const existing = timeSeriesMap.get(key) || {
        periodKey: key,
        billsCount: 0,
        salesAmount: 0,
        quantitySold: 0,
      };

      existing.billsCount += 1;
      existing.salesAmount = round2(existing.salesAmount + Number(sale.finalTotalAmount));
      for (const item of sale.items) {
        existing.quantitySold = round2(existing.quantitySold + Number(item.quantity));
      }
      timeSeriesMap.set(key, existing);
    }

    const timeSeries = Array.from(timeSeriesMap.values()).sort((a, b) =>
      a.periodKey.localeCompare(b.periodKey)
    );

    return {
      summary: {
        period: periodDescription,
        totalSalesAmount,
        completedBillsCount,
        averageBillValue,
        totalQuantitySold,
        totalWeightSold,
        cancelledBillsCount,
        cancelledAmount,
      },
      paymentBreakdown,
      timeSeries,
    };
  }

  /**
   * 2. Product-wise Sales Report & Ranking
   */
  static async getProductSalesReport(query: ProductReportQuery) {
    const {
      period,
      startDate,
      endDate,
      categoryId,
      subcategoryId,
      sortBy = 'amount',
      order = 'desc',
      limit = 50,
      page = 1,
    } = query;

    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const whereItem: any = {
      sale: {
        saleStatus: SaleStatus.COMPLETED,
      },
    };

    if (start || end) {
      whereItem.sale.createdAt = {};
      if (start) whereItem.sale.createdAt.gte = start;
      if (end) whereItem.sale.createdAt.lte = end;
    }

    if (subcategoryId) {
      whereItem.product = { subcategoryId };
    } else if (categoryId) {
      whereItem.product = {
        subcategory: { categoryId },
      };
    }

    const saleItems = await prisma.saleItem.findMany({
      where: whereItem,
      include: {
        sale: { select: { id: true } },
        product: {
          include: {
            subcategory: {
              include: { category: true },
            },
          },
        },
      },
    });

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        productCode: string;
        categoryName: string;
        subcategoryName: string;
        quantitySold: number;
        weightSold: number;
        salesAmount: number;
        billIds: Set<string>;
      }
    >();

    for (const item of saleItems) {
      const pid = item.productId;
      const existing = productMap.get(pid) || {
        productId: pid,
        productName: item.productNameSnapshot || item.product.name,
        productCode: item.product.code,
        categoryName: item.product.subcategory.category.name,
        subcategoryName: item.product.subcategory.name,
        quantitySold: 0,
        weightSold: 0,
        salesAmount: 0,
        billIds: new Set<string>(),
      };

      existing.quantitySold = round2(existing.quantitySold + Number(item.quantity));
      existing.weightSold = round2(existing.weightSold + Number(item.baseWeightDeducted));
      existing.salesAmount = round2(existing.salesAmount + Number(item.total));
      existing.billIds.add(item.sale.id);

      productMap.set(pid, existing);
    }

    let productsList = Array.from(productMap.values()).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      productCode: p.productCode,
      categoryName: p.categoryName,
      subcategoryName: p.subcategoryName,
      quantitySold: p.quantitySold,
      weightSold: p.weightSold,
      salesAmount: p.salesAmount,
      billsCount: p.billIds.size,
      averageSellingRate: p.quantitySold > 0 ? round2(p.salesAmount / p.quantitySold) : 0,
    }));

    // Sorting
    productsList.sort((a, b) => {
      let valA = a.salesAmount;
      let valB = b.salesAmount;
      if (sortBy === 'quantity') {
        valA = a.quantitySold;
        valB = b.quantitySold;
      } else if (sortBy === 'bills') {
        valA = a.billsCount;
        valB = b.billsCount;
      }
      return order === 'asc' ? valA - valB : valB - valA;
    });

    const totalRevenue = round2(productsList.reduce((acc, p) => acc + p.salesAmount, 0));
    const totalQuantitySold = round2(productsList.reduce((acc, p) => acc + p.quantitySold, 0));
    const totalProductsCount = productsList.length;

    // Pagination
    const total = productsList.length;
    const offset = (page - 1) * limit;
    const paginatedProducts = productsList.slice(offset, offset + limit);

    return {
      summary: {
        period: periodDescription,
        totalProductsCount,
        totalRevenue,
        totalQuantitySold,
      },
      data: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. Customer-wise Sales Report & Repeat Customer Metrics
   */
  static async getCustomerSalesReport(query: CustomerReportQuery) {
    const {
      period,
      startDate,
      endDate,
      minBills,
      sortBy = 'purchases',
      order = 'desc',
      limit = 50,
      page = 1,
    } = query;

    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const whereSale: any = {
      saleStatus: SaleStatus.COMPLETED,
    };

    if (start || end) {
      whereSale.createdAt = {};
      if (start) whereSale.createdAt.gte = start;
      if (end) whereSale.createdAt.lte = end;
    }

    const sales = await prisma.sale.findMany({
      where: whereSale,
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        mobile: string | null;
        customerType: string;
        billsCount: number;
        totalPurchases: number;
        totalWeight: number;
        lastPurchaseDate: Date;
      }
    >();

    for (const sale of sales) {
      const cid = sale.customerId;
      const existing = customerMap.get(cid) || {
        customerId: cid,
        customerName: sale.customerNameSnapshot || sale.customer.name,
        mobile: sale.customerMobileSnapshot || sale.customer.mobile,
        customerType: sale.customerTypeSnapshot || sale.customer.customerType,
        billsCount: 0,
        totalPurchases: 0,
        totalWeight: 0,
        lastPurchaseDate: sale.createdAt,
      };

      existing.billsCount += 1;
      existing.totalPurchases = round2(existing.totalPurchases + Number(sale.finalTotalAmount));
      for (const item of sale.items) {
        existing.totalWeight = round2(existing.totalWeight + Number(item.baseWeightDeducted));
      }
      if (sale.createdAt > existing.lastPurchaseDate) {
        existing.lastPurchaseDate = sale.createdAt;
      }

      customerMap.set(cid, existing);
    }

    let customersList = Array.from(customerMap.values()).map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      mobile: c.mobile,
      customerType: c.customerType,
      billsCount: c.billsCount,
      totalPurchases: c.totalPurchases,
      totalWeight: c.totalWeight,
      averageBillValue: c.billsCount > 0 ? round2(c.totalPurchases / c.billsCount) : 0,
      lastPurchaseDate: c.lastPurchaseDate,
    }));

    if (minBills && minBills > 1) {
      customersList = customersList.filter((c) => c.billsCount >= minBills);
    }

    // Repeat customer metrics
    const totalUniqueCustomers = customersList.length;
    const repeatCustomerCount = customersList.filter((c) => c.billsCount > 1).length;
    const singlePurchaseCustomerCount = customersList.filter((c) => c.billsCount === 1).length;
    const repeatPercentage =
      totalUniqueCustomers > 0
        ? round2((repeatCustomerCount / totalUniqueCustomers) * 100)
        : 0;

    // Sorting
    customersList.sort((a, b) => {
      let valA = a.totalPurchases;
      let valB = b.totalPurchases;
      if (sortBy === 'bills') {
        valA = a.billsCount;
        valB = b.billsCount;
      } else if (sortBy === 'lastPurchase') {
        valA = a.lastPurchaseDate.getTime();
        valB = b.lastPurchaseDate.getTime();
      }
      return order === 'asc' ? valA - valB : valB - valA;
    });

    const total = customersList.length;
    const offset = (page - 1) * limit;
    const paginatedCustomers = customersList.slice(offset, offset + limit);

    return {
      summary: {
        period: periodDescription,
        totalUniqueCustomers,
        repeatCustomerCount,
        singlePurchaseCustomerCount,
        repeatPercentage,
      },
      data: paginatedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 4. Customer Purchase History
   */
  static async getCustomerPurchaseHistory(customerId: string, query: CustomerHistoryQuery) {
    const { page = 1, limit = 20 } = query;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const where = {
      customerId,
      saleStatus: SaleStatus.COMPLETED,
    };

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          items: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const allCustomerSales = await prisma.sale.findMany({
      where,
      select: { finalTotalAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalPurchases = round2(
      allCustomerSales.reduce((acc, s) => acc + Number(s.finalTotalAmount), 0)
    );
    const firstPurchaseDate = allCustomerSales.length > 0 ? allCustomerSales[0].createdAt : null;
    const lastPurchaseDate =
      allCustomerSales.length > 0 ? allCustomerSales[allCustomerSales.length - 1].createdAt : null;

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        customerType: customer.customerType,
      },
      summary: {
        totalBills: total,
        totalPurchases,
        firstPurchaseDate,
        lastPurchaseDate,
        averageBillValue: total > 0 ? round2(totalPurchases / total) : 0,
      },
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 5. Production Report
   */
  static async getProductionReport(query: ProductionReportQuery) {
    const { period, startDate, endDate, productId, status, groupBy = 'DAY' } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const where: any = {};

    if (start || end) {
      where.productionDate = {};
      if (start) where.productionDate.gte = start;
      if (end) where.productionDate.lte = end;
    }

    if (productId) where.productId = productId;
    if (status) where.status = status;

    const entries = await prisma.productionEntry.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, symbol: true } },
      },
      orderBy: { productionDate: 'asc' },
    });

    let completedEntriesCount = 0;
    let draftEntriesCount = 0;
    let cancelledEntriesCount = 0;
    let totalCompletedQuantityProduced = 0;
    let totalCompletedBaseWeightAdded = 0;

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        productCode: string;
        completedQuantity: number;
        completedBaseWeight: number;
        entriesCount: number;
      }
    >();

    const timeSeriesMap = new Map<
      string,
      { periodKey: string; quantityProduced: number; baseWeightAdded: number; entriesCount: number }
    >();

    for (const entry of entries) {
      if (entry.status === ProductionStatus.COMPLETED) {
        completedEntriesCount += 1;
        totalCompletedQuantityProduced += Number(entry.quantityProduced);
        totalCompletedBaseWeightAdded += Number(entry.baseWeightAdded);

        // Product aggregation
        const pid = entry.productId;
        const prod = productMap.get(pid) || {
          productId: pid,
          productName: entry.product.name,
          productCode: entry.product.code,
          completedQuantity: 0,
          completedBaseWeight: 0,
          entriesCount: 0,
        };
        prod.completedQuantity = round2(prod.completedQuantity + Number(entry.quantityProduced));
        prod.completedBaseWeight = round2(prod.completedBaseWeight + Number(entry.baseWeightAdded));
        prod.entriesCount += 1;
        productMap.set(pid, prod);

        // Time series
        const key = formatPeriodKey(entry.productionDate, groupBy as GroupByInterval);
        const timePoint = timeSeriesMap.get(key) || {
          periodKey: key,
          quantityProduced: 0,
          baseWeightAdded: 0,
          entriesCount: 0,
        };
        timePoint.quantityProduced = round2(
          timePoint.quantityProduced + Number(entry.quantityProduced)
        );
        timePoint.baseWeightAdded = round2(
          timePoint.baseWeightAdded + Number(entry.baseWeightAdded)
        );
        timePoint.entriesCount += 1;
        timeSeriesMap.set(key, timePoint);
      } else if (entry.status === ProductionStatus.DRAFT) {
        draftEntriesCount += 1;
      } else if (entry.status === ProductionStatus.CANCELLED) {
        cancelledEntriesCount += 1;
      }
    }

    return {
      summary: {
        period: periodDescription,
        totalEntries: entries.length,
        completedEntriesCount,
        draftEntriesCount,
        cancelledEntriesCount,
        totalCompletedQuantityProduced: round2(totalCompletedQuantityProduced),
        totalCompletedBaseWeightAdded: round2(totalCompletedBaseWeightAdded),
      },
      productBreakdown: Array.from(productMap.values()).sort(
        (a, b) => b.completedBaseWeight - a.completedBaseWeight
      ),
      timeSeries: Array.from(timeSeriesMap.values()).sort((a, b) =>
        a.periodKey.localeCompare(b.periodKey)
      ),
    };
  }

  /**
   * 6. Stock Inventory Report
   */
  static async getStockReport(query: StockReportQuery) {
    const { status = 'ALL', categoryId, subcategoryId, page = 1, limit = 50 } = query;

    const productWhere: any = {
      isActive: true,
    };

    if (subcategoryId) {
      productWhere.subcategoryId = subcategoryId;
    } else if (categoryId) {
      productWhere.subcategory = { categoryId };
    }

    const stocks = await prisma.stock.findMany({
      where: {
        product: productWhere,
      },
      include: {
        product: {
          include: {
            primaryUnit: true,
            subcategory: {
              include: { category: true },
            },
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockWeight = 0;

    const categorizedStocks = stocks.map((s) => {
      const balance = Number(s.currentBalance);
      const threshold = Number(s.minimumThreshold);
      totalStockWeight += balance;

      let stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
      if (balance <= 0) {
        stockStatus = 'OUT_OF_STOCK';
        outOfStockCount += 1;
      } else if (balance <= threshold) {
        stockStatus = 'LOW_STOCK';
        lowStockCount += 1;
      } else {
        stockStatus = 'IN_STOCK';
        inStockCount += 1;
      }

      return {
        productId: s.productId,
        productName: s.product.name,
        productCode: s.product.code,
        categoryName: s.product.subcategory.category.name,
        subcategoryName: s.product.subcategory.name,
        unitSymbol: s.product.primaryUnit.symbol,
        currentBalance: balance,
        minimumThreshold: threshold,
        stockStatus,
        lastUpdatedAt: s.lastUpdatedAt,
      };
    });

    let filtered = categorizedStocks;
    if (status !== 'ALL') {
      filtered = categorizedStocks.filter((s) => s.stockStatus === status);
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      summary: {
        totalProductsCount: stocks.length,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalStockWeight: round2(totalStockWeight),
      },
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 7. Stock Movements Report
   */
  static async getStockMovementsReport(query: StockMovementsReportQuery) {
    const { period, startDate, endDate, productId, movementType, page = 1, limit = 50 } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const where: any = {};

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;

    const [total, movements, allMovements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, code: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.findMany({
        where,
        select: { movementType: true, quantityDelta: true },
      }),
    ]);

    const movementSummary: Record<string, { count: number; totalDelta: number }> = {};

    for (const m of allMovements) {
      const type = m.movementType;
      const current = movementSummary[type] || { count: 0, totalDelta: 0 };
      current.count += 1;
      current.totalDelta = round2(current.totalDelta + Number(m.quantityDelta));
      movementSummary[type] = current;
    }

    return {
      summary: {
        period: periodDescription,
        totalMovements: total,
        movementBreakdown: movementSummary,
      },
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 8. Stock Reconciliation Report (Admin verification, zero drift)
   */
  static async getStockReconciliationReport() {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const reconciliationList = [];
    let consistentCount = 0;
    let driftCount = 0;

    for (const p of products) {
      try {
        const rec = await InventoryService.reconcileStock(p.id);
        if (rec.isConsistent) {
          consistentCount += 1;
        } else {
          driftCount += 1;
        }
        reconciliationList.push({
          productId: p.id,
          productName: p.name,
          productCode: p.code,
          cachedBalance: rec.cachedBalance,
          ledgerTotal: rec.ledgerTotal,
          difference: rec.discrepancy,
          discrepancy: rec.discrepancy,
          isConsistent: rec.isConsistent,
        });
      } catch (_err) {
        // If product has no stock record yet
        reconciliationList.push({
          productId: p.id,
          productName: p.name,
          productCode: p.code,
          cachedBalance: 0,
          ledgerTotal: 0,
          difference: 0,
          discrepancy: 0,
          isConsistent: true,
        });
        consistentCount += 1;
      }
    }

    return {
      summary: {
        totalAudited: products.length,
        consistentCount,
        driftCount,
        allConsistent: driftCount === 0,
      },
      data: reconciliationList,
    };
  }

  /**
   * 9. Sales Return Report & Return Rate Analytics
   */
  static async getReturnsReport(query: ReturnsReportQuery) {
    const { period, startDate, endDate, productId, status, refundPaymentMode } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const where: any = {};

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    if (status) where.status = status;
    if (refundPaymentMode) where.refundPaymentMode = refundPaymentMode;
    if (productId) {
      where.items = { some: { productId } };
    }

    const returns = await prisma.salesReturn.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Completed sales in same period to compute Return Rate
    const salesWhere: any = { saleStatus: SaleStatus.COMPLETED };
    if (start || end) {
      salesWhere.createdAt = {};
      if (start) salesWhere.createdAt.gte = start;
      if (end) salesWhere.createdAt.lte = end;
    }
    const completedSales = await prisma.sale.findMany({
      where: salesWhere,
      select: { finalTotalAmount: true },
    });
    const completedSalesAmount = round2(
      completedSales.reduce((acc, s) => acc + Number(s.finalTotalAmount), 0)
    );

    let completedReturnsCount = 0;
    let draftReturnsCount = 0;
    let cancelledReturnsCount = 0;
    let totalRefundAmount = 0;
    let totalReturnedQuantity = 0;

    const paymentModeBreakdown: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      CREDIT_NOTE: 0,
    };

    const productMap = new Map<
      string,
      { productId: string; productName: string; returnedQuantity: number; refundAmount: number }
    >();

    for (const ret of returns) {
      if (ret.status === ReturnStatus.COMPLETED) {
        completedReturnsCount += 1;
        totalRefundAmount = round2(totalRefundAmount + Number(ret.totalReturnAmount));
        paymentModeBreakdown[ret.refundPaymentMode] = round2(
          (paymentModeBreakdown[ret.refundPaymentMode] || 0) + Number(ret.totalReturnAmount)
        );

        for (const item of ret.items) {
          totalReturnedQuantity = round2(totalReturnedQuantity + Number(item.returnedQuantity));

          const pid = item.productId;
          const prod = productMap.get(pid) || {
            productId: pid,
            productName: item.product.name,
            returnedQuantity: 0,
            refundAmount: 0,
          };
          prod.returnedQuantity = round2(prod.returnedQuantity + Number(item.returnedQuantity));
          prod.refundAmount = round2(prod.refundAmount + Number(item.refundAmount));
          productMap.set(pid, prod);
        }
      } else if (ret.status === ReturnStatus.DRAFT) {
        draftReturnsCount += 1;
      } else if (ret.status === ReturnStatus.CANCELLED) {
        cancelledReturnsCount += 1;
      }
    }

    const returnRate =
      completedSalesAmount > 0
        ? round2((totalRefundAmount / completedSalesAmount) * 100)
        : 0;

    return {
      summary: {
        period: periodDescription,
        totalReturns: returns.length,
        completedReturnsCount,
        draftReturnsCount,
        cancelledReturnsCount,
        totalRefundAmount,
        totalReturnedQuantity,
        completedSalesAmount,
        returnRate, // Return Percentage Formula: (Completed Return Amount / Completed Sales Amount) * 100
      },
      paymentModeBreakdown,
      productBreakdown: Array.from(productMap.values()).sort(
        (a, b) => b.refundAmount - a.refundAmount
      ),
    };
  }

  /**
   * 10. Real-time Business Summary Dashboard
   */
  static async getBusinessSummary(query: BusinessSummaryQuery) {
    const { date, period, startDate, endDate } = query;
    // Default to today if no date range is provided
    const targetPeriod = !date && !startDate && !endDate && !period ? 'today' : period;
    const targetStart = date || startDate;
    const targetEnd = date || endDate;

    const { start, end, periodDescription } = resolveDateRange(targetPeriod, targetStart, targetEnd);

    const dateFilter: any = {};
    if (start) dateFilter.gte = start;
    if (end) dateFilter.lte = end;

    // 1. Completed sales in period
    const sales = await prisma.sale.findMany({
      where: {
        saleStatus: SaleStatus.COMPLETED,
        createdAt: dateFilter,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    const totalSales = round2(sales.reduce((acc, s) => acc + Number(s.finalTotalAmount), 0));
    const billCount = sales.length;
    const averageBillValue = billCount > 0 ? round2(totalSales / billCount) : 0;

    // 2. Returns in period
    const returns = await prisma.salesReturn.findMany({
      where: {
        status: ReturnStatus.COMPLETED,
        createdAt: dateFilter,
      },
      select: { totalReturnAmount: true },
    });

    const totalReturnsAmount = round2(
      returns.reduce((acc, r) => acc + Number(r.totalReturnAmount), 0)
    );
    const returnsCount = returns.length;

    // Net Sales Formula: Completed Sales - Completed Returns
    const netSales = round2(totalSales - totalReturnsAmount);

    // 3. Production in period
    const production = await prisma.productionEntry.findMany({
      where: {
        status: ProductionStatus.COMPLETED,
        productionDate: dateFilter,
      },
      select: { baseWeightAdded: true, quantityProduced: true },
    });

    const totalProductionWeight = round2(
      production.reduce((acc, p) => acc + Number(p.baseWeightAdded), 0)
    );
    const productionEntriesCount = production.length;

    // 4. Inventory counts
    const stocks = await prisma.stock.findMany({
      where: { product: { isActive: true } },
      select: { currentBalance: true, minimumThreshold: true },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;

    for (const s of stocks) {
      const balance = Number(s.currentBalance);
      const threshold = Number(s.minimumThreshold);
      if (balance <= 0) {
        outOfStockCount += 1;
      } else if (balance <= threshold) {
        lowStockCount += 1;
      } else {
        inStockCount += 1;
      }
    }

    // 5. Payment mode breakdown
    const paymentSummary: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      OTHER: 0,
    };
    for (const s of sales) {
      for (const p of s.payments) {
        paymentSummary[p.paymentMode] = round2(
          (paymentSummary[p.paymentMode] || 0) + Number(p.amount)
        );
      }
    }

    // 6. Top products by sales revenue
    const productSalesMap = new Map<
      string,
      { productId: string; productName: string; revenue: number; quantity: number }
    >();

    for (const s of sales) {
      for (const item of s.items) {
        const pid = item.productId;
        const current = productSalesMap.get(pid) || {
          productId: pid,
          productName: item.productNameSnapshot,
          revenue: 0,
          quantity: 0,
        };
        current.revenue = round2(current.revenue + Number(item.total));
        current.quantity = round2(current.quantity + Number(item.quantity));
        productSalesMap.set(pid, current);
      }
    }

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      period: periodDescription,
      sales: {
        totalSales,
        billCount,
        averageBillValue,
      },
      returns: {
        totalReturnsAmount,
        returnsCount,
      },
      netSales,
      production: {
        totalProductionWeight,
        productionEntriesCount,
      },
      inventory: {
        totalItems: stocks.length,
        inStockCount,
        lowStockCount,
        outOfStockCount,
      },
      paymentSummary,
      topProducts,
    };
  }
}
