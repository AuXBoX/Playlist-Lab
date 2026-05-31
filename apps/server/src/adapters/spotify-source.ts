/**
 * Spotify Source Adapter
 *
 * Implements SourceAdapter for Spotify.
 * Uses the existing getSpotifyToken helper from spotify-auth.ts to authenticate.
 * Supports listing playlists and fetching tracks from a playlist URL or ID.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { getSpotifyToken } from '../routes/spotify-auth';
import { logger } from '../utils/logger';
import { execFile } from 'child_process';

/** Extract a Spotify playlist ID from a URL or return the value as-is if it's already an ID */
function extractPlaylistId(urlOrId: string): string {
  // Match https://open.spotify.com/playlist/{id} or spotify:playlist:{id}
  const urlMatch = urlOrId.match(/playlist[/:]([A-Za-z0-9]+)/);
  return urlMatch ? urlMatch[1] : urlOrId;
}

/**
 * Search for public Spotify playlists without authentication.
 * Uses Spotify's embed API which doesn't require OAuth.
 * Also supports fetching playlists by user ID.
 */
async function searchPlaylistsUnauthenticated(query: string): Promise<PlaylistInfo[]> {
  try {
    // Check if query is a user ID or user URL
    const userIdMatch = query.match(/(?:user\/|^)([a-zA-Z0-9]+)$/);
    if (userIdMatch) {
      const userId = userIdMatch[1];
      logger.info('[SpotifySourceAdapter] Fetching playlists for user', { userId });
      const result = await fetchUserPlaylistsUnauthenticated(userId);
      // Return just the playlists array for backward compatibility with searchPlaylists
      return result.playlists;
    }

    // Try to extract playlist ID from URL if it's a direct link
    const playlistIdMatch = query.match(/playlist[/:]([A-Za-z0-9]+)/);
    if (playlistIdMatch) {
      const playlistId = playlistIdMatch[1];
      // Fetch playlist info using embed API
      const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
      const response = await fetch(embedUrl);
      if (response.ok) {
        const html = await response.text();
        // Extract playlist name from HTML
        const nameMatch = html.match(/<title>([^<]+)<\/title>/);
        const name = nameMatch ? nameMatch[1].replace(' - playlist by Spotify', '').trim() : 'Spotify Playlist';
        
        return [{
          id: playlistId,
          name,
          trackCount: 0, // Can't get track count without auth
          coverUrl: undefined,
        }];
      }
    }

    // For search queries, we can't do much without auth
    // Return empty array and let the user know they need to provide a direct link
    logger.warn('[SpotifySourceAdapter] Unauthenticated search requires direct playlist URL or user ID', { query });
    return [];
  } catch (error) {
    logger.error('[SpotifySourceAdapter] Unauthenticated search failed', { error, query });
    return [];
  }
}

/**
 * Fetch a Spotify user's profile HTML via curl (HTTP/1.1 + short User-Agent).
 * Returns SSR HTML that contains playlist data in the initialState script tag.
 */
function fetchSpotifyHtml(url: string): Promise<{ html: string; status: number }> {
  return new Promise((resolve, reject) => {
    const curlBin = process.platform === 'win32'
      ? 'C:\\Windows\\System32\\curl.exe'
      : 'curl';
    execFile(curlBin, [
      '-s', '-L', '--http1.1',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '-H', 'Accept: text/html',
      '-w', '\n%{http_code}',
      '--max-time', '15',
      url,
    ], { timeout: 20000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`curl failed: ${error.message}`));
        return;
      }
      const lines = stdout.split('\n');
      const status = parseInt(lines[lines.length - 1].trim(), 10) || 0;
      const html = lines.slice(0, -1).join('\n');
      resolve({ html, status });
    });
  });
}

/**
 * Fetch a Client Credentials token from Spotify.
 * Returns null if credentials are not configured.
 */
async function getClientCredentialsToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      logger.warn('[SpotifySourceAdapter] Client credentials token request failed', { status: res.status });
      return null;
    }
    const data = await res.json() as any;
    return data.access_token || null;
  } catch (e) {
    logger.warn('[SpotifySourceAdapter] Failed to get client credentials token', { error: (e as Error).message });
    return null;
  }
}

/**
 * Fetch all public playlists for a user via the Spotify Web API (paginated).
 * Returns null if token is invalid or API call fails.
 */
