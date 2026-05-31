import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import { requireAuth } from '../middleware/auth';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';

const router = Router();

interface SavedSpotifyUser {
  id: number;
  spotify_user_id: string;
  display_name: string;
  added_at: number;
}

/**
 * GET /api/saved-spotify-users
 * List all saved Spotify users for the authenticated user
 */
router.get('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const db = getDatabase();

    const users = db
      .prepare(
        `SELECT id, spotify_user_id, display_name, added_at 
         FROM saved_spotify_users 
         WHERE user_id = ? 
         ORDER BY added_at DESC`
      )
      .all(userId) as SavedSpotifyUser[];

    res.json({ users });
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error listing saved users', { error });
    res.status(500).json({ error: { message: 'Failed to list saved Spotify users' } });
  }
});

/**
 * Resolve a Spotify user's display name by scraping their profile page title
 */
async function resolveSpotifyDisplayName(spotifyUserId: string): Promise<string | null> {
  // Known generic titles that don't contain user info
  const genericTitles = [
    'spotify', 'spotify - web player', 'web player', 'spotify web player',
    'spotify – web player', 'spotify – listen to web player',
    'spotify – free music streaming', 'spotify – music for everyone',
  ];
  
  const isGeneric = (text: string): boolean => {
    if (!text) return true;
    const lower = text.toLowerCase().trim();
    return genericTitles.includes(lower) || /^(spotify|web player|choose|sprache|langue|idioma)/i.test(lower);
  };
  
  const extractName = (raw: string): string | null => {
    if (!raw || isGeneric(raw)) return null;
    const cleaned = raw
      .replace(/\s+on\s+Spotify$/i, '')
      .replace(/\s*[-–|]\s*(Spotify|profile|Web Player).*$/i, '')
      .trim();
    return (cleaned && !isGeneric(cleaned)) ? cleaned : null;
  };
  
  const tryExtractFromHtml = (html: string): string | null => {
    // Strategy 1: page title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      logger.info('[SavedSpotifyUsers] Raw page title', { spotifyUserId, title });
      const name = extractName(title);
      if (name) return name;
    }
    
    // Strategy 2: og:title
    const ogMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
    if (ogMatch) {
      const ogTitle = ogMatch[1].trim();
      const name = extractName(ogTitle);
      if (name) return name;
    }
    
    // Strategy 3: og:description (format: "User · Mike" or "24 public playlists")
    const ogDescMatch = html.match(/property="og:description"\s+content="([^"]+)"/);
    if (ogDescMatch) {
      const desc = ogDescMatch[1].trim();
      // Format: "User · Mike" or "Profile · Mike"
      const descNameMatch = desc.match(/^(?:User|Profile|Artist)\s*[·•]\s*(.+)$/i);
      if (descNameMatch) {
        const name = descNameMatch[1].trim();
        if (name && !isGeneric(name)) return name;
      }
    }
    
    // Strategy 4: twitter:title
    const twitterMatch = html.match(/name="twitter:title"\s+content="([^"]+)"/);
    if (twitterMatch) {
      const name = extractName(twitterMatch[1].trim());
      if (name) return name;
    }
    
    // Strategy 5: h1 tag
    const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/g;
    let h1m;
    while ((h1m = h1Regex.exec(html)) !== null) {
      const h1 = h1m[1].trim();
      if (h1 && h1.length > 0 && h1.length < 100 && !isGeneric(h1) && !/spotify|web player/i.test(h1)) {
        return h1;
      }
    }
    
    // Strategy 6: data-testid="user-name"
    const testidMatch = html.match(/data-testid="user-name"[^>]*>([^<]+)</);
    if (testidMatch) {
      const name = testidMatch[1].trim();
      if (name && !isGeneric(name)) return name;
    }
    
    // Strategy 7: display_name in embedded JSON
    const jsonMatch = html.match(/"display_name"\s*:\s*"([^"]+)"/);
    if (jsonMatch) {
      const name = jsonMatch[1].trim();
      if (name && !isGeneric(name)) return name;
    }
    
    return null;
  };
  
  try {
    // Use curl for HTTP requests to Spotify.
    // Node.js fetch/https modules get the SPA shell due to TLS fingerprinting.
    // curl has a different TLS fingerprint and gets server-rendered HTML with real user names.
    // ?locale=en-US forces Spotify to return SSR HTML with the user's name in the title.
    const fetchHtmlCurl = (url: string): Promise<{ html: string; status: number }> => {
      return new Promise((resolve, reject) => {
        // Use full path on Windows to ensure we get the system curl
        const curlBin = process.platform === 'win32' 
          ? 'C:\\Windows\\System32\\curl.exe' 
          : 'curl';
        execFile(curlBin, [
          '-s', '-L', '--http1.1',
          '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          '-H', 'Accept: text/html',
          '-w', '\n%{http_code}',
          '--max-time', '10',
          url,
        ], { timeout: 15000 }, (error, stdout, stderr) => {
          if (error) {
            logger.error('[SavedSpotifyUsers] curl error', { 
              spotifyUserId, url, 
              errorMsg: error.message, 
              code: error.code,
              stderr: (stderr || '').substring(0, 500)
            });
            reject(new Error(`curl failed: ${error.message}`));
            return;
          }
          // Log verbose output (stderr) for debugging TLS/connection
          if (stderr) {
            const tlsInfo = stderr.match(/(?:SSL|TLS|ALPN|Connected to|HTTP\/)/gi);
            logger.info('[SavedSpotifyUsers] curl connection info', { 
              spotifyUserId, url, 
              connection: tlsInfo ? tlsInfo.join(', ') : 'no TLS info',
              stderrLen: stderr.length
            });
          }
          // Last line is the HTTP status code
          const lines = stdout.split('\n');
          const status = parseInt(lines[lines.length - 1].trim(), 10) || 0;
          const html = lines.slice(0, -1).join('\n');
          resolve({ html, status });
        });
      });
    };
    
    const urls = [
      `https://open.spotify.com/user/${spotifyUserId}?locale=en-US`,
      `https://open.spotify.com/user/${spotifyUserId}`,
    ];
    
    for (const url of urls) {
      try {
        logger.info('[SavedSpotifyUsers] Fetching profile via curl', { spotifyUserId, url });
        const { html, status } = await fetchHtmlCurl(url);
        logger.info('[SavedSpotifyUsers] Response', { spotifyUserId, url, status, htmlLen: html.length, htmlPreview: html.substring(0, 200) });
        
        if (status >= 200 && status < 300) {
          const name = tryExtractFromHtml(html);
          if (name) {
            logger.info('[SavedSpotifyUsers] Resolved display name', { spotifyUserId, name, source: url });
            return name;
          }
        }
      } catch (innerErr: any) {
        logger.warn('[SavedSpotifyUsers] Fetch failed for URL', { url, error: innerErr.message });
      }
    }
    
    logger.warn('[SavedSpotifyUsers] Could not resolve display name from any source', { spotifyUserId });
    return null;
  } catch (err: any) {
    logger.warn('[SavedSpotifyUsers] Failed to resolve display name', { spotifyUserId, error: err.message });
    return null;
  }
}

