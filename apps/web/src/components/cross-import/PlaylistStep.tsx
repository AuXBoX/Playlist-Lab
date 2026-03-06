import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { SourceInfo, PlaylistInfo } from '../../pages/CrossImportPage';
import { formatDuration } from './types';

interface TrackInfo {
  title: string;
  artist: string;
  album?: string;
}

interface Props {
  source: SourceInfo;
  onPlaylistSelected: (playlist: PlaylistInfo, urlOrId: string) => void;
}

const URL_PATTERN = /^https?:\/\//i;

function getSearchPlaceholder(sourceId: string): string {
  const base = sourceId.split(':')[0];
  switch (base) {
    case 'spotify': return 'Search playlists or paste a Spotify URL…';
    case 'deezer': return 'Paste a Deezer playlist URL…';
    case 'youtube': return 'Search playlists or paste a YouTube URL…';
    case 'youtube-plain': return 'Search playlists or paste a YouTube URL…';
    case 'apple': return 'Paste an Apple Music URL…';
    case 'amazon': return 'Paste an Amazon Music URL…';
    case 'tidal': return 'Paste a Tidal playlist URL…';
    case 'qobuz': return 'Paste a Qobuz playlist URL…';
    case 'listenbrainz': return 'Enter your ListenBrainz username…';
    default: return 'Search playlists or paste a URL…';
  }
}

// Sources that support server-side playlist search
const SEARCHABLE_SOURCES = ['spotify', 'youtube', 'youtube-plain'];

// ---------------------------------------------------------------------------
// Preview Modal
// ---------------------------------------------------------------------------
interface PreviewModalProps {
  sourceId: string;
  playlist: PlaylistInfo;
  urlOrId: string;
  onSelect: () => void;
  onClose: () => void;
}

