/**
 * YouTube Music Source Adapter
 *
 * Implements SourceAdapter for YouTube Music.
 * Uses the existing browser scraper from browser-scrapers.ts.
 */

import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeYouTubeMusicPlaylist } from '../services/scrapers';
import { logger } from '../utils/logger';

/** Extract a YouTube Music playlist ID from a URL */
function extractPlaylistId(url: string): string {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : 'unknown';
}

export const youtubeSourceAdapter: SourceAdapter = {
  meta: {
    id: 'youtube-music',
    name: 'YouTube Music',
    icon: 'youtube-music',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  async fetchTracks(
    playlistUrlOrId: string,
    _userId: number,
    _db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const result = await scrapeYouTubeMusicPlaylist(playlistUrlOrId);

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

    logger.info('[YouTubeSourceAdapter] Fetched playlist', {
      playlistId: extractPlaylistId(playlistUrlOrId),
      name: playlist.name,
      trackCount: tracks.length,
    });

    return { playlist, tracks };
  },
};
