import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import type { MissingTrack } from '@playlist-lab/shared';

interface GroupedMissingTracks {
  playlistId: number;
  playlistName: string;
  tracks: MissingTrack[];
}

interface RematchResult {
  ratingKey: string;
  title: string;
  artist: string;
  album: string;
  codec: string;
  bitrate: number;
  duration: number;
}

export const MissingTracksPage: FC = () => {
  const { apiClient, refreshMissingTracksCount } = useApp();
  const [missingTracks, setMissingTracks] = useState<MissingTrack[]>([]);
  const [groupedTracks, setGroupedTracks] = useState<GroupedMissingTracks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryingTrackId, setRetryingTrackId] = useState<number | null>(null);
  const [expandedPlaylist, setExpandedPlaylist] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<{ matched: number; remaining: number } | null>(null);

  // Manual rematch state
  const [rematchTrack, setRematchTrack] = useState<MissingTrack | null>(null);
  const [rematchQuery, setRematchQuery] = useState('');
  const [rematchResults, setRematchResults] = useState<RematchResult[]>([]);
  const [isSearchingRematch, setIsSearchingRematch] = useState(false);

  useEffect(() => {
    loadMissingTracks();
  }, []);

  const loadMissingTracks = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getMissingTracks();
      
      // Data is already grouped by playlist
      setGroupedTracks(data.missingTracks);
      
      // Flatten to get all tracks for export
      const allTracks = data.missingTracks.flatMap(group => 
        group.tracks.map(track => ({
          ...track,
          playlistId: group.playlistId,
          playlistName: group.playlistName,
        }))
      );
      setMissingTracks(allTracks);
      
      await refreshMissingTracksCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load missing tracks');
    } finally {
      setIsLoading(false);
    }
  };


  const handleRetryAll = async () => {
    setIsRetrying(true);
    setError(null);
    setRetryResult(null);
    try {
      const result = await apiClient.retryMissingTracks();
      setRetryResult(result);
      await loadMissingTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry matching');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetryPlaylist = async (playlistId: number) => {
    setIsRetrying(true);
    setError(null);
    setRetryResult(null);
    try {
      const result = await apiClient.retryMissingTracks(playlistId);
      setRetryResult(result);
      await loadMissingTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry matching');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRemoveTrack = async (id: number) => {
    setError(null);
    try {
      await apiClient.removeMissingTrack(id);
      await loadMissingTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove track');
    }
  };

  const handleRetryTrack = async (trackId: number) => {
    setRetryingTrackId(trackId);
    setError(null);
    try {
      const result = await apiClient.retryMissingTracks(undefined, [trackId]);
      if (result.matched > 0) {
        setRetryResult({ matched: result.matched, remaining: result.remaining });
      } else {
        setError('Track still not found in your Plex library');
      }
      await loadMissingTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry track');
    } finally {
      setRetryingTrackId(null);
    }
  };

  const handleClearPlaylist = async (playlistId: number) => {
    if (!confirm('Are you sure you want to clear all missing tracks for this playlist?')) {
      return;
    }

    setError(null);
    try {
      await apiClient.clearPlaylistMissingTracks(playlistId);
      await loadMissingTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear tracks');
    }
  };

  const exportToCSV = () => {
    const csv = [
      ['Playlist', 'Title', 'Artist', 'Album', 'Source', 'Added At'],
      ...missingTracks.map(track => [
        `Playlist ${track.playlistId}`,
        track.title,
        track.artist,
        track.album || '',
        track.source,
        new Date(track.addedAt).toLocaleDateString(),
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-tracks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Manual rematch handlers
  const handleOpenRematch = (track: MissingTrack) => {
    setRematchTrack(track);
    // Use only the first artist when multiple are listed (comma/& separated)
    const firstArtist = track.artist.split(/\s*[,&\/]\s*/)[0].trim();
    setRematchQuery(`${firstArtist} ${track.title}`);
    setRematchResults([]);
  };

  const handleCloseRematch = () => {
    setRematchTrack(null);
    setRematchQuery('');
    setRematchResults([]);
  };

  const handleSearchRematch = async () => {
    if (!rematchQuery.trim()) return;
    setIsSearchingRematch(true);
    try {
      const response = await fetch('/api/import/plex/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: rematchQuery }),
      });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setRematchResults(data.tracks || []);
    } catch {
      setRematchResults([]);
    } finally {
      setIsSearchingRematch(false);
    }
  };

  const handleSelectRematch = async (result: RematchResult) => {
    if (!rematchTrack) return;
    setError(null);
    try {
      await apiClient.rematchMissingTrack(rematchTrack.id, result.ratingKey);
      handleCloseRematch();
      await loadMissingTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rematch track');
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title">Missing Tracks</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {missingTracks.length > 0 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={exportToCSV}
                disabled={isRetrying}
              >
                Export CSV
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRetryAll}
                disabled={isRetrying}
              >
                {isRetrying ? 'Retrying...' : 'Retry All'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: '4px',
          color: 'var(--error)',
        }}>
          {error}
        </div>
      )}

      {retryResult && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          border: '1px solid var(--success)',
          borderRadius: '4px',
          color: 'var(--success)',
        }}>
          Found and added {retryResult.matched} tracks. {retryResult.remaining} still missing.
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading missing tracks...
        </div>
      ) : missingTracks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ marginBottom: '0.5rem' }}>No Missing Tracks</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            All imported playlist tracks have been matched to your Plex library.
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {missingTracks.length} track{missingTracks.length !== 1 ? 's' : ''} from {groupedTracks.length} playlist{groupedTracks.length !== 1 ? 's' : ''} couldn't be matched.
            Add the missing music to your Plex library, then click "Retry" to search again.
          </p>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {groupedTracks.map(group => (
              <div key={group.playlistId} className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedPlaylist(expandedPlaylist === group.playlistId ? null : group.playlistId)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {expandedPlaylist === group.playlistId ? '▼' : '▶'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{group.playlistName}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {group.tracks.length} missing track{group.tracks.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => handleRetryPlaylist(group.playlistId)}
                      disabled={isRetrying}
                    >
                      Retry
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleClearPlaylist(group.playlistId)}
                      disabled={isRetrying}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {expandedPlaylist === group.playlistId && (
                  <div style={{ 
                    marginTop: '1rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid var(--border-color)',
                  }}>
                    {group.tracks.map((track, idx) => (
                      <div
                        key={track.id}
                        style={{
                          padding: '0.75rem',
                          borderBottom: idx < group.tracks.length - 1 ? '1px solid var(--border-color)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{track.title}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {track.artist}
                            {track.album && ` • ${track.album}`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {track.source}
                            {track.addedAt ? ` • ${new Date(track.addedAt).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary btn-small"
                            onClick={() => handleRetryTrack(track.id)}
                            disabled={isRetrying || retryingTrackId === track.id}
                            title="Retry matching this track"
                          >
                            {retryingTrackId === track.id ? '...' : 'Retry'}
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleOpenRematch(track)}
                            title="Manually search and match this track"
                          >
                            Match
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleRemoveTrack(track.id)}
                            title="Remove from missing list"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Manual Rematch Modal */}
      {rematchTrack && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={handleCloseRematch}>
          <div style={{
            backgroundColor: 'var(--surface)', borderRadius: '8px', padding: '1.5rem',
            width: '700px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex',
            flexDirection: 'column',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Manual Rematch</h2>
              <button onClick={handleCloseRematch} style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                fontSize: '1.5rem', cursor: 'pointer',
              }}>×</button>
            </div>

            <div style={{
              padding: '0.75rem', backgroundColor: 'rgba(100, 181, 246, 0.1)',
              border: '1px solid rgba(100, 181, 246, 0.3)', borderRadius: '4px', marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Original Track:</div>
              <div>{rematchTrack.artist} - {rematchTrack.title}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={rematchQuery}
                onChange={(e) => setRematchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchRematch()}
                placeholder="Search your Plex library..."
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
              />
              <button className="btn btn-primary" onClick={handleSearchRematch} disabled={isSearchingRematch}>
                {isSearchingRematch ? '...' : 'Search'}
              </button>
            </div>

            {rematchResults.length > 0 ? (
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Title</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Artist</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Album</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '80px' }}>Format</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '90px' }}>Bitrate</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rematchResults.map((result, idx) => (
                      <tr key={idx} style={{
                        borderBottom: idx < rematchResults.length - 1 ? '1px solid var(--border-color)' : 'none',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                      }}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{result.title}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{result.artist || '-'}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{result.album || '-'}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{result.codec || '-'}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{result.bitrate ? `${result.bitrate} kbps` : '-'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button className="btn btn-primary btn-small" onClick={() => handleSelectRematch(result)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isSearchingRematch ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Searching...</div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                Search your Plex library to find a match
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={handleCloseRematch}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
