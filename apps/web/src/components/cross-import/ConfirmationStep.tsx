import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { TargetInfo, TargetConfig } from '../../pages/CrossImportPage';
import type { MatchResult } from './types';

interface Props {
  jobId: number;
  matchResults: MatchResult[];
  target: TargetInfo;
  targetConfig: TargetConfig;
  playlistName: string;
  onStartOver: () => void;
}

interface ExecuteResult {
  playlistId: string;
  name: string;
  trackCount: number;
}

export const ConfirmationStep: FC<Props> = ({
  jobId,
  matchResults,
  target,
  targetConfig,
  playlistName,
  onStartOver,
}) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const executedRef = useRef(false);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cross-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobId,
          reviewedTracks: matchResults,
          targetId: target.id,
          targetConfig,
          playlistName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || `Failed to create playlist (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;
    execute();
  }, []);

  if (loading) {
    return (
      <div className="confirmation-container">
        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Creating playlist on {target.name}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="confirmation-container">
        <div className="confirmation-icon">❌</div>
        <h2 className="confirmation-title">Something went wrong</h2>
        <p className="confirmation-subtitle">{error}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={execute}>Retry</button>
          <button className="btn btn-secondary" onClick={onStartOver}>Start over</button>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmation-container">
      <div className="confirmation-icon">✅</div>
      <h2 className="confirmation-title">Playlist created!</h2>
      <p className="confirmation-subtitle">
        "{result?.name}" was added to {target.name} with {result?.trackCount} track{result?.trackCount !== 1 ? 's' : ''}.
      </p>
      <button className="btn btn-primary" onClick={onStartOver}>
        Start another import
      </button>
    </div>
  );
};
