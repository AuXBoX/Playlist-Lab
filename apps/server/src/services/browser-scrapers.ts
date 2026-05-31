/**
 * Browser-based scrapers using Puppeteer
 * These scrapers use a headless browser to execute JavaScript and scrape content
 * Similar to how the desktop app uses Electron's BrowserWindow
 */

/// <reference lib="dom" />

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ExternalPlaylist } from './scrapers';
import { logger } from '../utils/logger';
import { logImportDebug } from '../utils/import-debug-logger';
import { EventEmitter } from 'events';
import { debugLog } from '../utils/debug-logger';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// Shared browser instance for better performance
let browserInstance: any = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

/**
 * Scrape Apple Music playlist using Puppeteer
 * Based on desktop app's BrowserWindow implementation
 */
export async function scrapeAppleMusicWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  debugLog('[Apple Music Browser] ========== SCRAPING STARTED ==========');
  debugLog('[Apple Music Browser] URL:', url);
  logger.info(`[Apple Music Browser] Scraping: ${url}`);
  
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading Apple Music page...'
  });
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for images to load - Apple Music loads images dynamically
    await page.waitForSelector('img', { timeout: 10000 }).catch(() => {
      logger.warn('[Apple Music Browser] No images found after 10s');
    });
    
    // Give extra time for high-res images to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Log page title for debugging
    const pageTitle = await page.title();
    logger.info(`[Apple Music Browser] Page title: ${pageTitle}`);
    
    // Execute the same scraping logic as the desktop app
    const result = await page.evaluate(() => {
      const tracks: { title: string; artist: string }[] = [];
      let playlistName = document.title.replace(' - Apple Music', '').trim() || 'Apple Music Playlist';
      let coverUrl = '';
      
      // Try to get playlist name from header
      const headerEl = document.querySelector('h1, [class*="playlist-name"], [class*="PlaylistHeader"]');
      if (headerEl) playlistName = headerEl.textContent?.trim() || playlistName;
      
      // Try to get cover image - Apple Music uses picture elements with source tags
      const allImages = Array.from(document.querySelectorAll('img'));
      const allPictures = Array.from(document.querySelectorAll('picture'));
      const allSources = Array.from(document.querySelectorAll('source'));
      
      // First try: Look for picture elements with source tags (modern Apple Music)
      for (const picture of allPictures) {
        const sources = Array.from(picture.querySelectorAll('source'));
        for (const source of sources) {
          const srcset = source.srcset || source.getAttribute('srcset') || '';
          if (srcset && srcset.includes('mzstatic.com')) {
            const srcsetParts = srcset.split(',').map((s: string) => s.trim());
            const lastPart = srcsetParts[srcsetParts.length - 1];
            coverUrl = lastPart.split(' ')[0];
            if (coverUrl) {
              coverUrl = coverUrl.replace(/\/\d+x\d+/, '/600x600');
              break;
            }
          }
        }
        if (coverUrl) break;
      }
      
      // Second try: Look for source elements directly
      if (!coverUrl) {
        for (const source of allSources) {
          const srcset = source.srcset || source.getAttribute('srcset') || '';
          if (srcset && srcset.includes('mzstatic.com')) {
            const srcsetParts = srcset.split(',').map((s: string) => s.trim());
            const lastPart = srcsetParts[srcsetParts.length - 1];
            coverUrl = lastPart.split(' ')[0];
            if (coverUrl) {
              coverUrl = coverUrl.replace(/\/\d+x\d+/, '/600x600');
              break;
            }
          }
        }
      }
      
      // Third try: Look for images with mzstatic.com in srcset
      if (!coverUrl) {
        for (const img of allImages) {
          const srcset = img.srcset || img.getAttribute('srcset') || '';
          if (srcset && srcset.includes('mzstatic.com')) {
            const srcsetParts = srcset.split(',').map((s: string) => s.trim());
            const lastPart = srcsetParts[srcsetParts.length - 1];
            coverUrl = lastPart.split(' ')[0];
            if (coverUrl) {
              coverUrl = coverUrl.replace(/\/\d+x\d+/, '/600x600');
              break;
            }
          }
        }
      }
      
      // Fourth try: Look for images with mzstatic.com in src (skip placeholders)
      if (!coverUrl) {
        for (const img of allImages) {
          const src = img.src || img.getAttribute('src') || '';
          if (src && src.includes('mzstatic.com') && !src.includes('1x1.gif') && !src.includes('placeholder')) {
            coverUrl = src.replace(/\/\d+x\d+/, '/600x600');
            break;
          }
        }
      }
      
      // Apple Music uses various selectors for track rows
      const selectors = [
        '[data-testid="track-row"]',
        '.songs-list-row',
        '.song-name-wrapper',
        '[class*="TrackRow"]',
        '[class*="song-list"] li',
        '.tracklist-item',
        'div[role="row"]'
      ];
      
      let items: NodeListOf<Element> | null = null;
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          items = found;
          break;
        }
      }
      
      if (items) {
        items.forEach(item => {
          // Try to find title
          const titleSelectors = [
            '[data-testid="track-title"]',
            '.songs-list-row__song-name',
            '.song-name',
            '[class*="TrackTitle"]',
            '[class*="song-name"]',
            'a[href*="/song/"]'
          ];
          
          const artistSelectors = [
            '[data-testid="track-subtitle"]',
            '.songs-list-row__by-line',
            '.song-artist',
            '[class*="TrackArtist"]',
            '[class*="artist"]',
            'a[href*="/artist/"]'
          ];
          
          let title = '';
          let artist = '';
          
          for (const sel of titleSelectors) {
            const el = item.querySelector(sel);
            if (el && el.textContent?.trim()) {
              title = el.textContent.trim();
              break;
            }
          }
          
          for (const sel of artistSelectors) {
            const el = item.querySelector(sel);
            if (el && el.textContent?.trim()) {
              artist = el.textContent.trim();
              break;
            }
          }
          
          if (title && artist) {
            tracks.push({ title, artist });
          }
        });
      }
      
      return { 
        name: playlistName, 
        tracks, 
        coverUrl, 
        imageCount: allImages.length,
        firstImageSrc: allImages[0]?.src || 'none',
        firstImageAlt: allImages[0]?.alt || 'none'
      };
    });
    
    debugLog('[Apple Music Browser] ========== PAGE EVALUATION COMPLETE ==========');
    debugLog('[Apple Music Browser] Playlist name:', result.name);
    debugLog('[Apple Music Browser] Track count:', result.tracks.length);
    debugLog('[Apple Music Browser] Image count:', result.imageCount);
    debugLog('[Apple Music Browser] First image src:', result.firstImageSrc);
    debugLog('[Apple Music Browser] First image alt:', result.firstImageAlt);
    debugLog('[Apple Music Browser] Cover URL:', result.coverUrl || 'EMPTY STRING OR UNDEFINED');
    debugLog('[Apple Music Browser] Cover URL type:', typeof result.coverUrl);
    debugLog('[Apple Music Browser] ===================================================');
    
    // Log the results from browser evaluation
    logImportDebug('=== APPLE MUSIC SCRAPING RESULTS ===', {
      url,
      imageCount: result.imageCount,
      firstImageSrc: result.firstImageSrc,
      firstImageAlt: result.firstImageAlt,
      coverUrl: result.coverUrl,
      hasCoverUrl: !!result.coverUrl,
      trackCount: result.tracks.length
    });
    
    logger.info(`[Apple Music Browser] ========== SCRAPING RESULTS ==========`);
    logger.info(`[Apple Music Browser] URL: ${url}`);
    logger.info(`[Apple Music Browser] Found ${result.imageCount} total images`);
    logger.info(`[Apple Music Browser] First image: src=${result.firstImageSrc}, alt=${result.firstImageAlt}`);
    logger.info(`[Apple Music Browser] Cover URL extracted: ${result.coverUrl || 'NONE - NO COVER URL FOUND'}`);
    logger.info(`[Apple Music Browser] Found ${result.tracks.length} tracks`);
    
    // If no cover URL found, log page HTML for debugging
    if (!result.coverUrl) {
      const html = await page.content();
      const imageTagsMatch = html.match(/<img[^>]*mzstatic[^>]*>/g);
      logger.info(`[Apple Music Browser] Found ${imageTagsMatch?.length || 0} mzstatic img tags in HTML`);
      logImportDebug('=== NO COVER URL - MZSTATIC IMG TAGS IN HTML ===', {
        mzstaticImgTagCount: imageTagsMatch?.length || 0,
        first3MzstaticImgTags: imageTagsMatch?.slice(0, 3) || []
      });
      if (imageTagsMatch && imageTagsMatch.length > 0) {
        logger.info(`[Apple Music Browser] First 3 mzstatic img tags:`, imageTagsMatch.slice(0, 3));
      }
    }
    
    logger.info(`[Apple Music Browser] ========================================`);
    
    // Emit final scraping progress with total count
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: result.tracks.length,
      total: result.tracks.length,
      currentTrackName: `Found ${result.tracks.length} tracks`
    });
    
    await page.close();
    
    // Extract playlist ID from URL
    const match = url.match(/playlist\/[^/]+\/(pl\.[a-zA-Z0-9-]+)/);
    const playlistId = match ? match[1] : 'unknown';
    
    // If no cover URL was found from page scraping, construct one from Apple Music CDN
    // Apple Music playlist covers follow a predictable pattern
    let finalCoverUrl = result.coverUrl;
    if (!finalCoverUrl && playlistId !== 'unknown') {
      // Use Apple Music's artwork URL pattern
      // Format: https://is1-ssl.mzstatic.com/image/thumb/Features/[hash]/[size].jpg
      // Since we can't get the hash without the page, use a generic music note icon or the first track's album art
      debugLog('[Apple Music Browser] No cover URL found, will use placeholder');
      // For now, leave it undefined - the frontend will show the gradient background
      finalCoverUrl = undefined;
    }
    
    const finalResult = {
      id: `apple-${playlistId}`,
      name: result.name,
      description: '',
      source: 'apple',
      tracks: result.tracks,
      coverUrl: finalCoverUrl,
    };
    
    debugLog('[Apple Music Browser] ========== RETURNING RESULT ==========');
    debugLog('[Apple Music Browser] Playlist:', finalResult.name);
    debugLog('[Apple Music Browser] Tracks:', finalResult.tracks.length);
    debugLog('[Apple Music Browser] Cover URL:', finalResult.coverUrl || 'NONE');
    debugLog('[Apple Music Browser] ================================================');
    
    return finalResult;
  } catch (error) {
    await page.close();
    logger.error('[Apple Music Browser] Error:', error);
    throw error;
  }
}

