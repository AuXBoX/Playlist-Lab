/**
 * Amazon Music Source Adapter
 *
 * Implements SourceAdapter for Amazon Music.
 * Uses the existing browser scraper from scrapers.ts.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeAmazonMusicPlaylist } from '../services/scrapers';
import { logger } from '../utils/logger';

export const amazonSourceAdapter: SourceAdapter = {
  meta: {
    id: 'amazon',
    name: 'Amazon Music',
    icon: 'amazon',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const result = await scrapeAmazonMusicPlaylist(playlistUrlOrId);

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

    logger.info('[AmazonSourceAdapter] Fetched playlist', {
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