async function fetchAllPlaylistsViaApi(token: string, spotifyUserId: string): Promise<PlaylistInfo[] | null> {
  try {
    const allPlaylists: PlaylistInfo[] = [];
    let url: string | null = `https://api.spotify.com/v1/users/${spotifyUserId}/playlists?limit=50&offset=0`;

    while (url) {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        logger.warn('[SpotifySourceAdapter] Spotify API playlist fetch failed', { status: res.status, url });
        return null;
      }
      const data = await res.json() as any;
      for (const p of (data.items || [])) {
        if (p.id) {
          allPlaylists.push({
            id: p.id,
            name: p.name || 'Untitled Playlist',
            trackCount: p.tracks?.total || 0,
            coverUrl: p.images?.[0]?.url || undefined,
          });
        }
      }
      url = data.next || null;
    }

    return allPlaylists;
  } catch (e) {
    logger.warn('[SpotifySourceAdapter] API playlist fetch error', { error: (e as Error).message });
    return null;
  }
}

/**
 * Fetch all playlists from a Spotify user profile using the existing browser scraper.
 * Uses tall viewport (4000px) and puppeteer-extra with stealth plugin.
 */
async function fetchAllPlaylistsViaPuppeteer(userId: string, _displayName: string): Promise<PlaylistInfo[] | null> {
  try {
    const { scrapeSpotifyUserPlaylists } = await import('../services/browser-scrapers');
    logger.info('[SpotifySourceAdapter] Using existing browser scraper for playlists', { userId });
    
    const playlists = await scrapeSpotifyUserPlaylists(userId);
    
    if (!playlists || playlists.length === 0) {
      logger.warn('[SpotifySourceAdapter] Browser scraper returned no playlists', { userId });
      return null;
    }
    
    // Convert to PlaylistInfo format
    const result: PlaylistInfo[] = playlists.map(p => {
      const urlMatch = p.url.match(/\/playlist\/([A-Za-z0-9]+)/);
      return {
        id: urlMatch ? urlMatch[1] : '',
        name: p.name,
        trackCount: 0, // Will be fetched later when importing
        coverUrl: p.imageUrl || undefined,
      };
    }).filter(p => p.id); // Filter out any without valid ID
    
    logger.info('[SpotifySourceAdapter] Browser scraper complete', { userId, playlistCount: result.length });
    return result.length > 0 ? result : null;
  } catch (error: any) {
    logger.warn('[SpotifySourceAdapter] Browser scraper failed', { userId, error: error.message });
    return null;
  }
}

/**
 * Fetch public playlists from a Spotify user without authentication.
 * Strategy:
 *   1. Get display name + first ~10 playlists from SSR HTML (fast curl, ~1s)
 *   2. If Spotify Client Credentials are configured → use Spotify Web API for ALL playlists (paginated, ~2s)
 *   3. Otherwise → use Puppeteer to scroll and collect ALL playlists (~10-15s)
 */
