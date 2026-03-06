import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { importPlaylist, ImportOptions } from '../services/import';
import { EventEmitter } from 'events';
import { debugLog } from '../utils/debug-logger';

const router = Router();

// Store active import sessions
const importSessions = new Map<string, EventEmitter>();
const cancelledSessions = new Set<string>();

// Store progress state for polling
const progressState = new Map<string, any>();

// All import routes require authentication
router.use(requireAuth);

/**
 * GET /api/import/progress/:sessionId
 * Server-Sent Events endpoint for import progress
 */
router.get('/progress/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  debugLog('[SSE] ========== NEW SSE CONNECTION ==========');
  debugLog('[SSE] SessionId: ' + sessionId);
  debugLog('[SSE] =========================================');
  
  // Set CORS headers for cross-origin SSE
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial comment to establish connection
  res.write(': connected\n\n');
  res.flush();
  
  const emitter = new EventEmitter();
  importSessions.set(sessionId, emitter);
  
  debugLog('[SSE] Emitter created and stored');
  debugLog('[SSE] Active sessions: ' + JSON.stringify(Array.from(importSessions.keys())));
  
  let sseOpen = true;
  
  const sendEvent = (data: any) => {
    if (!sseOpen) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    } catch {
      sseOpen = false;
    }
  };
  
  emitter.on('progress', (data) => {
    // Always store for polling, even if SSE is dead
    progressState.set(sessionId, data);
    sendEvent(data);
  });
  emitter.on('complete', (data) => {
    const completeData = { type: 'complete', ...data };
    progressState.set(sessionId, completeData);
    sendEvent(completeData);
    sseOpen = false;
    res.end();
  });
  emitter.on('error', (data) => {
    const errorData = { type: 'error', ...data };
    progressState.set(sessionId, errorData);
    sendEvent(errorData);
    sseOpen = false;
    res.end();
  });
  
  req.on('close', () => {
    sseOpen = false;
    // Don't remove listeners or delete session — import is still running
    // Polling fallback needs the emitter to keep updating progressState
  });
});

/**
 * GET /api/import/status/:sessionId
 * Polling endpoint for import progress (fallback for SSE issues)
 */
router.get('/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const progress = progressState.get(sessionId);
  
  if (progress) {
    res.json(progress);
    // Clean up session data after client reads terminal state
    if (progress.type === 'complete' || progress.type === 'error') {
      progressState.delete(sessionId);
      const emitter = importSessions.get(sessionId);
      if (emitter) {
        emitter.removeAllListeners();
        importSessions.delete(sessionId);
      }
      cancelledSessions.delete(sessionId);
    }
  } else {
    res.json({ type: 'waiting' });
  }
});

/**
 * POST /api/import/cancel/:sessionId
 * Cancel an ongoing import
 */
router.post('/cancel/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  cancelledSessions.add(sessionId);
  
  const emitter = importSessions.get(sessionId);
  if (emitter) {
    emitter.emit('error', { message: 'Import cancelled by user' });
  }
  
  res.json({ success: true });
});

/**
 * Helper function to handle import requests
 */
