/**
 * Property-Based Tests for Admin Features
 * 
 * Tests universal properties of admin functionality including missing tracks aggregation.
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

describe('Admin Features Property Tests', () => {
  describe('Property 24: Admin Missing Tracks Aggregation', () => {
    /**
     * **Validates: Requirements 10.3, 10.4**
     * 
     * For any admin query for missing tracks, the results should include missing tracks
     * from all users, aggregated by (title, artist) with counts showing how many users
     * are missing each track.
     */
    it('should aggregate missing tracks across all users by title and artist', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple users with unique plexUserId
          fc.uniqueArray(
            fc.record({
              plexUserId: fc.string({ minLength: 5, maxLength: 50 }),
              username: fc.string({ minLength: 3, maxLength: 50 }),
              token: fc.string({ minLength: 10, maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 5, selector: (user) => user.plexUserId }
          ),
          // Generate common missing tracks (same title/artist across users)
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (usersData, commonTracks) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create users and playlists
              const users = usersData.map(userData =>
                dbService.createUser(userData.plexUserId, userData.username, userData.token)
              );
              
              // Track which users have which missing tracks
              const trackUserCounts = new Map<string, Set<number>>();
              
              for (const user of users) {
                // Create a playlist for this user
                const playlist = dbService.createPlaylist(
                  user.id,
                  `plex-${Math.random()}`,
                  `Playlist for ${user.plex_username}`,
                  'spotify'
                );
                
                // Randomly select some common tracks to be missing for this user
                const userMissingTracks = commonTracks.filter(() => Math.random() > 0.3);
                
                if (userMissingTracks.length > 0) {
                  // Add missing tracks
                  dbService.addMissingTracks(
                    user.id,
                    playlist.id,
                    userMissingTracks.map((t, index) => ({
                      title: t.title,
                      artist: t.artist,
                      album: t.album,
                      position: index,
                      source: 'spotify',
                    }))
                  );
                  
                  // Track which users have which tracks
                  for (const track of userMissingTracks) {
                    const key = `${track.title}|${track.artist}`;
                    if (!trackUserCounts.has(key)) {
                      trackUserCounts.set(key, new Set());
                    }
                    trackUserCounts.get(key)!.add(user.id);
                  }
                }
              }
              
              // Get aggregated missing track stats
              const stats = dbService.getMissingTrackStats();
              
              // Property: Stats should aggregate by title and artist
              for (const stat of stats) {
                const key = `${stat.track}|${stat.artist}`;
                const expectedCount = trackUserCounts.get(key)?.size || 0;
                
                // The count should match the number of users who have this track missing
                expect(stat.count).toBe(expectedCount);
                expect(stat.count).toBeGreaterThan(0);
              }
              
              // Property: All unique missing tracks should appear in stats
              const statsKeys = new Set(stats.map(s => `${s.track}|${s.artist}`));
              for (const [key, userSet] of trackUserCounts.entries()) {
                if (userSet.size > 0) {
                  expect(statsKeys.has(key)).toBe(true);
                }
              }
              
              // Property: Stats should be ordered by count (most common first)
              for (let i = 1; i < stats.length; i++) {
                expect(stats[i - 1].count).toBeGreaterThanOrEqual(stats[i].count);
              }
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include tracks from all users in aggregation', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple users with unique plexUserId
          fc.uniqueArray(
            fc.record({
              plexUserId: fc.string({ minLength: 5, maxLength: 50 }),
              username: fc.string({ minLength: 3, maxLength: 50 }),
              token: fc.string({ minLength: 10, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 5, selector: (user) => user.plexUserId }
          ),
          // Generate unique tracks per user
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (usersData, tracksPerUser) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              let totalMissingTracks = 0;
              
              for (const userData of usersData) {
                // Create user
                const user = dbService.createUser(
                  userData.plexUserId,
                  userData.username,
                  userData.token
                );
                
                // Create playlist
                const playlist = dbService.createPlaylist(
                  user.id,
                  `plex-${Math.random()}`,
                  `Playlist for ${user.plex_username}`,
                  'spotify'
                );
                
                // Add missing tracks
                if (tracksPerUser.length > 0) {
                  dbService.addMissingTracks(
                    user.id,
                    playlist.id,
                    tracksPerUser.map((t, index) => ({
                      title: t.title,
                      artist: t.artist,
                      album: t.album,
                      position: index,
                      source: 'spotify',
                    }))
                  );
                  totalMissingTracks += tracksPerUser.length;
                }
              }
              
              // Get all missing tracks
              const allMissing = dbService.getAllMissingTracks();
              
              // Property: All missing tracks from all users should be included
              expect(allMissing.length).toBe(totalMissingTracks);
              
              // Property: Each user's tracks should be present
              for (const userData of usersData) {
                const user = dbService.getUserByPlexId(userData.plexUserId);
                if (user) {
                  const userTracks = allMissing.filter(t => t.user_id === user.id);
                  expect(userTracks.length).toBe(tracksPerUser.length);
                }
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
