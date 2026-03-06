/**
 * Database Class
 * 
 * Provides a high-level interface for all database operations.
 * Handles CRUD operations for all tables with proper error handling.
 */

import Database from 'better-sqlite3';
import type {
  User,
  UserServer,
  UserSettings,
  ParsedUserSettings,
  MatchingSettings,
  MixSettings,
  Playlist,
  Schedule,
  ScheduleInput,
  MissingTrack,
  MissingTrackInput,
  CachedPlaylist,
  ParsedCachedPlaylist,
  ExternalTrack,
  MissingTrackStat
} from './types';

/**
 * Default matching settings
 */
const DEFAULT_MATCHING_SETTINGS: MatchingSettings = {
  minMatchScore: 0.8,
  stripParentheses: true,
  stripBrackets: true,
  useFirstArtistOnly: false,
  ignoreFeaturedArtists: true,
  ignoreRemixInfo: true,
  ignoreVersionInfo: false,
  preferNonCompilation: true,
  penalizeMonoVersions: true,
  penalizeLiveVersions: true,
  preferHigherRated: true,
  minRatingForMatch: 0,
  autoCompleteOnPerfectMatch: true,
  playlistPrefixes: {
    enabled: true,
    spotify: '[Spotify] ',
    deezer: '[Deezer] ',
    apple: '[Apple Music] ',
    tidal: '[Tidal] ',
    youtube: '[YouTube Music] ',
    amazon: '[Amazon Music] ',
    qobuz: '[Qobuz] ',
    listenbrainz: '[ListenBrainz] ',
    file: '[Imported] ',
    ai: '[AI Generated] '
  },
  customStripPatterns: [],
  featuredArtistPatterns: ['feat.', 'ft.', 'featuring'],
  versionSuffixPatterns: ['- Remaster', '- Remix', '- Live'],
  remasterPatterns: ['remaster', 'remastered'],
  variousArtistsNames: ['Various Artists', 'Various', 'VA'],
  penaltyKeywords: ['mono', 'live'],
  priorityKeywords: ['remaster', 'deluxe']
};

/**
 * Default mix settings
 */
const DEFAULT_MIX_SETTINGS: MixSettings = {
  weeklyMix: {
    topArtists: 10,
    tracksPerArtist: 5
  },
  dailyMix: {
    recentTracks: 20,
    relatedTracks: 15,
    rediscoveryTracks: 15,
    rediscoveryDays: 90
  },
  timeCapsule: {
    trackCount: 50,
    daysAgo: 365,
    maxPerArtist: 3
  },
  newMusic: {
    albumCount: 10,
    tracksPerAlbum: 3
  }
};

export class DatabaseService {
  constructor(private db: Database.Database) {}

  // ==================== User Operations ====================

