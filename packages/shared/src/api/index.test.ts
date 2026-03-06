import { APIClient, APIError, NetworkError } from './index';

// Mock fetch globally
global.fetch = jest.fn();

describe('APIClient', () => {
  let client: APIClient;
  const baseURL = 'http://localhost:3000';
  const mockToken = 'test-token';

  beforeEach(() => {
    client = new APIClient(baseURL, () => mockToken);
    jest.clearAllMocks();
  });

  describe('Error Handling', () => {
    it('should throw APIError on non-ok response', async () => {
      const mockError = {
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          statusCode: 400,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockError),
      });

      await expect(client.getMe()).rejects.toThrow(APIError);
      
      // Reset mock for second call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockError),
      });
      
      await expect(client.getMe()).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: 'Test error message',
        statusCode: 400,
      });
    });

    it('should throw NetworkError on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Network error')
      );

      await expect(client.getMe()).rejects.toThrow(NetworkError);
    });

    it('should handle malformed error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      });

      await expect(client.getMe()).rejects.toThrow(APIError);
      
      // Reset mock for second call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      });
      
      await expect(client.getMe()).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
      });
    });
  });

  describe('Auth Methods', () => {
    it('should start auth', async () => {
      const mockResponse = {
        id: 123,
        code: 'ABC123',
        expiresAt: '2024-01-01T00:00:00Z',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await client.startAuth();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/auth/start`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should poll auth', async () => {
      const mockResponse = {
        authToken: 'token123',
        user: { id: 1, plexUserId: 'user123' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await client.pollAuth(123, 'ABC123');
      expect(result).toEqual(mockResponse);
    });

    it('should logout', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.logout();
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/auth/logout`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should get current user', async () => {
      const mockUser = {
        id: 1,
        plexUserId: 'user123',
        plexUsername: 'testuser',
        plexToken: 'token',
        createdAt: Date.now(),
        lastLogin: Date.now(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockUser),
      });

      const result = await client.getMe();
      expect(result).toEqual(mockUser);
    });
  });

  describe('Server Methods', () => {
    it('should get servers', async () => {
      const mockServers = [
        { name: 'Server1', clientId: 'id1', url: 'http://server1' },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockServers),
      });

      const result = await client.getServers();
      expect(result).toEqual(mockServers);
    });

    it('should select server', async () => {
      const server = { name: 'Server1', clientId: 'id1', url: 'http://server1' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.selectServer(server);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/servers/select`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(server),
        })
      );
    });
  });

  describe('Settings Methods', () => {
    it('should get settings', async () => {
      const mockSettings = {
        country: 'US',
        matchingSettings: { minMatchScore: 0.8 },
        mixSettings: { weeklyMix: { topArtists: 5, tracksPerArtist: 10 } },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSettings),
      });

      const result = await client.getSettings();
      expect(result).toEqual(mockSettings);
    });

    it('should update settings', async () => {
      const updates = { country: 'UK' };
      const mockResponse = {
        country: 'UK',
        matchingSettings: {},
        mixSettings: {},
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await client.updateSettings(updates);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Playlist Methods', () => {
    it('should get playlists', async () => {
      const mockPlaylists = [
        {
          id: 1,
          userId: 1,
          plexPlaylistId: 'pl1',
          name: 'Test Playlist',
          source: 'spotify',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPlaylists),
      });

      const result = await client.getPlaylists();
      expect(result).toEqual(mockPlaylists);
    });

    it('should create playlist', async () => {
      const data = { name: 'New Playlist', tracks: ['track1', 'track2'] };
      const mockPlaylist = {
        id: 1,
        userId: 1,
        plexPlaylistId: 'pl1',
        name: 'New Playlist',
        source: 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPlaylist),
      });

      const result = await client.createPlaylist(data);
      expect(result).toEqual(mockPlaylist);
    });

    it('should delete playlist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.deletePlaylist(1);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/playlists/1`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Import Methods', () => {
    const mockImportResponse = {
      matched: [
        {
          title: 'Track 1',
          artist: 'Artist 1',
          matched: true,
          plexRatingKey: 'key1',
        },
      ],
      unmatched: [
        { title: 'Track 2', artist: 'Artist 2', matched: false },
      ],
      playlistName: 'Test Playlist',
    };

    it('should import from Spotify', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockImportResponse),
      });

      const result = await client.importSpotify('https://spotify.com/playlist/123');
      expect(result).toEqual(mockImportResponse);
    });

    it('should import from Deezer', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockImportResponse),
      });

      const result = await client.importDeezer('123456');
      expect(result).toEqual(mockImportResponse);
    });

    it('should import file', async () => {
      const mockFile = new File(['content'], 'playlist.m3u', {
        type: 'audio/x-mpegurl',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockImportResponse),
      });

      const result = await client.importFile(mockFile);
      expect(result).toEqual(mockImportResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/import/file`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });

  describe('Mix Methods', () => {
    const mockPlaylist = {
      id: 1,
      userId: 1,
      plexPlaylistId: 'pl1',
      name: 'Weekly Mix',
      source: 'mix',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should generate weekly mix', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPlaylist),
      });

      const result = await client.generateWeeklyMix();
      expect(result).toEqual(mockPlaylist);
    });

    it('should generate all mixes', async () => {
      const mockPlaylists = [mockPlaylist, { ...mockPlaylist, id: 2 }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPlaylists),
      });

      const result = await client.generateAllMixes();
      expect(result).toEqual(mockPlaylists);
    });
  });

  describe('Schedule Methods', () => {
    it('should get schedules', async () => {
      const mockSchedules = [
        {
          id: 1,
          userId: 1,
          scheduleType: 'mix_generation' as const,
          frequency: 'daily' as const,
          startDate: '2024-01-01',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSchedules),
      });

      const result = await client.getSchedules();
      expect(result).toEqual(mockSchedules);
    });

    it('should create schedule', async () => {
      const schedule = {
        userId: 1,
        scheduleType: 'mix_generation' as const,
        frequency: 'daily' as const,
        startDate: '2024-01-01',
      };

      const mockResponse = { ...schedule, id: 1 };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await client.createSchedule(schedule);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Missing Tracks Methods', () => {
    it('should get missing tracks', async () => {
      const mockTracks = [
        {
          id: 1,
          userId: 1,
          playlistId: 1,
          title: 'Missing Track',
          artist: 'Artist',
          position: 0,
          addedAt: Date.now(),
          source: 'spotify',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockTracks),
      });

      const result = await client.getMissingTracks();
      expect(result).toEqual(mockTracks);
    });

    it('should retry missing tracks', async () => {
      const mockResponse = { matched: 5, remaining: 3 };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await client.retryMissingTracks(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Request Serialization', () => {
    it('should include authorization header when token is provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({}),
      });

      await client.getMe();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should not include authorization header when no token', async () => {
      const clientNoToken = new APIClient(baseURL);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({}),
      });

      await clientNoToken.startAuth();

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.headers).not.toHaveProperty('Authorization');
    });

    it('should serialize request body as JSON', async () => {
      const data = { country: 'UK' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.updateSettings(data);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(data),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});