const PreviewModal: FC<PreviewModalProps> = ({ sourceId, playlist, urlOrId, onSelect, onClose }) => {
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const res = await fetch(
          `/api/cross-import/sources/${encodeURIComponent(sourceId)}/tracks?urlOrId=${encodeURIComponent(urlOrId)}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as any;
          throw new Error(data.error || `Failed to load tracks (${res.status})`);
        }
        const data = await res.json();
        setTracks(data.tracks || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load tracks');
      } finally {
        setLoading(false);
      }
    };
    fetchTracks();
  }, [sourceId, urlOrId]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '560px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {playlist.coverUrl && (
            <img src={playlist.coverUrl} alt={playlist.name}
              style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {playlist.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {playlist.trackCount} tracks{playlist.durationMs ? ` · ${formatDuration(playlist.durationMs)}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.25rem', padding: '0.25rem', lineHeight: 1 }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Track list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {loading && (
            <div className="loading-container" style={{ padding: '2rem' }}>
              <div className="loading-spinner" />
              <span className="loading-text">Loading tracks…</span>
            </div>
          )}
          {error && (
            <div className="error-message" style={{ margin: '1rem' }}>{error}</div>
          )}
          {!loading && !error && tracks.map((track, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.5rem 1.25rem',
              borderBottom: i < tracks.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ width: '1.5rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.title}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.artist}{track.album ? ` · ${track.album}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
          padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSelect}>Import this playlist</button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PlaylistStep
// ---------------------------------------------------------------------------
export const PlaylistStep: FC<Props> = ({ source, onPlaylistSelected }) => {
  const [allPlaylists, setAllPlaylists] = useState<PlaylistInfo[]>([]);
  const [searchResults, setSearchResults] = useState<PlaylistInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [preview, setPreview] = useState<PlaylistInfo | null>(null);
  const [previewModal, setPreviewModal] = useState<{ playlist: PlaylistInfo; urlOrId: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourceBase = source.id.split(':')[0];
  const isPlex = source.type === 'plex-server' || source.type === 'plex-home-user';
  const supportsListing = isPlex || (source.connected && ['spotify', 'youtube'].includes(sourceBase));
  const supportsSearch = SEARCHABLE_SOURCES.includes(sourceBase);
  const isUrl = URL_PATTERN.test(query.trim());

  useEffect(() => {
    if (supportsListing) {
      fetchPlaylists();
    }
  }, [source.id]);

  const fetchPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cross-import/sources/${encodeURIComponent(source.id)}/playlists`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        throw new Error(data.error || `Failed to load playlists (${res.status})`);
      }
      const data = await res.json();
      setAllPlaylists(data.playlists || []);
    } catch (err: any) {
      // For YouTube, don't show listing errors — search/URL paste still works
      if (['youtube', 'youtube-plain'].includes(sourceBase)) {
        setAllPlaylists([]);
      } else {
        setError(err.message || 'Failed to load playlists');
      }
    } finally {
      setLoading(false);
    }
  };

  const searchSource = async (q: string) => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cross-import/sources/${encodeURIComponent(source.id)}/search?q=${encodeURIComponent(q)}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setSearchResults(data.playlists || []);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  const handleFetchUrl = async (url: string) => {
    setFetchingPreview(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/cross-import/sources/${encodeURIComponent(source.id)}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ urlOrId: url.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        throw new Error(data.error?.message || data.error || `Could not fetch playlist (${res.status})`);
      }
      const data = await res.json();
      setPreview(data.playlist);
    } catch (err: any) {
      setError(err.message || 'Could not fetch playlist. Check the URL and try again.');
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPreview(null);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (URL_PATTERN.test(value.trim())) {
      debounceRef.current = setTimeout(() => handleFetchUrl(value.trim()), 300);
      setSearchResults(null);
    } else if (value.trim() && supportsSearch) {
      debounceRef.current = setTimeout(() => searchSource(value.trim()), 400);
    } else {
      setSearchResults(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (isUrl) {
        handleFetchUrl(query.trim());
      } else if (supportsSearch) {
        searchSource(query.trim());
      }
    }
  };

  const displayList = searchResults !== null
    ? searchResults
    : supportsListing
      ? allPlaylists
      : [];

  const isLoadingList = loading || searching;
  const showEmptySearch = !isLoadingList && searchResults !== null && searchResults.length === 0;
  const showEmptyAll = !isLoadingList && searchResults === null && supportsListing && !query.trim() && allPlaylists.length === 0;

  return (
    <div>
      <h2 className="step-section-title">Choose a playlist</h2>

      {/* Universal search / URL bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted, #666)', fontSize: '1rem', pointerEvents: 'none',
          }}>
            {isUrl ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            )}
          </span>
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.25rem', paddingRight: (fetchingPreview || searching) ? '2.5rem' : undefined }}
            placeholder={getSearchPlaceholder(source.id)}
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {(fetchingPreview || searching) && (
            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
              <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            </span>
          )}
        </div>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* URL preview result */}
      {preview && (
        <div className="playlist-list-item" style={{ marginBottom: '1.25rem', cursor: 'default', background: 'var(--bg-secondary)' }}>
          {preview.coverUrl && (
            <img
              src={preview.coverUrl}
              alt={preview.name}
              style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div className="playlist-list-item-info">
            <div className="playlist-list-item-name">{preview.name}</div>
            <div className="playlist-list-item-meta">
              {preview.trackCount} tracks
              {preview.durationMs ? ` · ${formatDuration(preview.durationMs)}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => setPreviewModal({ playlist: preview, urlOrId: query.trim() })}
            >
              Preview
            </button>
            <button className="btn btn-primary btn-small" onClick={() => onPlaylistSelected(preview, query.trim())}>
              Use this
            </button>
          </div>
        </div>
      )}

      {/* Loading spinner for list */}
      {isLoadingList && (
        <div className="loading-container">
          <div className="loading-spinner" />
          <span className="loading-text">{searching ? 'Searching…' : 'Loading playlists…'}</span>
        </div>
      )}

      {/* Playlist list */}
      {!isLoadingList && displayList.length > 0 && (
        <div className="playlist-list">
          {displayList.map((pl, i) => (
            <div key={pl.id} className="playlist-list-item" style={{ cursor: 'default' }}>
              {pl.coverUrl ? (
                <img
                  src={pl.coverUrl}
                  alt={pl.name}
                  style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div className="playlist-list-item-index">{i + 1}</div>
              )}
              <div
                className="playlist-list-item-info"
                style={{ cursor: 'pointer' }}
                onClick={() => onPlaylistSelected(pl, pl.id)}
              >
                <div className="playlist-list-item-name">{pl.name}</div>
                <div className="playlist-list-item-meta">
                  {pl.trackCount} {pl.trackCount === 1 ? 'track' : 'tracks'}
                  {pl.durationMs ? ` · ${formatDuration(pl.durationMs)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={e => { e.stopPropagation(); setPreviewModal({ playlist: pl, urlOrId: pl.id }); }}
                >
                  Preview
                </button>
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => onPlaylistSelected(pl, pl.id)}
                >
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty states */}
      {showEmptySearch && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div className="empty-state-title">No results for "{query}"</div>
          <div className="empty-state-description">Try a different name or paste a playlist URL</div>
        </div>
      )}

      {showEmptyAll && (
        <div className="empty-state">
          <div className="empty-state-title">No playlists found</div>
          <div className="empty-state-description">
            {supportsSearch
              ? 'Try searching by name or paste a playlist URL above'
              : 'Paste a playlist URL above to import it directly'}
          </div>
        </div>
      )}

      {/* Hint for URL-only sources */}
      {!supportsListing && !supportsSearch && !preview && !error && !fetchingPreview && (
        <div className="empty-state" style={{ marginTop: '0.5rem' }}>
          <div className="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div className="empty-state-title">Paste a playlist URL</div>
          <div className="empty-state-description">
            Copy the playlist link from {source.name} and paste it above
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewModal && (
        <PreviewModal
          sourceId={source.id}
          playlist={previewModal.playlist}
          urlOrId={previewModal.urlOrId}
          onSelect={() => {
            onPlaylistSelected(previewModal.playlist, previewModal.urlOrId);
            setPreviewModal(null);
          }}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
};
