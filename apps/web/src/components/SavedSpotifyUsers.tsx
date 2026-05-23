import type { FC } from 'react';
import { useState, useEffect } from 'react';

interface SavedSpotifyUser {
  id: number;
  spotify_user_id: string;
  display_name: string;
  added_at: number;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  coverUrl?: string;
}

interface SavedSpotifyUsersProps {
  onSelectPlaylist: (playlistUrl: string, playlistName: string) => void;
}

export const SavedSpotifyUsers: FC<SavedSpotifyUsersProps> = ({ onSelectPlaylist }) => {
  const [savedUsers, setSavedUsers] = useState<SavedSpotifyUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<SavedSpotifyUser | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  
  // Preview state
  const [previewPlaylist, setPreviewPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [previewTracks, setPreviewTracks] = useState<Array<{ title: string; artist: string }>>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    fetchSavedUsers();
  }, []);

  const fetchSavedUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/saved-spotify-users', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch saved users');
      }
      const data = await response.json();
      setSavedUsers(data.users || []);
    } catch (err: any) {
      console.error('Failed to fetch saved Spotify users:', err);
      setError(err.message || 'Failed to load saved users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserId.trim()) {
      setError('User ID is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // First, try to fetch the user's display name from Spotify
      let displayName = newDisplayName.trim() || newUserId.trim();
      
      try {
        const playlistsResponse = await fetch(`/api/import/spotify/user/${encodeURIComponent(newUserId.trim())}/playlists`, {
          credentials: 'include',
        });
        
        if (playlistsResponse.ok) {
          const playlistsData = await playlistsResponse.json();
          if (playlistsData.displayName) {
            displayName = playlistsData.displayName;
          }
        }
      } catch (fetchError) {
        // If we can't fetch the display name, just use what the user provided
        console.warn('Could not fetch display name from Spotify:', fetchError);
      }
      
      // Now save the user with the display name
      const response = await fetch('/api/saved-spotify-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          spotifyUserId: newUserId.trim(),
          displayName: displayName,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save user');
      }
      
      const data = await response.json();
      setSavedUsers([data.user, ...savedUsers]);
      setNewUserId('');
      setNewDisplayName('');
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Failed to save Spotify user:', err);
      setError(err.message || 'Failed to save user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Remove this saved Spotify user?')) return;

    try {
      const response = await fetch(`/api/saved-spotify-users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      setSavedUsers(savedUsers.filter(u => u.id !== id));
    } catch (err: any) {
      console.error('Failed to delete Spotify user:', err);
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleSelectUser = async (user: SavedSpotifyUser) => {
    setSelectedUser(user);
    setIsLoadingPlaylists(true);
    setError(null);
    
    try {
      // Use the new endpoint to fetch user's public playlists
      const response = await fetch(`/api/import/spotify/user/${encodeURIComponent(user.spotify_user_id)}/playlists`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch user playlists');
      }
      
      const data = await response.json();
      
      // Update the display name if we got a new one from Spotify
      if (data.displayName && data.displayName !== user.display_name) {
        // Update local state
        setSavedUsers(savedUsers.map(u => 
          u.id === user.id ? { ...u, display_name: data.displayName } : u
        ));
        // Update selected user
        setSelectedUser({ ...user, display_name: data.displayName });
      }
      
      // The endpoint returns playlists with id, name, trackCount
      setUserPlaylists(data.playlists || []);
      
      if (!data.playlists || data.playlists.length === 0) {
        setError(
          `No public playlists found for @${user.spotify_user_id}. ` +
          `This could mean: (1) The profile is private, (2) The username is incorrect, or (3) Spotify changed their page structure. ` +
          `Try using a direct playlist URL instead in the "Spotify URL" field above.`
        );
      }
    } catch (err: any) {
      console.error('Failed to fetch user playlists:', err);
      setError(err.message || 'Failed to load playlists');
      setUserPlaylists([]);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setUserPlaylists([]);
    setError(null);
  };
  
  const openPreview = async (playlist: SpotifyPlaylist) => {
    setPreviewPlaylist(playlist);
    setIsLoadingPreview(true);
    setPreviewTracks([]);
    setError(null);
    
    try {
      // Fetch playlist tracks from the server
      const response = await fetch(`/api/import/spotify/playlist/${playlist.id}/tracks`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch playlist tracks');
      }
      
      const data = await response.json();
      setPreviewTracks(data.tracks || []);
    } catch (err: any) {
      console.error('Failed to fetch playlist tracks:', err);
      setError(err.message || 'Failed to load playlist tracks');
    } finally {
      setIsLoadingPreview(false);
    }
  };
  
  const closePreview = () => {
    setPreviewPlaylist(null);
    setPreviewTracks([]);
    setError(null);
  };
  
  const importFromPreview = () => {
    if (!previewPlaylist) return;
    onSelectPlaylist(`https://open.spotify.com/playlist/${previewPlaylist.id}`, previewPlaylist.name);
    closePreview();
  };

  const extractUserIdFromUrl = (input: string): string => {
    // Try to extract from URL: https://open.spotify.com/user/USERNAME
    const urlMatch = input.match(/spotify\.com\/user\/([^/?]+)/);
    if (urlMatch) return urlMatch[1];
    
    // Otherwise return as-is (assume it's already a user ID)
    return input.trim();
  };

  const handleUserIdChange = (value: string) => {
    const userId = extractUserIdFromUrl(value);
    setNewUserId(userId);
    
    // Auto-fill display name if empty
    if (!newDisplayName && userId) {
      setNewDisplayName(userId);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
        Loading saved users...
      </div>
    );
  }
  
  // Show preview modal if a playlist is being previewed
  if (previewPlaylist) {
    return (
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '0.75rem'
        }}>
          <button
            className="btn btn-small btn-secondary"
            onClick={closePreview}
          >
            ← Back
          </button>
          <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 500 }}>
            Preview Playlist
          </h3>
          <div style={{ width: '80px' }} /> {/* Spacer for centering */}
        </div>

        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{previewPlaylist.name}</h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {isLoadingPreview ? 'Loading...' : `${previewTracks.length} tracks`} from Spotify
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={importFromPreview}
              disabled={isLoadingPreview || previewTracks.length === 0}
            >
              Import This Playlist
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid var(--error)',
            borderRadius: '4px',
            color: 'var(--error)',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        {isLoadingPreview ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading tracks...
          </div>
        ) : previewTracks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            backgroundColor: 'var(--surface)',
            border: '1px dashed var(--border-color)',
            borderRadius: '4px',
          }}>
            No tracks found. The playlist may be private or unavailable.
          </div>
        ) : (
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
          }}>
            {previewTracks.map((track, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  padding: '0.75rem',
                  borderBottom: i < previewTracks.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <span style={{ 
                  minWidth: '40px', 
                  color: 'var(--text-secondary)', 
                  fontSize: '0.875rem' 
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{track.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{track.artist}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Show playlists if a user is selected */}
      {selectedUser ? (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.75rem'
          }}>
            <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 500 }}>
              {selectedUser.display_name}'s Playlists
            </h3>
            <button
              className="btn btn-small btn-secondary"
              onClick={handleBackToUsers}
            >
              ← Back to Users
            </button>
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: '4px',
              color: 'var(--error)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          {isLoadingPlaylists ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading playlists...
            </div>
          ) : userPlaylists.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              backgroundColor: 'var(--surface)',
              border: '1px dashed var(--border-color)',
              borderRadius: '4px',
            }}>
              No public playlists found for this user
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {userPlaylists.map(playlist => (
                <div
                  key={playlist.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                    e.currentTarget.style.backgroundColor = 'rgba(91, 155, 213, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'var(--surface)';
                  }}
                >
                  <div 
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => openPreview(playlist)}
                    title="Click to preview playlist"
                  >
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                      {playlist.name}
                    </div>
                    {playlist.trackCount > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {playlist.trackCount} tracks
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(playlist);
                      }}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      title="Preview playlist"
                    >
                      Preview
                    </button>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPlaylist(`https://open.spotify.com/playlist/${playlist.id}`, playlist.name);
                      }}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Import
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Show saved users list */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.75rem'
          }}>
            <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 500 }}>
              Saved Spotify Users
            </h3>
            <button
              className="btn btn-small btn-secondary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? 'Cancel' : '+ Add User'}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: '4px',
              color: 'var(--error)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

      {showAddForm && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Spotify Username
            </label>
            <input
              type="text"
              value={newUserId}
              onChange={(e) => handleUserIdChange(e.target.value)}
              placeholder="e.g., spotify or 1234603815"
              disabled={isSaving}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--background)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Enter just the username from the profile URL
              <br />
              Example: For <code style={{ backgroundColor: 'rgba(91, 155, 213, 0.1)', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>https://open.spotify.com/user/spotify</code>, enter <code style={{ backgroundColor: 'rgba(91, 155, 213, 0.1)', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>spotify</code>
              <br />
              Try popular users: <code style={{ backgroundColor: 'rgba(91, 155, 213, 0.1)', padding: '0.125rem 0.25rem', borderRadius: '2px', cursor: 'pointer' }} onClick={() => { setNewUserId('spotify'); setNewDisplayName('Spotify Official'); }}>spotify</code>, <code style={{ backgroundColor: 'rgba(91, 155, 213, 0.1)', padding: '0.125rem 0.25rem', borderRadius: '2px', cursor: 'pointer' }} onClick={() => { setNewUserId('billboard.com'); setNewDisplayName('Billboard'); }}>billboard.com</code>
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Display Name (optional)
            </label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="e.g., Spotify Official (will be fetched automatically)"
              disabled={isSaving}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--background)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Leave blank to automatically fetch from Spotify
            </div>
          </div>

          <button
            className="btn btn-primary btn-small"
            onClick={handleAddUser}
            disabled={isSaving || !newUserId.trim()}
            style={{ width: '100%' }}
          >
            {isSaving ? 'Saving...' : 'Save User'}
          </button>
        </div>
      )}

      {savedUsers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--surface)',
          border: '1px dashed var(--border-color)',
          borderRadius: '4px',
        }}>
          <div style={{ marginBottom: '0.5rem' }}>No saved Spotify users yet</div>
          <div style={{ fontSize: '0.75rem' }}>
            Save Spotify user IDs for quick access to their public playlists
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {savedUsers.map(user => (
            <div
              key={user.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.backgroundColor = 'rgba(91, 155, 213, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <div 
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => handleSelectUser(user)}
                title="Click to load this user's playlists"
              >
                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                  {user.display_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  @{user.spotify_user_id}
                </div>
              </div>
              <button
                className="btn btn-small btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteUser(user.id);
                }}
                style={{ 
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  minWidth: 'auto',
                }}
                title="Remove saved user"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
};
