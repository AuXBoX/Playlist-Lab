import type { FC } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthCallbackPage: FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.opener) {
      // We're in a popup opened by the login page.
      // Notify the parent window that auth completed, then auto-close the popup.
      try {
        window.opener.postMessage({ type: 'plex-auth-complete' }, window.location.origin);
      } catch {
        // Cross-origin safety - ignore
      }
      window.close();
    } else {
      // Opened in a regular tab (not a popup) - fall back to redirecting to login.
      // The login page's polling will pick up the auth state.
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Completing authentication...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Please wait</p>
      </div>
    </div>
  );
};
