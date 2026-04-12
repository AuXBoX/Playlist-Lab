import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/youtube-config/credentials
 * Saves YouTube OAuth credentials to .env file
 */
router.post('/credentials', async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret, redirectUri } = req.body;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({ 
        error: 'Missing required fields: clientId, clientSecret, redirectUri' 
      });
    }

    // Validate format
    if (!clientId.includes('.apps.googleusercontent.com')) {
      return res.status(400).json({ 
        error: 'Invalid Client ID format. Should end with .apps.googleusercontent.com' 
      });
    }

    if (!redirectUri.includes('/api/cross-import/oauth/youtube/callback')) {
      return res.status(400).json({ 
        error: 'Invalid Redirect URI. Should end with /api/cross-import/oauth/youtube/callback' 
      });
    }

    // Path to .env file
    const envPath = path.join(process.cwd(), '.env');
    
    // Read existing .env file
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch (err) {
      // If .env doesn't exist, create it
      envContent = '# Playlist Lab Server Configuration\n\n';
    }

    // Update or add YouTube credentials
    const lines = envContent.split('\n');
    let updatedClientId = false;
    let updatedClientSecret = false;
    let updatedRedirectUri = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('YOUTUBE_CLIENT_ID=')) {
        lines[i] = `YOUTUBE_CLIENT_ID=${clientId}`;
        updatedClientId = true;
      } else if (lines[i].startsWith('YOUTUBE_CLIENT_SECRET=')) {
        lines[i] = `YOUTUBE_CLIENT_SECRET=${clientSecret}`;
        updatedClientSecret = true;
      } else if (lines[i].startsWith('YOUTUBE_REDIRECT_URI=')) {
        lines[i] = `YOUTUBE_REDIRECT_URI=${redirectUri}`;
        updatedRedirectUri = true;
      }
    }

    // If not found, add them
    if (!updatedClientId || !updatedClientSecret || !updatedRedirectUri) {
      // Find YouTube section or add at end
      const youtubeIndex = lines.findIndex(line => 
        line.includes('YouTube OAuth Configuration')
      );

      if (youtubeIndex !== -1) {
        // Add after the comment section
        let insertIndex = youtubeIndex + 1;
        while (insertIndex < lines.length && lines[insertIndex].startsWith('#')) {
          insertIndex++;
        }
        
        if (!updatedClientId) {
          lines.splice(insertIndex, 0, `YOUTUBE_CLIENT_ID=${clientId}`);
          insertIndex++;
        }
        if (!updatedClientSecret) {
          lines.splice(insertIndex, 0, `YOUTUBE_CLIENT_SECRET=${clientSecret}`);
          insertIndex++;
        }
        if (!updatedRedirectUri) {
          lines.splice(insertIndex, 0, `YOUTUBE_REDIRECT_URI=${redirectUri}`);
        }
      } else {
        // Add new section at end
        lines.push('');
        lines.push('# YouTube OAuth Configuration');
        lines.push(`YOUTUBE_CLIENT_ID=${clientId}`);
        lines.push(`YOUTUBE_CLIENT_SECRET=${clientSecret}`);
        lines.push(`YOUTUBE_REDIRECT_URI=${redirectUri}`);
      }
    }

    // Write back to .env
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');

    logger.info('[YouTubeConfig] Credentials saved to .env file', { 
      userId: req.session.userId 
    });

    return res.json({ 
      success: true, 
      message: 'Credentials saved. Please restart the server for changes to take effect.' 
    });
  } catch (err: any) {
    logger.error('[YouTubeConfig] Failed to save credentials', { error: err.message });
    return res.status(500).json({ error: 'Failed to save credentials: ' + err.message });
  }
});

/**
 * GET /api/youtube-config/status
 * Check if YouTube OAuth is configured
 */
router.get('/status', (_req: Request, res: Response) => {
  const configured = !!(
    process.env.YOUTUBE_CLIENT_ID && 
    process.env.YOUTUBE_CLIENT_SECRET && 
    process.env.YOUTUBE_REDIRECT_URI &&
    !process.env.YOUTUBE_CLIENT_ID.includes('your-client-id')
  );

  res.json({ 
    configured,
    debug: {
      hasClientId: !!process.env.YOUTUBE_CLIENT_ID,
      hasClientSecret: !!process.env.YOUTUBE_CLIENT_SECRET,
      hasRedirectUri: !!process.env.YOUTUBE_REDIRECT_URI,
      clientIdPreview: process.env.YOUTUBE_CLIENT_ID?.substring(0, 20) + '...',
      isPlaceholder: process.env.YOUTUBE_CLIENT_ID?.includes('your-client-id')
    }
  });
});

export default router;
