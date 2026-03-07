import type { FC } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

interface ProtectedRouteProps {
  children: JSX.Element;
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { server, isLoading: isAppLoading } = useApp();
  const location = useLocation();

  if (isLoading || isAppLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: 'var(--text-secondary)',
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Only redirect to settings if there is no server configured at all (first-time setup)
  // Don't redirect just because libraryId is missing — user may have a server without a library selected
  // Also don't redirect if we're still loading - wait for the data to confirm no server exists
  // Check for server.url to ensure we have a valid server object (not just null/undefined)
  const needsSetup = !isAppLoading && (!server || !server.url);
  const isOnSettingsPage = location.pathname === '/settings';
  
  if (needsSetup && !isOnSettingsPage) {
    return <Navigate to="/settings" replace state={{ firstTimeSetup: true }} />;
  }

  return children;
};
