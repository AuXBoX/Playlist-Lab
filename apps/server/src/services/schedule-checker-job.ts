/**
 * Schedule Checker Job
 * 
 * Checks for due schedules and executes them:
 * - Playlist refresh schedules
 * - Mix generation schedules
 */

import { DatabaseService } from '../database/database';
import { logger } from '../utils/logger';
import { importPlaylist } from './import';
import { MixService } from './mixes';
import { PlexClient } from './plex';

/**
 * Execute playlist refresh schedules that are due
 */
async function executePlaylistRefreshSchedules(db: DatabaseService): Promise<{ executed: number; failed: number }> {
  const dueSchedules = db.getDueSchedules().filter(s => s.schedule_type === 'playlist_refresh');

  let executed = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    let executionId: number | null = null;
    try {
      logger.info('Executing playlist refresh schedule', {
        scheduleId: schedule.id,
        userId: schedule.user_id,
        playlistId: schedule.playlist_id
      });

      // Get user info
      const user = db.getUserById(schedule.user_id);
      if (!user) {
        logger.error('User not found for schedule', { scheduleId: schedule.id, userId: schedule.user_id });
        failed++;
        continue;
      }

      // Get user's server info
      const server = db.getUserServer(schedule.user_id);
      if (!server) {
        logger.error('Server not found for user', { scheduleId: schedule.id, userId: schedule.user_id });
        failed++;
        continue;
      }

      // Parse schedule config
      const config = schedule.config ? JSON.parse(schedule.config) : {};

      // Check if this is a chart import schedule (has chartUrl or autoImport in config)
      const isChartImport = config.chartUrl || config.autoImport;

      let result;
      let playlistName;

      if (isChartImport) {
        playlistName = config.playlistName || config.chartName || 'Chart Import';
      } else {
        const playlist = schedule.playlist_id ? db.getPlaylistById(schedule.playlist_id) : null;
        if (!playlist) {
          logger.error('Playlist not found for schedule', { scheduleId: schedule.id, playlistId: schedule.playlist_id });
          failed++;
          continue;
        }
        playlistName = playlist.name;
      }

      // Create execution record
      executionId = db.createScheduleExecution(schedule.id, schedule.user_id, playlistName);

      if (isChartImport) {
        // Chart import schedule
        logger.info('Executing chart import schedule', {
          scheduleId: schedule.id,
          chartName: config.chartName,
          chartSource: config.chartSource,
          chartUrl: config.chartUrl
        });

        // Import from chart URL
        result = await importPlaylist(
          config.chartSource as any,
          config.chartUrl,
          {
            userId: schedule.user_id,
            serverUrl: server.server_url,
            plexToken: user.plex_token,
            libraryId: server.library_id || undefined,
          },
          db
        );

        // Use custom playlist name from config, or fall back to chart name
        playlistName = config.playlistName || config.chartName || result.playlistName;
      } else {
        // Regular playlist refresh schedule
        const playlist = schedule.playlist_id ? db.getPlaylistById(schedule.playlist_id) : null;
        if (!playlist) {
          logger.error('Playlist not found for schedule', { scheduleId: schedule.id, playlistId: schedule.playlist_id });
          failed++;
          continue;
        }

        // Re-import the playlist
        result = await importPlaylist(
          playlist.source as any,
          playlist.source_url || playlist.plex_playlist_id,
          {
            userId: schedule.user_id,
            serverUrl: server.server_url,
            plexToken: user.plex_token,
            libraryId: server.library_id || undefined,
          },
          db
        );

        playlistName = playlist.name;
      }

      // Update the playlist in Plex
      const plex = new PlexClient(server.server_url, user.plex_token);

      // Handle overwrite option
      const overwriteExisting = config.overwriteExisting !== undefined ? config.overwriteExisting : true;

      if (overwriteExisting) {
        // Find existing playlist with the same name
        try {
          const playlists = await plex.getPlaylists();
          const existingPlaylist = playlists.find((p: any) => p.title === playlistName);

          if (existingPlaylist) {
            logger.info('Deleting existing playlist before creating new one', {
              playlistName,
              existingPlaylistId: existingPlaylist.ratingKey
            });
            await plex.deletePlaylist(existingPlaylist.ratingKey);
          }
        } catch (error: any) {
          logger.warn('Failed to check for existing playlist', {
            playlistName,
            error: error.message
          });
          // Continue anyway - playlist creation will handle duplicates
        }
      }

      // Create new playlist with refreshed tracks
      // Filter out tracks without valid plexRatingKey and build proper URIs
      const matchedWithKeys = result.matched.filter((t: any) => t.matched && t.plexRatingKey);
      
      // Get server client ID for building track URIs
      const serverClientId = server.server_client_id || 'playlist-lab-server';
      const trackUris = matchedWithKeys.map((t: any) => 
        `server://${serverClientId}/com.plexapp.plugins.library/library/metadata/${t.plexRatingKey}`
      );
      
      logger.info('Creating playlist with matched tracks', {
        scheduleId: schedule.id,
        totalMatched: result.matched.filter((t: any) => t.matched).length,
        validTrackUris: trackUris.length,
        playlistName,
        sampleUri: trackUris[0]
      });
      
      const newPlaylist = await plex.createPlaylist(
        playlistName,
        server.library_id || '',
        trackUris
      );

      // Upload cover art if available and overwriteCover is enabled
      const overwriteCover = config.overwriteCover !== undefined ? config.overwriteCover : true;
      if (result.coverUrl && overwriteCover) {
        try {
          logger.info('Uploading cover art for scheduled import', {
            scheduleId: schedule.id,
            playlistName,
            coverUrl: result.coverUrl
          });
          await plex.uploadPlaylistPoster(newPlaylist.ratingKey, result.coverUrl);
        } catch (coverError: any) {
          logger.warn('Failed to upload cover art for scheduled import', {
            scheduleId: schedule.id,
            playlistName,
            error: coverError.message
          });
          // Continue - cover upload failure shouldn't fail the whole import
        }
      }

      // Get or create playlist record in database
      let playlistDbId = schedule.playlist_id;
      
      if (playlistDbId) {
        // Update existing playlist record
        db.updatePlaylist(playlistDbId, {
          plex_playlist_id: newPlaylist.ratingKey,
          updated_at: Math.floor(Date.now() / 1000)
        });
      } else {
        // For chart imports or new playlists, create a database record
        const existingPlaylist = db.getPlaylistByPlexId(newPlaylist.ratingKey);
        if (existingPlaylist) {
          playlistDbId = existingPlaylist.id;
        } else {
          // Create new playlist record
          const createdPlaylist = db.createPlaylist(
            schedule.user_id,
            newPlaylist.ratingKey,
            playlistName,
            isChartImport ? config.chartSource : 'plex',
            isChartImport ? config.chartUrl : undefined
          );
          playlistDbId = createdPlaylist.id;
          
          logger.info('Created playlist record for scheduled import', {
            scheduleId: schedule.id,
            playlistId: playlistDbId,
            playlistName,
            isChartImport
          });
        }
      }

      // Save any unmatched tracks to missing_tracks
      if (result.unmatched && result.unmatched.length > 0 && playlistDbId) {
        const runDate = new Date().toLocaleDateString('en-GB');
        const missingSource = `Scheduled import – ${runDate}`;

        // Clear old missing tracks for this playlist before adding new ones
        db.clearPlaylistMissingTracks(playlistDbId);

        const missingTracks = result.unmatched.map((t: any, i: number) => ({
          title: t.title || 'Unknown',
          artist: t.artist || 'Unknown',
          album: t.album,
          position: i + 1,
          source: missingSource,
        }));

        db.addMissingTracks(schedule.user_id, playlistDbId, missingTracks);

        logger.info('Saved missing tracks from scheduled import', {
          scheduleId: schedule.id,
          playlistId: playlistDbId,
          missingCount: missingTracks.length,
        });
      }

      // Update schedule last_run
      db.updateScheduleLastRun(schedule.id);

      // Update execution record with success
      if (executionId) {
        const matchedCount = result.matched?.filter((t: any) => t.matched).length || 0;
        const unmatchedCount = result.unmatched?.length || 0;
        db.updateScheduleExecution(executionId, 'success', matchedCount, unmatchedCount);
      }

      executed++;
      logger.info('Playlist refresh schedule executed successfully', {
        scheduleId: schedule.id,
        playlistName,
        trackCount: trackUris.length
      });
    } catch (error: any) {
      logger.error('Failed to execute playlist refresh schedule', {
        scheduleId: schedule.id,
        error: error.message,
        stack: error.stack
      });
      
      // Update execution record with failure
      if (executionId) {
        db.updateScheduleExecution(executionId, 'failed', 0, 0, error.message);
      }
      
      failed++;
    }
  }

  return { executed, failed };
}


