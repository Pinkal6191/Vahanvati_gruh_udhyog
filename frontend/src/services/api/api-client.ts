import { storageService } from '../storage/storage.service';
import { ApiResponse, RequestOptions } from '../../types/api.types';

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: any[];

  constructor(message: string, status: number, code: string = 'API_ERROR', details?: any[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private baseUrl: string;
  private onUnauthorizedCallback?: () => void;

  constructor() {
    this.baseUrl =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
        ? import.meta.env.VITE_API_BASE_URL
        : 'http://localhost:4000/api/v1';
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  triggerUnauthorized() {
    storageService.clearAuthSession();
    if (this.onUnauthorizedCallback) {
      this.onUnauthorizedCallback();
    }
  }

  getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    const token = storageService.getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    return requestHeaders;
  }

  private async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { timeout = 15000, skipAuth = false, headers = {}, ...customConfig } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestHeaders = this.getHeaders(headers as Record<string, string>);
    if (skipAuth) {
      delete requestHeaders['Authorization'];
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        ...customConfig,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized globally
      if (response.status === 401) {
        storageService.clearAuthSession();
        if (this.onUnauthorizedCallback) {
          this.onUnauthorizedCallback();
        }
      }

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          `Request failed with status ${response.status}: ${response.statusText}`;
        const errorCode = data?.error?.code || `HTTP_${response.status}`;
        const errorDetails = data?.error?.details || data?.details;

        throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
      }

      return data as ApiResponse<T>;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out after 15 seconds', 408, 'REQUEST_TIMEOUT');
      }

      throw new ApiError(
        err.message || 'Network error: unable to connect to server',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // HTTP Method Verbs
  get<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
