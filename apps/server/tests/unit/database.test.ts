/**
 * Database Unit Tests
 * 
 * Tests all CRUD operations for the DatabaseService class.
 * Uses in-memory SQLite database for fast, isolated tests.
 */

import Database from 'better-sqlite3';
import { DatabaseService } from '../../src/database/database';
import type { MissingTrackInput, ScheduleInput } from '../../src/database/types';

describe('DatabaseService', () => {
  let db: Database.Database;
  let dbService: DatabaseService;

  beforeEach(() => {
    // Create in-memory database for each test
    db = new Database(':memory:');
    
    // Initialize schema
    db.pragma('foreign_keys = ON');
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Execute the entire schema at once - SQLite can handle multiple statements
    db.exec(schema);
    
    dbService = new DatabaseService(db);
  });

  afterEach(() => {
    db.close();
  });

  // ==================== User Operations ====================

  describe('User Operations', () => {
    test('createUser should create a new user', () => {
      const user = dbService.createUser('plex123', 'testuser', 'token123', 'thumb.jpg');
      
      expect(user.id).toBeDefined();
      expect(user.plex_user_id).toBe('plex123');
      expect(user.plex_username).toBe('testuser');
      expect(user.plex_token).toBe('token123');
      expect(user.plex_thumb).toBe('thumb.jpg');
      expect(user.created_at).toBeDefined();
      expect(user.last_login).toBeDefined();
    });

    test('getUserByPlexId should retrieve user', () => {
      dbService.createUser('plex123', 'testuser', 'token123');
      const user = dbService.getUserByPlexId('plex123');
      
      expect(user).not.toBeNull();
      expect(user?.plex_user_id).toBe('plex123');
    });

    test('getUserByPlexId should return null for non-existent user', () => {
      const user = dbService.getUserByPlexId('nonexistent');
      expect(user).toBeNull();
    });

    test('getUserById should retrieve user', () => {
      const created = dbService.createUser('plex123', 'testuser', 'token123');
      const user = dbService.getUserById(created.id);
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(created.id);
    });

    test('updateUserLogin should update last_login timestamp', () => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      const newTimestamp = Math.floor(Date.now() / 1000) + 1000;
      
      dbService.updateUserLogin(user.id, newTimestamp);
      
      const updated = dbService.getUserById(user.id);
      expect(updated?.last_login).toBe(newTimestamp);
    });

    test('updateUserToken should update token', () => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      
      dbService.updateUserToken(user.id, 'newtoken456');
      
      const updated = dbService.getUserById(user.id);
      expect(updated?.plex_token).toBe('newtoken456');
    });
  });

  // ==================== Server Operations ====================

  describe('Server Operations', () => {
    let userId: number;

    beforeEach(() => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      userId = user.id;
    });

    test('saveUserServer should save server configuration', () => {
      const server = dbService.saveUserServer(
        userId,
        'My Server',
        'client123',
        'http://localhost:32400',
        'lib1',
        'Music'
      );
      
      expect(server.id).toBeDefined();
      expect(server.server_name).toBe('My Server');
      expect(server.library_id).toBe('lib1');
    });

    test('saveUserServer should replace existing server', () => {
      dbService.saveUserServer(userId, 'Server 1', 'client1', 'http://server1');
      dbService.saveUserServer(userId, 'Server 2', 'client2', 'http://server2');
      
      const server = dbService.getUserServer(userId);
      expect(server?.server_name).toBe('Server 2');
    });

    test('getUserServer should retrieve server', () => {
      dbService.saveUserServer(userId, 'My Server', 'client123', 'http://localhost:32400');
      const server = dbService.getUserServer(userId);
      
      expect(server).not.toBeNull();
      expect(server?.server_name).toBe('My Server');
    });

    test('getUserServer should return null if no server configured', () => {
      const server = dbService.getUserServer(userId);
      expect(server).toBeNull();
    });
  });

  // ==================== Settings Operations ====================

  describe('Settings Operations', () => {
    let userId: number;

    beforeEach(() => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      userId = user.id;
    });

    test('getUserSettings should return defaults for new user', () => {
      const settings = dbService.getUserSettings(userId);
      
      expect(settings.user_id).toBe(userId);
      expect(settings.country).toBe('global');
      expect(settings.matching_settings).toBeDefined();
      expect(settings.mix_settings).toBeDefined();
    });

    test('saveUserSettings should save settings', () => {
      dbService.saveUserSettings(userId, {
        country: 'US',
        matching_settings: {
          ...dbService.getUserSettings(userId).matching_settings,
          minMatchScore: 0.9
        }
      });
      
      const settings = dbService.getUserSettings(userId);
      expect(settings.country).toBe('US');
      expect(settings.matching_settings.minMatchScore).toBe(0.9);
    });

    test('saveUserSettings should update existing settings', () => {
      dbService.saveUserSettings(userId, { country: 'US' });
      dbService.saveUserSettings(userId, { country: 'UK' });
      
      const settings = dbService.getUserSettings(userId);
      expect(settings.country).toBe('UK');
    });
  });

  // ==================== Playlist Operations ====================

  describe('Playlist Operations', () => {
    let userId: number;

    beforeEach(() => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      userId = user.id;
    });

    test('createPlaylist should create a new playlist', () => {
      const playlist = dbService.createPlaylist(
        userId,
        'plex_pl_123',
        'My Playlist',
        'spotify',
        'https://spotify.com/playlist/123'
      );
      
      expect(playlist.id).toBeDefined();
      expect(playlist.name).toBe('My Playlist');
      expect(playlist.source).toBe('spotify');
    });

    test('getUserPlaylists should return user playlists', () => {
      dbService.createPlaylist(userId, 'pl1', 'Playlist 1', 'spotify');
      dbService.createPlaylist(userId, 'pl2', 'Playlist 2', 'deezer');
      
      const playlists = dbService.getUserPlaylists(userId);
      expect(playlists).toHaveLength(2);
    });

    test('getUserPlaylists should not return other users playlists', () => {
      const user2 = dbService.createUser('plex456', 'user2', 'token456');
      
      dbService.createPlaylist(userId, 'pl1', 'Playlist 1', 'spotify');
      dbService.createPlaylist(user2.id, 'pl2', 'Playlist 2', 'deezer');
      
      const playlists = dbService.getUserPlaylists(userId);
      expect(playlists).toHaveLength(1);
      expect(playlists[0].name).toBe('Playlist 1');
    });

    test('getPlaylistById should retrieve playlist', () => {
      const created = dbService.createPlaylist(userId, 'pl1', 'Playlist 1', 'spotify');
      const playlist = dbService.getPlaylistById(created.id);
      
      expect(playlist).not.toBeNull();
      expect(playlist?.name).toBe('Playlist 1');
    });

    test('updatePlaylist should update playlist fields', () => {
      const playlist = dbService.createPlaylist(userId, 'pl1', 'Old Name', 'spotify');
      
      dbService.updatePlaylist(playlist.id, { name: 'New Name' });
      
      const updated = dbService.getPlaylistById(playlist.id);
      expect(updated?.name).toBe('New Name');
    });

    test('deletePlaylist should remove playlist', () => {
      const playlist = dbService.createPlaylist(userId, 'pl1', 'Playlist 1', 'spotify');
      
      dbService.deletePlaylist(playlist.id);
      
      const deleted = dbService.getPlaylistById(playlist.id);
      expect(deleted).toBeNull();
    });
  });

  // ==================== Schedule Operations ====================

  describe('Schedule Operations', () => {
    let userId: number;
    let playlistId: number;

    beforeEach(() => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      userId = user.id;
      const playlist = dbService.createPlaylist(userId, 'pl1', 'Playlist 1', 'spotify');
      playlistId = playlist.id;
    });

    test('createSchedule should create a new schedule', () => {
      const scheduleInput: ScheduleInput = {
        playlist_id: playlistId,
        schedule_type: 'playlist_refresh',
        frequency: 'daily',
        start_date: '2024-01-01'
      };
      
      const schedule = dbService.createSchedule(userId, scheduleInput);
      
      expect(schedule.id).toBeDefined();
      expect(schedule.schedule_type).toBe('playlist_refresh');
      expect(schedule.frequency).toBe('daily');
    });

    test('getUserSchedules should return user schedules', () => {
      dbService.createSchedule(userId, {
        schedule_type: 'mix_generation',
        frequency: 'weekly',
        start_date: '2024-01-01'
      });
      
      const schedules = dbService.getUserSchedules(userId);
      expect(schedules).toHaveLength(1);
    });

    test('getDueSchedules should return schedules that need to run', () => {
      // Create schedule with no last_run (should be due)
      dbService.createSchedule(userId, {
        schedule_type: 'mix_generation',
        frequency: 'daily',
        start_date: '2024-01-01'
      });
      
      const dueSchedules = dbService.getDueSchedules();
      expect(dueSchedules.length).toBeGreaterThan(0);
    });

    test('updateScheduleLastRun should update timestamp', () => {
      const schedule = dbService.createSchedule(userId, {
        schedule_type: 'mix_generation',
        frequency: 'daily',
        start_date: '2024-01-01'
      });
      
      const timestamp = Math.floor(Date.now() / 1000);
      dbService.updateScheduleLastRun(schedule.id, timestamp);
      
      const updated = dbService.getScheduleById(schedule.id);
      expect(updated?.last_run).toBe(timestamp);
    });

    test('deleteSchedule should remove schedule', () => {
      const schedule = dbService.createSchedule(userId, {
        schedule_type: 'mix_generation',
        frequency: 'daily',
        start_date: '2024-01-01'
      });
      
      dbService.deleteSchedule(schedule.id);
      
      const deleted = dbService.getScheduleById(schedule.id);
      expect(deleted).toBeNull();
    });
  });

  // ==================== Missing Tracks Operations ====================

  describe('Missing Tracks Operations', () => {
    let userId: number;
    let playlistId: number;

    beforeEach(() => {
      const user = dbService.createUser('plex123', 'testuser', 'token123');
      userId = user.id;
      const playlist = dbService.createPlaylist(userId, 'pl1', 'Playlist 1', 'spotify');
      playlistId = playlist.id;
    });

    test('addMissingTracks should add tracks', () => {
      const tracks: MissingTrackInput[] = [
        { title: 'Song 1', artist: 'Artist 1', position: 0, source: 'spotify' },
        { title: 'Song 2', artist: 'Artist 2', position: 1, source: 'spotify' }
      ];
      
      dbService.addMissingTracks(userId, playlistId, tracks);
      
      const missing = dbService.getUserMissingTracks(userId);
      expect(missing).toHaveLength(2);
    });

    test('getUserMissingTracks should return user tracks', () => {
      const tracks: MissingTrackInput[] = [
        { title: 'Song 1', artist: 'Artist 1', position: 0, source: 'spotify' }
      ];
      
      dbService.addMissingTracks(userId, playlistId, tracks);
      
      const missing = dbService.getUserMissingTracks(userId);
      expect(missing[0].title).toBe('Song 1');
    });

    test('getPlaylistMissingTracks should return playlist tracks', () => {
      const tracks: MissingTrackInput[] = [
        { title: 'Song 1', artist: 'Artist 1', position: 0, source: 'spotify' }
      ];
      
      dbService.addMissingTracks(userId, playlistId, tracks);
      
      const missing = dbService.getPlaylistMissingTracks(playlistId);
      expect(missing).toHaveLength(1);
    });

    test('removeMissingTrack should remove track', () => {
      const tracks: MissingTrackInput[] = [
        { title: 'Song 1', artist: 'Artist 1', position: 0, source: 'spotify' }
      ];
      
      dbService.addMissingTracks(userId, playlistId, tracks);
      const missing = dbService.getUserMissingTracks(userId);
      
      dbService.removeMissingTrack(missing[0].id);
      
      const remaining = dbService.getUserMissingTracks(userId);
      expect(remaining).toHaveLength(0);
    });

    test('clearPlaylistMissingTracks should remove all playlist tracks', () => {
      const tracks: MissingTrackInput[] = [
        { title: 'Song 1', artist: 'Artist 1', position: 0, source: 'spotify' },
        { title: 'Song 2', artist: 'Artist 2', position: 1, source: 'spotify' }
      ];
      
      dbService.addMissingTracks(userId, playlistId, tracks);
      dbService.clearPlaylistMissingTracks(playlistId);
      
      const missing = dbService.getPlaylistMissingTracks(playlistId);
      expect(missing).toHaveLength(0);
    });
  });

  // ==================== Cached Playlists Operations ====================

  describe('Cached Playlists Operations', () => {
    test('saveCachedPlaylist should save playlist', () => {
      const tracks = [
        { title: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
        { title: 'Song 2', artist: 'Artist 2' }
      ];
      
      dbService.saveCachedPlaylist('spotify', 'pl123', 'Playlist', 'Description', tracks);
      
      const cached = dbService.getCachedPlaylist('spotify', 'pl123');
      expect(cached).not.toBeNull();
      expect(cached?.name).toBe('Playlist');
      expect(cached?.tracks).toHaveLength(2);
    });

    test('saveCachedPlaylist should update existing cache', () => {
      const tracks1 = [{ title: 'Song 1', artist: 'Artist 1' }];
      const tracks2 = [{ title: 'Song 2', artist: 'Artist 2' }];
      
      dbService.saveCachedPlaylist('spotify', 'pl123', 'Old Name', 'Desc', tracks1);
      dbService.saveCachedPlaylist('spotify', 'pl123', 'New Name', 'Desc', tracks2);
      
      const cached = dbService.getCachedPlaylist('spotify', 'pl123');
      expect(cached?.name).toBe('New Name');
      expect(cached?.tracks).toHaveLength(1);
      expect(cached?.tracks[0].title).toBe('Song 2');
    });

    test('getCachedPlaylist should return null for non-existent cache', () => {
      const cached = dbService.getCachedPlaylist('spotify', 'nonexistent');
      expect(cached).toBeNull();
    });

    test('getStaleCache should return old playlists', () => {
      const tracks = [{ title: 'Song 1', artist: 'Artist 1' }];
      
      // Save with old timestamp
      const oldTimestamp = Math.floor(Date.now() / 1000) - (48 * 3600); // 48 hours ago
      db.prepare(`
        INSERT INTO cached_playlists (source, source_id, name, tracks, scraped_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('spotify', 'pl123', 'Old Playlist', JSON.stringify(tracks), oldTimestamp);
      
      const stale = dbService.getStaleCache(24); // Older than 24 hours
      expect(stale).toHaveLength(1);
    });

    test('deleteOldCache should remove old playlists', () => {
      const tracks = [{ title: 'Song 1', artist: 'Artist 1' }];
      
      // Save with old timestamp
      const oldTimestamp = Math.floor(Date.now() / 1000) - (10 * 86400); // 10 days ago
      db.prepare(`
        INSERT INTO cached_playlists (source, source_id, name, tracks, scraped_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('spotify', 'pl123', 'Old Playlist', JSON.stringify(tracks), oldTimestamp);
      
      const deleted = dbService.deleteOldCache(7); // Older than 7 days
      expect(deleted).toBe(1);
    });
  });

  // ==================== Admin Operations ====================

  describe('Admin Operations', () => {
    test('getAllUsers should return all users', () => {
      dbService.createUser('plex1', 'user1', 'token1');
      dbService.createUser('plex2', 'user2', 'token2');
      
      const users = dbService.getAllUsers();
      expect(users).toHaveLength(2);
    });

    test('getUserCount should return count', () => {
      dbService.createUser('plex1', 'user1', 'token1');
      dbService.createUser('plex2', 'user2', 'token2');
      
      const count = dbService.getUserCount();
      expect(count).toBe(2);
    });

    test('getPlaylistCount should return count', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      dbService.createPlaylist(user.id, 'pl1', 'Playlist 1', 'spotify');
      dbService.createPlaylist(user.id, 'pl2', 'Playlist 2', 'deezer');
      
      const count = dbService.getPlaylistCount();
      expect(count).toBe(2);
    });

    test('getMissingTrackStats should return aggregated stats', () => {
      const user1 = dbService.createUser('plex1', 'user1', 'token1');
      const user2 = dbService.createUser('plex2', 'user2', 'token2');
      const pl1 = dbService.createPlaylist(user1.id, 'pl1', 'Playlist 1', 'spotify');
      const pl2 = dbService.createPlaylist(user2.id, 'pl2', 'Playlist 2', 'spotify');
      
      // Same track missing for both users
      dbService.addMissingTracks(user1.id, pl1.id, [
        { title: 'Popular Song', artist: 'Popular Artist', position: 0, source: 'spotify' }
      ]);
      dbService.addMissingTracks(user2.id, pl2.id, [
        { title: 'Popular Song', artist: 'Popular Artist', position: 0, source: 'spotify' }
      ]);
      
      const stats = dbService.getMissingTrackStats();
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0].count).toBe(2);
    });

    test('isAdmin should return false for non-admin', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      expect(dbService.isAdmin(user.id)).toBe(false);
    });

    test('addAdmin should make user admin', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      
      dbService.addAdmin(user.id);
      
      expect(dbService.isAdmin(user.id)).toBe(true);
    });

    test('removeAdmin should remove admin privileges', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      dbService.addAdmin(user.id);
      
      dbService.removeAdmin(user.id);
      
      expect(dbService.isAdmin(user.id)).toBe(false);
    });
  });

  // ==================== Foreign Key Cascade Tests ====================

  describe('Foreign Key Cascades', () => {
    test('deleting user should cascade delete user_servers', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      dbService.saveUserServer(user.id, 'Server', 'client1', 'http://server');
      
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      
      const server = dbService.getUserServer(user.id);
      expect(server).toBeNull();
    });

    test('deleting user should cascade delete user_settings', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      dbService.saveUserSettings(user.id, { country: 'US' });
      
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      
      const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(user.id);
      expect(settings).toBeUndefined();
    });

    test('deleting user should cascade delete playlists', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      const playlist = dbService.createPlaylist(user.id, 'pl1', 'Playlist', 'spotify');
      
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      
      const deleted = dbService.getPlaylistById(playlist.id);
      expect(deleted).toBeNull();
    });

    test('deleting playlist should cascade delete schedules', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      const playlist = dbService.createPlaylist(user.id, 'pl1', 'Playlist', 'spotify');
      const schedule = dbService.createSchedule(user.id, {
        playlist_id: playlist.id,
        schedule_type: 'playlist_refresh',
        frequency: 'daily',
        start_date: '2024-01-01'
      });
      
      dbService.deletePlaylist(playlist.id);
      
      const deleted = dbService.getScheduleById(schedule.id);
      expect(deleted).toBeNull();
    });

    test('deleting playlist should cascade delete missing_tracks', () => {
      const user = dbService.createUser('plex1', 'user1', 'token1');
      const playlist = dbService.createPlaylist(user.id, 'pl1', 'Playlist', 'spotify');
      dbService.addMissingTracks(user.id, playlist.id, [
        { title: 'Song', artist: 'Artist', position: 0, source: 'spotify' }
      ]);
      
      dbService.deletePlaylist(playlist.id);
      
      const missing = dbService.getPlaylistMissingTracks(playlist.id);
      expect(missing).toHaveLength(0);
    });
  });
});

