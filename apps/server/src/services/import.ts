/**
 * Import Service
 * 
 * Handles playlist import workflow with cache-first logic:
 * 1. Check cached_playlists table before scraping
 * 2. Use cached data if fresh (< 24 hours)
 * 3. Scrape if cache miss or stale
 * 4. Store scraped data in cache
 * 5. Match tracks using matching service
 * 6. Store unmatched tracks in missing_tracks table
 */

import { DatabaseService } from '../database';
import {
  scrapeDeezerPlaylist,
  scrapeSpotifyPlaylist,
  scrapeAppleMusicPlaylist,
  scrapeTidalPlaylist,
  scrapeYouTubeMusicPlaylist,
  scrapeAmazonMusicPlaylist,
  scrapeQobuzPlaylist,
  getListenBrainzPlaylists,
  parseM3UFile,
  scrapeAriaPlaylist,
  ExternalPlaylist,
} from './scrapers';
import { matchPlaylist, MatchedTrack } from './matching';
import { logger } from '../utils/logger';
import { logImportDebug } from '../utils/import-debug-logger';
import { EventEmitter } from 'events';
import { debugLog } from '../utils/debug-logger';

const CACHE_MAX_AGE_HOURS = parseInt(process.env.CACHE_MAX_AGE_HOURS || '24', 10);

export interface ImportResult {
  playlistId: string;
  playlistName: string;
  source: string;
  matched: MatchedTrack[];
  unmatched: MatchedTrack[];
  matchedCount: number;
  totalCount: number;
  usedCache: boolean;
  coverUrl?: string;
}

export interface ImportOptions {
  userId: number;
  serverUrl: string;
  plexToken: string;
  libraryId?: string;
}

/**
 * Import a playlist from an external source
 */
