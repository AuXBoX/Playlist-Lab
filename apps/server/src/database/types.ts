/**
 * Database Type Definitions
 * 
 * TypeScript interfaces for all database tables and related types.
 * These types ensure type safety when working with database records.
 */

/**
 * User record from the users table
 */
export interface User {
  id: number;
  plex_user_id: string;
  plex_username: string;
  plex_token: string;  // Encrypted
  plex_thumb?: string;
  created_at: number;
  last_login: number;
  is_enabled: number;  // 1 = enabled, 0 = disabled
}

/**
 * User server configuration from the user_servers table
 */
export interface UserServer {
  id: number;
  user_id: number;
  server_name: string;
  server_client_id: string;
  server_url: string;
  library_id?: string;
  library_name?: string;
}

/**
 * Matching algorithm settings
 */
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

/**
 * Mix generation settings
 */
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

/**
 * User settings from the user_settings table
 */
export interface UserSettings {
  user_id: number;
  country: string;
  matching_settings: string;  // JSON string
  mix_settings: string;       // JSON string
  gemini_api_key?: string;    // Encrypted
  grok_api_key?: string;      // Encrypted
  ai_provider?: string;       // 'gemini' or 'grok'
}

/**
 * Parsed user settings with typed objects
 */
export interface ParsedUserSettings {
  user_id: number;
  country: string;
  matching_settings: MatchingSettings;
  mix_settings: MixSettings;
  gemini_api_key?: string;    // Encrypted
  grok_api_key?: string;      // Encrypted
  ai_provider?: string;       // 'gemini' or 'grok'
}

/**
 * Playlist record from the playlists table
 */
export interface Playlist {
  id: number;
  user_id: number;
  plex_playlist_id: string;
  name: string;
  source: string;
  source_url?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Schedule types
 */
export type ScheduleType = 'playlist_refresh' | 'mix_generation';

/**
 * Schedule frequencies
 */
export type ScheduleFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly';

/**
 * Schedule record from the schedules table
 */
export interface Schedule {
  id: number;
  user_id: number;
  playlist_id?: number;
  schedule_type: ScheduleType;
  frequency: ScheduleFrequency;
  start_date: string;
  last_run?: number;
  config?: string;  // JSON string
}

/**
 * Missing track record from the missing_tracks table
 */
export interface MissingTrack {
  id: number;
  user_id: number;
  playlist_id: number;
  title: string;
  artist: string;
  album?: string;
  position: number;
  after_track_key?: string;
  added_at: number;
  source: string;
}

/**
 * External track data structure
 */
export interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
}

/**
 * Cached playlist record from the cached_playlists table
 */
export interface CachedPlaylist {
  id: number;
  source: string;
  source_id: string;
  name: string;
  description?: string;
  tracks: string;  // JSON string
  scraped_at: number;
}

/**
 * Parsed cached playlist with typed tracks
 */
export interface ParsedCachedPlaylist {
  id: number;
  source: string;
  source_id: string;
  name: string;
  description?: string;
  tracks: ExternalTrack[];
  cover_url?: string;
  scraped_at: number;
}

/**
 * Session record from the sessions table
 */
export interface Session {
  sid: string;
  sess: string;  // JSON string
  expired: number;
}

/**
 * Admin user record from the admin_users table
 */
export interface AdminUser {
  user_id: number;
}

/**
 * Input type for creating a missing track
 */
export interface MissingTrackInput {
  title: string;
  artist: string;
  album?: string;
  position: number;
  after_track_key?: string;
  source: string;
}

/**
 * Input type for creating a schedule
 */
export interface ScheduleInput {
  playlist_id?: number;
  schedule_type: ScheduleType;
  frequency: ScheduleFrequency;
  start_date: string;
  config?: any;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  users: number;
  user_servers: number;
  user_settings: number;
  playlists: number;
  schedules: number;
  missing_tracks: number;
  cached_playlists: number;
  sessions: number;
  admin_users: number;
}

/**
 * Missing track statistics for admin view
 */
export interface MissingTrackStat {
  track: string;
  artist: string;
  count: number;
}
