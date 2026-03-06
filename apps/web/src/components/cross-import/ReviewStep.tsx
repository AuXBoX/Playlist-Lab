import type { FC } from 'react';
import { useState } from 'react';
import type { TargetInfo, TargetConfig } from '../../pages/CrossImportPage';
import type { MatchResult } from './types';

interface Props {
  matchResults: MatchResult[];
  target: TargetInfo;
  targetConfig: TargetConfig;
  onConfirm: (reviewedTracks: MatchResult[]) => void;
}

function confidenceClass(confidence: number): string {
  if (confidence >= 80) return 'confidence-high';
  if (confidence >= 50) return 'confidence-medium';
  return 'confidence-low';
}

export const ReviewStep: FC<Props> = ({ matchResults, target, targetConfig, onConfirm }) => {
  const [tracks, setTracks] = useState<MatchResult[]>(matchResults);
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const toggleSkip = (index: number) => {
    setTracks(prev => prev.map((t, i) => i === index ? { ...t, skipped: !t.skipped } : t));
  };

  const openSearch = (index: number) => {
    const t = tracks[index];
    setSearchingIndex(index);
    setSearchQuery(`${t.sourceTrack.title} ${t.sourceTrack.artist}`);
    setSearchResults([]);
    setSearchError(null);
  };

  const closeSearch = () => {
    setSearchingIndex(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/cross-import/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: searchQuery, targetId: target.id, targetConfig }),
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const applySearchResult = (result: MatchResult) => {
    if (searchingIndex === null) return;
    setTracks(prev => prev.map((t, i) =>
      i === searchingIndex
        ? {
            ...t,
            targetTrackId: result.targetTrackId,
            targetTitle: result.targetTitle,
            targetArtist: result.targetArtist,
            targetAlbum: result.targetAlbum,
            confidence: 100,
            matched: true,
            skipped: false,
          }
        : t
    ));
    closeSearch();
  };

  const displayed = showUnmatchedOnly
    ? tracks.filter(t => !t.matched && !t.skipped)
    : tracks;

  const matched = tracks.filter(t => t.matched && !t.skipped).length;
  const unmatched = tracks.filter(t => !t.matched && !t.skipped).length;
  const skipped = tracks.filter(t => t.skipped).length;
  const total = tracks.length;

  return (
    <div>
      <h2 className="step-section-title">Review matches</h2>

      {/* Summary bar */}
      <div className="review-summary" style={{ marginBottom: '1rem' }}>
        <div className="review-summary-item">
          <span className="review-summary-count">{total}</span> total
        </div>
        <div className="review-summary-item" style={{ color: 'var(--success)' }}>
          <span className="review-summary-count">{matched}</span> matched
        </div>
        <div className="review-summary-item" style={{ color: 'var(--warning)' }}>
          <span className="review-summary-count">{unmatched}</span> unmatched
        </div>
        <div className="review-summary-item" style={{ color: 'var(--text-muted)' }}>
          <span className="review-summary-count">{skipped}</span> skipped
        </div>
      </div>

      {/* Filter toggle */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={showUnmatchedOnly}
            onChange={e => setShowUnmatchedOnly(e.target.checked)}
          />
          Show only unmatched
        </label>
      </div>

      {/* Track list */}
      <div className="review-track-list" style={{ marginBottom: '1.5rem' }}>
        {displayed.map((track) => {
          const realIndex = tracks.indexOf(track);
          const statusClass = track.skipped ? 'skipped' : track.matched ? 'matched' : 'unmatched';

          return (
            <div key={realIndex} className={`review-track-item ${statusClass}`}>
              {/* Source */}
              <div className="review-track-source">
                <div className="review-track-title">{track.sourceTrack.title}</div>
                <div className="review-track-artist">{track.sourceTrack.artist}</div>
              </div>

              {/* Target */}
              <div className="review-track-target">
                {track.matched ? (
                  <>
                    <div className="review-track-title">{track.targetTitle}</div>
                    <div className="review-track-artist">{track.targetArtist}</div>
                  </>
                ) : (
                  <span className="review-track-unmatched-label">Unmatched</span>
                )}
              </div>

              {/* Confidence */}
              {track.matched && (
                <span className={`confidence-badge ${confidenceClass(track.confidence)}`}>
                  {track.confidence}%
                </span>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => openSearch(realIndex)}
                  title="Search manually"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  🔍
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => toggleSkip(realIndex)}
                  title={track.skipped ? 'Unskip' : 'Skip'}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  {track.skipped ? '↩' : '✕'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual search panel */}
      {searchingIndex !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={closeSearch}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: '520px',
              maxHeight: '80vh', overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Manual search</h3>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                className="input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                placeholder="Search for a track…"
                autoFocus
              />
              <button className="btn btn-primary" onClick={runSearch} disabled={searching} style={{ whiteSpace: 'nowrap' }}>
                {searching ? '…' : 'Search'}
              </button>
            </div>
            {searchError && <div className="error-message">{searchError}</div>}
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="playlist-list-item"
                    onClick={() => applySearchResult(r)}
                  >
                    <div className="playlist-list-item-info">
                      <div className="playlist-list-item-name">{r.targetTitle}</div>
                      <div className="playlist-list-item-meta">{r.targetArtist}{r.targetAlbum ? ` · ${r.targetAlbum}` : ''}</div>
                    </div>
                    <span className={`confidence-badge ${confidenceClass(r.confidence)}`}>{r.confidence}%</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults.length === 0 && !searching && searchQuery && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No results. Try a different query.</p>
            )}
            <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={closeSearch}>Close</button>
          </div>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={() => onConfirm(tracks)}
        style={{ minWidth: '160px' }}
      >
        Confirm Import ({matched} tracks)
      </button>
    </div>
  );
};
