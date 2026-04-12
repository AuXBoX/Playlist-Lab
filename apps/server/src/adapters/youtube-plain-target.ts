/**
 * @deprecated This adapter is deprecated and will be removed in a future version.
 * Use youtube-oauth-target.ts instead.
 * 
 * YouTube Target Adapter (Cookie-based - DEPRECATED)
 *
 * This adapter uses browser-captured cookies for authentication.
 * 
 * LIMITATIONS:
 * - Works for READ operations (search) but FAILS for WRITE operations (playlist creation) with 401 errors
 * - Requires manual cookie copying from browser DevTools (poor UX)
 * - Cookies expire frequently, requiring repeated manual updates
 * - No automatic token refresh mechanism
 * - Cannot extract video resolution information
 * 
 * REPLACEMENT: apps/server/src/adapters/youtube-oauth-target.ts
 * - Uses OAuth 2.0 for reliable authentication
 * - Automatic token refresh
 * - Works for all operations (read and write)
 * - Extracts video resolution information
 * - Better user experience
 * 
 * See docs/YOUTUBE_OAUTH_SETUP.md for migration instructions.
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

function cleanTrackTitle(title: string): string {
  // Remove anything in parentheses (including the parentheses)
  let cleaned = title.replace(/\([^)]*\)/g, '');
  // Remove "remastered" (case insensitive)
  cleaned = cleaned.replace(/\bremastered?\b/gi, '');
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function similarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (!na || !nb) return 0;
  
  // Check if all words from the shorter string appear in the longer string
  const wordsA = na.split(/\s+/);
  const wordsB = nb.split(/\s+/);
  const shorterWords = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longerWords = wordsA.length <= wordsB.length ? wordsB : wordsA;
  
  let matchedWords = 0;
  for (const word of shorterWords) {
    if (longerWords.some(w => w.includes(word) || word.includes(w))) {
      matchedWords++;
    }
  }
  
  // If most words match, give high score regardless of order
  const wordMatchRatio = matchedWords / shorterWords.length;
  if (wordMatchRatio >= 0.8) {
    return Math.round(wordMatchRatio * 100);
  }
  
  // Fall back to character-based matching
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

  logger.debug('[YouTubePlainTargetAdapter] Making YouTube API request', { endpoint });

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
      logger.error('[YouTubePlainTargetAdapter] YouTube API request timed out', { endpoint, timeout: '15s' });
      done(() => reject(new Error('YouTube API request timed out after 15 seconds. This may be caused by firewall/antivirus blocking YouTube requests.')));
    }, 15_000); // Increased to 15s for slower connections/firewalls

    const req = https.request(options, (res: any) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        clearTimeout(timer);
        logger.warn('[YouTubePlainTargetAdapter] YouTube API auth error', { statusCode: res.statusCode });
        return done(() => reject(new Error(`YouTube API error: ${res.statusCode}`)));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        clearTimeout(timer);
        logger.warn('[YouTubePlainTargetAdapter] YouTube API HTTP error', { statusCode: res.statusCode });
        return done(() => reject(new Error(`YouTube API error: ${res.statusCode}`)));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data?.error?.code === 401 || data?.error?.code === 403) {
            logger.warn('[YouTubePlainTargetAdapter] YouTube API returned auth error', { errorCode: data.error.code });
            return done(() => reject(new Error(`YouTube API error: ${data.error.code}`)));
          }
          logger.debug('[YouTubePlainTargetAdapter] YouTube API request successful', { endpoint });
          done(() => resolve(data));
        } catch (e) {
          logger.error('[YouTubePlainTargetAdapter] Failed to parse YouTube API response', { error: e });
          done(() => reject(new Error('YouTube API: invalid JSON response')));
        }
      });
    });

    req.on('error', (err: Error) => {
      clearTimeout(timer);
      logger.error('[YouTubePlainTargetAdapter] YouTube API request error', { error: err.message, endpoint });
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
  } catch (err) {
    logger.error('[YouTubePlainTargetAdapter] Error extracting track', { error: err });
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

  async searchCatalog(query: string, userId: number, db: any, _allowLive?: boolean, _allowStatic?: boolean): Promise<MatchResult[]> {
    const cookie = await getCookie(userId, db);
    if (!cookie) throw new Error('Not connected to YouTube. Please authenticate first.');

    const data = await ytApi('search', { query, params: 'EgIQAQ%3D%3D' }, cookie);
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    const items: any[] = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

    const results = items.flatMap(item => {
      const track = extractTrack(item);
      if (!track) return [];
      
      let confidence = similarity(query, track.title);
      
      // Boost confidence for "Official" videos
      const isOfficial = /official/i.test(track.title);
      if (isOfficial) {
        confidence = Math.min(100, confidence + 15);
      }
      
      // Penalize live, lyrics, and acoustic versions
      const titleLower = track.title.toLowerCase();
      if (titleLower.includes('live')) {
        confidence = Math.max(0, confidence - 20);
      }
      if (/\blyrics?\b/i.test(track.title)) {
        confidence = Math.max(0, confidence - 20);
      }
      if (titleLower.includes('acoustic')) {
        confidence = Math.max(0, confidence - 20);
      }
      
      return [{
        sourceTrack,
        targetTrackId: track.videoId,
        targetTitle: track.title,
        targetArtist: track.artist,
        confidence,
        matched: true,
        skipped: false,
      }];
    });
    
    // Sort by confidence
    return results.sort((a, b) => b.confidence - a.confidence);
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
      logger.error('[YouTubePlainTargetAdapter] Cookie missing required auth tokens', { 
        userId, 
        cookieLength: cookie.length,
        hasSID: /SID=/.test(cookie),
        hasSecure3PSID: /__Secure-3PSID=/.test(cookie),
        hasSAPISID: /SAPISID=/.test(cookie),
        hasSecure3PAPISID: /__Secure-3PAPISID=/.test(cookie)
      });
      db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
      throw new Error('YouTube cookies are incomplete or expired. Please reconnect and paste the FULL cookie string from your browser (it should be very long, 2000+ characters).');
    }

    // Validate cookie with a quick test search before processing all tracks
    logger.info('[YouTubePlainTargetAdapter] Validating cookie with test search', { userId });
    try {
      const testData = await ytApi('search', { query: 'test', params: 'EgIQAQ%3D%3D' }, cookie);
      logger.info('[YouTubePlainTargetAdapter] Cookie validation successful', { userId, hasContents: !!testData?.contents });
      if (!testData?.contents) {
        throw new Error('YouTube session expired. Please reconnect your YouTube account.');
      }
    } catch (err: any) {
      const msg = err.message ?? '';
      logger.error('[YouTubePlainTargetAdapter] Cookie validation failed', { userId, error: msg });
      if (msg.includes('401') || msg.includes('403') || msg.includes('session expired') || msg.includes('sign in') || msg.includes('timed out') || msg.includes('firewall') || msg.includes('antivirus')) {
        logger.warn('[YouTubePlainTargetAdapter] Clearing stored cookie due to validation failure', { userId, reason: msg });
        db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
        throw new Error(`YouTube connection failed: ${msg}. Please reconnect your YouTube account.`);
      }
      throw err;
    }

    logger.info('[YouTubePlainTargetAdapter] Starting track matching loop', { trackCount: tracks.length, userId });

    const results: MatchResult[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;
      const track = tracks[i];
      // Clean the track title before searching (remove remastered, parentheses content)
      const cleanedTitle = cleanTrackTitle(track.title);
      const query = `${cleanedTitle} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        logger.info('[YouTubePlainTargetAdapter] Searching track', { i: i + 1, total: tracks.length, query, title: track.title, artist: track.artist });
        const data = await ytApi('search', { query, params: 'EgIQAQ%3D%3D' }, cookie);
        logger.info('[YouTubePlainTargetAdapter] Search completed', { i: i + 1, total: tracks.length, hasData: !!data, hasContents: !!data?.contents });
        const items: any[] = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

        const candidates = items.flatMap(item => {
          const t = extractTrack(item);
          return t ? [t] : [];
        });

        if (candidates.length > 0) {
          const scored = candidates.map(c => {
            // Use cleaned title for comparison
            const titleSim = similarity(cleanedTitle, c.title);
            const artistSim = similarity(track.artist, c.artist);
            let baseScore = titleSim * 0.6 + artistSim * 0.4;
            
            // Boost score for "Official" videos
            const isOfficial = /official/i.test(c.title);
            if (isOfficial) {
              baseScore = Math.min(100, baseScore + 15);
            }
            
            // Penalize live, lyrics, and acoustic versions
            const titleLower = c.title.toLowerCase();
            if (titleLower.includes('live')) {
              baseScore = Math.max(0, baseScore - 20);
            }
            if (/\blyrics?\b/i.test(c.title)) {
              baseScore = Math.max(0, baseScore - 20);
            }
            if (titleLower.includes('acoustic')) {
              baseScore = Math.max(0, baseScore - 20);
            }
            
            return {
              c,
              score: Math.round(baseScore),
              isOfficial,
            };
          });
          
          // Sort by score
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
        logger.error('[YouTubePlainTargetAdapter] Search error', { i: i + 1, total: tracks.length, track: track.title, error: msg });
        if (msg.includes('401') || msg.includes('403')) {
          logger.warn('[YouTubePlainTargetAdapter] Auth error during match, aborting', { userId, i });
          db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
          throw new Error('YouTube session expired mid-match. Please reconnect your YouTube account.');
        }
        if (msg.includes('timed out')) {
          logger.error('[YouTubePlainTargetAdapter] Timeout during match', { userId, i, track: track.title });
          throw new Error(`YouTube API timed out while searching for "${track.title}". This may be caused by firewall/antivirus blocking requests.`);
        }
        logger.warn('[YouTubePlainTargetAdapter] Search failed, continuing', { track, err });
      }

      results.push(matchResult);
      const progressData = { 
        current: i + 1, 
        total: tracks.length,
        currentTrackName: track.title 
      };
      logger.info('[YouTubePlainTargetAdapter] Emitting progress', { userId, ...progressData });
      progressEmitter?.emit('progress', progressData);
    }
    
    logger.info('[YouTubePlainTargetAdapter] Matching complete', { trackCount: tracks.length, userId, matchedCount: results.filter(r => r.matched).length });
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
    // Use the manual cookie paste form - more reliable than Puppeteer
    return `${redirectUri.replace('/callback', '/form')}?state=${userId}`;
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
