import { createContext, useContext, useState, useEffect, useRef, type FC, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { APIClient } from '@playlist-lab/shared';

interface PlexServer {
  name: string;
  clientId: string;
  url: string;
  libraryId?: string;
  libraryName?: string;
}

interface MatchingSettings {
  minMatchScore: number;
  stripParentheses: boolean;
  stripBrackets: boolean;
  useFirstArtistOnly: boolean;
  ignoreFeaturedArtists: boolean;
  ignoreRemixInfo: boolean;
  ignoreVersionInfo: boolean;
  preferNonCompilation: boolean;
  penalizeMonoVersions: boolean;
  penalizeLiveVersions: boolean;
  preferHigherRated: boolean;
  minRatingForMatch: number;
  autoCompleteOnPerfectMatch: boolean;
  playlistPrefixes: {
    enabled: boolean;
    spotify: string;
    deezer: string;
    apple: string;
    tidal: string;
    youtube: string;
    amazon: string;
    qobuz: string;
    listenbrainz: string;
    file: string;
    ai: string;
  };
  customStripPatterns: string[];
  featuredArtistPatterns: string[];
  versionSuffixPatterns: string[];
  remasterPatterns: string[];
  variousArtistsNames: string[];
  penaltyKeywords: string[];
  priorityKeywords: string[];
}

interface MixSettings {
  weeklyMix: {
    topArtists: number;
    tracksPerArtist: number;
  };
  dailyMix: {
    recentTracks: number;
    relatedTracks: number;
    rediscoveryTracks: number;
    rediscoveryDays: number;
  };
  timeCapsule: {
    trackCount: number;
    daysAgo: number;
    maxPerArtist: number;
  };
  newMusic: {
    albumCount: number;
    tracksPerAlbum: number;
  };
}

interface UserSettings {
  country: string;
  matchingSettings: MatchingSettings;
  mixSettings: MixSettings;
  geminiApiKey?: string;
  grokApiKey?: string;
  aiProvider?: 'gemini' | 'grok';
}

interface Playlist {
  id: number;
  userId: number;
  plexPlaylistId: string;
  name: string;
  source: string;
  sourceUrl?: string;
  trackCount?: number;
  duration?: number;
  createdAt: number;
  updatedAt: number;
}

interface Schedule {
  id: number;
  userId: number;
  playlistId?: number;
  scheduleType: 'playlist_refresh' | 'mix_generation';
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
  startDate: string;
  lastRun?: number;
  config?: any;
}

interface AppState {
  server: PlexServer | null;
  settings: UserSettings | null;
  playlists: Playlist[];
  schedules: Schedule[];
  missingTracksCount: number;
  isLoading: boolean;
}

interface AppContextType extends AppState {
  apiClient: APIClient;
  setServer: (server: PlexServer) => void;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshMissingTracksCount: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: FC<AppProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<AppState>({
    server: null,
    settings: null,
    playlists: [],
    schedules: [],
    missingTracksCount: 0,
    isLoading: true, // Start as true to prevent premature redirects before initial data loads
  });

  // Create API client instance (stable reference — never recreated)
  const apiClient = useRef(new APIClient(window.location.origin)).current;

  // Load initial data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshAll();
    } else {
      // Reset state when logged out
      setState({
        server: null,
        settings: null,
        playlists: [],
        schedules: [],
        missingTracksCount: 0,
        isLoading: false,
      });
    }
  }, [isAuthenticated]);

  const setServer = (server: PlexServer) => {
    setState((prev) => ({ ...prev, server }));
  };

  const updateSettings = async (settings: Partial<UserSettings>) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      // API returns { settings: {...} }
      setState((prev) => ({ ...prev, settings: data.settings }));
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  const refreshPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both array and object with playlists property
        const playlists = Array.isArray(data) ? data : (data.playlists || []);
        setState((prev) => ({ ...prev, playlists }));
      } else {
        console.error('Failed to fetch playlists:', response.status);
        setState((prev) => ({ ...prev, playlists: [] }));
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      setState((prev) => ({ ...prev, playlists: [] }));
    }
  };

  const refreshSchedules = async () => {
    try {
      const response = await fetch('/api/schedules', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both array and object with schedules property
        const schedules = Array.isArray(data) ? data : (data.schedules || []);
        setState((prev) => ({ ...prev, schedules }));
      } else {
        console.error('Failed to fetch schedules:', response.status);
        setState((prev) => ({ ...prev, schedules: [] }));
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setState((prev) => ({ ...prev, schedules: [] }));
    }
  };

  const refreshMissingTracksCount = async () => {
    try {
      const response = await fetch('/api/missing', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Use totalCount from API (actual track count) instead of array length (playlist group count)
        const count = data.totalCount ?? (Array.isArray(data) ? data.length : (data.missingTracks || []).reduce((sum: number, g: any) => sum + (g.tracks?.length || 0), 0));
        setState((prev) => ({ 
          ...prev, 
          missingTracksCount: count
        }));
      } else {
        console.error('Failed to fetch missing tracks:', response.status);
        setState((prev) => ({ ...prev, missingTracksCount: 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch missing tracks count:', error);
      setState((prev) => ({ ...prev, missingTracksCount: 0 }));
    }
  };

  const refreshSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // API returns { settings: {...} }
        setState((prev) => ({ ...prev, settings: data.settings }));
      } else {
        console.error('Failed to fetch settings:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const refreshAll = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Fetch current server first
      try {
        const serverResponse = await fetch('/api/servers/current', {
          credentials: 'include',
        });
        if (serverResponse.ok) {
          const data = await serverResponse.json();
          if (data.server) {
            setState((prev) => ({ ...prev, server: data.server }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch current server in refreshAll:', error);
      }

      // Fetch settings
      try {
        const settingsResponse = await fetch('/api/settings', {
          credentials: 'include',
        });
        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          // API returns { settings: {...} }
          setState((prev) => ({ ...prev, settings: data.settings }));
        }
      } catch (error) {
        console.error('Failed to fetch settings in refreshAll:', error);
      }

      // Fetch all data in parallel, but don't let failures stop other requests
      await Promise.allSettled([
        refreshPlaylists(),
        refreshSchedules(),
        refreshMissingTracksCount(),
      ]);
    } catch (error) {
      console.error('Failed to refresh app data:', error);
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const value: AppContextType = {
    ...state,
    apiClient,
    setServer,
    updateSettings,
    refreshPlaylists,
    refreshSchedules,
    refreshMissingTracksCount,
    refreshSettings,
    refreshAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
