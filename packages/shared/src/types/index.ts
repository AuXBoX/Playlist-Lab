// User types
export interface User {
  id: number;
  plexUserId: string;
  plexUsername: string;
  plexToken: string;
  plexThumb?: string;
  createdAt: number;
  lastLogin: number;
  isAdmin?: boolean;
  isEnabled?: boolean;
  hasServer?: boolean;
}

// Plex Server types
export interface PlexServer {
  name: string;
  clientId: string;
  url: string;
  libraryId?: string;
  libraryName?: string;
}

// Settings types
export interface UserSettings {
  country: string;
  matchingSettings: MatchingSettings;
  mixSettings: MixSettings;
  geminiApiKey?: string;
  grokApiKey?: string;
  aiProvider?: 'gemini' | 'grok';
}

export interface MatchingSettings {
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

export interface MixSettings {
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

// Playlist types
export interface Playlist {
  id: number;
  userId?: number;
  plexPlaylistId: string;
  name: string;
  source: string;
  sourceUrl?: string;
  trackCount?: number;
  duration?: number;
  createdAt: number;
  updatedAt: number;
}

// Schedule types
export interface Schedule {
  id: number;
  userId: number;
  playlistId?: number;
  scheduleType: 'playlist_refresh' | 'mix_generation';
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
  startDate: string;
  lastRun?: number;
  config?: any;
}

// Missing track types
export interface MissingTrack {
  id: number;
  userId: number;
  playlistId: number;
  title: string;
  artist: string;
  album?: string;
  position: number;
  afterTrackKey?: string;
  addedAt: number;
  source: string;
}

// Cached playlist types
export interface CachedPlaylist {
  id: number;
  source: string;
  sourceId: string;
  name: string;
  description?: string;
  tracks: ExternalTrack[];
  scrapedAt: number;
}

// External service types
export interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
}

export interface ExternalPlaylist {
  id: string;
  name: string;
  description?: string;
  source: string;
  tracks: ExternalTrack[];
}

// Matched track types
export interface MatchedTrack {
  title: string;
  artist: string;
  album?: string;
  matched: boolean;
  plexRatingKey?: string;
  plexTitle?: string;
  plexArtist?: string;
  plexAlbum?: string;
  plexCodec?: string;
  plexBitrate?: number;
  score?: number;
}

// Plex track types
export interface PlexTrack {
  ratingKey: string;
  title: string;
  grandparentTitle: string; // Artist
  parentTitle: string; // Album
  Media?: Array<{
    audioCodec?: string;
    bitrate?: number;
  }>;
}

// API Error types
export interface APIErrorData {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

// API Response types
export interface APIResponse<T> {
  data?: T;
  error?: APIErrorData;
}