async function fetchUserPlaylistsUnauthenticated(userId: string): Promise<{ displayName: string; playlists: PlaylistInfo[] }> {
  try {
    const url = `https://open.spotify.com/user/${userId}?locale=en-US`;
    logger.info('[SpotifySourceAdapter] Fetching user profile via curl', { userId, url });

    const { html, status } = await fetchSpotifyHtml(url);
    logger.info('[SpotifySourceAdapter] Profile response', { userId, status, htmlLen: html.length });

    if (status !== 200 || html.length < 1000) {
      throw new Error(`Failed to fetch profile page (status: ${status}, size: ${html.length})`);
    }

    // Extract displayName from title tag: "Mike on Spotify"
    let displayName = '';
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1];
      const nameMatch = title.match(/^(.+?)\s+on\s+Spotify$/i);
      if (nameMatch) displayName = nameMatch[1].trim();
    }
    // Fallback to og:title
    if (!displayName) {
      const ogMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
      if (ogMatch && !/choose|language|sprache/i.test(ogMatch[1])) {
        displayName = ogMatch[1].trim();
      }
    }

    // Parse SSR playlists as initial data
    let ssrPlaylists: PlaylistInfo[] = [];
    let ssrTotalCount = 0;
    const stateMatch = html.match(/id="initialState"[^>]*>([^<]+)</);
    if (stateMatch) {
      try {
        const initialState = JSON.parse(Buffer.from(stateMatch[1], 'base64').toString());
        const items = initialState?.entities?.items || {};
        const userKey = Object.keys(items).find(k => k.includes(userId) || k.includes('user'));
        if (userKey) {
          const userEntity = items[userKey];
          if (!displayName && userEntity?.name) displayName = userEntity.name;
          const publicPlaylists = userEntity?.publicPlaylistsV2;
          if (publicPlaylists?.items) {
            ssrTotalCount = publicPlaylists.totalCount || publicPlaylists.items.length;
            ssrPlaylists = publicPlaylists.items.map((item: any) => {
              const data = item?.data || {};
              const id = (item?._uri || '').replace('spotify:playlist:', '');
              const name = data?.name || 'Untitled Playlist';
              const coverUrl = data?.images?.items?.[0]?.sources?.[0]?.url || undefined;
              return { id, name, trackCount: 0, coverUrl };
            }).filter((p: PlaylistInfo) => p.id);
          }
        }
      } catch (e) {
        logger.warn('[SpotifySourceAdapter] Failed to parse initialState', { userId, error: (e as Error).message });
      }
    }

    // Note: We intentionally do NOT early-return when SSR reports "all playlists".
    // Spotify's SSR totalCount can under-report (e.g. says 9 when user has 20+).
    // The SSR also returns incomplete metadata (trackCount: 0, sometimes missing covers).
    // Always verify with Puppeteer to ensure we have all playlists with full metadata.
    if (ssrPlaylists.length >= ssrTotalCount && ssrTotalCount > 0) {
      logger.info('[SpotifySourceAdapter] SSR reports all playlists, will verify with Puppeteer', {
        userId, displayName: displayName || userId, ssrPlaylistCount: ssrPlaylists.length, ssrTotalCount
      });
    }

    // Try Client Credentials API (fastest full fetch, ~2s)
    const apiToken = await getClientCredentialsToken();
    if (apiToken) {
      logger.info('[SpotifySourceAdapter] Client credentials available, fetching all playlists via API', { userId });
      const apiPlaylists = await fetchAllPlaylistsViaApi(apiToken, userId);
      if (apiPlaylists && apiPlaylists.length > 0) {
        logger.info('[SpotifySourceAdapter] Fetched all user playlists via API', {
          userId, displayName: displayName || userId, playlistCount: apiPlaylists.length,
        });
        return { displayName: displayName || userId, playlists: apiPlaylists };
      }
    }

    // Fall back to Puppeteer for full list
    logger.info('[SpotifySourceAdapter] Using Puppeteer to fetch all playlists', {
      userId, ssrCount: ssrPlaylists.length, totalFromServer: ssrTotalCount
    });
    const puppeteerPlaylists = await fetchAllPlaylistsViaPuppeteer(userId, displayName || userId);
    if (puppeteerPlaylists && puppeteerPlaylists.length > 0) {
      if (puppeteerPlaylists.length > ssrPlaylists.length) {
        logger.info('[SpotifySourceAdapter] Puppeteer found more playlists than SSR', {
          userId, displayName: displayName || userId,
          puppeteerCount: puppeteerPlaylists.length, ssrCount: ssrPlaylists.length
        });
      } else {
        logger.info('[SpotifySourceAdapter] Puppeteer confirmed playlist count, using Puppeteer data (better metadata)', {
          userId, displayName: displayName || userId,
          puppeteerCount: puppeteerPlaylists.length, ssrCount: ssrPlaylists.length
        });
      }
      return { displayName: displayName || userId, playlists: puppeteerPlaylists };
    }

    // Final fallback: SSR playlists
    logger.info('[SpotifySourceAdapter] Returning SSR playlists (no additional playlists found)', {
      userId, displayName: displayName || userId, playlistCount: ssrPlaylists.length, totalFromServer: ssrTotalCount,
    });
    return { displayName: displayName || userId, playlists: ssrPlaylists };
  } catch (error) {
    logger.error('[SpotifySourceAdapter] Failed to fetch user playlists', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      userId,
    });
    throw new Error(`Unable to fetch playlists for user ${userId}. The profile may be private or the user ID may be invalid.`);
  }
}


/**
 * Fetch tracks from a public Spotify playlist without user authentication.
 * Uses Spotify's Client Credentials flow (app-only auth) which doesn't require user login.
 */
