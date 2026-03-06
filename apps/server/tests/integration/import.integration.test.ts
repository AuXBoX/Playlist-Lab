/**
 * Integration Tests for Import Workflow
 * 
 * Tests the full import workflow with mocked external services:
 * - Cache behavior (fresh, stale, miss)
 * - Scraping fallback
 * - Track matching
 * - Missing tracks storage
 */

import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { DatabaseService } from '../../src/database/database';
import { importPlaylist, ImportOptions } from '../../src/services/import';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock the scrapers module
jest.mock('../../src/services/scrapers', () => ({
  scrapeSpotifyPlaylist: jest.fn(),
  scrapeDeezerPlaylist: jest.fn(),
  scrapeAppleMusicPlaylist: jest.fn(),
  scrapeTidalPlaylist: jest.fn(),
  scrapeYouTubeMusicPlaylist: jest.fn(),
  scrapeAmazonMusicPlaylist: jest.fn(),
  scrapeQobuzPlaylist: jest.fn(),
  getListenBrainzPlaylists: jest.fn(),
  parseM3UFile: jest.fn(),
}));

// Mock the Plex service
jest.mock('../../src/services/plex', () => ({
  PlexClient: jest.fn().mockImplementation(() => ({
    searchTrack: jest.fn().mockResolvedValue([]),
  })),
}));

import { scrapeSpotifyPlaylist } from '../../src/services/scrapers';

/**
 * Create a temporary test database
 */