/**
 * Scrape YouTube Music playlist using Puppeteer
 */
export async function scrapeYouTubeMusicWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  logger.info(`[YouTube Music Browser] Scraping: ${url}`);
  
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading YouTube Music page...'
  });
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: 0,
      total: 0,
      currentTrackName: 'Navigating to playlist...'
    });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: 0,
      total: 0,
      currentTrackName: 'Waiting for playlist to load...'
    });
    
    // Wait for the detail header to appear (this means the playlist loaded)
    try {
      await page.waitForSelector('ytmusic-detail-header-renderer', { timeout: 10000 });
      logger.info(`[YouTube Music Browser] Detail header found`);
    } catch (err) {
      logger.warn(`[YouTube Music Browser] Detail header not found, continuing anyway`);
    }
    
    // Give extra time for images and dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: 0,
      total: 0,
      currentTrackName: 'Extracting playlist data...'
    });
    
    const result = await page.evaluate(() => {
      const tracks: { title: string; artist: string }[] = [];
      let playlistName = '';
      let coverUrl = '';
      
      // Try to get playlist name from the detail header
      const detailHeader = document.querySelector('ytmusic-detail-header-renderer');
      if (detailHeader) {
        // Try multiple selectors for the title
        const titleSelectors = [
          'h2.title yt-formatted-string',
          'yt-formatted-string.title',
          'h2.title',
          '.title yt-formatted-string',
          '.title'
        ];
        
        for (const selector of titleSelectors) {
          const el = detailHeader.querySelector(selector);
          if (el && el.textContent?.trim()) {
            const text = el.textContent.trim();
            // Skip generic text
            if (text !== 'Home' && text !== 'YouTube Music' && text.length > 0) {
              playlistName = text;
              break;
            }
          }
        }
      }
      
      // Fallback: try h2 elements outside detail header
      if (!playlistName) {
        const h2Elements = document.querySelectorAll('h2');
        for (let i = 0; i < h2Elements.length; i++) {
          const h2 = h2Elements[i];
          const text = h2.textContent?.trim();
          if (text && text !== 'Home' && text !== 'YouTube Music' && text.length > 0 && text.length < 100) {
            playlistName = text;
            break;
          }
        }
      }
      
      // Last resort: use page title
      if (!playlistName) {
        playlistName = document.title.replace(' - YouTube Music', '').replace(' - YouTube', '').trim();
        if (playlistName === 'Home' || playlistName === 'YouTube Music' || !playlistName) {
          playlistName = 'YouTube Music Playlist';
        }
      }
      
      // Try to get cover art from detail header
      if (detailHeader) {
        const headerImg = detailHeader.querySelector('img');
        if (headerImg) {
          const src = headerImg.getAttribute('src') || headerImg.src;
          // Skip channel avatars (yt3.ggpht.com) and data URIs
          if (src && !src.includes('data:image') && !src.includes('yt3.ggpht.com')) {
            // Remove size parameters to get full quality
            coverUrl = src.split('=')[0];
          }
        }
      }
      
      // Fallback: find the largest square image (playlist covers are square)
      if (!coverUrl) {
        const allImages = Array.from(document.querySelectorAll('img'));
        let largestSquareImg: HTMLImageElement | null = null;
        let largestSize = 0;
        
        for (const img of allImages) {
          const src = img.getAttribute('src') || img.src;
          // Skip channel avatars, data URIs, and icons
          if (src && !src.includes('data:image') && !src.includes('yt3.ggpht.com') && !src.includes('icon')) {
            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;
            
            // Look for square images (playlist covers are usually square)
            const isSquare = Math.abs(width - height) < 50;
            const size = width * height;
            
            if (isSquare && size > largestSize && size > 10000) { // At least 100x100
              largestSize = size;
              largestSquareImg = img;
            }
          }
        }
        
        if (largestSquareImg) {
          const src = largestSquareImg.getAttribute('src') || largestSquareImg.src;
          coverUrl = src.split('=')[0];
        }
      }
      
      // YouTube Music track selectors
      const items = document.querySelectorAll('ytmusic-responsive-list-item-renderer, ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer');
      
      items.forEach(item => {
        const titleEl = item.querySelector('.title a, .title');
        const artistEl = item.querySelector('.secondary-flex-columns a, .secondary-flex-columns');
        
        const title = titleEl?.textContent?.trim();
        const artist = artistEl?.textContent?.trim();
        
        if (title && artist) {
          tracks.push({ title, artist });
        }
      });
      
      return { name: playlistName, tracks, coverUrl };
    });
    
    // Emit final scraping progress with total count
    logger.info(`[YouTube Music Browser] Scraping complete:`, {
      playlistName: result.name,
      trackCount: result.tracks.length,
      coverUrl: result.coverUrl || 'NONE',
      hasCoverUrl: !!result.coverUrl
    });
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: result.tracks.length,
      total: result.tracks.length,
      currentTrackName: `Found ${result.tracks.length} tracks`,
      coverUrl: result.coverUrl,
      playlistName: result.name
    });
    
    await page.close();
    
    logger.info(`[YouTube Music Browser] Found ${result.tracks.length} tracks`);
    
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const playlistId = match ? match[1] : 'unknown';
    
    return {
      id: `youtube-${playlistId}`,
      name: result.name,
      description: '',
      source: 'youtube',
      tracks: result.tracks,
      coverUrl: result.coverUrl,
    };
  } catch (error) {
    await page.close();
    logger.error('[YouTube Music Browser] Error:', error);
    throw error;
  }
}

