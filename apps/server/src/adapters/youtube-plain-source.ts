/**
 * Plain YouTube Source Adapter
 * Uses InnerTube API with browser cookies for authenticated requests.
 */
import { SourceAdapter, PlaylistInfo, TrackInfo, ServiceMeta } from './types';
import { scrapeYouTubePlaylist } from '../services/scrapers';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const YT_BASE = 'https://www.youtube.com';
const YT_CLIENT = { clientName: 'WEB', clientVersion: '2.20250101.00.00' };
const YT_CLIENT_NAME_ID = '1';

async function getStoredCookie(userId: number, db: any): Promise<string | null> {
  const row = db.prepare(
    'SELECT access_token FROM oauth_connections WHERE user_id = ? AND service = ?'
  ).get(userId, 'youtube') as any;
  if (!row) return null;
  try { return decrypt(row.access_token, ENCRYPTION_SECRET); } catch { return null; }
}

function generateSapisidHash(sapisid: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const input = ts + ' ' + sapisid + ' ' + YT_BASE;
  const hash = crypto.createHash('sha1').update(input).digest('hex');
  return 'SAPISIDHASH ' + ts + '_' + hash;
}

function doYtRequest(urlPath: string, postBody: string, headers: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const https = require('https');
    let settled = false;
    const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const timer = setTimeout(() => { req.destroy(); done(() => reject(new Error('timed out'))); }, 12000);
    const req = https.request({ hostname: 'www.youtube.com', path: urlPath, method: 'POST', headers }, (res: any) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume(); clearTimeout(timer);
        return done(() => reject(new Error('YouTube API error: ' + res.statusCode)));
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data?.error?.code) return done(() => reject(new Error('YouTube API error: ' + data.error.code)));
          done(() => resolve(data));
        } catch { done(() => reject(new Error('YouTube API: invalid JSON'))); }
      });
    });
    req.on('error', (e: Error) => { clearTimeout(timer); done(() => reject(e)); });
    req.write(postBody);
    req.end();
  });
}

function ytApi(endpoint: string, body: object, cookie: string): Promise<any> {
  const sapisidMatch = cookie.match(/(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
  const sapisid = sapisidMatch?.[1] ?? '';
  const authHeader = sapisid ? generateSapisidHash(sapisid) : '';
  const postBody = JSON.stringify({ context: { client: YT_CLIENT }, ...body });
  const urlPath = '/youtubei/v1/' + endpoint + '?prettyPrint=false';
  return doYtRequest(urlPath, postBody, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postBody),
    'Cookie': cookie,
    ...(authHeader ? { Authorization: authHeader } : {}),
    'X-Origin': YT_BASE, 'Origin': YT_BASE, 'Referer': YT_BASE + '/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-YouTube-Client-Name': YT_CLIENT_NAME_ID,
    'X-YouTube-Client-Version': YT_CLIENT.clientVersion,
    'X-Goog-AuthUser': '0',
  });
}

function ytApiPublic(endpoint: string, body: object): Promise<any> {
  const postBody = JSON.stringify({ context: { client: YT_CLIENT }, ...body });
  const urlPath = '/youtubei/v1/' + endpoint + '?prettyPrint=false';
  return doYtRequest(urlPath, postBody, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postBody),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-YouTube-Client-Name': YT_CLIENT_NAME_ID,
    'X-YouTube-Client-Version': YT_CLIENT.clientVersion,
  });
}

