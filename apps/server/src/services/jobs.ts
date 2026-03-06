/**
 * Background Jobs Service
 * 
 * Manages scheduled background jobs using node-cron:
 * - Daily scraper job (2:00 AM)
 * - Hourly schedule checker jobs
 * - Weekly cache cleanup job
 * - Graceful shutdown handling
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import { DatabaseService } from '../database/database';

export interface JobConfig {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled?: boolean;
}

export class JobScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private isShuttingDown = false;

  constructor(_db: DatabaseService) {
    // Database service may be used in future for job persistence
  }

  /**
   * Register a job with the scheduler
   */
  registerJob(config: JobConfig): void {
    if (config.enabled === false) {
      logger.info(`Job ${config.name} is disabled, skipping registration`);
      return;
    }

    if (this.jobs.has(config.name)) {
      logger.warn(`Job ${config.name} is already registered`);
      return;
    }

    try {
      const task = cron.schedule(config.schedule, async () => {
        if (this.isShuttingDown) {
          logger.info(`Skipping job ${config.name} - shutdown in progress`);
          return;
        }

        logger.info(`Starting job: ${config.name}`);
        const startTime = Date.now();

        try {
          await config.handler();
          const duration = Date.now() - startTime;
          logger.info(`Job ${config.name} completed successfully`, { duration });
        } catch (error: any) {
          logger.error(`Job ${config.name} failed`, { 
            error: error.message,
            stack: error.stack 
          });
          // Continue with next scheduled run despite error
        }
      }, {
        scheduled: false, // Don't start immediately
      });

      this.jobs.set(config.name, task);
      logger.info(`Registered job: ${config.name} with schedule: ${config.schedule}`);
    } catch (error: any) {
      logger.error(`Failed to register job ${config.name}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Start all registered jobs
   */
  start(): void {
    logger.info(`Starting ${this.jobs.size} job(s)`);
    
    for (const [name, task] of this.jobs.entries()) {
      task.start();
      logger.info(`Started job: ${name}`);
    }
  }

  /**
   * Stop all jobs gracefully
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    logger.info(`Stopping ${this.jobs.size} job(s)`);

    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      logger.info(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    logger.info('All jobs stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus(): Array<{ name: string; running: boolean }> {
    const status: Array<{ name: string; running: boolean }> = [];
    
    for (const [name, _task] of this.jobs.entries()) {
      status.push({
        name,
        running: !this.isShuttingDown,
      });
    }

    return status;
  }
}