/**
 * Scrape Tidal playlist using Puppeteer
 */
export async function scrapeTidalWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  logger.info(`[Tidal Browser] Scraping: ${url}`);
  
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading Tidal page...'
  });
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = await page.evaluate(() => {
      const tracks: { title: string; artist: string }[] = [];
      let playlistName = '';
      
      // Try to get playlist name from various elements
      const titleEl = document.querySelector('h1, [data-test="playlist-title"], [class*="PlaylistTitle"]');
      if (titleEl) playlistName = titleEl.textContent?.trim() || '';
      if (!playlistName) {
        playlistName = document.title.replace(' - TIDAL', '').replace(' | TIDAL', '').replace(' - Playlist by', '').trim();
      }
      
      // Method 1: Look for track rows with data attributes
      document.querySelectorAll('[data-test="tracklist-row"], [class*="TrackRow"], [class*="track-row"]').forEach(row => {
        const titleEl = row.querySelector('[data-test="table-cell-title"] a, [class*="TrackTitle"] a, a[href*="/track/"]');
        const artistEl = row.querySelector('[data-test="table-cell-artist"] a, [class*="ArtistName"] a, a[href*="/artist/"]');
        if (titleEl && artistEl) {
          const title = titleEl.textContent?.trim();
          const artist = artistEl.textContent?.trim();
          if (title && artist && !tracks.some(t => t.title === title && t.artist === artist)) {
            tracks.push({ title, artist });
          }
        }
      });
      
      // Method 2: Find track links and their parent containers
      if (tracks.length === 0) {
        document.querySelectorAll('a[href*="/track/"]').forEach(link => {
          const title = link.textContent?.trim();
          if (!title || title.length > 100) return;
          
          const container = link.closest('div, li, tr, article');
          if (container) {
            const artistLink = container.querySelector('a[href*="/artist/"]');
            if (artistLink) {
              const artist = artistLink.textContent?.trim();
              if (artist && !tracks.some(t => t.title === title && t.artist === artist)) {
                tracks.push({ title, artist });
              }
            }
          }
        });
      }
      
      return { name: playlistName || 'Tidal Playlist', tracks };
    });
    
    // Emit final scraping progress with total count
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: result.tracks.length,
      total: result.tracks.length,
      currentTrackName: `Found ${result.tracks.length} tracks`
    });
    
    await page.close();
    
    logger.info(`[Tidal Browser] Found ${result.tracks.length} tracks`);
    
    const match = url.match(/playlist\/([a-f0-9-]+)/i);
    const playlistId = match ? match[1] : 'unknown';
    
    return {
      id: `tidal-${playlistId}`,
      name: result.name,
      description: '',
      source: 'tidal',
      tracks: result.tracks,
    };
  } catch (error) {
    await page.close();
    logger.error('[Tidal Browser] Error:', error);
    throw error;
  }
}

