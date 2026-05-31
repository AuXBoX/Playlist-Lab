/**
 * Configuration API Routes
 * 
 * Endpoints for managing server configuration, including PUBLIC_URL
 * for reverse proxy and OAuth support.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { configService } from '../config';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/config/public-url
 * Returns current public URL configuration and OAuth redirect URLs
 */
router.get('/public-url', requireAuth, (req: Request, res: Response) => {
  try {
    const publicUrl = configService.getPublicUrlFromRequest(req);
    const oauthRedirectUrls = configService.getAllOAuthRedirectUrls();

    res.json({
      publicUrl,
      configuredPublicUrl: configService.config.publicUrl,
      oauthRedirectUrls,
      isDefault: configService.config.publicUrl === 'http://localhost:3001',
      trustProxy: configService.config.trustProxy,
    });
  } catch (err: any) {
    logger.error('[Config] Failed to get public URL config', { error: err.message });
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * PUT /api/config/public-url
 * Updates the PUBLIC_URL configuration and persists to server.conf.json
 */
router.put('/public-url', requireAuth, (req: Request, res: Response) => {
  try {
    const { publicUrl } = req.body;

    if (!publicUrl || typeof publicUrl !== 'string') {
      return res.status(400).json({ error: 'publicUrl is required and must be a string' });
    }

    // Validate URL format
    try {
      const url = new URL(publicUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return res.status(400).json({ error: 'URL must use http:// or https:// protocol' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Update and persist configuration
    configService.updateConfig({ 
      publicUrl,
      oauthRedirectBase: publicUrl, // Update OAuth base as well
    });

    logger.info('[Config] PUBLIC_URL updated and persisted', { 
      publicUrl,
      userId: req.session.userId,
    });

    return res.json({
      success: true,
      message: 'PUBLIC_URL updated and saved. Changes will persist across server restarts.',
      publicUrl,
      oauthRedirectUrls: configService.getAllOAuthRedirectUrls(),
    });
  } catch (err: any) {
    logger.error('[Config] Failed to update public URL', { error: err.message });
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
});

export default router;
