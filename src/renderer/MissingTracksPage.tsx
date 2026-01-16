/**
 * Missing Tracks Page - View and retry matching missing tracks from imports
 */

import { useState, useEffect, useCallback } from 'react';

interface MissingTrack {
  title: string;
  artist: string;
  album?: string;
  position: number;
  afterTrackKey?: string;
  addedAt: number;
  source: string;
}

interface MissingPlaylistEntry {
  playlistId: string;
  playlistName: string;
  tracks: MissingTrack[];
}

interface MissingTracksPageProps {
  serverUrl: string;
  onBack: () => void;
  onCountChange?: (count: number) => void;
}

export default function MissingTracksPage({ serverUrl, onBack, onCountChange }: MissingTracksPageProps) {
  const [missingEntries, setMissingEntries] = useState<MissingPlaylistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{ current: number; total: number; track: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);

  useEffect(() => {
    loadMissingTracks();
  }, []);

  const loadMissingTracks = async () => {
    setIsLoading(true);
    try {
      const entries = await window.api.getMissingTracks();
      setMissingEntries(entries);
      // Notify parent of count change
      const total = entries.reduce((sum, e) => sum + e.tracks.length, 0);
      onCountChange?.(total);
    } catch (error: any) {
      setStatusMessage(`Error loading missing tracks: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const retryAllForPlaylist = useCallback(async (entry: MissingPlaylistEntry) => {
    setIsRetrying(true);
    setStatusMessage('');
    let foundCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < entry.tracks.length; i++) {
      const track = entry.tracks[i];
      setRetryProgress({ current: i + 1, total: entry.tracks.length, track: `${track.artist} - ${track.title}` });

      try {
        // Search for the track
        const results = await window.api.searchTrack({ 
          serverUrl, 
          query: `${track.artist} ${track.title}` 
        });

        if (results.length > 0) {
          // Find best match
          const match = results.find((r: any) => {
            const titleMatch = r.title?.toLowerCase().includes(track.title.toLowerCase()) ||
                              track.title.toLowerCase().includes(r.title?.toLowerCase());
            const artistMatch = r.grandparentTitle?.toLowerCase().includes(track.artist.toLowerCase()) ||
                               track.artist.toLowerCase().includes(r.grandparentTitle?.toLowerCase());
            return titleMatch && artistMatch;
          }) || results[0];

          if (match) {
            // Insert track at correct position
            const result = await window.api.insertTrackAtPosition({
              serverUrl,
              playlistId: entry.playlistId,
              trackKey: match.ratingKey,
              afterTrackKey: track.afterTrackKey,
            });

            if (result.success) {
              // Remove from missing tracks
              await window.api.removeMissingTrack({
                playlistId: entry.playlistId,
                title: track.title,
                artist: track.artist,
              });
              foundCount++;
            } else {
              notFoundCount++;
            }
          } else {
            notFoundCount++;
          }
        } else {
          notFoundCount++;
        }
      } catch (error) {
        notFoundCount++;
      }
    }

    setRetryProgress(null);
    setIsRetrying(false);
    await loadMissingTracks();
    setStatusMessage(`Found and added ${foundCount} tracks. ${notFoundCount} still missing.`);
  }, [serverUrl]);

  const retryAll = useCallback(async () => {
    for (const entry of missingEntries) {
      await retryAllForPlaylist(entry);
    }
  }, [missingEntries, retryAllForPlaylist]);

  const removeSingleTrack = async (playlistId: string, title: string, artist: string) => {
    await window.api.removeMissingTrack({ playlistId, title, artist });
    await loadMissingTracks();
  };

  const clearPlaylistMissing = async (playlistId: string) => {
    await window.api.clearMissingTracks({ playlistId });
    await loadMissingTracks();
  };

  const clearAll = async () => {
    if (confirm('Are you sure you want to clear all missing tracks? This cannot be undone.')) {
      await window.api.clearAllMissingTracks();
      await loadMissingTracks();
    }
  };

  const totalMissing = missingEntries.reduce((sum, e) => sum + e.tracks.length, 0);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <h1>Missing Tracks</h1>
        <div style={{ flex: 1 }} />
        {totalMissing > 0 && !isRetrying && (
          <>
            <button className="btn btn-primary" onClick={retryAll}>
              Retry All ({totalMissing})
            </button>
            <button className="btn btn-secondary" onClick={clearAll} style={{ marginLeft: '8px' }}>
              Clear All
            </button>
          </>
        )}
      </div>

      {statusMessage && (
        <div className="status-message" style={{ margin: '16px 0', padding: '12px', background: 'rgba(88, 166, 255, 0.1)', borderRadius: '6px', color: '#58a6ff' }}>
          {statusMessage}
        </div>
      )}

      {retryProgress && (
        <div className="retry-progress" style={{ margin: '16px 0', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ marginBottom: '8px', color: '#58a6ff' }}>
            Searching... ({retryProgress.current}/{retryProgress.total})
          </div>
          <div style={{ fontSize: '13px', color: '#a0a0a0' }}>{retryProgress.track}</div>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">Loading missing tracks...</div>
      ) : totalMissing === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px', color: '#a0a0a0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <h3 style={{ color: '#e6edf3', marginBottom: '8px' }}>No Missing Tracks</h3>
          <p>All imported playlist tracks have been matched to your Plex library.</p>
        </div>
      ) : (
        <div className="missing-tracks-list">
          <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
            {totalMissing} track{totalMissing !== 1 ? 's' : ''} from {missingEntries.length} playlist{missingEntries.length !== 1 ? 's' : ''} couldn't be matched.
            Add the missing music to your Plex library, then click "Retry" to add them to the playlists.
          </p>

          {missingEntries.map(entry => (
            <div key={entry.playlistId} className="missing-playlist-entry" style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '8px', 
              marginBottom: '12px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div 
                className="missing-playlist-header"
                onClick={() => setExpandedPlaylist(expandedPlaylist === entry.playlistId ? null : entry.playlistId)}
                style={{ 
                  padding: '16px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ color: '#666', fontSize: '12px' }}>
                  {expandedPlaylist === entry.playlistId ? '▼' : '▶'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#e6edf3' }}>{entry.playlistName}</div>
                  <div style={{ fontSize: '13px', color: '#a0a0a0' }}>
                    {entry.tracks.length} missing track{entry.tracks.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button 
                  className="btn btn-primary btn-small"
                  onClick={(e) => { e.stopPropagation(); retryAllForPlaylist(entry); }}
                  disabled={isRetrying}
                >
                  Retry
                </button>
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={(e) => { e.stopPropagation(); clearPlaylistMissing(entry.playlistId); }}
                  disabled={isRetrying}
                >
                  Clear
                </button>
              </div>

              {expandedPlaylist === entry.playlistId && (
                <div className="missing-tracks-detail" style={{ 
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {entry.tracks.map((track, idx) => (
                    <div 
                      key={`${track.title}-${track.artist}-${idx}`}
                      className="missing-track-row"
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderBottom: idx < entry.tracks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                    >
                      <div style={{ 
                        width: '32px', 
                        textAlign: 'center', 
                        color: '#666',
                        fontSize: '12px'
                      }}>
                        #{track.position + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#e6edf3' }}>{track.title}</div>
                        <div style={{ fontSize: '13px', color: '#a0a0a0' }}>{track.artist}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {formatDate(track.addedAt)}
                      </div>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => removeSingleTrack(entry.playlistId, track.title, track.artist)}
                        title="Remove from missing list"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
