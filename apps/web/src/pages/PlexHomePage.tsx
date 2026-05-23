import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './PlexHomePage.css';

interface PlexHomeUser {
  id: string;
  title: string;
  username: string;
  thumb?: string;
  admin: boolean;
  restricted: boolean;
  guest: boolean;
}

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

export const PlexHomePage: FC = () => {
  const { apiClient, server } = useApp();
  const [homeUsers, setHomeUsers] = useState<PlexHomeUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PlexHomeUser | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [playlistToCopy, setPlaylistToCopy] = useState<Playlist | null>(null);
  const [targetUsers, setTargetUsers] = useState<Set<string>>(new Set());
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  
  // Editing features
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElement] = useState(() => new Audio());
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [searchArtist, setSearchArtist] = useState('');
  const [searchTrack, setSearchTrack] = useState('');
  const [searchAlbum, setSearchAlbum] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [trackToReplace, setTrackToReplace] = useState<Track | null>(null);
  const [replaceSearchQuery, setReplaceSearchQuery] = useState('');
  const [replaceSearchResults, setReplaceSearchResults] = useState<Track[]>([]);
  const [searchingReplace, setSearchingReplace] = useState(false);

  useEffect(() => {
    loadHomeUsers();
    
    // Cleanup audio on unmount
    return () => {
      audioElement.pause();
      audioElement.src = '';
    };
  }, []);

  const loadHomeUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);
    try {
      const response = await fetch('/api/plex-home/users', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setHomeUsers(data.homeUsers || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to load Plex Home users');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Plex Home users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadUserPlaylists = async (user: PlexHomeUser) => {
    setSelectedUser(user);
    setSelectedPlaylist(null);
    setTracks([]);
    setIsLoadingPlaylists(true);
    setError(null);
    setUserPlaylists([]);
    
    try {
      const response = await fetch(`/api/plex-home/users/${user.id}/playlists`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.playlists || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to load playlists');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load playlists');
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const loadPlaylistTracks = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsLoadingTracks(true);
    setError(null);
    setTracks([]);
    
    try {
      const response = await apiClient.getPlaylistTracks(playlist.id);
      setTracks((response.tracks || []).map((track: any) => ({
        ...track,
        playlistItemID: track.playlistItemID,
      })));
    } catch (err: any) {
      console.error('Failed to load tracks:', err);
      setError(err.message || 'Failed to load tracks');
      setTracks([]);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleCopyPlaylist = (playlist: Playlist) => {
    setPlaylistToCopy(playlist);
    setNewPlaylistName(playlist.name);
    setTargetUsers(new Set());
    setShowCopyModal(true);
    setSuccess(null);
    setError(null);
  };

  const handleToggleTargetUser = (userId: string) => {
    const newTargets = new Set(targetUsers);
    if (newTargets.has(userId)) {
      newTargets.delete(userId);
    } else {
      newTargets.add(userId);
    }
    setTargetUsers(newTargets);
  };

  const handleSelectAllUsers = () => {
    if (targetUsers.size === availableTargetUsers.length) {
      setTargetUsers(new Set());
    } else {
      setTargetUsers(new Set(availableTargetUsers.map(u => u.id)));
    }
  };

  const handleCopyToSelected = async () => {
    if (!playlistToCopy || !selectedUser || targetUsers.size === 0) return;
    
    setIsCopying(true);
    setError(null);
    setSuccess(null);
    
    try {
      const results = await Promise.allSettled(
        Array.from(targetUsers).map(targetUserId =>
          fetch('/api/plex-home/playlists/' + playlistToCopy.id + '/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sourceHomeUserId: selectedUser.id,
              targetHomeUserId: targetUserId === 'current' ? 'current' : targetUserId,
              newName: newPlaylistName || playlistToCopy.name,
            }),
          })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        setSuccess(`Successfully copied "${newPlaylistName || playlistToCopy.name}" to ${successful} user${successful > 1 ? 's' : ''}`);
      }
      if (failed > 0) {
        setError(`Failed to copy to ${failed} user${failed > 1 ? 's' : ''}`);
      }
      
      setShowCopyModal(false);
      setPlaylistToCopy(null);
      setTargetUsers(new Set());
      setNewPlaylistName('');
    } catch (err: any) {
      setError(err.message || 'Failed to copy playlist');
    } finally {
      setIsCopying(false);
    }
  };

  const handleCloseModal = () => {
    setShowCopyModal(false);
    setPlaylistToCopy(null);
    setTargetUsers(new Set());
    setNewPlaylistName('');
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  // Editing functions
  const handleRemoveTrack = async (playlistItemId: number) => {
    if (!selectedPlaylist) return;
    
    try {
      await apiClient.removeTrackFromPlaylist(selectedPlaylist.id, playlistItemId.toString());
      setTracks(tracks.filter(t => t.playlistItemID !== playlistItemId));
      setSuccess('Track removed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to remove track:', err);
      setError(err.message || 'Failed to remove track');
      setTimeout(() => setError(null), 3000);
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
    
    try {
      const draggedTrack = tracks[draggedIndex];
      
      if (!draggedTrack.playlistItemID) {
        console.error('Dragged track has no playlistItemID');
        setDraggedIndex(null);
        return;
      }

      const afterIndex = draggedIndex - 1;
      const afterTrackId = afterIndex < 0 ? '0' : tracks[afterIndex].playlistItemID?.toString() || '0';
      
      const response = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks/${draggedTrack.playlistItemID}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afterId: afterTrackId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reorder tracks: ${response.status}`);
      }
      
      setSuccess('Track moved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to reorder tracks:', err);
      setError(`Failed to reorder tracks: ${err.message}`);
      setTimeout(() => setError(null), 3000);
      setTracks(originalTracks);
    }
    
    setDraggedIndex(null);
  };

  const handlePlayTrack = (track: Track) => {
    if (!server) return;

    if (currentlyPlaying === track.ratingKey) {
      audioElement.pause();
      setCurrentlyPlaying(null);
      return;
    }

    if (currentlyPlaying) {
      audioElement.pause();
    }

    const streamUrl = `/api/proxy/audio?ratingKey=${track.ratingKey}`;
    
    audioElement.src = streamUrl;
    audioElement.play().catch(err => {
      console.error('Failed to play track:', err);
      setError('Failed to play track');
      setTimeout(() => setError(null), 3000);
    });
    
    setCurrentlyPlaying(track.ratingKey);

    audioElement.onended = () => {
      setCurrentlyPlaying(null);
    };
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
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

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

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

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setUploadingCover(true);
      
      const resizedBlob = await resizeImage(file, 1000, 1000);
      
      const formData = new FormData();
      formData.append('cover', resizedBlob, file.name);

      const response = await fetch(`/api/playlists/${selectedPlaylist.id}/cover`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to upload cover' }));
        throw new Error(error.message || 'Failed to upload cover');
      }

      // Refresh playlists and tracks
      if (selectedUser) {
        await loadUserPlaylists(selectedUser);
      }
      if (selectedPlaylist) {
        await loadPlaylistTracks(selectedPlaylist);
      }
      
      setSuccess('Cover uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to upload cover:', err);
      setError(err.message || 'Failed to upload cover');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleSearchTracks = async () => {
    if (!searchArtist.trim() && !searchTrack.trim() && !searchAlbum.trim()) {
      setError('Please enter at least one search term');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setSearching(true);
      
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
      setError('Failed to search tracks');
      setTimeout(() => setError(null), 3000);
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

      await loadPlaylistTracks(selectedPlaylist);
      
      setSelectedTracks(new Set());
      setSearchArtist('');
      setSearchTrack('');
      setSearchAlbum('');
      setSearchResults([]);
      setShowAddTracksModal(false);
      
      setSuccess(`Added ${trackIds.length} track(s) to playlist`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to add tracks:', err);
      setError('Failed to add tracks to playlist');
      setTimeout(() => setError(null), 3000);
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
        artist: item.artist || 'Unknown Artist',
        album: item.album || 'Unknown Album',
        duration: item.duration || 0,
        codec: item.codec || 'N/A',
        bitrate: item.bitrate || 0,
      })));
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to search tracks');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSearchingReplace(false);
    }
  };

  const handleReplaceTrack = async (newTrack: Track) => {
    if (!selectedPlaylist || !trackToReplace) return;

    try {
      if (newTrack.ratingKey === trackToReplace.ratingKey) {
        handleCloseReplaceModal();
        await loadPlaylistTracks(selectedPlaylist);
        return;
      }

      const oldTrackIndex = tracks.findIndex(t => t.playlistItemID === trackToReplace.playlistItemID);
      if (oldTrackIndex === -1) {
        throw new Error('Track not found in playlist');
      }

      const oldTrackRatingKey = trackToReplace.ratingKey;
      const afterIndex = oldTrackIndex - 1;
      const afterTrackId = afterIndex < 0 ? '0' : tracks[afterIndex].playlistItemID?.toString() || '0';

      const trackUri = `server://${server?.clientId}/com.plexapp.plugins.library/library/metadata/${newTrack.ratingKey}`;
      
      const addResponse = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUris: [trackUri] }),
      });

      if (!addResponse.ok) {
        throw new Error('Failed to add replacement track');
      }

      await loadPlaylistTracks(selectedPlaylist);

      const updatedTracks = await apiClient.getPlaylistTracks(selectedPlaylist.id);
      const newTrackItem = updatedTracks.tracks[updatedTracks.tracks.length - 1];
      
      if (!newTrackItem.playlistItemID) {
        throw new Error('New track does not have a playlist item ID');
      }

      const moveResponse = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks/${newTrackItem.playlistItemID}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afterId: afterTrackId }),
      });

      if (!moveResponse.ok) {
        throw new Error('Failed to move replacement track to correct position');
      }

      const tracksAfterMove = await apiClient.getPlaylistTracks(selectedPlaylist.id);
      const oldTrackAfterMove = tracksAfterMove.tracks.find(t => t.ratingKey === oldTrackRatingKey);
      
      if (!oldTrackAfterMove || !oldTrackAfterMove.playlistItemID) {
        throw new Error('Could not find old track after move');
      }
      
      await apiClient.removeTrackFromPlaylist(selectedPlaylist.id, oldTrackAfterMove.playlistItemID.toString());

      await loadPlaylistTracks(selectedPlaylist);
      handleCloseReplaceModal();
      setSuccess('Track replaced successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to replace track:', err);
      setError(`Failed to replace track: ${err.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 3000);
      await loadPlaylistTracks(selectedPlaylist);
    }
  };

  // Get available target users (all users except the selected one)
  const availableTargetUsers = homeUsers.filter(u => u.id !== selectedUser?.id);
  // Add "current user" option
  const targetUserOptions = [
    { id: 'current', title: 'My Account', username: 'current', admin: true, restricted: false, guest: false },
    ...availableTargetUsers
  ];

  if (isLoadingUsers) {
    return (
      <div className="page-container">
        <h1>Plex Home Users</h1>
        <div className="loading">Loading Plex Home users...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Plex Home Users</h1>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {homeUsers.length === 0 ? (
        <div className="info-message" style={{ 
          padding: '1.5rem', 
          borderRadius: '8px', 
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <h3 style={{ marginTop: 0, color: 'inherit' }}>No Plex Home Users</h3>
          <p style={{ marginBottom: '1rem' }}>
            You don't have any Plex Home users set up.
          </p>
          <div style={{ 
            textAlign: 'left', 
            maxWidth: '600px', 
            margin: '0 auto',
            padding: '1rem',
            background: 'var(--surface-hover)',
            borderRadius: '6px'
          }}>
            <h4 style={{ marginTop: 0 }}>What are Plex Home Users?</h4>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
              <strong>Plex Home</strong> allows you to create multiple user profiles under your single Plex account 
              (like family members). Each managed user has their own playlists, watch history, and preferences.
            </p>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.6', marginBottom: 0 }}>
              <strong>Note:</strong> This is different from Plex Friends (users you've shared your library with). 
              To share playlists with friends, use the <strong>Share Playlists</strong> page instead.
            </p>
          </div>
        </div>
      ) : (
        <div className="plex-home-layout">
          {/* Users Panel */}
          <div className="users-panel">
            <h2>Home Users</h2>
            <div className="user-list">
              {homeUsers.map(user => (
                <div
                  key={user.id}
                  className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`}
                  onClick={() => loadUserPlaylists(user)}
                >
                  {user.thumb && (
                    <img 
                      src={user.thumb} 
                      alt={user.title}
                      className="user-avatar"
                    />
                  )}
                  <div className="user-info">
                    <div className="user-name">{user.title}</div>
                    <div className="user-meta">
                      @{user.username}
                      {user.admin && <span className="badge badge-admin">Admin</span>}
                      {user.restricted && <span className="badge badge-restricted">Restricted</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Playlists Panel */}
          <div className="playlists-panel">
            {!selectedUser ? (
              <div className="empty-state">
                <p>Select a user to view their playlists</p>
              </div>
            ) : (
              <>
                <h2>{selectedUser.title}'s Playlists</h2>
                
                {isLoadingPlaylists ? (
                  <div className="loading">Loading playlists...</div>
                ) : userPlaylists.length === 0 ? (
                  <div className="empty-state">
                    <p>No playlists found for this user</p>
                  </div>
                ) : (
                  <div className="playlists-list">
                    {userPlaylists.map(playlist => (
                      <div
                        key={playlist.id}
                        className={`playlist-item ${selectedPlaylist?.id === playlist.id ? 'active' : ''}`}
                        onClick={() => loadPlaylistTracks(playlist)}
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
                            {playlist.trackCount} tracks • {formatDuration(playlist.duration)}
                          </div>
                        </div>
                        <button
                          className="btn-copy-inline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPlaylist(playlist);
                          }}
                          disabled={isCopying}
                          title="Copy playlist to another user"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tracks Panel */}
          <div className="tracks-panel">
            {!selectedPlaylist ? (
              <div className="empty-state">
                <p>Select a playlist to view tracks</p>
              </div>
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

                {isLoadingTracks ? (
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
                                onClick={() => track.playlistItemID && handleRemoveTrack(track.playlistItemID)}
                                title="Remove track"
                                disabled={!track.playlistItemID}
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
      )}

      {/* Copy Modal */}
      {showCopyModal && playlistToCopy && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Copy Playlist</h2>
            
            <div className="form-group">
              <label htmlFor="playlist-name">Playlist Name</label>
              <input
                id="playlist-name"
                type="text"
                className="form-control"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={playlistToCopy.name}
              />
            </div>

            <div className="form-group">
              <label>Copy to:</label>
              
              {targetUserOptions.length > 1 && (
                <div className="select-all-container">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={targetUsers.size === targetUserOptions.length}
                      onChange={handleSelectAllUsers}
                    />
                    <span>Select All</span>
                  </label>
                </div>
              )}

              <div className="target-user-list">
                {targetUserOptions.map(user => (
                  <label
                    key={user.id}
                    className="target-user-item checkbox-item"
                  >
                    <input
                      type="checkbox"
                      checked={targetUsers.has(user.id)}
                      onChange={() => handleToggleTargetUser(user.id)}
                      disabled={isCopying}
                    />
                    {user.id !== 'current' && user.thumb && (
                      <img 
                        src={user.thumb} 
                        alt={user.title}
                        className="user-avatar-small"
                      />
                    )}
                    <span className="user-name">{user.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={handleCloseModal}
                disabled={isCopying}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCopyToSelected}
                disabled={isCopying || targetUsers.size === 0}
              >
                {isCopying ? 'Copying...' : `Copy to ${targetUsers.size} user${targetUsers.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tracks Modal */}
      {showAddTracksModal && (
        <div className="modal-overlay" onClick={() => setShowAddTracksModal(false)}>
          <div className="modal-content add-tracks-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Tracks</h2>
            
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="Artist"
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Track"
                value={searchTrack}
                onChange={(e) => setSearchTrack(e.target.value)}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Album"
                value={searchAlbum}
                onChange={(e) => setSearchAlbum(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleSearchTracks}
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <p>{searchResults.length} results found</p>
                <div className="results-list">
                  {searchResults.map(track => (
                    <div
                      key={track.ratingKey}
                      className={`result-item ${selectedTracks.has(track.ratingKey) ? 'selected' : ''}`}
                      onClick={() => handleToggleTrack(track.ratingKey)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTracks.has(track.ratingKey)}
                        onChange={() => handleToggleTrack(track.ratingKey)}
                      />
                      <div className="result-info">
                        <div className="result-title">{track.title}</div>
                        <div className="result-meta">
                          {track.artist} • {track.album}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddTracksModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddSelectedTracks}
                disabled={selectedTracks.size === 0}
              >
                Add {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Track Modal */}
      {showReplaceModal && trackToReplace && (
        <div className="modal-overlay" onClick={handleCloseReplaceModal}>
          <div className="modal-content add-tracks-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Replace Track</h2>
            
            <div className="replace-track-info">
              <p><strong>Current Track:</strong></p>
              <p>{trackToReplace.title}</p>
              <p className="track-meta">{trackToReplace.artist} • {trackToReplace.album}</p>
            </div>

            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="Search for replacement track..."
                value={replaceSearchQuery}
                onChange={(e) => setReplaceSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchReplace()}
              />
              <button
                className="btn btn-primary"
                onClick={handleSearchReplace}
                disabled={searchingReplace}
              >
                {searchingReplace ? 'Searching...' : 'Search'}
              </button>
            </div>

            {replaceSearchResults.length > 0 && (
              <div className="search-results">
                <p>{replaceSearchResults.length} results found</p>
                <div className="results-list">
                  {replaceSearchResults.map(track => (
                    <div
                      key={track.ratingKey}
                      className="result-item"
                      onClick={() => handleReplaceTrack(track)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="result-info">
                        <div className="result-title">{track.title}</div>
                        <div className="result-meta">
                          {track.artist} • {track.album}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
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
};
