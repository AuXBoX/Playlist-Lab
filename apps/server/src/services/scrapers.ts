/**
 * External Service Scrapers
 * Ported from Electron app for server-side use
 * 
 * Note: Some scrapers (Spotify, Apple Music, Tidal, YouTube Music, Amazon Music, Qobuz, ARIA)
 * require JavaScript rendering which is not implemented in this basic version.
 * For production use, consider:
 * 1. Using official APIs where available (Spotify, Apple Music, Tidal)
 * 2. Using puppeteer or playwright for JavaScript-heavy sites
 * 3. Using third-party scraping services
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { debugLog } from '../utils/debug-logger';

export interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
}

export interface ExternalPlaylist {
  id: string;
  name: string;
  description: string;
  source: string;
  tracks: ExternalTrack[];
  coverUrl?: string;
}

// ==================== DEEZER ====================

/**
 * Scrape Deezer playlist by ID
 */
export async function scrapeDeezerPlaylist(playlistId: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Deezer playlist...'
  });
  try {
    const response = await axios.get(`https://api.deezer.com/playlist/${playlistId}`);
    const data = response.data;
    
    // Check for API error response
    if (data.error) {
      throw new Error(data.error.message || 'Deezer API error');
    }
    
    if (!data || !data.tracks) {
      throw new Error('Invalid Deezer playlist response');
    }
    
    const tracks: ExternalTrack[] = data.tracks.data.map((track: any) => ({
      title: track.title,
      artist: track.artist?.name || 'Unknown',
      album: track.album?.title,
    }));
    
    return {
      id: `deezer-${playlistId}`,
      name: data.title || 'Deezer Playlist',
      description: data.description || '',
      source: 'deezer',
      tracks,
      coverUrl: data.picture_xl || data.picture_big || data.picture_medium || data.picture,
    };
  } catch (error) {
    console.error('[Deezer] Scrape error:', error);
    throw new Error(`Failed to scrape Deezer playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Deezer charts for a country
 */
export async function getDeezerCharts(country: string): Promise<ExternalPlaylist[]> {
  const playlists: ExternalPlaylist[] = [];
  
  const countryNames: Record<string, string> = {
    'global': 'Global', 'us': 'United States', 'gb': 'United Kingdom',
    'au': 'Australia', 'ca': 'Canada', 'de': 'Germany', 'fr': 'France',
    'es': 'Spain', 'br': 'Brazil', 'jp': 'Japan',
  };

  try {
    // Always fetch global top tracks
    const topRes = await axios.get('https://api.deezer.com/chart/0/tracks?limit=50');
    if (topRes.data?.data?.length) {
      playlists.push({
        id: 'deezer-top-global',
        name: 'Top 50 Global',
        description: 'Most played tracks worldwide',
        source: 'deezer',
        tracks: topRes.data.data.map((t: any) => ({
          title: t.title,
          artist: t.artist?.name || 'Unknown',
          album: t.album?.title,
        })),
      });
    }

    // For non-global, try to get country-specific playlist
    if (country !== 'global') {
      const searchQuery = encodeURIComponent(`Top 50 ${countryNames[country] || country}`);
      const searchRes = await axios.get(`https://api.deezer.com/search/playlist?q=${searchQuery}&limit=5`);
      
      if (searchRes.data?.data) {
        const chartPlaylist = searchRes.data.data.find((p: any) => 
          p.title?.toLowerCase().includes('top') && 
          p.title?.toLowerCase().includes(countryNames[country]?.toLowerCase() || country)
        );
        
        if (chartPlaylist) {
          const playlistRes = await axios.get(`https://api.deezer.com/playlist/${chartPlaylist.id}/tracks?limit=50`);
          if (playlistRes.data?.data?.length) {
            playlists.push({
              id: `deezer-top-${country}`,
              name: `Top 50 ${countryNames[country] || country}`,
              description: `Top tracks in ${countryNames[country] || country}`,
              source: 'deezer',
              tracks: playlistRes.data.data.map((t: any) => ({
                title: t.title,
                artist: t.artist?.name || 'Unknown',
                album: t.album?.title,
              })),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[Deezer] Charts error:', error);
  }

  return playlists;
}

// ==================== SPOTIFY ====================

/**
 * Scrape Spotify playlist from URL using multiple fallback methods
 * Method 1: Embed page scraping (no auth needed, up to 100 tracks)
 * Method 1b: Puppeteer DOM scrolling (no auth needed, up to 1000+ tracks)
 * Method 2: Spotify API (if user is authenticated with Premium)
 * Method 3: Client Credentials API (requires Premium app owner)
 */
export async function scrapeSpotifyPlaylist(url: string, progressEmitter?: EventEmitter, userId?: number, db?: any): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Spotify playlist...'
  });
  try {
    // Extract playlist ID from URL
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!match) {
      throw new Error('Invalid Spotify playlist URL');
    }
    
    const playlistId = match[1];
    
    // Method 1: Embed page scraping (no auth needed, works for any public playlist)
    // The embed page returns __NEXT_DATA__ with full track data in the initial HTML - no lazy loading
    try {
      const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
      console.log('[Spotify] Trying embed page scraping for playlist', playlistId);
      
      const response = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      const html = response.data;
      const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        const entity = data?.props?.pageProps?.state?.data?.entity;
        
        if (entity?.trackList?.length > 0) {
          const tracks: ExternalTrack[] = entity.trackList
            .filter((item: any) => item?.title)
            .map((item: any) => ({
              title: item.title || 'Unknown',
              artist: item.subtitle || 'Unknown',
              album: undefined, // Embed page doesn't include album info
            }));
          
          const coverUrl = entity.coverArt?.sources?.[0]?.url;
          
          console.log('[Spotify] Successfully scraped playlist via embed page:', {
            name: entity.name,
            trackCount: tracks.length,
          });
          
          // If we hit the 100-track embed cap, try Puppeteer for more tracks
          if (tracks.length >= 100) {
            console.log('[Spotify] Embed returned 100 tracks (cap), trying Puppeteer for more...');
            try {
              const { scrapeSpotifyWithBrowser } = await import('./browser-scrapers');
              const browserResult = await scrapeSpotifyWithBrowser(url, progressEmitter);
              
              if (browserResult.tracks.length > tracks.length) {
                console.log(`[Spotify] Puppeteer found ${browserResult.tracks.length} tracks (vs ${tracks.length} from embed), using Puppeteer result`);
                return {
                  ...browserResult,
                  // Keep embed cover URL if Puppeteer didn't find one
                  coverUrl: browserResult.coverUrl || coverUrl,
                };
              }
              console.log(`[Spotify] Puppeteer found ${browserResult.tracks.length} tracks (not more than embed), using embed result`);
            } catch (browserError: any) {
              console.warn('[Spotify] Puppeteer fallback failed, using embed result:', browserError.message);
            }
          }
          
          progressEmitter?.emit('progress', {
            type: 'progress',
            phase: 'scraping',
            current: tracks.length,
            total: tracks.length,
            currentTrackName: `Found ${tracks.length} tracks`
          });
          
          return {
            id: `spotify-${playlistId}`,
            name: entity.name || 'Spotify Playlist',
            description: entity.subtitle || '',
            source: 'spotify',
            tracks,
            coverUrl,
          };
        }
      }
      
      console.warn('[Spotify] Embed page returned no track data, trying API methods');
    } catch (embedError: any) {
      console.error('[Spotify] Embed scraping failed:', embedError.message);
    }
    
    // Method 2: Try Spotify API if user is authenticated (requires Premium on app owner)
    if (userId && db) {
      try {
        const { getSpotifyToken } = await import('../routes/spotify-auth');
        const accessToken = await getSpotifyToken(userId, db);
        
        if (accessToken) {
          console.log('[Spotify] Using authenticated API for playlist', playlistId);
          
          const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          
          if (playlistResponse.data) {
            const playlist = playlistResponse.data;
            const tracks: ExternalTrack[] = [];
            
            // Handle the new API field names: items/items/item (Feb 2026 changes)
            let nextUrl = playlist.items?.href || playlist.tracks?.href;
            while (nextUrl) {
              const tracksResponse = await axios.get(nextUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              
              const tracksData = tracksResponse.data;
              const items = tracksData.items || [];
              
              for (const item of items) {
                const track = item?.item || item?.track;
                if (track) {
                  tracks.push({
                    title: track.name || 'Unknown',
                    artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                    album: track.album?.name,
                  });
                }
              }
              
              nextUrl = tracksData.next;
            }
            
            console.log('[Spotify] Successfully fetched playlist via API:', {
              name: playlist.name,
              trackCount: tracks.length,
            });
            
            return {
              id: `spotify-${playlistId}`,
              name: playlist.name || 'Spotify Playlist',
              description: playlist.description || '',
              source: 'spotify',
              tracks,
              coverUrl: playlist.images?.[0]?.url,
            };
          }
        }
      } catch (apiError: any) {
        console.error('[Spotify] API method failed:', apiError.message);
      }
    }
    
    // Method 3: Try Client Credentials flow (requires Premium app owner)
    try {
      const { getSpotifyClientCredentialsToken } = await import('../routes/spotify-auth');
      const ccToken = await getSpotifyClientCredentialsToken(userId, db);
      
      if (ccToken) {
        console.log('[Spotify] Using Client Credentials flow for playlist', playlistId);
        
        const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
          headers: { 'Authorization': `Bearer ${ccToken}` },
        });
        
        if (playlistResponse.data) {
          const playlist = playlistResponse.data;
          const tracks: ExternalTrack[] = [];
          
          let nextUrl = playlist.items?.href || playlist.tracks?.href;
          while (nextUrl) {
            const tracksResponse = await axios.get(nextUrl, {
              headers: { 'Authorization': `Bearer ${ccToken}` },
            });
            
            const tracksData = tracksResponse.data;
            const items = tracksData.items || [];
            
            for (const item of items) {
              const track = item?.item || item?.track;
              if (track) {
                tracks.push({
                  title: track.name || 'Unknown',
                  artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                  album: track.album?.name,
                });
              }
            }
            
            nextUrl = tracksData.next;
          }
          
          console.log('[Spotify] Successfully fetched playlist via Client Credentials:', {
            name: playlist.name,
            trackCount: tracks.length,
          });
          
          return {
            id: `spotify-${playlistId}`,
            name: playlist.name || 'Spotify Playlist',
            description: playlist.description || '',
            source: 'spotify',
            tracks,
            coverUrl: playlist.images?.[0]?.url,
          };
        }
      }
    } catch (ccError: any) {
      console.error('[Spotify] Client Credentials method failed:', ccError.message);
    }
    
    // All methods failed
    throw new Error(
      'Unable to fetch Spotify playlist data. Possible reasons:\n' +
      '• The playlist may be private or region-restricted\n' +
      '• The playlist URL may be invalid\n' +
      '• Spotify may have changed their embed page structure\n\n' +
      'Make sure the playlist is public and the URL is correct.'
    );
  } catch (error) {
    console.error('[Spotify] Scrape error:', error);
    throw error;
  }
}

