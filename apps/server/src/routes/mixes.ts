/**
 * Mix Generation Routes
 * 
 * API endpoints for generating personalized playlists:
 * - POST /api/mixes/weekly - Generate Weekly Mix
 * - POST /api/mixes/daily - Generate Daily Mix
 * - POST /api/mixes/timecapsule - Generate Time Capsule
 * - POST /api/mixes/newmusic - Generate New Music Mix
 * - POST /api/mixes/custom - Generate custom mix
 * - POST /api/mixes/all - Generate all mixes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { MixService, MixSettings } from '../services/mixes';
import { PlexClient } from '../services/plex';
import { DatabaseService } from '../database/database';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();
const mixService = new MixService();

// All mix routes require authentication
router.use(requireAuth);

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

/**
 * Helper function to get user's server and settings
 */
async function getUserServerAndSettings(userId: number, db: DatabaseService) {
  const userServer = await db.getUserServer(userId);
  if (!userServer) {
    throw new Error('No Plex server configured. Please select a server first.');
  }

  if (!userServer.library_id) {
    throw new Error('No music library selected. Please select a library first.');
  }

  const settings = await db.getUserSettings(userId);
  const mixSettings = settings.mix_settings || DEFAULT_MIX_SETTINGS;

  return { userServer, mixSettings };
}

/**
 * Helper function to create playlist from mix result
 */
async function createPlaylistFromMix(
  playlistName: string,
  trackKeys: string[],
  serverUrl: string,
  plexToken: string,
  libraryId: string,
  serverClientId: string,
  userId: number,
  db: DatabaseService
): Promise<{ playlistId: string; trackCount: number }> {
  const plex = new PlexClient(serverUrl, plexToken);

  // Build track URIs
  const trackUris = trackKeys.map(key => plex.buildTrackUri(key, serverClientId));
  const libraryUri = plex.buildLibraryUri(libraryId, serverClientId);

  // Create playlist in Plex
  const playlist = await plex.createPlaylist(playlistName, libraryUri, trackUris);

  // Store playlist in database
  await db.createPlaylist(
    userId,
    playlist.ratingKey,
    playlistName,
    'mix',
    undefined
  );

  return {
    playlistId: playlist.ratingKey,
    trackCount: trackKeys.length
  };
}

/**
 * POST /api/mixes/weekly
 * Generate Weekly Mix: Top tracks from most-played artists
 */
router.post('/weekly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer, mixSettings } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Weekly Mix', { userId, libraryId: userServer.library_id });

    // Generate mix
    const result = await mixService.generateWeeklyMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      mixSettings.weeklyMix
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'Not enough play history to generate Weekly Mix. Listen to more music and try again!'
      });
    }

    // Create playlist
    const playlistName = req.body.playlistName || 'Your Weekly Mix';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Weekly Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Weekly Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Weekly Mix'));
  }
});

/**
 * POST /api/mixes/daily
 * Generate Daily Mix: Recent plays + related tracks + rediscoveries
 */
router.post('/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer, mixSettings } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Daily Mix', { userId, libraryId: userServer.library_id });

    // Generate mix
    const result = await mixService.generateDailyMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      mixSettings.dailyMix
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'Not enough play history to generate Daily Mix. Listen to more music and try again!'
      });
    }

    // Create playlist
    const playlistName = req.body.playlistName || 'Daily Mix';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Daily Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Daily Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Daily Mix'));
  }
});

/**
 * POST /api/mixes/timecapsule
 * Generate Time Capsule: Old tracks with artist diversity
 */
router.post('/timecapsule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer, mixSettings } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Time Capsule', { userId, libraryId: userServer.library_id });

    // Generate mix
    const result = await mixService.generateTimeCapsule(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      mixSettings.timeCapsule
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'Not enough old tracks to generate Time Capsule. Try adjusting the settings or listen to more music!'
      });
    }

    // Create playlist
    const playlistName = req.body.playlistName || 'Time Capsule';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Time Capsule created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Time Capsule', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Time Capsule'));
  }
});

/**
 * POST /api/mixes/newmusic
 * Generate New Music Mix: Tracks from recently added albums
 */
router.post('/newmusic', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer, mixSettings } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating New Music Mix', { userId, libraryId: userServer.library_id });

    // Generate mix
    const result = await mixService.generateNewMusicMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      mixSettings.newMusic
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No recently added albums found. Add some new music to your library and try again!'
      });
    }

    // Create playlist
    const playlistName = req.body.playlistName || 'New Music Mix';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('New Music Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate New Music Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate New Music Mix'));
  }
});

/**
 * POST /api/mixes/custom
 * Generate custom mix with user-provided settings
 */
