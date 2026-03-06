import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { TargetInfo } from '../../pages/CrossImportPage';
import { ServiceIcon } from './ServiceIcon';

interface Props {
  target: TargetInfo;
  onOAuthComplete: () => void;
}

export const OAuthStep: FC<Props> = ({ target, onOAuthComplete }) => {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  const serviceId = target.id.split(':')[0];

  const fetchAuthUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cross-import/oauth/${serviceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to get auth URL (${res.status})`);
      const data = await res.json();
      setAuthUrl(data.authUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate authentication');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthUrl();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [target.id]);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      // Check if popup closed
      if (popupRef.current?.closed) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setWaiting(false);
        // Check connection status
        checkConnection();
        return;
      }
      // Check for postMessage or query param in popup URL
      try {
        const popupUrl = popupRef.current?.location?.href || '';
        if (popupUrl.includes('cross_import_connected')) {
          popupRef.current?.close();
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setWaiting(false);
          onOAuthComplete();
        }
      } catch {
        // Cross-origin — can't read popup URL, rely on popup closing
      }
    }, 500);
  };

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/cross-import/targets', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const updated = (data.targets || []).find((t: TargetInfo) => t.id === target.id);
        if (updated?.connected) {
          onOAuthComplete();
          return;
        }
      }
    } catch {
      // ignore
    }
    setError('Authentication did not complete. Please try again.');
  };

  const handleConnect = () => {
    if (!authUrl) return;
    const popup = window.open(authUrl, 'oauth_popup', 'width=600,height=700,scrollbars=yes');
    if (!popup) {
      setError('Popup was blocked. Please allow popups for this site and try again.');
      return;
    }
    popupRef.current = popup;
    setWaiting(true);
    startPolling();
  };

  // Also listen for postMessage from popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'cross_import_connected' && event.data?.service === serviceId) {
        if (pollRef.current) clearInterval(pollRef.current);
        popupRef.current?.close();
        setWaiting(false);
        onOAuthComplete();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [serviceId, onOAuthComplete]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Preparing authentication…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <h2 className="step-section-title">Connect to {target.name}</h2>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div className="progress-container" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ marginBottom: '1rem' }}><ServiceIcon serviceId={target.id} size={48} /></div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          You need to connect your {target.name} account to create playlists there.
          Click the button below to open the authorization page.
        </p>

        {waiting ? (
          <div>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Waiting for authorization…
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                popupRef.current?.close();
                setWaiting(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={handleConnect} disabled={!authUrl}>
            Connect {target.name}
          </button>
        )}
      </div>
    </div>
  );
};
