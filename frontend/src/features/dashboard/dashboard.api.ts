import { apiClient } from '../../services/api/api-client';
import { storageService } from '../../services/storage/storage.service';

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
    role?: string;
  }): Promise<BusinessSummaryData> => {
    const userRole = params?.role || storageService.getUser()?.role || 'ADMIN';
    const period = params?.period || 'today';

    // 1. OUTLET ROLE: Fetch permitted sales, returns, and stock reports
    if (userRole === 'OUTLET') {
      const [salesRes, returnsRes, stockRes, topProductsRes] = await Promise.allSettled([
        apiClient.get<{ summary: any; paymentBreakdown: any }>(`/reports/sales?period=${period}`),
        apiClient.get<{ summary: any }>(`/reports/returns?period=${period}`),
        apiClient.get<any>('/reports/stock'),
        apiClient.get<{ data: any[] }>(`/reports/sales/products?period=${period}&limit=5`),
      ]);

      const salesData = salesRes.status === 'fulfilled' ? salesRes.value.data : null;
      const returnsData = returnsRes.status === 'fulfilled' ? returnsRes.value.data : null;
      const stockData = stockRes.status === 'fulfilled' ? stockRes.value : null;
      const topProductsData = topProductsRes.status === 'fulfilled' ? topProductsRes.value.data : null;

      const totalSales = Number(salesData?.summary?.totalSalesAmount || 0);
      const totalRefund = Number(returnsData?.summary?.totalRefundAmount || 0);

      return {
        period: salesData?.summary?.period || 'Today',
        sales: {
          totalSales,
          billCount: Number(salesData?.summary?.completedBillsCount || 0),
          averageBillValue: Number(salesData?.summary?.averageBillValue || 0),
        },
        returns: {
          totalReturnsAmount: totalRefund,
          returnsCount: Number(returnsData?.summary?.completedReturnsCount || 0),
        },
        netSales: totalSales - totalRefund,
        production: {
          totalProductionWeight: 0,
          productionEntriesCount: 0,
        },
        inventory: {
          totalItems: Number(stockData?.summary?.totalProductsCount || 0),
          inStockCount: Number(stockData?.summary?.inStockCount || 0),
          lowStockCount: Number(stockData?.summary?.lowStockCount || 0),
          outOfStockCount: Number(stockData?.summary?.outOfStockCount || 0),
        },
        paymentSummary: salesData?.paymentBreakdown || {},
        topProducts: (topProductsData?.data || []).map((p: any) => ({
          productId: p.productId,
          productName: p.productName,
          revenue: Number(p.salesAmount || p.totalRevenue || 0),
          quantity: Number(p.quantitySold || 0),
        })),
      };
    }

    // 2. PRODUCTION ROLE: Fetch permitted production and stock reports
    if (userRole === 'PRODUCTION') {
      const [prodRes, stockRes] = await Promise.allSettled([
        apiClient.get<{ summary: any }>(`/reports/production?period=${period}`),
        apiClient.get<any>('/reports/stock'),
      ]);

      const prodData = prodRes.status === 'fulfilled' ? prodRes.value.data : null;
      const stockData = stockRes.status === 'fulfilled' ? stockRes.value : null;

      return {
        period: prodData?.summary?.period || 'Today',
        sales: { totalSales: 0, billCount: 0, averageBillValue: 0 },
        returns: { totalReturnsAmount: 0, returnsCount: 0 },
        netSales: 0,
        production: {
          totalProductionWeight: Number(prodData?.summary?.totalCompletedBaseWeightAdded || 0),
          productionEntriesCount: Number(prodData?.summary?.completedEntriesCount || 0),
        },
        inventory: {
          totalItems: Number(stockData?.summary?.totalProductsCount || 0),
          inStockCount: Number(stockData?.summary?.inStockCount || 0),
          lowStockCount: Number(stockData?.summary?.lowStockCount || 0),
          outOfStockCount: Number(stockData?.summary?.outOfStockCount || 0),
        },
        paymentSummary: {},
        topProducts: [],
      };
    }

    // 3. ADMIN ROLE (default): Call executive summary endpoint
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
