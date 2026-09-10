import { apiClient } from '../../services/api/api-client';

export type ReturnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type RefundPaymentMode = 'CASH' | 'UPI' | 'STORE_CREDIT';
export type RestockCondition = 'RESTOCKABLE' | 'DAMAGED_DISCARD';

export interface ReturnSummary {
  todayReturnCount: number;
  todayReturnAmount: number;
  totalReturnCount: number;
  totalReturnAmount: number;
  draftCount: number;
  completedCount: number;
  cancelledCount: number;
  recentReturns: Array<{
    id: string;
    returnNumber: string;
    originalBillNumber: string;
    customerName: string;
    totalReturnAmount: number;
    status: ReturnStatus;
    createdAt: string;
    createdByName: string;
  }>;
}

export interface ReturnPreviewItem {
  saleItemId: string;
  productId: string;
  productName: string;
  productCode: string;
  unitSymbol: string;
  weightOrPack: string;
  soldQuantity: number;
  alreadyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  unitRate: number;
  maxReturnAmount: number;
  isEligibleForReturn: boolean;
}

export interface ReturnPreview {
  originalSaleId: string;
  billNumber: string;
  saleDate: string;
  customerId: string | null;
  customerName: string;
  customerMobile: string | null;
  customerType: string;
  totalBillAmount: number;
  totalEligibleAmount: number;
  items: ReturnPreviewItem[];
}

export interface SalesReturnItem {
  id: string;
  saleItemId: string;
  productId: string;
  productName: string;
  productCode: string;
  returnedQuantity: number;
  originalSoldQuantity: number;
  unitRateSnapshot: number;
  refundAmount: number;
  restockCondition: RestockCondition;
  unitSymbol: string;
  weightOrPack: string;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  originalBillNumber: string;
  saleDate: string;
  customerId: string | null;
  customerName: string;
  customerMobile: string | null;
  customerType: string;
  totalReturnAmount: number;
  refundPaymentMode: RefundPaymentMode;
  status: ReturnStatus;
  reason: string;
  cancellationReason?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  itemCount?: number;
  items: SalesReturnItem[];
}

export interface CreateReturnItemInput {
  saleItemId: string;
  returnedQuantity: number;
  restockCondition?: RestockCondition;
}

export interface CreateReturnPayload {
  originalSaleId: string;
  reason: string;
  refundPaymentMode: RefundPaymentMode;
  status?: ReturnStatus;
  items: CreateReturnItemInput[];
}

export interface UpdateReturnPayload {
  reason?: string;
  refundPaymentMode?: RefundPaymentMode;
  items?: CreateReturnItemInput[];
}

export interface ReturnsQueryParams {
  returnNumber?: string;
  originalBillNumber?: string;
  customerId?: string;
  productId?: string;
  status?: ReturnStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface ReturnsListResponse {
  items: SalesReturn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const salesReturnsApi = {
  getSummary: async (): Promise<ReturnSummary> => {
    const response = await apiClient.get<ReturnSummary>('/sales-returns/summary');
    return response.data;
  },

  getPreview: async (saleIdOrBillNumber: string): Promise<ReturnPreview> => {
    const response = await apiClient.get<ReturnPreview>(
      `/sales-returns/preview/${encodeURIComponent(saleIdOrBillNumber)}`
    );
    return response.data;
  },

  list: async (params: ReturnsQueryParams = {}): Promise<ReturnsListResponse> => {
    const query = new URLSearchParams();
    if (params.returnNumber) query.append('returnNumber', params.returnNumber);
    if (params.originalBillNumber) query.append('originalBillNumber', params.originalBillNumber);
    if (params.customerId) query.append('customerId', params.customerId);
    if (params.productId) query.append('productId', params.productId);
    if (params.status) query.append('status', params.status);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = `/sales-returns${qs ? `?${qs}` : ''}`;
    const response = await apiClient.get<ReturnsListResponse>(endpoint);
    return response.data;
  },

  getById: async (id: string): Promise<SalesReturn> => {
    const response = await apiClient.get<SalesReturn>(`/sales-returns/${id}`);
    return response.data;
  },

  create: async (payload: CreateReturnPayload): Promise<SalesReturn> => {
    const response = await apiClient.post<SalesReturn>('/sales-returns', payload);
    return response.data;
  },

  updateDraft: async (id: string, payload: UpdateReturnPayload): Promise<SalesReturn> => {
    const response = await apiClient.put<SalesReturn>(`/sales-returns/${id}`, payload);
    return response.data;
  },

  complete: async (id: string): Promise<SalesReturn> => {
    const response = await apiClient.post<SalesReturn>(`/sales-returns/${id}/complete`);
    return response.data;
  },

  cancel: async (id: string, reason: string): Promise<SalesReturn> => {
    const response = await apiClient.post<SalesReturn>(`/sales-returns/${id}/cancel`, { reason });
    return response.data;
  },
};
