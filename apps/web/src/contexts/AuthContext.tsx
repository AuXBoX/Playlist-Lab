import { createContext, useContext, useState, useEffect, type FC, type ReactNode } from 'react';

interface User {
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (pinId: number, pinCode: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser({
          plexUserId: data.plexUserId,
          plexUsername: data.plexUsername,
          plexThumb: data.plexThumb,
          isAdmin: data.isAdmin,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (pinId: number, code: string) => {
    try {
      const response = await fetch('/api/auth/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ pinId, code }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      
      if (!data.authenticated) {
        throw new Error('Not authenticated yet');
      }

      setUser({
        plexUserId: data.user.plexUserId,
        plexUsername: data.user.plexUsername,
        plexThumb: data.user.plexThumb,
        isAdmin: data.user.isAdmin,
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const loginWithToken = async (_token: string) => {
    // This method is not currently used but required by the interface
    throw new Error('loginWithToken not implemented');
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithToken,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
