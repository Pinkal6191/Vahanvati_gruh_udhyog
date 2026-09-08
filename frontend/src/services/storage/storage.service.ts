import { STORAGE_KEYS } from '../../constants/storage';
import { User, AuthTokens } from '../../types/auth.types';

class StorageService {
  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  getItem<T = string>(key: string): T | null {
    if (!this.isAvailable()) return null;
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return null;
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as unknown as T;
      }
    } catch (err) {
      console.warn(`Storage get error for key "${key}":`, err);
      return null;
    }
  }

  setItem(key: string, value: any): void {
    if (!this.isAvailable()) return;
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
    } catch (err) {
      console.warn(`Storage set error for key "${key}":`, err);
    }
  }

  removeItem(key: string): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.warn(`Storage remove error for key "${key}":`, err);
    }
  }

  clear(): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.clear();
    } catch (err) {
      console.warn('Storage clear error:', err);
    }
  }

  // Auth Helpers
  getAccessToken(): string | null {
    return this.getItem<string>(STORAGE_KEYS.ACCESS_TOKEN);
  }

  setAccessToken(token: string): void {
    this.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  getRefreshToken(): string | null {
    return this.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN);
  }

  setRefreshToken(token: string): void {
    this.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  getUser(): User | null {
    return this.getItem<User>(STORAGE_KEYS.USER_DATA);
  }

  setUser(user: User): void {
    this.setItem(STORAGE_KEYS.USER_DATA, user);
  }

  saveAuthSession(user: User, tokens: AuthTokens): void {
    this.setUser(user);
    this.setAccessToken(tokens.accessToken);
    if (tokens.refreshToken) {
      this.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
  }

  clearAuthSession(): void {
    this.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    this.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    this.removeItem(STORAGE_KEYS.USER_DATA);
  }
}

export const storageService = new StorageService();
