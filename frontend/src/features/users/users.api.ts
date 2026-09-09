import { apiClient } from '../../services/api/api-client';
import { Role } from '../../types/auth.types';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  role: Role;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
  password?: string;
}

export const UsersApi = {
  list: async (): Promise<UserAccount[]> => {
    const response = await apiClient.get<UserAccount[]>('/users');
    return response.data || [];
  },

  create: async (data: CreateUserInput): Promise<UserAccount> => {
    const response = await apiClient.post<UserAccount>('/users', data);
    return response.data;
  },

  update: async (id: string, data: UpdateUserInput): Promise<UserAccount> => {
    const response = await apiClient.patch<UserAccount>(`/users/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<UserAccount> => {
    const response = await apiClient.patch<UserAccount>(`/users/${id}`, { isActive });
    return response.data;
  },
};