export async function importPlaylist(
  source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz' | 'file' | 'aria',
  sourceIdentifier: string,
  options: ImportOptions,
  db: DatabaseService,
  progressEmitter?: EventEmitter,
  sessionId?: string,
  cancelledSessions?: Set<string>
): Promise<ImportResult> {
  const importId = `${source}-${Date.now()}`;
  try {
    debugLog(`[Import ${importId}] ========== IMPORT STARTED ==========`);
    debugLog(`[Import ${importId}] Source:`, source);
    debugLog(`[Import ${importId}] Identifier:`, sourceIdentifier);
    debugLog(`[Import ${importId}] Has progressEmitter:`, !!progressEmitter);
    logger.info(`[Import ${importId}] Starting import from ${source}: ${sourceIdentifier}`);
  
  // Step 1: Check cache first
  debugLog(`[Import ${importId}] Checking cache...`);
  const cached = db.getCachedPlaylist(source, sourceIdentifier);
  debugLog(`[Import ${importId}] Cache result:`, cached ? 'found' : 'not found');
  
  const now = Math.floor(Date.now() / 1000);
  const isCacheFresh = cached && (now - cached.scraped_at) < (CACHE_MAX_AGE_HOURS * 3600);
  debugLog(`[Import ${importId}] Cache fresh:`, isCacheFresh);
  
  let externalPlaylist: ExternalPlaylist;
  let usedCache = false;
  
  if (isCacheFresh && cached) {
    // Step 2: Use cached data if fresh
    debugLog('[Import] Using cached data - STEP 1');
    
    debugLog('[Import] Using cached data - STEP 2 - about to call logger.info');
    logger.info(`[Import] Using fresh cache for ${source}:${sourceIdentifier}`);
    debugLog('[Import] Using cached data - STEP 3 - logger.info complete');
    
    debugLog('[Import] Using cached data - STEP 4 - creating externalPlaylist');
    externalPlaylist = {
      id: cached.source_id,
      name: cached.name,
      description: cached.description || '',
      source: cached.source,
      tracks: cached.tracks,
      coverUrl: cached.cover_url, // Use cached cover URL
    };
    debugLog('[Import] Using cached data - STEP 5 - externalPlaylist created');
    debugLog('[Import] Cached cover URL:', cached.cover_url || 'NONE');
    usedCache = true;
    debugLog('[Import] Using cached data - STEP 6 - usedCache set to true');
    
    debugLog('[Import] Using cached data - STEP 7 - COMPLETE');
  } else {
    // Step 3: Scrape if cache miss or stale
    debugLog('[Import] Cache miss or stale, will scrape');
    logger.info(`[Import] Cache ${cached ? 'stale' : 'miss'}, scraping ${source}:${sourceIdentifier}`);
    
    // Emit initial scraping progress
    if (progressEmitter) {
      progressEmitter.emit('progress', {
        type: 'progress',
        phase: 'scraping',
        current: 0,
        total: 0,
        currentTrackName: 'Fetching playlist from ' + source + '...',
      });
    }
    
    debugLog('[Import] ========== STARTING SCRAPE ==========');
    debugLog('[Import] About to call scrapePlaylist function');
    
    try {
      debugLog('[Import] Calling scrapePlaylist...');
      externalPlaylist = await scrapePlaylist(source, sourceIdentifier, progressEmitter, options.userId, db);
      debugLog('[Import] scrapePlaylist returned successfully');
      
      logImportDebug('=== SCRAPING COMPLETE ===', {
        playlistName: externalPlaylist.name,
        trackCount: externalPlaylist.tracks.length,
        coverUrl: externalPlaylist.coverUrl,
        hasCoverUrl: !!externalPlaylist.coverUrl
      });
      
      debugLog('[Import] ========== SCRAPING COMPLETE ==========');
      debugLog('[Import] Playlist:', externalPlaylist.name);
      debugLog('[Import] Tracks:', externalPlaylist.tracks.length);
      debugLog('[Import] Cover URL:', externalPlaylist.coverUrl || 'NONE');
      debugLog('[Import] =======================================');
      
      logger.info(`[Import] Scraping complete. Playlist: ${externalPlaylist.name}, Tracks: ${externalPlaylist.tracks.length}, Cover: ${externalPlaylist.coverUrl || 'none'}`);
      
      // Emit progress with cover URL and playlist name after scraping completes
      if (progressEmitter) {
        const scrapingCompleteEvent = {
          type: 'progress',
          phase: 'scraping',
          current: externalPlaylist.tracks.length,
          total: externalPlaylist.tracks.length,
          currentTrackName: `Found ${externalPlaylist.tracks.length} tracks`,
          coverUrl: externalPlaylist.coverUrl,
          playlistName: externalPlaylist.name
        };
        
        debugLog('[Import] ========== EMITTING SCRAPING COMPLETE EVENT ==========');
        debugLog('[Import] Event data:', JSON.stringify(scrapingCompleteEvent, null, 2));
        debugLog('[Import] =========================================================');
        
        logImportDebug('=== EMITTING SCRAPING COMPLETE EVENT ===', scrapingCompleteEvent);
        
        logger.info(`[Import] Emitting scraping complete event: ${JSON.stringify(scrapingCompleteEvent)}`);
        progressEmitter.emit('progress', scrapingCompleteEvent);
        
        // Wait a moment to ensure the frontend receives this update before matching starts
        debugLog('[Import] ========== WAITING 1.5 SECONDS ==========');
        await new Promise(resolve => setTimeout(resolve, 1500));
        debugLog('[Import] ========== WAIT COMPLETE ==========');
        logger.info(`[Import] Starting matching phase...`);
      }
      
      // Step 4: Store scraped data in cache
      debugLog('[Import] ========== SAVING TO CACHE ==========');
      debugLog('[Import] Source:', source);
      debugLog('[Import] Identifier:', sourceIdentifier);
      debugLog('[Import] Playlist name:', externalPlaylist.name);
      debugLog('[Import] Track count:', externalPlaylist.tracks.length);
      
      try {
        db.saveCachedPlaylist(
          source,
          sourceIdentifier,
          externalPlaylist.name,
          externalPlaylist.description,
          externalPlaylist.tracks,
          externalPlaylist.coverUrl
        );
        debugLog('[Import] ========== CACHE SAVE COMPLETE ==========');
        logger.info(`[Import] Cached ${externalPlaylist.tracks.length} tracks for ${source}:${sourceIdentifier} with cover URL: ${externalPlaylist.coverUrl || 'none'}`);
      } catch (cacheError: any) {
        debugLog('[Import] ========== CACHE SAVE ERROR ==========');
        debugLog('[Import] Cache error:', cacheError.message);
        debugLog('[Import] Cache stack:', cacheError.stack);
        debugLog('[Import] ==========================================');
        logger.error(`[Import] Failed to save to cache`, { error: cacheError.message, stack: cacheError.stack });
        // Don't throw - continue with matching even if cache save fails
      }
    } catch (error: any) {
      debugLog('[Import] ========== SCRAPING ERROR ==========');
      debugLog('[Import] Error message:', error.message);
      debugLog('[Import] Error stack:', error.stack);
      debugLog('[Import] Error name:', error.name);
      debugLog('[Import] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      debugLog('[Import] ====================================');
      
      // If scraping fails and we have stale cache, use it as fallback
      if (cached) {
        logger.warn(`[Import] Scraping failed, using stale cache for ${source}:${sourceIdentifier}`, { 
          error: error.message,
          stack: error.stack 
        });
        externalPlaylist = {
          id: cached.source_id,
          name: cached.name,
          description: cached.description || '',
          source: cached.source,
          tracks: cached.tracks,
        };
        usedCache = true;
      } else {
        logger.error(`[Import] Scraping failed and no cache available for ${source}:${sourceIdentifier}`, { 
          error: error.message,
          stack: error.stack 
        });
        throw error;
      }
    }
  }
  
  // Step 5: Match tracks using matching service
  debugLog('[Import] ========== EXITED SCRAPING BLOCK ==========');
  debugLog('[Import] About to start matching phase');
  debugLog('[Import] ===============================================');
  
  debugLog('[Import] ========== STARTING MATCHING PHASE ==========');
  debugLog('[Import] Playlist name:', externalPlaylist.name);
  debugLog('[Import] Track count:', externalPlaylist.tracks.length);
  debugLog('[Import] Cover URL:', externalPlaylist.coverUrl || 'NONE');
  debugLog('[Import] ================================================');
  
  logger.info(`[Import] Matching ${externalPlaylist.tracks.length} tracks for user ${options.userId}`);
  
  try {
    debugLog('[Import] Getting user settings...');
    const settings = db.getUserSettings(options.userId);
    debugLog('[Import] User settings retrieved');
    logger.info(`[Import] Got user settings`, { 
      hasSettings: !!settings,
      hasMatchingSettings: !!settings.matching_settings,
      minMatchScore: settings.matching_settings?.minMatchScore 
    });
    
    debugLog('[Import] Calling matchPlaylist...');
    
    // Emit matching phase start event
    if (progressEmitter) {
      progressEmitter.emit('progress', {
        type: 'progress',
        phase: 'matching',
        current: 0,
        total: externalPlaylist.tracks.length,
        currentTrackName: 'Matching tracks with your Plex library...',
        coverUrl: externalPlaylist.coverUrl,
        playlistName: externalPlaylist.name
      });
    }
    
    const matchedTracks = await matchPlaylist(
      externalPlaylist.tracks,
      options.serverUrl,
      options.plexToken,
      options.libraryId,
      settings.matching_settings,
      progressEmitter,
      externalPlaylist.coverUrl,
      externalPlaylist.name,
      () => cancelledSessions?.has(sessionId || '') ?? false
    );
    
    const matched = matchedTracks.filter((t: MatchedTrack) => t.matched);
    const unmatched = matchedTracks.filter((t: MatchedTrack) => !t.matched);
    
    logger.info(`[Import] Matched ${matched.length}/${matchedTracks.length} tracks`);
    
    return {
      playlistId: externalPlaylist.id,
      playlistName: externalPlaylist.name,
      source: externalPlaylist.source,
      matched,
      unmatched,
      matchedCount: matched.length,
      totalCount: matchedTracks.length,
      usedCache,
      coverUrl: externalPlaylist.coverUrl,
    };
  } catch (error: any) {
    logger.error(`[Import] Error during matching`, { 
      error: error.message,
      stack: error.stack,
      trackCount: externalPlaylist.tracks.length 
    });
    throw error;
  }
  } catch (error: any) {
    debugLog('[Import] ========== FATAL ERROR ==========');
    debugLog('[Import] Error:', error.message);
    debugLog('[Import] Stack:', error.stack);
    debugLog('[Import] =====================================');
    logger.error(`[Import] Fatal error in importPlaylist`, { 
      error: error.message,
      stack: error.stack,
      source,
      sourceIdentifier
    });
    throw error;
  }
}

/**
 * Store unmatched tracks in the missing_tracks table
 */
export function storeMissingTracks(
  userId: number,
  playlistId: number,
  tracks: MatchedTrack[],
  source: string,
  db: DatabaseService
): void {
  const unmatchedTracks = tracks
    .map((track, index) => ({
      track,
      index,
      // Find the last matched track before this one to get the after_track_key
      afterTrackKey: tracks
        .slice(0, index)
        .reverse()
        .find(t => t.matched)?.plexRatingKey,
    }))
    .filter(({ track }) => !track.matched)
    .map(({ track, index, afterTrackKey }) => ({
      title: track.title,
      artist: track.artist,
      album: track.album,
      position: index,
      after_track_key: afterTrackKey,
      source,
    }));
  
  if (unmatchedTracks.length > 0) {
    db.addMissingTracks(userId, playlistId, unmatchedTracks);
    logger.info(`[Import] Stored ${unmatchedTracks.length} missing tracks for playlist ${playlistId}`);
  }
}

/**
 * Scrape a playlist from an external source
 */
async function scrapePlaylist(
  source: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'youtube' | 'amazon' | 'qobuz' | 'listenbrainz' | 'file' | 'aria',
  sourceIdentifier: string,
  progressEmitter?: EventEmitter,
  userId?: number,
  db?: DatabaseService
): Promise<ExternalPlaylist> {
  debugLog('[scrapePlaylist] ========== FUNCTION CALLED ==========');
  debugLog('[scrapePlaylist] Source:', source);
  debugLog('[scrapePlaylist] Identifier:', sourceIdentifier);
  debugLog('[scrapePlaylist] =====================================');
  
  try {
    switch (source) {
      case 'spotify':
        debugLog('[scrapePlaylist] Calling scrapeSpotifyPlaylist...');
        // Pass userId and db for authenticated API access
        return await scrapeSpotifyPlaylist(sourceIdentifier, progressEmitter, userId, (db as any)?.db);
      
      case 'deezer':
        debugLog('[scrapePlaylist] Calling scrapeDeezerPlaylist...');
        // Extract playlist ID from URL if needed
        let deezerId = sourceIdentifier;
        if (sourceIdentifier.includes('deezer.com')) {
          const match = sourceIdentifier.match(/\/playlist\/(\d+)/);
          deezerId = match ? match[1] : sourceIdentifier;
        }
        debugLog('[scrapePlaylist] Deezer ID extraction', { originalUrl: sourceIdentifier, extractedId: deezerId });
        return await scrapeDeezerPlaylist(deezerId, progressEmitter);
      
      case 'apple':
        debugLog('[scrapePlaylist] Calling scrapeAppleMusicPlaylist...');
        const result = await scrapeAppleMusicPlaylist(sourceIdentifier, progressEmitter);
        debugLog('[scrapePlaylist] scrapeAppleMusicPlaylist returned:', JSON.stringify({ name: result.name, trackCount: result.tracks.length, coverUrl: result.coverUrl }));
        return result;
      
      case 'tidal':
        debugLog('[scrapePlaylist] Calling scrapeTidalPlaylist...');
        return await scrapeTidalPlaylist(sourceIdentifier, progressEmitter);
      
      case 'youtube':
        debugLog('[scrapePlaylist] Calling scrapeYouTubeMusicPlaylist...');
        return await scrapeYouTubeMusicPlaylist(sourceIdentifier, progressEmitter);
      
      case 'amazon':
        debugLog('[scrapePlaylist] Calling scrapeAmazonMusicPlaylist...');
        return await scrapeAmazonMusicPlaylist(sourceIdentifier, progressEmitter);
      
      case 'qobuz':
        debugLog('[scrapePlaylist] Calling scrapeQobuzPlaylist...');
        return await scrapeQobuzPlaylist(sourceIdentifier, progressEmitter);
      
      case 'aria':
        debugLog('[scrapePlaylist] Calling scrapeAriaPlaylist...');
        return await scrapeAriaPlaylist(sourceIdentifier, progressEmitter);
      
      case 'listenbrainz':
        debugLog('[scrapePlaylist] Calling getListenBrainzPlaylists...');
        // For ListenBrainz, sourceIdentifier is username
        const playlists = await getListenBrainzPlaylists(sourceIdentifier);
        if (playlists.length === 0) {
          throw new Error(`No playlists found for ListenBrainz user: ${sourceIdentifier}`);
        }
        // Return the first playlist (or implement selection logic)
        return playlists[0];
      
      case 'file':
        debugLog('[scrapePlaylist] Calling parseM3UFile...');
        // For file imports, sourceIdentifier is the file content
        // The filename should be passed separately in a real implementation
        return parseM3UFile(sourceIdentifier, 'imported-playlist.m3u');
      
      default:
        throw new Error(`Unsupported source: ${source}`);
    }
  } catch (error: any) {
    debugLog('[scrapePlaylist] ========== ERROR ==========');
    debugLog('[scrapePlaylist] Error:', error.message);
    debugLog('[scrapePlaylist] Stack:', error.stack);
    debugLog('[scrapePlaylist] ===========================');
    throw error;
  }
}

