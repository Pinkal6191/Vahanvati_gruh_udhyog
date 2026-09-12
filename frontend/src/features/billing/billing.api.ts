import { apiClient } from '../../services/api/api-client';
import { CustomerType } from '../../types/common.types';

export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'OTHER';
export type SaleStatus = 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'COMPLETED' | 'REFUNDED';

export interface CreateSaleItemPayload {
  productId: string;
  packConfigId?: string | null;
  quantity: number;
  looseWeightInGrams?: number | null;
}

export interface SalePaymentPayload {
  paymentMode: PaymentMode;
  amount: number;
  transactionReference?: string | null;
  notes?: string | null;
}

export interface CreateSalePayload {
  customerId?: string | null;
  customerType?: CustomerType | null;
  items: CreateSaleItemPayload[];
  discountAmount?: number;
  payments: SalePaymentPayload[];
  paidAmount: number;
}

export interface ResolveCartPayload {
  customerId?: string | null;
  customerType?: CustomerType;
  items: Array<{
    productId: string;
    packConfigId?: string | null;
    quantity: number;
    looseWeightInGrams?: number | null;
  }>;
}

export interface ResolvedCartItem {
  productId: string;
  packConfigId?: string | null;
  quantity: number;
  looseWeightInGrams?: number | null;
  baseWeightDeducted?: number;
  unitRate: number;
  totalAmount: number;
  weightOrPackSnapshot?: string;
  weightOrPackName?: string;
  productName?: string;
}

export interface ResolvedCartResponse {
  customerId?: string | null;
  customerType: CustomerType;
  subtotalAmount: number;
  finalTotalAmount: number;
  items: ResolvedCartItem[];
}

export interface SaleLineItem {
  id: string;
  saleId: string;
  productId: string;
  packConfigId?: string | null;
  productNameSnapshot: string;
  weightOrPackSnapshot: string;
  unitRate: number;
  quantity: number;
  total: number;
  createdAt: string;
}

export interface SalePaymentRecord {
  id: string;
  saleId: string;
  paymentMode: PaymentMode;
  amount: number;
  transactionReference?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface SaleRecord {
  id: string;
  billNumber: string;
  customerId?: string | null;
  customerTypeSnapshot: CustomerType;
  customerNameSnapshot?: string | null;
  customerMobileSnapshot?: string | null;
  subtotalAmount: number;
  discountAmount: number;
  finalTotalAmount: number;
  paidAmount: number;
  changeReturned: number;
  paymentStatus: PaymentStatus;
  saleStatus: SaleStatus;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
  };
  items: SaleLineItem[];
  payments: SalePaymentRecord[];
}

export interface SalesQueryFilter {
  billNumber?: string;
  customerId?: string;
  customerType?: CustomerType;
  paymentMode?: PaymentMode;
  saleStatus?: SaleStatus;
  date?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface SalesListResponse {
  items: SaleRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ThermalPrintPayload {
  company: {
    name: string;
    tagline?: string;
    address?: string;
    phone?: string;
    gstin?: string;
    fssaiLicense?: string;
    footerNotes?: string;
  };
  invoice: {
    billNumber: string;
    date: string;
    billerName: string;
    customerName?: string | null;
    customerMobile?: string | null;
  };
  items: Array<{
    name: string;
    variant: string;
    qty: number;
    rate: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    change: number;
  };
  payments: Array<{
    mode: PaymentMode;
    amount: number;
    ref?: string | null;
  }>;
}

export const BillingApi = {
  // 1. Authoritative Cart Price Resolution via Step 4 Pricing Engine
  resolveCart: async (payload: ResolveCartPayload): Promise<ResolvedCartResponse> => {
    const response = await apiClient.post<ResolvedCartResponse>('/pricing/resolve-cart', payload);
    return response.data;
  },

  // 2. Complete a Sale / POS Checkout
  createSale: async (payload: CreateSalePayload): Promise<SaleRecord> => {
    const response = await apiClient.post<SaleRecord>('/sales', payload);
    return response.data;
  },

  // 3. List Past Sales with Search and Pagination
  listSales: async (query?: SalesQueryFilter): Promise<SalesListResponse> => {
    const params = new URLSearchParams();
    if (query?.billNumber) params.set('billNumber', query.billNumber);
    if (query?.customerId) params.set('customerId', query.customerId);
    if (query?.customerType) params.set('customerType', query.customerType);
    if (query?.paymentMode) params.set('paymentMode', query.paymentMode);
    if (query?.saleStatus) params.set('saleStatus', query.saleStatus);
    if (query?.date) params.set('date', query.date);
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);
    if (query?.page) params.set('page', query.page.toString());
    if (query?.limit) params.set('limit', query.limit.toString());

    const qs = params.toString();
    const endpoint = qs ? `/sales?${qs}` : '/sales';
    const response = await apiClient.get<SalesListResponse>(endpoint);
    return response.data;
  },

  // 4. Get Sale by ID
  getSaleById: async (id: string): Promise<SaleRecord> => {
    const response = await apiClient.get<SaleRecord>(`/sales/${id}`);
    return response.data;
  },

  // 5. Get Sale by Sequential Bill Number
  getSaleByBillNumber: async (billNumber: string): Promise<SaleRecord> => {
    const response = await apiClient.get<SaleRecord>(`/sales/bill/${billNumber}`);
    return response.data;
  },

  // 6. Fetch 3-inch Thermal Print Payload
  getPrintPayload: async (saleId: string): Promise<ThermalPrintPayload> => {
    const response = await apiClient.get<ThermalPrintPayload>(`/sales/${saleId}/print`);
    return response.data;
  },

  // 7. Cancel Sale (Admin only)
  cancelSale: async (saleId: string, reason: string): Promise<SaleRecord> => {
    const response = await apiClient.post<SaleRecord>(`/sales/${saleId}/cancel`, { reason });
    return response.data;
  },
};