/**
 * POST /api/saved-spotify-users
 * Save a new Spotify user ID
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { spotifyUserId, displayName } = req.body;

    if (!spotifyUserId || typeof spotifyUserId !== 'string') {
      res.status(400).json({ 
        error: { message: 'spotifyUserId is required and must be a string' } 
      });
      return;
    }

    // Reject known invalid/generic user IDs
    const invalidUserIds = ['spotify', 'choose', 'language', 'web player', 'webplayer'];
    const trimmedId = spotifyUserId.trim().toLowerCase();
    if (invalidUserIds.includes(trimmedId) || trimmedId.length < 3) {
      res.status(400).json({ 
        error: { message: 'Invalid Spotify user ID. Please enter a valid username or profile URL.' } 
      });
      return;
    }

    if (!displayName || typeof displayName !== 'string') {
      res.status(400).json({ 
        error: { message: 'displayName is required and must be a string' } 
      });
      return;
    }

    // Try to resolve the actual display name from Spotify
    let resolvedName = displayName.trim();
    const resolved = await resolveSpotifyDisplayName(spotifyUserId.trim());
    if (resolved) {
      resolvedName = resolved;
      logger.info('[SavedSpotifyUsers] Resolved display name', { 
        spotifyUserId: spotifyUserId.trim(), 
        from: displayName.trim(), 
        to: resolvedName 
      });
    }

    const db = getDatabase();
    const now = Date.now();

    try {
      const result = db
        .prepare(
          `INSERT INTO saved_spotify_users (user_id, spotify_user_id, display_name, added_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(userId, spotifyUserId.trim(), resolvedName, now);

      const savedUser: SavedSpotifyUser = {
        id: result.lastInsertRowid as number,
        spotify_user_id: spotifyUserId.trim(),
        display_name: resolvedName,
        added_at: now,
      };

      logger.info('[SavedSpotifyUsers] Saved Spotify user', { 
        userId, 
        spotifyUserId: savedUser.spotify_user_id,
        displayName: savedUser.display_name 
      });

      res.status(201).json({ user: savedUser });
    } catch (dbError: any) {
      if (dbError.code && dbError.code.startsWith('SQLITE_CONSTRAINT')) {
        res.status(409).json({ 
          error: { message: 'This Spotify user is already saved' } 
        });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error saving Spotify user', { error });
    res.status(500).json({ error: { message: 'Failed to save Spotify user' } });
  }
});

/**
 * DELETE /api/saved-spotify-users/:id
 * Remove a saved Spotify user
 */
