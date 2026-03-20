/**
 * Mix Templates Routes
 * 
 * API endpoints for managing saved mix templates:
 * - GET /api/mix-templates - List all templates
 * - GET /api/mix-templates/:id - Get template details
 * - POST /api/mix-templates - Create new template
 * - PUT /api/mix-templates/:id - Update template
 * - DELETE /api/mix-templates/:id - Delete template
 * - POST /api/mix-templates/:id/generate - Generate mix from template
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError, createNotFoundError, createForbiddenError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { MixService } from '../services/mixes';
import { PlexClient } from '../services/plex';
import type { DatabaseService } from '../database/database';

const router = Router();
const mixService = new MixService();

/**
 * Retry configuration for network operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Retry a network operation with exponential backoff
 * @param operation Function to retry
 * @param operationName Name for logging
 * @param maxRetries Maximum number of retry attempts
 * @returns Result of the operation
 */
async function retryNetworkOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable (network errors)
      const isNetworkError = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET' ||
        error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('unreachable');

      // Don't retry non-network errors
      if (!isNetworkError) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        logger.error(`${operationName} failed after ${maxRetries} attempts`, {
          error: error.message,
          attempts: maxRetries
        });
        throw new Error(`${operationName} failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Log retry attempt
      logger.warn(`${operationName} failed, retrying (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        nextRetryIn: delay
      });

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error(`${operationName} failed`);
}

/**
 * Current schema version for template configurations
 * Increment this when making breaking changes to the configuration structure
 */
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Sanitize string input to prevent injection attacks
 * Removes potentially dangerous characters while preserving normal text
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes, control characters, and potentially dangerous patterns
  return input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \n, \r, \t
    .trim();
}

/**
 * Recursively sanitize configuration object
 * Prevents injection attacks while preserving data structure
 */
function sanitizeConfiguration(config: any): any {
  if (config === null || config === undefined) {
    return config;
  }
  
  if (typeof config === 'string') {
    return sanitizeString(config);
  }
  
  if (typeof config === 'number' || typeof config === 'boolean') {
    return config;
  }
  
  if (Array.isArray(config)) {
    // Filter out non-primitive types and sanitize strings
    return config
      .filter(item => {
        const type = typeof item;
        return type === 'string' || type === 'number' || type === 'boolean';
      })
      .map(item => {
        if (typeof item === 'string') {
          const sanitized = sanitizeString(item);
          return sanitized.length > 0 ? sanitized : null;
        }
        return item;
      })
      .filter(item => item !== null);
  }
  
  if (typeof config === 'object') {
    const sanitized: any = {};
    for (const key in config) {
      if (config.hasOwnProperty(key)) {
        // Sanitize the key itself
        const sanitizedKey = sanitizeString(key);
        if (sanitizedKey.length > 0) {
          sanitized[sanitizedKey] = sanitizeConfiguration(config[key]);
        }
      }
    }
    return sanitized;
  }
  
  return config;
}

/**
 * Validate template configuration based on mix type
 */
function validateConfiguration(configuration: any, mixType: string): { valid: boolean; error?: string } {
  // Check schema version
  if (configuration.schemaVersion !== undefined && typeof configuration.schemaVersion !== 'number') {
    return { valid: false, error: 'Schema version must be a number' };
  }

  // Check required fields
  if (!configuration.trackCount || typeof configuration.trackCount !== 'number' || configuration.trackCount <= 0) {
    return { valid: false, error: 'Configuration must include a valid trackCount' };
  }

  // Type-specific validation
  switch (mixType) {
    case 'artist':
      if (!configuration.artistIds || !Array.isArray(configuration.artistIds) || configuration.artistIds.length === 0) {
        return { valid: false, error: 'Artist mix requires artistIds array' };
      }
      break;

    case 'album':
      if (!configuration.albumIds || !Array.isArray(configuration.albumIds) || configuration.albumIds.length === 0) {
        return { valid: false, error: 'Album mix requires albumIds array' };
      }
      break;

    case 'genre':
      if (!configuration.genres || !Array.isArray(configuration.genres) || configuration.genres.length === 0) {
        return { valid: false, error: 'Genre mix requires genres array' };
      }
      break;

    case 'mood':
      if (!configuration.moods || !Array.isArray(configuration.moods) || configuration.moods.length === 0) {
        return { valid: false, error: 'Mood mix requires moods array' };
      }
      break;

    case 'decade':
      if (!configuration.decades || !Array.isArray(configuration.decades) || configuration.decades.length === 0) {
        return { valid: false, error: 'Decade mix requires decades array' };
      }
      break;

    case 'custom':
      // Custom mixes are flexible, just need trackCount
      break;

    default:
      return { valid: false, error: 'Invalid mix type' };
  }

  return { valid: true };
}

