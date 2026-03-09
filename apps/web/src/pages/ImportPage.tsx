// BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH
import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import type { MatchedTrack } from '@playlist-lab/shared';

type ImportSource = 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz' | 'file' | 'ai' | 'aria';

interface ImportResult {
  matched: MatchedTrack[];
  unmatched: MatchedTrack[];
  playlistName: string;
  coverUrl?: string;
}

interface PopularPlaylist {
  name: string;
  url: string;
  description?: string;
  videoCount?: number;
  count?: number;
  trackCount?: number;
}

export const ImportPage: FC = () => {
  const { apiClient, refreshPlaylists, refreshMissingTracksCount, settings } = useApp();
  const [activeSource, setActiveSource] = useState<ImportSource>(() => {
    const saved = localStorage.getItem('selectedCountry');
    return saved === 'AU' ? 'aria' : 'deezer';
  });
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTrackCount, setAiTrackCount] = useState(25);
  const [geminiApiKey, setGrokApiKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [previewPlaylist, setPreviewPlaylist] = useState<PopularPlaylist | null>(null);
  const [previewTracks, setPreviewTracks] = useState<any[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [schedulePlaylist, setSchedulePlaylist] = useState<PopularPlaylist | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'custom'>('daily');
  const [scheduleStartDate, setScheduleStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [schedulePlaylistName, setSchedulePlaylistName] = useState<string>('');
  const [scheduleOverwriteExisting, setScheduleOverwriteExisting] = useState<boolean>(false);
  const [scheduleOverwriteCover, setScheduleOverwriteCover] = useState<boolean>(false);
  const [scheduleRunTime, setScheduleRunTime] = useState<string>('09:00');
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyHasCredentials, setSpotifyHasCredentials] = useState(false);
  const [showSpotifySetup, setShowSpotifySetup] = useState(false);
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
  const [isSavingSpotify, setIsSavingSpotify] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<PopularPlaylist[]>([]);
  const [isLoadingSpotifyPlaylists, setIsLoadingSpotifyPlaylists] = useState(false);
  const [searchResults, setSearchResults] = useState<PopularPlaylist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const [dynamicPlaylists, setDynamicPlaylists] = useState<PopularPlaylist[]>([]);
  const [isLoadingDynamicPlaylists, setIsLoadingDynamicPlaylists] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    show: boolean;
    playlistName: string;
    source: string;
    currentTrack: number;
    totalTracks: number;
    currentTrackName: string;
    phase: 'scraping' | 'matching' | 'complete';
    coverUrl?: string;
  } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null);
  const [userCancelled, setUserCancelled] = useState(false);
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  
  // Review screen state
  const [editableTracks, setEditableTracks] = useState<MatchedTrack[]>([]);
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [keepExistingCover, setKeepExistingCover] = useState(true);
  const [rematchTrack, setRematchTrack] = useState<{ track: MatchedTrack; index: number } | null>(null);
  const [rematchQuery, setRematchQuery] = useState('');
  const [rematchResults, setRematchResults] = useState<any[]>([]);
  const [isSearchingRematch, setIsSearchingRematch] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // ARIA chart date states
  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const formatDateDMY = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const getMostRecentMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return toLocalDateStr(d);
  };
  const getRecentMondays = (count: number) => {
    const mondays: string[] = [];
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    for (let i = 0; i < count; i++) {
      mondays.push(toLocalDateStr(d));
      d.setDate(d.getDate() - 7);
    }
    return mondays;
  };
  const recentMondays = getRecentMondays(52);
  const [ariaTop50Date, setAriaTop50Date] = useState(() => getMostRecentMonday());
  const [ariaAustralianDate, setAriaAustralianDate] = useState(() => getMostRecentMonday());
  const [ariaReplayDate, setAriaReplayDate] = useState(() => getMostRecentMonday());
  const [ariaNewMusicDate, setAriaNewMusicDate] = useState(() => getMostRecentMonday());
  const [ariaHipHopDate, setAriaHipHopDate] = useState(() => getMostRecentMonday());
  const [ariaDanceDate, setAriaDanceDate] = useState(() => getMostRecentMonday());
  const [ariaClubDate, setAriaClubDate] = useState(() => getMostRecentMonday());
  const [ariaTop100Year, setAriaTop100Year] = useState(() => new Date().getFullYear().toString());

  // Country options for charts/popular playlists
  const countries = [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  ];

  // Check if Grok API key is set in settings
  const hasGeminiApiKey = !!settings?.grokApiKey;

  // Load saved country preference
  useEffect(() => {
    console.log('[ImportPage] Component mounted - BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH');
    const savedCountry = localStorage.getItem('selectedCountry');
    if (savedCountry) {
      setSelectedCountry(savedCountry);
    }
  }, []);

  // Fetch dynamic playlists when source or country changes
  useEffect(() => {
    // Only fetch for sources that support dynamic playlists
    if (['deezer', 'youtube', 'apple'].includes(activeSource)) {
      fetchDynamicPlaylists();
    } else {
      setDynamicPlaylists([]);
    }
  }, [activeSource, selectedCountry]);

  const fetchDynamicPlaylists = async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    const cacheKey = `playlists_${activeSource}_${selectedCountry}`;
    
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const { playlists, timestamp } = JSON.parse(cached);
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000;
          
          // Use cache if less than 1 day old AND has results
          if (now - timestamp < oneDay && playlists.length > 0) {
            setDynamicPlaylists(playlists);
            return;
          }
        } catch (err) {
          console.error('Failed to parse cached playlists:', err);
        }
      }
    }
    
    // Fetch fresh data
    setIsLoadingDynamicPlaylists(true);
    try {
      const response = await fetch(`/api/charts/${activeSource}/${selectedCountry}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const playlists = data.playlists || [];
        setDynamicPlaylists(playlists);
        
        // Cache the results (only if non-empty to avoid caching failures)
        if (playlists.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({
            playlists,
            timestamp: Date.now(),
          }));
        } else {
          // Clear any stale empty cache so next load retries
          localStorage.removeItem(cacheKey);
        }
      } else {
        console.error('Failed to fetch dynamic playlists');
        setDynamicPlaylists([]);
      }
    } catch (err) {
      console.error('Failed to fetch dynamic playlists:', err);
      setDynamicPlaylists([]);
    } finally {
      setIsLoadingDynamicPlaylists(false);
    }
  };

  // Save country preference when changed
  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    localStorage.setItem('selectedCountry', countryCode);
    if (countryCode === 'AU') {
      setActiveSource('aria');
    } else if (activeSource === 'aria') {
      setActiveSource('deezer');
    }
  };

  const sources = [
    ...(selectedCountry === 'AU' ? [{ id: 'aria' as const, name: 'ARIA Charts', placeholder: 'https://www.aria.com.au/charts/...' }] : []),
    { id: 'deezer' as const, name: 'Deezer', placeholder: 'Playlist ID or URL' },
    { id: 'youtube' as const, name: 'YouTube Music', placeholder: 'https://music.youtube.com/playlist?list=...' },
    { id: 'spotify' as const, name: 'Spotify', placeholder: 'https://open.spotify.com/playlist/...' },
    { id: 'apple' as const, name: 'Apple Music', placeholder: 'https://music.apple.com/...' },
    { id: 'amazon' as const, name: 'Amazon Music', placeholder: 'https://music.amazon.com/playlists/...' },
    { id: 'tidal' as const, name: 'Tidal', placeholder: 'https://tidal.com/browse/playlist/...' },
    { id: 'qobuz' as const, name: 'Qobuz', placeholder: 'https://www.qobuz.com/...' },
    { id: 'listenbrainz' as const, name: 'ListenBrainz', placeholder: 'Username' },
    { id: 'file' as const, name: 'File (M3U)', placeholder: 'Upload M3U/M3U8 file' },
    { id: 'ai' as const, name: 'AI Generated', placeholder: 'Describe the playlist you want...' },
  ];


  const currentSource = sources.find(s => s.id === activeSource);
  // Use dynamic playlists for supported sources, Spotify playlists for Spotify, empty for others
  const currentPopular = activeSource === 'spotify' 
    ? spotifyPlaylists 
    : (['deezer', 'youtube', 'apple'].includes(activeSource) 
      ? dynamicPlaylists 
      : []);

  // Check Spotify connection status when Spotify is selected
  useEffect(() => {
    if (activeSource === 'spotify') {
      checkSpotifyStatus();
      
      // Check for OAuth callback results
      const params = new URLSearchParams(window.location.search);
      if (params.get('spotify_connected') === 'true') {
        // Clear the query parameter
        window.history.replaceState({}, '', window.location.pathname);
        // Refresh status
        checkSpotifyStatus();
      } else if (params.get('spotify_error')) {
        const errorCode = params.get('spotify_error');
        setError(`Spotify connection failed: ${errorCode}. Please try again.`);
        // Clear the query parameter
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [activeSource]);

  const checkSpotifyStatus = async () => {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      const data = await response.json();
      setSpotifyConnected(data.connected);
      setSpotifyHasCredentials(data.hasCredentials);
      
      // If connected, fetch user's playlists
      if (data.connected) {
        fetchSpotifyPlaylists();
      }
    } catch (err) {
      console.error('Failed to check Spotify status', err);
      setSpotifyConnected(false);
      setSpotifyHasCredentials(false);
    }
  };

  const fetchSpotifyPlaylists = async () => {
    setIsLoadingSpotifyPlaylists(true);
    try {
      const response = await fetch('/api/spotify/playlists', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSpotifyPlaylists(data.playlists || []);
      } else {
        console.error('Failed to fetch Spotify playlists');
        setSpotifyPlaylists([]);
      }
    } catch (err) {
      console.error('Failed to fetch Spotify playlists', err);
      setSpotifyPlaylists([]);
    } finally {
      setIsLoadingSpotifyPlaylists(false);
    }
  };

  const handleSearch = async () => {
    if (!url.trim()) {
      setSearchResults([]);
      return;
    }

    // Spotify doesn't support search via scraping
    if (activeSource === 'spotify') {
      setError('Search is not available for Spotify. Please use the URL field to import a specific playlist or browse your playlists below.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      // Call backend search endpoint
      const response = await fetch('/api/import/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          source: activeSource,
          query: url.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Search failed');
      }

      const data = await response.json();
      setSearchResults(data.playlists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelImport = async () => {
    console.log('[ImportPage] Cancel button clicked', { sessionId: currentSessionId, hasEventSource: !!currentEventSource, hasPollInterval: !!pollInterval });
    
    // Mark as user-cancelled to prevent error message
    setUserCancelled(true);
    
    // Close SSE connection first
    if (currentEventSource) {
      currentEventSource.close();
      setCurrentEventSource(null);
    }
    
    // Clear polling interval if it exists
    if (pollInterval) {
      console.log('[ImportPage] Clearing polling interval');
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    
    // Reset state immediately (don't wait for server response)
    const sessionToCancel = currentSessionId;
    setCurrentSessionId(null);
    setImportProgress(null);
    setIsImporting(false);
    console.log('[ImportPage] Import cancelled, state reset');
    
    // Call cancel endpoint (fire and forget)
    if (sessionToCancel) {
      try {
        await fetch(`/api/import/cancel/${sessionToCancel}`, {
          method: 'POST',
          credentials: 'include',
        });
        console.log('[ImportPage] Cancel request sent to server');
      } catch (err) {
        console.error('Failed to cancel import:', err);
      }
    }
    
    // Reset user cancelled flag after a short delay
    setTimeout(() => setUserCancelled(false), 1000);
  };

  const handleImport = async (importUrl?: string) => {
    console.log('[ImportPage] ===== HANDLE IMPORT CALLED - BUILD v2026-02-11-15:00 =====');
    
    setError(null);
    setImportResult(null);
    setPlaylistCreated(false);
    setCreatedPlaylistId(null);
    setIsImporting(true);

    // Use provided URL or fall back to state
    const urlToImport = importUrl || url;
    
    console.log('[ImportPage] Import URL:', urlToImport);
    console.log('[ImportPage] Active source:', activeSource);
    
    // Generate session ID for progress tracking
    const sessionId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(sessionId);
    console.log('[ImportPage] Starting import with sessionId:', sessionId);

    // Set up SSE connection for progress
    console.log('[ImportPage] Creating EventSource...');
    // Use Vite proxy (configured for SSE in vite.config.ts)
    const eventSource = new EventSource(`/api/import/progress/${sessionId}`);
    setCurrentEventSource(eventSource);
    console.log('[ImportPage] SSE connection established');
    
    // Add polling fallback in case SSE doesn't work
    const startPolling = () => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/import/status/${sessionId}`, {
            credentials: 'include'
          });
          const data = await response.json();
          
          if (data.type === 'progress') {
            handleProgressUpdate(data);
          } else if (data.type === 'complete') {
            clearInterval(interval);
            setPollInterval(null);
            
            // Close SSE if still open
            if (eventSource.readyState !== EventSource.CLOSED) {
              eventSource.close();
            }
            setCurrentEventSource(null);
            setCurrentSessionId(null);
            
            if (data.matched && Array.isArray(data.matched)) {
              setImportProgress({
                show: true,
                playlistName: data.playlistName || playlistNameForProgress,
                source: currentSource?.name || activeSource,
                currentTrack: data.matchedCount || 0,
                totalTracks: data.totalCount || 0,
                currentTrackName: `Complete: ${data.matchedCount || 0} matched`,
                phase: 'complete',
                coverUrl: data.coverUrl || coverUrlForProgress,
              });
              setTimeout(() => {
                setImportProgress(null);
                setImportResult(data);
                setPlaylistName(data.playlistName);
                setEditableTracks([...data.matched, ...(data.unmatched || [])]);
                setIsImporting(false);
              }, 1000);
            } else {
              setError('Import failed: Invalid response from server');
              setIsImporting(false);
              setImportProgress(null);
            }
          } else if (data.type === 'error') {
            clearInterval(interval);
            setPollInterval(null);
            if (eventSource.readyState !== EventSource.CLOSED) {
              eventSource.close();
            }
            setCurrentEventSource(null);
            setCurrentSessionId(null);
            if (!userCancelled) {
              setError(data.message || 'Import failed');
            }
            setIsImporting(false);
            setImportProgress(null);
          }
          // 'waiting' means no progress yet (still scraping) — keep polling
        } catch (err) {
          console.error('[ImportPage] Polling error:', err);
        }
      }, 500); // Poll every 500ms
      setPollInterval(interval);
    };
    
    // Start polling alongside SSE as a reliable fallback
    startPolling();
    
    const handleProgressUpdate = (data: any) => {
      
      // Update playlist name if provided
      if (data.playlistName) {
        playlistNameForProgress = data.playlistName;
      }
      
      // Update cover URL if provided
      if (data.coverUrl) {
        coverUrlForProgress = data.coverUrl;
      }
      
      const finalCoverUrl = data.coverUrl || coverUrlForProgress;
      
      const newProgress = {
        show: true,
        playlistName: data.playlistName || playlistNameForProgress,
        source: currentSource?.name || activeSource,
        currentTrack: data.current,
        totalTracks: data.total,
        currentTrackName: data.currentTrackName || '',
        phase: data.phase,
        coverUrl: finalCoverUrl,
      };
      setImportProgress(newProgress);
    };
    
    // Wait a moment for SSE connection to establish
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let playlistNameForProgress = 'Playlist';
    let coverUrlForProgress: string | undefined = undefined;
  
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'progress') {
        handleProgressUpdate(data);
      } else if (data.type === 'complete') {
        // Validate data structure
        if (!data.matched || !Array.isArray(data.matched)) {
          console.error('[ImportPage] Invalid complete data structure:', data);
          setError('Import failed: Invalid response from server');
          setIsImporting(false);
          setImportProgress(null);
          eventSource.close();
          setCurrentEventSource(null);
          setCurrentSessionId(null);
          return;
        }
        
        eventSource.close();
        setCurrentEventSource(null);
        setCurrentSessionId(null);
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        
        // Show completion briefly
        setImportProgress({
          show: true,
          playlistName: data.playlistName || playlistNameForProgress,
          source: currentSource?.name || activeSource,
          currentTrack: data.matchedCount || 0,
          totalTracks: data.totalCount || 0,
          currentTrackName: `Complete: ${data.matchedCount || 0} matched`,
          phase: 'complete',
          coverUrl: data.coverUrl || coverUrlForProgress,
        });

        // Small delay to show completion
        setTimeout(() => {
          setImportProgress(null);
          
          // Show review screen
          setImportResult(data);
          setPlaylistName(data.playlistName);
          setEditableTracks([...data.matched, ...(data.unmatched || [])]);
          setIsImporting(false);
        }, 1000);
      } else if (data.type === 'error') {
        eventSource.close();
        setCurrentEventSource(null);
        // Only show error if not user-cancelled
        if (!userCancelled) {
          setError(data.message || 'Import failed');
        }
        setIsImporting(false);
        setImportProgress(null);
        setCurrentSessionId(null);
      }
    };
    
    eventSource.onerror = () => {
      // SSE errors are expected — polling fallback is already running
    };

    try {
      let result: ImportResult | undefined;

      if (activeSource === 'ai') {
        playlistNameForProgress = 'AI Generated Playlist';
        
        // Show initial progress for AI generation
        setImportProgress({
          show: true,
          playlistName: playlistNameForProgress,
          source: 'AI',
          currentTrack: 0,
          totalTracks: aiTrackCount,
          currentTrackName: 'Generating playlist...',
          phase: 'scraping',
          coverUrl: undefined,
        });

        // AI generation - call AI endpoint
        const response = await fetch('/api/import/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prompt: aiPrompt, trackCount: aiTrackCount, grokApiKey: geminiApiKey, sessionId }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error?.message || 'AI generation failed';
          
          if (errorMessage.includes('No library selected')) {
            throw new Error('Please go to Settings and select a music library before using AI generation.');
          }
          
          throw new Error(errorMessage);
        }
        result = await response.json();
      } else {
        // For regular imports, use a generic name initially
        // We'll update it when we get the actual name from the server
        if (activeSource === 'listenbrainz') {
          playlistNameForProgress = username || 'ListenBrainz Playlist';
        } else {
          // Use source name as default
          playlistNameForProgress = `${currentSource?.name || activeSource} Playlist`;
        }
        
        // Show initial progress - will be updated by backend events
        setImportProgress({
          show: true,
          playlistName: playlistNameForProgress,
          source: currentSource?.name || activeSource,
          currentTrack: 0,
          totalTracks: 0,
          currentTrackName: 'Starting import...',
          phase: 'scraping',
          coverUrl: undefined,
        });

        // Make direct fetch call with sessionId
        let endpoint = '';
        let body: any = { sessionId };
        
        switch (activeSource) {
          case 'spotify':
            endpoint = '/api/import/spotify';
            body.url = urlToImport;
            break;
          case 'deezer':
            endpoint = '/api/import/deezer';
            body.url = urlToImport;
            break;
          case 'apple':
            endpoint = '/api/import/apple';
            body.url = urlToImport;
            break;
          case 'tidal':
            endpoint = '/api/import/tidal';
            body.url = urlToImport;
            break;
          case 'youtube':
            endpoint = '/api/import/youtube';
            body.url = urlToImport;
            break;
          case 'amazon':
            endpoint = '/api/import/amazon';
            body.url = urlToImport;
            break;
          case 'qobuz':
            endpoint = '/api/import/qobuz';
            body.url = urlToImport;
            break;
          case 'aria':
            endpoint = '/api/import/aria';
            body.url = urlToImport;
            break;
          case 'listenbrainz':
            endpoint = '/api/import/listenbrainz';
            body.username = username;
            break;
          case 'file':
            if (!file) throw new Error('Please select a file');
            // File upload needs FormData
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sessionId', sessionId);
            const fileResponse = await fetch('/api/import/file', {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });
            if (!fileResponse.ok) {
              const errorData = await fileResponse.json();
              throw new Error(errorData.error?.message || errorData.error || 'File import failed');
            }
            result = await fileResponse.json();
            break;
          default:
            throw new Error('Invalid source');
        }
        
        if (activeSource !== 'file') {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || errorData.error || 'Import failed');
          }
          
          // When using SSE (sessionId provided), the POST just starts the import
          // The actual result will come via the SSE 'complete' event
          // So we don't need to process the response here
          const responseData = await response.json();
          console.log('[ImportPage] Import started:', responseData);
          
          // Don't set result here - it will come via SSE complete event
          // Just return to let the SSE handler take over
          return;
        }
      }

      // This code only runs for AI imports or file imports (non-SSE)
      // For SSE imports, we return early above

      // Ensure result is defined and has required properties
      if (!result) {
        throw new Error('Import failed: No result returned');
      }
      
      if (!result.matched || !Array.isArray(result.matched)) {
        console.error('[ImportPage] Invalid result structure:', result);
        throw new Error('Import failed: Invalid response from server');
      }

      // Close SSE connection
      eventSource.close();
      setCurrentEventSource(null);
      setCurrentSessionId(null);
      
      // Show completion briefly
      setImportProgress({
        show: true,
        playlistName: result.playlistName,
        source: currentSource?.name || activeSource,
        currentTrack: result.matched.length,
        totalTracks: result.matched.length + (result.unmatched?.length || 0),
        currentTrackName: `Complete: ${result.matched.length} matched`,
        phase: 'complete',
        coverUrl: result.coverUrl,
      });

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setImportProgress(null);
      
      // Show review screen instead of auto-creating
      setImportResult(result);
      setPlaylistName(result.playlistName);
      setEditableTracks([...result.matched, ...result.unmatched]);
    } catch (err) {
      console.error('[ImportPage] Import error:', err);
      if (currentEventSource) {
        currentEventSource.close();
        setCurrentEventSource(null);
      }
      setCurrentSessionId(null);
      setImportProgress(null);
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setImportResult(null);
    setEditableTracks([]);
    setShowUnmatchedOnly(false);
    setOverwriteExisting(false);
    setKeepExistingCover(true);
    setError(null);
    setPlaylistCreated(false);
    setCreatedPlaylistId(null);
  };

  // Initialize editable tracks when import result changes
  useEffect(() => {
    if (importResult) {
      const allTracks = [...importResult.matched, ...importResult.unmatched];
      setEditableTracks(allTracks);
    }
  }, [importResult]);

  // Manual rematch functions
  const handleOpenRematch = (track: MatchedTrack, index: number) => {
    setRematchTrack({ track, index });
    setRematchQuery(`${track.artist} ${track.title}`);
    setRematchResults([]);
  };

  const handleCloseRematch = () => {
    setRematchTrack(null);
    setRematchQuery('');
    setRematchResults([]);
  };

  const handleSearchRematch = async () => {
    if (!rematchQuery.trim()) return;

    setIsSearchingRematch(true);
    try {
      const response = await fetch('/api/import/plex/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: rematchQuery }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setRematchResults(data.tracks || []);
    } catch (err) {
      console.error('Search error:', err);
      setRematchResults([]);
    } finally {
      setIsSearchingRematch(false);
    }
  };

  const handleSelectRematch = (result: any) => {
    if (!rematchTrack) return;

    const updatedTracks = [...editableTracks];
    updatedTracks[rematchTrack.index] = {
      ...rematchTrack.track,
      matched: true,
      plexRatingKey: result.ratingKey,
      plexTitle: result.title,
      plexArtist: result.artist,
      plexAlbum: result.album,
      plexCodec: result.codec,
      plexBitrate: result.bitrate,
      score: 100, // Manual match gets 100% score
    };

    setEditableTracks(updatedTracks);
    handleCloseRematch();
  };

  // Drag and drop functions
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updatedTracks = [...editableTracks];
    const draggedTrack = updatedTracks[draggedIndex];
    updatedTracks.splice(draggedIndex, 1);
    updatedTracks.splice(index, 0, draggedTrack);

    setEditableTracks(updatedTracks);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Export missing tracks
  const handleExportMissing = () => {
    const unmatchedTracks = editableTracks.filter(t => !t.matched);
    if (unmatchedTracks.length === 0) return;

    const csv = [
      'Title,Artist,Album',
      ...unmatchedTracks.map(t => `"${t.title}","${t.artist}","${t.album || ''}"`)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlistName || 'playlist'}_missing_tracks.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // State for playlist name edit before saving missing tracks
  const [showMissingNameModal, setShowMissingNameModal] = useState(false);
  const [missingPlaylistName, setMissingPlaylistName] = useState('');

  // Add missing tracks to Missing Tracks list (and create Plex playlist with matched tracks)
  const handleAddToMissingTracks = async () => {
    const unmatchedTracks = editableTracks.filter(t => !t.matched);
    if (unmatchedTracks.length === 0) return;

    // Show modal to let user edit playlist name before saving
    setMissingPlaylistName(playlistName || 'Imported Playlist');
    setShowMissingNameModal(true);
  };

  const handleConfirmMissingSave = async () => {
      const unmatchedTracks = editableTracks.filter(t => !t.matched);
      setShowMissingNameModal(false);

      try {
        if (playlistCreated && createdPlaylistId) {
          // Playlist already exists in Plex — just add missing tracks to it
          await apiClient.addMissingTracks({
            playlistId: createdPlaylistId,
            tracks: unmatchedTracks.map(t => ({
              title: t.title,
              artist: t.artist,
              album: t.album || '',
            })),
            source: activeSource === 'ai' ? 'ai' : activeSource,
          });
        } else {
          // No playlist created yet — create one with matched tracks + save missing
          const matchedTracks = editableTracks.filter(t => t.matched && t.plexRatingKey);
          await apiClient.saveMissingTracks({
            playlistName: missingPlaylistName || 'Imported Playlist',
            source: activeSource === 'ai' ? 'ai' : activeSource,
            sourceUrl: activeSource === 'ai' ? `AI: ${aiPrompt}` : (url || username),
            tracks: unmatchedTracks.map(t => ({
              title: t.title,
              artist: t.artist,
              album: t.album || '',
            })),
            matchedTracks: matchedTracks.map(t => ({
              plexRatingKey: t.plexRatingKey,
              title: t.title,
              artist: t.artist,
            })),
            overwriteExisting,
            keepExistingCover: overwriteExisting ? keepExistingCover : undefined,
            coverUrl: importResult?.coverUrl,
          });
        }

        await refreshPlaylists();
        await refreshMissingTracksCount();

        // Navigate to Missing Tracks page
        window.location.href = '/missing';
      } catch (error: any) {
        console.error('Failed to save missing tracks:', error);
        alert(`Failed to save missing tracks: ${error.message || 'Unknown error'}`);
      }
    };

  // Update handleConfirm to use editableTracks
  const [playlistCreated, setPlaylistCreated] = useState(false);
  const [createdPlaylistId, setCreatedPlaylistId] = useState<number | null>(null);

  const handleConfirmUpdated = async () => {
    if (!editableTracks.length) return;

    setIsImporting(true);
    setError(null);

    try {
      const matchedTracks = editableTracks.filter(t => t.matched);
      
      const result = await apiClient.confirmImport({
        playlistName,
        source: activeSource === 'ai' ? 'ai' : activeSource,
        sourceUrl: activeSource === 'ai' ? `AI: ${aiPrompt}` : (url || username),
        tracks: matchedTracks,
        overwriteExisting,
        keepExistingCover: overwriteExisting ? keepExistingCover : undefined,
        coverUrl: importResult?.coverUrl,
      });

      await refreshPlaylists();
      await refreshMissingTracksCount();

      // Stay on review screen so user can save missing tracks
      setPlaylistCreated(true);
      setCreatedPlaylistId(result?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist');
    } finally {
      setIsImporting(false);
    }
  };

  // Get match score color
  const getScoreColor = (score?: number): string => {
    if (!score) return 'var(--error)';
    if (score === 100) return 'var(--success)';
    if (score >= 90) return '#90EE90';
    if (score >= 80) return '#FFD700';
    if (score >= 70) return '#FFA500';
    return 'var(--warning)';
  };

  // Filter tracks based on showUnmatchedOnly
  const displayedTracks = showUnmatchedOnly 
    ? editableTracks.filter(t => !t.matched)
    : editableTracks;

  const matchedCount = editableTracks.filter(t => t.matched).length;
  const unmatchedCount = editableTracks.filter(t => !t.matched).length;

  const handlePopularClick = (playlist: PopularPlaylist) => {
    // Trigger import immediately with the URL directly
    handleImport(playlist.url);
  };

  const handlePreview = async (playlist: PopularPlaylist) => {
    setPreviewPlaylist(playlist);
    setIsLoadingPreview(true);
    setPreviewTracks(null);
    setError(null);
    
    try {
      // Fetch playlist preview without importing
      const response = await fetch(`/api/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          source: activeSource,
          url: playlist.url 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle preview errors - show empty tracks with error message
        setPreviewTracks([]);
        setError(data.error?.message || data.message || 'Failed to load preview');
      } else {
        // Check if we got an error in the response (empty preview case)
        if (data.error) {
          setPreviewTracks([]);
          setError(data.error);
        } else {
          setPreviewTracks(data.tracks || []);
          setError(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
      setPreviewTracks([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSchedule = (playlist: PopularPlaylist) => {
    setSchedulePlaylist(playlist);
    setSchedulePlaylistName(playlist.name); // Set default playlist name
    setScheduleOverwriteExisting(false); // Reset overwrite option
    setScheduleOverwriteCover(false); // Reset cover art option
    setScheduleRunTime('09:00'); // Reset run time
  };

  const handleDisconnectSpotify = async () => {
    if (!confirm('Disconnect Spotify? You will need to reconnect to access your playlists.')) {
      return;
    }

    try {
      const response = await fetch('/api/spotify/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setSpotifyConnected(false);
      setShowSpotifySetup(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Spotify');
    }
  };

  const handleScheduleConfirm = async () => {
    if (!schedulePlaylist) return;
    
    setIsImporting(true);
    setError(null);
    
    try {
      // Create schedule for chart import
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          schedule_type: 'playlist_refresh',
          frequency: scheduleFrequency,
          start_date: scheduleStartDate,
          run_time: scheduleRunTime,
          config: {
            chartName: schedulePlaylist.name,
            chartSource: activeSource,
            chartUrl: schedulePlaylist.url,
            autoImport: true,
            playlistName: schedulePlaylistName || schedulePlaylist.name,
            overwriteExisting: scheduleOverwriteExisting,
            overwriteCover: scheduleOverwriteCover,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Failed to create schedule' } }));
        throw new Error(errorData.error?.message || 'Failed to create schedule');
      }
      
      // Navigate to schedules page
      window.location.href = '/schedules';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveSpotifyCredentials = async () => {
    // If credentials are already saved and user didn't enter new ones, just connect
    if (spotifyHasCredentials && !spotifyClientId.trim() && !spotifyClientSecret.trim()) {
      setIsSavingSpotify(true);
      setError(null);
      
      try {
        // Just initiate OAuth with existing credentials
        const loginResponse = await fetch('/api/spotify/login', {
          credentials: 'include',
        });
        const loginData = await loginResponse.json();
        
        if (loginData.authUrl) {
          window.location.href = loginData.authUrl;
        } else if (loginData.error) {
          setError(loginData.error);
          setIsSavingSpotify(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to Spotify');
        setIsSavingSpotify(false);
      }
      return;
    }
    
    // Otherwise, validate and save new credentials
    if (!spotifyClientId.trim()) {
      setError('Please enter your Spotify Client ID');
      return;
    }

    if (!spotifyClientSecret.trim()) {
      setError('Please enter your Spotify Client Secret');
      return;
    }

    setIsSavingSpotify(true);
    setError(null);

    try {
      // First, test the credentials to make sure they're valid
      const testResponse = await fetch('/api/spotify/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          clientId: spotifyClientId,
          clientSecret: spotifyClientSecret 
        }),
      });

      const testData = await testResponse.json();

      if (!testData.valid) {
        throw new Error(testData.error || 'Invalid credentials');
      }

      // Credentials are valid, now save them
      const saveResponse = await fetch('/api/spotify/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          clientId: spotifyClientId,
          clientSecret: spotifyClientSecret 
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData.error || 'Failed to save credentials');
      }

      // Show success message briefly before redirecting
      setError(null);
      
      // Small delay to show the "Connecting..." state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now initiate OAuth
      const loginResponse = await fetch('/api/spotify/login', {
        credentials: 'include',
      });
      const loginData = await loginResponse.json();
      
      if (loginData.authUrl) {
        // Redirect to Spotify OAuth
        window.location.href = loginData.authUrl;
      } else if (loginData.error) {
        setError(loginData.error);
        setIsSavingSpotify(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Spotify');
      setIsSavingSpotify(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Import Playlist</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Country Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Country:
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {countries.map(country => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Refresh Button for Dynamic Playlists */}
          {['deezer', 'youtube', 'apple'].includes(activeSource) && (
            <button
              className="btn btn-secondary"
              onClick={() => fetchDynamicPlaylists(true)}
              disabled={isLoadingDynamicPlaylists}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                minWidth: 'auto',
              }}
              title="Refresh popular playlists"
            >
              {isLoadingDynamicPlaylists ? '⟳' : '↻'} Refresh
            </button>
          )}
          
          {/* Spotify Connect Button */}
          {activeSource === 'spotify' && !spotifyConnected && (
            <button
              className="btn btn-primary"
              onClick={() => setShowSpotifySetup(!showSpotifySetup)}
              style={{ minWidth: '180px' }}
            >
              {showSpotifySetup ? 'Hide Setup' : 'Connect to Spotify'}
            </button>
          )}
          
          {activeSource === 'spotify' && spotifyConnected && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid var(--success)',
                borderRadius: '4px',
                color: 'var(--success)',
                fontSize: '0.875rem',
              }}>
                ✓ Spotify Connected
              </div>
              <button
                className="btn btn-secondary btn-small"
                onClick={handleDisconnectSpotify}
                title="Disconnect and reconnect to refresh credentials"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Spotify Setup Panel */}
      {activeSource === 'spotify' && showSpotifySetup && !spotifyConnected && (
        <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'rgba(91, 155, 213, 0.05)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Setup Spotify Connection</h3>
          
          {spotifyHasCredentials && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid var(--success)',
              borderRadius: '4px',
              color: 'var(--success)',
              fontSize: '0.875rem',
            }}>
              ✓ Credentials already saved. Click "Connect to Spotify" to authenticate.
            </div>
          )}
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {spotifyHasCredentials ? 'Update your credentials or connect with existing ones:' : 'Follow these steps to connect your Spotify account:'}
            </div>
            
            <ol style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: '1.25rem', lineHeight: '1.8' }}>
              <li>
                Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontWeight: 500 }}>Spotify Developer Dashboard</a>
              </li>
              <li>Click <strong>"Create app"</strong> button</li>
              <li>Fill in the form:
                <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>App name: <code style={{ backgroundColor: 'var(--surface)', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>Playlist Lab</code></li>
                  <li>Redirect URI: <code style={{ backgroundColor: 'var(--surface)', padding: '0.125rem 0.25rem', borderRadius: '2px', fontWeight: 'bold', color: 'var(--primary-color)' }}>http://127.0.0.1:3001/api/spotify/callback</code></li>
                </ul>
              </li>
              <li>Click <strong>"Save"</strong></li>
              <li>Click <strong>"Settings"</strong> and copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
              <li>Paste both values below and click <strong>"Connect"</strong></li>
            </ol>
            
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}>
              ⚠️ <strong>Important:</strong> The Redirect URI must be exactly <code style={{ backgroundColor: 'var(--surface)', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>http://127.0.0.1:3001/api/spotify/callback</code> (not https, not localhost)
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Spotify Client ID
            </label>
            <input
              type="text"
              value={spotifyClientId}
              onChange={(e) => setSpotifyClientId(e.target.value)}
              placeholder="Paste your Client ID here"
              disabled={isSavingSpotify}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            />
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Spotify Client Secret
            </label>
            <input
              type="password"
              value={spotifyClientSecret}
              onChange={(e) => setSpotifyClientSecret(e.target.value)}
              placeholder="Paste your Client Secret here"
              disabled={isSavingSpotify}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              🔒 Your credentials are encrypted before storage
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveSpotifyCredentials}
              disabled={isSavingSpotify || (!spotifyHasCredentials && (!spotifyClientId.trim() || !spotifyClientSecret.trim()))}
              style={{ flex: 1 }}
            >
              {isSavingSpotify ? (
                <>
                  <span style={{ display: 'inline-block', marginRight: '0.5rem' }}>⏳</span>
                  Connecting...
                </>
              ) : spotifyHasCredentials && !spotifyClientId.trim() && !spotifyClientSecret.trim() ? (
                'Connect to Spotify'
              ) : (
                'Save & Connect to Spotify'
              )}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.open('https://developer.spotify.com/dashboard', '_blank')}
            >
              Open Spotify Dashboard
            </button>
          </div>
          
          {isSavingSpotify && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(91, 155, 213, 0.1)',
              border: '1px solid rgba(91, 155, 213, 0.3)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}>
              <div style={{ marginBottom: '0.5rem' }}>✓ Validating credentials with Spotify...</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                This may take a few seconds
              </div>
            </div>
          )}
        </div>
      )}

      {!importResult ? (
        <>
          {/* Source Selection */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Source
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {sources.map(source => (
                <button
                  key={source.id}
                  className={`btn ${activeSource === source.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setActiveSource(source.id);
                    setUrl('');
                    setUsername('');
                    setFile(null);
                    setError(null);
                    setSearchResults([]);
                  }}
                  disabled={isImporting}
                >
                  {source.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input Field - Moved to top */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            {activeSource === 'file' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Select File
                </label>
                <input
                  type="file"
                  accept=".m3u,.m3u8"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isImporting}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            ) : activeSource === 'listenbrainz' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  ListenBrainz Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={currentSource?.placeholder}
                  disabled={isImporting}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            ) : activeSource === 'ai' ? (
              <div>
                {!hasGeminiApiKey && (
                  <>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGrokApiKey(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      disabled={isImporting}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-primary)',
                        marginBottom: '1rem',
                      }}
                    />
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Get your free API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Google AI Studio</a> or save it in <a href="/settings" style={{ color: 'var(--primary)' }}>Settings</a>
                    </div>
                  </>
                )}
                
                {hasGeminiApiKey && (
                  <div style={{ 
                    padding: '0.75rem', 
                    marginBottom: '1rem',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    border: '1px solid var(--success)',
                    borderRadius: '4px',
                    color: 'var(--success)',
                    fontSize: '0.875rem'
                  }}>
                    ✓ Using Gemini API key from Settings
                  </div>
                )}
                
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Describe Your Playlist
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., 'Create a playlist of upbeat 80s rock songs' or 'Relaxing jazz for studying'"
                  disabled={isImporting}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Tip: Be specific about genre, mood, era, or artists you like
                </div>
                
                <label style={{ display: 'block', marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Number of Tracks
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={aiTrackCount}
                  onChange={(e) => setAiTrackCount(Math.min(100, Math.max(10, Number(e.target.value) || 10)))}
                  disabled={isImporting}
                  style={{
                    width: '100px',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Choose between 10 and 100 tracks for your playlist
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  {['deezer', 'youtube'].includes(activeSource) ? `${currentSource?.name} URL or Search` : `${currentSource?.name} URL`}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      // Clear search results when user types
                      if (searchResults.length > 0) {
                        setSearchResults([]);
                      }
                    }}
                    placeholder={['deezer', 'youtube'].includes(activeSource) ? `${currentSource?.placeholder} or search for playlists` : currentSource?.placeholder}
                    disabled={isImporting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && ['deezer', 'youtube'].includes(activeSource) && url.trim() && !url.includes('http')) {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {['deezer', 'youtube'].includes(activeSource) && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleSearch}
                      disabled={isSearching || !url.trim() || url.includes('http')}
                      style={{ minWidth: '100px' }}
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </button>
                  )}
                </div>
                {['deezer', 'youtube'].includes(activeSource) && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Paste a URL to import directly, or enter keywords to search for playlists
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => handleImport()}
              disabled={isImporting || (!url && !username && !file && !aiPrompt) || (activeSource === 'ai' && !hasGeminiApiKey && !geminiApiKey)}
              style={{ marginTop: '1rem', width: '100%' }}
            >
              {isImporting ? 'Importing...' : activeSource === 'ai' ? 'Generate Playlist' : 'Import Playlist'}
            </button>
          </div>

          {/* Popular/User Playlists */}
          {activeSource === 'spotify' && !spotifyConnected ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              marginBottom: '1rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'rgba(91, 155, 213, 0.05)',
            }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🎵</div>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Connect to Spotify</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Connect your Spotify account to see and import your playlists
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowSpotifySetup(true)}
              >
                Connect to Spotify
              </button>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                Search Results for "{url}"
              </h3>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                gap: '0.75rem',
                marginBottom: '1rem',
              }}>
                {searchResults.map((playlist, idx) => (
                  <div
                    key={idx}
                    className="card"
                    style={{ 
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{playlist.name}</div>
                      {playlist.description && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {playlist.description}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handlePreview(playlist)}
                        disabled={isImporting}
                        style={{ flex: 1, minWidth: '60px' }}
                      >
                        Preview
                      </button>
                      <button
                        className="btn btn-primary btn-small"
                        onClick={() => handlePopularClick(playlist)}
                        disabled={isImporting}
                        style={{ flex: 1, minWidth: '60px' }}
                      >
                        Import
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleSchedule(playlist)}
                        disabled={isImporting}
                        style={{ flex: 1, minWidth: '70px' }}
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : activeSource === 'aria' ? (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                ARIA Charts
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                {/* Top 50 Singles */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Top 50 Singles</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Weekly ARIA Top 50 Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaTop50Date} onChange={(e) => setAriaTop50Date(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/singles-chart/${ariaTop50Date}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA Top 50 Singles - ${ariaTop50Date}`, url: `https://www.aria.com.au/charts/singles-chart/${ariaTop50Date}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Top Australian Singles */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Top Australian Singles</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Australian Artist Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaAustralianDate} onChange={(e) => setAriaAustralianDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/australian-artist-singles-chart/${ariaAustralianDate}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA Australian Singles - ${ariaAustralianDate}`, url: `https://www.aria.com.au/charts/australian-artist-singles-chart/${ariaAustralianDate}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Top 50 On Replay Singles */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Top 50 On Replay Singles</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Catalogue Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaReplayDate} onChange={(e) => setAriaReplayDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/catalogue-singles-chart/${ariaReplayDate}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA On Replay Singles - ${ariaReplayDate}`, url: `https://www.aria.com.au/charts/catalogue-singles-chart/${ariaReplayDate}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Top 20 New Music Singles */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Top 20 New Music Singles</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>New Music Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaNewMusicDate} onChange={(e) => setAriaNewMusicDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/new-music-singles-chart/${ariaNewMusicDate}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA New Music Singles - ${ariaNewMusicDate}`, url: `https://www.aria.com.au/charts/new-music-singles-chart/${ariaNewMusicDate}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Hip Hop R&B Singles */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Hip Hop R&B Singles</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Weekly ARIA Hip Hop R&B Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaHipHopDate} onChange={(e) => setAriaHipHopDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/hip-hop-r-and-b-singles-chart/${ariaHipHopDate}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA Hip Hop R&B Singles - ${ariaHipHopDate}`, url: `https://www.aria.com.au/charts/hip-hop-r-and-b-singles-chart/${ariaHipHopDate}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Dance Singles */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Dance Singles</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Weekly ARIA Dance Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaDanceDate} onChange={(e) => setAriaDanceDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/dance-singles-chart/${ariaDanceDate}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA Dance Singles - ${ariaDanceDate}`, url: `https://www.aria.com.au/charts/dance-singles-chart/${ariaDanceDate}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Club Tracks */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Club Tracks</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Weekly ARIA Club Tracks Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Chart week (Monday):</label>
                    <select value={ariaClubDate} onChange={(e) => setAriaClubDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%', cursor: 'pointer' }}>
                      {recentMondays.map(m => <option key={m} value={m}>{formatDateDMY(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/club-tracks-chart/${ariaClubDate}`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA Club Tracks - ${ariaClubDate}`, url: `https://www.aria.com.au/charts/club-tracks-chart/${ariaClubDate}` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>

                {/* Top 100 Singles (Annual) */}
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Top 100 Singles (Annual)</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>End of Year Singles Chart</div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Year:</label>
                    <select value={ariaTop100Year} onChange={(e) => setAriaTop100Year(e.target.value)} style={{ padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.8rem', width: '100%' }}>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-small" onClick={() => handleImport(`https://www.aria.com.au/charts/${ariaTop100Year}/singles-chart`)} disabled={isImporting} style={{ flex: 1 }}>Import</button>
                    <button className="btn btn-secondary btn-small" onClick={() => handleSchedule({ name: `ARIA Top 100 Singles ${ariaTop100Year}`, url: `https://www.aria.com.au/charts/${ariaTop100Year}/singles-chart` })} disabled={isImporting} style={{ flex: 1 }}>Schedule</button>
                  </div>
                </div>
              </div>
            </>
          ) : (currentPopular.length > 0 || (activeSource === 'spotify' && isLoadingSpotifyPlaylists) || isLoadingDynamicPlaylists) && (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                {activeSource === 'spotify' ? 'Your Spotify Playlists' : 'Popular Playlists'}
              </h3>
              
              {(isLoadingSpotifyPlaylists || isLoadingDynamicPlaylists) ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                }}>
                  Loading playlists...
                </div>
              ) : currentPopular.length === 0 && activeSource === 'spotify' ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}>
                  No playlists found in your Spotify account
                </div>
              ) : currentPopular.length === 0 && ['amazon', 'apple'].includes(activeSource) ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 193, 7, 0.05)',
                }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                    {activeSource === 'amazon' ? 'Amazon Music' : 'Apple Music'} popular playlists are not available
                  </div>
                  <div>
                    These services require browser automation to access. You can still import playlists by pasting a direct URL above.
                  </div>
                </div>
              ) : currentPopular.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}>
                  No popular playlists found. Try refreshing or selecting a different country.
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}>
                  {currentPopular.map((playlist, idx) => (
                      <div
                        key={`${activeSource}-${playlist.url}-${idx}`}
                        className="card"
                        style={{ 
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div style={{ flex: 1, marginBottom: '0.75rem' }}>
                          <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{playlist.name}</div>
                          {playlist.description && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              {playlist.description}
                            </div>
                          )}
                          {(playlist.videoCount || playlist.count || playlist.trackCount) && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {playlist.videoCount || playlist.count || playlist.trackCount} tracks
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handlePreview(playlist)}
                            disabled={isImporting}
                            style={{ flex: 1, minWidth: '60px' }}
                          >
                            Preview
                          </button>
                          <button
                            className="btn btn-primary btn-small"
                            onClick={() => handlePopularClick(playlist)}
                            disabled={isImporting}
                            style={{ flex: 1, minWidth: '60px' }}
                          >
                            Import
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleSchedule(playlist)}
                            disabled={isImporting}
                            style={{ flex: 1, minWidth: '70px' }}
                          >
                            Schedule
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}


          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: '4px',
              color: 'var(--error)',
            }}>
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Import Results - Review Screen */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Review Import</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>{matchedCount}</span> matched, {' '}
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{unmatchedCount}</span> unmatched
                </div>
                <button
                  onClick={handleCancel}
                  disabled={isImporting}
                  title="Close review"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Playlist Name
              </label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Overwrite Existing */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Overwrite existing playlist with same name</span>
              </label>
              {overwriteExisting && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={keepExistingCover}
                    onChange={(e) => setKeepExistingCover(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Keep existing cover art</span>
                </label>
              )}
            </div>

            {/* Filter Controls */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showUnmatchedOnly}
                  onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Show unmatched only</span>
              </label>
              
              {unmatchedCount > 0 && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={handleExportMissing}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    Export Missing ({unmatchedCount})
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddToMissingTracks}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    Save the Missing Tracks ({unmatchedCount})
                  </button>
                </>
              )}
            </div>

            {/* Tracks Table */}
            <div style={{ 
              overflowX: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              marginBottom: '1.5rem',
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: 'var(--surface)',
                    borderBottom: '1px solid var(--border-color)',
                  }}>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, width: '30px' }}>⋮⋮</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '40px' }}>#</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Title</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Artist</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Album</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '80px' }}>Format</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, width: '80px' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTracks.map((track, idx) => {
                    const originalIndex = editableTracks.indexOf(track);
                    return (
                      <tr
                        key={originalIndex}
                        draggable
                        onDragStart={() => handleDragStart(originalIndex)}
                        onDragOver={(e) => handleDragOver(e, originalIndex)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenRematch(track, originalIndex)}
                        style={{
                          borderBottom: idx < displayedTracks.length - 1 ? '1px solid var(--border-color)' : 'none',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                          cursor: 'pointer',
                          opacity: draggedIndex === originalIndex ? 0.5 : 1,
                        }}
                      >
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', cursor: 'grab' }}>
                          ⋮⋮
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{originalIndex + 1}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {track.matched ? (
                            <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                {track.title}
                              </div>
                              <div style={{ fontWeight: 500 }}>
                                → {track.plexTitle}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontWeight: 500, color: 'var(--warning)' }}>{track.title}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                          {track.matched ? track.plexArtist : track.artist}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                          {track.matched ? (track.plexAlbum || '-') : (track.album || '-')}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                          {track.matched && track.plexCodec ? (
                            <div>
                              <div>{track.plexCodec}</div>
                              {track.plexBitrate && (
                                <div style={{ fontSize: '0.75rem' }}>
                                  {Math.round(track.plexBitrate / 1000)} kbps
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          fontWeight: 600,
                          color: getScoreColor(track.score),
                        }}>
                          {track.matched ? `${track.score || 0}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleConfirmUpdated}
                disabled={isImporting || matchedCount === 0 || playlistCreated}
                style={{ minWidth: '150px' }}
              >
                {isImporting ? 'Creating...' : playlistCreated ? `Playlist Created ✓` : `Create Playlist (${matchedCount})`}
              </button>

              {playlistCreated && (
                <button
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  style={{ minWidth: '130px' }}
                >
                  New Import
                </button>
              )}

              <button
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={isImporting}
                style={{ minWidth: '100px' }}
              >
                {playlistCreated ? 'Close' : 'Cancel'}
              </button>
            </div>

            {playlistCreated && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid var(--success, #4caf50)',
                borderRadius: '4px',
                color: 'var(--success, #4caf50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <span>
                  Playlist "{playlistName}" created successfully.
                  {unmatchedCount > 0 && (
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      {unmatchedCount} unmatched track{unmatchedCount !== 1 ? 's' : ''} remaining.
                    </span>
                  )}
                </span>
                {unmatchedCount > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleAddToMissingTracks}
                    style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem', whiteSpace: 'nowrap' }}
                  >
                    Save Missing Tracks ({unmatchedCount})
                  </button>
                )}
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid var(--error)',
                borderRadius: '4px',
                color: 'var(--error)',
              }}>
                {error}
              </div>
            )}
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewPlaylist && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="card" style={{
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>{previewPlaylist.name}</h2>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  setPreviewPlaylist(null);
                  setPreviewTracks(null);
                }}
              >
                ✕
              </button>
            </div>

            {previewPlaylist.description && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {previewPlaylist.description}
              </p>
            )}

            {isLoadingPreview ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                Loading tracks...
              </div>
            ) : previewTracks && previewTracks.length > 0 ? (
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px' }}>
                {previewTracks.map((track, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderBottom: idx < previewTracks.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{track.title}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {track.artist}
                    </div>
                  </div>
                ))}
              </div>
            ) : previewTracks && previewTracks.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
              }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>ℹ️</div>
                <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Preview Unavailable</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {error || 'Unable to load preview for this playlist.'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(91, 155, 213, 0.1)', borderRadius: '4px' }}>
                  <strong>Don't worry!</strong> You can still import this playlist. The full track list will be fetched and matched during the import process.
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handlePopularClick(previewPlaylist);
                  setPreviewPlaylist(null);
                  setPreviewTracks(null);
                }}
                style={{ flex: 1 }}
              >
                Import This Playlist
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setPreviewPlaylist(null);
                  setPreviewTracks(null);
                }}
                style={{ flex: 1 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Modal */}
      {importProgress && importProgress.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1rem',
        }}>
          <div style={{
            width: '400px',
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            {/* Playlist artwork */}
            <div style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 1.5rem',
              borderRadius: '12px',
              backgroundColor: '#2a2a2a',
              backgroundImage: importProgress.coverUrl 
                ? `url(${importProgress.coverUrl})` 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3.5rem',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
            }}>
              {!importProgress.coverUrl && '🎵'}
            </div>

            {/* Playlist name */}
            <h2 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}>
              {importProgress.playlistName}
            </h2>
            
            {/* Source label */}
            <div style={{ 
              fontSize: '0.813rem', 
              color: '#888888', 
              marginBottom: '1.5rem',
              fontWeight: 400,
            }}>
              from {importProgress.source}
            </div>

            {/* Track count - prominent display */}
            {importProgress.totalTracks > 0 && (
              <div style={{ 
                fontSize: '1.125rem', 
                fontWeight: 500, 
                marginBottom: '0.75rem',
                color: '#ffffff',
              }}>
                {importProgress.currentTrack} / {importProgress.totalTracks} tracks
              </div>
            )}

            {/* Current track name or status */}
            <div style={{ 
              fontSize: '0.875rem', 
              fontWeight: 400,
              color: '#aaaaaa',
              minHeight: '1.25rem',
              marginBottom: '1.5rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '0 1rem',
            }}>
              {importProgress.phase === 'scraping' && (importProgress.currentTrackName || 'Fetching playlist...')}
              {importProgress.phase === 'matching' && (importProgress.currentTrackName || 'Matching tracks...')}
              {importProgress.phase === 'complete' && (importProgress.currentTrackName || 'Complete!')}
            </div>

            {/* Progress indicator - spinning or progress bar */}
            {importProgress.phase !== 'complete' && (
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginBottom: '1.5rem',
              }}>
                {importProgress.totalTracks > 0 ? (
                  // Progress bar when we have total
                  <div style={{
                    width: `${(importProgress.currentTrack / importProgress.totalTracks) * 100}%`,
                    height: '100%',
                    backgroundColor: '#667eea',
                    transition: 'width 0.3s ease',
                  }} />
                ) : (
                  // Indeterminate progress when fetching
                  <div style={{
                    width: '30%',
                    height: '100%',
                    backgroundColor: '#667eea',
                    animation: 'progress-indeterminate 1.5s ease-in-out infinite',
                  }} />
                )}
              </div>
            )}
            
            {/* Cancel button */}
            {importProgress.phase !== 'complete' && (
              <button
                onClick={handleCancelImport}
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.938rem',
                  fontWeight: 500,
                  color: '#ffffff',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                Cancel
              </button>
            )}
          </div>
          
          {/* Add CSS animation for indeterminate progress */}
          <style>{`
            @keyframes progress-indeterminate {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(350%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
        </div>
      )}

      {/* Manual Rematch Modal */}
      {rematchTrack && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="card" style={{
            maxWidth: '800px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Manual Rematch</h2>
              <button
                className="btn btn-secondary btn-small"
                onClick={handleCloseRematch}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Original Track:
              </div>
              <div style={{ fontWeight: 500 }}>
                {rematchTrack.track.artist} - {rematchTrack.track.title}
              </div>
              {rematchTrack.track.album && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {rematchTrack.track.album}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={rematchQuery}
                  onChange={(e) => setRematchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchRematch()}
                  placeholder="Search Plex library..."
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSearchRematch}
                  disabled={isSearchingRematch || !rematchQuery.trim()}
                  style={{ minWidth: '100px' }}
                >
                  {isSearchingRematch ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {rematchResults.length > 0 ? (
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                }}>
                  <thead>
                    <tr style={{ 
                      backgroundColor: 'var(--surface)',
                      borderBottom: '1px solid var(--border-color)',
                      position: 'sticky',
                      top: 0,
                    }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Title</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Artist</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Album</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '80px' }}>Format</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '80px' }}>Bitrate</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rematchResults.map((result, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: idx < rematchResults.length - 1 ? '1px solid var(--border-color)' : 'none',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{result.title}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{result.artist}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{result.album || '-'}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                          {result.codec || '-'}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                          {result.bitrate ? `${result.bitrate} kbps` : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            className="btn btn-primary btn-small"
                            onClick={() => handleSelectRematch(result)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isSearchingRematch ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
              }}>
                Searching...
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
              }}>
                {rematchQuery.trim() ? 'No results found. Try a different search.' : 'Enter a search query to find tracks.'}
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={handleCloseRematch}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {schedulePlaylist && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Schedule Playlist</h2>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setSchedulePlaylist(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{schedulePlaylist.name}</div>
              {schedulePlaylist.description && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {schedulePlaylist.description}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Playlist Name in Plex
              </label>
              <input
                type="text"
                value={schedulePlaylistName}
                onChange={(e) => setSchedulePlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                This will be the name of the playlist saved to Plex
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'var(--surface)',
              }}>
                <input
                  type="checkbox"
                  checked={scheduleOverwriteExisting}
                  onChange={(e) => setScheduleOverwriteExisting(e.target.checked)}
                  style={{ marginRight: '0.75rem' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Overwrite existing playlist</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    If a playlist with the same name exists in Plex, it will be replaced
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'var(--surface)',
              }}>
                <input
                  type="checkbox"
                  checked={scheduleOverwriteCover}
                  onChange={(e) => setScheduleOverwriteCover(e.target.checked)}
                  style={{ marginRight: '0.75rem' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Overwrite cover art</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Replace the playlist cover art with the imported playlist's artwork
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Update Frequency
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'fortnightly', label: 'Fortnightly (Every 2 weeks)' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'custom', label: 'Custom' },
                ].map(option => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: scheduleFrequency === option.value ? 'var(--surface-hover)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={scheduleFrequency === option.value}
                      onChange={(e) => setScheduleFrequency(e.target.value as any)}
                      style={{ marginRight: '0.75rem' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Start Date
              </label>
              <input
                type="date"
                value={scheduleStartDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                First update will occur on this date
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Run Time
              </label>
              <input
                type="time"
                value={scheduleRunTime}
                onChange={(e) => setScheduleRunTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Time of day to run the schedule
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleScheduleConfirm}
                disabled={isImporting}
                style={{ flex: 1 }}
              >
                {isImporting ? 'Creating...' : 'Create Schedule'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSchedulePlaylist(null)}
                disabled={isImporting}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Name Edit Modal for Missing Tracks Save */}
      {showMissingNameModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowMissingNameModal(false)}>
          <div style={{
            backgroundColor: 'var(--surface)', borderRadius: '8px', padding: '1.5rem',
            width: '450px', maxWidth: '90vw',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Save to Plex & Missing Tracks</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {editableTracks.filter(t => t.matched).length} matched track{editableTracks.filter(t => t.matched).length !== 1 ? 's' : ''} will be added to a Plex playlist.{' '}
              {editableTracks.filter(t => !t.matched).length} unmatched track{editableTracks.filter(t => !t.matched).length !== 1 ? 's' : ''} will be saved to Missing Tracks for later matching.
            </p>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
              Playlist Name
            </label>
            <input
              type="text"
              value={missingPlaylistName}
              onChange={(e) => setMissingPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && missingPlaylistName.trim() && handleConfirmMissingSave()}
              style={{
                width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px',
                border: '1px solid var(--border-color)', backgroundColor: 'var(--background)',
                color: 'var(--text-primary)', marginBottom: '1rem', boxSizing: 'border-box',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowMissingNameModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmMissingSave}
                disabled={!missingPlaylistName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