  /**
   * Create a new user
   */
  createUser(
    plexUserId: string,
    username: string,
    token: string,
    thumb?: string
  ): User {
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = this.db.prepare(`
      INSERT INTO users (plex_user_id, plex_username, plex_token, plex_thumb, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(plexUserId, username, token, thumb, now, now);
    
    return {
      id: result.lastInsertRowid as number,
      plex_user_id: plexUserId,
      plex_username: username,
      plex_token: token,
      plex_thumb: thumb,
      created_at: now,
      last_login: now,
      is_enabled: 1
    };
  }

  /**
   * Get user by Plex user ID
   */
  getUserByPlexId(plexUserId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE plex_user_id = ?');
    const result = stmt.get(plexUserId) as User | undefined;
    return result ?? null;
  }

  /**
   * Get user by internal ID
   */
  getUserById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const result = stmt.get(id) as User | undefined;
    return result ?? null;
  }

  /**
   * Update user's last login timestamp
   */
  updateUserLogin(userId: number, timestamp?: number): void {
    const now = timestamp ?? Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    stmt.run(now, userId);
  }

  /**
   * Update user's Plex token
   */
  updateUserToken(userId: number, token: string): void {
    const stmt = this.db.prepare('UPDATE users SET plex_token = ? WHERE id = ?');
    stmt.run(token, userId);
  }

  // ==================== Server Operations ====================

  /**
   * Save user's server configuration
   */
  saveUserServer(
    userId: number,
    serverName: string,
    serverClientId: string,
    serverUrl: string,
    libraryId?: string,
    libraryName?: string
  ): UserServer {
    // Delete existing server for this user
    this.db.prepare('DELETE FROM user_servers WHERE user_id = ?').run(userId);
    
    // Insert new server
    const stmt = this.db.prepare(`
      INSERT INTO user_servers (user_id, server_name, server_client_id, server_url, library_id, library_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(userId, serverName, serverClientId, serverUrl, libraryId, libraryName);
    
    return {
      id: result.lastInsertRowid as number,
      user_id: userId,
      server_name: serverName,
      server_client_id: serverClientId,
      server_url: serverUrl,
      library_id: libraryId,
      library_name: libraryName
    };
  }

  /**
   * Get user's server configuration
   */
  getUserServer(userId: number): UserServer | null {
    const stmt = this.db.prepare('SELECT * FROM user_servers WHERE user_id = ?');
    const result = stmt.get(userId) as UserServer | undefined;
    return result ?? null;
  }

  // ==================== Settings Operations ====================

  /**
   * Get user settings (with defaults if not exists)
   */
  getUserSettings(userId: number): ParsedUserSettings {
    const stmt = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    const row = stmt.get(userId) as UserSettings | undefined;
    
    if (!row) {
      // Return defaults
      return {
        user_id: userId,
        country: 'global',
        matching_settings: DEFAULT_MATCHING_SETTINGS,
        mix_settings: DEFAULT_MIX_SETTINGS,
        gemini_api_key: undefined,
        grok_api_key: undefined,
        ai_provider: 'gemini'
      };
    }
    
    return {
      user_id: row.user_id,
      country: row.country,
      matching_settings: JSON.parse(row.matching_settings),
      mix_settings: JSON.parse(row.mix_settings),
      gemini_api_key: row.gemini_api_key,
      grok_api_key: row.grok_api_key,
      ai_provider: row.ai_provider || 'gemini'
    };
  }

  /**
   * Save user settings
   */
  saveUserSettings(
    userId: number,
    settings: Partial<{
      country: string;
      matching_settings: MatchingSettings;
      mix_settings: MixSettings;
      gemini_api_key: string | null;
      grok_api_key: string | null;
      ai_provider: string;
    }>
  ): void {
    const current = this.getUserSettings(userId);
    
    const country = settings.country ?? current.country;
    const matchingSettings = settings.matching_settings ?? current.matching_settings;
    const mixSettings = settings.mix_settings ?? current.mix_settings;
    const geminiApiKey = settings.gemini_api_key !== undefined ? settings.gemini_api_key : current.gemini_api_key;
    const grokApiKey = settings.grok_api_key !== undefined ? settings.grok_api_key : current.grok_api_key;
    const aiProvider = settings.ai_provider ?? current.ai_provider ?? 'gemini';
    
    const stmt = this.db.prepare(`
      INSERT INTO user_settings (user_id, country, matching_settings, mix_settings, gemini_api_key, grok_api_key, ai_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        country = excluded.country,
        matching_settings = excluded.matching_settings,
        mix_settings = excluded.mix_settings,
        gemini_api_key = excluded.gemini_api_key,
        grok_api_key = excluded.grok_api_key,
        ai_provider = excluded.ai_provider
    `);
    
    stmt.run(
      userId,
      country,
      JSON.stringify(matchingSettings),
      JSON.stringify(mixSettings),
      geminiApiKey,
      grokApiKey,
      aiProvider
    );
  }

  // ==================== Playlist Operations ====================

  /**
   * Create a new playlist
   */
  createPlaylist(
    userId: number,
    plexPlaylistId: string,
    name: string,
    source: string,
    sourceUrl?: string | null
  ): Playlist {
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = this.db.prepare(`
      INSERT INTO playlists (user_id, plex_playlist_id, name, source, source_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(userId, plexPlaylistId, name, source, sourceUrl ?? undefined, now, now);
    
    return {
      id: result.lastInsertRowid as number,
      user_id: userId,
      plex_playlist_id: plexPlaylistId,
      name,
      source,
      source_url: sourceUrl ?? undefined,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Get all playlists for a user
   */
  getUserPlaylists(userId: number): Playlist[] {
    const stmt = this.db.prepare('SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as Playlist[];
  }

  /**
   * Get playlist by ID
   */
  getPlaylistById(id: number): Playlist | null {
    const stmt = this.db.prepare('SELECT * FROM playlists WHERE id = ?');
    const result = stmt.get(id) as Playlist | undefined;
    return result ?? null;
  }

  /**
   * Update playlist
   */
  updatePlaylist(id: number, updates: Partial<Playlist>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.source_url !== undefined) {
      fields.push('source_url = ?');
      values.push(updates.source_url);
    }
    if (updates.plex_playlist_id !== undefined) {
      fields.push('plex_playlist_id = ?');
      values.push(updates.plex_playlist_id);
    }
    
    fields.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  /**
   * Delete playlist
   */
  deletePlaylist(id: number): void {
    const stmt = this.db.prepare('DELETE FROM playlists WHERE id = ?');
    stmt.run(id);
  }

  // ==================== Schedule Operations ====================

  /**
   * Create a new schedule
   */
  createSchedule(userId: number, schedule: ScheduleInput): Schedule {
    const stmt = this.db.prepare(`
      INSERT INTO schedules (user_id, playlist_id, schedule_type, frequency, start_date, config)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      userId,
      schedule.playlist_id,
      schedule.schedule_type,
      schedule.frequency,
      schedule.start_date,
      schedule.config ? JSON.stringify(schedule.config) : null
    );
    
    return {
      id: result.lastInsertRowid as number,
      user_id: userId,
      playlist_id: schedule.playlist_id,
      schedule_type: schedule.schedule_type,
      frequency: schedule.frequency,
      start_date: schedule.start_date,
      config: schedule.config ? JSON.stringify(schedule.config) : undefined
    };
  }

  /**
   * Get all schedules for a user
   */
  getUserSchedules(userId: number): Schedule[] {
    const stmt = this.db.prepare('SELECT * FROM schedules WHERE user_id = ?');
    return stmt.all(userId) as Schedule[];
  }

  /**
   * Get schedule by ID
   */
  getScheduleById(id: number): Schedule | null {
    const stmt = this.db.prepare('SELECT * FROM schedules WHERE id = ?');
    const result = stmt.get(id) as Schedule | undefined;
    return result ?? null;
  }

  /**
   * Get due schedules (schedules that need to run)
   */
  getDueSchedules(): Schedule[] {
    const now = Math.floor(Date.now() / 1000);
    
    // Get schedules that have never run or are due based on frequency
    const stmt = this.db.prepare(`
      SELECT * FROM schedules
      WHERE last_run IS NULL
         OR (frequency = 'daily' AND last_run < ?)
         OR (frequency = 'weekly' AND last_run < ?)
         OR (frequency = 'fortnightly' AND last_run < ?)
         OR (frequency = 'monthly' AND last_run < ?)
    `);
    
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;
    const twoWeeksAgo = now - 1209600;
    const oneMonthAgo = now - 2592000;
    
    const candidates = stmt.all(oneDayAgo, oneWeekAgo, twoWeeksAgo, oneMonthAgo) as Schedule[];

    // Filter by run_time if set: only run during the correct hour
    const currentHour = new Date().getHours();
    return candidates.filter(schedule => {
      const config = schedule.config ? JSON.parse(schedule.config as any) : {};
      if (!config.run_time) return true; // No time preference — always eligible
      const [h] = (config.run_time as string).split(':').map(Number);
      return h === currentHour;
    });
  }

  /**
   * Update schedule's last run timestamp
   */
  updateScheduleLastRun(id: number, timestamp?: number): void {
    const now = timestamp ?? Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('UPDATE schedules SET last_run = ? WHERE id = ?');
    stmt.run(now, id);
  }

  /**
   * Update schedule
   */
  updateSchedule(id: number, updates: Partial<ScheduleInput>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.frequency !== undefined) {
      fields.push('frequency = ?');
      values.push(updates.frequency);
    }
    if (updates.start_date !== undefined) {
      fields.push('start_date = ?');
      values.push(updates.start_date);
    }
    if (updates.config !== undefined) {
      fields.push('config = ?');
      values.push(JSON.stringify(updates.config));
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  /**
   * Delete schedule
   */
  deleteSchedule(id: number): void {
    const stmt = this.db.prepare('DELETE FROM schedules WHERE id = ?');
    stmt.run(id);
  }

  // ==================== Missing Tracks Operations ====================

  /**
   * Add missing tracks
   */
  addMissingTracks(userId: number, playlistId: number, tracks: MissingTrackInput[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO missing_tracks (user_id, playlist_id, title, artist, album, position, after_track_key, added_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Math.floor(Date.now() / 1000);
    
    const insertMany = this.db.transaction((tracks: MissingTrackInput[]) => {
      for (const track of tracks) {
        stmt.run(
          userId,
          playlistId,
          track.title,
          track.artist,
          track.album,
          track.position,
          track.after_track_key,
          now,
          track.source
        );
      }
    });
    
    insertMany(tracks);
  }

  /**
   * Get all missing tracks for a user
   */
  getUserMissingTracks(userId: number): MissingTrack[] {
    const stmt = this.db.prepare(`
      SELECT * FROM missing_tracks
      WHERE user_id = ?
      ORDER BY playlist_id, position
    `);
    return stmt.all(userId) as MissingTrack[];
  }

  /**
   * Get missing tracks for a specific playlist
   */
  getPlaylistMissingTracks(playlistId: number): MissingTrack[] {
    const stmt = this.db.prepare(`
      SELECT * FROM missing_tracks
      WHERE playlist_id = ?
      ORDER BY position
    `);
    return stmt.all(playlistId) as MissingTrack[];
  }

  /**
   * Get all missing tracks (admin only)
   */
  getAllMissingTracks(): MissingTrack[] {
    const stmt = this.db.prepare('SELECT * FROM missing_tracks ORDER BY added_at DESC');
    return stmt.all() as MissingTrack[];
  }

  /**
   * Remove a missing track
   */
  removeMissingTrack(id: number): void {
    const stmt = this.db.prepare('DELETE FROM missing_tracks WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Clear all missing tracks for a playlist
   */
  clearPlaylistMissingTracks(playlistId: number): void {
    const stmt = this.db.prepare('DELETE FROM missing_tracks WHERE playlist_id = ?');
    stmt.run(playlistId);
  }

  // ==================== Cached Playlists Operations ====================

  /**
   * Get cached playlist
   */
  getCachedPlaylist(source: string, sourceId: string): ParsedCachedPlaylist | null {
    const stmt = this.db.prepare('SELECT * FROM cached_playlists WHERE source = ? AND source_id = ?');
    const row = stmt.get(source, sourceId) as CachedPlaylist | undefined;
    
    if (!row) return null;
    
    return {
      ...row,
      tracks: JSON.parse(row.tracks)
    };
  }

  /**
   * Save cached playlist
   */
  saveCachedPlaylist(
    source: string,
    sourceId: string,
    name: string,
    description: string | undefined,
    tracks: ExternalTrack[],
    coverUrl?: string
  ): void {
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = this.db.prepare(`
      INSERT INTO cached_playlists (source, source_id, name, description, tracks, cover_url, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, source_id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        tracks = excluded.tracks,
        cover_url = excluded.cover_url,
        scraped_at = excluded.scraped_at
    `);
    
    stmt.run(source, sourceId, name, description, JSON.stringify(tracks), coverUrl, now);
  }

  /**
   * Get stale cached playlists (older than maxAgeHours)
   */
  getStaleCache(maxAgeHours: number): ParsedCachedPlaylist[] {
    const cutoff = Math.floor(Date.now() / 1000) - (maxAgeHours * 3600);
    
    const stmt = this.db.prepare('SELECT * FROM cached_playlists WHERE scraped_at < ?');
    const rows = stmt.all(cutoff) as CachedPlaylist[];
    
    return rows.map(row => ({
      ...row,
      tracks: JSON.parse(row.tracks)
    }));
  }

  /**
   * Get all cached playlists
   */
  getAllCachedPlaylists(): ParsedCachedPlaylist[] {
    const stmt = this.db.prepare('SELECT * FROM cached_playlists ORDER BY scraped_at DESC');
    const rows = stmt.all() as CachedPlaylist[];
    
    return rows.map(row => ({
      ...row,
      tracks: JSON.parse(row.tracks)
    }));
  }

  /**
   * Delete old cached playlists
   */
  deleteOldCache(maxAgeDays: number): number {
    const cutoff = Math.floor(Date.now() / 1000) - (maxAgeDays * 86400);
    const stmt = this.db.prepare('DELETE FROM cached_playlists WHERE scraped_at < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }

  // ==================== Admin Operations ====================

  /**
   * Get all users (admin only)
   */
  getAllUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as User[];
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Get playlist count
   */
  getPlaylistCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM playlists');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Get missing track statistics (most commonly missing tracks)
   */
  getMissingTrackStats(): MissingTrackStat[] {
    const stmt = this.db.prepare(`
      SELECT 
        title || ' - ' || artist as track,
        artist,
        COUNT(*) as count
      FROM missing_tracks
      GROUP BY title, artist
      ORDER BY count DESC
      LIMIT 100
    `);
    return stmt.all() as MissingTrackStat[];
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId: number): boolean {
    const stmt = this.db.prepare('SELECT user_id FROM admin_users WHERE user_id = ?');
    return stmt.get(userId) !== undefined;
  }

  /**
   * Add admin user
   */
  addAdmin(userId: number): void {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO admin_users (user_id) VALUES (?)');
    stmt.run(userId);
  }

  /**
   * Remove admin user
   */
  removeAdmin(userId: number): void {
    const stmt = this.db.prepare('DELETE FROM admin_users WHERE user_id = ?');
    stmt.run(userId);
  }

  /**
   * Enable a user
   */
  enableUser(userId: number): void {
    const stmt = this.db.prepare('UPDATE users SET is_enabled = 1 WHERE id = ?');
    stmt.run(userId);
  }

  /**
   * Disable a user
   */
  disableUser(userId: number): void {
    const stmt = this.db.prepare('UPDATE users SET is_enabled = 0 WHERE id = ?');
    stmt.run(userId);
  }

  /**
   * Check if a user is enabled
   */
  isUserEnabled(userId: number): boolean {
    const stmt = this.db.prepare('SELECT is_enabled FROM users WHERE id = ?');
    const result = stmt.get(userId) as { is_enabled: number } | undefined;
    // Default to enabled if column doesn't exist yet (migration pending)
    return result ? result.is_enabled !== 0 : true;
  }

  /**
   * Delete a user and all their data
   */
  deleteUser(userId: number): void {
    // Foreign keys with CASCADE will handle related data
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(userId);
  }

  /**
   * Copy server config from one user to another
   */
  copyServerConfig(fromUserId: number, toUserId: number): void {
    const sourceServer = this.getUserServer(fromUserId);
    if (sourceServer) {
      this.saveUserServer(
        toUserId,
        sourceServer.server_name,
        sourceServer.server_client_id,
        sourceServer.server_url,
        sourceServer.library_id,
        sourceServer.library_name
      );
    }
  }

  /**
   * Get the first admin user (server owner)
   */
  getFirstAdmin(): User | null {
    const stmt = this.db.prepare(`
      SELECT u.* FROM users u
      INNER JOIN admin_users a ON u.id = a.user_id
      ORDER BY u.created_at ASC
      LIMIT 1
    `);
    const result = stmt.get() as User | undefined;
    return result ?? null;
  }

  // ==================== Playlist Sharing Operations ====================

  /**
   * Share a playlist with multiple users
   */
  sharePlaylistWithUsers(
    playlistId: number,
    ownerUserId: number,
    userIds: number[],
    metadata: { plexPlaylistId: string; playlistName: string }
  ): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO playlist_shares 
      (playlist_id, owner_user_id, shared_with_user_id, plex_playlist_id, playlist_name, shared_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    let sharedCount = 0;

    for (const userId of userIds) {
      // Don't share with yourself
      if (userId === ownerUserId) continue;

      try {
        stmt.run(
          playlistId,
          ownerUserId,
          userId,
          metadata.plexPlaylistId,
          metadata.playlistName,
          now
        );
        sharedCount++;
      } catch (error) {
        // Skip if already shared or other error
        continue;
      }
    }

    return sharedCount;
  }

  /**
   * Get playlists shared with a user
   */
  getPlaylistsSharedWithUser(userId: number): Array<{
    id: number;
    playlistName: string;
    ownerUsername: string;
    sharedAt: number;
    trackCount: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        ps.id,
        ps.playlist_name as playlistName,
        u.plex_username as ownerUsername,
        ps.shared_at as sharedAt,
        0 as trackCount
      FROM playlist_shares ps
      JOIN users u ON ps.owner_user_id = u.id
      WHERE ps.shared_with_user_id = ?
      ORDER BY ps.shared_at DESC
    `);

    return stmt.all(userId) as any[];
  }

  /**
   * Get playlist by Plex ID
   */
  getPlaylistByPlexId(plexPlaylistId: string): Playlist | null {
    const stmt = this.db.prepare(`
      SELECT * FROM playlists WHERE plex_playlist_id = ?
    `);

    return stmt.get(plexPlaylistId) as Playlist | null;
  }


}


