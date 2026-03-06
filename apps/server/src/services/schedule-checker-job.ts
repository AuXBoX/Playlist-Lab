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
      const trackUris = result.matched.filter((t: any) => t.matched).map((t: any) => t.plexRatingKey!);
      const newPlaylist = await plex.createPlaylist(
        playlistName,
        server.library_id || '',
        trackUris
      );

      // Update playlist record if this is a regular playlist refresh
      if (schedule.playlist_id) {
        db.updatePlaylist(schedule.playlist_id, {
          plex_playlist_id: newPlaylist.ratingKey,
          updated_at: Math.floor(Date.now() / 1000)
        });
      }

      // Save any unmatched tracks to missing_tracks
      if (result.unmatched && result.unmatched.length > 0) {
        const playlistDbId = schedule.playlist_id || db.getPlaylistByPlexId(newPlaylist.ratingKey)?.id;
        if (playlistDbId) {
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
      }

      // Update schedule last_run
      db.updateScheduleLastRun(schedule.id);

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
      const config = schedule.config ? JSON.parse(schedule.config) : { mixes: ['weekly', 'daily', 'timecapsule', 'newmusic'] };
      const mixTypes = config.mixes || ['weekly', 'daily', 'timecapsule', 'newmusic'];

      const plex = new PlexClient(server.server_url, user.plex_token);

      // Generate each requested mix
      for (const mixType of mixTypes) {
        try {
          let result;
          let playlistName;

          switch (mixType) {
            case 'weekly':
              result = await mixService.generateWeeklyMix(
                server.server_url,
                user.plex_token,
                server.library_id || '',
                settings.mix_settings.weeklyMix
              );
              playlistName = 'Weekly Mix';
              break;

            case 'daily':
              result = await mixService.generateDailyMix(
                server.server_url,
                user.plex_token,
                server.library_id || '',
                settings.mix_settings.dailyMix
              );
              playlistName = 'Daily Mix';
              break;

            case 'timecapsule':
              result = await mixService.generateTimeCapsule(
                server.server_url,
                user.plex_token,
                server.library_id || '',
                settings.mix_settings.timeCapsule
              );
              playlistName = 'Time Capsule';
              break;

            case 'newmusic':
              result = await mixService.generateNewMusicMix(
                server.server_url,
                user.plex_token,
                server.library_id || '',
                settings.mix_settings.newMusic
              );
              playlistName = 'New Music Mix';
              break;

            default:
              logger.warn('Unknown mix type in schedule', { mixType, scheduleId: schedule.id });
              continue;
          }

          if (result.trackKeys.length === 0) {
            logger.warn('Mix generation returned no tracks', { mixType, scheduleId: schedule.id });
            continue;
          }

          // Create new playlist (or update if it exists)
          // Note: Plex will create a new playlist with the same name if one exists
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
      failed++;
    }
  }

  return { executed, failed };
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
