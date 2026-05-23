import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';

const router = Router();

interface SavedSpotifyUser {
  id: number;
  spotify_user_id: string;
  display_name: string;
  added_at: number;
}

/**
 * GET /api/saved-spotify-users
 * List all saved Spotify users for the authenticated user
 */
router.get('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const db = getDatabase();

    const users = db
      .prepare(
        `SELECT id, spotify_user_id, display_name, added_at 
         FROM saved_spotify_users 
         WHERE user_id = ? 
         ORDER BY added_at DESC`
      )
      .all(userId) as SavedSpotifyUser[];

    res.json({ users });
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error listing saved users', { error });
    res.status(500).json({ error: { message: 'Failed to list saved Spotify users' } });
  }
});

/**
 * POST /api/saved-spotify-users
 * Save a new Spotify user ID
 */
router.post('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const { spotifyUserId, displayName } = req.body;

    if (!spotifyUserId || typeof spotifyUserId !== 'string') {
      res.status(400).json({ 
        error: { message: 'spotifyUserId is required and must be a string' } 
      });
      return;
    }

    if (!displayName || typeof displayName !== 'string') {
      res.status(400).json({ 
        error: { message: 'displayName is required and must be a string' } 
      });
      return;
    }

    const db = getDatabase();
    const now = Date.now();

    try {
      const result = db
        .prepare(
          `INSERT INTO saved_spotify_users (user_id, spotify_user_id, display_name, added_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(userId, spotifyUserId.trim(), displayName.trim(), now);

      const savedUser: SavedSpotifyUser = {
        id: result.lastInsertRowid as number,
        spotify_user_id: spotifyUserId.trim(),
        display_name: displayName.trim(),
        added_at: now,
      };

      logger.info('[SavedSpotifyUsers] Saved Spotify user', { 
        userId, 
        spotifyUserId: savedUser.spotify_user_id 
      });

      res.status(201).json({ user: savedUser });
    } catch (dbError: any) {
      if (dbError.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json({ 
          error: { message: 'This Spotify user is already saved' } 
        });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error saving Spotify user', { error });
    res.status(500).json({ error: { message: 'Failed to save Spotify user' } });
  }
});

/**
 * DELETE /api/saved-spotify-users/:id
 * Remove a saved Spotify user
 */
router.delete('/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const savedUserId = parseInt(req.params.id, 10);

    if (isNaN(savedUserId)) {
      res.status(400).json({ 
        error: { message: 'Invalid saved user ID' } 
      });
      return;
    }

    const db = getDatabase();

    // Verify ownership before deleting
    const existing = db
      .prepare('SELECT id FROM saved_spotify_users WHERE id = ? AND user_id = ?')
      .get(savedUserId, userId);

    if (!existing) {
      res.status(404).json({ 
        error: { message: 'Saved Spotify user not found' } 
      });
      return;
    }

    db.prepare('DELETE FROM saved_spotify_users WHERE id = ?').run(savedUserId);

    logger.info('[SavedSpotifyUsers] Deleted saved Spotify user', { 
      userId, 
      savedUserId 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error deleting saved Spotify user', { error });
    res.status(500).json({ error: { message: 'Failed to delete saved Spotify user' } });
  }
});

export default router;
