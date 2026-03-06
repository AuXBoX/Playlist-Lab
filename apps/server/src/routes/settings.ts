import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/settings
 * Get user settings
 */
router.get('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    
    const dbSettings = db.getUserSettings(userId);
    
    // Transform snake_case to camelCase for frontend
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key,
      grokApiKey: dbSettings.grok_api_key,
      aiProvider: dbSettings.ai_provider || 'gemini'
    };
    
    logger.info('Returning user settings', { 
      userId, 
      hasGeminiApiKey: !!settings.geminiApiKey,
      hasGrokApiKey: !!settings.grokApiKey,
      aiProvider: settings.aiProvider
    });
    
    res.json({ settings });
  } catch (error) {
    logger.error('Failed to get settings', { error, userId: req.session.userId });
    next(createInternalError('Failed to retrieve user settings'));
  }
});

/**
 * PUT /api/settings
 * Update user settings
 */
router.put('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { country, matchingSettings, mixSettings } = req.body;

    // Build update object
    const updates: any = {};
    if (country !== undefined) updates.country = country;
    if (matchingSettings !== undefined) updates.matching_settings = matchingSettings;
    if (mixSettings !== undefined) updates.mix_settings = mixSettings;

    // Save settings
    db.saveUserSettings(userId, updates);
    
    // Retrieve updated settings and transform to camelCase
    const dbSettings = db.getUserSettings(userId);
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key
    };

    logger.info('Settings updated', { userId });

    res.json({ settings });
  } catch (error) {
    logger.error('Failed to update settings', { error, userId: req.session.userId });
    next(createInternalError('Failed to update user settings'));
  }
});

/**
 * PUT /api/settings/matching
 * Update matching settings only
 */
router.put('/matching', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { matchingSettings } = req.body;

    if (!matchingSettings) {
      return next(createValidationError('matchingSettings is required'));
    }

    // Save matching settings
    db.saveUserSettings(userId, { matching_settings: matchingSettings });
    
    // Retrieve updated settings and transform to camelCase
    const dbSettings = db.getUserSettings(userId);
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key
    };

    logger.info('Matching settings updated', { userId });

    res.json({ settings });
  } catch (error) {
    logger.error('Failed to update matching settings', { error, userId: req.session.userId });
    next(createInternalError('Failed to update matching settings'));
  }
});

/**
 * PUT /api/settings/mixes
 * Update mix generation settings only
 */
router.put('/mixes', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { mixSettings } = req.body;

    if (!mixSettings) {
      return next(createValidationError('mixSettings is required'));
    }

    // Save mix settings
    db.saveUserSettings(userId, { mix_settings: mixSettings });
    
    // Retrieve updated settings and transform to camelCase
    const dbSettings = db.getUserSettings(userId);
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key
    };

    logger.info('Mix settings updated', { userId });

    res.json({ settings });
  } catch (error) {
    logger.error('Failed to update mix settings', { error, userId: req.session.userId });
    next(createInternalError('Failed to update mix settings'));
  }
});

/**
 * PUT /api/settings/gemini-api-key
 * Update Gemini API key
 */
router.put('/gemini-api-key', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { geminiApiKey } = req.body;

    logger.info('Saving Gemini API key', { 
      userId, 
      hasKey: !!geminiApiKey,
      keyLength: geminiApiKey?.length || 0
    });

    // Allow null to clear the key
    if (geminiApiKey !== null && typeof geminiApiKey !== 'string') {
      return next(createValidationError('geminiApiKey must be a string or null'));
    }

    // Save Gemini API key
    db.saveUserSettings(userId, { gemini_api_key: geminiApiKey });
    
    // Retrieve updated settings and transform to camelCase
    const dbSettings = db.getUserSettings(userId);
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key,
      grokApiKey: dbSettings.grok_api_key,
      aiProvider: dbSettings.ai_provider || 'gemini'
    };

    logger.info('Gemini API key saved successfully', { 
      userId, 
      hasKey: !!settings.geminiApiKey
    });

    res.json({ settings });
  } catch (error) {
    logger.error('Failed to update Gemini API key', { error, userId: req.session.userId });
    next(createInternalError('Failed to update Gemini API key'));
  }
});

/**
 * PUT /api/settings/grok-api-key
 * Update Grok API key
 */
router.put('/grok-api-key', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { grokApiKey } = req.body;

    logger.info('Saving Grok API key', { 
      userId, 
      hasKey: !!grokApiKey,
      keyLength: grokApiKey?.length || 0
    });

    // Allow null to clear the key
    if (grokApiKey !== null && typeof grokApiKey !== 'string') {
      return next(createValidationError('grokApiKey must be a string or null'));
    }

    // Save Grok API key
    db.saveUserSettings(userId, { grok_api_key: grokApiKey });
    
    // Retrieve updated settings and transform to camelCase
    const dbSettings = db.getUserSettings(userId);
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key,
      grokApiKey: dbSettings.grok_api_key,
      aiProvider: dbSettings.ai_provider || 'gemini'
    };

    logger.info('Grok API key saved successfully', { 
      userId, 
      hasKey: !!settings.grokApiKey
    });

    res.json({ settings });
  } catch (error) {
    logger.error('Failed to update Grok API key', { error, userId: req.session.userId });
    next(createInternalError('Failed to update Grok API key'));
  }
});

/**
 * PUT /api/settings/ai-provider
 * Update AI provider selection
 */
router.put('/ai-provider', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const { aiProvider } = req.body;

    if (!aiProvider || !['gemini', 'grok'].includes(aiProvider)) {
      return next(createValidationError('aiProvider must be either "gemini" or "grok"'));
    }

    logger.info('Saving AI provider', { userId, aiProvider });

    // Save AI provider
    db.saveUserSettings(userId, { ai_provider: aiProvider });
    
    // Retrieve updated settings and transform to camelCase
    const dbSettings = db.getUserSettings(userId);
    const settings = {
      country: dbSettings.country,
      matchingSettings: dbSettings.matching_settings,
      mixSettings: dbSettings.mix_settings,
      geminiApiKey: dbSettings.gemini_api_key,
      grokApiKey: dbSettings.grok_api_key,
      aiProvider: dbSettings.ai_provider || 'gemini'
    };

    logger.info('AI provider saved successfully', { userId, aiProvider: settings.aiProvider });

    res.json({ settings });
  } catch (error) {
    logger.error('Failed to update AI provider', { error, userId: req.session.userId });
    next(createInternalError('Failed to update AI provider'));
  }
});

export default router;

