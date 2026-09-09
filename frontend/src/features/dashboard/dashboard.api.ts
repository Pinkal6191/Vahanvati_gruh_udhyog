import { apiClient } from '../../services/api/api-client';

export interface BusinessSummaryData {
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
  paymentSummary: {
    CASH?: number;
    UPI?: number;
    CARD?: number;
    OTHER?: number;
    [key: string]: number | undefined;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    quantity: number;
  }>;
}

export interface RecentSaleItem {
  id: string;
  billNumber: string;
  customerNameSnapshot?: string | null;
  customerMobileSnapshot?: string | null;
  totalItemsCount: number;
  finalTotalAmount: number;
  paymentStatus: string;
  saleStatus: string;
  createdAt: string;
}

export const DashboardApi = {
  getBusinessSummary: async (params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    date?: string;
  }): Promise<BusinessSummaryData> => {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.date) query.set('date', params.date);

    const queryString = query.toString();
    const endpoint = queryString ? `/reports/business-summary?${queryString}` : '/reports/business-summary';
    const response = await apiClient.get<BusinessSummaryData>(endpoint);
    return response.data;
  },

  getRecentSales: async (limit: number = 5): Promise<RecentSaleItem[]> => {
    try {
      const response = await apiClient.get<{ items: RecentSaleItem[] }>(`/sales?limit=${limit}&page=1`);
      return response.data?.items || [];
    } catch {
      // Fallback gracefully if sales list is not accessible or empty
      return [];
    }
  },
};