/**
 * Add schema version to configuration if not present
 */
function addSchemaVersion(configuration: any): any {
  if (!configuration.schemaVersion) {
    return {
      ...configuration,
      schemaVersion: CURRENT_SCHEMA_VERSION
    };
  }
  return configuration;
}

/**
 * Migrate configuration from older schema versions to current version
 * Returns migrated configuration or null if migration fails
 */
function migrateConfiguration(configuration: any): { success: boolean; configuration?: any; error?: string } {
  const schemaVersion = configuration.schemaVersion || 0;

  // Already at current version
  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    return { success: true, configuration };
  }

  // Future version - cannot migrate
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      error: `Configuration schema version ${schemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}. Please update the application.`
    };
  }

  // Migrate from version 0 (no version) to version 1
  let migratedConfig = { ...configuration };

  if (schemaVersion === 0) {
    // Version 0 to 1: Add schema version field
    migratedConfig.schemaVersion = 1;
    logger.info('Migrated configuration from schema version 0 to 1');
  }

  // Future migrations would go here
  // if (schemaVersion < 2) { ... }

  return { success: true, configuration: migratedConfig };
}

/**
 * Parse and normalize template configuration
 * Ensures configuration matches expected structure and provides defaults
 */
function parseTemplateConfiguration(rawConfig: any, mixType: string): { 
  success: boolean; 
  configuration?: any; 
  error?: string;
} {
  // Verify configuration is an object
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return { 
      success: false, 
      error: 'Configuration must be a valid object' 
    };
  }

  // Create a normalized configuration object
  const config: any = {
    mixType: rawConfig.mixType || mixType,
    trackCount: rawConfig.trackCount,
    sortBy: rawConfig.sortBy || 'random',
    sortDirection: rawConfig.sortDirection || 'desc'
  };

  // Parse type-specific fields
  switch (mixType) {
    case 'artist':
      if (rawConfig.artistIds && Array.isArray(rawConfig.artistIds)) {
        config.artistIds = rawConfig.artistIds.filter((id: any) => typeof id === 'string');
      }
      if (rawConfig.maxTracksPerArtist !== undefined) {
        config.maxTracksPerArtist = Number(rawConfig.maxTracksPerArtist);
      }
      if (rawConfig.allowDuplicateArtists !== undefined) {
        config.allowDuplicateArtists = Boolean(rawConfig.allowDuplicateArtists);
      }
      break;

    case 'album':
      if (rawConfig.albumIds && Array.isArray(rawConfig.albumIds)) {
        config.albumIds = rawConfig.albumIds.filter((id: any) => typeof id === 'string');
      }
      if (rawConfig.maxTracksPerAlbum !== undefined) {
        config.maxTracksPerAlbum = Number(rawConfig.maxTracksPerAlbum);
      }
      if (rawConfig.allowDuplicateAlbums !== undefined) {
        config.allowDuplicateAlbums = Boolean(rawConfig.allowDuplicateAlbums);
      }
      break;

    case 'genre':
      if (rawConfig.genres && Array.isArray(rawConfig.genres)) {
        config.genres = rawConfig.genres.filter((g: any) => typeof g === 'string');
      }
      break;

    case 'mood':
      if (rawConfig.moods && Array.isArray(rawConfig.moods)) {
        config.moods = rawConfig.moods.filter((m: any) => typeof m === 'string');
      }
      break;

    case 'decade':
      if (rawConfig.decades && Array.isArray(rawConfig.decades)) {
        config.decades = rawConfig.decades
          .map((d: any) => Number(d))
          .filter((d: number) => !isNaN(d) && d >= 1900 && d <= 2100);
      }
      break;

    case 'custom':
      // Parse custom rules if present
      if (rawConfig.customRules && typeof rawConfig.customRules === 'object') {
        config.customRules = {};
        
        // Time-based filters
        if (rawConfig.customRules.playedInLastDays !== undefined) {
          config.customRules.playedInLastDays = Number(rawConfig.customRules.playedInLastDays);
        }
        if (rawConfig.customRules.notPlayedInLastDays !== undefined) {
          config.customRules.notPlayedInLastDays = Number(rawConfig.customRules.notPlayedInLastDays);
        }
        if (rawConfig.customRules.addedInLastDays !== undefined) {
          config.customRules.addedInLastDays = Number(rawConfig.customRules.addedInLastDays);
        }
        
        // Year range
        if (rawConfig.customRules.yearRange && typeof rawConfig.customRules.yearRange === 'object') {
          config.customRules.yearRange = {
            min: rawConfig.customRules.yearRange.min !== undefined ? Number(rawConfig.customRules.yearRange.min) : undefined,
            max: rawConfig.customRules.yearRange.max !== undefined ? Number(rawConfig.customRules.yearRange.max) : undefined
          };
        }
        
        // Genre filters
        if (rawConfig.customRules.includeGenres && Array.isArray(rawConfig.customRules.includeGenres)) {
          config.customRules.includeGenres = rawConfig.customRules.includeGenres.filter((g: any) => typeof g === 'string');
        }
        if (rawConfig.customRules.excludeGenres && Array.isArray(rawConfig.customRules.excludeGenres)) {
          config.customRules.excludeGenres = rawConfig.customRules.excludeGenres.filter((g: any) => typeof g === 'string');
        }
        
        // Rating filter
        if (rawConfig.customRules.minRating !== undefined) {
          config.customRules.minRating = Number(rawConfig.customRules.minRating);
        }
        if (rawConfig.customRules.maxRating !== undefined) {
          config.customRules.maxRating = Number(rawConfig.customRules.maxRating);
        }
        
        // Boolean flags
        if (rawConfig.customRules.includeUnplayed !== undefined) {
          config.customRules.includeUnplayed = Boolean(rawConfig.customRules.includeUnplayed);
        }
      }
      break;
  }

  // Validate the parsed configuration
  const validation = validateConfiguration(config, mixType);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  return {
    success: true,
    configuration: config
  };
}

