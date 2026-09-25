import { apiClient } from '../../services/api/api-client';
import { Subcategory } from '../subcategories/subcategories.api';

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  isWeightBased: boolean;
  conversionFactorToBase: number;
  isActive: boolean;
}

export interface PackConfiguration {
  id: string;
  productId: string;
  packName: string;
  weightInBaseUnits: number;
  unitId: string;
  displayOrder: number;
  isActive: boolean;
  unit?: Unit;
}

export interface ProductStock {
  currentBalance: number;
  minimumThreshold: number;
}

export interface Product {
  id: string;
  subcategoryId: string;
  primaryUnitId: string;
  name: string;
  gujaratiName?: string | null;
  code: string;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isLooseWeightAllowed: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subcategory?: Subcategory;
  primaryUnit?: Unit;
  packConfigurations?: PackConfiguration[];
  stock?: ProductStock | null;
  // Resolved price fields for UI convenience
  indianPrice?: number | null;
  retailPrice?: number | null;
  nriPrice?: number | null;
  wholesalePrice?: number | null;
  prices?: Array<{
    id?: string;
    pricingTier: string;
    packConfigId?: string | null;
    rate: number;
    isActive: boolean;
  }>;
}

export interface ProductListResponse {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductQueryParams {
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
}

export interface CreateProductInput {
  categoryId?: string;
  subcategoryId: string;
  primaryUnitId: string;
  name: string;
  gujaratiName?: string;
  code: string;
  barcode?: string;
  description?: string;
  isLooseWeightAllowed?: boolean;
  minimumStockThreshold?: number;
  // Optional initial prices
  indianPrice?: number;
  nriPrice?: number;
  wholesalePrice?: number;
}

export interface UpdateProductInput {
  categoryId?: string;
  subcategoryId?: string;
  primaryUnitId?: string;
  name?: string;
  gujaratiName?: string;
  code?: string;
  barcode?: string;
  description?: string;
  isLooseWeightAllowed?: boolean;
  minimumStockThreshold?: number;
  // Optional price updates
  indianPrice?: number;
  nriPrice?: number;
  wholesalePrice?: number;
}

export interface ProductPriceEntry {
  id: string;
  productId: string;
  packConfigId?: string | null;
  pricingTier?: 'RETAIL' | 'NRI' | 'WHOLESALE';
  customerType?: 'INDIAN' | 'NRI';
  rate: number;
  isActive: boolean;
}

export const ProductsApi = {
  list: async (params?: ProductQueryParams): Promise<ProductListResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.subcategoryId) query.set('subcategoryId', params.subcategoryId);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = qs ? `/products?${qs}` : '/products';
    const response = await apiClient.get<ProductListResponse>(endpoint);
    return response.data;
  },

  getById: async (id: string): Promise<Product> => {
    const response = await apiClient.get<Product>(`/products/${id}`);
    return response.data;
  },

  create: async (data: CreateProductInput): Promise<Product> => {
    const { indianPrice, nriPrice, wholesalePrice, ...productData } = data;
    const response = await apiClient.post<Product>('/products', productData);
    const createdProduct = response.data;

    // If initial pricing provided, save via batch pricing endpoint using canonical pricingTier
    if (createdProduct?.id && (indianPrice !== undefined || nriPrice !== undefined || wholesalePrice !== undefined)) {
      try {
        const pricesToCreate = [];
        if (indianPrice !== undefined && indianPrice > 0) {
          pricesToCreate.push({
            productId: createdProduct.id,
            pricingTier: 'RETAIL' as const,
            rate: Number(indianPrice),
            isActive: true,
          });
        }
        if (nriPrice !== undefined && nriPrice > 0) {
          pricesToCreate.push({
            productId: createdProduct.id,
            pricingTier: 'NRI' as const,
            rate: Number(nriPrice),
            isActive: true,
          });
        }
        if (wholesalePrice !== undefined && wholesalePrice > 0) {
          pricesToCreate.push({
            productId: createdProduct.id,
            pricingTier: 'WHOLESALE' as const,
            rate: Number(wholesalePrice),
            isActive: true,
          });
        }
        if (pricesToCreate.length > 0) {
          await apiClient.post('/pricing/batch', { prices: pricesToCreate });
        }
      } catch (err) {
        console.warn('Could not batch-set prices for product:', err);
      }
    }

    return createdProduct;
  },

  update: async (id: string, data: UpdateProductInput): Promise<Product> => {
    const { indianPrice, nriPrice, wholesalePrice, ...productData } = data;
    const response = await apiClient.patch<Product>(`/products/${id}`, productData);
    const updatedProduct = response.data;

    // Update prices if provided using canonical pricingTier
    if (indianPrice !== undefined || nriPrice !== undefined || wholesalePrice !== undefined) {
      try {
        const pricesToSave = [];
        if (indianPrice !== undefined && indianPrice > 0) {
          pricesToSave.push({
            productId: id,
            pricingTier: 'RETAIL' as const,
            rate: Number(indianPrice),
            isActive: true,
          });
        }
        if (nriPrice !== undefined && nriPrice > 0) {
          pricesToSave.push({
            productId: id,
            pricingTier: 'NRI' as const,
            rate: Number(nriPrice),
            isActive: true,
          });
        }
        if (wholesalePrice !== undefined && wholesalePrice > 0) {
          pricesToSave.push({
            productId: id,
            pricingTier: 'WHOLESALE' as const,
            rate: Number(wholesalePrice),
            isActive: true,
          });
        }
        if (pricesToSave.length > 0) {
          await apiClient.post('/pricing/batch', { prices: pricesToSave });
        }
      } catch (err) {
        console.warn('Could not update prices for product:', err);
      }
    }

    return updatedProduct;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<Product> => {
    const response = await apiClient.patch<Product>(`/products/${id}/status`, { isActive });
    return response.data;
  },

  fetchUnits: async (): Promise<Unit[]> => {
    const response = await apiClient.get<Unit[]>('/units');
    return response.data || [];
  },

  fetchProductPrices: async (productId: string): Promise<{ indian?: number; nri?: number; wholesale?: number }> => {
    try {
      const response = await apiClient.get<ProductPriceEntry[]>(`/pricing/current?productId=${productId}`);
      const prices = response.data || [];
      const indian = prices.find((p) => (p.pricingTier === 'RETAIL' || (p as any).customerType === 'INDIAN') && !p.packConfigId)?.rate;
      const nri = prices.find((p) => (p.pricingTier === 'NRI' || (p as any).customerType === 'NRI') && !p.packConfigId)?.rate;
      const wholesale = prices.find((p) => p.pricingTier === 'WHOLESALE' && !p.packConfigId)?.rate;
      return { indian, nri, wholesale };
    } catch {
      return {};
    }
  },
};
