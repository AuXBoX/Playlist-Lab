/**
 * YouTube Target Adapter
 *
 * Creates playlists on youtube.com using browser-captured cookies.
 * The user logs in via a real browser window (Puppeteer, non-headless).
 * No Google API credentials required.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

const YT_BASE = 'https://www.youtube.com';
const YT_CLIENT = { clientName: 'WEB', clientVersion: '2.20250101.00.00' };
const YT_CLIENT_NAME_ID = '1';

// Active login sessions: sessionId -> { browser, page, status, cookie }
const loginSessions = new Map<string, { browser: any; status: 'pending' | 'done' | 'error'; cookie?: string; error?: string }>();

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

function generateSapisidHash(sapisid: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1')
    .update(`${timestamp} ${sapisid} ${YT_BASE}`)
    .digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash}`;
}

async function getCookie(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'youtube') as any;
  if (!row) return null;
  try { return decrypt(row.access_token, ENCRYPTION_SECRET); } catch { return null; }
}

async function ytApi(endpoint: string, body: object, cookie: string): Promise<any> {
  const sapisidMatch = cookie.match(/(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
  const sapisid = sapisidMatch?.[1] ?? '';
  const authHeader = sapisid ? generateSapisidHash(sapisid) : '';

  const postBody = JSON.stringify({
    context: { client: YT_CLIENT },
    ...body,
  });

  return new Promise((resolve, reject) => {
    const https = require('https');
    const options = {
      hostname: 'www.youtube.com',
      path: `/youtubei/v1/${endpoint}?prettyPrint=false`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody),
        'Cookie': cookie,
        ...(authHeader ? { Authorization: authHeader } : {}),
        'X-Origin': YT_BASE,
        'Origin': YT_BASE,
        'Referer': `${YT_BASE}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-YouTube-Client-Name': YT_CLIENT_NAME_ID,
        'X-YouTube-Client-Version': YT_CLIENT.clientVersion,
        'X-Goog-AuthUser': '0',
      },
    };

    let settled = false;
    const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

    const timer = setTimeout(() => {
      req.destroy();
      done(() => reject(new Error('YouTube API request timed out')));
    }, 12_000);

    const req = https.request(options, (res: any) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        clearTimeout(timer);
        return done(() => reject(new Error(`YouTube API error: ${res.statusCode}`)));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        clearTimeout(timer);
        return done(() => reject(new Error(`YouTube API error: ${res.statusCode}`)));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data?.error?.code === 401 || data?.error?.code === 403) {
            return done(() => reject(new Error(`YouTube API error: ${data.error.code}`)));
          }
          done(() => resolve(data));
        } catch (e) {
          done(() => reject(new Error('YouTube API: invalid JSON response')));
        }
      });
    });

    req.on('error', (err: Error) => {
      clearTimeout(timer);
      done(() => reject(err));
    });

    req.write(postBody);
    req.end();
  });
}

function extractTrack(item: any): { videoId: string; title: string; artist: string } | null {
  try {
    const renderer = item.videoRenderer ?? item.compactVideoRenderer;
    if (!renderer) return null;
    const videoId = renderer.videoId;
    if (!videoId) return null;
    const title = renderer.title?.runs?.[0]?.text ?? renderer.title?.simpleText ?? '';
    const artist = renderer.ownerText?.runs?.[0]?.text ?? renderer.shortBylineText?.runs?.[0]?.text ?? '';
    return { videoId, title, artist };
  } catch {
    return null;
  }
}

/**
 * Start a visible browser login session for YouTube.
 * Returns a sessionId the frontend can poll for status.
 */
function findSystemChrome(): string | undefined {
  const { platform } = process;
  const candidates: string[] = [];

  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    );
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium');
  }

  const fs = require('fs');
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

export async function startYouTubeLoginSession(sessionId: string): Promise<void> {
  const puppeteer = await import('puppeteer');

  const executablePath = findSystemChrome();

  const browser = await puppeteer.default.launch({
    headless: false,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null,
  });

  loginSessions.set(sessionId, { browser, status: 'pending' });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.goto('https://accounts.google.com/signin/v2/identifier?service=youtube', {
    waitUntil: 'domcontentloaded',
  });

  // Poll for YouTube auth cookies in the background
  const poll = setInterval(async () => {
    const session = loginSessions.get(sessionId);
    if (!session || session.status !== 'pending') {
      clearInterval(poll);
      return;
    }

    try {
      const pages = await browser.pages();
      let allCookies: any[] = [];

      for (const p of pages) {
        try {
          const client = await p.createCDPSession();
          const { cookies } = await client.send('Network.getAllCookies');
          allCookies = allCookies.concat(cookies);
        } catch { /* page may have closed */ }
      }

      // Check for YouTube auth cookies
      const ytCookies = allCookies.filter((c: any) =>
        (c.domain === '.youtube.com' || c.domain === 'youtube.com') &&
        ['SID', '__Secure-3PSID', 'SAPISID', '__Secure-3PAPISID'].includes(c.name)
      );

      if (ytCookies.length >= 2) {
        // Build cookie string from youtube.com AND google.com cookies (both needed for auth)
        const allYtCookies = allCookies.filter((c: any) =>
          c.domain === '.youtube.com' || c.domain === 'youtube.com' ||
          c.domain === '.google.com' || c.domain === 'google.com'
        );
        const cookieStr = allYtCookies.map((c: any) => `${c.name}=${c.value}`).join('; ');

        clearInterval(poll);
        session.status = 'done';
        session.cookie = cookieStr;

        // Close browser after a short delay
        setTimeout(() => {
          try { browser.close(); } catch { /* ignore */ }
          loginSessions.delete(sessionId);
        }, 2000);
      }
    } catch (err: any) {
      // Browser may have been closed by user
      if (err.message?.includes('Target closed') || err.message?.includes('Session closed')) {
        clearInterval(poll);
        const session = loginSessions.get(sessionId);
        if (session && session.status === 'pending') {
          session.status = 'error';
          session.error = 'Browser was closed before login completed';
        }
      }
    }
  }, 1500);

  // Timeout after 5 minutes
  setTimeout(() => {
    clearInterval(poll);
    const session = loginSessions.get(sessionId);
    if (session && session.status === 'pending') {
      session.status = 'error';
      session.error = 'Login timed out';
      try { browser.close(); } catch { /* ignore */ }
    }
  }, 5 * 60 * 1000);
}