async function handleImport(
  req: Request,
  res: Response,
  next: NextFunction,
  source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz' | 'aria'
) {
  debugLog('========== IMPORT REQUEST RECEIVED ==========');
  debugLog('Source:', source);
  debugLog('Body:', JSON.stringify(req.body, null, 2));
  debugLog('============================================');

  try {
    const { url, sessionId } = req.body;

    debugLog('[Import Route] URL:', url);
    debugLog('[Import Route] SessionId:', sessionId);

    if (!url || typeof url !== 'string') {
      debugLog('[Import Route] ERROR: URL validation failed');
      return next(createValidationError('url is required and must be a string'));
    }

    const userId = req.session.userId!;
    const db = req.dbService!;

    debugLog('[Import Route] UserId:', userId);

    // Get user's Plex token from users table
    const userRow = (db as any).db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);

    if (!userRow) {
      debugLog('[Import Route] ERROR: User not found');
      return next(createValidationError('User not found'));
    }

    const { plex_token: plexToken } = userRow;

    if (!plexToken || typeof plexToken !== 'string') {
      debugLog('[Import Route] ERROR: No Plex token');
      return next(createValidationError('No Plex token found. Please log in again.'));
    }

    // Get user's server configuration from user_servers table
    const serverRow = (db as any).db.prepare('SELECT server_url, library_id FROM user_servers WHERE user_id = ? LIMIT 1').get(userId);

    if (!serverRow) {
      debugLog('[Import Route] ERROR: No server configured');
      return next(createValidationError('No Plex server configured. Please go to Settings and select a server.'));
    }

    const { server_url: serverUrl, library_id: libraryId } = serverRow;

    if (!serverUrl || typeof serverUrl !== 'string') {
      debugLog('[Import Route] ERROR: No server URL');
      return next(createValidationError('No Plex server URL configured. Please go to Settings and select a server.'));
    }

    debugLog('[Import Route] Server URL:', serverUrl);
    debugLog('[Import Route] Library ID:', libraryId);

    const options: ImportOptions = {
      userId,
      serverUrl,
      plexToken,
      libraryId,
    };

    // Get progress emitter if sessionId provided
    let progressEmitter = sessionId ? importSessions.get(sessionId) : undefined;

    // If sessionId was provided but emitter not found (race condition with SSE),
    // create a fallback emitter that stores progress for polling
    if (sessionId && !progressEmitter) {
      debugLog('[Import Route] No SSE emitter found, creating fallback for polling');
      progressEmitter = new EventEmitter();
      importSessions.set(sessionId, progressEmitter);
      progressEmitter.on('progress', (data: any) => {
        progressState.set(sessionId, data);
      });
      progressEmitter.on('complete', (data: any) => {
        progressState.set(sessionId, { type: 'complete', ...data });
      });
      progressEmitter.on('error', (data: any) => {
        progressState.set(sessionId, { type: 'error', ...data });
      });
    }

    debugLog('[Import Route] Has progressEmitter:', !!progressEmitter);
    debugLog('[Import Route] Calling importPlaylist...');

    if (!progressEmitter) {
      // No SSE connection and no sessionId, run synchronously
      try {
        const result = await importPlaylist(source, url, options, db, progressEmitter, sessionId, cancelledSessions);
        debugLog('[Import Route] Import complete, sending response');
        res.json(result);
      } catch (importError: any) {
        debugLog('[Import Route] ========== IMPORT ERROR ==========');
        debugLog('[Import Route] Import error:', importError.message);
        debugLog('[Import Route] Import stack:', importError.stack);
        debugLog('[Import Route] ====================================');
        throw importError;
      }
    } else {
      // SSE connection exists, run asynchronously
      debugLog('[Import Route] Running import asynchronously with SSE');
      
      // Return immediately to prevent timeout
      res.json({ success: true, message: 'Import started' });
      
      // Run import in background
      importPlaylist(source, url, options, db, progressEmitter, sessionId, cancelledSessions)
        .then((result) => {
          debugLog('[Import Route] Import complete, emitting complete event');
          progressEmitter.emit('complete', result);
        })
        .catch((importError: any) => {
          debugLog('[Import Route] ========== IMPORT ERROR ==========');
          debugLog('[Import Route] Import error:', importError.message);
          debugLog('[Import Route] Import stack:', importError.stack);
          debugLog('[Import Route] ====================================');
          
          logger.error(`Failed to import ${source} playlist`, {
            error: importError.message || importError,
            stack: importError.stack,
            url
          });
          
          progressEmitter.emit('error', { 
            message: importError.message || 'Import failed' 
          });
        });
    }
  } catch (error: any) {
    debugLog('[Import Route] ========== ERROR ==========');
    debugLog('[Import Route] Error:', error.message);
    debugLog('[Import Route] Stack:', error.stack);
    debugLog('[Import Route] ============================');

    logger.error(`Failed to import ${source} playlist`, {
      error: error.message || error,
      stack: error.stack,
      url: req.body.url
    });
    next(createInternalError(`Failed to import ${source} playlist: ${error.message || 'Unknown error'}`));
  }
}


/**
 * POST /api/import/spotify
 * Import a Spotify playlist
 */
