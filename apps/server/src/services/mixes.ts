/**
 * Mix Generation Service
 * 
 * Generates personalized playlists based on user's listening history:
 * - Weekly Mix: Top tracks from most-played artists
 * - Daily Mix: Recent plays + related tracks + rediscoveries
 * - Time Capsule: Old tracks with artist diversity
 * - New Music Mix: Tracks from recently added albums
 */

import { PlexClient, PlexTrack } from './plex';

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
      
      // Time filters
      playedInLastDays?: number;
      notPlayedInLastDays?: number;
      addedInLastDays?: number;
      
      // Release date filters
      releasedAfterYear?: number;
      releasedBeforeYear?: number;
      
      // Rating & popularity
      minRating?: number;
      maxRating?: number;
      minPlayCount?: number;
      maxPlayCount?: number;
      popularTracksOnly?: boolean; // Only include tracks from Plex's "Popular Tracks" section
      popularArtistsOnly?: boolean; // Only include tracks from popular/well-known artists
      
      // Track characteristics
      minDuration?: number; // in seconds
      maxDuration?: number; // in seconds
      minTrackNumber?: number;
      maxTrackNumber?: number;
      discNumber?: number;
      
      // Quality filters
      minBitrate?: number; // in kbps
      audioCodec?: string[]; // e.g., ['flac', 'mp3']
      minSampleRate?: number; // in Hz
      losslessOnly?: boolean;
      
      // Metadata filters
      genres?: string[];
      excludeGenres?: string[];
      moods?: string[];
      excludeMoods?: string[];
      styles?: string[];
      excludeStyles?: string[];
      collections?: string[];
      labels?: string[]; // record labels
      
      // Artist/Album filters
      artistNames?: string[];
      albumTitles?: string[];
      
      // Sonic Analysis filters
      sonicSeedTrackKey?: string;
      sonicSeedArtistKey?: string;
      sonicMaxDistance?: number;
      sonicIncludeSameArtist?: boolean;
      sonicIncludeSimilarArtists?: boolean;
      sonicUsePopularTracks?: boolean;
      
      // Sorting
      sortBy: 'random' | 'playCount' | 'lastPlayed' | 'dateAdded' | 'releaseDate' | 'rating' | 'duration' | 'title';
      sortDirection: 'asc' | 'desc';
    },
    progressEmitter?: any
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    let tracks: PlexTrack[] = [];

    // If popularTracksOnly is requested, get popular tracks from all artists
    if (settings.popularTracksOnly) {
      progressEmitter?.emit('progress', {
        type: 'progress',
        stage: 'fetching_artists',
        message: 'Fetching artists from library...',
        progress: 10
      });
      
      // Get all artists from the library
      const allArtists = await plex.getTracksWithAdvancedFilters(libraryId, {
        sortBy: 'random',
        sortDirection: 'desc',
        limit: 1000 // Get a large sample
      });

      // Extract unique artists
      const artistKeys = new Set<string>();
      allArtists.forEach(track => {
        if (track.grandparentRatingKey) {
          artistKeys.add(track.grandparentRatingKey);
        }
      });

      progressEmitter?.emit('progress', {
        type: 'progress',
        stage: 'fetching_popular',
        message: `Fetching popular tracks from ${artistKeys.size} artists...`,
        progress: 30
      });

      // Get popular tracks from each artist
      const popularTracksPerArtist = Math.max(3, Math.ceil(settings.trackCount / artistKeys.size));
      const allPopularTracks: PlexTrack[] = [];

      let processed = 0;
      for (const artistKey of Array.from(artistKeys)) {
        try {
          const popularTracks = await plex.getArtistPopularTracks(
            libraryId,
            artistKey,
            popularTracksPerArtist
          );
          allPopularTracks.push(...popularTracks);
          
          processed++;
          if (processed % 10 === 0) {
            progressEmitter?.emit('progress', {
              type: 'progress',
              stage: 'fetching_popular',
              message: `Processed ${processed}/${artistKeys.size} artists...`,
              progress: 30 + (processed / artistKeys.size) * 40
            });
          }
        } catch (error) {
          // Skip artists that fail
          continue;
        }
      }

      tracks = allPopularTracks;
    }
    // If sonic analysis is requested, use that as the primary source
    else if (settings.sonicSeedTrackKey || settings.sonicSeedArtistKey) {
      progressEmitter?.emit('progress', {
        type: 'progress',
        stage: 'sonic_analysis',
        message: 'Analyzing sonic similarity...',
        progress: 20
      });
      
      const seedKey = settings.sonicSeedTrackKey || settings.sonicSeedArtistKey!;
      
      // If popular tracks are requested and we have an artist seed
      if (settings.sonicUsePopularTracks && settings.sonicSeedArtistKey) {
        const popularTracks = await plex.getArtistPopularTracks(
          libraryId, 
          settings.sonicSeedArtistKey, 
          settings.trackCount
        );
        tracks = popularTracks;
      } else {
        // Get sonically similar tracks
        const sonicTracks = await plex.getSonicallySimilarTracks(
          seedKey,
          libraryId,
          {
            limit: settings.trackCount * 3, // Get more for filtering
            maxDistance: settings.sonicMaxDistance || 0.25,
          }
        );

        tracks = sonicTracks;
      }

      progressEmitter?.emit('progress', {
        type: 'progress',
        stage: 'expanding_results',
        message: 'Expanding results with similar artists...',
        progress: 50
      });

      // If seed is a track and we want same artist tracks
      if (settings.sonicSeedTrackKey && settings.sonicIncludeSameArtist) {
        const seedTrack = await plex.getTrackDetails(settings.sonicSeedTrackKey);
        if (seedTrack?.grandparentRatingKey) {
          const artistTracks = await plex.getArtistPopularTracks(libraryId, seedTrack.grandparentRatingKey, 20);
          tracks = [...tracks, ...artistTracks];
        }
      }

      // If we want similar artists' tracks
      if (settings.sonicIncludeSimilarArtists) {
        const seedArtistKey = settings.sonicSeedArtistKey || 
          (settings.sonicSeedTrackKey ? (await plex.getTrackDetails(settings.sonicSeedTrackKey))?.grandparentRatingKey : undefined);
        
        if (seedArtistKey) {
          // Get similar tracks which often include tracks from similar artists
          const similarTracks = await plex.getSimilarTracks(seedArtistKey, 50);
          tracks = [...tracks, ...similarTracks];
        }
      }

      // Remove duplicates
      const uniqueTracks = new Map<string, PlexTrack>();
      tracks.forEach(track => uniqueTracks.set(track.ratingKey, track));
      tracks = Array.from(uniqueTracks.values());
    } else {
      progressEmitter?.emit('progress', {
        type: 'progress',
        stage: 'fetching_tracks',
        message: 'Fetching tracks from library...',
        progress: 30
      });
      
      // Use the standard advanced filtering method
      tracks = await plex.getTracksWithAdvancedFilters(libraryId, {
        ...settings,
        limit: settings.trackCount * 2 // Get more tracks than needed for better variety
      });
    }

    progressEmitter?.emit('progress', {
      type: 'progress',
      stage: 'filtering',
      message: 'Applying filters...',
      progress: 70
    });

    // Apply additional filters if specified (even for sonic results)
    if (settings.genres || settings.excludeGenres || settings.minRating || settings.minPlayCount || settings.popularArtistsOnly) {
      
      // If popularArtistsOnly is enabled, we need to check artist popularity first
      if (settings.popularArtistsOnly) {
        progressEmitter?.emit('progress', {
          type: 'progress',
          stage: 'filtering_artists',
          message: 'Filtering by popular artists (Last.fm data)...',
          progress: 75
        });

        // Get unique artist keys from tracks
        const artistKeys = new Set<string>();
        tracks.forEach(track => {
          if (track.grandparentRatingKey) {
            artistKeys.add(track.grandparentRatingKey);
          }
        });

        // Check each artist for Last.fm popularity data
        const popularArtistKeys = new Set<string>();
        let checkedCount = 0;
        
        for (const artistKey of Array.from(artistKeys)) {
          try {
            const artistDetails = await plex.getArtistDetails(artistKey);
            
            // Artists with ratingCount > 0 have external popularity data from Last.fm/MusicBrainz
            // This indicates the artist is well-known enough to have ratings on Last.fm
            if (artistDetails && artistDetails.ratingCount && artistDetails.ratingCount > 0) {
              popularArtistKeys.add(artistKey);
              console.log(`[Popular Artist] ${artistDetails.title}: ratingCount=${artistDetails.ratingCount}`);
            }
            
            checkedCount++;
            if (checkedCount % 10 === 0) {
              progressEmitter?.emit('progress', {
                type: 'progress',
                stage: 'filtering_artists',
                message: `Checked ${checkedCount}/${artistKeys.size} artists for Last.fm data...`,
                progress: 75 + (checkedCount / artistKeys.size) * 10
              });
            }
          } catch (error) {
            // Skip artists that fail to fetch
            continue;
          }
        }

        console.log(`[Popular Artists Filter] Found ${popularArtistKeys.size} popular artists out of ${artistKeys.size} total`);

        // Filter tracks to only include those from popular artists
        const beforeCount = tracks.length;
        tracks = tracks.filter(track => 
          track.grandparentRatingKey && popularArtistKeys.has(track.grandparentRatingKey)
        );
        
        console.log(`[Popular Artists Filter] Filtered from ${beforeCount} to ${tracks.length} tracks`);
        
        if (tracks.length === 0) {
          console.warn('[Popular Artists Filter] No tracks found from popular artists. This may mean:');
          console.warn('  1. Plex has not fetched Last.fm data for your artists yet');
          console.warn('  2. Your library contains mostly lesser-known artists');
          console.warn('  3. Last.fm agent is not enabled in Plex settings');
        }
      }

      // Apply other filters
      tracks = tracks.filter(track => {
        // Genre filters
        if (settings.genres && settings.genres.length > 0) {
          const trackGenres = track.Genre?.map((g: any) => g.tag.toLowerCase()) || [];
          const hasGenre = settings.genres.some(g => trackGenres.includes(g.toLowerCase()));
          if (!hasGenre) return false;
        }
        if (settings.excludeGenres && settings.excludeGenres.length > 0) {
          const trackGenres = track.Genre?.map((g: any) => g.tag.toLowerCase()) || [];
          const hasExcludedGenre = settings.excludeGenres.some(g => trackGenres.includes(g.toLowerCase()));
          if (hasExcludedGenre) return false;
        }

        // Rating filter
        if (settings.minRating && (!track.userRating || track.userRating < settings.minRating)) {
          return false;
        }

        // Play count filter
        if (settings.minPlayCount && (!track.viewCount || track.viewCount < settings.minPlayCount)) {
          return false;
        }

        return true;
      });
    }

    progressEmitter?.emit('progress', {
      type: 'progress',
      stage: 'finalizing',
      message: 'Finalizing track selection...',
      progress: 85
    });

    // Limit to requested track count
    const selectedTracks = tracks.slice(0, settings.trackCount);

    return {
      trackKeys: selectedTracks.map(t => t.ratingKey),
      trackCount: selectedTracks.length
    };
  }

  /**
   * Generate sonic similarity mix based on a seed track
   */
  async generateSonicMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      seedTrackKey: string;
      trackCount: number;
      maxDistance?: number; // 0-1, lower = more similar
      tempoRange?: { min: number; max: number };
      energyRange?: { min: number; max: number };
      danceabilityRange?: { min: number; max: number };
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    const tracks = await plex.getSonicallySimilarTracks(
      settings.seedTrackKey,
      libraryId,
      {
        maxDistance: settings.maxDistance || 0.25,
        limit: settings.trackCount,
        tempoRange: settings.tempoRange,
        energyRange: settings.energyRange,
        danceabilityRange: settings.danceabilityRange
      }
    );

    return {
      trackKeys: tracks.map(t => t.ratingKey),
      trackCount: tracks.length
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

  /**
   * Generate Deep Cuts Mix: Hidden gems (low play count, exclude popular tracks)
   */
  async generateDeepCutsMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      trackCount: number;
      maxPlayCount?: number; // Exclude tracks played more than this
      minRating?: number; // Only include rated tracks above this
      excludePopularThreshold?: number; // Percentile to exclude (e.g., top 20%)
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get all tracks sorted by play count
    const allTracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      sortBy: 'playCount',
      sortDirection: 'asc',
      limit: settings.trackCount * 3
    });

    // Filter for deep cuts
    let deepCuts = allTracks.filter(track => {
      // Exclude highly played tracks
      if (settings.maxPlayCount && track.viewCount && track.viewCount > settings.maxPlayCount) {
        return false;
      }
      
      // Only include rated tracks if minRating is set
      if (settings.minRating && (!track.userRating || track.userRating < settings.minRating)) {
        return false;
      }

      return true;
    });

    // Shuffle and limit
    deepCuts = this.shuffle(deepCuts).slice(0, settings.trackCount);

    return {
      trackKeys: deepCuts.map(t => t.ratingKey),
      trackCount: deepCuts.length
    };
  }

  /**
   * Generate Artist Discovery Mix: Tracks from similar artists
   */
  async generateArtistDiscoveryMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      seedArtistKeys: string[]; // Rating keys of favorite artists
      tracksPerArtist: number;
      maxSimilarArtists: number;
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    const allTracks: PlexTrack[] = [];

    // For each seed artist, get similar artists and their tracks
    for (const artistKey of settings.seedArtistKeys) {
      try {
        // Get related hubs for this artist
        const hubs = await plex.getRelatedHubs(artistKey);
        
        // Find "Similar Artists" or "Fans Also Like" hub
        const similarHub = hubs.find((h: any) => 
          h.title?.toLowerCase().includes('similar') || 
          h.title?.toLowerCase().includes('fans also like')
        );

        if (similarHub?.Metadata) {
          const similarArtists = similarHub.Metadata.slice(0, settings.maxSimilarArtists);
          
          // Get popular tracks from each similar artist
          for (const artist of similarArtists) {
            const tracks = await plex.getArtistPopularTracks(
              libraryId,
              artist.ratingKey,
              settings.tracksPerArtist
            );
            allTracks.push(...tracks);
          }
        }
      } catch (error) {
        console.error(`Failed to get similar artists for ${artistKey}:`, error);
      }
    }

    // Remove duplicates and shuffle
    const uniqueTracks = new Map<string, PlexTrack>();
    allTracks.forEach(track => uniqueTracks.set(track.ratingKey, track));
    const finalTracks = this.shuffle(Array.from(uniqueTracks.values()));

    return {
      trackKeys: finalTracks.map(t => t.ratingKey),
      trackCount: finalTracks.length
    };
  }

  /**
   * Generate Mood Mix: Tracks filtered by mood tags
   */
  async generateMoodMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      moods: string[]; // e.g., ["energetic", "chill", "melancholy"]
      trackCount: number;
      useSonicAnalysis?: boolean; // Use sonic similarity for consistency
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get tracks with mood filters
    const tracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      moods: settings.moods,
      limit: settings.trackCount * 2
    });

    // If sonic analysis is requested and we have tracks, use first track as seed
    if (settings.useSonicAnalysis && tracks.length > 0) {
      const seedTrack = tracks[0];
      const sonicTracks = await plex.getSonicallySimilarTracks(
        seedTrack.ratingKey,
        libraryId,
        { limit: settings.trackCount }
      );
      
      // Filter sonic tracks by mood
      const moodFilteredTracks = sonicTracks.filter(track => {
        const trackMoods = (track as any).Mood?.map((m: any) => m.tag.toLowerCase()) || [];
        return settings.moods.some(mood => trackMoods.includes(mood.toLowerCase()));
      });

      if (moodFilteredTracks.length >= settings.trackCount / 2) {
        return {
          trackKeys: moodFilteredTracks.slice(0, settings.trackCount).map(t => t.ratingKey),
          trackCount: moodFilteredTracks.length
        };
      }
    }

    // Shuffle and limit
    const finalTracks = this.shuffle(tracks).slice(0, settings.trackCount);

    return {
      trackKeys: finalTracks.map(t => t.ratingKey),
      trackCount: finalTracks.length
    };
  }

  /**
   * Generate Era Mix: Tracks from a specific decade/era
   */
  async generateEraMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      startYear: number;
      endYear: number;
      trackCount: number;
      usePopularTracks?: boolean; // Use popular tracks from that era
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get tracks from the specified era
    const tracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      releasedAfterYear: settings.startYear,
      releasedBeforeYear: settings.endYear,
      sortBy: settings.usePopularTracks ? 'playCount' : 'random',
      sortDirection: 'desc',
      limit: settings.trackCount * 2
    });

    // Shuffle if not using popular tracks
    const finalTracks = settings.usePopularTracks 
      ? tracks.slice(0, settings.trackCount)
      : this.shuffle(tracks).slice(0, settings.trackCount);

    return {
      trackKeys: finalTracks.map(t => t.ratingKey),
      trackCount: finalTracks.length
    };
  }

  /**
   * Generate Genre Evolution Mix: Show how a genre evolved over time
   */
  async generateGenreEvolutionMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      genre: string;
      trackCount: number;
      tracksPerDecade?: number;
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get all tracks in the genre
    const allTracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      genres: [settings.genre],
      sortBy: 'releaseDate',
      sortDirection: 'asc',
      limit: settings.trackCount * 3
    });

    if (allTracks.length === 0) {
      return { trackKeys: [], trackCount: 0 };
    }

    // Group by decade
    const tracksByDecade = new Map<number, PlexTrack[]>();
    allTracks.forEach(track => {
      if (track.year) {
        const decade = Math.floor(track.year / 10) * 10;
        if (!tracksByDecade.has(decade)) {
          tracksByDecade.set(decade, []);
        }
        tracksByDecade.get(decade)!.push(track);
      }
    });

    // Select tracks from each decade
    const selectedTracks: PlexTrack[] = [];
    const decades = Array.from(tracksByDecade.keys()).sort();
    const tracksPerDecade = settings.tracksPerDecade || Math.ceil(settings.trackCount / decades.length);

    for (const decade of decades) {
      const decadeTracks = tracksByDecade.get(decade)!;
      const selected = this.shuffle(decadeTracks).slice(0, tracksPerDecade);
      selectedTracks.push(...selected);
    }

    // Limit to requested count
    const finalTracks = selectedTracks.slice(0, settings.trackCount);

    return {
      trackKeys: finalTracks.map(t => t.ratingKey),
      trackCount: finalTracks.length
    };
  }

  /**
   * Generate Artist Journey Mix: Chronological journey through an artist's work
   */
  async generateArtistJourneyMix(
    serverUrl: string,
    plexToken: string,
    _libraryId: string, // Unused but kept for API consistency
    settings: {
      artistKey: string;
      tracksPerAlbum: number;
      usePopularTracks?: boolean;
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get all albums from the artist, sorted chronologically
    const albums = await plex.getArtistAlbums(settings.artistKey);
    
    // Sort by year
    albums.sort((a, b) => (a.year || 0) - (b.year || 0));

    const allTracks: PlexTrack[] = [];

    // Get tracks from each album
    for (const album of albums) {
      try {
        if (settings.usePopularTracks) {
          // Get popular tracks from this album
          const albumTracks = await plex.getAlbumTracks(album.ratingKey);
          const sortedTracks = albumTracks.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
          allTracks.push(...sortedTracks.slice(0, settings.tracksPerAlbum));
        } else {
          // Get first N tracks from album
          const albumTracks = await plex.getAlbumTracks(album.ratingKey);
          allTracks.push(...albumTracks.slice(0, settings.tracksPerAlbum));
        }
      } catch (error) {
        console.error(`Failed to get tracks for album ${album.ratingKey}:`, error);
      }
    }

    return {
      trackKeys: allTracks.map(t => t.ratingKey),
      trackCount: allTracks.length
    };
  }

  /**
   * Generate Workout Intensity Mix: Progressive tempo/energy build
   */
  async generateWorkoutMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      trackCount: number;
      warmupTracks: number; // Low intensity
      peakTracks: number; // High intensity
      cooldownTracks: number; // Low intensity
      minTempo?: number; // BPM
      maxTempo?: number; // BPM
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get tracks with tempo/energy data
    const allTracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      limit: settings.trackCount * 3
    });

    // Filter tracks with tempo data and sort by tempo
    const tracksWithTempo = allTracks
      .filter(t => (t as any).musicAnalysis?.tempo)
      .sort((a, b) => ((a as any).musicAnalysis?.tempo || 0) - ((b as any).musicAnalysis?.tempo || 0));

    if (tracksWithTempo.length === 0) {
      // Fallback: just return random tracks
      return {
        trackKeys: this.shuffle(allTracks).slice(0, settings.trackCount).map(t => t.ratingKey),
        trackCount: Math.min(allTracks.length, settings.trackCount)
      };
    }

    // Split into intensity levels
    const third = Math.floor(tracksWithTempo.length / 3);
    const lowIntensity = tracksWithTempo.slice(0, third);
    const medIntensity = tracksWithTempo.slice(third, third * 2);
    const highIntensity = tracksWithTempo.slice(third * 2);

    // Build workout progression
    const workout: PlexTrack[] = [];
    
    // Warmup
    workout.push(...this.shuffle(lowIntensity).slice(0, settings.warmupTracks));
    
    // Build to peak
    const buildTracks = Math.floor((settings.trackCount - settings.warmupTracks - settings.peakTracks - settings.cooldownTracks) / 2);
    workout.push(...this.shuffle(medIntensity).slice(0, buildTracks));
    
    // Peak
    workout.push(...this.shuffle(highIntensity).slice(0, settings.peakTracks));
    
    // Cool down from peak
    workout.push(...this.shuffle(medIntensity).slice(buildTracks, buildTracks * 2));
    
    // Final cooldown
    workout.push(...this.shuffle(lowIntensity).slice(settings.warmupTracks, settings.warmupTracks + settings.cooldownTracks));

    return {
      trackKeys: workout.map(t => t.ratingKey),
      trackCount: workout.length
    };
  }

  /**
   * Generate Forgotten Favorites Mix: High play count but not played recently
   */
  async generateForgottenFavoritesMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      trackCount: number;
      minPlayCount: number;
      notPlayedInDays: number;
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get tracks with high play count
    const tracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      minPlayCount: settings.minPlayCount,
      notPlayedInLastDays: settings.notPlayedInDays,
      sortBy: 'playCount',
      sortDirection: 'desc',
      limit: settings.trackCount * 2
    });

    // Shuffle and limit
    const finalTracks = this.shuffle(tracks).slice(0, settings.trackCount);

    return {
      trackKeys: finalTracks.map(t => t.ratingKey),
      trackCount: finalTracks.length
    };
  }

  /**
   * Generate Genre Blend Mix: Tracks that span multiple genres
   */
  async generateGenreBlendMix(
    serverUrl: string,
    plexToken: string,
    libraryId: string,
    settings: {
      genres: string[]; // 2-3 genres to blend
      trackCount: number;
      requireAllGenres?: boolean; // Track must have ALL genres vs ANY genre
    }
  ): Promise<MixResult> {
    const plex = this.createPlexClient(serverUrl, plexToken);

    // Get tracks with genre filters
    const tracks = await plex.getTracksWithAdvancedFilters(libraryId, {
      genres: settings.genres,
      limit: settings.trackCount * 3
    });

    // If requireAllGenres, filter for tracks that have all specified genres
    let filteredTracks = tracks;
    if (settings.requireAllGenres) {
      filteredTracks = tracks.filter(track => {
        const trackGenres = track.Genre?.map((g: any) => g.tag.toLowerCase()) || [];
        return settings.genres.every(genre => trackGenres.includes(genre.toLowerCase()));
      });
    }

    // Shuffle and limit
    const finalTracks = this.shuffle(filteredTracks).slice(0, settings.trackCount);

    return {
      trackKeys: finalTracks.map(t => t.ratingKey),
      trackCount: finalTracks.length
    };
  }
}

