import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { PlexService } from '../services/plex';

const router = Router();

/**
 * GET /api/search
 * Search for tracks in Plex library
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { artist, track, album } = req.query;

    // At least one search parameter is required
    if (!artist && !track && !album) {
      return next(createValidationError('At least one search parameter (artist, track, or album) is required'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createValidationError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return res.json({ results: [] });
    }

    // Build search query - combine all provided fields
    const searchTerms: string[] = [];
    if (artist && typeof artist === 'string') searchTerms.push(artist);
    if (track && typeof track === 'string') searchTerms.push(track);
    if (album && typeof album === 'string') searchTerms.push(album);
    
    const combinedQuery = searchTerms.join(' ');

    // Search Plex using the searchTrack method with proper parameters
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    const searchResults = await plexService.searchTrack(
      combinedQuery,
      userServer.library_id || undefined,
      artist as string | undefined,
      track as string | undefined
    );
    
    logger.info('Search completed', { 
      userId, 
      artist, 
      track, 
      album, 
      combinedQuery, 
      resultCount: searchResults.length 
    });
    
    res.json({ results: searchResults });
  } catch (error) {
    logger.error('Search failed', { error, userId: req.session.userId });
    next(createInternalError('Failed to search'));
  }
});

export default router;
