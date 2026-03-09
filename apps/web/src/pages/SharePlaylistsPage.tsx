import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './SharePlaylistsPage.css';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  duration: number;
  composite?: string;
}

interface PlexFriend {
  username: string;
  email: string;
  thumb?: string;
  friendlyName?: string;
}

export const SharePlaylistsPage: FC = () => {
  const { apiClient } = useApp();
  const [friends, setFriends] = useState<PlexFriend[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharingPlaylist, setSharingPlaylist] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [playlistToShare, setPlaylistToShare] = useState<Playlist | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'share' | 'shared'>('share');
  const [sharedPlaylists, setSharedPlaylists] = useState<any[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  useEffect(() => {
    loadFriends();
    loadPlaylists();
  }, []);

  useEffect(() => {
    if (activeTab === 'shared') {
      loadSharedPlaylists();
    }
  }, [activeTab]);

  const loadFriends = async () => {
    setIsLoadingFriends(true);
    setError(null);
    try {
      const response = await fetch('/api/plex/friends', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      } else {
        setError('Failed to load Plex friends');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Plex friends');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const loadPlaylists = async () => {
    setIsLoadingPlaylists(true);
    setError(null);
    try {
      const response = await apiClient.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load playlists');
      setPlaylists([]);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const loadSharedPlaylists = async () => {
    setIsLoadingShared(true);
    setError(null);
    try {
      const response = await fetch('/api/playlists/shared-with-me', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSharedPlaylists(data.sharedPlaylists || []);
      } else {
        setError('Failed to load shared playlists');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shared playlists');
    } finally {
      setIsLoadingShared(false);
    }
  };

  const handleShare = async (playlist: Playlist) => {
    setPlaylistToShare(playlist);
    setShowShareModal(true);
    setShareSuccess(null);
    setSelectedFriends(new Set());
  };

  const handleToggleFriend = (username: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(username)) {
      newSelected.delete(username);
    } else {
      newSelected.add(username);
    }
    setSelectedFriends(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFriends.size === friends.length) {
      setSelectedFriends(new Set());
    } else {
      setSelectedFriends(new Set(friends.map(f => f.username)));
    }
  };

  const handleShareWithSelected = async () => {
    if (!playlistToShare || selectedFriends.size === 0) return;
    
    setSharingPlaylist(playlistToShare.id);
    setError(null);
    setShareSuccess(null);
    
    try {
      const friendsList = Array.from(selectedFriends);
      const results = await Promise.allSettled(
        friendsList.map(friendUsername =>
          fetch(`/api/playlists/${playlistToShare.id}/share-to-friend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ friendUsername }),
          })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        setShareSuccess(`Successfully shared "${playlistToShare.name}" with ${successful} friend${successful > 1 ? 's' : ''}`);
      }
      if (failed > 0) {
        setError(`Failed to share with ${failed} friend${failed > 1 ? 's' : ''}`);
      }
      
      setShowShareModal(false);
      setPlaylistToShare(null);
      setSelectedFriends(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to share playlist');
    } finally {
      setSharingPlaylist(null);
    }
  };

  const handleCloseModal = () => {
    setShowShareModal(false);
    setPlaylistToShare(null);
    setSelectedFriends(new Set());
  };

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoadingFriends || isLoadingPlaylists) {
    return (
      <div className="page-container">
        <h1>Share Playlists</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Share Playlists</h1>
      
      {error && <div className="error-message">{error}</div>}
      {shareSuccess && <div className="success-message">{shareSuccess}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'share' ? 'active' : ''}`}
          onClick={() => setActiveTab('share')}
        >
          Share with Users
        </button>
        <button 
          className={`tab ${activeTab === 'shared' ? 'active' : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          Shared Playlists
        </button>
      </div>

      {activeTab === 'share' ? (
        <>
          {/* Info message when no friends */}
          {friends.length === 0 && (
            <div className="info-message" style={{ 
              padding: '1rem', 
              backgroundColor: '#e3f2fd', 
              border: '1px solid #2196f3', 
              borderRadius: '4px', 
              marginBottom: '1rem',
              color: '#1565c0'
            }}>
              <strong>Note:</strong> No Plex friends found. To share playlists, you need to add friends in your Plex account settings and grant them library access.
            </div>
          )}

          {/* Playlists Section */}
          <div className="share-section">
            <h2>Your Playlists</h2>
            <p className="share-description">
              Share your playlists with Plex friends. When you share a playlist, a copy will be created in their account.
            </p>

            {playlists.length === 0 ? (
              <p className="empty-state">No playlists found</p>
            ) : (
              <div className="playlist-share-list">
                {playlists.map(playlist => (
                  <div key={playlist.id} className="playlist-share-item">
                    <div className="playlist-share-info">
                      <div className="playlist-share-name">{playlist.name}</div>
                      <div className="playlist-share-meta">
                        {playlist.trackCount} tracks • {formatDuration(playlist.duration)}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleShare(playlist)}
                      disabled={sharingPlaylist === playlist.id || friends.length === 0}
                    >
                      {sharingPlaylist === playlist.id ? 'Sharing...' : 'Share'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="share-section">
          <h2>Shared Playlists</h2>
          <p className="share-description">
            View playlists that have been shared with you by other Playlist Lab users
          </p>

          {isLoadingShared ? (
            <div className="loading">Loading shared playlists...</div>
          ) : sharedPlaylists.length === 0 ? (
            <div className="info-message" style={{ 
              padding: '1.5rem', 
              backgroundColor: '#f5f5f5', 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              marginTop: '2rem',
              textAlign: 'center'
            }}>
              <h3 style={{ marginTop: 0, color: '#666' }}>No Shared Playlists</h3>
              <p style={{ color: '#888', marginBottom: 0 }}>
                You don't have any playlists shared with you yet.
                <br />
                When other users share playlists with you, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="playlist-share-list">
              {sharedPlaylists.map((shared: any) => (
                <div key={shared.id} className="playlist-share-item">
                  <div className="playlist-share-info">
                    <div className="playlist-share-name">{shared.playlistName}</div>
                    <div className="playlist-share-meta">
                      Shared by {shared.sharedByUsername} • {new Date(shared.sharedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <a
                    href={`/playlists/${shared.plexPlaylistId}`}
                    className="btn btn-primary btn-sm"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && playlistToShare && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Share Playlist</h2>
            <p>Share "{playlistToShare.name}" with:</p>
            
            {friends.length > 1 && (
              <div className="select-all-container">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedFriends.size === friends.length}
                    onChange={handleSelectAll}
                  />
                  <span>Select All</span>
                </label>
              </div>
            )}

            <div className="share-target-list">
              {friends.map(friend => (
                <label
                  key={friend.username}
                  className="share-target-item checkbox-item"
                >
                  <input
                    type="checkbox"
                    checked={selectedFriends.has(friend.username)}
                    onChange={() => handleToggleFriend(friend.username)}
                    disabled={!!sharingPlaylist}
                  />
                  {friend.thumb && (
                    <img 
                      src={friend.thumb} 
                      alt={friend.username}
                      className="friend-avatar"
                    />
                  )}
                  <span className="friend-name">{friend.friendlyName || friend.username}</span>
                </label>
              ))}
            </div>

            {friends.length === 0 && (
              <div className="empty-state">
                <p>No Plex friends available to share with.</p>
              </div>
            )}

            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={handleCloseModal}
                disabled={!!sharingPlaylist}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleShareWithSelected}
                disabled={!!sharingPlaylist || selectedFriends.size === 0}
              >
                {sharingPlaylist ? 'Sharing...' : `Share with ${selectedFriends.size} friend${selectedFriends.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
