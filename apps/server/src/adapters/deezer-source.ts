/**
 * Deezer Source Adapter
 *
 * Implements SourceAdapter for Deezer using the public Deezer API (no auth required).
 * Accepts a Deezer playlist URL or bare playlist ID.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeDeezerPlaylist } from '../services/scrapers';
import { logger } from '../utils/logger';

/** Extract a Deezer playlist ID from a URL or return the value as-is if already an ID */
function extractPlaylistId(urlOrId: string): string {
  // Match https://www.deezer.com/playlist/{id} or https://www.deezer.com/{locale}/playlist/{id}
  const match = urlOrId.match(/playlist\/(\d+)/);
  return match ? match[1] : urlOrId;
}

export const deezerSourceAdapter: SourceAdapter = {
  meta: {
    id: 'deezer',
    name: 'Deezer',
    icon: 'deezer',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const playlistId = extractPlaylistId(playlistUrlOrId);

    const result = await scrapeDeezerPlaylist(playlistId);

    const playlist: PlaylistInfo = {
      id: result.id,
      name: result.name,
      trackCount: result.tracks.length,
      coverUrl: result.coverUrl,
    };

    const tracks: TrackInfo[] = result.tracks.map(t => ({
      title: t.title,
      artist: t.artist,
      album: t.album,
    }));

    logger.info('[DeezerSourceAdapter] Fetched playlist', {
      playlistId,
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
