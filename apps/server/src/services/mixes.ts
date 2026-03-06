/**
 * Mix Generation Service
 * 
 * Generates personalized playlists based on user's listening history:
 * - Weekly Mix: Top tracks from most-played artists
 * - Daily Mix: Recent plays + related tracks + rediscoveries
 * - Time Capsule: Old tracks with artist diversity
 * - New Music Mix: Tracks from recently added albums
 */

import { PlexClient } from './plex';

export interface MixSettings {
  weeklyMix: {
    topArtists: number;
    tracksPerArtist: number;
  };
  dailyMix: {
    recentTracks: number;
    relatedTracks: number;
    rediscoveryTracks: number;
    rediscoveryDays: number;
  };
  timeCapsule: {
    trackCount: number;
    daysAgo: number;
    maxPerArtist: number;
  };
  newMusic: {
    albumCount: number;
    tracksPerAlbum: number;
  };
}

export interface MixResult {
  trackKeys: string[];
  trackCount: number;
}

export class MixService {
  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Create a PlexClient instance for the given server and token
   */
  private createPlexClient(serverUrl: string, plexToken: string): PlexClient {
    return new PlexClient(serverUrl, plexToken);
  }

  /**
   * Generate Weekly Mix: Top tracks from user's most-played artists
   */
  async generateWeeklyMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: MixSettings['weeklyMix']
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get recently played tracks (last 7 days, fallback to 30 days)
    let recentTracks = await plex.getRecentTracks(libraryId, 7);
    
    if (recentTracks.length < 20) {
      recentTracks = await plex.getRecentTracks(libraryId, 30);
    }

    // Count plays per artist
    const artistCounts = new Map<string, number>();
    for (const track of recentTracks) {
      const artist = track.grandparentTitle || 'Unknown';
      // Skip generic artists
      if (artist === 'Various Artists' || artist === 'Unknown' || artist === 'Soundtrack') {
        continue;
      }
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    }

