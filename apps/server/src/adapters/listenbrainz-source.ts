/**
 * ListenBrainz Source Adapter
 *
 * Implements SourceAdapter for ListenBrainz.
 * Input is a username (not a URL). Uses the ListenBrainz public API directly.
 *
 * - listPlaylists: fetches playlists created for the user via /1/user/{username}/playlists/createdfor
 * - fetchTracks: fetches a single playlist by MBID via /1/playlist/{mbid}
 */

import axios from 'axios';
import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { logger } from '../utils/logger';

const LB_API = 'https://api.listenbrainz.org';

/** Extract MBID from a ListenBrainz playlist URL or return as-is if already an MBID */
function extractMbid(urlOrMbid: string): string {
  // Match https://listenbrainz.org/playlist/{mbid} or bare UUID
  const match = urlOrMbid.match(/playlist\/([0-9a-f-]{36})/i);
  return match ? match[1] : urlOrMbid;
}

export const listenbrainzSourceAdapter: SourceAdapter = {
  meta: {
    id: 'listenbrainz',
    name: 'ListenBrainz',
    icon: 'listenbrainz',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  /**
   * List playlists created for the given username.
   * The playlistUrlOrId passed to fetchTracks should be the playlist MBID.
   * Here we use the userId as a username lookup key stored in the DB,
   * but since ListenBrainz uses public usernames, the caller passes the username
   * as the playlistUrlOrId when listing is not available — so we expose listPlaylists
   * keyed by a stored username preference.
   *
   * For the adapter flow: the UI passes the username as the "source ID" suffix,
   * e.g. sourceId = "listenbrainz:myusername", and the playlist MBID as playlistUrlOrId.
   */
  async listPlaylists(userId: number, db: any): Promise<PlaylistInfo[]> {
    // Retrieve the stored ListenBrainz username for this user
    const row = db.prepare('SELECT listenbrainz_username FROM users WHERE id = ?').get(userId) as any;
    const username = row?.listenbrainz_username;
    if (!username) {
      throw new Error('No ListenBrainz username configured. Please set your username in settings.');
    }

    const response = await axios.get(`${LB_API}/1/user/${username}/playlists/createdfor`);
    const data = response.data;

    if (!data?.playlists) return [];

    return data.playlists.map((p: any) => ({
      id: p.identifier,
      name: p.playlist?.title || 'ListenBrainz Playlist',
      trackCount: p.playlist?.track?.length ?? 0,
    }));
  },

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const mbid = extractMbid(playlistUrlOrId);

    const response = await axios.get(`${LB_API}/1/playlist/${mbid}`);
    const data = response.data?.playlist;

    if (!data) {
      throw new Error(`ListenBrainz playlist not found: ${mbid}`);
    }

    const tracks: TrackInfo[] = (data.track ?? []).map((t: any) => ({
      title: t.title || 'Unknown',
      artist: t.creator || 'Unknown',
    }));

    const playlist: PlaylistInfo = {
      id: `listenbrainz-${mbid}`,
      name: data.title || 'ListenBrainz Playlist',
      trackCount: tracks.length,
    };

    logger.info('[ListenBrainzSourceAdapter] Fetched playlist', {
      mbid,
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
