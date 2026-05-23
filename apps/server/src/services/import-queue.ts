/**
 * Import Queue Service
 * 
 * Manages a queue of import operations to prevent concurrent imports
 * and allow users to continue interacting with the UI while imports run.
 * 
 * Queue is persisted to database to survive server restarts.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import Database from 'better-sqlite3';

export interface ImportJob {
  id: string;
  userId: number;
  source: string;
  url: string;
  playlistName?: string;
  sessionId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  position?: number;
  result?: any; // Store import result for completed imports
  progress?: {
    current: number;
    total: number;
    currentTrackName?: string;
    phase?: string;
  };
}

export interface ImportJobHandler {
  (job: ImportJob): Promise<any>; // Return result
}

export class ImportQueue extends EventEmitter {
  private db: Database.Database | null = null;
  private processing: ImportJob | null = null;
  private handler: ImportJobHandler | null = null;
  private isProcessing = false;

  constructor() {
    super();
  }

  /**
   * Initialize with database connection
   */
  initialize(db: Database.Database): void {
    this.db = db;
    
    // Load any processing or queued jobs from database on startup
    this.loadFromDatabase();
  }

  /**
   * Load jobs from database on startup
   */
  private loadFromDatabase(): void {
    if (!this.db) return;

    try {
      // Get any jobs that were processing or queued when server stopped
      const jobs = this.db.prepare(`
        SELECT * FROM import_queue 
        WHERE status IN ('queued', 'processing')
        ORDER BY created_at ASC
      `).all() as any[];

      if (jobs.length > 0) {
        logger.info(`Loaded ${jobs.length} pending import jobs from database`);
        
        // Reset processing jobs to queued (they were interrupted)
        this.db.prepare(`
          UPDATE import_queue 
          SET status = 'queued' 
          WHERE status = 'processing'
        `).run();

        // Start processing
        if (!this.isProcessing) {
          this.processNext();
        }
      }
    } catch (error: any) {
      logger.error('Failed to load import queue from database', { error: error.message });
    }
  }

  /**
   * Set the handler function that processes import jobs
   */
  setHandler(handler: ImportJobHandler): void {
    this.handler = handler;
  }

  /**
   * Add a job to the queue
   */
  enqueue(job: Omit<ImportJob, 'status' | 'queuedAt' | 'position'>): ImportJob {
    if (!this.db) {
      throw new Error('ImportQueue not initialized with database');
    }

    const queuedJob: ImportJob = {
      ...job,
      status: 'queued',
      queuedAt: Date.now(),
    };

    // Save to database
    try {
      this.db.prepare(`
        INSERT INTO import_queue (
          session_id, user_id, source, url, playlist_name, 
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        job.sessionId,
        job.userId,
        job.source,
        job.url,
        job.playlistName || null,
        'queued',
        queuedJob.queuedAt
      );
    } catch (error: any) {
      logger.error('Failed to save import job to database', { error: error.message });
      throw error;
    }
    
    logger.info('Import job queued', {
      jobId: job.id,
      userId: job.userId,
      source: job.source,
    });

    this.emit('job-queued', queuedJob);

    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processNext();
    }

    return queuedJob;
  }

  /**
   * Get the current queue status for a user
   */
  getUserQueueStatus(userId: number): {
    processing: ImportJob | null;
    queued: ImportJob[];
    position: number | null;
  } {
    if (!this.db) {
      return { processing: null, queued: [], position: null };
    }

    const queued = this.db.prepare(`
      SELECT * FROM import_queue 
      WHERE user_id = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(userId) as any[];

    const queuedJobs = queued.map((row, index) => this.rowToJob(row, index + 1));

    const userProcessing = this.processing?.userId === userId ? this.processing : null;

    // If user has a processing job, get its latest data from database
    if (userProcessing) {
      const row = this.db.prepare(`
        SELECT * FROM import_queue WHERE session_id = ?
      `).get(userProcessing.sessionId) as any;
      
      if (row) {
        // Update processing job with latest database data
        userProcessing.playlistName = row.playlist_name || userProcessing.playlistName;
        // Add progress data if available
        if (row.progress !== null && row.total !== null) {
          (userProcessing as any).progress = {
            current: row.progress,
            total: row.total,
          };
        }
      }
    }

    // Find user's position in queue (0 if processing, otherwise queue position)
    let position: number | null = null;
    if (userProcessing) {
      position = 0;
    } else if (queuedJobs.length > 0) {
      position = queuedJobs[0].position!;
    }

    return {
      processing: userProcessing,
      queued: queuedJobs,
      position,
    };
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: number): ImportJob[] {
    if (!this.db) return [];

    const jobs: ImportJob[] = [];
    
    if (this.processing?.userId === userId) {
      jobs.push(this.processing);
    }
    
    const queued = this.db.prepare(`
      SELECT * FROM import_queue 
      WHERE user_id = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(userId) as any[];

    jobs.push(...queued.map(row => this.rowToJob(row)));
    
    return jobs;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string, userId: number): boolean {
    if (!this.db) return false;

    // Check if it's the currently processing job
    if (this.processing?.id === jobId && this.processing.userId === userId) {
      this.processing.status = 'cancelled';
      
      // Update in database
      this.db.prepare(`
        UPDATE import_queue 
        SET status = 'cancelled', completed_at = ?
        WHERE session_id = ?
      `).run(Date.now(), jobId);
      
      this.emit('job-cancelled', this.processing);
      logger.info('Cancelled processing job', { jobId, userId });
      return true;
    }

    // Check if it's in the queue
    const result = this.db.prepare(`
      UPDATE import_queue 
      SET status = 'cancelled', completed_at = ?
      WHERE session_id = ? AND user_id = ? AND status = 'queued'
    `).run(Date.now(), jobId, userId);

    if (result.changes > 0) {
      const job = this.getJob(jobId);
      if (job) {
        this.emit('job-cancelled', job);
      }
      logger.info('Cancelled queued job', { jobId, userId });
      return true;
    }

    return false;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ImportJob | null {
    if (!this.db) return null;

    if (this.processing?.id === jobId) {
      return this.processing;
    }

    const row = this.db.prepare(`
      SELECT * FROM import_queue WHERE session_id = ?
    `).get(jobId) as any;

    return row ? this.rowToJob(row) : null;
  }

  /**
   * Process the next job in the queue
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing || !this.db) {
      return;
    }

    if (!this.handler) {
      logger.error('No handler set for import queue');
      return;
    }

    // Get next queued job
    const row = this.db.prepare(`
      SELECT * FROM import_queue 
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as any;

    if (!row) {
      return; // No jobs in queue
    }

    this.isProcessing = true;
    const job = this.rowToJob(row);
    this.processing = job;

    job.status = 'processing';
    job.startedAt = Date.now();

    // Update in database
    this.db.prepare(`
      UPDATE import_queue 
      SET status = 'processing', started_at = ?
      WHERE session_id = ?
    `).run(job.startedAt, job.sessionId);

    logger.info('Processing import job', {
      jobId: job.id,
      userId: job.userId,
      source: job.source,
    });

    this.emit('job-started', job);

    try {
      const result = await this.handler(job);
      
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
      
      // Update in database
      this.db.prepare(`
        UPDATE import_queue 
        SET status = 'completed', completed_at = ?, result = ?
        WHERE session_id = ?
      `).run(job.completedAt, JSON.stringify(result), job.sessionId);
      
      logger.info('Import job completed', {
        jobId: job.id,
        userId: job.userId,
        duration: job.completedAt - job.startedAt!,
      });

      this.emit('job-completed', job);
    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = error.message;
      
      // Update in database
      this.db.prepare(`
        UPDATE import_queue 
        SET status = 'failed', completed_at = ?, error_message = ?
        WHERE session_id = ?
      `).run(job.completedAt, error.message, job.sessionId);
      
      logger.error('Import job failed', {
        jobId: job.id,
        userId: job.userId,
        error: error.message,
      });

      this.emit('job-failed', job);
    } finally {
      this.processing = null;
      this.isProcessing = false;

      // Process next job if any
      const hasMore = this.db.prepare(`
        SELECT COUNT(*) as count FROM import_queue WHERE status = 'queued'
      `).get() as any;

      if (hasMore.count > 0) {
        // Small delay before processing next
        setTimeout(() => this.processNext(), 100);
      }
    }
  }

  /**
   * Get completed imports for a user
   */
  getCompletedImports(userId: number): ImportJob[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM import_queue 
      WHERE user_id = ? AND status IN ('completed', 'failed', 'cancelled')
      ORDER BY completed_at DESC
      LIMIT 50
    `).all(userId) as any[];

    return rows.map(row => this.rowToJob(row));
  }

  /**
   * Remove a completed import
   */
  removeCompletedImport(userId: number, jobId: string): boolean {
    if (!this.db) return false;

    const result = this.db.prepare(`
      DELETE FROM import_queue 
      WHERE session_id = ? AND user_id = ? AND status IN ('completed', 'failed', 'cancelled')
    `).run(jobId, userId);

    if (result.changes > 0) {
      logger.info('Removed completed import', { userId, jobId });
      return true;
    }

    return false;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    processing: boolean;
    totalProcessed: number;
  } {
    if (!this.db) {
      return { queueLength: 0, processing: false, totalProcessed: 0 };
    }

    const queueCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM import_queue WHERE status = 'queued'
    `).get() as any;

    const processedCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM import_queue WHERE status IN ('completed', 'failed')
    `).get() as any;

    return {
      queueLength: queueCount.count,
      processing: this.isProcessing,
      totalProcessed: processedCount.count,
    };
  }

  /**
   * Clear all jobs for a user (admin function)
   */
  clearUserJobs(userId: number): number {
    if (!this.db) return 0;

    const result = this.db.prepare(`
      DELETE FROM import_queue 
      WHERE user_id = ? AND status = 'queued'
    `).run(userId);
    
    logger.info('Cleared user jobs', { userId, cleared: result.changes });
    
    return result.changes;
  }

  /**
   * Convert database row to ImportJob
   */
  private rowToJob(row: any, position?: number): ImportJob {
    return {
      id: row.session_id,
      userId: row.user_id,
      source: row.source,
      url: row.url,
      playlistName: row.playlist_name,
      sessionId: row.session_id,
      status: row.status,
      queuedAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error_message,
      result: row.result ? JSON.parse(row.result) : undefined,
      position,
    };
  }
}

// Singleton instance
export const importQueue = new ImportQueue();
