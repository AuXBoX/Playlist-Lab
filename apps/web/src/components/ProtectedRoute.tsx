import type { FC } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

interface ProtectedRouteProps {
  children: JSX.Element;
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoading: isAppLoading } = useApp();

  // Show loading screen while auth or app data is loading
  if (isLoading || isAppLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: 'var(--text-secondary)',
        gap: '1rem',
      }}>
        <div>Loading...</div>
        <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
          {isLoading ? 'Checking authentication...' : 'Loading app data...'}
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // No automatic redirect to settings - let users navigate there manually if needed
  return children;
};
