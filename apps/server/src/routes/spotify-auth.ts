import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encryption';

const router = Router();

// Spotify OAuth configuration
// Users provide their own Spotify app credentials through the UI
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/api/spotify/callback';

// Encryption secret for Spotify tokens
const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

// Spotify API response types
interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Initiate Spotify OAuth flow using authorization code flow
 * This requires both Client ID and Client Secret for better security and refresh token support
 * GET /api/spotify/login
 */
router.get('/login', requireAuth, (req: Request, res: Response) => {
  try {
    const dbService = req.dbService!;
    const userId = req.session.userId!;
    const db = (dbService as any).db;
    
    // Get credentials from database
    const user = db.prepare(
      'SELECT spotify_client_id, spotify_client_secret FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user?.spotify_client_id || !user?.spotify_client_secret) {
      return res.status(500).json({ 
        error: 'Spotify credentials not configured. Please provide your Client ID and Client Secret.' 
      });
    }
    
    // Decrypt credentials
    let clientId: string;
    let clientSecret: string;
    
    try {
      clientId = decrypt(user.spotify_client_id, ENCRYPTION_SECRET);
      clientSecret = decrypt(user.spotify_client_secret, ENCRYPTION_SECRET);
    } catch (decryptError) {
      logger.error('Failed to decrypt Spotify credentials', { error: decryptError, userId });
      return res.status(500).json({ 
        error: 'Failed to load credentials. Please reconnect your Spotify account.' 
      });
    }
    
    // Update environment variables for this session (for callback use)
    process.env.SPOTIFY_CLIENT_ID = clientId;
    process.env.SPOTIFY_CLIENT_SECRET = clientSecret;
    
    const scopes = 'playlist-read-private playlist-read-collaborative user-library-read';
    
    // Use authorization code flow (response_type=code)
    // This returns an authorization code that we exchange for tokens
    const authUrl = `https://accounts.spotify.com/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
      `state=${userId}&` +
      `show_dialog=true`;
    
    return res.json({ authUrl });
  } catch (err) {
    logger.error('Failed to initiate Spotify login', { error: err });
    return res.status(500).json({ error: 'Failed to initiate Spotify login' });
  }
});

/**
 * Spotify OAuth callback for authorization code flow
 * Exchange authorization code for access and refresh tokens
 * GET /api/spotify/callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  const closePopup = (status: 'connected' | 'error', detail: string) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Connecting…</title></head><body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'cross_import_oauth', status: '${status}', service: 'spotify', detail: decodeURIComponent('${encodeURIComponent(detail)}') }, '*');
    }
  } catch(e) {}
  window.close();
<\/script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#ccc;">${status === 'connected' ? 'Connected! You can close this window.' : 'Error: ' + detail}</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  };

  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.error('Spotify OAuth error', { error });
      return closePopup('error', String(error));
    }
    
    if (!code || typeof code !== 'string') {
      return closePopup('error', 'no_code');
    }
    
    // Get user ID from state parameter
    const userId = state ? parseInt(state as string) : null;
    
    if (!userId) {
      return closePopup('error', 'invalid_state');
    }
    
    // Get credentials from database
    const dbService = req.dbService || (req.app as any).get('dbService');
    if (!dbService) {
      logger.error('Database service not available');
      return closePopup('error', 'server_error');
    }
    
    const db = (dbService as any).db;
    
    const user = db.prepare(
      'SELECT spotify_client_id, spotify_client_secret FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user?.spotify_client_id || !user?.spotify_client_secret) {
      logger.error('Spotify credentials not found for user', { userId });
      return closePopup('error', 'credentials_not_found');
    }
    
    // Decrypt credentials
    let clientId: string;
    let clientSecret: string;
    
    try {
      clientId = decrypt(user.spotify_client_id, ENCRYPTION_SECRET);
      clientSecret = decrypt(user.spotify_client_secret, ENCRYPTION_SECRET);
    } catch (decryptError) {
      logger.error('Failed to decrypt Spotify credentials', { error: decryptError, userId });
      return closePopup('error', 'decrypt_failed');
    }
    
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      logger.error('Failed to exchange code for tokens', { error: errorData });
      return closePopup('error', 'token_exchange_failed');
    }
    
    const tokens = await tokenResponse.json() as SpotifyTokenResponse;
    const { access_token, refresh_token, expires_in } = tokens;
    
    // Calculate expiration time
    const expiresAt = Date.now() + (expires_in * 1000);
    
    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(access_token, ENCRYPTION_SECRET);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token, ENCRYPTION_SECRET) : null;
    
    // Store encrypted tokens in database
    db.prepare(
      `UPDATE users SET 
        spotify_access_token = ?,
        spotify_refresh_token = ?,
        spotify_token_expires_at = ?
      WHERE id = ?`
    ).run(encryptedAccessToken, encryptedRefreshToken, expiresAt, userId);
    
    logger.info('Spotify tokens saved (encrypted)', { userId });
    return closePopup('connected', 'spotify');
  } catch (err) {
    logger.error('Spotify callback error', { error: err });
    return closePopup('error', 'callback_failed');
  }
});

/**
 * Test Spotify credentials without OAuth
 * POST /api/spotify/test-credentials
 */
router.post('/test-credentials', requireAuth, async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret } = req.body;
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Both Client ID and Client Secret are required' 
      });
    }
    
    // Validate format first
    if (!/^[a-f0-9]{32}$/i.test(clientId)) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid Client ID format (should be 32 hex characters)' 
      });
    }
    
    if (!/^[a-f0-9]{32}$/i.test(clientSecret)) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid Client Secret format (should be 32 hex characters)' 
      });
    }
    
    // Test credentials by making a request to Spotify API
    // We'll use the client credentials flow to verify the credentials work
    const testResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });
    
    if (testResponse.ok) {
      logger.info('Spotify credentials validated successfully', { 
        userId: req.session.userId,
        clientIdPrefix: clientId.substring(0, 8) + '...'
      });
      return res.json({ 
        valid: true, 
        message: 'Credentials are valid!' 
      });
    } else {
      const errorData = await testResponse.json();
      logger.warn('Invalid Spotify credentials', { 
        userId: req.session.userId,
        error: errorData,
        status: testResponse.status
      });
      return res.json({ 
        valid: false, 
        error: 'Invalid credentials. Please check your Client ID and Client Secret.' 
      });
    }
  } catch (err) {
    logger.error('Failed to test Spotify credentials', { error: err, userId: req.session.userId });
    return res.status(500).json({ 
      valid: false, 
      error: 'Failed to validate credentials. Please try again.' 
    });
  }
});

/**
 * Save Spotify credentials (Client ID and Client Secret)
 * POST /api/spotify/save-credentials
 */
router.post('/save-credentials', requireAuth, async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret } = req.body;
    
    if (!clientId || typeof clientId !== 'string') {
      logger.warn('Missing or invalid Client ID', { userId: req.session.userId });
      return res.status(400).json({ error: 'Client ID is required' });
    }
    
    if (!clientSecret || typeof clientSecret !== 'string') {
      logger.warn('Missing or invalid Client Secret', { userId: req.session.userId });
      return res.status(400).json({ error: 'Client Secret is required' });
    }
    
    // Validate Client ID format (Spotify Client IDs are 32 character hex strings)
    if (!/^[a-f0-9]{32}$/i.test(clientId)) {
      logger.warn('Invalid Client ID format', { userId: req.session.userId, clientIdLength: clientId.length });
      return res.status(400).json({ 
        error: 'Invalid Client ID format. It should be a 32-character hexadecimal string.' 
      });
    }
    
    // Validate Client Secret format (Spotify Client Secrets are 32 character hex strings)
    if (!/^[a-f0-9]{32}$/i.test(clientSecret)) {
      logger.warn('Invalid Client Secret format', { userId: req.session.userId, clientSecretLength: clientSecret.length });
      return res.status(400).json({ 
        error: 'Invalid Client Secret format. It should be a 32-character hexadecimal string.' 
      });
    }
    
    const dbService = req.dbService!;
    const userId = req.session.userId!;
    const db = (dbService as any).db;
    
    // Encrypt credentials before storing
    const encryptedClientId = encrypt(clientId, ENCRYPTION_SECRET);
    const encryptedClientSecret = encrypt(clientSecret, ENCRYPTION_SECRET);
    
    // Store encrypted credentials in database
    db.prepare(
      `UPDATE users SET 
        spotify_client_id = ?,
        spotify_client_secret = ?
      WHERE id = ?`
    ).run(encryptedClientId, encryptedClientSecret, userId);
    
    // Also update environment variables for this session (for immediate use)
    process.env.SPOTIFY_CLIENT_ID = clientId;
    process.env.SPOTIFY_CLIENT_SECRET = clientSecret;
    
    logger.info('Spotify credentials saved (encrypted)', { 
      userId,
      clientIdPrefix: clientId.substring(0, 8) + '...'
    });
    
    return res.json({ 
      success: true,
      message: 'Credentials saved successfully. Redirecting to Spotify...'
    });
  } catch (err) {
    logger.error('Failed to save Spotify credentials', { error: err, userId: req.session.userId });
    return res.status(500).json({ error: 'Failed to save credentials. Please try again.' });
  }
});

/**
 * Check Spotify connection status
 * GET /api/spotify/status
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbService = req.dbService!;
    const userId = req.session.userId!;
    
    const db = (dbService as any).db;
    
    const user = db.prepare(
      'SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires_at, spotify_client_id, spotify_client_secret FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user) {
      logger.warn('User not found for Spotify status check', { userId });
      return res.json({ connected: false, hasCredentials: false });
    }
    
    const hasCredentials = !!(user?.spotify_client_id && user?.spotify_client_secret);
    const now = Date.now();
    const expiresAt = user?.spotify_token_expires_at || 0;
    const isExpired = expiresAt <= now;
    
    // If token is expired but we have a refresh token, try to refresh it
    let isConnected = !!(user?.spotify_access_token && !isExpired);
    
    if (isExpired && user?.spotify_refresh_token) {
      logger.info('Token expired, attempting automatic refresh', { userId });
      const refreshed = await refreshSpotifyToken(userId, user.spotify_refresh_token, db);
      if (refreshed) {
        isConnected = true;
        logger.info('Token automatically refreshed on status check', { userId });
      } else {
        logger.warn('Token refresh failed on status check', { userId });
      }
    }
    
    return res.json({ 
      connected: isConnected,
      hasCredentials: hasCredentials,
      tokenExpired: isExpired && !isConnected
    });
  } catch (err: any) {
    logger.error('Failed to check Spotify status', { 
      error: err,
      message: err?.message,
      stack: err?.stack,
      userId: req.session.userId 
    });
    return res.json({ connected: false, hasCredentials: false });
  }
});

/**
 * Get Spotify access token for API calls
 * Automatically refreshes if expired
 * GET /api/spotify/token
 */
router.get('/token', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbService = req.dbService!;
    const userId = req.session.userId!;
    const db = (dbService as any).db;
    
    const user = db.prepare(
      'SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires_at FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user?.spotify_access_token) {
      return res.status(401).json({ error: 'Not connected to Spotify' });
    }
    
    // Check if token is expired
    if (user.spotify_token_expires_at <= Date.now()) {
      // Try to refresh the token
      if (user.spotify_refresh_token) {
        try {
          const refreshed = await refreshSpotifyToken(userId, user.spotify_refresh_token, db);
          if (refreshed) {
            return res.json({ accessToken: refreshed });
          }
        } catch (refreshError) {
          logger.error('Failed to refresh Spotify token', { error: refreshError, userId });
        }
      }
      return res.status(401).json({ error: 'Spotify token expired. Please reconnect.' });
    }
    
    // Decrypt the access token before returning
    try {
      const decryptedToken = decrypt(user.spotify_access_token, ENCRYPTION_SECRET);
      return res.json({ accessToken: decryptedToken });
    } catch (decryptError) {
      logger.error('Failed to decrypt Spotify token', { error: decryptError, userId });
      return res.status(500).json({ error: 'Failed to decrypt token. Please reconnect to Spotify.' });
    }
  } catch (err) {
    logger.error('Failed to get Spotify token', { error: err });
    return res.status(500).json({ error: 'Failed to get token' });
  }
});

/**
 * Get user's Spotify playlists
 * GET /api/spotify/playlists
 */
router.get('/playlists', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbService = req.dbService!;
    const userId = req.session.userId!;
    const db = (dbService as any).db;
    
    const token = await getSpotifyToken(userId, db);
    
    if (!token) {
      return res.status(401).json({ error: 'Not connected to Spotify' });
    }
    
    // Fetch user's playlists from Spotify API
    const playlistsResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!playlistsResponse.ok) {
      // Log the response for debugging
      const responseText = await playlistsResponse.text();
      logger.error('Failed to fetch Spotify playlists', { 
        status: playlistsResponse.status,
        statusText: playlistsResponse.statusText,
        responsePreview: responseText.substring(0, 200),
        userId 
      });
      
      // Try to parse as JSON if it looks like JSON
      let errorMessage = 'Failed to fetch playlists from Spotify';
      if (responseText.trim().startsWith('{')) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // Not JSON, use default message
        }
      }
      
      return res.status(playlistsResponse.status).json({ error: errorMessage });
    }
    
    const data = await playlistsResponse.json() as any;
    
    // Transform to our format
    const playlists = data.items.map((playlist: any) => ({
      name: playlist.name,
      url: playlist.external_urls.spotify,
      description: `${playlist.tracks.total} tracks${playlist.owner.display_name ? ` • by ${playlist.owner.display_name}` : ''}`,
      trackCount: playlist.tracks.total,
      owner: playlist.owner.display_name,
      imageUrl: playlist.images?.[0]?.url,
    }));
    
    logger.info('Successfully fetched Spotify playlists', { 
      userId, 
      playlistCount: playlists.length 
    });
    
    return res.json({ playlists });
  } catch (err: any) {
    logger.error('Failed to get Spotify playlists', { 
      error: err.message,
      stack: err.stack,
      userId: req.session.userId 
    });
    return res.status(500).json({ error: 'Failed to get playlists' });
  }
});

/**
 * Disconnect Spotify
 * POST /api/spotify/disconnect
 */
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbService = req.dbService!;
    const db = (dbService as any).db;
    const userId = req.session.userId!;
    
    db.prepare(
      `UPDATE users SET 
        spotify_access_token = NULL,
        spotify_refresh_token = NULL,
        spotify_token_expires_at = NULL
      WHERE id = ?`
    ).run(userId);
    
    return res.json({ success: true });
  } catch (err) {
    logger.error('Failed to disconnect Spotify', { error: err });
    return res.status(500).json({ error: 'Failed to disconnect Spotify' });
  }
});

/**
 * Refresh Spotify access token using refresh token
 * Helper function for internal use
 */
async function refreshSpotifyToken(userId: number, encryptedRefreshToken: string, db: any): Promise<string | null> {
  try {
    // Get user's credentials from database
    const user = db.prepare(
      'SELECT spotify_client_id, spotify_client_secret FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user?.spotify_client_id || !user?.spotify_client_secret) {
      logger.error('Spotify credentials not found for token refresh', { userId });
      return null;
    }
    
    // Decrypt credentials
    let clientId: string;
    let clientSecret: string;
    
    try {
      clientId = decrypt(user.spotify_client_id, ENCRYPTION_SECRET);
      clientSecret = decrypt(user.spotify_client_secret, ENCRYPTION_SECRET);
    } catch (decryptError) {
      logger.error('Failed to decrypt Spotify credentials for refresh', { error: decryptError, userId });
      return null;
    }
    
    // Decrypt refresh token
    const refreshToken = decrypt(encryptedRefreshToken, ENCRYPTION_SECRET);
    
    logger.info('Attempting to refresh Spotify token', { 
      userId,
      clientIdPrefix: clientId.substring(0, 8) + '...',
      refreshTokenPrefix: refreshToken.substring(0, 10) + '...'
    });
    
    // Request new access token
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to refresh Spotify token', { 
        error: errorData,
        status: response.status,
        userId
      });
      return null;
    }
    
    const tokens = await response.json() as SpotifyTokenResponse;
    const { access_token, expires_in, refresh_token: newRefreshToken } = tokens;
    
    // Calculate expiration time
    const expiresAt = Date.now() + (expires_in * 1000);
    
    logger.info('Successfully refreshed Spotify token', { 
      userId,
      expiresAt: new Date(expiresAt).toISOString(),
      hasNewRefreshToken: !!newRefreshToken
    });
    
    // Encrypt new tokens
    const encryptedAccessToken = encrypt(access_token, ENCRYPTION_SECRET);
    const encryptedNewRefreshToken = newRefreshToken ? encrypt(newRefreshToken, ENCRYPTION_SECRET) : encryptedRefreshToken;
    
    // Update database
    db.prepare(
      `UPDATE users SET 
        spotify_access_token = ?,
        spotify_refresh_token = ?,
        spotify_token_expires_at = ?
      WHERE id = ?`
    ).run(encryptedAccessToken, encryptedNewRefreshToken, expiresAt, userId);
    
    logger.info('Spotify token refreshed and saved', { userId });
    return access_token;
  } catch (error: any) {
    logger.error('Failed to refresh Spotify token', { 
      error: error.message,
      stack: error.stack,
      userId 
    });
    return null;
  }
}

/**
 * Get decrypted Spotify access token for a user
 * Helper function for internal use
 */
export async function getSpotifyToken(userId: number, db: any): Promise<string | null> {
  try {
    const user = db.prepare(
      'SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires_at FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user?.spotify_access_token) {
      logger.info('No Spotify access token found for user', { userId });
      return null;
    }
    
    const now = Date.now();
    const expiresAt = user.spotify_token_expires_at;
    const isExpired = expiresAt <= now;
    
    logger.info('Spotify token status', { 
      userId, 
      expiresAt: new Date(expiresAt).toISOString(),
      now: new Date(now).toISOString(),
      isExpired,
      hasRefreshToken: !!user.spotify_refresh_token
    });
    
    // Check if token is expired
    if (isExpired) {
      logger.info('Spotify token expired, attempting refresh', { userId });
      // Try to refresh the token
      if (user.spotify_refresh_token) {
        const refreshed = await refreshSpotifyToken(userId, user.spotify_refresh_token, db);
        if (refreshed) {
          logger.info('Successfully refreshed Spotify token', { userId });
          return refreshed;
        } else {
          logger.error('Failed to refresh Spotify token', { userId });
        }
      } else {
        logger.error('No refresh token available', { userId });
      }
      return null;
    }
    
    // Decrypt the token
    const decryptedToken = decrypt(user.spotify_access_token, ENCRYPTION_SECRET);
    logger.info('Successfully retrieved and decrypted Spotify token', { 
      userId,
      tokenPrefix: decryptedToken.substring(0, 10) + '...'
    });
    return decryptedToken;
  } catch (error: any) {
    logger.error('Failed to get Spotify token', { 
      error: error.message,
      stack: error.stack,
      userId 
    });
    return null;
  }
}

/**
 * Disconnect Spotify account
 * DELETE /api/spotify/disconnect
 */
router.delete('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbService = req.dbService!;
    const userId = req.session.userId!;
    const db = (dbService as any).db;
    
    // Clear Spotify tokens from database
    db.prepare(`
      UPDATE users 
      SET spotify_access_token = NULL,
          spotify_refresh_token = NULL,
          spotify_token_expires_at = NULL
      WHERE id = ?
    `).run(userId);
    
    logger.info('Spotify account disconnected', { userId });
    
    return res.json({ success: true, message: 'Spotify account disconnected' });
  } catch (err) {
    logger.error('Failed to disconnect Spotify', { error: err, userId: req.session.userId });
    return res.status(500).json({ error: 'Failed to disconnect Spotify account' });
  }
});

export default router;
