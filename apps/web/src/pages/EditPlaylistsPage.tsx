import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './EditPlaylistsPage.css';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  duration: number;
  composite?: string;
}

interface Track {
  id?: string;
  ratingKey: string;
  playlistItemID?: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  codec?: string;
  bitrate?: number;
}

export function EditPlaylistsPage() {
  const { apiClient, server } = useApp();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [searchArtist, setSearchArtist] = useState('');
  const [searchTrack, setSearchTrack] = useState('');
  const [searchAlbum, setSearchAlbum] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElement] = useState(() => new Audio());
  
  // Replace track state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [trackToReplace, setTrackToReplace] = useState<Track | null>(null);
  const [replaceSearchQuery, setReplaceSearchQuery] = useState('');
  const [replaceSearchResults, setReplaceSearchResults] = useState<Track[]>([]);
  const [searchingReplace, setSearchingReplace] = useState(false);

  useEffect(() => {
    loadPlaylists();
    
    // Cleanup audio on unmount
    return () => {
      audioElement.pause();
      audioElement.src = '';
    };
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getPlaylists();
      
      const playlistMap = new Map<string, Playlist>();
      response.playlists.forEach((playlist: Playlist) => {
        if (!playlistMap.has(playlist.id)) {
          playlistMap.set(playlist.id, playlist);
        }
      });
      
      const uniquePlaylists = Array.from(playlistMap.values());
      setPlaylists(uniquePlaylists);
    } catch (err: any) {
      console.error('Failed to load playlists:', err);
      setError(err.message || 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const loadTracks = async (playlistId: string) => {
    try {
      setTracksLoading(true);
      setError(null);
      const response = await apiClient.getPlaylistTracks(playlistId);
      setTracks((response.tracks || []).map((track: any) => ({
        ...track,
        playlistItemID: track.playlistItemID,
      })));
    } catch (err: any) {
      console.error('Failed to load tracks:', err);
      setError(err.message || 'Failed to load tracks');
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    loadTracks(playlist.id);
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!selectedPlaylist) return;
    
    try {
      await apiClient.removeTrackFromPlaylist(selectedPlaylist.id, trackId);
      setTracks(tracks.filter(t => t.ratingKey !== trackId));
    } catch (err: any) {
      console.error('Failed to remove track:', err);
      alert(err.message || 'Failed to remove track');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newTracks = [...tracks];
    const draggedTrack = newTracks[draggedIndex];
    newTracks.splice(draggedIndex, 1);
    newTracks.splice(index, 0, draggedTrack);
    
    setTracks(newTracks);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null || !selectedPlaylist) {
      setDraggedIndex(null);
      return;
    }

    const originalTracks = [...tracks];
    
    // Save the reorder to Plex
    try {
      const draggedTrack = tracks[draggedIndex];
      
      console.log('Drag ended:', {
        draggedIndex,
        draggedTrack: {
          title: draggedTrack.title,
          playlistItemID: draggedTrack.playlistItemID
        }
      });
      
      if (!draggedTrack.playlistItemID) {
        console.error('Dragged track has no playlistItemID');
        setDraggedIndex(null);
        return;
      }

      // Find the track that should come before the dragged track
      const afterIndex = draggedIndex - 1;
      
      // If moving to first position, use '0', otherwise use the previous track's playlistItemID
      const afterTrackId = afterIndex < 0 ? '0' : tracks[afterIndex].playlistItemID?.toString() || '0';
      
      console.log('Moving track:', {
        playlistId: selectedPlaylist.id,
        trackId: draggedTrack.playlistItemID,
        afterTrackId
      });
      
      const response = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks/${draggedTrack.playlistItemID}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afterId: afterTrackId }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to reorder tracks - Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to reorder tracks: ${response.status} ${response.statusText}`);
      }
      
      console.log('Track moved successfully');
    } catch (err: any) {
      console.error('Failed to reorder tracks:', err);
      alert(`Failed to reorder tracks: ${err.message}`);
      // Restore original order
      setTracks(originalTracks);
    }
    
    setDraggedIndex(null);
  };

  const handlePlayTrack = (track: Track) => {
    if (!server) return;

    // If clicking the same track that's playing, pause it
    if (currentlyPlaying === track.ratingKey) {
      audioElement.pause();
      setCurrentlyPlaying(null);
      return;
    }

    // Stop current track if playing
    if (currentlyPlaying) {
      audioElement.pause();
    }

    // Get the audio stream URL from Plex
    const streamUrl = `/api/proxy/audio?ratingKey=${track.ratingKey}`;
    
    audioElement.src = streamUrl;
    audioElement.play().catch(err => {
      console.error('Failed to play track:', err);
      alert('Failed to play track');
    });
    
    setCurrentlyPlaying(track.ratingKey);

    // Handle when track ends
    audioElement.onended = () => {
      setCurrentlyPlaying(null);
    };
  };

  // Resize image to Plex-compatible dimensions
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Set canvas size and draw image
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to resize image'));
            }
          },
          'image/jpeg',
          0.9
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    try {
      setUploadingCover(true);
      
      // Resize image to Plex-compatible dimensions (1000x1000 max)
      const resizedBlob = await resizeImage(file, 1000, 1000);
      
      // Create FormData with resized image
      const formData = new FormData();
      formData.append('cover', resizedBlob, file.name);

      // Upload to server
      const response = await fetch(`/api/playlists/${selectedPlaylist.id}/cover`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to upload cover' }));
        throw new Error(error.message || 'Failed to upload cover');
      }

      // Refresh playlists to get updated cover
      await loadPlaylists();
      if (selectedPlaylist) {
        await loadTracks(selectedPlaylist.id);
      }
      
      alert('Cover uploaded successfully!');
    } catch (err: any) {
      console.error('Failed to upload cover:', err);
      alert(err.message || 'Failed to upload cover');
    } finally {
      setUploadingCover(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleSearchTracks = async () => {
    // At least one field must be filled
    if (!searchArtist.trim() && !searchTrack.trim() && !searchAlbum.trim()) {
      alert('Please enter at least one search term');
      return;
    }

    try {
      setSearching(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (searchArtist.trim()) params.append('artist', searchArtist.trim());
      if (searchTrack.trim()) params.append('track', searchTrack.trim());
      if (searchAlbum.trim()) params.append('album', searchAlbum.trim());
      
      const response = await fetch(`/api/search?${params.toString()}`);
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      const results = data.results || [];
      
      setSearchResults(results.map((item: any) => ({
        id: item.ratingKey,
        ratingKey: item.ratingKey,
        title: item.title,
        artist: item.grandparentTitle || 'Unknown Artist',
        album: item.parentTitle || 'Unknown Album',
        duration: item.duration || 0,
        codec: item.Media?.[0]?.audioCodec || 'N/A',
        bitrate: item.Media?.[0]?.bitrate || 0,
      })));
    } catch (err) {
      console.error('Search failed:', err);
      alert('Failed to search tracks');
    } finally {
      setSearching(false);
    }
  };

  const handleToggleTrack = (trackId: string) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedTracks(newSelected);
  };

  const handleAddSelectedTracks = async () => {
    if (!selectedPlaylist || selectedTracks.size === 0) return;

    try {
      const trackIds = Array.from(selectedTracks);
      const trackUris = trackIds.map(id => `server://${server?.clientId}/com.plexapp.plugins.library/library/metadata/${id}`);
      
      const response = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUris }),
      });

      if (!response.ok) {
        throw new Error('Failed to add tracks');
      }

      // Refresh tracks
      await loadTracks(selectedPlaylist.id);
      
      // Reset and close
      setSelectedTracks(new Set());
      setSearchArtist('');
      setSearchTrack('');
      setSearchAlbum('');
      setSearchResults([]);
      setShowAddTracksModal(false);
      
      alert(`Added ${trackIds.length} track(s) to playlist`);
    } catch (err) {
      console.error('Failed to add tracks:', err);
      alert('Failed to add tracks to playlist');
    }
  };

  const handleOpenReplaceModal = (track: Track) => {
    setTrackToReplace(track);
    setReplaceSearchQuery(`${track.artist} ${track.title}`);
    setReplaceSearchResults([]);
    setShowReplaceModal(true);
  };

  const handleCloseReplaceModal = () => {
    setShowReplaceModal(false);
    setTrackToReplace(null);
    setReplaceSearchQuery('');
    setReplaceSearchResults([]);
  };

  const handleSearchReplace = async () => {
    if (!replaceSearchQuery.trim()) return;

    setSearchingReplace(true);
    try {
      const response = await fetch('/api/import/plex/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: replaceSearchQuery }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      const results = data.tracks || [];

      setReplaceSearchResults(results.map((item: any) => ({
        id: item.ratingKey,
        ratingKey: item.ratingKey,
        title: item.title,
        artist: item.grandparentTitle || 'Unknown Artist',
        album: item.parentTitle || 'Unknown Album',
        duration: item.duration || 0,
        codec: item.Media?.[0]?.audioCodec || 'N/A',
        bitrate: item.Media?.[0]?.bitrate || 0,
      })));
    } catch (err) {
      console.error('Search failed:', err);
      alert('Failed to search tracks');
    } finally {
      setSearchingReplace(false);
    }
  };

  const handleReplaceTrack = async (newTrack: Track) => {
    if (!selectedPlaylist || !trackToReplace) return;

    try {
      // Remove old track
      await apiClient.removeTrackFromPlaylist(selectedPlaylist.id, trackToReplace.ratingKey);

      // Add new track
      const trackUri = `server://${server?.clientId}/com.plexapp.plugins.library/library/metadata/${newTrack.ratingKey}`;
      
      const response = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUris: [trackUri] }),
      });

      if (!response.ok) {
        throw new Error('Failed to add replacement track');
      }

      // Refresh tracks
      await loadTracks(selectedPlaylist.id);
      handleCloseReplaceModal();
      alert('Track replaced successfully');
    } catch (err) {
      console.error('Failed to replace track:', err);
      alert('Failed to replace track');
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} mins`;
  };

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return 'N/A';
    return `${Math.round(bitrate)} kbps`;
  };

  const getCoverUrl = (composite?: string) => {
    if (!composite || !server) {
      return null;
    }
    // Use the API proxy endpoint to avoid CORS issues
    const fullPlexUrl = `${server.url}${composite}`;
    return `/api/proxy/image?url=${encodeURIComponent(fullPlexUrl)}`;
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>Edit Playlists</h1>
        <p>Loading playlists...</p>
      </div>
    );
  }

  if (error && playlists.length === 0) {
    return (
      <div className="page-container">
        <h1>Edit Playlists</h1>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Edit Playlists</h1>
      <div className="edit-playlists-layout">
        <div className="playlists-panel">
          <h2>Your Playlists</h2>
          <div className="playlists-list">
            {playlists.map(playlist => (
              <div
                key={`playlist-${playlist.id}-${playlist.name}`}
                className={`playlist-item ${selectedPlaylist?.id === playlist.id ? 'active' : ''}`}
                onClick={() => handlePlaylistSelect(playlist)}
              >
                {playlist.composite && (
                  <div className="playlist-thumb-container">
                    <img
                      src={getCoverUrl(playlist.composite) || ''}
                      alt=""
                      className="playlist-thumb"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="playlist-info">
                  <div className="playlist-name">{playlist.name}</div>
                  <div className="playlist-meta">
                    {playlist.trackCount || 0} tracks • {formatDuration(playlist.duration || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tracks-panel">
          {!selectedPlaylist ? (
            <p>Select a playlist to view and edit tracks</p>
          ) : (
            <>
              <div className="playlist-header">
                <div className="playlist-cover-section">
                  <div className="playlist-cover-container">
                    {selectedPlaylist.composite ? (
                      <img
                        src={getCoverUrl(selectedPlaylist.composite) || ''}
                        alt={selectedPlaylist.name}
                        className="playlist-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const placeholder = e.currentTarget.parentElement?.querySelector('.playlist-cover-placeholder');
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div className="playlist-cover-placeholder" style={{ display: selectedPlaylist.composite ? 'none' : 'flex' }}>
                      No Cover
                    </div>
                  </div>
                  <label className="upload-cover-btn" title="Change cover">
                    {uploadingCover ? '⏳ Uploading...' : '⬆️ Change Cover'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={uploadingCover}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                <div className="playlist-info-section">
                  <h1 className="playlist-title">{selectedPlaylist.name}</h1>
                  <div className="playlist-stats">
                    {tracks.length} tracks • {formatDuration(selectedPlaylist.duration || 0)}
                  </div>

                  <button
                    className="btn-primary add-tracks-btn"
                    onClick={() => setShowAddTracksModal(true)}
                  >
                    + Add Tracks
                  </button>
                </div>
              </div>

              {tracksLoading ? (
                <p>Loading tracks...</p>
              ) : tracks.length === 0 ? (
                <p>No tracks in this playlist</p>
              ) : (
                <div className="tracks-table-container">
                  <table className="tracks-table">
                    <thead>
                      <tr>
                        <th className="col-play"></th>
                        <th className="col-replace"></th>
                        <th className="col-drag"></th>
                        <th className="col-number">#</th>
                        <th className="col-title">Title</th>
                        <th className="col-artist">Artist</th>
                        <th className="col-album">Album</th>
                        <th className="col-codec">Codec</th>
                        <th className="col-bitrate">Bitrate</th>
                        <th className="col-duration">Duration</th>
                        <th className="col-actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.map((track, index) => (
                        <tr
                          key={track.ratingKey}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={draggedIndex === index ? 'dragging' : ''}
                        >
                          <td className="col-play">
                            <button
                              className={`btn-play ${currentlyPlaying === track.ratingKey ? 'playing' : ''}`}
                              onClick={() => handlePlayTrack(track)}
                              title={currentlyPlaying === track.ratingKey ? 'Pause' : 'Play track'}
                            >
                              {currentlyPlaying === track.ratingKey ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="6" y="4" width="4" height="16" />
                                  <rect x="14" y="4" width="4" height="16" />
                                </svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="col-replace">
                            <button
                              className="btn-replace"
                              onClick={() => handleOpenReplaceModal(track)}
                              title="Replace track"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                              </svg>
                            </button>
                          </td>
                          <td className="col-drag">
                            <span className="drag-handle">☰</span>
                          </td>
                          <td className="col-number">{index + 1}</td>
                          <td className="col-title">{track.title}</td>
                          <td className="col-artist">{track.artist}</td>
                          <td className="col-album">{track.album}</td>
                          <td className="col-codec">{track.codec || 'N/A'}</td>
                          <td className="col-bitrate">{formatBitrate(track.bitrate)}</td>
                          <td className="col-duration">{formatDuration(track.duration)}</td>
                          <td className="col-actions">
                            <button
                              className="btn-icon"
                              onClick={() => handleRemoveTrack(track.ratingKey)}
                              title="Remove track"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddTracksModal && (
        <div className="modal-overlay" onClick={() => setShowAddTracksModal(false)}>
          <div className="modal-content add-tracks-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Tracks to Playlist</h3>
            
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="Artist name..."
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTracks()}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Track name..."
                value={searchTrack}
                onChange={(e) => setSearchTrack(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTracks()}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Album name..."
                value={searchAlbum}
                onChange={(e) => setSearchAlbum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTracks()}
              />
              <button
                className="btn-primary"
                onClick={handleSearchTracks}
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <p>{searchResults.length} results found. Select tracks to add:</p>
                <div className="results-list">
                  {searchResults.map((track) => track.id && (
                    <div
                      key={track.id}
                      className={`result-item ${selectedTracks.has(track.id) ? 'selected' : ''}`}
                      onClick={() => track.id && handleToggleTrack(track.id)}
                    >
                      <input
                        type="checkbox"
                        checked={track.id ? selectedTracks.has(track.id) : false}
                        onChange={() => {}}
                      />
                      <div className="result-info">
                        <div className="result-title">{track.title}</div>
                        <div className="result-meta">{track.artist} • {track.album}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              {selectedTracks.size > 0 && (
                <button
                  className="btn-primary"
                  onClick={handleAddSelectedTracks}
                >
                  Add {selectedTracks.size} Track(s)
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddTracksModal(false);
                  setSearchArtist('');
                  setSearchTrack('');
                  setSearchAlbum('');
                  setSearchResults([]);
                  setSelectedTracks(new Set());
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Track Modal */}
      {showReplaceModal && trackToReplace && (
        <div className="modal-overlay" onClick={handleCloseReplaceModal}>
          <div className="modal-content add-tracks-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Replace Track</h3>
            
            <div className="replace-track-info">
              <p><strong>Current Track:</strong></p>
              <p>{trackToReplace.artist} - {trackToReplace.title}</p>
              <p className="track-meta">{trackToReplace.album}</p>
            </div>

            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="Search for replacement track..."
                value={replaceSearchQuery}
                onChange={(e) => setReplaceSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchReplace()}
              />
              <button
                className="btn-primary"
                onClick={handleSearchReplace}
                disabled={searchingReplace}
              >
                {searchingReplace ? 'Searching...' : 'Search'}
              </button>
            </div>

            {replaceSearchResults.length > 0 && (
              <div className="search-results">
                <p>{replaceSearchResults.length} results found. Select a track to replace with:</p>
                <div className="results-list">
                  {replaceSearchResults.map((track) => track.id && (
                    <div
                      key={track.id}
                      className="result-item"
                      onClick={() => handleReplaceTrack(track)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="result-info">
                        <div className="result-title">{track.title}</div>
                        <div className="result-meta">{track.artist} • {track.album}</div>
                        <div className="result-meta">{track.codec} • {formatBitrate(track.bitrate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={handleCloseReplaceModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
