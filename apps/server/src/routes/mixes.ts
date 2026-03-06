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
    const customSettings = req.body;

    if (!customSettings.name || !customSettings.trackCount) {
      return next(createValidationError('Playlist name and track count are required'));
    }

    const { userServer } = await getUserServerAndSettings(userId, db);
    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    logger.info('Generating custom advanced mix', { userId, libraryId: userServer.library_id, settings: customSettings });

    // Generate mix with custom filters
    const result = await mixService.generateCustomMix(
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      customSettings
    );

    if (result.trackCount === 0) {
      return res.json({
        success: false,
        message: 'No tracks found matching your criteria. Try adjusting the filters.'
      });
    }

    // Create playlist
    const playlist = await createPlaylistFromMix(
      customSettings.name,
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
        name: customSettings.name,
        trackCount: playlist.trackCount
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate custom advanced mix', { error: error.message });
    next(createInternalError(error.message || 'Failed to generate custom advanced mix'));
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

