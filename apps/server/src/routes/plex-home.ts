/**
 * Plex Home Users Management Routes
 * 
 * Endpoints for viewing and managing playlists across Plex Home users
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/plex-home/users
 * Get all Plex Home users on the account
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = (req.dbService as any).db;

    // Get user's Plex token
    const user = db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    if (!user?.plex_token) {
      return next(createValidationError('No Plex token found'));
    }

    // Get home users from Plex.tv API
    const response = await fetch('https://plex.tv/api/v2/home/users', {
      headers: {
        'X-Plex-Token': user.plex_token,
        'X-Plex-Client-Identifier': 'playlist-lab-server',
        'X-Plex-Product': 'Playlist Lab',
        'X-Plex-Platform': 'Web',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Plex Home] Failed to fetch home users', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      return next(createInternalError('Failed to fetch Plex Home users'));
    }

    const data = await response.json() as any;
    logger.info('[Plex Home] Raw API response', { data: JSON.stringify(data).substring(0, 1000) });
    
    // The response might be an array directly or wrapped in an object
    let usersArray = Array.isArray(data) ? data : (data.users || data.User || []);
    
    const homeUsers = usersArray.map((u: any) => ({
      id: u.uuid || u.id, // Use uuid if available, fallback to id
      title: u.title,
      username: u.username || u.title,
      thumb: u.thumb,
      admin: u.admin === 1 || u.admin === '1' || u.admin === true,
      restricted: u.restricted === 1 || u.restricted === '1' || u.restricted === true,
      guest: u.guest === 1 || u.guest === '1' || u.guest === true,
    }));

    logger.info('[Plex Home] Found home users', { count: homeUsers.length, userId, users: homeUsers });

    res.json({ homeUsers });
  } catch (error: any) {
    logger.error('[Plex Home] Error fetching home users', { error: error.message, stack: error.stack });
    next(createInternalError('Failed to fetch Plex Home users'));
  }
});

/**
 * POST /api/plex-home/users/:homeUserId/switch
 * Switch to a home user and get their token
 */
router.post('/users/:homeUserId/switch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeUserId } = req.params;
    const userId = req.session.userId!;
    const db = (req.dbService as any).db;

    // Get admin user's Plex token
    const user = db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    if (!user?.plex_token) {
      return next(createValidationError('No Plex token found'));
    }

    // Switch to the home user
    const response = await fetch(`https://plex.tv/api/v2/home/users/${homeUserId}/switch`, {
      method: 'POST',
      headers: {
        'X-Plex-Token': user.plex_token,
        'X-Plex-Client-Identifier': 'playlist-lab-server',
        'X-Plex-Product': 'Playlist Lab',
        'X-Plex-Platform': 'Web',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('[Plex Home] Failed to switch user', { homeUserId, status: response.status });
      return next(createInternalError('Failed to switch to home user'));
    }

    const data = await response.json() as any;
    
    logger.info('[Plex Home] Switched to home user', { homeUserId, userId });

    res.json({ 
      authToken: data.authToken,
      user: {
        id: data.id,
        title: data.title,
        username: data.username || data.title,
        thumb: data.thumb,
      },
    });
  } catch (error: any) {
    logger.error('[Plex Home] Error switching user', { error: error.message, stack: error.stack });
    next(createInternalError('Failed to switch to home user'));
  }
});

/**
 * GET /api/plex-home/users/:homeUserId/playlists
 * Get playlists for a specific home user
 * 
 * Note: Plex Home managed users share the same server. We use the admin token
 * to access the server, but playlists are user-specific based on who created them.
 */
router.get('/users/:homeUserId/playlists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeUserId } = req.params;
    const userId = req.session.userId!;
    const db = (req.dbService as any).db;

    // Get admin user's Plex token and server info
    const user = db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    if (!user?.plex_token) {
      return next(createValidationError('No Plex token found'));
    }

    const serverRow = db.prepare('SELECT server_url FROM user_servers WHERE user_id = ? LIMIT 1').get(userId);
    if (!serverRow?.server_url) {
      return next(createValidationError('No Plex server configured'));
    }

    // For managed users, we need to switch to get their token for the Plex server
    logger.info('[Plex Home] Attempting to switch to home user', { homeUserId, userId });
    
    const switchResponse = await fetch(`https://plex.tv/api/v2/home/users/${homeUserId}/switch`, {
      method: 'POST',
      headers: {
        'X-Plex-Token': user.plex_token,
        'X-Plex-Client-Identifier': 'playlist-lab-server',
        'X-Plex-Product': 'Playlist Lab',
        'X-Plex-Platform': 'Web',
        'Accept': 'application/json',
      },
    });

    if (!switchResponse.ok) {
      const errorText = await switchResponse.text();
      logger.error('[Plex Home] Failed to switch user for playlists', { 
        homeUserId, 
        status: switchResponse.status,
        statusText: switchResponse.statusText,
        error: errorText
      });
      return next(createInternalError('Failed to access home user playlists'));
    }

    const switchData = await switchResponse.json() as any;
    
    logger.info('[Plex Home] Switch response data', { 
      homeUserId,
      username: switchData.username,
      hasAuthToken: !!switchData.authToken,
      accountId: switchData.id
    });
    
    // Try to use the home user's token first
    const { PlexClient } = await import('../services/plex');
    let playlists: any[] = [];
    let usedAdminToken = false;
    
    try {
      // Attempt to use the home user's token
      const userPlexClient = new PlexClient(serverRow.server_url, switchData.authToken);
      const allPlaylists = await userPlexClient.getPlaylists();
      playlists = allPlaylists.filter((p: any) => p.playlistType === 'audio');
      logger.info('[Plex Home] Successfully fetched playlists with home user token', { 
        homeUserId,
        count: playlists.length 
      });
    } catch (tokenError: any) {
      // If home user token fails, fall back to admin token and show all playlists
      logger.warn('[Plex Home] Home user token failed, using admin token', { 
        homeUserId,
        error: tokenError.message 
      });
      usedAdminToken = true;
      
      const adminPlexClient = new PlexClient(serverRow.server_url, user.plex_token);
      const allPlaylists = await adminPlexClient.getPlaylists();
      playlists = allPlaylists.filter((p: any) => p.playlistType === 'audio');
      
      logger.info('[Plex Home] Fetched all playlists with admin token', { 
        homeUserId,
        count: playlists.length,
        note: 'Showing all playlists - cannot filter by user'
      });
    }
    
    // Map playlists to include proper fields for the frontend
    const mappedPlaylists = playlists.map((p: any) => ({
      id: p.ratingKey,
      name: p.title,
      trackCount: p.leafCount || 0,
      duration: p.duration || 0,
      composite: p.composite,
    }));
    
    logger.info('[Plex Home] Returning playlists', { 
      homeUserId,
      username: switchData.username,
      count: mappedPlaylists.length,
      usedAdminToken,
      userId 
    });

    res.json({ playlists: mappedPlaylists });
  } catch (error: any) {
    logger.error('[Plex Home] Error fetching home user playlists', { error: error.message, stack: error.stack });
    next(createInternalError('Failed to fetch home user playlists'));
  }
});

