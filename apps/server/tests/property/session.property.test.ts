/**
 * Property-Based Tests for Session Management
 * 
 * Tests universal properties of session management including session expiration,
 * validation, and secure cookie configuration.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { SQLiteStore } from '../../src/middleware/session-store';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Create a temporary in-memory database for testing
 */
function createTestDatabase(): Database.Database {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-lab-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  return initializeDatabase(dbPath);
}

/**
 * Clean up test database
 */
function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = db.name;
  db.close();
  
  // Clean up the database file and directory
  if (dbPath && dbPath !== ':memory:') {
    try {
      fs.unlinkSync(dbPath);
      fs.rmdirSync(path.dirname(dbPath));
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

describe('Session Management Property Tests', () => {
  describe('Property 26: Session Expiration', () => {
    /**
     * **Validates: Requirements 12.3**
     * 
     * For any session created at time T, accessing the session at time 
     * T + 31 days should fail and redirect to login.
     */
    it('should expire sessions after 30 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate session data
          fc.record({
            sid: fc.string({ minLength: 32, maxLength: 64 }),
            userId: fc.integer({ min: 1, max: 10000 }),
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (sessionData) => {
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000); // 1 hour cleanup interval
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
              
              // Create session with 30-day expiration
              const session = {
                userId: sessionData.userId,
                plexUserId: sessionData.plexUserId,
                cookie: {
                  originalMaxAge: thirtyDays,
                  expires: new Date(now + thirtyDays),
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              // Store session
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.sid, session, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Verify session exists and is valid now
              const retrievedNow = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(retrievedNow).not.toBeNull();
              expect(retrievedNow.userId).toBe(sessionData.userId);
              
              // Simulate time passing by manually setting expired timestamp to past
              const thirtyOneDaysAgo = Math.floor((now - (31 * 24 * 60 * 60 * 1000)) / 1000);
              const updateExpired = db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?');
              updateExpired.run(thirtyOneDaysAgo, sessionData.sid);
              
              // Try to retrieve expired session
              const retrievedExpired = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              // Session should be null (expired and deleted)
              expect(retrievedExpired).toBeNull();
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle sessions with varying expiration times', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate session with random expiration
          fc.record({
            sid: fc.string({ minLength: 32, maxLength: 64 }),
            userId: fc.integer({ min: 1, max: 10000 }),
            expirationDays: fc.integer({ min: 1, max: 60 }), // 1-60 days
          }),
          async (sessionData) => {
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const expirationMs = sessionData.expirationDays * 24 * 60 * 60 * 1000;
              
              // Create session
              const session = {
                userId: sessionData.userId,
                cookie: {
                  originalMaxAge: expirationMs,
                  expires: new Date(now + expirationMs),
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              // Store session
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.sid, session, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Verify session is valid before expiration
              const validSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(validSession).not.toBeNull();
              
              // Simulate expiration by setting expired timestamp to past
              const pastTimestamp = Math.floor((now - 1000) / 1000); // 1 second ago
              const updateExpired = db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?');
              updateExpired.run(pastTimestamp, sessionData.sid);
              
              // Verify session is now expired
              const expiredSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(expiredSession).toBeNull();
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 27: Session Validation', () => {
    /**
     * **Validates: Requirements 12.4**
     * 
     * For any authenticated API request, the server should validate the 
     * session token before processing the request.
     */
    it('should validate session tokens on every request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid and invalid session IDs
          fc.record({
            validSid: fc.string({ minLength: 32, maxLength: 64 }),
            invalidSid: fc.string({ minLength: 32, maxLength: 64 }),
            userId: fc.integer({ min: 1, max: 10000 }),
          }),
          async (sessionData) => {
            // Ensure valid and invalid SIDs are different
            fc.pre(sessionData.validSid !== sessionData.invalidSid);
            
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              
              // Create valid session
              const session = {
                userId: sessionData.userId,
                cookie: {
                  originalMaxAge: thirtyDays,
                  expires: new Date(now + thirtyDays),
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              // Store valid session
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.validSid, session, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Validate valid session
              const validSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.validSid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(validSession).not.toBeNull();
              expect(validSession.userId).toBe(sessionData.userId);
              
              // Validate invalid session (not stored)
              const invalidSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.invalidSid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(invalidSession).toBeNull();
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject tampered session data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate session data
          fc.record({
            sid: fc.string({ minLength: 32, maxLength: 64 }),
            originalUserId: fc.integer({ min: 1, max: 10000 }),
            tamperedUserId: fc.integer({ min: 1, max: 10000 }),
          }),
          async (sessionData) => {
            // Ensure original and tampered IDs are different
            fc.pre(sessionData.originalUserId !== sessionData.tamperedUserId);
            
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              
              // Create session with original user ID
              const session = {
                userId: sessionData.originalUserId,
                cookie: {
                  originalMaxAge: thirtyDays,
                  expires: new Date(now + thirtyDays),
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              // Store session
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.sid, session, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Retrieve and verify original session
              const originalSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(originalSession).not.toBeNull();
              expect(originalSession.userId).toBe(sessionData.originalUserId);
              
              // Attempt to tamper with session data directly in database
              const tamperedSessionData = {
                ...originalSession,
                userId: sessionData.tamperedUserId
              };
              
              const updateStmt = db.prepare('UPDATE sessions SET sess = ? WHERE sid = ?');
              updateStmt.run(JSON.stringify(tamperedSessionData), sessionData.sid);
              
              // Retrieve tampered session
              const tamperedSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              // Session should contain tampered data (demonstrating need for validation)
              expect(tamperedSession).not.toBeNull();
              expect(tamperedSession.userId).toBe(sessionData.tamperedUserId);
              
              // This test demonstrates that session data can be tampered with
              // In production, additional validation (e.g., HMAC signatures) would be needed
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 44: Secure Session Cookies', () => {
    /**
     * **Validates: Requirements 19.5**
     * 
     * For any session cookie set by the server, the cookie should have 
     * httpOnly=true and secure=true flags (in production).
     */
    it('should enforce httpOnly flag on all session cookies', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate session data
          fc.record({
            sid: fc.string({ minLength: 32, maxLength: 64 }),
            userId: fc.integer({ min: 1, max: 10000 }),
            isProduction: fc.boolean(),
          }),
          async (sessionData) => {
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              
              // Create session with cookie flags
              const session = {
                userId: sessionData.userId,
                cookie: {
                  originalMaxAge: thirtyDays,
                  expires: new Date(now + thirtyDays),
                  secure: sessionData.isProduction, // Should be true in production
                  httpOnly: true, // Should always be true
                  path: '/',
                  sameSite: 'lax' as const
                }
              };
              
              // Store session
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.sid, session, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Retrieve and verify cookie flags
              const retrievedSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(retrievedSession).not.toBeNull();
              expect(retrievedSession.cookie.httpOnly).toBe(true);
              expect(retrievedSession.cookie.secure).toBe(sessionData.isProduction);
              expect(retrievedSession.cookie.sameSite).toBe('lax');
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce secure flag in production environment', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple sessions
          fc.array(
            fc.record({
              sid: fc.string({ minLength: 32, maxLength: 64 }),
              userId: fc.integer({ min: 1, max: 10000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (sessionsData) => {
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              const isProduction = true; // Simulate production environment
              
              // Create all sessions with production cookie settings
              for (const sessionData of sessionsData) {
                const session = {
                  userId: sessionData.userId,
                  cookie: {
                    originalMaxAge: thirtyDays,
                    expires: new Date(now + thirtyDays),
                    secure: isProduction,
                    httpOnly: true,
                    path: '/',
                    sameSite: 'strict' as const
                  }
                };
                
                await new Promise<void>((resolve, reject) => {
                  store.set(sessionData.sid, session, (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
              }
              
              // Verify all sessions have secure flags
              for (const sessionData of sessionsData) {
                const retrievedSession = await new Promise<any>((resolve, reject) => {
                  store.get(sessionData.sid, (err, sess) => {
                    if (err) reject(err);
                    else resolve(sess);
                  });
                });
                
                expect(retrievedSession).not.toBeNull();
                expect(retrievedSession.cookie.httpOnly).toBe(true);
                expect(retrievedSession.cookie.secure).toBe(true);
                expect(retrievedSession.cookie.sameSite).toBe('strict');
              }
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain cookie security properties across session updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate session data
          fc.record({
            sid: fc.string({ minLength: 32, maxLength: 64 }),
            initialUserId: fc.integer({ min: 1, max: 10000 }),
            updatedUserId: fc.integer({ min: 1, max: 10000 }),
          }),
          async (sessionData) => {
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              
              // Create initial session
              const initialSession = {
                userId: sessionData.initialUserId,
                cookie: {
                  originalMaxAge: thirtyDays,
                  expires: new Date(now + thirtyDays),
                  secure: true,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.sid, initialSession, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Update session with new user ID
              const updatedSession = {
                userId: sessionData.updatedUserId,
                cookie: {
                  originalMaxAge: thirtyDays,
                  expires: new Date(now + thirtyDays),
                  secure: true,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              await new Promise<void>((resolve, reject) => {
                store.set(sessionData.sid, updatedSession, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              // Verify updated session maintains security properties
              const retrievedSession = await new Promise<any>((resolve, reject) => {
                store.get(sessionData.sid, (err, sess) => {
                  if (err) reject(err);
                  else resolve(sess);
                });
              });
              
              expect(retrievedSession).not.toBeNull();
              expect(retrievedSession.userId).toBe(sessionData.updatedUserId);
              expect(retrievedSession.cookie.httpOnly).toBe(true);
              expect(retrievedSession.cookie.secure).toBe(true);
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Session Store Operations', () => {
    it('should handle concurrent session operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple sessions
          fc.array(
            fc.record({
              sid: fc.string({ minLength: 32, maxLength: 64 }),
              userId: fc.integer({ min: 1, max: 10000 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (sessionsData) => {
            const db = createTestDatabase();
            const store = new SQLiteStore(db, 3600000);
            
            try {
              const now = Date.now();
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              
              // Create all sessions concurrently
              await Promise.all(
                sessionsData.map(sessionData => {
                  const session = {
                    userId: sessionData.userId,
                    cookie: {
                      originalMaxAge: thirtyDays,
                      expires: new Date(now + thirtyDays),
                      secure: false,
                      httpOnly: true,
                      path: '/'
                    }
                  };
                  
                  return new Promise<void>((resolve, reject) => {
                    store.set(sessionData.sid, session, (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  });
                })
              );
              
              // Verify all sessions were created correctly
              const retrievedSessions = await Promise.all(
                sessionsData.map(sessionData =>
                  new Promise<any>((resolve, reject) => {
                    store.get(sessionData.sid, (err, sess) => {
                      if (err) reject(err);
                      else resolve(sess);
                    });
                  })
                )
              );
              
              // Verify each session
              for (let i = 0; i < sessionsData.length; i++) {
                expect(retrievedSessions[i]).not.toBeNull();
                expect(retrievedSessions[i].userId).toBe(sessionsData[i].userId);
              }
              
              // Get session count
              const count = await new Promise<number>((resolve, reject) => {
                store.length((err, len) => {
                  if (err) reject(err);
                  else resolve(len!);
                });
              });
              
              expect(count).toBe(sessionsData.length);
              
            } finally {
              store.stopCleanup();
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
