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
   */
  async searchPlaylists(query: string, userId: number, db: any): Promise<PlaylistInfo[]> {
    const token = await getSpotifyToken(userId, db);
    
    // If no token, try unauthenticated search via public API
    if (!token) {
      logger.info('[SpotifySourceAdapter] No token available, attempting unauthenticated search', { query });
      return this.searchPlaylistsUnauthenticated(query);
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
        return this.searchPlaylistsUnauthenticated(query);
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
   * Search for public Spotify playlists without authentication.
   * Uses Spotify's embed API which doesn't require OAuth.
   */
  async searchPlaylistsUnauthenticated(query: string): Promise<PlaylistInfo[]> {
    try {
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
      logger.warn('[SpotifySourceAdapter] Unauthenticated search requires direct playlist URL', { query });
      return [];
    } catch (error) {
      logger.error('[SpotifySourceAdapter] Unauthenticated search failed', { error, query });
      return [];
    }
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
      return this.fetchTracksUnauthenticated(playlistId);
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
        return this.fetchTracksUnauthenticated(playlistId);
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

  /**
   * Fetch tracks from a public Spotify playlist without authentication.
   * Uses web scraping of the embed page.
   */
  async fetchTracksUnauthenticated(playlistId: string): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    try {
      // Fetch the embed page which contains playlist data
      const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Spotify playlist (unauthenticated): ${response.status}`);
      }

      const html = await response.text();

      // Extract playlist name from title tag
      const nameMatch = html.match(/<title>([^<]+)<\/title>/);
      const playlistName = nameMatch 
        ? nameMatch[1].replace(' - playlist by Spotify', '').replace(' | Spotify', '').trim()
        : 'Spotify Playlist';

      // Try to extract embedded JSON data
      const jsonMatch = html.match(/Spotify\.Entity\s*=\s*({.+?});/);
      let tracks: TrackInfo[] = [];

      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const trackList = data?.tracks?.items || [];
          
          tracks = trackList
            .filter((item: any) => item?.track)
            .map((item: any) => ({
              title: item.track.name || '',
              artist: item.track.artists?.[0]?.name || '',
              album: item.track.album?.name,
            }));
        } catch (parseError) {
          logger.warn('[SpotifySourceAdapter] Failed to parse embedded JSON', { parseError });
        }
      }

      // If we couldn't extract tracks from JSON, try to scrape the HTML
      if (tracks.length === 0) {
        logger.warn('[SpotifySourceAdapter] Could not extract tracks from embed page', { playlistId });
        throw new Error('Unable to fetch playlist tracks without authentication. Please connect your Spotify account or ensure the playlist is public.');
      }

      const playlist: PlaylistInfo = {
        id: playlistId,
        name: playlistName,
        trackCount: tracks.length,
        coverUrl: undefined,
      };

      logger.info('[SpotifySourceAdapter] Fetched playlist tracks (unauthenticated)', {
        playlistId,
        playlistName,
        trackCount: tracks.length,
      });

      return { playlist, tracks };
    } catch (error) {
      logger.error('[SpotifySourceAdapter] Unauthenticated fetch failed', { error, playlistId });
      throw new Error('Unable to fetch Spotify playlist without authentication. Please connect your Spotify account or provide a valid public playlist URL.');
    }
  },
};
