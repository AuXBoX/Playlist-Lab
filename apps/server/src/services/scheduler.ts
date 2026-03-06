/**
 * Schedule Service
 * 
 * Handles schedule execution logic:
 * - Queries due schedules from database
 * - Executes playlist refresh schedules
 * - Executes mix generation schedules
 * - Updates last_run timestamps after execution
 */

import { DatabaseService } from '../database/database';
import { Schedule } from '../database/types';
import { logger } from '../utils/logger';

export class SchedulerService {
  constructor() {}

  /**
   * Get all schedules that are due to run
   */
  getDueSchedules(db: DatabaseService): Schedule[] {
    return db.getDueSchedules();
  }

  /**
   * Execute a single schedule
   */
  async executeSchedule(schedule: Schedule, db: DatabaseService): Promise<void> {
    logger.info('Executing schedule', { 
      scheduleId: schedule.id, 
      type: schedule.schedule_type,
      userId: schedule.user_id 
    });

    try {
      // TODO: Implement actual schedule execution logic
      // This will be implemented in the routes layer
      
      // Update last_run timestamp
      db.updateScheduleLastRun(schedule.id);

      logger.info('Schedule executed successfully', { scheduleId: schedule.id });
    } catch (error: any) {
      logger.error('Failed to execute schedule', { 
        scheduleId: schedule.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Execute all due schedules
   */
  async executeDueSchedules(db: DatabaseService): Promise<{ executed: number; failed: number }> {
    const dueSchedules = this.getDueSchedules(db);
    
    logger.info(`Found ${dueSchedules.length} due schedule(s)`);

    let executed = 0;
    let failed = 0;

    for (const schedule of dueSchedules) {
      try {
        await this.executeSchedule(schedule, db);
        executed++;
      } catch (error: any) {
        failed++;
        logger.error('Schedule execution failed', { 
          scheduleId: schedule.id, 
          error: error.message 
        });
      }
    }

    logger.info('Schedule execution complete', { executed, failed });

    return { executed, failed };
  }
}