/**
 * Execute mix generation schedules that are due
 */
async function executeMixGenerationSchedules(db: DatabaseService): Promise<{ executed: number; failed: number }> {
  const dueSchedules = db.getDueSchedules().filter(s => s.schedule_type === 'mix_generation');
  
  let executed = 0;
  let failed = 0;

  const mixService = new MixService();

  for (const schedule of dueSchedules) {
    let executionId: number | null = null;
    try {
      logger.info('Executing mix generation schedule', { 
        scheduleId: schedule.id,
        userId: schedule.user_id
      });

      // Get user info
      const user = db.getUserById(schedule.user_id);
      if (!user) {
        logger.error('User not found for schedule', { scheduleId: schedule.id, userId: schedule.user_id });
        failed++;
        continue;
      }

      // Get user's server info
      const server = db.getUserServer(schedule.user_id);
      if (!server) {
        logger.error('Server not found for user', { scheduleId: schedule.id, userId: schedule.user_id });
        failed++;
        continue;
      }

      // Get user settings
      const settings = db.getUserSettings(schedule.user_id);

      // Parse schedule config to determine which mixes to generate
      const config = schedule.config ? JSON.parse(schedule.config) : {};
      
      const plex = new PlexClient(server.server_url, user.plex_token);

      // Check if this is a template-based schedule
      if (config.templateId) {
        // Template-based mix generation
        const template = db.getMixTemplateById(config.templateId);
        if (!template) {
          logger.error('Template not found for schedule', { 
            scheduleId: schedule.id, 
            templateId: config.templateId 
          });
          failed++;
          continue;
        }

        const playlistName = config.templateName || template.name;
        
        // Create execution record
        executionId = db.createScheduleExecution(schedule.id, schedule.user_id, playlistName);

        logger.info('Generating mix from template', {
          scheduleId: schedule.id,
          templateId: template.id,
          templateName: template.name,
          mixType: template.mix_type
        });

        // Generate mix using the template configuration
        const templateConfig = typeof template.configuration === 'string' 
          ? JSON.parse(template.configuration) 
          : template.configuration;

        let result;
        
        // Handle different mix types from templates
        if (template.mix_type === 'custom' && templateConfig.customRules) {
          // Custom mix from template
          result = await mixService.generateCustomMix(
            server.server_url,
            user.plex_token,
            server.library_id || '',
            {
              ...templateConfig,
              playlistName,
            }
          );
        } else {
          // Other mix types (weekly, daily, etc.)
          const mixType = templateConfig.mixType || template.mix_type;
          result = await generateMixByType(
            mixService,
            mixType,
            server.server_url,
            user.plex_token,
            server.library_id || '',
            settings,
            templateConfig
          );
        }

        if (!result || result.trackKeys.length === 0) {
          logger.warn('Template mix generation returned no tracks', { 
            templateId: template.id,
            scheduleId: schedule.id 
          });
          if (executionId) {
            db.updateScheduleExecution(executionId, 'failed', 0, 0, 'No tracks generated');
          }
          failed++;
          continue;
        }

        // Create or update playlist
        const playlistId = await plex.createPlaylist(
          playlistName,
          server.library_id || '',
          result.trackKeys
        );

        logger.info('Template mix generated successfully', { 
          templateId: template.id,
          playlistName, 
          trackCount: result.trackCount,
          playlistId: playlistId.ratingKey
        });

        // Update template usage
        db.updateMixTemplateUsage(template.id);

        // Update execution record with success
        if (executionId) {
          db.updateScheduleExecution(executionId, 'success', result.trackCount, 0);
        }

      } else if (config.mixType) {
        // Individual mix type schedule (from quick mix settings)
        const mixType = config.mixType;
        const playlistName = config.mixName || `${mixType} Mix`;
        
        // Create execution record
        executionId = db.createScheduleExecution(schedule.id, schedule.user_id, playlistName);

        logger.info('Generating individual mix', {
          scheduleId: schedule.id,
          mixType,
          playlistName
        });

        const result = await generateMixByType(
          mixService,
          mixType,
          server.server_url,
          user.plex_token,
          server.library_id || '',
          settings,
          config
        );

        if (!result || result.trackKeys.length === 0) {
          logger.warn('Mix generation returned no tracks', { mixType, scheduleId: schedule.id });
          if (executionId) {
            db.updateScheduleExecution(executionId, 'failed', 0, 0, 'No tracks generated');
          }
          failed++;
          continue;
        }

        // Create or update playlist
        const playlistId = await plex.createPlaylist(
          playlistName,
          server.library_id || '',
          result.trackKeys
        );

        logger.info('Mix generated successfully', { 
          mixType, 
          playlistName, 
          trackCount: result.trackCount,
          playlistId: playlistId.ratingKey
        });

        // Update execution record with success
        if (executionId) {
          db.updateScheduleExecution(executionId, 'success', result.trackCount, 0);
        }

      } else {
        // Legacy format: config.mixes array
        const mixTypes = config.mixes || ['weekly', 'daily', 'timecapsule', 'newmusic'];

        for (const mixType of mixTypes) {
          try {
            const playlistName = `${mixType.charAt(0).toUpperCase() + mixType.slice(1)} Mix`;
            
            const result = await generateMixByType(
              mixService,
              mixType,
              server.server_url,
              user.plex_token,
              server.library_id || '',
              settings,
              {}
            );

            if (!result || result.trackKeys.length === 0) {
              logger.warn('Mix generation returned no tracks', { mixType, scheduleId: schedule.id });
              continue;
            }

            // Create new playlist
            const playlistId = await plex.createPlaylist(
              playlistName,
              server.library_id || '',
              result.trackKeys
            );

            logger.info('Mix generated successfully', { 
              mixType, 
              playlistName, 
              trackCount: result.trackCount,
              playlistId: playlistId.ratingKey
            });
          } catch (error: any) {
            logger.error('Failed to generate mix', { 
              mixType,
              scheduleId: schedule.id,
              error: error.message
            });
          }
        }
      }

      // Update schedule last_run
      db.updateScheduleLastRun(schedule.id);

      executed++;
      logger.info('Mix generation schedule executed successfully', { scheduleId: schedule.id });
    } catch (error: any) {
      logger.error('Failed to execute mix generation schedule', { 
        scheduleId: schedule.id,
        error: error.message,
        stack: error.stack
      });
      
      // Update execution record with failure
      if (executionId) {
        db.updateScheduleExecution(executionId, 'failed', 0, 0, error.message);
      }
      
      failed++;
    }
  }

  return { executed, failed };
}