function extractPlaylist(obj: any): PlaylistInfo | null {
  if (!obj || typeof obj !== 'object') return null;
  // lockupViewModel - newer YouTube UI
  const lvm = obj.lockupViewModel;
  if (lvm?.contentId && lvm?.metadata) {
    const id = lvm.contentId;
    const title = lvm.metadata?.lockupMetadataViewModel?.title?.content ?? '';
    if (!id || !title) return null;
    const subtitle = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content ?? '';
    const trackCount = parseInt(String(subtitle).replace(/\D/g, ''), 10) || 0;
    const thumb = lvm.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources?.[0]?.url ?? undefined;
    return { id, name: title, trackCount, coverUrl: thumb };
  }
  // gridPlaylistRenderer / playlistRenderer - classic
  const renderer = obj.gridPlaylistRenderer ?? obj.playlistRenderer;
  if (renderer?.playlistId) {
    const id = renderer.playlistId;
    const title = renderer.title?.runs?.[0]?.text ?? renderer.title?.simpleText ?? '';
    if (!id || !title) return null;
    const countText = renderer.videoCountText?.runs?.[0]?.text ?? renderer.videoCountShortText?.simpleText ?? '';
    const trackCount = parseInt(String(countText).replace(/\D/g, ''), 10) || 0;
    const thumb = renderer.thumbnail?.thumbnails?.[0]?.url ?? undefined;
    return { id, name: title, trackCount, coverUrl: thumb };
  }
  return null;
}

function findPlaylistsInResponse(obj: any, depth = 0): PlaylistInfo[] {
  if (!obj || typeof obj !== 'object' || depth > 12) return [];
  const pl = extractPlaylist(obj);
  if (pl) return [pl];
  const results: PlaylistInfo[] = [];
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) results.push(...findPlaylistsInResponse(item, depth + 1));
    } else if (val && typeof val === 'object') {
      results.push(...findPlaylistsInResponse(val as any, depth + 1));
    }
  }
  return results;
}

function findContinuationTokens(obj: any, depth = 0): string[] {
  if (!obj || typeof obj !== 'object' || depth > 8) return [];
  const tokens: string[] = [];
  const ct = obj.nextContinuationData?.continuation ?? obj.continuationEndpoint?.continuationCommand?.token;
  if (typeof ct === 'string') tokens.push(ct);
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) tokens.push(...findContinuationTokens(item, depth + 1));
    } else if (val && typeof val === 'object') {
      tokens.push(...findContinuationTokens(val as any, depth + 1));
    }
  }
  return tokens;
}

function logRenderers(data: any, label: string): void {
  const keys: string[] = [];
  const scan = (obj: any, d = 0) => {
    if (!obj || typeof obj !== 'object' || d > 4) return;
    for (const [k, v] of Object.entries(obj)) {
      if (k.endsWith('Renderer') || k.endsWith('ViewModel')) keys.push(k);
      if (Array.isArray(v)) { for (const i of v) scan(i, d + 1); }
      else if (v && typeof v === 'object') scan(v, d + 1);
    }
  };
  scan(data);
  logger.info('[YTSource] ' + label + ' renderers: ' + [...new Set(keys)].slice(0, 25).join(', '));
}

