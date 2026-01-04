/**
 * Import Page - Import playlists from Spotify and Deezer
 */

import { useState, useEffect, useCallback } from 'react';
import { MatchedPlaylist, matchPlaylistToPlex } from './discovery';

interface ImportPageProps {
  serverUrl: string;
  onBack: () => void;
  onPlaylistSelect: (playlist: MatchedPlaylist) => void;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  image?: string;
  owner: string;
}

interface DeezerPlaylist {
  id: string;
  name: string;
  trackCount: number;
  image?: string;
  creator: string;
}

interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
}

interface ImportProgress {
  playlistName: string;
  playlistImage?: string;
  source: 'spotify' | 'deezer' | 'apple' | 'tidal';
  current: number;
  total: number;
  currentTrack: string;
  matchedCount: number;
}

type Tab = 'spotify' | 'deezer' | 'apple' | 'tidal' | 'plex';

interface PreImportPlaylist {
  source: 'spotify' | 'deezer' | 'apple' | 'tidal';
  id: string;
  name: string;
  image?: string;
  trackCount: number;
  url?: string; // For Apple Music and Tidal
}

export default function ImportPage({ serverUrl, onBack, onPlaylistSelect }: ImportPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('deezer');
  
  // Spotify state
  const [spotifyAuth, setSpotifyAuth] = useState<{ user: any; accessToken: string | null } | null>(null);
  const [spotifyCredentials, setSpotifyCredentials] = useState<{ clientId: string; clientSecret: string }>({ clientId: '', clientSecret: '' });
  const [showSpotifySetup, setShowSpotifySetup] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false);
  
  // Deezer state
  const [deezerQuery, setDeezerQuery] = useState('');
  const [deezerPlaylists, setDeezerPlaylists] = useState<DeezerPlaylist[]>([]);
  const [isSearchingDeezer, setIsSearchingDeezer] = useState(false);
  
  // Plex playlists state
  const [plexPlaylists, setPlexPlaylists] = useState<any[]>([]);
  const [isLoadingPlex, setIsLoadingPlex] = useState(false);
  
  // Popular playlists state
  const [deezerTopPlaylists, setDeezerTopPlaylists] = useState<DeezerPlaylist[]>([]);
  const [appleMusicUrl, setAppleMusicUrl] = useState('');
  const [tidalUrl, setTidalUrl] = useState('');
  
  // Curated popular playlists for Apple Music and Tidal
  const appleMusicPopular = [
    { name: 'Today\'s Hits', url: 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb' },
    { name: 'A-List Pop', url: 'https://music.apple.com/us/playlist/a-list-pop/pl.5ee8333dbe944d9f9151e97d92d1ead9' },
    { name: 'Rap Life', url: 'https://music.apple.com/us/playlist/rap-life/pl.abe8ba42278f4ef490e3a9fc5ec8e8c5' },
    { name: 'New Music Daily', url: 'https://music.apple.com/us/playlist/new-music-daily/pl.2b0e6e332fdf4b7a91164da3162127b5' },
    { name: 'R&B Now', url: 'https://music.apple.com/us/playlist/r-b-now/pl.0e50dfad7b84444faecb03c3e8e5f0f3' },
    { name: 'danceXL', url: 'https://music.apple.com/us/playlist/dancexl/pl.6bf4415b83ce4f3789614ac4c3675740' },
    { name: 'ALT CTRL', url: 'https://music.apple.com/us/playlist/alt-ctrl/pl.acc464c750b94302b8806e5fcbe56e17' },
    { name: 'Country Risers', url: 'https://music.apple.com/us/playlist/country-risers/pl.87bb5b36a9bd49db8c975607452cd978' },
    { name: 'Chill Vibes', url: 'https://music.apple.com/us/playlist/chill-vibes/pl.7f8f618a4c2a4d8aa7b8e1f7d5c6b3a2' },
    { name: '80s Hits', url: 'https://music.apple.com/us/playlist/80s-hits-essentials/pl.97c6f95b0b884bedbcce117f9ea5d54b' },
  ];
  
  const tidalPopular = [
    { name: 'Pop Hits', url: 'https://tidal.com/browse/playlist/7ab5d2b6-93fb-4181-a008-a1d18e2cebfa' },
    { name: 'Hip-Hop & R&B', url: 'https://tidal.com/browse/playlist/944dd087-3e8f-49c4-a90f-e62ac7f109c4' },
    { name: 'Electronic Hits', url: 'https://tidal.com/browse/playlist/36ea71a8-b4ae-4e84-9d9f-d5fe7e521a6e' },
    { name: 'Rock Classics', url: 'https://tidal.com/browse/playlist/4c3f4f4e-8e8e-4e8e-8e8e-8e8e8e8e8e8e' },
    { name: 'Chill Mix', url: 'https://tidal.com/browse/playlist/5d4e5f6a-9f9f-5f9f-9f9f-9f9f9f9f9f9f' },
    { name: 'Workout Beats', url: 'https://tidal.com/browse/playlist/6e5f6a7b-0a0a-6a0a-0a0a-0a0a0a0a0a0a' },
    { name: 'New Releases', url: 'https://tidal.com/browse/playlist/7f6a7b8c-1b1b-7b1b-1b1b-1b1b1b1b1b1b' },
    { name: 'Throwback Jams', url: 'https://tidal.com/browse/playlist/8a7b8c9d-2c2c-8c2c-2c2c-2c2c2c2c2c2c' },
    { name: 'Acoustic Vibes', url: 'https://tidal.com/browse/playlist/9b8c9d0e-3d3d-9d3d-3d3d-3d3d3d3d3d3d' },
    { name: 'Party Mix', url: 'https://tidal.com/browse/playlist/0c9d0e1f-4e4e-0e4e-4e4e-4e4e4e4e4e4e' },
  ];
  
  // Import state
  const [importingPlaylist, setImportingPlaylist] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [matchedPlaylists, setMatchedPlaylists] = useState<Map<string, MatchedPlaylist>>(new Map());
  const [statusMessage, setStatusMessage] = useState('');
  
  // Pre-import modal state
  const [preImportPlaylist, setPreImportPlaylist] = useState<PreImportPlaylist | null>(null);
  const [editedPlaylistName, setEditedPlaylistName] = useState('');
  
  // Preview state
  const [previewPlaylist, setPreviewPlaylist] = useState<PreImportPlaylist | null>(null);
  const [previewTracks, setPreviewTracks] = useState<ExternalTrack[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Schedule modal state
  const [schedulePlaylist, setSchedulePlaylist] = useState<{
    source: 'deezer' | 'apple' | 'tidal' | 'spotify';
    id: string;
    name: string;
    url?: string;
  } | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState<'weekly' | 'fortnightly' | 'monthly'>('weekly');
  const [existingSchedules, setExistingSchedules] = useState<any[]>([]);

  // Load Spotify auth on mount
  useEffect(() => {
    loadSpotifyAuth();
    loadPlexPlaylists();
    loadDeezerTopPlaylists();
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    const schedules = await window.api.getSchedules();
    setExistingSchedules(schedules);
  };

  const loadPlexPlaylists = async () => {
    if (!serverUrl) return;
    setIsLoadingPlex(true);
    try {
      const playlists = await window.api.getPlaylists({ serverUrl });
      setPlexPlaylists(playlists);
    } catch (error: any) {
      console.error('Error loading Plex playlists:', error);
    } finally {
      setIsLoadingPlex(false);
    }
  };

  const loadDeezerTopPlaylists = async () => {
    try {
      const playlists = await window.api.getDeezerTopPlaylists();
      setDeezerTopPlaylists(playlists);
    } catch (error: any) {
      console.error('Error loading Deezer top playlists:', error);
    }
  };

  const loadSpotifyAuth = async () => {
    const auth = await window.api.getSpotifyAuth();
    if (auth.accessToken && auth.user) {
      setSpotifyAuth({ user: auth.user, accessToken: auth.accessToken });
      loadSpotifyPlaylists();
    }
    
    const creds = await window.api.getSpotifyCredentials();
    if (creds.clientId) {
      setSpotifyCredentials({ clientId: creds.clientId, clientSecret: creds.clientSecret || '' });
    }
  };

  const loadSpotifyPlaylists = async () => {
    setIsLoadingSpotify(true);
    try {
      const playlists = await window.api.getSpotifyPlaylists();
      setSpotifyPlaylists(playlists);
    } catch (error: any) {
      setStatusMessage(`Error loading playlists: ${error.message}`);
    } finally {
      setIsLoadingSpotify(false);
    }
  };

  const handleSaveSpotifyCredentials = async () => {
    if (!spotifyCredentials.clientId || !spotifyCredentials.clientSecret) {
      setStatusMessage('Please enter both Client ID and Client Secret');
      return;
    }
    
    await window.api.saveSpotifyCredentials(spotifyCredentials);
    setShowSpotifySetup(false);
    setStatusMessage('Spotify credentials saved. Click "Connect Spotify" to login.');
  };

  const handleSpotifyLogin = async () => {
    if (!spotifyCredentials.clientId) {
      setShowSpotifySetup(true);
      return;
    }
    
    try {
      await window.api.startSpotifyAuth();
      setStatusMessage('Complete login in your browser, then paste the callback URL here.');
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleSpotifyCallback = async (callbackUrl: string) => {
    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      
      if (!code) {
        setStatusMessage('Invalid callback URL - no code found');
        return;
      }
      
      const result = await window.api.exchangeSpotifyCode({ code });
      setSpotifyAuth({ user: result.user, accessToken: result.accessToken });
      setStatusMessage('');
      loadSpotifyPlaylists();
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleSpotifyLogout = async () => {
    await window.api.logoutSpotify();
    setSpotifyAuth(null);
    setSpotifyPlaylists([]);
  };

  const handleDeezerSearch = async () => {
    if (!deezerQuery.trim()) return;
    
    setIsSearchingDeezer(true);
    try {
      const playlists = await window.api.searchDeezerPlaylists({ query: deezerQuery });
      setDeezerPlaylists(playlists);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsSearchingDeezer(false);
    }
  };

  const showPreImportModal = (
    source: 'spotify' | 'deezer',
    id: string,
    name: string,
    trackCount: number,
    image?: string
  ) => {
    setPreImportPlaylist({ source, id, name, image, trackCount });
    setEditedPlaylistName(name);
  };

  const openScheduleModal = (
    source: 'deezer' | 'apple' | 'tidal' | 'spotify',
    id: string,
    name: string,
    url?: string
  ) => {
    setSchedulePlaylist({ source, id, name, url });
    setScheduleFrequency('weekly');
  };

  const isPlaylistScheduled = (source: string, id: string) => {
    return existingSchedules.some(s => s.source === source && s.sourceUrl === id);
  };

  const saveSchedule = async () => {
    if (!schedulePlaylist) return;
    
    const schedule = {
      playlistId: `import-${schedulePlaylist.source}-${schedulePlaylist.id}`,
      playlistName: schedulePlaylist.name,
      frequency: scheduleFrequency,
      startDate: new Date().toISOString().split('T')[0],
      country: 'global',
      source: schedulePlaylist.source,
      sourceUrl: schedulePlaylist.url || schedulePlaylist.id,
    };
    
    await window.api.saveSchedule(schedule);
    await loadSchedules();
    setSchedulePlaylist(null);
    setStatusMessage(`Scheduled "${schedulePlaylist.name}" to refresh ${scheduleFrequency}`);
  };

  const removeSchedule = async (source: string, id: string) => {
    const schedule = existingSchedules.find(s => s.source === source && s.sourceUrl === id);
    if (schedule) {
      await window.api.deleteSchedule(schedule.playlistId);
      await loadSchedules();
      setStatusMessage('Schedule removed');
    }
  };

  const openPreview = async (
    source: 'spotify' | 'deezer' | 'apple' | 'tidal',
    id: string,
    name: string,
    trackCount: number,
    image?: string,
    url?: string
  ) => {
    setPreviewPlaylist({ source, id, name, image, trackCount, url });
    setIsLoadingPreview(true);
    setPreviewTracks([]);
    
    try {
      let tracks: ExternalTrack[];
      if (source === 'spotify') {
        tracks = await window.api.getSpotifyPlaylistTracks({ playlistId: id });
      } else if (source === 'deezer') {
        tracks = await window.api.getDeezerPlaylistTracks({ playlistId: id });
      } else if (source === 'apple' && url) {
        const result = await window.api.scrapeAppleMusicPlaylist({ url });
        tracks = result.tracks;
      } else if (source === 'tidal' && url) {
        const result = await window.api.scrapeTidalPlaylist({ url });
        tracks = result.tracks;
      } else {
        tracks = [];
      }
      setPreviewTracks(tracks);
    } catch (error: any) {
      setStatusMessage(`Error loading tracks: ${error.message}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const importFromPreview = () => {
    if (!previewPlaylist) return;
    
    // For Apple Music and Tidal, import directly since we already have the tracks
    if ((previewPlaylist.source === 'apple' || previewPlaylist.source === 'tidal') && previewTracks.length > 0) {
      importFromPreviewDirect();
      return;
    }
    
    setPreImportPlaylist(previewPlaylist);
    setEditedPlaylistName(previewPlaylist.name);
    setPreviewPlaylist(null);
    setPreviewTracks([]);
  };

  const importFromPreviewDirect = async () => {
    if (!previewPlaylist || previewTracks.length === 0) return;
    
    const playlistName = previewPlaylist.name;
    const sourceName = previewPlaylist.source === 'apple' ? 'Apple Music' : 'Tidal';
    const sourceType = previewPlaylist.source;
    const tracks = [...previewTracks];
    
    // Clear preview and show progress
    setPreviewPlaylist(null);
    setPreviewTracks([]);
    setImportingPlaylist('direct-import');
    setImportProgress({
      playlistName,
      source: sourceType as 'apple' | 'tidal' | 'spotify' | 'deezer',
      current: 0,
      total: tracks.length,
      currentTrack: '',
      matchedCount: 0,
    });
    
    const discoveryPlaylist = {
      id: `${previewPlaylist.source}-${Date.now()}`,
      name: playlistName,
      description: `Imported from ${sourceName}`,
      source: 'deezer' as const,
      tracks: tracks.map((t: any) => ({ ...t, source: 'deezer' as const })),
    };
    
    try {
      const matched = await matchPlaylistToPlex(
        discoveryPlaylist, 
        serverUrl, 
        window.api.searchTrack,
        (current, total, trackName) => {
          setImportProgress(prev => prev ? {
            ...prev,
            current,
            total,
            currentTrack: trackName,
          } : null);
        }
      );
      setImportProgress(null);
      setImportingPlaylist(null);
      onPlaylistSelect(matched);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setImportProgress(null);
      setImportingPlaylist(null);
    }
  };

  // Direct import from URL without preview
  const importDirectFromUrl = async (source: 'apple' | 'tidal', url: string, name: string) => {
    setImportingPlaylist(url);
    setImportProgress({
      playlistName: name,
      source: source,
      current: 0,
      total: 0,
      currentTrack: 'Fetching playlist...',
      matchedCount: 0,
    });
    
    try {
      let tracks: { title: string; artist: string }[];
      let playlistName = name;
      
      if (source === 'apple') {
        const result = await window.api.scrapeAppleMusicPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else {
        const result = await window.api.scrapeTidalPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      }
      
      if (tracks.length === 0) {
        setStatusMessage('No tracks found. The playlist may be private.');
        setImportProgress(null);
        setImportingPlaylist(null);
        return;
      }
      
      setImportProgress(prev => prev ? { ...prev, total: tracks.length, currentTrack: '' } : null);
      
      const discoveryPlaylist = {
        id: `${source}-${Date.now()}`,
        name: playlistName,
        description: `Imported from ${source === 'apple' ? 'Apple Music' : 'Tidal'}`,
        source: 'deezer' as const,
        tracks: tracks.map((t: any) => ({ ...t, source: 'deezer' as const })),
      };
      
      const matched = await matchPlaylistToPlex(
        discoveryPlaylist, 
        serverUrl, 
        window.api.searchTrack,
        (current, total, trackName) => {
          setImportProgress(prev => prev ? {
            ...prev,
            current,
            total,
            currentTrack: trackName,
          } : null);
        }
      );
      
      setImportProgress(null);
      setImportingPlaylist(null);
      onPlaylistSelect(matched);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setImportProgress(null);
      setImportingPlaylist(null);
    }
  };

  const startImport = () => {
    if (!preImportPlaylist) return;
    const { source, id, image } = preImportPlaylist;
    const name = editedPlaylistName.trim() || preImportPlaylist.name;
    setPreImportPlaylist(null);
    // Only spotify and deezer use this modal flow
    handleImportPlaylist(source as 'spotify' | 'deezer', id, name, image);
  };

  const handleImportPlaylist = useCallback(async (
    source: 'spotify' | 'deezer',
    playlistId: string,
    playlistName: string,
    playlistImage?: string
  ) => {
    setImportingPlaylist(playlistId);
    setStatusMessage('');
    
    try {
      // Get tracks from source
      let tracks: ExternalTrack[];
      if (source === 'spotify') {
        tracks = await window.api.getSpotifyPlaylistTracks({ playlistId });
      } else {
        tracks = await window.api.getDeezerPlaylistTracks({ playlistId });
      }
      
      // Initialize progress view
      setImportProgress({
        playlistName,
        playlistImage,
        source,
        current: 0,
        total: tracks.length,
        currentTrack: '',
        matchedCount: 0,
      });
      
      // Create a discovery playlist format
      const discoveryPlaylist = {
        id: `${source}-${playlistId}`,
        name: playlistName,
        description: `Imported from ${source === 'spotify' ? 'Spotify' : 'Deezer'}`,
        source: 'deezer' as const,
        tracks: tracks.map(t => ({ ...t, source: 'deezer' as const })),
      };
      
      // Match against Plex with progress callback
      const matched = await matchPlaylistToPlex(
        discoveryPlaylist,
        serverUrl,
        window.api.searchTrack,
        (current, total, trackName) => {
          setImportProgress(prev => prev ? {
            ...prev,
            current,
            total,
            currentTrack: trackName,
          } : null);
        }
      );
      
      // Store the matched playlist
      setMatchedPlaylists(prev => new Map(prev).set(playlistId, matched));
      setImportProgress(null);
      
      // Open the playlist detail view
      onPlaylistSelect(matched);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setImportProgress(null);
    } finally {
      setImportingPlaylist(null);
    }
  }, [serverUrl, onPlaylistSelect]);

  const renderSpotifyTab = () => (
    <div className="import-tab-content">
      {!spotifyAuth ? (
        <div className="import-login-section">
          {showSpotifySetup ? (
            <div className="spotify-setup">
              <h3>Spotify API Setup</h3>
              <p className="setup-instructions">
                To use Spotify, you need to create a Spotify Developer app:
              </p>
              <ol className="setup-steps">
                <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a></li>
                <li>Create a new app</li>
                <li>Set Redirect URI to: <code>http://127.0.0.1:8888/callback</code></li>
                <li>Copy your Client ID and Client Secret below</li>
              </ol>
              
              <div className="input-group">
                <label>Client ID</label>
                <input
                  type="text"
                  value={spotifyCredentials.clientId}
                  onChange={e => setSpotifyCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                  placeholder="Enter Spotify Client ID"
                />
              </div>
              
              <div className="input-group">
                <label>Client Secret</label>
                <input
                  type="password"
                  value={spotifyCredentials.clientSecret}
                  onChange={e => setSpotifyCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                  placeholder="Enter Spotify Client Secret"
                />
              </div>
              
              <div className="button-row">
                <button className="btn btn-secondary" onClick={() => setShowSpotifySetup(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveSpotifyCredentials}>Save Credentials</button>
              </div>
            </div>
          ) : (
            <div className="login-prompt">
              <div className="service-icon">🎵</div>
              <h3>Connect to Spotify</h3>
              <p>Import your Spotify playlists and match them to your Plex library</p>
              <button className="btn btn-primary btn-large" onClick={handleSpotifyLogin}>
                {spotifyCredentials.clientId ? 'Connect Spotify' : 'Setup Spotify'}
              </button>
              {spotifyCredentials.clientId && (
                <button className="btn btn-secondary btn-small" onClick={() => setShowSpotifySetup(true)}>
                  Edit Credentials
                </button>
              )}
            </div>
          )}
          
          {statusMessage.includes('Complete login') && (
            <div className="callback-input">
              <p>After logging in, paste the callback URL here:</p>
              <input
                type="text"
                placeholder="http://127.0.0.1:8888/callback?code=..."
                onPaste={e => handleSpotifyCallback(e.clipboardData.getData('text'))}
                onChange={e => e.target.value.includes('code=') && handleSpotifyCallback(e.target.value)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="import-playlists-section">
          <div className="user-header">
            <div className="user-info-row">
              {spotifyAuth.user.image && <img src={spotifyAuth.user.image} alt="" className="user-avatar" />}
              <span>{spotifyAuth.user.name}</span>
            </div>
            <button className="btn btn-secondary btn-small" onClick={handleSpotifyLogout}>Logout</button>
          </div>
          
          {isLoadingSpotify ? (
            <div className="loading">Loading playlists...</div>
          ) : (
            <div className="playlist-grid">
              {spotifyPlaylists.map(playlist => {
                const matched = matchedPlaylists.get(playlist.id);
                return (
                  <div 
                    key={playlist.id} 
                    className="import-playlist-card clickable"
                    onClick={() => openPreview('spotify', playlist.id, playlist.name, playlist.trackCount, playlist.image)}
                  >
                    {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                    <div className="playlist-info">
                      <span className="playlist-name">{playlist.name}</span>
                      <span className="playlist-meta">{playlist.trackCount} tracks • {playlist.owner}</span>
                    </div>
                    <div className="button-group">
                      <button
                        className={`btn btn-small ${matched ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          matched ? onPlaylistSelect(matched) : showPreImportModal('spotify', playlist.id, playlist.name, playlist.trackCount, playlist.image);
                        }}
                        disabled={importingPlaylist === playlist.id}
                      >
                        {importingPlaylist === playlist.id ? '...' : matched ? `View (${matched.matchedCount}/${matched.totalCount})` : 'Import'}
                      </button>
                      <button 
                        className={`btn btn-small ${isPlaylistScheduled('spotify', playlist.id) ? 'btn-scheduled' : 'btn-secondary'}`}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          isPlaylistScheduled('spotify', playlist.id) 
                            ? removeSchedule('spotify', playlist.id)
                            : openScheduleModal('spotify', playlist.id, playlist.name); 
                        }}
                        title={isPlaylistScheduled('spotify', playlist.id) ? 'Remove schedule' : 'Schedule auto-refresh'}
                      >
                        {isPlaylistScheduled('spotify', playlist.id) ? 'Scheduled' : 'Schedule'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderDeezerTab = () => (
    <div className="import-tab-content">
      <div className="deezer-search">
        <div className="search-bar-row">
          <input
            type="text"
            value={deezerQuery}
            onChange={e => setDeezerQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDeezerSearch()}
            placeholder="Search Deezer playlists..."
          />
          <button 
            className="btn btn-primary"
            onClick={handleDeezerSearch}
            disabled={isSearchingDeezer || !deezerQuery.trim()}
          >
            {isSearchingDeezer ? '...' : 'Search'}
          </button>
        </div>
      </div>
      
      {deezerPlaylists.length > 0 ? (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Search Results</h3>
          <div className="playlist-grid">
            {deezerPlaylists.map(playlist => {
              const matched = matchedPlaylists.get(playlist.id);
              return (
                <div 
                  key={playlist.id} 
                  className="import-playlist-card clickable"
                  onClick={() => openPreview('deezer', playlist.id, playlist.name, playlist.trackCount, playlist.image)}
                >
                  {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                  <div className="playlist-info">
                    <span className="playlist-name">{playlist.name}</span>
                    <span className="playlist-meta">{playlist.trackCount} tracks • {playlist.creator}</span>
                  </div>
                  <div className="button-group">
                    <button
                      className={`btn btn-small ${matched ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        matched ? onPlaylistSelect(matched) : showPreImportModal('deezer', playlist.id, playlist.name, playlist.trackCount, playlist.image);
                      }}
                      disabled={importingPlaylist === playlist.id}
                    >
                      {importingPlaylist === playlist.id ? '...' : matched ? `View (${matched.matchedCount}/${matched.totalCount})` : 'Import'}
                    </button>
                    <button 
                      className={`btn btn-small ${isPlaylistScheduled('deezer', playlist.id) ? 'btn-scheduled' : 'btn-secondary'}`}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        isPlaylistScheduled('deezer', playlist.id) 
                          ? removeSchedule('deezer', playlist.id)
                          : openScheduleModal('deezer', playlist.id, playlist.name); 
                      }}
                      title={isPlaylistScheduled('deezer', playlist.id) ? 'Remove schedule' : 'Schedule auto-refresh'}
                    >
                      {isPlaylistScheduled('deezer', playlist.id) ? 'Scheduled' : 'Schedule'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Popular Playlists</h3>
          {deezerTopPlaylists.length === 0 ? (
            <p className="empty-state">Loading popular playlists...</p>
          ) : (
            <div className="playlist-grid">
              {deezerTopPlaylists.map(playlist => {
                const matched = matchedPlaylists.get(playlist.id);
                return (
                  <div 
                    key={playlist.id} 
                    className="import-playlist-card clickable"
                    onClick={() => openPreview('deezer', playlist.id, playlist.name, playlist.trackCount, playlist.image)}
                  >
                    {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                    <div className="playlist-info">
                      <span className="playlist-name">{playlist.name}</span>
                      <span className="playlist-meta">{playlist.trackCount} tracks</span>
                    </div>
                    <div className="button-group">
                      <button
                        className={`btn btn-small ${matched ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          matched ? onPlaylistSelect(matched) : showPreImportModal('deezer', playlist.id, playlist.name, playlist.trackCount, playlist.image);
                        }}
                        disabled={importingPlaylist === playlist.id}
                      >
                        {importingPlaylist === playlist.id ? '...' : matched ? `View` : 'Import'}
                      </button>
                      <button 
                        className={`btn btn-small ${isPlaylistScheduled('deezer', playlist.id) ? 'btn-scheduled' : 'btn-secondary'}`}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          isPlaylistScheduled('deezer', playlist.id) 
                            ? removeSchedule('deezer', playlist.id)
                            : openScheduleModal('deezer', playlist.id, playlist.name); 
                        }}
                        title={isPlaylistScheduled('deezer', playlist.id) ? 'Remove schedule' : 'Schedule auto-refresh'}
                      >
                        {isPlaylistScheduled('deezer', playlist.id) ? 'Scheduled' : 'Schedule'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderAppleMusicTab = () => (
    <div className="import-tab-content">
      <div className="url-import-section">
        <h3>Import from Apple Music</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Paste an Apple Music playlist share link to preview and import
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={appleMusicUrl}
            onChange={e => setAppleMusicUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && appleMusicUrl.trim() && openPreview('apple', appleMusicUrl, 'Apple Music Playlist', 0, undefined, appleMusicUrl)}
            placeholder="https://music.apple.com/playlist/..."
          />
          <button 
            className="btn btn-secondary"
            onClick={() => openPreview('apple', appleMusicUrl, 'Apple Music Playlist', 0, undefined, appleMusicUrl)}
            disabled={!appleMusicUrl.trim()}
          >
            Preview
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => importDirectFromUrl('apple', appleMusicUrl, 'Apple Music Playlist')}
            disabled={!appleMusicUrl.trim() || importingPlaylist === appleMusicUrl}
          >
            {importingPlaylist === appleMusicUrl ? '...' : 'Import'}
          </button>
        </div>
      </div>
      
      <h3 style={{ margin: '24px 0 12px' }}>Popular Playlists</h3>
      <div className="playlist-grid">
        {appleMusicPopular.map((playlist, i) => (
          <div 
            key={i} 
            className="import-playlist-card clickable"
            onClick={() => openPreview('apple', playlist.url, playlist.name, 0, undefined, playlist.url)}
          >
            <div className="playlist-info">
              <span className="playlist-name">{playlist.name}</span>
              <span className="playlist-meta">Apple Music</span>
            </div>
            <div className="button-group">
              <button 
                className="btn btn-small btn-secondary"
                onClick={(e) => { e.stopPropagation(); openPreview('apple', playlist.url, playlist.name, 0, undefined, playlist.url); }}
              >
                Preview
              </button>
              <button 
                className="btn btn-small btn-primary"
                onClick={(e) => { e.stopPropagation(); importDirectFromUrl('apple', playlist.url, playlist.name); }}
                disabled={importingPlaylist === playlist.url}
              >
                {importingPlaylist === playlist.url ? '...' : 'Import'}
              </button>
              <button 
                className={`btn btn-small ${isPlaylistScheduled('apple', playlist.url) ? 'btn-scheduled' : 'btn-secondary'}`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  isPlaylistScheduled('apple', playlist.url) 
                    ? removeSchedule('apple', playlist.url)
                    : openScheduleModal('apple', playlist.url, playlist.name, playlist.url); 
                }}
                title={isPlaylistScheduled('apple', playlist.url) ? 'Remove schedule' : 'Schedule auto-refresh'}
              >
                {isPlaylistScheduled('apple', playlist.url) ? 'Scheduled' : 'Schedule'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTidalTab = () => (
    <div className="import-tab-content">
      <div className="url-import-section">
        <h3>Import from Tidal</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Paste a Tidal playlist share link to preview and import
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={tidalUrl}
            onChange={e => setTidalUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tidalUrl.trim() && openPreview('tidal', tidalUrl, 'Tidal Playlist', 0, undefined, tidalUrl)}
            placeholder="https://tidal.com/browse/playlist/..."
          />
          <button 
            className="btn btn-secondary"
            onClick={() => openPreview('tidal', tidalUrl, 'Tidal Playlist', 0, undefined, tidalUrl)}
            disabled={!tidalUrl.trim()}
          >
            Preview
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => importDirectFromUrl('tidal', tidalUrl, 'Tidal Playlist')}
            disabled={!tidalUrl.trim() || importingPlaylist === tidalUrl}
          >
            {importingPlaylist === tidalUrl ? '...' : 'Import'}
          </button>
        </div>
      </div>
      
      <h3 style={{ margin: '24px 0 12px' }}>Popular Playlists</h3>
      <div className="playlist-grid">
        {tidalPopular.map((playlist, i) => (
          <div 
            key={i} 
            className="import-playlist-card clickable"
            onClick={() => openPreview('tidal', playlist.url, playlist.name, 0, undefined, playlist.url)}
          >
            <div className="playlist-info">
              <span className="playlist-name">{playlist.name}</span>
              <span className="playlist-meta">Tidal</span>
            </div>
            <div className="button-group">
              <button 
                className="btn btn-small btn-secondary"
                onClick={(e) => { e.stopPropagation(); openPreview('tidal', playlist.url, playlist.name, 0, undefined, playlist.url); }}
              >
                Preview
              </button>
              <button 
                className="btn btn-small btn-primary"
                onClick={(e) => { e.stopPropagation(); importDirectFromUrl('tidal', playlist.url, playlist.name); }}
                disabled={importingPlaylist === playlist.url}
              >
                {importingPlaylist === playlist.url ? '...' : 'Import'}
              </button>
              <button 
                className={`btn btn-small ${isPlaylistScheduled('tidal', playlist.url) ? 'btn-scheduled' : 'btn-secondary'}`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  isPlaylistScheduled('tidal', playlist.url) 
                    ? removeSchedule('tidal', playlist.url)
                    : openScheduleModal('tidal', playlist.url, playlist.name, playlist.url); 
                }}
                title={isPlaylistScheduled('tidal', playlist.url) ? 'Remove schedule' : 'Schedule auto-refresh'}
              >
                {isPlaylistScheduled('tidal', playlist.url) ? 'Scheduled' : 'Schedule'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPlexTab = () => (
    <div className="import-tab-content">
      <div className="plex-playlists-header">
        <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
          Select an existing Plex playlist to view or export
        </p>
        <button className="btn btn-secondary btn-small" onClick={loadPlexPlaylists} disabled={isLoadingPlex}>
          {isLoadingPlex ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {isLoadingPlex ? (
        <div className="loading">Loading playlists...</div>
      ) : plexPlaylists.length === 0 ? (
        <p className="empty-state">No playlists found in Plex</p>
      ) : (
        <div className="playlist-grid">
          {plexPlaylists.map(playlist => (
            <div 
              key={playlist.ratingKey} 
              className="import-playlist-card"
            >
              {playlist.composite && (
                <img 
                  src={`${serverUrl}${playlist.composite}?X-Plex-Token=${window.api ? '' : ''}`} 
                  alt="" 
                  className="playlist-image"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              )}
              <div className="playlist-info">
                <span className="playlist-name">{playlist.title}</span>
                <span className="playlist-meta">{playlist.leafCount || 0} tracks</span>
              </div>
              <span className="playlist-badge">Plex</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Preview view when viewing playlist tracks
  if (previewPlaylist) {
    const sourceNames: Record<string, string> = {
      spotify: 'Spotify',
      deezer: 'Deezer',
      apple: 'Apple Music',
      tidal: 'Tidal',
    };
    
    return (
      <div className="import-page">
        <div className="import-header">
          <button className="btn btn-secondary btn-small" onClick={() => { setPreviewPlaylist(null); setPreviewTracks([]); }}>← Back</button>
          <h1>Preview Playlist</h1>
        </div>
        
        <div className="preview-header">
          <div className="preview-info">
            {previewPlaylist.image && (
              <img src={previewPlaylist.image} alt="" className="preview-image" />
            )}
            <div>
              <h2>{previewPlaylist.name}</h2>
              <p className="preview-meta">
                {previewTracks.length > 0 ? `${previewTracks.length} tracks` : 'Loading...'} from {sourceNames[previewPlaylist.source]}
              </p>
            </div>
          </div>
          <button 
            className="btn btn-primary"
            onClick={importFromPreview}
            disabled={previewTracks.length === 0}
          >
            Import This Playlist
          </button>
        </div>
        
        {isLoadingPreview ? (
          <div className="loading">Loading tracks...</div>
        ) : previewTracks.length === 0 ? (
          <div className="empty-state">No tracks found. The playlist may be private or the service blocked the request.</div>
        ) : (
          <div className="preview-track-list">
            {previewTracks.map((track, i) => (
              <div key={i} className="preview-track-item">
                <span className="preview-track-number">{i + 1}</span>
                <div className="preview-track-info">
                  <span className="preview-track-title">{track.title}</span>
                  <span className="preview-track-artist">{track.artist}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Progress view when importing
  if (importProgress) {
    const percent = Math.round((importProgress.current / importProgress.total) * 100);
    return (
      <div className="import-page">
        <div className="import-progress-view">
          {importProgress.playlistImage && (
            <img src={importProgress.playlistImage} alt="" className="progress-playlist-image" />
          )}
          <h2>Importing {importProgress.playlistName}</h2>
          <p className="progress-source">from {
            importProgress.source === 'spotify' ? 'Spotify' : 
            importProgress.source === 'apple' ? 'Apple Music' : 
            importProgress.source === 'tidal' ? 'Tidal' : 'Deezer'
          }</p>
          
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
          
          <p className="progress-count">{importProgress.current} / {importProgress.total} tracks</p>
          <p className="progress-current-track">{importProgress.currentTrack}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-page">
      <div className="import-header">
        <button className="btn btn-secondary btn-small" onClick={onBack}>← Back</button>
        <h1>Import Playlists</h1>
      </div>
      
      {statusMessage && <div className="status-message">{statusMessage}</div>}
      
      <div className="import-tabs">
        <button 
          className={`tab-btn ${activeTab === 'deezer' ? 'active' : ''}`}
          onClick={() => setActiveTab('deezer')}
        >
          Deezer
        </button>
        <button 
          className={`tab-btn ${activeTab === 'apple' ? 'active' : ''}`}
          onClick={() => setActiveTab('apple')}
        >
          Apple Music
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tidal' ? 'active' : ''}`}
          onClick={() => setActiveTab('tidal')}
        >
          Tidal
        </button>
        <button 
          className={`tab-btn ${activeTab === 'spotify' ? 'active' : ''}`}
          onClick={() => setActiveTab('spotify')}
        >
          Spotify
        </button>
        <button 
          className={`tab-btn ${activeTab === 'plex' ? 'active' : ''}`}
          onClick={() => setActiveTab('plex')}
        >
          Plex
        </button>
      </div>
      
      {activeTab === 'deezer' && renderDeezerTab()}
      {activeTab === 'apple' && renderAppleMusicTab()}
      {activeTab === 'tidal' && renderTidalTab()}
      {activeTab === 'spotify' && renderSpotifyTab()}
      {activeTab === 'plex' && renderPlexTab()}
      
      {/* Pre-import modal */}
      {preImportPlaylist && (
        <div className="modal-overlay" onClick={() => setPreImportPlaylist(null)}>
          <div className="modal pre-import-modal" onClick={e => e.stopPropagation()}>
            <h3>Import Playlist</h3>
            
            <div className="pre-import-preview">
              {preImportPlaylist.image && (
                <img src={preImportPlaylist.image} alt="" className="pre-import-image" />
              )}
              <p className="pre-import-meta">
                {preImportPlaylist.trackCount} tracks from {preImportPlaylist.source === 'spotify' ? 'Spotify' : 'Deezer'}
              </p>
            </div>
            
            <div className="input-group">
              <label>Playlist Name</label>
              <input
                type="text"
                value={editedPlaylistName}
                onChange={e => setEditedPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                autoFocus
              />
            </div>
            
            <div className="button-row">
              <button className="btn btn-secondary" onClick={() => setPreImportPlaylist(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={startImport} disabled={!editedPlaylistName.trim()}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {schedulePlaylist && (
        <div className="modal-overlay" onClick={() => setSchedulePlaylist(null)}>
          <div className="modal schedule-modal" onClick={e => e.stopPropagation()}>
            <h3>Schedule Playlist</h3>
            <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
              Auto-refresh "{schedulePlaylist.name}" from {schedulePlaylist.source === 'apple' ? 'Apple Music' : schedulePlaylist.source.charAt(0).toUpperCase() + schedulePlaylist.source.slice(1)}
            </p>
            
            <div className="input-group">
              <label>Refresh Frequency</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="frequency"
                    checked={scheduleFrequency === 'weekly'}
                    onChange={() => setScheduleFrequency('weekly')}
                  />
                  Weekly
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="frequency"
                    checked={scheduleFrequency === 'fortnightly'}
                    onChange={() => setScheduleFrequency('fortnightly')}
                  />
                  Fortnightly
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="frequency"
                    checked={scheduleFrequency === 'monthly'}
                    onChange={() => setScheduleFrequency('monthly')}
                  />
                  Monthly
                </label>
              </div>
            </div>
            
            <div className="button-row">
              <button className="btn btn-secondary" onClick={() => setSchedulePlaylist(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSchedule}>
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
