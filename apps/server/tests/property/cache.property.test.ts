/**
 * Property-Based Tests for Cache Management
 * 
 * Tests correctness properties related to playlist caching:
 * - Property 9: Cache Timestamp Storage
 * - Property 10: Cache Staleness
 * - Property 38: Cached Playlist Reuse
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../src/database/database';
import fs from 'fs';
import path from 'path';

describe('Cache Management Property Tests', () => {
  let db: Database.Database;
  let dbService: DatabaseService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    
    dbService = new DatabaseService(db);
  });

  afterEach(() => {
    db.close();
  });

  /**
   * Property 9: Cache Timestamp Storage
   * 
   * For any scraped playlist data, storing it in the cache should include 
   * a timestamp that can be used to determine freshness
   * 
   * Validates: Requirements 4.3
   */
  test('Property 9: Cache Timestamp Storage - cached playlists include timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal', 'youtube', 'amazon', 'qobuz'),
          sourceId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ maxLength: 500 }),
          tracks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
        }),
        async (playlistData) => {
          // Record time before saving
          const beforeSave = Math.floor(Date.now() / 1000);
          
          // Save playlist to cache
          dbService.saveCachedPlaylist(
            playlistData.source,
            playlistData.sourceId,
            playlistData.name,
            playlistData.description,
            playlistData.tracks
          );
          
          // Record time after saving
          const afterSave = Math.floor(Date.now() / 1000);
          
          // Retrieve from cache
          const cached = dbService.getCachedPlaylist(playlistData.source, playlistData.sourceId);
          
          // Verify cache exists and has timestamp
          expect(cached).not.toBeNull();
          expect(cached!.scraped_at).toBeDefined();
          expect(typeof cached!.scraped_at).toBe('number');
          
          // Verify timestamp is within reasonable range (between before and after save)
          expect(cached!.scraped_at).toBeGreaterThanOrEqual(beforeSave);
          expect(cached!.scraped_at).toBeLessThanOrEqual(afterSave);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Cache Staleness
   * 
   * For any cached playlist, if the current time minus the scraped timestamp 
   * exceeds 24 hours, the cache should be considered stale
   * 
   * Validates: Requirements 4.4
   */
  test('Property 10: Cache Staleness - cache older than 24 hours is stale', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
          sourceId: fc.uuid(), // Use UUID to ensure uniqueness
          name: fc.string({ minLength: 1, maxLength: 100 }),
          tracks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          hoursOld: fc.integer({ min: 0, max: 72 }), // 0 to 72 hours old
        }),
        async (data) => {
          // Calculate timestamp for the specified age
          const now = Math.floor(Date.now() / 1000);
          const scrapedAt = now - (data.hoursOld * 3600);
          
          // Insert cache entry with specific timestamp using saveCachedPlaylist
          // (which handles INSERT OR REPLACE)
          db.prepare(`
            INSERT OR REPLACE INTO cached_playlists (source, source_id, name, description, tracks, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            data.source,
            data.sourceId,
            data.name,
            '',
            JSON.stringify(data.tracks),
            scrapedAt
          );
          
          // Retrieve from cache
          const cached = dbService.getCachedPlaylist(data.source, data.sourceId);
          expect(cached).not.toBeNull();
          
          // Calculate age in hours
          const ageInHours = (now - cached!.scraped_at) / 3600;
          
          // Check staleness using getStaleCache
          const staleCache = dbService.getStaleCache(24);
          const isInStaleList = staleCache.some(
            c => c.source === data.source && c.source_id === data.sourceId
          );
          
          // Verify: cache older than 24 hours should be in stale list
          if (ageInHours > 24) {
            expect(isInStaleList).toBe(true);
          } else {
            expect(isInStaleList).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 38: Cached Playlist Reuse
   * 
   * For any cached playlist, if multiple users import it within the cache 
   * validity period, the server should serve the same cached data to all 
   * users without re-scraping
   * 
   * Validates: Requirements 18.2
   */
  test('Property 38: Cached Playlist Reuse - multiple users get same cached data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          source: fc.constantFrom('spotify', 'deezer', 'apple'),
          sourceId: fc.string({ minLength: 1, maxLength: 50 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          tracks: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          userCount: fc.integer({ min: 2, max: 10 }),
        }),
        async (data) => {
          // Save playlist to cache once
          dbService.saveCachedPlaylist(
            data.source,
            data.sourceId,
            data.name,
            'Test playlist',
            data.tracks
          );
          
          // Get the cached playlist's timestamp
          const firstRetrieval = dbService.getCachedPlaylist(data.source, data.sourceId);
          expect(firstRetrieval).not.toBeNull();
          const originalTimestamp = firstRetrieval!.scraped_at;
          const originalTrackCount = firstRetrieval!.tracks.length;
          
          // Simulate multiple users retrieving the same cached playlist
          const retrievals = [];
          for (let i = 0; i < data.userCount; i++) {
            const cached = dbService.getCachedPlaylist(data.source, data.sourceId);
            retrievals.push(cached);
          }
          
          // Verify all retrievals are non-null
          expect(retrievals.every(r => r !== null)).toBe(true);
          
          // Verify all retrievals have the same timestamp (no re-scraping occurred)
          expect(retrievals.every(r => r!.scraped_at === originalTimestamp)).toBe(true);
          
          // Verify all retrievals have the same track count
          expect(retrievals.every(r => r!.tracks.length === originalTrackCount)).toBe(true);
          
          // Verify all retrievals have the same name
          expect(retrievals.every(r => r!.name === data.name)).toBe(true);
          
          // Verify the cache was only written once (by checking there's only one entry)
          const allCached = db.prepare(
            'SELECT COUNT(*) as count FROM cached_playlists WHERE source = ? AND source_id = ?'
          ).get(data.source, data.sourceId) as { count: number };
          
          expect(allCached.count).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
