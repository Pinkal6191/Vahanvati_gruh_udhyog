import { apiClient } from '../../services/api/api-client';

export type ReportDatePeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'custom';

export type GroupByInterval = 'DAY' | 'WEEK' | 'MONTH';
export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'OTHER';
export type ProductionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type ReturnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type RefundPaymentMode = 'CASH' | 'UPI' | 'CARD' | 'CREDIT_NOTE';
export type MovementType =
  | 'PRODUCTION_IN'
  | 'PURCHASE_IN'
  | 'SALES_RETURN_IN'
  | 'ADJUSTMENT_IN'
  | 'SALE_OUT'
  | 'ADJUSTMENT_OUT'
  | 'SCRAP_OUT';

export interface BaseReportQuery {
  period?: ReportDatePeriod;
  startDate?: string;
  endDate?: string;
}

// 1. Business Summary
export interface BusinessSummaryQuery extends BaseReportQuery {
  date?: string;
}

export interface BusinessSummaryResponse {
  period: string;
  sales: {
    totalSales: number;
    billCount: number;
    averageBillValue: number;
  };
  returns: {
    totalReturnsAmount: number;
    returnsCount: number;
  };
  netSales: number;
  production: {
    totalProductionWeight: number;
    productionEntriesCount: number;
  };
  inventory: {
    totalItems: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  paymentSummary: Record<string, number>;
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    quantity: number;
  }>;
}

// 2. Sales Report
export interface SalesReportQuery extends BaseReportQuery {
  groupBy?: GroupByInterval;
  paymentMode?: PaymentMode;
  customerId?: string;
}

export interface SalesReportData {
  summary: {
    period: string;
    totalSalesAmount: number;
    completedBillsCount: number;
    averageBillValue: number;
    totalQuantitySold: number;
    totalWeightSold: number;
    cancelledBillsCount: number;
    cancelledAmount: number;
  };
  paymentBreakdown: Record<string, number>;
  timeSeries: Array<{
    periodKey: string;
    billsCount: number;
    salesAmount: number;
    quantitySold: number;
  }>;
}

// 3. Product Sales Report
export interface ProductReportQuery extends BaseReportQuery {
  categoryId?: string;
  subcategoryId?: string;
  sortBy?: 'amount' | 'quantity' | 'bills';
  order?: 'asc' | 'desc';
  limit?: number;
  page?: number;
}

export interface ProductSaleRecord {
  productId: string;
  productName: string;
  productCode: string;
  categoryName: string;
  subcategoryName: string;
  quantitySold: number;
  weightSold: number;
  salesAmount: number;
  billsCount: number;
  averageSellingRate: number;
}

