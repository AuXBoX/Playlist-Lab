import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError, createNotFoundError, createForbiddenError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { PlexService } from '../services/plex';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = Router();

/**
 * GET /api/playlists
 * Get user's playlists from Plex
 * Query params:
 *   - userId: (optional, admin only) Get playlists for a specific user
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.session.userId!;
    const db = req.dbService!;
    
    // Check if requesting another user's playlists
    const requestedUserId = req.query.userId ? parseInt(req.query.userId as string, 10) : currentUserId;
    
    // Only admins can fetch other users' playlists
    if (requestedUserId !== currentUserId && !db.isAdmin(currentUserId)) {
      return next(createForbiddenError('You do not have permission to view other users\' playlists'));
    }
    
    // Get user and server info
    const user = db.getUserById(requestedUserId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(requestedUserId);
    if (!userServer) {
      logger.info('No server selected, returning empty playlists', { userId: requestedUserId });
      return res.json({ playlists: [] });
    }

    // Fetch playlists directly from Plex
    try {
      const plexService = new PlexService(userServer.server_url, user.plex_token);
      const plexPlaylists = await plexService.getPlaylists();
      
      // Filter for audio playlists only
      const audioPlaylists = plexPlaylists.filter(p => p.playlistType === 'audio');
      
      // Map to our format
      const playlists = audioPlaylists.map(p => {
        // Clean up duplicate prefixes in playlist names (e.g., "All out - All out 60s" -> "All out 60s")
        let cleanName = p.title;
        const parts = cleanName.split(' - ');
        if (parts.length === 2 && parts[0] === parts[1].split(' ')[0]) {
          // If the prefix before " - " matches the first word after " - ", remove the prefix
          cleanName = parts[1];
        }
        
        return {
          id: p.ratingKey,
          plexPlaylistId: p.ratingKey,
          name: cleanName,
          source: 'plex',
          trackCount: p.leafCount || 0,
          duration: p.duration || 0,
          composite: p.composite,
          thumb: p.composite,
          createdAt: p.addedAt ? p.addedAt * 1000 : Date.now(),
          updatedAt: p.updatedAt ? p.updatedAt * 1000 : Date.now(),
        };
      });
      
      logger.info('Fetched playlists from Plex', { userId: requestedUserId, count: playlists.length });
      res.json({ playlists });
    } catch (error) {
      logger.error('Failed to fetch playlists from Plex', { error, userId: requestedUserId });
      // Return empty array instead of error to avoid breaking the UI
      res.json({ playlists: [] });
    }
  } catch (error) {
    logger.error('Failed to get playlists', { error, userId: req.session.userId });
    next(createInternalError('Failed to retrieve playlists'));
  }
});

export default router;/**
 * GET /api/playlists/:id
 * Get playlist details
 */
router.get('/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = parseInt(req.params.id, 10);

    if (isNaN(playlistId)) {
      return next(createValidationError('Invalid playlist ID'));
    }

    const playlist = db.getPlaylistById(playlistId);
    
    if (!playlist) {
      return next(createNotFoundError('Playlist not found'));
    }

    // Verify ownership
    if (playlist.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to access this playlist'));
    }

    res.json({ playlist });
  } catch (error) {
    logger.error('Failed to get playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to retrieve playlist'));
  }
});

/**
 * POST /api/playlists
 * Create a new playlist in Plex
 */
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { name, source, sourceUrl, trackUris } = req.body;

    if (!name) {
      return next(createValidationError('name is required'));
    }

    if (!trackUris || !Array.isArray(trackUris) || trackUris.length === 0) {
      return next(createValidationError('trackUris must be a non-empty array'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    if (!userServer.library_id) {
      return next(createValidationError('No library selected. Please select a library first.'));
    }

    // Create playlist in Plex
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    const libraryUri = `server://${userServer.server_client_id}/com.plexapp.plugins.library/library/sections/${userServer.library_id}`;
    const plexPlaylist = await plexService.createPlaylist(name, libraryUri, trackUris);

    // Save playlist to database
    const playlist = db.createPlaylist(
      userId,
      plexPlaylist.ratingKey,
      name,
      source || 'manual',
      sourceUrl
    );

    logger.info('Playlist created', { userId, playlistId: playlist.id, name });

    res.status(201).json({ playlist });
  } catch (error) {
    logger.error('Failed to create playlist', { error, userId: req.session.userId });
    next(createInternalError('Failed to create playlist'));
  }
});

/**
 * PUT /api/playlists/:id
 * Update playlist
 */
