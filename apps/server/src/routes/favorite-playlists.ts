import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';

const router = Router();

interface FavoritePlaylist {
  id: number;
  name: string;
  source: string;
  source_url: string;
  description: string | null;
  image_url: string | null;
  favorited_at: number;
}

/**
 * GET /api/favorite-playlists
 * List all favorite playlists for the authenticated user
 */
router.get('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const db = getDatabase();

    const favorites = db
      .prepare(
        `SELECT id, name, source, source_url, description, image_url, favorited_at 
         FROM favorite_playlists 
         WHERE user_id = ? 
         ORDER BY favorited_at DESC`
      )
      .all(userId) as FavoritePlaylist[];

    res.json({ favorites });
  } catch (error) {
    logger.error('[FavoritePlaylists] Error listing favorites', { error });
    res.status(500).json({ error: { message: 'Failed to list favorite playlists' } });
  }
});

/**
 * POST /api/favorite-playlists
 * Add a playlist to favorites
 */
router.post('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const { name, source, sourceUrl, description, imageUrl } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: { message: 'name is required' } });
      return;
    }

    if (!source || typeof source !== 'string') {
      res.status(400).json({ error: { message: 'source is required' } });
      return;
    }

    if (!sourceUrl || typeof sourceUrl !== 'string') {
      res.status(400).json({ error: { message: 'sourceUrl is required' } });
      return;
    }

    const db = getDatabase();
    const now = Date.now();

    try {
      const result = db
        .prepare(
          `INSERT INTO favorite_playlists (user_id, name, source, source_url, description, image_url, favorited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(userId, name.trim(), source.trim(), sourceUrl.trim(), description || null, imageUrl || null, now);

      const favorite: FavoritePlaylist = {
        id: result.lastInsertRowid as number,
        name: name.trim(),
        source: source.trim(),
        source_url: sourceUrl.trim(),
        description: description || null,
        image_url: imageUrl || null,
        favorited_at: now,
      };

      logger.info('[FavoritePlaylists] Added favorite', { userId, name: favorite.name });
      res.status(201).json({ favorite });
    } catch (dbError: any) {
      if (dbError.code === 'SQLITE_CONSTRAINT') {
        // Already favorited — return the existing one
        const existing = db
          .prepare('SELECT * FROM favorite_playlists WHERE user_id = ? AND source_url = ?')
          .get(userId, sourceUrl.trim()) as FavoritePlaylist;
        res.json({ favorite: existing });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[FavoritePlaylists] Error adding favorite', { error });
    res.status(500).json({ error: { message: 'Failed to add favorite playlist' } });
  }
});

/**
 * DELETE /api/favorite-playlists/:id
 * Remove a playlist from favorites
 */
router.delete('/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const favoriteId = parseInt(req.params.id, 10);

    if (isNaN(favoriteId)) {
      res.status(400).json({ error: { message: 'Invalid favorite ID' } });
      return;
    }

    const db = getDatabase();

    const existing = db
      .prepare('SELECT id FROM favorite_playlists WHERE id = ? AND user_id = ?')
      .get(favoriteId, userId);

    if (!existing) {
      res.status(404).json({ error: { message: 'Favorite not found' } });
      return;
    }

    db.prepare('DELETE FROM favorite_playlists WHERE id = ?').run(favoriteId);

    logger.info('[FavoritePlaylists] Removed favorite', { userId, favoriteId });
    res.status(204).send();
  } catch (error) {
    logger.error('[FavoritePlaylists] Error removing favorite', { error });
    res.status(500).json({ error: { message: 'Failed to remove favorite playlist' } });
  }
});

/**
 * DELETE /api/favorite-playlists/by-url
 * Remove a playlist from favorites by source URL (for toggle behavior)
 */
router.delete('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const { sourceUrl } = req.body;

    if (!sourceUrl || typeof sourceUrl !== 'string') {
      res.status(400).json({ error: { message: 'sourceUrl is required' } });
      return;
    }

    const db = getDatabase();
    db.prepare('DELETE FROM favorite_playlists WHERE user_id = ? AND source_url = ?').run(userId, sourceUrl.trim());

    logger.info('[FavoritePlaylists] Removed favorite by URL', { userId, sourceUrl });
    res.status(204).send();
  } catch (error) {
    logger.error('[FavoritePlaylists] Error removing favorite by URL', { error });
    res.status(500).json({ error: { message: 'Failed to remove favorite playlist' } });
  }
});

export default router;
