import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { importPlaylist, ImportOptions } from '../services/import';
import { EventEmitter } from 'events';
import { debugLog } from '../utils/debug-logger';
import multer from 'multer';
import { importQueue } from '../services/import-queue';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for playlist files
  fileFilter: (_req, file, cb) => {
    // Accept M3U, M3U8, and TXT files (some programs export as .txt)
    const allowedExtensions = ['.m3u', '.m3u8', '.txt'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Please upload M3U, M3U8, or TXT playlist files. Got: ${ext}`));
    }
  }
});

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
  const userId = req.session.userId!;
  
  // Try to cancel from queue first
  const cancelled = importQueue.cancelJob(sessionId, userId);
  
  if (cancelled) {
    logger.info('Import job cancelled from queue', { sessionId, userId });
  } else {
    // Fall back to old cancellation method for currently processing job
    cancelledSessions.add(sessionId);
    
    const emitter = importSessions.get(sessionId);
    if (emitter) {
      emitter.emit('error', { message: 'Import cancelled by user' });
    }
  }
  
  res.json({ success: true, cancelled });
});

/**
 * GET /api/import/queue
 * Get user's import queue status
 */
router.get('/queue', (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const status = importQueue.getUserQueueStatus(userId);
  
  // Enrich processing job with progress data if available
  if (status.processing) {
    const progress = progressState.get(status.processing.sessionId);
    if (progress && progress.type === 'progress') {
      status.processing.progress = {
        current: progress.current || 0,
        total: progress.total || 0,
        currentTrackName: progress.currentTrackName,
        phase: progress.phase,
      };
    }
  }
  
  res.json({
    success: true,
    ...status,
  });
});

/**
 * GET /api/import/queue/completed
 * Get user's completed imports waiting for review
 */
router.get('/queue/completed', (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const completed = importQueue.getCompletedImports(userId);
  
  // Transform to frontend format - only send counts, not full track arrays
  // This makes the response much smaller and faster
  const formattedCompleted = completed.map(job => ({
    id: job.id,
    source: job.source,
    url: job.url,
    playlistName: job.playlistName || 'Imported Playlist',
    completedAt: job.completedAt,
    matchedCount: job.result?.matched?.length || 0,
    unmatchedCount: job.result?.unmatched?.length || 0,
    coverUrl: job.result?.coverUrl,
    // Don't send full track arrays - they'll be loaded when user selects the import
  }));
  
  res.json({
    success: true,
    completed: formattedCompleted,
  });
});

/**
 * GET /api/import/queue/completed/:jobId
 * Get full details of a specific completed import (with all tracks)
 */
router.get('/queue/completed/:jobId', (req: Request, res: Response): void => {
  const userId = req.session.userId!;
  const { jobId } = req.params;
  
  const job = importQueue.getJob(jobId);
  
  if (!job || job.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { message: 'Import not found' },
    });
    return;
  }
  
  res.json({
    success: true,
    import: {
      id: job.id,
      source: job.source,
      url: job.url,
      playlistName: job.playlistName || 'Imported Playlist',
      completedAt: job.completedAt,
      matched: job.result?.matched || [],
      unmatched: job.result?.unmatched || [],
      coverUrl: job.result?.coverUrl,
    },
  });
});

/**
 * DELETE /api/import/queue/completed/:jobId
 * Remove a completed import from the queue
 */
router.delete('/queue/completed/:jobId', (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { jobId } = req.params;
  
  const removed = importQueue.removeCompletedImport(userId, jobId);
  
  res.json({
    success: true,
    removed,
  });
});

/**
 * DELETE /api/import/queue/:jobId
 * Cancel an active or queued import job
 */
router.delete('/queue/:jobId', (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { jobId } = req.params;
  
  const cancelled = importQueue.cancelJob(jobId, userId);
  
  if (cancelled) {
    logger.info('Import job cancelled by user', { userId, jobId });
    res.json({
      success: true,
      message: 'Import cancelled',
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Job not found or already completed',
    });
  }
});

/**
 * Helper function to handle import requests
 */
async function handleImport(
  req: Request,
  res: Response,
  next: NextFunction,
  source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz' | 'aria' | 'billboard' | 'lastfm'
) {
  debugLog('========== IMPORT REQUEST RECEIVED ==========');
  debugLog('Source:', source);
  debugLog('Body:', JSON.stringify(req.body, null, 2));
  debugLog('============================================');

  try {
    const { url, sessionId, customName, skipQueue } = req.body;

    debugLog('[Import Route] URL:', url);
    debugLog('[Import Route] SessionId:', sessionId);
    debugLog('[Import Route] Custom Name:', customName);
    debugLog('[Import Route] Skip Queue:', skipQueue);

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
      customName: customName?.trim() || undefined,
    };

    // Check if we should use the queue (default: yes, unless skipQueue is explicitly true)
    const useQueue = skipQueue !== true;

    if (useQueue) {
      // Add to queue
      const job = importQueue.enqueue({
        id: sessionId,
        userId,
        source,
        url,
        playlistName: customName || undefined,
        sessionId,
      });

      logger.info('Import job added to queue', {
        jobId: job.id,
        userId,
        source,
        playlistName: job.playlistName,
        queuePosition: importQueue.getUserQueueStatus(userId).position,
      });

      // Return immediately with queue status
      const queueStatus = importQueue.getUserQueueStatus(userId);
      return res.json({
        success: true,
        queued: true,
        position: queueStatus.position,
        message: queueStatus.position === 0 
          ? 'Import started' 
          : `Import queued (position ${queueStatus.position})`,
      });
    }

    // Legacy path: run immediately without queue (for backward compatibility)
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
 * POST /api/import/billboard
 * Import a Billboard chart
 */
router.post('/billboard', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'billboard');
});

/**
 * POST /api/import/lastfm
 * Import a Last.fm chart
 */
router.post('/lastfm', async (req: Request, res: Response, next: NextFunction) => {
  await handleImport(req, res, next, 'lastfm');
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
router.post('/file', requireAuth, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    const file = req.file;

    if (!file) {
      return next(createValidationError('No file uploaded'));
    }

    // Read file content with encoding detection
    let content: string;
    try {
      // Try UTF-8 first
      content = file.buffer.toString('utf-8');
      
      // Check for invalid UTF-8 sequences
      if (content.includes('\uFFFD')) {
        // Try other encodings if UTF-8 fails
        content = file.buffer.toString('latin1');
      }
    } catch (error) {
      return next(createValidationError('Unable to read file. Please ensure it is a text-based playlist file.'));
    }
    
    const filename = file.originalname;

    debugLog('[File Import] ========== FILE UPLOAD ==========');
    debugLog('[File Import] Filename: ' + filename);
    debugLog('[File Import] Size: ' + file.size + ' bytes');
    debugLog('[File Import] Content length: ' + content.length + ' chars');
    debugLog('[File Import] SessionId: ' + sessionId);
    debugLog('[File Import] ==========================================');

    if (!content || content.trim().length === 0) {
      return next(createValidationError('File is empty. Please upload a valid playlist file.'));
    }
    
    // Basic validation - check if it looks like a playlist file
    const hasExtinf = content.includes('#EXTINF');
    const hasM3UHeader = content.includes('#EXTM3U');
    const hasFilePaths = /\.(mp3|m4a|flac|wav|ogg|aac|wma)/i.test(content);
    
    if (!hasExtinf && !hasM3UHeader && !hasFilePaths) {
      debugLog('[File Import] File validation failed - no playlist markers found');
      return next(createValidationError('File does not appear to be a valid M3U playlist. Please check the file format.'));
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

    const { server_url: serverUrl, library_id: libraryId } = serverRow;

    if (!serverUrl || typeof serverUrl !== 'string') {
      return next(createValidationError('No Plex server URL configured. Please go to Settings and select a server.'));
    }

    const options: ImportOptions = {
      userId,
      serverUrl,
      plexToken,
      libraryId,
      filename, // Pass filename for parseM3UFile
    };

    // Get progress emitter if sessionId provided
    let progressEmitter = sessionId ? importSessions.get(sessionId) : undefined;

    // If sessionId was provided but emitter not found, create a fallback emitter
    if (sessionId && !progressEmitter) {
      debugLog('[File Import] No SSE emitter found, creating fallback for polling');
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

    // For file imports, we pass the content and filename separately
    // The parseM3UFile function expects content as the sourceIdentifier
    debugLog('[File Import] Calling importPlaylist with file content');
    
    if (!progressEmitter) {
      // No SSE connection, run synchronously
      const result = await importPlaylist('file', content, options, db, progressEmitter, sessionId, cancelledSessions);
      debugLog('[File Import] Import complete, sending response');
      res.json(result);
    } else {
      // SSE connection exists, run asynchronously
      debugLog('[File Import] Running import asynchronously with SSE');
      
      // Return immediately
      res.json({ success: true, message: 'Import started' });
      
      // Run import in background
      importPlaylist('file', content, options, db, progressEmitter, sessionId, cancelledSessions)
        .then((result) => {
          debugLog('[File Import] Background import complete');
          progressEmitter!.emit('complete', result);
        })
        .catch((error) => {
          debugLog('[File Import] Background import error:', error.message);
          logger.error('File import failed', { error, filename });
          progressEmitter!.emit('error', { message: error.message || 'Import failed' });
        });
    }
  } catch (error: any) {
    logger.error('Failed to import playlist from file', { error, filename: req.file?.originalname });
    next(createInternalError(`Failed to import playlist: ${error.message || 'Unknown error'}`));
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

    let rawTracks: any[] = [];
    
    // Try to parse query as "Artist - Title" or "Artist Title" format
    let parsedArtist: string | undefined;
    let parsedTitle: string | undefined;
    
    // Check for "Artist - Title" format
    if (query.includes(' - ')) {
      const parts = query.split(' - ');
      if (parts.length === 2) {
        parsedArtist = parts[0].trim();
        parsedTitle = parts[1].trim();
        logger.info(`[Plex Search] Parsed query as artist-title: "${parsedArtist}" - "${parsedTitle}"`);
      }
    }
    
    // If not parsed yet, try to detect artist name at start (common pattern: "Artist Name Track Name")
    // Look for known artists or use first 2-3 words as artist
    if (!parsedArtist && !parsedTitle) {
      const words = query.split(/\s+/);
      if (words.length >= 3) {
        // Try first 2 words as artist, rest as title
        parsedArtist = words.slice(0, 2).join(' ');
        parsedTitle = words.slice(2).join(' ');
        logger.info(`[Plex Search] Attempting to split query: artist="${parsedArtist}", title="${parsedTitle}"`);
      }
    }
    
    // If we have both artist and title, use optimized artist-first search
    if (parsedArtist && parsedTitle && searchLibraryId) {
      logger.info(`[Plex Search] Using artist-first search with parsed values`);
      
      try {
        // Search for artist (Album Artist)
        const artistResponse = await plexClient.client.get(
          `/library/sections/${searchLibraryId}/all`,
          { 
            params: { 
              type: 8, // Artist type
              'artist.title': parsedArtist
            } 
          }
        );
        
        const artists = artistResponse.data.MediaContainer.Metadata || [];
        logger.info(`[Plex Search] Found ${artists.length} matching album artists for "${parsedArtist}"`);
        
        if (artists.length > 0) {
          // Get all tracks from the first matching artist
          const artistKey = artists[0].ratingKey;
          const artistName = artists[0].title;
          logger.info(`[Plex Search] Fetching tracks from album artist: ${artistName}`);
          
          const tracksResponse = await plexClient.client.get(
            `/library/metadata/${artistKey}/allLeaves`,
            { params: { type: 10 } }
          );
          
          const artistTracks = tracksResponse.data.MediaContainer.Metadata || [];
          logger.info(`[Plex Search] Album artist has ${artistTracks.length} tracks`);
          
          // Filter by title
          const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedSearchTitle = normalizeTitle(parsedTitle);
          
          rawTracks = artistTracks.filter((track: any) => {
            const trackTitle = track.title || '';
            const normalizedTrackTitle = normalizeTitle(trackTitle);
            return normalizedTrackTitle.includes(normalizedSearchTitle) || 
                   normalizedSearchTitle.includes(normalizedTrackTitle);
          });
          
          logger.info(`[Plex Search] Filtered to ${rawTracks.length} tracks matching title "${parsedTitle}"`);
        }
        
        // If no results from album artist, try searching by track artist (for compilations)
        if (rawTracks.length === 0) {
          logger.info(`[Plex Search] No results from album artist, trying track-level artist search`);
          
          // Search for tracks by title, then filter by track artist in memory
          // This is necessary because Plex doesn't support filtering by track.originalTitle directly
          const trackSearchResponse = await plexClient.client.get(
            `/library/sections/${searchLibraryId}/all`,
            { 
              params: { 
                type: 10, // Track type
                'track.title': parsedTitle
              } 
            }
          );
          
          const allTracks = trackSearchResponse.data.MediaContainer.Metadata || [];
          logger.info(`[Plex Search] Found ${allTracks.length} tracks with title "${parsedTitle}"`);
          
          // Filter by track artist (originalTitle field)
          const normalizeArtist = (a: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedSearchArtist = normalizeArtist(parsedArtist);
          
          rawTracks = allTracks.filter((track: any) => {
            const trackArtist = track.originalTitle || '';
            const normalizedTrackArtist = normalizeArtist(trackArtist);
            return normalizedTrackArtist.includes(normalizedSearchArtist) || 
                   normalizedSearchArtist.includes(normalizedTrackArtist);
          });
          
          logger.info(`[Plex Search] Track artist filter matched ${rawTracks.length} tracks where track artist contains "${parsedArtist}"`);
        }
      } catch (err: any) {
        logger.warn(`[Plex Search] Artist-first search with parsed values failed: ${err.message}`);
      }
    }
    
    // Check if this looks like an artist-only search (no track-specific words)
    if (rawTracks.length === 0) {
      const trackIndicators = /\b(remix|feat|ft|featuring|live|acoustic|version|edit|mix|cover|demo|remaster)\b/i;
      const looksLikeArtistSearch = !trackIndicators.test(query) && query.split(/\s+/).length <= 3;
      
      if (looksLikeArtistSearch && searchLibraryId) {
        logger.info(`[Plex Search] Query looks like artist search, trying artist-first approach for: ${query}`);
        
        try {
          // Search for album artist
          const artistResponse = await plexClient.client.get(
            `/library/sections/${searchLibraryId}/all`,
            { 
              params: { 
                type: 8, // Artist type
                'artist.title': query
              } 
            }
          );
          
          const artists = artistResponse.data.MediaContainer.Metadata || [];
          logger.info(`[Plex Search] Found ${artists.length} matching album artists`);
          
          if (artists.length > 0) {
            // Get all tracks from the first matching artist
            const artistKey = artists[0].ratingKey;
            const artistName = artists[0].title;
            logger.info(`[Plex Search] Fetching all tracks from album artist: ${artistName}`);
            
            const tracksResponse = await plexClient.client.get(
              `/library/metadata/${artistKey}/allLeaves`,
              { params: { type: 10 } }
            );
            
            rawTracks = tracksResponse.data.MediaContainer.Metadata || [];
            logger.info(`[Plex Search] Album artist has ${rawTracks.length} tracks`);
          }
          
          // If no results from album artist, try hub search (which searches track artists too)
          if (rawTracks.length === 0) {
            logger.info(`[Plex Search] No album artist found, trying hub search for track artists`);
            
            const hubResponse = await plexClient.client.get('/hubs/search', {
              params: { query: query, limit: 500 }
            });
            
            const hubs = hubResponse.data.MediaContainer.Hub || [];
            const trackHub = hubs.find((hub: any) => hub.type === 'track');
            const allHubTracks = trackHub?.Metadata || [];
            logger.info(`[Plex Search] Hub search returned ${allHubTracks.length} tracks`);
            
            // Filter by library if specified
            if (searchLibraryId && allHubTracks.length > 0) {
              const libraryIdNum = parseInt(searchLibraryId, 10);
              rawTracks = allHubTracks.filter((track: any) => track.librarySectionID === libraryIdNum);
              logger.info(`[Plex Search] After library filter: ${rawTracks.length} tracks`);
            } else {
              rawTracks = allHubTracks;
            }
          }
        } catch (err: any) {
          logger.warn(`[Plex Search] Artist-first search failed: ${err.message}, falling back to regular search`);
        }
      }
    }
    
    // If artist search didn't find anything, use regular search
    if (rawTracks.length === 0) {
      logger.info(`[Plex Search] Using regular search for: ${query}`);
      rawTracks = await plexClient.searchTrack(query, searchLibraryId);
    }

    logger.info(`[Plex Search] Found ${rawTracks.length} raw tracks for query: ${query}`);

    // Filter to ensure we only have tracks (type 10), not albums or artists
    const trackTypeOnly = rawTracks.filter((track: any) => {
      // Plex track type is 'track' (string) or 10 (number)
      const isTrack = track.type === 'track' || track.type === 10;
      if (!isTrack) {
        logger.warn(`[Plex Search] Filtering out non-track item: ${track.title} (type: ${track.type})`);
      }
      return isTrack;
    });

    logger.info(`[Plex Search] After type filter: ${trackTypeOnly.length} tracks`);

    // Enrich tracks missing artist/album/media by fetching full metadata
    // Use concurrency limit to avoid hammering Plex with 50 simultaneous requests
    const CONCURRENCY = 5;
    const enrichedTracks: any[] = [];
    for (let i = 0; i < trackTypeOnly.length; i += CONCURRENCY) {
      const batch = trackTypeOnly.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (track: any) => {
          // Check if track has all required metadata
          const hasMetadata = track.grandparentTitle && track.parentTitle && track.Media?.length;
          
          if (hasMetadata) {
            return track;
          }
          
          // Fetch full metadata if missing
          try {
            logger.info(`[Plex Search] Enriching track ${track.ratingKey}: ${track.title}`);
            const detailResp = await plexClient.getTrackDetails(track.ratingKey);
            return detailResp || track;
          } catch (err) {
            logger.warn(`[Plex Search] Failed to enrich track ${track.ratingKey}: ${err}`);
            return track;
          }
        })
      );
      enrichedTracks.push(...results);
    }

    logger.info(`[Plex Search] Enriched ${enrichedTracks.length} tracks`);

    // Log a sample track to see what data we have
    if (enrichedTracks.length > 0) {
      const sample = enrichedTracks[0];
      logger.info(`[Plex Search] Sample track data:`, {
        title: sample.title,
        hasMedia: !!sample.Media,
        mediaLength: sample.Media?.length,
        mediaData: sample.Media?.[0] ? {
          bitrate: sample.Media[0].bitrate,
          audioCodec: sample.Media[0].audioCodec,
          container: sample.Media[0].container,
        } : 'no media',
      });
    }

    // Calculate relevance score for each track
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 2);
    
    const tracksWithScores = enrichedTracks.map((track: any) => {
      const titleLower = (track.title || '').toLowerCase();
      const artistLower = (track.grandparentTitle || track.originalTitle || '').toLowerCase();
      const albumLower = (track.parentTitle || '').toLowerCase();
      
      // Extract media info
      const media = track.Media?.[0];
      const codec = media?.audioCodec?.toUpperCase() || 'Unknown';
      const bitrate = media?.bitrate || 0;
      // Plex returns bitrate in kbps, not bps, so don't divide
      const bitrateKbps = bitrate || 0;
      
      logger.info(`[Plex Search] Track "${track.title}": codec=${codec}, bitrate=${bitrate}, bitrateKbps=${bitrateKbps}`);
      
      let score = 0;
      
      // Check if query matches artist name well (for artist-focused searches)
      const artistMatchesQuery = artistLower.includes(queryLower) || queryLower.includes(artistLower);
      
      if (artistMatchesQuery) {
        // If artist matches, prioritize it heavily
        score += 800;
        
        // Exact artist match gets even more
        if (artistLower === queryLower) {
          score += 200;
        }
      }
      
      // Exact title match (highest score for title-focused searches)
      if (titleLower === queryLower) {
        score += 1000;
      }
      
      // Title starts with query
      if (titleLower.startsWith(queryLower)) {
        score += 500;
      }
      
      // Title contains full query
      if (titleLower.includes(queryLower)) {
        score += 300;
      }
      
      // Count matching words in title
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 100;
        }
      }
      
      // Artist word matches (if not already counted above)
      if (!artistMatchesQuery) {
        for (const word of queryWords) {
          if (artistLower.includes(word)) {
            score += 20;
          }
        }
      }
      
      // Album match (lowest priority)
      if (albumLower.includes(queryLower)) {
        score += 10;
      }
      
      // Prefer higher quality (small bonus)
      if (codec === 'FLAC') score += 5;
      else if (codec === 'ALAC') score += 4;
      else if (codec === 'AAC') score += 2;
      
      return {
        ratingKey: track.ratingKey,
        title: track.title,
        artist: track.grandparentTitle || track.originalTitle || 'Unknown Artist',
        album: track.parentTitle || 'Unknown Album',
        codec: codec,
        bitrate: bitrateKbps,
        duration: track.duration || 0,
        score: score,
      };
    });

    // Sort by score (highest first)
    tracksWithScores.sort((a, b) => b.score - a.score);
    
    // Remove score from final output (internal use only)
    const tracks = tracksWithScores.map(({ score, ...track }) => track);

    logger.info(`[Plex Search] Returning ${tracks.length} tracks sorted by relevance`);

    // Return tracks with mapped metadata
    res.json({ tracks });
  } catch (error: any) {
    logger.error('Failed to search Plex tracks', { error: error.message, query: req.body.query });
    next(createInternalError(`Failed to search tracks: ${error.message || 'Unknown error'}`));
  }
});

/**
 * Retry matching a single track
 * POST /api/import/plex/retry-match
 */
router.post('/plex/retry-match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { track } = req.body;

    if (!track || typeof track !== 'object') {
      return next(createValidationError('track is required and must be an object'));
    }

    if (!track.title || !track.artist) {
      return next(createValidationError('track must have title and artist'));
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

    const { server_url: serverUrl, library_id: libraryId } = serverRow;

    if (!serverUrl || typeof serverUrl !== 'string') {
      return next(createValidationError('No Plex server URL configured. Please go to Settings and select a server.'));
    }

    // Get user's matching settings
    const settingsRow = (db as any).db.prepare('SELECT matching_settings FROM users WHERE id = ?').get(userId);
    const matchingSettings = settingsRow?.matching_settings 
      ? JSON.parse(settingsRow.matching_settings)
      : {
          minMatchScore: 70,
          preferHigherQuality: true,
          preferLossless: false,
          allowRemaster: true,
          allowLive: false,
          allowRemix: false,
          allowCover: false,
          allowKaraoke: false,
          allowInstrumental: false,
          allowAcoustic: true,
          allowExplicit: true,
          allowClean: true,
        };

    // Import matching service
    const { matchPlaylist } = await import('../services/matching');
    
    // Use matchPlaylist with a single track
    const externalTrack = {
      title: track.title,
      artist: track.artist,
      album: track.album || '',
    };

    const matchResults = await matchPlaylist(
      [externalTrack],
      serverUrl,
      plexToken,
      libraryId,
      matchingSettings
    );

    const matchResult = matchResults[0];

    if (matchResult && matchResult.matched && matchResult.plexRatingKey) {
      // Return the matched track info
      res.json({
        matched: true,
        plexRatingKey: matchResult.plexRatingKey,
        plexTitle: matchResult.plexTitle,
        plexArtist: matchResult.plexArtist,
        plexAlbum: matchResult.plexAlbum,
      });
    } else {
      // No match found
      res.json({
        matched: false,
        message: 'Track not found in Plex library',
      });
    }
  } catch (error: any) {
    logger.error('Failed to retry track match', { error: error.message, track: req.body.track });
    next(createInternalError(`Failed to retry match: ${error.message || 'Unknown error'}`));
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
        case 'billboard':
          playlistData = await scrapers.scrapeBillboardPlaylist(url);
          break;
        case 'lastfm':
          playlistData = await scrapers.scrapeLastfmPlaylist(url);
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

/**
 * GET /api/import/spotify/user/:userId/playlists
 * Fetch public playlists from a Spotify user (unauthenticated)
 */
router.get('/spotify/user/:userId/playlists', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId: spotifyUserId } = req.params;
    const userId = req.session.userId!;
    const db = (req.dbService as any)?.db || (req as any).db;

    if (!spotifyUserId) {
      res.status(400).json({
        error: { message: 'Spotify user ID is required' }
      });
      return;
    }

    logger.info('[Spotify User Playlists] Fetching playlists', { spotifyUserId, userId });

    // Import the adapter
    const { adapterRegistry } = await import('../adapters');
    const adapter = adapterRegistry.getSource('spotify');

    if (!adapter || !adapter.searchPlaylists) {
      res.status(500).json({
        error: { message: 'Spotify adapter not available' }
      });
      return;
    }

    // Use searchPlaylists with the user ID - it will use unauthenticated method
    const result = await adapter.searchPlaylists(spotifyUserId, userId, db);
    
    // Check if result includes displayName (for user ID queries) or is just playlists array
    let displayName: string;
    let playlists: any[];
    
    if (Array.isArray(result)) {
      // Old format: just playlists array
      displayName = spotifyUserId;
      playlists = result;
    } else {
      // New format: { displayName, playlists }
      displayName = result.displayName;
      playlists = result.playlists;
    }

    // Update the display name in the database if this user is saved
    // But only if the display name looks valid (not a language dialog or generic title)
    const invalidNames = ['choose a language', 'spotify', 'spotify - web player', 'spotify – web player', 'web player', ''];
    const isValidDisplayName = displayName && 
      !invalidNames.includes(displayName.toLowerCase().trim()) &&
      !/choose|language|sprache|langue|idioma/i.test(displayName);
    
    if (isValidDisplayName) {
      try {
        db.prepare(
          `UPDATE saved_spotify_users 
           SET display_name = ? 
           WHERE user_id = ? AND spotify_user_id = ?`
        ).run(displayName, userId, spotifyUserId);
      } catch (updateError) {
        logger.warn('[Spotify User Playlists] Could not update display name', { 
          spotifyUserId, 
          error: updateError 
        });
      }
    } else {
      // Invalid display name from scraper — try to get the saved name from DB
      logger.info('[Spotify User Playlists] Invalid scraper display name, falling back to DB', { 
        spotifyUserId, 
        scraperName: displayName 
      });
      try {
        const savedUser = db.prepare(
          `SELECT display_name FROM saved_spotify_users WHERE user_id = ? AND spotify_user_id = ?`
        ).get(userId, spotifyUserId) as { display_name: string } | undefined;
        if (savedUser && !invalidNames.includes(savedUser.display_name.toLowerCase().trim()) && !/choose|language|sprache|langue|idioma/i.test(savedUser.display_name)) {
          displayName = savedUser.display_name;
        } else {
          displayName = spotifyUserId;
        }
      } catch {
        displayName = spotifyUserId;
      }
    }

    logger.info('[Spotify User Playlists] Found playlists', { 
      spotifyUserId,
      displayName,
      count: playlists.length 
    });

    res.json({ displayName, playlists });
  } catch (error: any) {
    logger.error('[Spotify User Playlists] Error', { error: error.message, stack: error.stack });
    next(createInternalError(error.message || 'Failed to fetch Spotify user playlists'));
  }
});

/**
 * GET /api/import/spotify/playlist/:playlistId/tracks
 * Fetch tracks from a Spotify playlist for preview
 */
router.get('/spotify/playlist/:playlistId/tracks', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const userId = req.session.userId!;
    const db = (req.dbService as any).db; // Get the actual database instance

    logger.info('[Spotify Playlist Tracks] Fetching tracks', { playlistId, userId });

    // Import the adapter
    const { adapterRegistry } = await import('../adapters');
    const adapter = adapterRegistry.getSource('spotify');

    if (!adapter || !adapter.fetchTracks) {
      res.status(500).json({
        error: { message: 'Spotify adapter not available' }
      });
      return;
    }

    // Fetch tracks from the playlist
    const { tracks } = await adapter.fetchTracks(playlistId, userId, db);

    logger.info('[Spotify Playlist Tracks] Found tracks', { 
      playlistId, 
      count: tracks.length 
    });

    res.json({ tracks });
  } catch (error: any) {
    logger.error('[Spotify Playlist Tracks] Error', { error: error.message, stack: error.stack });
    next(createInternalError(error.message || 'Failed to fetch Spotify playlist tracks'));
  }
});

export default router;