/**
 * POST /api/plex-home/playlists/:playlistId/copy
 * Copy a playlist from one home user to another
 */
router.post('/playlists/:playlistId/copy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playlistId } = req.params;
    const { sourceHomeUserId, targetHomeUserId, newName } = req.body;
    const userId = req.session.userId!;
    const db = (req.dbService as any).db;

    if (!sourceHomeUserId) {
      return next(createValidationError('sourceHomeUserId is required'));
    }

    // Get admin user's Plex token and server info
    const user = db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    if (!user?.plex_token) {
      return next(createValidationError('No Plex token found'));
    }

    const serverRow = db.prepare('SELECT server_url, library_id, server_client_id FROM user_servers WHERE user_id = ? LIMIT 1').get(userId);
    if (!serverRow?.server_url) {
      return next(createValidationError('No Plex server configured'));
    }

    const { PlexClient } = await import('../services/plex');

    // Get source user's token and playlist
    const sourceResponse = await fetch(`https://plex.tv/api/v2/home/users/${sourceHomeUserId}/switch`, {
      method: 'POST',
      headers: {
        'X-Plex-Token': user.plex_token,
        'X-Plex-Client-Identifier': 'playlist-lab-server',
        'X-Plex-Product': 'Playlist Lab',
        'X-Plex-Platform': 'Web',
        'Accept': 'application/json',
      },
    });

    if (!sourceResponse.ok) {
      return next(createInternalError('Failed to access source user'));
    }

    const sourceData = await sourceResponse.json() as any;
    const sourcePlexClient = new PlexClient(serverRow.server_url, sourceData.authToken);

    // Get playlist details
    const playlist = await sourcePlexClient.getPlaylistDetails(playlistId);
    const tracks = await sourcePlexClient.getPlaylistTracks(playlistId);

    // Get target user's token (or use current user if not specified)
    let targetToken = user.plex_token;
    if (targetHomeUserId && targetHomeUserId !== 'current') {
      const targetResponse = await fetch(`https://plex.tv/api/v2/home/users/${targetHomeUserId}/switch`, {
        method: 'POST',
        headers: {
          'X-Plex-Token': user.plex_token,
          'X-Plex-Client-Identifier': 'playlist-lab-server',
          'X-Plex-Product': 'Playlist Lab',
          'X-Plex-Platform': 'Web',
          'Accept': 'application/json',
        },
      });

      if (!targetResponse.ok) {
        return next(createInternalError('Failed to access target user'));
      }

      const targetData = await targetResponse.json() as any;
      targetToken = targetData.authToken;
    }

    const targetPlexClient = new PlexClient(serverRow.server_url, targetToken);

    // Create playlist for target user
    const trackUris = tracks.map((t: any) => 
      `server://${serverRow.server_client_id}/com.plexapp.plugins.library/library/metadata/${t.ratingKey}`
    );

    const libraryUri = `server://${serverRow.server_client_id}/com.plexapp.plugins.library/library/sections/${serverRow.library_id}`;
    const playlistName = newName || playlist.title;

    const newPlaylist = await targetPlexClient.createPlaylist(playlistName, libraryUri, trackUris);

    // Copy cover art if it exists
    if (playlist.composite) {
      try {
        const coverUrl = `${serverRow.server_url}${playlist.composite}?X-Plex-Token=${sourceData.authToken}`;
        await targetPlexClient.uploadPlaylistPoster(newPlaylist.ratingKey, coverUrl);
      } catch (coverError) {
        logger.warn('[Plex Home] Failed to copy cover art', { playlistId, error: coverError });
      }
    }

    logger.info('[Plex Home] Copied playlist', { 
      sourcePlaylistId: playlistId,
      newPlaylistId: newPlaylist.ratingKey,
      sourceHomeUserId,
      targetHomeUserId: targetHomeUserId || 'current',
      userId 
    });

    res.json({ 
      success: true,
      playlist: {
        id: newPlaylist.ratingKey,
        title: newPlaylist.title,
        trackCount: tracks.length,
      },
    });
  } catch (error: any) {
    logger.error('[Plex Home] Error copying playlist', { error: error.message, stack: error.stack });
    next(createInternalError('Failed to copy playlist'));
  }
});

export default router;