router.post('/custom', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { mixType, settings, playlistName } = req.body;

    if (!mixType || !['weekly', 'daily', 'timecapsule', 'newmusic'].includes(mixType)) {
      return next(createValidationError('Invalid mix type. Must be one of: weekly, daily, timecapsule, newmusic'));
    }

    if (!settings) {
      return next(createValidationError('Mix settings are required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating custom mix', { userId, mixType, libraryId: userServer.library_id });

    let result;
    let defaultName;

    switch (mixType) {
      case 'weekly':
        result = await mixService.generateWeeklyMix(
          userServer.server_url,
          user.plex_token,
          userServer.library_id!,
          settings
        );
        defaultName = 'Custom Weekly Mix';
        break;
      case 'daily':
        result = await mixService.generateDailyMix(
          userServer.server_url,
          user.plex_token,
          userServer.library_id!,
          settings
        );
        defaultName = 'Custom Daily Mix';
        break;
      case 'timecapsule':
        result = await mixService.generateTimeCapsule(
          userServer.server_url,
          user.plex_token,
          userServer.library_id!,
          settings
        );
        defaultName = 'Custom Time Capsule';
        break;
      case 'newmusic':
        result = await mixService.generateNewMusicMix(
          userServer.server_url,
          user.plex_token,
          userServer.library_id!,
          settings
        );
        defaultName = 'Custom New Music Mix';
        break;
    }

    if (!result || result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'Could not generate mix with the provided settings. Try adjusting the parameters.'
      });
    }

    // Create playlist
    const finalPlaylistName = playlistName || defaultName;
    const playlist = await createPlaylistFromMix(
      finalPlaylistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Custom mix created', { userId, mixType, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: finalPlaylistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate custom mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate custom mix'));
  }
});

/**
 * POST /api/mixes/custom-advanced
 * Generate custom mix with advanced filters
 */
router.post('/custom-advanced', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { name, trackCount, ...filterOptions } = req.body;

    if (!name || !trackCount) {
      return next(createValidationError('Playlist name and track count are required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating custom advanced mix', { userId, libraryId: userServer.library_id, name, trackCount });

    // Generate mix with custom filters
    const result = await mixService.generateCustomMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      {
        trackCount,
        ...filterOptions
      }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No tracks found matching your criteria. Try adjusting the filters.'
      });
    }

    // Create playlist
    const playlist = await createPlaylistFromMix(
      name,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Custom advanced mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: name,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate custom advanced mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate custom advanced mix'));
  }
});

/**
 * POST /api/mixes/sonic
 * Generate sonic similarity mix based on a seed track
 */
router.post('/sonic', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { name, seedTrackKey, trackCount, maxDistance, tempoRange, energyRange, danceabilityRange } = req.body;

    if (!name || !seedTrackKey || !trackCount) {
      return next(createValidationError('Playlist name, seed track, and track count are required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating sonic mix', { userId, libraryId: userServer.library_id, seedTrackKey, trackCount });

    // Generate sonic mix
    const result = await mixService.generateSonicMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      {
        seedTrackKey,
        trackCount,
        maxDistance,
        tempoRange,
        energyRange,
        danceabilityRange
      }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No similar tracks found. Try adjusting the parameters or selecting a different seed track.'
      });
    }

    // Create playlist
    const playlist = await createPlaylistFromMix(
      name,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Sonic mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: name,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate sonic mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate sonic mix'));
  }
});

/**
 * GET /api/mixes/metadata/genres
 * Get all available genres from the user's library
 */
router.get('/metadata/genres', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    const plex = new PlexClient(userServer.server_url, user.plex_token);
    const genres = await plex.getLibraryGenres(userServer.library_id!);

    res.json({ genres });
  } catch (error: any) {
    logger.error('Failed to get library genres', { error: error.message });
    next(createInternalError(error.message || 'Failed to get library genres'));
  }
});

/**
 * GET /api/mixes/metadata/moods
 * Get all available moods from the user's library
 */
router.get('/metadata/moods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    const plex = new PlexClient(userServer.server_url, user.plex_token);
    const moods = await plex.getLibraryMoods(userServer.library_id!);

    res.json({ moods });
  } catch (error: any) {
    logger.error('Failed to get library moods', { error: error.message });
    next(createInternalError(error.message || 'Failed to get library moods'));
  }
});

/**
 * GET /api/mixes/metadata/styles
 * Get all available styles from the user's library
 */
router.get('/metadata/styles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    const plex = new PlexClient(userServer.server_url, user.plex_token);
    const styles = await plex.getLibraryStyles(userServer.library_id!);

    res.json({ styles });
  } catch (error: any) {
    logger.error('Failed to get library styles', { error: error.message });
    next(createInternalError(error.message || 'Failed to get library styles'));
  }
});

