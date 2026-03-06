import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { SourceInfo } from '../../pages/CrossImportPage';
import { ServiceIcon } from './ServiceIcon';

interface Props {
  onSourceSelected: (source: SourceInfo) => void;
}

// Services that require OAuth/token to browse/fetch playlists
const OAUTH_REQUIRED_SOURCES = ['spotify', 'deezer', 'youtube-music', 'amazon', 'apple', 'tidal', 'qobuz', 'listenbrainz'];
// Services that work without auth (public API or URL-based)
const PUBLIC_SOURCES = ['youtube', 'youtube-plain', 'aria', 'file'];

export const SourceStep: FC<Props> = ({ onSourceSelected }) => {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingSource, setConnectingSource] = useState<SourceInfo | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  const fetchSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cross-import/sources', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load sources (${res.status})`);
      const data = await res.json();
      setSources(data.sources || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleSourceClick = (source: SourceInfo) => {
    const baseId = source.id.split(':')[0];
    const needsOAuth = OAUTH_REQUIRED_SOURCES.includes(baseId);
    if (needsOAuth && !source.connected) {
      // Only show connect panel if not already connected
      setConnectingSource(source);
      setConnectError(null);
    } else {
      onSourceSelected(source);
    }
  };

  const handleConnect = async () => {
    if (!connectingSource) return;
    const serviceId = connectingSource.id.split(':')[0];
    setConnectError(null);

    try {
      const res = await fetch(`/api/cross-import/oauth/${serviceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to get auth URL (${res.status})`);
      const data = await res.json();

      const popup = window.open(data.authUrl, 'oauth_source_popup', 'width=600,height=700,scrollbars=yes');
      if (!popup) {
        setConnectError('Popup was blocked. Please allow popups for this site and try again.');
        return;
      }
      popupRef.current = popup;
      setWaitingForAuth(true);

      const finishAuth = async () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setWaitingForAuth(false);

        const refreshRes = await fetch('/api/cross-import/sources', { credentials: 'include' });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const updatedSources: SourceInfo[] = refreshData.sources || [];
          setSources(updatedSources);
          const updated = updatedSources.find(s => s.id === connectingSource.id);
          if (updated?.connected) {
            setConnectingSource(null);
            onSourceSelected(updated);
          } else {
            setConnectError('Authentication did not complete. Please try again.');
          }
        }
      };

      // Listen for postMessage from the popup (faster than polling)
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'cross_import_oauth') {
          window.removeEventListener('message', onMessage);
          popupRef.current?.close();
          if (event.data.status === 'connected') {
            finishAuth();
          } else {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setWaitingForAuth(false);
            setConnectError(`Authentication failed: ${event.data.detail || 'unknown error'}`);
          }
        }
      };
      window.addEventListener('message', onMessage);

      // Fallback: poll until popup closes
      pollRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          window.removeEventListener('message', onMessage);
          finishAuth();
        }
      }, 500);
    } catch (err: any) {
      setConnectError(err.message || 'Failed to initiate authentication');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading sources…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={fetchSources}>
          Retry
        </button>
      </div>
    );
  }

  // Show connect prompt for OAuth-required sources (only when not connected)
  if (connectingSource) {
    return (
      <div style={{ maxWidth: '480px' }}>
        <h2 className="step-section-title">Connect to {connectingSource.name}</h2>
        {connectError && <div className="error-message" style={{ marginBottom: '1rem' }}>{connectError}</div>}
        <div className="progress-container" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <ServiceIcon serviceId={connectingSource.id} size={48} />
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Connect your {connectingSource.name} account to browse and import your playlists.
          </p>
          {waitingForAuth ? (
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
                  setWaitingForAuth(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConnectingSource(null)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleConnect}>
                Connect {connectingSource.name}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="step-section-title">Choose a source</h2>
      <div className="service-grid">
        {sources.map(source => {
          const baseId = source.id.split(':')[0];
          const isPublic = PUBLIC_SOURCES.includes(baseId) || source.type === 'plex-server' || source.type === 'plex-home-user';
          const showDisconnected = !source.connected && !isPublic;
          return (
            <button
              key={source.id}
              className="service-card"
              onClick={() => handleSourceClick(source)}
            >
              <div
                className={`service-card-badge ${source.connected ? 'connected' : showDisconnected ? 'disconnected' : ''}`}
                title={source.connected ? 'Connected' : showDisconnected ? 'Login required' : 'No login needed'}
              />
              <ServiceIcon serviceId={source.id} size={90} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