router.put('/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = parseInt(req.params.id, 10);
    const { name, sourceUrl } = req.body;

    if (isNaN(playlistId)) {
      return next(createValidationError('Invalid playlist ID'));
    }

    const playlist = db.getPlaylistById(playlistId);
    
    if (!playlist) {
      return next(createNotFoundError('Playlist not found'));
    }

    // Verify ownership
    if (playlist.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to modify this playlist'));
    }

    // Build update object
    const updates: any = { updated_at: Date.now() };
    if (name !== undefined) updates.name = name;
    if (sourceUrl !== undefined) updates.source_url = sourceUrl;

    // Update playlist
    db.updatePlaylist(playlistId, updates);
    
    // Retrieve updated playlist
    const updatedPlaylist = db.getPlaylistById(playlistId);

    logger.info('Playlist updated', { userId, playlistId });

    res.json({ playlist: updatedPlaylist });
  } catch (error) {
    logger.error('Failed to update playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to update playlist'));
  }
});

/**
 * DELETE /api/playlists/:id
 * Delete playlist
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = parseInt(req.params.id, 10);

    if (isNaN(playlistId)) {
      return next(createValidationError('Invalid playlist ID'));
    }

    const playlist = db.getPlaylistById(playlistId);
    
    if (!playlist) {
      return next(createNotFoundError('Playlist not found'));
    }

    // Verify ownership
    if (playlist.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to delete this playlist'));
    }

    // Get user and server info to delete from Plex
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (userServer) {
      try {
        // Delete from Plex
        const plexService = new PlexService(userServer.server_url, user.plex_token);
        await plexService.deletePlaylist(playlist.plex_playlist_id);
      } catch (error) {
        logger.warn('Failed to delete playlist from Plex, continuing with database deletion', { error, playlistId });
      }
    }

    // Delete from database
    db.deletePlaylist(playlistId);

    logger.info('Playlist deleted', { userId, playlistId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to delete playlist'));
  }
});

/**
 * GET /api/playlists/:id/tracks
 * Get playlist tracks from Plex
 */
router.get('/:id/tracks', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id;

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    // Get tracks from Plex using the playlist ID directly
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    const plexTracks = await plexService.getPlaylistTracks(playlistId);

    // Map tracks to include codec and bitrate from Media array
    const tracks = plexTracks.map(track => {
      const albumArtist = track.grandparentTitle || '';
      const trackArtist = (track as any).originalTitle || '';
      
      // For Various Artists compilations, prefer track artist over album artist
      const isVariousArtists = albumArtist.toLowerCase().includes('various') || 
                               albumArtist.toLowerCase().includes('compilation');
      const displayArtist = isVariousArtists && trackArtist ? trackArtist : albumArtist;
      
      return {
        ratingKey: track.ratingKey,
        playlistItemID: track.playlistItemID,
        title: track.title,
        artist: displayArtist,
        album: track.parentTitle || '',
        duration: track.duration || 0,
        codec: track.Media?.[0]?.audioCodec?.toUpperCase(),
        bitrate: track.Media?.[0]?.bitrate,
      };
    });

    res.json({ tracks });
  } catch (error) {
    logger.error('Failed to get playlist tracks', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to retrieve playlist tracks'));
  }
});

/**
 * POST /api/playlists/:id/tracks
 * Add tracks to playlist
 */
router.post('/:id/tracks', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id; // Keep as string for Plex ID
    const { trackUris } = req.body;

    if (!trackUris || !Array.isArray(trackUris) || trackUris.length === 0) {
      return next(createValidationError('trackUris must be a non-empty array'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    // Add tracks to Plex playlist using Plex ID directly
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    await plexService.addToPlaylist(playlistId, trackUris);

    // Try to update database record if it exists
    const playlistIdNum = parseInt(playlistId, 10);
    if (!isNaN(playlistIdNum)) {
      const playlist = db.getPlaylistById(playlistIdNum);
      if (playlist) {
        db.updatePlaylist(playlistIdNum, { updated_at: Date.now() });
      }
    }

    logger.info('Tracks added to playlist', { userId, playlistId, trackCount: trackUris.length });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to add tracks to playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to add tracks to playlist'));
  }
});

/**
 * DELETE /api/playlists/:id/tracks/:trackId
 * Remove track from playlist
 */
router.delete('/:id/tracks/:trackId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id; // Keep as string for Plex ID
    const { trackId } = req.params;

    if (!trackId) {
      return next(createValidationError('trackId is required'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    // Remove track from Plex playlist using Plex ID directly
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    await plexService.removeFromPlaylist(playlistId, trackId);

    // Try to update database record if it exists
    const playlistIdNum = parseInt(playlistId, 10);
    if (!isNaN(playlistIdNum)) {
      const playlist = db.getPlaylistById(playlistIdNum);
      if (playlist) {
        db.updatePlaylist(playlistIdNum, { updated_at: Date.now() });
      }
    }

    logger.info('Track removed from playlist', { userId, playlistId, trackId });

    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to remove track from playlist', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session.userId, 
      playlistId: req.params.id,
      trackId: req.params.trackId
    });
    
    // Provide more specific error messages
    if (errorMessage.includes('not found')) {
      return next(createNotFoundError('Track not found in playlist. The playlist may have been modified.'));
    }
    
    next(createInternalError('Failed to remove track from playlist'));
  }
});