function createTestDatabase(): Database.Database {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-lab-integration-'));
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

describe('Import Workflow Integration Tests', () => {
  let db: Database.Database;
  let dbService: DatabaseService;
  let userId: number;
  let importOptions: ImportOptions;

  beforeEach(() => {
    // Create test database
    db = createTestDatabase();
    dbService = new DatabaseService(db);

    // Create test user
    const user = dbService.createUser(
      'test-plex-user-id',
      'testuser',
      'test-plex-token',
      'https://example.com/thumb.jpg'
    );
    userId = user.id;

    // Setup import options
    importOptions = {
      userId,
      serverUrl: 'http://localhost:32400',
      plexToken: 'test-plex-token',
      libraryId: '1',
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  describe('Cache Behavior', () => {
    it('should use fresh cache when available', async () => {
      // Setup: Store fresh cache
      const mockPlaylist = {
        id: 'spotify-123',
        name: 'Test Playlist',
        description: 'Test Description',
        source: 'spotify',
        tracks: [
          { title: 'Track 1', artist: 'Artist 1', album: 'Album 1' },
          { title: 'Track 2', artist: 'Artist 2', album: 'Album 2' },
        ],
      };

      dbService.saveCachedPlaylist(
        'spotify',
        'https://open.spotify.com/playlist/123',
        mockPlaylist.name,
        mockPlaylist.description,
        mockPlaylist.tracks
      );

      // Mock scraper should NOT be called
      (scrapeSpotifyPlaylist as jest.Mock).mockResolvedValue(mockPlaylist);

      // Execute: Import playlist
      const result = await importPlaylist(
        'spotify',
        'https://open.spotify.com/playlist/123',
        importOptions,
        dbService
      );

      // Verify: Should use cache, not call scraper
      expect(result.usedCache).toBe(true);
      expect(scrapeSpotifyPlaylist).not.toHaveBeenCalled();
      expect(result.playlistName).toBe('Test Playlist');
      expect(result.totalCount).toBe(2);
    });

    it('should scrape when cache is stale', async () => {
      // Setup: Store stale cache (> 24 hours old)
      const now = Math.floor(Date.now() / 1000);
      const staleTimestamp = now - (25 * 3600); // 25 hours ago

      const stmt = db.prepare(`
        INSERT INTO cached_playlists (source, source_id, name, description, tracks, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        'spotify',
        'https://open.spotify.com/playlist/123',
        'Old Playlist',
        'Old Description',
        JSON.stringify([{ title: 'Old Track', artist: 'Old Artist' }]),
        staleTimestamp
      );

      // Mock scraper to return fresh data
      const freshPlaylist = {
        id: 'spotify-123',
        name: 'Fresh Playlist',
        description: 'Fresh Description',
        source: 'spotify',
        tracks: [
          { title: 'Fresh Track 1', artist: 'Fresh Artist 1', album: 'Fresh Album 1' },
          { title: 'Fresh Track 2', artist: 'Fresh Artist 2', album: 'Fresh Album 2' },
        ],
      };
      (scrapeSpotifyPlaylist as jest.Mock).mockResolvedValue(freshPlaylist);

      // Execute: Import playlist
      const result = await importPlaylist(
        'spotify',
        'https://open.spotify.com/playlist/123',
        importOptions,
        dbService
      );

      // Verify: Should scrape fresh data
      expect(result.usedCache).toBe(false);
      expect(scrapeSpotifyPlaylist).toHaveBeenCalledWith('https://open.spotify.com/playlist/123');
      expect(result.playlistName).toBe('Fresh Playlist');
      expect(result.totalCount).toBe(2);

      // Verify cache was updated
      const cached = dbService.getCachedPlaylist('spotify', 'https://open.spotify.com/playlist/123');
      expect(cached).not.toBeNull();
      expect(cached!.name).toBe('Fresh Playlist');
    });

    it('should scrape when cache is missing', async () => {
      // Setup: No cache exists
      const mockPlaylist = {
        id: 'spotify-456',
        name: 'New Playlist',
        description: 'New Description',
        source: 'spotify',
        tracks: [
          { title: 'New Track 1', artist: 'New Artist 1', album: 'New Album 1' },
        ],
      };
      (scrapeSpotifyPlaylist as jest.Mock).mockResolvedValue(mockPlaylist);

      // Execute: Import playlist
      const result = await importPlaylist(
        'spotify',
        'https://open.spotify.com/playlist/456',
        importOptions,
        dbService
      );

      // Verify: Should scrape and cache
      expect(result.usedCache).toBe(false);
      expect(scrapeSpotifyPlaylist).toHaveBeenCalledWith('https://open.spotify.com/playlist/456');
      expect(result.playlistName).toBe('New Playlist');

      // Verify cache was updated
      const cached = dbService.getCachedPlaylist('spotify', 'https://open.spotify.com/playlist/456');
      expect(cached).not.toBeNull();
      expect(cached!.name).toBe('New Playlist');
    });
  });

  describe('Missing Tracks Storage', () => {
    it('should return unmatched tracks in result', async () => {
      // Setup: Mock playlist with tracks that won't match
      const mockPlaylist = {
        id: 'spotify-789',
        name: 'Test Playlist',
        description: 'Test Description',
        source: 'spotify',
        tracks: [
          { title: 'Unmatched Track 1', artist: 'Unknown Artist 1', album: 'Unknown Album 1' },
          { title: 'Unmatched Track 2', artist: 'Unknown Artist 2', album: 'Unknown Album 2' },
        ],
      };
      (scrapeSpotifyPlaylist as jest.Mock).mockResolvedValue(mockPlaylist);

      // Execute: Import playlist
      const result = await importPlaylist(
        'spotify',
        'https://open.spotify.com/playlist/789',
        importOptions,
        dbService
      );

      // Verify: Response indicates no matches
      expect(result.matchedCount).toBe(0);
      expect(result.totalCount).toBe(2);
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0].matched).toBe(false);
      expect(result.tracks[1].matched).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle scraper failures gracefully', async () => {
      // Setup: Mock scraper to fail
      (scrapeSpotifyPlaylist as jest.Mock).mockRejectedValue(new Error('Scraper failed'));

      // Execute: Import playlist should throw
      await expect(
        importPlaylist(
          'spotify',
          'https://open.spotify.com/playlist/error',
          importOptions,
          dbService
        )
      ).rejects.toThrow('Scraper failed');
    });

    it('should use stale cache as fallback when scraper fails', async () => {
      // Setup: Store stale cache
      const now = Math.floor(Date.now() / 1000);
      const staleTimestamp = now - (25 * 3600); // 25 hours ago

      const stmt = db.prepare(`
        INSERT INTO cached_playlists (source, source_id, name, description, tracks, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        'spotify',
        'https://open.spotify.com/playlist/fallback',
        'Fallback Playlist',
        'Fallback Description',
        JSON.stringify([{ title: 'Fallback Track', artist: 'Fallback Artist' }]),
        staleTimestamp
      );

      // Mock scraper to fail
      (scrapeSpotifyPlaylist as jest.Mock).mockRejectedValue(new Error('Scraper failed'));

      // Execute: Import playlist
      const result = await importPlaylist(
        'spotify',
        'https://open.spotify.com/playlist/fallback',
        importOptions,
        dbService
      );

      // Verify: Should use stale cache as fallback
      expect(result.usedCache).toBe(true);
      expect(result.playlistName).toBe('Fallback Playlist');
      expect(result.totalCount).toBe(1);
    });
  });
});
