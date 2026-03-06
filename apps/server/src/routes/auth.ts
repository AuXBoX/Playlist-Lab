import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();
const authService = new AuthService(
  process.env.PLEX_CLIENT_ID || 'playlist-lab-server',
  'Playlist Lab'
);

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId: number;
    plexUserId: string;
  }
}

/**
 * Handle user login: create/update user, auto-admin first user,
 * check Plex Home membership, auto-assign server config
 */
async function handleUserLogin(
  db: any,
  plexUserId: string,
  username: string,
  authToken: string,
  thumb?: string
) {
  // Create or update user in database
  let user = db.getUserByPlexId(plexUserId);
  const isNewUser = !user;

  if (!user) {
    user = db.createUser(plexUserId, username, authToken, thumb);
    logger.info('New user created', { plexUserId, username });
  } else {
    db.updateUserLogin(user.id);
    db.updateUserToken(user.id, authToken);
    logger.info('User logged in', { plexUserId, username });
  }

  // First user ever becomes admin automatically
  const userCount = db.getUserCount();
  if (userCount === 1) {
    db.addAdmin(user.id);
    logger.info('First user auto-promoted to admin', { userId: user.id, username });
  }

  // If this is a new non-admin user, check Plex Home membership
  if (isNewUser && !db.isAdmin(user.id)) {
    const admin = db.getFirstAdmin();
    if (admin) {
      try {
        const homeUsers = await authService.getHomeUsers(admin.plex_token);
        const isHomeUser = homeUsers.some(
          (hu: any) => hu.id.toString() === plexUserId
        );

        if (isHomeUser) {
          // Auto-assign admin's server config to this managed user
          db.copyServerConfig(admin.id, user.id);
          logger.info('Plex Home user auto-assigned server config', {
            userId: user.id,
            username,
            adminId: admin.id,
          });
        } else {
          // Not a Plex Home member — disable by default
          db.disableUser(user.id);
          logger.info('Non-home user disabled by default', {
            userId: user.id,
            username,
          });
        }
      } catch (err) {
        logger.warn('Failed to check Plex Home membership, allowing user', {
          error: err instanceof Error ? err.message : err,
          userId: user.id,
        });
      }
    }
  }

  // Check if user is enabled
  if (!db.isUserEnabled(user.id) && !db.isAdmin(user.id)) {
    return { user, enabled: false };
  }

  return { user, enabled: true };
}

/**
 * POST /api/auth/start
 * Initiate Plex PIN-based OAuth flow
 */
router.post('/start', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pin = await authService.startAuth();
    
    res.json({
      id: pin.id,
      code: pin.code,
      authUrl: authService.getAuthUrl(pin.code),
    });
  } catch (error) {
    logger.error('Failed to start auth', { error });
    next(createInternalError('Failed to initiate authentication'));
  }
});

/**
 * POST /api/auth/poll
 * Poll for PIN authentication completion
 */