/**
 * Helper function to generate a mix by type
 */
async function generateMixByType(
  mixService: MixService,
  mixType: string,
  serverUrl: string,
  plexToken: string,
  libraryId: string,
  settings: any,
  config: any
): Promise<any> {
  switch (mixType) {
    case 'weekly':
      return await mixService.generateWeeklyMix(
        serverUrl,
        plexToken,
        libraryId,
        settings.mix_settings.weeklyMix
      );

    case 'daily':
      return await mixService.generateDailyMix(
        serverUrl,
        plexToken,
        libraryId,
        settings.mix_settings.dailyMix
      );

    case 'timecapsule':
      return await mixService.generateTimeCapsule(
        serverUrl,
        plexToken,
        libraryId,
        settings.mix_settings.timeCapsule
      );

    case 'newmusic':
      return await mixService.generateNewMusicMix(
        serverUrl,
        plexToken,
        libraryId,
        settings.mix_settings.newMusic
      );

    case 'deepcuts':
      return await mixService.generateDeepCutsMix(
        serverUrl,
        plexToken,
        libraryId,
        config
      );

    case 'workout':
      return await mixService.generateWorkoutMix(
        serverUrl,
        plexToken,
        libraryId,
        config
      );

    case 'forgottenfavorites':
      return await mixService.generateForgottenFavoritesMix(
        serverUrl,
        plexToken,
        libraryId,
        config
      );

    default:
      throw new Error(`Unknown mix type: ${mixType}`);
  }
}