router.post('/spotify', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'spotify');
});

/**
 * POST /api/import/deezer
 * Import a Deezer playlist
 */
router.post('/deezer', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'deezer');
});

/**
 * POST /api/import/apple
 * Import an Apple Music playlist
 */
router.post('/apple', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'apple');
});

/**
 * POST /api/import/tidal
 * Import a Tidal playlist
 */
router.post('/tidal', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'tidal');
});

/**
 * POST /api/import/youtube
 * Import a YouTube Music playlist
 */
router.post('/youtube', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'youtube');
});

/**
 * POST /api/import/amazon
 * Import an Amazon Music playlist
 */
router.post('/amazon', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'amazon');
});

/**
 * POST /api/import/qobuz
 * Import a Qobuz playlist
 */
router.post('/qobuz', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'qobuz');
});

/**
 * POST /api/import/aria
 * Import an ARIA chart
 */
router.post('/aria', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'aria');
});

/**
 * POST /api/import/listenbrainz
 * Import a ListenBrainz playlist
 */
router.post('/listenbrainz', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'listenbrainz');
});

/**
 * POST /api/import/file
 * Import a playlist from a file (M3U, CSV, etc.)
 */
router.post('/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, filename, serverUrl, plexToken, libraryId } = req.body;

    if (!content || typeof content !== 'string') {
      return next(createValidationError('content is required and must be a string'));
    }

    if (!filename || typeof filename !== 'string') {
      return next(createValidationError('filename is required and must be a string'));
    }

    if (!serverUrl || typeof serverUrl !== 'string') {
      return next(createValidationError('serverUrl is required and must be a string'));
    }

    if (!plexToken || typeof plexToken !== 'string') {
      return next(createValidationError('plexToken is required and must be a string'));
    }

    const userId = req.session.userId!;
    const db = req.dbService!;

    const options: ImportOptions = {
      userId,
      serverUrl,
      plexToken,
      libraryId,
    };

    // For file imports, we use the content as the sourceIdentifier
    const result = await importPlaylist('file', content, options, db);

    res.json(result);
  } catch (error) {
    logger.error('Failed to import playlist from file', { error, filename: req.body.filename });
    next(createInternalError('Failed to import playlist from file'));
  }
});

/**
 * Search for playlists on a platform
 * POST /api/import/search
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, query } = req.body;

    if (!source || typeof source !== 'string') {
      return next(createValidationError('source is required and must be a string'));
    }

    if (!query || typeof query !== 'string') {
      return next(createValidationError('query is required and must be a string'));
    }

    // Spotify doesn't support search via scraping
    if (source === 'spotify') {
      return next(createValidationError('Search is not supported for Spotify'));
    }

    // Import the scraper functions
    const scrapers = await import('../services/scrapers');
    
    let playlists: any[] = [];
    
    try {
      // Call the appropriate search function based on source
      switch (source) {
        case 'deezer':
          // Deezer search - returns array of playlists
          playlists = await scrapers.searchDeezerPlaylists(query);
          break;
        case 'youtube':
          // YouTube Music search
          playlists = await scrapers.searchYouTubeMusicPlaylists(query);
          break;
        case 'apple':
          // Apple Music search not implemented yet
          return res.json({ playlists: [], message: 'Search not yet implemented for Apple Music' });
        case 'tidal':
          // Tidal search not implemented yet
          return res.json({ playlists: [], message: 'Search not yet implemented for Tidal' });
        case 'amazon':
          // Amazon Music search not implemented yet
          return res.json({ playlists: [], message: 'Search not yet implemented for Amazon Music' });
        case 'qobuz':
          // Qobuz search not implemented yet
          return res.json({ playlists: [], message: 'Search not yet implemented for Qobuz' });
        case 'listenbrainz':
          // ListenBrainz uses username, not search
          return next(createValidationError('Use username field for ListenBrainz'));
        default:
          return next(createValidationError(`Unsupported source: ${source}`));
      }
    } catch (scraperError: unknown) {
      const errorData = scraperError as any;
      logger.error('Search failed', { error: errorData.message, source, query });
      return res.status(400).json({
        error: {
          message: `Search failed: ${errorData.message}`,
          code: 'SEARCH_FAILED',
          source,
        },
      });
    }

    res.json({ playlists });
  } catch (error) {
    logger.error('Failed to search playlists', { error, source: req.body.source, query: req.body.query });
    next(createInternalError('Failed to search playlists'));
  }
});

/**
 * Search for tracks in Plex library
 * POST /api/plex/search
 */