// ==================== APPLE MUSIC ====================

/**
 * Scrape Apple Music playlist from URL
 * Uses browser-based scraping with Puppeteer
 */
export async function scrapeAppleMusicPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  debugLog('[Apple Music Scraper] ========== FUNCTION CALLED ==========');
  debugLog('[Apple Music Scraper] URL:', url);
  debugLog('[Apple Music Scraper] Has progressEmitter:', !!progressEmitter);

  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Apple Music playlist...'
  });
  
  try {
    // Try browser-based scraping
    const { scrapeAppleMusicWithBrowser } = await import('./browser-scrapers');
    return await scrapeAppleMusicWithBrowser(url, progressEmitter);
  } catch (browserError) {
    console.error('[Apple Music] Browser scraping failed:', browserError);
    throw new Error(`Failed to scrape Apple Music playlist: ${browserError instanceof Error ? browserError.message : 'Unknown error'}`);
  }
}



// ==================== TIDAL ====================

/**
 * Scrape Tidal playlist from URL
 * Uses browser-based scraping with Puppeteer as primary method
 */
export async function scrapeTidalPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Tidal playlist...'
  });
  
  try {
    // Try browser-based scraping first (most reliable)
    const { scrapeTidalWithBrowser } = await import('./browser-scrapers');
    return await scrapeTidalWithBrowser(url, progressEmitter);
  } catch (browserError) {
    console.error('[Tidal] Browser scraping failed, trying API fallback:', browserError);
    
    // Extract playlist UUID from URL
    const match = url.match(/playlist\/([a-zA-Z0-9-]+)/);
    if (!match) {
      throw new Error('Invalid Tidal playlist URL');
    }
    
    const playlistId = match[1];
    
    // Try Tidal's public API
    try {
      // Tidal has a public API that doesn't require auth for some playlists
      const apiUrl = `https://api.tidal.com/v1/playlists/${playlistId}`;
      const response = await axios.get(apiUrl, {
        params: {
          countryCode: 'US',
          limit: 100,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (response.data) {
        const playlist = response.data;
        const tracks: ExternalTrack[] = [];
        
        // Get tracks
        if (playlist.tracks) {
          for (const track of playlist.tracks) {
            tracks.push({
              title: track.title || 'Unknown',
              artist: track.artist?.name || track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
              album: track.album?.title,
            });
          }
        }
        
        return {
          id: `tidal-${playlistId}`,
          name: playlist.title || 'Tidal Playlist',
          description: playlist.description || '',
          source: 'tidal',
          tracks,
        };
      }
    } catch (apiError) {
      console.error('[Tidal] API fetch failed:', apiError);
    }
    
    // Fallback: Try to scrape the embed page
    try {
      const embedUrl = `https://embed.tidal.com/playlists/${playlistId}`;
      const response = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      const html = response.data;
      
      // Try to extract JSON data from the page
      const dataMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
      if (dataMatch) {
        const data = JSON.parse(dataMatch[1]);
        if (data.playlist) {
          const tracks: ExternalTrack[] = (data.playlist.tracks || []).map((t: any) => ({
            title: t.title || 'Unknown',
            artist: t.artist?.name || 'Unknown',
            album: t.album?.title,
          }));
          
          return {
            id: `tidal-${playlistId}`,
            name: data.playlist.title || 'Tidal Playlist',
            description: data.playlist.description || '',
            source: 'tidal',
            tracks,
          };
        }
      }
    } catch (embedError) {
      console.error('[Tidal] Embed scraping failed:', embedError);
    }
    
    throw new Error('Unable to fetch Tidal playlist. The playlist may be private or require authentication.');
  }
}

// ==================== YOUTUBE MUSIC ====================

/**
 * Scrape YouTube Music playlist from URL
 * Uses ytmusic-api for reliable data extraction
 */
export async function scrapeYouTubeMusicPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching YouTube Music playlist...'
  });
  
  try {
    // Extract playlist ID from URL
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error('Invalid YouTube Music playlist URL. Please provide a valid playlist link.');
    }
    
    const playlistId = match[1];
    
    // Use ytmusic-api
    const { default: YTMusic } = await import('ytmusic-api');
    const ytmusic = new YTMusic();
    await ytmusic.initialize();
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: 0,
      total: 0,
      currentTrackName: 'Loading playlist details...'
    });
    
    // Get playlist details - getPlaylist returns basic info without tracks
    // Get playlist info
    const playlistInfo: any = await ytmusic.getPlaylist(playlistId);
    
    if (!playlistInfo) {
      throw new Error('Playlist not found or is private');
    }
    
    // Try to get tracks from items
    const trackList = playlistInfo.items || [];
    
    console.log('[YouTube Music] Playlist info:', {
      playlistId,
      name: playlistInfo.name,
      trackListLength: trackList.length,
      firstTrack: trackList[0] ? Object.keys(trackList[0]) : null
    });
    
    // If no tracks found, throw error to trigger browser scraping fallback
    if (trackList.length === 0) {
      console.warn('[YouTube Music] No tracks found via API, falling back to browser scraping');
      throw new Error('No tracks found in playlist via API');
    }
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: 0,
      total: trackList.length,
      currentTrackName: 'Extracting tracks...'
    });
    
    // Extract tracks - ytmusic-api returns items with different structure
    const tracks: ExternalTrack[] = trackList.map((item: any) => {
      // The item has a 'name' field for title and 'artists' array
      const title = item.name || item.title || 'Unknown';
      const artist = item.artists && item.artists.length > 0 
        ? item.artists.map((a: any) => a.name).join(', ')
        : 'Unknown';
      const album = item.album?.name || undefined;
      
      return {
        title,
        artist,
        album,
      };
    });
    
    // Get cover URL - YouTube Music uses thumbnails array
    let coverUrl: string | undefined;
    if (playlistInfo.thumbnails && playlistInfo.thumbnails.length > 0) {
      // Get the highest quality thumbnail
      const thumbnail = playlistInfo.thumbnails[playlistInfo.thumbnails.length - 1];
      coverUrl = thumbnail.url;
    }
    
    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: tracks.length,
      total: tracks.length,
      currentTrackName: `Found ${tracks.length} tracks`,
      coverUrl,
      playlistName: playlistInfo.name || 'YouTube Music Playlist'
    });
    
    return {
      id: `youtube-${playlistId}`,
      name: playlistInfo.name || 'YouTube Music Playlist',
      description: playlistInfo.description || '',
      source: 'youtube',
      tracks,
      coverUrl,
    };
  } catch (error) {
    console.error('[YouTube Music] API scraping failed:', error);
    
    // Fallback to browser scraping if API fails
    try {
      const { scrapeYouTubeMusicWithBrowser } = await import('./browser-scrapers');
      return await scrapeYouTubeMusicWithBrowser(url, progressEmitter);
    } catch (browserError) {
      console.error('[YouTube Music] Browser scraping also failed:', browserError);
      throw new Error(`Failed to scrape YouTube Music playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ==================== AMAZON MUSIC ====================

/**
 * Scrape Amazon Music playlist from URL
 * Uses browser-based scraping with Puppeteer as primary method
 */
export async function scrapeAmazonMusicPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Amazon Music playlist...'
  });
  
  try {
    // Try browser-based scraping first (most reliable)
    const { scrapeAmazonMusicWithBrowser } = await import('./browser-scrapers');
    return await scrapeAmazonMusicWithBrowser(url, progressEmitter);
  } catch (browserError) {
    console.error('[Amazon Music] Browser scraping failed, trying page scraping fallback:', browserError);
    
    // Extract playlist ID from URL
    const match = url.match(/playlists\/([a-zA-Z0-9]+)/);
    if (!match) {
      throw new Error('Invalid Amazon Music playlist URL');
    }
    
    const playlistId = match[1];
    
    // Try to fetch the page
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      const html = response.data;
      
      // Try to extract data from meta tags
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
      
      // Try to find JSON data in script tags
      const scriptMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({.+?})<\/script>/s);
      if (scriptMatch) {
        try {
          const data = JSON.parse(scriptMatch[1]);
          if (data.playlist?.tracks) {
            const tracks: ExternalTrack[] = data.playlist.tracks.map((t: any) => ({
              title: t.title || t.name || 'Unknown',
              artist: t.artist?.name || t.artistName || 'Unknown',
              album: t.album?.title || t.albumName,
            }));
            
            return {
              id: `amazon-${playlistId}`,
              name: titleMatch?.[1] || data.playlist.title || 'Amazon Music Playlist',
              description: descMatch?.[1] || data.playlist.description || '',
              source: 'amazon',
              tracks,
            };
          }
        } catch (parseError) {
          console.error('[Amazon Music] Failed to parse data:', parseError);
        }
      }
    } catch (error) {
      console.error('[Amazon Music] Page fetch failed:', error);
    }
    
    throw new Error('Unable to fetch Amazon Music playlist. Amazon has strong anti-scraping measures and requires authentication.');
  }
}

// ==================== QOBUZ ====================

/**
 * Scrape Qobuz playlist from URL
 * Uses browser-based scraping with Puppeteer as primary method
 */
export async function scrapeQobuzPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Qobuz playlist...'
  });
  
  try {
    // Try browser-based scraping first (most reliable)
    const { scrapeQobuzWithBrowser } = await import('./browser-scrapers');
    return await scrapeQobuzWithBrowser(url, progressEmitter);
  } catch (browserError) {
    console.error('[Qobuz] Browser scraping failed, trying API fallback:', browserError);
    
    // Extract playlist ID from URL
    // Format: https://www.qobuz.com/*/playlist/{name}/{id}
    const match = url.match(/playlist\/[^/]+\/([0-9]+)/);
    if (!match) {
      throw new Error('Invalid Qobuz playlist URL');
    }
    
    const playlistId = match[1];
    
    // Try Qobuz public API
    try {
      const apiUrl = `https://www.qobuz.com/api.json/0.2/playlist/get`;
      const response = await axios.get(apiUrl, {
        params: {
          playlist_id: playlistId,
          limit: 100,
          offset: 0,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (response.data) {
        const playlist = response.data;
        const tracks: ExternalTrack[] = [];
        
        if (playlist.tracks?.items) {
          for (const track of playlist.tracks.items) {
            tracks.push({
              title: track.title || 'Unknown',
              artist: track.performer?.name || track.album?.artist?.name || 'Unknown',
              album: track.album?.title,
            });
          }
        }
        
        return {
          id: `qobuz-${playlistId}`,
          name: playlist.name || 'Qobuz Playlist',
          description: playlist.description || '',
          source: 'qobuz',
          tracks,
        };
      }
    } catch (apiError) {
      console.error('[Qobuz] API fetch failed:', apiError);
    }
    
    // Fallback: Try to scrape the page
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      const html = response.data;
      
      // Try to extract data from script tags
      const dataMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          if (data.playlist) {
            const tracks: ExternalTrack[] = (data.playlist.tracks?.items || []).map((t: any) => ({
              title: t.title || 'Unknown',
              artist: t.performer?.name || t.album?.artist?.name || 'Unknown',
              album: t.album?.title,
            }));
            
            return {
              id: `qobuz-${playlistId}`,
              name: data.playlist.name || 'Qobuz Playlist',
              description: data.playlist.description || '',
              source: 'qobuz',
              tracks,
            };
          }
        } catch (parseError) {
          console.error('[Qobuz] Failed to parse data:', parseError);
        }
      }
    } catch (pageError) {
      console.error('[Qobuz] Page scraping failed:', pageError);
    }
    
    throw new Error('Unable to fetch Qobuz playlist. The playlist may be private or require authentication.');
  }
}