/**
 * Run schedule checker job (checks both playlist refresh and mix generation)
 */
export async function runScheduleCheckerJob(db: DatabaseService): Promise<void> {
  logger.info('Starting schedule checker job');

  const playlistResults = await executePlaylistRefreshSchedules(db);
  const mixResults = await executeMixGenerationSchedules(db);

  logger.info('Schedule checker job completed', {
    playlistRefresh: playlistResults,
    mixGeneration: mixResults,
    timestamp: new Date().toISOString()
  });
}

/**
 * Run a single schedule immediately (for manual "Run Now" triggers)
 * This executes the schedule logic without checking if it's due
 */
export async function runSingleSchedule(db: DatabaseService, schedule: any): Promise<void> {
  logger.info('Manually running single schedule', {
    scheduleId: schedule.id,
    scheduleType: schedule.schedule_type,
    userId: schedule.user_id
  });

  try {
    if (schedule.schedule_type === 'playlist_refresh') {
      // Execute the playlist refresh logic for this specific schedule
      // We'll temporarily modify getDueSchedules to return this schedule
      const originalGetDueSchedules = db.getDueSchedules.bind(db);
      db.getDueSchedules = () => [schedule];
      
      try {
        await executePlaylistRefreshSchedules(db);
      } finally {
        // Restore original function
        db.getDueSchedules = originalGetDueSchedules;
      }
      
      logger.info('Manual playlist refresh completed', {
        scheduleId: schedule.id
      });
    } else if (schedule.schedule_type === 'mix_generation') {
      // Execute the mix generation logic for this specific schedule
      const originalGetDueSchedules = db.getDueSchedules.bind(db);
      db.getDueSchedules = () => [schedule];
      
      try {
        await executeMixGenerationSchedules(db);
      } finally {
        // Restore original function
        db.getDueSchedules = originalGetDueSchedules;
      }
      
      logger.info('Manual mix generation completed', {
        scheduleId: schedule.id
      });
    } else {
      throw new Error(`Unknown schedule type: ${schedule.schedule_type}`);
    }
  } catch (error: any) {
    logger.error('Failed to manually run schedule', {
      scheduleId: schedule.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
