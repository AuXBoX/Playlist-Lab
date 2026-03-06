/**
 * Unit Tests for Matching Service
 * 
 * Tests specific examples and edge cases for the matching algorithm.
 */

import { MatchingService, DEFAULT_MATCHING_SETTINGS, ExternalTrack, MatchingSettings } from '../../src/services/matching';
import { PlexClient } from '../../src/services/plex';

// Mock PlexClient
jest.mock('../../src/services/plex');

describe('MatchingService', () => {
  let matchingService: MatchingService;
  let mockPlexClient: jest.Mocked<PlexClient>;

  beforeEach(() => {
    matchingService = new MatchingService();
    mockPlexClient = new PlexClient('http://localhost:32400', 'test-token') as jest.Mocked<PlexClient>;
    jest.clearAllMocks();
  });

  describe('calculateScore', () => {
    it('should return 100 for exact title and artist match', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
      };

      const plexTrack = {
        title: 'Bohemian Rhapsody',
        grandparentTitle: 'Queen',
        parentTitle: 'A Night at the Opera',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBe(100);
    });

    it('should handle case-insensitive matching', () => {
      const sourceTrack: ExternalTrack = {
        title: 'BOHEMIAN RHAPSODY',
        artist: 'QUEEN',
      };

      const plexTrack = {
        title: 'bohemian rhapsody',
        grandparentTitle: 'queen',
        parentTitle: 'A Night at the Opera',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBe(100);
    });

    it('should handle accented characters', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Café',
        artist: 'Beyoncé',
      };

      const plexTrack = {
        title: 'Cafe',
        grandparentTitle: 'Beyonce',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBe(100);
    });

    it('should handle apostrophes and quotes', () => {
      const sourceTrack: ExternalTrack = {
        title: "Don't Stop Believin'",
        artist: 'Journey',
      };

      const plexTrack = {
        title: 'Dont Stop Believin',
        grandparentTitle: 'Journey',
        parentTitle: 'Escape',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBe(100);
    });

    it('should handle special characters', () => {
      const sourceTrack: ExternalTrack = {
        title: 'AC/DC - T.N.T.',
        artist: 'AC/DC',
      };

      const plexTrack = {
        title: 'ACDC TNT',
        grandparentTitle: 'ACDC',
        parentTitle: 'High Voltage',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeGreaterThan(80);
    });

    it('should score partial matches lower than exact matches', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
      };

      const plexTrack = {
        title: 'Stairway',
        grandparentTitle: 'Led Zeppelin',
        parentTitle: 'Led Zeppelin IV',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(70);
    });

    it('should handle featured artists in title', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Song Title (feat. Other Artist)',
        artist: 'Main Artist',
      };

      const plexTrack = {
        title: 'Song Title',
        grandparentTitle: 'Main Artist',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeGreaterThan(90);
    });

    it('should handle remastered versions', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Yesterday',
        artist: 'The Beatles',
      };

      const plexTrack = {
        title: 'Yesterday - Remastered 2009',
        grandparentTitle: 'The Beatles',
        parentTitle: 'Help!',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeGreaterThan(90);
    });
  });

  describe('matchPlaylist', () => {
    it('should match all tracks when they exist in Plex', async () => {
      const tracks: ExternalTrack[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];

      // Mock searchTrack to return matching results
      mockPlexClient.searchTrack = jest.fn()
        .mockResolvedValueOnce([
          {
            ratingKey: '1',
            title: 'Song 1',
            grandparentTitle: 'Artist 1',
            parentTitle: 'Album 1',
            Media: [{ audioCodec: 'flac', bitrate: 1000 }],
          },
        ])
        .mockResolvedValueOnce([
          {
            ratingKey: '2',
            title: 'Song 2',
            grandparentTitle: 'Artist 2',
            parentTitle: 'Album 2',
            Media: [{ audioCodec: 'mp3', bitrate: 320 }],
          },
        ]);

      // Override the PlexClient constructor to return our mock
      (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => mockPlexClient);

      const result = await matchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token'
      );

      expect(result).toHaveLength(2);
      expect(result[0].matched).toBe(true);
      expect(result[0].plexRatingKey).toBe('1');
      expect(result[1].matched).toBe(true);
      expect(result[1].plexRatingKey).toBe('2');
    });

    it('should mark tracks as unmatched when not found', async () => {
      const tracks: ExternalTrack[] = [
        { title: 'Obscure Song', artist: 'Unknown Artist' },
      ];

      mockPlexClient.searchTrack = jest.fn().mockResolvedValue([]);
      (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => mockPlexClient);

      const result = await matchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token'
      );

      expect(result).toHaveLength(1);
      expect(result[0].matched).toBe(false);
      expect(result[0].plexRatingKey).toBeUndefined();
    });

    it('should respect minMatchScore setting', async () => {
      const tracks: ExternalTrack[] = [
        { title: 'Song', artist: 'Artist' },
      ];

      // Return a result with a low match score
      mockPlexClient.searchTrack = jest.fn().mockResolvedValue([
        {
          ratingKey: '1',
          title: 'Different Song',
          grandparentTitle: 'Different Artist',
          parentTitle: 'Album',
          Media: [],
        },
      ]);
      (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => mockPlexClient);

      const settings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        minMatchScore: 90, // High threshold
      };

      const result = await matchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token',
        settings
      );

      expect(result).toHaveLength(1);
      // Should be marked as unmatched due to low score
      expect(result[0].matched).toBe(false);
    });

    it('should handle empty playlist', async () => {
      const tracks: ExternalTrack[] = [];

      const result = await matchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token'
      );

      expect(result).toHaveLength(0);
    });

    it('should include codec and bitrate information', async () => {
      const tracks: ExternalTrack[] = [
        { title: 'High Quality Song', artist: 'Audiophile Artist' },
      ];

      mockPlexClient.searchTrack = jest.fn().mockResolvedValue([
        {
          ratingKey: '1',
          title: 'High Quality Song',
          grandparentTitle: 'Audiophile Artist',
          parentTitle: 'Album',
          Media: [{ audioCodec: 'flac', bitrate: 1411 }],
        },
      ]);
      (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => mockPlexClient);

      const result = await matchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token'
      );

      expect(result).toHaveLength(1);
      expect(result[0].matched).toBe(true);
      expect(result[0].plexCodec).toBe('FLAC');
      expect(result[0].plexBitrate).toBe(1411);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short titles', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Go',
        artist: 'Artist',
      };

      const plexTrack = {
        title: 'Go',
        grandparentTitle: 'Artist',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeGreaterThan(0);
    });

    it('should handle very long titles', () => {
      const longTitle = 'This Is A Very Long Song Title That Goes On And On And On';
      const sourceTrack: ExternalTrack = {
        title: longTitle,
        artist: 'Artist',
      };

      const plexTrack = {
        title: longTitle,
        grandparentTitle: 'Artist',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBe(100);
    });

    it('should handle titles with numbers', () => {
      const sourceTrack: ExternalTrack = {
        title: '1999',
        artist: 'Prince',
      };

      const plexTrack = {
        title: '1999',
        grandparentTitle: 'Prince',
        parentTitle: '1999',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBe(100);
    });

    it('should handle multiple artists separated by commas', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Collaboration',
        artist: 'Artist One, Artist Two, Artist Three',
      };

      const plexTrack = {
        title: 'Collaboration',
        grandparentTitle: 'Artist One',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const settings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        useFirstArtistOnly: true,
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack, settings);
      expect(score).toBeGreaterThan(90);
    });

    it('should handle artists with ampersands', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Song',
        artist: 'Simon & Garfunkel',
      };

      const plexTrack = {
        title: 'Song',
        grandparentTitle: 'Simon and Garfunkel',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeGreaterThan(80);
    });

    it('should handle empty strings gracefully', () => {
      const sourceTrack: ExternalTrack = {
        title: '',
        artist: '',
      };

      const plexTrack = {
        title: 'Song',
        grandparentTitle: 'Artist',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle titles with parentheses and brackets', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Song [Explicit] (Radio Edit)',
        artist: 'Artist',
      };

      const plexTrack = {
        title: 'Song',
        grandparentTitle: 'Artist',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const settings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        stripParentheses: true,
        stripBrackets: true,
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack, settings);
      expect(score).toBeGreaterThan(90);
    });

    it('should handle live versions', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Song',
        artist: 'Artist',
      };

      const plexTrack = {
        title: 'Song (Live)',
        grandparentTitle: 'Artist',
        parentTitle: 'Live Album',
        ratingKey: '12345',
      };

      const settings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        penalizeLiveVersions: true,
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack, settings);
      // Should still match but with lower score due to penalty
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('should handle mono versions', () => {
      const sourceTrack: ExternalTrack = {
        title: 'Song',
        artist: 'Artist',
      };

      const plexTrack = {
        title: 'Song (Mono)',
        grandparentTitle: 'Artist',
        parentTitle: 'Album',
        ratingKey: '12345',
      };

      const settings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        penalizeMonoVersions: true,
      };

      const score = matchingService.calculateScore(sourceTrack, plexTrack, settings);
      // Should still match but with lower score due to penalty
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });
  });

  describe('Settings Application', () => {
    it('should use custom settings when provided', async () => {
      const tracks: ExternalTrack[] = [
        { title: 'Song', artist: 'Artist' },
      ];

      mockPlexClient.searchTrack = jest.fn().mockResolvedValue([
        {
          ratingKey: '1',
          title: 'Song',
          grandparentTitle: 'Artist',
          parentTitle: 'Album',
          Media: [],
        },
      ]);
      (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => mockPlexClient);

      const customSettings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        minMatchScore: 95,
      };

      const result = await matchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token',
        customSettings
      );

      expect(result).toHaveLength(1);
      // With exact match, should pass even high threshold
      expect(result[0].matched).toBe(true);
    });

    it('should use instance settings when no custom settings provided', async () => {
      const customSettings: MatchingSettings = {
        ...DEFAULT_MATCHING_SETTINGS,
        minMatchScore: 95,
      };

      const customMatchingService = new MatchingService(customSettings);

      const tracks: ExternalTrack[] = [
        { title: 'Song', artist: 'Artist' },
      ];

      mockPlexClient.searchTrack = jest.fn().mockResolvedValue([
        {
          ratingKey: '1',
          title: 'Song',
          grandparentTitle: 'Artist',
          parentTitle: 'Album',
          Media: [],
        },
      ]);
      (PlexClient as jest.MockedClass<typeof PlexClient>).mockImplementation(() => mockPlexClient);

      const result = await customMatchingService.matchPlaylist(
        tracks,
        'http://localhost:32400',
        'test-token'
      );

      expect(result).toHaveLength(1);
      expect(result[0].matched).toBe(true);
    });
  });
});
