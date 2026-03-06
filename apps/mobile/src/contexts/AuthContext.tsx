import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiClient, setCachedToken } from '../services/api';
import { TokenStorage, UserStorage, ServerStorage, clearAllStorage } from '../services/storage';
import type { User, PlexServer } from '@playlist-lab/shared';

interface AuthContextType {
  user: User | null;
  server: PlexServer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (pinId: number, code: string) => Promise<void>;
  logout: () => Promise<void>;
  selectServer: (server: PlexServer) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [server, setServer] = useState<PlexServer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      setIsLoading(true);

      const token = await TokenStorage.get();
      if (!token) {
        setIsLoading(false);
        return;
      }

      setCachedToken(token);

      const [storedUser, storedServer] = await Promise.all([
        UserStorage.get(),
        ServerStorage.get(),
      ]);

      if (storedUser) setUser(storedUser);
      if (storedServer) setServer(storedServer);

      // Verify token is still valid
      try {
        const currentUser = await getApiClient().getMe();
        setUser(currentUser);
        await UserStorage.save(currentUser);
      } catch (error) {
        console.error('Token validation failed:', error);
        await clearAllStorage();
        setCachedToken(null);
        setUser(null);
        setServer(null);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(pinId: number, code: string) {
    try {
      const result = await getApiClient().pollAuth(pinId, code);

      if (!result.authToken || !result.user) {
        throw new Error('Authentication failed');
      }

      await TokenStorage.save(result.authToken);
      setCachedToken(result.authToken);

      await UserStorage.save(result.user);
      setUser(result.user);

      const servers = await getApiClient().getServers();
      if (servers.length > 0) {
        await selectServer(servers[0]);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await getApiClient().logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await clearAllStorage();
      setCachedToken(null);
      setUser(null);
      setServer(null);
    }
  }

  async function selectServer(selectedServer: PlexServer) {
    try {
      await getApiClient().selectServer(selectedServer);
      await ServerStorage.save(selectedServer);
      setServer(selectedServer);
    } catch (error) {
      console.error('Error selecting server:', error);
      throw error;
    }
  }

  const value: AuthContextType = {
    user,
    server,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    selectServer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
