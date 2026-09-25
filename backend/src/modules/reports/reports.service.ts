import { prisma } from '../../config/database.js';
import { SaleStatus, ProductionStatus, ReturnStatus, PaymentMode, SaleType, RefundPaymentMode, CustomerType } from '@prisma/client';
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
  StatutorySalesReportQuery,
  StatutoryItemizedReportQuery,
  StatutoryReturnsReportQuery,
  StatutoryGstSummaryQuery,
} from './reports.validation.js';
import { resolveDateRange, formatPeriodKey, round2, GroupByInterval } from './reports.utils.js';
import {
  statutorySalesToCsv,
  statutoryItemizedToCsv,
  statutoryReturnsToCsv,
  statutoryGstSummaryToCsv,
} from './reports.csv.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { resolveReportSaleTypeScope } from './reports.auth.js';
import { AuthenticatedUser } from '../../middlewares/auth.middleware.js';

export class ReportsService {
  /**
   * 1. Comprehensive Sales Report
   */
  static async getSalesReport(query: SalesReportQuery, user?: AuthenticatedUser) {
    const { period, startDate, endDate, groupBy, paymentMode, customerId, saleType } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const whereSale: any = {
      saleStatus: SaleStatus.COMPLETED,
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
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
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
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

    // Segment sales by SaleType
    const salesByType: Record<SaleType, { totalSalesAmount: number; completedBillsCount: number }> = {
      [SaleType.RETAIL]: { totalSalesAmount: 0, completedBillsCount: 0 },
      [SaleType.NRI]: { totalSalesAmount: 0, completedBillsCount: 0 },
      [SaleType.WHOLESALE]: { totalSalesAmount: 0, completedBillsCount: 0 },
    };

    for (const sale of completedSales) {
      if (salesByType[sale.saleType]) {
        salesByType[sale.saleType].completedBillsCount += 1;
        salesByType[sale.saleType].totalSalesAmount = round2(
          salesByType[sale.saleType].totalSalesAmount + Number(sale.finalTotalAmount)
        );
      }
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
      salesByType,
      paymentBreakdown,
      timeSeries,
    };
  }

  /**
   * 2. Product-wise Sales Report & Ranking
   */
  static async getProductSalesReport(query: ProductReportQuery, user?: AuthenticatedUser) {
    const {
      period,
      startDate,
      endDate,
      categoryId,
      subcategoryId,
      saleType,
      sortBy = 'amount',
      order = 'desc',
      limit = 50,
      page = 1,
    } = query;

    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const whereItem: any = {
      sale: {
        saleStatus: SaleStatus.COMPLETED,
        ...(effectiveSaleType
          ? { saleType: effectiveSaleType }
          : { saleType: { in: effectiveSaleTypes } }),
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
  static async getCustomerSalesReport(query: CustomerReportQuery, user?: AuthenticatedUser) {
    const {
      period,
      startDate,
      endDate,
      customerType,
      saleType,
      minBills,
      sortBy = 'purchases',
      order = 'desc',
      limit = 50,
      page = 1,
    } = query;

    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const whereSale: any = {
      saleStatus: SaleStatus.COMPLETED,
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
    };

    if (customerType) {
      whereSale.customerTypeSnapshot = customerType;
    }

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
  static async getCustomerPurchaseHistory(
    customerId: string,
    query: CustomerHistoryQuery,
    user?: AuthenticatedUser
  ) {
    const { page = 1, limit = 20, saleType } = query;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const { effectiveSaleType, effectiveSaleTypes } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const where: any = {
      customerId,
      saleStatus: SaleStatus.COMPLETED,
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
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
  static async getReturnsReport(query: ReturnsReportQuery, user?: AuthenticatedUser) {
    const { period, startDate, endDate, productId, status, refundPaymentMode, saleType } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const where: any = {
      ...(effectiveSaleType
        ? { saleTypeSnapshot: effectiveSaleType }
        : { saleTypeSnapshot: { in: effectiveSaleTypes } }),
    };

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
    const salesWhere: any = {
      saleStatus: SaleStatus.COMPLETED,
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
    };
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
  static async getBusinessSummary(query: BusinessSummaryQuery, user?: AuthenticatedUser) {
    const { date, period, startDate, endDate, saleType } = query;
    // Default to today if no date range is provided
    const targetPeriod = !date && !startDate && !endDate && !period ? 'today' : period;
    const targetStart = date || startDate;
    const targetEnd = date || endDate;

    const { start, end, periodDescription } = resolveDateRange(targetPeriod, targetStart, targetEnd);

    const { effectiveSaleType, effectiveSaleTypes, isMasterAdmin, isScoped } =
      resolveReportSaleTypeScope(user, saleType);

    const dateFilter: any = {};
    if (start) dateFilter.gte = start;
    if (end) dateFilter.lte = end;

    // 1. Completed sales in period (scoped to authorized SaleTypes)
    const sales = await prisma.sale.findMany({
      where: {
        saleStatus: SaleStatus.COMPLETED,
        createdAt: dateFilter,
        ...(effectiveSaleType
          ? { saleType: effectiveSaleType }
          : { saleType: { in: effectiveSaleTypes } }),
      },
      include: {
        items: true,
        payments: true,
      },
    });

    const salesByType: Record<SaleType, { totalSales: number; billCount: number }> = {
      [SaleType.RETAIL]: { totalSales: 0, billCount: 0 },
      [SaleType.NRI]: { totalSales: 0, billCount: 0 },
      [SaleType.WHOLESALE]: { totalSales: 0, billCount: 0 },
    };

    for (const s of sales) {
      if (salesByType[s.saleType]) {
        salesByType[s.saleType].billCount += 1;
        salesByType[s.saleType].totalSales = round2(
          salesByType[s.saleType].totalSales + Number(s.finalTotalAmount)
        );
      }
    }

    const totalSales = round2(sales.reduce((acc, s) => acc + Number(s.finalTotalAmount), 0));
    const billCount = sales.length;
    const averageBillValue = billCount > 0 ? round2(totalSales / billCount) : 0;

    // 2. Returns in period (scoped to authorized SaleTypes)
    const returns = await prisma.salesReturn.findMany({
      where: {
        status: ReturnStatus.COMPLETED,
        createdAt: dateFilter,
        ...(effectiveSaleType
          ? { saleTypeSnapshot: effectiveSaleType }
          : { saleTypeSnapshot: { in: effectiveSaleTypes } }),
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
      scope: {
        isMasterAdmin,
        isScoped,
        scopeLabel: isMasterAdmin
          ? 'Company Total Sales'
          : `Authorized Sales (Scoped: ${effectiveSaleTypes.join(', ')})`,
        allowedSaleTypes: effectiveSaleTypes,
      },
      sales: {
        totalSales,
        billCount,
        averageBillValue,
      },
      salesByType,
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

  // ============================================================
  // Phase 2F: Statutory / CA Compliance Reporting & Export
  // ============================================================

  /**
   * Statutory Bill-Level Sales Register
   * Fully audited bill-by-bill report honoring RBAC and immutable historical snapshots.
   */
  static async getStatutorySalesRegister(
    query: StatutorySalesReportQuery,
    user?: AuthenticatedUser
  ) {
    const { period, startDate, endDate, saleType, customerType, paymentMode, gstinOnly, status, format } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes, isScoped, isMasterAdmin } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const whereSale: any = {
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
    };

    if (start || end) {
      whereSale.createdAt = {};
      if (start) whereSale.createdAt.gte = start;
      if (end) whereSale.createdAt.lte = end;
    }

    if (customerType) {
      whereSale.customerTypeSnapshot = customerType;
    }

    if (paymentMode) {
      whereSale.payments = {
        some: { paymentMode },
      };
    }

    if (gstinOnly) {
      whereSale.customerGstinSnapshot = { not: null };
    }

    if (status === 'COMPLETED') {
      whereSale.saleStatus = SaleStatus.COMPLETED;
    } else if (status === 'CANCELLED') {
      whereSale.saleStatus = SaleStatus.CANCELLED;
    }

    const sales = await prisma.sale.findMany({
      where: whereSale,
      include: {
        payments: true,
        user: { select: { fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute statutory metrics
    let completedBills = 0;
    let cancelledBills = 0;
    let subtotalAmount = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let finalTotalAmount = 0;
    let paidAmount = 0;
    let cancelledAmount = 0;

    for (const s of sales) {
      if (s.saleStatus === SaleStatus.COMPLETED) {
        completedBills += 1;
        subtotalAmount += Number(s.subtotalAmount);
        discountAmount += Number(s.discountAmount);
        taxAmount += Number(s.taxAmount);
        finalTotalAmount += Number(s.finalTotalAmount);
        paidAmount += Number(s.paidAmount);
      } else if (s.saleStatus === SaleStatus.CANCELLED) {
        cancelledBills += 1;
        cancelledAmount += Number(s.finalTotalAmount);
      }
    }

    subtotalAmount = round2(subtotalAmount);
    discountAmount = round2(discountAmount);
    const taxableAmount = round2(subtotalAmount - discountAmount);
    taxAmount = round2(taxAmount);
    finalTotalAmount = round2(finalTotalAmount);
    paidAmount = round2(paidAmount);
    cancelledAmount = round2(cancelledAmount);

    if (format === 'csv') {
      return statutorySalesToCsv(sales);
    }

    const formattedData = sales.map((s) => ({
      id: s.id,
      billNumber: s.billNumber,
      date: s.createdAt.toISOString(),
      saleType: s.saleType,
      customerName: s.customerNameSnapshot,
      customerMobile: s.customerMobileSnapshot,
      customerType: s.customerTypeSnapshot,
      customerGstin: s.customerGstinSnapshot,
      isB2B: Boolean(s.customerGstinSnapshot && s.customerGstinSnapshot.trim().length > 0),
      subtotalAmount: Number(s.subtotalAmount),
      discountAmount: Number(s.discountAmount),
      taxableAmount: round2(Number(s.subtotalAmount) - Number(s.discountAmount)),
      taxAmount: Number(s.taxAmount),
      finalTotalAmount: Number(s.finalTotalAmount),
      paidAmount: Number(s.paidAmount),
      paymentStatus: s.paymentStatus,
      paymentModes: Array.from(new Set(s.payments.map((p) => p.paymentMode))),
      saleStatus: s.saleStatus,
      cancellationReason: s.cancellationReason,
      biller: s.user ? s.user.fullName || s.user.username : 'Unknown',
    }));

    return {
      summary: {
        period: periodDescription,
        totalRecordedBills: sales.length,
        completedBills,
        cancelledBills,
        subtotalAmount,
        discountAmount,
        taxableAmount,
        taxAmount,
        finalTotalAmount,
        paidAmount,
        cancelledAmount,
        isScoped,
        isMasterAdmin,
        visibleSaleTypes: effectiveSaleTypes,
        formulaNotes:
          'Taxable Amount = subtotalAmount - discountAmount; Completed sales calculate turnover; Cancelled sales tracked separately.',
      },
      data: formattedData,
    };
  }

  /**
   * Statutory Itemized Sales Register
   * Line-item level audit report preserving immutable pricing, unit, and item snapshots.
   */
  static async getStatutoryItemizedSalesRegister(
    query: StatutoryItemizedReportQuery,
    user?: AuthenticatedUser
  ) {
    const { period, startDate, endDate, saleType, customerType, gstinOnly, status, format } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes, isScoped, isMasterAdmin } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const saleWhere: any = {
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
    };

    if (start || end) {
      saleWhere.createdAt = {};
      if (start) saleWhere.createdAt.gte = start;
      if (end) saleWhere.createdAt.lte = end;
    }

    if (customerType) {
      saleWhere.customerTypeSnapshot = customerType;
    }

    if (gstinOnly) {
      saleWhere.customerGstinSnapshot = { not: null };
    }

    if (status === 'COMPLETED') {
      saleWhere.saleStatus = SaleStatus.COMPLETED;
    } else if (status === 'CANCELLED') {
      saleWhere.saleStatus = SaleStatus.CANCELLED;
    }

    const items = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        sale: {
          select: {
            id: true,
            billNumber: true,
            createdAt: true,
            saleType: true,
            customerNameSnapshot: true,
            customerTypeSnapshot: true,
            customerGstinSnapshot: true,
            saleStatus: true,
            cancellationReason: true,
          },
        },
      },
      orderBy: [{ sale: { createdAt: 'desc' } }, { id: 'asc' }],
    });

    let completedItemsCount = 0;
    let cancelledItemsCount = 0;
    let totalQuantity = 0;
    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalAmount = 0;

    for (const it of items) {
      if (it.sale.saleStatus === SaleStatus.COMPLETED) {
        completedItemsCount += 1;
        totalQuantity += Number(it.quantity);
        totalSubtotal += Number(it.subtotal);
        totalDiscount += Number(it.discount);
        totalAmount += Number(it.total);
      } else {
        cancelledItemsCount += 1;
      }
    }

    totalQuantity = round2(totalQuantity);
    totalSubtotal = round2(totalSubtotal);
    totalDiscount = round2(totalDiscount);
    totalAmount = round2(totalAmount);

    if (format === 'csv') {
      return statutoryItemizedToCsv(items);
    }

    const formattedData = items.map((it) => {
      const isB2B = Boolean(
        it.sale.customerGstinSnapshot && it.sale.customerGstinSnapshot.trim().length > 0
      );
      return {
        id: it.id,
        saleId: it.sale.id,
        billNumber: it.sale.billNumber,
        date: it.sale.createdAt.toISOString(),
        saleType: it.saleTypeSnapshot || it.sale.saleType,
        customerName: it.sale.customerNameSnapshot,
        customerType: it.sale.customerTypeSnapshot,
        customerGstin: it.sale.customerGstinSnapshot,
        isB2B,
        productName: it.productNameSnapshot,
        unitSymbol: it.unitSymbolSnapshot,
        weightOrPack: it.weightOrPackSnapshot,
        quantity: Number(it.quantity),
        unitRate: Number(it.unitRate),
        subtotal: Number(it.subtotal),
        discount: Number(it.discount),
        total: Number(it.total),
        saleStatus: it.sale.saleStatus,
        cancellationReason: it.sale.cancellationReason,
      };
    });

    return {
      summary: {
        period: periodDescription,
        totalItemsCount: items.length,
        completedItemsCount,
        cancelledItemsCount,
        totalQuantity,
        totalSubtotal,
        totalDiscount,
        totalAmount,
        isScoped,
        isMasterAdmin,
        visibleSaleTypes: effectiveSaleTypes,
      },
      data: formattedData,
    };
  }

  /**
   * Statutory Sales Returns Register
   * Dedicated return register cross-referencing original sales, refund modes, and restock conditions.
   */
  static async getStatutoryReturnsRegister(
    query: StatutoryReturnsReportQuery,
    user?: AuthenticatedUser
  ) {
    const { period, startDate, endDate, saleType, customerType, refundPaymentMode, status, format } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes, isScoped, isMasterAdmin } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    const whereReturn: any = {
      ...(effectiveSaleType
        ? { saleTypeSnapshot: effectiveSaleType }
        : { saleTypeSnapshot: { in: effectiveSaleTypes } }),
    };

    if (start || end) {
      whereReturn.createdAt = {};
      if (start) whereReturn.createdAt.gte = start;
      if (end) whereReturn.createdAt.lte = end;
    }

    if (customerType) {
      whereReturn.customer = { customerType };
    }

    if (refundPaymentMode) {
      whereReturn.refundPaymentMode = refundPaymentMode;
    }

    if (status) {
      whereReturn.status = status;
    }

    const returns = await prisma.salesReturn.findMany({
      where: whereReturn,
      include: {
        originalSale: {
          select: {
            billNumber: true,
            customerNameSnapshot: true,
            customerTypeSnapshot: true,
            customerGstinSnapshot: true,
          },
        },
        customer: {
          select: {
            name: true,
            customerType: true,
            gstin: true,
          },
        },
        items: {
          include: {
            saleItem: true,
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let completedReturns = 0;
    let cancelledReturns = 0;
    let draftReturns = 0;
    let totalRefundAmount = 0;
    let totalReturnedQuantity = 0;

    for (const ret of returns) {
      if (ret.status === ReturnStatus.COMPLETED) {
        completedReturns += 1;
        totalRefundAmount += Number(ret.totalReturnAmount);
        for (const item of ret.items) {
          totalReturnedQuantity += Number(item.returnedQuantity);
        }
      } else if (ret.status === ReturnStatus.CANCELLED) {
        cancelledReturns += 1;
      } else if (ret.status === ReturnStatus.DRAFT) {
        draftReturns += 1;
      }
    }

    totalRefundAmount = round2(totalRefundAmount);
    totalReturnedQuantity = round2(totalReturnedQuantity);

    if (format === 'csv') {
      return statutoryReturnsToCsv(returns);
    }

    const formattedData = returns.map((ret) => {
      const custName = ret.customer?.name || ret.originalSale?.customerNameSnapshot || 'Unknown';
      const custType = ret.originalSale?.customerTypeSnapshot || ret.customer?.customerType || CustomerType.INDIAN;
      const gstin = ret.originalSale?.customerGstinSnapshot || ret.customer?.gstin || null;

      return {
        id: ret.id,
        returnNumber: ret.returnNumber,
        originalBillNumber: ret.originalSale?.billNumber || 'Unknown',
        date: ret.createdAt.toISOString(),
        completedAt: ret.completedAt ? ret.completedAt.toISOString() : null,
        customerName: custName,
        customerType: custType,
        customerGstin: gstin,
        isB2B: Boolean(gstin && gstin.trim().length > 0),
        saleType: ret.saleTypeSnapshot,
        refundPaymentMode: ret.refundPaymentMode,
        totalReturnAmount: Number(ret.totalReturnAmount),
        status: ret.status,
        reason: ret.reason,
        cancellationReason: ret.cancellationReason,
        items: ret.items.map((item) => ({
          id: item.id,
          productName: item.saleItem?.productNameSnapshot || item.product?.name || 'Unknown',
          returnedQuantity: Number(item.returnedQuantity),
          unitRate: Number(item.unitRateSnapshot),
          refundAmount: Number(item.refundAmount),
          restockCondition: item.restockCondition,
        })),
      };
    });

    return {
      summary: {
        period: periodDescription,
        totalReturns: returns.length,
        completedReturns,
        cancelledReturns,
        draftReturns,
        totalRefundAmount,
        totalReturnedQuantity,
        isScoped,
        isMasterAdmin,
        visibleSaleTypes: effectiveSaleTypes,
      },
      data: formattedData,
    };
  }

  /**
   * Statutory GST / Tax Summary
   * Segmented by SaleType and GST Classification (B2B vs B2C).
   * Reports aggregate taxAmount without inventing CGST/SGST/IGST splits.
   */
  static async getStatutoryGstSummary(
    query: StatutoryGstSummaryQuery,
    user?: AuthenticatedUser
  ) {
    const { period, startDate, endDate, saleType, customerType, gstinOnly, format } = query;
    const { start, end, periodDescription } = resolveDateRange(period, startDate, endDate);

    const { effectiveSaleType, effectiveSaleTypes, isScoped, isMasterAdmin } = resolveReportSaleTypeScope(
      user,
      saleType
    );

    // 1. Query Completed Sales
    const saleWhere: any = {
      saleStatus: SaleStatus.COMPLETED,
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
    };

    if (start || end) {
      saleWhere.createdAt = {};
      if (start) saleWhere.createdAt.gte = start;
      if (end) saleWhere.createdAt.lte = end;
    }

    if (customerType) {
      saleWhere.customerTypeSnapshot = customerType;
    }

    if (gstinOnly) {
      saleWhere.customerGstinSnapshot = { not: null };
    }

    const completedSales = await prisma.sale.findMany({
      where: saleWhere,
      select: {
        id: true,
        saleType: true,
        customerTypeSnapshot: true,
        customerGstinSnapshot: true,
        subtotalAmount: true,
        discountAmount: true,
        taxAmount: true,
        finalTotalAmount: true,
      },
    });

    // 2. Query Cancelled Sales
    const cancelledWhere: any = {
      saleStatus: SaleStatus.CANCELLED,
      ...(effectiveSaleType
        ? { saleType: effectiveSaleType }
        : { saleType: { in: effectiveSaleTypes } }),
    };

    if (start || end) {
      cancelledWhere.createdAt = {};
      if (start) cancelledWhere.createdAt.gte = start;
      if (end) cancelledWhere.createdAt.lte = end;
    }
    if (customerType) cancelledWhere.customerTypeSnapshot = customerType;
    if (gstinOnly) cancelledWhere.customerGstinSnapshot = { not: null };

    const cancelledSales = await prisma.sale.findMany({
      where: cancelledWhere,
      select: {
        saleType: true,
        customerGstinSnapshot: true,
        finalTotalAmount: true,
      },
    });

    // 3. Query Completed Returns
    const returnWhere: any = {
      status: ReturnStatus.COMPLETED,
      ...(effectiveSaleType
        ? { saleTypeSnapshot: effectiveSaleType }
        : { saleTypeSnapshot: { in: effectiveSaleTypes } }),
    };

    if (start || end) {
      returnWhere.createdAt = {};
      if (start) returnWhere.createdAt.gte = start;
      if (end) returnWhere.createdAt.lte = end;
    }

    if (customerType) {
      returnWhere.customer = { customerType };
    }

    const completedReturns = await prisma.salesReturn.findMany({
      where: returnWhere,
      include: {
        originalSale: {
          select: {
            customerGstinSnapshot: true,
          },
        },
      },
    });

    // Data structures for segmenting
    const emptySegment = () => ({
      billsCount: 0,
      subtotalAmount: 0,
      discountAmount: 0,
      taxableAmount: 0,
      taxAmount: 0,
      finalTotalAmount: 0,
      returnsCount: 0,
      returnAmount: 0,
      netAmount: 0,
      cancelledBillsCount: 0,
      cancelledAmount: 0,
    });

    const bySaleType: Record<SaleType, ReturnType<typeof emptySegment>> = {
      [SaleType.RETAIL]: emptySegment(),
      [SaleType.NRI]: emptySegment(),
      [SaleType.WHOLESALE]: emptySegment(),
    };

    const byGstClassification: Record<'B2B' | 'B2C', ReturnType<typeof emptySegment>> = {
      B2B: emptySegment(),
      B2C: emptySegment(),
    };

    // Overall summary accumulators
    let totalCompletedBills = 0;
    let grossSubtotal = 0;
    let grossDiscount = 0;
    let grossTaxAmount = 0;
    let grossFinalAmount = 0;

    // Process completed sales
    for (const s of completedSales) {
      const sub = Number(s.subtotalAmount);
      const disc = Number(s.discountAmount);
      const tax = Number(s.taxAmount);
      const finalTot = Number(s.finalTotalAmount);
      const isB2B = Boolean(s.customerGstinSnapshot && s.customerGstinSnapshot.trim().length > 0);
      const gstClass = isB2B ? 'B2B' : 'B2C';

      totalCompletedBills += 1;
      grossSubtotal += sub;
      grossDiscount += disc;
      grossTaxAmount += tax;
      grossFinalAmount += finalTot;

      // Update bySaleType
      if (bySaleType[s.saleType]) {
        const seg = bySaleType[s.saleType];
        seg.billsCount += 1;
        seg.subtotalAmount = round2(seg.subtotalAmount + sub);
        seg.discountAmount = round2(seg.discountAmount + disc);
        seg.taxableAmount = round2(seg.subtotalAmount - seg.discountAmount);
        seg.taxAmount = round2(seg.taxAmount + tax);
        seg.finalTotalAmount = round2(seg.finalTotalAmount + finalTot);
      }

      // Update byGstClassification
      const gSeg = byGstClassification[gstClass];
      gSeg.billsCount += 1;
      gSeg.subtotalAmount = round2(gSeg.subtotalAmount + sub);
      gSeg.discountAmount = round2(gSeg.discountAmount + disc);
      gSeg.taxableAmount = round2(gSeg.subtotalAmount - gSeg.discountAmount);
      gSeg.taxAmount = round2(gSeg.taxAmount + tax);
      gSeg.finalTotalAmount = round2(gSeg.finalTotalAmount + finalTot);
    }

    // Process completed returns
    let totalCompletedReturns = 0;
    let totalReturnAmount = 0;

    for (const ret of completedReturns) {
      const retAmt = Number(ret.totalReturnAmount);
      const isB2B = Boolean(
        ret.originalSale?.customerGstinSnapshot &&
          ret.originalSale.customerGstinSnapshot.trim().length > 0
      );
      const gstClass = isB2B ? 'B2B' : 'B2C';

      totalCompletedReturns += 1;
      totalReturnAmount = round2(totalReturnAmount + retAmt);

      if (bySaleType[ret.saleTypeSnapshot]) {
        const seg = bySaleType[ret.saleTypeSnapshot];
        seg.returnsCount += 1;
        seg.returnAmount = round2(seg.returnAmount + retAmt);
      }

      const gSeg = byGstClassification[gstClass];
      gSeg.returnsCount += 1;
      gSeg.returnAmount = round2(gSeg.returnAmount + retAmt);
    }

    // Process cancelled sales
    let totalCancelledBills = 0;
    let totalCancelledAmount = 0;

    for (const cs of cancelledSales) {
      const cAmt = Number(cs.finalTotalAmount);
      const isB2B = Boolean(cs.customerGstinSnapshot && cs.customerGstinSnapshot.trim().length > 0);
      const gstClass = isB2B ? 'B2B' : 'B2C';

      totalCancelledBills += 1;
      totalCancelledAmount = round2(totalCancelledAmount + cAmt);

      if (bySaleType[cs.saleType]) {
        const seg = bySaleType[cs.saleType];
        seg.cancelledBillsCount += 1;
        seg.cancelledAmount = round2(seg.cancelledAmount + cAmt);
      }

      const gSeg = byGstClassification[gstClass];
      gSeg.cancelledBillsCount += 1;
      gSeg.cancelledAmount = round2(gSeg.cancelledAmount + cAmt);
    }

    // Calculate net amounts for all segments
    for (const st of Object.values(bySaleType)) {
      st.netAmount = round2(st.finalTotalAmount - st.returnAmount);
    }
    for (const cls of Object.values(byGstClassification)) {
      cls.netAmount = round2(cls.finalTotalAmount - cls.returnAmount);
    }

    grossSubtotal = round2(grossSubtotal);
    grossDiscount = round2(grossDiscount);
    const taxableAmount = round2(grossSubtotal - grossDiscount);
    grossTaxAmount = round2(grossTaxAmount);
    grossFinalAmount = round2(grossFinalAmount);
    const netFinalAmount = round2(grossFinalAmount - totalReturnAmount);
    totalCancelledAmount = round2(totalCancelledAmount);

    const summary = {
      period: periodDescription,
      completedBills: totalCompletedBills,
      grossSubtotalAmount: grossSubtotal,
      discountAmount: grossDiscount,
      taxableAmount,
      taxAmount: grossTaxAmount,
      finalTotalAmount: grossFinalAmount,
      completedReturns: totalCompletedReturns,
      returnAmount: totalReturnAmount,
      netFinalAmount,
      cancelledBills: totalCancelledBills,
      cancelledFinalAmount: totalCancelledAmount,
      isScoped,
      isMasterAdmin,
      visibleSaleTypes: effectiveSaleTypes,
      formulaNotes:
        'Taxable Amount = grossSubtotalAmount - discountAmount; Net Final Amount = finalTotalAmount - returnAmount; Aggregate taxAmount reported without CGST/SGST/IGST synthesis.',
    };

    if (format === 'csv') {
      return statutoryGstSummaryToCsv(summary, bySaleType, byGstClassification);
    }

    return {
      summary,
      bySaleType,
      byGstClassification,
    };
  }
}
