/**
 * Deezer Target Adapter
 *
 * Uses Deezer's API with an ARL (Application Request Limit) cookie.
 * The ARL is a long-lived session token from the Deezer web app.
 * Users obtain it from their browser cookies after logging in to deezer.com.
 *
 * No developer app registration required.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

function similarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (!na || !nb) return 0;
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let matches = 0, pos = 0;
  for (const ch of shorter) {
    const idx = longer.indexOf(ch, pos);
    if (idx !== -1) { matches++; pos = idx + 1; }
  }
  return Math.round((matches / longer.length) * 100);
}

async function getArl(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'deezer') as any;
  if (!row) return null;
  try { return decrypt(row.access_token, ENCRYPTION_SECRET); } catch { return null; }
}

/** Make an authenticated Deezer API request using the ARL cookie */
async function deezerApi(path: string, arl: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.deezer.com${path}`, {
    ...options,
    headers: {
      'Cookie': `arl=${arl}`,
      'User-Agent': 'Mozilla/5.0',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Deezer API error: ${res.status}`);
  return res.json();
}

export const deezerTargetAdapter: TargetAdapter = {
  meta: {
    id: 'deezer',
    name: 'Deezer',
    icon: 'deezer',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return true; // No server-side credentials needed
  },

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const arl = await getArl(userId, db);
    if (!arl) throw new Error('Not connected to Deezer. Please add your ARL token.');

    const data = await deezerApi(`/search/track?q=${encodeURIComponent(query)}&limit=10`, arl);
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    return (data.data ?? []).map((item: any) => ({
      sourceTrack,
      targetTrackId: String(item.id),
      targetTitle: item.title,
      targetArtist: item.artist?.name ?? '',
      targetAlbum: item.album?.title,
      confidence: similarity(query, item.title),
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
    const arl = await getArl(userId, db);
    if (!arl) throw new Error('Not connected to Deezer. Please add your ARL token.');

    const results: MatchResult[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        const data = await deezerApi(`/search/track?q=${encodeURIComponent(query)}&limit=5`, arl);
        const items: any[] = data.data ?? [];
        if (items.length > 0) {
          const scored = items.map(item => ({
            item,
            score: Math.round(
              similarity(track.title, item.title) * 0.6 +
              similarity(track.artist, item.artist?.name ?? '') * 0.4
            ),
          }));
          scored.sort((a, b) => b.score - a.score);
          const best = scored[0];
          matchResult = {
            sourceTrack: track,
            targetTrackId: String(best.item.id),
            targetTitle: best.item.title,
            targetArtist: best.item.artist?.name ?? '',
            targetAlbum: best.item.album?.title,
            confidence: best.score,
            matched: best.score >= 50,
            skipped: false,
          };
        }
      } catch (err) {
        logger.warn('[DeezerTargetAdapter] Search failed', { track, err });
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
    const arl = await getArl(userId, db);
    if (!arl) throw new Error('Not connected to Deezer. Please add your ARL token.');

    const me = await deezerApi('/user/me', arl);

    const createRes = await fetch(`https://api.deezer.com/user/${me.id}/playlists`, {
      method: 'POST',
      headers: { 'Cookie': `arl=${arl}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: name }),
    });
    if (!createRes.ok) throw new Error(`Failed to create Deezer playlist: ${createRes.status}`);
    const created = await createRes.json() as any;
    const playlistId = String(created.id);

    const trackIds = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => r.targetTrackId!);

    if (trackIds.length > 0) {
      await fetch(`https://api.deezer.com/playlist/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Cookie': `arl=${arl}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ songs: trackIds.join(',') }),
      });
    }

    logger.info('[DeezerTargetAdapter] Created playlist', { userId, playlistId, name, trackCount: trackIds.length });
    return { playlistId, name, trackCount: trackIds.length };
  },

  /**
   * Deezer auth: user provides their ARL cookie from browser DevTools.
   * We return a special "form" URL that the frontend handles as a token input.
   */
  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    return `${redirectUri.replace('/callback', '/form')}?service=deezer&state=${userId}&type=arl`;
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    // code is the ARL token
    const arl = code.trim();
    if (!arl) throw new Error('No ARL token provided');

    // Validate by fetching user info
    const res = await fetch('https://api.deezer.com/user/me', {
      headers: { 'Cookie': `arl=${arl}` },
    });
    if (!res.ok) throw new Error('Invalid Deezer ARL token. Please check and try again.');
    const data = await res.json() as any;
    if (data.error) throw new Error('Invalid Deezer ARL token. Please check and try again.');

    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'deezer', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(arl, ENCRYPTION_SECRET), now, now);

    logger.info('[DeezerTargetAdapter] ARL token stored', { userId, deezerUser: data.name });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    return (await getArl(userId, db)) !== null;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'deezer');
    logger.info('[DeezerTargetAdapter] Connection revoked', { userId });
  },
};
