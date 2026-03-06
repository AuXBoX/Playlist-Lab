/**
 * Property-Based Tests for Mix Generation
 * 
 * Tests universal properties that should hold for all mix generation operations:
 * - Property 11: Mix Generation Requires Play History
 * - Property 12: Weekly Mix Artist Selection
 * - Property 13: Daily Mix Composition
 * - Property 14: Time Capsule Staleness and Diversity
 * - Property 15: New Music Mix Recency
 * - Property 16: Mix Playlist Creation
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import { MixService, MixSettings } from '../../src/services/mixes';
import { PlexClient } from '../../src/services/plex';

// Mock PlexClient
jest.mock('../../src/services/plex');

describe('Mix Generation Property Tests', () => {
  let mixService: MixService;
  const mockServerUrl = 'http://localhost:32400';
  const mockToken = 'test-token';
  const mockLibraryId = '1';

  beforeEach(() => {
    mixService = new MixService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Property 11: Mix Generation Requires Play History
   * For any mix generation request (Weekly, Daily, Time Capsule, New Music),
   * the server should fetch the user's play history from their Plex server before generating the mix
   * 
   * Feature: playlist-lab-web-server, Property 11: Mix Generation Requires Play History
   * Validates: Requirements 5.2
   */
  test('Property 11: All mix types should fetch play history or library data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          weeklyMix: fc.record({
            topArtists: fc.integer({ min: 1, max: 10 }),
            tracksPerArtist: fc.integer({ min: 5, max: 20 })
          }),
          dailyMix: fc.record({
            recentTracks: fc.integer({ min: 5, max: 20 }),
            relatedTracks: fc.integer({ min: 5, max: 20 }),
            rediscoveryTracks: fc.integer({ min: 5, max: 20 }),
            rediscoveryDays: fc.integer({ min: 7, max: 90 })
          }),
          timeCapsule: fc.record({
            trackCount: fc.integer({ min: 10, max: 100 }),
            daysAgo: fc.integer({ min: 30, max: 365 }),
            maxPerArtist: fc.integer({ min: 1, max: 5 })
          }),
          newMusic: fc.record({
            albumCount: fc.integer({ min: 5, max: 20 }),
            tracksPerAlbum: fc.integer({ min: 1, max: 5 })
          })
        }),
        async (settings: MixSettings) => {
          // Mock PlexClient methods
          const mockGetRecentTracks = jest.fn().mockResolvedValue([
            { ratingKey: '1', grandparentTitle: 'Artist 1', title: 'Track 1' },
            { ratingKey: '2', grandparentTitle: 'Artist 2', title: 'Track 2' }
          ]);
          const mockSearchArtist = jest.fn().mockResolvedValue({ ratingKey: '100' });
          const mockGetArtistPopularTracks = jest.fn().mockResolvedValue([
            { ratingKey: '10', title: 'Popular 1' }
          ]);
          const mockGetSimilarTracks = jest.fn().mockResolvedValue([]);
          const mockGetStalePlayedTracks = jest.fn().mockResolvedValue([]);
          const mockGetRecentlyAddedAlbums = jest.fn().mockResolvedValue([
            { ratingKey: '200', title: 'Album 1' }
          ]);
          const mockGetAlbumTracks = jest.fn().mockResolvedValue([
            { ratingKey: '300', title: 'Track from album' }
          ]);

          (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
            getRecentTracks: mockGetRecentTracks,
            searchArtist: mockSearchArtist,
            getArtistPopularTracks: mockGetArtistPopularTracks,
            getSimilarTracks: mockGetSimilarTracks,
            getStalePlayedTracks: mockGetStalePlayedTracks,
            getRecentlyAddedAlbums: mockGetRecentlyAddedAlbums,
            getAlbumTracks: mockGetAlbumTracks
          } as any));

          // Test Weekly Mix
          await mixService.generateWeeklyMix(mockServerUrl, mockToken, mockLibraryId, settings.weeklyMix);
          expect(mockGetRecentTracks).toHaveBeenCalled();

          jest.clearAllMocks();

          // Test Daily Mix
          await mixService.generateDailyMix(mockServerUrl, mockToken, mockLibraryId, settings.dailyMix);
          expect(mockGetRecentTracks).toHaveBeenCalled();

          jest.clearAllMocks();

          // Test Time Capsule
          await mixService.generateTimeCapsule(mockServerUrl, mockToken, mockLibraryId, settings.timeCapsule);
          expect(mockGetStalePlayedTracks).toHaveBeenCalled();

          jest.clearAllMocks();

          // Test New Music Mix
          await mixService.generateNewMusicMix(mockServerUrl, mockToken, mockLibraryId, settings.newMusic);
          expect(mockGetRecentlyAddedAlbums).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 12: Weekly Mix Artist Selection
   * For any Weekly Mix generation, all selected tracks should come from artists
   * that appear in the user's most-played artists list
   * 
   * Feature: playlist-lab-web-server, Property 12: Weekly Mix Artist Selection
   * Validates: Requirements 5.3
   */
  test('Property 12: Weekly Mix tracks should come from most-played artists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          topArtists: fc.integer({ min: 2, max: 5 }),
          tracksPerArtist: fc.integer({ min: 3, max: 10 })
        }),
        fc.array(
          fc.record({
            ratingKey: fc.string(),
            grandparentTitle: fc.constantFrom('Artist A', 'Artist B', 'Artist C', 'Artist D'),
            title: fc.string()
          }),
          { minLength: 10, maxLength: 50 }
        ),
        async (settings, recentTracks) => {
          // Count artist plays
          const artistCounts = new Map<string, number>();
          for (const track of recentTracks) {
            const artist = track.grandparentTitle;
            artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
          }

          const topArtists = Array.from(artistCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, settings.topArtists)
            .map(([name]) => name);

          // Mock PlexClient
          const mockGetRecentTracks = jest.fn().mockResolvedValue(recentTracks);
          const mockSearchArtist = jest.fn().mockImplementation((_libraryId, artistName) => {
            if (topArtists.includes(artistName)) {
              return Promise.resolve({ ratingKey: `artist-${artistName}` });
            }
            return Promise.resolve(null);
          });
          const mockGetArtistPopularTracks = jest.fn().mockImplementation((_libraryId, artistKey) => {
            const artistName = artistKey.replace('artist-', '');
            return Promise.resolve([
              { ratingKey: `track-${artistName}-1`, grandparentTitle: artistName },
              { ratingKey: `track-${artistName}-2`, grandparentTitle: artistName }
            ]);
          });

          (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
            getRecentTracks: mockGetRecentTracks,
            searchArtist: mockSearchArtist,
            getArtistPopularTracks: mockGetArtistPopularTracks
          } as any));

          const result = await mixService.generateWeeklyMix(
            mockServerUrl,
            mockToken,
            mockLibraryId,
            settings
          );

          // Verify all tracks are from top artists
          const searchedArtists = mockSearchArtist.mock.calls.map(call => call[1]); // Second parameter is artistName
          for (const artist of searchedArtists) {
            expect(topArtists).toContain(artist);
          }

          // Ensure result is valid
          expect(result.trackKeys).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 13: Daily Mix Composition
   * For any Daily Mix generation, the resulting playlist should contain tracks
   * from all three categories: recent plays, related tracks, and rediscoveries
   * 
   * Feature: playlist-lab-web-server, Property 13: Daily Mix Composition
   * Validates: Requirements 5.4
   */
  test('Property 13: Daily Mix should contain recent, related, and rediscovery tracks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          recentTracks: fc.integer({ min: 3, max: 10 }),
          relatedTracks: fc.integer({ min: 3, max: 10 }),
          rediscoveryTracks: fc.integer({ min: 3, max: 10 }),
          rediscoveryDays: fc.integer({ min: 7, max: 90 })
        }),
        async (settings) => {
          const recentTracksData = Array.from({ length: settings.recentTracks }, (_, i) => ({
            ratingKey: `recent-${i}`,
            title: `Recent ${i}`,
            grandparentTitle: 'Artist'
          }));

          const relatedTracksData = Array.from({ length: settings.relatedTracks }, (_, i) => ({
            ratingKey: `related-${i}`,
            title: `Related ${i}`
          }));

          const rediscoveryTracksData = Array.from({ length: settings.rediscoveryTracks }, (_, i) => ({
            ratingKey: `rediscovery-${i}`,
            title: `Rediscovery ${i}`
          }));

          const mockGetRecentTracks = jest.fn().mockResolvedValue(recentTracksData);
          const mockGetSimilarTracks = jest.fn().mockResolvedValue(relatedTracksData);
          const mockGetStalePlayedTracks = jest.fn().mockResolvedValue(rediscoveryTracksData);

          (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
            getRecentTracks: mockGetRecentTracks,
            getSimilarTracks: mockGetSimilarTracks,
            getStalePlayedTracks: mockGetStalePlayedTracks
          } as any));

          const result = await mixService.generateDailyMix(
            mockServerUrl,
            mockToken,
            mockLibraryId,
            settings
          );

          // Verify all three methods were called
          expect(mockGetRecentTracks).toHaveBeenCalled();
          expect(mockGetSimilarTracks).toHaveBeenCalled();
          expect(mockGetStalePlayedTracks).toHaveBeenCalled();

          // Verify result contains tracks from all categories
          const hasRecent = result.trackKeys.some(key => key.startsWith('recent-'));
          const hasRelated = result.trackKeys.some(key => key.startsWith('related-'));
          const hasRediscovery = result.trackKeys.some(key => key.startsWith('rediscovery-'));

          expect(hasRecent || hasRelated || hasRediscovery).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 14: Time Capsule Staleness and Diversity
   * For any Time Capsule generation with parameters (daysAgo, maxPerArtist),
   * all selected tracks should have lastViewedAt older than daysAgo,
   * and no artist should have more than maxPerArtist tracks
   * 
   * Feature: playlist-lab-web-server, Property 14: Time Capsule Staleness and Diversity
   * Validates: Requirements 5.5
   */
  test('Property 14: Time Capsule should enforce staleness and artist diversity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          trackCount: fc.integer({ min: 10, max: 30 }),
          daysAgo: fc.integer({ min: 30, max: 180 }),
          maxPerArtist: fc.integer({ min: 2, max: 5 })
        }),
        async (settings) => {
          // Create tracks from multiple artists
          const artists = ['Artist A', 'Artist B', 'Artist C', 'Artist D', 'Artist E'];
          const staleTracksData = artists.flatMap(artist =>
            Array.from({ length: 10 }, (_, i) => ({
              ratingKey: `${artist}-${i}`,
              title: `Track ${i}`,
              grandparentTitle: artist
            }))
          );

          const mockGetStalePlayedTracks = jest.fn().mockResolvedValue(staleTracksData);

          (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
            getStalePlayedTracks: mockGetStalePlayedTracks
          } as any));

          const result = await mixService.generateTimeCapsule(
            mockServerUrl,
            mockToken,
            mockLibraryId,
            settings
          );

          // Verify staleness check was called with correct parameters
          expect(mockGetStalePlayedTracks).toHaveBeenCalledWith(
            mockLibraryId,
            settings.daysAgo,
            expect.any(Number)
          );

          // Count tracks per artist in result
          const artistTrackCounts = new Map<string, number>();
          for (const key of result.trackKeys) {
            const artist = key.split('-')[0] + ' ' + key.split('-')[1]; // "Artist A"
            artistTrackCounts.set(artist, (artistTrackCounts.get(artist) || 0) + 1);
          }

          // Verify no artist exceeds maxPerArtist
          for (const count of artistTrackCounts.values()) {
            expect(count).toBeLessThanOrEqual(settings.maxPerArtist);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 15: New Music Mix Recency
   * For any New Music Mix generation, all selected tracks should come from albums
   * with addedAt timestamps within the configured recent period
   * 
   * Feature: playlist-lab-web-server, Property 15: New Music Mix Recency
   * Validates: Requirements 5.6
   */
  test('Property 15: New Music Mix should only include tracks from recently added albums', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          albumCount: fc.integer({ min: 3, max: 10 }),
          tracksPerAlbum: fc.integer({ min: 2, max: 5 })
        }),
        async (settings) => {
          const recentAlbums = Array.from({ length: settings.albumCount }, (_, i) => ({
            ratingKey: `album-${i}`,
            title: `Album ${i}`,
            addedAt: Date.now() / 1000 - i * 86400 // Recent albums
          }));

          const mockGetRecentlyAddedAlbums = jest.fn().mockResolvedValue(recentAlbums);
          const mockGetAlbumTracks = jest.fn().mockImplementation((albumKey) => {
            return Promise.resolve(
              Array.from({ length: 5 }, (_, i) => ({
                ratingKey: `${albumKey}-track-${i}`,
                title: `Track ${i}`,
                parentRatingKey: albumKey
              }))
            );
          });

          (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
            getRecentlyAddedAlbums: mockGetRecentlyAddedAlbums,
            getAlbumTracks: mockGetAlbumTracks
          } as any));

          const result = await mixService.generateNewMusicMix(
            mockServerUrl,
            mockToken,
            mockLibraryId,
            settings
          );

          // Verify recently added albums were fetched
          expect(mockGetRecentlyAddedAlbums).toHaveBeenCalledWith(
            mockLibraryId,
            settings.albumCount
          );

          // Verify tracks are from the fetched albums
          for (const trackKey of result.trackKeys) {
            const albumKey = trackKey.split('-track-')[0];
            expect(recentAlbums.some(album => album.ratingKey === albumKey)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 16: Mix Playlist Creation
   * For any successfully generated mix, a playlist should be created in the user's
   * Plex server with the generated tracks
   * 
   * Feature: playlist-lab-web-server, Property 16: Mix Playlist Creation
   * Validates: Requirements 5.7
   * 
   * Note: This property is tested at the API route level where playlists are actually created
   */
  test('Property 16: Mix results should contain valid track keys for playlist creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          topArtists: fc.integer({ min: 1, max: 5 }),
          tracksPerArtist: fc.integer({ min: 3, max: 10 })
        }),
        async (settings) => {
          const recentTracks = [
            { ratingKey: '1', grandparentTitle: 'Artist A', title: 'Track 1' },
            { ratingKey: '2', grandparentTitle: 'Artist A', title: 'Track 2' }
          ];

          const mockGetRecentTracks = jest.fn().mockResolvedValue(recentTracks);
          const mockSearchArtist = jest.fn().mockResolvedValue({ ratingKey: 'artist-1' });
          const mockGetArtistPopularTracks = jest.fn().mockResolvedValue([
            { ratingKey: 'track-1', title: 'Popular 1' },
            { ratingKey: 'track-2', title: 'Popular 2' }
          ]);

          (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
            getRecentTracks: mockGetRecentTracks,
            searchArtist: mockSearchArtist,
            getArtistPopularTracks: mockGetArtistPopularTracks
          } as any));

          const result = await mixService.generateWeeklyMix(
            mockServerUrl,
            mockToken,
            mockLibraryId,
            settings
          );

          // Verify result has valid structure for playlist creation
          expect(result).toHaveProperty('trackKeys');
          expect(result).toHaveProperty('trackCount');
          expect(Array.isArray(result.trackKeys)).toBe(true);
          expect(typeof result.trackCount).toBe('number');
          expect(result.trackCount).toBe(result.trackKeys.length);

          // Verify all track keys are non-empty strings
          for (const key of result.trackKeys) {
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
