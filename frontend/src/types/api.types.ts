export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  summary?: Record<string, any>;
  pagination?: PaginationMeta;
  error?: ApiErrorPayload;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
}
