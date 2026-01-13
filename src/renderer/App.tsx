import { useState, useEffect, useCallback } from 'react';
import { fetchAllCharts, MatchedPlaylist, matchPlaylistToPlex, PLAYLIST_SCHEDULES, MatchingSettings, DEFAULT_MATCHING_SETTINGS, setMatchingSettings, DEFAULT_FEATURED_ARTIST_PATTERNS, DEFAULT_VERSION_SUFFIX_PATTERNS, DEFAULT_REMASTER_PATTERNS, DEFAULT_VARIOUS_ARTISTS_NAMES, DEFAULT_PENALTY_KEYWORDS, DEFAULT_PRIORITY_KEYWORDS } from './discovery';
import ImportPage, { ImportProgress } from './ImportPage';
import SharingPage from './SharingPage';
import BackupRestorePage from './BackupRestorePage';
import logoImg from './logo.png';

// Schedule types
type ScheduleFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'none';

interface PlaylistSchedule {
  playlistId: string;
  playlistName: string;
  frequency: ScheduleFrequency;
  startDate: string;
  lastRun?: number;
  chartIds?: string[];
  country: string;
}

// Navigation types
type NavSection = 'generate' | 'discover' | 'import' | 'manage';
type NavPage = 'generate' | 'discover' | 'schedule' | 'import' | 'share' | 'backup' | 'edit';

declare global {
  interface Window {
    api: {
      getAuth: () => Promise<{ token: string | null; user: any; server: any }>;
      startAuth: () => Promise<{ id: string; code: string }>;
      pollAuth: (data: { id: string; code: string }) => Promise<{ token: string; user: any } | null>;
      logout: () => Promise<boolean>;
      getServers: () => Promise<any[]>;
      selectServer: (server: any) => Promise<boolean>;
      getLibraries: (data: { serverUrl: string }) => Promise<any[]>;
      getSettings: () => Promise<{ country: string; libraryId: string | null; autoSync: boolean }>;
      saveSettings: (settings: any) => Promise<boolean>;
      searchTrack: (data: { serverUrl: string; query: string }) => Promise<any[]>;
      createPlaylist: (data: { serverUrl: string; title: string; trackKeys: string[] }) => Promise<boolean>;
      getPlaylists: (data: { serverUrl: string }) => Promise<any[]>;
      getPlaylistTracks: (data: { serverUrl: string; playlistId: string }) => Promise<any[]>;
      addToPlaylist: (data: { serverUrl: string; playlistId: string; trackKey: string }) => Promise<boolean>;
      removeFromPlaylist: (data: { serverUrl: string; playlistId: string; playlistItemId: string }) => Promise<boolean>;
      getPlayHistory: (data: { serverUrl: string; libraryId: string }) => Promise<any[]>;
      findArtist: (data: { serverUrl: string; libraryId: string; name: string }) => Promise<any>;
      getArtistPopularTracks: (data: { serverUrl: string; libraryId: string; artistKey: string; limit: number }) => Promise<any[]>;
      getRandomArtists: (data: { serverUrl: string; libraryId: string; limit: number }) => Promise<any[]>;
      getRecentTracks: (data: { serverUrl: string; libraryId: string }) => Promise<any[]>;
      getSimilarTracks: (data: { serverUrl: string; trackKey: string }) => Promise<any[]>;
      getStalePlayedTracks: (data: { serverUrl: string; libraryId: string; daysAgo: number; limit: number }) => Promise<any[]>;
      getRelatedTracks: (data: { serverUrl: string; trackKey: string; limit: number }) => Promise<any[]>;
      getRecentAlbums: (data: { serverUrl: string; libraryId: string; limit: number }) => Promise<any[]>;
      getAlbumTracks: (data: { serverUrl: string; albumKey: string }) => Promise<any[]>;
      deletePlaylist: (data: { serverUrl: string; playlistId: string }) => Promise<boolean>;
      getRefreshTimes: () => Promise<Record<string, number>>;
      setRefreshTime: (data: { playlistId: string; timestamp: number }) => Promise<boolean>;
      needsRefresh: (data: { playlistId: string; scheduleHours: number }) => Promise<boolean>;
      getSchedules: () => Promise<PlaylistSchedule[]>;
      saveSchedule: (schedule: PlaylistSchedule) => Promise<boolean>;
      deleteSchedule: (playlistId: string) => Promise<boolean>;
      getDueSchedules: () => Promise<PlaylistSchedule[]>;
      markScheduleRun: (playlistId: string) => Promise<boolean>;
      scrapeAriaCharts: (selectedChartIds?: string[]) => Promise<{ id: string; name: string; description: string; tracks: { title: string; artist: string }[] }[]>;
      // Spotify
      getSpotifyAuth: () => Promise<{ accessToken: string | null; refreshToken: string | null; expiresAt: number | null; user: any }>;
      saveSpotifyCredentials: (data: { clientId: string; clientSecret: string }) => Promise<boolean>;
      getSpotifyCredentials: () => Promise<{ clientId: string | null; clientSecret: string | null }>;
      startSpotifyAuth: () => Promise<{ state: string }>;
      exchangeSpotifyCode: (data: { code: string }) => Promise<{ accessToken: string; user: any }>;
      getSpotifyPlaylists: () => Promise<any[]>;
      getSpotifyPlaylistTracks: (data: { playlistId: string }) => Promise<any[]>;
      logoutSpotify: () => Promise<boolean>;
      // Deezer
      searchDeezerPlaylists: (data: { query: string }) => Promise<any[]>;
      getDeezerPlaylistTracks: (data: { playlistId: string }) => Promise<any[]>;
      getDeezerTopPlaylists: () => Promise<any[]>;
      getDeezerAuth: () => Promise<{ accessToken: string | null; user: any }>;
      saveDeezerCredentials: (data: { appId: string; appSecret: string }) => Promise<boolean>;
      getDeezerCredentials: () => Promise<{ appId: string | null; appSecret: string | null }>;
      startDeezerAuth: () => Promise<{ redirectUri: string }>;
      exchangeDeezerCode: (data: { code: string }) => Promise<{ accessToken: string; user: any }>;
      logoutDeezer: () => Promise<boolean>;
      getDeezerUserPlaylists: () => Promise<any[]>;
      // Apple Music
      scrapeAppleMusicPlaylist: (data: { url: string }) => Promise<{ name: string; tracks: { title: string; artist: string }[] }>;
      // Tidal
      scrapeTidalPlaylist: (data: { url: string }) => Promise<{ name: string; tracks: { title: string; artist: string }[] }>;
      getTidalAuth: () => Promise<{ accessToken: string | null; user: any }>;
      saveTidalCredentials: (data: { clientId: string; clientSecret: string }) => Promise<boolean>;
      getTidalCredentials: () => Promise<{ clientId: string | null; clientSecret: string | null }>;
      startTidalAuth: () => Promise<{ redirectUri: string }>;
      exchangeTidalCode: (data: { code: string }) => Promise<{ accessToken: string; user: any }>;
      logoutTidal: () => Promise<boolean>;
      getTidalUserPlaylists: () => Promise<any[]>;
      searchTidalPlaylists: (data: { query: string }) => Promise<any[]>;
      // YouTube Music
      getYouTubeMusicAuth: () => Promise<{ accessToken: string | null; user: any }>;
      saveYouTubeMusicCredentials: (data: { clientId: string; clientSecret: string }) => Promise<boolean>;
      getYouTubeMusicCredentials: () => Promise<{ clientId: string | null; clientSecret: string | null }>;
      startYouTubeMusicAuth: () => Promise<{ redirectUri: string }>;
      exchangeYouTubeMusicCode: (data: { code: string }) => Promise<{ accessToken: string; user: any }>;
      logoutYouTubeMusic: () => Promise<boolean>;
      getYouTubeMusicPlaylists: () => Promise<any[]>;
      getYouTubeMusicPlaylistTracks: (data: { playlistId: string }) => Promise<any[]>;
      scrapeYouTubeMusicPlaylist: (data: { url: string }) => Promise<{ name: string; tracks: { title: string; artist: string }[] }>;
      // Amazon Music
      scrapeAmazonMusicPlaylist: (data: { url: string }) => Promise<{ name: string; tracks: { title: string; artist: string }[] }>;
      // Qobuz
      scrapeQobuzPlaylist: (data: { url: string }) => Promise<{ name: string; tracks: { title: string; artist: string }[] }>;
      // Spotify URL scraping
      scrapeSpotifyPlaylist: (data: { url: string }) => Promise<{ name: string; tracks: { title: string; artist: string }[] }>;
      // File import
      importM3UFile: () => Promise<{ name: string; tracks: { title: string; artist: string }[] } | null>;
      importiTunesXML: () => Promise<{ playlists: { name: string; trackCount: number; tracks: { title: string; artist: string }[] }[] } | null>;
      // ListenBrainz
      getListenBrainzPlaylists: (data: { username: string }) => Promise<{ id: string; name: string; trackCount: number }[]>;
      getListenBrainzPlaylistTracks: (data: { playlistId: string }) => Promise<{ title: string; artist: string }[]>;
      // Other
      getMonthlyTracks: (data: { serverUrl: string; libraryId: string }) => Promise<any[]>;
      getMixesSchedule: () => Promise<{ enabled: boolean; frequency: 'daily' | 'weekly' | 'monthly'; lastRun?: number }>;
      saveMixesSchedule: (schedule: { enabled: boolean; frequency: 'daily' | 'weekly' | 'monthly'; lastRun?: number }) => Promise<boolean>;
      checkMixesScheduleDue: () => Promise<boolean>;
      markMixesScheduleRun: () => Promise<boolean>;
      getHomeUsers: () => Promise<any[]>;
      getSharedServers: () => Promise<any[]>;
      getUserPlaylists: (data: { serverUrl: string; userToken: string }) => Promise<any[]>;
      copyPlaylistToUser: (data: { serverUrl: string; sourcePlaylistId: string; targetUserToken: string; newTitle: string }) => Promise<boolean>;
      deleteUserPlaylist: (data: { serverUrl: string; playlistId: string; userToken: string }) => Promise<boolean>;
      // Update checker
      checkForUpdates: () => Promise<{ hasUpdate: boolean; currentVersion?: string; latestVersion?: string; releaseUrl?: string; releaseNotes?: string; error?: string }>;
      getAppVersion: () => Promise<string>;
      openReleasePage: (url: string) => Promise<boolean>;
    };
  }
}

