/**
 * Tidal Source Adapter
 *
 * Implements SourceAdapter for Tidal.
 * Uses the existing browser scraper from scrapers.ts.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeTidalPlaylist } from '../services/scrapers';
import { logger } from '../utils/logger';

export const tidalSourceAdapter: SourceAdapter = {
  meta: {
    id: 'tidal',
    name: 'Tidal',
    icon: 'tidal',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const result = await scrapeTidalPlaylist(playlistUrlOrId);

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

    logger.info('[TidalSourceAdapter] Fetched playlist', {
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