// ==================== LISTENBRAINZ ====================

/**
 * Get ListenBrainz playlists for a user
 */
export async function getListenBrainzPlaylists(username: string): Promise<ExternalPlaylist[]> {
  try {
    const response = await axios.get(`https://api.listenbrainz.org/1/user/${username}/playlists/createdfor`);
    const data = response.data;
    
    if (!data || !data.playlists) {
      return [];
    }
    
    const playlists: ExternalPlaylist[] = [];
    
    for (const playlist of data.playlists.slice(0, 10)) {
      try {
        const detailsRes = await axios.get(`https://api.listenbrainz.org/1/playlist/${playlist.identifier}`);
        const details = detailsRes.data.playlist;
        
        const tracks: ExternalTrack[] = details.track.map((t: any) => ({
          title: t.title || 'Unknown',
          artist: t.creator || 'Unknown',
        }));
        
        playlists.push({
          id: `listenbrainz-${playlist.identifier}`,
          name: details.title || 'ListenBrainz Playlist',
          description: details.annotation || '',
          source: 'listenbrainz',
          tracks,
        });
      } catch (error) {
        console.error(`[ListenBrainz] Error fetching playlist ${playlist.identifier}:`, error);
      }
    }
    
    return playlists;
  } catch (error) {
    console.error('[ListenBrainz] Error:', error);
    throw new Error(`Failed to fetch ListenBrainz playlists: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ==================== ARIA CHARTS ====================

/**
 * Scrape ARIA charts from official website
 * Note: This requires HTML parsing of the ARIA website
 */
export async function scrapeAriaCharts(_chartIds?: string[]): Promise<ExternalPlaylist[]> {
  // Not used directly — individual chart URLs are imported via scrapeAriaPlaylist
  return [];
}

/**
 * Scrape a single ARIA chart page by URL
 * Uses browser-based scraping with Puppeteer
 */
export async function scrapeAriaPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching ARIA chart...'
  });

  try {
    const { scrapeAriaChartWithBrowser } = await import('./browser-scrapers');
    return await scrapeAriaChartWithBrowser(url, progressEmitter);
  } catch (browserError) {
    console.error('[ARIA] Browser scraping failed:', browserError);
    throw new Error(`Failed to scrape ARIA chart: ${browserError instanceof Error ? browserError.message : 'Unknown error'}`);
  }
}

/**
 * Scrape Billboard chart
 * Uses billboard-top-100 NPM package for reliable data
 */
export async function scrapeBillboardPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Billboard chart...'
  });

  try {
    const { scrapeBillboardChart } = await import('./browser-scrapers');
    return await scrapeBillboardChart(url, progressEmitter);
  } catch (error) {
    console.error('[Billboard] Scraping failed:', error);
    throw new Error(`Failed to scrape Billboard chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Scrape Last.fm chart using their API
 * Supports: top-tracks, top-artists, top-tags, and tag-based charts
 */
export async function scrapeLastfmPlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching Last.fm chart...'
  });

  try {
    // Parse the URL to determine chart type
    const chartType = url.includes('top-tracks') ? 'top-tracks' 
      : url.includes('top-artists') ? 'top-artists'
      : url.includes('top-tags') ? 'top-tags'
      : url.includes('/tag/') ? 'tag'
      : 'top-tracks';

    const API_KEY = 'b25b959554ed76058ac220b7b2e0a026'; // Public Last.fm API key
    const limit = 100;
    let tracks: { artist: string; title: string }[] = [];
    let playlistName = '';

    if (chartType === 'top-tracks') {
      playlistName = 'Last.fm Top Tracks';
      const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'chart.gettoptracks',
          api_key: API_KEY,
          format: 'json',
          limit
        }
      });

      const topTracks = response.data.tracks?.track || [];
      tracks = topTracks.map((track: any) => ({
        artist: track.artist?.name || 'Unknown Artist',
        title: track.name || 'Unknown Track'
      }));

    } else if (chartType === 'top-artists') {
      playlistName = 'Last.fm Top Artists';
      const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'chart.gettopartists',
          api_key: API_KEY,
          format: 'json',
          limit: 50
        }
      });

      const topArtists = response.data.artists?.artist || [];
      
      // For each artist, get their top tracks
      for (let i = 0; i < Math.min(topArtists.length, 20); i++) {
        const artist = topArtists[i];
        try {
          const artistTracksResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
            params: {
              method: 'artist.gettoptracks',
              artist: artist.name,
              api_key: API_KEY,
              format: 'json',
              limit: 5
            }
          });

          const artistTracks = artistTracksResponse.data.toptracks?.track || [];
          tracks.push(...artistTracks.slice(0, 3).map((track: any) => ({
            artist: artist.name,
            title: track.name
          })));

          progressEmitter?.emit('progress', {
            type: 'progress',
            phase: 'scraping',
            current: i + 1,
            total: 20,
            currentTrackName: `Fetching tracks from ${artist.name}...`
          });
        } catch (err) {
          console.error(`Failed to fetch tracks for ${artist.name}:`, err);
        }
      }

    } else if (chartType === 'top-tags') {
      playlistName = 'Last.fm Top Tags';
      // Get top tags first
      const tagsResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'chart.gettoptags',
          api_key: API_KEY,
          format: 'json',
          limit: 10
        }
      });

      const topTags = tagsResponse.data.tags?.tag || [];
      
      // For each tag, get top tracks
      for (let i = 0; i < Math.min(topTags.length, 10); i++) {
        const tag = topTags[i];
        try {
          const tagTracksResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
            params: {
              method: 'tag.gettoptracks',
              tag: tag.name,
              api_key: API_KEY,
              format: 'json',
              limit: 10
            }
          });

          const tagTracks = tagTracksResponse.data.tracks?.track || [];
          tracks.push(...tagTracks.slice(0, 10).map((track: any) => ({
            artist: track.artist?.name || 'Unknown Artist',
            title: track.name || 'Unknown Track'
          })));

          progressEmitter?.emit('progress', {
            type: 'progress',
            phase: 'scraping',
            current: i + 1,
            total: 10,
            currentTrackName: `Fetching tracks from ${tag.name} tag...`
          });
        } catch (err) {
          console.error(`Failed to fetch tracks for tag ${tag.name}:`, err);
        }
      }

    } else if (chartType === 'tag') {
      // Extract tag name from URL: https://www.last.fm/tag/rock
      const tagMatch = url.match(/\/tag\/([^\/]+)/);
      const tagName = tagMatch ? decodeURIComponent(tagMatch[1]) : 'rock';
      playlistName = `Last.fm Top ${tagName.charAt(0).toUpperCase() + tagName.slice(1)}`;
      
      const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'tag.gettoptracks',
          tag: tagName,
          api_key: API_KEY,
          format: 'json',
          limit
        }
      });

      const tagTracks = response.data.tracks?.track || [];
      tracks = tagTracks.map((track: any) => ({
        artist: track.artist?.name || 'Unknown Artist',
        title: track.name || 'Unknown Track'
      }));
    }

    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: tracks.length,
      total: tracks.length,
      currentTrackName: 'Chart fetched successfully'
    });

    return {
      id: chartType,
      name: playlistName,
      description: `Last.fm ${chartType.replace('-', ' ')} chart`,
      tracks,
      source: 'lastfm'
    };

  } catch (error) {
    console.error('[Last.fm] API request failed:', error);
    throw new Error(`Failed to fetch Last.fm chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


// ==================== M3U FILE PARSING ====================

/**
 * Parse M3U/M3U8 playlist file content
 * Supports various formats:
 * - iTunes/Apple Music: #EXTINF:duration,Title - Artist
 * - Standard M3U: #EXTINF:duration,Artist - Title
 * - Simple M3U: Just file paths (no EXTINF)
 * - Extended formats with additional metadata
 */
export function parseM3UFile(content: string, fileName: string): ExternalPlaylist {
  debugLog('[parseM3UFile] ========== PARSING FILE ==========');
  debugLog('[parseM3UFile] Filename: ' + fileName);
  debugLog('[parseM3UFile] Content length: ' + content.length + ' chars');
  debugLog('[parseM3UFile] First 200 chars: ' + content.substring(0, 200));
  debugLog('[parseM3UFile] =====================================');
  
  const lines = content.split(/\r?\n/);
  const tracks: ExternalTrack[] = [];
  
  debugLog('[parseM3UFile] Total lines: ' + lines.length);
  
  let currentTitle = '';
  let currentArtist = '';
  
  // Detect format by analyzing first few EXTINF lines
  // Apple Music/iTunes uses "Title - Artist", most others use "Artist - Title"
  let useAppleFormat = false;
  const sampleLines = lines.slice(0, 30).filter(l => l.trim().startsWith('#EXTINF:'));
  debugLog('[parseM3UFile] Sample EXTINF lines found: ' + sampleLines.length);
  
  if (sampleLines.length >= 2) {
    // Heuristic: if the part after " - " looks like a single artist name (no special chars like parentheses),
    // it's likely Apple format (Title - Artist)
    let appleFormatCount = 0;
    let standardFormatCount = 0;
    
    for (const sample of sampleLines.slice(0, Math.min(10, sampleLines.length))) {
      const match = sample.match(/#EXTINF:[^,]*,(.+)/);
      if (match) {
        const info = match[1].trim();
        const dashIndex = info.lastIndexOf(' - ');
        if (dashIndex > 0) {
          const beforeDash = info.substring(0, dashIndex).trim();
          const afterDash = info.substring(dashIndex + 3).trim();
          
          // Check for Apple format indicators:
          // - After dash is short and simple (likely artist name)
          // - Before dash has special chars (common in song titles)
          const afterDashSimple = !/[(\[{]/.test(afterDash) && afterDash.length < 50;
          const beforeDashComplex = /[(\[{]/.test(beforeDash);
          
          if (afterDashSimple && beforeDashComplex) {
            appleFormatCount++;
          } else if (!afterDashSimple || afterDash.length > 50) {
            // Likely standard format (Artist - Title)
            standardFormatCount++;
          }
        }
      }
    }
    
    // Use Apple format if majority of samples indicate it
    useAppleFormat = appleFormatCount > standardFormatCount;
    debugLog(`[parseM3UFile] Format detection - Apple: ${appleFormatCount}, Standard: ${standardFormatCount}`);
    debugLog(`[parseM3UFile] Detected format: ${useAppleFormat ? 'Apple (Title - Artist)' : 'Standard (Artist - Title)'}`);
  }
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // Skip empty lines and comments (except EXTINF)
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#EXTINF'))) {
      continue;
    }
    
    // Parse EXTINF line: #EXTINF:duration,Artist - Title or #EXTINF:duration,Title - Artist
    if (trimmed.startsWith('#EXTINF')) {
      const match = trimmed.match(/#EXTINF:[^,]*,(.+)/);
      if (match) {
        const info = match[1].trim();
        
        // Try to parse artist and title from the info string
        // Support multiple formats:
        // 1. "Artist - Title" or "Title - Artist"
        // 2. "Title" only (no artist)
        
        const dashIndex = info.lastIndexOf(' - ');
        if (dashIndex > 0) {
          const part1 = info.substring(0, dashIndex).trim();
          const part2 = info.substring(dashIndex + 3).trim();
          
          if (useAppleFormat) {
            // Apple format: Title - Artist
            currentTitle = part1;
            currentArtist = part2;
          } else {
            // Standard format: Artist - Title
            currentArtist = part1;
            currentTitle = part2;
          }
        } else {
          // If no " - " separator, use the whole string as title
          currentTitle = info;
          currentArtist = 'Unknown';
        }
      }
    } else if (!trimmed.startsWith('#')) {
      // This is a file path or URL
      // If we have title/artist from EXTINF, use them
      if (currentTitle) {
        tracks.push({
          title: currentTitle,
          artist: currentArtist || 'Unknown',
        });
        currentTitle = '';
        currentArtist = '';
      } else {
        // No EXTINF metadata - try to extract from filename
        // This handles simple M3U files without extended info
        const filename = trimmed.split(/[/\\]/).pop() || '';
        const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
        
        // Skip if it looks like a URL without useful info
        if (nameWithoutExt.length < 3 || /^https?:/.test(trimmed)) {
          debugLog('[parseM3UFile] Skipping line without metadata: ' + trimmed.substring(0, 50));
          continue;
        }
        
        // Try to parse filename for artist/title
        const dashIndex = nameWithoutExt.lastIndexOf(' - ');
        if (dashIndex > 0) {
          const part1 = nameWithoutExt.substring(0, dashIndex).trim();
          const part2 = nameWithoutExt.substring(dashIndex + 3).trim();
          
          if (useAppleFormat) {
            // Apple format: Title - Artist
            tracks.push({
              title: part1,
              artist: part2,
            });
          } else {
            // Standard format: Artist - Title
            tracks.push({
              title: part2,
              artist: part1,
            });
          }
        } else {
          // No separator - use filename as title
          tracks.push({
            title: nameWithoutExt,
            artist: 'Unknown',
          });
        }
      }
    }
  }
  
  debugLog('[parseM3UFile] ========== PARSING COMPLETE ==========');
  debugLog('[parseM3UFile] Tracks found: ' + tracks.length);
  if (tracks.length > 0) {
    debugLog('[parseM3UFile] First track: ' + JSON.stringify(tracks[0]));
    debugLog('[parseM3UFile] Last track: ' + JSON.stringify(tracks[tracks.length - 1]));
  }
  debugLog('[parseM3UFile] =====================================');
  
  if (tracks.length === 0) {
    throw new Error('No tracks found in file. Please ensure the file is a valid M3U/M3U8 playlist with track information.');
  }
  
  return {
    id: `m3u-${Date.now()}`,
    name: fileName.replace(/\.[^.]+$/, ''), // Remove extension from name
    description: `Imported from ${fileName}`,
    source: 'file',
    tracks,
  };
}


// ==================== SEARCH FUNCTIONS ====================

/**
 * Search for Deezer playlists
 */
export async function searchDeezerPlaylists(query: string): Promise<Array<{ name: string; url: string; description: string; count?: number }>> {
  try {
    const response = await axios.get(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(query)}&limit=20`);
    const data = response.data;
    
    if (!data || !data.data) {
      return [];
    }
    
    return data.data.map((playlist: any) => ({
      name: playlist.title,
      url: `https://www.deezer.com/playlist/${playlist.id}`,
      description: playlist.user?.name ? `by ${playlist.user.name}` : '',
      count: playlist.nb_tracks || 0,
    }));
  } catch (error) {
    console.error('Failed to search Deezer playlists:', error);
    return [];
  }
}

