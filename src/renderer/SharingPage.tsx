/**
 * Sharing Page - Share playlists between Plex home users
 */

import { useState, useEffect } from 'react';

interface SharingPageProps {
  serverUrl: string;
  onBack: () => void;
}

interface HomeUser {
  id: number;
  uuid: string;
  title: string;
  username?: string;
  thumb?: string;
  admin?: boolean;
  guest?: boolean;
  restricted?: boolean;
}

interface SharedServer {
  id: number;
  username: string;
  userID: string;
  accessToken: string;
}

interface UserPlaylist {
  ratingKey: string;
  title: string;
  leafCount: number;
  composite?: string;
  duration: number;
}

interface UserWithPlaylists {
  user: HomeUser;
  token: string | null;
  playlists: UserPlaylist[];
  isLoading: boolean;
}

export default function SharingPage({ serverUrl, onBack }: SharingPageProps) {
  const [usersWithPlaylists, setUsersWithPlaylists] = useState<UserWithPlaylists[]>([]);
  const [adminPlaylists, setAdminPlaylists] = useState<UserPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Share modal state
  const [shareModal, setShareModal] = useState<{
    playlist: UserPlaylist;
    sourceUser: UserWithPlaylists | null; // null = admin
    sourceToken: string;
  } | null>(null);
  const [selectedTargetUsers, setSelectedTargetUsers] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setStatusMessage('Loading users...');
    
    try {
      // Load admin playlists first
      const adminPlaylistsData = await window.api.getPlaylists({ serverUrl });
      setAdminPlaylists(adminPlaylistsData || []);
      
      // Try both endpoints and combine results
      const [homeUsers, sharedServers] = await Promise.all([
        window.api.getHomeUsers(),
        window.api.getSharedServers(),
      ]);
      
      console.log('Home users:', homeUsers);
      console.log('Shared servers:', sharedServers);
      
      const homeArray = Array.isArray(homeUsers) ? homeUsers : [];
      const sharedArray = Array.isArray(sharedServers) ? sharedServers : [];
      
      // Build a map of userID -> accessToken from shared servers
      const tokenMap = new Map<string, string>();
      for (const s of sharedArray) {
        if (s.userID && s.accessToken) {
          tokenMap.set(String(s.userID), s.accessToken);
        }
      }
      
      // Build user list from home users, adding tokens from shared servers
      const usersData: UserWithPlaylists[] = [];
      
      // Add users from home users endpoint (excluding admin)
      for (const u of homeArray) {
        if (u.admin) continue; // Skip admin user
        
        const userId = String(u.id);
        const token = tokenMap.get(userId) || null;
        
        usersData.push({
          user: {
            id: u.id,
            uuid: u.uuid || userId,
            title: u.title || u.username || u.friendlyName || 'User',
            username: u.username,
            thumb: u.thumb,
            admin: u.admin,
            guest: u.guest,
            restricted: u.restricted,
          },
          token,
          playlists: [],
          isLoading: false,
        });
      }
      
      // If no home users, fall back to shared servers only
      if (usersData.length === 0 && sharedArray.length > 0) {
        for (const s of sharedArray) {
          usersData.push({
            user: {
              id: parseInt(s.userID) || 0,
              uuid: s.userID,
              title: s.username,
              username: s.username,
            },
            token: s.accessToken,
            playlists: [],
            isLoading: false,
          });
        }
      }
      
      setUsersWithPlaylists(usersData);
      setStatusMessage(usersData.length === 0 ? 'No managed users found' : '');
    } catch (error: any) {
      console.error('Error loading users:', error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPlaylists = async (userIndex: number) => {
    const userData = usersWithPlaylists[userIndex];
    if (!userData.token || userData.isLoading) return;
    
    setUsersWithPlaylists(prev => {
      const updated = [...prev];
      updated[userIndex] = { ...updated[userIndex], isLoading: true };
      return updated;
    });
    
    try {
      const playlists = await window.api.getUserPlaylists({ 
        serverUrl, 
        userToken: userData.token 
      });
      
      setUsersWithPlaylists(prev => {
        const updated = [...prev];
        updated[userIndex] = { 
          ...updated[userIndex], 
          playlists, 
          isLoading: false 
        };
        return updated;
      });
    } catch (error) {
      setUsersWithPlaylists(prev => {
        const updated = [...prev];
        updated[userIndex] = { ...updated[userIndex], isLoading: false };
        return updated;
      });
    }
  };

  const openShareModal = (
    playlist: UserPlaylist, 
    sourceUser: UserWithPlaylists | null,
    sourceToken: string
  ) => {
    setShareModal({ playlist, sourceUser, sourceToken });
    setSelectedTargetUsers(new Set());
  };

  const handleShare = async () => {
    if (!shareModal || selectedTargetUsers.size === 0) return;
    
    setIsSharing(true);
    let successCount = 0;
    
    for (const targetUserId of selectedTargetUsers) {
      const targetUser = usersWithPlaylists.find(u => String(u.user.id) === targetUserId);
      if (!targetUser?.token) continue;
      
      try {
        setStatusMessage(`Sharing to ${targetUser.user.title}...`);
        
        await window.api.copyPlaylistToUser({
          serverUrl,
          sourcePlaylistId: shareModal.playlist.ratingKey,
          targetUserToken: targetUser.token,
          newTitle: shareModal.playlist.title,
        });
        
        successCount++;
      } catch (error: any) {
        console.error(`Failed to share to ${targetUser.user.title}:`, error);
      }
    }
    
    setStatusMessage(`Shared playlist to ${successCount} user(s)`);
    setShareModal(null);
    setIsSharing(false);
    
    // Refresh user playlists
    for (let i = 0; i < usersWithPlaylists.length; i++) {
      if (selectedTargetUsers.has(String(usersWithPlaylists[i].user.id))) {
        await loadUserPlaylists(i);
      }
    }
    
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleDeletePlaylist = async (
    playlist: UserPlaylist, 
    userToken: string,
    userIndex: number
  ) => {
    if (!confirm(`Delete "${playlist.title}"?`)) return;
    
    try {
      await window.api.deleteUserPlaylist({
        serverUrl,
        playlistId: playlist.ratingKey,
        userToken,
      });
      
      // Refresh that user's playlists
      void loadUserPlaylists(userIndex);
      setStatusMessage(`Deleted "${playlist.title}"`);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="sharing-page">
        <div className="import-header">
          <button className="btn btn-secondary btn-small" onClick={onBack}>← Back</button>
          <h1>Playlist Sharing</h1>
        </div>
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="sharing-page">
      <div className="import-header">
        <button className="btn btn-secondary btn-small" onClick={onBack}>← Back</button>
        <h1>Playlist Sharing</h1>
      </div>
      
      {statusMessage && <div className="status-message">{statusMessage}</div>}
      
      {/* Admin Playlists Section */}
      <div className="sharing-section">
        <h2>Your Playlists (Admin)</h2>
        <p className="section-hint">Share your playlists with managed users</p>
        
        {adminPlaylists.length === 0 ? (
          <p className="empty-state">No playlists found</p>
        ) : (
          <div className="playlist-grid">
            {adminPlaylists.map(playlist => (
              <div key={playlist.ratingKey} className="sharing-playlist-card">
                <div className="playlist-info">
                  <span className="playlist-name">{playlist.title}</span>
                  <span className="playlist-meta">
                    {playlist.leafCount} tracks • {formatDuration(playlist.duration)}
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => openShareModal(playlist, null, '')}
                >
                  Share
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Managed Users Section */}
      <div className="sharing-section">
        <h2>Managed Users</h2>
        <p className="section-hint">View and share playlists from managed users</p>
        
        {usersWithPlaylists.length === 0 ? (
          <p className="empty-state">No managed users found</p>
        ) : (
          <div className="users-list">
            {usersWithPlaylists.map((userData, index) => (
              <div key={userData.user.id} className="user-card">
                <div className="user-card-header" onClick={() => loadUserPlaylists(index)}>
                  <div className="user-info-row">
                    {userData.user.thumb && (
                      <img src={userData.user.thumb} alt="" className="user-avatar" />
                    )}
                    <div>
                      <span className="user-name">{userData.user.title}</span>
                      {userData.user.admin && <span className="user-badge">Admin</span>}
                      {userData.user.guest && <span className="user-badge guest">Guest</span>}
                    </div>
                  </div>
                  <span className="expand-hint">
                    {userData.playlists.length > 0 
                      ? `${userData.playlists.length} playlists` 
                      : userData.token ? 'Click to load' : 'No access'}
                  </span>
                </div>
                
                {userData.isLoading && (
                  <div className="user-playlists loading">Loading playlists...</div>
                )}
                
                {userData.playlists.length > 0 && (
                  <div className="user-playlists">
                    {userData.playlists.map(playlist => (
                      <div key={playlist.ratingKey} className="user-playlist-item">
                        <div className="playlist-info">
                          <span className="playlist-name">{playlist.title}</span>
                          <span className="playlist-meta">{playlist.leafCount} tracks</span>
                        </div>
                        <div className="playlist-actions">
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => openShareModal(playlist, userData, userData.token!)}
                          >
                            Share
                          </button>
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleDeletePlaylist(playlist, userData.token!, index)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(null)}>
          <div className="modal share-modal" onClick={e => e.stopPropagation()}>
            <h3>Share Playlist</h3>
            <p className="share-playlist-name">"{shareModal.playlist.title}"</p>
            
            <div className="share-target-list">
              <p className="share-label">Select users to share with:</p>
              {usersWithPlaylists
                .filter(u => u.token && u.user.id !== shareModal.sourceUser?.user.id)
                .length === 0 ? (
                  <p className="empty-state">No users available to share with. Make sure you have managed users set up in Plex.</p>
                ) : (
                  usersWithPlaylists
                    .filter(u => u.token && u.user.id !== shareModal.sourceUser?.user.id)
                    .map(userData => (
                      <label key={userData.user.id} className="share-target-item">
                        <input
                          type="checkbox"
                          checked={selectedTargetUsers.has(String(userData.user.id))}
                          onChange={e => {
                            const newSet = new Set(selectedTargetUsers);
                            if (e.target.checked) {
                              newSet.add(String(userData.user.id));
                            } else {
                              newSet.delete(String(userData.user.id));
                            }
                            setSelectedTargetUsers(newSet);
                          }}
                        />
                        <span>{userData.user.title}</span>
                      </label>
                    ))
                )}
            </div>
            
            <div className="button-row">
              <button className="btn btn-secondary" onClick={() => setShareModal(null)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleShare}
                disabled={selectedTargetUsers.size === 0 || isSharing}
              >
                {isSharing ? 'Sharing...' : `Share to ${selectedTargetUsers.size} user(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
