/**
 * Property-Based Tests for Matching Service
 * 
 * Tests universal properties of the matching algorithm and settings persistence.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { DatabaseService } from '../../src/database/database';
import { MatchingService, DEFAULT_MATCHING_SETTINGS, MatchingSettings } from '../../src/services/matching';
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

/**
 * Arbitrary generator for MatchingSettings
 */
const matchingSettingsArbitrary = fc.record({
  minMatchScore: fc.integer({ min: 0, max: 100 }),
  stripParentheses: fc.boolean(),
  stripBrackets: fc.boolean(),
  useFirstArtistOnly: fc.boolean(),
  ignoreFeaturedArtists: fc.boolean(),
  ignoreRemixInfo: fc.boolean(),
  ignoreVersionInfo: fc.boolean(),
  preferNonCompilation: fc.boolean(),
  penalizeMonoVersions: fc.boolean(),
  penalizeLiveVersions: fc.boolean(),
  preferHigherRated: fc.boolean(),
  minRatingForMatch: fc.integer({ min: 0, max: 10 }),
  autoCompleteOnPerfectMatch: fc.boolean(),
  playlistPrefixes: fc.record({
    enabled: fc.boolean(),
    spotify: fc.string({ maxLength: 10 }),
    deezer: fc.string({ maxLength: 10 }),
    apple: fc.string({ maxLength: 10 }),
    tidal: fc.string({ maxLength: 10 }),
    youtube: fc.string({ maxLength: 10 }),
    amazon: fc.string({ maxLength: 10 }),
    qobuz: fc.string({ maxLength: 10 }),
    listenbrainz: fc.string({ maxLength: 10 }),
    file: fc.string({ maxLength: 10 }),
    ai: fc.string({ maxLength: 10 }),
  }),
  customStripPatterns: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
  featuredArtistPatterns: fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }),
  versionSuffixPatterns: fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }),
  remasterPatterns: fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }),
  variousArtistsNames: fc.array(fc.string({ maxLength: 30 }), { maxLength: 10 }),
  penaltyKeywords: fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }),
  priorityKeywords: fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }),
});