/**
 * PUT /api/playlists/:id/tracks/:trackId/move
 * Reorder a track in the playlist
 */
router.put('/:id/tracks/:trackId/move', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id; // Keep as string for Plex
    const { trackId } = req.params;
    const { afterId } = req.body;

    if (!trackId) {
      return next(createValidationError('trackId is required'));
    }

    if (afterId === undefined) {
      return next(createValidationError('afterId is required'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    // Move track in Plex playlist
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    await plexService.movePlaylistItem(playlistId, trackId, afterId);

    logger.info('Track moved in playlist', { userId, playlistId, trackId, afterId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to move track in playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to move track in playlist'));
  }
});

/**
 * POST /api/playlists/:id/share
 * Share a playlist with another user (copy playlist to their account)
 */
router.post('/:id/share', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return next(createValidationError('targetUserId is required'));
    }

    const targetUserIdNum = parseInt(targetUserId, 10);
    if (isNaN(targetUserIdNum)) {
      return next(createValidationError('Invalid target user ID'));
    }

    // Only admins can share playlists
    if (!db.isAdmin(currentUserId)) {
      return next(createForbiddenError('You do not have permission to share playlists'));
    }

    // Get source user (playlist owner) and target user
    const targetUser = db.getUserById(targetUserIdNum);
    if (!targetUser) {
      return next(createNotFoundError('Target user not found'));
    }

    const targetUserServer = db.getUserServer(targetUserIdNum);
    if (!targetUserServer) {
      return next(createValidationError('Target user has no server configured'));
    }

    if (!targetUserServer.library_id) {
      return next(createValidationError('Target user has no library selected'));
    }

    // Get the playlist details and tracks from the source
    // We need to determine who owns this playlist
    // For now, we'll fetch it using the current user's credentials
    const currentUser = db.getUserById(currentUserId);
    if (!currentUser) {
      return next(createNotFoundError('Current user not found'));
    }

    const currentUserServer = db.getUserServer(currentUserId);
    if (!currentUserServer) {
      return next(createValidationError('No server selected'));
    }

    // Get playlist details and tracks
    const plexService = new PlexService(currentUserServer.server_url, currentUser.plex_token);
    const tracks = await plexService.getPlaylistTracks(playlistId);
    
    if (tracks.length === 0) {
      return next(createValidationError('Cannot share empty playlist'));
    }

    // Get playlist name from the first request
    const playlists = await plexService.getPlaylists();
    const sourcePlaylist = playlists.find(p => p.ratingKey === playlistId);
    
    if (!sourcePlaylist) {
      return next(createNotFoundError('Playlist not found'));
    }

    // Create the playlist in the target user's account
    const targetPlexService = new PlexService(targetUserServer.server_url, targetUser.plex_token);
    const libraryUri = `server://${targetUserServer.server_client_id}/com.plexapp.plugins.library/library/sections/${targetUserServer.library_id}`;
    
    // Build track URIs
    const trackUris = tracks.map(t => t.key);
    
    // Create the new playlist
    const newPlaylist = await targetPlexService.createPlaylist(
      sourcePlaylist.title,
      libraryUri,
      trackUris
    );

    // Save to database
    db.createPlaylist(
      targetUserIdNum,
      newPlaylist.ratingKey,
      sourcePlaylist.title,
      'shared',
      undefined
    );

    logger.info('Playlist shared', { 
      playlistId, 
      playlistName: sourcePlaylist.title,
      fromUserId: currentUserId, 
      toUserId: targetUserIdNum,
      trackCount: tracks.length 
    });

    res.json({ 
      success: true,
      playlistName: sourcePlaylist.title,
      trackCount: tracks.length
    });
  } catch (error) {
    logger.error('Failed to share playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to share playlist'));
  }
});

/**
 * POST /api/playlists/:id/share-to-friend
 * Share a playlist with a Plex friend (user with library access)
 */
