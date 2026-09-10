import { apiClient } from '../../services/api/api-client';

export type MovementType =
  | 'PRODUCTION_IN'
  | 'SALES_RETURN_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'SALE_OUT';

export type ReferenceType = 'SALE' | 'PRODUCTION' | 'SALES_RETURN' | 'MANUAL' | 'AUDIT';

export interface StockItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  subcategoryName: string;
  categoryName: string;
  currentBalance: number;
  minimumThreshold: number;
  unitSymbol: string;
  isWeightBased: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lastUpdatedAt: string;
}

export interface InventorySummary {
  totalActiveProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  recentMovements: {
    id: string;
    productId: string;
    productName: string;
    movementType: MovementType;
    quantityDelta: number;
    balanceAfter: number;
    notes?: string | null;
    createdByName: string;
    createdAt: string;
  }[];
}

export interface ProductStockDetail {
  productId: string;
  productName: string;
  productCode: string;
  subcategoryName: string;
  categoryName: string;
  currentBalance: number;
  minimumThreshold: number;
  unitSymbol: string;
  isWeightBased: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lastUpdatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unitSymbol: string;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string;
  quantityDelta: number;
  balanceAfter: number;
  notes?: string | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  createdAt: string;
}

export interface StockQueryParams {
  search?: string;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
  categoryId?: string;
  subcategoryId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface StockListResponse {
  items: StockItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MovementQueryParams {
  productId?: string;
  movementType?: MovementType;
  referenceType?: ReferenceType;
  referenceId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface MovementListResponse {
  items: StockMovement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdjustStockPayload {
  productId: string;
  quantityDelta: number;
  reason: string;
  notes?: string;
}

export interface AdjustStockResponse {
  productId: string;
  productName: string;
  previousBalance: number;
  newBalance: number;
  quantityDelta: number;
  movement: any;
}

export interface ReconcileStockResponse {
  productId: string;
  productName: string;
  cachedBalance: number;
  ledgerTotal: number;
  isConsistent: boolean;
  discrepancy: number;
}

export const inventoryApi = {
  getSummary: async (): Promise<InventorySummary> => {
    const response = await apiClient.get<InventorySummary>('/inventory/summary');
    return response.data;
  },

  listStock: async (params: StockQueryParams = {}): Promise<StockListResponse> => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.lowStockOnly !== undefined) query.append('lowStockOnly', String(params.lowStockOnly));
    if (params.outOfStockOnly !== undefined) query.append('outOfStockOnly', String(params.outOfStockOnly));
    if (params.categoryId) query.append('categoryId', params.categoryId);
    if (params.subcategoryId) query.append('subcategoryId', params.subcategoryId);
    if (params.isActive !== undefined) query.append('isActive', String(params.isActive));
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = `/inventory/status${qs ? `?${qs}` : ''}`;
    const response = await apiClient.get<StockListResponse>(endpoint);
    return response.data;
  },

  getProductStock: async (productId: string): Promise<ProductStockDetail> => {
    const response = await apiClient.get<ProductStockDetail>(`/inventory/product/${productId}`);
    return response.data;
  },

  listMovements: async (params: MovementQueryParams = {}): Promise<MovementListResponse> => {
    const query = new URLSearchParams();
    if (params.productId) query.append('productId', params.productId);
    if (params.movementType) query.append('movementType', params.movementType);
    if (params.referenceType) query.append('referenceType', params.referenceType);
    if (params.referenceId) query.append('referenceId', params.referenceId);
    if (params.userId) query.append('userId', params.userId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = `/inventory/movements${qs ? `?${qs}` : ''}`;
    const response = await apiClient.get<MovementListResponse>(endpoint);
    return response.data;
  },

  adjustStock: async (payload: AdjustStockPayload): Promise<AdjustStockResponse> => {
    const response = await apiClient.post<AdjustStockResponse>('/inventory/adjust', payload);
    return response.data;
  },

  reconcileStock: async (productId: string): Promise<ReconcileStockResponse> => {
    const response = await apiClient.get<ReconcileStockResponse>(`/inventory/reconcile/${productId}`);
    return response.data;
  },
};