router.post('/plex/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, libraryId } = req.body;

    if (!query || typeof query !== 'string') {
      return next(createValidationError('query is required and must be a string'));
    }

    const userId = req.session.userId!;
    const db = req.dbService!;

    // Get user's Plex token from users table
    const userRow = (db as any).db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    
    if (!userRow) {
      return next(createValidationError('User not found'));
    }

    const { plex_token: plexToken } = userRow;

    if (!plexToken || typeof plexToken !== 'string') {
      return next(createValidationError('No Plex token found. Please log in again.'));
    }

    // Get user's server configuration from user_servers table
    const serverRow = (db as any).db.prepare('SELECT server_url, library_id FROM user_servers WHERE user_id = ? LIMIT 1').get(userId);
    
    if (!serverRow) {
      return next(createValidationError('No Plex server configured. Please go to Settings and select a server.'));
    }

    const { server_url: serverUrl, library_id: defaultLibraryId } = serverRow;

    if (!serverUrl || typeof serverUrl !== 'string') {
      return next(createValidationError('No Plex server URL configured. Please go to Settings and select a server.'));
    }

    // Use provided libraryId or fall back to user's default
    const searchLibraryId = libraryId || defaultLibraryId;

    // Import Plex client
    const { PlexClient } = await import('../services/plex');
    const plexClient = new PlexClient(serverUrl, plexToken);

    // Search for tracks
    const rawTracks = await plexClient.searchTrack(query, searchLibraryId);

    // Enrich tracks missing artist/album/media by fetching full metadata
    // Use concurrency limit to avoid hammering Plex with 50 simultaneous requests
    const CONCURRENCY = 5;
    const enrichedTracks: any[] = [];
    for (let i = 0; i < rawTracks.length; i += CONCURRENCY) {
      const batch = rawTracks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (track: any) => {
          if (track.grandparentTitle && track.parentTitle && track.Media?.length) {
            return track;
          }
          try {
            const detailResp = await plexClient.getTrackDetails(track.ratingKey);
            return detailResp || track;
          } catch {
            return track;
          }
        })
      );
      enrichedTracks.push(...results);
    }

    // Map Plex fields to the format the frontend expects
    const tracks = enrichedTracks.map((track: any) => ({
      ratingKey: track.ratingKey,
      title: track.title,
      artist: track.grandparentTitle || track.originalTitle || '',
      album: track.parentTitle || '',
      codec: track.Media?.[0]?.audioCodec?.toUpperCase() || '',
      bitrate: track.Media?.[0]?.bitrate || 0,
      duration: track.duration || 0,
    }));

    // Return tracks with mapped metadata
    res.json({ tracks });
  } catch (error: any) {
    logger.error('Failed to search Plex tracks', { error: error.message, query: req.body.query });
    next(createInternalError(`Failed to search tracks: ${error.message || 'Unknown error'}`));
  }
});

