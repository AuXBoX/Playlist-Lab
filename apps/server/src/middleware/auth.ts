/**
 * Authentication Middleware
 * 
 * Provides middleware functions for protecting routes and checking authentication.
 * Integrates with express-session for session management.
 */

import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/database';

/**
 * Extend Express Request to include user and session data
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        plexUserId: string;
        plexUsername: string;
        plexToken: string;
        plexThumb?: string;
      };
      dbService?: DatabaseService;
    }

    interface SessionData {
      userId?: number;
      plexUserId?: string;
    }
  }
}

/**
 * Middleware to attach database service to request
 */
export function attachDatabase(dbService: DatabaseService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.dbService = dbService;
    next();
  };
}

/**
 * Middleware to require authentication
 * Returns 401 if user is not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  console.log(`[Auth] Checking authentication for ${req.method} ${req.path}`);
  console.log(`[Auth] Session ID: ${req.sessionID?.substring(0, 10)}...`);
  console.log(`[Auth] Session userId: ${req.session.userId || 'none'}`);
  console.log(`[Auth] Cookie header: ${req.headers.cookie ? 'present' : 'missing'}`);
  
  if (!req.session.userId) {
    console.log('[Auth] No userId in session, returning 401');
    res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        statusCode: 401
      }
    });
    return;
  }

  // Load user from database
  if (!req.dbService) {
    console.error('[Auth] Database service not available');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Database service not available',
        statusCode: 500
      }
    });
    return;
  }

  const user = req.dbService.getUserById(req.session.userId);
  
  if (!user) {
    // Session references non-existent user, clear it
    console.log(`[Auth] User ${req.session.userId} not found in database, destroying session`);
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying invalid session:', err);
      }
    });

    res.status(401).json({
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid session',
        statusCode: 401
      }
    });
    return;
  }

  // Attach user to request
  req.user = {
    id: user.id,
    plexUserId: user.plex_user_id,
    plexUsername: user.plex_username,
    plexToken: user.plex_token,
    plexThumb: user.plex_thumb
  };

  // Check if user is enabled (admins always pass)
  if (!req.dbService.isAdmin(user.id) && !req.dbService.isUserEnabled(user.id)) {
    console.log(`[Auth] User ${user.id} is disabled`);
    res.status(403).json({
      error: {
        code: 'USER_DISABLED',
        message: 'Your account has been disabled. Contact the server admin.',
        statusCode: 403
      }
    });
    return;
  }

  console.log(`[Auth] Authentication successful for user ${user.id} (${user.plex_username})`);
  next();
}

/**
 * Middleware to require admin privileges
 * Must be used after requireAuth
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.dbService) {
    res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        statusCode: 401
      }
    });
    return;
  }

  const isAdmin = req.dbService.isAdmin(req.user.id);

  if (!isAdmin) {
    res.status(403).json({
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Admin privileges required',
        statusCode: 403
      }
    });
    return;
  }

  next();
}

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't require it
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.dbService) {
    next();
    return;
  }

  const user = req.dbService.getUserById(req.session.userId);
  
  if (user) {
    req.user = {
      id: user.id,
      plexUserId: user.plex_user_id,
      plexUsername: user.plex_username,
      plexToken: user.plex_token,
      plexThumb: user.plex_thumb
    };
  }

  next();
}