/**
 * Get popular Deezer playlists for a country using charts + genre editorial playlists.
 * Uses Deezer's public API (no auth required). Requests run in parallel for speed.
 */
export async function getDeezerPopularPlaylists(country: string): Promise<Array<{ name: string; url: string; description: string; count?: number }>> {
  const countryNames: Record<string, string> = {
    'US': 'USA', 'GB': 'UK', 'CA': 'Canada', 'AU': 'Australia',
    'DE': 'Germany', 'FR': 'France', 'ES': 'Spain', 'IT': 'Italy',
    'BR': 'Brazil', 'MX': 'Mexico', 'JP': 'Japan', 'KR': 'South Korea',
    'IN': 'India', 'NL': 'Netherlands', 'SE': 'Sweden', 'NO': 'Norway',
    'PL': 'Poland', 'AR': 'Argentina', 'CL': 'Chile', 'NZ': 'New Zealand',
  };
  const name = countryNames[country] || country;
  const seen = new Set<string>();

  const addPlaylist = (p: any, results: Array<{ name: string; url: string; description: string; count?: number }>) => {
    const id = String(p.id);
    if (seen.has(id)) return;
    seen.add(id);
    results.push({
      name: p.title,
      url: `https://www.deezer.com/playlist/${p.id}`,
      description: p.user?.name ? `by ${p.user.name} · ${p.nb_tracks || 0} tracks` : `${p.nb_tracks || 0} tracks`,
      count: p.nb_tracks || 0,
    });
  };

  try {
    // Run all API calls in parallel
    const genres = ['Pop', 'Rock', 'Hip Hop', 'Electronic', 'R&B', 'Latin'];
    const [chartRes, countryRes, ...genreResults] = await Promise.allSettled([
      axios.get('https://api.deezer.com/chart/0/playlists?limit=5'),
      axios.get(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(`Top ${name}`)}&limit=5`),
      ...genres.map(g => axios.get(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(g + ' hits')}&limit=1`)),
    ]);

    const results: Array<{ name: string; url: string; description: string; count?: number }> = [];

    // 1. Chart playlists
    if (chartRes.status === 'fulfilled' && chartRes.value.data?.data) {
      for (const p of chartRes.value.data.data) addPlaylist(p, results);
    }

    // 2. Country-specific playlists
    if (countryRes.status === 'fulfilled' && countryRes.value.data?.data) {
      for (const p of countryRes.value.data.data) addPlaylist(p, results);
    }

    // 3. Genre playlists
    for (const gr of genreResults) {
      if (gr.status === 'fulfilled' && gr.value.data?.data?.[0]) {
        addPlaylist(gr.value.data.data[0], results);
      }
    }

    return results;
  } catch (error) {
    console.error('[Deezer] Failed to fetch popular playlists:', error);
    return [];
  }
}
/**
 * Search for YouTube Music playlists
 */