/**
 * Preview playlist without importing
 * POST /api/import/preview
 */
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, url } = req.body;

    if (!source || typeof source !== 'string') {
      return next(createValidationError('source is required and must be a string'));
    }

    if (!url || typeof url !== 'string') {
      return next(createValidationError('url is required and must be a string'));
    }

    // Check cache first (same as import logic)
    const dbService = req.dbService!;
    const cached = dbService.getCachedPlaylist(source, url);
    const now = Math.floor(Date.now() / 1000);
    const CACHE_MAX_AGE_HOURS = 24;
    const isCacheFresh = cached && (now - cached.scraped_at) < (CACHE_MAX_AGE_HOURS * 3600);

    // If we have fresh cache, use it
    if (isCacheFresh && cached) {
      logger.info(`[Preview] Using fresh cache for ${source}:${url}`);
      return res.json({
        name: cached.name,
        tracks: cached.tracks,
      });
    }

    // Import the scraper functions
    const scrapers = await import('../services/scrapers');
    const { getSpotifyToken } = await import('./spotify-auth');
    
    let playlistData;
    
    try {
      // Call the appropriate scraper based on source
      switch (source) {
        case 'spotify':
          // Try to use Spotify API with OAuth token first
          const userId = req.session.userId;
          const db = (dbService as any).db;
          const spotifyToken = userId ? await getSpotifyToken(userId, db) : null;
          
          if (spotifyToken) {
            // Use Spotify API
            const playlistId = url.split('/playlist/')[1]?.split('?')[0];
            if (!playlistId) {
              return next(createValidationError('Invalid Spotify playlist URL'));
            }
            
            try {
              logger.info('Attempting to fetch Spotify playlist via API', { playlistId, userId });
              
              // Get playlist details
              const playlistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
                headers: {
                  'Authorization': `Bearer ${spotifyToken}`,
                },
              });
              
              if (!playlistResponse.ok) {
                const errorData = await playlistResponse.json();
                logger.error('Spotify API error', { 
                  error: errorData, 
                  status: playlistResponse.status,
                  playlistId,
                  userId,
                  tokenPrefix: spotifyToken.substring(0, 10) + '...'
                });
                throw new Error(`Spotify API error: ${errorData.error?.message || playlistResponse.statusText}`);
              }
              
              const playlist = await playlistResponse.json() as any;
              logger.info('Successfully fetched Spotify playlist via API', { 
                playlistId, 
                trackCount: playlist.tracks?.items?.length || 0 
              });
              
              playlistData = {
                name: playlist.name,
                tracks: playlist.tracks.items.map((item: any) => ({
                  title: item.track.name,
                  artist: item.track.artists.map((a: any) => a.name).join(', '),
                })),
              };
            } catch (apiError: any) {
              logger.error('Failed to fetch from Spotify API, falling back to scraping', { 
                error: apiError.message,
                stack: apiError.stack,
                playlistId,
                userId
              });
              // Fall back to scraping if API fails
              playlistData = await scrapers.scrapeSpotifyPlaylist(url);
            }
          } else {
            logger.info('No Spotify token available, falling back to scraping', { userId });
            // Fall back to scraping
            playlistData = await scrapers.scrapeSpotifyPlaylist(url);
          }
          break;
        case 'deezer':
          // Extract playlist ID from URL or use as-is
          let deezerId = url;
          if (url.includes('deezer.com')) {
            const match = url.match(/\/playlist\/(\d+)/);
            deezerId = match ? match[1] : url;
          }
          logger.info('[Import] Deezer ID extraction', { originalUrl: url, extractedId: deezerId });
          playlistData = await scrapers.scrapeDeezerPlaylist(deezerId);
          break;
        case 'apple':
          playlistData = await scrapers.scrapeAppleMusicPlaylist(url);
          break;
        case 'tidal':
          playlistData = await scrapers.scrapeTidalPlaylist(url);
          break;
        case 'youtube':
          playlistData = await scrapers.scrapeYouTubeMusicPlaylist(url);
          break;
        case 'amazon':
          playlistData = await scrapers.scrapeAmazonMusicPlaylist(url);
          break;
        case 'qobuz':
          playlistData = await scrapers.scrapeQobuzPlaylist(url);
          break;
        case 'aria':
          playlistData = await scrapers.scrapeAriaPlaylist(url);
          break;
        case 'listenbrainz':
          const playlists = await scrapers.getListenBrainzPlaylists(url);
          playlistData = playlists[0] || { name: 'No playlists found', tracks: [] };
          break;
        default:
          return next(createValidationError(`Unsupported source: ${source}`));
      }

      // Cache the scraped data
      if (playlistData && playlistData.tracks) {
        dbService.saveCachedPlaylist(
          source,
          url,
          playlistData.name,
          '',
          playlistData.tracks
        );
        logger.info(`[Preview] Cached ${playlistData.tracks.length} tracks for ${source}:${url}`);
      }

      res.json({
        name: playlistData.name,
        tracks: playlistData.tracks,
      });
    } catch (scrapingError: any) {
      // Scraping failed, check for stale cache
      logger.warn(`[Preview] Scraping failed for ${source}:${url}, checking for stale cache`, { error: scrapingError.message });
      
      const staleCache = dbService.getCachedPlaylist(source, url);
      if (staleCache) {
        logger.info(`[Preview] Using stale cache for ${source}:${url}`);
        return res.json({
          name: staleCache.name,
          tracks: staleCache.tracks,
          fromCache: true,
        });
      }
      
      // No cache available - return empty with helpful message
      logger.info(`[Preview] No cache available for ${source}:${url}, returning empty preview`);
      return res.json({
        name: 'Preview Unavailable',
        tracks: [],
        error: scrapingError.message,
      });
    }
  } catch (error: any) {
    logger.error('Failed to preview playlist', { error: error.message, source: req.body.source, url: req.body.url });
    next(createInternalError(error.message || 'Failed to preview playlist'));
  }
});