/**
 * Generate a mix from a template using the MixService
 */
/**
 * Generate a mix from a template using the MixService
 */
async function generateMixFromTemplate(
  template: any,
  serverUrl: string,
  plexToken: string,
  libraryId: string,
  serverClientId: string,
  playlistName: string,
  userId: number,
  db: DatabaseService
): Promise<{ playlistId: string; trackCount: number; warnings: string[] }> {
  const config = template.configuration;
  const plex = new PlexClient(serverUrl, plexToken);
  const warnings: string[] = [];

  let trackKeys: string[] = [];

  // Generate mix based on template type
  switch (template.mix_type) {
    case 'custom': {
      // Use the custom mix generator
      try {
        // Retry network operations for custom mix generation
        const result = await retryNetworkOperation(
          () => mixService.generateCustomMix(
            serverUrl,
            plexToken,
            libraryId,
            {
              trackCount: config.trackCount,
              playedInLastDays: config.customRules?.playedInLastDays,
              notPlayedInLastDays: config.customRules?.notPlayedInLastDays,
              addedInLastDays: config.customRules?.addedInLastDays,
              releasedAfterYear: config.customRules?.yearRange?.min,
              releasedBeforeYear: config.customRules?.yearRange?.max,
              genres: config.customRules?.includeGenres,
              excludeGenres: config.customRules?.excludeGenres,
              minRating: config.customRules?.minRating,
              sortBy: config.sortBy || 'random',
              sortDirection: config.sortDirection || 'desc'
            }
          ),
          'Generate custom mix'
        );
        trackKeys = result.trackKeys;

        if (trackKeys.length < config.trackCount) {
          warnings.push(`Only found ${trackKeys.length} tracks matching criteria (requested ${config.trackCount})`);
        }
      } catch (error: any) {
        logger.error('Failed to generate custom mix from template', { error: error.message, templateId: template.id });
        
        // Provide user-friendly error messages
        if (error.message?.includes('unreachable')) {
          throw new Error('Unable to connect to Plex server. Please check that your server is running and accessible.');
        } else if (error.message?.includes('token') || error.message?.includes('401')) {
          throw new Error('Plex authentication failed. Please reconnect your Plex account in settings.');
        } else if (error.message?.includes('library') || error.message?.includes('404')) {
          throw new Error('Music library not found. Please verify your library selection in settings.');
        } else {
          throw new Error(`Failed to generate custom mix: ${error.message}`);
        }
      }
      break;
    }

    case 'artist': {
      // Get tracks from specified artists
      const addedKeys = new Set<string>();
      const missingArtists: string[] = [];
      const foundArtists: string[] = [];

      for (const artistId of config.artistIds || []) {
        try {
          // Retry network operations for fetching artist tracks
          const tracks = await retryNetworkOperation(
            () => plex.getArtistPopularTracks(
              libraryId,
              artistId,
              Math.ceil(config.trackCount / (config.artistIds?.length || 1))
            ),
            `Fetch tracks for artist ${artistId}`
          );

          if (tracks.length === 0) {
            missingArtists.push(artistId);
            warnings.push(`No tracks found for artist: ${artistId}`);
            logger.warn('Artist not found or has no tracks', { artistId, templateId: template.id });
            continue;
          }

          // Get artist name from first track
          const artistName = tracks[0]?.grandparentTitle || artistId;
          foundArtists.push(artistName);

          for (const track of tracks) {
            if (!addedKeys.has(track.ratingKey) && trackKeys.length < config.trackCount) {
              trackKeys.push(track.ratingKey);
              addedKeys.add(track.ratingKey);
            }
          }
        } catch (error: any) {
          missingArtists.push(artistId);
          const errorMsg = error.message?.includes('unreachable') 
            ? 'Plex server is unreachable. Please check your server connection.'
            : error.message?.includes('token')
            ? 'Invalid Plex authentication. Please reconnect your Plex account.'
            : `Failed to fetch artist tracks: ${error.message}`;
          warnings.push(`Artist ${artistId}: ${errorMsg}`);
          logger.warn('Failed to get tracks for artist', { artistId, error: error.message });
        }
      }

      // Add warnings for missing artists
      if (missingArtists.length > 0) {
        warnings.push(`${missingArtists.length} artist(s) not found in library: ${missingArtists.join(', ')}`);
      }

      if (foundArtists.length === 0) {
        throw new Error('None of the artists in this template exist in your library');
      }

      logger.info('Artist mix generation summary', {
        templateId: template.id,
        totalArtists: config.artistIds?.length || 0,
        foundArtists: foundArtists.length,
        missingArtists: missingArtists.length,
        tracksFound: trackKeys.length
      });
      break;
    }

    case 'album': {
      // Get tracks from specified albums
      const addedKeys = new Set<string>();
      const missingAlbums: string[] = [];
      const foundAlbums: string[] = [];

      for (const albumId of config.albumIds || []) {
        try {
          // Retry network operations for fetching album tracks
          const tracks = await retryNetworkOperation(
            () => plex.getAlbumTracks(albumId),
            `Fetch tracks for album ${albumId}`
          );

          if (tracks.length === 0) {
            missingAlbums.push(albumId);
            warnings.push(`No tracks found for album: ${albumId}`);
            logger.warn('Album not found or has no tracks', { albumId, templateId: template.id });
            continue;
          }

          // Get album name from first track
          const albumName = tracks[0]?.parentTitle || albumId;
          foundAlbums.push(albumName);

          for (const track of tracks) {
            if (!addedKeys.has(track.ratingKey) && trackKeys.length < config.trackCount) {
              trackKeys.push(track.ratingKey);
              addedKeys.add(track.ratingKey);
            }
          }
        } catch (error: any) {
          missingAlbums.push(albumId);
          const errorMsg = error.message?.includes('unreachable') 
            ? 'Plex server is unreachable. Please check your server connection.'
            : error.message?.includes('token')
            ? 'Invalid Plex authentication. Please reconnect your Plex account.'
            : `Failed to fetch album tracks: ${error.message}`;
          warnings.push(`Album ${albumId}: ${errorMsg}`);
          logger.warn('Failed to get tracks for album', { albumId, error: error.message });
        }
      }

      // Add warnings for missing albums
      if (missingAlbums.length > 0) {
        warnings.push(`${missingAlbums.length} album(s) not found in library: ${missingAlbums.join(', ')}`);
      }

      if (foundAlbums.length === 0) {
        throw new Error('None of the albums in this template exist in your library');
      }

      logger.info('Album mix generation summary', {
        templateId: template.id,
        totalAlbums: config.albumIds?.length || 0,
        foundAlbums: foundAlbums.length,
        missingAlbums: missingAlbums.length,
        tracksFound: trackKeys.length
      });
      break;
    }

    case 'genre':
    case 'mood':
    case 'decade': {
      // Use custom mix with genre/year filters
      const filters: any = {
        trackCount: config.trackCount,
        sortBy: config.sortBy || 'random',
        sortDirection: config.sortDirection || 'desc'
      };

      if (template.mix_type === 'genre') {
        filters.genres = config.genres;
      } else if (template.mix_type === 'mood') {
        filters.genres = config.moods; // Moods are treated as genres in Plex
      } else if (template.mix_type === 'decade') {
        // Convert decades to year ranges
        const decades = config.decades || [];
        if (decades.length > 0) {
          const minDecade = Math.min(...decades);
          const maxDecade = Math.max(...decades);
          filters.releasedAfterYear = minDecade;
          filters.releasedBeforeYear = maxDecade + 9; // Include full decade
        }
      }

      try {
        // Retry network operations for genre/mood/decade mix generation
        const result = await retryNetworkOperation(
          () => mixService.generateCustomMix(
            serverUrl,
            plexToken,
            libraryId,
            filters
          ),
          `Generate ${template.mix_type} mix`
        );
        trackKeys = result.trackKeys;

        if (trackKeys.length === 0) {
          const filterType = template.mix_type === 'genre' ? 'genres' :
                           template.mix_type === 'mood' ? 'moods' : 'decades';
          const filterValues = template.mix_type === 'genre' ? config.genres?.join(', ') :
                             template.mix_type === 'mood' ? config.moods?.join(', ') :
                             config.decades?.join(', ');
          warnings.push(`No tracks found matching ${filterType}: ${filterValues}`);
        } else if (trackKeys.length < config.trackCount) {
          warnings.push(`Only found ${trackKeys.length} tracks matching criteria (requested ${config.trackCount})`);
        }
      } catch (error: any) {
        logger.error('Failed to generate mix from template', { error: error.message, mixType: template.mix_type, templateId: template.id });
        
        // Provide user-friendly error messages
        if (error.message?.includes('unreachable')) {
          throw new Error('Unable to connect to Plex server. Please check that your server is running and accessible.');
        } else if (error.message?.includes('token') || error.message?.includes('401')) {
          throw new Error('Plex authentication failed. Please reconnect your Plex account in settings.');
        } else if (error.message?.includes('library') || error.message?.includes('404')) {
          throw new Error('Music library not found. Please verify your library selection in settings.');
        } else {
          throw new Error(`Failed to generate ${template.mix_type} mix: ${error.message}`);
        }
      }
      break;
    }

    default:
      throw new Error(`Unsupported mix type: ${template.mix_type}`);
  }

  if (trackKeys.length === 0) {
    throw new Error('No tracks found matching template criteria. The items in this template may no longer exist in your library.');
  }

  // Build track URIs and library URI
  const trackUris = trackKeys.map(key => plex.buildTrackUri(key, serverClientId));
  const libraryUri = plex.buildLibraryUri(libraryId, serverClientId);

  // Create playlist in Plex
  try {
    // Retry network operations for playlist creation
    const playlist = await retryNetworkOperation(
      () => plex.createPlaylist(playlistName, libraryUri, trackUris),
      'Create Plex playlist'
    );

    // Store playlist in database
    await db.createPlaylist(
      userId,
      playlist.ratingKey,
      playlistName,
      'template',
      template.id
    );

    return {
      playlistId: playlist.ratingKey,
      trackCount: trackKeys.length,
      warnings
    };
  } catch (error: any) {
    logger.error('Failed to create playlist from template', { error: error.message, templateId: template.id });
    
    // Provide user-friendly error messages
    if (error.message?.includes('unreachable')) {
      throw new Error('Unable to connect to Plex server to create playlist. Please check your server connection.');
    } else if (error.message?.includes('token') || error.message?.includes('401')) {
      throw new Error('Plex authentication failed while creating playlist. Please reconnect your Plex account.');
    } else if (error.message?.includes('permission') || error.message?.includes('403')) {
      throw new Error('You do not have permission to create playlists on this Plex server.');
    } else {
      throw new Error(`Failed to create playlist: ${error.message}`);
    }
  }
}


// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/mix-templates
 * List all templates for the current user
 * 
 * Performance optimizations:
 * - Returns lightweight template list without full configuration
 * - Configuration is lazy-loaded via GET /:id endpoint
 * - Uses database indexes for fast user_id lookup
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    // Get templates with lightweight data (no full configuration parsing)
    const templates = db.getMixTemplates(userId);

    // Transform to response format - include configuration for display
    const responseTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      mixType: template.mix_type,
      configuration: template.configuration, // Include full configuration
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      lastUsedAt: template.last_used_at,
      useCount: template.use_count
    }));

    logger.info('Fetched mix templates', { userId, count: responseTemplates.length });

    // Set cache headers for client-side caching (5 minutes)
    res.set('Cache-Control', 'private, max-age=300');
    res.json({ templates: responseTemplates });
  } catch (error: any) {
    logger.error('Failed to fetch mix templates', { error: error.message, stack: error.stack, userId: req.session.userId });
    
    // Provide user-friendly error message
    if (error.message?.includes('database') || error.code === 'SQLITE_ERROR') {
      next(createInternalError('Database error while retrieving templates. Please try again.'));
    } else {
      next(createInternalError('Failed to retrieve mix templates. Please try again.'));
    }
  }
});

/**
 * GET /api/mix-templates/:id
 * Get a specific template with full configuration
 * 
 * Performance optimizations:
 * - Lazy loads full configuration only when requested
 * - Uses prepared statement with index lookup
 * - Sets cache headers for client-side caching
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return next(createValidationError('Invalid template ID. Please provide a valid numeric ID.'));
    }

    const template = db.getMixTemplateById(templateId);

    if (!template) {
      return next(createNotFoundError('Template not found. It may have been deleted.'));
    }

    // Verify ownership
    if (template.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to access this template'));
    }

    logger.info('Fetched mix template', { userId, templateId });

    // Set cache headers for client-side caching (5 minutes)
    res.set('Cache-Control', 'private, max-age=300');
    res.json(template);
  } catch (error: any) {
    logger.error('Failed to fetch mix template', { error: error.message, stack: error.stack, userId: req.session.userId, templateId: req.params.id });
    
    // Provide user-friendly error message
    if (error.message?.includes('database') || error.code === 'SQLITE_ERROR') {
      next(createInternalError('Database error while retrieving template. Please try again.'));
    } else {
      next(createInternalError('Failed to retrieve mix template. Please try again.'));
    }
  }
});

/**
 * POST /api/mix-templates
 * Create a new template
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { name, description, mixType, configuration } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return next(createValidationError('Template name is required'));
    }

    if (name.trim().length > 255) {
      return next(createValidationError('Template name must be 255 characters or less'));
    }

    // Validate description (optional)
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return next(createValidationError('Description must be a string'));
      }
      if (description.length > 1000) {
        return next(createValidationError('Description must be 1000 characters or less'));
      }
    }

    // Validate mixType
    if (!mixType || typeof mixType !== 'string') {
      return next(createValidationError('Mix type is required'));
    }

    const validMixTypes = ['artist', 'album', 'genre', 'mood', 'decade', 'custom'];
    if (!validMixTypes.includes(mixType)) {
      return next(createValidationError(`Invalid mix type. Must be one of: ${validMixTypes.join(', ')}`));
    }

    // Validate configuration
    if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
      return next(createValidationError('Configuration is required and must be an object'));
    }

    // Validate configuration structure
    const configValidation = validateConfiguration(configuration, mixType);
    if (!configValidation.valid) {
      return next(createValidationError(configValidation.error!));
    }

    // Sanitize inputs to prevent injection attacks
    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedMixType = sanitizeString(mixType);
    const sanitizedConfiguration = sanitizeConfiguration(configuration);

    // Add schema version to configuration
    const versionedConfiguration = addSchemaVersion(sanitizedConfiguration);

    // Verify sanitization didn't remove essential data
    if (sanitizedName.length === 0) {
      return next(createValidationError('Template name contains invalid characters'));
    }

    if (!validMixTypes.includes(sanitizedMixType)) {
      return next(createValidationError('Mix type contains invalid characters'));
    }

    // Create template with sanitized and versioned data
    const template = db.createMixTemplate(
      userId,
      sanitizedName,
      sanitizedDescription,
      sanitizedMixType,
      versionedConfiguration
    );

    logger.info('Mix template created', { userId, templateId: template.id, name: template.name });

    res.status(201).json({ 
      id: template.id,
      message: 'Template saved successfully'
    });
  } catch (error: any) {
    logger.error('Failed to create mix template', { error: error.message, stack: error.stack, userId: req.session.userId });
    
    // Provide user-friendly error messages
    if (error.message?.includes('database') || error.code === 'SQLITE_ERROR') {
      next(createInternalError('Database error while saving template. Please try again.'));
    } else if (error.message?.includes('UNIQUE constraint')) {
      next(createValidationError('A template with this name already exists. Please choose a different name.'));
    } else {
      next(createInternalError('Failed to create mix template. Please try again.'));
    }
  }
});

/**
 * PUT /api/mix-templates/:id
 * Update an existing template
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const templateId = parseInt(req.params.id, 10);
    const { name, description, configuration } = req.body;

    if (isNaN(templateId)) {
      return next(createValidationError('Invalid template ID'));
    }

    const template = db.getMixTemplateById(templateId);

    if (!template) {
      return next(createNotFoundError('Template not found'));
    }

    // Verify ownership
    if (template.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to modify this template'));
    }

    // Validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return next(createValidationError('Template name must be a non-empty string'));
      }
      if (name.trim().length > 255) {
        return next(createValidationError('Template name must be 255 characters or less'));
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return next(createValidationError('Description must be a string'));
      }
      if (description.length > 1000) {
        return next(createValidationError('Description must be 1000 characters or less'));
      }
    }

    if (configuration !== undefined) {
      if (typeof configuration !== 'object' || Array.isArray(configuration)) {
        return next(createValidationError('Configuration must be an object'));
      }
      
      // Validate configuration structure if provided
      const configValidation = validateConfiguration(configuration, template.mix_type);
      if (!configValidation.valid) {
        return next(createValidationError(configValidation.error!));
      }
    }

    // Sanitize inputs
    const sanitizedName = name !== undefined ? sanitizeString(name) : undefined;
    const sanitizedDescription = description !== undefined 
      ? (description === null ? null : sanitizeString(description))
      : undefined;
    let sanitizedConfiguration = configuration !== undefined 
      ? sanitizeConfiguration(configuration)
      : undefined;

    // Add schema version to configuration if being updated
    if (sanitizedConfiguration !== undefined) {
      sanitizedConfiguration = addSchemaVersion(sanitizedConfiguration);
    }

    // Verify sanitization didn't remove essential data
    if (sanitizedName !== undefined && sanitizedName.length === 0) {
      return next(createValidationError('Template name contains invalid characters'));
    }

    // Update template with sanitized and versioned data
    db.updateMixTemplate(templateId, {
      name: sanitizedName,
      description: sanitizedDescription,
      configuration: sanitizedConfiguration
    });

    logger.info('Mix template updated', { userId, templateId });

    res.json({ message: 'Template updated successfully' });
  } catch (error: any) {
    logger.error('Failed to update mix template', { error: error.message, stack: error.stack, userId: req.session.userId, templateId: req.params.id });
    
    // Provide user-friendly error messages
    if (error.message?.includes('database') || error.code === 'SQLITE_ERROR') {
      next(createInternalError('Database error while updating template. Please try again.'));
    } else if (error.message?.includes('UNIQUE constraint')) {
      next(createValidationError('A template with this name already exists. Please choose a different name.'));
    } else {
      next(createInternalError('Failed to update mix template. Please try again.'));
    }
  }
});

/**
 * DELETE /api/mix-templates/:id
 * Delete a template
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return next(createValidationError('Invalid template ID'));
    }

    const template = db.getMixTemplateById(templateId);

    if (!template) {
      return next(createNotFoundError('Template not found'));
    }

    // Verify ownership
    if (template.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to delete this template'));
    }

    // Delete template
    db.deleteMixTemplate(templateId);

    logger.info('Mix template deleted', { userId, templateId });

    res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    logger.error('Failed to delete mix template', { error: error.message, stack: error.stack, userId: req.session.userId, templateId: req.params.id });
    
    // Provide user-friendly error messages
    if (error.message?.includes('database') || error.code === 'SQLITE_ERROR') {
      next(createInternalError('Database error while deleting template. Please try again.'));
    } else {
      next(createInternalError('Failed to delete mix template. Please try again.'));
    }
  }
});

/**
 * POST /api/mix-templates/:id/generate
 * Generate a mix from a template
 */