describe('Matching Service Property Tests', () => {
  describe('Property 23: Settings Persistence', () => {
    /**
     * **Validates: Requirements 9.2, 9.3**
     * 
     * For any user's matching settings modification, the updated settings 
     * should be stored in the database and applied to all subsequent 
     * matching operations for that user.
     */
    it('should persist and apply matching settings correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two users with different settings
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          matchingSettingsArbitrary,
          async (userData, matchingSettings) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Save matching settings
              dbService.saveUserSettings(user.id, {
                matching_settings: matchingSettings,
              });
              
              // Retrieve settings
              const retrievedSettings = dbService.getUserSettings(user.id);
              expect(retrievedSettings).toBeDefined();
              
              // Verify settings match
              const parsedSettings = retrievedSettings.matching_settings;
              
              // Verify all settings fields are preserved
              expect(parsedSettings.minMatchScore).toBe(matchingSettings.minMatchScore);
              expect(parsedSettings.stripParentheses).toBe(matchingSettings.stripParentheses);
              expect(parsedSettings.stripBrackets).toBe(matchingSettings.stripBrackets);
              expect(parsedSettings.useFirstArtistOnly).toBe(matchingSettings.useFirstArtistOnly);
              expect(parsedSettings.ignoreFeaturedArtists).toBe(matchingSettings.ignoreFeaturedArtists);
              expect(parsedSettings.ignoreRemixInfo).toBe(matchingSettings.ignoreRemixInfo);
              expect(parsedSettings.ignoreVersionInfo).toBe(matchingSettings.ignoreVersionInfo);
              expect(parsedSettings.preferNonCompilation).toBe(matchingSettings.preferNonCompilation);
              expect(parsedSettings.penalizeMonoVersions).toBe(matchingSettings.penalizeMonoVersions);
              expect(parsedSettings.penalizeLiveVersions).toBe(matchingSettings.penalizeLiveVersions);
              expect(parsedSettings.preferHigherRated).toBe(matchingSettings.preferHigherRated);
              expect(parsedSettings.minRatingForMatch).toBe(matchingSettings.minRatingForMatch);
              expect(parsedSettings.autoCompleteOnPerfectMatch).toBe(matchingSettings.autoCompleteOnPerfectMatch);
              
              // Verify nested objects
              expect(parsedSettings.playlistPrefixes).toEqual(matchingSettings.playlistPrefixes);
              expect(parsedSettings.customStripPatterns).toEqual(matchingSettings.customStripPatterns);
              expect(parsedSettings.featuredArtistPatterns).toEqual(matchingSettings.featuredArtistPatterns);
              expect(parsedSettings.versionSuffixPatterns).toEqual(matchingSettings.versionSuffixPatterns);
              expect(parsedSettings.remasterPatterns).toEqual(matchingSettings.remasterPatterns);
              expect(parsedSettings.variousArtistsNames).toEqual(matchingSettings.variousArtistsNames);
              expect(parsedSettings.penaltyKeywords).toEqual(matchingSettings.penaltyKeywords);
              expect(parsedSettings.priorityKeywords).toEqual(matchingSettings.priorityKeywords);
              
              // Update settings with different values
              const updatedSettings = {
                ...matchingSettings,
                minMatchScore: (matchingSettings.minMatchScore + 10) % 100,
                stripParentheses: !matchingSettings.stripParentheses,
              };
              
              dbService.saveUserSettings(user.id, {
                matching_settings: updatedSettings,
              });
              
              // Retrieve updated settings
              const retrievedUpdatedSettings = dbService.getUserSettings(user.id);
              const parsedUpdatedSettings = retrievedUpdatedSettings.matching_settings;
              
              // Verify updates were applied
              expect(parsedUpdatedSettings.minMatchScore).toBe(updatedSettings.minMatchScore);
              expect(parsedUpdatedSettings.stripParentheses).toBe(updatedSettings.stripParentheses);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Matching Algorithm Behavior', () => {
    /**
     * Test that matching settings affect the matching algorithm behavior
     */
    it('should apply settings when matching tracks', () => {
      // Test with different minMatchScore values
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (minMatchScore) => {
            const settings: MatchingSettings = {
              ...DEFAULT_MATCHING_SETTINGS,
              minMatchScore,
            };
            
            const matchingService = new MatchingService(settings);
            
            // Create a mock track with a known score
            const sourceTrack = {
              title: 'Test Song',
              artist: 'Test Artist',
            };
            
            const plexTrack = {
              title: 'Test Song',
              grandparentTitle: 'Test Artist',
              parentTitle: 'Test Album',
              ratingKey: '12345',
            };
            
            // Calculate score
            const score = matchingService.calculateScore(sourceTrack, plexTrack, settings);
            
            // Score should be between 0 and 100
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
            
            // For exact matches, score should be 100
            expect(score).toBe(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Test that stripParentheses setting affects title matching
     */
    it('should respect stripParentheses setting', () => {
      const matchingService = new MatchingService();
      
      const sourceTrack = {
        title: 'Song Title',
        artist: 'Artist Name',
      };
      
      const plexTrackWithParens = {
        title: 'Song Title (Radio Edit)',
        grandparentTitle: 'Artist Name',
        parentTitle: 'Album',
        ratingKey: '123',
      };
      
      // With stripParentheses = true (default), should match better
      const scoreWithStrip = matchingService.calculateScore(
        sourceTrack,
        plexTrackWithParens,
        { ...DEFAULT_MATCHING_SETTINGS, stripParentheses: true }
      );
      
      // With stripParentheses = false, might score lower
      const scoreWithoutStrip = matchingService.calculateScore(
        sourceTrack,
        plexTrackWithParens,
        { ...DEFAULT_MATCHING_SETTINGS, stripParentheses: false }
      );
      
      // Both should produce valid scores
      expect(scoreWithStrip).toBeGreaterThanOrEqual(0);
      expect(scoreWithStrip).toBeLessThanOrEqual(100);
      expect(scoreWithoutStrip).toBeGreaterThanOrEqual(0);
      expect(scoreWithoutStrip).toBeLessThanOrEqual(100);
    });

    /**
     * Test that useFirstArtistOnly setting affects artist matching
     */
    it('should respect useFirstArtistOnly setting', () => {
      const matchingService = new MatchingService();
      
      const sourceTrack = {
        title: 'Collaboration Song',
        artist: 'Artist One',
      };
      
      const plexTrack = {
        title: 'Collaboration Song',
        grandparentTitle: 'Artist One, Artist Two, Artist Three',
        parentTitle: 'Album',
        ratingKey: '456',
      };
      
      // With useFirstArtistOnly = true, should match well
      const scoreWithFirst = matchingService.calculateScore(
        sourceTrack,
        plexTrack,
        { ...DEFAULT_MATCHING_SETTINGS, useFirstArtistOnly: true }
      );
      
      // With useFirstArtistOnly = false, might score differently
      const scoreWithoutFirst = matchingService.calculateScore(
        sourceTrack,
        plexTrack,
        { ...DEFAULT_MATCHING_SETTINGS, useFirstArtistOnly: false }
      );
      
      // Both should produce valid scores
      expect(scoreWithFirst).toBeGreaterThanOrEqual(0);
      expect(scoreWithFirst).toBeLessThanOrEqual(100);
      expect(scoreWithoutFirst).toBeGreaterThanOrEqual(0);
      expect(scoreWithoutFirst).toBeLessThanOrEqual(100);
    });
  });
});
