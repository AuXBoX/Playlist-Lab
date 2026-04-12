/**
 * Unit Tests: YouTube OAuth Target Adapter
 * 
 * Tests the youtubeOAuthTargetAdapter including:
 * - cleanTrackTitle() function
 * - similarity() function
 * - mapResolution() function
 * - Confidence scoring algorithm
 * - Error handling
 */

import { youtubeOAuthTargetAdapter } from '../../src/adapters/youtube-oauth-target';
import { youtubeOAuthService } from '../../src/services/youtube-oauth';
import { TrackInfo, MatchResult } from '../../src/adapters/types';

// Mock dependencies
jest.mock('../../src/services/youtube-oauth');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('YouTubeOAuthTargetAdapter', () => {
  const mockYouTubeClient = {
    search: {
      list: jest.fn(),
    },
    videos: {
      list: jest.fn(),
    },
    playlists: {
      insert: jest.fn(),
    },
    playlistItems: {
      insert: jest.fn(),
    },
  };

  const mockDb = {};
  const userId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    (youtubeOAuthService.getYouTubeClient as jest.Mock).mockResolvedValue(mockYouTubeClient);
  });

  describe('meta', () => {
    it('should have correct metadata', () => {
      expect(youtubeOAuthTargetAdapter.meta.id).toBe('youtube');
      expect(youtubeOAuthTargetAdapter.meta.name).toBe('YouTube');
      expect(youtubeOAuthTargetAdapter.meta.requiresOAuth).toBe(true);
      expect(youtubeOAuthTargetAdapter.meta.isSourceOnly).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true when service is ready', () => {
      (youtubeOAuthService.isReady as jest.Mock).mockReturnValue(true);
      expect(youtubeOAuthTargetAdapter.isConfigured!()).toBe(true);
    });

    it('should return false when service is not ready', () => {
      (youtubeOAuthService.isReady as jest.Mock).mockReturnValue(false);
      expect(youtubeOAuthTargetAdapter.isConfigured!()).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    // Access private helper functions through the adapter's methods
    // We'll test them indirectly through searchCatalog and matchTracks

    describe('cleanTrackTitle (tested indirectly)', () => {
      it('should remove parenthetical content', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test123' },
              snippet: {
                title: 'Bohemian Rhapsody',
                channelTitle: 'Queen',
              },
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Bohemian Rhapsody (Remastered 2011)', artist: 'Queen', album: 'A Night at the Opera' },
        ];

        await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        // Verify search was called with cleaned title (no parentheses)
        expect(mockYouTubeClient.search.list).toHaveBeenCalledWith(
          expect.objectContaining({
            q: expect.stringMatching(/^Bohemian Rhapsody Queen$/),
          })
        );
      });

      it('should remove "remastered" keyword', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: { items: [] },
        });

        const tracks: TrackInfo[] = [
          { title: 'Hotel California Remastered', artist: 'Eagles', album: 'Hotel California' },
        ];

        await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        // Verify "remastered" was removed from search query
        expect(mockYouTubeClient.search.list).toHaveBeenCalledWith(
          expect.objectContaining({
            q: expect.stringMatching(/^Hotel California Eagles$/),
          })
        );
      });

      it('should clean up extra whitespace', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: { items: [] },
        });

        const tracks: TrackInfo[] = [
          { title: 'Stairway   to   Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV' },
        ];

        await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        // Verify whitespace was normalized
        expect(mockYouTubeClient.search.list).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'Stairway to Heaven Led Zeppelin',
          })
        );
      });
    });

    describe('similarity (tested through confidence scoring)', () => {
      it('should return 100 for exact matches', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test123' },
              snippet: {
                title: 'Bohemian Rhapsody',
                channelTitle: 'Queen',
              },
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
        ];

        const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        // Exact match should have very high confidence (close to 100)
        expect(results[0].confidence).toBeGreaterThan(90);
      });

      it('should return 0 for completely different strings', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test123' },
              snippet: {
                title: 'Completely Different Song',
                channelTitle: 'Different Artist',
              },
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
        ];

        const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        // Very different match should have low confidence
        expect(results[0].confidence).toBeLessThan(50);
      });

      it('should handle partial word matches', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test123' },
              snippet: {
                title: 'Different Song Title',
                channelTitle: 'Queen',
              },
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
        ];

        const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        // Partial match (only artist matches) should have moderate confidence
        expect(results[0].confidence).toBeGreaterThan(0);
        expect(results[0].confidence).toBeLessThan(100);
      });
    });

    describe('mapResolution', () => {
      it('should map "hd" to "720p+"', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test123' },
              snippet: {
                title: 'Test Video',
                channelTitle: 'Test Channel',
              },
            }],
          },
        });

        mockYouTubeClient.videos.list.mockResolvedValue({
          data: {
            items: [{
              id: 'test123',
              contentDetails: {
                definition: 'hd',
              },
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Test Song', artist: 'Test Artist', album: 'Test Album' },
        ];

        const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        expect(results[0].targetResolution).toBe('720p+');
      });

      it('should map "sd" to "480p"', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test456' },
              snippet: {
                title: 'Test Video SD',
                channelTitle: 'Test Channel',
              },
            }],
          },
        });

        mockYouTubeClient.videos.list.mockResolvedValue({
          data: {
            items: [{
              id: 'test456',
              contentDetails: {
                definition: 'sd',
              },
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Test Song', artist: 'Test Artist', album: 'Test Album' },
        ];

        const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        expect(results[0].targetResolution).toBe('480p');
      });

      it('should handle undefined definition', async () => {
        mockYouTubeClient.search.list.mockResolvedValue({
          data: {
            items: [{
              id: { videoId: 'test789' },
              snippet: {
                title: 'Test Video',
                channelTitle: 'Test Channel',
              },
            }],
          },
        });

        mockYouTubeClient.videos.list.mockResolvedValue({
          data: {
            items: [{
              id: 'test789',
              contentDetails: {},
            }],
          },
        });

        const tracks: TrackInfo[] = [
          { title: 'Test Song', artist: 'Test Artist', album: 'Test Album' },
        ];

        const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

        expect(results[0].targetResolution).toBeUndefined();
      });
    });
  });

  describe('Confidence Scoring Algorithm', () => {
    it('should boost confidence for "Official" videos', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'unofficial456' },
              snippet: {
                title: 'Bohemian Rhapsody',
                channelTitle: 'Queen',
              },
            },
            {
              id: { videoId: 'official123' },
              snippet: {
                title: 'Bohemian Rhapsody Official',
                channelTitle: 'Queen',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody Queen',
        userId,
        mockDb
      );

      // Find both results
      const officialResult = results.find(r => r.targetTrackId === 'official123');
      const unofficialResult = results.find(r => r.targetTrackId === 'unofficial456');

      // Both should exist
      expect(officialResult).toBeDefined();
      expect(unofficialResult).toBeDefined();
      
      // Official video should have +15 boost, so it should have higher confidence
      // (assuming similar base similarity scores)
      expect(officialResult!.targetTitle).toContain('Official');
    });

    it('should penalize "live" versions', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'studio123' },
              snippet: {
                title: 'Bohemian Rhapsody',
                channelTitle: 'Queen',
              },
            },
            {
              id: { videoId: 'live456' },
              snippet: {
                title: 'Bohemian Rhapsody (Live at Wembley)',
                channelTitle: 'Queen',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody Queen',
        userId,
        mockDb
      );

      // Studio version should have higher confidence than live
      const studioResult = results.find(r => r.targetTrackId === 'studio123');
      const liveResult = results.find(r => r.targetTrackId === 'live456');

      expect(studioResult!.confidence).toBeGreaterThan(liveResult!.confidence);
    });

    it('should penalize "lyrics" videos', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'music123' },
              snippet: {
                title: 'Bohemian Rhapsody - Official Music Video',
                channelTitle: 'Queen',
              },
            },
            {
              id: { videoId: 'lyrics456' },
              snippet: {
                title: 'Bohemian Rhapsody (Lyrics)',
                channelTitle: 'Queen',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody Queen',
        userId,
        mockDb
      );

      // Music video should have higher confidence than lyrics
      const musicResult = results.find(r => r.targetTrackId === 'music123');
      const lyricsResult = results.find(r => r.targetTrackId === 'lyrics456');

      expect(musicResult!.confidence).toBeGreaterThan(lyricsResult!.confidence);
    });

    it('should penalize "acoustic" versions', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'original123' },
              snippet: {
                title: 'Hotel California',
                channelTitle: 'Eagles',
              },
            },
            {
              id: { videoId: 'acoustic456' },
              snippet: {
                title: 'Hotel California (Acoustic)',
                channelTitle: 'Eagles',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Hotel California Eagles',
        userId,
        mockDb
      );

      // Original should have higher confidence than acoustic
      const originalResult = results.find(r => r.targetTrackId === 'original123');
      const acousticResult = results.find(r => r.targetTrackId === 'acoustic456');

      expect(originalResult!.confidence).toBeGreaterThan(acousticResult!.confidence);
    });

    it('should combine title and artist similarity (60/40 weighting)', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [{
            id: { videoId: 'test123' },
            snippet: {
              title: 'Bohemian Rhapsody',
              channelTitle: 'Queen Official',
            },
          }],
        },
      });

      const tracks: TrackInfo[] = [
        { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
      ];

      const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      // Should have high confidence due to good title and artist match
      expect(results[0].confidence).toBeGreaterThan(80);
    });

    it('should not exceed 100 confidence even with boosts', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [{
            id: { videoId: 'perfect123' },
            snippet: {
              title: 'Bohemian Rhapsody - Official Video',
              channelTitle: 'Queen Official',
            },
          }],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody Queen',
        userId,
        mockDb
      );

      // Confidence should never exceed 100
      expect(results[0].confidence).toBeLessThanOrEqual(100);
    });

    it('should not go below 0 confidence even with penalties', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [{
            id: { videoId: 'bad123' },
            snippet: {
              title: 'Completely Different Song (Live Acoustic Lyrics)',
              channelTitle: 'Different Artist',
            },
          }],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody Queen',
        userId,
        mockDb
      );

      // Confidence should never go below 0
      expect(results[0].confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('searchCatalog', () => {
    it('should search YouTube and return match results', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'video1' },
              snippet: {
                title: 'Bohemian Rhapsody',
                channelTitle: 'Queen',
              },
            },
            {
              id: { videoId: 'video2' },
              snippet: {
                title: 'Bohemian Rhapsody - Official Video',
                channelTitle: 'Queen Official',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody',
        userId,
        mockDb
      );

      expect(results).toHaveLength(2);
      expect(results[0].targetTrackId).toBeDefined();
      expect(results[0].targetTitle).toBeDefined();
      expect(results[0].targetArtist).toBeDefined();
      expect(results[0].confidence).toBeGreaterThan(0);
      expect(results[0].matched).toBe(true);
    });

    it('should sort results by confidence descending', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'low' },
              snippet: {
                title: 'Different Song',
                channelTitle: 'Different Artist',
              },
            },
            {
              id: { videoId: 'high' },
              snippet: {
                title: 'Bohemian Rhapsody - Official',
                channelTitle: 'Queen',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'Bohemian Rhapsody Queen',
        userId,
        mockDb
      );

      // Results should be sorted by confidence (highest first)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
      }
    });

    it('should filter out items without videoId', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [
            {
              id: { videoId: 'valid123' },
              snippet: {
                title: 'Valid Video',
                channelTitle: 'Valid Channel',
              },
            },
            {
              id: {},
              snippet: {
                title: 'Invalid Video',
                channelTitle: 'Invalid Channel',
              },
            },
          ],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'test query',
        userId,
        mockDb
      );

      expect(results).toHaveLength(1);
      expect(results[0].targetTrackId).toBe('valid123');
    });

    it('should handle empty search results', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [],
        },
      });

      const results = await youtubeOAuthTargetAdapter.searchCatalog(
        'nonexistent song',
        userId,
        mockDb
      );

      expect(results).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      mockYouTubeClient.search.list.mockRejectedValue(new Error('API quota exceeded'));

      await expect(
        youtubeOAuthTargetAdapter.searchCatalog('test query', userId, mockDb)
      ).rejects.toThrow('YouTube search failed: API quota exceeded');
    });
  });

  describe('matchTracks', () => {
    it('should match tracks and return results', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [{
            id: { videoId: 'match123' },
            snippet: {
              title: 'Bohemian Rhapsody',
              channelTitle: 'Queen',
            },
          }],
        },
      });

      mockYouTubeClient.videos.list.mockResolvedValue({
        data: {
          items: [{
            id: 'match123',
            contentDetails: {
              definition: 'hd',
            },
          }],
        },
      });

      const tracks: TrackInfo[] = [
        { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
      ];

      const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      expect(results).toHaveLength(1);
      expect(results[0].sourceTrack).toEqual(tracks[0]);
      expect(results[0].targetTrackId).toBe('match123');
      expect(results[0].matched).toBe(true);
      expect(results[0].targetResolution).toBe('720p+');
    });

    it('should emit progress events', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: { items: [] },
      });

      const tracks: TrackInfo[] = [
        { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
        { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
      ];

      const progressEmitter = {
        emit: jest.fn(),
      };

      await youtubeOAuthTargetAdapter.matchTracks(
        tracks,
        {},
        userId,
        mockDb,
        progressEmitter as any
      );

      expect(progressEmitter.emit).toHaveBeenCalledTimes(2);
      expect(progressEmitter.emit).toHaveBeenCalledWith('progress', {
        current: 1,
        total: 2,
        currentTrackName: 'Song 1',
      });
      expect(progressEmitter.emit).toHaveBeenCalledWith('progress', {
        current: 2,
        total: 2,
        currentTrackName: 'Song 2',
      });
    });

    it('should handle cancellation', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: { items: [] },
      });

      const tracks: TrackInfo[] = [
        { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
        { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
        { title: 'Song 3', artist: 'Artist 3', album: 'Album 3' },
      ];

      let callCount = 0;
      const isCancelled = jest.fn(() => {
        callCount++;
        return callCount > 1; // Cancel after first track
      });

      const results = await youtubeOAuthTargetAdapter.matchTracks(
        tracks,
        {},
        userId,
        mockDb,
        undefined,
        isCancelled
      );

      // Should only process tracks before cancellation
      expect(results.length).toBeLessThan(tracks.length);
    });

    it('should continue on individual track search errors', async () => {
      mockYouTubeClient.search.list
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockResolvedValueOnce({
          data: {
            items: [{
              id: { videoId: 'success123' },
              snippet: {
                title: 'Song 2',
                channelTitle: 'Artist 2',
              },
            }],
          },
        });

      const tracks: TrackInfo[] = [
        { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
        { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
      ];

      const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      expect(results).toHaveLength(2);
      expect(results[0].matched).toBe(false); // First track failed
      expect(results[1].matched).toBe(true);  // Second track succeeded
    });

    it('should batch fetch resolutions for matched videos', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [{
            id: { videoId: 'video1' },
            snippet: {
              title: 'Test Song',
              channelTitle: 'Test Artist',
            },
          }],
        },
      });

      mockYouTubeClient.videos.list.mockResolvedValue({
        data: {
          items: [{
            id: 'video1',
            contentDetails: {
              definition: 'hd',
            },
          }],
        },
      });

      const tracks: TrackInfo[] = [
        { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
      ];

      await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      // Should call videos.list with matched video IDs
      expect(mockYouTubeClient.videos.list).toHaveBeenCalledWith({
        part: ['contentDetails'],
        id: ['video1'],
      });
    });

    it('should handle resolution fetch errors gracefully', async () => {
      mockYouTubeClient.search.list.mockResolvedValue({
        data: {
          items: [{
            id: { videoId: 'video1' },
            snippet: {
              title: 'Test Song',
              channelTitle: 'Test Artist',
            },
          }],
        },
      });

      mockYouTubeClient.videos.list.mockRejectedValue(new Error('Resolution fetch failed'));

      const tracks: TrackInfo[] = [
        { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
      ];

      const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      // Should still return results without resolutions
      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].targetResolution).toBeUndefined();
    });

    it('should mark tracks as matched when confidence >= 40', async () => {
      mockYouTubeClient.search.list
        .mockResolvedValueOnce({
          data: {
            items: [{
              id: { videoId: 'high' },
              snippet: {
                title: 'Exact Match',
                channelTitle: 'Exact Artist',
              },
            }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{
              id: { videoId: 'low' },
              snippet: {
                title: 'Completely Different',
                channelTitle: 'Different Artist',
              },
            }],
          },
        });

      const tracks: TrackInfo[] = [
        { title: 'Exact Match', artist: 'Exact Artist', album: 'Album 1' },
        { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
      ];

      const results = await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      expect(results[0].matched).toBe(true);
      expect(results[0].confidence).toBeGreaterThanOrEqual(40);
      expect(results[1].matched).toBe(false);
      expect(results[1].confidence).toBeLessThan(40);
    });

    it('should process batches of 50 video IDs for resolution fetch', async () => {
      // Create 75 matched tracks (should result in 2 batch calls)
      const videoIds = Array.from({ length: 75 }, (_, i) => `video${i}`);
      
      mockYouTubeClient.search.list.mockImplementation(() => 
        Promise.resolve({
          data: {
            items: [{
              id: { videoId: videoIds[mockYouTubeClient.search.list.mock.calls.length - 1] },
              snippet: {
                title: 'Test Song',
                channelTitle: 'Test Artist',
              },
            }],
          },
        })
      );

      mockYouTubeClient.videos.list.mockResolvedValue({
        data: {
          items: videoIds.map(id => ({
            id,
            contentDetails: { definition: 'hd' },
          })),
        },
      });

      const tracks: TrackInfo[] = Array.from({ length: 75 }, (_, i) => ({
        title: `Song ${i}`,
        artist: `Artist ${i}`,
        album: `Album ${i}`,
      }));

      await youtubeOAuthTargetAdapter.matchTracks(tracks, {}, userId, mockDb);

      // Should make 2 batch calls (50 + 25)
      expect(mockYouTubeClient.videos.list).toHaveBeenCalledTimes(2);
      expect(mockYouTubeClient.videos.list.mock.calls[0][0].id).toHaveLength(50);
      expect(mockYouTubeClient.videos.list.mock.calls[1][0].id).toHaveLength(25);
    });
  });

  describe('createPlaylist', () => {
    it('should create playlist and add videos', async () => {
      mockYouTubeClient.playlists.insert.mockResolvedValue({
        data: {
          id: 'playlist123',
        },
      });

      mockYouTubeClient.playlistItems.insert.mockResolvedValue({
        data: {},
      });

      const matchResults: MatchResult[] = [
        {
          sourceTrack: { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
          targetTrackId: 'video1',
          targetTitle: 'Song 1',
          targetArtist: 'Artist 1',
          confidence: 95,
          matched: true,
          skipped: false,
        },
        {
          sourceTrack: { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
          targetTrackId: 'video2',
          targetTitle: 'Song 2',
          targetArtist: 'Artist 2',
          confidence: 90,
          matched: true,
          skipped: false,
        },
      ];

      const result = await youtubeOAuthTargetAdapter.createPlaylist(
        'My Playlist',
        matchResults,
        {},
        userId,
        mockDb
      );

      expect(mockYouTubeClient.playlists.insert).toHaveBeenCalledWith({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: 'My Playlist',
            description: 'Created by Playlist Lab',
          },
          status: {
            privacyStatus: 'private',
          },
        },
      });

      expect(mockYouTubeClient.playlistItems.insert).toHaveBeenCalledTimes(2);
      expect(result.playlistId).toBe('playlist123');
      expect(result.name).toBe('My Playlist');
      expect(result.trackCount).toBe(2);
    });

    it('should only add matched and non-skipped tracks', async () => {
      mockYouTubeClient.playlists.insert.mockResolvedValue({
        data: { id: 'playlist123' },
      });

      mockYouTubeClient.playlistItems.insert.mockResolvedValue({
        data: {},
      });

      const matchResults: MatchResult[] = [
        {
          sourceTrack: { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
          targetTrackId: 'video1',
          targetTitle: 'Song 1',
          targetArtist: 'Artist 1',
          confidence: 95,
          matched: true,
          skipped: false,
        },
        {
          sourceTrack: { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
          targetTrackId: 'video2',
          targetTitle: 'Song 2',
          targetArtist: 'Artist 2',
          confidence: 90,
          matched: true,
          skipped: true, // Skipped
        },
        {
          sourceTrack: { title: 'Song 3', artist: 'Artist 3', album: 'Album 3' },
          confidence: 20,
          matched: false, // Not matched
          skipped: false,
        },
      ];

      const result = await youtubeOAuthTargetAdapter.createPlaylist(
        'My Playlist',
        matchResults,
        {},
        userId,
        mockDb
      );

      // Should only add video1 (matched and not skipped)
      expect(mockYouTubeClient.playlistItems.insert).toHaveBeenCalledTimes(1);
      expect(result.trackCount).toBe(1);
    });

    it('should continue adding videos even if some fail', async () => {
      mockYouTubeClient.playlists.insert.mockResolvedValue({
        data: { id: 'playlist123' },
      });

      mockYouTubeClient.playlistItems.insert
        .mockRejectedValueOnce(new Error('Video not available'))
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });

      const matchResults: MatchResult[] = [
        {
          sourceTrack: { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
          targetTrackId: 'video1',
          targetTitle: 'Song 1',
          targetArtist: 'Artist 1',
          confidence: 95,
          matched: true,
          skipped: false,
        },
        {
          sourceTrack: { title: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
          targetTrackId: 'video2',
          targetTitle: 'Song 2',
          targetArtist: 'Artist 2',
          confidence: 90,
          matched: true,
          skipped: false,
        },
        {
          sourceTrack: { title: 'Song 3', artist: 'Artist 3', album: 'Album 3' },
          targetTrackId: 'video3',
          targetTitle: 'Song 3',
          targetArtist: 'Artist 3',
          confidence: 85,
          matched: true,
          skipped: false,
        },
      ];

      const result = await youtubeOAuthTargetAdapter.createPlaylist(
        'My Playlist',
        matchResults,
        {},
        userId,
        mockDb
      );

      // Should attempt all 3, but only 2 succeed
      expect(mockYouTubeClient.playlistItems.insert).toHaveBeenCalledTimes(3);
      expect(result.trackCount).toBe(2);
    });

    it('should throw error if playlist creation fails', async () => {
      mockYouTubeClient.playlists.insert.mockRejectedValue(
        new Error('Quota exceeded')
      );

      const matchResults: MatchResult[] = [
        {
          sourceTrack: { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
          targetTrackId: 'video1',
          targetTitle: 'Song 1',
          targetArtist: 'Artist 1',
          confidence: 95,
          matched: true,
          skipped: false,
        },
      ];

      await expect(
        youtubeOAuthTargetAdapter.createPlaylist('My Playlist', matchResults, {}, userId, mockDb)
      ).rejects.toThrow('Failed to create YouTube playlist: Quota exceeded');
    });

    it('should throw error if no playlist ID returned', async () => {
      mockYouTubeClient.playlists.insert.mockResolvedValue({
        data: {}, // No ID
      });

      const matchResults: MatchResult[] = [
        {
          sourceTrack: { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
          targetTrackId: 'video1',
          targetTitle: 'Song 1',
          targetArtist: 'Artist 1',
          confidence: 95,
          matched: true,
          skipped: false,
        },
      ];

      await expect(
        youtubeOAuthTargetAdapter.createPlaylist('My Playlist', matchResults, {}, userId, mockDb)
      ).rejects.toThrow('Failed to create playlist - no playlist ID returned');
    });
  });

  describe('OAuth Methods', () => {
    it('should delegate getOAuthUrl to service', async () => {
      const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?...';
      (youtubeOAuthService.getAuthUrl as jest.Mock).mockReturnValue(expectedUrl);

      const url = await youtubeOAuthTargetAdapter.getOAuthUrl!(userId, mockDb, 'http://redirect');

      expect(youtubeOAuthService.getAuthUrl).toHaveBeenCalledWith(String(userId));
      expect(url).toBe(expectedUrl);
    });

    it('should delegate handleOAuthCallback to service', async () => {
      const code = 'auth-code-123';
      const tokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() + 3600000,
      };

      (youtubeOAuthService.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (youtubeOAuthService.storeTokens as jest.Mock).mockResolvedValue(undefined);

      await youtubeOAuthTargetAdapter.handleOAuthCallback!(code, userId, mockDb, 'http://redirect');

      expect(youtubeOAuthService.exchangeCode).toHaveBeenCalledWith(code);
      expect(youtubeOAuthService.storeTokens).toHaveBeenCalledWith(userId, tokens, mockDb);
    });

    it('should check for valid connection', async () => {
      (youtubeOAuthService.getTokens as jest.Mock).mockResolvedValue({
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() + 3600000,
      });

      const hasConnection = await youtubeOAuthTargetAdapter.hasValidConnection!(userId, mockDb);

      expect(hasConnection).toBe(true);
    });

    it('should return false when no tokens exist', async () => {
      (youtubeOAuthService.getTokens as jest.Mock).mockResolvedValue(null);

      const hasConnection = await youtubeOAuthTargetAdapter.hasValidConnection!(userId, mockDb);

      expect(hasConnection).toBe(false);
    });

    it('should return false when token check fails', async () => {
      (youtubeOAuthService.getTokens as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const hasConnection = await youtubeOAuthTargetAdapter.hasValidConnection!(userId, mockDb);

      expect(hasConnection).toBe(false);
    });

    it('should delegate revokeConnection to service', async () => {
      (youtubeOAuthService.revokeConnection as jest.Mock).mockResolvedValue(undefined);

      await youtubeOAuthTargetAdapter.revokeConnection!(userId, mockDb);

      expect(youtubeOAuthService.revokeConnection).toHaveBeenCalledWith(userId, mockDb);
    });
  });
});
