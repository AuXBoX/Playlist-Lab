import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();

/**
 * GET /api/proxy/image
 * Proxy Plex images to avoid CORS issues
 */
router.get('/image', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.query;
    const userId = req.session.userId!;
    const db = req.dbService!;

    logger.info('Image proxy request', { url, userId });

    if (!url || typeof url !== 'string') {
      logger.error('Invalid URL parameter', { url });
      return next(createValidationError('url parameter is required'));
    }

    // Get user's Plex token
    const user = db.getUserById(userId);
    if (!user) {
      logger.error('User not found for image proxy', { userId });
      return next(createValidationError('User not found'));
    }

    // Add token to URL if not already present
    const imageUrl = url.includes('?') 
      ? `${url}&X-Plex-Token=${user.plex_token}`
      : `${url}?X-Plex-Token=${user.plex_token}`;

    logger.info('Fetching image from Plex', { imageUrl: imageUrl.replace(user.plex_token, 'REDACTED') });

    // Fetch image from Plex
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'X-Plex-Token': user.plex_token,
      },
      timeout: 10000,
    });

    logger.info('Image fetched successfully', { 
      contentType: response.headers['content-type'],
      size: response.data.length 
    });

    // Set appropriate headers
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(response.data);
  } catch (error: any) {
    logger.error('Failed to proxy image', { 
      error: error.message, 
      code: error.code,
      status: error.response?.status 
    });
    // Send a 1x1 transparent pixel as fallback
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    res.send(transparentPixel);
  }
});

/**
 * GET /api/proxy/audio
 * Proxy Plex audio streams to avoid CORS issues
 */
router.get('/audio', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ratingKey } = req.query;
    const userId = req.session.userId!;
    const db = req.dbService!;

    logger.info('Audio proxy request', { ratingKey, userId });

    if (!ratingKey || typeof ratingKey !== 'string') {
      logger.error('Invalid ratingKey parameter', { ratingKey });
      return next(createValidationError('ratingKey parameter is required'));
    }

    // Get user's Plex token and server
    const user = db.getUserById(userId);
    if (!user) {
      logger.error('User not found for audio proxy', { userId });
      return next(createValidationError('User not found'));
    }

    const server = db.getUserServer(userId);
    if (!server) {
      logger.error('Server not found for audio proxy', { userId });
      return next(createValidationError('Server not found'));
    }

    // First, get the track metadata to find the actual media file path
    const metadataUrl = `${server.server_url}/library/metadata/${ratingKey}?X-Plex-Token=${user.plex_token}`;
    
    logger.info('Fetching track metadata', { 
      metadataUrl: metadataUrl.replace(user.plex_token, 'REDACTED') 
    });

    const metadataResponse = await axios.get(metadataUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': user.plex_token,
      },
      timeout: 10000,
    });

    const track = metadataResponse.data?.MediaContainer?.Metadata?.[0];
    if (!track || !track.Media?.[0]?.Part?.[0]?.key) {
      logger.error('Track media not found', { ratingKey, track });
      return next(createValidationError('Track media not found'));
    }

    // Get the direct stream URL from the track's media part
    const partKey = track.Media[0].Part[0].key;
    const audioUrl = `${server.server_url}${partKey}?X-Plex-Token=${user.plex_token}`;

    logger.info('Streaming audio from Plex', { 
      audioUrl: audioUrl.replace(user.plex_token, 'REDACTED') 
    });

    // Stream audio from Plex
    const response = await axios.get(audioUrl, {
      responseType: 'stream',
      headers: {
        'X-Plex-Token': user.plex_token,
      },
      timeout: 30000,
    });

    logger.info('Audio stream started', { 
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length']
    });

    // Forward headers
    res.set('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'no-cache');
    
    if (response.headers['content-range']) {
      res.set('Content-Range', response.headers['content-range']);
      res.status(206); // Partial Content
    }

    // Pipe the stream
    response.data.pipe(res);
  } catch (error: any) {
    logger.error('Failed to proxy audio', { 
      error: error.message, 
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data
    });
    next(error);
  }
});

export default router;
