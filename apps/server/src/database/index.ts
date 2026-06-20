/**
 * Database Module
 * 
 * Main entry point for database operations.
 * Exports initialization functions, DatabaseService class, and type definitions.
 */

import Database from 'better-sqlite3';
import { initializeDatabase } from './init';
import path from 'path';
import os from 'os';

// Singleton database instance
let dbInstance: Database.Database | null = null;

/**
 * Get the default database path based on environment
 */
function getDefaultDbPath(): string {
  const isProduction = process.cwd().includes('Program Files') || process.cwd().includes('Program Files (x86)');
  if (isProduction) {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Playlist Lab', 'data', 'playlist-lab.db');
  }
  return './data/playlist-lab.db';
}

/**
 * Get or create the database instance
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH || process.env.DATABASE_PATH || getDefaultDbPath();
    dbInstance = initializeDatabase(dbPath);
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export {
  initializeDatabase,
  verifySchema,
  getDatabaseStats,
  cleanupExpiredSessions,
  vacuumDatabase
} from './init';

export { DatabaseService } from './database';

export type {
  User,
  UserServer,
  MatchingSettings,
  MixSettings,
  UserSettings,
  ParsedUserSettings,
  Playlist,
  ScheduleType,
  ScheduleFrequency,
  Schedule,
  MissingTrack,
  ExternalTrack,
  CachedPlaylist,
  ParsedCachedPlaylist,
  Session,
  AdminUser,
  MissingTrackInput,
  ScheduleInput,
  DatabaseStats,
  MissingTrackStat
} from './types';
