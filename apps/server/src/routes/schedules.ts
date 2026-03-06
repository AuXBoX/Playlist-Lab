/**
 * Schedule Routes
 * 
 * API endpoints for managing schedules:
 * - GET /api/schedules - Get user's schedules
 * - POST /api/schedules - Create schedule
 * - PUT /api/schedules/:id - Update schedule
 * - DELETE /api/schedules/:id - Delete schedule
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { ScheduleInput } from '../database/types';

const router = Router();

// All schedule routes require authentication
router.use(requireAuth);

/**
 * Transform database schedule to API format (snake_case to camelCase)
 */
function transformSchedule(dbSchedule: any): any {
  return {
    id: dbSchedule.id,
    userId: dbSchedule.user_id,
    playlistId: dbSchedule.playlist_id,
    scheduleType: dbSchedule.schedule_type,
    frequency: dbSchedule.frequency,
    startDate: dbSchedule.start_date,
    lastRun: dbSchedule.last_run,
    config: dbSchedule.config ? (typeof dbSchedule.config === 'string' ? JSON.parse(dbSchedule.config) : dbSchedule.config) : undefined
  };
}

/**
 * GET /api/schedules
 * Get all schedules for the authenticated user
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;

    logger.info('Getting user schedules', { userId });

    const dbSchedules = db.getUserSchedules(userId);
    const schedules = dbSchedules.map(transformSchedule);

    res.json({
      success: true,
      schedules
    });
  } catch (error: any) {
    logger.error('Failed to get schedules', { error: error.message });
    next(createInternalError(error.message || 'Failed to get schedules'));
  }
});

/**
 * POST /api/schedules
 * Create a new schedule
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    
    // Log what we received
    logger.info('Received schedule creation request', { 
      body: req.body,
      bodyKeys: Object.keys(req.body),
      bodyType: typeof req.body,
      bodyStringified: JSON.stringify(req.body)
    });
    
    // Support both camelCase (from frontend) and snake_case
    const playlist_id = req.body.playlist_id || req.body.playlistId;
    const schedule_type = req.body.schedule_type || req.body.scheduleType;
    const frequency = req.body.frequency;
    const start_date = req.body.start_date || req.body.startDate;
    const config = req.body.config;
    
    logger.info('Extracted fields', { 
      playlist_id, 
      schedule_type, 
      frequency, 
      start_date,
      hasPlaylistId: !!playlist_id,
      hasScheduleType: !!schedule_type,
      hasFrequency: !!frequency,
      hasStartDate: !!start_date
    });

    // Validate required fields
    if (!schedule_type || !frequency || !start_date) {
      return next(createValidationError('Missing required fields: schedule_type, frequency, start_date'));
    }

    // Validate schedule_type
    if (!['playlist_refresh', 'mix_generation'].includes(schedule_type)) {
      return next(createValidationError('Invalid schedule_type. Must be playlist_refresh or mix_generation'));
    }

    // Validate frequency
    if (!['daily', 'weekly', 'fortnightly', 'monthly'].includes(frequency)) {
      return next(createValidationError('Invalid frequency. Must be daily, weekly, fortnightly, or monthly'));
    }

    // Validate playlist_id for playlist_refresh schedules (unless it's a chart import)
    const isChartImport = config && (config.chartUrl || config.autoImport);
    logger.info('Chart import check', { 
      hasConfig: !!config,
      configKeys: config ? Object.keys(config) : [],
      chartUrl: config?.chartUrl,
      autoImport: config?.autoImport,
      isChartImport,
      scheduleType: schedule_type,
      hasPlaylistId: !!playlist_id
    });
    
    if (schedule_type === 'playlist_refresh' && !playlist_id && !isChartImport) {
      return next(createValidationError('playlist_id is required for playlist_refresh schedules'));
    }

    logger.info('Creating schedule', { userId, schedule_type, frequency });

    const scheduleInput: ScheduleInput = {
      playlist_id,
      schedule_type,
      frequency,
      start_date,
      config  // Don't stringify here - the database method will do it
    };

    const dbSchedule = db.createSchedule(userId, scheduleInput);
    const schedule = transformSchedule(dbSchedule);

    logger.info('Schedule created', { scheduleId: schedule.id });

    res.status(201).json({
      success: true,
      schedule
    });
  } catch (error: any) {
    logger.error('Failed to create schedule', { error: error.message });
    next(createInternalError(error.message || 'Failed to create schedule'));
  }
});

/**
 * PUT /api/schedules/:id
 * Update an existing schedule
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const scheduleId = parseInt(req.params.id, 10);
    const { frequency, start_date, startDate, config } = req.body;

    console.log('Update schedule request:', {
      scheduleId,
      body: req.body,
      frequency,
      start_date,
      startDate,
      config
    });

    if (isNaN(scheduleId)) {
      return next(createValidationError('Invalid schedule ID'));
    }

    // Verify schedule exists and belongs to user
    const existingSchedule = db.getScheduleById(scheduleId);
    if (!existingSchedule) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
          statusCode: 404
        }
      });
    }

    if (existingSchedule.user_id !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this schedule',
          statusCode: 403
        }
      });
    }

    // Validate frequency if provided
    if (frequency && !['daily', 'weekly', 'fortnightly', 'monthly'].includes(frequency)) {
      return next(createValidationError('Invalid frequency. Must be daily, weekly, fortnightly, or monthly'));
    }

    logger.info('Updating schedule', { scheduleId, userId });

    const updates: any = {};
    if (frequency) updates.frequency = frequency;
    // Support both snake_case and camelCase
    const dateToUpdate = start_date || startDate;
    if (dateToUpdate) updates.start_date = dateToUpdate;
    // Don't stringify here - the database method will do it
    if (config !== undefined) updates.config = config;

    console.log('Updates to apply:', updates);

    db.updateSchedule(scheduleId, updates);

    const dbSchedule = db.getScheduleById(scheduleId);
    const updatedSchedule = dbSchedule ? transformSchedule(dbSchedule) : null;

    console.log('Updated schedule:', updatedSchedule);

    logger.info('Schedule updated', { scheduleId });

    res.json({
      success: true,
      schedule: updatedSchedule
    });
  } catch (error: any) {
    logger.error('Failed to update schedule', { error: error.message });
    next(createInternalError(error.message || 'Failed to update schedule'));
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const db = req.dbService!;
    const scheduleId = parseInt(req.params.id, 10);

    if (isNaN(scheduleId)) {
      return next(createValidationError('Invalid schedule ID'));
    }

    // Verify schedule exists and belongs to user
    const existingSchedule = db.getScheduleById(scheduleId);
    if (!existingSchedule) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
          statusCode: 404
        }
      });
    }

    if (existingSchedule.user_id !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this schedule',
          statusCode: 403
        }
      });
    }

    logger.info('Deleting schedule', { scheduleId, userId });

    db.deleteSchedule(scheduleId);

    logger.info('Schedule deleted', { scheduleId });

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete schedule', { error: error.message });
    next(createInternalError(error.message || 'Failed to delete schedule'));
  }
});

export default router;