const COUNTRIES = [
  { code: 'global', name: 'Global' },
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'au', name: 'Australia' },
  { code: 'ca', name: 'Canada' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' },
  { code: 'br', name: 'Brazil' },
  { code: 'jp', name: 'Japan' },
];

const ARIA_CHARTS = [
  { id: 'singles-chart', name: 'ARIA Top Singles', category: 'Main Charts', weekly: true },
  { id: 'australian-artist-singles-chart', name: 'ARIA Top Australian Singles', category: 'Main Charts', weekly: true },
  { id: 'catalogue-singles-chart', name: 'ARIA Top On Replay Singles', category: 'Main Charts', weekly: true },
  { id: 'australian-artist-catalogue-singles-chart', name: 'ARIA Top Australian On Replay Singles', category: 'Main Charts', weekly: true },
  { id: 'hip-hop-r-and-b-singles-chart', name: 'ARIA Top Hip-Hop/R&B Singles', category: 'Genre Charts', weekly: true },
  { id: 'australian-hip-hop-r-and-b-singles-chart', name: 'ARIA Top Australian Hip-Hop/R&B', category: 'Genre Charts', weekly: true },
  { id: 'dance-singles-chart', name: 'ARIA Top Dance Singles', category: 'Genre Charts', weekly: true },
  { id: 'club-tracks-chart', name: 'ARIA Top Club Tracks', category: 'Genre Charts', weekly: true },
  { id: '2010-end-of-decade-singles-chart', name: 'ARIA Top End of Decade 2010s', category: 'Decade Charts', weekly: false },
  { id: '2000-end-of-decade-singles-chart', name: 'ARIA Top End of Decade 2000s', category: 'Decade Charts', weekly: false },
];

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function App() {
  const [auth, setAuth] = useState<{ token: string | null; user: any; server: any }>({ token: null, user: null, server: null });
  const [servers, setServers] = useState<any[]>([]);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [settings, setSettings] = useState({ country: 'global', libraryId: '', autoSync: false });
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Navigation state
  const [currentPage, setCurrentPage] = useState<NavPage>('import');
  const [expandedSections, setExpandedSections] = useState<Set<NavSection>>(new Set(['import', 'generate', 'manage']));
  
  const [playlists, setPlaylists] = useState<MatchedPlaylist[]>([]);
  const [createdPlaylists, setCreatedPlaylists] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [mixesSchedule, setMixesSchedule] = useState<{ enabled: boolean; frequency: 'daily' | 'weekly' | 'monthly'; lastRun?: number }>({ enabled: false, frequency: 'weekly' });
  
  const [selectedPlaylist, setSelectedPlaylist] = useState<MatchedPlaylist | null>(null);
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [trackSortField, setTrackSortField] = useState<'none' | 'title' | 'artist' | 'status' | 'score'>('none');
  const [trackSortDir, setTrackSortDir] = useState<'asc' | 'desc'>('asc');
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [schedules, setSchedules] = useState<PlaylistSchedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulePlaylist, setSchedulePlaylist] = useState<MatchedPlaylist | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>('weekly');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [manualSearchTrack, setManualSearchTrack] = useState<{ index: number; title: string; artist: string } | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isManualSearching, setIsManualSearching] = useState(false);
  const [showChartScheduler, setShowChartScheduler] = useState(false);
  const [chartScheduleSelections, setChartScheduleSelections] = useState<Map<string, { frequency: ScheduleFrequency; startDate: string }>>(new Map());

  // Update notification state
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; latestVersion?: string; releaseUrl?: string; releaseNotes?: string } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Edit playlists state
  const [editPlaylists, setEditPlaylists] = useState<any[]>([]);
  const [isLoadingEditPlaylists, setIsLoadingEditPlaylists] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<any | null>(null);
  const [editPlaylistTracks, setEditPlaylistTracks] = useState<any[]>([]);
  const [isLoadingEditTracks, setIsLoadingEditTracks] = useState(false);
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editSearchResults, setEditSearchResults] = useState<any[]>([]);
  const [isEditSearching, setIsEditSearching] = useState(false);

  // Matching settings state
  const [showMatchingSettings, setShowMatchingSettings] = useState(false);
  const [matchingSettings, setMatchingSettingsState] = useState<MatchingSettings>(DEFAULT_MATCHING_SETTINGS);
  const [newStripPattern, setNewStripPattern] = useState('');
  const [newFeatPattern, setNewFeatPattern] = useState('');
  const [newVersionPattern, setNewVersionPattern] = useState('');
  const [newRemasterPattern, setNewRemasterPattern] = useState('');
  const [newVariousName, setNewVariousName] = useState('');
  const [newPenaltyKeyword, setNewPenaltyKeyword] = useState('');
  const [newPriorityKeyword, setNewPriorityKeyword] = useState('');
  const [expandedPatternSection, setExpandedPatternSection] = useState<string | null>(null);

  // Global import progress state (shared with ImportPage)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    async function init() {
      const authData = await window.api.getAuth();
      setAuth(authData);
      
      if (authData.token) {
        const savedSettings = await window.api.getSettings();
        setSettings({
          country: savedSettings.country || 'global',
          libraryId: savedSettings.libraryId || '',
          autoSync: savedSettings.autoSync || false,
        });
        
        // Load matching settings
        if (savedSettings.matchingSettings) {
          setMatchingSettingsState(savedSettings.matchingSettings);
          setMatchingSettings(savedSettings.matchingSettings);
        }
        
        if (authData.server) {
          const url = authData.server.connections?.[0]?.uri;
          setServerUrl(url);
          if (url) {
            const libs = await window.api.getLibraries({ serverUrl: url });
            setLibraries(libs);
          }
        } else {
          const serverList = await window.api.getServers();
          setServers(serverList);
        }
        
        const savedSchedules = await window.api.getSchedules();
        setSchedules(savedSchedules);
        
        const savedMixesSchedule = await window.api.getMixesSchedule();
        setMixesSchedule(savedMixesSchedule);
        
        // Check if mixes schedule is due
        if (savedMixesSchedule.enabled && authData.server && savedSettings.libraryId) {
          const isDue = await window.api.checkMixesScheduleDue();
          if (isDue) {
            console.log('Mixes schedule is due, auto-generating...');
            // Will trigger after component mounts
            setTimeout(() => {
              const generateBtn = document.querySelector('[data-auto-generate]') as HTMLButtonElement;
              if (generateBtn) generateBtn.click();
            }, 1000);
          }
        }
      }
      setIsLoading(false);
      
      // Check for updates
      try {
        const update = await window.api.checkForUpdates();
        if (update.hasUpdate) {
          setUpdateInfo(update);
          setShowUpdateModal(true);
        }
      } catch (e) {
        console.log('Update check failed:', e);
      }
    }
    init();
  }, []);

  const handleLogin = async () => {
    setIsAuthenticating(true);
    setStatusMessage('Opening browser for Plex login...');
    
    const { id, code } = await window.api.startAuth();
    
    const pollInterval = setInterval(async () => {
      const result = await window.api.pollAuth({ id, code });
      if (result) {
        clearInterval(pollInterval);
        setAuth({ token: result.token, user: result.user, server: null });
        const serverList = await window.api.getServers();
        setServers(serverList);
        setIsAuthenticating(false);
        setStatusMessage('');
      }
    }, 2000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsAuthenticating(false);
      setStatusMessage('Login timed out. Please try again.');
    }, 120000);
  };

  const handleSelectServer = async (server: any) => {
    await window.api.selectServer(server);
    const url = server.connections?.[0]?.uri;
    setServerUrl(url);
    setAuth(prev => ({ ...prev, server }));
    
    if (url) {
      const libs = await window.api.getLibraries({ serverUrl: url });
      setLibraries(libs);
    }
  };

  const handleSaveSettings = async (newSettings: typeof settings) => {
    setSettings(newSettings);
    await window.api.saveSettings(newSettings);
  };

  const handleLogout = async () => {
    await window.api.logout();
    setAuth({ token: null, user: null, server: null });
    setServers([]);
    setServerUrl(null);
    setPlaylists([]);
  };

  const toggleSection = (section: NavSection) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };


  // Generate mixes functions
  const handleGenerateAll = useCallback(async () => {
    if (!serverUrl || !settings.libraryId) return;
    
    setIsGenerating(true);
    setGeneratedCount(0);
    
    try {
      setStatusMessage('Cleaning up old playlists...');
      const existingPlaylists = await window.api.getPlaylists({ serverUrl });
      for (const p of existingPlaylists) {
        if (p.title === 'Your Weekly Mix' || 
            p.title === 'Time Capsule' ||
            p.title === 'New Music Mix' ||
            p.title === 'Daily Mix') {
          await window.api.deletePlaylist({ serverUrl, playlistId: p.ratingKey });
        }
      }

      setStatusMessage('Generating Your Weekly Mix...');
      const weeklyCreated = await generateWeeklyMix();
      if (weeklyCreated) setGeneratedCount(c => c + 1);

      setStatusMessage('Creating Time Capsule...');
      const history = await window.api.getPlayHistory({ serverUrl, libraryId: settings.libraryId });
      const olderHistory = history.filter((h: any) => {
        const age = Date.now() - (h.viewedAt * 1000);
        return age > 30 * 24 * 60 * 60 * 1000;
      });
      
      if (olderHistory.length >= 5) {
        const timeCapsuleCreated = await createTimeCapsule(olderHistory);
        if (timeCapsuleCreated) setGeneratedCount(c => c + 1);
      }

      setStatusMessage('Creating New Music Mix...');
      const newMusicCreated = await createNewMusicMix();
      if (newMusicCreated) setGeneratedCount(c => c + 1);

      setStatusMessage('Creating Daily Mix...');
      const dailyMixCreated = await createDailyMix();
      if (dailyMixCreated) setGeneratedCount(c => c + 1);

      // Mark schedule as run
      await window.api.markMixesScheduleRun();
      const updatedSchedule = await window.api.getMixesSchedule();
      setMixesSchedule(updatedSchedule);

      setStatusMessage(`Done! Created playlists.`);
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [serverUrl, settings.libraryId]);

  const generateWeeklyMix = async () => {
    console.log('Generating Weekly Mix...');
    
    try {
      // Get recently played tracks from the last 7 days
      let recentTracks = await window.api.getRecentTracks({ serverUrl: serverUrl!, libraryId: settings.libraryId });
      console.log('Recent tracks (last 7 days):', recentTracks.length);
      
      // If not enough recent tracks, fall back to last 30 days
      if (recentTracks.length < 20) {
        console.log('Not enough recent tracks, falling back to last 30 days...');
        recentTracks = await window.api.getMonthlyTracks({ serverUrl: serverUrl!, libraryId: settings.libraryId });
        console.log('Monthly tracks (last 30 days):', recentTracks.length);
      }
      
      // Count plays per artist
      const artistCounts = new Map<string, number>();
      for (const track of recentTracks) {
        const artist = track.grandparentTitle || 'Unknown';
        // Skip "Various Artists" and "Unknown"
        if (artist === 'Various Artists' || artist === 'Unknown' || artist === 'Soundtrack') continue;
        artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
      }
      
      // Get top 10 artists by play count
      const topArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name);
      
      console.log('Top 10 artists:', topArtists);
      
      // Find these artists in the library
      const artistKeys: { key: string; name: string }[] = [];
      for (const name of topArtists) {
        const artist = await window.api.findArtist({ serverUrl: serverUrl!, libraryId: settings.libraryId, name });
        if (artist) {
          artistKeys.push({ key: artist.ratingKey, name: artist.title });
        }
      }
      
      console.log('Found artists in library:', artistKeys.length, artistKeys.map(a => a.name));
      
      if (artistKeys.length === 0) {
        console.log('No artists found from listening history');
        return false;
      }
      
      // Get top 5 popular tracks from each artist (from Plex's Popular Tracks hub)
      const allTracks: string[] = [];
      for (const artist of artistKeys.slice(0, 10)) {
        console.log(`Getting popular tracks for ${artist.name}...`);
        const tracks = await window.api.getArtistPopularTracks({ 
          serverUrl: serverUrl!, 
          libraryId: settings.libraryId, 
          artistKey: artist.key, 
          limit: 5 
        });
        console.log(`  ${artist.name}: ${tracks.length} popular tracks`);
        for (const track of tracks) {
          if (!allTracks.includes(track.ratingKey)) {
            allTracks.push(track.ratingKey);
          }
        }
      }
      
      console.log('Total tracks for Weekly Mix:', allTracks.length);
      
      if (allTracks.length >= 5) {
        await window.api.createPlaylist({ serverUrl: serverUrl!, title: 'Your Weekly Mix', trackKeys: shuffle(allTracks) });
        console.log('Your Weekly Mix created with', allTracks.length, 'tracks!');
        return true;
      }
      console.log('Not enough tracks for Weekly Mix (need at least 5)');
      return false;
    } catch (error) {
      console.error('Error generating Weekly Mix:', error);
      return false;
    }
  };

  const createArtistMix = async (artistName: string, seedTracks: any[]) => {
    const mixTracks: string[] = [];
    const addedKeys = new Set<string>();

    for (const seed of seedTracks.slice(0, 5)) {
      if (!addedKeys.has(seed.ratingKey)) {
        mixTracks.push(seed.ratingKey);
        addedKeys.add(seed.ratingKey);
      }
    }

    for (const seed of seedTracks.slice(0, 3)) {
      const similar = await window.api.getSimilarTracks({ serverUrl: serverUrl!, trackKey: seed.ratingKey });
      for (const track of similar.slice(0, 5)) {
        if (!addedKeys.has(track.ratingKey)) {
          mixTracks.push(track.ratingKey);
          addedKeys.add(track.ratingKey);
        }
        if (mixTracks.length >= 25) break;
      }
      if (mixTracks.length >= 25) break;
    }

    if (mixTracks.length >= 10) {
      await window.api.createPlaylist({ serverUrl: serverUrl!, title: `${artistName} Mix`, trackKeys: shuffle(mixTracks) });
      return true;
    }
    return false;
  };

  const createTimeCapsule = async (olderHistory: any[]) => {
    const uniqueTracks = new Map<string, string>();
    for (const item of olderHistory) {
      if (!uniqueTracks.has(item.ratingKey)) uniqueTracks.set(item.ratingKey, item.ratingKey);
    }
    const trackKeys = Array.from(uniqueTracks.values()).slice(0, 25);
    if (trackKeys.length >= 5) {
      await window.api.createPlaylist({ serverUrl: serverUrl!, title: 'Time Capsule', trackKeys: shuffle(trackKeys) });
      return true;
    }
    return false;
  };

  const createNewMusicMix = async () => {
    const albums = await window.api.getRecentAlbums({ serverUrl: serverUrl!, libraryId: settings.libraryId, limit: 10 });
    const trackKeys: string[] = [];
    for (const album of albums.slice(0, 5)) {
      const tracks = await window.api.getAlbumTracks({ serverUrl: serverUrl!, albumKey: album.ratingKey });
      const shuffledTracks = shuffle(tracks).slice(0, 3);
      for (const track of shuffledTracks) trackKeys.push(track.ratingKey);
    }
    if (trackKeys.length >= 5) {
      await window.api.createPlaylist({ serverUrl: serverUrl!, title: 'New Music Mix', trackKeys: shuffle(trackKeys) });
      return true;
    }
    return false;
  };

  // Daily Mix: 50 recent tracks + 4 related each + 50 stale tracks = ~150 tracks
  const createDailyMix = async () => {
    console.log('Creating Daily Mix...');
    const addedKeys = new Set<string>();
    const mixTracks: string[] = [];
    
    // 1. Get last 50 listened tracks
    const recentTracks = await window.api.getRecentTracks({ serverUrl: serverUrl!, libraryId: settings.libraryId });
    const seedTracks = recentTracks.slice(0, 50);
    console.log(`[Daily Mix] Seed tracks: ${seedTracks.length}`);
    
    // Add seed tracks
    for (const track of seedTracks) {
      if (!addedKeys.has(track.ratingKey)) {
        mixTracks.push(track.ratingKey);
        addedKeys.add(track.ratingKey);
      }
    }
    
    // 2. For each seed track, get up to 4 related tracks (same artist/album)
    for (const seed of seedTracks.slice(0, 50)) {
      const related = await window.api.getRelatedTracks({ serverUrl: serverUrl!, trackKey: seed.ratingKey, limit: 4 });
      for (const track of related) {
        if (!addedKeys.has(track.ratingKey)) {
          mixTracks.push(track.ratingKey);
          addedKeys.add(track.ratingKey);
        }
      }
    }
    console.log(`[Daily Mix] After related tracks: ${mixTracks.length}`);
    
    // 3. Get 50 tracks not played in 20+ days
    const staleTracks = await window.api.getStalePlayedTracks({ 
      serverUrl: serverUrl!, 
      libraryId: settings.libraryId, 
      daysAgo: 20, 
      limit: 50 
    });
    for (const track of staleTracks) {
      if (!addedKeys.has(track.ratingKey)) {
        mixTracks.push(track.ratingKey);
        addedKeys.add(track.ratingKey);
      }
    }
    console.log(`[Daily Mix] Final track count: ${mixTracks.length}`);
    
    if (mixTracks.length >= 20) {
      await window.api.createPlaylist({ serverUrl: serverUrl!, title: 'Daily Mix', trackKeys: shuffle(mixTracks) });
      console.log('Daily Mix created!');
      return true;
    }
    console.log('Not enough tracks for Daily Mix');
    return false;
  };

  // Discover charts
  const handleDiscover = useCallback(async () => {
    if (!serverUrl || !settings.libraryId) return;
    
    if (settings.country === 'au' && !showPlaylistSelector) {
      setSelectedCharts(new Set(ARIA_CHARTS.map(c => c.id)));
      setShowPlaylistSelector(true);
      return;
    }
    
    setShowPlaylistSelector(false);
    setIsDiscovering(true);
    setStatusMessage(settings.country === 'au' ? 'Scraping ARIA charts...' : 'Fetching charts from Deezer and Last.fm...');
    setPlaylists([]);
    
    try {
      const charts = await fetchAllCharts(settings.country, settings.country === 'au' ? Array.from(selectedCharts) : undefined);
      setStatusMessage(`Found ${charts.length} playlists. Matching against your library...`);
      
      const matched: MatchedPlaylist[] = [];
      for (let i = 0; i < charts.length; i++) {
        setStatusMessage(`Matching "${charts[i].name}" (${i + 1}/${charts.length})...`);
        const result = await matchPlaylistToPlex(charts[i], serverUrl, window.api.searchTrack);
        matched.push(result);
        setPlaylists([...matched]);
      }
      
      if (settings.autoSync) {
        const existingPlaylists = await window.api.getPlaylists({ serverUrl });
        let syncedCount = 0;
        
        for (const playlist of matched) {
          if (playlist.matchedCount < 5) continue;
          
          let scheduleHours = PLAYLIST_SCHEDULES['top-charts'];
          if (playlist.id.includes('decade')) scheduleHours = PLAYLIST_SCHEDULES['decade'];
          else if (playlist.id.includes('genre') || playlist.id.includes('pop') || playlist.id.includes('rock')) scheduleHours = PLAYLIST_SCHEDULES['genre'];
          
          const needsRefresh = await window.api.needsRefresh({ playlistId: playlist.id, scheduleHours });
          if (!needsRefresh) continue;
          
          setStatusMessage(`Syncing "${playlist.name}" to Plex...`);
          const playlistTitle = playlist.name;
          const existing = existingPlaylists.find((p: any) => p.title === playlistTitle);
          if (existing) await window.api.deletePlaylist({ serverUrl, playlistId: existing.ratingKey });
          
          const trackKeys = playlist.tracks.filter(t => t.matched && t.plexRatingKey).map(t => t.plexRatingKey!);
          if (trackKeys.length > 0) {
            const success = await window.api.createPlaylist({ serverUrl, title: playlistTitle, trackKeys });
            if (success) {
              await window.api.setRefreshTime({ playlistId: playlist.id, timestamp: Date.now() });
              setCreatedPlaylists(prev => [...prev, playlist.id]);
              syncedCount++;
            }
          }
        }
        setStatusMessage(syncedCount > 0 ? `Done! Synced ${syncedCount} playlists to Plex.` : 'All playlists are up to date.');
      } else {
        const goodMatches = matched.filter(m => m.matchedCount >= 5);
        setStatusMessage(goodMatches.length > 0 ? `Found ${goodMatches.length} playlists with 5+ matches.` : 'Matching complete.');
      }
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsDiscovering(false);
    }
  }, [serverUrl, settings.country, settings.libraryId, settings.autoSync, showPlaylistSelector, selectedCharts]);

  const handleCreatePlaylist = async (playlist: MatchedPlaylist) => {
    if (!serverUrl) return;
    const trackKeys = playlist.tracks.filter(t => t.matched && t.plexRatingKey).map(t => t.plexRatingKey!);
    if (trackKeys.length === 0) {
      setStatusMessage('No matched tracks to create playlist.');
      return;
    }
    const success = await window.api.createPlaylist({ serverUrl, title: playlist.name, trackKeys });
    if (success) {
      setCreatedPlaylists(prev => [...prev, playlist.id]);
      setStatusMessage(`Created "${playlist.name}" with ${trackKeys.length} tracks!`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // Manual search
  const handleManualSearch = async () => {
    console.log('Manual search triggered, serverUrl:', serverUrl, 'query:', manualSearchQuery);
    if (!serverUrl || !manualSearchQuery.trim()) {
      console.log('Search aborted - missing serverUrl or query');
      return;
    }
    setIsManualSearching(true);
    try {
      console.log('Searching for:', manualSearchQuery);
      const results = await window.api.searchTrack({ serverUrl, query: manualSearchQuery });
      console.log('Search results:', results?.length || 0, 'tracks');
      setManualSearchResults(results.slice(0, 20));
    } catch (error) {
      console.error('Manual search error:', error);
      setManualSearchResults([]);
    } finally {
      setIsManualSearching(false);
    }
  };

  const handleManualMatch = (plexTrack: any) => {
    if (!selectedPlaylist || manualSearchTrack === null) return;
    const updatedTracks = [...selectedPlaylist.tracks];
    const plexArtist = plexTrack.grandparentTitle || plexTrack.originalTitle || '';
    updatedTracks[manualSearchTrack.index] = { 
      ...updatedTracks[manualSearchTrack.index], 
      matched: true, 
      plexRatingKey: plexTrack.ratingKey, 
      plexTitle: plexTrack.title,
      plexArtist: plexArtist,
      score: 100 
    };
    const updatedPlaylist = { ...selectedPlaylist, tracks: updatedTracks, matchedCount: updatedTracks.filter(t => t.matched).length };
    setPlaylists(prev => prev.map(p => p.id === selectedPlaylist.id ? updatedPlaylist : p));
    setSelectedPlaylist(updatedPlaylist);
    setManualSearchTrack(null);
    setManualSearchQuery('');
    setManualSearchResults([]);
  };

  const openManualSearch = (trackIndex: number, title: string, artist: string) => {
    setManualSearchTrack({ index: trackIndex, title, artist });
    // Use only the first artist if there are multiple (split by comma)
    const firstArtist = artist.split(',')[0].trim();
    setManualSearchQuery(`${firstArtist} ${title}`);
    setManualSearchResults([]);
  };


  // Render sidebar navigation
  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={logoImg} alt="" className="sidebar-logo" />
        <span className="sidebar-title">Playlist Lab</span>
      </div>
      
      <nav className="sidebar-nav">
        {/* Import Playlists */}
        <div className="nav-section">
          <div className="nav-section-header" onClick={() => toggleSection('import')}>
            <span>Import Playlists</span>
            <span className="nav-arrow">{expandedSections.has('import') ? '▼' : '▶'}</span>
          </div>
          {expandedSections.has('import') && (
            <div className="nav-items">
              <div className={`nav-item ${currentPage === 'import' ? 'active' : ''}`} onClick={() => setCurrentPage('import')}>
                Browse Sources
              </div>
              <div className={`nav-item ${currentPage === 'discover' ? 'active' : ''}`} onClick={() => setCurrentPage('discover')}>
                Charts
              </div>
              <div className={`nav-item ${currentPage === 'schedule' ? 'active' : ''}`} onClick={() => setCurrentPage('schedule')}>
                Schedule Playlists
              </div>
            </div>
          )}
        </div>
        
        {/* Generate Plex Playlists */}
        <div className="nav-section">
          <div className="nav-section-header" onClick={() => toggleSection('generate')}>
            <span>Generate Plex Playlists</span>
            <span className="nav-arrow">{expandedSections.has('generate') ? '▼' : '▶'}</span>
          </div>
          {expandedSections.has('generate') && (
            <div className="nav-items">
              <div className={`nav-item ${currentPage === 'generate' ? 'active' : ''}`} onClick={() => setCurrentPage('generate')}>
                Personal Mixes
              </div>
            </div>
          )}
        </div>
        
        {/* Manage Plex Playlists */}
        <div className="nav-section">
          <div className="nav-section-header" onClick={() => toggleSection('manage')}>
            <span>Manage Plex Playlists</span>
            <span className="nav-arrow">{expandedSections.has('manage') ? '▼' : '▶'}</span>
          </div>
          {expandedSections.has('manage') && (
            <div className="nav-items">
              <div className={`nav-item ${currentPage === 'edit' ? 'active' : ''}`} onClick={() => setCurrentPage('edit')}>
                Edit Playlists
              </div>
              <div className={`nav-item ${currentPage === 'share' ? 'active' : ''}`} onClick={() => setCurrentPage('share')}>
                Share Playlists
              </div>
              <div className={`nav-item ${currentPage === 'backup' ? 'active' : ''}`} onClick={() => setCurrentPage('backup')}>
                Backup & Restore
              </div>
            </div>
          )}
        </div>
      </nav>
      
      {/* Matching Settings */}
      <div className="sidebar-matching">
        <button className="btn btn-secondary btn-small btn-full" onClick={() => setShowMatchingSettings(true)}>
          ⚙️ Matching Settings
        </button>
      </div>
      
      {/* Settings at bottom */}
      <div className="sidebar-footer">
        <div className="sidebar-settings">
          <div className="setting-row">
            <label>Country</label>
            <select className="select select-small" value={settings.country} onChange={e => handleSaveSettings({ ...settings, country: e.target.value })}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="setting-row">
            <label>Library</label>
            <select className="select select-small" value={settings.libraryId} onChange={e => handleSaveSettings({ ...settings, libraryId: e.target.value })}>
              <option value="">Select...</option>
              {libraries.map(lib => <option key={lib.id} value={lib.id}>{lib.title}</option>)}
            </select>
          </div>
        </div>
        
        <div className="sidebar-user">
          {auth.user?.thumb && <img src={auth.user.thumb} className="user-avatar-small" alt="" />}
          <span className="user-name">{auth.user?.username}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </div>
  );

  // Render main content based on current page
  const renderContent = () => {
    if (!serverUrl) return null;
    
    switch (currentPage) {
      case 'generate':
        return renderGeneratePage();
      case 'discover':
        return renderDiscoverPage();
      case 'schedule':
        return renderSchedulePage();
      case 'import':
        return <ImportPage serverUrl={serverUrl} onBack={() => setCurrentPage('import')} onPlaylistSelect={setSelectedPlaylist} importProgress={importProgress} setImportProgress={setImportProgress} />;
      case 'share':
        return <SharingPage serverUrl={serverUrl} onBack={() => setCurrentPage('share')} />;
      case 'backup':
        return <BackupRestorePage serverUrl={serverUrl} onBack={() => setCurrentPage('backup')} />;
      case 'edit':
        return renderEditPlaylistsPage();
      default:
        return renderGeneratePage();
    }
  };

  const renderGeneratePage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Generate Personal Mixes</h1>
      </div>
      
      <div className="card">
        <p style={{ marginBottom: '16px', color: '#a0a0a0' }}>
          Generate personalized playlists based on your listening history. Creates Weekly Mix, Daily Mix, Time Capsule, and New Music Mix.
        </p>
        
        <button className="btn btn-primary btn-large" data-auto-generate onClick={handleGenerateAll} disabled={isGenerating || !settings.libraryId}>
          {isGenerating ? `Generating... (${generatedCount})` : 'Generate Personal Mixes'}
        </button>
        
        {statusMessage && (
          <div className="status-box">
            {isGenerating && <div className="spinner" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
      
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Auto-Generate Schedule</h3>
        <label className="toggle-label" style={{ marginBottom: '12px' }}>
          <input 
            type="checkbox" 
            checked={mixesSchedule.enabled} 
            onChange={e => {
              const newSchedule = { ...mixesSchedule, enabled: e.target.checked };
              setMixesSchedule(newSchedule);
              window.api.saveMixesSchedule(newSchedule);
            }} 
          />
          Enable automatic generation
        </label>
        
        {mixesSchedule.enabled && (
          <div style={{ marginLeft: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input 
                type="radio" 
                name="mixFreq" 
                checked={mixesSchedule.frequency === 'daily'} 
                onChange={() => {
                  const newSchedule = { ...mixesSchedule, frequency: 'daily' as const };
                  setMixesSchedule(newSchedule);
                  window.api.saveMixesSchedule(newSchedule);
                }}
              /> Daily
            </label>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input 
                type="radio" 
                name="mixFreq" 
                checked={mixesSchedule.frequency === 'weekly'} 
                onChange={() => {
                  const newSchedule = { ...mixesSchedule, frequency: 'weekly' as const };
                  setMixesSchedule(newSchedule);
                  window.api.saveMixesSchedule(newSchedule);
                }}
              /> Weekly
            </label>
            <label style={{ display: 'block' }}>
              <input 
                type="radio" 
                name="mixFreq" 
                checked={mixesSchedule.frequency === 'monthly'} 
                onChange={() => {
                  const newSchedule = { ...mixesSchedule, frequency: 'monthly' as const };
                  setMixesSchedule(newSchedule);
                  window.api.saveMixesSchedule(newSchedule);
                }}
              /> Monthly
            </label>
            {mixesSchedule.lastRun && (
              <p style={{ marginTop: '12px', color: '#a0a0a0', fontSize: '12px' }}>
                Last generated: {new Date(mixesSchedule.lastRun).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
      
      <div className="card info-card">
        <h3>What gets created:</h3>
        <ul>
          <li><strong>Your Weekly Mix</strong> - Based on your top artists</li>
          <li><strong>Daily Mix</strong> - Recent tracks + related songs + rediscoveries (~150 tracks)</li>
          <li><strong>Time Capsule</strong> - Rediscover older favorites</li>
          <li><strong>New Music Mix</strong> - Fresh tracks from recent additions</li>
        </ul>
      </div>
    </div>
  );

  const renderDiscoverPage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Discover Charts</h1>
      </div>
      
      <div className="card">
        <p style={{ marginBottom: '16px', color: '#a0a0a0' }}>
          {settings.country === 'au' 
            ? 'Scrape ARIA charts and match against your Plex library.'
            : 'Fetch trending charts from Deezer and Last.fm, then match against your library.'}
        </p>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary btn-large" onClick={handleDiscover} disabled={isDiscovering || !settings.libraryId}>
            {isDiscovering ? 'Discovering...' : 'Discover Charts'}
          </button>
          {isDiscovering && (
            <button className="btn btn-secondary btn-large" onClick={() => setIsDiscovering(false)}>
              Cancel
            </button>
          )}
        </div>
        
        {statusMessage && (
          <div className="status-box">
            {isDiscovering && <div className="spinner" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
      
      {playlists.length > 0 && (
        <div className="discovered-playlists">
          <h2>Discovered Playlists</h2>
          <p className="hint">Click any playlist to view details and create in Plex</p>
          <div className="playlist-grid">
            {playlists.map(playlist => (
              <div key={playlist.id} className={`playlist-card ${playlist.source} ${playlist.matchedCount < 5 ? 'low-match' : ''}`} onClick={() => setSelectedPlaylist(playlist)}>
                <div className="playlist-source">{playlist.source.toUpperCase()}</div>
                <div className="playlist-name">{playlist.name}</div>
                <div className="playlist-match">{playlist.matchedCount}/{playlist.totalCount} tracks matched</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(playlist.matchedCount / playlist.totalCount) * 100}%` }} />
                </div>
                {createdPlaylists.includes(playlist.id) && <div className="created-badge">Created</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Edit Playlists functions
  const loadEditPlaylists = async () => {
    if (!serverUrl) return;
    setIsLoadingEditPlaylists(true);
    try {
      const playlists = await window.api.getPlaylists({ serverUrl });
      setEditPlaylists(playlists);
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setIsLoadingEditPlaylists(false);
    }
  };

  const openPlaylistForEdit = async (playlist: any) => {
    setEditingPlaylist(playlist);
    setIsLoadingEditTracks(true);
    setEditPlaylistTracks([]);
    setEditSearchQuery('');
    setEditSearchResults([]);
    try {
      const tracks = await window.api.getPlaylistTracks({ serverUrl: serverUrl!, playlistId: playlist.ratingKey });
      setEditPlaylistTracks(tracks);
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
    } finally {
      setIsLoadingEditTracks(false);
    }
  };

  const handleEditSearch = async () => {
    if (!editSearchQuery.trim() || !serverUrl) return;
    setIsEditSearching(true);
    try {
      const results = await window.api.searchTrack({ serverUrl, query: editSearchQuery });
      setEditSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsEditSearching(false);
    }
  };

  const handleAddTrackToPlaylist = async (track: any) => {
    if (!editingPlaylist || !serverUrl) return;
    const success = await window.api.addToPlaylist({ 
      serverUrl, 
      playlistId: editingPlaylist.ratingKey, 
      trackKey: track.ratingKey 
    });
    if (success) {
      // Reload tracks
      const tracks = await window.api.getPlaylistTracks({ serverUrl, playlistId: editingPlaylist.ratingKey });
      setEditPlaylistTracks(tracks);
      setEditSearchResults([]);
      setEditSearchQuery('');
    }
  };

  const handleRemoveTrackFromPlaylist = async (track: any) => {
    if (!editingPlaylist || !serverUrl) return;
    const success = await window.api.removeFromPlaylist({ 
      serverUrl, 
      playlistId: editingPlaylist.ratingKey, 
      playlistItemId: track.playlistItemID 
    });
    if (success) {
      setEditPlaylistTracks(prev => prev.filter(t => t.playlistItemID !== track.playlistItemID));
    }
  };

  const renderEditPlaylistsPage = () => {
    // If editing a specific playlist, show the detail view
    if (editingPlaylist) {
      return (
        <div className="page-content">
          <div className="page-header">
            <button className="btn btn-secondary btn-small" onClick={() => setEditingPlaylist(null)}>← Back</button>
            <h1>{editingPlaylist.title}</h1>
          </div>

          <div className="card">
            <h3>Add Tracks</h3>
            <div className="search-bar-row" style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={editSearchQuery}
                onChange={e => setEditSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditSearch()}
                placeholder="Search for tracks to add..."
              />
              <button className="btn btn-primary" onClick={handleEditSearch} disabled={isEditSearching}>
                {isEditSearching ? '...' : 'Search'}
              </button>
            </div>
            
            {editSearchResults.length > 0 && (
              <div className="search-results-list">
                {editSearchResults.slice(0, 10).map((track: any) => (
                  <div key={track.ratingKey} className="search-result-item">
                    <div className="track-info">
                      <span className="track-title">{track.title}</span>
                      <span className="track-artist">{track.grandparentTitle} - {track.parentTitle}</span>
                    </div>
                    <button className="btn btn-small btn-primary" onClick={() => handleAddTrackToPlaylist(track)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Playlist Tracks ({editPlaylistTracks.length})</h3>
            {isLoadingEditTracks ? (
              <div className="loading">Loading tracks...</div>
            ) : editPlaylistTracks.length === 0 ? (
              <p className="empty-state">No tracks in this playlist</p>
            ) : (
              <div className="edit-track-list">
                {editPlaylistTracks.map((track: any, index: number) => (
                  <div key={track.playlistItemID || track.ratingKey} className="edit-track-item">
                    <span className="track-number">{index + 1}</span>
                    <div className="track-info">
                      <span className="track-title">{track.title}</span>
                      <span className="track-artist">{track.grandparentTitle} - {track.parentTitle}</span>
                    </div>
                    <button 
                      className="btn btn-small btn-danger" 
                      onClick={() => handleRemoveTrackFromPlaylist(track)}
                      title="Remove from playlist"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Show playlist list
    return (
      <div className="page-content">
        <div className="page-header">
          <h1>Edit Playlists</h1>
          <button className="btn btn-secondary btn-small" onClick={loadEditPlaylists} disabled={isLoadingEditPlaylists}>
            {isLoadingEditPlaylists ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {isLoadingEditPlaylists ? (
          <div className="loading">Loading playlists...</div>
        ) : editPlaylists.length === 0 ? (
          <div className="card">
            <p className="empty-state">No playlists found. Click Refresh to load your playlists.</p>
          </div>
        ) : (
          <div className="playlist-grid">
            {editPlaylists.map((playlist: any) => (
              <div 
                key={playlist.ratingKey} 
                className="import-playlist-card clickable"
                onClick={() => openPlaylistForEdit(playlist)}
              >
                <div className="playlist-info">
                  <span className="playlist-name">{playlist.title}</span>
                  <span className="playlist-meta">{playlist.leafCount || 0} tracks</span>
                </div>
                <button className="btn btn-small btn-secondary">Edit</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSchedulePage = () => (
    <div className="page-content">
      <div className="page-header">
        <h1>Schedule Playlists</h1>
      </div>
      
      {settings.country === 'au' && (
        <div className="card">
          <h3>Schedule ARIA Charts</h3>
          <p style={{ marginBottom: '16px', color: '#a0a0a0' }}>Set up automatic rescanning for ARIA charts.</p>
          <button className="btn btn-secondary" onClick={() => setShowChartScheduler(true)}>Configure ARIA Schedules</button>
        </div>
      )}
      
      <div className="card">
        <h3>Active Schedules</h3>
        {schedules.filter(s => s.frequency !== 'none').length === 0 ? (
          <p className="empty-state">No scheduled playlists. Discover charts first, then schedule them.</p>
        ) : (
          <div className="schedule-list">
            {schedules.filter(s => s.frequency !== 'none').map(schedule => {
              const getNextRun = () => {
                const start = new Date(schedule.startDate);
                const now = new Date();
                const lastRun = schedule.lastRun ? new Date(schedule.lastRun) : null;
                let next = lastRun ? new Date(lastRun) : start;
                if (lastRun) {
                  switch (schedule.frequency) {
                    case 'weekly': next.setDate(next.getDate() + 7); break;
                    case 'fortnightly': next.setDate(next.getDate() + 14); break;
                    case 'monthly': next.setMonth(next.getMonth() + 1); break;
                  }
                }
                while (next <= now) {
                  switch (schedule.frequency) {
                    case 'weekly': next.setDate(next.getDate() + 7); break;
                    case 'fortnightly': next.setDate(next.getDate() + 14); break;
                    case 'monthly': next.setMonth(next.getMonth() + 1); break;
                  }
                }
                return next.toLocaleDateString();
              };
              return (
                <div key={schedule.playlistId} className="schedule-item">
                  <div className="schedule-info">
                    <span className="schedule-name">{schedule.playlistName}</span>
                    <span className="schedule-freq">{schedule.frequency} • Next: {getNextRun()}</span>
                  </div>
                  <button className="btn btn-secondary btn-small" onClick={() => window.api.deleteSchedule(schedule.playlistId).then(() => window.api.getSchedules().then(setSchedules))}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );


  // Modals
  const renderPlaylistDetail = () => {
    if (!selectedPlaylist) return null;
    
    // Apply sorting
    let tracksToShow = showUnmatchedOnly ? [...selectedPlaylist.tracks.filter(t => !t.matched)] : [...selectedPlaylist.tracks];
    
    if (trackSortField !== 'none') {
      tracksToShow.sort((a, b) => {
        let cmp = 0;
        if (trackSortField === 'title') {
          cmp = a.title.localeCompare(b.title);
        } else if (trackSortField === 'artist') {
          cmp = a.artist.localeCompare(b.artist);
        } else if (trackSortField === 'status') {
          cmp = (a.matched ? 1 : 0) - (b.matched ? 1 : 0);
        } else if (trackSortField === 'score') {
          cmp = (a.score || 0) - (b.score || 0);
        }
        return trackSortDir === 'asc' ? cmp : -cmp;
      });
    }
    
    const matchedTracks = selectedPlaylist.tracks.filter(t => t.matched);
    const unmatchedTracks = selectedPlaylist.tracks.filter(t => !t.matched);
    
    const handleSort = (field: 'title' | 'artist' | 'status' | 'score') => {
      if (trackSortField === field) {
        if (trackSortDir === 'asc') setTrackSortDir('desc');
        else { setTrackSortField('none'); setTrackSortDir('asc'); }
      } else {
        setTrackSortField(field);
        setTrackSortDir('asc');
      }
    };
    
    const handleDragStart = (index: number) => {
      if (trackSortField !== 'none') return; // Disable drag when sorted
      setDraggedTrackIndex(index);
    };
    
    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (trackSortField !== 'none' || draggedTrackIndex === null || draggedTrackIndex === index) return;
    };
    
    const handleDrop = (targetIndex: number) => {
      if (trackSortField !== 'none' || draggedTrackIndex === null || draggedTrackIndex === targetIndex) {
        setDraggedTrackIndex(null);
        return;
      }
      
      const newTracks = [...selectedPlaylist.tracks];
      const [draggedTrack] = newTracks.splice(draggedTrackIndex, 1);
      newTracks.splice(targetIndex, 0, draggedTrack);
      
      setSelectedPlaylist({ ...selectedPlaylist, tracks: newTracks });
      setDraggedTrackIndex(null);
    };
    
    const sortIcon = (field: string) => {
      if (trackSortField !== field) return '↕';
      return trackSortDir === 'asc' ? '↑' : '↓';
    };
    
    return (
      <div className="modal-overlay" onClick={() => setSelectedPlaylist(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>{selectedPlaylist.name}</h2>
              <p className="modal-subtitle">{matchedTracks.length} matched / {unmatchedTracks.length} unmatched</p>
            </div>
            <button className="btn btn-secondary btn-small" onClick={() => setSelectedPlaylist(null)}>✕</button>
          </div>
          <div className="modal-actions">
            <label className="toggle-label">
              <input type="checkbox" checked={showUnmatchedOnly} onChange={e => setShowUnmatchedOnly(e.target.checked)} />
              Show unmatched only
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unmatchedTracks.length > 0 && (
                <button className="btn btn-secondary btn-small" onClick={() => {
                  const csv = ['Title,Artist', ...unmatchedTracks.map(t => `"${t.title.replace(/"/g, '""')}","${t.artist.replace(/"/g, '""')}"`)].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedPlaylist.name.replace(/[^a-z0-9]/gi, '_')}_missing.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  Export Missing ({unmatchedTracks.length})
                </button>
              )}
              <button className="btn btn-primary btn-small" onClick={() => { handleCreatePlaylist(selectedPlaylist); setSelectedPlaylist(null); }} disabled={matchedTracks.length === 0 || createdPlaylists.includes(selectedPlaylist.id)}>
                {createdPlaylists.includes(selectedPlaylist.id) ? '✓ Created' : `Create Playlist (${matchedTracks.length} tracks)`}
              </button>
            </div>
          </div>
          
          <div className="track-list-header" style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid #333', fontSize: '12px', color: '#888', gap: '8px' }}>
            <span style={{ width: '30px' }}>#</span>
            <span style={{ width: '30px', cursor: 'pointer' }} onClick={() => handleSort('status')} title="Sort by status">
              {sortIcon('status')}
            </span>
            <span style={{ flex: 2, cursor: 'pointer' }} onClick={() => handleSort('title')} title="Sort by title">
              Title {sortIcon('title')}
            </span>
            <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleSort('artist')} title="Sort by artist">
              Artist {sortIcon('artist')}
            </span>
            <span style={{ width: '50px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('score')} title="Sort by match score">
              Score {sortIcon('score')}
            </span>
          </div>
          
          <div className="track-list">
            {tracksToShow.map((track, i) => {
              const actualIndex = selectedPlaylist.tracks.findIndex(t => t.title === track.title && t.artist === track.artist);
              return (
                <div 
                  key={i} 
                  className={`track-item ${track.matched ? 'matched' : 'unmatched'} clickable ${draggedTrackIndex === actualIndex ? 'dragging' : ''}`}
                  draggable={trackSortField === 'none'}
                  onDragStart={() => handleDragStart(actualIndex)}
                  onDragOver={(e) => handleDragOver(e, actualIndex)}
                  onDrop={() => handleDrop(actualIndex)}
                  onDragEnd={() => setDraggedTrackIndex(null)}
                  onClick={() => openManualSearch(actualIndex, track.title, track.artist)} 
                  title={trackSortField === 'none' ? 'Drag to reorder, click to search/change match' : 'Click to search/change match'}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span style={{ width: '30px', color: '#666', fontSize: '12px' }}>{i + 1}</span>
                  <span className="track-status" style={{ width: '30px' }}>{track.matched ? '✓' : '✗'}</span>
                  <div className="track-info" style={{ flex: 2 }}>
                    <span className="track-title">{track.title}</span>
                    {track.matched && track.plexTitle && (
                      <span className="track-plex-match">→ {track.plexTitle}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, color: '#888' }}>
                    <span className="track-artist">{track.artist}</span>
                    {track.matched && track.plexArtist && track.plexArtist !== track.artist && (
                      <span className="track-plex-match" style={{ display: 'block' }}>→ {track.plexArtist}</span>
                    )}
                  </div>
                  <span style={{ width: '50px', textAlign: 'right' }}>
                    {track.matched ? track.score && <span className="track-score">{Math.round(track.score)}%</span> : <span className="track-search-hint">🔍</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderManualSearchModal = () => {
    if (!manualSearchTrack) return null;
    return (
      <div className="modal-overlay" onClick={() => setManualSearchTrack(null)}>
        <div className="modal-content manual-search-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>Manual Search</h2>
              <p className="modal-subtitle">Finding: {manualSearchTrack.title} - {manualSearchTrack.artist}</p>
            </div>
            <button className="btn btn-secondary btn-small" onClick={() => setManualSearchTrack(null)}>✕</button>
          </div>
          <div className="manual-search-bar">
            <input type="text" value={manualSearchQuery} onChange={e => setManualSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualSearch()} placeholder="Search your Plex library..." autoFocus />
            <button className="btn btn-primary btn-small" onClick={handleManualSearch} disabled={isManualSearching || !manualSearchQuery.trim()}>{isManualSearching ? '...' : 'Search'}</button>
          </div>
          <div className="manual-search-results">
            {manualSearchResults.length === 0 && !isManualSearching && <p className="empty-results">Enter a search term and click Search</p>}
            {manualSearchResults.map((track, i) => (
              <div key={track.ratingKey || i} className="search-result-item" onClick={() => handleManualMatch(track)}>
                <div className="result-info">
                  <span className="result-title">{track.title}</span>
                  <span className="result-artist">{track.grandparentTitle || track.originalTitle || 'Unknown Artist'}{track.parentTitle && ` • ${track.parentTitle}`}</span>
                </div>
                <span className="result-select">Select</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPlaylistSelector = () => {
    if (!showPlaylistSelector) return null;
    const categories = ['Main Charts', 'Genre Charts', 'Decade Charts'];
    const toggleChart = (id: string) => {
      setSelectedCharts(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };
    return (
      <div className="modal-overlay" onClick={() => setShowPlaylistSelector(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div><h2>Select ARIA Charts</h2><p className="modal-subtitle">Choose which charts to scrape</p></div>
            <button className="btn btn-secondary btn-small" onClick={() => setShowPlaylistSelector(false)}>✕</button>
          </div>
          <div className="modal-actions">
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-small" onClick={() => setSelectedCharts(new Set(ARIA_CHARTS.map(c => c.id)))}>Select All</button>
              <button className="btn btn-secondary btn-small" onClick={() => setSelectedCharts(new Set())}>Select None</button>
            </div>
            <span style={{ color: '#a0a0a0', fontSize: '13px' }}>{selectedCharts.size} selected</span>
          </div>
          <div className="chart-selector-list">
            {categories.map(category => (
              <div key={category} className="chart-category">
                <div className="chart-category-title">{category}</div>
                {ARIA_CHARTS.filter(c => c.category === category).map(chart => (
                  <label key={chart.id} className="chart-selector-item">
                    <input type="checkbox" checked={selectedCharts.has(chart.id)} onChange={() => toggleChart(chart.id)} />
                    <span>{chart.name}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDiscover} disabled={selectedCharts.size === 0}>Start Discovery ({selectedCharts.size} charts)</button>
          </div>
        </div>
      </div>
    );
  };

  const renderChartScheduler = () => {
    if (!showChartScheduler) return null;
    const categories = ['Main Charts', 'Genre Charts', 'Decade Charts'];
    const today = new Date().toISOString().split('T')[0];
    const getChartSchedule = (chartId: string) => chartScheduleSelections.get(chartId) || { frequency: 'none' as ScheduleFrequency, startDate: today };
    const setChartSchedule = (chartId: string, frequency: ScheduleFrequency, startDate: string) => {
      setChartScheduleSelections(prev => { const next = new Map(prev); next.set(chartId, { frequency, startDate }); return next; });
    };
    const handleSaveAllSchedules = async () => {
      let savedCount = 0;
      for (const [chartId, config] of chartScheduleSelections.entries()) {
        if (config.frequency !== 'none') {
          const chart = ARIA_CHARTS.find(c => c.id === chartId);
          if (chart) {
            await window.api.saveSchedule({ playlistId: `aria-${chartId}`, playlistName: chart.name, frequency: config.frequency, startDate: config.startDate, chartIds: [chartId], country: 'au' });
            savedCount++;
          }
        }
      }
      const updatedSchedules = await window.api.getSchedules();
      setSchedules(updatedSchedules);
      setShowChartScheduler(false);
      setChartScheduleSelections(new Map());
      if (savedCount > 0) { setStatusMessage(`Saved ${savedCount} chart schedule(s)`); setTimeout(() => setStatusMessage(''), 3000); }
    };
    const scheduledCount = Array.from(chartScheduleSelections.values()).filter(s => s.frequency !== 'none').length;
    return (
      <div className="modal-overlay" onClick={() => { setShowChartScheduler(false); setChartScheduleSelections(new Map()); }}>
        <div className="modal-content chart-scheduler-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div><h2>Schedule ARIA Charts</h2><p className="modal-subtitle">Set up automatic rescanning</p></div>
            <button className="btn btn-secondary btn-small" onClick={() => { setShowChartScheduler(false); setChartScheduleSelections(new Map()); }}>✕</button>
          </div>
          <div className="chart-scheduler-list">
            {categories.map(category => (
              <div key={category} className="chart-category">
                <div className="chart-category-title">{category}</div>
                {ARIA_CHARTS.filter(c => c.category === category).map(chart => {
                  const config = getChartSchedule(chart.id);
                  return (
                    <div key={chart.id} className="chart-schedule-item">
                      <div className="chart-schedule-name">{chart.name}</div>
                      <div className="chart-schedule-controls">
                        <input type="date" className="select select-small" value={config.startDate} onChange={e => setChartSchedule(chart.id, config.frequency, e.target.value)} min={today} />
                        <select className="select select-small" value={config.frequency} onChange={e => setChartSchedule(chart.id, e.target.value as ScheduleFrequency, config.startDate)}>
                          <option value="none">No schedule</option>
                          <option value="weekly">Weekly</option>
                          <option value="fortnightly">Fortnightly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveAllSchedules}>Save Schedules ({scheduledCount} charts)</button>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container center">
        <div className="loading"><div className="spinner" /><p>Loading...</p></div>
      </div>
    );
  }

  // Login screen
  if (!auth.token) {
    return (
      <div className="container center">
        <div className="login-screen">
          <img src={logoImg} alt="Playlist Lab" className="login-logo" />
          <h1>Playlist Lab</h1>
          <p>Import, generate, and manage your Plex playlists</p>
          <button className="btn btn-primary" onClick={handleLogin} disabled={isAuthenticating}>
            {isAuthenticating ? 'Waiting for login...' : 'Sign in with Plex'}
          </button>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>
      </div>
    );
  }

  // Server selection
  if (!auth.server) {
    return (
      <div className="container center">
        <div className="server-select">
          <h1>Select Server</h1>
          <div className="server-list">
            {servers.map(server => (
              <div key={server.clientId} className="server-item" onClick={() => handleSelectServer(server)}>
                <span>{server.name}</span><span>→</span>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={handleLogout}>Logout</button>
        </div>
      </div>
    );
  }

  // Main app with sidebar
  const renderMatchingSettingsModal = () => {
    if (!showMatchingSettings) return null;
    
    const updateMatchingSettings = (newSettings: MatchingSettings) => {
      setMatchingSettingsState(newSettings);
      setMatchingSettings(newSettings); // Update the discovery module
    };
    
    const handleSaveMatchingSettings = () => {
      setMatchingSettings(matchingSettings); // Apply to discovery module
      window.api.saveSettings({...settings, matchingSettings});
      setShowMatchingSettings(false);
    };
    
    const handleResetMatchingSettings = () => {
      setMatchingSettingsState(DEFAULT_MATCHING_SETTINGS);
      setMatchingSettings(DEFAULT_MATCHING_SETTINGS);
    };

    const renderPatternSection = (
      title: string,
      sectionKey: string,
      patterns: string[],
      defaultPatterns: string[],
      settingsKey: keyof MatchingSettings,
      newValue: string,
      setNewValue: (v: string) => void,
      placeholder: string
    ) => {
      const isExpanded = expandedPatternSection === sectionKey;
      return (
        <div className="pattern-section">
          <div className="pattern-section-header" onClick={() => setExpandedPatternSection(isExpanded ? null : sectionKey)}>
            <span>{title}</span>
            <span className="pattern-count">{patterns.length} patterns</span>
            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          </div>
          {isExpanded && (
            <div className="pattern-section-content">
              <div className="pattern-list">
                {patterns.map((pattern, i) => (
                  <div key={i} className="pattern-item">
                    <span>{pattern}</span>
                    <button className="btn-remove" onClick={() => updateMatchingSettings({...matchingSettings, [settingsKey]: patterns.filter((_, idx) => idx !== i)})}>×</button>
                  </div>
                ))}
                {patterns.length === 0 && <div className="pattern-empty">No patterns defined</div>}
              </div>
              <div className="pattern-add">
                <input 
                  type="text" 
                  placeholder={placeholder} 
                  value={newValue} 
                  onChange={e => setNewValue(e.target.value)} 
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && newValue.trim()) { 
                      updateMatchingSettings({...matchingSettings, [settingsKey]: [...patterns, newValue.trim()]}); 
                      setNewValue(''); 
                    }
                  }} 
                />
                <button className="btn btn-secondary btn-small" onClick={() => { 
                  if (newValue.trim()) { 
                    updateMatchingSettings({...matchingSettings, [settingsKey]: [...patterns, newValue.trim()]}); 
                    setNewValue(''); 
                  }
                }}>Add</button>
              </div>
              <button className="btn btn-secondary btn-small" style={{marginTop: '8px'}} onClick={() => updateMatchingSettings({...matchingSettings, [settingsKey]: [...defaultPatterns]})}>
                Reset to Defaults
              </button>
            </div>
          )}
        </div>
      );
    };
    
    return (
      <div className="modal-overlay" onClick={() => setShowMatchingSettings(false)}>
        <div className="modal-content matching-settings-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Matching Settings</h2>
            <button className="btn btn-secondary btn-small" onClick={() => setShowMatchingSettings(false)}>✕</button>
          </div>
          
          <div className="matching-settings-content">
            <div className="setting-group">
              <h3>Title Cleaning</h3>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.stripParentheses} onChange={e => updateMatchingSettings({...matchingSettings, stripParentheses: e.target.checked})} />
                Strip parentheses content (Radio Edit), (Remix)
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.stripBrackets} onChange={e => updateMatchingSettings({...matchingSettings, stripBrackets: e.target.checked})} />
                Strip bracket content [Explicit], [Remaster]
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.ignoreRemixInfo} onChange={e => updateMatchingSettings({...matchingSettings, ignoreRemixInfo: e.target.checked})} />
                Ignore remix info when matching
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.ignoreVersionInfo} onChange={e => updateMatchingSettings({...matchingSettings, ignoreVersionInfo: e.target.checked})} />
                Ignore version info (Remaster, Deluxe)
              </label>
            </div>
            
            <div className="setting-group">
              <h3>Artist Matching</h3>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.useFirstArtistOnly} onChange={e => updateMatchingSettings({...matchingSettings, useFirstArtistOnly: e.target.checked})} />
                Use first artist only (for multiple artists)
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.ignoreFeaturedArtists} onChange={e => updateMatchingSettings({...matchingSettings, ignoreFeaturedArtists: e.target.checked})} />
                Ignore featured artists (feat., ft.)
              </label>
            </div>
            
            <div className="setting-group">
              <h3>Scoring</h3>
              <label className="slider-label">
                Minimum match score: {matchingSettings.minMatchScore}%
                <input type="range" min="30" max="100" value={matchingSettings.minMatchScore} onChange={e => updateMatchingSettings({...matchingSettings, minMatchScore: parseInt(e.target.value)})} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.preferNonCompilation} onChange={e => updateMatchingSettings({...matchingSettings, preferNonCompilation: e.target.checked})} />
                Prefer non-compilation albums
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.penalizeMonoVersions} onChange={e => updateMatchingSettings({...matchingSettings, penalizeMonoVersions: e.target.checked})} />
                Penalize mono versions
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={matchingSettings.penalizeLiveVersions} onChange={e => updateMatchingSettings({...matchingSettings, penalizeLiveVersions: e.target.checked})} />
                Prefer studio over live versions
              </label>
            </div>
            
            <div className="setting-group">
              <h3>Pattern Lists</h3>
              <p className="setting-hint">Click to expand and edit the patterns used for matching</p>
              
              {renderPatternSection(
                'Featured Artist Keywords',
                'feat',
                matchingSettings.featuredArtistPatterns || DEFAULT_FEATURED_ARTIST_PATTERNS,
                DEFAULT_FEATURED_ARTIST_PATTERNS,
                'featuredArtistPatterns',
                newFeatPattern,
                setNewFeatPattern,
                'e.g. featuring'
              )}
              
              {renderPatternSection(
                'Version Suffixes',
                'version',
                matchingSettings.versionSuffixPatterns || DEFAULT_VERSION_SUFFIX_PATTERNS,
                DEFAULT_VERSION_SUFFIX_PATTERNS,
                'versionSuffixPatterns',
                newVersionPattern,
                setNewVersionPattern,
                'e.g. deluxe edition'
              )}
              
              {renderPatternSection(
                'Remaster Keywords',
                'remaster',
                matchingSettings.remasterPatterns || DEFAULT_REMASTER_PATTERNS,
                DEFAULT_REMASTER_PATTERNS,
                'remasterPatterns',
                newRemasterPattern,
                setNewRemasterPattern,
                'e.g. anniversary edition'
              )}
              
              {renderPatternSection(
                'Various Artists Names',
                'various',
                matchingSettings.variousArtistsNames || DEFAULT_VARIOUS_ARTISTS_NAMES,
                DEFAULT_VARIOUS_ARTISTS_NAMES,
                'variousArtistsNames',
                newVariousName,
                setNewVariousName,
                'e.g. compilation'
              )}
              
              {renderPatternSection(
                'Custom Strip Patterns',
                'custom',
                matchingSettings.customStripPatterns,
                [],
                'customStripPatterns',
                newStripPattern,
                setNewStripPattern,
                'e.g. - Single Version'
              )}
              
              {renderPatternSection(
                'Penalty Keywords (reduce score)',
                'penalty',
                matchingSettings.penaltyKeywords || DEFAULT_PENALTY_KEYWORDS,
                DEFAULT_PENALTY_KEYWORDS,
                'penaltyKeywords',
                newPenaltyKeyword,
                setNewPenaltyKeyword,
                'e.g. karaoke'
              )}
              
              {renderPatternSection(
                'Priority Keywords (boost score)',
                'priority',
                matchingSettings.priorityKeywords || DEFAULT_PRIORITY_KEYWORDS,
                DEFAULT_PRIORITY_KEYWORDS,
                'priorityKeywords',
                newPriorityKeyword,
                setNewPriorityKeyword,
                'e.g. hd'
              )}
            </div>
          </div>
          
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={handleResetMatchingSettings}>Reset All to Default</button>
            <button className="btn btn-primary" onClick={handleSaveMatchingSettings}>Save</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout">
      {renderSidebar()}
      <main className="main-content">
        {renderContent()}
      </main>
      {renderPlaylistDetail()}
      {renderManualSearchModal()}
      {renderPlaylistSelector()}
      {renderChartScheduler()}
      {renderMatchingSettingsModal()}
      {/* Update notification modal */}
      {showUpdateModal && updateInfo && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <div>
                <h2>🎉 Update Available</h2>
                <p className="modal-subtitle">Version {updateInfo.latestVersion} is now available</p>
              </div>
              <button className="btn btn-secondary btn-small" onClick={() => setShowUpdateModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 0' }}>
              {updateInfo.releaseNotes && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '13px', color: '#a0a0a0', whiteSpace: 'pre-wrap' }}>
                  {updateInfo.releaseNotes.slice(0, 500)}{updateInfo.releaseNotes.length > 500 ? '...' : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
                  Later
                </button>
                <button className="btn btn-primary" onClick={() => {
                  if (updateInfo.releaseUrl) window.api.openReleasePage(updateInfo.releaseUrl);
                  setShowUpdateModal(false);
                }}>
                  Download Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Global import progress overlay */}
      {importProgress && (
        <div className="import-progress-overlay">
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
              <div className="progress-bar" style={{ width: `${importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%` }} />
            </div>
            
            <p className="progress-count">{importProgress.current} / {importProgress.total} tracks</p>
            <p className="progress-current-track">{importProgress.currentTrack}</p>
          </div>
        </div>
      )}
    </div>
  );
}
