/**
 * Qobuz Target Adapter
 *
 * Uses Qobuz's API with username/password login.
 * Uses Qobuz's public app_id (embedded in their own web app) — no registration needed.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

// Qobuz's public app_id — embedded in their own web app, no registration needed
const QOBUZ_APP_ID = process.env.QOBUZ_APP_ID || '285473059';

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

async function getToken(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'qobuz') as any;
  if (!row) return null;
  try { return decrypt(row.access_token, ENCRYPTION_SECRET); } catch { return null; }
}

export const qobuzTargetAdapter: TargetAdapter = {
  meta: {
    id: 'qobuz',
    name: 'Qobuz',
    icon: 'qobuz',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return true; // Uses public app_id, no registration needed
  },

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const token = await getToken(userId, db);
    if (!token) throw new Error('Not connected to Qobuz. Please log in first.');

    const res = await fetch(
      `https://www.qobuz.com/api.json/0.2/track/search?query=${encodeURIComponent(query)}&limit=10&app_id=${QOBUZ_APP_ID}`,
      { headers: { 'X-User-Auth-Token': token } }
    );
    if (!res.ok) throw new Error(`Qobuz search failed: ${res.status}`);
    const data = await res.json() as any;
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    return (data.tracks?.items ?? []).map((item: any) => ({
      sourceTrack,
      targetTrackId: String(item.id),
      targetTitle: item.title ?? '',
      targetArtist: item.performer?.name ?? '',
      targetAlbum: item.album?.title,
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
    if (!token) throw new Error('Not connected to Qobuz. Please log in first.');

    const results: MatchResult[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        const res = await fetch(
          `https://www.qobuz.com/api.json/0.2/track/search?query=${encodeURIComponent(query)}&limit=5&app_id=${QOBUZ_APP_ID}`,
          { headers: { 'X-User-Auth-Token': token } }
        );
        if (res.ok) {
          const data = await res.json() as any;
          const items: any[] = data.tracks?.items ?? [];
          if (items.length > 0) {
            const scored = items.map(item => ({
              item,
              score: Math.round(
                similarity(track.title, item.title ?? '') * 0.6 +
                similarity(track.artist, item.performer?.name ?? '') * 0.4
              ),
            }));
            scored.sort((a, b) => b.score - a.score);
            const best = scored[0];
            matchResult = {
              sourceTrack: track,
              targetTrackId: String(best.item.id),
              targetTitle: best.item.title ?? '',
              targetArtist: best.item.performer?.name ?? '',
              targetAlbum: best.item.album?.title,
              confidence: best.score,
              matched: best.score >= 50,
              skipped: false,
            };
          }
        }
      } catch (err) {
        logger.warn('[QobuzTargetAdapter] Search failed', { track, err });
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
    if (!token) throw new Error('Not connected to Qobuz. Please log in first.');

    const createRes = await fetch(
      `https://www.qobuz.com/api.json/0.2/playlist/create?name=${encodeURIComponent(name)}&is_public=false&app_id=${QOBUZ_APP_ID}`,
      { method: 'POST', headers: { 'X-User-Auth-Token': token } }
    );
    if (!createRes.ok) throw new Error(`Failed to create Qobuz playlist: ${createRes.status}`);
    const created = await createRes.json() as any;
    const playlistId = String(created.id);

    const trackIds = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => r.targetTrackId!);

    if (trackIds.length > 0) {
      await fetch(
        `https://www.qobuz.com/api.json/0.2/playlist/addTracks?playlist_id=${playlistId}&track_ids=${trackIds.join(',')}&app_id=${QOBUZ_APP_ID}`,
        { method: 'POST', headers: { 'X-User-Auth-Token': token } }
      );
    }

    logger.info('[QobuzTargetAdapter] Created playlist', { userId, playlistId, name, trackCount: trackIds.length });
    return { playlistId, name, trackCount: trackIds.length };
  },

  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    return `${redirectUri.replace('/callback', '/form')}?service=qobuz&state=${userId}&type=credentials`;
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    // code is "username:password" base64-encoded
    let username: string, password: string;
    try {
      const decoded = Buffer.from(code, 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      username = decoded.slice(0, sep);
      password = decoded.slice(sep + 1);
    } catch {
      throw new Error('Invalid credentials format');
    }

    const res = await fetch(
      `https://www.qobuz.com/api.json/0.2/user/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&app_id=${QOBUZ_APP_ID}`
    );
    if (!res.ok) throw new Error('Qobuz login failed. Check your username and password.');
    const data = await res.json() as any;
    const authToken: string = data.user_auth_token;
    if (!authToken) throw new Error('No auth token returned from Qobuz');

    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'qobuz', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(authToken, ENCRYPTION_SECRET), now, now);

    logger.info('[QobuzTargetAdapter] Login successful', { userId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    return (await getToken(userId, db)) !== null;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'qobuz');
    logger.info('[QobuzTargetAdapter] Connection revoked', { userId });
  },
};