export const youtubePlainSourceAdapter: SourceAdapter = {
  meta: { id: 'youtube', name: 'YouTube', icon: 'youtube', isSourceOnly: false, requiresOAuth: false } satisfies ServiceMeta,

  async listPlaylists(userId: number, db: any): Promise<PlaylistInfo[]> {
    const cookie = await getStoredCookie(userId, db);
    if (!cookie) return [];
    const all: PlaylistInfo[] = [];
    // Browse FEplaylist_aggregation + follow continuations
    try {
      const data = await ytApi('browse', { browseId: 'FEplaylist_aggregation' }, cookie);
      logRenderers(data, 'FEplaylist_aggregation');
      all.push(...findPlaylistsInResponse(data));
      logger.info('[YTSource] FEplaylist_aggregation initial count: ' + all.length);
      const tokens = findContinuationTokens(data);
      logger.info('[YTSource] continuation tokens found: ' + tokens.length);
      for (let i = 0; i < Math.min(tokens.length, 3); i++) {
        try {
          const cd = await ytApi('browse', { continuation: tokens[i] }, cookie);
          logRenderers(cd, 'continuation-' + (i + 1));
          const cp = findPlaylistsInResponse(cd);
          all.push(...cp);
          logger.info('[YTSource] continuation ' + (i + 1) + ' added ' + cp.length);
        } catch (ce: any) {
          logger.info('[YTSource] continuation ' + (i + 1) + ' failed: ' + (ce.message ?? ''));
          break;
        }
      }
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('401') || msg.includes('403')) {
        logger.warn('[YTSource] Cookie rejected, clearing', { userId });
        db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
        return [];
      }
      logger.info('[YTSource] FEplaylist_aggregation failed: ' + msg);
    }
    // If only system playlists found, try FElibrary for user-created playlists
    if (all.length <= 6) {
      try {
        const libData = await ytApi('browse', { browseId: 'FElibrary' }, cookie);
        logRenderers(libData, 'FElibrary');
        const libPlaylists = findPlaylistsInResponse(libData);
        logger.info('[YTSource] FElibrary found ' + libPlaylists.length + ' playlists');
        // Add any playlists not already in the list
        const existingIds = new Set(all.map(p => p.id));
        for (const p of libPlaylists) {
          if (!existingIds.has(p.id)) { all.push(p); existingIds.add(p.id); }
        }
      } catch (e: any) {
        logger.info('[YTSource] FElibrary failed: ' + (e.message ?? ''));
      }
    }
    // Also try the guide endpoint as another fallback
    if (all.length <= 6) {
      try {
        const guideData = await ytApi('guide', {}, cookie);
        logRenderers(guideData, 'guide');
        const guidePlaylists = findPlaylistsInResponse(guideData);
        logger.info('[YTSource] guide found ' + guidePlaylists.length + ' playlists');
        const existingIds = new Set(all.map(p => p.id));
        for (const p of guidePlaylists) {
          if (!existingIds.has(p.id)) { all.push(p); existingIds.add(p.id); }
        }
      } catch (e: any) {
        logger.info('[YTSource] guide failed: ' + (e.message ?? ''));
      }
    }
    logger.info('[YTSource] Listed playlists', { userId, count: all.length, names: all.map(p => p.name).join(', ') });
    return all;
  },

  async searchPlaylists(query: string, userId: number, db: any): Promise<PlaylistInfo[]> {
    const cookie = await getStoredCookie(userId, db);
    const data = cookie
      ? await ytApi('search', { query, params: 'EgIQAw%3D%3D' }, cookie)
      : await ytApiPublic('search', { query, params: 'EgIQAw%3D%3D' });
    const items: any[] = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];
    const playlists: PlaylistInfo[] = [];
    for (const item of items) {
      const r = item.playlistRenderer;
      if (!r) continue;
      const id = r.playlistId;
      const title = r.title?.simpleText ?? r.title?.runs?.[0]?.text ?? '';
      if (!id || !title) continue;
      const countText = r.videoCountText?.runs?.[0]?.text ?? '';
      const trackCount = parseInt(String(countText).replace(/\D/g, ''), 10) || 0;
      const thumb = r.thumbnails?.[0]?.thumbnails?.[0]?.url ?? undefined;
      playlists.push({ id, name: title, trackCount, coverUrl: thumb });
    }
    logger.info('[YTSource] Searched playlists', { userId, query, count: playlists.length });
    return playlists;
  },

  async fetchTracks(playlistUrlOrId: string, _userId: number, _db: any): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
    const result = await scrapeYouTubePlaylist(playlistUrlOrId);
    const playlist: PlaylistInfo = { id: result.id, name: result.name, trackCount: result.tracks.length, coverUrl: result.coverUrl };
    const tracks: TrackInfo[] = result.tracks.map(t => ({ title: t.title, artist: t.artist, album: t.album }));
    logger.info('[YTSource] Fetched playlist', { name: playlist.name, trackCount: tracks.length });
    return { playlist, tracks };
  },
};
