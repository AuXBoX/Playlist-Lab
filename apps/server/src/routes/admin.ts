import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { AuthService } from '../services/auth';
import { createInternalError, createValidationError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();
const authService = new AuthService(
  process.env.PLEX_CLIENT_ID || 'playlist-lab-server',
  'Playlist Lab'
);

// All admin routes require authentication and admin privileges
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get system statistics
 */
router.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    
    const userCount = db.getUserCount();
    const playlistCount = db.getPlaylistCount();
    
    // Get active users (logged in within last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const allUsers = db.getAllUsers();
    const activeUsers = allUsers.filter(u => u.last_login >= thirtyDaysAgo).length;
    
    // Get missing tracks count
    const allMissing = db.getAllMissingTracks();
    const missingTracksCount = allMissing.length;
    
    res.json({
      stats: {
        totalUsers: userCount,
        activeUsers,
        totalPlaylists: playlistCount,
        totalMissingTracks: missingTracksCount,
      },
    });
  } catch (error) {
    logger.error('Failed to get admin stats', { error });
    next(createInternalError('Failed to retrieve system statistics'));
  }
});

/**
 * GET /api/admin/users
 * Get all users with their status
 */
router.get('/users', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    
    const users = db.getAllUsers();
    
    // Include admin status and enabled status
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      plexUserId: u.plex_user_id,
      plexUsername: u.plex_username,
      plexThumb: u.plex_thumb,
      createdAt: u.created_at,
      lastLogin: u.last_login,
      isAdmin: db.isAdmin(u.id),
      isEnabled: db.isUserEnabled(u.id),
      hasServer: !!db.getUserServer(u.id),
    }));
    
    res.json({ users: sanitizedUsers });
  } catch (error) {
    logger.error('Failed to get users', { error });
    next(createInternalError('Failed to retrieve users'));
  }
});

/**
 * POST /api/admin/users/:userId/enable
 * Enable a user
 */
router.post('/users/:userId/enable', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return next(createValidationError('Invalid user ID'));
    }
    
    const user = db.getUserById(userId);
    if (!user) {
      return next(createValidationError('User not found'));
    }
    
    db.enableUser(userId);
    
    // Auto-assign server config from admin if user doesn't have one
    if (!db.getUserServer(userId)) {
      db.copyServerConfig(req.user!.id, userId);
    }
    
    logger.info('User enabled by admin', { userId, adminId: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to enable user', { error });
    next(createInternalError('Failed to enable user'));
  }
});

/**
 * POST /api/admin/users/:userId/disable
 * Disable a user
 */
router.post('/users/:userId/disable', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return next(createValidationError('Invalid user ID'));
    }
    
    // Can't disable yourself
    if (userId === req.user!.id) {
      return next(createValidationError('Cannot disable your own account'));
    }
    
    const user = db.getUserById(userId);
    if (!user) {
      return next(createValidationError('User not found'));
    }
    
    db.disableUser(userId);
    logger.info('User disabled by admin', { userId, adminId: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disable user', { error });
    next(createInternalError('Failed to disable user'));
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their data
 */
router.delete('/users/:userId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return next(createValidationError('Invalid user ID'));
    }
    
    // Can't delete yourself
    if (userId === req.user!.id) {
      return next(createValidationError('Cannot delete your own account'));
    }
    
    const user = db.getUserById(userId);
    if (!user) {
      return next(createValidationError('User not found'));
    }
    
    db.deleteUser(userId);
    logger.info('User deleted by admin', { userId, username: user.plex_username, adminId: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete user', { error });
    next(createInternalError('Failed to delete user'));
  }
});

/**
 * GET /api/admin/home-users
 * Get Plex Home users from the admin's Plex account
 */
router.get('/home-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const homeUsers = await authService.getHomeUsers(req.user!.plexToken);
    
    res.json({
      homeUsers: homeUsers.map(u => ({
        id: u.id,
        title: u.title,
        username: u.username,
        thumb: u.thumb,
        admin: u.admin,
        restricted: u.restricted,
        guest: u.guest,
      })),
    });
  } catch (error) {
    logger.error('Failed to get Plex Home users', { error });
    next(createInternalError('Failed to retrieve Plex Home users'));
  }
});

/**
 * GET /api/admin/missing
 * Get all missing tracks across all users, aggregated by track
 */
router.get('/missing', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    
    const missingTrackStats = db.getMissingTrackStats();
    
    res.json({ 
      missingTracks: missingTrackStats,
      totalCount: missingTrackStats.length,
    });
  } catch (error) {
    logger.error('Failed to get missing tracks', { error });
    next(createInternalError('Failed to retrieve missing tracks'));
  }
});

/**
 * GET /api/admin/jobs
 * Get background job status
 */
router.get('/jobs', (_req: Request, res: Response, next: NextFunction) => {
  try {
    // For now, return a simple status
    // In a full implementation, this would query the job scheduler
    const jobs = [
      {
        name: 'daily-scraper',
        schedule: process.env.SCRAPER_SCHEDULE || '0 2 * * *',
        enabled: process.env.ENABLE_SCRAPER_JOB !== 'false',
        lastRun: null, // Would be tracked in a real implementation
        status: 'scheduled',
      },
      {
        name: 'schedule-checker',
        schedule: '0 * * * *',
        enabled: process.env.ENABLE_SCHEDULE_CHECKER !== 'false',
        lastRun: null,
        status: 'scheduled',
      },
      {
        name: 'cache-cleanup',
        schedule: '0 3 * * 0',
        enabled: process.env.ENABLE_CACHE_CLEANUP !== 'false',
        lastRun: null,
        status: 'scheduled',
      },
    ];
    
    res.json({ jobs });
  } catch (error) {
    logger.error('Failed to get job status', { error });
    next(createInternalError('Failed to retrieve job status'));
  }
});

/**
 * POST /api/admin/shutdown
 * Gracefully shut down the server process (admin only)
 * Useful when the server needs to be restarted from the tray app
 */
router.post('/shutdown', (req: Request, res: Response) => {
  logger.info('Shutdown requested by admin', { adminId: req.user!.id });
  res.json({ success: true, message: 'Server shutting down' });
  // Give the response time to send before exiting
  setTimeout(() => process.exit(0), 500);
});

export default router;
