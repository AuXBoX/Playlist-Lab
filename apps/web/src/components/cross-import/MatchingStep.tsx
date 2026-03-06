import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { SourceInfo, TargetInfo, TargetConfig } from '../../pages/CrossImportPage';
import type { MatchResult } from './types';

interface Props {
  source: SourceInfo;
  playlistUrlOrId: string;
  target: TargetInfo;
  targetConfig: TargetConfig;
  onMatchingComplete: (results: MatchResult[], jobId: number, sessionId: string) => void;
}

interface Progress {
  phase: 'fetching' | 'matching';
  current: number;
  total: number;
  playlistName?: string;
}

export const MatchingStep: FC<Props> = ({
  source,
  playlistUrlOrId,
  target,
  targetConfig,
  onMatchingComplete,
}) => {
  const [progress, setProgress] = useState<Progress>({ phase: 'fetching', current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const sessionIdRef = useRef<string>(`ci-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startedRef = useRef(false);

  const sessionId = sessionIdRef.current;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startMatching();
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const startMatching = async () => {
    // Open SSE connection first
    const es = new EventSource(`/api/cross-import/match/progress/${sessionId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setProgress({
            phase: data.phase,
            current: data.current,
            total: data.total,
            playlistName: data.playlistName,
          });
        } else if (data.type === 'complete') {
          es.close();
          onMatchingComplete(data.results, data.jobId, sessionId);
        } else if (data.type === 'error') {
          es.close();
          if (!cancelled) {
            setError(data.message || 'Matching failed');
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE errors are expected on some proxies — rely on polling fallback
    };

    // Small delay to let SSE establish
    await new Promise(r => setTimeout(r, 150));

    // Start matching
    try {
      const res = await fetch('/api/cross-import/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceId: source.id,
          playlistUrlOrId,
          targetId: target.id,
          targetConfig,
          sessionId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || `Matching failed (${res.status})`);
      }
    } catch (err: any) {
      es.close();
      if (!cancelled) {
        setError(err.message || 'Failed to start matching');
      }
    }
  };

  const handleCancel = async () => {
    setCancelled(true);
    eventSourceRef.current?.close();
    try {
      await fetch(`/api/cross-import/match/cancel/${sessionId}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setError('Matching cancelled.');
  };

  const phaseLabel = progress.phase === 'fetching' ? 'Fetching tracks…' : 'Matching tracks…';
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  if (error) {
    return (
      <div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="progress-container">
      <h2 className="step-section-title" style={{ marginBottom: '0.5rem' }}>
        {progress.playlistName ? `Importing "${progress.playlistName}"` : 'Matching tracks…'}
      </h2>

      <p className="progress-phase">{phaseLabel}</p>

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="progress-count">
        {progress.total > 0
          ? `${progress.current} / ${progress.total} tracks`
          : 'Starting…'}
      </p>

      <button
        className="btn btn-secondary"
        style={{ marginTop: '1.5rem' }}
        onClick={handleCancel}
      >
        Cancel
      </button>
    </div>
  );
};
