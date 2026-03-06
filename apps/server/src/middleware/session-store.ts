/**
 * SQLite Session Store
 * 
 * Custom session store for express-session using SQLite database.
 * Stores sessions in the sessions table with automatic cleanup of expired sessions.
 */

import { Store } from 'express-session';
import { getDatabase } from '../database';

export class SQLiteStore extends Store {
  private db: ReturnType<typeof getDatabase>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(db: ReturnType<typeof getDatabase>, cleanupIntervalMs: number = 3600000) {
    super();
    this.db = db;

    // Start cleanup interval (default: every hour)
    this.startCleanup(cleanupIntervalMs);
  }

  /**
   * Get session by ID
   */
  get(sid: string, callback: (err: any, session?: any) => void): void {
    try {
      const stmt = this.db.prepare('SELECT sess, expired FROM sessions WHERE sid = ?');
      const row = stmt.get(sid) as { sess: string; expired: number } | undefined;

      if (!row) {
        console.log(`[Session Store] Session not found for sid: ${sid.substring(0, 10)}...`);
        return callback(null, null);
      }

      // Check if expired
      const now = Math.floor(Date.now() / 1000);
      if (row.expired < now) {
        // Session expired, delete it
        console.log(`[Session Store] Session expired for sid: ${sid.substring(0, 10)}...`);
        this.destroy(sid, () => {});
        return callback(null, null);
      }

      const session = JSON.parse(row.sess);
      console.log(`[Session Store] Session loaded successfully for sid: ${sid.substring(0, 10)}..., userId: ${session.userId || 'none'}`);
      callback(null, session);
    } catch (error) {
      console.error('[Session Store] Error loading session:', error);
      callback(error);
    }
  }

  /**
   * Set/update session
   */
  set(sid: string, session: any, callback?: (err?: any) => void): void {
    try {
      const maxAge = session.cookie?.originalMaxAge ?? 2592000000; // 30 days default
      const expired = Math.floor((Date.now() + maxAge) / 1000);
      const sess = JSON.stringify(session);

      const stmt = this.db.prepare(`
        INSERT INTO sessions (sid, sess, expired)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          sess = excluded.sess,
          expired = excluded.expired
      `);

      stmt.run(sid, sess, expired);

      // Verify the session was written
      const verify = this.db.prepare('SELECT sess FROM sessions WHERE sid = ?');
      const row = verify.get(sid) as { sess: string } | undefined;
      
      if (!row) {
        console.error(`[Session Store] Failed to verify session write for sid: ${sid}`);
        if (callback) callback(new Error('Session write verification failed'));
        return;
      }

      console.log(`[Session Store] Session saved successfully for sid: ${sid.substring(0, 10)}...`);
      if (callback) callback();
    } catch (error) {
      console.error('[Session Store] Error saving session:', error);
      if (callback) callback(error);
    }
  }

  /**
   * Destroy session
   */
  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
      stmt.run(sid);

      if (callback) callback();
    } catch (error) {
      if (callback) callback(error);
    }
  }

  /**
   * Touch session (update expiration)
   */
  touch(sid: string, session: any, callback?: (err?: any) => void): void {
    try {
      const maxAge = session.cookie?.originalMaxAge ?? 2592000000; // 30 days default
      const expired = Math.floor((Date.now() + maxAge) / 1000);

      const stmt = this.db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?');
      stmt.run(expired, sid);

      if (callback) callback();
    } catch (error) {
      if (callback) callback(error);
    }
  }

  /**
   * Get all sessions
   */
  all(callback: (err: any, obj?: any) => void): void {
    try {
      const stmt = this.db.prepare('SELECT sess FROM sessions WHERE expired >= ?');
      const now = Math.floor(Date.now() / 1000);
      const rows = stmt.all(now) as Array<{ sess: string }>;

      const sessions = rows.map(row => JSON.parse(row.sess));
      callback(null, sessions);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Get session count
   */
  length(callback: (err: any, length?: number) => void): void {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expired >= ?');
      const now = Math.floor(Date.now() / 1000);
      const result = stmt.get(now) as { count: number };

      callback(null, result.count);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Clear all sessions
   */
  clear(callback?: (err?: any) => void): void {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions');
      stmt.run();

      if (callback) callback();
    } catch (error) {
      if (callback) callback(error);
    }
  }

  /**
   * Start automatic cleanup of expired sessions
   */
  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const stmt = this.db.prepare('DELETE FROM sessions WHERE expired < ?');
        const result = stmt.run(now);

        if (result.changes > 0) {
          console.log(`Cleaned up ${result.changes} expired sessions`);
        }
      } catch (error) {
        console.error('Error cleaning up expired sessions:', error);
      }
    }, intervalMs);

    // Don't keep process alive just for cleanup
    this.cleanupInterval.unref();
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const sessionStore = new SQLiteStore(getDatabase());

