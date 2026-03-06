/**
 * Property-Based Tests for Database Schema
 * 
 * Tests universal properties of the database schema, particularly
 * foreign key cascade behavior and referential integrity.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
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
  
  // Clean up the database file and directory
  if (dbPath && dbPath !== ':memory:') {
    try {
      fs.unlinkSync(dbPath);
      fs.rmdirSync(path.dirname(dbPath));
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

describe('Database Schema Property Tests', () => {
  describe('Property 25: Foreign Key Cascade', () => {
    /**
     * **Validates: Requirements 11.4**
     * 
     * For any user deletion, all related records (playlists, schedules, 
     * missing_tracks, settings) should be automatically deleted due to 
     * foreign key constraints.
     */
    it('should cascade delete all related records when a user is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 10, maxLength: 100 }),
            plexThumb: fc.option(fc.webUrl(), { nil: undefined }),
          }),
          // Generate arbitrary playlist data
          fc.array(
            fc.record({
              plexPlaylistId: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
              sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          // Generate arbitrary schedule data
          fc.array(
            fc.record({
              scheduleType: fc.constantFrom('playlist_refresh', 'mix_generation'),
              frequency: fc.constantFrom('daily', 'weekly', 'fortnightly', 'monthly'),
              startDate: fc.date().map(d => d.toISOString().split('T')[0]),
              config: fc.option(fc.jsonValue(), { nil: undefined }),
            }),
            { minLength: 0, maxLength: 3 }
          ),
          // Generate arbitrary missing tracks data
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
              position: fc.integer({ min: 0, max: 1000 }),
              source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          // Generate arbitrary settings data
          fc.record({
            country: fc.string({ minLength: 2, maxLength: 10 }),
            matchingSettings: fc.jsonValue(),
            mixSettings: fc.jsonValue(),
          }),
          async (userData, playlistsData, schedulesData, missingTracksData, settingsData) => {
            const db = createTestDatabase();
            
            try {
              const now = Date.now();
              
              // Insert user
              const insertUser = db.prepare(`
                INSERT INTO users (plex_user_id, plex_username, plex_token, plex_thumb, created_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              
              const userResult = insertUser.run(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken,
                userData.plexThumb,
                now,
                now
              );
              
              const userId = userResult.lastInsertRowid as number;
              
              // Insert user settings
              const insertSettings = db.prepare(`
                INSERT INTO user_settings (user_id, country, matching_settings, mix_settings)
                VALUES (?, ?, ?, ?)
              `);
              
              insertSettings.run(
                userId,
                settingsData.country,
                JSON.stringify(settingsData.matchingSettings),
                JSON.stringify(settingsData.mixSettings)
              );
              
              // Insert playlists
              const insertPlaylist = db.prepare(`
                INSERT INTO playlists (user_id, plex_playlist_id, name, source, source_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `);
              
              const playlistIds: number[] = [];
              for (const playlist of playlistsData) {
                const result = insertPlaylist.run(
                  userId,
                  playlist.plexPlaylistId,
                  playlist.name,
                  playlist.source,
                  playlist.sourceUrl,
                  now,
                  now
                );
                playlistIds.push(result.lastInsertRowid as number);
              }
              
              // Insert schedules (some linked to playlists, some not)
              const insertSchedule = db.prepare(`
                INSERT INTO schedules (user_id, playlist_id, schedule_type, frequency, start_date, config)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              
              for (let i = 0; i < schedulesData.length; i++) {
                const schedule = schedulesData[i];
                const playlistId = playlistIds.length > 0 && i % 2 === 0 
                  ? playlistIds[i % playlistIds.length] 
                  : null;
                
                insertSchedule.run(
                  userId,
                  playlistId,
                  schedule.scheduleType,
                  schedule.frequency,
                  schedule.startDate,
                  schedule.config ? JSON.stringify(schedule.config) : null
                );
              }
              
              // Insert missing tracks (linked to playlists if available)
              if (playlistIds.length > 0) {
                const insertMissingTrack = db.prepare(`
                  INSERT INTO missing_tracks (user_id, playlist_id, title, artist, album, position, added_at, source)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (let i = 0; i < missingTracksData.length; i++) {
                  const track = missingTracksData[i];
                  const playlistId = playlistIds[i % playlistIds.length];
                  
                  insertMissingTrack.run(
                    userId,
                    playlistId,
                    track.title,
                    track.artist,
                    track.album,
                    track.position,
                    now,
                    track.source
                  );
                }
              }
              
              // Verify all records exist before deletion
              const countBefore = {
                users: db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get(userId) as { count: number },
                settings: db.prepare('SELECT COUNT(*) as count FROM user_settings WHERE user_id = ?').get(userId) as { count: number },
                playlists: db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(userId) as { count: number },
                schedules: db.prepare('SELECT COUNT(*) as count FROM schedules WHERE user_id = ?').get(userId) as { count: number },
                missingTracks: db.prepare('SELECT COUNT(*) as count FROM missing_tracks WHERE user_id = ?').get(userId) as { count: number },
              };
              
              expect(countBefore.users.count).toBe(1);
              expect(countBefore.settings.count).toBe(1);
              expect(countBefore.playlists.count).toBe(playlistsData.length);
              expect(countBefore.schedules.count).toBe(schedulesData.length);
              expect(countBefore.missingTracks.count).toBe(
                playlistIds.length > 0 ? missingTracksData.length : 0
              );
              
              // Delete the user
              const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
              deleteUser.run(userId);
              
              // Verify all related records are deleted (CASCADE)
              const countAfter = {
                users: db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get(userId) as { count: number },
                settings: db.prepare('SELECT COUNT(*) as count FROM user_settings WHERE user_id = ?').get(userId) as { count: number },
                playlists: db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(userId) as { count: number },
                schedules: db.prepare('SELECT COUNT(*) as count FROM schedules WHERE user_id = ?').get(userId) as { count: number },
                missingTracks: db.prepare('SELECT COUNT(*) as count FROM missing_tracks WHERE user_id = ?').get(userId) as { count: number },
              };
              
              // All counts should be 0 after cascade delete
              expect(countAfter.users.count).toBe(0);
              expect(countAfter.settings.count).toBe(0);
              expect(countAfter.playlists.count).toBe(0);
              expect(countAfter.schedules.count).toBe(0);
              expect(countAfter.missingTracks.count).toBe(0);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cascade delete schedules and missing tracks when a playlist is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          // Generate playlist data
          fc.record({
            plexPlaylistId: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
          }),
          // Generate number of schedules and missing tracks
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 10 }),
          async (userData, playlistData, numSchedules, numMissingTracks) => {
            const db = createTestDatabase();
            
            try {
              const now = Date.now();
              
              // Insert user
              const insertUser = db.prepare(`
                INSERT INTO users (plex_user_id, plex_username, plex_token, created_at, last_login)
                VALUES (?, ?, ?, ?, ?)
              `);
              
              const userResult = insertUser.run(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken,
                now,
                now
              );
              
              const userId = userResult.lastInsertRowid as number;
              
              // Insert playlist
              const insertPlaylist = db.prepare(`
                INSERT INTO playlists (user_id, plex_playlist_id, name, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              
              const playlistResult = insertPlaylist.run(
                userId,
                playlistData.plexPlaylistId,
                playlistData.name,
                playlistData.source,
                now,
                now
              );
              
              const playlistId = playlistResult.lastInsertRowid as number;
              
              // Insert schedules linked to this playlist
              const insertSchedule = db.prepare(`
                INSERT INTO schedules (user_id, playlist_id, schedule_type, frequency, start_date)
                VALUES (?, ?, 'playlist_refresh', 'daily', ?)
              `);
              
              for (let i = 0; i < numSchedules; i++) {
                insertSchedule.run(userId, playlistId, '2024-01-01');
              }
              
              // Insert missing tracks linked to this playlist
              const insertMissingTrack = db.prepare(`
                INSERT INTO missing_tracks (user_id, playlist_id, title, artist, position, added_at, source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `);
              
              for (let i = 0; i < numMissingTracks; i++) {
                insertMissingTrack.run(
                  userId,
                  playlistId,
                  `Track ${i}`,
                  `Artist ${i}`,
                  i,
                  now,
                  'spotify'
                );
              }
              
              // Verify records exist before deletion
              const countBefore = {
                playlists: db.prepare('SELECT COUNT(*) as count FROM playlists WHERE id = ?').get(playlistId) as { count: number },
                schedules: db.prepare('SELECT COUNT(*) as count FROM schedules WHERE playlist_id = ?').get(playlistId) as { count: number },
                missingTracks: db.prepare('SELECT COUNT(*) as count FROM missing_tracks WHERE playlist_id = ?').get(playlistId) as { count: number },
              };
              
              expect(countBefore.playlists.count).toBe(1);
              expect(countBefore.schedules.count).toBe(numSchedules);
              expect(countBefore.missingTracks.count).toBe(numMissingTracks);
              
              // Delete the playlist
              const deletePlaylist = db.prepare('DELETE FROM playlists WHERE id = ?');
              deletePlaylist.run(playlistId);
              
              // Verify all related records are deleted (CASCADE)
              const countAfter = {
                playlists: db.prepare('SELECT COUNT(*) as count FROM playlists WHERE id = ?').get(playlistId) as { count: number },
                schedules: db.prepare('SELECT COUNT(*) as count FROM schedules WHERE playlist_id = ?').get(playlistId) as { count: number },
                missingTracks: db.prepare('SELECT COUNT(*) as count FROM missing_tracks WHERE playlist_id = ?').get(playlistId) as { count: number },
              };
              
              expect(countAfter.playlists.count).toBe(0);
              expect(countAfter.schedules.count).toBe(0);
              expect(countAfter.missingTracks.count).toBe(0);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain referential integrity across multiple users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple users
          fc.array(
            fc.record({
              plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
              plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
              plexToken: fc.string({ minLength: 10, maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          // Generate playlists per user
          fc.integer({ min: 1, max: 3 }),
          async (usersData, playlistsPerUser) => {
            const db = createTestDatabase();
            
            try {
              const now = Date.now();
              const userIds: number[] = [];
              
              // Insert all users
              const insertUser = db.prepare(`
                INSERT INTO users (plex_user_id, plex_username, plex_token, created_at, last_login)
                VALUES (?, ?, ?, ?, ?)
              `);
              
              for (const userData of usersData) {
                const result = insertUser.run(
                  userData.plexUserId,
                  userData.plexUsername,
                  userData.plexToken,
                  now,
                  now
                );
                userIds.push(result.lastInsertRowid as number);
              }
              
              // Insert playlists for each user
              const insertPlaylist = db.prepare(`
                INSERT INTO playlists (user_id, plex_playlist_id, name, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              
              for (const userId of userIds) {
                for (let i = 0; i < playlistsPerUser; i++) {
                  insertPlaylist.run(
                    userId,
                    `playlist-${userId}-${i}`,
                    `Playlist ${i}`,
                    'spotify',
                    now,
                    now
                  );
                }
              }
              
              // Count total records before deletion
              const totalBefore = {
                users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
                playlists: db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number },
              };
              
              expect(totalBefore.users.count).toBe(usersData.length);
              expect(totalBefore.playlists.count).toBe(usersData.length * playlistsPerUser);
              
              // Delete the first user
              const firstUserId = userIds[0];
              const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
              deleteUser.run(firstUserId);
              
              // Verify only the first user's data is deleted
              const totalAfter = {
                users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
                playlists: db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number },
                firstUserPlaylists: db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(firstUserId) as { count: number },
              };
              
              expect(totalAfter.users.count).toBe(usersData.length - 1);
              expect(totalAfter.playlists.count).toBe((usersData.length - 1) * playlistsPerUser);
              expect(totalAfter.firstUserPlaylists.count).toBe(0);
              
              // Verify other users' data is intact
              for (let i = 1; i < userIds.length; i++) {
                const userId = userIds[i];
                const userPlaylists = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(userId) as { count: number };
                expect(userPlaylists.count).toBe(playlistsPerUser);
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
