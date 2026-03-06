import type {
  User,
  PlexServer,
  UserSettings,
  MatchingSettings,
  MixSettings,
  Playlist,
  Schedule,
  MissingTrack,
  MatchedTrack,
} from '../types';

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class APIClient {
  constructor(private baseURL: string, private getToken?: () => string | null) {}

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const token = this.getToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
      };

      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for session
      });

      if (!response.ok) {
        const error: any = await response.json().catch(() => ({
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred',
            statusCode: response.status,
          },
        }));

        throw new APIError(
          error.error?.code || 'UNKNOWN_ERROR',
          error.error?.message || 'Request failed',
          response.status,
          error.error?.details
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      if (error instanceof TypeError) {
        throw new NetworkError('Network error - check your connection');
      }
      throw error;
    }
  }

  // Auth methods
  async startAuth(): Promise<{ id: number; code: string; expiresAt: string }> {
    return this.request('/api/auth/start', { method: 'POST' });
  }

  async pollAuth(
    pinId: number,
    code: string
  ): Promise<{ authToken?: string; user?: User }> {
    return this.request('/api/auth/poll', {
      method: 'POST',
      body: JSON.stringify({ pinId, code }),
    });
  }

  async logout(): Promise<void> {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async getMe(): Promise<User> {
    return this.request('/api/auth/me');
  }

  // Server methods
  async getServers(): Promise<PlexServer[]> {
    const response = await this.request<{ servers: PlexServer[] }>('/api/servers');
    return response.servers;
  }

  async selectServer(server: PlexServer): Promise<void> {
    return this.request('/api/servers/select', {
      method: 'POST',
      body: JSON.stringify(server),
    });
  }

  async getLibraries(): Promise<
    Array<{ id: string; name: string; type: string }>
  > {
    return this.request('/api/servers/libraries');
  }

  // Settings methods
  async getSettings(): Promise<UserSettings> {
    return this.request('/api/settings');
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async updateMatchingSettings(
    settings: Partial<MatchingSettings>
  ): Promise<UserSettings> {
    return this.request('/api/settings/matching', {
      method: 'PUT',
      body: JSON.stringify({ matchingSettings: settings }),
    });
  }

  async updateMixSettings(settings: Partial<MixSettings>): Promise<UserSettings> {
    return this.request('/api/settings/mixes', {
      method: 'PUT',
      body: JSON.stringify({ mixSettings: settings }),
    });
  }

  // Playlist methods
  async getPlaylists(userId?: number): Promise<{ playlists: any[] }> {
    const url = userId ? `/api/playlists?userId=${userId}` : '/api/playlists';
    return this.request(url);
  }

  async getPlaylist(id: number): Promise<{ playlist: any }> {
    return this.request(`/api/playlists/${id}`);
  }

  async createPlaylist(data: {
    name: string;
    tracks: string[];
  }): Promise<{ playlist: any }> {
    return this.request('/api/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlaylist(
    id: number,
    data: Partial<Playlist>
  ): Promise<{ playlist: any }> {
    return this.request(`/api/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePlaylist(id: number | string): Promise<{ success: boolean }> {
    return this.request(`/api/playlists/${id}`, { method: 'DELETE' });
  }

  async getPlaylistTracks(id: number | string): Promise<{ tracks: any[] }> {
    return this.request(`/api/playlists/${id}/tracks`);
  }

  async sharePlaylist(id: number | string, targetUserId: number): Promise<{ success: boolean; playlistName: string; trackCount: number }> {
    return this.request(`/api/playlists/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }

  async addTrackToPlaylist(id: number | string, trackUri: string): Promise<{ success: boolean }> {
    return this.request(`/api/playlists/${id}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ trackUris: [trackUri] }),
    });
  }

  async removeTrackFromPlaylist(id: number | string, trackId: string): Promise<{ success: boolean }> {
    return this.request(`/api/playlists/${id}/tracks/${trackId}`, {
      method: 'DELETE',
    });
  }

  // Import methods
  async importSpotify(url: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/spotify', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async importDeezer(playlistId: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/deezer', {
      method: 'POST',
      body: JSON.stringify({ playlistId }),
    });
  }

  async importAppleMusic(url: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/apple', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async importTidal(url: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/tidal', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async importYouTubeMusic(url: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/youtube', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async importAmazonMusic(url: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/amazon', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async importQobuz(url: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/qobuz', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async importListenBrainz(username: string): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    return this.request('/api/import/listenbrainz', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async importFile(file: File): Promise<{
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
    playlistName: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken?.();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}/api/import/file`, {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new APIError(
        error.error?.code || 'UNKNOWN_ERROR',
        error.error?.message || 'Import failed',
        response.status,
        error.error?.details
      );
    }

    return response.json() as any;
  }

  async confirmImport(data: {
    playlistName: string;
    source: string;
    sourceUrl?: string;
    tracks: MatchedTrack[];
    saveMissingTracks?: boolean;
    missingTracks?: Array<{ title: string; artist: string; album?: string }>;
    overwriteExisting?: boolean;
    keepExistingCover?: boolean;
    coverUrl?: string;
  }): Promise<Playlist> {
    return this.request('/api/import/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Mix methods
  async generateWeeklyMix(): Promise<Playlist> {
    return this.request('/api/mixes/weekly', { method: 'POST' });
  }

  async generateDailyMix(): Promise<Playlist> {
    return this.request('/api/mixes/daily', { method: 'POST' });
  }

  async generateTimeCapsule(): Promise<Playlist> {
    return this.request('/api/mixes/timecapsule', { method: 'POST' });
  }

  async generateNewMusicMix(): Promise<Playlist> {
    return this.request('/api/mixes/newmusic', { method: 'POST' });
  }

  async generateCustomMix(settings: {
    name: string;
    trackCount: number;
    playedInLastDays?: number;
    notPlayedInLastDays?: number;
    addedInLastDays?: number;
    releasedAfterYear?: number;
    releasedBeforeYear?: number;
    genres?: string[];
    excludeGenres?: string[];
    minRating?: number;
    sortBy: 'random' | 'playCount' | 'lastPlayed' | 'dateAdded' | 'releaseDate' | 'rating';
    sortDirection: 'asc' | 'desc';
  }): Promise<Playlist> {
    return this.request('/api/mixes/custom', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });
  }

  async generateAllMixes(): Promise<Playlist[]> {
    return this.request('/api/mixes/all', { method: 'POST' });
  }

  // Schedule methods
  async getSchedules(): Promise<Schedule[]> {
    return this.request('/api/schedules');
  }

  async createSchedule(schedule: Omit<Schedule, 'id' | 'userId' | 'lastRun'>): Promise<Schedule> {
    // Transform camelCase to snake_case for backend
    const body = {
      playlist_id: schedule.playlistId,
      schedule_type: schedule.scheduleType,
      frequency: schedule.frequency,
      start_date: schedule.startDate,
      config: schedule.config,
    };
    
    console.log('Creating schedule - input:', schedule);
    console.log('Creating schedule - transformed body:', body);
    console.log('Creating schedule - stringified:', JSON.stringify(body));
    
    return this.request('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateSchedule(
    id: number,
    schedule: Partial<Schedule>
  ): Promise<Schedule> {
    // Transform camelCase to snake_case for backend
    const body: any = {};
    if (schedule.playlistId !== undefined) body.playlist_id = schedule.playlistId;
    if (schedule.scheduleType !== undefined) body.schedule_type = schedule.scheduleType;
    if (schedule.frequency !== undefined) body.frequency = schedule.frequency;
    if (schedule.startDate !== undefined) body.start_date = schedule.startDate;
    if (schedule.config !== undefined) body.config = schedule.config;
    
    return this.request(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteSchedule(id: number): Promise<void> {
    return this.request(`/api/schedules/${id}`, { method: 'DELETE' });
  }

  // Missing tracks methods
  async getMissingTracks(): Promise<{
    missingTracks: Array<{
      playlistId: number;
      playlistName: string;
      source: string;
      tracks: MissingTrack[];
    }>;
    totalCount: number;
  }> {
    return this.request('/api/missing');
  }

  async retryMissingTracks(playlistId?: number, trackIds?: number[]): Promise<{
    matched: number;
    remaining: number;
  }> {
    return this.request('/api/missing/retry', {
      method: 'POST',
      body: JSON.stringify({ playlistId, trackIds }),
    });
  }

  async removeMissingTrack(id: number): Promise<void> {
    return this.request(`/api/missing/${id}`, { method: 'DELETE' });
  }

  async rematchMissingTrack(id: number, ratingKey: string): Promise<{ success: boolean }> {
    return this.request(`/api/missing/${id}/rematch`, {
      method: 'POST',
      body: JSON.stringify({ ratingKey }),
    });
  }

  async clearPlaylistMissingTracks(playlistId: number): Promise<void> {
    return this.request(`/api/missing/playlist/${playlistId}`, {
      method: 'DELETE',
    });
  }

  async addMissingTracks(data: {
    playlistId: number;
    tracks: Array<{ title: string; artist: string; album?: string; position?: number }>;
    source: string;
  }): Promise<{ success: boolean; added: number; message: string }> {
    return this.request('/api/missing/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveMissingTracks(data: {
    playlistName: string;
    source: string;
    sourceUrl?: string;
    tracks: Array<{ title: string; artist: string; album?: string }>;
    matchedTracks?: Array<{ plexRatingKey?: string; title: string; artist: string }>;
    overwriteExisting?: boolean;
    keepExistingCover?: boolean;
    coverUrl?: string;
  }): Promise<{ success: boolean; playlistId: number; added: number; message: string }> {
    return this.request('/api/missing/save', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin methods
  async getAdminStats(): Promise<{
    userCount: number;
    activeUsers: number;
    playlistCount: number;
    missingTrackCount: number;
  }> {
    const data = await this.request<{ stats: any }>('/api/admin/stats');
    return {
      userCount: data.stats.totalUsers,
      activeUsers: data.stats.activeUsers,
      playlistCount: data.stats.totalPlaylists,
      missingTrackCount: data.stats.totalMissingTracks,
    };
  }

  async getAdminUsers(): Promise<User[]> {
    const data = await this.request<{ users: User[] }>('/api/admin/users');
    return data.users;
  }

  async getAdminMissingTracks(): Promise<
    Array<{ track: string; artist: string; count: number }>
  > {
    const data = await this.request<{ missingTracks: Array<{ track: string; artist: string; count: number }> }>('/api/admin/missing');
    return data.missingTracks;
  }

  async getAdminJobs(): Promise<
    Array<{ name: string; status: string; lastRun?: number }>
  > {
    const data = await this.request<{ jobs: Array<{ name: string; status: string; lastRun?: number }> }>('/api/admin/jobs');
    return data.jobs;
  }

  async enableUser(userId: number): Promise<{ success: boolean }> {
    return this.request(`/api/admin/users/${userId}/enable`, { method: 'POST' });
  }

  async disableUser(userId: number): Promise<{ success: boolean }> {
    return this.request(`/api/admin/users/${userId}/disable`, { method: 'POST' });
  }

  async deleteUser(userId: number): Promise<{ success: boolean }> {
    return this.request(`/api/admin/users/${userId}`, { method: 'DELETE' });
  }

  async getHomeUsers(): Promise<
    Array<{ id: number; title: string; username: string; thumb: string; admin: boolean; restricted: boolean; guest: boolean }>
  > {
    const data = await this.request<{ homeUsers: any[] }>('/api/admin/home-users');
    return data.homeUsers;
  }

  // Migration methods
  async migrateDesktopData(data: any): Promise<{
    playlists: number;
    schedules: number;
    missingTracks: number;
  }> {
    return this.request('/api/migrate/desktop', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
