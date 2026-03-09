/**
 * Unit tests for external service scrapers
 */

import axios from 'axios';
import {
  scrapeDeezerPlaylist,
  getDeezerCharts,
  scrapeSpotifyPlaylist,
  scrapeAppleMusicPlaylist,
  scrapeTidalPlaylist,
  scrapeYouTubeMusicPlaylist,
  scrapeAmazonMusicPlaylist,
  scrapeQobuzPlaylist,
  getListenBrainzPlaylists,
  scrapeAriaCharts,
  parseM3UFile,
} from '../../src/services/scrapers';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Scrapers Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scrapeDeezerPlaylist', () => {
    it('should scrape a Deezer playlist successfully', async () => {
      const mockResponse = {
        data: {
          id: '123',
          title: 'Test Playlist',
          description: 'Test Description',
          tracks: {
            data: [
              {
                title: 'Track 1',
                artist: { name: 'Artist 1' },
                album: { title: 'Album 1' },
              },
              {
                title: 'Track 2',
                artist: { name: 'Artist 2' },
                album: { title: 'Album 2' },
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await scrapeDeezerPlaylist('123');

      expect(result).toEqual({
        id: 'deezer-123',
        name: 'Test Playlist',
        description: 'Test Description',
        source: 'deezer',
        tracks: [
          { title: 'Track 1', artist: 'Artist 1', album: 'Album 1' },
          { title: 'Track 2', artist: 'Artist 2', album: 'Album 2' },
        ],
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('https://api.deezer.com/playlist/123');
    });

    it('should handle missing artist names', async () => {
      const mockResponse = {
        data: {
          id: '123',
          title: 'Test Playlist',
          description: '',
          tracks: {
            data: [
              {
                title: 'Track 1',
                artist: {},
                album: { title: 'Album 1' },
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await scrapeDeezerPlaylist('123');

      expect(result.tracks[0].artist).toBe('Unknown');
    });

    it('should throw error on invalid response', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} });

      await expect(scrapeDeezerPlaylist('123')).rejects.toThrow('Invalid Deezer playlist response');
    });

    it('should throw error on network failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(scrapeDeezerPlaylist('123')).rejects.toThrow('Failed to scrape Deezer playlist');
    });
  });

  describe('getDeezerCharts', () => {
    it('should fetch global charts', async () => {
      const mockTopResponse = {
        data: {
          data: [
            {
              title: 'Top Track 1',
              artist: { name: 'Artist 1' },
              album: { title: 'Album 1' },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockTopResponse);

      const result = await getDeezerCharts('global');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('deezer-top-global');
      expect(result[0].name).toBe('Top 50 Global');
      expect(result[0].tracks).toHaveLength(1);
    });

    it('should fetch country-specific charts', async () => {
      const mockTopResponse = {
        data: {
          data: [
            {
              title: 'Top Track 1',
              artist: { name: 'Artist 1' },
              album: { title: 'Album 1' },
            },
          ],
        },
      };

      const mockSearchResponse = {
        data: {
          data: [
            {
              id: '456',
              title: 'Top 50 United States',
            },
          ],
        },
      };

      const mockPlaylistResponse = {
        data: {
          data: [
            {
              title: 'US Track 1',
              artist: { name: 'US Artist 1' },
              album: { title: 'US Album 1' },
            },
          ],
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockTopResponse)
        .mockResolvedValueOnce(mockSearchResponse)
        .mockResolvedValueOnce(mockPlaylistResponse);

      const result = await getDeezerCharts('us');

      expect(result).toHaveLength(2);
      expect(result[1].id).toBe('deezer-top-us');
      expect(result[1].name).toBe('Top 50 United States');
    });

    it('should handle errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await getDeezerCharts('global');

      expect(result).toEqual([]);
    });
  });

  describe('scrapeSpotifyPlaylist', () => {
    it('should throw error indicating API integration needed', async () => {
      await expect(scrapeSpotifyPlaylist('https://open.spotify.com/playlist/abc123')).rejects.toThrow(
        'Spotify scraping requires Web API integration'
      );
    });

    it('should throw error on invalid URL', async () => {
      await expect(scrapeSpotifyPlaylist('https://invalid-url.com')).rejects.toThrow(
        'Invalid Spotify playlist URL'
      );
    });
  });

  describe('scrapeAppleMusicPlaylist', () => {
    it('should throw error indicating JavaScript rendering needed', async () => {
      await expect(scrapeAppleMusicPlaylist('https://music.apple.com/playlist/abc')).rejects.toThrow(
        'Apple Music scraping requires JavaScript rendering'
      );
    });
  });

  describe('scrapeTidalPlaylist', () => {
    it('should throw error indicating API integration needed', async () => {
      await expect(scrapeTidalPlaylist('https://tidal.com/playlist/abc-123')).rejects.toThrow(
        'Tidal scraping requires API integration'
      );
    });

    it('should throw error on invalid URL', async () => {
      await expect(scrapeTidalPlaylist('https://invalid-url.com')).rejects.toThrow(
        'Invalid Tidal playlist URL'
      );
    });
  });

  describe('scrapeYouTubeMusicPlaylist', () => {
    it('should throw error indicating JavaScript rendering needed', async () => {
      await expect(scrapeYouTubeMusicPlaylist('https://music.youtube.com/playlist?list=abc')).rejects.toThrow(
        'YouTube Music scraping requires JavaScript rendering'
      );
    });
  });

  describe('scrapeAmazonMusicPlaylist', () => {
    it('should throw error indicating JavaScript rendering needed', async () => {
      await expect(scrapeAmazonMusicPlaylist('https://music.amazon.com/playlist/abc')).rejects.toThrow(
        'Amazon Music scraping requires JavaScript rendering'
      );
    });
  });

  describe('scrapeQobuzPlaylist', () => {
    it('should throw error indicating JavaScript rendering needed', async () => {
      await expect(scrapeQobuzPlaylist('https://www.qobuz.com/playlist/abc')).rejects.toThrow(
        'Qobuz scraping requires JavaScript rendering'
      );
    });
  });

  describe('getListenBrainzPlaylists', () => {
    it('should fetch ListenBrainz playlists successfully', async () => {
      const mockPlaylistsResponse = {
        data: {
          playlists: [
            {
              identifier: 'playlist-1',
            },
          ],
        },
      };

      const mockPlaylistDetailsResponse = {
        data: {
          playlist: {
            title: 'My Playlist',
            annotation: 'Test playlist',
            track: [
              {
                title: 'Track 1',
                creator: 'Artist 1',
              },
              {
                title: 'Track 2',
                creator: 'Artist 2',
              },
            ],
          },
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockPlaylistsResponse)
        .mockResolvedValueOnce(mockPlaylistDetailsResponse);

      const result = await getListenBrainzPlaylists('testuser');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'listenbrainz-playlist-1',
        name: 'My Playlist',
        description: 'Test playlist',
        source: 'listenbrainz',
        tracks: [
          { title: 'Track 1', artist: 'Artist 1' },
          { title: 'Track 2', artist: 'Artist 2' },
        ],
      });
    });

    it('should handle missing track data', async () => {
      const mockPlaylistsResponse = {
        data: {
          playlists: [
            {
              identifier: 'playlist-1',
            },
          ],
        },
      };

      const mockPlaylistDetailsResponse = {
        data: {
          playlist: {
            title: 'My Playlist',
            annotation: '',
            track: [
              {
                title: null,
                creator: null,
              },
            ],
          },
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockPlaylistsResponse)
        .mockResolvedValueOnce(mockPlaylistDetailsResponse);

      const result = await getListenBrainzPlaylists('testuser');

      expect(result[0].tracks[0]).toEqual({
        title: 'Unknown',
        artist: 'Unknown',
      });
    });

    it('should handle errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(getListenBrainzPlaylists('testuser')).rejects.toThrow(
        'Failed to fetch ListenBrainz playlists'
      );
    });

    it('should skip playlists that fail to fetch', async () => {
      const mockPlaylistsResponse = {
        data: {
          playlists: [
            { identifier: 'playlist-1' },
            { identifier: 'playlist-2' },
          ],
        },
      };

      const mockPlaylistDetailsResponse = {
        data: {
          playlist: {
            title: 'My Playlist',
            annotation: '',
            track: [{ title: 'Track 1', creator: 'Artist 1' }],
          },
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockPlaylistsResponse)
        .mockRejectedValueOnce(new Error('Playlist not found'))
        .mockResolvedValueOnce(mockPlaylistDetailsResponse);

      const result = await getListenBrainzPlaylists('testuser');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('listenbrainz-playlist-2');
    });
  });

  describe('scrapeAriaCharts', () => {
    it('should throw error indicating HTML parsing needed', async () => {
      await expect(scrapeAriaCharts()).rejects.toThrow('ARIA charts scraping requires HTML parsing');
    });
  });

  describe('parseM3UFile', () => {
    it('should parse M3U file with EXTINF tags (standard format)', () => {
      const content = `#EXTM3U
#EXTINF:180,Artist 1 - Track 1
/path/to/track1.mp3
#EXTINF:200,Artist 2 - Track 2
/path/to/track2.mp3`;

      const result = parseM3UFile(content, 'test.m3u');

      expect(result.name).toBe('test.m3u');
      expect(result.source).toBe('file');
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0]).toEqual({
        title: 'Track 1',
        artist: 'Artist 1',
      });
      expect(result.tracks[1]).toEqual({
        title: 'Track 2',
        artist: 'Artist 2',
      });
    });

    it('should parse M3U file with Apple Music format (Title - Artist)', () => {
      const content = `#EXTM3U
#EXTINF:232,Happy (From "Despicable Me 2") - Pharrell Williams
/path/to/track1.m4a
#EXTINF:215,Cool Kids (Radio Edit) - Echosmith
/path/to/track2.m4a
#EXTINF:180,Shake It Off - Taylor Swift
/path/to/track3.m4a`;

      const result = parseM3UFile(content, 'apple-playlist.m3u');

      expect(result.tracks).toHaveLength(3);
      expect(result.tracks[0]).toEqual({
        title: 'Happy (From "Despicable Me 2")',
        artist: 'Pharrell Williams',
      });
      expect(result.tracks[1]).toEqual({
        title: 'Cool Kids (Radio Edit)',
        artist: 'Echosmith',
      });
      expect(result.tracks[2]).toEqual({
        title: 'Shake It Off',
        artist: 'Taylor Swift',
      });
    });

    it('should parse M3U file without EXTINF tags', () => {
      const content = `#EXTM3U
Artist 1 - Track 1.mp3
Artist 2 - Track 2.mp3`;

      const result = parseM3UFile(content, 'test.m3u');

      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0]).toEqual({
        title: 'Track 1',
        artist: 'Artist 1',
      });
    });

    it('should handle tracks without artist separator', () => {
      const content = `#EXTM3U
#EXTINF:180,Track Without Artist
/path/to/track.mp3`;

      const result = parseM3UFile(content, 'test.m3u');

      expect(result.tracks[0]).toEqual({
        title: 'Track Without Artist',
        artist: 'Unknown',
      });
    });

    it('should handle empty lines and comments', () => {
      const content = `#EXTM3U
# This is a comment

#EXTINF:180,Artist 1 - Track 1
/path/to/track1.mp3

# Another comment
#EXTINF:200,Artist 2 - Track 2
/path/to/track2.mp3`;

      const result = parseM3UFile(content, 'test.m3u');

      expect(result.tracks).toHaveLength(2);
    });

    it('should handle Windows-style line endings', () => {
      const content = '#EXTM3U\r\n#EXTINF:180,Artist 1 - Track 1\r\n/path/to/track1.mp3';

      const result = parseM3UFile(content, 'test.m3u');

      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].title).toBe('Track 1');
    });

    it('should handle file paths with multiple separators using lastIndexOf', () => {
      const content = `#EXTM3U
#EXTINF:180,Artist - With - Dashes - Track - Title - With - More
/path/to/track.mp3`;

      const result = parseM3UFile(content, 'test.m3u');

      expect(result.tracks[0]).toEqual({
        title: 'Track - Title - With - More',
        artist: 'Artist - With - Dashes',
      });
    });

    it('should detect mixed format and default to standard when ambiguous', () => {
      const content = `#EXTM3U
#EXTINF:180,Some Artist - Some Track
/path/to/track1.mp3
#EXTINF:200,Another Artist - Another Track
/path/to/track2.mp3`;

      const result = parseM3UFile(content, 'test.m3u');

      // Should use standard format (Artist - Title) when detection is ambiguous
      expect(result.tracks[0]).toEqual({
        title: 'Some Track',
        artist: 'Some Artist',
      });
    });
  });
});
