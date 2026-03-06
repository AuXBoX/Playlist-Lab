import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError, createNotFoundError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { PlexService } from '../services/plex';
import axios from 'axios';

const router = Router();

// Gemini API configuration
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1';
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

// Grok API configuration
const GROK_API_BASE = 'https://api.x.ai/v1';
const GROK_MODEL = 'grok-beta';

/**
 * POST /api/import/ai
 * Generate a playlist using AI based on a text prompt
 */
router.post('/ai', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { prompt, trackCount = 50, geminiApiKey, grokApiKey, aiProvider } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return next(createValidationError('prompt is required'));
    }

    // Validate trackCount
    const validTrackCount = Math.min(100, Math.max(10, Number(trackCount) || 50));

    // Get user and server info
    const user = db.getUserById(userId);
    if (!user) {
      return next(createNotFoundError('User not found'));
    }

    // Get settings
    const settings = db.getUserSettings(userId);
    const selectedProvider = aiProvider || settings.ai_provider || 'gemini';
    
    // Get appropriate API key based on provider
    let apiKey: string;
    if (selectedProvider === 'grok') {
      apiKey = grokApiKey || settings.grok_api_key || '';
      if (!apiKey) {
        return next(createValidationError('Grok API key is required. Please add it in Settings or provide it in the request.'));
      }
    } else {
      apiKey = geminiApiKey || settings.gemini_api_key || '';
      if (!apiKey) {
        return next(createValidationError('Gemini API key is required. Please add it in Settings or provide it in the request.'));
      }
    }

    const userServer = db.getUserServer(userId);
    if (!userServer) {
      return next(createValidationError('No server selected. Please select a server first.'));
    }

    if (!userServer.library_id) {
      return next(createValidationError('No library selected. Please go to Settings and select a music library first.'));
    }

    // Initialize Plex service
    const plexService = new PlexService(userServer.server_url, user.plex_token);

    logger.info('AI playlist generation started', { userId, prompt, provider: selectedProvider });

    // Use selected AI to extract search queries from the prompt
    const searchQueries = selectedProvider === 'grok' 
      ? await getSearchQueriesFromGrok(prompt, apiKey)
      : await getSearchQueriesFromGemini(prompt, apiKey);
    logger.info('AI generated search queries', { userId, provider: selectedProvider, queries: searchQueries, queryCount: searchQueries.length });

    // Search for tracks matching the queries
    const allTracks: any[] = [];
    for (const query of searchQueries.slice(0, 10)) { // Limit to 10 queries
      try {
        logger.info('Searching for query', { query, libraryId: userServer.library_id });
        const tracks = await plexService.searchTrack(query, userServer.library_id);
        logger.info('Search results', { query, trackCount: tracks.length });
        allTracks.push(...tracks.slice(0, 5)); // Take top 5 from each search
      } catch (error) {
        logger.warn('Failed to search for query', { query, error });
      }
    }

    logger.info('Total tracks found', { totalTracks: allTracks.length });

    // Remove duplicates
    const uniqueTracks = Array.from(
      new Map(allTracks.map(t => [t.ratingKey, t])).values()
    );

    // Shuffle and limit to requested track count
    const shuffled = uniqueTracks.sort(() => Math.random() - 0.5).slice(0, validTrackCount);

    // Generate playlist name from prompt using selected AI
    const playlistName = selectedProvider === 'grok'
      ? await generatePlaylistNameWithGrok(prompt, apiKey)
      : await generatePlaylistNameWithGemini(prompt, apiKey);

    // Format as matched tracks
    const matched = shuffled.map(track => ({
      title: track.title,
      artist: track.grandparentTitle || track.artist || 'Unknown Artist',
      album: track.parentTitle || track.album,
      plexRatingKey: track.ratingKey,
      matchScore: 1.0,
    }));

    logger.info('AI playlist generated', { 
      userId, 
      trackCount: matched.length,
      playlistName 
    });

    res.json({
      matched,
      unmatched: [],
      playlistName,
    });
  } catch (error: any) {
    logger.error('Failed to generate AI playlist', { 
      error: error.message,
      stack: error.stack,
      userId: req.session.userId 
    });
    
    // Check if it's an AI API error
    if (error.response?.status === 401 || error.response?.status === 403) {
      return next(createValidationError('Invalid API key. Please check your API key and try again.'));
    }
    
    next(createInternalError('Failed to generate playlist: ' + error.message));
  }
});

