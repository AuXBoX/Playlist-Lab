/**
 * YouTube Music Target Adapter
 *
 * Uses YouTube Music's internal API with browser cookies.
 * The user pastes their __Secure-3PAPISID cookie from browser DevTools.
 * No Google API credentials or developer registration required.
 *
 * This mirrors how the YouTube Music source adapter works.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

// YouTube Music internal API base
const YTM_BASE = 'https://music.youtube.com';
const YTM_API = `${YTM_BASE}/youtubei/v1`;
const YTM_CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00' };

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

/** Generate SAPISIDHASH for YouTube auth */
function generateSapisidHash(sapisid: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1')
    .update(`${timestamp} ${sapisid} ${YTM_BASE}`)
    .digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash}`;
}

async function getCookie(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'youtube-music') as any;
  if (!row) return null;
  try { return decrypt(row.access_token, ENCRYPTION_SECRET); } catch { return null; }
}

/** Make an authenticated YouTube Music API request */
async function ytmApi(endpoint: string, body: object, cookie: string): Promise<any> {
  // Extract SAPISID from cookie string
  const sapisidMatch = cookie.match(/(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
  const sapisid = sapisidMatch?.[1] ?? '';
  const authHeader = sapisid ? generateSapisidHash(sapisid) : '';

  const res = await fetch(`${YTM_API}/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      ...(authHeader ? { Authorization: authHeader } : {}),
      'X-Origin': YTM_BASE,
      'Origin': YTM_BASE,
      'Referer': `${YTM_BASE}/`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      context: { client: YTM_CLIENT },
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`YouTube Music API error: ${res.status}`);
  return res.json();
}

/** Extract video ID and title from a search result item */
function extractTrack(item: any): { videoId: string; title: string; artist: string } | null {
  try {
    const renderer = item.musicResponsiveListItemRenderer;
    if (!renderer) return null;
    const videoId = renderer.playlistItemData?.videoId ?? renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    if (!videoId) return null;
    const cols: any[] = renderer.flexColumns ?? [];
    const title = cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ?? '';
    const artist = cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ?? '';
    return { videoId, title, artist };
  } catch {
    return null;
  }
}

export const youtubeTargetAdapter: TargetAdapter = {
  meta: {
    id: 'youtube-music',
    name: 'YouTube Music',
    icon: 'youtube-music',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return true; // Cookie-based auth, no server credentials needed
  },

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const cookie = await getCookie(userId, db);
    if (!cookie) throw new Error('Not connected to YouTube Music. Please add your browser cookie.');

    const data = await ytmApi('search', { query, params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D' }, cookie);
    const sourceTrack: TrackInfo = { title: query, artist: '' };
    const items: any[] = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents ?? [];

    return items.flatMap(item => {
      const track = extractTrack(item);
      if (!track) return [];
      return [{
        sourceTrack,
        targetTrackId: track.videoId,
        targetTitle: track.title,
        targetArtist: track.artist,
        confidence: similarity(query, track.title),
        matched: true,
        skipped: false,
      }];
    });
  },

  async matchTracks(
    tracks: TrackInfo[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any,
    progressEmitter?: NodeJS.EventEmitter,
    isCancelled?: () => boolean
  ): Promise<MatchResult[]> {
    const cookie = await getCookie(userId, db);
    if (!cookie) throw new Error('Not connected to YouTube Music. Please add your browser cookie.');

    const results: MatchResult[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        const data = await ytmApi('search', { query, params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D' }, cookie);
        const items: any[] = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents ?? [];

        const candidates = items.flatMap(item => {
          const t = extractTrack(item);
          return t ? [t] : [];
        });

        if (candidates.length > 0) {
          const scored = candidates.map(c => ({
            c,
            score: Math.round(
              similarity(track.title, c.title) * 0.6 +
              similarity(track.artist, c.artist) * 0.4
            ),
          }));
          scored.sort((a, b) => b.score - a.score);
          const best = scored[0];
          matchResult = {
            sourceTrack: track,
            targetTrackId: best.c.videoId,
            targetTitle: best.c.title,
            targetArtist: best.c.artist,
            confidence: best.score,
            matched: best.score >= 40,
            skipped: false,
          };
        }
      } catch (err) {
        logger.warn('[YouTubeTargetAdapter] Search failed', { track, err });
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
    const cookie = await getCookie(userId, db);
    if (!cookie) throw new Error('Not connected to YouTube Music. Please add your browser cookie.');

    const videoIds = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => r.targetTrackId!);

    // Create playlist via YouTube Music internal API
    const createData = await ytmApi('playlist/create', {
      title: name,
      description: '',
      privacyStatus: 'PRIVATE',
      videoIds,
    }, cookie);

    const playlistId: string = createData.playlistId ?? 'unknown';

    logger.info('[YouTubeTargetAdapter] Created playlist', { userId, playlistId, name, trackCount: videoIds.length });
    return { playlistId, name, trackCount: videoIds.length };
  },

  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    return `${redirectUri.replace('/callback', '/form')}?service=youtube-music&state=${userId}&type=cookie`;
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    // code is the cookie string from the browser
    const cookie = code.trim();
    if (!cookie) throw new Error('No cookie provided');

    // Validate by making a simple API call
    try {
      await ytmApi('search', { query: 'test', params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D' }, cookie);
    } catch {
      throw new Error('Invalid YouTube Music cookie. Please check and try again.');
    }

    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'youtube-music', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(cookie, ENCRYPTION_SECRET), now, now);

    logger.info('[YouTubeTargetAdapter] Cookie stored', { userId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    return (await getCookie(userId, db)) !== null;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube-music');
    logger.info('[YouTubeTargetAdapter] Connection revoked', { userId });
  },
};