router.delete('/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = (req as any).user.id;
    const savedUserId = parseInt(req.params.id, 10);

    if (isNaN(savedUserId)) {
      res.status(400).json({ 
        error: { message: 'Invalid saved user ID' } 
      });
      return;
    }

    const db = getDatabase();

    // Verify ownership before deleting
    const existing = db
      .prepare('SELECT id FROM saved_spotify_users WHERE id = ? AND user_id = ?')
      .get(savedUserId, userId);

    if (!existing) {
      res.status(404).json({ 
        error: { message: 'Saved Spotify user not found' } 
      });
      return;
    }

    db.prepare('DELETE FROM saved_spotify_users WHERE id = ?').run(savedUserId);

    logger.info('[SavedSpotifyUsers] Deleted saved Spotify user', { 
      userId, 
      savedUserId 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error deleting saved Spotify user', { error });
    res.status(500).json({ error: { message: 'Failed to delete saved Spotify user' } });
  }
});

/**
 * PATCH /api/saved-spotify-users/:id/refresh
 * Re-resolve the display name for a saved Spotify user
 */
router.patch('/:id/refresh', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const savedUserId = parseInt(req.params.id, 10);

    if (isNaN(savedUserId)) {
      res.status(400).json({ error: { message: 'Invalid saved user ID' } });
      return;
    }

    const db = getDatabase();
    const existing = db
      .prepare('SELECT id, spotify_user_id FROM saved_spotify_users WHERE id = ? AND user_id = ?')
      .get(savedUserId, userId) as { id: number; spotify_user_id: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: { message: 'Saved Spotify user not found' } });
      return;
    }

    // Skip resolution for known invalid user IDs
    const invalidIds = ['spotify', 'choose', 'language', 'web player', 'webplayer'];
    if (invalidIds.includes(existing.spotify_user_id.trim().toLowerCase()) || existing.spotify_user_id.trim().length < 3) {
      res.json({ displayName: null, message: 'Invalid Spotify user ID, skipping resolution' });
      return;
    }

    const resolved = await resolveSpotifyDisplayName(existing.spotify_user_id);
    if (resolved) {
      db.prepare('UPDATE saved_spotify_users SET display_name = ? WHERE id = ?').run(resolved, savedUserId);
      logger.info('[SavedSpotifyUsers] Refreshed display name', { 
        savedUserId, 
        spotifyUserId: existing.spotify_user_id, 
        newName: resolved 
      });
      res.json({ displayName: resolved });
    } else {
      res.json({ displayName: null, message: 'Could not resolve display name' });
    }
  } catch (error) {
    logger.error('[SavedSpotifyUsers] Error refreshing display name', { error });
    res.status(500).json({ error: { message: 'Failed to refresh display name' } });
  }
});

export default router;