/**
 * Scrape Amazon Music playlist using Puppeteer
 */
export async function scrapeAmazonMusicWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  logger.info(`[Amazon Music Browser] Scraping: ${url}`);
  
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading Amazon Music page...'
  });
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = await page.evaluate(() => {
      const tracks: { title: string; artist: string }[] = [];
      let playlistName = document.querySelector('h1, [data-testid="playlistHeaderTitle"], .playlistHeaderTitle')?.textContent?.trim() || 'Amazon Music Playlist';
      
      // Find track rows
      document.querySelectorAll('[data-testid="tracklist-row"], .trackListRow, tr[class*="track"]').forEach(row => {
        const titleEl = row.querySelector('[data-testid="track-title"], .trackTitle, td:nth-child(2)');
        const artistEl = row.querySelector('[data-testid="track-artist"], .trackArtist, td:nth-child(3)');
        
        if (titleEl) {
          const title = titleEl.textContent?.trim();
          const artist = artistEl?.textContent?.trim() || 'Unknown';
          if (title && !tracks.some(t => t.title === title && t.artist === artist)) {
            tracks.push({ title, artist });
          }
        }
      });
      
      return { name: playlistName, tracks };
    });
    
    // Emit final scraping progress with total count
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: result.tracks.length,
      total: result.tracks.length,
      currentTrackName: `Found ${result.tracks.length} tracks`
    });
    
    await page.close();
    
    logger.info(`[Amazon Music Browser] Found ${result.tracks.length} tracks`);
    
    const match = url.match(/playlists\/([A-Z0-9]+)/i);
    const playlistId = match ? match[1] : 'unknown';
    
    return {
      id: `amazon-${playlistId}`,
      name: result.name,
      description: '',
      source: 'amazon',
      tracks: result.tracks,
    };
  } catch (error) {
    await page.close();
    logger.error('[Amazon Music Browser] Error:', error);
    throw error;
  }
}

/**
 * Scrape Qobuz playlist using Puppeteer
 */