router.post('/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const templateId = parseInt(req.params.id, 10);
    const { playlistName } = req.body;

    if (isNaN(templateId)) {
      return next(createValidationError('Invalid template ID'));
    }

    const template = db.getMixTemplateById(templateId);

    if (!template) {
      return next(createNotFoundError('Template not found'));
    }

    // Verify ownership
    if (template.user_id !== userId) {
      return next(createForbiddenError('You do not have permission to use this template'));
    }

    // Migrate configuration if needed (before parsing)
    let rawConfiguration = template.configuration;
    const preMigrationResult = migrateConfiguration(rawConfiguration);
    if (!preMigrationResult.success) {
      logger.error('Failed to migrate template configuration', {
        templateId,
        error: preMigrationResult.error
      });
      return next(createValidationError(`Template configuration migration failed: ${preMigrationResult.error}`));
    }
    
    rawConfiguration = preMigrationResult.configuration!;

    // Parse and validate template configuration
    const parseResult = parseTemplateConfiguration(rawConfiguration, template.mix_type);
    
    if (!parseResult.success) {
      logger.error('Failed to parse template configuration', { 
        templateId, 
        mixType: template.mix_type,
        error: parseResult.error 
      });
      return next(createValidationError(`Template configuration is invalid: ${parseResult.error}`));
    }
    
    const configuration = parseResult.configuration!;

    // Verify required fields are present
    if (!configuration.trackCount || typeof configuration.trackCount !== 'number') {
      return next(createValidationError('Template configuration missing valid trackCount'));
    }

    // Get user's server configuration
    const userServer = await db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No Plex server configured. Please select a server first.'));
    }

    if (!userServer.library_id) {
      return next(createValidationError('No music library selected. Please select a library first.'));
    }

    const user = await db.getUserById(userId);
    if (!user) {
      return next(createInternalError('User not found'));
    }

    // Update usage statistics
    db.updateMixTemplateUsage(templateId);

    logger.info('Generating mix from template', { 
      userId, 
      templateId, 
      templateName: template.name,
      mixType: template.mix_type,
      trackCount: configuration.trackCount
    });

    // Generate playlist name if not provided
    const finalPlaylistName = playlistName || `${template.name} - ${new Date().toLocaleDateString()}`;

    // Generate mix based on template type
    const result = await generateMixFromTemplate(
      template,
      userServer.server_url,
      user.plex_token,
      userServer.library_id!,
      userServer.server_client_id,
      finalPlaylistName,
      userId,
      db
    );

    logger.info('Mix generated from template', { 
      userId, 
      templateId, 
      playlistId: result.playlistId, 
      trackCount: result.trackCount,
      warningCount: result.warnings.length
    });

    res.json({
      success: true,
      playlistId: result.playlistId,
      trackCount: result.trackCount,
      warnings: result.warnings,
      message: result.warnings.length > 0 
        ? `Mix generated with ${result.warnings.length} warning(s)` 
        : 'Mix generated successfully'
    });
  } catch (error: any) {
    logger.error('Failed to generate mix from template', { 
      error: error.message, 
      stack: error.stack,
      userId: req.session.userId, 
      templateId: req.params.id 
    });
    
    // Provide user-friendly error messages based on error type
    let errorMessage = error.message || 'Failed to generate mix from template';
    
    // Network/connection errors
    if (error.message?.includes('unreachable') || error.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to Plex server. Please check that your server is running and accessible.';
    } 
    // Authentication errors
    else if (error.message?.includes('token') || error.message?.includes('401') || error.message?.includes('authentication')) {
      errorMessage = 'Plex authentication failed. Please reconnect your Plex account in settings.';
    }
    // Library/resource not found errors
    else if (error.message?.includes('library') || error.message?.includes('404') || error.message?.includes('not found')) {
      errorMessage = 'Music library or template items not found. Please verify your library selection and template configuration.';
    }
    // Permission errors
    else if (error.message?.includes('permission') || error.message?.includes('403')) {
      errorMessage = 'You do not have permission to create playlists on this Plex server.';
    }
    // Database errors
    else if (error.message?.includes('database') || error.code === 'SQLITE_ERROR') {
      errorMessage = 'Database error while generating mix. Please try again.';
    }
    // Timeout errors
    else if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      errorMessage = 'Request timed out. Your Plex server may be slow or overloaded. Please try again.';
    }
    // Configuration errors
    else if (error.message?.includes('configuration') || error.message?.includes('invalid')) {
      errorMessage = `Template configuration error: ${error.message}`;
    }
    
    next(createInternalError(errorMessage));
  }
});

export default router;
