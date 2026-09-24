export type Role = 'ADMIN' | 'OUTLET' | 'PRODUCTION';
export type UserRole = Role;
export type SaleType = 'RETAIL' | 'NRI' | 'WHOLESALE';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  role: Role;
  isActive?: boolean;
  lastLoginAt?: string | null;
  isMasterAdmin?: boolean;
  allowedBillingSaleTypes?: SaleType[];
  allowedReportSaleTypes?: SaleType[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponseData {
  user: User;
  tokens: AuthTokens;
}
