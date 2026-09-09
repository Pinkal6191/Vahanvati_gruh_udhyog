import { apiClient } from '../../services/api/api-client';

export type CustomerType = 'INDIAN' | 'NRI';

export interface Customer {
  id: string;
  name: string;
  customerType: CustomerType;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  gstin?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sales?: number;
  };
}

export interface CustomerListResponse {
  items: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerQueryParams {
  search?: string;
  type?: CustomerType;
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
}

export interface CreateCustomerInput {
  name: string;
  customerType: CustomerType;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string;
  gstin?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerInput {
  name?: string;
  customerType?: CustomerType;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string;
  gstin?: string | null;
  notes?: string | null;
}

export interface CustomerPurchaseItem {
  productNameSnapshot: string;
  quantity: number;
  unitRate: number;
  total: number;
  unitSymbolSnapshot?: string;
}

export interface CustomerPurchaseBill {
  id: string;
  billNumber: string;
  saleStatus: string;
  finalTotalAmount: number;
  paymentStatus: string;
  createdAt: string;
  itemsCount: number;
  payments: Array<{
    paymentMode: string;
    amount: number;
  }>;
  items: CustomerPurchaseItem[];
}

export interface CustomerPurchaseHistoryData {
  customer: Customer;
  summary: {
    totalPurchases: number;
    billCount: number;
    totalBaseWeightPurchased: number;
    averageBillValue: number;
    firstPurchaseDate: string | null;
    lastPurchaseDate: string | null;
  };
  bills: CustomerPurchaseBill[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const CustomersApi = {
  list: async (params?: CustomerQueryParams): Promise<CustomerListResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = qs ? `/customers?${qs}` : '/customers';
    const response = await apiClient.get<CustomerListResponse>(endpoint);
    return response.data;
  },

  getById: async (id: string): Promise<Customer> => {
    const response = await apiClient.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  create: async (data: CreateCustomerInput): Promise<Customer> => {
    const response = await apiClient.post<Customer>('/customers', data);
    return response.data;
  },

  update: async (id: string, data: UpdateCustomerInput): Promise<Customer> => {
    const response = await apiClient.patch<Customer>(`/customers/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<Customer> => {
    const response = await apiClient.patch<Customer>(`/customers/${id}/status`, { isActive });
    return response.data;
  },

  getPurchaseHistory: async (
    customerId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerPurchaseHistoryData> => {
    const response = await apiClient.get<CustomerPurchaseHistoryData>(
      `/reports/customers/${customerId}?page=${page}&limit=${limit}`
    );
    return response.data;
  },
};