export async function scrapeQobuzWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  logger.info(`[Qobuz Browser] Scraping: ${url}`);
  
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading Qobuz page...'
  });
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = await page.evaluate(() => {
      const tracks: { title: string; artist: string }[] = [];
      let playlistName = document.querySelector('h1, .playlist-title, [class*="PlaylistTitle"]')?.textContent?.trim() || 'Qobuz Playlist';
      
      // Find track rows
      document.querySelectorAll('.track-row, [class*="TrackRow"], tr[class*="track"]').forEach(row => {
        const titleEl = row.querySelector('.track-title, [class*="TrackTitle"], td:nth-child(2)');
        const artistEl = row.querySelector('.track-artist, [class*="ArtistName"], td:nth-child(3)');
        
        if (titleEl) {
          const title = titleEl.textContent?.trim();
          const artist = artistEl?.textContent?.trim() || 'Unknown';
          if (title && !tracks.some(t => t.title === title && t.artist === artist)) {
            tracks.push({ title, artist });
          }
        }
      });
      
      return { name: playlistName, tracks };
    });
    
    // Emit final scraping progress with total count
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: result.tracks.length,
      total: result.tracks.length,
      currentTrackName: `Found ${result.tracks.length} tracks`
    });
    
    await page.close();
    
    logger.info(`[Qobuz Browser] Found ${result.tracks.length} tracks`);
    
    const match = url.match(/playlist\/([0-9]+)/i);
    const playlistId = match ? match[1] : 'unknown';
    
    return {
      id: `qobuz-${playlistId}`,
      name: result.name,
      description: '',
      source: 'qobuz',
      tracks: result.tracks,
    };
  } catch (error) {
    await page.close();
    logger.error('[Qobuz Browser] Error:', error);
    throw error;
  }
}

/**
 * Scrape ARIA chart page
 */
export async function scrapeAriaChartWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  logger.info(`[ARIA Browser] Scraping: ${url}`);

  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading ARIA chart page...'
  });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Intercept API responses that might contain chart data
    const apiResponses: any[] = [];
    page.on('response', async (response: any) => {
      const responseUrl = response.url();
      if (responseUrl.includes('api') || responseUrl.includes('chart') || responseUrl.includes('json')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const data = await response.json();
            apiResponses.push({ url: responseUrl, data });
          }
        } catch { /* ignore non-json */ }
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.info(`[ARIA Browser] Intercepted ${apiResponses.length} API responses`);

    // Try to extract tracks from intercepted API data first
    let tracks: { title: string; artist: string }[] = [];
    let chartName = 'ARIA Chart';

    for (const resp of apiResponses) {
      logger.info(`[ARIA Browser] API: ${resp.url.substring(0, 100)}`);
      const data = resp.data;
      const findTracks = (obj: any, depth = 0): { title: string; artist: string }[] => {
        if (depth > 5) return [];
        if (Array.isArray(obj) && obj.length >= 10 && obj.length <= 200) {
          const first = obj[0];
          if (first && typeof first === 'object') {
            const keys = Object.keys(first).map(k => k.toLowerCase());
            const hasTitle = keys.some(k => k.includes('title') || k.includes('name') || k.includes('song'));
            if (hasTitle) {
              return obj.map((item: any) => {
                const titleKey = Object.keys(item).find(k => /title|name|song/i.test(k) && typeof item[k] === 'string');
                const artistKey = Object.keys(item).find(k => /artist|performer/i.test(k) && (typeof item[k] === 'string' || typeof item[k] === 'object'));
                let artist = 'Unknown';
                if (artistKey) {
                  artist = typeof item[artistKey] === 'string' ? item[artistKey] : item[artistKey]?.name || 'Unknown';
                }
                return { title: item[titleKey!] || 'Unknown', artist };
              }).filter((t: { title: string; artist: string }) => t.title !== 'Unknown');
            }
          }
        }
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const val of Object.values(obj)) {
            const found = findTracks(val, depth + 1);
            if (found.length >= 10) return found;
          }
        }
        return [];
      };
      const found = findTracks(data);
      if (found.length > tracks.length) {
        tracks = found;
      }
    }

    // If API interception didn't work, fall back to DOM scraping
    if (tracks.length === 0) {
      logger.info(`[ARIA Browser] No API data found, falling back to DOM scraping`);

      const result = await page.evaluate(() => {
        const tracks: { title: string; artist: string }[] = [];
        const chartName = document.querySelector('h1')?.textContent?.trim() || 'ARIA Chart';

        // Strategy: Find all elements whose text is exactly a chart position number (1-100).
        // Each chart entry has a position number, a title, and an artist.
        // Walk up from the position number to find the chart row, then extract title/artist.

        // First, find all text nodes or elements that contain just a number 1-100
        // These are chart position indicators
        const allElements = Array.from(document.querySelectorAll('*'));
        const chartRows: { position: number; element: Element }[] = [];

        for (const el of allElements) {
          // Only consider leaf-ish elements (no deeply nested children with numbers)
          const text = el.textContent?.trim() || '';
          // Must be exactly a number 1-100 with no other text
          if (/^\d+$/.test(text)) {
            const num = parseInt(text, 10);
            if (num >= 1 && num <= 100) {
              // Check this element is small (just the number, not a big container)
              const children = el.children;
              if (children.length === 0 || (children.length === 1 && (children[0].textContent?.trim() || '') === text)) {
                // Walk up to find the chart row (a parent that contains title + artist info)
                let row = el.parentElement;
                for (let depth = 0; depth < 6 && row; depth++) {
                  const rowText = row.innerText || row.textContent || '';
                  // A chart row should contain "last week" or "peak" or "weeks in" stats
                  if (/last week|peak|weeks? in/i.test(rowText)) {
                    // Check we haven't already captured this row for a different position
                    const alreadyCaptured = chartRows.some(r => r.element === row || r.element.contains(row!) || row!.contains(r.element));
                    if (!alreadyCaptured) {
                      chartRows.push({ position: num, element: row });
                    }
                    break;
                  }
                  row = row.parentElement;
                }
              }
            }
          }
        }

        // Sort by position
        chartRows.sort((a, b) => a.position - b.position);

        // Deduplicate - keep only the first occurrence of each position
        const seen = new Set<number>();
        const uniqueRows = chartRows.filter(r => {
          if (seen.has(r.position)) return false;
          seen.add(r.position);
          return true;
        });

        // Extract title and artist from each row
        for (const { element } of uniqueRows) {
          const rowText = (element as HTMLElement).innerText || element.textContent || '';
          const lines = rowText.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);

          // Filter out: position numbers, stats lines, empty lines
          const meaningful = lines.filter(l => {
            if (/^\d+$/.test(l)) return false; // pure number (position)
            if (/^\d+\s*(last week|peak|weeks? in)/i.test(l)) return false; // stats
            if (/^(last week|peak|weeks? in|new)/i.test(l)) return false; // stats labels
            if (/^-$/i.test(l)) return false; // dash
            if (l.length < 2 || l.length > 150) return false;
            return true;
          });

          if (meaningful.length >= 2) {
            // First meaningful line is title, second is artist
            const title = meaningful[0];
            // For multiple artists, just use the first one
            let artist = meaningful[1];
            // Clean up artist - sometimes has "feat." or "&" etc, just take first artist
            artist = artist.split(/\s*[,&]\s*/)[0].replace(/\s*feat\.?\s*.*/i, '').trim();
            if (title && artist) {
              tracks.push({ title, artist });
            }
          } else if (meaningful.length === 1) {
            // Try splitting by dash
            const parts = meaningful[0].split(/\s*[-–—]\s*/);
            if (parts.length >= 2) {
              tracks.push({ title: parts[0].trim(), artist: parts[1].trim() });
            }
          }
        }

        return {
          name: chartName,
          tracks,
          debug: `found ${chartRows.length} raw rows, ${uniqueRows.length} unique positions, ${tracks.length} tracks`
        };
      });

      tracks = result.tracks;
      chartName = result.name;
      logger.info(`[ARIA Browser] DOM scraping result: ${tracks.length} tracks, debug: ${result.debug}`);
    } else {
      chartName = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || 'ARIA Chart');
    }

    if (tracks.length > 0) {
      logger.info(`[ARIA Browser] Sample tracks: ${JSON.stringify(tracks.slice(0, 3))}, total: ${tracks.length}`);
    }

    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: tracks.length,
      total: tracks.length,
      currentTrackName: `Found ${tracks.length} tracks`
    });

    await page.close();

    const urlPath = new URL(url).pathname;
    const chartId = urlPath.replace(/\//g, '-').replace(/^-|-$/g, '');

    return {
      id: `aria-${chartId}`,
      name: chartName,
      description: '',
      source: 'aria',
      tracks,
    };
  } catch (error) {
    await page.close();
    logger.error('[ARIA Browser] Error:', error);
    throw error;
  }
}

