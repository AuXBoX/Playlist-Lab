/**
 * Integration Tests for Mix Generation
 * 
 * Tests the complete mix generation workflow with mocked Plex data:
 * - Weekly Mix generation with play history
 * - Daily Mix generation with recent plays and rediscoveries
 * - Time Capsule generation with artist diversity
 * - New Music Mix generation with recently added albums
 * - Mix settings application
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MixService, MixSettings } from '../../src/services/mixes';
import { PlexClient } from '../../src/services/plex';

// Mock PlexClient
jest.mock('../../src/services/plex');

describe('Mix Generation Integration Tests', () => {
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
   * Test Weekly Mix generation with realistic play history
   */
  test('should generate Weekly Mix from play history', async () => {
    const settings: MixSettings['weeklyMix'] = {
      topArtists: 3,
      tracksPerArtist: 5
    };

    // Mock play history with multiple artists
    const recentTracks = [
      { ratingKey: '1', grandparentTitle: 'The Beatles', title: 'Hey Jude' },
      { ratingKey: '2', grandparentTitle: 'The Beatles', title: 'Let It Be' },
      { ratingKey: '3', grandparentTitle: 'The Beatles', title: 'Yesterday' },
      { ratingKey: '4', grandparentTitle: 'Pink Floyd', title: 'Comfortably Numb' },
      { ratingKey: '5', grandparentTitle: 'Pink Floyd', title: 'Wish You Were Here' },
      { ratingKey: '6', grandparentTitle: 'Led Zeppelin', title: 'Stairway to Heaven' },
      { ratingKey: '7', grandparentTitle: 'Led Zeppelin', title: 'Kashmir' },
      { ratingKey: '8', grandparentTitle: 'Queen', title: 'Bohemian Rhapsody' }
    ];

    const mockGetRecentTracks = jest.fn().mockResolvedValue(recentTracks);
    const mockSearchArtist = jest.fn().mockImplementation((_libraryId, artistName) => {
      return Promise.resolve({ ratingKey: `artist-${artistName}` });
    });
    const mockGetArtistPopularTracks = jest.fn().mockImplementation((_libraryId, artistKey) => {
      const artistName = artistKey.replace('artist-', '');
      return Promise.resolve([
        { ratingKey: `${artistKey}-track-1`, title: `${artistName} Track 1` },
        { ratingKey: `${artistKey}-track-2`, title: `${artistName} Track 2` },
        { ratingKey: `${artistKey}-track-3`, title: `${artistName} Track 3` },
        { ratingKey: `${artistKey}-track-4`, title: `${artistName} Track 4` },
        { ratingKey: `${artistKey}-track-5`, title: `${artistName} Track 5` }
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

    // Verify play history was fetched
    expect(mockGetRecentTracks).toHaveBeenCalled();

    // Verify top artists were searched (The Beatles, Pink Floyd, Led Zeppelin)
    expect(mockSearchArtist).toHaveBeenCalledTimes(3);

    // Verify popular tracks were fetched for each artist
    expect(mockGetArtistPopularTracks).toHaveBeenCalledTimes(3);

    // Verify result contains tracks
    expect(result.trackCount).toBeGreaterThan(0);
    expect(result.trackKeys.length).toBe(result.trackCount);
    expect(result.trackKeys.length).toBeLessThanOrEqual(settings.topArtists * settings.tracksPerArtist);
  });

  /**
   * Test Daily Mix generation with all three components
   */
  test('should generate Daily Mix with recent, related, and rediscovery tracks', async () => {
    const settings: MixSettings['dailyMix'] = {
      recentTracks: 5,
      relatedTracks: 5,
      rediscoveryTracks: 5,
      rediscoveryDays: 30
    };

    const recentTracks = [
      { ratingKey: 'recent-1', grandparentTitle: 'Artist A', title: 'Recent 1' },
      { ratingKey: 'recent-2', grandparentTitle: 'Artist B', title: 'Recent 2' },
      { ratingKey: 'recent-3', grandparentTitle: 'Artist C', title: 'Recent 3' },
      { ratingKey: 'recent-4', grandparentTitle: 'Artist D', title: 'Recent 4' },
      { ratingKey: 'recent-5', grandparentTitle: 'Artist E', title: 'Recent 5' }
    ];

    const relatedTracks = [
      { ratingKey: 'related-1', title: 'Related 1' },
      { ratingKey: 'related-2', title: 'Related 2' }
    ];

    const staleTracksData = [
      { ratingKey: 'stale-1', title: 'Stale 1' },
      { ratingKey: 'stale-2', title: 'Stale 2' },
      { ratingKey: 'stale-3', title: 'Stale 3' }
    ];

    const mockGetRecentTracks = jest.fn().mockResolvedValue(recentTracks);
    const mockGetSimilarTracks = jest.fn().mockResolvedValue(relatedTracks);
    const mockGetStalePlayedTracks = jest.fn().mockResolvedValue(staleTracksData);

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

    // Verify all three data sources were used
    expect(mockGetRecentTracks).toHaveBeenCalled();
    expect(mockGetSimilarTracks).toHaveBeenCalled();
    expect(mockGetStalePlayedTracks).toHaveBeenCalled();

    // Verify result contains tracks from all categories
    expect(result.trackCount).toBeGreaterThan(0);
    expect(result.trackKeys.some(key => key.startsWith('recent-'))).toBe(true);
    expect(result.trackKeys.some(key => key.startsWith('related-'))).toBe(true);
    expect(result.trackKeys.some(key => key.startsWith('stale-'))).toBe(true);
  });

  /**
   * Test Time Capsule generation with artist diversity
   */
  test('should generate Time Capsule with artist diversity', async () => {
    const settings: MixSettings['timeCapsule'] = {
      trackCount: 20,
      daysAgo: 90,
      maxPerArtist: 3
    };

    // Create tracks from multiple artists
    const staleTracksData = [
      ...Array.from({ length: 10 }, (_, i) => ({
        ratingKey: `artist-a-${i}`,
        grandparentTitle: 'Artist A',
        title: `Track ${i}`
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        ratingKey: `artist-b-${i}`,
        grandparentTitle: 'Artist B',
        title: `Track ${i}`
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        ratingKey: `artist-c-${i}`,
        grandparentTitle: 'Artist C',
        title: `Track ${i}`
      }))
    ];

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

    // Verify stale tracks were fetched
    expect(mockGetStalePlayedTracks).toHaveBeenCalledWith(
      mockLibraryId,
      settings.daysAgo,
      expect.any(Number)
    );

    // Verify result respects track count
    expect(result.trackCount).toBeLessThanOrEqual(settings.trackCount);

    // Count tracks per artist
    const artistCounts = new Map<string, number>();
    for (const key of result.trackKeys) {
      const artist = key.split('-')[0] + '-' + key.split('-')[1]; // "artist-a"
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    }

    // Verify no artist exceeds maxPerArtist
    for (const count of artistCounts.values()) {
      expect(count).toBeLessThanOrEqual(settings.maxPerArtist);
    }
  });

  /**
   * Test New Music Mix generation with recently added albums
   */
  test('should generate New Music Mix from recently added albums', async () => {
    const settings: MixSettings['newMusic'] = {
      albumCount: 5,
      tracksPerAlbum: 3
    };

    const recentAlbums = [
      { ratingKey: 'album-1', title: 'Album 1' },
      { ratingKey: 'album-2', title: 'Album 2' },
      { ratingKey: 'album-3', title: 'Album 3' },
      { ratingKey: 'album-4', title: 'Album 4' },
      { ratingKey: 'album-5', title: 'Album 5' }
    ];

    const mockGetRecentlyAddedAlbums = jest.fn().mockResolvedValue(recentAlbums);
    const mockGetAlbumTracks = jest.fn().mockImplementation((albumKey) => {
      return Promise.resolve([
        { ratingKey: `${albumKey}-track-1`, title: 'Track 1' },
        { ratingKey: `${albumKey}-track-2`, title: 'Track 2' },
        { ratingKey: `${albumKey}-track-3`, title: 'Track 3' },
        { ratingKey: `${albumKey}-track-4`, title: 'Track 4' },
        { ratingKey: `${albumKey}-track-5`, title: 'Track 5' }
      ]);
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

    // Verify tracks were fetched from each album
    expect(mockGetAlbumTracks).toHaveBeenCalledTimes(settings.albumCount);

    // Verify result contains tracks
    expect(result.trackCount).toBeGreaterThan(0);
    expect(result.trackKeys.length).toBe(result.trackCount);

    // Verify tracks are from the albums
    for (const trackKey of result.trackKeys) {
      const albumKey = trackKey.split('-track-')[0];
      expect(recentAlbums.some(album => album.ratingKey === albumKey)).toBe(true);
    }
  });

  /**
   * Test mix settings application
   */
  test('should apply custom mix settings correctly', async () => {
    const customSettings: MixSettings['weeklyMix'] = {
      topArtists: 2,
      tracksPerArtist: 3
    };

    const recentTracks = [
      { ratingKey: '1', grandparentTitle: 'Artist 1', title: 'Track 1' },
      { ratingKey: '2', grandparentTitle: 'Artist 1', title: 'Track 2' },
      { ratingKey: '3', grandparentTitle: 'Artist 2', title: 'Track 3' },
      { ratingKey: '4', grandparentTitle: 'Artist 3', title: 'Track 4' }
    ];

    const mockGetRecentTracks = jest.fn().mockResolvedValue(recentTracks);
    const mockSearchArtist = jest.fn().mockResolvedValue({ ratingKey: 'artist-key' });
    const mockGetArtistPopularTracks = jest.fn().mockResolvedValue([
      { ratingKey: 'track-1', title: 'Popular 1' },
      { ratingKey: 'track-2', title: 'Popular 2' },
      { ratingKey: 'track-3', title: 'Popular 3' }
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
      customSettings
    );

    // Verify only top 2 artists were searched
    expect(mockSearchArtist).toHaveBeenCalledTimes(2);

    // Verify popular tracks were fetched with correct limit
    expect(mockGetArtistPopularTracks).toHaveBeenCalledWith(
      mockLibraryId,
      expect.any(String),
      customSettings.tracksPerArtist
    );

    // Verify result respects settings
    expect(result.trackCount).toBeLessThanOrEqual(
      customSettings.topArtists * customSettings.tracksPerArtist
    );
  });

  /**
   * Test empty result handling
   */
  test('should handle empty play history gracefully', async () => {
    const settings: MixSettings['weeklyMix'] = {
      topArtists: 5,
      tracksPerArtist: 10
    };

    const mockGetRecentTracks = jest.fn().mockResolvedValue([]);

    (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => ({
      getRecentTracks: mockGetRecentTracks
    } as any));

    const result = await mixService.generateWeeklyMix(
      mockServerUrl,
      mockToken,
      mockLibraryId,
      settings
    );

    expect(result.trackCount).toBe(0);
    expect(result.trackKeys).toEqual([]);
  });

  /**
   * Test generateAllMixes
   */
  test('should generate all mix types at once', async () => {
    const settings: MixSettings = {
      weeklyMix: { topArtists: 2, tracksPerArtist: 5 },
      dailyMix: { recentTracks: 5, relatedTracks: 5, rediscoveryTracks: 5, rediscoveryDays: 30 },
      timeCapsule: { trackCount: 20, daysAgo: 90, maxPerArtist: 3 },
      newMusic: { albumCount: 5, tracksPerAlbum: 3 }
    };

    // Mock all required methods
    const mockGetRecentTracks = jest.fn().mockResolvedValue([
      { ratingKey: '1', grandparentTitle: 'Artist A', title: 'Track 1' },
      { ratingKey: '2', grandparentTitle: 'Artist B', title: 'Track 2' }
    ]);
    const mockSearchArtist = jest.fn().mockResolvedValue({ ratingKey: 'artist-key' });
    const mockGetArtistPopularTracks = jest.fn().mockResolvedValue([
      { ratingKey: 'popular-1', title: 'Popular 1' }
    ]);
    const mockGetSimilarTracks = jest.fn().mockResolvedValue([
      { ratingKey: 'similar-1', title: 'Similar 1' }
    ]);
    const mockGetStalePlayedTracks = jest.fn().mockResolvedValue([
      { ratingKey: 'stale-1', grandparentTitle: 'Artist C', title: 'Stale 1' }
    ]);
    const mockGetRecentlyAddedAlbums = jest.fn().mockResolvedValue([
      { ratingKey: 'album-1', title: 'Album 1' }
    ]);
    const mockGetAlbumTracks = jest.fn().mockResolvedValue([
      { ratingKey: 'album-1-track-1', title: 'Track 1' }
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

    const results = await mixService.generateAllMixes(
      mockServerUrl,
      mockToken,
      mockLibraryId,
      settings
    );

    // Verify all mix types were generated
    expect(results).toHaveProperty('weekly');
    expect(results).toHaveProperty('daily');
    expect(results).toHaveProperty('timeCapsule');
    expect(results).toHaveProperty('newMusic');

    // Verify each result has the correct structure
    expect(results.weekly).toHaveProperty('trackKeys');
    expect(results.weekly).toHaveProperty('trackCount');
    expect(results.daily).toHaveProperty('trackKeys');
    expect(results.daily).toHaveProperty('trackCount');
    expect(results.timeCapsule).toHaveProperty('trackKeys');
    expect(results.timeCapsule).toHaveProperty('trackCount');
    expect(results.newMusic).toHaveProperty('trackKeys');
    expect(results.newMusic).toHaveProperty('trackCount');
  });
});
