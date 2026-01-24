/**
 * Import Page - Import playlists from Spotify and Deezer
 */

import { useState, useEffect, useCallback } from 'react';
import { MatchedPlaylist, matchPlaylistToPlex, applyPlaylistPrefix, MatchingSettings } from './discovery';

export interface ImportProgress {
  playlistName: string;
  playlistImage?: string;
  source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz';
  current: number;
  total: number;
  currentTrack: string;
  matchedCount: number;
}

interface ImportPageProps {
  serverUrl: string;
  onBack: () => void;
  onPlaylistSelect: (playlist: MatchedPlaylist) => void;
  importProgress: ImportProgress | null;
  setImportProgress: React.Dispatch<React.SetStateAction<ImportProgress | null>>;
  matchingSettings: MatchingSettings;
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

interface PreImportPlaylist {
  source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz' | 'file' | 'ai';
  id: string;
  name: string;
  image?: string;
  trackCount: number;
  url?: string;
  tracks?: { title: string; artist: string }[]; // Pre-fetched tracks for direct import
}

type Tab = 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'plex' | 'file' | 'listenbrainz' | 'ai';

export default function ImportPage({ serverUrl, onBack, onPlaylistSelect, importProgress, setImportProgress, matchingSettings }: ImportPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('deezer');
  
  // Spotify state
  const [spotifyAuth, setSpotifyAuth] = useState<{ user: any; accessToken: string | null } | null>(null);
  const [spotifyCredentials, setSpotifyCredentials] = useState<{ clientId: string; clientSecret: string }>({ clientId: '', clientSecret: '' });
  const [showSpotifySetup, setShowSpotifySetup] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState<string | null>(null); // Track URL being fetched before progress shows
  const [spotifySearchQuery, setSpotifySearchQuery] = useState('');
  const [spotifySearchResults, setSpotifySearchResults] = useState<SpotifyPlaylist[]>([]);
  const [isSearchingSpotify, setIsSearchingSpotify] = useState(false);
  
  // Deezer state (with optional login)
  const [deezerAuth, setDeezerAuth] = useState<{ user: any; accessToken: string | null } | null>(null);
  const [deezerCredentials, setDeezerCredentials] = useState<{ appId: string; appSecret: string }>({ appId: '', appSecret: '' });
  const [showDeezerSetup, setShowDeezerSetup] = useState(false);
  const [deezerUserPlaylists, setDeezerUserPlaylists] = useState<DeezerPlaylist[]>([]);
  const [isLoadingDeezerUser, setIsLoadingDeezerUser] = useState(false);
  
  // Tidal state (with optional login)
  const [tidalAuth, setTidalAuth] = useState<{ user: any; accessToken: string | null } | null>(null);
  const [tidalCredentials, setTidalCredentials] = useState<{ clientId: string; clientSecret: string }>({ clientId: '', clientSecret: '' });
  const [showTidalSetup, setShowTidalSetup] = useState(false);
  const [tidalUserPlaylists, setTidalUserPlaylists] = useState<any[]>([]);
  const [isLoadingTidalUser, setIsLoadingTidalUser] = useState(false);
  const [tidalSearchQuery, setTidalSearchQuery] = useState('');
  const [tidalSearchResults, setTidalSearchResults] = useState<any[]>([]);
  const [isSearchingTidal, setIsSearchingTidal] = useState(false);
  
  // YouTube Music state (with optional login)
  const [ytMusicAuth, setYtMusicAuth] = useState<{ user: any; accessToken: string | null } | null>(null);
  const [ytMusicCredentials, setYtMusicCredentials] = useState<{ clientId: string; clientSecret: string }>({ clientId: '', clientSecret: '' });
  const [showYtMusicSetup, setShowYtMusicSetup] = useState(false);
  const [ytMusicPlaylists, setYtMusicPlaylists] = useState<any[]>([]);
  const [isLoadingYtMusic, setIsLoadingYtMusic] = useState(false);
  const [ytMusicUrl, setYtMusicUrl] = useState('');
  
  // Amazon Music state (URL only - no API)
  const [amazonMusicUrl, setAmazonMusicUrl] = useState('');
  
  // Qobuz state (URL only - limited API)
  const [qobuzUrl, setQobuzUrl] = useState('');
  
  // File import state (M3U/M3U8)
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [iTunesPlaylists, setiTunesPlaylists] = useState<{ name: string; trackCount: number; tracks: { title: string; artist: string }[] }[]>([]);
  
  // ListenBrainz state
  const [listenBrainzUsername, setListenBrainzUsername] = useState('');
  const [listenBrainzPlaylists, setListenBrainzPlaylists] = useState<{ id: string; name: string; trackCount: number; type?: string }[]>([]);
  const [isLoadingListenBrainz, setIsLoadingListenBrainz] = useState(false);
  
  // AI Playlist state
  const [aiProvider, setAiProvider] = useState<'groq' | 'openai'>('groq');
  const [aiApiKey, setAiApiKey] = useState<string>('');
  const [aiApiKeySaved, setAiApiKeySaved] = useState<boolean | null>(null); // null = loading, false = no saved key, true = has saved key
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTrackCount, setAiTrackCount] = useState(25);
  const [aiGeneratedTracks, setAiGeneratedTracks] = useState<{ title: string; artist: string }[]>([]);
  const [aiPlaylistName, setAiPlaylistName] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
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

