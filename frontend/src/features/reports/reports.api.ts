import { apiClient } from '../../services/api/api-client';
import { storageService } from '../../services/storage/storage.service';

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
export type SaleType = 'RETAIL' | 'NRI' | 'WHOLESALE';
export type CustomerType = 'INDIAN' | 'NRI';
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
  saleType?: SaleType;
}

export interface BusinessSummaryResponse {
  period: string;
  scope?: {
    isMasterAdmin: boolean;
    isScoped: boolean;
    scopeLabel: string;
    allowedSaleTypes: SaleType[];
  };
  sales: {
    totalSales: number;
    billCount: number;
    averageBillValue: number;
  };
  salesByType?: Record<SaleType, { totalSales: number; billCount: number }>;
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
  saleType?: SaleType;
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
  salesByType?: Record<SaleType, { totalSalesAmount: number; completedBillsCount: number }>;
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
  saleType?: SaleType;
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
  customerType?: CustomerType;
  saleType?: SaleType;
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
  saleType?: SaleType;
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
  saleType?: SaleType;
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

  // ==========================================
  // Phase 2F: Statutory / CA Compliance Reports
  // ==========================================

  // 11. Statutory Sales Register
  async getStatutorySales(query: StatutoryReportQuery = {}): Promise<StatutorySalesResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<StatutorySalesResponse>(`/reports/statutory/sales${qs}`);
    return res as any;
  },

  // 12. Statutory Itemized Sales Register
  async getStatutoryItemizedSales(
    query: StatutoryReportQuery = {}
  ): Promise<StatutoryItemizedResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<StatutoryItemizedResponse>(
      `/reports/statutory/sales/itemized${qs}`
    );
    return res as any;
  },

  // 13. Statutory Sales Returns Register
  async getStatutoryReturns(query: StatutoryReportQuery = {}): Promise<StatutoryReturnsResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<StatutoryReturnsResponse>(`/reports/statutory/returns${qs}`);
    return res as any;
  },

  // 14. Statutory GST Summary
  async getStatutoryGstSummary(
    query: StatutoryReportQuery = {}
  ): Promise<StatutoryGstSummaryResponse> {
    const qs = buildQueryString(query);
    const res = await apiClient.get<StatutoryGstSummaryResponse>(
      `/reports/statutory/gst-summary${qs}`
    );
    return res as any;
  },

  // Download Statutory Report CSV
  async downloadStatutoryCsv(path: string, query: Record<string, any>, filename: string): Promise<void> {
    const qs = buildQueryString({ ...query, format: 'csv' });
    const token = storageService.getAccessToken();
    const res = await fetch(`${apiClient.getBaseUrl()}${path}${qs}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to download CSV: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

// ==========================================
// Phase 2F: Statutory Types
// ==========================================

export interface StatutoryReportQuery extends BaseReportQuery {
  saleType?: SaleType;
  customerType?: CustomerType;
  paymentMode?: PaymentMode;
  gstinOnly?: boolean;
  status?: 'ALL' | 'COMPLETED' | 'CANCELLED';
  refundPaymentMode?: RefundPaymentMode;
  format?: 'json' | 'csv';
}

export interface StatutorySaleRow {
  id: string;
  billNumber: string;
  date: string;
  saleType: SaleType;
  customerName: string;
  customerMobile: string | null;
  customerType: CustomerType;
  customerGstin: string | null;
  isB2B: boolean;
  subtotalAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalTotalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  paymentModes: string[];
  saleStatus: string;
  cancellationReason: string | null;
  biller: string;
}

export interface StatutorySalesSummary {
  period: string;
  totalRecordedBills: number;
  completedBills: number;
  cancelledBills: number;
  subtotalAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalTotalAmount: number;
  paidAmount: number;
  cancelledAmount: number;
  isScoped: boolean;
  isMasterAdmin: boolean;
  visibleSaleTypes: SaleType[];
  formulaNotes?: string;
}

export interface StatutorySalesResponse {
  success: boolean;
  summary: StatutorySalesSummary;
  data: StatutorySaleRow[];
}

export interface StatutoryItemizedSaleRow {
  id: string;
  saleId: string;
  billNumber: string;
  date: string;
  saleType: SaleType;
  customerName: string;
  customerType: CustomerType;
  customerGstin: string | null;
  isB2B: boolean;
  productName: string;
  unitSymbol: string;
  weightOrPack: string;
  quantity: number;
  unitRate: number;
  subtotal: number;
  discount: number;
  total: number;
  saleStatus: string;
  cancellationReason: string | null;
}

export interface StatutoryItemizedSummary {
  period: string;
  totalItemsCount: number;
  completedItemsCount: number;
  cancelledItemsCount: number;
  totalQuantity: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalAmount: number;
  isScoped: boolean;
  isMasterAdmin: boolean;
  visibleSaleTypes: SaleType[];
}

export interface StatutoryItemizedResponse {
  success: boolean;
  summary: StatutoryItemizedSummary;
  data: StatutoryItemizedSaleRow[];
}

export interface StatutoryReturnItem {
  id: string;
  productName: string;
  returnedQuantity: number;
  unitRate: number;
  refundAmount: number;
  restockCondition: string;
}

export interface StatutoryReturnRow {
  id: string;
  returnNumber: string;
  originalBillNumber: string;
  date: string;
  completedAt: string | null;
  customerName: string;
  customerType: CustomerType;
  customerGstin: string | null;
  isB2B: boolean;
  saleType: SaleType;
  refundPaymentMode: RefundPaymentMode;
  totalReturnAmount: number;
  status: ReturnStatus;
  reason: string;
  cancellationReason: string | null;
  items: StatutoryReturnItem[];
}

export interface StatutoryReturnsSummary {
  period: string;
  totalReturns: number;
  completedReturns: number;
  cancelledReturns: number;
  draftReturns: number;
  totalRefundAmount: number;
  totalReturnedQuantity: number;
  isScoped: boolean;
  isMasterAdmin: boolean;
  visibleSaleTypes: SaleType[];
}

export interface StatutoryReturnsResponse {
  success: boolean;
  summary: StatutoryReturnsSummary;
  data: StatutoryReturnRow[];
}

export interface GstSegmentSummary {
  billsCount: number;
  subtotalAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalTotalAmount: number;
  returnsCount: number;
  returnAmount: number;
  netAmount: number;
  cancelledBillsCount: number;
  cancelledAmount: number;
}

export interface StatutoryGstSummaryResponse {
  success: boolean;
  summary: {
    period: string;
    completedBills: number;
    grossSubtotalAmount: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    finalTotalAmount: number;
    completedReturns: number;
    returnAmount: number;
    netFinalAmount: number;
    cancelledBills: number;
    cancelledFinalAmount: number;
    isScoped: boolean;
    isMasterAdmin: boolean;
    visibleSaleTypes: SaleType[];
    formulaNotes: string;
  };
  bySaleType: Record<SaleType, GstSegmentSummary>;
  byGstClassification: Record<'B2B' | 'B2C', GstSegmentSummary>;
}
