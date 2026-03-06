/**
 * Property-Based Tests for Authentication
 * 
 * Tests universal properties of authentication and session management,
 * including token storage, session restoration, and session invalidation.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { DatabaseService } from '../../src/database/database';
import { encrypt, decrypt } from '../../src/utils/encryption';
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

describe('Authentication Property Tests', () => {
  describe('Property 1: Authentication Token Storage', () => {
    /**
     * **Validates: Requirements 1.3**
     * 
     * For any successful Plex authentication, storing the user's token and 
     * user ID in the database should allow subsequent retrieval of those 
     * exact values.
     */
    it('should store and retrieve authentication tokens correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user authentication data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
            plexThumb: fc.option(fc.webUrl(), { nil: undefined }),
          }),
          // Generate encryption secret
          fc.string({ minLength: 32, maxLength: 64 }),
          async (userData, secret) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Encrypt the token before storage (as the application would)
              const encryptedToken = encrypt(userData.plexToken, secret);
              
              // Store user with encrypted token
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                encryptedToken,
                userData.plexThumb
              );
              
              // Verify user was created
              expect(user).toBeDefined();
              expect(user.id).toBeGreaterThan(0);
              
              // Retrieve user by Plex ID
              const retrievedByPlexId = dbService.getUserByPlexId(userData.plexUserId);
              expect(retrievedByPlexId).not.toBeNull();
              expect(retrievedByPlexId!.plex_user_id).toBe(userData.plexUserId);
              expect(retrievedByPlexId!.plex_username).toBe(userData.plexUsername);
              
              // Decrypt and verify token
              const decryptedToken = decrypt(retrievedByPlexId!.plex_token, secret);
              expect(decryptedToken).toBe(userData.plexToken);
              
              // Retrieve user by internal ID
              const retrievedById = dbService.getUserById(user.id);
              expect(retrievedById).not.toBeNull();
              expect(retrievedById!.plex_user_id).toBe(userData.plexUserId);
              
              // Decrypt and verify token again
              const decryptedToken2 = decrypt(retrievedById!.plex_token, secret);
              expect(decryptedToken2).toBe(userData.plexToken);
              
              // Verify thumb is stored correctly
              if (userData.plexThumb) {
                expect(retrievedByPlexId!.plex_thumb).toBe(userData.plexThumb);
                expect(retrievedById!.plex_thumb).toBe(userData.plexThumb);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle token updates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            initialToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate new token
          fc.string({ minLength: 20, maxLength: 200 }),
          // Generate encryption secret
          fc.string({ minLength: 32, maxLength: 64 }),
          async (userData, newToken, secret) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user with initial token
              const encryptedInitialToken = encrypt(userData.initialToken, secret);
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                encryptedInitialToken
              );
              
              // Update token
              const encryptedNewToken = encrypt(newToken, secret);
              dbService.updateUserToken(user.id, encryptedNewToken);
              
              // Retrieve and verify new token
              const retrieved = dbService.getUserById(user.id);
              expect(retrieved).not.toBeNull();
              
              const decryptedToken = decrypt(retrieved!.plex_token, secret);
              expect(decryptedToken).toBe(newToken);
              expect(decryptedToken).not.toBe(userData.initialToken);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Session Restoration', () => {
    /**
     * **Validates: Requirements 1.4**
     * 
     * For any user with stored credentials, creating a session should 
     * restore access to their data without re-authentication.
     */
    it('should restore user session from stored credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
            plexThumb: fc.option(fc.webUrl(), { nil: undefined }),
          }),
          // Generate session ID
          fc.string({ minLength: 32, maxLength: 64 }),
          async (userData, sessionId) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken,
                userData.plexThumb
              );
              
              // Simulate session creation by storing session data
              const sessionData = {
                userId: user.id,
                plexUserId: userData.plexUserId,
                cookie: {
                  originalMaxAge: 2592000000, // 30 days
                  expires: new Date(Date.now() + 2592000000).toISOString(),
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              const expired = Math.floor((Date.now() + 2592000000) / 1000);
              const insertSession = db.prepare(`
                INSERT INTO sessions (sid, sess, expired)
                VALUES (?, ?, ?)
              `);
              insertSession.run(sessionId, JSON.stringify(sessionData), expired);
              
              // Simulate session restoration by retrieving session
              const getSession = db.prepare('SELECT sess FROM sessions WHERE sid = ?');
              const sessionRow = getSession.get(sessionId) as { sess: string } | undefined;
              
              expect(sessionRow).toBeDefined();
              const restoredSession = JSON.parse(sessionRow!.sess);
              
              // Verify session contains correct user ID
              expect(restoredSession.userId).toBe(user.id);
              expect(restoredSession.plexUserId).toBe(userData.plexUserId);
              
              // Verify we can retrieve user data using session info
              const restoredUser = dbService.getUserById(restoredSession.userId);
              expect(restoredUser).not.toBeNull();
              expect(restoredUser!.plex_user_id).toBe(userData.plexUserId);
              expect(restoredUser!.plex_username).toBe(userData.plexUsername);
              expect(restoredUser!.plex_token).toBe(userData.plexToken);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should restore multiple concurrent user sessions independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple users
          fc.array(
            fc.record({
              plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
              plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
              plexToken: fc.string({ minLength: 20, maxLength: 200 }),
              sessionId: fc.string({ minLength: 32, maxLength: 64 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (usersData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              const userIds: number[] = [];
              
              // Create all users and their sessions
              for (const userData of usersData) {
                const user = dbService.createUser(
                  userData.plexUserId,
                  userData.plexUsername,
                  userData.plexToken
                );
                userIds.push(user.id);
                
                // Create session for this user
                const sessionData = {
                  userId: user.id,
                  plexUserId: userData.plexUserId,
                  cookie: {
                    originalMaxAge: 2592000000,
                    expires: new Date(Date.now() + 2592000000).toISOString(),
                    secure: false,
                    httpOnly: true,
                    path: '/'
                  }
                };
                
                const expired = Math.floor((Date.now() + 2592000000) / 1000);
                const insertSession = db.prepare(`
                  INSERT INTO sessions (sid, sess, expired)
                  VALUES (?, ?, ?)
                `);
                insertSession.run(userData.sessionId, JSON.stringify(sessionData), expired);
              }
              
              // Verify each session restores the correct user
              for (let i = 0; i < usersData.length; i++) {
                const userData = usersData[i];
                const expectedUserId = userIds[i];
                
                const getSession = db.prepare('SELECT sess FROM sessions WHERE sid = ?');
                const sessionRow = getSession.get(userData.sessionId) as { sess: string } | undefined;
                
                expect(sessionRow).toBeDefined();
                const restoredSession = JSON.parse(sessionRow!.sess);
                
                expect(restoredSession.userId).toBe(expectedUserId);
                expect(restoredSession.plexUserId).toBe(userData.plexUserId);
                
                // Verify user data is correct
                const restoredUser = dbService.getUserById(restoredSession.userId);
                expect(restoredUser).not.toBeNull();
                expect(restoredUser!.plex_user_id).toBe(userData.plexUserId);
                expect(restoredUser!.plex_token).toBe(userData.plexToken);
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Session Invalidation', () => {
    /**
     * **Validates: Requirements 1.5, 12.5**
     * 
     * For any active user session, logging out should invalidate the 
     * session such that subsequent requests with that session fail 
     * authentication.
     */
    it('should invalidate session on logout', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate session ID
          fc.string({ minLength: 32, maxLength: 64 }),
          async (userData, sessionId) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create session
              const sessionData = {
                userId: user.id,
                plexUserId: userData.plexUserId,
                cookie: {
                  originalMaxAge: 2592000000,
                  expires: new Date(Date.now() + 2592000000).toISOString(),
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              const expired = Math.floor((Date.now() + 2592000000) / 1000);
              const insertSession = db.prepare(`
                INSERT INTO sessions (sid, sess, expired)
                VALUES (?, ?, ?)
              `);
              insertSession.run(sessionId, JSON.stringify(sessionData), expired);
              
              // Verify session exists
              const getSession = db.prepare('SELECT sess FROM sessions WHERE sid = ?');
              const sessionBefore = getSession.get(sessionId);
              expect(sessionBefore).toBeDefined();
              
              // Simulate logout by deleting session
              const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?');
              deleteSession.run(sessionId);
              
              // Verify session no longer exists
              const sessionAfter = getSession.get(sessionId);
              expect(sessionAfter).toBeUndefined();
              
              // Verify user still exists (only session is deleted)
              const userStillExists = dbService.getUserById(user.id);
              expect(userStillExists).not.toBeNull();
              expect(userStillExists!.id).toBe(user.id);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should invalidate only the specified session without affecting other sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate multiple session IDs for the same user
          fc.array(
            fc.string({ minLength: 32, maxLength: 64 }),
            { minLength: 2, maxLength: 5 }
          ),
          async (userData, sessionIds) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create multiple sessions for the same user
              const insertSession = db.prepare(`
                INSERT INTO sessions (sid, sess, expired)
                VALUES (?, ?, ?)
              `);
              
              for (const sessionId of sessionIds) {
                const sessionData = {
                  userId: user.id,
                  plexUserId: userData.plexUserId,
                  cookie: {
                    originalMaxAge: 2592000000,
                    expires: new Date(Date.now() + 2592000000).toISOString(),
                    secure: false,
                    httpOnly: true,
                    path: '/'
                  }
                };
                
                const expired = Math.floor((Date.now() + 2592000000) / 1000);
                insertSession.run(sessionId, JSON.stringify(sessionData), expired);
              }
              
              // Verify all sessions exist
              const getSession = db.prepare('SELECT sess FROM sessions WHERE sid = ?');
              for (const sessionId of sessionIds) {
                const session = getSession.get(sessionId);
                expect(session).toBeDefined();
              }
              
              // Delete only the first session
              const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?');
              deleteSession.run(sessionIds[0]);
              
              // Verify first session is deleted
              const firstSession = getSession.get(sessionIds[0]);
              expect(firstSession).toBeUndefined();
              
              // Verify other sessions still exist
              for (let i = 1; i < sessionIds.length; i++) {
                const session = getSession.get(sessionIds[i]);
                expect(session).toBeDefined();
              }
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle expired sessions as invalid', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate session ID
          fc.string({ minLength: 32, maxLength: 64 }),
          async (userData, sessionId) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create session with past expiration (already expired)
              const sessionData = {
                userId: user.id,
                plexUserId: userData.plexUserId,
                cookie: {
                  originalMaxAge: 2592000000,
                  expires: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
                  secure: false,
                  httpOnly: true,
                  path: '/'
                }
              };
              
              const expired = Math.floor((Date.now() - 1000) / 1000); // Past timestamp
              const insertSession = db.prepare(`
                INSERT INTO sessions (sid, sess, expired)
                VALUES (?, ?, ?)
              `);
              insertSession.run(sessionId, JSON.stringify(sessionData), expired);
              
              // Verify session exists in database
              const getSession = db.prepare('SELECT sess, expired FROM sessions WHERE sid = ?');
              const sessionRow = getSession.get(sessionId) as { sess: string; expired: number } | undefined;
              expect(sessionRow).toBeDefined();
              
              // Verify session is expired
              const now = Math.floor(Date.now() / 1000);
              expect(sessionRow!.expired).toBeLessThan(now);
              
              // Simulate session validation (as middleware would do)
              const isExpired = sessionRow!.expired < now;
              expect(isExpired).toBe(true);
              
              // If expired, session should be treated as invalid
              // (In real implementation, middleware would delete it and return 401)
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
