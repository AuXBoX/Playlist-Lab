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
 * Fetch public playlists from a Spotify user without authentication.
 * Uses Puppeteer to render the JavaScript-heavy Spotify page.
 */
async function fetchUserPlaylistsUnauthenticated(userId: string): Promise<{ displayName: string; playlists: PlaylistInfo[] }> {
  let browser;
  try {
    // Dynamic import to avoid loading Puppeteer unless needed
    const puppeteer = await import('puppeteer');
    
    // Use the /playlists URL to get the grid view with all playlists
    const playlistsUrl = `https://open.spotify.com/user/${userId}/playlists`;
    logger.info('[SpotifySourceAdapter] Launching browser to fetch playlists', { userId, url: playlistsUrl });
    
    // Launch headless browser
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
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the playlists page
    await page.goto(playlistsUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for the page to load playlists
    await page.waitForSelector('a[href*="/playlist/"]', { 
      timeout: 10000 
    }).catch(() => {
      logger.warn('[SpotifySourceAdapter] Playlist links not found, page may be empty or private', { userId });
    });
    
    // Scroll to load all playlists (Spotify uses lazy loading)
    logger.info('[SpotifySourceAdapter] Scrolling to load all playlists', { userId });
    
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 50;
    let noChangeCount = 0;
    
    while (scrollAttempts < maxScrollAttempts && noChangeCount < 2) {
      // Count current playlists
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/playlist/"]').length;
      });
      
      logger.info('[SpotifySourceAdapter] Scroll attempt', { 
        userId, 
        attempt: scrollAttempts,
        playlistCount: currentCount 
      });
      
      // If count hasn't changed, increment counter
      if (currentCount === previousCount && scrollAttempts > 0) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }
      
      previousCount = currentCount;
      
      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content to load (reduced from 1500ms to 800ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      scrollAttempts++;
    }
    
    logger.info('[SpotifySourceAdapter] Finished scrolling', { 
      userId, 
      scrollAttempts,
      finalPlaylistCount: previousCount 
    });
    
    // Extract data from the page
    const data = await page.evaluate(() => {
      // Try to get display name from the page
      let displayName = '';
      
      // On the /playlists page, look for the profile name in specific locations
      // Try to find it in the page title or header
      const titleElement = document.querySelector('title');
      if (titleElement?.textContent) {
        // Title format is usually "Username's Playlists | Spotify" or "Public Playlists | Spotify"
        const titleMatch = titleElement.textContent.match(/^(.+?)'s Playlists/);
        if (titleMatch) {
          displayName = titleMatch[1];
        }
      }
      
      // If not found in title, try h1 elements but be more selective
      if (!displayName) {
        const h1Elements = Array.from(document.querySelectorAll('h1'));
        for (const h1 of h1Elements) {
          const text = h1.textContent?.trim() || '';
          // Skip common UI text
          if (text && 
              text !== 'Public Playlists' && 
              text !== 'Your Library' &&
              text !== 'Playlists' &&
              !text.includes('Spotify') &&
              text.length > 0 &&
              text.length < 100) {
            displayName = text;
            break;
          }
        }
      }
      
      console.log(`Extracted display name: "${displayName}"`);
      
      // Find all playlist cards - look for links to playlists
      const playlistLinks = Array.from(document.querySelectorAll('a[href*="/playlist/"]'));
      
      console.log(`Found ${playlistLinks.length} playlist links`);
      
      const playlistsMap = new Map();
      
      playlistLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const playlistId = href.match(/\/playlist\/([A-Za-z0-9]+)/)?.[1];
        if (!playlistId || playlistsMap.has(playlistId)) return;
        
        // Get the card container (parent elements)
        const card = link.closest('[data-testid="playlist-card"]') || 
                    link.closest('.playlist-card') ||
                    link.closest('div[role="gridcell"]') ||
                    link.closest('article') ||
                    link;
        
        // Extract playlist name - look in the link or card
        let name = '';
        const titleSelectors = [
          '[data-testid="card-title"]',
          '.card-title',
          'div[data-encore-id="text"]',
          'span',
          'div',
        ];
        
        for (const selector of titleSelectors) {
          const el = card.querySelector(selector);
          const text = el?.textContent?.trim();
          if (text && text.length > 0 && text.length < 200 && !text.includes('songs')) {
            name = text;
            break;
          }
        }
        
        if (!name) {
          // Try getting text from the link itself
          const linkText = link.textContent?.trim();
          if (linkText && linkText.length > 0 && linkText.length < 200) {
            name = linkText;
          } else {
            name = 'Untitled Playlist';
          }
        }
        
        // Extract track count from subtitle or description
        let trackCount = 0;
        
        // Look for "X songs" text in the card
        const textContent = card.textContent || '';
        const songMatch = textContent.match(/(\d+)\s+songs?/i);
        if (songMatch) {
          trackCount = parseInt(songMatch[1], 10);
        }
        
        // If not found, try specific subtitle elements
        if (trackCount === 0) {
          const subtitleEl = card.querySelector('[data-testid="card-subtitle"]') ||
                            card.querySelector('.card-subtitle') ||
                            card.querySelector('[data-encore-id="text"]');
          if (subtitleEl) {
            const text = subtitleEl.textContent || '';
            const match = text.match(/(\d+)\s+songs?/i);
            if (match) {
              trackCount = parseInt(match[1], 10);
            }
          }
        }
        
        // Extract cover image
        const imgEl = card.querySelector('img');
        const coverUrl = imgEl?.getAttribute('src') || undefined;
        
        playlistsMap.set(playlistId, {
          id: playlistId,
          name,
          trackCount,
          coverUrl,
        });
      });
      
      const playlists = Array.from(playlistsMap.values());
      console.log(`Extracted ${playlists.length} unique playlists`);
      
      return { displayName, playlists };
    });
    
    await browser.close();
    browser = undefined;
    
    logger.info('[SpotifySourceAdapter] Fetched user playlists with Puppeteer', {
      userId,
      displayName: data.displayName || userId,
      playlistCount: data.playlists.length,
    });
    
    return {
      displayName: data.displayName || userId,
      playlists: data.playlists as PlaylistInfo[],
    };
    
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    logger.error('[SpotifySourceAdapter] Failed to fetch user playlists with Puppeteer', { error, userId });
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
    const token = await getSpotifyToken(userId, db);
    
    // Check if query is a user ID (for fetching user playlists)
    const userIdMatch = query.match(/^([A-Za-z0-9_-]+)$/);
    const isUserId = userIdMatch && !query.includes('spotify:') && !query.includes('http');
    
    // If no token, try unauthenticated search via public API
    if (!token) {
      logger.info('[SpotifySourceAdapter] No token available, attempting unauthenticated search', { query });
      
      // If it's a user ID, fetch user playlists and return full result
      if (isUserId) {
        return fetchUserPlaylistsUnauthenticated(query);
      }
      
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
        
        // If it's a user ID, fetch user playlists and return full result
        if (isUserId) {
          return fetchUserPlaylistsUnauthenticated(query);
        }
        
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