/**
 * Scrape Official Charts UK page
 * NOTE: Official Charts actively blocks automated scraping.
 * This function is kept for reference but may not work reliably.
 */
/**
 * Billboard chart scraping using GitHub data source
 * 
 * Instead of scraping Billboard.com (which blocks automation), we use a public
 * GitHub repository that provides daily-updated Billboard Hot 100 data as JSON.
 * 
 * Data source: https://github.com/mhollingshead/billboard-hot-100
 * This repository is updated daily and provides historical data back to 1958.
 */
export async function scrapeBillboardChart(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  logger.info(`[Billboard] Fetching chart data from GitHub: ${url}`);

  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Billboard chart data...'
  });

  try {
    // Parse the chart type and date from URL
    // Expected formats:
    // - https://www.billboard.com/charts/hot-100/
    // - https://www.billboard.com/charts/hot-100/2024-03-15/
    
    const chartMatch = url.match(/\/charts\/([^/]+)/);
    if (!chartMatch) {
      throw new Error('Invalid Billboard chart URL');
    }
    
    const chartType = chartMatch[1];
    const dateMatch = url.match(/\/(\d{4}-\d{2}-\d{2})\/?$/);
    
    // Currently only Hot 100 is supported via the GitHub data source
    if (chartType !== 'hot-100') {
      throw new Error(
        `Billboard ${chartType} chart is not currently supported. ` +
        'Only the Hot 100 chart is available at this time. ' +
        '\n\nAlternative chart sources:\n' +
        '• Spotify Charts - Available in the Import page\n' +
        '• Deezer Charts - Available in the Import page\n' +
        '• ARIA Charts - For Australian music (if country set to AU)'
      );
    }
    
    // Determine which JSON file to fetch
    let dataUrl: string;
    let chartDate: string;
    
    if (dateMatch) {
      // Specific date requested
      chartDate = dateMatch[1];
      dataUrl = `https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/date/${chartDate}.json`;
    } else {
      // Most recent chart
      chartDate = 'current';
      dataUrl = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/recent.json';
    }
    
    logger.info(`[Billboard] Fetching from: ${dataUrl}`);
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: 0,
      total: 0,
      currentTrackName: 'Downloading chart data...'
    });
    
    // Fetch the JSON data
    const axios = (await import('axios')).default;
    const response = await axios.get(dataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response from Billboard data source');
    }
    
    const chartData = response.data;
    const tracks: { title: string; artist: string }[] = [];
    
    // Convert the chart data to our format
    for (const entry of chartData.data) {
      if (entry.song && entry.artist) {
        tracks.push({
          title: entry.song,
          artist: entry.artist,
        });
      }
    }
    
    logger.info(`[Billboard] Successfully fetched ${tracks.length} tracks`);
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: tracks.length,
      total: tracks.length,
      currentTrackName: `Found ${tracks.length} tracks`
    });
    
    // Format the playlist name
    const displayDate = chartDate === 'current' 
      ? chartData.date 
      : chartDate;
    const playlistName = `Billboard Hot 100 - ${displayDate}`;
    
    return {
      id: `billboard-hot-100-${chartData.date}`,
      name: playlistName,
      description: `Billboard Hot 100 chart for the week of ${chartData.date}`,
      source: 'billboard',
      tracks,
    };
  } catch (error) {
    // Extract error message safely without circular references
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = (error as any)?.response?.status;
    
    logger.error('[Billboard] Error fetching chart:', { message: errorMessage, statusCode });
    
    // Provide helpful error messages
    if (statusCode === 404 || errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      throw new Error(
        'Billboard chart not found for the specified date. ' +
        'Charts are dated for Saturdays and may not be available for the current week yet. ' +
        'Please try a previous Saturday date in YYYY-MM-DD format.'
      );
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      throw new Error(
        'Failed to connect to Billboard data source. ' +
        'Please check your internet connection and try again.'
      );
    }
    
    throw new Error(`Failed to fetch Billboard chart: ${errorMessage}`);
  }
}