/**
 * POST /api/import/search
 * Search Plex library for manual rematch
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return next(createValidationError('query is required and must be a string'));
    }

    const userId = req.session.userId!;
    const db = req.dbService!;

    // Get user's Plex token and server info
    const userRow = (db as any).db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    
    if (!userRow) {
      return next(createValidationError('User not found'));
    }

    const { plex_token: plexToken } = userRow;

    if (!plexToken) {
      return next(createValidationError('Plex token not configured. Please configure your Plex server in Settings.'));
    }

    // Get server URL and library ID
    const serverRow = (db as any).db.prepare('SELECT server_url, library_id FROM user_servers WHERE user_id = ?').get(userId);
    
    if (!serverRow) {
      return next(createValidationError('Plex server not configured. Please configure your Plex server in Settings.'));
    }

    const { server_url: serverUrl, library_id: libraryId } = serverRow;

    if (!serverUrl) {
      return next(createValidationError('Plex server URL not configured. Please configure your Plex server in Settings.'));
    }

    // Import PlexClient and search
    const { PlexClient } = await import('../services/plex');
    const plexClient = new PlexClient(serverUrl, plexToken);
    
    // Try hub search first (searches all fields)
    let results = await plexClient.searchTrack(query, libraryId);
    
    // If hub search returns results but they're all from compilations or albums,
    // also try a direct track title search to find tracks where title = album name
    if (results.length > 0 && libraryId) {
      const hasNonCompilationTrack = results.some((track: any) => {
        const artist = track.grandparentTitle || '';
        return artist && !artist.toLowerCase().includes('various') && !artist.toLowerCase().includes('compilation');
      });
      
      // If all results are compilations, try direct track search
      if (!hasNonCompilationTrack) {
        logger.info(`[Manual Search] All hub results are compilations, trying direct track search for: "${query}"`);
        try {
          const directResults = await plexClient.searchTrack('', libraryId, undefined, query);
          logger.info(`[Manual Search] Direct track search returned ${directResults.length} results`);
          
          // Merge results, avoiding duplicates
          for (const track of directResults) {
            if (!results.some((r: any) => r.ratingKey === track.ratingKey)) {
              results.push(track);
            }
          }
        } catch (err) {
          logger.warn(`[Manual Search] Direct track search failed: ${err}`);
        }
      }
    }
    
    // If still no results and we have a library, try direct track search as fallback
    if (results.length === 0 && libraryId) {
      logger.info(`[Manual Search] No hub results, trying direct track search for: "${query}"`);
      try {
        results = await plexClient.searchTrack('', libraryId, undefined, query);
        logger.info(`[Manual Search] Direct track search returned ${results.length} results`);
      } catch (err) {
        logger.warn(`[Manual Search] Direct track search failed: ${err}`);
      }
    }
    
    // Enrich tracks missing artist/album/media by fetching full metadata
    const enrichedResults = await Promise.all(
      results.map(async (track: any) => {
        if (track.grandparentTitle && track.parentTitle && track.Media?.length) {
          return track;
        }
        try {
          const detail = await plexClient.getTrackDetails(track.ratingKey);
          return detail || track;
        } catch {
          return track;
        }
      })
    );
    
    // Return results with all needed fields
    const tracks = enrichedResults.map((track: any) => ({
      ratingKey: track.ratingKey,
      title: track.title,
      artist: track.grandparentTitle || track.originalTitle || '',
      album: track.parentTitle || '',
      codec: track.Media?.[0]?.audioCodec?.toUpperCase() || '',
      bitrate: track.Media?.[0]?.bitrate || 0,
      duration: track.duration || 0,
    }));

    res.json({ tracks });
  } catch (error: any) {
    logger.error('Failed to search tracks', { error: error.message });
    next(createInternalError(error.message || 'Failed to search tracks'));
  }
});

/**
 * POST /api/import/confirm
 * Create playlist from matched tracks and optionally save missing tracks
 */
