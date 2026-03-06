/**
 * Daily Scraper Job
 * 
 * Scrapes popular playlists from external services daily and caches them.
 * This allows users to import popular playlists quickly without waiting for scraping.
 */

import { DatabaseService } from '../database/database';
import { logger } from '../utils/logger';
import { getDeezerCharts, scrapeAriaCharts } from './scrapers';

const SUPPORTED_COUNTRIES = ['global', 'us', 'gb', 'au', 'ca', 'de', 'fr', 'es', 'br', 'jp'];

/**
 * Scrape popular playlists from all supported services
 */
export async function runDailyScraperJob(db: DatabaseService): Promise<void> {
  logger.info('Starting daily scraper job');
  
  let totalScraped = 0;
  let totalFailed = 0;

  // Scrape Deezer charts for all supported countries
  for (const country of SUPPORTED_COUNTRIES) {
    try {
      logger.info(`Scraping Deezer charts for ${country}`);
      const playlists = await getDeezerCharts(country);
      
      for (const playlist of playlists) {
        try {
          db.saveCachedPlaylist(
            playlist.source,
            playlist.id,
            playlist.name,
            playlist.description,
            playlist.tracks
          );
          totalScraped++;
          logger.debug(`Cached playlist: ${playlist.name} (${playlist.tracks.length} tracks)`);
        } catch (error: any) {
          logger.error(`Failed to cache playlist ${playlist.name}`, { error: error.message });
          totalFailed++;
        }
      }
    } catch (error: any) {
      logger.error(`Failed to scrape Deezer charts for ${country}`, { error: error.message });
      totalFailed++;
    }
  }

  // Scrape ARIA charts (Australian charts)
  try {
    logger.info('Scraping ARIA charts');
    const ariaPlaylists = await scrapeAriaCharts();
    
    for (const playlist of ariaPlaylists) {
      try {
        db.saveCachedPlaylist(
          playlist.source,
          playlist.id,
          playlist.name,
          playlist.description,
          playlist.tracks
        );
        totalScraped++;
        logger.debug(`Cached playlist: ${playlist.name} (${playlist.tracks.length} tracks)`);
      } catch (error: any) {
        logger.error(`Failed to cache playlist ${playlist.name}`, { error: error.message });
        totalFailed++;
      }
    }
  } catch (error: any) {
    logger.error('Failed to scrape ARIA charts', { error: error.message });
    totalFailed++;
  }

  // Note: Other services (Spotify, Apple Music, Tidal, YouTube Music, Amazon Music, Qobuz)
  // require JavaScript rendering or official APIs which are not implemented in this basic version.
  // For production use, these should be added using:
  // 1. Official APIs (Spotify, Apple Music, Tidal)
  // 2. Puppeteer/Playwright for JavaScript-heavy sites
  // 3. Third-party scraping services

  logger.info('Daily scraper job completed', { 
    totalScraped, 
    totalFailed,
    timestamp: new Date().toISOString()
  });
}