/**
 * Scrape Spotify playlist using Puppeteer with DOM scrolling
 * Extracts up to ~1000+ tracks by loading the main playlist page and scrolling through the track list.
 * No login required for public playlists.
 * 
 * Strategy:
 * 1. Load main playlist page with a tall viewport (renders ~82 tracks initially)
 * 2. Extract track names/artists from DOM aria-labels
 * 3. Scroll the track list to trigger lazy-loading of more tracks
 * 4. Repeat until no new tracks appear
 */
export async function scrapeSpotifyWithBrowser(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  debugLog('[Spotify Browser] ========== SCRAPING STARTED ==========');
  debugLog('[Spotify Browser] URL:', url);
  logger.info(`[Spotify Browser] Scraping: ${url}`);
  
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Loading Spotify playlist...'
  });
  
  // Extract playlist ID from URL
  const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!playlistMatch) {
    throw new Error('Invalid Spotify playlist URL');
  }
  const playlistId = playlistMatch[1];
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Use a tall viewport to render more tracks initially (~82 vs ~30 with default)
    await page.setViewport({ width: 1920, height: 4000 });
    
    // Navigate to the main playlist page (not embed - embed caps at 100)
    const mainUrl = `https://open.spotify.com/playlist/${playlistId}`;
    await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for track list to render
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get playlist name from page title
    const pageTitle = await page.title();
    const playlistName = pageTitle.replace(/ - playlist by .+ \| Spotify$/, '') || 'Spotify Playlist';
    logger.info(`[Spotify Browser] Page title: ${pageTitle}`);
    
    // Extract tracks from DOM using aria-labels on the "more options" and "play" buttons
    const extractVisibleTracks = async () => {
      return await page.evaluate(() => {
        const tracks: Array<{ title: string; artist: string }> = [];
        const rows = document.querySelectorAll('[data-testid="tracklist-row"]');
        rows.forEach(row => {
          // Try "More options for X by Y" aria-label
          const moreBtn = row.querySelector('[aria-label*="More options for"]');
          if (moreBtn) {
            const label = moreBtn.getAttribute('aria-label') || '';
            const match = label.match(/More options for (.+) by (.+)/);
            if (match) {
              tracks.push({ title: match[1], artist: match[2] });
              return;
            }
          }
          // Fallback: "Play X by Y" aria-label
          const playBtn = row.querySelector('[aria-label*="Play "]');
          if (playBtn) {
            const label = playBtn.getAttribute('aria-label') || '';
            const match = label.match(/Play (.+) by (.+)/);
            if (match) {
              tracks.push({ title: match[1], artist: match[2] });
            }
          }
        });
        return tracks;
      });
    };
    
    // Use a Map to deduplicate tracks (keyed by title|artist)
    const allTracks = new Map<string, { title: string; artist: string }>();
    
    // Extract initial tracks
    const initialTracks = await extractVisibleTracks() as Array<{ title: string; artist: string }>;
    initialTracks.forEach((t: { title: string; artist: string }) => allTracks.set(`${t.title}|${t.artist}`, t));
    logger.info(`[Spotify Browser] Initial tracks: ${allTracks.size}`);
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: allTracks.size,
      total: 0,
      currentTrackName: `Found ${allTracks.size} tracks, scrolling for more...`
    });
    
    // Scroll through the track list to load more
    let lastCount = allTracks.size;
    let noProgressCount = 0;
    
    for (let scroll = 0; scroll < 150; scroll++) {
      // Scroll all scrollable containers
      await page.evaluate(() => {
        document.querySelectorAll('div').forEach(el => {
          if (el.scrollHeight > el.clientHeight + 100) {
            el.scrollBy(0, 800);
          }
        });
        window.scrollBy(0, 800);
      });
      
      // Small delay for lazy-loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Extract newly visible tracks
      const visible = await extractVisibleTracks() as Array<{ title: string; artist: string }>;
      visible.forEach((t: { title: string; artist: string }) => allTracks.set(`${t.title}|${t.artist}`, t));
      
      // Progress update every 10 scrolls
      if (scroll % 10 === 9) {
        logger.info(`[Spotify Browser] Scroll ${scroll + 1}: ${allTracks.size} unique tracks`);
        progressEmitter?.emit('progress', {
          type: 'progress',
          phase: 'scraping',
          current: allTracks.size,
          total: 0,
          currentTrackName: `Found ${allTracks.size} tracks...`
        });
        
        if (allTracks.size === lastCount) {
          noProgressCount++;
          if (noProgressCount >= 2) {
            logger.info('[Spotify Browser] No new tracks after 20 scrolls, stopping');
            break;
          }
        } else {
          noProgressCount = 0;
        }
        lastCount = allTracks.size;
      }
    }
    
    // Try to get cover art from the page
    let coverUrl: string | undefined;
    try {
      coverUrl = await page.evaluate(() => {
        const img = document.querySelector('[data-testid="playlist-image"] img') || 
                    document.querySelector('img[alt*="playlist"]') ||
                    document.querySelector('[data-encore-id="playlist"] img');
        return img?.getAttribute('src') || undefined;
      });
    } catch {}
    
    const tracks = Array.from(allTracks.values());
    
    logger.info(`[Spotify Browser] Successfully scraped ${tracks.length} tracks from ${playlistName}`);
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: tracks.length,
      total: tracks.length,
      currentTrackName: `Found ${tracks.length} tracks`
    });
    
    return {
      id: `spotify-${playlistId}`,
      name: playlistName,
      description: '',
      source: 'spotify',
      tracks,
      coverUrl,
    };
  } finally {
    await page.close().catch(() => {});
  }
}