  // Curated popular playlists for YouTube Music
  const youtubePopular = [
    { name: 'Today\'s Biggest Hits', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs' },
    { name: 'Pop Hotlist', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_n9Fbdw7e6ap-98fLY_GkKPDNOwfEGnCPg' },
    { name: 'Hip-Hop Hotlist', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_lBNUteBRencHzKelu5iDHwLF6mYqjL-JU' },
    { name: 'Rock Hotlist', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_mfut9V_o1n9nVG_m5yZ3ztCif29AHUffI' },
    { name: 'Chill Hits', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_n8mHAKaloLc5ub3lKfrKPSM-YLsaJbKgE' },
    { name: 'Workout Beats', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_kLWIr9gv1XLlPbaDS965-Db4TrYPya0bU' },
    { name: 'Feel Good', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_lXWhlJsAulOMsGj5_yyMXoYr3ZPJ0GKbM' },
    { name: 'Dance Pop', url: 'https://music.youtube.com/playlist?list=RDCLAK5uy_kuo04hnIGNq5dG08-bxBvMmWgh-f5nKYY' },
  ];

  // Curated popular playlists for Amazon Music
  const amazonPopular = [
    { name: 'Top 50 Global', url: 'https://music.amazon.com/playlists/B07GWJLQKP' },
    { name: 'Pop Culture', url: 'https://music.amazon.com/playlists/B01M1KW1JQ' },
    { name: 'Hip-Hop Central', url: 'https://music.amazon.com/playlists/B01LZ7BQHK' },
    { name: 'Rock Classics', url: 'https://music.amazon.com/playlists/B07D8QXKPN' },
    { name: 'Chill Out', url: 'https://music.amazon.com/playlists/B07GWTQXKP' },
    { name: 'Workout', url: 'https://music.amazon.com/playlists/B07D8QXKPM' },
    { name: 'Country Heat', url: 'https://music.amazon.com/playlists/B01M1KW1JR' },
    { name: 'R&B Rotation', url: 'https://music.amazon.com/playlists/B07GWTQXKQ' },
  ];

  // Curated popular playlists for Qobuz
  const qobuzPopular = [
    { name: 'Qobuz Weekly', url: 'https://www.qobuz.com/us-en/playlist/qobuz-weekly' },
    { name: 'New This Week', url: 'https://www.qobuz.com/us-en/playlist/new-this-week' },
    { name: 'Hi-Res Essentials', url: 'https://www.qobuz.com/us-en/playlist/hi-res-essentials' },
    { name: 'Jazz Essentials', url: 'https://www.qobuz.com/us-en/playlist/jazz-essentials' },
    { name: 'Classical Essentials', url: 'https://www.qobuz.com/us-en/playlist/classical-essentials' },
    { name: 'Audiophile Picks', url: 'https://www.qobuz.com/us-en/playlist/audiophile-picks' },
  ];
  
  // Import state
  const [importingPlaylist, setImportingPlaylist] = useState<string | null>(null);
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
    source: 'deezer' | 'apple' | 'tidal' | 'spotify' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz';
    id: string;
    name: string;
    url?: string;
    username?: string; // For ListenBrainz
  } | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'fortnightly' | 'monthly'>('weekly');
  const [existingSchedules, setExistingSchedules] = useState<any[]>([]);

  // Load auth states on mount
  useEffect(() => {
    loadSpotifyAuth();
    loadDeezerAuth();
    loadTidalAuth();
    loadYtMusicAuth();
    loadPlexPlaylists();
    loadDeezerTopPlaylists();
    loadSchedules();
    loadAiApiKey();
  }, []);

  // Load popular playlists when switching tabs (if not logged in)
  useEffect(() => {
    if (activeTab === 'deezer' && deezerTopPlaylists.length === 0) {
      loadDeezerTopPlaylists();
    }
  }, [activeTab]);

  const loadAiApiKey = async () => {
    try {
      const config = await (window.api as any).getAiConfig();
      console.log('[AI Config] Loaded:', config);
      if (config.provider && (config.provider === 'groq' || config.provider === 'openai')) {
        setAiProvider(config.provider);
      }
      setAiApiKey(config.apiKey || '');
      setAiApiKeySaved(!!config.apiKey);
    } catch (error) {
      console.error('[AI Config] Error loading:', error);
      setAiApiKey('');
      setAiApiKeySaved(false);
    }
  };

  const saveAiApiKey = async () => {
    console.log('[AI Config] Saving:', { provider: aiProvider, apiKey: aiApiKey ? '***' : '' });
    await (window.api as any).saveAiConfig({ provider: aiProvider, apiKey: aiApiKey });
    setAiApiKeySaved(true);
    setShowAiSetup(false);
    setStatusMessage(`${aiProvider === 'groq' ? 'Groq' : 'OpenAI'} API key saved`);
  };

  const generateAiPlaylist = async () => {
    if (!aiPrompt.trim() || !aiApiKey) return;
    setIsGeneratingAi(true);
    setAiGeneratedTracks([]);
    setAiPlaylistName('');
    try {
      const result = await (window.api as any).generateAiPlaylist({ 
        prompt: aiPrompt, 
        trackCount: aiTrackCount,
        apiKey: aiApiKey,
        provider: aiProvider
      });
      setAiGeneratedTracks(result.tracks);
      setAiPlaylistName(result.name || 'AI Generated Playlist');
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const importAiPlaylist = async () => {
    if (aiGeneratedTracks.length === 0) return;
    
    const playlistName = aiPlaylistName || 'AI Generated Playlist';
    setImportProgress({
      playlistName,
      source: 'spotify',
      current: 0,
      total: aiGeneratedTracks.length,
      currentTrack: '',
      matchedCount: 0,
    });
    
    const discoveryPlaylist = {
      id: `ai-${Date.now()}`,
      name: applyPlaylistPrefix(playlistName, 'ai', matchingSettings),
      description: `Generated by AI: ${aiPrompt}`,
      source: 'deezer' as const,
      tracks: aiGeneratedTracks.map(t => ({ ...t, source: 'deezer' as const })),
    };
    
    try {
      const matched = await matchPlaylistToPlex(
        discoveryPlaylist,
        serverUrl,
        window.api.searchTrack,
        (current, total, trackName) => {
          setImportProgress(prev => prev ? { ...prev, current, total, currentTrack: trackName } : null);
        }
      );
      setImportProgress(null);
      setAiGeneratedTracks([]);
      setAiPrompt('');
      onPlaylistSelect(matched);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setImportProgress(null);
    }
  };

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

  // Deezer OAuth functions
  const loadDeezerAuth = async () => {
    const auth = await window.api.getDeezerAuth();
    if (auth.accessToken && auth.user) {
      setDeezerAuth({ user: auth.user, accessToken: auth.accessToken });
      loadDeezerUserPlaylists();
    }
    const creds = await window.api.getDeezerCredentials();
    if (creds.appId) {
      setDeezerCredentials({ appId: creds.appId, appSecret: creds.appSecret || '' });
    }
  };

  const loadDeezerUserPlaylists = async () => {
    setIsLoadingDeezerUser(true);
    try {
      const playlists = await window.api.getDeezerUserPlaylists();
      setDeezerUserPlaylists(playlists);
    } catch (error: any) {
      console.error('Error loading Deezer playlists:', error);
    } finally {
      setIsLoadingDeezerUser(false);
    }
  };

  const handleSaveDeezerCredentials = async () => {
    if (!deezerCredentials.appId || !deezerCredentials.appSecret) {
      setStatusMessage('Please enter both App ID and App Secret');
      return;
    }
    await window.api.saveDeezerCredentials(deezerCredentials);
    setShowDeezerSetup(false);
    setStatusMessage('Deezer credentials saved. Click "Connect Deezer" to login.');
  };

  const handleDeezerLogin = async () => {
    if (!deezerCredentials.appId) {
      setShowDeezerSetup(true);
      return;
    }
    try {
      await window.api.startDeezerAuth();
      setStatusMessage('Complete login in your browser, then paste the callback URL here.');
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleDeezerCallback = async (callbackUrl: string) => {
    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      if (!code) {
        setStatusMessage('Invalid callback URL - no code found');
        return;
      }
      const result = await window.api.exchangeDeezerCode({ code });
      setDeezerAuth({ user: result.user, accessToken: result.accessToken });
      setStatusMessage('');
      loadDeezerUserPlaylists();
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleDeezerLogout = async () => {
    await window.api.logoutDeezer();
    setDeezerAuth(null);
    setDeezerUserPlaylists([]);
  };

  // Tidal OAuth functions
  const loadTidalAuth = async () => {
    const auth = await window.api.getTidalAuth();
    if (auth.accessToken && auth.user) {
      setTidalAuth({ user: auth.user, accessToken: auth.accessToken });
      loadTidalUserPlaylists();
    }
    const creds = await window.api.getTidalCredentials();
    if (creds.clientId) {
      setTidalCredentials({ clientId: creds.clientId, clientSecret: creds.clientSecret || '' });
    }
  };

  const loadTidalUserPlaylists = async () => {
    setIsLoadingTidalUser(true);
    try {
      const playlists = await window.api.getTidalUserPlaylists();
      setTidalUserPlaylists(playlists);
    } catch (error: any) {
      console.error('Error loading Tidal playlists:', error);
    } finally {
      setIsLoadingTidalUser(false);
    }
  };

  const handleSaveTidalCredentials = async () => {
    if (!tidalCredentials.clientId || !tidalCredentials.clientSecret) {
      setStatusMessage('Please enter both Client ID and Client Secret');
      return;
    }
    await window.api.saveTidalCredentials(tidalCredentials);
    setShowTidalSetup(false);
    setStatusMessage('Tidal credentials saved. Click "Connect Tidal" to login.');
  };

  const handleTidalLogin = async () => {
    if (!tidalCredentials.clientId) {
      setShowTidalSetup(true);
      return;
    }
    try {
      await window.api.startTidalAuth();
      setStatusMessage('Complete login in your browser, then paste the callback URL here.');
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleTidalCallback = async (callbackUrl: string) => {
    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      if (!code) {
        setStatusMessage('Invalid callback URL - no code found');
        return;
      }
      const result = await window.api.exchangeTidalCode({ code });
      setTidalAuth({ user: result.user, accessToken: result.accessToken });
      setStatusMessage('');
      loadTidalUserPlaylists();
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleTidalLogout = async () => {
    await window.api.logoutTidal();
    setTidalAuth(null);
    setTidalUserPlaylists([]);
  };

  const handleTidalSearch = async () => {
    if (!tidalSearchQuery.trim()) return;
    setIsSearchingTidal(true);
    try {
      const results = await window.api.searchTidalPlaylists({ query: tidalSearchQuery });
      setTidalSearchResults(results);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsSearchingTidal(false);
    }
  };

  // YouTube Music OAuth functions
  const loadYtMusicAuth = async () => {
    const auth = await window.api.getYouTubeMusicAuth();
    if (auth.accessToken && auth.user) {
      setYtMusicAuth({ user: auth.user, accessToken: auth.accessToken });
      loadYtMusicPlaylists();
    }
    const creds = await window.api.getYouTubeMusicCredentials();
    if (creds.clientId) {
      setYtMusicCredentials({ clientId: creds.clientId, clientSecret: creds.clientSecret || '' });
    }
  };

  const loadYtMusicPlaylists = async () => {
    setIsLoadingYtMusic(true);
    try {
      const playlists = await window.api.getYouTubeMusicPlaylists();
      setYtMusicPlaylists(playlists);
    } catch (error: any) {
      console.error('Error loading YouTube Music playlists:', error);
    } finally {
      setIsLoadingYtMusic(false);
    }
  };

  const handleSaveYtMusicCredentials = async () => {
    if (!ytMusicCredentials.clientId || !ytMusicCredentials.clientSecret) {
      setStatusMessage('Please enter both Client ID and Client Secret');
      return;
    }
    await window.api.saveYouTubeMusicCredentials(ytMusicCredentials);
    setShowYtMusicSetup(false);
    setStatusMessage('YouTube credentials saved. Click "Connect YouTube Music" to login.');
  };

  const handleYtMusicLogin = async () => {
    if (!ytMusicCredentials.clientId) {
      setShowYtMusicSetup(true);
      return;
    }
    try {
      await window.api.startYouTubeMusicAuth();
      setStatusMessage('Complete login in your browser, then paste the callback URL here.');
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleYtMusicCallback = async (callbackUrl: string) => {
    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      if (!code) {
        setStatusMessage('Invalid callback URL - no code found');
        return;
      }
      const result = await window.api.exchangeYouTubeMusicCode({ code });
      setYtMusicAuth({ user: result.user, accessToken: result.accessToken });
      setStatusMessage('');
      loadYtMusicPlaylists();
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  const handleYtMusicLogout = async () => {
    await window.api.logoutYouTubeMusic();
    setYtMusicAuth(null);
    setYtMusicPlaylists([]);
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

  const handleSpotifySearch = async () => {
    if (!spotifySearchQuery.trim()) return;
    
    setIsSearchingSpotify(true);
    try {
      const playlists = await window.api.searchSpotifyPlaylists({ query: spotifySearchQuery });
      setSpotifySearchResults(playlists);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsSearchingSpotify(false);
    }
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
    source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz',
    id: string,
    name: string,
    trackCount: number,
    image?: string,
    url?: string
  ) => {
    setPreImportPlaylist({ source, id, name, image, trackCount, url });
    setEditedPlaylistName(name);
  };

  const openScheduleModal = (
    source: 'deezer' | 'apple' | 'tidal' | 'spotify' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz',
    id: string,
    name: string,
    url?: string,
    username?: string
  ) => {
    setSchedulePlaylist({ source, id, name, url, username });
    // Default to daily for ListenBrainz (daily jams), weekly for others
    setScheduleFrequency(source === 'listenbrainz' ? 'daily' : 'weekly');
  };

  const isPlaylistScheduled = (source: string, id: string) => {
    return existingSchedules.some(s => s.source === source && s.sourceUrl === id);
  };

  const saveSchedule = async () => {
    if (!schedulePlaylist) return;
    
    const schedule: any = {
      playlistId: `import-${schedulePlaylist.source}-${schedulePlaylist.id}`,
      playlistName: schedulePlaylist.name,
      frequency: scheduleFrequency,
      startDate: new Date().toISOString().split('T')[0],
      country: 'global',
      source: schedulePlaylist.source,
      sourceUrl: schedulePlaylist.url || schedulePlaylist.id,
    };
    
    // Include username for ListenBrainz
    if (schedulePlaylist.username) {
      schedule.username = schedulePlaylist.username;
    }
    
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
      name: applyPlaylistPrefix(playlistName, previewPlaylist.source, matchingSettings),
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

  // Fetch playlist from URL and show name editing modal
  const importDirectFromUrl = async (source: 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'spotify', url: string, name: string) => {
    setFetchingUrl(url);
    
    // Clear the URL input field immediately
    if (source === 'spotify') setSpotifyUrl('');
    else if (source === 'apple') setAppleMusicUrl('');
    else if (source === 'tidal') setTidalUrl('');
    else if (source === 'youtube') setYtMusicUrl('');
    else if (source === 'amazon') setAmazonMusicUrl('');
    else if (source === 'qobuz') setQobuzUrl('');
    
    try {
      let tracks: { title: string; artist: string }[];
      let playlistName = name;
      
      if (source === 'apple') {
        const result = await window.api.scrapeAppleMusicPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else if (source === 'tidal') {
        const result = await window.api.scrapeTidalPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else if (source === 'youtube') {
        const result = await window.api.scrapeYouTubeMusicPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else if (source === 'amazon') {
        const result = await window.api.scrapeAmazonMusicPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else if (source === 'qobuz') {
        const result = await window.api.scrapeQobuzPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else if (source === 'spotify') {
        const result = await window.api.scrapeSpotifyPlaylist({ url });
        tracks = result.tracks;
        playlistName = result.name || name;
      } else {
        tracks = [];
      }
      
      setFetchingUrl(null);
      
      if (tracks.length === 0) {
        setStatusMessage('No tracks found. The playlist may be private or the service blocked the request.');
        return;
      }
      
      // Show modal with fetched tracks for name editing
      setPreImportPlaylist({
        source,
        id: url,
        name: playlistName,
        trackCount: tracks.length,
        url,
        tracks,
      });
      setEditedPlaylistName(playlistName);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setFetchingUrl(null);
    }
  };

  // Actually perform the import after name editing
  const doImportWithTracks = async (
    source: string,
    name: string,
    tracks: { title: string; artist: string }[],
    url?: string
  ) => {
    setImportingPlaylist(url || 'import');
    setImportProgress({
      playlistName: name,
      source: (source === 'youtube' || source === 'amazon' || source === 'qobuz' || source === 'spotify' || source === 'listenbrainz' || source === 'file' || source === 'ai') ? 'spotify' : source as any,
      current: 0,
      total: tracks.length,
      currentTrack: '',
      matchedCount: 0,
    });
    
    const sourceNames: Record<string, string> = {
      apple: 'Apple Music',
      tidal: 'Tidal',
      youtube: 'YouTube Music',
      amazon: 'Amazon Music',
      qobuz: 'Qobuz',
      spotify: 'Spotify',
      listenbrainz: 'ListenBrainz',
      file: 'File',
      ai: 'AI',
    };
    
    try {
      const discoveryPlaylist = {
        id: `${source}-${Date.now()}`,
        name: applyPlaylistPrefix(name, source, matchingSettings),
        description: `Imported from ${sourceNames[source] || source}`,
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
    const { source, id, image, url, tracks } = preImportPlaylist;
    const name = editedPlaylistName.trim() || preImportPlaylist.name;
    setPreImportPlaylist(null);
    
    // If tracks are pre-fetched (from URL scraping), use them directly
    if (tracks && tracks.length > 0) {
      doImportWithTracks(source, name, tracks, url);
      return;
    }
    
    // YouTube with OAuth - import by playlist ID
    if (source === 'youtube' && !url) {
      importYouTubePlaylistById(id, name, image);
    } else {
      // Spotify and Deezer use ID-based import
      handleImportPlaylist(source as 'spotify' | 'deezer', id, name, image);
    }
  };

  const importYouTubePlaylistById = async (playlistId: string, playlistName: string, playlistImage?: string) => {
    setImportingPlaylist(playlistId);
    setImportProgress({
      playlistName,
      playlistImage,
      source: 'spotify', // Using spotify as a generic source type for progress
      current: 0,
      total: 0,
      currentTrack: 'Fetching playlist...',
      matchedCount: 0,
    });
    
    try {
      const tracks = await window.api.getYouTubeMusicPlaylistTracks({ playlistId });
      
      if (tracks.length === 0) {
        setStatusMessage('No tracks found in playlist.');
        setImportProgress(null);
        setImportingPlaylist(null);
        return;
      }
      
      setImportProgress(prev => prev ? { ...prev, total: tracks.length, currentTrack: '' } : null);
      
      const discoveryPlaylist = {
        id: `youtube-${playlistId}`,
        name: applyPlaylistPrefix(playlistName, 'youtube', matchingSettings),
        description: 'Imported from YouTube Music',
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
        name: applyPlaylistPrefix(playlistName, source, matchingSettings),
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
      {/* Search bar at the top */}
      <div className="deezer-search">
        <div className="search-bar-row">
          <input
            type="text"
            value={spotifySearchQuery}
            onChange={e => setSpotifySearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSpotifySearch()}
            placeholder="Search Spotify playlists..."
          />
          <button 
            className="btn btn-primary"
            onClick={handleSpotifySearch}
            disabled={isSearchingSpotify || !spotifySearchQuery.trim()}
          >
            {isSearchingSpotify ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {spotifySearchResults.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Search Results</h3>
          <div className="playlist-grid">
            {spotifySearchResults.map(playlist => {
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
        </>
      )}

      {/* URL Import */}
      <div className="url-import-section" style={{ marginTop: spotifySearchResults.length > 0 ? '24px' : '0', borderTop: spotifySearchResults.length > 0 ? '1px solid #333' : 'none', paddingTop: spotifySearchResults.length > 0 ? '24px' : '0' }}>
        <h3>Import from URL</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Paste a Spotify playlist URL to import (no login required)
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={spotifyUrl}
            onChange={e => setSpotifyUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && spotifyUrl.trim() && !fetchingUrl && importDirectFromUrl('spotify', spotifyUrl, 'Spotify Playlist')}
            placeholder="https://open.spotify.com/playlist/..."
          />
          <button 
            className="btn btn-primary"
            onClick={() => importDirectFromUrl('spotify', spotifyUrl, 'Spotify Playlist')}
            disabled={!spotifyUrl.trim() || !!fetchingUrl}
          >
            {fetchingUrl ? <span className="spinner-small" /> : 'Import'}
          </button>
        </div>
      </div>

      {/* Search Spotify playlists (no login required) */}
      <div style={{ marginTop: '16px' }}>
        <div className="search-bar-row">
          <input
            type="text"
            value={spotifySearchQuery}
            onChange={e => setSpotifySearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSpotifySearch()}
            placeholder="Search Spotify playlists..."
          />
          <button 
            className="btn btn-primary"
            onClick={handleSpotifySearch}
            disabled={isSearchingSpotify || !spotifySearchQuery.trim()}
          >
            {isSearchingSpotify ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {spotifySearchResults.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Search Results</h3>
          <div className="playlist-grid">
            {spotifySearchResults.map(playlist => {
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
        </>
      )}
      
      {/* Optional OAuth Login */}
      <div style={{ marginTop: '24px', borderTop: '1px solid #333', paddingTop: '24px' }}>
        <h3>Your Playlists (Optional)</h3>
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

      {/* Optional OAuth Login for personal playlists */}
      <div style={{ marginTop: '24px', borderTop: '1px solid #333', paddingTop: '24px' }}>
        <h3>Your Playlists (Optional)</h3>
        {!deezerAuth ? (
          <div className="import-login-section">
            {showDeezerSetup ? (
              <div className="spotify-setup">
                <h4>Deezer API Setup</h4>
                <p className="setup-instructions">
                  To access your personal playlists, create a Deezer app:
                </p>
                <ol className="setup-steps">
                  <li>Go to <a href="https://developers.deezer.com/myapps" target="_blank" rel="noopener">developers.deezer.com/myapps</a></li>
                  <li>Create a new application</li>
                  <li>Set redirect URI to: <code>http://127.0.0.1:8888/callback</code></li>
                </ol>
                <div className="input-group">
                  <label>App ID</label>
                  <input
                    type="text"
                    value={deezerCredentials.appId}
                    onChange={e => setDeezerCredentials(prev => ({ ...prev, appId: e.target.value }))}
                    placeholder="Enter App ID"
                  />
                </div>
                <div className="input-group">
                  <label>App Secret</label>
                  <input
                    type="password"
                    value={deezerCredentials.appSecret}
                    onChange={e => setDeezerCredentials(prev => ({ ...prev, appSecret: e.target.value }))}
                    placeholder="Enter App Secret"
                  />
                </div>
                <div className="button-row">
                  <button className="btn btn-secondary" onClick={() => setShowDeezerSetup(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveDeezerCredentials}>Save</button>
                </div>
              </div>
            ) : (
              <div className="login-prompt" style={{ padding: '16px' }}>
                <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>Connect to access your personal Deezer playlists</p>
                <button className="btn btn-secondary" onClick={handleDeezerLogin}>
                  {deezerCredentials.appId ? 'Connect Deezer' : 'Setup Deezer'}
                </button>
                {deezerCredentials.appId && (
                  <button className="btn btn-secondary btn-small" style={{ marginLeft: '8px' }} onClick={() => setShowDeezerSetup(true)}>
                    Edit
                  </button>
                )}
              </div>
            )}
            {statusMessage.includes('Complete login') && activeTab === 'deezer' && (
              <div className="callback-input">
                <p>After logging in, paste the callback URL here:</p>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:8888/callback?code=..."
                  onPaste={e => handleDeezerCallback(e.clipboardData.getData('text'))}
                  onChange={e => e.target.value.includes('code=') && handleDeezerCallback(e.target.value)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="import-playlists-section">
            <div className="user-header">
              <div className="user-info-row">
                <span>{deezerAuth.user?.name || 'Deezer User'}</span>
              </div>
              <button className="btn btn-secondary btn-small" onClick={handleDeezerLogout}>Logout</button>
            </div>
            {isLoadingDeezerUser ? (
              <div className="loading">Loading playlists...</div>
            ) : deezerUserPlaylists.length === 0 ? (
              <p className="empty-state">No personal playlists found</p>
            ) : (
              <div className="playlist-grid">
                {deezerUserPlaylists.map(playlist => (
                  <div key={playlist.id} className="import-playlist-card clickable" onClick={() => openPreview('deezer', playlist.id, playlist.name, playlist.trackCount, playlist.image)}>
                    {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                    <div className="playlist-info">
                      <span className="playlist-name">{playlist.name}</span>
                      <span className="playlist-meta">{playlist.trackCount} tracks</span>
                    </div>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={(e) => { e.stopPropagation(); showPreImportModal('deezer', playlist.id, playlist.name, playlist.trackCount, playlist.image); }}
                      disabled={importingPlaylist === playlist.id}
                    >
                      {importingPlaylist === playlist.id ? '...' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
            onClick={() => showPreImportModal('apple', appleMusicUrl, 'Apple Music Playlist', 0, undefined, appleMusicUrl)}
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
                onClick={(e) => { e.stopPropagation(); showPreImportModal('apple', playlist.url, playlist.name, 0, undefined, playlist.url); }}
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
            onClick={() => showPreImportModal('tidal', tidalUrl, 'Tidal Playlist', 0, undefined, tidalUrl)}
            disabled={!tidalUrl.trim() || importingPlaylist === tidalUrl}
          >
            {importingPlaylist === tidalUrl ? '...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Search Tidal playlists (requires login) */}
      {tidalAuth && (
        <div style={{ marginTop: '16px' }}>
          <div className="search-bar-row">
            <input
              type="text"
              value={tidalSearchQuery}
              onChange={e => setTidalSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTidalSearch()}
              placeholder="Search Tidal playlists..."
            />
            <button 
              className="btn btn-primary"
              onClick={handleTidalSearch}
              disabled={isSearchingTidal || !tidalSearchQuery.trim()}
            >
              {isSearchingTidal ? '...' : 'Search'}
            </button>
          </div>
          {tidalSearchResults.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>Search Results</h3>
              <div className="playlist-grid">
                {tidalSearchResults.map((playlist: any) => (
                  <div key={playlist.id} className="import-playlist-card">
                    {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                    <div className="playlist-info">
                      <span className="playlist-name">{playlist.name}</span>
                      <span className="playlist-meta">{playlist.trackCount || 0} tracks</span>
                    </div>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => showPreImportModal('tidal', playlist.id, playlist.name, playlist.trackCount || 0, playlist.image)}
                      disabled={importingPlaylist === playlist.id}
                    >
                      {importingPlaylist === playlist.id ? '...' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      
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
                onClick={(e) => { e.stopPropagation(); showPreImportModal('tidal', playlist.url, playlist.name, 0, undefined, playlist.url); }}
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

      {/* Optional OAuth Login for personal playlists */}
      <div style={{ marginTop: '24px', borderTop: '1px solid #333', paddingTop: '24px' }}>
        <h3>Your Playlists (Optional)</h3>
        {!tidalAuth ? (
          <div className="import-login-section">
            {showTidalSetup ? (
              <div className="spotify-setup">
                <h4>Tidal API Setup</h4>
                <p className="setup-instructions">
                  To access your personal playlists, create a Tidal developer app:
                </p>
                <ol className="setup-steps">
                  <li>Go to <a href="https://developer.tidal.com/" target="_blank" rel="noopener">developer.tidal.com</a></li>
                  <li>Create a new application</li>
                  <li>Set redirect URI to: <code>http://127.0.0.1:8888/callback</code></li>
                </ol>
                <div className="input-group">
                  <label>Client ID</label>
                  <input
                    type="text"
                    value={tidalCredentials.clientId}
                    onChange={e => setTidalCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter Client ID"
                  />
                </div>
                <div className="input-group">
                  <label>Client Secret</label>
                  <input
                    type="password"
                    value={tidalCredentials.clientSecret}
                    onChange={e => setTidalCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter Client Secret"
                  />
                </div>
                <div className="button-row">
                  <button className="btn btn-secondary" onClick={() => setShowTidalSetup(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveTidalCredentials}>Save</button>
                </div>
              </div>
            ) : (
              <div className="login-prompt" style={{ padding: '16px' }}>
                <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>Connect to access your personal Tidal playlists and search</p>
                <button className="btn btn-secondary" onClick={handleTidalLogin}>
                  {tidalCredentials.clientId ? 'Connect Tidal' : 'Setup Tidal'}
                </button>
                {tidalCredentials.clientId && (
                  <button className="btn btn-secondary btn-small" style={{ marginLeft: '8px' }} onClick={() => setShowTidalSetup(true)}>
                    Edit
                  </button>
                )}
              </div>
            )}
            {statusMessage.includes('Complete login') && activeTab === 'tidal' && (
              <div className="callback-input">
                <p>After logging in, paste the callback URL here:</p>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:8888/callback?code=..."
                  onPaste={e => handleTidalCallback(e.clipboardData.getData('text'))}
                  onChange={e => e.target.value.includes('code=') && handleTidalCallback(e.target.value)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="import-playlists-section">
            <div className="user-header">
              <div className="user-info-row">
                <span>{tidalAuth.user?.name || 'Tidal User'}</span>
              </div>
              <button className="btn btn-secondary btn-small" onClick={handleTidalLogout}>Logout</button>
            </div>
            {isLoadingTidalUser ? (
              <div className="loading">Loading playlists...</div>
            ) : tidalUserPlaylists.length === 0 ? (
              <p className="empty-state">No personal playlists found</p>
            ) : (
              <div className="playlist-grid">
                {tidalUserPlaylists.map((playlist: any) => (
                  <div key={playlist.id} className="import-playlist-card">
                    {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                    <div className="playlist-info">
                      <span className="playlist-name">{playlist.name}</span>
                      <span className="playlist-meta">{playlist.trackCount || 0} tracks</span>
                    </div>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => showPreImportModal('tidal', playlist.id, playlist.name, playlist.trackCount || 0, playlist.image)}
                      disabled={importingPlaylist === playlist.id}
                    >
                      {importingPlaylist === playlist.id ? '...' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderYouTubeMusicTab = () => (
    <div className="import-tab-content">
      {/* URL Import - always available */}
      <div className="url-import-section">
        <h3>Import from YouTube Music</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Paste a YouTube Music playlist URL to import
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={ytMusicUrl}
            onChange={e => setYtMusicUrl(e.target.value)}
            placeholder="https://music.youtube.com/playlist?list=..."
          />
          <button 
            className="btn btn-primary"
            onClick={() => showPreImportModal('youtube', ytMusicUrl, 'YouTube Music Playlist', 0, undefined, ytMusicUrl)}
            disabled={!ytMusicUrl.trim() || importingPlaylist === ytMusicUrl}
          >
            {importingPlaylist === ytMusicUrl ? '...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Popular Playlists */}
      <h3 style={{ margin: '24px 0 12px' }}>Popular Playlists</h3>
      <div className="playlist-grid">
        {youtubePopular.map((playlist, i) => (
          <div 
            key={i} 
            className="import-playlist-card clickable"
            onClick={() => showPreImportModal('youtube', playlist.url, playlist.name, 0, undefined, playlist.url)}
          >
            <div className="playlist-info">
              <span className="playlist-name">{playlist.name}</span>
              <span className="playlist-meta">YouTube Music</span>
            </div>
            <div className="button-group">
              <button 
                className="btn btn-small btn-primary"
                onClick={(e) => { e.stopPropagation(); showPreImportModal('youtube', playlist.url, playlist.name, 0, undefined, playlist.url); }}
                disabled={importingPlaylist === playlist.url}
              >
                {importingPlaylist === playlist.url ? '...' : 'Import'}
              </button>
              <button 
                className={`btn btn-small ${isPlaylistScheduled('youtube', playlist.url) ? 'btn-scheduled' : 'btn-secondary'}`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  isPlaylistScheduled('youtube', playlist.url) 
                    ? removeSchedule('youtube', playlist.url)
                    : openScheduleModal('youtube', playlist.url, playlist.name, playlist.url); 
                }}
              >
                {isPlaylistScheduled('youtube', playlist.url) ? 'Scheduled' : 'Schedule'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Optional OAuth Login */}
      <div style={{ marginTop: '24px', borderTop: '1px solid #333', paddingTop: '24px' }}>
        <h3>Your Playlists (Optional)</h3>
        {!ytMusicAuth ? (
          <div className="import-login-section">
            {showYtMusicSetup ? (
              <div className="spotify-setup">
                <h4>YouTube API Setup</h4>
                <p className="setup-instructions">
                  To access your personal playlists, create a Google Cloud project:
                </p>
                <ol className="setup-steps">
                  <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a></li>
                  <li>Create OAuth 2.0 credentials (Web application)</li>
                  <li>Add redirect URI: <code>http://127.0.0.1:8888/callback</code></li>
                  <li>Enable YouTube Data API v3</li>
                </ol>
                <div className="input-group">
                  <label>Client ID</label>
                  <input
                    type="text"
                    value={ytMusicCredentials.clientId}
                    onChange={e => setYtMusicCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter Client ID"
                  />
                </div>
                <div className="input-group">
                  <label>Client Secret</label>
                  <input
                    type="password"
                    value={ytMusicCredentials.clientSecret}
                    onChange={e => setYtMusicCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter Client Secret"
                  />
                </div>
                <div className="button-row">
                  <button className="btn btn-secondary" onClick={() => setShowYtMusicSetup(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveYtMusicCredentials}>Save</button>
                </div>
              </div>
            ) : (
              <div className="login-prompt" style={{ padding: '16px' }}>
                <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>Connect to access your personal YouTube Music playlists</p>
                <button className="btn btn-secondary" onClick={handleYtMusicLogin}>
                  {ytMusicCredentials.clientId ? 'Connect YouTube Music' : 'Setup YouTube Music'}
                </button>
                {ytMusicCredentials.clientId && (
                  <button className="btn btn-secondary btn-small" style={{ marginLeft: '8px' }} onClick={() => setShowYtMusicSetup(true)}>
                    Edit
                  </button>
                )}
              </div>
            )}
            {statusMessage.includes('Complete login') && activeTab === 'youtube' && (
              <div className="callback-input">
                <p>After logging in, paste the callback URL here:</p>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:8888/callback?code=..."
                  onPaste={e => handleYtMusicCallback(e.clipboardData.getData('text'))}
                  onChange={e => e.target.value.includes('code=') && handleYtMusicCallback(e.target.value)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="import-playlists-section">
            <div className="user-header">
              <div className="user-info-row">
                <span>{ytMusicAuth.user?.name || 'YouTube Music User'}</span>
              </div>
              <button className="btn btn-secondary btn-small" onClick={handleYtMusicLogout}>Logout</button>
            </div>
            {isLoadingYtMusic ? (
              <div className="loading">Loading playlists...</div>
            ) : ytMusicPlaylists.length === 0 ? (
              <p className="empty-state">No playlists found</p>
            ) : (
              <div className="playlist-grid">
                {ytMusicPlaylists.map(playlist => (
                  <div key={playlist.id} className="import-playlist-card">
                    {playlist.image && <img src={playlist.image} alt="" className="playlist-image" />}
                    <div className="playlist-info">
                      <span className="playlist-name">{playlist.name}</span>
                      <span className="playlist-meta">{playlist.trackCount || 0} tracks</span>
                    </div>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => showPreImportModal('youtube', playlist.id, playlist.name, playlist.trackCount || 0, playlist.image)}
                      disabled={importingPlaylist === playlist.id}
                    >
                      {importingPlaylist === playlist.id ? '...' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderAmazonMusicTab = () => (
    <div className="import-tab-content">
      <div className="url-import-section">
        <h3>Import from Amazon Music</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Paste an Amazon Music playlist URL to import. Note: Only public playlists are supported.
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={amazonMusicUrl}
            onChange={e => setAmazonMusicUrl(e.target.value)}
            placeholder="https://music.amazon.com/playlists/..."
          />
          <button 
            className="btn btn-primary"
            onClick={() => showPreImportModal('amazon', amazonMusicUrl, 'Amazon Music Playlist', 0, undefined, amazonMusicUrl)}
            disabled={!amazonMusicUrl.trim() || importingPlaylist === amazonMusicUrl}
          >
            {importingPlaylist === amazonMusicUrl ? '...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Popular Playlists */}
      <h3 style={{ margin: '24px 0 12px' }}>Popular Playlists</h3>
      <div className="playlist-grid">
        {amazonPopular.map((playlist, i) => (
          <div 
            key={i} 
            className="import-playlist-card clickable"
            onClick={() => showPreImportModal('amazon', playlist.url, playlist.name, 0, undefined, playlist.url)}
          >
            <div className="playlist-info">
              <span className="playlist-name">{playlist.name}</span>
              <span className="playlist-meta">Amazon Music</span>
            </div>
            <div className="button-group">
              <button 
                className="btn btn-small btn-primary"
                onClick={(e) => { e.stopPropagation(); showPreImportModal('amazon', playlist.url, playlist.name, 0, undefined, playlist.url); }}
                disabled={importingPlaylist === playlist.url}
              >
                {importingPlaylist === playlist.url ? '...' : 'Import'}
              </button>
              <button 
                className={`btn btn-small ${isPlaylistScheduled('amazon', playlist.url) ? 'btn-scheduled' : 'btn-secondary'}`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  isPlaylistScheduled('amazon', playlist.url) 
                    ? removeSchedule('amazon', playlist.url)
                    : openScheduleModal('amazon', playlist.url, playlist.name, playlist.url); 
                }}
              >
                {isPlaylistScheduled('amazon', playlist.url) ? 'Scheduled' : 'Schedule'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px' }}>
        <p style={{ color: '#888', fontSize: '13px' }}>
          ⚠️ Amazon Music does not provide a public API. Import works by scraping public playlist pages, 
          which may be unreliable. Personal playlists require the playlist to be set to public.
        </p>
      </div>
    </div>
  );

  const renderQobuzTab = () => (
    <div className="import-tab-content">
      <div className="url-import-section">
        <h3>Import from Qobuz</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Paste a Qobuz playlist URL to import
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={qobuzUrl}
            onChange={e => setQobuzUrl(e.target.value)}
            placeholder="https://www.qobuz.com/playlist/..."
          />
          <button 
            className="btn btn-primary"
            onClick={() => showPreImportModal('qobuz', qobuzUrl, 'Qobuz Playlist', 0, undefined, qobuzUrl)}
            disabled={!qobuzUrl.trim() || importingPlaylist === qobuzUrl}
          >
            {importingPlaylist === qobuzUrl ? '...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Popular Playlists */}
      <h3 style={{ margin: '24px 0 12px' }}>Popular Playlists</h3>
      <div className="playlist-grid">
        {qobuzPopular.map((playlist, i) => (
          <div 
            key={i} 
            className="import-playlist-card clickable"
            onClick={() => showPreImportModal('qobuz', playlist.url, playlist.name, 0, undefined, playlist.url)}
          >
            <div className="playlist-info">
              <span className="playlist-name">{playlist.name}</span>
              <span className="playlist-meta">Qobuz</span>
            </div>
            <div className="button-group">
              <button 
                className="btn btn-small btn-primary"
                onClick={(e) => { e.stopPropagation(); showPreImportModal('qobuz', playlist.url, playlist.name, 0, undefined, playlist.url); }}
                disabled={importingPlaylist === playlist.url}
              >
                {importingPlaylist === playlist.url ? '...' : 'Import'}
              </button>
              <button 
                className={`btn btn-small ${isPlaylistScheduled('qobuz', playlist.url) ? 'btn-scheduled' : 'btn-secondary'}`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  isPlaylistScheduled('qobuz', playlist.url) 
                    ? removeSchedule('qobuz', playlist.url)
                    : openScheduleModal('qobuz', playlist.url, playlist.name, playlist.url); 
                }}
              >
                {isPlaylistScheduled('qobuz', playlist.url) ? 'Scheduled' : 'Schedule'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px' }}>
        <p style={{ color: '#888', fontSize: '13px' }}>
          ⚠️ Qobuz has limited API access. Import works by scraping public playlist pages.
        </p>
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

  const handleFileImport = async () => {
    setIsLoadingFile(true);
    try {
      const result = await window.api.importM3UFile();
      if (!result || result.tracks.length === 0) {
        setStatusMessage('No tracks found in file or import cancelled.');
        setIsLoadingFile(false);
        return;
      }
      
      const playlistName = result.name || 'Imported Playlist';
      setIsLoadingFile(false);
      
      // Show modal for name editing
      setPreImportPlaylist({
        source: 'file',
        id: `file-${Date.now()}`,
        name: playlistName,
        trackCount: result.tracks.length,
        tracks: result.tracks,
      });
      setEditedPlaylistName(playlistName);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setIsLoadingFile(false);
    }
  };

  const handleiTunesImport = async () => {
    setIsLoadingFile(true);
    setiTunesPlaylists([]);
    try {
      const result = await window.api.importiTunesXML();
      if (!result || result.playlists.length === 0) {
        setStatusMessage('No playlists found in file or import cancelled.');
        setIsLoadingFile(false);
        return;
      }
      setiTunesPlaylists(result.playlists);
      setIsLoadingFile(false);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setIsLoadingFile(false);
    }
  };

  const importiTunesPlaylist = async (playlist: { name: string; tracks: { title: string; artist: string }[] }) => {
    // Show modal for name editing
    setPreImportPlaylist({
      source: 'file',
      id: `itunes-${Date.now()}`,
      name: playlist.name,
      trackCount: playlist.tracks.length,
      tracks: playlist.tracks,
    });
    setEditedPlaylistName(playlist.name);
  };

  const renderFileTab = () => (
    <div className="import-tab-content">
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '12px', color: '#fff' }}>M3U / M3U8 Playlists</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
          Import playlists from M3U or M3U8 files with #EXTINF tags or "Artist - Title" filenames.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={handleFileImport}
          disabled={isLoadingFile}
        >
          {isLoadingFile ? 'Importing...' : 'Select M3U/M3U8 File'}
        </button>
      </div>
      
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '12px', color: '#fff' }}>iTunes Library XML</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
          Import playlists from iTunes/Music app XML export. Export via File → Library → Export Library.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={handleiTunesImport}
          disabled={isLoadingFile}
          style={{ marginBottom: '16px' }}
        >
          {isLoadingFile ? 'Loading...' : 'Select iTunes XML File'}
        </button>
        
        {iTunesPlaylists.length > 0 && (
          <div className="playlist-grid" style={{ marginTop: '16px' }}>
            {iTunesPlaylists.map((playlist, i) => (
              <div key={i} className="import-playlist-card" onClick={() => importiTunesPlaylist(playlist)}>
                <div className="playlist-info">
                  <span className="playlist-name">{playlist.name}</span>
                  <span className="playlist-meta">{playlist.trackCount} tracks</span>
                </div>
                <span className="playlist-badge">iTunes</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const loadListenBrainzPlaylists = async () => {
    if (!listenBrainzUsername.trim()) {
      setStatusMessage('Please enter a ListenBrainz username');
      return;
    }
    setIsLoadingListenBrainz(true);
    setListenBrainzPlaylists([]);
    try {
      const playlists = await window.api.getListenBrainzPlaylists({ username: listenBrainzUsername.trim() });
      setListenBrainzPlaylists(playlists);
      if (playlists.length === 0) {
        setStatusMessage('No playlists found for this user');
      }
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsLoadingListenBrainz(false);
    }
  };

  const importListenBrainzPlaylist = async (playlist: { id: string; name: string; trackCount: number }) => {
    setFetchingUrl(playlist.id);
    
    try {
      const tracks = await window.api.getListenBrainzPlaylistTracks({ playlistId: playlist.id });
      
      setFetchingUrl(null);
      
      if (tracks.length === 0) {
        setStatusMessage('No tracks found in playlist');
        return;
      }
      
      // Show modal for name editing
      setPreImportPlaylist({
        source: 'listenbrainz',
        id: playlist.id,
        name: playlist.name,
        trackCount: tracks.length,
        tracks,
      });
      setEditedPlaylistName(playlist.name);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setFetchingUrl(null);
    }
  };

  const renderListenBrainzTab = () => {
    const createdForPlaylists = listenBrainzPlaylists.filter(p => p.type === 'createdfor');
    const userPlaylists = listenBrainzPlaylists.filter(p => p.type !== 'createdfor');
    
    return (
    <div className="import-tab-content">
      <div className="url-import-section">
        <h3>Import from ListenBrainz</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '12px' }}>
          Enter a ListenBrainz username to load their playlists and recommendations
        </p>
        <div className="search-bar-row">
          <input
            type="text"
            value={listenBrainzUsername}
            onChange={e => setListenBrainzUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadListenBrainzPlaylists()}
            placeholder="Enter ListenBrainz username..."
          />
          <button 
            className="btn btn-primary" 
            onClick={loadListenBrainzPlaylists}
            disabled={isLoadingListenBrainz || !listenBrainzUsername.trim()}
          >
            {isLoadingListenBrainz ? '...' : 'Load Playlists'}
          </button>
        </div>
      </div>
      
      {createdForPlaylists.length > 0 && (
        <>
          <h3 style={{ margin: '24px 0 12px' }}>🎵 Created For You (Daily/Weekly Jams)</h3>
          <p style={{ color: '#a0a0a0', marginBottom: '12px', fontSize: '13px' }}>
            Personalized recommendations from troi-bot - schedule to auto-update
          </p>
          <div className="playlist-grid">
            {createdForPlaylists.map(playlist => (
              <div 
                key={playlist.id} 
                className="import-playlist-card"
              >
                <div 
                  className="playlist-info clickable"
                  onClick={() => importListenBrainzPlaylist(playlist)}
                  style={{ flex: 1, cursor: 'pointer' }}
                >
                  <span className="playlist-name">{playlist.name}</span>
                  <span className="playlist-meta">{playlist.trackCount} tracks</span>
                </div>
                <div className="playlist-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={(e) => { e.stopPropagation(); importListenBrainzPlaylist(playlist); }}
                    title="Import playlist"
                  >
                    Import
                  </button>
                  <button 
                    className={`btn btn-small ${isPlaylistScheduled('listenbrainz', playlist.id) ? 'btn-scheduled' : 'btn-secondary'}`}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      isPlaylistScheduled('listenbrainz', playlist.id) 
                        ? removeSchedule('listenbrainz', playlist.id)
                        : openScheduleModal('listenbrainz', playlist.id, playlist.name, undefined, listenBrainzUsername); 
                    }}
                    title={isPlaylistScheduled('listenbrainz', playlist.id) ? 'Remove schedule' : 'Schedule auto-refresh'}
                  >
                    {isPlaylistScheduled('listenbrainz', playlist.id) ? '✓ Scheduled' : 'Schedule'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {userPlaylists.length > 0 && (
        <>
          <h3 style={{ margin: '24px 0 12px' }}>User Playlists</h3>
          <div className="playlist-grid">
            {userPlaylists.map(playlist => (
              <div 
                key={playlist.id} 
                className="import-playlist-card"
              >
                <div 
                  className="playlist-info clickable"
                  onClick={() => importListenBrainzPlaylist(playlist)}
                  style={{ flex: 1, cursor: 'pointer' }}
                >
                  <span className="playlist-name">{playlist.name}</span>
                  <span className="playlist-meta">{playlist.trackCount} tracks</span>
                </div>
                <div className="playlist-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={(e) => { e.stopPropagation(); importListenBrainzPlaylist(playlist); }}
                    title="Import playlist"
                  >
                    Import
                  </button>
                  <button 
                    className={`btn btn-small ${isPlaylistScheduled('listenbrainz', playlist.id) ? 'btn-scheduled' : 'btn-secondary'}`}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      isPlaylistScheduled('listenbrainz', playlist.id) 
                        ? removeSchedule('listenbrainz', playlist.id)
                        : openScheduleModal('listenbrainz', playlist.id, playlist.name, undefined, listenBrainzUsername); 
                    }}
                    title={isPlaylistScheduled('listenbrainz', playlist.id) ? 'Remove schedule' : 'Schedule auto-refresh'}
                  >
                    {isPlaylistScheduled('listenbrainz', playlist.id) ? '✓ Scheduled' : 'Schedule'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    );
  };

  const renderAiTab = () => (
    <div className="import-tab-content">
      <div className="url-import-section">
        <h3>AI Playlist Generator</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
          Describe the playlist you want and let AI generate a track list for you
        </p>
        
        {aiApiKeySaved === null ? (
          <div style={{ color: '#888' }}>Loading...</div>
        ) : !aiApiKeySaved || showAiSetup ? (
          <div className="ai-setup">
            <div className="spotify-setup">
                <h4>AI Provider Setup</h4>
                <div style={{ marginBottom: '16px' }}>
                  <div className="tab-bar" style={{ marginBottom: '16px' }}>
                    <button 
                      className={`tab-btn ${aiProvider === 'groq' ? 'active' : ''}`}
                      onClick={() => { setAiProvider('groq'); setAiApiKey(''); }}
                    >
                      Groq (Free)
                    </button>
                    <button 
                      className={`tab-btn ${aiProvider === 'openai' ? 'active' : ''}`}
                      onClick={() => { setAiProvider('openai'); setAiApiKey(''); }}
                    >
                      OpenAI (Paid)
                    </button>
                  </div>
                </div>
                
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  {aiProvider === 'groq' ? (
                    <>
                      <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Get a free Groq API key:</p>
                      <ol style={{ margin: 0, paddingLeft: '20px', color: '#a0a0a0', fontSize: '14px', lineHeight: '1.8' }}>
                        <li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style={{ color: '#e5a01c' }}>console.groq.com/keys</a></li>
                        <li>Sign up or log in (no credit card needed)</li>
                        <li>Click "Create API Key"</li>
                        <li>Copy and paste it below</li>
                      </ol>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Get an OpenAI API key:</p>
                      <ol style={{ margin: 0, paddingLeft: '20px', color: '#a0a0a0', fontSize: '14px', lineHeight: '1.8' }}>
                        <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style={{ color: '#e5a01c' }}>platform.openai.com/api-keys</a></li>
                        <li>Ensure you have billing set up (or use existing subscription)</li>
                        <li>Create a new API key</li>
                        <li>Paste it below</li>
                      </ol>
                    </>
                  )}
                </div>
                
                <div className="input-group">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={e => setAiApiKey(e.target.value)}
                    placeholder={aiProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                  />
                </div>
                <div className="button-row">
                  <button className="btn btn-secondary" onClick={() => { setShowAiSetup(false); loadAiApiKey(); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveAiApiKey} disabled={!aiApiKey.trim()}>Save</button>
                </div>
              </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>Using: {aiProvider === 'groq' ? 'Groq' : 'OpenAI'}</span>
              <button 
                className="btn btn-secondary btn-small"
                onClick={() => setShowAiSetup(true)}
              >
                Change Provider
              </button>
            </div>
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Describe your playlist</label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g., Upbeat 80s synth-pop songs for a road trip, or Relaxing jazz for a rainy afternoon, or Songs similar to Radiohead and Portishead..."
                rows={3}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              <div className="input-group" style={{ margin: 0, flex: '0 0 auto' }}>
                <label>Number of tracks</label>
                <select 
                  value={aiTrackCount} 
                  onChange={e => setAiTrackCount(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                >
                  <option value={10}>10 tracks</option>
                  <option value={15}>15 tracks</option>
                  <option value={25}>25 tracks</option>
                  <option value={50}>50 tracks</option>
                  <option value={100}>100 tracks</option>
                </select>
              </div>
              <button 
                className="btn btn-primary"
                onClick={generateAiPlaylist}
                disabled={isGeneratingAi || !aiPrompt.trim()}
                style={{ marginTop: '20px' }}
              >
                {isGeneratingAi ? 'Generating...' : 'Generate Playlist'}
              </button>
            </div>
          </>
        )}
      </div>
      
      {aiGeneratedTracks.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <input
                type="text"
                value={aiPlaylistName}
                onChange={e => setAiPlaylistName(e.target.value)}
                style={{ fontSize: '18px', fontWeight: 'bold', background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#fff', padding: '4px 0', width: '300px' }}
                placeholder="Playlist name..."
              />
              <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>{aiGeneratedTracks.length} tracks generated</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setAiGeneratedTracks([])}>
                Clear
              </button>
              <button className="btn btn-primary" onClick={importAiPlaylist}>
                Import to Plex
              </button>
            </div>
          </div>
          
          <div className="preview-track-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {aiGeneratedTracks.map((track, i) => (
              <div key={i} className="preview-track-item">
                <span className="preview-track-number">{i + 1}</span>
                <div className="preview-track-info">
                  <span className="preview-track-title">{track.title}</span>
                  <span className="preview-track-artist">{track.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '8px', color: '#e5a01c' }}>Tips for better results</h4>
        <ul style={{ color: '#888', fontSize: '13px', margin: 0, paddingLeft: '20px' }}>
          <li>Be specific about mood, era, or genre</li>
          <li>Mention similar artists for style reference</li>
          <li>Include context like "for working out" or "dinner party"</li>
          <li>Try "deep cuts" or "lesser known tracks" for variety</li>
        </ul>
      </div>
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
          className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
          onClick={() => setActiveTab('youtube')}
        >
          YouTube Music
        </button>
        <button 
          className={`tab-btn ${activeTab === 'amazon' ? 'active' : ''}`}
          onClick={() => setActiveTab('amazon')}
        >
          Amazon Music
        </button>
        <button 
          className={`tab-btn ${activeTab === 'qobuz' ? 'active' : ''}`}
          onClick={() => setActiveTab('qobuz')}
        >
          Qobuz
        </button>
        <button 
          className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          File
        </button>
        <button 
          className={`tab-btn ${activeTab === 'listenbrainz' ? 'active' : ''}`}
          onClick={() => setActiveTab('listenbrainz')}
        >
          ListenBrainz
        </button>
        <button 
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI
        </button>
      </div>
      
      {activeTab === 'deezer' && renderDeezerTab()}
      {activeTab === 'apple' && renderAppleMusicTab()}
      {activeTab === 'tidal' && renderTidalTab()}
      {activeTab === 'spotify' && renderSpotifyTab()}
      {activeTab === 'youtube' && renderYouTubeMusicTab()}
      {activeTab === 'amazon' && renderAmazonMusicTab()}
      {activeTab === 'qobuz' && renderQobuzTab()}
      {activeTab === 'file' && renderFileTab()}
      {activeTab === 'listenbrainz' && renderListenBrainzTab()}
      {activeTab === 'ai' && renderAiTab()}
      
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
                {preImportPlaylist.trackCount > 0 ? `${preImportPlaylist.trackCount} tracks from ` : 'From '}
                {preImportPlaylist.source === 'spotify' ? 'Spotify' : 
                 preImportPlaylist.source === 'deezer' ? 'Deezer' :
                 preImportPlaylist.source === 'apple' ? 'Apple Music' :
                 preImportPlaylist.source === 'tidal' ? 'Tidal' :
                 preImportPlaylist.source === 'youtube' ? 'YouTube Music' :
                 preImportPlaylist.source === 'amazon' ? 'Amazon Music' :
                 preImportPlaylist.source === 'qobuz' ? 'Qobuz' :
                 preImportPlaylist.source === 'listenbrainz' ? 'ListenBrainz' :
                 preImportPlaylist.source === 'file' ? 'File' :
                 preImportPlaylist.source === 'ai' ? 'AI' : 'Unknown'}
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
            
            {matchingSettings.playlistPrefixes?.enabled && (
              <p style={{ color: '#888', fontSize: '12px', marginTop: '-8px' }}>
                Prefix "{matchingSettings.playlistPrefixes[preImportPlaylist.source as keyof typeof matchingSettings.playlistPrefixes] || ''}" will be added
              </p>
            )}
            
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
              Auto-refresh "{schedulePlaylist.name}" from {
                schedulePlaylist.source === 'apple' ? 'Apple Music' : 
                schedulePlaylist.source === 'listenbrainz' ? 'ListenBrainz' :
                schedulePlaylist.source.charAt(0).toUpperCase() + schedulePlaylist.source.slice(1)
              }
            </p>
            
            <div className="input-group">
              <label>Refresh Frequency</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="frequency"
                    checked={scheduleFrequency === 'daily'}
                    onChange={() => setScheduleFrequency('daily')}
                  />
                  Daily
                </label>
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
            
            <p style={{ color: '#888', fontSize: '12px', marginTop: '12px' }}>
              Scheduled updates will clear and replace playlist contents, preserving custom artwork.
            </p>
            
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
