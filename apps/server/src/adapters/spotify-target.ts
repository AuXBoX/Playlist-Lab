/**
 * Spotify Target Adapter
 *
 * Implements TargetAdapter for Spotify.
 * Uses the existing users table token columns for backward compatibility
 * (Spotify tokens are stored in users.spotify_access_token etc., not oauth_connections).
 *
 * OAuth methods delegate to the same pattern as spotify-auth.ts.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { getSpotifyToken } from '../routes/spotify-auth';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3001/api/spotify/callback';

/** Compute a simple string-similarity confidence score (0–100) */
function similarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (!na || !nb) return 0;

  // Longest common subsequence length as a rough proxy
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

/** Build a confidence score from source vs result metadata */
function scoreResult(source: TrackInfo, result: any): number {
  const titleScore = similarity(source.title, result.name ?? '');
  const artistScore = similarity(source.artist, result.artists?.[0]?.name ?? '');
  return Math.round((titleScore * 0.6) + (artistScore * 0.4));
}

export const spotifyTargetAdapter: TargetAdapter = {
  meta: {
    id: 'spotify',
    name: 'Spotify',
    icon: 'spotify',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  /**
   * Search Spotify's catalog for a track by query string.
   * Returns up to 10 results as MatchResult entries.
   */
  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const token = await getSpotifyToken(userId, db);
    if (!token) {
      throw new Error('Not connected to Spotify. Please authenticate first.');
    }

    const response = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message || `Spotify search failed: ${response.status}`);
    }

    const data = await response.json() as any;
    const sourceTrack: TrackInfo = { title: query, artist: '' };

    return (data.tracks?.items ?? []).map((item: any) => ({
      sourceTrack,
      targetTrackId: item.uri,
      targetTitle: item.name,
      targetArtist: item.artists?.[0]?.name ?? '',
      targetAlbum: item.album?.name,
      confidence: scoreResult(sourceTrack, item),
      matched: true,
      skipped: false,
    }));
  },

  /**
   * Match source tracks against Spotify's catalog.
   * Searches each track individually, picks the top result, emits progress events.
   */
  async matchTracks(
    tracks: TrackInfo[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any,
    progressEmitter?: NodeJS.EventEmitter,
    isCancelled?: () => boolean
  ): Promise<MatchResult[]> {
    const token = await getSpotifyToken(userId, db);
    if (!token) {
      throw new Error('Not connected to Spotify. Please authenticate first.');
    }

    const results: MatchResult[] = [];

    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) break;

      const track = tracks[i];
      const query = `${track.title} ${track.artist}`.trim();

      let matchResult: MatchResult = {
        sourceTrack: track,
        confidence: 0,
        matched: false,
        skipped: false,
      };

      try {
        const response = await fetch(
          `https://api.spotify.com/v1/search?type=track&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json() as any;
          const items: any[] = data.tracks?.items ?? [];

          if (items.length > 0) {
            // Score all results and pick the best
            const scored = items.map(item => ({ item, score: scoreResult(track, item) }));
            scored.sort((a, b) => b.score - a.score);
            const best = scored[0];

            matchResult = {
              sourceTrack: track,
              targetTrackId: best.item.uri,
              targetTitle: best.item.name,
              targetArtist: best.item.artists?.[0]?.name ?? '',
              targetAlbum: best.item.album?.name,
              confidence: best.score,
              matched: best.score >= 50,
              skipped: false,
            };
          }
        }
      } catch (err) {
        logger.warn('[SpotifyTargetAdapter] Search failed for track', { track, err });
      }

      results.push(matchResult);

      progressEmitter?.emit('progress', {
        type: 'progress',
        phase: 'matching',
        current: i + 1,
        total: tracks.length,
      });
    }

    logger.info('[SpotifyTargetAdapter] matchTracks complete', {
      userId,
      total: tracks.length,
      matched: results.filter(r => r.matched).length,
    });

    return results;
  },

  /**
   * Create a playlist on Spotify and add the matched tracks.
   * Uses POST /v1/users/{userId}/playlists then POST /v1/playlists/{id}/tracks.
   */
  async createPlaylist(
    name: string,
    matchResults: MatchResult[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }> {
    const token = await getSpotifyToken(userId, db);
    if (!token) {
      throw new Error('Not connected to Spotify. Please authenticate first.');
    }

    // Get Spotify user ID
    const meResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meResponse.ok) {
      throw new Error(`Failed to get Spotify user info: ${meResponse.status}`);
    }

    const me = await meResponse.json() as any;
    const spotifyUserId: string = me.id;

    // Create the playlist
    const createResponse = await fetch(
      `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, public: false }),
      }
    );

    if (!createResponse.ok) {
      const err = await createResponse.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message || `Failed to create Spotify playlist: ${createResponse.status}`);
    }

    const created = await createResponse.json() as any;
    const playlistId: string = created.id;

    // Collect matched, non-skipped track URIs
    const uris = matchResults
      .filter(r => r.matched && !r.skipped && r.targetTrackId)
      .map(r => r.targetTrackId!);

    if (uris.length === 0) {
      return { playlistId, name: created.name, trackCount: 0 };
    }

    // Spotify allows max 100 tracks per request — add in batches
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      const addResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: batch }),
        }
      );

      if (!addResponse.ok) {
        const err = await addResponse.json().catch(() => ({})) as any;
        // Attempt to clean up the empty playlist on failure
        await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/followers`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
        throw new Error(err?.error?.message || `Failed to add tracks to Spotify playlist: ${addResponse.status}`);
      }
    }

    logger.info('[SpotifyTargetAdapter] Created playlist', {
      userId,
      playlistId,
      name: created.name,
      trackCount: uris.length,
    });

    return { playlistId, name: created.name, trackCount: uris.length };
  },

  /**
   * Return the Spotify OAuth authorization URL.
   * Reuses the same scopes and flow as spotify-auth.ts.
   * Uses the existing SPOTIFY_REDIRECT_URI (already registered in Spotify app dashboard).
   */
  async getOAuthUrl(userId: number, db: any, _redirectUri: string): Promise<string> {
    const user = db.prepare(
      'SELECT spotify_client_id, spotify_client_secret FROM users WHERE id = ?'
    ).get(userId);

    if (!user?.spotify_client_id || !user?.spotify_client_secret) {
      throw new Error('Spotify credentials not configured. Please provide your Client ID and Client Secret in Settings.');
    }

    const clientId = decrypt(user.spotify_client_id, ENCRYPTION_SECRET);

    const scopes = [
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-library-read',
    ].join(' ');

    // Always use the registered redirect URI — must match what's in the Spotify app dashboard
    const authUrl =
      `https://accounts.spotify.com/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
      `state=${userId}&` +
      `show_dialog=true`;

    return authUrl;
  },

  /**
   * Handle the OAuth callback: exchange code for tokens and store them.
   * Stores in the users table (backward compatible with existing Spotify integration).
   */
  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    const user = db.prepare(
      'SELECT spotify_client_id, spotify_client_secret FROM users WHERE id = ?'
    ).get(userId);

    if (!user?.spotify_client_id || !user?.spotify_client_secret) {
      throw new Error('Spotify credentials not found for user');
    }

    const clientId = decrypt(user.spotify_client_id, ENCRYPTION_SECRET);
    const clientSecret = decrypt(user.spotify_client_secret, ENCRYPTION_SECRET);

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json().catch(() => ({})) as any;
      throw new Error(err?.error_description || `Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json() as any;
    const { access_token, refresh_token, expires_in } = tokens;
    const expiresAt = Date.now() + expires_in * 1000;

    db.prepare(
      `UPDATE users SET
        spotify_access_token = ?,
        spotify_refresh_token = ?,
        spotify_token_expires_at = ?
      WHERE id = ?`
    ).run(
      encrypt(access_token, ENCRYPTION_SECRET),
      refresh_token ? encrypt(refresh_token, ENCRYPTION_SECRET) : null,
      expiresAt,
      userId
    );

    logger.info('[SpotifyTargetAdapter] OAuth tokens stored', { userId });
  },

  /**
   * Check whether the user has a valid (non-expired) Spotify connection.
   */
  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    const token = await getSpotifyToken(userId, db);
    return token !== null;
  },

  /**
   * Revoke the Spotify connection by clearing tokens from the users table.
   */
  async revokeConnection(userId: number, db: any): Promise<void> {
    db.prepare(
      `UPDATE users SET
        spotify_access_token = NULL,
        spotify_refresh_token = NULL,
        spotify_token_expires_at = NULL
      WHERE id = ?`
    ).run(userId);

    logger.info('[SpotifyTargetAdapter] Connection revoked', { userId });
  },
};
