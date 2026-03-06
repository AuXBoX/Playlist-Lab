/**
 * Tidal Target Adapter
 *
 * Uses Tidal's API with username/password login.
 * The client_id used here is Tidal's own web/mobile app client ID (public).
 * No developer registration required.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

// Tidal's public client ID (used by their own web app)
const TIDAL_PUBLIC_CLIENT_ID = process.env.TIDAL_CLIENT_ID || 'zU4XHVVkc2tDPo4t';
const TIDAL_PUBLIC_CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET || 'VJKhDFqJPqvsPVNBV6ukXTJmwlvbttP7wlMlrc72se4=';

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

async function getToken(userId: number, db: any): Promise<{ token: string; userId: string } | null> {
  const row = db.prepare(
    'SELECT access_token, refresh_token, token_expires_at, scope FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'tidal') as any;
  if (!row) return null;

  try {
    const expiresAt = row.token_expires_at ?? 0;
    const tidalUserId = row.scope ?? ''; // we store tidal user ID in scope field

    if (expiresAt > Date.now() + 60_000) {
      return { token: decrypt(row.access_token, ENCRYPTION_SECRET), userId: tidalUserId };
    }

    // Refresh
    if (!row.refresh_token) return null;
    const refreshToken = decrypt(row.refresh_token, ENCRYPTION_SECRET);
    const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${TIDAL_PUBLIC_CLIENT_ID}:${TIDAL_PUBLIC_CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;

    db.prepare(
      'UPDATE oauth_connections SET access_token = ?, token_expires_at = ?, updated_at = ? WHERE user_id = ? AND service = ?'
    ).run(encrypt(data.access_token, ENCRYPTION_SECRET), newExpiry, Date.now(), userId, 'tidal');

    return { token: data.access_token, userId: tidalUserId };
  } catch {
    return null;
  }
}

export const tidalTargetAdapter: TargetAdapter = {
  meta: {
    id: 'tidal',
    name: 'Tidal',
    icon: 'tidal',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return true; // Uses public client ID, no registration needed
  },

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const auth = await getToken(userId, db);
    if (!auth) throw new Error('Not connected to Tidal. Please log in.');

    const res = await fetch(
      `https://api.tidal.com/v1/search/tracks?query=${encodeURIComponent(query)}&limit=10&countryCode=US`,
      { headers: { Authorization: `Bearer ${auth.token}`, 'X-Tidal-Token': TIDAL_PUBLIC_CLIENT_ID } }
    );
    if (!res.ok) throw new Error(`Tidal search failed: ${res.status}`);
    const data = await res.json() as any;
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    return (data.items ?? []).map((item: any) => ({
      sourceTrack,
      targetTrackId: String(item.id),
      targetTitle: item.title ?? '',
      targetArtist: item.artist?.name ?? item.artists?.[0]?.name ?? '',
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
    const auth = await getToken(userId, db);
    if (!auth) throw new Error('Not connected to Tidal. Please log in.');

    const results: MatchResult[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        const res = await fetch(
          `https://api.tidal.com/v1/search/tracks?query=${encodeURIComponent(query)}&limit=5&countryCode=US`,
          { headers: { Authorization: `Bearer ${auth.token}`, 'X-Tidal-Token': TIDAL_PUBLIC_CLIENT_ID } }
        );
        if (res.ok) {
          const data = await res.json() as any;
          const items: any[] = data.items ?? [];
          if (items.length > 0) {
            const scored = items.map(item => ({
              item,
              score: Math.round(
                similarity(track.title, item.title ?? '') * 0.6 +
                similarity(track.artist, item.artist?.name ?? item.artists?.[0]?.name ?? '') * 0.4
              ),
            }));
            scored.sort((a, b) => b.score - a.score);
            const best = scored[0];
            matchResult = {
              sourceTrack: track,
              targetTrackId: String(best.item.id),
              targetTitle: best.item.title ?? '',
              targetArtist: best.item.artist?.name ?? best.item.artists?.[0]?.name ?? '',
              targetAlbum: best.item.album?.title,
              confidence: best.score,
              matched: best.score >= 50,
              skipped: false,
            };
          }
        }
      } catch (err) {
        logger.warn('[TidalTargetAdapter] Search failed', { track, err });
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
    const auth = await getToken(userId, db);
    if (!auth) throw new Error('Not connected to Tidal. Please log in.');

    // Create playlist
    const createRes = await fetch(`https://api.tidal.com/v1/users/${auth.userId}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'X-Tidal-Token': TIDAL_PUBLIC_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: name, description: '' }),
    });
    if (!createRes.ok) throw new Error(`Failed to create Tidal playlist: ${createRes.status}`);
    const created = await createRes.json() as any;
    const playlistUuid: string = created.uuid;

    const trackIds = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => ({ id: Number(r.targetTrackId!) }));

    if (trackIds.length > 0) {
      await fetch(`https://api.tidal.com/v1/playlists/${playlistUuid}/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'X-Tidal-Token': TIDAL_PUBLIC_CLIENT_ID,
          'Content-Type': 'application/json',
          'If-None-Match': '*',
        },
        body: JSON.stringify({ trackIds: trackIds.map(t => t.id), toIndex: 0 }),
      });
    }

    logger.info('[TidalTargetAdapter] Created playlist', { userId, playlistUuid, name, trackCount: trackIds.length });
    return { playlistId: playlistUuid, name, trackCount: trackIds.length };
  },

  /**
   * Returns a form URL — the frontend shows a username/password form.
   */
  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    return `${redirectUri.replace('/callback', '/form')}?service=tidal&state=${userId}&type=credentials`;
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

    const tokenRes = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${TIDAL_PUBLIC_CLIENT_ID}:${TIDAL_PUBLIC_CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username,
        password,
        scope: 'r_usr w_usr w_sub',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({})) as any;
      throw new Error(err?.error_description || 'Tidal login failed. Check your username and password.');
    }

    const tokens = await tokenRes.json() as any;
    const { access_token, refresh_token, expires_in, user } = tokens;
    const expiresAt = Date.now() + (expires_in ?? 3600) * 1000;
    const tidalUserId = String(user?.userId ?? '');
    const now = Date.now();

    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, refresh_token, token_expires_at, scope, created_at, updated_at)
      VALUES (?, 'tidal', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, refresh_token),
        token_expires_at = excluded.token_expires_at,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `).run(
      userId,
      encrypt(access_token, ENCRYPTION_SECRET),
      refresh_token ? encrypt(refresh_token, ENCRYPTION_SECRET) : null,
      expiresAt,
      tidalUserId, // store tidal user ID in scope field
      now, now
    );

    logger.info('[TidalTargetAdapter] Login successful', { userId, tidalUserId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    return (await getToken(userId, db)) !== null;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'tidal');
    logger.info('[TidalTargetAdapter] Connection revoked', { userId });
  },
};
