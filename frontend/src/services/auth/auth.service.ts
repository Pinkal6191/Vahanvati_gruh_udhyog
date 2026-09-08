import { apiClient } from '../api/api-client';
import { storageService } from '../storage/storage.service';
import { LoginCredentials, LoginResponseData, User } from '../../types/auth.types';

export class AuthService {
  /**
   * Log in user with username and password
   */
  static async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    const res = await apiClient.post<LoginResponseData>('/auth/login', credentials, {
      skipAuth: true,
    });

    if (!res.data) {
      throw new Error('Invalid response received from auth service');
    }

    // Persist session to local storage
    storageService.saveAuthSession(res.data.user, res.data.tokens);

    return res.data;
  }

  /**
   * Log out user and clear storage
   */
  static async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      storageService.clearAuthSession();
    }
  }

  /**
   * Retrieve current user profile from backend
   */
  static async getProfile(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me');
    if (!res.data) {
      throw new Error('Failed to retrieve user profile');
    }
    storageService.setUser(res.data);
    return res.data;
  }

  /**
   * Get currently persisted user from local storage
   */
  static getStoredUser(): User | null {
    return storageService.getUser();
  }

  /**
   * Check if token is currently stored
   */
  static hasStoredToken(): boolean {
    return !!storageService.getAccessToken();
  }
}
