import { apiClient } from '../../services/api/api-client';
import { Unit } from '../products/products.api';

export type ProductionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface ProductionProduct {
  id: string;
  name: string;
  code: string;
  gujaratiName?: string | null;
  primaryUnit?: Unit;
}

export interface ProductionUser {
  id: string;
  fullName: string;
  username: string;
}

export interface ProductionEntry {
  id: string;
  productId: string;
  quantityProduced: number;
  unitId: string;
  batchNumber: string;
  productionDate: string;
  expiryDate?: string | null;
  notes?: string | null;
  status: ProductionStatus;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  product: ProductionProduct;
  unit: Unit;
  user: ProductionUser;
  cancelledByUser?: ProductionUser | null;
}

export interface ProductionSummary {
  todayProductionWeightGrams: number;
  totalEntries: number;
  draftCount: number;
  completedCount: number;
  cancelledCount: number;
  recentEntries: ProductionEntry[];
}

export interface ProductionQueryParams {
  productId?: string;
  batchNumber?: string;
  status?: ProductionStatus;
  date?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface ProductionListResponse {
  items: ProductionEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateProductionPayload {
  productId: string;
  quantityProduced: number;
  unitId: string;
  productionDate: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
  status?: 'DRAFT' | 'COMPLETED';
}

export interface UpdateProductionPayload {
  quantityProduced?: number;
  unitId?: string;
  batchNumber?: string;
  productionDate?: string;
  expiryDate?: string;
  notes?: string;
}

export const productionApi = {
  getSummary: async (): Promise<ProductionSummary> => {
    const response = await apiClient.get<ProductionSummary>('/production/summary');
    return response.data;
  },

  list: async (params: ProductionQueryParams = {}): Promise<ProductionListResponse> => {
    const query = new URLSearchParams();
    if (params.productId) query.append('productId', params.productId);
    if (params.batchNumber) query.append('batchNumber', params.batchNumber);
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = `/production${qs ? `?${qs}` : ''}`;
    const response = await apiClient.get<ProductionListResponse>(endpoint);
    return response.data;
  },

  getById: async (id: string): Promise<ProductionEntry> => {
    const response = await apiClient.get<ProductionEntry>(`/production/${id}`);
    return response.data;
  },

  create: async (payload: CreateProductionPayload): Promise<ProductionEntry> => {
    const response = await apiClient.post<ProductionEntry>('/production', payload);
    return response.data;
  },

  updateDraft: async (id: string, payload: UpdateProductionPayload): Promise<ProductionEntry> => {
    const response = await apiClient.put<ProductionEntry>(`/production/${id}`, payload);
    return response.data;
  },

  completeDraft: async (id: string): Promise<ProductionEntry> => {
    const response = await apiClient.post<ProductionEntry>(`/production/${id}/complete`);
    return response.data;
  },

  cancel: async (id: string, reason: string): Promise<ProductionEntry> => {
    const response = await apiClient.post<ProductionEntry>(`/production/${id}/cancel`, { reason });
    return response.data;
  },
};
