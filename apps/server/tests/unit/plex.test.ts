/**
 * Unit Tests for Plex API Client
 * 
 * Tests all Plex client methods:
 * - searchTrack
 * - getLibraries
 * - getPlayHistory
 * - createPlaylist
 * - getPlaylistTracks
 * - addToPlaylist
 * - removeFromPlaylist
 * - deletePlaylist
 */

import axios from 'axios';
import { PlexClient } from '../../src/services/plex';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PlexClient', () => {
  let client: PlexClient;
  const serverUrl = 'http://localhost:32400';
  const token = 'test-token';
  const clientId = 'test-client';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock axios instance
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    client = new PlexClient(serverUrl, token, clientId);
  });

  describe('searchTrack', () => {
    it('should search for tracks in a specific library', async () => {
      const mockTracks = [
        {
          ratingKey: '123',
          title: 'Test Track',
          grandparentTitle: 'Test Artist',
          parentTitle: 'Test Album',
          type: 'track',
        },
      ];

      const mockResponse = {
        data: {
          MediaContainer: {
            size: 1,
            Metadata: mockTracks,
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.searchTrack('test query', '1');

      expect(mockInstance.get).toHaveBeenCalledWith(
        '/library/sections/1/search',
        {
          params: {
            query: 'test query',
            type: 10,
          },
        }
      );
      expect(result).toEqual(mockTracks);
    });

    it('should search globally using hub search when no library specified', async () => {
      const mockTracks = [
        {
          ratingKey: '456',
          title: 'Another Track',
          grandparentTitle: 'Another Artist',
          parentTitle: 'Another Album',
          type: 'track',
        },
      ];

      const mockResponse = {
        data: {
          MediaContainer: {
            size: 1,
            Hub: [
              {
                type: 'track',
                Metadata: mockTracks,
              },
            ],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.searchTrack('test query');

      expect(mockInstance.get).toHaveBeenCalledWith('/hubs/search', {
        params: {
          query: 'test query',
          type: 10,
        },
      });
      expect(result).toEqual(mockTracks);
    });

    it('should return empty array when no tracks found', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            size: 0,
            Metadata: [],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.searchTrack('nonexistent', '1');

      expect(result).toEqual([]);
    });

    it('should throw error when server is unreachable', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Network Error');
      error.code = 'ECONNREFUSED';
      error.isAxiosError = true;
      mockInstance.get.mockRejectedValue(error);

      await expect(client.searchTrack('test')).rejects.toThrow(
        'Plex server is unreachable'
      );
    });

    it('should throw error when token is invalid', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Unauthorized');
      error.isAxiosError = true;
      error.response = { status: 401 };
      mockInstance.get.mockRejectedValue(error);

      await expect(client.searchTrack('test')).rejects.toThrow('Invalid Plex token');
    });
  });

  describe('getLibraries', () => {
    it('should return only music libraries', async () => {
      const mockLibraries = [
        {
          key: '1',
          title: 'Music',
          type: 'artist',
          agent: 'com.plexapp.agents.lastfm',
          scanner: 'Plex Music Scanner',
          language: 'en',
          uuid: 'uuid-1',
          updatedAt: 1234567890,
          createdAt: 1234567890,
          scannedAt: 1234567890,
          content: true,
          directory: true,
          contentChangedAt: 1234567890,
          hidden: 0,
        },
        {
          key: '2',
          title: 'Movies',
          type: 'movie',
          agent: 'com.plexapp.agents.imdb',
          scanner: 'Plex Movie Scanner',
          language: 'en',
          uuid: 'uuid-2',
          updatedAt: 1234567890,
          createdAt: 1234567890,
          scannedAt: 1234567890,
          content: true,
          directory: true,
          contentChangedAt: 1234567890,
          hidden: 0,
        },
      ];

      const mockResponse = {
        data: {
          MediaContainer: {
            size: 2,
            Directory: mockLibraries,
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getLibraries();

      expect(mockInstance.get).toHaveBeenCalledWith('/library/sections');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('artist');
      expect(result[0].title).toBe('Music');
    });

    it('should return empty array when no music libraries exist', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            size: 0,
            Directory: [],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getLibraries();

      expect(result).toEqual([]);
    });

    it('should throw error when server is unreachable', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Network Error');
      error.code = 'ETIMEDOUT';
      error.isAxiosError = true;
      mockInstance.get.mockRejectedValue(error);

      await expect(client.getLibraries()).rejects.toThrow(
        'Plex server is unreachable'
      );
    });
  });

  describe('getPlayHistory', () => {
    it('should return play history for a library', async () => {
      const mockHistory = [
        {
          historyKey: '1',
          key: '/library/metadata/123',
          ratingKey: '123',
          title: 'Test Track',
          type: 'track',
          thumb: '/library/metadata/123/thumb',
          parentThumb: '/library/metadata/122/thumb',
          grandparentThumb: '/library/metadata/121/thumb',
          grandparentTitle: 'Test Artist',
          parentTitle: 'Test Album',
          index: 1,
          parentIndex: 1,
          viewedAt: 1234567890,
          accountID: 1,
          deviceID: 1,
        },
      ];

      const mockResponse = {
        data: {
          MediaContainer: {
            size: 1,
            Metadata: mockHistory,
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getPlayHistory('1', 50);

      expect(mockInstance.get).toHaveBeenCalledWith(
        '/status/sessions/history/all',
        {
          params: {
            librarySectionID: '1',
            'X-Plex-Container-Size': 50,
          },
        }
      );
      expect(result).toEqual(mockHistory);
    });

    it('should use default limit of 100 when not specified', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            size: 0,
            Metadata: [],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      await client.getPlayHistory('1');

      expect(mockInstance.get).toHaveBeenCalledWith(
        '/status/sessions/history/all',
        {
          params: {
            librarySectionID: '1',
            'X-Plex-Container-Size': 100,
          },
        }
      );
    });

    it('should return empty array when no history exists', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            size: 0,
            Metadata: [],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getPlayHistory('1');

      expect(result).toEqual([]);
    });
  });

  describe('createPlaylist', () => {
    it('should create a playlist with tracks', async () => {
      const mockPlaylist = {
        ratingKey: '999',
        key: '/playlists/999',
        guid: 'com.plexapp.agents.none://playlist-999',
        type: 'playlist',
        title: 'Test Playlist',
        summary: '',
        smart: false,
        playlistType: 'audio',
        composite: '/playlists/999/composite',
        duration: 180000,
        leafCount: 2,
        addedAt: 1234567890,
        updatedAt: 1234567890,
      };

      const mockCreateResponse = {
        data: {
          MediaContainer: {
            size: 1,
            Metadata: [mockPlaylist],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.post.mockResolvedValue(mockCreateResponse);
      mockInstance.put.mockResolvedValue({ data: {} });

      const trackUris = [
        'server://localhost:32400/com.plexapp.plugins.library/library/metadata/123',
        'server://localhost:32400/com.plexapp.plugins.library/library/metadata/124',
      ];

      const result = await client.createPlaylist(
        'Test Playlist',
        'server://localhost:32400/com.plexapp.plugins.library/library/sections/1/all?type=10',
        trackUris
      );

      expect(mockInstance.post).toHaveBeenCalledWith('/playlists', null, {
        params: {
          type: 'audio',
          title: 'Test Playlist',
          smart: 0,
          uri: 'server://localhost:32400/com.plexapp.plugins.library/library/sections/1/all?type=10',
        },
      });

      expect(mockInstance.put).toHaveBeenCalledWith(
        '/playlists/999/items',
        null,
        {
          params: {
            uri: trackUris.join(','),
          },
        }
      );

      expect(result).toEqual(mockPlaylist);
    });

    it('should create empty playlist when no tracks provided', async () => {
      const mockPlaylist = {
        ratingKey: '999',
        title: 'Empty Playlist',
        leafCount: 0,
      };

      const mockCreateResponse = {
        data: {
          MediaContainer: {
            size: 1,
            Metadata: [mockPlaylist],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.post.mockResolvedValue(mockCreateResponse);

      const result = await client.createPlaylist(
        'Empty Playlist',
        'server://localhost:32400/com.plexapp.plugins.library/library/sections/1/all?type=10',
        []
      );

      expect(mockInstance.post).toHaveBeenCalled();
      expect(mockInstance.put).not.toHaveBeenCalled();
      expect(result).toEqual(mockPlaylist);
    });

    it('should throw error when playlist creation fails', async () => {
      const mockCreateResponse = {
        data: {
          MediaContainer: {
            size: 0,
            Metadata: [],
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.post.mockResolvedValue(mockCreateResponse);

      await expect(
        client.createPlaylist('Test', 'uri', [])
      ).rejects.toThrow('Failed to create playlist - no playlist returned');
    });
  });

  describe('getPlaylistTracks', () => {
    it('should return tracks from a playlist', async () => {
      const mockTracks = [
        {
          ratingKey: '123',
          title: 'Track 1',
          grandparentTitle: 'Artist 1',
          parentTitle: 'Album 1',
        },
        {
          ratingKey: '124',
          title: 'Track 2',
          grandparentTitle: 'Artist 2',
          parentTitle: 'Album 2',
        },
      ];

      const mockResponse = {
        data: {
          MediaContainer: {
            size: 2,
            Metadata: mockTracks,
          },
        },
      };

      const mockInstance = mockedAxios.create() as any;
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getPlaylistTracks('999');

      expect(mockInstance.get).toHaveBeenCalledWith('/playlists/999/items');
      expect(result).toEqual(mockTracks);
    });

    it('should throw error when playlist not found', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Not Found');
      error.isAxiosError = true;
      error.response = { status: 404 };
      mockInstance.get.mockRejectedValue(error);

      await expect(client.getPlaylistTracks('999')).rejects.toThrow(
        'Playlist not found'
      );
    });
  });

  describe('addToPlaylist', () => {
    it('should add tracks to a playlist', async () => {
      const mockInstance = mockedAxios.create() as any;
      mockInstance.put.mockResolvedValue({ data: {} });

      const trackUris = [
        'server://localhost:32400/com.plexapp.plugins.library/library/metadata/123',
        'server://localhost:32400/com.plexapp.plugins.library/library/metadata/124',
      ];

      await client.addToPlaylist('999', trackUris);

      expect(mockInstance.put).toHaveBeenCalledWith(
        '/playlists/999/items',
        null,
        {
          params: {
            uri: trackUris.join(','),
          },
        }
      );
    });

    it('should throw error when playlist not found', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Not Found');
      error.isAxiosError = true;
      error.response = { status: 404 };
      mockInstance.put.mockRejectedValue(error);

      await expect(client.addToPlaylist('999', ['uri'])).rejects.toThrow(
        'Playlist not found'
      );
    });
  });

  describe('removeFromPlaylist', () => {
    it('should remove a track from a playlist', async () => {
      const mockInstance = mockedAxios.create() as any;
      mockInstance.delete.mockResolvedValue({ data: {} });

      await client.removeFromPlaylist('999', '123');

      expect(mockInstance.delete).toHaveBeenCalledWith(
        '/playlists/999/items/123'
      );
    });

    it('should throw error when playlist or item not found', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Not Found');
      error.isAxiosError = true;
      error.response = { status: 404 };
      mockInstance.delete.mockRejectedValue(error);

      await expect(client.removeFromPlaylist('999', '123')).rejects.toThrow(
        'Playlist or item not found'
      );
    });
  });

  describe('deletePlaylist', () => {
    it('should delete a playlist', async () => {
      const mockInstance = mockedAxios.create() as any;
      mockInstance.delete.mockResolvedValue({ data: {} });

      await client.deletePlaylist('999');

      expect(mockInstance.delete).toHaveBeenCalledWith('/playlists/999');
    });

    it('should throw error when playlist not found', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Not Found');
      error.isAxiosError = true;
      error.response = { status: 404 };
      mockInstance.delete.mockRejectedValue(error);

      await expect(client.deletePlaylist('999')).rejects.toThrow(
        'Playlist not found'
      );
    });

    it('should throw error when server is unreachable', async () => {
      const mockInstance = mockedAxios.create() as any;
      const error: any = new Error('Network Error');
      error.code = 'ECONNREFUSED';
      error.isAxiosError = true;
      mockInstance.delete.mockRejectedValue(error);

      await expect(client.deletePlaylist('999')).rejects.toThrow(
        'Plex server is unreachable'
      );
    });
  });

  describe('URI builders', () => {
    it('should build track URI correctly', () => {
      const uri = client.buildTrackUri('123');
      expect(uri).toBe(
        'server://http://localhost:32400/com.plexapp.plugins.library/library/metadata/123'
      );
    });

    it('should build library URI correctly', () => {
      const uri = client.buildLibraryUri('1');
      expect(uri).toBe(
        'server://http://localhost:32400/com.plexapp.plugins.library/library/sections/1/all?type=10'
      );
    });
  });
});
