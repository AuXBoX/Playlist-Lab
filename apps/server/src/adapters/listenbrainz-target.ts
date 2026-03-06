/**
 * ListenBrainz Target Adapter
 *
 * Implements TargetAdapter for ListenBrainz.
 * ListenBrainz uses a user token (not OAuth) for write operations.
 * The token is stored in oauth_connections as access_token.
 *
 * API docs: https://listenbrainz.readthedocs.io/en/latest/users/api/
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const LB_API = 'https://api.listenbrainz.org';

function similarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (!na || !nb) return 0;
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let matches = 0;
  let pos = 0;
  for (const ch of shorter) {
    const idx = longer.indexOf(ch, pos);
    if (idx !== -1) { matches++; pos = idx + 1; }
  }
  return Math.round((matches / longer.length) * 100);
}

async function getToken(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'listenbrainz') as any;
  if (!row) return null;
  try {
    return decrypt(row.access_token, ENCRYPTION_SECRET);
  } catch {
    return null;
  }
}

export const listenbrainzTargetAdapter: TargetAdapter = {
  meta: {
    id: 'listenbrainz',
    name: 'ListenBrainz',
    icon: 'listenbrainz',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const token = await getToken(userId, db);
    if (!token) throw new Error('Not connected to ListenBrainz. Please add your user token first.');

    // ListenBrainz doesn't have a track search — use MusicBrainz search API
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=10&fmt=json`,
      { headers: { 'User-Agent': 'PlaylistLab/1.0 (playlist-lab)' } }
    );
    if (!res.ok) throw new Error(`MusicBrainz search failed: ${res.status}`);
    const data = await res.json() as any;
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    return (data.recordings ?? []).map((item: any) => ({
      sourceTrack,
      targetTrackId: item.id, // MBID
      targetTitle: item.title ?? '',
      targetArtist: item['artist-credit']?.[0]?.name ?? '',
      targetAlbum: item.releases?.[0]?.title,
      confidence: similarity(query, item.title ?? ''),
      matched: true,
      skipped: false,
    }));
  },

  async matchTracks(
    tracks: TrackInfo[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any,
    progressEmitter?: NodeJS.EventEmitter,
    isCancelled?: () => boolean
  ): Promise<MatchResult[]> {
    const token = await getToken(userId, db);
    if (!token) throw new Error('Not connected to ListenBrainz. Please add your user token first.');

    const results: MatchResult[] = [];

    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `recording:"${track.title}" AND artist:"${track.artist}"`;

      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        const res = await fetch(
          `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
          { headers: { 'User-Agent': 'PlaylistLab/1.0 (playlist-lab)' } }
        );
        if (res.ok) {
          const data = await res.json() as any;
          const items: any[] = data.recordings ?? [];
          if (items.length > 0) {
            const scored = items.map(item => ({
              item,
              score: Math.round(
                similarity(track.title, item.title ?? '') * 0.6 +
                similarity(track.artist, item['artist-credit']?.[0]?.name ?? '') * 0.4
              ),
            }));
            scored.sort((a, b) => b.score - a.score);
            const best = scored[0];
            matchResult = {
              sourceTrack: track,
              targetTrackId: best.item.id,
              targetTitle: best.item.title ?? '',
              targetArtist: best.item['artist-credit']?.[0]?.name ?? '',
              targetAlbum: best.item.releases?.[0]?.title,
              confidence: best.score,
              matched: best.score >= 50,
              skipped: false,
            };
          }
        }
        // Rate limit: MusicBrainz allows 1 req/sec
        await new Promise(r => setTimeout(r, 1100));
      } catch (err) {
        logger.warn('[ListenBrainzTargetAdapter] Search failed', { track, err });
      }

      results.push(matchResult);
      progressEmitter?.emit('progress', { type: 'progress', phase: 'matching', current: i + 1, total: tracks.length });
    }

    return results;
  },

  async createPlaylist(
    name: string,
    matchResults: MatchResult[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }> {
    const token = await getToken(userId, db);
    if (!token) throw new Error('Not connected to ListenBrainz. Please add your user token first.');

    const trackMbids = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => r.targetTrackId!);

    const playlist = {
      playlist: {
        title: name,
        track: trackMbids.map(mbid => ({
          identifier: [`https://musicbrainz.org/recording/${mbid}`],
        })),
      },
    };

    const res = await fetch(`${LB_API}/1/playlist/create`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(playlist),
    });

    if (!res.ok) throw new Error(`Failed to create ListenBrainz playlist: ${res.status}`);
    const data = await res.json() as any;
    const playlistId: string = data.playlist_mbid;

    logger.info('[ListenBrainzTargetAdapter] Created playlist', { userId, playlistId, name, trackCount: trackMbids.length });
    return { playlistId, name, trackCount: trackMbids.length };
  },

  isConfigured(): boolean {
    return true; // ListenBrainz uses a user token, no server-side credentials needed
  },

  /**
   * ListenBrainz uses a user token, not OAuth.
   * We return a special URL that the frontend handles as a token input form.
   */
  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    return `${redirectUri.replace('/callback', '/form')}?service=listenbrainz&state=${userId}`;
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    // code is the ListenBrainz user token
    const userToken = code.trim();
    if (!userToken) throw new Error('No ListenBrainz token provided');

    // Validate the token
    const res = await fetch(`${LB_API}/1/validate-token`, {
      headers: { Authorization: `Token ${userToken}` },
    });
    if (!res.ok) throw new Error('Invalid ListenBrainz token');
    const data = await res.json() as any;
    if (!data.valid) throw new Error('ListenBrainz token is not valid');

    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'listenbrainz', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(userToken, ENCRYPTION_SECRET), now, now);

    // Also store username for source adapter use
    if (data.user_name) {
      try {
        db.prepare('UPDATE users SET listenbrainz_username = ? WHERE id = ?').run(data.user_name, userId);
      } catch { /* column may not exist yet */ }
    }

    logger.info('[ListenBrainzTargetAdapter] Token stored', { userId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    const token = await getToken(userId, db);
    return token !== null;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'listenbrainz');
    logger.info('[ListenBrainzTargetAdapter] Connection revoked', { userId });
  },
};
