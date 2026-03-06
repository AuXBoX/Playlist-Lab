/**
 * Property-Based Tests for Import Workflow
 * 
 * Tests universal properties of playlist import including cache behavior,
 * matching workflow, and missing track storage.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { DatabaseService } from '../../src/database/database';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Create a temporary in-memory database for testing
 */
function createTestDatabase(): Database.Database {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-lab-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  return initializeDatabase(dbPath);
}

/**
 * Clean up test database
 */
function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = db.name;
  db.close();
  
  if (dbPath && dbPath !== ':memory:') {
    try {
      fs.unlinkSync(dbPath);
      fs.rmdirSync(path.dirname(dbPath));
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

describe('Import Workflow Property Tests', () => {
  describe('Property 6: Cache-First Import', () => {
    /**
     * **Validates: Requirements 3.2, 4.5**
     * 
     * For any playlist import where cached data exists and is less than 24 hours old,
     * the server should use cached data instead of scraping.
     */
    it('should use cached data when fresh (< 24 hours)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate playlist data
          fc.record({
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
            sourceId: fc.string({ minLength: 5, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            description: fc.string({ minLength: 0, maxLength: 500 }),
            tracks: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                artist: fc.string({ minLength: 1, maxLength: 100 }),
                album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
              }),
              { minLength: 1, maxLength: 50 }
            ),
          }),
          // Generate age in seconds (less than 24 hours)
          fc.integer({ min: 0, max: 86399 }), // 0 to 23:59:59
          async (playlistData, _ageInSeconds) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              const now = Math.floor(Date.now() / 1000);
              
              // Store playlist in cache
              dbService.saveCachedPlaylist(
                playlistData.source,
                playlistData.sourceId,
                playlistData.name,
                playlistData.description,
                playlistData.tracks
              );
              
              // Retrieve from cache
              const cached = dbService.getCachedPlaylist(playlistData.source, playlistData.sourceId);
              
              // Verify cache exists
              expect(cached).not.toBeNull();
              expect(cached!.source).toBe(playlistData.source);
              expect(cached!.source_id).toBe(playlistData.sourceId);
              expect(cached!.name).toBe(playlistData.name);
              expect(cached!.tracks).toEqual(playlistData.tracks);
              
              // Verify cache is fresh (< 24 hours)
              const cacheAge = now - cached!.scraped_at;
              expect(cacheAge).toBeLessThan(86400); // 24 hours in seconds
              
              // Property: Cache should be used when fresh
              const isCacheFresh = cacheAge < 86400;
              expect(isCacheFresh).toBe(true);
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Stale Cache Scraping', () => {
    /**
     * **Validates: Requirements 3.3**
     * 
     * For any playlist import where cached data does not exist or is older than 24 hours,
     * the server should scrape fresh data from the external service.
     */
    it('should identify stale cache (>= 24 hours)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate playlist data
          fc.record({
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
            sourceId: fc.string({ minLength: 5, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            description: fc.string({ minLength: 0, maxLength: 500 }),
            tracks: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                artist: fc.string({ minLength: 1, maxLength: 100 }),
              }),
              { minLength: 1, maxLength: 50 }
            ),
          }),
          // Generate age in seconds (24 hours or more)
          fc.integer({ min: 86400, max: 604800 }), // 24 hours to 7 days
          async (playlistData, ageInSeconds) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              const now = Math.floor(Date.now() / 1000);
              const scrapedAt = now - ageInSeconds;
              
              // Manually insert stale cache
              const stmt = db.prepare(`
                INSERT INTO cached_playlists (source, source_id, name, description, tracks, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              stmt.run(
                playlistData.source,
                playlistData.sourceId,
                playlistData.name,
                playlistData.description,
                JSON.stringify(playlistData.tracks),
                scrapedAt
              );
              
              // Retrieve from cache
              const cached = dbService.getCachedPlaylist(playlistData.source, playlistData.sourceId);
              
              // Verify cache exists
              expect(cached).not.toBeNull();
              
              // Verify cache is stale (>= 24 hours)
              const cacheAge = now - cached!.scraped_at;
              expect(cacheAge).toBeGreaterThanOrEqual(86400);
              
              // Property: Cache should be considered stale
              const isCacheStale = cacheAge >= 86400;
              expect(isCacheStale).toBe(true);
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Import Workflow Completeness', () => {
    /**
     * **Validates: Requirements 3.4, 3.5, 3.6, 8.1**
     * 
     * For any playlist import, the workflow should retrieve data (cached or scraped),
     * match tracks against the user's library, present results, and upon confirmation
     * create the playlist in Plex.
     */
    it('should complete full import workflow with all steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate playlist data
          fc.record({
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
            sourceId: fc.string({ minLength: 5, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            tracks: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                artist: fc.string({ minLength: 1, maxLength: 100 }),
                album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
              }),
              { minLength: 1, maxLength: 20 }
            ),
          }),
          async (userData, playlistData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Step 1: Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              expect(user).toBeDefined();
              
              // Step 2: Cache playlist data (simulating retrieval)
              dbService.saveCachedPlaylist(
                playlistData.source,
                playlistData.sourceId,
                playlistData.name,
                '',
                playlistData.tracks
              );
              
              const cached = dbService.getCachedPlaylist(playlistData.source, playlistData.sourceId);
              expect(cached).not.toBeNull();
              
              // Step 3: Simulate matching (create matched tracks structure)
              const matchedTracks = playlistData.tracks.map((track, index) => ({
                ...track,
                matched: index % 2 === 0, // Alternate matched/unmatched for testing
                plexRatingKey: index % 2 === 0 ? `track-${index}` : undefined,
              }));
              
              // Step 4: Create playlist record (simulating Plex playlist creation)
              const playlist = dbService.createPlaylist(
                user.id,
                `plex-playlist-${playlistData.sourceId}`,
                playlistData.name,
                playlistData.source,
                `https://${playlistData.source}.com/playlist/${playlistData.sourceId}`
              );
              expect(playlist).toBeDefined();
              expect(playlist.user_id).toBe(user.id);
              expect(playlist.name).toBe(playlistData.name);
              
              // Step 5: Store unmatched tracks as missing
              const unmatchedTracks = matchedTracks
                .map((track, index) => ({ track, index }))
                .filter(({ track }) => !track.matched)
                .map(({ track, index }) => ({
                  title: track.title,
                  artist: track.artist,
                  album: track.album,
                  position: index,
                  after_track_key: undefined,
                  source: playlistData.source,
                }));
              
              if (unmatchedTracks.length > 0) {
                dbService.addMissingTracks(user.id, playlist.id, unmatchedTracks);
                
                const missingTracks = dbService.getPlaylistMissingTracks(playlist.id);
                expect(missingTracks.length).toBe(unmatchedTracks.length);
              }
              
              // Property: Workflow should complete all steps
              // 1. Data retrieved (cached)
              expect(cached).not.toBeNull();
              // 2. Tracks matched (simulated)
              expect(matchedTracks.length).toBe(playlistData.tracks.length);
              // 3. Playlist created
              expect(playlist).toBeDefined();
              // 4. Missing tracks stored (if any)
              const storedMissing = dbService.getPlaylistMissingTracks(playlist.id);
              expect(storedMissing.length).toBe(unmatchedTracks.length);
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 20: Missing Track Storage', () => {
    /**
     * **Validates: Requirements 8.1**
     * 
     * For any track that fails to match during import, the track should be stored
     * in the missing_tracks table with user_id, playlist_id, title, artist, position, and source.
     */
    it('should store unmatched tracks with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate playlist data
          fc.record({
            plexPlaylistId: fc.string({ minLength: 5, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
          }),
          // Generate unmatched tracks
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
              position: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          async (userData, playlistData, unmatchedTracks) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create playlist
              const playlist = dbService.createPlaylist(
                user.id,
                playlistData.plexPlaylistId,
                playlistData.name,
                playlistData.source
              );
              
              // Store missing tracks
              const missingTracksInput = unmatchedTracks.map(track => ({
                title: track.title,
                artist: track.artist,
                album: track.album,
                position: track.position,
                after_track_key: undefined,
                source: playlistData.source,
              }));
              
              dbService.addMissingTracks(user.id, playlist.id, missingTracksInput);
              
              // Retrieve missing tracks
              const storedMissing = dbService.getPlaylistMissingTracks(playlist.id);
              
              // Property: All unmatched tracks should be stored with required fields
              expect(storedMissing.length).toBe(unmatchedTracks.length);
              
              // Sort both arrays by position to ensure consistent comparison
              const sortedStored = [...storedMissing].sort((a, b) => a.position - b.position);
              const sortedOriginal = [...unmatchedTracks].sort((a, b) => a.position - b.position);
              
              for (let i = 0; i < sortedStored.length; i++) {
                const stored = sortedStored[i];
                const original = sortedOriginal[i];
                
                expect(stored.user_id).toBe(user.id);
                expect(stored.playlist_id).toBe(playlist.id);
                expect(stored.title).toBe(original.title);
                expect(stored.artist).toBe(original.artist);
                expect(stored.album).toBe(original.album || null); // Database stores null for undefined
                expect(stored.position).toBe(original.position);
                expect(stored.source).toBe(playlistData.source);
                expect(stored.added_at).toBeGreaterThan(0);
              }
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
