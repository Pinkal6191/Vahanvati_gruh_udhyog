import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginCredentials } from '../../types/auth.types';
import { AuthService } from '../../services/auth/auth.service';
import { storageService } from '../../services/storage/storage.service';
import { apiClient } from '../../services/api/api-client';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentialsOrUsername: LoginCredentials | string, password?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => storageService.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  // Listen to 401s from ApiClient
  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      setUser(null);
    });
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = storageService.getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await AuthService.getProfile();
        setUser(profile);
      } catch (err) {
        console.warn('Session verification failed, logging out:', err);
        storageService.clearAuthSession();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (
    credentialsOrUsername: LoginCredentials | string,
    password?: string
  ): Promise<User> => {
    setIsLoading(true);
    try {
      const creds: LoginCredentials =
        typeof credentialsOrUsername === 'string'
          ? { username: credentialsOrUsername, password: password || '' }
          : credentialsOrUsername;

      const data = await AuthService.login(creds);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!storageService.getAccessToken()) return;
    try {
      const profile = await AuthService.getProfile();
      setUser(profile);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