router.post('/poll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pinId, code } = req.body;

    if (!pinId || !code) {
      return next(createValidationError('pinId and code are required'));
    }

    const pin = await authService.pollAuth(pinId, code);

    if (!pin.authToken) {
      return res.json({ authenticated: false });
    }

    // Get user info from Plex
    const userInfo = await authService.getUserInfo(pin.authToken);
    const db = req.dbService!;

    const { user, enabled } = await handleUserLogin(
      db,
      userInfo.id.toString(),
      userInfo.username,
      pin.authToken,
      userInfo.thumb
    );

    if (!enabled) {
      return res.json({
        authenticated: false,
        denied: true,
        message: 'Your account has not been approved. Please contact the server admin.',
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.plexUserId = user.plex_user_id;

    logger.info('Creating session for user', { 
      userId: user.id, 
      plexUserId: user.plex_user_id,
      sessionId: req.sessionID,
      cookie: req.session.cookie
    });

    // Regenerate session to ensure clean state
    const oldSessionId = req.sessionID;
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        logger.error('Failed to regenerate session:', regenerateErr);
        // Continue anyway with existing session
      } else {
        logger.info('Session regenerated', { oldId: oldSessionId, newId: req.sessionID });
      }
      
      // Set session data again after regeneration
      req.session.userId = user.id;
      req.session.plexUserId = user.plex_user_id;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          logger.error('Failed to save session:', err);
          return next(createInternalError('Failed to create session'));
        }

        logger.info('Session saved successfully', { 
          sessionId: req.sessionID,
          userId: user.id,
          cookieValue: req.session.cookie
        });

        // Verify session was actually saved by reloading it
        req.session.reload((reloadErr) => {
          if (reloadErr) {
            logger.error('Failed to reload session after save:', reloadErr);
            return next(createInternalError('Session verification failed'));
          }

          if (!req.session.userId) {
            logger.error('Session reload succeeded but userId is missing!');
            return next(createInternalError('Session data not persisted'));
          }

          logger.info('Session verified successfully', {
            sessionId: req.sessionID,
            userId: req.session.userId
          });

          res.json({
            authenticated: true,
            user: {
              id: user.id,
              plexUserId: user.plex_user_id,
              plexUsername: user.plex_username,
              plexThumb: user.plex_thumb,
              isAdmin: db.isAdmin(user.id),
            },
          });
        });
      });
    });
  } catch (error) {
    logger.error('Failed to poll auth', { error });
    next(createInternalError('Failed to complete authentication'));
  }
});

/**
 * POST /api/auth/token
 * Authenticate using a Plex token directly (for 2FA users)
 */
router.post('/token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return next(createValidationError('Token is required'));
    }

    // Validate token by getting user info from Plex
    const userInfo = await authService.getUserInfo(token);
    const db = req.dbService!;

    const { user, enabled } = await handleUserLogin(
      db,
      userInfo.id.toString(),
      userInfo.username,
      token,
      userInfo.thumb
    );

    if (!enabled) {
      return res.json({
        success: false,
        denied: true,
        message: 'Your account has not been approved. Please contact the server admin.',
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.plexUserId = user.plex_user_id;

    logger.info('Creating session for user (token auth)', { 
      userId: user.id, 
      plexUserId: user.plex_user_id,
      sessionId: req.sessionID 
    });

    // Explicitly save session before responding
    req.session.save((err) => {
      if (err) {
        logger.error('Failed to save session:', err);
        return next(createInternalError('Failed to create session'));
      }

      logger.info('Session saved successfully (token auth)', { 
        sessionId: req.sessionID,
        userId: user.id 
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          plexUserId: user.plex_user_id,
          plexUsername: user.plex_username,
          plexThumb: user.plex_thumb,
          isAdmin: db.isAdmin(user.id),
        },
      });
    });
  } catch (error) {
    logger.error('Failed to authenticate with token', { error });
    if (error instanceof Error && error.message.includes('Invalid or expired')) {
      return next(createValidationError('Invalid or expired Plex token'));
    }
    next(createInternalError('Failed to authenticate with token'));
  }
});

/**
 * POST /api/auth/logout
 * Destroy user session
 */
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Failed to destroy session', { error: err });
      return next(createInternalError('Failed to logout'));
    }
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Auth check request', { 
      sessionId: req.sessionID,
      userId: req.session.userId,
      hasSession: !!req.session,
      hasCookie: !!req.headers.cookie
    });

    const userId = req.session.userId!;
    const db = req.dbService!;
    const user = db.getUserById(userId);

    if (!user) {
      return next(createInternalError('User not found'));
    }

    res.json({
      id: user.id,
      plexUserId: user.plex_user_id,
      plexUsername: user.plex_username,
      plexThumb: user.plex_thumb,
      isAdmin: db.isAdmin(user.id),
    });
  } catch (error) {
    logger.error('Failed to get user info', { error });
    next(createInternalError('Failed to retrieve user information'));
  }
});

/**
 * GET /api/auth/debug-session
 * Debug endpoint to check session state (development only)
 */
router.get('/debug-session', (req: Request, res: Response) => {
  res.json({
    sessionID: req.sessionID,
    sessionData: {
      userId: req.session.userId,
      plexUserId: req.session.plexUserId,
      cookie: req.session.cookie,
    },
    headers: {
      cookie: req.headers.cookie,
      userAgent: req.headers['user-agent'],
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
