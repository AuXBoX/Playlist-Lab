import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { TargetInfo, TargetConfig } from '../../pages/CrossImportPage';
import { ServiceIcon } from './ServiceIcon';

interface Props {
  onTargetSelected: (target: TargetInfo, config: TargetConfig) => void;
}

export const TargetStep: FC<Props> = ({ onTargetSelected }) => {
  const [targets, setTargets] = useState<TargetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingTarget, setConnectingTarget] = useState<TargetInfo | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  const fetchTargets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cross-import/targets', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load targets (${res.status})`);
      const data = await res.json();
      const list: TargetInfo[] = data.targets || [];
      setTargets(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    fetchTargets();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleCardClick = (target: TargetInfo) => {
    // If server-side credentials aren't configured, this service is unavailable
    if (target.configured === false) return;
    // If target requires OAuth and isn't connected, show connect prompt
    if (target.requiresOAuth && !target.connected && !target.id.startsWith('plex')) {
      setConnectingTarget(target);
      setConnectError(null);
      return;
    }
    // Advance immediately — same as SourceStep
    const config: TargetConfig = {};
    if (target.id.startsWith('plex')) {
      config.libraryId = target.libraries?.[0]?.id || '';
    }
    onTargetSelected(target, config);
  };

  const handleConnect = async () => {
    if (!connectingTarget) return;
    setConnectError(null);

    try {
      const res = await fetch(`/api/cross-import/oauth/${connectingTarget.id}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        throw new Error(data.error || `Failed to get auth URL (${res.status})`);
      }
      const data = await res.json();

      const popup = window.open(data.authUrl, 'oauth_target_popup', 'width=600,height=700,scrollbars=yes');
      if (!popup) {
        setConnectError('Popup was blocked. Please allow popups for this site and try again.');
        return;
      }
      popupRef.current = popup;
      setWaitingForAuth(true);

      const finishAuth = async () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setWaitingForAuth(false);

        const refreshRes = await fetch('/api/cross-import/targets', { credentials: 'include' });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const updatedTargets: TargetInfo[] = refreshData.targets || [];
          setTargets(updatedTargets);
          const updated = updatedTargets.find(t => t.id === connectingTarget.id);
          if (updated?.connected) {
            setConnectingTarget(null);
            const config: TargetConfig = {};
            if (updated.id.startsWith('plex')) config.libraryId = updated.libraries?.[0]?.id || '';
            onTargetSelected(updated, config);
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
        <span className="loading-text">Loading targets…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={fetchTargets}>Retry</button>
      </div>
    );
  }

  // Show connect prompt for OAuth-required targets
  if (connectingTarget) {
    return (
      <div style={{ maxWidth: '480px' }}>
        <h2 className="step-section-title">Connect to {connectingTarget.name}</h2>
        {connectError && <div className="error-message" style={{ marginBottom: '1rem' }}>{connectError}</div>}
        <div className="progress-container" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <ServiceIcon serviceId={connectingTarget.id} size={48} />
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            You need to connect your {connectingTarget.name} account to import playlists into it.
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
              <button className="btn btn-secondary" onClick={() => setConnectingTarget(null)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleConnect}>
                Connect {connectingTarget.name}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="step-section-title">Choose a destination</h2>

      <div className="service-grid" style={{ marginBottom: '1.5rem' }}>
        {targets.map(target => (
          <button
            key={target.id}
            className={`service-card ${target.configured === false ? 'unavailable' : ''}`}
            onClick={() => handleCardClick(target)}
            title={target.configured === false ? `${target.name} requires server-side API credentials (not configured)` : undefined}
            style={target.configured === false ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            <div
              className={`service-card-badge ${target.connected ? 'connected' : 'disconnected'}`}
              title={target.connected ? 'Connected' : 'Requires authentication'}
            />
            <ServiceIcon serviceId={target.id} size={90} />
            {target.configured === false && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #666)' }}>Not available</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
