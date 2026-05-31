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
    
    // Launch headless browser (Puppeteer 24+ uses new headless by default)
    browser = await puppeteer.default.launch({
      headless: 'shell' as any,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--lang=en-US,en',
      ],
    });
    
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set locale headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    // Use a standard viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Override browser locale to English (prevents Spotify language dialog)
    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, 'language', { get: function() { return 'en-US'; } });
      Object.defineProperty(navigator, 'languages', { get: function() { return ['en-US', 'en']; } });
    `);
    
    // Step 1: Visit Spotify homepage first to establish locale cookies
    // This prevents the "Choose a language" overlay on subsequent pages
    logger.info('[SpotifySourceAdapter] Visiting homepage to establish locale cookies');
    await page.goto('https://open.spotify.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    }).catch(() => {
      logger.warn('[SpotifySourceAdapter] Homepage load failed, continuing anyway');
    });
    
    // Wait for homepage to render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Dismiss language dialog on homepage if present (clicks English)
    await page.evaluate(`
      (function() {
        var all = document.querySelectorAll('button, a, [role="button"], [role="option"], li, span');
        for (var i = 0; i < all.length; i++) {
          var t = (all[i].textContent || '').trim();
          if (/^english/i.test(t) && t.length < 30) { all[i].click(); return; }
        }
      })()
    `);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Set locale cookies explicitly
    await page.setCookie(
      { name: 'sp_lg', value: 'en', domain: '.spotify.com', path: '/' },
      { name: 'sp_locale', value: 'en', domain: '.spotify.com', path: '/' },
      { name: 'sp_m', value: 'en', domain: '.spotify.com', path: '/' },
    );
    
    // Step 3: Navigate to the user's playlists page
    await page.goto(playlistsUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for Spotify's JS to render the page (including any language dialog)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Check for "Choose a language" dialog and force-dismiss it
    const pageTitle = await page.title();
    logger.info('[SpotifySourceAdapter] Page loaded', { userId, title: pageTitle });
    
    // Diagnostic: log page structure to understand what's rendered
    const pageDiag = await page.evaluate(`
      (function() {
        var r = {};
        r.title = document.title;
        var h1s = document.querySelectorAll('h1');
        r.h1s = [];
        for (var i = 0; i < h1s.length; i++) r.h1s.push((h1s[i].textContent || '').trim().substring(0, 100));
        var btns = document.querySelectorAll('button');
        r.btnCount = btns.length;
        r.btnTexts = [];
        for (var i = 0; i < Math.min(15, btns.length); i++) r.btnTexts.push((btns[i].textContent || '').trim().substring(0, 50));
        r.bodyLen = (document.body.textContent || '').length;
        r.hasChoose = (document.body.textContent || '').indexOf('Choose') !== -1;
        r.hasLanguage = (document.body.textContent || '').indexOf('language') !== -1;
        r.visibleText = (document.body.textContent || '').replace(/\\s+/g, ' ').trim().substring(0, 500);
        return r;
      })()
    `);
    logger.info('[SpotifySourceAdapter] Page diagnostics', { diag: pageDiag });
    
    // Check for language dialog using multiple methods
    const hasLangDialog = await page.evaluate(`
      (function() {
        var t = document.body.textContent || '';
        if (t.indexOf('Choose a language') !== -1) return true;
        if (t.indexOf('choose a language') !== -1) return true;
        if (t.indexOf('Sprache') !== -1) return true;
        if (t.indexOf('langue') !== -1) return true;
        var h1s = document.querySelectorAll('h1');
        for (var i = 0; i < h1s.length; i++) {
          var h = (h1s[i].textContent || '').trim().toLowerCase();
          if (h === 'choose a language' || h.indexOf('choose a language') !== -1 || h === 'sprache wählen') return true;
        }
        return false;
      })()
    `) as boolean;
    
    logger.info('[SpotifySourceAdapter] Language dialog check', { hasLangDialog });
    
    if (hasLangDialog) {
      logger.info('[SpotifySourceAdapter] Language selector detected, attempting to dismiss');
      
      // Try to click English button
      const dismissResult = await page.evaluate(`
        (function() {
          var results = [];
          var allClickable = document.querySelectorAll('button, a, [role="button"], [role="option"], [role="menuitem"], li, span');
          for (var i = 0; i < allClickable.length; i++) {
            var text = (allClickable[i].textContent || '').trim();
            if (/^english(\\s*\\(.*\\))?$/i.test(text) || text.toLowerCase() === 'english') {
              allClickable[i].click();
              results.push('clicked: ' + text);
              return results;
            }
          }
          for (var i = 0; i < allClickable.length; i++) {
            var text = (allClickable[i].textContent || '').trim().toLowerCase();
            if (text.indexOf('english') !== -1 && text.length < 30) {
              allClickable[i].click();
              results.push('partial: ' + text);
              return results;
            }
          }
          results.push('no english button found, total clickable: ' + allClickable.length);
          return results;
        })()
      `) as string[];
      
      logger.info('[SpotifySourceAdapter] Language dismiss attempt', { results: dismissResult });
      
      // Wait for navigation after clicking
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      
      // Set locale cookies and API call
      await page.evaluate(`try{fetch('https://spclient.wg.spotify.com/user-customization-service/v1/customization',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferred_language:'en'}),credentials:'include'}).catch(function(){})}catch(e){};document.cookie='sp_lg=en;domain=.spotify.com;path=/;max-age=31536000';document.cookie='sp_locale=en;domain=.spotify.com;path=/;max-age=31536000';`);
      
      // Re-navigate to the playlists page
      await page.goto(playlistsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Force-remove any remaining overlay/modal elements that might block scrolling
    await page.evaluate(`
      (function() {
        // Remove elements that look like full-page overlays or modals
        var allDivs = document.querySelectorAll('div');
        for (var i = 0; i < allDivs.length; i++) {
          var el = allDivs[i];
          var style = getComputedStyle(el);
          var text = (el.textContent || '').substring(0, 200);
          // Check if it's a full-page overlay containing language selection text
          if ((style.position === 'fixed' || style.position === 'absolute') &&
              style.zIndex && parseInt(style.zIndex) > 100 &&
              el.clientHeight > window.innerHeight * 0.5 &&
              (text.indexOf('Choose') !== -1 || text.indexOf('language') !== -1 || text.indexOf('Sprache') !== -1)) {
            el.remove();
          }
        }
      })()
    `);
    
    // Wait for the page to load playlists
    await page.waitForSelector('a[href*="/playlist/"]', { 
      timeout: 15000 
    }).catch(() => {
      logger.warn('[SpotifySourceAdapter] Playlist links not found after language handling', { userId });
    });

    // Extract display name from the page title
    const displayName = await page.evaluate(`
      (function() {
        var t = document.querySelector('title');
        if (t && t.textContent) {
          var m1 = t.textContent.match(/^(.+?)'s Playlists/);
          if (m1) return m1[1];
          var m2 = t.textContent.match(/^(.+?)\\s+on\\s+Spotify$/i);
          if (m2) return m2[1];
        }
        var h1s = document.querySelectorAll('h1');
        for (var i = 0; i < h1s.length; i++) {
          var txt = (h1s[i].textContent || '').trim();
          if (txt && txt !== 'Public Playlists' && txt !== 'Your Library' && txt !== 'Playlists' && txt.indexOf('Spotify') === -1 && txt.length > 0 && txt.length < 100) return txt;
        }
        return '';
      })()
    `) as string;
    
    logger.info('[SpotifySourceAdapter] Display name', { userId, displayName });
    
    // If display name is "Choose a language" or similar, the dialog is still blocking the page
    if (displayName && /choose|language|sprache|langue|idioma/i.test(displayName)) {
      logger.warn('[SpotifySourceAdapter] Dialog still present after dismissal attempts, force-removing');
      
      // Try clicking any element containing "English" text
      const forceClick = await page.evaluate(`
        (function() {
          var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          while (walker.nextNode()) {
            if (/english/i.test(walker.currentNode.textContent)) {
              var el = walker.currentNode.parentElement;
              while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'LI') el = el.parentElement;
              if (el) { el.click(); return 'clicked parent: ' + el.tagName; }
              walker.currentNode.parentElement.click();
              return 'clicked text parent';
            }
          }
          return 'no english text found';
        })()
      `) as string;
      logger.info('[SpotifySourceAdapter] Force click result', { forceClick });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Aggressively remove ALL fixed/absolute positioned elements with high z-index
      await page.evaluate(`
        (function() {
          var removed = [];
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var s = getComputedStyle(el);
            if ((s.position === 'fixed' || s.position === 'absolute') && parseInt(s.zIndex || '0') > 50 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
              removed.push(el.tagName + '.' + (el.className || '').toString().substring(0, 40));
              el.style.display = 'none';
            }
          }
          // Also try to re-enable scrolling on the body
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
          return removed;
        })()
      `);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Re-navigate one more time
      logger.info('[SpotifySourceAdapter] Re-navigating after force removal');
      await page.goto(playlistsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Remove overlays again
      await page.evaluate(`
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var s = getComputedStyle(el);
            if ((s.position === 'fixed' || s.position === 'absolute') && parseInt(s.zIndex || '0') > 50 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
              var t = (el.textContent || '').substring(0, 200).toLowerCase();
              if (t.indexOf('language') !== -1 || t.indexOf('choose') !== -1) {
                el.style.display = 'none';
              }
            }
          }
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
        })()
      `);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Spotify uses virtual scrolling - only ~24 items exist in the DOM at any time.
    // We must ACCUMULATE playlists across scroll positions, not just read at the end.
    
        // IMPORTANT: tsx/esbuild injects __name helpers into arrow functions, which causes
    // "ReferenceError: __name is not defined" when Puppeteer serializes them to the browser.
    // Solution: inject JS helpers as strings, then call them via string-based evaluate.
    
    // Inject scroll helper into the page
    await page.evaluate(`window.__plScrollStep=function(step){function tryScroll(el){var b=el.scrollTop;el.scrollTop=el.scrollTop+step;return el.scrollTop!==b}var sels=['[data-testid="main-scroll-container"]','[data-scroll-container]','#main','main','[role="main"]','.main-view-container','.os-viewport','.main-view-container__scroll-node'];for(var i=0;i<sels.length;i++){var el=document.querySelector(sels[i]);if(el&&el.scrollHeight>el.clientHeight+100&&tryScroll(el))return true}var a=document.querySelectorAll('div,main,section');var c=[];for(var i=0;i<a.length;i++){var s=getComputedStyle(a[i]);if((s.overflowY==='auto'||s.overflowY==='scroll'||s.overflow==='auto'||s.overflow==='scroll')&&a[i].scrollHeight>a[i].clientHeight+200)c.push(a[i])}c.sort(function(x,y){return y.scrollHeight-x.scrollHeight});for(var i=0;i<c.length;i++){if(tryScroll(c[i]))return true}var by=window.scrollY;window.scrollBy(0,step);if(window.scrollY!==by)return true;for(var i=0;i<a.length;i++){if(a[i].scrollHeight>a[i].clientHeight+100&&tryScroll(a[i]))return true}return false}`);
    
    // Diagnose scroll containers
    const scrollDiag = await page.evaluate(`
      (function() {
        var r = {};
        var sels = ['[data-testid="main-scroll-container"]','[data-scroll-container]','#main','main','[role="main"]','.main-view-container','.os-viewport'];
        for (var i = 0; i < sels.length; i++) {
          var el = document.querySelector(sels[i]);
          if (el) r[sels[i]] = {sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY};
        }
        var a = document.querySelectorAll('div,main,section');
        var scrollables = [];
        for (var i = 0; i < a.length; i++) {
          var s = getComputedStyle(a[i]);
          if ((s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll') && a[i].scrollHeight > a[i].clientHeight + 50) {
            scrollables.push({tag: a[i].tagName, cls: (a[i].className||'').substring(0,80), sh: a[i].scrollHeight, ch: a[i].clientHeight, oy: s.overflowY});
          }
        }
        r._scrollables = scrollables.slice(0, 5);
        r._winScrollH = document.documentElement.scrollHeight;
        r._winClientH = document.documentElement.clientHeight;
        return r;
      })()
    `);
    logger.info('[SpotifySourceAdapter] Scroll diagnostics', { diag: scrollDiag });
    
    const scrollContainer = async (step: number): Promise<boolean> => {
      return page.evaluate('window.__plScrollStep(' + step + ')') as Promise<boolean>;
    };
    
    // Inject playlist extraction helper as string
    await page.evaluate(`window.__plExtractPlaylists=function(){var links=document.querySelectorAll('a[href*="/playlist/"]');var results=[];var seen={};for(var i=0;i<links.length;i++){var href=links[i].getAttribute('href');if(!href)continue;var m=href.match(/\\/playlist\\/([A-Za-z0-9]+)/);if(!m)continue;var pid=m[1];if(seen[pid])continue;seen[pid]=true;var card=links[i].closest('[data-testid="playlist-card"]')||links[i].closest('div[role="gridcell"]')||links[i].closest('article')||links[i];var name='';var tsels=['[data-testid="card-title"]','div[data-encore-id="text"]','span','div'];for(var j=0;j<tsels.length;j++){var el=card.querySelector(tsels[j]);if(el){var t=(el.textContent||'').trim();if(t&&t.length<200&&t.indexOf('songs')===-1){name=t;break}}}if(!name){var lt=(links[i].textContent||'').trim();name=(lt&&lt.length<200)?lt:'Untitled Playlist'}var tc=0;var tcm=(card.textContent||'').match(/(\\d+)\\s+songs?/i);if(tcm)tc=parseInt(tcm[1],10);var img=card.querySelector('img');var cover=img?(img.getAttribute('src')||undefined):undefined;results.push({id:pid,name:name,trackCount:tc,coverUrl:cover})}return results}`);
    
    const extractVisiblePlaylists = async (): Promise<Array<{ id: string; name: string; trackCount: number; coverUrl?: string }>> => {
      return page.evaluate('window.__plExtractPlaylists()') as Promise<Array<{ id: string; name: string; trackCount: number; coverUrl?: string }>>;
    };
    // Accumulate playlists in a Map keyed by playlist ID
    const allPlaylists = new Map<string, PlaylistInfo>();
    
    // Helper to add visible playlists to the accumulated map
    const collectVisible = async () => {
      const visible = await extractVisiblePlaylists();
      let newCount = 0;
      for (const p of visible) {
        if (!allPlaylists.has(p.id)) {
          allPlaylists.set(p.id, { id: p.id, name: p.name, trackCount: p.trackCount, coverUrl: p.coverUrl });
          newCount++;
        }
      }
      return newCount;
    };
    
    // First extract at initial scroll position
    await collectVisible();
    logger.info('[SpotifySourceAdapter] Initial playlists visible', { userId, count: allPlaylists.size });
    
    // Scroll incrementally, collecting playlists at each position
    let noNewCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 200;
    const scrollStep = 600;
    
    while (scrollAttempts < maxScrollAttempts && noNewCount < 5) {
      const didScroll = await scrollContainer(scrollStep);
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const newCount = await collectVisible();
      
      if (newCount === 0) {
        noNewCount++;
      } else {
        noNewCount = 0;
      }
      
      scrollAttempts++;
      
      if (scrollAttempts % 10 === 0) {
        logger.info('[SpotifySourceAdapter] Scroll progress', { 
          userId, 
          attempt: scrollAttempts, 
          totalCollected: allPlaylists.size,
          newInBatch: newCount,
          didScroll,
        });
      }
      
      // If we couldn't scroll and haven't found new items, we're done
      if (!didScroll && noNewCount >= 2) {
        logger.info('[SpotifySourceAdapter] Cannot scroll further, stopping', { userId, scrollAttempts });
        break;
      }
    }
    
    logger.info('[SpotifySourceAdapter] Finished scrolling', { 
      userId, 
      scrollAttempts,
      totalPlaylistsCollected: allPlaylists.size,
    });
    
    await browser.close();
    browser = undefined;
    
    const playlists = Array.from(allPlaylists.values());
    
    logger.info('[SpotifySourceAdapter] Fetched user playlists with Puppeteer', {
      userId,
      displayName: displayName || userId,
      playlistCount: playlists.length,
    });
    
    return {
      displayName: displayName || userId,
      playlists,
    };
    
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    logger.error('[SpotifySourceAdapter] Failed to fetch user playlists with Puppeteer', { 
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error, 
      userId 
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
    let token: string | null = null;
    try {
      if (db) {
        token = await getSpotifyToken(userId, db);
      }
    } catch {
      // Ignore token lookup errors - will fall back to unauthenticated
    }
    
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
