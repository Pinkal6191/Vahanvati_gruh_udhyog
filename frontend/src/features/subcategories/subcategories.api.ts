import { apiClient } from '../../services/api/api-client';
import { Category } from '../categories/categories.api';

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface CreateSubcategoryInput {
  categoryId: string;
  name: string;
  code: string;
  displayOrder?: number;
}

export interface UpdateSubcategoryInput {
  categoryId?: string;
  name?: string;
  code?: string;
  displayOrder?: number;
}

export interface SubcategoryQueryParams {
  categoryId?: string;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export const SubcategoriesApi = {
  list: async (params?: SubcategoryQueryParams): Promise<Subcategory[]> => {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);

    const qs = query.toString();
    const endpoint = qs ? `/subcategories?${qs}` : '/subcategories';
    const response = await apiClient.get<Subcategory[]>(endpoint);
    return response.data || [];
  },

  getById: async (id: string): Promise<Subcategory> => {
    const response = await apiClient.get<Subcategory>(`/subcategories/${id}`);
    return response.data;
  },

  create: async (data: CreateSubcategoryInput): Promise<Subcategory> => {
    const response = await apiClient.post<Subcategory>('/subcategories', data);
    return response.data;
  },

  update: async (id: string, data: UpdateSubcategoryInput): Promise<Subcategory> => {
    const response = await apiClient.patch<Subcategory>(`/subcategories/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<Subcategory> => {
    const response = await apiClient.patch<Subcategory>(`/subcategories/${id}/status`, { isActive });
    return response.data;
  },
};