router.post('/:id/share-to-friend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbService!;
    const playlistId = parseInt(req.params.id);
    const { friendUsername } = req.body;
    const currentUserId = req.session.userId!;

    if (!friendUsername) {
      return next(createValidationError('Friend username is required'));
    }

    // Get the playlist
    const playlist = db.getPlaylistById(playlistId);
    if (!playlist) {
      return next(createValidationError('Playlist not found'));
    }

    // Verify ownership
    if (playlist.user_id !== currentUserId) {
      return next(createValidationError('You can only share your own playlists'));
    }

    // Get user's server config
    const userServer = db.getUserServer(currentUserId);
    if (!userServer) {
      return next(createValidationError('Server configuration not found'));
    }

    // Initialize Plex service
    const plexService = new PlexService(
      userServer.server_url,
      req.user!.plexToken,
      userServer.library_id
    );

    // Share the playlist via Plex API (creates a copy in the friend's account)
    await plexService.sharePlaylist(playlist.plex_playlist_id, friendUsername);

    // Check if the friend is a Playlist Lab user and record the share
    try {
      // Try to find the friend in our users table
      const friendUser = db.getUserByPlexUsername(friendUsername);
      if (friendUser) {
        // Record the share in the database so it shows in their "Shared Playlists" tab
        db.recordPlaylistShare(
          playlist.id,
          currentUserId,
          friendUser.id,
          playlist.plex_playlist_id,
          playlist.name
        );
        logger.info('Recorded playlist share in database', { 
          playlistId, 
          friendUserId: friendUser.id 
        });
      }
    } catch (err) {
      // Friend is not a Playlist Lab user, that's okay - they still got the playlist in Plex
      logger.info('Friend is not a Playlist Lab user, share not recorded in database', { 
        friendUsername 
      });
    }

    logger.info('Playlist shared with friend', { 
      playlistId, 
      playlistName: playlist.name,
      friendUsername 
    });

    res.json({ 
      success: true,
      playlistName: playlist.name
    });
  } catch (error: any) {
    logger.error('Failed to share playlist with friend', { 
      error: error.message, 
      userId: req.session.userId, 
      playlistId: req.params.id 
    });
    next(createInternalError(error.message || 'Failed to share playlist'));
  }
});

/**
 * POST /api/playlists/copy-to-managed-user
 * Copy a playlist from one managed user to another
 */
router.post('/copy-to-managed-user', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { sourceUserId, targetUserId, playlistId } = req.body;

    if (!sourceUserId || !targetUserId || !playlistId) {
      return next(createValidationError('Source user ID, target user ID, and playlist ID are required'));
    }

    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    logger.info('Copying playlist between managed users', { 
      sourceUserId, 
      targetUserId, 
      playlistId 
    });

    // Get source user's token
    const sourceTokenResponse = await axios.post(
      `https://plex.tv/api/v2/home/users/${sourceUserId}/switch`,
      {},
      {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': user.plex_token
        }
      }
    );
    const sourceToken = sourceTokenResponse.data.authToken;

    // Get target user's token
    const targetTokenResponse = await axios.post(
      `https://plex.tv/api/v2/home/users/${targetUserId}/switch`,
      {},
      {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': user.plex_token
        }
      }
    );
    const targetToken = targetTokenResponse.data.authToken;

    // Get user's server
    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('Server configuration not found'));
    }

    // Get playlist details from source user
    const sourcePlexService = new PlexService(userServer.server_url, sourceToken);
    const playlist = await sourcePlexService.getPlaylistDetails(playlistId);
    
    if (!playlist) {
      return next(createNotFoundError('Playlist not found'));
    }

    // Get playlist items
    const items = await sourcePlexService.getPlaylistTracks(playlistId);

    logger.info('Retrieved playlist details', { 
      title: playlist.title, 
      itemCount: items.length 
    });

    // Create playlist in target user's account
    const targetPlexService = new PlexService(userServer.server_url, targetToken);
    const machineId = await sourcePlexService.getMachineIdentifier();
    
    // Build track URIs
    const trackUris = items.map((item: any) => 
      sourcePlexService.buildTrackUri(item.ratingKey, machineId)
    );
    
    // Get library URI
    const libraryUri = sourcePlexService.buildLibraryUri(userServer.library_id!, machineId);

    // Delete existing playlist with same name if it exists
    try {
      const existingPlaylists = await targetPlexService.getPlaylists();
      const existingPlaylist = existingPlaylists.find(p => p.title === playlist.title);
      if (existingPlaylist) {
        logger.info('Deleting existing playlist in target user account', { 
          title: playlist.title 
        });
        await targetPlexService.deletePlaylist(existingPlaylist.ratingKey);
      }
    } catch (err) {
      logger.warn('Could not check for existing playlist', { error: err });
    }

    // Create the new playlist
    const newPlaylist = await targetPlexService.createPlaylist(playlist.title, libraryUri, trackUris);

    logger.info('Playlist copied successfully', { 
      playlistId: newPlaylist.ratingKey,
      title: playlist.title,
      trackCount: items.length
    });

    res.json({
      success: true,
      playlistId: newPlaylist.ratingKey,
      playlistName: playlist.title,
      trackCount: items.length
    });
  } catch (error: any) {
    logger.error('Failed to copy playlist between managed users', { 
      error: error.message 
    });
    next(createInternalError(error.message || 'Failed to copy playlist'));
  }
});

