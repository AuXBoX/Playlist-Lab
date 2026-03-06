/**
 * Database Initialization Module
 * 
 * Handles SQLite database creation and schema initialization for the
 * Playlist Lab Web Server. This module ensures the database exists and
 * all tables are created with proper constraints and indexes.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Initialize the SQLite database with the schema
 * 
 * @param dbPath - Path to the SQLite database file
 * @returns Database instance
 */
export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open database connection
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

  // Read and execute schema SQL
  // In production, schema.sql is in the same directory as the compiled init.js
  // In development, it's in the src/database directory
  let schemaPath = path.join(__dirname, 'schema.sql');
  
  // If not found, try the src directory (development)
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(__dirname, '..', '..', 'src', 'database', 'schema.sql');
  }
  
  // If still not found, try relative to process.cwd()
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(process.cwd(), 'src', 'database', 'schema.sql');
  }
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found. Tried: ${schemaPath}`);
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Execute the entire schema at once - SQLite can handle multiple statements
  try {
    db.exec(schema);
    console.log('Database initialized successfully');
    
    // Run migrations to add any new columns
    console.log('Running database migrations...');
    runMigrations(db);
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Error executing schema:', error);
    throw error;
  }

  return db;
}

/**
 * Verify database schema integrity
 * 
 * @param db - Database instance
 * @returns true if schema is valid, false otherwise
 */
export function verifySchema(db: Database.Database): boolean {
  const requiredTables = [
    'users',
    'user_servers',
    'user_settings',
    'playlists',
    'schedules',
    'missing_tracks',
    'cached_playlists',
    'sessions',
    'admin_users',
    'cross_import_jobs',
    'oauth_connections'
  ];

  try {
    for (const table of requiredTables) {
      const result = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);

      if (!result) {
        console.error(`Missing required table: ${table}`);
        return false;
      }
    }

    // Verify foreign keys are enabled
    const fkEnabled = db.pragma('foreign_keys', { simple: true });
    if (fkEnabled !== 1) {
      console.error('Foreign keys are not enabled');
      return false;
    }

    console.log('Database schema verification passed');
    return true;
  } catch (error) {
    console.error('Schema verification failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 * 
 * @param db - Database instance
 * @returns Object with table row counts
 */
export function getDatabaseStats(db: Database.Database): Record<string, number> {
  const tables = [
    'users',
    'user_servers',
    'user_settings',
    'playlists',
    'schedules',
    'missing_tracks',
    'cached_playlists',
    'sessions',
    'admin_users',
    'cross_import_jobs',
    'oauth_connections'
  ];

  const stats: Record<string, number> = {};

  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    stats[table] = result.count;
  }

  return stats;
}

/**
 * Clean up expired sessions
 * 
 * @param db - Database instance
 * @returns Number of sessions deleted
 */
export function cleanupExpiredSessions(db: Database.Database): number {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM sessions WHERE expired < ?').run(now);
  return result.changes;
}

/**
 * Run database migrations
 * Adds new columns to existing tables if they don't exist
 * 
 * @param db - Database instance
 */
export function runMigrations(db: Database.Database): void {
  try {
    // Check if gemini_api_key column exists in user_settings
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as Array<{ name: string }>;
    const hasGeminiApiKey = columns.some(col => col.name === 'gemini_api_key');
    const hasGrokApiKey = columns.some(col => col.name === 'grok_api_key');
    const hasAiProvider = columns.some(col => col.name === 'ai_provider');
    
    if (!hasGeminiApiKey) {
      console.log('Adding gemini_api_key column to user_settings table...');
      db.exec('ALTER TABLE user_settings ADD COLUMN gemini_api_key TEXT');
      console.log('Migration completed: gemini_api_key column added');
    }
    
    if (!hasGrokApiKey) {
      console.log('Adding grok_api_key column to user_settings table...');
      db.exec('ALTER TABLE user_settings ADD COLUMN grok_api_key TEXT');
      console.log('Migration completed: grok_api_key column added');
    }
    
    if (!hasAiProvider) {
      console.log('Adding ai_provider column to user_settings table...');
      db.exec("ALTER TABLE user_settings ADD COLUMN ai_provider TEXT DEFAULT 'gemini'");
      console.log('Migration completed: ai_provider column added');
    }
    
    // Check if Spotify columns exist in users table
    const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasSpotifyAccessToken = userColumns.some(col => col.name === 'spotify_access_token');
    const hasSpotifyRefreshToken = userColumns.some(col => col.name === 'spotify_refresh_token');
    const hasSpotifyTokenExpiresAt = userColumns.some(col => col.name === 'spotify_token_expires_at');
    const hasSpotifyClientId = userColumns.some(col => col.name === 'spotify_client_id');
    const hasSpotifyClientSecret = userColumns.some(col => col.name === 'spotify_client_secret');
    
    if (!hasSpotifyAccessToken) {
      console.log('Adding spotify_access_token column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN spotify_access_token TEXT');
      console.log('Migration completed: spotify_access_token column added');
    }
    
    if (!hasSpotifyRefreshToken) {
      console.log('Adding spotify_refresh_token column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN spotify_refresh_token TEXT');
      console.log('Migration completed: spotify_refresh_token column added');
    }
    
    if (!hasSpotifyTokenExpiresAt) {
      console.log('Adding spotify_token_expires_at column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN spotify_token_expires_at INTEGER');
      console.log('Migration completed: spotify_token_expires_at column added');
    }
    
    if (!hasSpotifyClientId) {
      console.log('Adding spotify_client_id column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN spotify_client_id TEXT');
      console.log('Migration completed: spotify_client_id column added');
    }
    
    if (!hasSpotifyClientSecret) {
      console.log('Adding spotify_client_secret column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN spotify_client_secret TEXT');
      console.log('Migration completed: spotify_client_secret column added');
    }
    
    // Check if cover_url column exists in cached_playlists table
    const cachedPlaylistColumns = db.prepare("PRAGMA table_info(cached_playlists)").all() as Array<{ name: string }>;
    const hasCoverUrl = cachedPlaylistColumns.some(col => col.name === 'cover_url');
    
    if (!hasCoverUrl) {
      console.log('Adding cover_url column to cached_playlists table...');
      db.exec('ALTER TABLE cached_playlists ADD COLUMN cover_url TEXT');
      console.log('Migration completed: cover_url column added');
    }
    
    // Check if is_enabled column exists in users table (multi-user support)
    const userCols2 = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasIsEnabled = userCols2.some(col => col.name === 'is_enabled');
    
    if (!hasIsEnabled) {
      console.log('Adding is_enabled column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN is_enabled INTEGER DEFAULT 1');
      console.log('Migration completed: is_enabled column added');
    }

    // Create cross_import_jobs table if it doesn't exist
    const hasCrossImportJobs = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cross_import_jobs'"
    ).get();
    if (!hasCrossImportJobs) {
      console.log('Creating cross_import_jobs table...');
      db.exec(`
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
          status TEXT NOT NULL DEFAULT 'pending',
          unmatched_tracks TEXT,
          created_at INTEGER NOT NULL,
          completed_at INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cross_import_jobs_user_id ON cross_import_jobs(user_id);
        CREATE INDEX IF NOT EXISTS idx_cross_import_jobs_created_at ON cross_import_jobs(created_at);
      `);
      console.log('Migration completed: cross_import_jobs table created');
    }

    // Create oauth_connections table if it doesn't exist
    const hasOauthConnections = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_connections'"
    ).get();
    if (!hasOauthConnections) {
      console.log('Creating oauth_connections table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS oauth_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          service TEXT NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          token_expires_at INTEGER,
          scope TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(user_id, service),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_service ON oauth_connections(user_id, service);
      `);
      console.log('Migration completed: oauth_connections table created');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Vacuum the database to reclaim space
 * 
 * @param db - Database instance
 */
export function vacuumDatabase(db: Database.Database): void {
  db.exec('VACUUM');
  console.log('Database vacuumed successfully');
}

