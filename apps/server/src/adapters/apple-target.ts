/**
 * Apple Music Target Adapter
 *
 * Implements TargetAdapter for Apple Music using the MusicKit API.
 * Requires:
 *   - APPLE_TEAM_ID: Apple Developer Team ID
 *   - APPLE_KEY_ID: MusicKit key ID
 *   - APPLE_PRIVATE_KEY: PEM-encoded private key (.p8 file contents)
 *
 * The developer token (JWT) is generated server-side.
 * The user music token is obtained via MusicKit JS on the frontend and
 * passed as the OAuth "code" during the callback flow.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '';
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || '';
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

/** Generate a MusicKit developer JWT (valid for 6 months max) */
function generateDeveloperToken(): string {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error('Apple Music credentials not configured (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY).');
  }

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: APPLE_KEY_ID })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + 15_552_000, // 6 months
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const signature = sign.sign({ key: APPLE_PRIVATE_KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url');

  return `${signingInput}.${signature}`;
}

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

async function getUserToken(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'apple') as any;
  if (!row) return null;
  try {
    return decrypt(row.access_token, ENCRYPTION_SECRET);
  } catch {
    return null;
  }
}

export const appleTargetAdapter: TargetAdapter = {
  meta: {
    id: 'apple',
    name: 'Apple Music',
    icon: 'apple',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const userToken = await getUserToken(userId, db);
    if (!userToken) throw new Error('Not connected to Apple Music. Please authenticate first.');
    const devToken = generateDeveloperToken();

    const res = await fetch(
      `https://api.music.apple.com/v1/catalog/us/search?types=songs&term=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${devToken}`,
          'Music-User-Token': userToken,
        },
      }
    );
    if (!res.ok) throw new Error(`Apple Music search failed: ${res.status}`);
    const data = await res.json() as any;
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    return (data.results?.songs?.data ?? []).map((item: any) => ({
      sourceTrack,
      targetTrackId: item.id,
      targetTitle: item.attributes?.name ?? '',
      targetArtist: item.attributes?.artistName ?? '',
      targetAlbum: item.attributes?.albumName,
      confidence: similarity(query, item.attributes?.name ?? ''),
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
    const userToken = await getUserToken(userId, db);
    if (!userToken) throw new Error('Not connected to Apple Music. Please authenticate first.');
    const devToken = generateDeveloperToken();

    const results: MatchResult[] = [];

    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();

      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        const res = await fetch(
          `https://api.music.apple.com/v1/catalog/us/search?types=songs&term=${encodeURIComponent(query)}&limit=5`,
          {
            headers: {
              Authorization: `Bearer ${devToken}`,
              'Music-User-Token': userToken,
            },
          }
        );
        if (res.ok) {
          const data = await res.json() as any;
          const items: any[] = data.results?.songs?.data ?? [];
          if (items.length > 0) {
            const scored = items.map(item => ({
              item,
              score: Math.round(
                similarity(track.title, item.attributes?.name ?? '') * 0.6 +
                similarity(track.artist, item.attributes?.artistName ?? '') * 0.4
              ),
            }));
            scored.sort((a, b) => b.score - a.score);
            const best = scored[0];
            matchResult = {
              sourceTrack: track,
              targetTrackId: best.item.id,
              targetTitle: best.item.attributes?.name ?? '',
              targetArtist: best.item.attributes?.artistName ?? '',
              targetAlbum: best.item.attributes?.albumName,
              confidence: best.score,
              matched: best.score >= 50,
              skipped: false,
            };
          }
        }
      } catch (err) {
        logger.warn('[AppleTargetAdapter] Search failed', { track, err });
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
    const userToken = await getUserToken(userId, db);
    if (!userToken) throw new Error('Not connected to Apple Music. Please authenticate first.');
    const devToken = generateDeveloperToken();

    const trackIds = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => ({ id: r.targetTrackId!, type: 'songs' }));

    const createRes = await fetch('https://api.music.apple.com/v1/me/library/playlists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devToken}`,
        'Music-User-Token': userToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attributes: { name },
        relationships: { tracks: { data: trackIds } },
      }),
    });

    if (!createRes.ok) throw new Error(`Failed to create Apple Music playlist: ${createRes.status}`);
    const created = await createRes.json() as any;
    const playlistId: string = created.data?.[0]?.id ?? 'unknown';

    logger.info('[AppleTargetAdapter] Created playlist', { userId, playlistId, name, trackCount: trackIds.length });
    return { playlistId, name, trackCount: trackIds.length };
  },

  isConfigured(): boolean {
    return !!(APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);
  },

  /**
   * Apple Music auth requires MusicKit JS on the frontend to get the user token.
   * We return a special URL that the frontend handles as a MusicKit auth flow.
   */
  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
      throw new Error('Apple Music requires developer credentials (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY). Apple Music is not available without these.');
    }
    // Generate developer token for the frontend to use with MusicKit JS
    const devToken = generateDeveloperToken();
    return `${redirectUri.replace('/callback', '/form')}?service=apple&state=${userId}&devToken=${encodeURIComponent(devToken)}`;
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    // code is the MusicKit user token obtained from the frontend
    const userToken = code.trim();
    if (!userToken) throw new Error('No Apple Music user token provided');

    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'apple', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(userToken, ENCRYPTION_SECRET), now, now);

    logger.info('[AppleTargetAdapter] User token stored', { userId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    const token = await getUserToken(userId, db);
    return token !== null;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'apple');
    logger.info('[AppleTargetAdapter] Connection revoked', { userId });
  },
};