/**
 * GET /api/mixes/metadata/collections
 * Get all available collections from the user's library
 */
router.get('/metadata/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    const plex = new PlexClient(userServer.server_url, user.plex_token);
    const collections = await plex.getLibraryCollections(userServer.library_id!);

    res.json({ collections });
  } catch (error: any) {
    logger.error('Failed to get library collections', { error: error.message });
    next(createInternalError(error.message || 'Failed to get library collections'));
  }
});

/**
 * POST /api/mixes/all
 * Generate all mix types at once
 */
router.post('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    const { userServer, mixSettings } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating all mixes', { userId, libraryId: userServer.library_id });

    // Generate all mixes
    const results = await mixService.generateAllMixes(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      mixSettings
    );

    const playlists = [];

    // Create Weekly Mix playlist
    if (results.weekly.trackCount > 0) {
      const playlist = await createPlaylistFromMix(
        'Your Weekly Mix',
        results.weekly.trackKeys,
        userServer.server_url,
        user.plex_token,
        userServer.library_id!,
        userServer.server_client_id,
        userId,
        db
      );
      playlists.push({ type: 'weekly', ...playlist, name: 'Your Weekly Mix' });
    }

    // Create Daily Mix playlist
    if (results.daily.trackCount > 0) {
      const playlist = await createPlaylistFromMix(
        'Daily Mix',
        results.daily.trackKeys,
        userServer.server_url,
        user.plex_token,
        userServer.library_id!,
        userServer.server_client_id,
        userId,
        db
      );
      playlists.push({ type: 'daily', ...playlist, name: 'Daily Mix' });
    }

    // Create Time Capsule playlist
    if (results.timeCapsule.trackCount > 0) {
      const playlist = await createPlaylistFromMix(
        'Time Capsule',
        results.timeCapsule.trackKeys,
        userServer.server_url,
        user.plex_token,
        userServer.library_id!,
        userServer.server_client_id,
        userId,
        db
      );
      playlists.push({ type: 'timecapsule', ...playlist, name: 'Time Capsule' });
    }

    // Create New Music Mix playlist
    if (results.newMusic.trackCount > 0) {
      const playlist = await createPlaylistFromMix(
        'New Music Mix',
        results.newMusic.trackKeys,
        userServer.server_url,
        user.plex_token,
        userServer.library_id!,
        userServer.server_client_id,
        userId,
        db
      );
      playlists.push({ type: 'newmusic', ...playlist, name: 'New Music Mix' });
    }

    logger.info('All mixes created', { userId, playlistCount: playlists.length });

    res.json({
      success: true,
      playlists,
      message: `Successfully created ${playlists.length} playlist(s)`
    });
  } catch (error: any) {
    logger.error('Failed to generate all mixes', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate all mixes'));
  }
});

export default router;


/**
 * POST /api/mixes/deep-cuts
 * Generate Deep Cuts Mix: Hidden gems with low play counts
 */
router.post('/deep-cuts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { trackCount = 50, maxPlayCount = 5, excludePopular = true } = req.body;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Deep Cuts Mix', { userId, libraryId: userServer.library_id });

    const result = await mixService.generateDeepCutsMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { trackCount, maxPlayCount, excludePopular }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No deep cuts found. Try adjusting the play count threshold.'
      });
    }

    const playlistName = req.body.playlistName || 'Deep Cuts';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Deep Cuts Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Deep Cuts Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Deep Cuts Mix'));
  }
});

/**
 * POST /api/mixes/artist-discovery
 * Generate Artist Discovery Mix: Tracks from similar artists
 */
router.post('/artist-discovery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { seedArtistKey, trackCount = 50, tracksPerArtist = 3 } = req.body;

    if (!seedArtistKey) {
      return next(createValidationError('Seed artist key is required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Artist Discovery Mix', { userId, libraryId: userServer.library_id, seedArtistKey });

    const result = await mixService.generateArtistDiscoveryMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { seedArtistKey, trackCount, tracksPerArtist }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No similar artists found. Try a different seed artist.'
      });
    }

    const playlistName = req.body.playlistName || 'Artist Discovery';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Artist Discovery Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Artist Discovery Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Artist Discovery Mix'));
  }
});

/**
 * POST /api/mixes/mood
 * Generate Mood Mix: Tracks filtered by mood tags
 */
router.post('/mood', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { moods, trackCount = 50, useSonicAnalysis = false } = req.body;

    if (!moods || !Array.isArray(moods) || moods.length === 0) {
      return next(createValidationError('At least one mood is required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Mood Mix', { userId, libraryId: userServer.library_id, moods });

    const result = await mixService.generateMoodMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { moods, trackCount, useSonicAnalysis }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No tracks found with the selected moods.'
      });
    }

    const playlistName = req.body.playlistName || `${moods.join(' & ')} Mix`;
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Mood Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Mood Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Mood Mix'));
  }
});

