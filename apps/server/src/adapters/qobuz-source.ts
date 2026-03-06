/**
 * Qobuz Source Adapter
 *
 * Implements SourceAdapter for Qobuz.
 * Uses the existing browser scraper from scrapers.ts.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeQobuzPlaylist } from '../services/scrapers';
import { logger } from '../utils/logger';

export const qobuzSourceAdapter: SourceAdapter = {
  meta: {
    id: 'qobuz',
    name: 'Qobuz',
    icon: 'qobuz',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const result = await scrapeQobuzPlaylist(playlistUrlOrId);

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

    logger.info('[QobuzSourceAdapter] Fetched playlist', {
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