export async function searchYouTubeMusicPlaylists(query: string): Promise<Array<{ name: string; url: string; description: string; videoCount: number }>> {
  try {
    const { default: YTMusic } = await import('ytmusic-api');
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    const results = await ytmusic.searchPlaylists(query);

    if (!results || results.length === 0) {
      return [];
    }

    return results.slice(0, 20).map((playlist: any) => {
      const videoCount = playlist.videoCount || playlist.count || 0;
      return {
        name: playlist.name || playlist.title,
        url: `https://music.youtube.com/playlist?list=${playlist.playlistId}`,
        description: playlist.author?.name ? `by ${playlist.author.name}` : '',
        videoCount: videoCount,
      };
    });
  } catch (error) {
    console.error('Failed to search YouTube Music playlists:', error);
    return [];
  }
}




/**
 * Search for Apple Music playlists by country
 * Uses Apple's free public RSS feed API (no auth required).
 */
export async function searchAppleMusicPlaylists(country: string): Promise<Array<{ name: string; url: string; description: string; count?: number }>> {
  const storefront = country.toLowerCase();
  try {
    const response = await axios.get(
      `https://rss.applemarketingtools.com/api/v2/${storefront}/music/most-played/25/playlists.json`
    );
    const results = response.data?.feed?.results;
    if (!results || !Array.isArray(results)) return [];

    return results.map((p: any) => ({
      name: p.name,
      url: p.url,
      description: p.artistName || '',
      count: undefined,
    }));
  } catch (error) {
    console.error(`[Apple Music] Failed to fetch playlists for ${country}:`, error);
    return [];
  }
}



