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
 * Method 1: Spotify API (if user is authenticated)
 * Method 2: OEmbed API (most reliable, no auth)
 * Method 3: Embed page scraping
 * Method 4: Suggest OAuth
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
    
    // Method 1: Try Spotify API if user is authenticated
    if (userId && db) {
      try {
        const { getSpotifyToken } = await import('../routes/spotify-auth');
        const accessToken = await getSpotifyToken(userId, db);
        
        if (accessToken) {
          console.log('[Spotify] Using authenticated API for playlist', playlistId);
          
          // Fetch playlist details
          const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (playlistResponse.data) {
            const playlist = playlistResponse.data;
            const tracks: ExternalTrack[] = [];
            
            // Get all tracks (handle pagination)
            let nextUrl = playlist.tracks.href;
            while (nextUrl) {
              const tracksResponse = await axios.get(nextUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              });
              
              const tracksData = tracksResponse.data;
              
              for (const item of tracksData.items) {
                if (item?.track) {
                  tracks.push({
                    title: item.track.name || 'Unknown',
                    artist: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                    album: item.track.album?.name,
                  });
                }
              }
              
              nextUrl = tracksData.next;
            }
            
            console.log('[Spotify] Successfully fetched playlist via API:', {
              name: playlist.name,
              trackCount: tracks.length,
              isPrivate: !playlist.public
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
      } catch (apiError) {
        console.error('[Spotify] API method failed, falling back to scraping:', apiError);
        // Continue to fallback methods
      }
    }
    
    // Method 1: Try Spotify's oEmbed API (most reliable, publicly accessible)
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
      const oembedResponse = await axios.get(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (oembedResponse.data) {
        // oEmbed gives us basic info, but not track list
        // We need to fetch the actual page to get tracks
        const pageResponse = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          }
        });
        
        const html = pageResponse.data;
        
        // Try to extract Spotify data from meta tags and scripts
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
        
        // Try to find track data in various script tags
        let tracks: ExternalTrack[] = [];
        
        // Method 1a: Look for __NEXT_DATA__
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
        if (nextDataMatch) {
          try {
            const data = JSON.parse(nextDataMatch[1]);
            const playlist = data?.props?.pageProps?.state?.data?.entity;
            
            if (playlist?.tracks?.items) {
              tracks = playlist.tracks.items
                .filter((item: any) => item?.track)
                .map((item: any) => ({
                  title: item.track.name || 'Unknown',
                  artist: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                  album: item.track.album?.name,
                }));
            }
          } catch (parseError) {
            console.error('[Spotify] Failed to parse __NEXT_DATA__:', parseError);
          }
        }
        
        // Method 1b: Look for Spotify resource data
        if (tracks.length === 0) {
          const resourceMatch = html.match(/Spotify\.Entity\s*=\s*({.+?});/s);
          if (resourceMatch) {
            try {
              const data = JSON.parse(resourceMatch[1]);
              if (data?.tracks?.items) {
                tracks = data.tracks.items
                  .filter((item: any) => item?.track)
                  .map((item: any) => ({
                    title: item.track.name || 'Unknown',
                    artist: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                    album: item.track.album?.name,
                  }));
              }
            } catch (parseError) {
              console.error('[Spotify] Failed to parse Spotify.Entity:', parseError);
            }
          }
        }
        
        if (tracks.length > 0) {
          // Try to extract cover image from meta tags
          const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
          
          return {
            id: `spotify-${playlistId}`,
            name: titleMatch?.[1] || oembedResponse.data.title || 'Spotify Playlist',
            description: descMatch?.[1] || '',
            source: 'spotify',
            tracks,
            coverUrl: imageMatch?.[1],
          };
        }
      }
    } catch (oembedError) {
      console.error('[Spotify] oEmbed method failed:', oembedError);
    }
    
    // Method 2: Try embed page as fallback
    try {
      const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
      const response = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = response.data;
      const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        const playlist = data?.props?.pageProps?.state?.data?.entity;
        
        if (playlist?.tracks?.items) {
          const tracks: ExternalTrack[] = playlist.tracks.items
            .filter((item: any) => item?.track)
            .map((item: any) => ({
              title: item.track.name || 'Unknown',
              artist: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
              album: item.track.album?.name,
            }));
          
          if (tracks.length > 0) {
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
      }
    } catch (embedError) {
      console.error('[Spotify] Embed scraping failed:', embedError);
    }
    
    // All methods failed - suggest OAuth or provide helpful error
    throw new Error(
      'Unable to fetch Spotify playlist data. Possible reasons:\n' +
      '• The playlist may be private or region-restricted\n' +
      '• Spotify may have changed their page structure\n' +
      '• The playlist URL may be invalid\n\n' +
      'Solutions:\n' +
      '• Try a different public playlist\n' +
      '• Set up OAuth connection if you have Spotify developer credentials\n' +
      '• Use the direct import button (will attempt to fetch during import)'
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


// ==================== M3U FILE PARSING ====================

/**
 * Parse M3U/M3U8 playlist file content
 */
export function parseM3UFile(content: string, fileName: string): ExternalPlaylist {
  const lines = content.split(/\r?\n/);
  const tracks: ExternalTrack[] = [];
  
  let currentTitle = '';
  let currentArtist = '';
  
  // Detect format by analyzing first few EXTINF lines
  // Apple Music/iTunes uses "Title - Artist", most others use "Artist - Title"
  let useAppleFormat = false;
  const sampleLines = lines.slice(0, 20).filter(l => l.trim().startsWith('#EXTINF:'));
  if (sampleLines.length >= 3) {
    // Heuristic: if the part after " - " looks like a single artist name (no special chars like parentheses),
    // it's likely Apple format (Title - Artist)
    let appleFormatCount = 0;
    for (const sample of sampleLines.slice(0, Math.min(5, sampleLines.length))) {
      const match = sample.match(/#EXTINF:[^,]*,(.+)/);
      if (match) {
        const info = match[1].trim();
        const dashIndex = info.lastIndexOf(' - ');
        if (dashIndex > 0) {
          const beforeDash = info.substring(0, dashIndex).trim();
          const afterDash = info.substring(dashIndex + 3).trim();
          // If after dash has no parentheses/brackets and is relatively short, likely artist name
          // Also check if before dash has parentheses (common in song titles)
          if (!/[(\[{]/.test(afterDash) && afterDash.length < 50 && /[(\[{]/.test(beforeDash)) {
            appleFormatCount++;
          }
        }
      }
    }
    useAppleFormat = appleFormatCount >= Math.ceil(sampleLines.slice(0, Math.min(5, sampleLines.length)).length / 2);
    debugLog(`[parseM3UFile] Detected format: ${useAppleFormat ? 'Apple (Title - Artist)' : 'Standard (Artist - Title)'}`);
  }
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments (except EXTINF)
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#EXTINF'))) {
      continue;
    }
    
    // Parse EXTINF line: #EXTINF:duration,Artist - Title or #EXTINF:duration,Title - Artist
    if (trimmed.startsWith('#EXTINF')) {
      const match = trimmed.match(/#EXTINF:[^,]*,(.+)/);
      if (match) {
        const info = match[1].trim();
        
        // Use lastIndexOf to handle titles with multiple dashes
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
        // Try to extract from filename
        const filename = trimmed.split(/[/\\]/).pop() || '';
        const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
        
        // Use lastIndexOf to handle filenames with multiple dashes
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
          tracks.push({
            title: nameWithoutExt,
            artist: 'Unknown',
          });
        }
      }
    }
  }
  
  return {
    id: `m3u-${Date.now()}`,
    name: fileName,
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