/**
 * Scrape all public playlists from a Spotify user profile
 * Navigates to /user/{userId}/playlists with a tall viewport to load all playlists at once.
 * No login required.
 */
export async function scrapeSpotifyUserPlaylists(userId: string): Promise<Array<{ name: string; url: string; imageUrl?: string }>> {
  debugLog('[Spotify Browser] Scraping user playlists for:', userId);
  logger.info(`[Spotify Browser] Scraping user playlists: ${userId}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 4000 });
    
    const profileUrl = `https://open.spotify.com/user/${encodeURIComponent(userId)}/playlists`;
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if page loaded successfully
    const pageTitle = await page.title();
    if (pageTitle.includes('Page not found') || pageTitle.includes('404')) {
      throw new Error(`Spotify user "${userId}" not found`);
    }
    
    // Extract all playlist links with cover images
    const playlists = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/playlist/"]')).map(a => {
        const el = a as HTMLAnchorElement;
        const img = el.querySelector('img');
        return {
          href: el.getAttribute('href') || '',
          name: (el.innerText || '').trim().split('\n')[0] || '',
          imageUrl: img ? (img.src || img.getAttribute('src') || '') : '',
        };
      }).filter(l => l.name && l.href && !l.href.includes('?'));
      
      // Deduplicate by href
      const seen = new Set<string>();
      return links.filter(l => {
        if (seen.has(l.href)) return false;
        seen.add(l.href);
        return true;
      }).map(l => ({
        name: l.name,
        url: l.href.startsWith('/') ? `https://open.spotify.com${l.href}` : l.href,
        imageUrl: l.imageUrl || undefined,
      }));
    }) as Array<{ name: string; url: string; imageUrl?: string }>;
    
    // Scroll a bit to load any lazily-loaded playlists
    if (playlists.length < 10) {
      await page.evaluate(() => {
        document.querySelectorAll('div').forEach(el => {
          if (el.scrollHeight > el.clientHeight + 100) el.scrollBy(0, 600);
        });
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Re-extract after potential scroll with cover images
    const allPlaylists = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/playlist/"]')).map(a => {
        const el = a as HTMLAnchorElement;
        const img = el.querySelector('img');
        return {
          href: el.getAttribute('href') || '',
          name: (el.innerText || '').trim().split('\n')[0] || '',
          imageUrl: img ? (img.src || img.getAttribute('src') || '') : '',
        };
      }).filter(l => l.name && l.href && !l.href.includes('?'));
      
      const seen = new Set<string>();
      return links.filter(l => {
        if (seen.has(l.href)) return false;
        seen.add(l.href);
        return true;
      }).map(l => ({
        name: l.name,
        url: l.href.startsWith('/') ? `https://open.spotify.com${l.href}` : l.href,
        imageUrl: l.imageUrl || undefined,
      }));
    }) as Array<{ name: string; url: string; imageUrl?: string }>;
    
    logger.info(`[Spotify Browser] Found ${allPlaylists.length} playlists for user ${userId}`);
    return allPlaylists;
  } finally {
    await page.close().catch(() => {});
  }
}


/**
 * Clean up browser instance
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

