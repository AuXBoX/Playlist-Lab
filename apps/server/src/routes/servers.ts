import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError, createNotFoundError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { AuthService } from '../services/auth';
import { PlexService } from '../services/plex';

const router = Router();
const authService = new AuthService(
  process.env.PLEX_CLIENT_ID || 'playlist-lab-server',
  'Playlist Lab'
);

/**
 * GET /api/servers/current
 * Get user's currently selected server
 */
router.get('/current', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    
    // Get user's selected server
    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return res.json({ server: null });
    }

    const server = {
      name: userServer.server_name,
      clientId: userServer.server_client_id,
      url: userServer.server_url,
      libraryId: userServer.library_id,
      libraryName: userServer.library_name
    };

    return res.json({ server });
  } catch (error) {
    logger.error('Failed to get current server', { error, userId: req.session.userId });
    return next(createInternalError('Failed to retrieve current server'));
  }
});

/**
 * GET /api/servers
 * Get user's Plex servers
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    
    // Get user to retrieve Plex token
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    logger.info('Fetching Plex servers', { userId, hasToken: !!user.plex_token });

    // Fetch servers from Plex
    const plexServers = await authService.getServers(user.plex_token);
    
    // Map to our PlexServer format
    const servers = plexServers.map(s => ({
      name: s.name,
      clientId: s.clientIdentifier,
      url: authService.getBestServerUrl(s)
    }));
    
    logger.info('Successfully fetched Plex servers', { userId, serverCount: servers.length });

    res.json({ servers });
  } catch (error) {
    logger.error('Failed to get servers', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session.userId 
    });
    next(createInternalError('Failed to retrieve Plex servers'));
  }
});

/**
 * POST /api/servers/select
 * Select and save user's Plex server
 */
router.post('/select', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { serverName, serverClientId, serverUrl, libraryId, libraryName } = req.body;

    if (!serverName || !serverClientId || !serverUrl) {
      return next(createValidationError('serverName, serverClientId, and serverUrl are required'));
    }

    // Save server configuration
    const server = db.saveUserServer(
      userId,
      serverName,
      serverClientId,
      serverUrl,
      libraryId,
      libraryName
    );

    logger.info('Server selected', { userId, serverName, libraryId });

    res.json({ server });
  } catch (error) {
    logger.error('Failed to select server', { error, userId: req.session.userId });
    next(createInternalError('Failed to save server configuration'));
  }
});

/**
 * GET /api/servers/libraries
 * Get music libraries from selected server
 */
router.get('/libraries', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    
    // Get user to retrieve Plex token
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    // Get user's selected server
    const userServer = db.getUserServer(userId);
    if (!userServer) {
      logger.warn('No server selected for user', { userId });
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    logger.info('Fetching libraries for user', { 
      userId, 
      serverUrl: userServer.server_url,
      serverName: userServer.server_name 
    });

    // Fetch libraries from Plex
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    const libraries = await plexService.getLibraries();
    
    logger.info('Libraries fetched successfully', { 
      userId, 
      totalCount: libraries.length,
      musicCount: libraries.filter(lib => lib.type === 'artist').length
    });

    res.json({ libraries });
  } catch (error) {
    logger.error('Failed to get libraries', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session.userId 
    });
    next(createInternalError('Failed to retrieve music libraries'));
  }
});

/**
 * GET /api/servers/library-folders
 * Get folder paths for the selected library
 */
router.get('/library-folders', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    
    // Get user to retrieve Plex token
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    // Get user's selected server
    const userServer = db.getUserServer(userId);
    if (!userServer) {
      logger.warn('No server selected for user', { userId });
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    if (!userServer.library_id) {
      logger.warn('No library selected for user', { userId });
      return next(createValidationError('No library selected. Please select a library first.'));
    }

    logger.info('Fetching library folders', { 
      userId, 
      serverUrl: userServer.server_url,
      libraryId: userServer.library_id
    });

    // Fetch library folders from Plex
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    const folders = await plexService.getLibraryFolders(userServer.library_id);
    
    logger.info('Library folders fetched successfully', { 
      userId, 
      libraryId: userServer.library_id,
      folderCount: folders.length
    });

    res.json({ folders });
  } catch (error) {
    logger.error('Failed to get library folders', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session.userId 
    });
    next(createInternalError('Failed to retrieve library folders'));
  }
});

/**
 * POST /api/servers/scan-library
 * Trigger a scan/refresh of the selected library or a specific folder
 */
router.post('/scan-library', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { path } = req.body; // Optional folder path
    
    // Get user to retrieve Plex token
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    // Get user's selected server
    const userServer = db.getUserServer(userId);
    if (!userServer) {
      logger.warn('No server selected for user', { userId });
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    if (!userServer.library_id) {
      logger.warn('No library selected for user', { userId });
      return next(createValidationError('No library selected. Please select a library first.'));
    }

    logger.info('Triggering library scan', { 
      userId, 
      serverUrl: userServer.server_url,
      libraryId: userServer.library_id,
      libraryName: userServer.library_name,
      path: path || 'full library'
    });

    // Trigger library scan
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    await plexService.scanLibrary(userServer.library_id, path);
    
    const message = path 
      ? `Scanning folder "${path}". This may take a few minutes.`
      : `Scanning library "${userServer.library_name}". This may take a few minutes.`;
    
    logger.info('Library scan triggered successfully', { 
      userId, 
      libraryId: userServer.library_id,
      libraryName: userServer.library_name,
      path
    });

    res.json({ 
      success: true, 
      message
    });
  } catch (error) {
    logger.error('Failed to scan library', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session.userId 
    });
    next(createInternalError('Failed to trigger library scan'));
  }
});

export default router;

/**
 * POST /api/servers/scan-library
 * Trigger a scan/refresh of the selected library
 */
router.post('/scan-library', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    // Get user to retrieve Plex token
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    // Get user's selected server
    const userServer = db.getUserServer(userId);
    if (!userServer) {
      logger.warn('No server selected for user', { userId });
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    if (!userServer.library_id) {
      logger.warn('No library selected for user', { userId });
      return next(createValidationError('No library selected. Please select a library first.'));
    }

    logger.info('Triggering library scan', {
      userId,
      serverUrl: userServer.server_url,
      libraryId: userServer.library_id,
      libraryName: userServer.library_name
    });

    // Trigger library scan
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    await plexService.scanLibrary(userServer.library_id);

    logger.info('Library scan triggered successfully', {
      userId,
      libraryId: userServer.library_id,
      libraryName: userServer.library_name
    });

    res.json({
      success: true,
      message: `Scanning library "${userServer.library_name}". This may take a few minutes.`
    });
  } catch (error) {
    logger.error('Failed to scan library', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session.userId
    });
    next(createInternalError('Failed to trigger library scan'));
  }
});

