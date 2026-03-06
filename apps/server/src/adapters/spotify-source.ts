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
   */
  async listPlaylists(userId: number, db: any): Promise<PlaylistInfo[]> {
    const token = await getSpotifyToken(userId, db);
    if (!token) {
      throw new Error('Not connected to Spotify. Please authenticate first.');
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
          throw new Error('Spotify access denied. Please reconnect your Spotify account to grant the required permissions.');
        }
        if (response.status === 401) {
          db.prepare(`UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE id = ?`).run(userId);
          throw new Error('Spotify session expired. Please reconnect your Spotify account.');
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
   */
  async searchPlaylists(query: string, userId: number, db: any): Promise<PlaylistInfo[]> {
    const token = await getSpotifyToken(userId, db);
    if (!token) throw new Error('Not connected to Spotify. Please authenticate first.');

    const url = `https://api.spotify.com/v1/search?type=playlist&q=${encodeURIComponent(query)}&limit=20`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      const message = err?.error?.message || `Spotify search error: ${response.status}`;
      if (response.status === 403 || response.status === 401) {
        db.prepare(`UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE id = ?`).run(userId);
        throw new Error('Spotify access denied. Please reconnect your Spotify account.');
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
   */
  async fetchTracks(
    playlistUrlOrId: string,
    userId: number,
    db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const token = await getSpotifyToken(userId, db);
    if (!token) {
      throw new Error('Not connected to Spotify. Please authenticate first.');
    }

    const playlistId = extractPlaylistId(playlistUrlOrId);

    // Fetch playlist metadata
    const metaResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,tracks(total),images`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaResponse.ok) {
      const err = await metaResponse.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message || `Failed to fetch Spotify playlist: ${metaResponse.status}`);
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