async function fetchTracksUnauthenticated(playlistId: string): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
  try {
    logger.info('[SpotifySourceAdapter] Fetching playlist with client credentials', { playlistId });
    
    // Get client credentials token (app-only, no user login required)
    // This uses the public Spotify API with basic authentication
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      logger.warn('[SpotifySourceAdapter] No Spotify client credentials configured, falling back to scraping', { playlistId });
      throw new Error('Spotify client credentials not configured');
    }
    
    // Get access token using client credentials flow
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!tokenResponse.ok) {
      logger.error('[SpotifySourceAdapter] Failed to get client credentials token', { 
        status: tokenResponse.status,
        playlistId 
      });
      throw new Error('Failed to get Spotify access token');
    }
    
    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;
    
    logger.info('[SpotifySourceAdapter] Got client credentials token', { playlistId });
    
    // Fetch playlist metadata
    const playlistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,images,tracks.total`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!playlistResponse.ok) {
      logger.error('[SpotifySourceAdapter] Failed to fetch playlist metadata', { 
        status: playlistResponse.status,
        playlistId 
      });
      throw new Error('Failed to fetch playlist metadata');
    }
    
    const playlistData = await playlistResponse.json() as any;
    const playlistName = playlistData.name;
    const totalTracks = playlistData.tracks?.total || 0;
    
    logger.info('[SpotifySourceAdapter] Fetching all tracks', { playlistId, totalTracks });
    
    // Fetch all tracks with pagination (100 per page)
    const tracks: TrackInfo[] = [];
    let offset = 0;
    const limit = 100;
    
    while (offset < totalTracks) {
      const tracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(name,artists,album))`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (!tracksResponse.ok) {
        logger.error('[SpotifySourceAdapter] Failed to fetch tracks page', { 
          status: tracksResponse.status,
          offset,
          playlistId 
        });
        break;
      }
      
      const tracksData = await tracksResponse.json() as any;
      
      for (const item of tracksData.items || []) {
        const track = item?.track;
        if (!track) continue;
        
        tracks.push({
          title: track.name,
          artist: track.artists?.[0]?.name || 'Unknown Artist',
          album: track.album?.name || '',
        });
      }
      
      offset += limit;
      logger.info('[SpotifySourceAdapter] Fetched tracks page', { playlistId, offset, total: totalTracks });
    }
    
    const playlist: PlaylistInfo = {
      id: playlistId,
      name: playlistName,
      trackCount: tracks.length,
      coverUrl: playlistData.images?.[0]?.url,
    };
    
    logger.info('[SpotifySourceAdapter] Successfully fetched all tracks via API', {
      playlistId,
      playlistName,
      trackCount: tracks.length,
    });
    
    return { playlist, tracks };
    
  } catch (error: any) {
    logger.error('[SpotifySourceAdapter] API fetch failed, falling back to scraping', { 
      error: error.message,
      playlistId 
    });
    
    // Fall back to web scraping (will only get ~24 tracks due to virtual scrolling)
    return fetchTracksViaScraping(playlistId);
  }
}

/**
 * Fallback method: scrape tracks from Spotify web page.
 * Collects tracks progressively while scrolling to overcome virtual scrolling.
 */
