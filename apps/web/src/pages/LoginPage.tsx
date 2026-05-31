import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export const LoginPage: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [_pinId, setPinId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuth();
  const authPopupRef = useRef<Window | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Listen for the auth-complete message from the popup callback page
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'plex-auth-complete') {
        // Popup's callback page fired this - the poll will pick up auth momentarily.
        // Close the popup if it's still open.
        if (authPopupRef.current && !authPopupRef.current.closed) {
          authPopupRef.current.close();
          authPopupRef.current = null;
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const startPlexAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to start authentication');
      }

      const data = await response.json();
      setPinCode(data.code);
      setPinId(data.id);

      // Open a popup window instead of a new tab (like Seerr and similar apps)
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      authPopupRef.current = window.open(
        data.authUrl,
        'plex-auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      pollForAuth(data.id, data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsLoading(false);
    }
  };

  const pollForAuth = async (pinId: number, code: string) => {
    const maxAttempts = 120;
    let attempts = 0;
    let cancelled = false;
    let pollInterval = 2000;

    const poll = async () => {
      if (cancelled) return;

      if (attempts >= maxAttempts) {
        setError('Authentication timed out. Please try again.');
        setIsLoading(false);
        setPinCode(null);
        setPinId(null);
        return;
      }

      attempts++;
      if (attempts > 10) pollInterval = 5000;

      try {
        const response = await fetch('/api/auth/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pinId, code }),
        });
        
        if (!response.ok) throw new Error('Poll request failed');
        
        const data = await response.json();

        if (data.denied) {
          setError(data.message || 'Your account has not been approved by the server admin.');
          setIsLoading(false);
          setPinCode(null);
          setPinId(null);
          return;
        }

        if (data.authenticated) {
          // Close the popup if it's still open
          if (authPopupRef.current && !authPopupRef.current.closed) {
            authPopupRef.current.close();
            authPopupRef.current = null;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
          
          if (meResponse.ok) {
            await checkAuth();
            navigate('/', { replace: true });
          } else {
            setError('Login succeeded but session creation failed. Please try again.');
            setIsLoading(false);
            setPinCode(null);
            setPinId(null);
          }
        } else {
          if (!cancelled) setTimeout(poll, pollInterval);
        }
      } catch (err) {
        if (!cancelled) setTimeout(poll, pollInterval);
      }
    };

    (window as any).__cancelPlexAuth = () => {
      cancelled = true;
      if (authPopupRef.current && !authPopupRef.current.closed) {
        authPopupRef.current.close();
        authPopupRef.current = null;
      }
      setIsLoading(false);
      setPinCode(null);
      setPinId(null);
    };

    poll();
  };

  const cancelAuth = () => {
    if ((window as any).__cancelPlexAuth) {
      (window as any).__cancelPlexAuth();
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.svg" alt="Playlist Lab" />
          <h1><span className="logo-playlist">Playlist </span><span className="logo-lab">Lab</span></h1>
        </div>
        <p className="login-subtitle">Sign in with your Plex account to continue</p>

        {error && <div className="login-error">{error}</div>}

        {pinCode && (
          <div className="login-pin-box">
            <div className="login-pin-spinner" />
            <p className="login-pin-text">A sign-in window has opened. Please sign in to Plex and authorize this app.</p>
            <p className="login-pin-code">{pinCode}</p>
            <p className="login-pin-hint">Enter this code if prompted</p>
            <p className="login-pin-info">
              <strong>After authorizing in Plex:</strong><br/>
              The window will close automatically and you'll be signed in.
            </p>
            <button className="login-btn-cancel" onClick={cancelAuth}>Cancel</button>
          </div>
        )}

        <button className="login-btn" onClick={startPlexAuth} disabled={isLoading}>
          {isLoading ? 'Waiting for Plex...' : 'Sign in with Plex'}
        </button>
      </div>
    </div>
  );
};