    // Get top N artists by play count
    const topArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, settings.topArtists)
      .map(([name]) => name);

    if (topArtists.length === 0) {
      return { trackKeys: [], trackCount: 0 };
    }

    // Find these artists in the library and get their popular tracks
    const allTracks: string[] = [];
    const addedKeys = new Set<string>();

    for (const artistName of topArtists) {
      const artist = await plex.searchArtist(libraryId, artistName);
      if (!artist) continue;

      const tracks = await plex.getArtistPopularTracks(
        libraryId,
        artist.ratingKey,
        settings.tracksPerArtist
      );

      for (const track of tracks) {
        if (!addedKeys.has(track.ratingKey)) {
          allTracks.push(track.ratingKey);
          addedKeys.add(track.ratingKey);
        }
      }
    }

    return {
      trackKeys: this.shuffle(allTracks),
      trackCount: allTracks.length
    };
  }

  /**
   * Generate Daily Mix: Recent plays + related tracks + rediscoveries
   */
  async generateDailyMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: MixSettings['dailyMix']
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);
    const addedKeys = new Set<string>();
    const mixTracks: string[] = [];

    // 1. Get recent listened tracks
    const recentTracks = await plex.getRecentTracks(libraryId, 7);
    const seedTracks = recentTracks.slice(0, settings.recentTracks);

    // Add seed tracks
    for (const track of seedTracks) {
      if (!addedKeys.has(track.ratingKey)) {
        mixTracks.push(track.ratingKey);
        addedKeys.add(track.ratingKey);
      }
    }

    // 2. For each seed track, get related tracks (similar/same artist)
    const relatedPerSeed = Math.ceil(settings.relatedTracks / Math.max(seedTracks.length, 1));
    for (const seed of seedTracks) {
      if (mixTracks.length >= settings.recentTracks + settings.relatedTracks) break;

      const related = await plex.getSimilarTracks(seed.ratingKey, relatedPerSeed);

      for (const track of related) {
        if (!addedKeys.has(track.ratingKey)) {
          mixTracks.push(track.ratingKey);
          addedKeys.add(track.ratingKey);
        }
      }
    }

    // 3. Get tracks not played in X days (rediscoveries)
    const staleTracks = await plex.getStalePlayedTracks(
      libraryId,
      settings.rediscoveryDays,
      settings.rediscoveryTracks
    );

    for (const track of staleTracks) {
      if (!addedKeys.has(track.ratingKey)) {
        mixTracks.push(track.ratingKey);
        addedKeys.add(track.ratingKey);
      }
    }

    return {
      trackKeys: this.shuffle(mixTracks),
      trackCount: mixTracks.length
    };
  }

  /**
   * Generate Time Capsule: Old tracks with artist diversity
   */
  async generateTimeCapsule(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: MixSettings['timeCapsule']
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Fetch a larger pool of tracks not played in X days
    const poolSize = settings.trackCount * 10;
    const allTracks = await plex.getStalePlayedTracks(
      libraryId,
      settings.daysAgo,
      poolSize
    );

    if (allTracks.length === 0) {
      return { trackKeys: [], trackCount: 0 };
    }

    // Group tracks by artist
    const tracksByArtist = new Map<string, any[]>();
    for (const track of allTracks) {
      const artist = track.grandparentTitle || 'Unknown';
      if (!tracksByArtist.has(artist)) {
        tracksByArtist.set(artist, []);
      }
      tracksByArtist.get(artist)!.push(track);
    }

    // Select tracks with artist diversity using round-robin
    const selectedTracks: any[] = [];
    const artistQueues = Array.from(tracksByArtist.entries()).map(([artist, tracks]) => ({
      artist,
      tracks: [...tracks],
      selected: 0
    }));

    // Shuffle artist order for variety
    for (let i = artistQueues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [artistQueues[i], artistQueues[j]] = [artistQueues[j], artistQueues[i]];
    }

    // Round-robin selection: take one track from each artist in rotation
    let hasMore = true;
    while (selectedTracks.length < settings.trackCount && hasMore) {
      hasMore = false;
      for (const queue of artistQueues) {
        if (selectedTracks.length >= settings.trackCount) break;
        if (queue.selected >= settings.maxPerArtist) continue;
        if (queue.tracks.length === 0) continue;

        // Pick a random track from this artist's remaining tracks
        const randomIndex = Math.floor(Math.random() * queue.tracks.length);
        const track = queue.tracks.splice(randomIndex, 1)[0];
        selectedTracks.push(track);
        queue.selected++;
        hasMore = true;
      }
    }

    return {
      trackKeys: this.shuffle(selectedTracks.map(t => t.ratingKey)),
      trackCount: selectedTracks.length
    };
  }

  /**
   * Generate New Music Mix: Tracks from recently added albums
   */
  async generateNewMusicMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: MixSettings['newMusic']
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get recently added albums
    const albums = await plex.getRecentlyAddedAlbums(libraryId, settings.albumCount);

    const trackKeys: string[] = [];
    const addedKeys = new Set<string>();

    // Get tracks from each album
    for (const album of albums) {
      const tracks = await plex.getAlbumTracks(album.ratingKey);
      
      // Shuffle and take N tracks per album
      const shuffledTracks = this.shuffle(tracks).slice(0, settings.tracksPerAlbum);
      
      for (const track of shuffledTracks) {
        if (!addedKeys.has(track.ratingKey)) {
          trackKeys.push(track.ratingKey);
          addedKeys.add(track.ratingKey);
        }
      }
    }

    return {
      trackKeys: this.shuffle(trackKeys),
      trackCount: trackKeys.length
    };
  }

  /**
   * Generate custom mix with advanced filters
   */
  async generateCustomMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
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
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Build query filters
    const filters: string[] = [];

    // Time filters
    if (settings.playedInLastDays) {
      const daysAgo = Math.floor(Date.now() / 1000) - (settings.playedInLastDays * 24 * 60 * 60);
      filters.push(`lastViewedAt>=${daysAgo}`);
    }

    if (settings.notPlayedInLastDays) {
      const daysAgo = Math.floor(Date.now() / 1000) - (settings.notPlayedInLastDays * 24 * 60 * 60);
      filters.push(`lastViewedAt<${daysAgo}`);
    }

    if (settings.addedInLastDays) {
      const daysAgo = Math.floor(Date.now() / 1000) - (settings.addedInLastDays * 24 * 60 * 60);
      filters.push(`addedAt>=${daysAgo}`);
    }

    // Release date filters
    if (settings.releasedAfterYear) {
      filters.push(`year>=${settings.releasedAfterYear}`);
    }

    if (settings.releasedBeforeYear) {
      filters.push(`year<=${settings.releasedBeforeYear}`);
    }

    // Rating filter
    if (settings.minRating) {
      filters.push(`userRating>=${settings.minRating}`);
    }

    // Get tracks with filters
    let tracks = await plex.getTracksWithFilters(libraryId, filters);

    // Apply genre filters (client-side since Plex API genre filtering is complex)
    if (settings.genres && settings.genres.length > 0) {
      const genreLower = settings.genres.map(g => g.toLowerCase());
      tracks = tracks.filter(track => {
        const trackGenres = track.Genre?.map((g: any) => g.tag.toLowerCase()) || [];
        return genreLower.some(genre => trackGenres.includes(genre));
      });
    }

    if (settings.excludeGenres && settings.excludeGenres.length > 0) {
      const excludeLower = settings.excludeGenres.map(g => g.toLowerCase());
      tracks = tracks.filter(track => {
        const trackGenres = track.Genre?.map((g: any) => g.tag.toLowerCase()) || [];
        return !excludeLower.some(genre => trackGenres.includes(genre));
      });
    }

    // Sort tracks
    if (settings.sortBy !== 'random') {
      tracks.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (settings.sortBy) {
          case 'playCount':
            aVal = a.viewCount || 0;
            bVal = b.viewCount || 0;
            break;
          case 'lastPlayed':
            aVal = a.lastViewedAt || 0;
            bVal = b.lastViewedAt || 0;
            break;
          case 'dateAdded':
            aVal = a.addedAt || 0;
            bVal = b.addedAt || 0;
            break;
          case 'releaseDate':
            aVal = a.year || 0;
            bVal = b.year || 0;
            break;
          case 'rating':
            aVal = a.userRating || 0;
            bVal = b.userRating || 0;
            break;
          default:
            return 0;
        }

        return settings.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    } else {
      tracks = this.shuffle(tracks);
    }

    // Limit to requested track count
    const selectedTracks = tracks.slice(0, settings.trackCount);

    return {
      trackKeys: selectedTracks.map(t => t.ratingKey),
      trackCount: selectedTracks.length
    };
  }

  /**
   * Generate all mixes at once
   */
  async generateAllMixes(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: MixSettings
  ): Promise<{
    weekly: MixResult;
    daily: MixResult;
    timeCapsule: MixResult;
    newMusic: MixResult;
  }> {
    const [weekly, daily, timeCapsule, newMusic] = await Promise.all([
      this.generateWeeklyMix(serverUrl, plexToken, libraryId, settings.weeklyMix),
      this.generateDailyMix(serverUrl, plexToken, libraryId, settings.dailyMix),
      this.generateTimeCapsule(serverUrl, plexToken, libraryId, settings.timeCapsule),
      this.generateNewMusicMix(serverUrl, plexToken, libraryId, settings.newMusic)
    ]);

    return { weekly, daily, timeCapsule, newMusic };
  }
}