async function fetchTracksViaScraping(playlistId: string): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
  let browser;
  try {
    // Get playlist name from oEmbed API
    const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${playlistId}`;
    const oembedResponse = await fetch(oembedUrl);
    
    let playlistName = 'Spotify Playlist';
    if (oembedResponse.ok) {
      const oembedData = await oembedResponse.json() as any;
      playlistName = oembedData.title || playlistName;
    }
    
    const puppeteer = await import('puppeteer');
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    
    logger.info('[SpotifySourceAdapter] Scraping playlist with progressive collection', { playlistId, url: playlistUrl });
    
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 }); // Set large viewport like the test
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(playlistUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    
    await page.waitForSelector('a[href*="/track/"]', { timeout: 10000 }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Collect tracks progressively while scrolling
    logger.info('[SpotifySourceAdapter] Collecting tracks while scrolling', { playlistId });
    
    // First, scroll to the very bottom to trigger all lazy loading
    logger.info('[SpotifySourceAdapter] Scrolling to bottom to trigger lazy loading', { playlistId });
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Now scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now collect tracks while scrolling down again
    const allTracks = new Map(); // Use Map to deduplicate by track ID
    let unchangedCount = 0;
    const maxScrolls = 40;
    
    for (let i = 0; i < maxScrolls && unchangedCount < 8; i++) {
      // Extract current tracks in DOM
      const currentTracks = await page.evaluate(() => {
        const trackLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
        const tracks: any[] = [];
        
        trackLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          
          const trackId = href.match(/\/track\/([A-Za-z0-9]+)/)?.[1];
          if (!trackId) return;
          
          const row = link.closest('[data-testid="tracklist-row"]') ||
                     link.closest('[role="row"]') ||
                     link.parentElement;
          
          if (!row) return;
          
          const title = link.textContent?.trim() || '';
          let artist = '';
          const artistLinks = Array.from(row.querySelectorAll('a[href*="/artist/"]'));
          if (artistLinks.length > 0) {
            artist = artistLinks.map(a => a.textContent?.trim()).filter(t => t).join(', ');
          }
          
          if (title && artist) {
            tracks.push({ id: trackId, title, artist, album: '' });
          }
        });
        
        return tracks;
      });
      
      // Add new tracks to our collection
      const previousSize = allTracks.size;
      currentTracks.forEach((track: any) => {
        if (!allTracks.has(track.id)) {
          allTracks.set(track.id, { title: track.title, artist: track.artist, album: track.album });
        }
      });
      
      // Check if we found new tracks
      if (allTracks.size === previousSize) {
        unchangedCount++;
      } else {
        unchangedCount = 0;
        logger.info('[SpotifySourceAdapter] Collected tracks', { 
          playlistId, 
          scroll: i + 1,
          totalCollected: allTracks.size 
        });
      }
      
      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, 600);
      });
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    await browser.close();
    browser = undefined;
    
    const tracks = Array.from(allTracks.values());
    
    logger.info('[SpotifySourceAdapter] Scraping complete', {
      playlistId,
      trackCount: tracks.length,
    });
    
    if (tracks.length === 0) {
      throw new Error('No tracks found. Playlist may be private or unavailable.');
    }
    
    const playlist: PlaylistInfo = {
      id: playlistId,
      name: playlistName,
      trackCount: tracks.length,
      coverUrl: undefined,
    };
    
    return { playlist, tracks: tracks as TrackInfo[] };
    
  } catch (error: any) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    logger.error('[SpotifySourceAdapter] Scraping failed', { error: error.message, playlistId });
    throw new Error('Unable to fetch Spotify playlist. Please connect your Spotify account for full access.');
  }
}

export const spotifySourceAdapter: SourceAdapter = {
  meta: {
    id: 'spotify',
    name: 'Spotify',
    icon: 'spotify',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  /**
   * List all playlists the authenticated Spotify user owns or follows.
   * Paginates through all pages (Spotify returns max 50 per page).
   * Returns empty array if not authenticated (user can still search by URL).
   */
  async listPlaylists(userId: number, db: any): Promise<PlaylistInfo[]> {
    const token = await getSpotifyToken(userId, db);
    if (!token) {
      logger.info('[SpotifySourceAdapter] No token available for listPlaylists', { userId });
      // Return empty array - user can still use URL-based import
      return [];
    }

    const playlists: PlaylistInfo[] = [];
    let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

    while (url) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as any;
        const message = err?.error?.message || `Spotify API error: ${response.status}`;
        logger.error('[SpotifySourceAdapter] listPlaylists API error', { status: response.status, message, userId });
        if (response.status === 403) {
          // Token exists but lacks required scopes — clear it so user gets prompted to reconnect
          db.prepare(`UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE id = ?`).run(userId);
          logger.info('[SpotifySourceAdapter] Cleared invalid token, returning empty list', { userId });
          return [];
        }
        if (response.status === 401) {
          db.prepare(`UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE id = ?`).run(userId);
          logger.info('[SpotifySourceAdapter] Cleared expired token, returning empty list', { userId });
          return [];
        }
        throw new Error(message);
      }

      const data = await response.json() as any;

      for (const item of data.items ?? []) {
        if (!item) continue;
        playlists.push({
          id: item.id,
          name: item.name,
          trackCount: item.tracks?.total ?? 0,
          coverUrl: item.images?.[0]?.url,
        });
      }

      url = data.next ?? null;
    }

    logger.info('[SpotifySourceAdapter] Listed playlists', { userId, count: playlists.length });
    return playlists;
  },

  /**
   * Search Spotify for playlists matching the query.
   * If no token is available, falls back to unauthenticated search (limited functionality).
   * When searching for a user ID, returns { displayName, playlists }, otherwise returns playlists array.
   */
  async searchPlaylists(query: string, userId: number, db: any): Promise<PlaylistInfo[] | { displayName: string; playlists: PlaylistInfo[] }> {
    // Check if query is a user ID (for fetching user playlists)
    const userIdMatch = query.match(/^([A-Za-z0-9_-]+)$/);
    const isUserId = userIdMatch && !query.includes('spotify:') && !query.includes('http');
    
    // For user ID queries, skip token entirely and use fast curl-based method
    if (isUserId) {
      logger.info('[SpotifySourceAdapter] User ID detected, using unauthenticated fetch', { query });
      return fetchUserPlaylistsUnauthenticated(query);
    }
    
    let token: string | null = null;
    try {
      if (db) {
        token = await getSpotifyToken(userId, db);
      }
    } catch {
      // Ignore token lookup errors - will fall back to unauthenticated
    }
    
    // If no token, try unauthenticated search via public API
    if (!token) {
      logger.info('[SpotifySourceAdapter] No token available, attempting unauthenticated search', { query });
      const playlists = await searchPlaylistsUnauthenticated(query);
      return playlists;
    }

    const url = `https://api.spotify.com/v1/search?type=playlist&q=${encodeURIComponent(query)}&limit=20`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      const message = err?.error?.message || `Spotify search error: ${response.status}`;
      if (response.status === 403 || response.status === 401) {
        db.prepare(`UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE id = ?`).run(userId);
        // Fall back to unauthenticated search
        logger.info('[SpotifySourceAdapter] Auth failed, falling back to unauthenticated search', { query });
        const playlists = await searchPlaylistsUnauthenticated(query);
        return playlists;
      }
      throw new Error(message);
    }
    const data = await response.json() as any;
    return (data.playlists?.items ?? [])
      .filter((item: any) => item != null)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        trackCount: item.tracks?.total ?? 0,
        coverUrl: item.images?.[0]?.url,
      }));
  },

  /**
   * Fetch all tracks from a Spotify playlist.
   * Accepts a full Spotify URL or a bare playlist ID.
   * Paginates through all pages (Spotify returns max 100 tracks per page).
   * Falls back to unauthenticated fetch for public playlists if no token available.
   */
  async fetchTracks(
    playlistUrlOrId: string,
    userId: number,
    db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const token = await getSpotifyToken(userId, db);
    const playlistId = extractPlaylistId(playlistUrlOrId);

    // If no token, try unauthenticated fetch
    if (!token) {
      logger.info('[SpotifySourceAdapter] No token available, attempting unauthenticated fetch', { playlistId });
      return fetchTracksUnauthenticated(playlistId);
    }

    // Fetch playlist metadata
    const metaResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,tracks(total),images`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaResponse.ok) {
      const err = await metaResponse.json().catch(() => ({})) as any;
      const status = metaResponse.status;
      
      // If auth failed, try unauthenticated fetch
      if (status === 401 || status === 403) {
        logger.info('[SpotifySourceAdapter] Auth failed, falling back to unauthenticated fetch', { playlistId });
        db.prepare(`UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE id = ?`).run(userId);
        return fetchTracksUnauthenticated(playlistId);
      }
      
      throw new Error(err?.error?.message || `Failed to fetch Spotify playlist: ${status}`);
    }

    const meta = await metaResponse.json() as any;

    const playlist: PlaylistInfo = {
      id: meta.id,
      name: meta.name,
      trackCount: meta.tracks?.total ?? 0,
      coverUrl: meta.images?.[0]?.url,
    };

    // Fetch all tracks with pagination
    const tracks: TrackInfo[] = [];
    let tracksUrl: string | null =
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(name,artists,album(name)))`;

    while (tracksUrl) {
      const response = await fetch(tracksUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as any;
        throw new Error(err?.error?.message || `Failed to fetch Spotify tracks: ${response.status}`);
      }

      const data = await response.json() as any;

      for (const item of data.items ?? []) {
        const track = item?.track;
        // Skip null tracks (e.g. local files or unavailable tracks)
        if (!track) continue;

        tracks.push({
          title: track.name,
          artist: track.artists?.[0]?.name ?? '',
          album: track.album?.name,
        });
      }

      tracksUrl = data.next ?? null;
    }

    logger.info('[SpotifySourceAdapter] Fetched playlist tracks', {
      playlistId,
      playlistName: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
