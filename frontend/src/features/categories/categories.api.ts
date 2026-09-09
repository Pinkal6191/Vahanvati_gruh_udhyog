import { apiClient } from '../../services/api/api-client';

export interface Category {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    subcategories?: number;
  };
}

export interface CreateCategoryInput {
  name: string;
  code: string;
  displayOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  code?: string;
  displayOrder?: number;
}

export interface CategoryQueryParams {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export const CategoriesApi = {
  list: async (params?: CategoryQueryParams): Promise<Category[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);

    const qs = query.toString();
    const endpoint = qs ? `/categories?${qs}` : '/categories';
    const response = await apiClient.get<Category[]>(endpoint);
    return response.data || [];
  },

  getById: async (id: string): Promise<Category> => {
    const response = await apiClient.get<Category>(`/categories/${id}`);
    return response.data;
  },

  create: async (data: CreateCategoryInput): Promise<Category> => {
    const response = await apiClient.post<Category>('/categories', data);
    return response.data;
  },

  update: async (id: string, data: UpdateCategoryInput): Promise<Category> => {
    const response = await apiClient.patch<Category>(`/categories/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<Category> => {
    const response = await apiClient.patch<Category>(`/categories/${id}/status`, { isActive });
    return response.data;
  },
};
