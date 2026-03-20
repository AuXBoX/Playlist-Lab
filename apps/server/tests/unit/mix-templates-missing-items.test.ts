/**
 * Mix Templates - Missing Items Error Handling Tests
 * 
 * Tests for Task 1.3: Add error handling for missing items
 * 
 * When generating a mix from a template, referenced Plex items (artists, albums, genres)
 * may no longer exist in the library. These tests verify graceful error handling.
 */

import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import mixTemplatesRoutes from '../../src/routes/mix-templates';
import { DatabaseService } from '../../src/database/database';
import { errorHandler } from '../../src/middleware/error-handler';
import { PlexClient } from '../../src/services/plex';
import { MixService } from '../../src/services/mixes';
import * as fs from 'fs';
import * as path from 'path';

// Mock the Plex client and Mix service
jest.mock('../../src/services/plex');
jest.mock('../../src/services/mixes');

describe('Mix Templates - Missing Items Error Handling', () => {
  let app: Express;
  let sqliteDb: Database.Database;
  let db: DatabaseService;
  let testUserId: number;
  let MockedPlexClient: jest.MockedClass<typeof PlexClient>;
  let MockedMixService: jest.MockedClass<typeof MixService>;

  beforeAll(() => {
    // Get mocked classes
    MockedPlexClient = PlexClient as jest.MockedClass<typeof PlexClient>;
    MockedMixService = MixService as jest.MockedClass<typeof MixService>;

    // Create in-memory database
    sqliteDb = new Database(':memory:');
    sqliteDb.pragma('foreign_keys = ON');
    
    // Load and execute schema
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    sqliteDb.exec(schema);
    
    db = new DatabaseService(sqliteDb);
    
    // Create test user
    const user = db.createUser('plex123', 'testuser', 'token123', 'thumb.jpg');
    testUserId = user.id;

    // Setup server configuration
    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(testUserId, 'http://localhost:32400', 'Test Server', 'test-client-id', '1', 'Music');
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup authenticated app
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    app.use((req, res, next) => {
      req.session.userId = testUserId;
      req.dbService = db;
      next();
    });
    app.use('/api/mix-templates', mixTemplatesRoutes);
    app.use(errorHandler);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  describe('Artist Mix - Missing Artists', () => {
    it('should handle when all artists are missing', async () => {
      const template = db.createMixTemplate(testUserId, 'Missing Artists Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['missing1', 'missing2', 'missing3']
      });

      // Mock Plex client to return empty arrays for all artists
      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn().mockResolvedValue([]);
      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn();
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn();

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('None of the artists');
      expect(response.body.error.message).toContain('exist in your library');
    });

    it('should handle when some artists are missing', async () => {
      const template = db.createMixTemplate(testUserId, 'Partial Artists Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['found1', 'missing1', 'found2']
      });

      // Mock Plex client - some artists return tracks, others don't
      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn()
        .mockImplementation((libraryId: string, artistId: string) => {
          if (artistId === 'found1') {
            return Promise.resolve([
              { ratingKey: 'track1', grandparentTitle: 'Found Artist 1' },
              { ratingKey: 'track2', grandparentTitle: 'Found Artist 1' }
            ]);
          } else if (artistId === 'found2') {
            return Promise.resolve([
              { ratingKey: 'track3', grandparentTitle: 'Found Artist 2' },
              { ratingKey: 'track4', grandparentTitle: 'Found Artist 2' }
            ]);
          } else {
            return Promise.resolve([]);
          }
        });

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.warnings).toBeDefined();
      expect(response.body.warnings.length).toBeGreaterThan(0);
      expect(response.body.warnings.some((w: string) => w.includes('not found'))).toBe(true);
      expect(response.body.trackCount).toBeGreaterThan(0);
    });

    it('should provide clear warning messages for missing artists', async () => {
      const template = db.createMixTemplate(testUserId, 'Artist Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['artist1', 'artist2']
      });

      // Mock first artist found, second missing
      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn()
        .mockImplementation((libraryId: string, artistId: string) => {
          if (artistId === 'artist1') {
            return Promise.resolve([
              { ratingKey: 'track1', grandparentTitle: 'Artist One' }
            ]);
          } else {
            return Promise.resolve([]);
          }
        });

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.warnings).toBeDefined();
      const warningText = response.body.warnings.join(' ');
      expect(warningText).toContain('artist(s) not found');
      expect(warningText).toContain('artist2');
    });

    it('should log missing artists for debugging', async () => {
      const template = db.createMixTemplate(testUserId, 'Artist Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['missing1']
      });

      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn().mockResolvedValue([]);

      await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .catch(() => {}); // Ignore error

      // Verify that getArtistPopularTracks was called with the missing artist ID
      expect(MockedPlexClient.prototype.getArtistPopularTracks).toHaveBeenCalledWith(
        '1',
        'missing1',
        expect.any(Number)
      );
    });
  });

  describe('Album Mix - Missing Albums', () => {
    it('should handle when all albums are missing', async () => {
      const template = db.createMixTemplate(testUserId, 'Missing Albums Mix', null, 'album', {
        trackCount: 50,
        albumIds: ['missing1', 'missing2']
      });

      // Mock Plex client to return empty arrays for all albums
      (MockedPlexClient.prototype.getAlbumTracks as jest.Mock) = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('None of the albums');
      expect(response.body.error.message).toContain('exist in your library');
    });

    it('should handle when some albums are missing', async () => {
      const template = db.createMixTemplate(testUserId, 'Partial Albums Mix', null, 'album', {
        trackCount: 50,
        albumIds: ['found1', 'missing1', 'found2']
      });

      // Mock Plex client - some albums return tracks, others don't
      (MockedPlexClient.prototype.getAlbumTracks as jest.Mock) = jest.fn()
        .mockImplementation((albumId: string) => {
          if (albumId === 'found1') {
            return Promise.resolve([
              { ratingKey: 'track1', parentTitle: 'Found Album 1' },
              { ratingKey: 'track2', parentTitle: 'Found Album 1' }
            ]);
          } else if (albumId === 'found2') {
            return Promise.resolve([
              { ratingKey: 'track3', parentTitle: 'Found Album 2' }
            ]);
          } else {
            return Promise.resolve([]);
          }
        });

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.warnings).toBeDefined();
      expect(response.body.warnings.length).toBeGreaterThan(0);
      expect(response.body.warnings.some((w: string) => w.includes('album(s) not found'))).toBe(true);
    });

    it('should provide clear warning messages for missing albums', async () => {
      const template = db.createMixTemplate(testUserId, 'Album Mix', null, 'album', {
        trackCount: 50,
        albumIds: ['album1', 'album2', 'album3']
      });

      // Mock only first album found
      (MockedPlexClient.prototype.getAlbumTracks as jest.Mock) = jest.fn()
        .mockImplementation((albumId: string) => {
          if (albumId === 'album1') {
            return Promise.resolve([
              { ratingKey: 'track1', parentTitle: 'Album One' }
            ]);
          } else {
            return Promise.resolve([]);
          }
        });

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.warnings).toBeDefined();
      const warningText = response.body.warnings.join(' ');
      expect(warningText).toContain('2 album(s) not found');
      expect(warningText).toContain('album2');
      expect(warningText).toContain('album3');
    });
  });

  describe('Genre/Mood/Decade Mix - No Matching Tracks', () => {
    it('should handle genre mix with no matching tracks', async () => {
      const template = db.createMixTemplate(testUserId, 'Genre Mix', null, 'genre', {
        trackCount: 50,
        genres: ['NonexistentGenre']
      });

      // Mock MixService to return empty result
      const mockGenerateCustomMix = jest.fn().mockResolvedValue({
        trackKeys: []
      });
      MockedMixService.prototype.generateCustomMix = mockGenerateCustomMix;

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('No tracks found');
      expect(response.body.error.message).toContain('may no longer exist');
    });

    it('should handle mood mix with no matching tracks', async () => {
      const template = db.createMixTemplate(testUserId, 'Mood Mix', null, 'mood', {
        trackCount: 50,
        moods: ['NonexistentMood']
      });

      const mockGenerateCustomMix2 = jest.fn().mockResolvedValue({
        trackKeys: []
      });
      MockedMixService.prototype.generateCustomMix = mockGenerateCustomMix2;

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('No tracks found');
    });

    it('should warn when fewer tracks found than requested', async () => {
      const template = db.createMixTemplate(testUserId, 'Genre Mix', null, 'genre', {
        trackCount: 100,
        genres: ['Rock']
      });

      // Mock MixService to return fewer tracks than requested
      const mockGenerateCustomMix3 = jest.fn().mockResolvedValue({
        trackKeys: ['track1', 'track2', 'track3'] // Only 3 tracks instead of 100
      });
      MockedMixService.prototype.generateCustomMix = mockGenerateCustomMix3;

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.warnings).toBeDefined();
      expect(response.body.warnings.some((w: string) => 
        w.includes('Only found 3 tracks') && w.includes('requested 100')
      )).toBe(true);
    });
  });

  describe('Custom Mix - Missing Items', () => {
    it('should handle custom mix with no matching tracks', async () => {
      const template = db.createMixTemplate(testUserId, 'Custom Mix', null, 'custom', {
        trackCount: 50,
        customRules: {
          includeGenres: ['NonexistentGenre'],
          minRating: 10
        }
      });

      const mockGenerateCustomMix4 = jest.fn().mockResolvedValue({
        trackKeys: []
      });
      MockedMixService.prototype.generateCustomMix = mockGenerateCustomMix4;

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('No tracks found');
    });

    it('should handle custom mix generation errors gracefully', async () => {
      const template = db.createMixTemplate(testUserId, 'Custom Mix', null, 'custom', {
        trackCount: 50,
        customRules: {}
      });

      const mockGenerateCustomMix5 = jest.fn()
        .mockRejectedValue(new Error('Plex API error'));
      MockedMixService.prototype.generateCustomMix = mockGenerateCustomMix5;

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Failed to generate custom mix');
    });
  });

  describe('Error Messages and Logging', () => {
    it('should provide user-friendly error messages', async () => {
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['missing1', 'missing2']
      });

      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      // Error message should be clear and actionable
      expect(response.body.error.message).not.toContain('undefined');
      expect(response.body.error.message).not.toContain('null');
      expect(response.body.error.message.length).toBeGreaterThan(10);
    });

    it('should return warnings array even when generation succeeds', async () => {
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['artist1']
      });

      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn().mockResolvedValue([
        { ratingKey: 'track1', grandparentTitle: 'Artist One' }
      ]);
      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.warnings).toBeDefined();
      expect(Array.isArray(response.body.warnings)).toBe(true);
    });

    it('should include warning count in success message', async () => {
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['found1', 'missing1']
      });

      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn()
        .mockImplementation((libraryId: string, artistId: string) => {
          if (artistId === 'found1') {
            return Promise.resolve([
              { ratingKey: 'track1', grandparentTitle: 'Found Artist' }
            ]);
          } else {
            return Promise.resolve([]);
          }
        });

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.message).toContain('warning');
      expect(response.body.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Playlist Creation with Partial Data', () => {
    it('should create playlist with available tracks when some items are missing', async () => {
      const template = db.createMixTemplate(testUserId, 'Partial Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['found1', 'missing1', 'missing2']
      });

      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn()
        .mockImplementation((libraryId: string, artistId: string) => {
          if (artistId === 'found1') {
            return Promise.resolve([
              { ratingKey: 'track1', grandparentTitle: 'Found Artist' },
              { ratingKey: 'track2', grandparentTitle: 'Found Artist' },
              { ratingKey: 'track3', grandparentTitle: 'Found Artist' }
            ]);
          } else {
            return Promise.resolve([]);
          }
        });

      (MockedPlexClient.prototype.buildTrackUri as any) = jest.fn((key: string) => `server://track/${key}`);
      (MockedPlexClient.prototype.buildLibraryUri as any) = jest.fn((libraryId: string) => 'server://library/1');
      (MockedPlexClient.prototype.createPlaylist as jest.Mock) = jest.fn().mockResolvedValue({
        ratingKey: 'playlist123',
        title: 'Test Playlist'
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.playlistId).toBe('playlist123');
      expect(response.body.trackCount).toBe(3);
      expect(response.body.warnings.length).toBeGreaterThan(0);
      
      // Verify playlist was created with available tracks
      expect(MockedPlexClient.prototype.createPlaylist).toHaveBeenCalledWith(
        'Test Playlist',
        'server://library/1',
        expect.arrayContaining(['server://track/track1', 'server://track/track2', 'server://track/track3'])
      );
    });

    it('should not create playlist when no tracks are available', async () => {
      const template = db.createMixTemplate(testUserId, 'Empty Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['missing1', 'missing2']
      });

      (MockedPlexClient.prototype.getArtistPopularTracks as jest.Mock) = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Test Playlist' })
        .expect(500);

      expect(MockedPlexClient.prototype.createPlaylist).not.toHaveBeenCalled();
    });
  });
});
