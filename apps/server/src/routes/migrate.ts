import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/migrate/desktop
 * Import data from desktop app
 */
router.post('/desktop', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { data } = req.body;

    if (!data) {
      return next(createValidationError('data is required'));
    }

    // Validate data structure
    if (!data.version || !data.user || !data.settings) {
      return next(createValidationError('Invalid data format: missing required fields'));
    }

    // Import settings
    if (data.settings.matchingSettings) {
      db.saveUserSettings(userId, {
        matching_settings: data.settings.matchingSettings,
      });
    }

    if (data.settings.mixSettings) {
      db.saveUserSettings(userId, {
        mix_settings: data.settings.mixSettings,
      });
    }

    if (data.settings.country) {
      db.saveUserSettings(userId, {
        country: data.settings.country,
      });
    }

    // Import server configuration
    if (data.user.plexServer) {
      const server = data.user.plexServer;
      db.saveUserServer(
        userId,
        server.name || 'Imported Server',
        server.clientIdentifier || server.clientId || '',
        server.uri || server.url || '',
        data.settings.libraryId,
        undefined
      );
    }

    // Note: Playlists and schedules would need to be re-created in Plex
    // as we don't have the Plex playlist IDs from the desktop app
    // This is a limitation of the migration process

    logger.info('Desktop data imported', { userId });

    res.json({
      success: true,
      message: 'Settings and server configuration imported successfully. Playlists and schedules need to be recreated.',
      imported: {
        settings: true,
        server: !!data.user.plexServer,
        playlists: 0, // Not imported
        schedules: 0, // Not imported
      },
    });
  } catch (error) {
    logger.error('Failed to import desktop data', { error, userId: req.session.userId });
    next(createInternalError('Failed to import desktop app data'));
  }
});

export default router;
