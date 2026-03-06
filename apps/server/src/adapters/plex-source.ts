/**
 * Plex Source Adapter
 *
 * Implements SourceAdapter for Plex Media Server.
 * Supports both regular Plex servers and Plex Home managed users.
 *
 * Source IDs:
 *   - Regular server: uses the user's configured server (no prefix needed)
 *   - Plex Home user: prefixed with 'plex-home:{plexHomeUserId}'
 */

import axios from 'axios';
import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { PlexClient } from '../services/plex';
import { logger } from '../utils/logger';

const PLEX_TV_API = 'https://plex.tv/api/v2';

/**
 * Obtain a managed user's token via the Plex Home switch endpoint.
 * Requires the admin token of the Plex Home owner.
 */
async function getManagedUserToken(plexHomeUserId: string, adminToken: string): Promise<string> {
  const response = await axios.post(
    `${PLEX_TV_API}/home/users/${plexHomeUserId}/switch`,
    null,
    {
      headers: {
        Accept: 'application/json',
        'X-Plex-Token': adminToken,
        'X-Plex-Product': 'Playlist Lab',
        'X-Plex-Client-Identifier': 'playlist-lab-server',
      },
    }
  );

  const token = response.data?.authToken;
  if (!token) {
    throw new Error(`Failed to obtain token for Plex Home user ${plexHomeUserId}`);
  }
  return token;
}

export const plexSourceAdapter: SourceAdapter = {
  meta: {
    id: 'plex',
    name: 'Plex',
    icon: 'plex',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  /**
   * List all audio playlists from the user's configured Plex server.
   * For Plex Home sources the caller should use fetchTracks with the plex-home: prefixed ID.
   */
  async listPlaylists(userId: number, db: any): Promise<PlaylistInfo[]> {
    const userServer = db.prepare('SELECT * FROM user_servers WHERE user_id = ?').get(userId) as any;
    if (!userServer) {
      throw new Error('No Plex server configured for this user');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      throw new Error('User not found');
    }

    const client = new PlexClient(userServer.server_url, user.plex_token);
    const rawPlaylists = await client.getPlaylists();

    return rawPlaylists
      .filter((p: any) => p.playlistType === 'audio')
      .map((p: any) => ({
        id: p.ratingKey,
        name: p.title,
        trackCount: p.leafCount ?? 0,
        durationMs: p.duration ?? undefined,
        coverUrl: p.composite
          ? `${userServer.server_url}${p.composite}?X-Plex-Token=${user.plex_token}`
          : undefined,
      }));
  },

  /**
   * Fetch all tracks from a Plex playlist.
   *
   * @param playlistUrlOrId - Either a plain playlist ratingKey, or a compound ID
   *   in the form 'plex-home:{plexHomeUserId}:{playlistRatingKey}' for managed users.
   */
  async fetchTracks(
    playlistUrlOrId: string,
    userId: number,
    db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const userServer = db.prepare('SELECT * FROM user_servers WHERE user_id = ?').get(userId) as any;
    if (!userServer) {
      throw new Error('No Plex server configured for this user');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      throw new Error('User not found');
    }

    let token = user.plex_token;
    let playlistId = playlistUrlOrId;

    // Handle Plex Home managed user: 'plex-home:{plexHomeUserId}:{playlistId}'
    if (playlistUrlOrId.startsWith('plex-home:')) {
      const parts = playlistUrlOrId.split(':');
      // parts[0] = 'plex-home', parts[1] = plexHomeUserId, parts[2] = playlistId
      if (parts.length < 3) {
        throw new Error(`Invalid plex-home source ID format: ${playlistUrlOrId}`);
      }
      const plexHomeUserId = parts[1];
      playlistId = parts.slice(2).join(':');

      logger.info('[PlexSourceAdapter] Switching to Plex Home user', { plexHomeUserId });
      token = await getManagedUserToken(plexHomeUserId, user.plex_token);
    }

    const client = new PlexClient(userServer.server_url, token);

    // Fetch playlist metadata
    const allPlaylists = await client.getPlaylists();
    const plexPlaylist = allPlaylists.find((p: any) => p.ratingKey === playlistId);

    if (!plexPlaylist) {
      throw new Error(`Playlist ${playlistId} not found on Plex server`);
    }

    const playlist: PlaylistInfo = {
      id: plexPlaylist.ratingKey,
      name: plexPlaylist.title,
      trackCount: plexPlaylist.leafCount ?? 0,
      durationMs: plexPlaylist.duration ?? undefined,
      coverUrl: plexPlaylist.composite
        ? `${userServer.server_url}${plexPlaylist.composite}?X-Plex-Token=${token}`
        : undefined,
    };

    // Fetch tracks
    const rawTracks = await client.getPlaylistTracks(playlistId);

    const tracks: TrackInfo[] = rawTracks.map((t: any) => ({
      title: t.title,
      artist: t.grandparentTitle ?? '',
      album: t.parentTitle ?? undefined,
    }));

    logger.info('[PlexSourceAdapter] Fetched playlist tracks', {
      playlistId,
      playlistName: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