/**
 * Get the status of a login session.
 */
export function getLoginSessionStatus(sessionId: string): { status: 'pending' | 'done' | 'error' | 'not_found'; cookie?: string; error?: string } {
  const session = loginSessions.get(sessionId);
  if (!session) return { status: 'not_found' };
  return { status: session.status, cookie: session.cookie, error: session.error };
}

export const youtubePlainTargetAdapter: TargetAdapter = {
  meta: {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return true; // Browser-based auth, no server credentials needed
  },

  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const cookie = await getCookie(userId, db);
    if (!cookie) throw new Error('Not connected to YouTube. Please authenticate first.');

    const data = await ytApi('search', { query, params: 'EgIQAQ%3D%3D' }, cookie);
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    const items: any[] = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

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
    if (!cookie) throw new Error('Not connected to YouTube. Please authenticate first.');

    logger.info('[YouTubePlainTargetAdapter] Starting matchTracks', { trackCount: tracks.length, userId });

    // Quick sanity check — if cookie has no auth tokens, fail immediately without network call
    const hasAuthCookie = /(?:__Secure-3PSID|SAPISID|__Secure-3PAPISID)=/.test(cookie);
    if (!hasAuthCookie) {
      logger.warn('[YouTubePlainTargetAdapter] Cookie missing auth tokens, clearing', { userId });
      db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
      throw new Error('YouTube session expired. Please reconnect your YouTube account.');
    }

    // Validate cookie with a quick test search before processing all tracks
    try {
      const testData = await ytApi('search', { query: 'test', params: 'EgIQAQ%3D%3D' }, cookie);
      if (!testData?.contents) {
        throw new Error('YouTube session expired. Please reconnect your YouTube account.');
      }
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('401') || msg.includes('403') || msg.includes('session expired') || msg.includes('sign in') || msg.includes('timed out')) {
        logger.warn('[YouTubePlainTargetAdapter] Cookie validation failed, clearing stored cookie', { userId, reason: msg });
        db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
        throw new Error('YouTube session expired. Please reconnect your YouTube account.');
      }
      throw err;
    }

    const results: MatchResult[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        logger.debug('[YouTubePlainTargetAdapter] Searching', { i: i + 1, total: tracks.length, query });
        const data = await ytApi('search', { query, params: 'EgIQAQ%3D%3D' }, cookie);
        const items: any[] = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

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
      } catch (err: any) {
        // If we get auth errors mid-match, abort early
        const msg = err.message ?? '';
        if (msg.includes('401') || msg.includes('403')) {
          logger.warn('[YouTubePlainTargetAdapter] Auth error during match, aborting', { userId, i });
          db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
          throw new Error('YouTube session expired mid-match. Please reconnect your YouTube account.');
        }
        logger.warn('[YouTubePlainTargetAdapter] Search failed', { track, err });
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
    if (!cookie) throw new Error('Not connected to YouTube. Please authenticate first.');

    const videoIds = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => r.targetTrackId!);

    const createData = await ytApi('playlist/create', {
      title: name,
      description: '',
      privacyStatus: 'PRIVATE',
      videoIds,
    }, cookie);

    const playlistId: string = createData.playlistId ?? 'unknown';

    logger.info('[YouTubePlainTargetAdapter] Created playlist', { userId, playlistId, name, trackCount: videoIds.length });
    return { playlistId, name, trackCount: videoIds.length };
  },

  async getOAuthUrl(userId: number, _db: any, redirectUri: string): Promise<string> {
    // Use the cookie paste form — simpler and more reliable than Puppeteer
    const host = redirectUri.replace(/\/api\/cross-import\/oauth\/youtube\/callback$/, '');
    return `${host}/api/cross-import/oauth/youtube/form?state=${userId}`;
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    // code is the captured cookie string from the browser login session
    const cookie = code.trim();
    if (!cookie) throw new Error('No cookie provided');

    const now = Date.now();
    db.prepare(`
      INSERT INTO oauth_connections (user_id, service, access_token, created_at, updated_at)
      VALUES (?, 'youtube', ?, ?, ?)
      ON CONFLICT(user_id, service) DO UPDATE SET access_token = excluded.access_token, updated_at = excluded.updated_at
    `).run(userId, encrypt(cookie, ENCRYPTION_SECRET), now, now);

    logger.info('[YouTubePlainTargetAdapter] Cookie stored from browser login', { userId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    const cookie = await getCookie(userId, db);
    return !!cookie;
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
    logger.info('[YouTubePlainTargetAdapter] Connection revoked', { userId });
  },
};