export interface ProductReportResponse {
  summary: {
    period: string;
    totalProductsCount: number;
    totalRevenue: number;
    totalQuantitySold: number;
  };
  data: ProductSaleRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 4. Customer Sales Report
export interface CustomerReportQuery extends BaseReportQuery {
  minBills?: number;
  sortBy?: 'purchases' | 'bills' | 'lastPurchase';
  order?: 'asc' | 'desc';
  limit?: number;
  page?: number;
}

export interface CustomerSaleRecord {
  customerId: string;
  customerName: string;
  mobile: string | null;
  customerType: string;
  billsCount: number;
  totalPurchases: number;
  totalWeight: number;
  averageBillValue: number;
  lastPurchaseDate: string;
}

export interface CustomerReportResponse {
  summary: {
    period: string;
    totalUniqueCustomers: number;
    repeatCustomerCount: number;
    singlePurchaseCustomerCount: number;
    repeatPercentage: number;
  };
  data: CustomerSaleRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 5. Customer History
export interface CustomerHistoryQuery {
  limit?: number;
  page?: number;
}

export interface CustomerHistoryResponse {
  customer: {
    id: string;
    name: string;
    mobile: string | null;
    customerType: string;
  };
  summary: {
    totalBills: number;
    totalPurchases: number;
    firstPurchaseDate: string | null;
    lastPurchaseDate: string | null;
    averageBillValue: number;
  };
  data: Array<{
    id: string;
    billNumber: string;
    finalTotalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    saleStatus: string;
    createdAt: string;
    items: Array<{
      id: string;
      productNameSnapshot: string;
      quantity: number;
      unitRate: number;
      total: number;
    }>;
    payments: Array<{
      id: string;
      paymentMode: string;
      amount: number;
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 6. Production Report
export interface ProductionReportQuery extends BaseReportQuery {
  productId?: string;
  status?: ProductionStatus;
  groupBy?: GroupByInterval;
}

export interface ProductionReportData {
  summary: {
    period: string;
    totalEntries: number;
    completedEntriesCount: number;
    draftEntriesCount: number;
    cancelledEntriesCount: number;
    totalCompletedQuantityProduced: number;
    totalCompletedBaseWeightAdded: number;
  };
  productBreakdown: Array<{
    productId: string;
    productName: string;
    productCode: string;
    completedQuantity: number;
    completedBaseWeight: number;
    entriesCount: number;
  }>;
  timeSeries: Array<{
    periodKey: string;
    quantityProduced: number;
    baseWeightAdded: number;
    entriesCount: number;
  }>;
}

// 7. Stock Report
export interface StockReportQuery {
  status?: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK';
  categoryId?: string;
  subcategoryId?: string;
  limit?: number;
  page?: number;
}

export interface StockReportRecord {
  productId: string;
  productName: string;
  productCode: string;
  categoryName: string;
  subcategoryName: string;
  unitSymbol: string;
  currentBalance: number;
  minimumThreshold: number;
  stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
  lastUpdatedAt: string;
}

export interface StockReportResponse {
  summary: {
    totalProductsCount: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockWeight: number;
  };
  data: StockReportRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 8. Stock Movements Report
export interface StockMovementsReportQuery extends BaseReportQuery {
  productId?: string;
  movementType?: MovementType;
  limit?: number;
  page?: number;
}

export interface StockMovementRecord {
  id: string;
  productId: string;
  movementType: MovementType;
  referenceType: string;
  referenceId: string | null;
  quantityDelta: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    code: string;
  };
  user: {
    id: string;
    fullName: string;
    username: string;
  } | null;
}

export interface StockMovementsReportResponse {
  summary: {
    period: string;
    totalMovements: number;
    movementBreakdown: Record<string, { count: number; totalDelta: number }>;
  };
  data: StockMovementRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 9. Stock Reconciliation Report
export interface StockReconciliationRecord {
  productId: string;
  productName: string;
  productCode: string;
  cachedBalance: number;
  ledgerTotal: number;
  difference: number;
  discrepancy: number;
  isConsistent: boolean;
}

export interface StockReconciliationResponse {
  summary: {
    totalAudited: number;
    consistentCount: number;
    driftCount: number;
    allConsistent: boolean;
  };
  data: StockReconciliationRecord[];
}

// 10. Returns Report
export interface ReturnsReportQuery extends BaseReportQuery {
  productId?: string;
  status?: ReturnStatus;
  refundPaymentMode?: RefundPaymentMode;
}

export interface ReturnsReportData {
  summary: {
    period: string;
    totalReturns: number;
    completedReturnsCount: number;
    draftReturnsCount: number;
    cancelledReturnsCount: number;
    totalRefundAmount: number;
    totalReturnedQuantity: number;
    completedSalesAmount: number;
    returnRate: number;
  };
  paymentModeBreakdown: Record<string, number>;
  productBreakdown: Array<{
    productId: string;
    productName: string;
    returnedQuantity: number;
    refundAmount: number;
  }>;
}

function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const str = query.toString();
  return str ? `?${str}` : '';
}

export const reportsApi = {
  // 1. Business Summary (ADMIN)
  async getBusinessSummary(query: BusinessSummaryQuery = {}): Promise<BusinessSummaryResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<{ data: BusinessSummaryResponse }>(`/reports/business-summary${qs}`);
    return (res as any).data || (res as any);
  },

  // 2. Sales Report (ADMIN, OUTLET)
  async getSalesReport(query: SalesReportQuery = {}): Promise<SalesReportData> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<{ data: SalesReportData }>(`/reports/sales${qs}`);
    return (res as any).data || (res as any);
  },

  // 3. Product Sales Report (ADMIN, OUTLET)
  async getProductSalesReport(query: ProductReportQuery = {}): Promise<ProductReportResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<ProductReportResponse>(`/reports/sales/products${qs}`);
    return res as any;
  },

  // 4. Customer Sales Report (ADMIN, OUTLET)
  async getCustomerSalesReport(query: CustomerReportQuery = {}): Promise<CustomerReportResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<CustomerReportResponse>(`/reports/sales/customers${qs}`);
    return res as any;
  },

  // 5. Customer Purchase History (ADMIN, OUTLET)
  async getCustomerPurchaseHistory(
    customerId: string,
    query: CustomerHistoryQuery = {}
  ): Promise<CustomerHistoryResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<CustomerHistoryResponse>(`/reports/customers/${customerId}${qs}`);
    return res as any;
  },

  // 6. Production Report (ADMIN, PRODUCTION)
  async getProductionReport(query: ProductionReportQuery = {}): Promise<ProductionReportData> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<{ data: ProductionReportData }>(`/reports/production${qs}`);
    return (res as any).data || (res as any);
  },

  // 7. Stock Report (ADMIN, OUTLET, PRODUCTION)
  async getStockReport(query: StockReportQuery = {}): Promise<StockReportResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<StockReportResponse>(`/reports/stock${qs}`);
    return res as any;
  },

  // 8. Stock Movements Report (ADMIN, PRODUCTION)
  async getStockMovementsReport(
    query: StockMovementsReportQuery = {}
  ): Promise<StockMovementsReportResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<StockMovementsReportResponse>(`/reports/stock/movements${qs}`);
    return res as any;
  },

  // 9. Stock Reconciliation Report (ADMIN)
  async getStockReconciliationReport(): Promise<StockReconciliationResponse> {
    const res = await apiClient.get<StockReconciliationResponse>('/reports/stock/reconciliation');
    return res as any;
  },

  // 10. Returns Report (ADMIN, OUTLET)
  async getReturnsReport(query: ReturnsReportQuery = {}): Promise<ReturnsReportData> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<{ data: ReturnsReportData }>(`/reports/returns${qs}`);
    return (res as any).data || (res as any);
  },
};
