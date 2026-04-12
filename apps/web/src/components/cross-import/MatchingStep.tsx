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
  allowLive?: boolean;
  allowStatic?: boolean;
}

interface Progress {
  phase: 'fetching' | 'matching';
  current: number;
  total: number;
  playlistName?: string;
  currentTrackName?: string;
}

export const MatchingStep: FC<Props> = ({
  source,
  playlistUrlOrId,
  target,
  targetConfig,
  onMatchingComplete,
  allowLive,
  allowStatic,
}) => {
  const [progress, setProgress] = useState<Progress>({ phase: 'fetching', current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const sessionIdRef = useRef<string>(`ci-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startedRef = useRef(false);

  const sessionId = sessionIdRef.current;

  console.log('[MatchingStep] Current progress state:', progress);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startMatching();
    return () => {
      const es = eventSourceRef.current;
      if (es) {
        const interval = (es as any).pollInterval;
        if (interval) clearInterval(interval);
        if (es instanceof EventSource) {
          es.close();
        }
      }
    };
  }, []);

  const startMatching = async () => {
    console.log('[MatchingStep] Starting matching with sessionId:', sessionId);
    
    // Start matching FIRST
    console.log('[MatchingStep] Sending match request...');
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
          allowLive,
          allowStatic,
        }),
      });
      console.log('[MatchingStep] Match request response:', res.status, res.ok);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[MatchingStep] Match request failed:', data);
        throw new Error(data.error?.message || `Matching failed (${res.status})`);
      }
      console.log('[MatchingStep] Match request successful');
    } catch (err: any) {
      console.error('[MatchingStep] Match request error:', err);
      if (!cancelled) {
        setError(err.message || 'Failed to start matching');
      }
      return;
    }
    
    // NOW set up SSE connection and polling
    console.log('[MatchingStep] Creating EventSource...');
    const eventSource = new EventSource(`/api/cross-import/match/progress/${sessionId}`);
    eventSourceRef.current = eventSource;
    console.log('[MatchingStep] SSE connection established');
    
    // Add polling fallback (same as ImportPage)
    const startPolling = () => {
      console.log('[MatchingStep] Starting polling...');
      
      const doPoll = async () => {
        try {
          const response = await fetch(`/api/cross-import/match/status/${sessionId}`, {
            credentials: 'include'
          });
          const data = await response.json();
          console.log('[MatchingStep] Poll response:', data);
          
          if (data.type === 'progress') {
            console.log('[MatchingStep] Updating progress from poll:', data);
            setProgress({
              phase: data.phase,
              current: data.current,
              total: data.total,
              playlistName: data.playlistName,
              currentTrackName: data.currentTrackName,
            });
          } else if (data.type === 'complete') {
            clearInterval(interval);
            if (eventSource.readyState !== EventSource.CLOSED) {
              eventSource.close();
            }
            onMatchingComplete(data.results, data.jobId, sessionId);
          } else if (data.type === 'error') {
            clearInterval(interval);
            if (eventSource.readyState !== EventSource.CLOSED) {
              eventSource.close();
            }
            if (!cancelled) {
              setError(data.message || 'Matching failed');
            }
          }
        } catch (err) {
          console.error('[MatchingStep] Polling error:', err);
        }
      };
      
      // Poll immediately
      doPoll();
      
      // Then poll every 500ms
      const interval = setInterval(doPoll, 500);
      (eventSource as any).pollInterval = interval;
    };
    
    // Start polling alongside SSE
    startPolling();
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[MatchingStep] SSE event received:', data);
        if (data.type === 'progress') {
          console.log('[MatchingStep] Updating progress from SSE:', data);
          setProgress({
            phase: data.phase,
            current: data.current,
            total: data.total,
            playlistName: data.playlistName,
            currentTrackName: data.currentTrackName,
          });
        } else if (data.type === 'complete') {
          eventSource.close();
          const interval = (eventSource as any).pollInterval;
          if (interval) clearInterval(interval);
          onMatchingComplete(data.results, data.jobId, sessionId);
        } else if (data.type === 'error') {
          eventSource.close();
          const interval = (eventSource as any).pollInterval;
          if (interval) clearInterval(interval);
          if (!cancelled) {
            setError(data.message || 'Matching failed');
          }
        }
      } catch (err) {
        console.error('[MatchingStep] Failed to parse SSE event:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[MatchingStep] SSE error:', error);
      console.log('[MatchingStep] SSE readyState:', eventSource.readyState);
      // SSE errors are expected — polling fallback is already running
    };
  };

  const handleCancel = async () => {
    setCancelled(true);
    const es = eventSourceRef.current;
    if (es) {
      const interval = (es as any).pollInterval;
      if (interval) clearInterval(interval);
      if (es instanceof EventSource) {
        es.close();
      }
    }
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

  const phaseLabel = progress.phase === 'fetching' ? 'Fetching playlist...' : 'Matching tracks with your Plex library...';
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  if (error) {
    return (
      <div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <>
      {/* Modal overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}>
        <div style={{
          width: '400px',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          {/* YouTube logo - simple red square with white play button */}
          <div style={{
            width: '120px',
            height: '120px',
            margin: '0 auto 1.5rem',
            borderRadius: '12px',
            backgroundColor: '#FF0000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 0, 0, 0.3)',
            position: 'relative',
          }}>
            {/* White play button triangle */}
            <div style={{
              width: 0,
              height: 0,
              borderLeft: '30px solid white',
              borderTop: '20px solid transparent',
              borderBottom: '20px solid transparent',
              marginLeft: '8px',
            }} />
          </div>

          {/* Playlist name */}
          <h2 style={{ 
            margin: '0 0 0.5rem 0',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}>
            {progress.playlistName || 'YouTube Playlist'}
          </h2>
          
          {/* Source label */}
          <div style={{ 
            fontSize: '0.813rem', 
            color: '#888888', 
            marginBottom: '1.5rem',
            fontWeight: 400,
          }}>
            from {source.name}
          </div>

          {/* Track count - always show, even if 0 */}
          <div style={{ 
            fontSize: '1.125rem', 
            fontWeight: 500, 
            marginBottom: '0.75rem',
            color: '#ffffff',
          }}>
            {progress.total > 0 
              ? `${progress.current} / ${progress.total} tracks`
              : 'Starting...'}
          </div>

          {/* Current status or track name */}
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: 400,
            color: '#aaaaaa',
            minHeight: '1.25rem',
            marginBottom: '1.5rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 1rem',
          }}>
            {progress.currentTrackName || phaseLabel}
          </div>

          {/* Progress indicator */}
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}>
            {progress.total > 0 ? (
              // Progress bar when we have total
              <div style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: '#FF0000',
                transition: 'width 0.3s ease',
              }} />
            ) : (
              // Indeterminate progress when fetching
              <div style={{
                width: '30%',
                height: '100%',
                backgroundColor: '#FF0000',
                animation: 'progress-indeterminate 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
          
          {/* Cancel button */}
          <button
            onClick={handleCancel}
            style={{ 
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.938rem',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            Cancel
          </button>
        </div>
        
        {/* Add CSS animation for indeterminate progress */}
        <style>{`
          @keyframes progress-indeterminate {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(350%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    </>
  );
};
