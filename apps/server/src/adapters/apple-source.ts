/**
 * Apple Music Source Adapter
 *
 * Implements SourceAdapter for Apple Music.
 * Uses the existing browser scraper from scrapers.ts.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeAppleMusicPlaylist } from '../services/scrapers';
import { logger } from '../utils/logger';

export const appleSourceAdapter: SourceAdapter = {
  meta: {
    id: 'apple',
    name: 'Apple Music',
    icon: 'apple',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const result = await scrapeAppleMusicPlaylist(playlistUrlOrId);

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

    logger.info('[AppleSourceAdapter] Fetched playlist', {
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
