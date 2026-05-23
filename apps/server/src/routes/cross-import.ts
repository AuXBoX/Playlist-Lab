import { Router, Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { adapterRegistry } from '../adapters/registry';
import { TargetConfig, MatchResult } from '../adapters/types';
import { startYouTubeLoginSession, getLoginSessionStatus } from '../adapters/youtube-plain-target';

const router = Router();

// ---------------------------------------------------------------------------
// SSE session state
// ---------------------------------------------------------------------------
const matchSessions = new Map<string, EventEmitter>();
const cancelledSessions = new Set<string>();
const matchProgressState = new Map<string, any>();

// All cross-import routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Helper: get raw db from dbService
// ---------------------------------------------------------------------------
function getRawDb(req: Request) {
  return (req.dbService as any).db;
}

// ---------------------------------------------------------------------------
// GET /api/cross-import/sources
// Returns all available sources enriched with Plex server/home-user entries
// and OAuth connection status for external services.
// FILTERED: Only returns Plex sources (no external services)
// ---------------------------------------------------------------------------
router.get('/sources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = getRawDb(req);

    const sources: any[] = [];

    for (const adapter of adapterRegistry.listSources()) {
      // FILTER: Only allow Plex as source
      if (adapter.meta.id === 'plex') {
        // Expand Plex into one entry per configured server
        const servers = db.prepare('SELECT * FROM user_servers WHERE user_id = ?').all(userId);

        for (const server of servers) {
          sources.push({
            id: `plex:${server.server_client_id}`,
            name: server.server_name || 'Plex',
            icon: 'plex',
            isSourceOnly: false,
            connected: true,
            type: 'plex-server',
            serverUrl: server.server_url,
            libraryId: server.library_id,
          });
        }
      }
      // External services removed - only Plex allowed as source
    }

    res.json({ sources });
  } catch (err: any) {
    logger.error('[CrossImport] GET /sources error', { error: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/targets
// Returns all write-capable targets enriched with Plex library info and
// OAuth connection status. Marks the user's default Plex server.
// FILTERED: Only returns YouTube target (no other services)
// ---------------------------------------------------------------------------
router.get('/targets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = getRawDb(req);

    const targets: any[] = [];

    for (const adapter of adapterRegistry.listTargets()) {
      // FILTER: Only allow YouTube (plain) as target
      if (adapter.meta.id === 'youtube') {
        // Check OAuth connection status
        let connected = false;
        try {
          const row = db.prepare(
            'SELECT id FROM oauth_connections WHERE user_id = ? AND service = ?'
          ).get(userId, adapter.meta.id);
          connected = !!row;
        } catch {
          connected = false;
        }

        targets.push({
          id: adapter.meta.id,
          name: adapter.meta.name,
          icon: adapter.meta.icon,
          connected,
          requiresOAuth: adapter.meta.requiresOAuth,
          configured: adapter.isConfigured ? adapter.isConfigured() : true,
        });
      }
      // All other targets removed - only YouTube allowed
    }

    res.json({ targets });
  } catch (err: any) {
    logger.error('[CrossImport] GET /targets error', { error: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/sources/:sourceId/playlists
// Resolves the source adapter and returns its playlist list.
// ---------------------------------------------------------------------------
router.get('/sources/:sourceId/playlists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId } = req.params;
    const userId = req.session.userId!;
    const db = getRawDb(req);

    // Resolve adapter — strip 'plex:...' prefix to 'plex'
    const adapterId = sourceId.startsWith('plex') ? 'plex' : sourceId;
    const adapter = adapterRegistry.getSource(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Source adapter '${sourceId}' not found` });
    }

    if (!adapter.listPlaylists) {
      return res.status(400).json({ error: `Source '${sourceId}' does not support listing playlists` });
    }

    const playlists = await adapter.listPlaylists(userId, db);
    res.json({ playlists });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] GET /sources/:sourceId/playlists error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/sources/:sourceId/search?q=...
// Searches the source service for playlists matching the query.
// ---------------------------------------------------------------------------
router.get('/sources/:sourceId/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId } = req.params;
    const { q } = req.query as { q?: string };

    if (!q?.trim()) {
      return res.status(400).json({ error: 'q (query) is required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);

    const adapterId = sourceId.startsWith('plex') ? 'plex' : sourceId;
    const adapter = adapterRegistry.getSource(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Source adapter '${sourceId}' not found` });
    }

    if (!adapter.searchPlaylists) {
      return res.status(400).json({ error: `Source '${sourceId}' does not support playlist search` });
    }

    const playlists = await adapter.searchPlaylists(q.trim(), userId, db);
    res.json({ playlists });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] GET /sources/:sourceId/search error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/sources/:sourceId/preview
// Fetches playlist metadata (name, track count) from a URL/ID without
// running the full match. Used by PlaylistStep to confirm before proceeding.
// ---------------------------------------------------------------------------
router.post('/sources/:sourceId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId } = req.params;
    const { urlOrId } = req.body as { urlOrId: string };

    if (!urlOrId) {
      return res.status(400).json({ error: 'urlOrId is required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);

    const adapterId = sourceId.startsWith('plex') ? 'plex' : sourceId;
    const adapter = adapterRegistry.getSource(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Source adapter '${sourceId}' not found` });
    }

    // fetchTracks returns the full track list — we only need the playlist metadata
    const { playlist } = await adapter.fetchTracks(urlOrId, userId, db);
    res.json({ playlist });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] POST /sources/:sourceId/preview error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/sources/:sourceId/tracks
// Fetches the full track list for a playlist (for preview purposes).
// Returns playlist metadata + first 50 tracks.
// ---------------------------------------------------------------------------
router.post('/sources/:sourceId/tracks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId } = req.params;
    const { urlOrId } = req.body as { urlOrId: string };

    if (!urlOrId) {
      return res.status(400).json({ error: 'urlOrId is required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);

    const adapterId = sourceId.startsWith('plex') ? 'plex' : sourceId;
    const adapter = adapterRegistry.getSource(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Source adapter '${sourceId}' not found` });
    }

    const { playlist, tracks } = await adapter.fetchTracks(urlOrId, userId, db);
    res.json({ playlist, tracks: tracks.slice(0, 50), total: tracks.length });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] POST /sources/:sourceId/tracks error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/search
// Resolves the target adapter and searches its catalog.
// ---------------------------------------------------------------------------
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, targetId, allowLive, allowStatic } = req.body as {
      query: string;
      targetId: string;
      targetConfig?: TargetConfig;
      allowLive?: boolean;
      allowStatic?: boolean;
    };

    if (!query || !targetId) {
      return res.status(400).json({ error: 'query and targetId are required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);

    const adapterId = targetId.startsWith('plex') ? 'plex' : targetId;
    const adapter = adapterRegistry.getTarget(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Target adapter '${targetId}' not found` });
    }

    const results = await adapter.searchCatalog(query, userId, db, allowLive, allowStatic);
    res.json({ results });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] POST /search error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/execute
// Creates the playlist on the target service using reviewed tracks.
// Updates the job record to status=complete.
// ---------------------------------------------------------------------------
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, reviewedTracks, targetId, targetConfig, playlistName } = req.body as {
      jobId: number;
      reviewedTracks: MatchResult[];
      targetId: string;
      targetConfig: TargetConfig;
      playlistName: string;
    };

    if (!reviewedTracks || !targetId || !playlistName) {
      return res.status(400).json({ error: 'reviewedTracks, targetId, and playlistName are required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);
    const rawDb = db;

    const adapterId = targetId.startsWith('plex') ? 'plex' : targetId;
    const adapter = adapterRegistry.getTarget(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Target adapter '${targetId}' not found` });
    }

    const result = await adapter.createPlaylist(playlistName, reviewedTracks, targetConfig ?? {}, userId, db);

    // Update job record if jobId provided
    if (jobId) {
      const matchedCount = reviewedTracks.filter(t => t.matched && !t.skipped).length;
      const unmatchedCount = reviewedTracks.filter(t => !t.matched && !t.skipped).length;
      const skippedCount = reviewedTracks.filter(t => t.skipped).length;
      const unmatchedTracks = reviewedTracks
        .filter(t => !t.matched && !t.skipped)
        .map(t => ({ title: t.sourceTrack.title, artist: t.sourceTrack.artist }));

      rawDb.prepare(`
        UPDATE cross_import_jobs SET
          status = 'complete',
          target_playlist_name = ?,
          matched_count = ?,
          unmatched_count = ?,
          skipped_count = ?,
          total_count = ?,
          unmatched_tracks = ?,
          completed_at = ?
        WHERE id = ? AND user_id = ?
      `).run(
        result.name,
        matchedCount,
        unmatchedCount,
        skippedCount,
        reviewedTracks.length,
        JSON.stringify(unmatchedTracks),
        Date.now(),
        jobId,
        userId
      );
    }

    res.json(result);
    return;
  } catch (err: any) {
    logger.error('[CrossImport] POST /execute error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/history
// Returns the authenticated user's import job history (newest first).
// ---------------------------------------------------------------------------
router.get('/history', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const rawDb = getRawDb(req);

    const jobs = rawDb.prepare(`
      SELECT * FROM cross_import_jobs
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    // Parse unmatched_tracks JSON for each job
    const parsed = jobs.map((job: any) => ({
      ...job,
      unmatched_tracks: job.unmatched_tracks ? JSON.parse(job.unmatched_tracks) : [],
    }));

    res.json({ jobs: parsed });
  } catch (err: any) {
    logger.error('[CrossImport] GET /history error', { error: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/match/progress/:sessionId
// SSE endpoint — streams matching progress events to the client.
// ---------------------------------------------------------------------------
router.get('/match/progress/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  logger.info('[CrossImport] SSE connection request received', { sessionId, url: req.url });

  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  if (typeof (res as any).flush === 'function') (res as any).flush();
  logger.info('[CrossImport] SSE connection established', { sessionId });

  // Reuse the emitter pre-created by POST /match, or create a new one if connecting early
  const emitter = matchSessions.get(sessionId) ?? new EventEmitter();
  emitter.setMaxListeners(20);
  matchSessions.set(sessionId, emitter);

  // Replay any already-stored progress state (in case match ran before SSE connected)
  const existingState = matchProgressState.get(sessionId);

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
    const payload = { type: 'progress', ...data };
    matchProgressState.set(sessionId, payload);
    logger.info('[CrossImport] SSE sending progress event', { sessionId, payload });
    sendEvent(payload);
  });
  emitter.on('complete', (data) => {
    const payload = { type: 'complete', ...data };
    matchProgressState.set(sessionId, payload);
    sendEvent(payload);
    sseOpen = false;
    res.end();
  });
  emitter.on('error', (data) => {
    const payload = { type: 'error', ...data };
    matchProgressState.set(sessionId, payload);
    sendEvent(payload);
    sseOpen = false;
    res.end();
  });

  // Keep-alive comment every 15 seconds
  const keepAlive = setInterval(() => {
    if (!sseOpen) { clearInterval(keepAlive); return; }
    try {
      res.write(': keep-alive\n\n');
      if (typeof (res as any).flush === 'function') (res as any).flush();
    } catch {
      sseOpen = false;
      clearInterval(keepAlive);
    }
  }, 15_000);

  // If match already completed before SSE connected, replay the final state
  if (existingState && (existingState.type === 'complete' || existingState.type === 'error')) {
    sendEvent(existingState);
    sseOpen = false;
    clearInterval(keepAlive);
    res.end();
    return;
  }

  req.on('close', () => {
    sseOpen = false;
    clearInterval(keepAlive);
  });
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/match/status/:sessionId
// Polling endpoint — returns current matching progress state.
// ---------------------------------------------------------------------------
router.get('/match/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  // Log ALL keys in the Map for debugging
  const allKeys = Array.from(matchProgressState.keys());
  const allEntries = Array.from(matchProgressState.entries()).map(([key, value]) => ({
    key,
    type: value?.type,
    phase: value?.phase,
    current: value?.current,
    total: value?.total
  }));
  
  logger.info('[CrossImport] Polling request received', { 
    sessionId,
    allSessionIds: allKeys,
    allEntries,
    hasProgress: matchProgressState.has(sessionId),
    mapSize: matchProgressState.size
  });
  
  // Return stored progress state or 'waiting' if nothing yet
  const progress = matchProgressState.get(sessionId);
  
  logger.info('[CrossImport] Polling response', { 
    sessionId, 
    hasProgress: !!progress, 
    progressType: progress?.type,
    progressPhase: progress?.phase,
    progressCurrent: progress?.current,
    progressTotal: progress?.total,
    progressMessage: progress?.message,
    mapSize: matchProgressState.size
  });
  
  if (progress) {
    res.json(progress);
    // Clean up terminal states after client reads them
    if (progress.type === 'complete' || progress.type === 'error') {
      logger.info('[CrossImport] Cleaning up terminal state', { sessionId, type: progress.type });
      matchProgressState.delete(sessionId);
      const emitter = matchSessions.get(sessionId);
      if (emitter) {
        emitter.removeAllListeners();
        matchSessions.delete(sessionId);
      }
    }
  } else {
    logger.warn('[CrossImport] NO PROGRESS FOUND - returning waiting', { 
      sessionId,
      allKeys,
      mapSize: matchProgressState.size
    });
    res.json({ type: 'waiting' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/match
// Starts async matching; emits progress/complete/error on the SSE emitter.
// ---------------------------------------------------------------------------
router.post('/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId, playlistUrlOrId, targetId, targetConfig, sessionId, allowLive, allowStatic } = req.body as {
      sourceId: string;
      playlistUrlOrId: string;
      targetId: string;
      targetConfig?: TargetConfig;
      sessionId: string;
      allowLive?: boolean;
      allowStatic?: boolean;
    };

    if (!sourceId || !playlistUrlOrId || !targetId || !sessionId) {
      return res.status(400).json({ error: 'sourceId, playlistUrlOrId, targetId, and sessionId are required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);
    const rawDb = db;

    const srcAdapterId = sourceId.startsWith('plex') ? 'plex' : sourceId;
    const tgtAdapterId = targetId.startsWith('plex') ? 'plex' : targetId;

    const sourceAdapter = adapterRegistry.getSource(srcAdapterId);
    const targetAdapter = adapterRegistry.getTarget(tgtAdapterId);

    if (!sourceAdapter) return res.status(404).json({ error: `Source adapter '${sourceId}' not found` });
    if (!targetAdapter) return res.status(404).json({ error: `Target adapter '${targetId}' not found` });

    // Insert job record
    const now = Date.now();
    const jobResult = rawDb.prepare(`
      INSERT INTO cross_import_jobs
        (user_id, source_service, source_playlist_name, target_service, status, total_count, created_at)
      VALUES (?, ?, ?, ?, 'matching', 0, ?)
    `).run(userId, sourceId, playlistUrlOrId, targetId, now);
    const jobId = jobResult.lastInsertRowid as number;

    // Pre-create the emitter NOW so events aren't lost if SSE connects after setImmediate fires
    const preEmitter = new EventEmitter();
    preEmitter.setMaxListeners(20);
    matchSessions.set(sessionId, preEmitter);
    logger.info('[CrossImport] Pre-created emitter for session', { sessionId, hasEmitter: true });

    // IMPORTANT: Store initial "fetching" state BEFORE responding so polling has something to return immediately
    const fetchingState = { type: 'progress', phase: 'fetching', current: 0, total: 0 };
    logger.info('[CrossImport] BEFORE storing initial fetching state', { 
      sessionId,
      mapSizeBefore: matchProgressState.size,
      hasSessionBefore: matchProgressState.has(sessionId),
      allKeysBefore: Array.from(matchProgressState.keys())
    });
    matchProgressState.set(sessionId, fetchingState);
    logger.info('[CrossImport] AFTER storing initial fetching state', { 
      sessionId,
      mapSizeAfter: matchProgressState.size,
      hasSessionAfter: matchProgressState.has(sessionId),
      storedData: matchProgressState.get(sessionId),
      allKeysAfter: Array.from(matchProgressState.keys())
    });

    // Respond immediately so the client can start listening on the SSE stream
    res.json({ jobId, sessionId });

    // Run matching asynchronously
    setImmediate(async () => {
      const emitter = matchSessions.get(sessionId);
      const isCancelled = () => cancelledSessions.has(sessionId);

      try {
        logger.info('[CrossImport] Async matching started', { sessionId, jobId, sourceId, targetId });
        
        // Phase 1: fetch tracks
        const fetchingProgress = { type: 'progress', phase: 'fetching', current: 0, total: 0 };
        matchProgressState.set(sessionId, fetchingProgress);
        logger.info('[CrossImport] Stored fetching progress', { sessionId, hasEmitter: !!emitter });
        emitter?.emit('progress', fetchingProgress);

        const { playlist, tracks } = await sourceAdapter.fetchTracks(playlistUrlOrId, userId, db);

        // Update job with real playlist name and total
        rawDb.prepare(`
          UPDATE cross_import_jobs SET source_playlist_name = ?, total_count = ? WHERE id = ?
        `).run(playlist.name, tracks.length, jobId);

        // Emit progress with playlist name and total
        const fetchedProgress = { 
          type: 'progress', 
          phase: 'fetching', 
          current: tracks.length, 
          total: tracks.length,
          playlistName: playlist.name,
        };
        matchProgressState.set(sessionId, fetchedProgress);
        emitter?.emit('progress', fetchedProgress);

        if (isCancelled()) {
          rawDb.prepare('DELETE FROM cross_import_jobs WHERE id = ?').run(jobId);
          emitter?.emit('error', { message: 'Cancelled' });
          return;
        }

        // Phase 2: match tracks
        const progressEmitter = new EventEmitter();
        progressEmitter.on('progress', (data: any) => {
          logger.info('[CrossImport] Progress event received from adapter', { 
            sessionId, 
            current: data.current, 
            total: data.total, 
            currentTrackName: data.currentTrackName 
          });
          const progressData = {
            type: 'progress',
            phase: 'matching',
            current: data.current,
            total: data.total,
            playlistName: playlist.name,
            currentTrackName: data.currentTrackName,
          };
          // Store in state FIRST, then emit
          logger.info('[CrossImport] BEFORE storing progress', { 
            sessionId, 
            mapSizeBefore: matchProgressState.size,
            hasSessionBefore: matchProgressState.has(sessionId)
          });
          matchProgressState.set(sessionId, progressData);
          logger.info('[CrossImport] AFTER storing progress', { 
            sessionId, 
            mapSizeAfter: matchProgressState.size,
            hasSessionAfter: matchProgressState.has(sessionId),
            storedData: matchProgressState.get(sessionId),
            allKeys: Array.from(matchProgressState.keys())
          });
          emitter?.emit('progress', progressData);
        });

        const results = await targetAdapter.matchTracks(
          tracks,
          targetConfig ?? {},
          userId,
          db,
          progressEmitter,
          isCancelled,
          allowLive,
          allowStatic
        );

        if (isCancelled()) {
          rawDb.prepare('DELETE FROM cross_import_jobs WHERE id = ?').run(jobId);
          emitter?.emit('error', { message: 'Cancelled' });
          return;
        }

        // Update job status to 'review'
        rawDb.prepare(`UPDATE cross_import_jobs SET status = 'review' WHERE id = ?`).run(jobId);

        const completeData = { type: 'complete', results, jobId };
        matchProgressState.set(sessionId, completeData);
        emitter?.emit('complete', completeData);
      } catch (err: any) {
        logger.error('[CrossImport] Async matching error', { error: err.message, stack: err.stack, jobId, sessionId, hasEmitter: !!emitter });
        try {
          rawDb.prepare(`UPDATE cross_import_jobs SET status = 'failed' WHERE id = ?`).run(jobId);
        } catch { /* ignore */ }
        
        // Send detailed error message to UI
        const errorMessage = err.message || 'Matching failed';
        const errorData = { 
          type: 'error',
          message: errorMessage,
          detail: err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : undefined
        };
        matchProgressState.set(sessionId, errorData);
        logger.info('[CrossImport] Stored error in matchProgressState', { sessionId, errorData });
        emitter?.emit('error', errorData);
        logger.info('[CrossImport] Emitted error event', { sessionId, hasEmitter: !!emitter });
      } finally {
        cancelledSessions.delete(sessionId);
        // Don't delete matchSessions here - let polling endpoint clean it up after client reads terminal state
        logger.info('[CrossImport] Async matching finished', { sessionId, jobId });
      }
    });

    return;
  } catch (err: any) {
    logger.error('[CrossImport] POST /match error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/match/cancel/:sessionId
// Sets the cancellation flag; the async matcher checks isCancelled() between
// batches and stops. Deletes the job record on cancellation.
// ---------------------------------------------------------------------------
router.post('/match/cancel/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  cancelledSessions.add(sessionId);

  const emitter = matchSessions.get(sessionId);
  if (emitter) {
    // Use setImmediate to avoid "Unhandled error" from emit
    setImmediate(() => {
      try {
        emitter.emit('error', { message: 'Cancelled' });
      } catch (err) {
        // Ignore - emitter may have been removed
      }
    });
  }

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/oauth/:service
// Returns the OAuth authorization URL for the given target or source service.
// ---------------------------------------------------------------------------
router.get('/oauth/:service', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { service } = req.params;
    const userId = req.session.userId!;
    const db = getRawDb(req);

    // Form-based source-only services (no target adapter, but need credential storage)
    const FORM_ONLY_SOURCES = ['amazon'];
    if (FORM_ONLY_SOURCES.includes(service)) {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/cross-import/oauth/${service}/callback`;
      const authUrl = `${redirectUri.replace('/callback', '/form')}?state=${userId}`;
      res.json({ authUrl });
      return;
    }

    const adapter = adapterRegistry.getTarget(service);
    if (!adapter) {
      return res.status(404).json({ error: `Target adapter '${service}' not found` });
    }
    if (!adapter.getOAuthUrl) {
      return res.status(400).json({ error: `Service '${service}' does not support OAuth` });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/cross-import/oauth/${service}/callback`;
    const authUrl = await adapter.getOAuthUrl(userId, db, redirectUri);

    res.json({ authUrl });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] GET /oauth/:service error', { error: err.message, service: req.params.service });
    return res.status(400).json({ error: err.message || 'Failed to get OAuth URL' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/oauth/:service/form
// Serves a simple HTML credential form for services that use username/password,
// ARL tokens, or browser cookies instead of standard OAuth.
// ---------------------------------------------------------------------------
router.get('/oauth/:service/form', (req: Request, res: Response) => {
  const { service } = req.params;
  const { state } = req.query as { state?: string };

  const callbackUrl = `/api/cross-import/oauth/${service}/callback`;

  const serviceLabels: Record<string, { name: string; fields: Array<{ id: string; label: string; type: string; placeholder: string; help?: string }> }> = {
    amazon: {
      name: 'Amazon Music',
      fields: [{
        id: 'cookie',
        label: 'Browser Cookie',
        type: 'textarea',
        placeholder: 'Paste your Amazon Music cookies here',
        help: 'Open music.amazon.com, open DevTools (F12) → Network → any request → Request Headers → copy the full "cookie" header value.',
      }],
    },
    deezer: {
      name: 'Deezer',
      fields: [{
        id: 'arl',
        label: 'ARL Token',
        type: 'text',
        placeholder: 'Paste your ARL token here',
        help: 'Open deezer.com in your browser, open DevTools (F12) → Application → Cookies → find the "arl" cookie and copy its value.',
      }],
    },
    tidal: {
      name: 'Tidal',
      fields: [
        { id: 'username', label: 'Email', type: 'email', placeholder: 'your@email.com' },
        { id: 'password', label: 'Password', type: 'password', placeholder: 'Your Tidal password' },
      ],
    },
    qobuz: {
      name: 'Qobuz',
      fields: [
        { id: 'username', label: 'Email', type: 'email', placeholder: 'your@email.com' },
        { id: 'password', label: 'Password', type: 'password', placeholder: 'Your Qobuz password' },
      ],
    },
    listenbrainz: {
      name: 'ListenBrainz',
      fields: [{
        id: 'token',
        label: 'User Token',
        type: 'text',
        placeholder: 'Paste your ListenBrainz user token',
        help: 'Find your token at listenbrainz.org → Profile → User Token.',
      }],
    },
    'youtube-music': {
      name: 'YouTube Music',
      fields: [{
        id: 'cookie',
        label: 'Browser Cookie',
        type: 'textarea',
        placeholder: 'Paste your YouTube Music cookies here',
        help: 'Open music.youtube.com, open DevTools (F12) → Network → any request → Request Headers → copy the full "cookie" header value.',
      }],
    },
    youtube: {
      name: 'YouTube',
      fields: [{
        id: 'cookie',
        label: 'Browser Cookie',
        type: 'textarea',
        placeholder: 'Paste your YouTube cookies here',
        help: '1. Open www.youtube.com in your browser and make sure you\'re logged in. 2. Press F12 to open DevTools. 3. Click the "Network" tab. 4. Refresh the page (F5). 5. Click any request in the list. 6. In the "Headers" section on the right, scroll down to "Request Headers". 7. Find the "cookie:" line and copy EVERYTHING after "cookie: " (it\'s very long, that\'s normal). 8. Paste it here.',
      }],
    },
    apple: {
      name: 'Apple Music',
      fields: [{
        id: 'token',
        label: 'Music User Token',
        type: 'text',
        placeholder: 'Paste your Music-User-Token here',
        help: 'Open music.apple.com, open DevTools (F12) → Network → any request → Request Headers → copy the "Music-User-Token" header value.',
      }],
    },
  };

  const config = serviceLabels[service];
  if (!config) {
    return res.status(404).send('Unknown service');
  }

  const fieldsHtml = config.fields.map(f => {
    const inputEl = f.type === 'textarea'
      ? `<textarea id="${f.id}" name="${f.id}" placeholder="${f.placeholder}" rows="4" required style="width:100%;padding:10px;border:1px solid #444;border-radius:6px;background:#1a1a1a;color:#fff;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>`
      : `<input id="${f.id}" name="${f.id}" type="${f.type}" placeholder="${f.placeholder}" required style="width:100%;padding:10px;border:1px solid #444;border-radius:6px;background:#1a1a1a;color:#fff;font-size:14px;box-sizing:border-box;">`;
    const helpHtml = f.help ? `<p style="margin:6px 0 0;font-size:12px;color:#888;line-height:1.5;">${f.help}</p>` : '';
    return `<div style="margin-bottom:16px;"><label for="${f.id}" style="display:block;margin-bottom:6px;font-size:14px;color:#ccc;">${f.label}</label>${inputEl}${helpHtml}</div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect ${config.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 32px; width: 100%; max-width: 440px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
    .error { background: #3d1515; border: 1px solid #7a2020; border-radius: 6px; padding: 10px 14px; font-size: 14px; color: #ff6b6b; margin-bottom: 16px; display: none; }
    .btn { width: 100%; padding: 12px; background: #6c63ff; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .btn:hover { background: #5a52d5; }
    .btn:disabled { background: #444; cursor: not-allowed; }
    .spinner { display: none; text-align: center; margin-top: 12px; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect ${config.name}</h1>
    <p class="subtitle">Enter your ${config.name} credentials to connect your account.</p>
    <div class="error" id="error"></div>
    <form id="form">
      ${fieldsHtml}
      <button type="submit" class="btn" id="submit">Connect</button>
    </form>
    <div class="spinner" id="spinner">Connecting…</div>
  </div>
  <script>
    const form = document.getElementById('form');
    const errorEl = document.getElementById('error');
    const submitBtn = document.getElementById('submit');
    const spinner = document.getElementById('spinner');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      spinner.style.display = 'block';

      const fields = ${JSON.stringify(config.fields)};
      let code = '';

      if (fields.length === 1) {
        // Single field: use value directly as code
        code = document.getElementById(fields[0].id).value.trim();
      } else {
        // Multiple fields (username + password): base64 encode as "user:pass"
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        code = btoa(username + ':' + password);
      }

      // POST the credentials to avoid URL length limits (cookies can be huge)
      try {
        const resp = await fetch('${callbackUrl}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, state: '${state || ''}' }),
        });
        const result = await resp.json();
        if (result.status === 'connected') {
          spinner.textContent = 'Connected!';
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'cross_import_oauth', status: 'connected', service: '${service}' }, '*');
            }
          } catch(e) {}
          setTimeout(() => window.close(), 800);
        } else {
          throw new Error(result.detail || result.error || 'Connection failed');
        }
      } catch (err) {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        errorEl.textContent = err.message || 'Connection failed. Please try again.';
        errorEl.style.display = 'block';
        try {
          if (window.opener) {
            window.opener.postMessage({ type: 'cross_import_oauth', status: 'error', service: '${service}', detail: err.message }, '*');
          }
        } catch(e) {}
      }
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/oauth/:service/callback
// Handles the OAuth callback: exchanges code for tokens and redirects to UI.
// ---------------------------------------------------------------------------
router.get('/oauth/:service/callback', async (req: Request, res: Response, _next: NextFunction) => {
  const { service } = req.params;

  const closePopup = (status: 'connected' | 'error', detail: string) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Connecting…</title></head><body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'cross_import_oauth', status: '${status}', service: '${service}', detail: decodeURIComponent('${encodeURIComponent(detail)}') }, '*');
    }
  } catch(e) {}
  window.close();
<\/script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#ccc;">${status === 'connected' ? 'Connected! You can close this window.' : 'Error: ' + detail}</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  };

  try {
    const { code, state, error } = req.query;

    if (error) return closePopup('error', String(error));
    if (!code || typeof code !== 'string') return closePopup('error', 'no_code');

    const userId = state ? parseInt(state as string, 10) : null;
    if (!userId || isNaN(userId)) return closePopup('error', 'invalid_state');

    const db = getRawDb(req);

    // Handle source-only form-based services (store cookie directly)
    const FORM_ONLY_SOURCES: Record<string, string> = { amazon: 'amazon' };
    if (FORM_ONLY_SOURCES[service]) {
      const cookie = code.trim();
      if (!cookie) return closePopup('error', 'no_credentials');
      const { encrypt } = await import('../utils/encryption');
      const secret = process.env.SESSION_SECRET || 'default-secret-change-in-production';
      const now = Date.now();
      db.prepare(`
        INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
      `).run(userId, service, encrypt(cookie, secret), now, now);
      return closePopup('connected', service);
    }

    const adapter = adapterRegistry.getTarget(service);
    if (!adapter?.handleOAuthCallback) return closePopup('error', 'unknown_service');

    const redirectUri = `${req.protocol}://${req.get('host')}/api/cross-import/oauth/${service}/callback`;

    await adapter.handleOAuthCallback(code, userId, db, redirectUri);

    return closePopup('connected', service);
  } catch (err: any) {
    logger.error('[CrossImport] GET /oauth/:service/callback error', { error: err.message, service });
    return closePopup('error', err.message || 'oauth_failed');
  }
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/oauth/:service/callback
// Handles form-based credential submission via POST (avoids URL length limits).
// Returns JSON instead of HTML since the form uses fetch().
// ---------------------------------------------------------------------------
router.post('/oauth/:service/callback', async (req: Request, res: Response) => {
  const { service } = req.params;
  try {
    const { code, state } = req.body as { code?: string; state?: string };

    if (!code || typeof code !== 'string') return res.json({ status: 'error', detail: 'No credentials provided' });

    const userId = state ? parseInt(state, 10) : req.session.userId;
    if (!userId || isNaN(userId)) return res.json({ status: 'error', detail: 'Invalid session' });

    const db = getRawDb(req);
    const adapter = adapterRegistry.getTarget(service);

    if (adapter?.handleOAuthCallback) {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/cross-import/oauth/${service}/callback`;
      await adapter.handleOAuthCallback(code, userId, db, redirectUri);
    } else {
      // Fallback: store directly as encrypted cookie
      const { encrypt } = await import('../utils/encryption');
      const secret = process.env.SESSION_SECRET || 'default-secret-change-in-production';
      const now = Date.now();
      db.prepare(`
        INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
      `).run(userId, service, encrypt(code.trim(), secret), now, now);
    }

    logger.info('[CrossImport] POST callback stored credentials', { service, userId });
    return res.json({ status: 'connected' });
  } catch (err: any) {
    logger.error('[CrossImport] POST /oauth/:service/callback error', { error: err.message, service });
    return res.json({ status: 'error', detail: err.message || 'Connection failed' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/cross-import/oauth/:service
// Revokes and removes the stored OAuth connection for the given service.
// ---------------------------------------------------------------------------
router.delete('/oauth/:service', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service } = req.params;
    const userId = req.session.userId!;
    const db = getRawDb(req);

    const adapter = adapterRegistry.getTarget(service);
    if (!adapter) {
      return res.status(404).json({ error: `Target adapter '${service}' not found` });
    }
    if (!adapter.revokeConnection) {
      return res.status(400).json({ error: `Service '${service}' does not support OAuth revocation` });
    }

    await adapter.revokeConnection(userId, db);

    res.json({ success: true });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] DELETE /oauth/:service error', { error: err.message });
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/oauth/youtube/browser-login
// Opens a visible browser window for the user to log in to YouTube.
// Returns a sessionId the frontend polls for completion.
// ---------------------------------------------------------------------------
router.get('/oauth/youtube/browser-login', async (req: Request, res: Response) => {
  const { state } = req.query as { state?: string };
  const userId = state ? parseInt(state, 10) : req.session.userId!;
  const sessionId = `yt-login-${userId}-${Date.now()}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Connect YouTube</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 32px; width: 100%; max-width: 440px; text-align: center; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    p { color: #888; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .spinner { width: 36px; height: 36px; border: 3px solid #333; border-top-color: #6c63ff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { font-size: 14px; color: #aaa; }
    .error { color: #ff6b6b; }
    .success { color: #4caf50; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect YouTube</h1>
    <p>A browser window has opened for you to sign in to your Google account. Once you're signed in, this window will close automatically.</p>
    <div class="spinner" id="spinner"></div>
    <div class="status" id="status">Waiting for login…</div>
  </div>
  <script>
    const sessionId = ${JSON.stringify(sessionId)};
    const userId = ${JSON.stringify(String(userId))};

    // Start the browser login session
    fetch('/api/cross-import/oauth/youtube/browser-login/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, userId }),
    });

    // Poll for completion
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/cross-import/oauth/youtube/browser-login/status?sessionId=' + sessionId, { credentials: 'include' });
        const data = await res.json();

        if (data.status === 'done') {
          clearInterval(poll);
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status').className = 'status success';
          document.getElementById('status').textContent = 'Connected! Closing…';

          // Store the cookie via POST (cookies are too large for GET query params)
          await fetch('/api/cross-import/oauth/youtube/browser-login/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ cookie: data.cookie, userId }),
          });

          setTimeout(() => {
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'cross_import_oauth', status: 'connected', service: 'youtube' }, '*');
              }
            } catch(e) {}
            window.close();
          }, 1000);
        } else if (data.status === 'error') {
          clearInterval(poll);
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status').className = 'status error';
          document.getElementById('status').textContent = 'Error: ' + (data.error || 'Login failed');
          setTimeout(() => {
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'cross_import_oauth', status: 'error', service: 'youtube', detail: data.error || 'Login failed' }, '*');
              }
            } catch(e) {}
            window.close();
          }, 3000);
        }
      } catch (e) { /* ignore network errors */ }
    }, 1500);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/oauth/youtube/browser-login/start
// Starts the Puppeteer browser login session.
// ---------------------------------------------------------------------------
router.post('/oauth/youtube/browser-login/start', async (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    await startYouTubeLoginSession(sessionId);
    res.json({ started: true });
  } catch (err: any) {
    logger.error('[CrossImport] YouTube browser login start error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
  return;
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/oauth/youtube/browser-login/status
// Returns the current status of a browser login session.
// ---------------------------------------------------------------------------
router.get('/oauth/youtube/browser-login/status', (req: Request, res: Response) => {
  const { sessionId } = req.query as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const status = getLoginSessionStatus(sessionId);
  res.json(status);
  return;
});

// ---------------------------------------------------------------------------
// POST /api/cross-import/oauth/youtube/browser-login/save
// Stores the captured YouTube cookie from the browser login session.
// Uses POST to avoid URL length limits with large cookies.
// ---------------------------------------------------------------------------
router.post('/oauth/youtube/browser-login/save', async (req: Request, res: Response) => {
  try {
    const { cookie, userId: userIdStr } = req.body as { cookie?: string; userId?: string };
    const userId = userIdStr ? parseInt(userIdStr, 10) : req.session.userId;
    if (!userId || !cookie) { res.status(400).json({ error: 'cookie and userId required' }); return; }

    const db = getRawDb(req);
    const { encrypt } = await import('../utils/encryption');
    const secret = process.env.SESSION_SECRET || 'default-secret-change-in-production';
    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'youtube', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(cookie.trim(), secret), now, now);

    logger.info('[CrossImport] YouTube cookie stored via browser login', { userId });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[CrossImport] YouTube browser-login save error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cross-import/sources/:sourceId/tracks?urlOrId=...
// Fetches the track list for a playlist — used by the playlist preview modal.
// ---------------------------------------------------------------------------
router.get('/sources/:sourceId/tracks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId } = req.params;
    const { urlOrId } = req.query as { urlOrId?: string };

    if (!urlOrId) {
      return res.status(400).json({ error: 'urlOrId is required' });
    }

    const userId = req.session.userId!;
    const db = getRawDb(req);

    const adapterId = sourceId.startsWith('plex') ? 'plex' : sourceId;
    const adapter = adapterRegistry.getSource(adapterId);

    if (!adapter) {
      return res.status(404).json({ error: `Source adapter '${sourceId}' not found` });
    }

    const { playlist, tracks } = await adapter.fetchTracks(urlOrId, userId, db);
    res.json({ playlist, tracks });
    return;
  } catch (err: any) {
    logger.error('[CrossImport] GET /sources/:sourceId/tracks error', { error: err.message });
    return next(err);
  }
});

export default router;