/**
 * POST /api/mixes/era
 * Generate Era Mix: Tracks from a specific decade/era
 */
router.post('/era', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { startYear, endYear, trackCount = 50 } = req.body;

    if (!startYear || !endYear) {
      return next(createValidationError('Start year and end year are required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Era Mix', { userId, libraryId: userServer.library_id, startYear, endYear });

    const result = await mixService.generateEraMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { startYear, endYear, trackCount }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: `No tracks found from ${startYear}-${endYear}.`
      });
    }

    const playlistName = req.body.playlistName || `${startYear}s Mix`;
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Era Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Era Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Era Mix'));
  }
});

/**
 * POST /api/mixes/genre-evolution
 * Generate Genre Evolution Mix: Show how a genre evolved chronologically
 */
router.post('/genre-evolution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { genre, trackCount = 50, tracksPerDecade = 5 } = req.body;

    if (!genre) {
      return next(createValidationError('Genre is required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Genre Evolution Mix', { userId, libraryId: userServer.library_id, genre });

    const result = await mixService.generateGenreEvolutionMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { genre, trackCount, tracksPerDecade }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: `No tracks found for genre: ${genre}`
      });
    }

    const playlistName = req.body.playlistName || `${genre} Evolution`;
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Genre Evolution Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Genre Evolution Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Genre Evolution Mix'));
  }
});

/**
 * POST /api/mixes/artist-journey
 * Generate Artist Journey Mix: Chronological journey through an artist's discography
 */
router.post('/artist-journey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { artistKey, trackCount = 50, tracksPerAlbum = 3 } = req.body;

    if (!artistKey) {
      return next(createValidationError('Artist key is required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Artist Journey Mix', { userId, libraryId: userServer.library_id, artistKey });

    const result = await mixService.generateArtistJourneyMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { artistKey, trackCount, tracksPerAlbum }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No tracks found for this artist.'
      });
    }

    const playlistName = req.body.playlistName || 'Artist Journey';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Artist Journey Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Artist Journey Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Artist Journey Mix'));
  }
});

/**
 * POST /api/mixes/workout
 * Generate Workout Mix: Progressive tempo/energy build (warmup → peak → cooldown)
 */
router.post('/workout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { trackCount = 50, warmupTracks = 5, peakTracks = 30, cooldownTracks = 5 } = req.body;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Workout Mix', { userId, libraryId: userServer.library_id });

    const result = await mixService.generateWorkoutMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { trackCount, warmupTracks, peakTracks, cooldownTracks }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'Not enough tracks with tempo/energy data to generate workout mix.'
      });
    }

    const playlistName = req.body.playlistName || 'Workout Mix';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Workout Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Workout Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Workout Mix'));
  }
});

/**
 * POST /api/mixes/forgotten-favorites
 * Generate Forgotten Favorites Mix: High play count but not played recently
 */
router.post('/forgotten-favorites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { trackCount = 50, minPlayCount = 10, notPlayedDays = 180 } = req.body;

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Forgotten Favorites Mix', { userId, libraryId: userServer.library_id });

    const result = await mixService.generateForgottenFavoritesMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { trackCount, minPlayCount, notPlayedDays }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No forgotten favorites found. Try adjusting the play count or time threshold.'
      });
    }

    const playlistName = req.body.playlistName || 'Forgotten Favorites';
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Forgotten Favorites Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Forgotten Favorites Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Forgotten Favorites Mix'));
  }
});

/**
 * POST /api/mixes/genre-blend
 * Generate Genre Blend Mix: Tracks that span multiple genres
 */
router.post('/genre-blend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { genres, trackCount = 50, minGenres = 2 } = req.body;

    if (!genres || !Array.isArray(genres) || genres.length < 2) {
      return next(createValidationError('At least two genres are required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating Genre Blend Mix', { userId, libraryId: userServer.library_id, genres });

    const result = await mixService.generateGenreBlendMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      { genres, trackCount, minGenres }
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No tracks found that blend the selected genres.'
      });
    }

    const playlistName = req.body.playlistName || `${genres.join(' + ')} Blend`;
    const playlist = await createPlaylistFromMix(
      playlistName,
      result.trackKeys,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      userId,
      db
    );

    logger.info('Genre Blend Mix created', { userId, playlistId: playlist.playlistId, trackCount: playlist.trackCount });

    res.json({
      success: true,
      playlist: {
        id: playlist.playlistId,
        name: playlistName,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Genre Blend Mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate Genre Blend Mix'));
  }
});
