/**
 * Property-Based Tests for Missing Tracks
 * 
 * Tests universal properties of missing track storage, grouping, and retry logic.
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

describe('Missing Tracks Property Tests', () => {
  describe('Property 21: Missing Tracks Grouping', () => {
    /**
     * **Validates: Requirements 8.2**
     * 
     * For any user's missing tracks query, the results should be grouped by playlist_id.
     */
    it('should group missing tracks by playlist_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 5, maxLength: 50 }),
            username: fc.string({ minLength: 3, maxLength: 50 }),
            token: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          // Generate multiple playlists with missing tracks
          fc.array(
            fc.record({
              playlistName: fc.string({ minLength: 1, maxLength: 100 }),
              source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
              missingTracks: fc.array(
                fc.record({
                  title: fc.string({ minLength: 1, maxLength: 100 }),
                  artist: fc.string({ minLength: 1, maxLength: 100 }),
                  album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
                  position: fc.integer({ min: 0, max: 1000 }),
                }),
                { minLength: 1, maxLength: 20 }
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (userData, playlistsData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.username,
                userData.token
              );
              
              // Create playlists and add missing tracks
              const playlistIds: number[] = [];
              for (const playlistData of playlistsData) {
                const playlist = dbService.createPlaylist(
                  user.id,
                  `plex-${Math.random()}`,
                  playlistData.playlistName,
                  playlistData.source
                );
                playlistIds.push(playlist.id);
                
                // Add missing tracks
                dbService.addMissingTracks(
                  user.id,
                  playlist.id,
                  playlistData.missingTracks.map(t => ({
                    title: t.title,
                    artist: t.artist,
                    album: t.album,
                    position: t.position,
                    source: playlistData.source,
                  }))
                );
              }
              
              // Get all missing tracks
              const allMissing = dbService.getUserMissingTracks(user.id);
              
              // Property: All missing tracks should belong to one of the created playlists
              for (const track of allMissing) {
                expect(playlistIds).toContain(track.playlist_id);
              }
              
              // Property: Group by playlist_id should match the number of playlists with missing tracks
              const groupedByPlaylist = new Map<number, typeof allMissing>();
              for (const track of allMissing) {
                if (!groupedByPlaylist.has(track.playlist_id)) {
                  groupedByPlaylist.set(track.playlist_id, []);
                }
                groupedByPlaylist.get(track.playlist_id)!.push(track);
              }
              
              expect(groupedByPlaylist.size).toBe(playlistsData.length);
              
              // Property: Each group should contain the correct number of tracks
              for (let i = 0; i < playlistsData.length; i++) {
                const playlistId = playlistIds[i];
                const expectedCount = playlistsData[i].missingTracks.length;
                const actualCount = groupedByPlaylist.get(playlistId)?.length || 0;
                expect(actualCount).toBe(expectedCount);
              }
              
              // Property: All tracks in a group should have the same playlist_id
              for (const [playlistId, tracks] of groupedByPlaylist.entries()) {
                for (const track of tracks) {
                  expect(track.playlist_id).toBe(playlistId);
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

  describe('Property 22: Missing Track Retry and Insertion', () => {
    /**
     * **Validates: Requirements 8.3, 8.5**
     * 
     * For any missing track that successfully matches on retry, the track should be
     * inserted at its original position in the playlist and removed from the missing_tracks table.
     */
    it('should remove successfully matched tracks from missing_tracks table', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 5, maxLength: 50 }),
            username: fc.string({ minLength: 3, maxLength: 50 }),
            token: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          // Generate playlist with missing tracks
          fc.record({
            playlistName: fc.string({ minLength: 1, maxLength: 100 }),
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
            missingTracks: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                artist: fc.string({ minLength: 1, maxLength: 100 }),
                album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
                position: fc.integer({ min: 0, max: 1000 }),
              }),
              { minLength: 2, maxLength: 10 }
            ),
          }),
          // Generate indices of tracks to "successfully match"
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 5 }),
          async (userData, playlistData, matchedIndices) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
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
                playlistData.playlistName,
                playlistData.source
              );
              
              // Add missing tracks
              dbService.addMissingTracks(
                user.id,
                playlist.id,
                playlistData.missingTracks.map(t => ({
                  title: t.title,
                  artist: t.artist,
                  album: t.album,
                  position: t.position,
                  source: playlistData.source,
                }))
              );
              
              // Get initial missing tracks count
              const initialMissing = dbService.getUserMissingTracks(user.id);
              const initialCount = initialMissing.length;
              
              // Simulate successful matching by removing some tracks
              const validIndices = matchedIndices.filter(i => i < initialMissing.length);
              const uniqueIndices = [...new Set(validIndices)];
              
              for (const index of uniqueIndices) {
                const track = initialMissing[index];
                dbService.removeMissingTrack(track.id);
              }
              
              // Get updated missing tracks
              const updatedMissing = dbService.getUserMissingTracks(user.id);
              
              // Property: Successfully matched tracks should be removed from missing_tracks
              expect(updatedMissing.length).toBe(initialCount - uniqueIndices.length);
              
              // Property: Removed tracks should not appear in the updated list
              const removedIds = uniqueIndices.map(i => initialMissing[i].id);
              for (const track of updatedMissing) {
                expect(removedIds).not.toContain(track.id);
              }
              
              // Property: Remaining tracks should still be in the database
              const remainingIds = initialMissing
                .filter((_, i) => !uniqueIndices.includes(i))
                .map(t => t.id);
              
              for (const track of updatedMissing) {
                expect(remainingIds).toContain(track.id);
              }
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve position information for missing tracks', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 5, maxLength: 50 }),
            username: fc.string({ minLength: 3, maxLength: 50 }),
            token: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          // Generate playlist with missing tracks
          fc.record({
            playlistName: fc.string({ minLength: 1, maxLength: 100 }),
            source: fc.constantFrom('spotify', 'deezer', 'apple', 'tidal'),
            missingTracks: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                artist: fc.string({ minLength: 1, maxLength: 100 }),
                album: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
                position: fc.integer({ min: 0, max: 1000 }),
                afterTrackKey: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              }),
              { minLength: 1, maxLength: 20 }
            ),
          }),
          async (userData, playlistData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
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
                playlistData.playlistName,
                playlistData.source
              );
              
              // Add missing tracks
              dbService.addMissingTracks(
                user.id,
                playlist.id,
                playlistData.missingTracks.map(t => ({
                  title: t.title,
                  artist: t.artist,
                  album: t.album,
                  position: t.position,
                  afterTrackKey: t.afterTrackKey?.trim() || undefined,
                  source: playlistData.source,
                }))
              );
              
              // Get missing tracks
              const missingTracks = dbService.getUserMissingTracks(user.id);
              
              // Property: Position information should be preserved
              for (let i = 0; i < playlistData.missingTracks.length; i++) {
                const original = playlistData.missingTracks[i];
                const stored = missingTracks.find(
                  t => t.title === original.title && t.artist === original.artist
                );
                
                expect(stored).toBeDefined();
                expect(stored!.position).toBe(original.position);
                
                // Sanitize whitespace-only strings to undefined for comparison
                const sanitizedAfterTrackKey = original.afterTrackKey?.trim() || undefined;
                if (sanitizedAfterTrackKey) {
                  expect(stored!.after_track_key).toBe(sanitizedAfterTrackKey);
                } else {
                  expect(stored!.after_track_key).toBeNull();
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
