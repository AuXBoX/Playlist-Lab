import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { ServiceIcon } from './ServiceIcon';

interface ImportJob {
  id: number;
  source_service: string;
  source_playlist_name: string;
  target_service: string;
  target_playlist_name: string | null;
  matched_count: number;
  unmatched_count: number;
  skipped_count: number;
  total_count: number;
  status: string;
  unmatched_tracks: string | null;
  created_at: number;
  completed_at: number | null;
}

export const ImportHistoryTab: FC = () => {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/cross-import/history', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
        return res.json();
      })
      .then(data => setJobs(data.jobs || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading history…</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">No import history</div>
        <div className="empty-state-description">Your completed imports will appear here.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {jobs.map(job => {
        const unmatchedTracks: Array<{ title: string; artist: string }> = job.unmatched_tracks
          ? JSON.parse(job.unmatched_tracks)
          : [];
        const isExpanded = expandedId === job.id;
        const date = new Date(job.created_at * 1000).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
        });

        return (
          <div
            key={job.id}
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <button
              style={{
                width: '100%', display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                alignItems: 'center', gap: '1rem',
                padding: '0.875rem 1rem',
                background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onClick={() => setExpandedId(isExpanded ? null : job.id)}
            >
              <span style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ServiceIcon serviceId={job.source_service} size={20} />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <ServiceIcon serviceId={job.target_service} size={20} />
              </span>
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                  {job.source_playlist_name}
                  {job.target_playlist_name ? ` → ${job.target_playlist_name}` : ''}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {job.source_service} → {job.target_service} · {date}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--success)' }}>{job.matched_count} matched</span>
                {job.unmatched_count > 0 && (
                  <span style={{ color: 'var(--warning)' }}>{job.unmatched_count} unmatched</span>
                )}
                {job.skipped_count > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>{job.skipped_count} skipped</span>
                )}
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {isExpanded ? '▲' : '▼'}
              </span>
            </button>

            {isExpanded && unmatchedTracks.length > 0 && (
              <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.75rem 0 0.5rem' }}>
                  Unmatched tracks:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {unmatchedTracks.map((t, i) => (
                    <div key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {t.title} — {t.artist}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isExpanded && unmatchedTracks.length === 0 && (
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                All tracks were matched.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