// ==================== PLAIN YOUTUBE ====================

/**
 * Scrape a plain YouTube playlist (youtube.com/playlist?list=...)
 * Uses the YouTube Data API v3 if an API key is available, otherwise
 * falls back to parsing the public playlist page via axios + cheerio.
 */
export async function scrapeYouTubePlaylist(url: string, progressEmitter?: EventEmitter): Promise<ExternalPlaylist> {
  progressEmitter?.emit('progress', {
    type: 'progress',
    phase: 'scraping',
    current: 0,
    total: 0,
    currentTrackName: 'Fetching YouTube playlist...',
  });

  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Invalid YouTube playlist URL. Please provide a URL containing ?list=...');
  }
  const playlistId = match[1];

  try {
    // Use the YouTube oEmbed-style initial data endpoint
    const pageUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const response = await axios.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const html = response.data as string;

    // Extract ytInitialData JSON blob
    const dataMatch = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!dataMatch) {
      throw new Error('Could not parse YouTube playlist page');
    }

    const data = JSON.parse(dataMatch[1]);

    // Navigate to playlist items
    const contents =
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.contents?.[0]
        ?.playlistVideoListRenderer?.contents ?? [];

    const playlistHeader =
      data?.header?.playlistHeaderRenderer ??
      data?.microformat?.microformatDataRenderer;

    const playlistName: string =
      playlistHeader?.title?.simpleText ||
      playlistHeader?.title?.runs?.[0]?.text ||
      'YouTube Playlist';

    const coverUrl: string | undefined =
      playlistHeader?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
      playlistHeader?.thumbnailDetails?.thumbnails?.slice(-1)[0]?.url;

    const tracks: Array<{ title: string; artist: string; album?: string }> = [];

    for (const item of contents) {
      const video = item?.playlistVideoRenderer;
      if (!video) continue;

      const title: string = video.title?.runs?.[0]?.text || video.title?.simpleText || 'Unknown';
      const channel: string = video.shortBylineText?.runs?.[0]?.text || 'Unknown';

      tracks.push({ title, artist: channel });
    }

    progressEmitter?.emit('progress', {
      type: 'progress',
      phase: 'scraping',
      current: tracks.length,
      total: tracks.length,
      currentTrackName: `Found ${tracks.length} videos`,
    });

    return {
      id: `youtube-${playlistId}`,
      name: playlistName,
      description: '',
      source: 'youtube',
      tracks,
      coverUrl,
    };
  } catch (error) {
    console.error('[YouTube] Scraping failed:', error);
    throw new Error(`Failed to scrape YouTube playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get popular Spotify playlists for a country using the Browse API.
 * Uses Client Credentials flow (no user OAuth needed).
 * Fetches featured playlists + toplists category in parallel.
 */
export async function getSpotifyPopularPlaylists(country: string, userId?: number, db?: any): Promise<Array<{ name: string; url: string; description: string; count?: number; imageUrl?: string; premiumRequired?: boolean }>> {
  try {
    const { getSpotifyClientCredentialsToken } = await import('../routes/spotify-auth');
    const token = await getSpotifyClientCredentialsToken(userId, db);
    
    if (!token) {
      console.warn('[Spotify Charts] No Client Credentials token available');
      return [];
    }

    const results: Array<{ name: string; url: string; description: string; count?: number; imageUrl?: string }> = [];
    const seen = new Set<string>();

    const addPlaylist = (p: any) => {
      if (!p || seen.has(p.id)) return;
      seen.add(p.id);
      results.push({
        name: p.name,
        url: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
        description: p.description || `${p.tracks?.total || 0} tracks`,
        count: p.tracks?.total || 0,
        imageUrl: p.images?.[0]?.url,
      });
    };

    // Fetch featured playlists and toplists category in parallel
    const [featuredRes, toplistsRes] = await Promise.allSettled([
      axios.get('https://api.spotify.com/v1/browse/featured-playlists', {
        params: { country, limit: 20 },
        headers: { 'Authorization': `Bearer ${token}` },
      }),
      axios.get('https://api.spotify.com/v1/browse/categories/toplists/playlists', {
        params: { country, limit: 50 },
        headers: { 'Authorization': `Bearer ${token}` },
      }),
    ]);

    // Check for premium required errors
    const isPremiumError = (result: PromiseSettledResult<any>) => {
      if (result.status === 'rejected' && result.reason?.response?.status === 403) return true;
      if (result.status === 'fulfilled' && result.value.status === 403) return true;
      return false;
    };
    
    const bothFailedWithPremium = isPremiumError(featuredRes) && isPremiumError(toplistsRes);
    if (bothFailedWithPremium) {
      console.warn('[Spotify Charts] Premium required for browse API');
      return [{ name: '__premium_required__', url: '', description: 'Spotify Premium required', count: 0, premiumRequired: true }];
    }

    // Process featured playlists
    if (featuredRes.status === 'fulfilled' && featuredRes.value.data?.playlists?.items) {
      for (const p of featuredRes.value.data.playlists.items) {
        addPlaylist(p);
      }
    }

    // Process toplists
    if (toplistsRes.status === 'fulfilled' && toplistsRes.value.data?.playlists?.items) {
      for (const p of toplistsRes.value.data.playlists.items) {
        addPlaylist(p);
      }
    }

    console.log(`[Spotify Charts] Found ${results.length} playlists for country ${country}`);
    return results;
  } catch (error) {
    console.error('[Spotify Charts] Error fetching popular playlists:', error);
    return [];
  }
}