router.post('/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playlistName: rawPlaylistName, source, sourceUrl, tracks, saveMissingTracks, missingTracks, overwriteExisting, keepExistingCover, coverUrl } = req.body;

    if (!rawPlaylistName || typeof rawPlaylistName !== 'string') {
      return next(createValidationError('playlistName is required and must be a string'));
    }

    // Normalize playlist name: collapse whitespace, trim
    const playlistName = rawPlaylistName.replace(/\s+/g, ' ').trim();

    if (!tracks || !Array.isArray(tracks)) {
      return next(createValidationError('tracks is required and must be an array'));
    }

    const userId = req.session.userId!;
    const db = req.dbService!;

    // Get user's Plex token and server info
    const userRow = (db as any).db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    
    if (!userRow) {
      return next(createValidationError('User not found'));
    }

    const { plex_token: plexToken } = userRow;

    if (!plexToken) {
      return next(createValidationError('Plex token not configured. Please configure your Plex server in Settings.'));
    }

    // Get server URL and library ID
    const serverRow = (db as any).db.prepare('SELECT server_url, library_id, server_client_id FROM user_servers WHERE user_id = ?').get(userId);
    
    if (!serverRow) {
      return next(createValidationError('Plex server not configured. Please configure your Plex server in Settings.'));
    }

    const { server_url: serverUrl, library_id: libraryId, server_client_id: serverClientId } = serverRow;

    if (!serverUrl) {
      return next(createValidationError('Plex server URL not configured. Please configure your Plex server in Settings.'));
    }

    // Import PlexClient and create playlist
    const { PlexClient } = await import('../services/plex');
    const plexClient = new PlexClient(serverUrl, plexToken);
    
    // Handle overwrite: delete existing playlist with same name
    let existingCoverUrl: string | null = null;
    if (overwriteExisting) {
      try {
        const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
        const normalizedTarget = normalize(playlistName);
        logger.info('[Overwrite] Starting overwrite flow', { playlistName, normalizedTarget });

        // Fetch playlists directly from Plex with audio filter
        const plexResponse = await plexClient.getPlaylists();
        logger.info('[Overwrite] Plex getPlaylists returned', { 
          count: plexResponse.length,
          titles: plexResponse.map((p: any) => p.title),
          types: plexResponse.map((p: any) => p.playlistType),
        });

        // Filter to audio playlists and find matches
        const audioPlaylists = plexResponse.filter((p: any) => p.playlistType === 'audio');
        const matchingPlaylists = audioPlaylists.filter((p: any) => {
          const normalizedTitle = normalize(p.title || '');
          const isMatch = normalizedTitle === normalizedTarget;
          if (isMatch) {
            logger.info('[Overwrite] Found matching playlist', { title: p.title, ratingKey: p.ratingKey });
          }
          return isMatch;
        });

        logger.info('[Overwrite] Match results', { 
          audioCount: audioPlaylists.length,
          matchCount: matchingPlaylists.length,
          audioTitles: audioPlaylists.map((p: any) => p.title),
        });

        if (matchingPlaylists.length > 0) {
          // Save existing cover URL from the first match if user wants to keep it
          const firstMatch = matchingPlaylists[0];
          if (keepExistingCover && firstMatch.composite) {
            existingCoverUrl = `${serverUrl}${firstMatch.composite}?X-Plex-Token=${plexToken}`;
            logger.info('[Overwrite] Saving existing cover', { playlistName });
          }

          // Delete ALL matching playlists (handles duplicates too)
          for (const existing of matchingPlaylists) {
            logger.info('[Overwrite] Deleting Plex playlist', { title: existing.title, ratingKey: existing.ratingKey });
            await plexClient.deletePlaylist(existing.ratingKey);
            logger.info('[Overwrite] Deleted Plex playlist', { title: existing.title, ratingKey: existing.ratingKey });
          }
        } else {
          logger.info('[Overwrite] No matching Plex playlist found', { 
            playlistName,
            normalizedTarget,
            audioTitles: audioPlaylists.map((p: any) => `"${p.title}" -> "${normalize(p.title || '')}"`),
          });
        }

        // Also delete from DB
        const userPlaylists = db.getUserPlaylists(userId);
        const matchingDbPlaylists = userPlaylists.filter((p: any) => 
          normalize(p.name || '') === normalizedTarget
        );
        for (const existingDb of matchingDbPlaylists) {
          db.deletePlaylist(existingDb.id);
          logger.info('[Overwrite] Deleted DB playlist', { playlistName, dbId: existingDb.id });
        }
      } catch (overwriteErr: any) {
        logger.error('[Overwrite] Failed', { error: overwriteErr.message, stack: overwriteErr.stack });
        return next(createInternalError(`Failed to overwrite existing playlist: ${overwriteErr.message}`));
      }
    }

    // Create playlist in Plex
    const trackUris = tracks
      .filter((t: any) => t.matched && t.plexRatingKey)
      .map((t: any) => `server://${serverClientId}/com.plexapp.plugins.library/library/metadata/${t.plexRatingKey}`);
    
    logger.info('Confirm import - track URI details', {
      totalTracks: tracks.length,
      matchedWithKey: tracks.filter((t: any) => t.matched && t.plexRatingKey).length,
      matchedOnly: tracks.filter((t: any) => t.matched).length,
      withKeyOnly: tracks.filter((t: any) => t.plexRatingKey).length,
      uriCount: trackUris.length,
      serverClientId,
      libraryId,
      sampleTrack: tracks[0] ? { matched: tracks[0].matched, plexRatingKey: tracks[0].plexRatingKey, title: tracks[0].title } : null,
      sampleUri: trackUris[0],
    });
    
    if (trackUris.length === 0) {
      return next(createValidationError('No matched tracks to add to playlist'));
    }

    const libraryUri = `server://${serverClientId}/com.plexapp.plugins.library/library/sections/${libraryId}`;
    const plexPlaylist = await plexClient.createPlaylist(playlistName, libraryUri, trackUris);
    
    // Upload cover art: use new cover, or re-upload existing cover if kept
    const finalCoverUrl = (coverUrl && typeof coverUrl === 'string') ? coverUrl : existingCoverUrl;
    if (finalCoverUrl) {
      await plexClient.uploadPlaylistPoster(plexPlaylist.ratingKey, finalCoverUrl);
    }
    
    // Save playlist to database
    const playlist = db.createPlaylist(
      userId,
      plexPlaylist.ratingKey,
      playlistName,
      source || 'manual',
      sourceUrl || ''
    );

    logger.info('Playlist created from import', { 
      userId, 
      playlistId: playlist.id, 
      playlistName,
      trackCount: trackUris.length,
      hasMissingTracks: saveMissingTracks && missingTracks?.length > 0
    });

    // Save missing tracks if requested
    if (saveMissingTracks && missingTracks && Array.isArray(missingTracks) && missingTracks.length > 0) {
      const missingTracksInput = missingTracks.map((track: any, index: number) => ({
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || '',
        position: index,
        source: source || 'manual',
      }));

      db.addMissingTracks(userId, playlist.id, missingTracksInput);

      logger.info('Missing tracks saved', { 
        userId, 
        playlistId: playlist.id, 
        missingCount: missingTracks.length 
      });
    }

    // Return playlist info
    res.json(playlist);
  } catch (error: any) {
    logger.error('Failed to confirm import', { error: error.message });
    next(createInternalError(error.message || 'Failed to create playlist'));
  }
});

export default router;
