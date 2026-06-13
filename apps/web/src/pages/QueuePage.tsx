import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import type { MatchedTrack } from '@playlist-lab/shared';
import './QueuePage.css';

interface CompletedImport {
  id: string;
  source: string;
  url?: string;
  playlistName: string;
  completedAt: number;
  matchedCount?: number;
  unmatchedCount?: number;
  matched?: MatchedTrack[];
  unmatched?: MatchedTrack[];
  coverUrl?: string;
}

export const QueuePage: FC = () => {
  const { apiClient, refreshPlaylists, refreshMissingTracksCount } = useApp();
  const [completedImports, setCompletedImports] = useState<CompletedImport[]>([]);
  const [activeQueue, setActiveQueue] = useState<any>(null);
  const [selectedImport, setSelectedImport] = useState<CompletedImport | null>(null);
  const [editableTracks, setEditableTracks] = useState<MatchedTrack[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematchTrack, setRematchTrack] = useState<{ track: MatchedTrack; index: number } | null>(null);
  const [rematchQuery, setRematchQuery] = useState('');
  const [rematchResults, setRematchResults] = useState<any[]>([]);
  const [isSearchingRematch, setIsSearchingRematch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [overwriteCover, setOverwriteCover] = useState(true);

  // Track whether mousedown started on the backdrop
  const backdropMouseDown = useRef(false);

  // ESC key closes the rematch modal
  useEffect(() => {
    if (!rematchTrack) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRematchTrack(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [rematchTrack]);

  // Load completed imports and active queue
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await Promise.all([loadCompletedImports(), loadActiveQueue()]);
      setIsLoading(false);
    };
    
    loadInitialData();
    
    const interval = setInterval(() => {
      loadCompletedImports();
      loadActiveQueue();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadActiveQueue = async () => {
    try {
      const response = await fetch('/api/import/queue', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveQueue(data);
      }
    } catch (err) {
      console.error('[QueuePage] Failed to load active queue:', err);
    }
  };

  const loadCompletedImports = async () => {
    try {
      const response = await fetch('/api/import/queue/completed', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const imports = data.completed || [];
        setCompletedImports(imports);
      }
    } catch (err) {
      console.error('[QueuePage] Failed to load completed imports:', err);
    }
  };

  const handleSelectImport = async (imp: CompletedImport) => {
    // If this import doesn't have full track data yet, load it
    if (!imp.matched || !imp.unmatched) {
      try {
        const response = await fetch(`/api/import/queue/completed/${imp.id}`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          const fullImport = data.import;
          
          // Update the import in the list with full data
          setCompletedImports(prev => prev.map(i => 
            i.id === imp.id ? { ...i, matched: fullImport.matched, unmatched: fullImport.unmatched } : i
          ));
          
          // Set as selected with full data
          setSelectedImport(fullImport);
          setEditableTracks([...fullImport.matched, ...fullImport.unmatched]);
          setPlaylistName(fullImport.playlistName);
          setShowUnmatchedOnly(false);
        }
      } catch (err) {
        console.error('[QueuePage] Failed to load import details:', err);
        setError('Failed to load import details');
      }
    } else {
      // Already has full data
      setSelectedImport(imp);
      setEditableTracks([...imp.matched, ...imp.unmatched]);
      setPlaylistName(imp.playlistName);
      setShowUnmatchedOnly(false);
    }
  };

  const handleDiscardImport = async (importId: string) => {
    if (!confirm('Discard this import? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/import/queue/completed/${importId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      setCompletedImports(prev => prev.filter(i => i.id !== importId));
      
      if (selectedImport?.id === importId) {
        setSelectedImport(null);
        setEditableTracks([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard import');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Cancel this import? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/import/queue/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // Reload queue status
        await loadActiveQueue();
      } else {
        setError('Failed to cancel import');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel import');
    }
  };

  const handleSavePlaylist = async () => {
    if (!selectedImport) return;

    setIsSaving(true);
    setError(null);

    try {
      const matchedTracks = editableTracks.filter(t => t.matched && t.plexRatingKey);
      const unmatchedTracks = editableTracks.filter(t => !t.matched || !t.plexRatingKey);

      // Use confirmImport endpoint which properly handles cover art, missing tracks, and overwrite
      await apiClient.confirmImport({
        playlistName,
        source: selectedImport.source,
        sourceUrl: selectedImport.url || '',
        tracks: matchedTracks,
        saveMissingTracks: unmatchedTracks.length > 0,
        missingTracks: unmatchedTracks.map(t => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
        })),
        overwriteExisting,
        keepExistingCover: false,
        coverUrl: overwriteCover ? selectedImport.coverUrl : undefined,
      });

      await fetch(`/api/import/queue/completed/${selectedImport.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setCompletedImports(prev => prev.filter(i => i.id !== selectedImport.id));
      setSelectedImport(null);
      setEditableTracks([]);
      
      await refreshPlaylists();
      await refreshMissingTracksCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save playlist');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToMissingTracks = async () => {
    if (!selectedImport) return;

    const matchedTracks = editableTracks.filter(t => t.matched && t.plexRatingKey);
    const unmatchedTracks = editableTracks.filter(t => !t.matched || !t.plexRatingKey);

    if (unmatchedTracks.length === 0) {
      setError('No unmatched tracks to add');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Save unmatched tracks to missing tracks with their original positions
      // The backend will create a Plex playlist with matched tracks if provided
      if (unmatchedTracks.length > 0) {
        const unmatchedWithPositions = unmatchedTracks.map(t => {
          const originalIndex = editableTracks.findIndex(track => track === t);
          return {
            title: t.title,
            artist: t.artist,
            album: t.album,
            position: originalIndex + 1, // 1-based position
          };
        });

        // Pass matched tracks so the backend can create a playlist with them
        const matchedTracksData = matchedTracks.length > 0 ? matchedTracks.map(t => ({
          plexRatingKey: t.plexRatingKey,
          title: t.title,
          artist: t.artist,
        })) : undefined;

        await apiClient.saveMissingTracks({
          playlistName: playlistName,
          source: selectedImport.source,
          sourceUrl: selectedImport.url || '',
          tracks: unmatchedWithPositions,
          matchedTracks: matchedTracksData,
          coverUrl: overwriteCover ? selectedImport.coverUrl : undefined,
          overwriteExisting,
        });
      } else if (matchedTracks.length > 0) {
        // Only matched tracks, create playlist normally
        const trackUris = matchedTracks
          .filter(t => t.plexRatingKey)
          .map(t => `server://playlist-lab-server/com.plexapp.plugins.library/library/metadata/${t.plexRatingKey}`);

        if (trackUris.length > 0) {
          await apiClient.createPlaylist({
            name: playlistName,
            tracks: trackUris,
          });
        }
      }

      await fetch(`/api/import/queue/completed/${selectedImport.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setCompletedImports(prev => prev.filter(i => i.id !== selectedImport.id));
      setSelectedImport(null);
      setEditableTracks([]);
      
      await refreshPlaylists();
      await refreshMissingTracksCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to missing tracks');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryTrack = async (index: number) => {
    const track = editableTracks[index];
    
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/import/plex/retry-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          track: {
            title: track.title,
            artist: track.artist,
            album: track.album,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      const data = await response.json();
      
      if (data.matched && data.plexRatingKey) {
        const updatedTracks = [...editableTracks];
        updatedTracks[index] = {
          ...updatedTracks[index],
          matched: true,
          plexRatingKey: data.plexRatingKey,
          plexTitle: data.plexTitle,
          plexArtist: data.plexArtist,
          plexAlbum: data.plexAlbum,
        };
        setEditableTracks(updatedTracks);
      } else {
        setError('Track still not found in your Plex library');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry track');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenRematch = (track: MatchedTrack, index: number) => {
    setRematchTrack({ track, index });
    // Use only the first artist when multiple are listed (comma/& separated)
    const firstArtist = track.artist.split(/\s*[,&\/]\s*/)[0].trim();
    setRematchQuery(`${firstArtist} ${track.title}`);
    setRematchResults([]);
  };

  const handleSearchRematch = async () => {
    if (!rematchQuery.trim()) return;

    setIsSearchingRematch(true);
    setRematchResults([]); // Clear previous results
    try {
      console.log('[QueuePage] Searching for:', rematchQuery);
      const response = await fetch('/api/import/plex/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: rematchQuery }),
      });

      console.log('[QueuePage] Search response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Search failed' } }));
        console.error('[QueuePage] Search error:', errorData);
        throw new Error(errorData.error?.message || 'Search failed');
      }

      const data = await response.json();
      console.log('[QueuePage] Search results:', data.tracks?.length || 0, 'tracks');
      setRematchResults(data.tracks || []);
    } catch (err) {
      console.error('[QueuePage] Search exception:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setRematchResults([]);
    } finally {
      setIsSearchingRematch(false);
    }
  };

  const handleSelectRematch = (result: any) => {
    if (!rematchTrack) return;

    const { index } = rematchTrack;
    const updatedTracks = [...editableTracks];
    updatedTracks[index] = {
      ...updatedTracks[index],
      matched: true,
      plexRatingKey: result.ratingKey,
      plexTitle: result.title,
      plexArtist: result.artist,
      plexAlbum: result.album,
    };

    setEditableTracks(updatedTracks);
    setRematchTrack(null);
    setRematchResults([]);
  };

  const handleToggleTrack = (index: number) => {
    const updatedTracks = [...editableTracks];
    updatedTracks[index] = {
      ...updatedTracks[index],
      matched: !updatedTracks[index].matched,
    };
    setEditableTracks(updatedTracks);
  };

  const getMatchStats = () => {
    const matched = editableTracks.filter(t => t.matched && t.plexRatingKey).length;
    const unmatched = editableTracks.filter(t => !t.matched || !t.plexRatingKey).length;
    return { matched, unmatched, total: editableTracks.length };
  };

  const getDisplayTracks = () => {
    return showUnmatchedOnly
      ? editableTracks.filter(t => !t.matched || !t.plexRatingKey)
      : editableTracks;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <h1>Import Queue</h1>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading queue...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!activeQueue && completedImports.length === 0) {
    return (
      <div className="page-container">
        <h1>Import Queue</h1>
        <div className="queue-empty">
          <h2>No Imports in Queue</h2>
          <p>Imports will appear here when they are processing or completed.</p>
          <p>Go to the <a href="/import">Import page</a> to start importing playlists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Import Queue</h1>
      
      <div className="queue-layout">
        {/* Left Panel - Import List */}
        <div className="queue-list-panel">
          {/* Active Queue Section */}
          {activeQueue && (activeQueue.processing || activeQueue.queued.length > 0) && (
            <div className="queue-section">
              <h2>Active</h2>
              
              {activeQueue.processing && (
                <div className="queue-list-item processing">
                  <div className="queue-item-header">
                    <div className="queue-item-status">
                      <span className="status-badge status-processing">⟳ Processing</span>
                    </div>
                    <button
                      className="btn-cancel-small"
                      onClick={() => handleCancelJob(activeQueue.processing.id)}
                      title="Cancel import"
                    >
                      ×
                    </button>
                  </div>
                  <div className="queue-item-name">{activeQueue.processing.playlistName || 'Importing...'}</div>
                  <div className="queue-item-source">{activeQueue.processing.source}</div>
                </div>
              )}

              {activeQueue.queued.map((job: any, index: number) => (
                <div key={job.id} className="queue-list-item queued">
                  <div className="queue-item-header">
                    <div className="queue-item-status">
                      <span className="status-badge status-queued">#{index + 1} Queued</span>
                    </div>
                    <button
                      className="btn-cancel-small"
                      onClick={() => handleCancelJob(job.id)}
                      title="Cancel import"
                    >
                      ×
                    </button>
                  </div>
                  <div className="queue-item-name">{job.playlistName || 'Waiting...'}</div>
                  <div className="queue-item-source">{job.source}</div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Imports Section */}
          {completedImports.length > 0 && (
            <div className="queue-section">
              <h2>Completed</h2>
              {completedImports.map((imp) => {
                // Use counts if available (fast), otherwise calculate from arrays (slower)
                const matched = imp.matchedCount ?? imp.matched?.length ?? 0;
                const unmatched = imp.unmatchedCount ?? imp.unmatched?.length ?? 0;
                const total = matched + unmatched;

                return (
                  <div
                    key={imp.id}
                    className={`queue-list-item ${selectedImport?.id === imp.id ? 'active' : ''}`}
                    onClick={() => handleSelectImport(imp)}
                  >
                    {imp.coverUrl && (
                      <div className="queue-item-thumb-container">
                        <img src={imp.coverUrl} alt="" className="queue-item-thumb" />
                      </div>
                    )}
                    <div className="queue-item-info">
                      <div className="queue-item-name">{imp.playlistName}</div>
                      <div className="queue-item-meta">
                        <span className="queue-item-source">{imp.source}</span>
                        <span className="queue-item-stats">{matched}/{total} matched</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel - Import Details */}
        <div className="queue-details-panel">
          {!selectedImport ? (
            <p>Select a completed import to review and save</p>
          ) : (
            <>
              {/* Import Header */}
              <div className="queue-import-header">
                <div className="queue-header-cover-section">
                  {selectedImport.coverUrl && (
                    <img src={selectedImport.coverUrl} alt="" className="queue-header-cover" />
                  )}
                </div>

                <div className="queue-header-info-section">
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="queue-playlist-name-input"
                    placeholder="Playlist name"
                  />
                  <div className="queue-header-meta">
                    <span>{selectedImport.source}</span>
                    <span>{formatDate(selectedImport.completedAt)}</span>
                  </div>
                  <div className="queue-header-stats">
                    <span className="stat-matched">{getMatchStats().matched} matched</span>
                    <span className="stat-unmatched">{getMatchStats().unmatched} unmatched</span>
                    <span className="stat-total">{getMatchStats().total} total</span>
                  </div>

                  <div className="queue-overwrite-options" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                      />
                      Overwrite existing playlist
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={overwriteCover}
                        onChange={(e) => setOverwriteCover(e.target.checked)}
                      />
                      Overwrite cover art
                    </label>
                  </div>

                  <div className="queue-header-actions">
                    <button
                      className="btn btn-success"
                      onClick={handleSavePlaylist}
                      disabled={isSaving || getMatchStats().matched === 0}
                    >
                      {isSaving ? 'Saving...' : `Save Playlist (${getMatchStats().matched})`}
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={handleAddToMissingTracks}
                      disabled={isSaving || getMatchStats().unmatched === 0}
                    >
                      Add to Missing ({getMatchStats().unmatched})
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDiscardImport(selectedImport.id)}
                      disabled={isSaving}
                    >
                      Discard
                    </button>
                  </div>

                  <label className="queue-checkbox-label">
                    <input
                      type="checkbox"
                      checked={showUnmatchedOnly}
                      onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
                    />
                    Show unmatched only
                  </label>
                </div>
              </div>

              {error && (
                <div className="queue-error-banner">
                  {error}
                  <button onClick={() => setError(null)}>×</button>
                </div>
              )}

              {/* Tracks Table */}
              <div className="queue-tracks-table-container">
                <table className="queue-tracks-table">
                  <thead>
                    <tr>
                      <th className="col-check"></th>
                      <th className="col-number">#</th>
                      <th className="col-original">Original Track</th>
                      <th className="col-matched">Matched Track</th>
                      <th className="col-codec">Codec</th>
                      <th className="col-bitrate">Bitrate</th>
                      <th className="col-status">Status</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDisplayTracks().map((track, displayIndex) => {
                      const actualIndex = showUnmatchedOnly
                        ? editableTracks.findIndex(t => t === track)
                        : displayIndex;

                      return (
                        <tr key={actualIndex} className={track.matched ? 'matched' : 'unmatched'}>
                          <td className="col-check">
                            <input
                              type="checkbox"
                              checked={track.matched && !!track.plexRatingKey}
                              onChange={() => handleToggleTrack(actualIndex)}
                            />
                          </td>
                          <td className="col-number">{actualIndex + 1}</td>
                          <td className="col-original">
                            <div className="track-info-title">{track.title}</div>
                            <div className="track-info-meta">
                              {track.artist}
                              {track.album && ` • ${track.album}`}
                            </div>
                          </td>
                          <td className="col-matched">
                            {track.matched && track.plexRatingKey ? (
                              <>
                                <div className="track-info-title">{track.plexTitle || track.title}</div>
                                <div className="track-info-meta">
                                  {track.plexArtist || track.artist}
                                  {(track.plexAlbum || track.album) && ` • ${track.plexAlbum || track.album}`}
                                </div>
                              </>
                            ) : (
                              <div className="track-info-empty">—</div>
                            )}
                          </td>
                          <td className="col-codec">
                            {track.matched && track.plexRatingKey && track.plexCodec ? (
                              <span className="codec-badge">{track.plexCodec}</span>
                            ) : (
                              <span className="track-info-empty">—</span>
                            )}
                          </td>
                          <td className="col-bitrate">
                            {track.matched && track.plexRatingKey && track.plexBitrate ? (
                              <span className="bitrate-value">{track.plexBitrate} kbps</span>
                            ) : (
                              <span className="track-info-empty">—</span>
                            )}
                          </td>
                          <td className="col-status">
                            {track.matched && track.plexRatingKey ? (
                              <span className="status-badge status-matched">✓ Matched</span>
                            ) : (
                              <span className="status-badge status-unmatched">✗ Unmatched</span>
                            )}
                          </td>
                          <td className="col-actions">
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => handleRetryTrack(actualIndex)}
                              disabled={isSaving}
                              title="Retry automatic matching"
                            >
                              Retry
                            </button>
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => handleOpenRematch(track, actualIndex)}
                              title="Manual search"
                            >
                              Search
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rematch Modal */}
      {rematchTrack && (
        <div className="modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) backdropMouseDown.current = true; }}
          onMouseUp={(e) => { if (e.target === e.currentTarget && backdropMouseDown.current) setRematchTrack(null); backdropMouseDown.current = false; }}
        >
          <div className="modal-content" onMouseDown={(e) => { backdropMouseDown.current = false; e.stopPropagation(); }}>
            <div className="modal-header">
              <h2>Search for Track</h2>
              <button className="modal-close" onClick={() => setRematchTrack(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="rematch-original">
                <strong>Original:</strong> {rematchTrack.track.artist} - {rematchTrack.track.title}
              </div>
              <div className="rematch-search">
                <input
                  type="text"
                  value={rematchQuery}
                  onChange={(e) => setRematchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchRematch()}
                  placeholder="Search Plex library..."
                  className="rematch-input"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSearchRematch}
                  disabled={isSearchingRematch}
                >
                  {isSearchingRematch ? 'Searching...' : 'Search'}
                </button>
              </div>
              <div className="rematch-results">
                {rematchResults.length > 0 && (
                  <table className="rematch-results-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Album</th>
                        <th>Codec</th>
                        <th>Bitrate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rematchResults.map((result, idx) => (
                        <tr key={idx} onClick={() => handleSelectRematch(result)} className="rematch-result-row">
                          <td className="rematch-result-title">{result.title}</td>
                          <td className="rematch-result-artist">{result.artist}</td>
                          <td className="rematch-result-album">{result.album || '—'}</td>
                          <td className="rematch-result-codec">
                            <span className="rematch-codec">{result.codec || '—'}</span>
                          </td>
                          <td className="rematch-result-bitrate">
                            {result.bitrate > 0 ? `${result.bitrate} kbps` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {rematchResults.length === 0 && !isSearchingRematch && (
                  <div className="rematch-no-results">No results found</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
