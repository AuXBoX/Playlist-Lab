/**
 * Cache Cleanup Job
 * 
 * Removes old cached playlists and vacuums the database to reclaim space.
 * Runs weekly to keep the cache fresh and database optimized.
 */

import { DatabaseService } from '../database/database';
import { logger } from '../utils/logger';

const CACHE_MAX_AGE_DAYS = 7;

/**
 * Run cache cleanup job
 */
export async function runCacheCleanupJob(db: DatabaseService): Promise<void> {
  logger.info('Starting cache cleanup job');

  try {
    // Delete old cache entries (older than 7 days)
    const deletedCount = db.deleteOldCache(CACHE_MAX_AGE_DAYS);
    
    logger.info(`Deleted ${deletedCount} stale cache entries`);

    // Note: Database vacuum is handled separately by the database maintenance routine
    // SQLite in WAL mode doesn't require frequent vacuuming

    logger.info('Cache cleanup job completed', {
      deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Cache cleanup job failed', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
