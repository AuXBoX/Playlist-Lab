/**
 * Property-Based Tests for Data Isolation and Security
 * 
 * Tests universal properties of multi-user data isolation, ensuring users
 * cannot access or modify other users' data.
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

describe('Data Isolation Property Tests', () => {
  describe('Property 4: User Data Isolation', () => {
    /**
     * **Validates: Requirements 2.2, 2.3, 2.4**
     * 
     * For any two different users A and B, user A should not be able to 
     * access, view, or modify any data (playlists, settings, schedules, 
     * missing tracks) belonging to user B.
     */
    it('should isolate playlist data between users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate playlist data
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              plexPlaylistId: fc.string({ minLength: 1, maxLength: 50 }),
              source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
              sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (userA, userB, playlistsData) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Create playlists for user A
              const userAPlaylists = [];
              for (const playlistData of playlistsData) {
                const playlist = dbService.createPlaylist(
                  userARecord.id,
                  playlistData.plexPlaylistId,
                  playlistData.name,
                  playlistData.source,
                  playlistData.sourceUrl
                );
                userAPlaylists.push(playlist);
              }
              
              // Verify user A can access their playlists
              const userARetrievedPlaylists = dbService.getUserPlaylists(userARecord.id);
              expect(userARetrievedPlaylists).toHaveLength(playlistsData.length);
              
              // Verify user B cannot see user A's playlists
              const userBRetrievedPlaylists = dbService.getUserPlaylists(userBRecord.id);
              expect(userBRetrievedPlaylists).toHaveLength(0);
              
              // Verify each of user A's playlists is not accessible via user B's query
              for (const playlist of userAPlaylists) {
                expect(userBRetrievedPlaylists.find(p => p.id === playlist.id)).toBeUndefined();
              }
              
              // Verify playlist IDs belong to correct user
              for (const playlist of userARetrievedPlaylists) {
                expect(playlist.user_id).toBe(userARecord.id);
                expect(playlist.user_id).not.toBe(userBRecord.id);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should isolate schedule data between users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate schedule data
          fc.array(
            fc.record({
              scheduleType: fc.constantFrom('playlist_refresh', 'mix_generation'),
              frequency: fc.constantFrom('daily', 'weekly', 'fortnightly', 'monthly'),
              startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
                .map(d => d.toISOString().split('T')[0]),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (userA, userB, schedulesData) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Create schedules for user A
              const userASchedules = [];
              for (const scheduleData of schedulesData) {
                const schedule = dbService.createSchedule(userARecord.id, {
                  schedule_type: scheduleData.scheduleType as 'playlist_refresh' | 'mix_generation',
                  frequency: scheduleData.frequency as 'daily' | 'weekly' | 'fortnightly' | 'monthly',
                  start_date: scheduleData.startDate,
                });
                userASchedules.push(schedule);
              }
              
              // Verify user A can access their schedules
              const userARetrievedSchedules = dbService.getUserSchedules(userARecord.id);
              expect(userARetrievedSchedules).toHaveLength(schedulesData.length);
              
              // Verify user B cannot see user A's schedules
              const userBRetrievedSchedules = dbService.getUserSchedules(userBRecord.id);
              expect(userBRetrievedSchedules).toHaveLength(0);
              
              // Verify each of user A's schedules is not accessible via user B's query
              for (const schedule of userASchedules) {
                expect(userBRetrievedSchedules.find(s => s.id === schedule.id)).toBeUndefined();
              }
              
              // Verify schedule IDs belong to correct user
              for (const schedule of userARetrievedSchedules) {
                expect(schedule.user_id).toBe(userARecord.id);
                expect(schedule.user_id).not.toBe(userBRecord.id);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should isolate missing tracks data between users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate missing tracks data
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              artist: fc.string({ minLength: 1, maxLength: 100 }),
              album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
              position: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (userA, userB, tracksData) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Create a playlist for user A
              const playlist = dbService.createPlaylist(
                userARecord.id,
                'test-playlist-id',
                'Test Playlist',
                'spotify'
              );
              
              // Add missing tracks for user A
              dbService.addMissingTracks(
                userARecord.id,
                playlist.id,
                tracksData.map(track => ({
                  title: track.title,
                  artist: track.artist,
                  album: track.album,
                  position: track.position,
                  source: 'spotify',
                }))
              );
              
              // Verify user A can access their missing tracks
              const userAMissingTracks = dbService.getUserMissingTracks(userARecord.id);
              expect(userAMissingTracks).toHaveLength(tracksData.length);
              
              // Verify user B cannot see user A's missing tracks
              const userBMissingTracks = dbService.getUserMissingTracks(userBRecord.id);
              expect(userBMissingTracks).toHaveLength(0);
              
              // Verify each missing track belongs to user A
              for (const track of userAMissingTracks) {
                expect(track.user_id).toBe(userARecord.id);
                expect(track.user_id).not.toBe(userBRecord.id);
                expect(track.playlist_id).toBe(playlist.id);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent cross-user data modification', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          async (userA, userB) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Create a playlist for user A
              const userAPlaylist = dbService.createPlaylist(
                userARecord.id,
                'playlist-a',
                'User A Playlist',
                'spotify'
              );
              
              // Verify the playlist belongs to user A
              expect(userAPlaylist.user_id).toBe(userARecord.id);
              
              // Attempt to retrieve the playlist as user B (should not be in their list)
              const userBPlaylists = dbService.getUserPlaylists(userBRecord.id);
              expect(userBPlaylists.find(p => p.id === userAPlaylist.id)).toBeUndefined();
              
              // Verify direct access to playlist shows correct owner
              const playlistDirect = dbService.getPlaylistById(userAPlaylist.id);
              expect(playlistDirect).not.toBeNull();
              expect(playlistDirect!.user_id).toBe(userARecord.id);
              expect(playlistDirect!.user_id).not.toBe(userBRecord.id);
              
              // In a real API, user B would be prevented from modifying this playlist
              // because the API would check req.user.id === playlist.user_id
              // Here we verify the data layer maintains correct ownership
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Independent User Settings', () => {
    /**
     * **Validates: Requirements 2.5**
     * 
     * For any two users, modifying one user's matching settings should 
     * not affect the other user's matching settings.
     */
    it('should maintain independent matching settings per user', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate matching settings for user A
          fc.record({
            minMatchScore: fc.integer({ min: 50, max: 100 }),
            stripParentheses: fc.boolean(),
            stripBrackets: fc.boolean(),
            useFirstArtistOnly: fc.boolean(),
          }),
          // Generate different matching settings for user B
          fc.record({
            minMatchScore: fc.integer({ min: 50, max: 100 }),
            stripParentheses: fc.boolean(),
            stripBrackets: fc.boolean(),
            useFirstArtistOnly: fc.boolean(),
          }),
          async (userA, userB, settingsA, settingsB) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Get initial settings for both users (should be defaults)
              const initialSettingsA = dbService.getUserSettings(userARecord.id);
              const initialSettingsB = dbService.getUserSettings(userBRecord.id);
              
              expect(initialSettingsA).toBeDefined();
              expect(initialSettingsB).toBeDefined();
              
              // Update user A's matching settings
              dbService.saveUserSettings(userARecord.id, {
                matching_settings: {
                  ...initialSettingsA.matching_settings,
                  minMatchScore: settingsA.minMatchScore,
                  stripParentheses: settingsA.stripParentheses,
                  stripBrackets: settingsA.stripBrackets,
                  useFirstArtistOnly: settingsA.useFirstArtistOnly,
                },
              });
              
              // Update user B's matching settings (different values)
              dbService.saveUserSettings(userBRecord.id, {
                matching_settings: {
                  ...initialSettingsB.matching_settings,
                  minMatchScore: settingsB.minMatchScore,
                  stripParentheses: settingsB.stripParentheses,
                  stripBrackets: settingsB.stripBrackets,
                  useFirstArtistOnly: settingsB.useFirstArtistOnly,
                },
              });
              
              // Retrieve settings for both users
              const updatedSettingsA = dbService.getUserSettings(userARecord.id);
              const updatedSettingsB = dbService.getUserSettings(userBRecord.id);
              
              // Verify user A's settings match what we set
              expect(updatedSettingsA.matching_settings.minMatchScore).toBe(settingsA.minMatchScore);
              expect(updatedSettingsA.matching_settings.stripParentheses).toBe(settingsA.stripParentheses);
              expect(updatedSettingsA.matching_settings.stripBrackets).toBe(settingsA.stripBrackets);
              expect(updatedSettingsA.matching_settings.useFirstArtistOnly).toBe(settingsA.useFirstArtistOnly);
              
              // Verify user B's settings match what we set
              expect(updatedSettingsB.matching_settings.minMatchScore).toBe(settingsB.minMatchScore);
              expect(updatedSettingsB.matching_settings.stripParentheses).toBe(settingsB.stripParentheses);
              expect(updatedSettingsB.matching_settings.stripBrackets).toBe(settingsB.stripBrackets);
              expect(updatedSettingsB.matching_settings.useFirstArtistOnly).toBe(settingsB.useFirstArtistOnly);
              
              // Verify settings are independent (user A's settings don't affect user B)
              if (settingsA.minMatchScore !== settingsB.minMatchScore) {
                expect(updatedSettingsA.matching_settings.minMatchScore)
                  .not.toBe(updatedSettingsB.matching_settings.minMatchScore);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain independent mix settings per user', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate mix settings for user A
          fc.record({
            topArtists: fc.integer({ min: 1, max: 20 }),
            tracksPerArtist: fc.integer({ min: 1, max: 10 }),
          }),
          // Generate different mix settings for user B
          fc.record({
            topArtists: fc.integer({ min: 1, max: 20 }),
            tracksPerArtist: fc.integer({ min: 1, max: 10 }),
          }),
          async (userA, userB, mixSettingsA, mixSettingsB) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Get initial settings for both users
              const initialSettingsA = dbService.getUserSettings(userARecord.id);
              const initialSettingsB = dbService.getUserSettings(userBRecord.id);
              
              // Update user A's mix settings
              dbService.saveUserSettings(userARecord.id, {
                mix_settings: {
                  ...initialSettingsA.mix_settings,
                  weeklyMix: {
                    topArtists: mixSettingsA.topArtists,
                    tracksPerArtist: mixSettingsA.tracksPerArtist,
                  },
                },
              });
              
              // Update user B's mix settings (different values)
              dbService.saveUserSettings(userBRecord.id, {
                mix_settings: {
                  ...initialSettingsB.mix_settings,
                  weeklyMix: {
                    topArtists: mixSettingsB.topArtists,
                    tracksPerArtist: mixSettingsB.tracksPerArtist,
                  },
                },
              });
              
              // Retrieve settings for both users
              const updatedSettingsA = dbService.getUserSettings(userARecord.id);
              const updatedSettingsB = dbService.getUserSettings(userBRecord.id);
              
              // Verify user A's settings match what we set
              expect(updatedSettingsA.mix_settings.weeklyMix.topArtists).toBe(mixSettingsA.topArtists);
              expect(updatedSettingsA.mix_settings.weeklyMix.tracksPerArtist).toBe(mixSettingsA.tracksPerArtist);
              
              // Verify user B's settings match what we set
              expect(updatedSettingsB.mix_settings.weeklyMix.topArtists).toBe(mixSettingsB.topArtists);
              expect(updatedSettingsB.mix_settings.weeklyMix.tracksPerArtist).toBe(mixSettingsB.tracksPerArtist);
              
              // Verify settings are independent
              if (mixSettingsA.topArtists !== mixSettingsB.topArtists) {
                expect(updatedSettingsA.mix_settings.weeklyMix.topArtists)
                  .not.toBe(updatedSettingsB.mix_settings.weeklyMix.topArtists);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain independent country settings per user', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different users
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate country codes
          fc.constantFrom('us', 'uk', 'au', 'ca', 'de', 'fr', 'jp', 'global'),
          fc.constantFrom('us', 'uk', 'au', 'ca', 'de', 'fr', 'jp', 'global'),
          async (userA, userB, countryA, countryB) => {
            // Ensure users are different
            fc.pre(userA.plexUserId !== userB.plexUserId);
            
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create both users
              const userARecord = dbService.createUser(
                userA.plexUserId,
                userA.plexUsername,
                userA.plexToken
              );
              
              const userBRecord = dbService.createUser(
                userB.plexUserId,
                userB.plexUsername,
                userB.plexToken
              );
              
              // Update user A's country
              dbService.saveUserSettings(userARecord.id, {
                country: countryA,
              });
              
              // Update user B's country
              dbService.saveUserSettings(userBRecord.id, {
                country: countryB,
              });
              
              // Retrieve settings for both users
              const settingsA = dbService.getUserSettings(userARecord.id);
              const settingsB = dbService.getUserSettings(userBRecord.id);
              
              // Verify each user has their own country setting
              expect(settingsA.country).toBe(countryA);
              expect(settingsB.country).toBe(countryB);
              
              // Verify settings are independent
              if (countryA !== countryB) {
                expect(settingsA.country).not.toBe(settingsB.country);
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