/**
 * POST /api/import/ai/test
 * Test the AI API key (Gemini or Grok)
 */
router.post('/ai/test', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { geminiApiKey, grokApiKey, aiProvider } = req.body;

    // Get settings
    const settings = db.getUserSettings(userId);
    const selectedProvider = aiProvider || settings.ai_provider || 'gemini';
    
    // Get appropriate API key
    let apiKey: string;
    if (selectedProvider === 'grok') {
      apiKey = grokApiKey || settings.grok_api_key || '';
      if (!apiKey) {
        return next(createValidationError('Grok API key is required'));
      }
    } else {
      apiKey = geminiApiKey || settings.gemini_api_key || '';
      if (!apiKey) {
        return next(createValidationError('Gemini API key is required'));
      }
    }

    logger.info('Testing AI API key', { userId, provider: selectedProvider });

    let testResponse;
    let response;
    
    if (selectedProvider === 'grok') {
      // Test Grok API
      testResponse = await axios.post(
        `${GROK_API_BASE}/chat/completions`,
        {
          model: GROK_MODEL,
          messages: [{
            role: 'user',
            content: 'Say "OK" if you can read this.'
          }],
          max_tokens: 10
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        }
      );
      response = testResponse.data.choices?.[0]?.message?.content || '';
    } else {
      // Test Gemini API
      testResponse = await axios.post(
        `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [{
              text: 'Say "OK" if you can read this.'
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      response = testResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    
    logger.info('AI API test successful', { userId, provider: selectedProvider, response });

    res.json({
      success: true,
      message: `${selectedProvider === 'grok' ? 'Grok' : 'Gemini'} API key is valid and working!`,
      testResponse: response
    });
  } catch (error: any) {
    logger.error('AI API test failed', { 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      userId: req.session.userId 
    });
    
    if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
      return res.json({
        success: false,
        message: 'Invalid API key. Please check your API key.'
      });
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.json({
        success: false,
        message: 'Connection timeout. Please check your internet connection.'
      });
    }
    
    res.json({
      success: false,
      message: 'Failed to connect to AI API: ' + error.message
    });
  }
});

/**
 * Use Gemini AI to extract search queries from a user prompt
 */
async function getSearchQueriesFromGemini(prompt: string, apiKey: string): Promise<string[]> {
  try {
    const response = await axios.post(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: `You are a music expert. Given a user's description of a playlist they want to create, extract 5-10 specific search queries (artist names, song titles, genres, moods) that would help find matching tracks in a music library. Return ONLY a JSON array of strings, nothing else. Example: ["rock", "The Beatles", "upbeat", "80s pop", "dance music"]\n\nUser request: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Parse the JSON response
    try {
      const queries = JSON.parse(content);
      if (Array.isArray(queries) && queries.length > 0) {
        return queries.filter(q => typeof q === 'string' && q.length > 0);
      }
    } catch (parseError) {
      logger.warn('Failed to parse Gemini response as JSON, falling back to keyword extraction', { content });
    }

    // Fallback to simple keyword extraction
    return extractKeywords(prompt);
  } catch (error: any) {
    logger.error('Gemini API error', { 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data 
    });
    
    // If Gemini fails, fall back to keyword extraction
    if (error.response?.status === 400 || error.response?.status === 403) {
      throw error; // Re-throw auth errors
    }
    
    return extractKeywords(prompt);
  }
}

/**
 * Use Gemini AI to generate a playlist name from a prompt
 */
async function generatePlaylistNameWithGemini(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.post(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: `You are a creative playlist naming expert. Given a user's description of a playlist, create a short, catchy playlist name (2-6 words). Return ONLY the playlist name, nothing else. No quotes, no explanation.\n\nUser request: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 50
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const name = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    
    if (name.length > 0 && name.length < 100) {
      // Remove quotes if present
      return name.replace(/^["']|["']$/g, '');
    }

    // Fallback
    return generatePlaylistName(prompt);
  } catch (error) {
    logger.warn('Failed to generate name with Gemini, using fallback', { error });
    return generatePlaylistName(prompt);
  }
}

/**
 * Extract keywords from a prompt (fallback method)
 */
function extractKeywords(prompt: string): string[] {
  // Remove common words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'create', 'make', 'playlist', 'songs', 'tracks', 'music', 'i', 'want',
    'like', 'that', 'this', 'some', 'any', 'all', 'would', 'could', 'should'
  ]);

  // Extract words
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Return unique keywords
  return Array.from(new Set(words));
}

/**
 * Generate a playlist name from a prompt (fallback method)
 */
function generatePlaylistName(prompt: string): string {
  // Try to extract a meaningful name
  const cleaned = prompt
    .replace(/^(create|make|generate|build)\s+(a|an)?\s+(playlist\s+(of|with|for)?)?/i, '')
    .trim();

  if (cleaned.length > 0 && cleaned.length < 100) {
    // Capitalize first letter
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Fallback to generic name
  return 'AI Generated Playlist';
}

export default router;


/**
 * Use Grok AI to extract search queries from a user prompt
 */
async function getSearchQueriesFromGrok(prompt: string, apiKey: string): Promise<string[]> {
  try {
    const response = await axios.post(
      `${GROK_API_BASE}/chat/completions`,
      {
        model: GROK_MODEL,
        messages: [{
          role: 'user',
          content: `You are a music expert. Given a user's description of a playlist they want to create, extract 5-10 specific search queries (artist names, song titles, genres, moods) that would help find matching tracks in a music library. Return ONLY a JSON array of strings, nothing else. Example: ["rock", "The Beatles", "upbeat", "80s pop", "dance music"]\n\nUser request: ${prompt}`
        }],
        temperature: 0.7,
        max_tokens: 200
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const content = response.data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON response
    try {
      const queries = JSON.parse(content);
      if (Array.isArray(queries) && queries.length > 0) {
        return queries.filter(q => typeof q === 'string' && q.length > 0);
      }
    } catch (parseError) {
      logger.warn('Failed to parse Grok response as JSON, falling back to keyword extraction', { content });
    }

    // Fallback to simple keyword extraction
    return extractKeywords(prompt);
  } catch (error: any) {
    logger.error('Grok API error', { 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data 
    });
    
    // If Grok fails, fall back to keyword extraction
    if (error.response?.status === 400 || error.response?.status === 403) {
      throw error; // Re-throw auth errors
    }
    
    return extractKeywords(prompt);
  }
}

/**
 * Use Grok AI to generate a playlist name from a prompt
 */
async function generatePlaylistNameWithGrok(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.post(
      `${GROK_API_BASE}/chat/completions`,
      {
        model: GROK_MODEL,
        messages: [{
          role: 'user',
          content: `You are a creative playlist naming expert. Given a user's description of a playlist, create a short, catchy playlist name (2-6 words). Return ONLY the playlist name, nothing else. No quotes, no explanation.\n\nUser request: ${prompt}`
        }],
        temperature: 0.8,
        max_tokens: 50
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const name = response.data.choices?.[0]?.message?.content?.trim() || '';
    
    if (name.length > 0 && name.length < 100) {
      // Remove quotes if present
      return name.replace(/^["']|["']$/g, '');
    }

    // Fallback
    return generatePlaylistName(prompt);
  } catch (error) {
    logger.warn('Failed to generate name with Grok, using fallback', { error });
    return generatePlaylistName(prompt);
  }
}