/**
 * POST /api/playlists/:id/cover
 * Upload cover image for playlist
 */
router.post('/:id/cover', requireAuth, upload.single('cover'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id; // Keep as string for Plex

    if (!req.file) {
      return next(createValidationError('No file uploaded'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createNotFoundError('No server configured'));
    }

    // Upload to Plex
    // Plex expects the image to be uploaded via POST to /library/metadata/{ratingKey}/posters
    const uploadUrl = `${userServer.server_url}/library/metadata/${playlistId}/posters?X-Plex-Token=${user.plex_token}`;
    
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Plex-Token': user.plex_token,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    logger.info('Playlist cover uploaded', { userId, playlistId });
    res.json({ success: true, message: 'Cover uploaded successfully' });
  } catch (error: any) {
    logger.error('Failed to upload playlist cover', { 
      error: error.message, 
      userId: req.session.userId, 
      playlistId: req.params.id 
    });
    next(createInternalError('Failed to upload cover'));
  }
});

/**
 * PUT /api/playlists/:id/tracks/:trackId/move
 * Reorder a track in the playlist
 */
router.put('/:id/tracks/:trackId/move', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const playlistId = req.params.id;
    const { trackId } = req.params;
    const { afterId } = req.body;

    logger.info('Move track request received', { 
      playlistId, 
      trackId, 
      afterId, 
      body: req.body,
      userId 
    });

    if (afterId === undefined) {
      logger.error('afterId is undefined', { body: req.body });
      return next(createValidationError('afterId is required'));
    }

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected'));
    }

    // Move track in Plex playlist
    const plexService = new PlexService(userServer.server_url, user.plex_token);
    await plexService.movePlaylistItem(playlistId, trackId, afterId);

    logger.info('Track moved in playlist', { userId, playlistId, trackId, afterId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to move track in playlist', { error, userId: req.session.userId, playlistId: req.params.id });
    next(createInternalError('Failed to move track'));
  }
});

/**
 * POST /api/playlists/:id/share
 * Share a playlist with another user (copy playlist to their account)
 */
router.post('/:id/share', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    const currentUserId = req.session.userId!;
    const db = req.dbService!;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return next(createValidationError('userIds array is required'));
    }

    // Get the playlist from Plex to verify it exists
    const user = db.getUserById(currentUserId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    const userServer = db.getUserServer(currentUserId);
    if (!userServer) {
      return next(createValidationError('No Plex server configured'));
    }

    const plexService = new PlexService(userServer.server_url, user.plex_token);
    const playlists = await plexService.getPlaylists();
    const playlist = playlists.find(p => p.ratingKey === id);

    if (!playlist) {
      return next(createNotFoundError('Playlist not found'));
    }

    // Get or create playlist record in database
    let playlistRecord = db.getPlaylistByPlexId(id);
    if (!playlistRecord) {
      playlistRecord = db.createPlaylist(
        currentUserId,
        id,
        playlist.title,
        'plex',
        null
      );
    }

    // Share with each user
    const sharedCount = db.sharePlaylistWithUsers(playlistRecord.id, currentUserId, userIds, {
      plexPlaylistId: id,
      playlistName: playlist.title
    });

    logger.info('Playlist shared', {
      playlistId: id,
      playlistName: playlist.title,
      ownerId: currentUserId,
      sharedWithCount: sharedCount
    });

    res.json({
      success: true,
      sharedCount
    });
  } catch (error: any) {
    logger.error('Failed to share playlist', { error: error.message });
    next(createInternalError('Failed to share playlist'));
  }
});

/**
 * GET /api/playlists/shared-with-me
 * Get playlists that have been shared with the current user
 */
router.get('/shared-with-me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.session.userId!;
    const db = req.dbService!;

    const sharedPlaylists = db.getPlaylistsSharedWithUser(currentUserId);

    res.json({
      sharedPlaylists
    });
  } catch (error: any) {
    logger.error('Failed to get shared playlists', { error: error.message });
    next(createInternalError('Failed to get shared playlists'));
  }
});
