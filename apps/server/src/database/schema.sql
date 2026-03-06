-- Playlist Lab Web Server Database Schema
-- SQLite database schema for multi-user playlist management

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table
-- Stores authenticated Plex users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plex_user_id TEXT UNIQUE NOT NULL,
  plex_username TEXT NOT NULL,
  plex_token TEXT NOT NULL,  -- Encrypted Plex authentication token
  plex_thumb TEXT,           -- User avatar URL
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL,
  is_enabled INTEGER DEFAULT 1,  -- Whether user is allowed to access the app
  gemini_api_key TEXT,
  grok_api_key TEXT,
  ai_provider TEXT DEFAULT 'gemini',
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  spotify_token_expires_at INTEGER,
  spotify_client_id TEXT,
  spotify_client_secret TEXT
);

-- Index for fast user lookup by Plex ID
CREATE INDEX IF NOT EXISTS idx_users_plex_user_id ON users(plex_user_id);

-- User servers table
-- Stores each user's Plex server configurations
CREATE TABLE IF NOT EXISTS user_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  server_name TEXT NOT NULL,
  server_client_id TEXT NOT NULL,
  server_url TEXT NOT NULL,
  library_id TEXT,
  library_name TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast server lookup by user
CREATE INDEX IF NOT EXISTS idx_user_servers_user_id ON user_servers(user_id);

-- User settings table
-- Stores per-user configuration for matching and mix generation
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  country TEXT DEFAULT 'global',
  matching_settings TEXT,  -- JSON: matching algorithm configuration
  mix_settings TEXT,       -- JSON: mix generation configuration
  gemini_api_key TEXT,     -- Encrypted Gemini API key for AI features
  grok_api_key TEXT,       -- Encrypted Grok API key for AI features
  ai_provider TEXT DEFAULT 'gemini',  -- 'gemini' or 'grok'
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlists table
-- Stores playlists created by users
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plex_playlist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,  -- 'spotify', 'deezer', 'apple', 'tidal', etc.
  source_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast playlist lookup by user
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);

-- Index for fast playlist lookup by Plex playlist ID
CREATE INDEX IF NOT EXISTS idx_playlists_plex_playlist_id ON playlists(plex_playlist_id);

-- Schedules table
-- Stores automated playlist refresh and mix generation schedules
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER,
  schedule_type TEXT NOT NULL,  -- 'playlist_refresh' or 'mix_generation'
  frequency TEXT NOT NULL,      -- 'daily', 'weekly', 'fortnightly', 'monthly'
  start_date TEXT NOT NULL,
  last_run INTEGER,
  config TEXT,  -- JSON: additional configuration (mix types, etc.)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Index for fast schedule lookup by user
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);

-- Index for finding due schedules efficiently
CREATE INDEX IF NOT EXISTS idx_schedules_last_run ON schedules(last_run);

-- Missing tracks table
-- Stores tracks that couldn't be matched during import
CREATE TABLE IF NOT EXISTS missing_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  position INTEGER NOT NULL,
  after_track_key TEXT,
  added_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Index for fast missing tracks lookup by user
CREATE INDEX IF NOT EXISTS idx_missing_tracks_user_id ON missing_tracks(user_id);

-- Index for fast missing tracks lookup by playlist
CREATE INDEX IF NOT EXISTS idx_missing_tracks_playlist_id ON missing_tracks(playlist_id);

-- Composite index for grouping missing tracks by user and playlist
CREATE INDEX IF NOT EXISTS idx_missing_tracks_user_playlist ON missing_tracks(user_id, playlist_id);

-- Cached playlists table
-- Stores scraped playlist data to avoid re-scraping
CREATE TABLE IF NOT EXISTS cached_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,      -- 'spotify', 'deezer', etc.
  source_id TEXT NOT NULL,   -- External playlist ID or chart ID
  name TEXT NOT NULL,
  description TEXT,
  tracks TEXT NOT NULL,      -- JSON array of tracks
  cover_url TEXT,            -- Playlist cover image URL
  scraped_at INTEGER NOT NULL,
  UNIQUE(source, source_id)
);

-- Index for fast cache lookup by source and ID
CREATE INDEX IF NOT EXISTS idx_cached_playlists_source_id ON cached_playlists(source, source_id);

-- Index for finding stale cache entries
CREATE INDEX IF NOT EXISTS idx_cached_playlists_scraped_at ON cached_playlists(scraped_at);

-- Sessions table
-- Stores user sessions for authentication
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER NOT NULL
);

-- Index for cleaning up expired sessions
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);

-- Admin users table
-- Stores which users have admin privileges
CREATE TABLE IF NOT EXISTS admin_users (
  user_id INTEGER PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlist shares table
-- Tracks which playlists have been shared with which users
CREATE TABLE IF NOT EXISTS playlist_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  owner_user_id INTEGER NOT NULL,
  shared_with_user_id INTEGER NOT NULL,
  plex_playlist_id TEXT NOT NULL,
  playlist_name TEXT NOT NULL,
  shared_at INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, shared_with_user_id)
);

-- Index for finding playlists shared with a user
CREATE INDEX IF NOT EXISTS idx_playlist_shares_shared_with ON playlist_shares(shared_with_user_id);

-- Index for finding shares by owner
CREATE INDEX IF NOT EXISTS idx_playlist_shares_owner ON playlist_shares(owner_user_id);

-- Cross-import jobs table
-- Stores completed and in-progress cross-playlist import operations
CREATE TABLE IF NOT EXISTS cross_import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_service TEXT NOT NULL,
  source_playlist_name TEXT NOT NULL,
  target_service TEXT NOT NULL,
  target_playlist_name TEXT,
  matched_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'matching', 'review', 'complete', 'failed'
  unmatched_tracks TEXT,                   -- JSON array of {title, artist}
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cross_import_jobs_user_id ON cross_import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_import_jobs_created_at ON cross_import_jobs(created_at);

-- OAuth connections table
-- Stores OAuth tokens for external service targets (all services except Spotify, which uses the users table)
CREATE TABLE IF NOT EXISTS oauth_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  service TEXT NOT NULL,         -- e.g. 'deezer', 'tidal'
  access_token TEXT NOT NULL,    -- encrypted
  refresh_token TEXT,            -- encrypted, if provided
  token_expires_at INTEGER,
  scope TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, service),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_service ON oauth_connections(user_id, service);
