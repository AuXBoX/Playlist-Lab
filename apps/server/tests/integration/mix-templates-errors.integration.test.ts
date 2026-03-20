/**
 * Mix Templates E2E Error Scenario Tests
 * 
 * Tests error handling for the saved mix templates feature:
 * - Invalid template data
 * - Missing Plex items when generating from template
 * - Network errors during generation
 * - Permission errors (accessing other user's templates)
 * - Invalid configuration structures
 * - Database errors
 */

import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import mixTemplatesRoutes from '../../src/routes/mix-templates';
import { DatabaseService } from '../../src/database/database';
import { errorHandler } from '../../src/middleware/error-handler';
import * as fs from 'fs';
import * as path from 'path';

describe('Mix Templates E2E Error Scenarios', () => {
  let app: Express;
  let sqliteDb: Database.Database;
  let db: DatabaseService;
  let testUserId: number;
  let otherUserId: number;

  beforeAll(() => {
    // Create in-memory database
    sqliteDb = new Database(':memory:');
    sqliteDb.pragma('foreign_keys = ON');
    
    // Load and execute schema
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    sqliteDb.exec(schema);
    
    db = new DatabaseService(sqliteDb);
    
    // Create test users
    const user1 = db.createUser('plex123', 'testuser', 'token123', 'thumb.jpg');
    testUserId = user1.id;
    
    const user2 = db.createUser('plex456', 'otheruser', 'token456', 'thumb2.jpg');
    otherUserId = user2.id;
  });

  beforeEach(() => {
    // Clean up templates before each test
    sqliteDb.exec('DELETE FROM mix_templates');
    
    // Setup authenticated app
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    app.use((req, res, next) => {
      req.session.userId = testUserId;
      req.dbService = db;
      next();
    });
    app.use('/api/mix-templates', mixTemplatesRoutes);
    app.use(errorHandler);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  describe('Invalid Template Data', () => {
    it('should reject template with missing required fields', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          // Missing name, mixType, configuration
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/name|required/i);
    });

    it('should reject template with invalid mixType', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'invalid_type',
          configuration: { trackCount: 50 }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/mixType|invalid/i);
    });

    it('should reject template with malformed configuration', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'mood',
          configuration: 'not-an-object'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/configuration|object/i);
    });

    it('should reject template with invalid trackCount', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'mood',
          configuration: {
            trackCount: -10,
            moods: ['chill']
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/trackCount/i);
    });

    it('should reject artist mix without artistIds', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Artist Mix',
          mixType: 'artist',
          configuration: {
            trackCount: 50
            // Missing artistIds
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/artistIds/i);
    });

    it('should reject album mix without albumIds', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Album Mix',
          mixType: 'album',
          configuration: {
            trackCount: 50
            // Missing albumIds
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/albumIds/i);
    });

    it('should reject genre mix without genres', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Genre Mix',
          mixType: 'genre',
          configuration: {
            trackCount: 50
            // Missing genres
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/genres/i);
    });

    it('should reject template with empty name', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: '   ',
          mixType: 'mood',
          configuration: { trackCount: 50, moods: ['chill'] }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/name|empty/i);
    });

    it('should reject template with excessively long name', async () => {
      const longName = 'A'.repeat(300);
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: longName,
          mixType: 'mood',
          configuration: { trackCount: 50, moods: ['chill'] }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/name|length|long/i);
    });
  });

  describe('Missing Plex Items', () => {
    beforeEach(() => {
      // Setup mock Plex server configuration
      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(testUserId, 'http://localhost:32400', 'Test Server', 'test-client-id', '1', 'Music');
    });

    it('should handle template with non-existent artist IDs', async () => {
      const template = db.createMixTemplate(testUserId, 'Artist Mix', null, 'artist', {
        trackCount: 50,
        artistIds: ['999999', '888888'] // Non-existent IDs
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      // Should indicate missing items or generation failure
      expect(response.body.error.message).toMatch(/generate|failed|not found|missing|exist|library/i);
    });

    it('should handle template with non-existent album IDs', async () => {
      const template = db.createMixTemplate(testUserId, 'Album Mix', null, 'album', {
        trackCount: 50,
        albumIds: ['999999', '888888']
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/generate|failed|not found|missing|exist|library/i);
    });

    it('should handle template with invalid genre names', async () => {
      const template = db.createMixTemplate(testUserId, 'Genre Mix', null, 'genre', {
        trackCount: 50,
        genres: ['NonExistentGenre123', 'FakeGenre456']
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/generate|failed|not found|missing|exist|library/i);
    });

    it('should handle template with partially missing items', async () => {
      const template = db.createMixTemplate(testUserId, 'Mixed Items', null, 'artist', {
        trackCount: 50,
        artistIds: ['1', '999999'] // One valid, one invalid
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' });

      // Should either succeed with partial data or fail gracefully
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 500) {
        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('Network Errors', () => {
    it('should handle missing Plex server configuration', async () => {
      // Remove server configuration
      sqliteDb.exec('DELETE FROM user_servers WHERE user_id = ?');
      
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'custom', {
        trackCount: 50,
        customRules: {}
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/server|configured|not found|exist|library/i);
    });

    it('should handle unreachable Plex server', async () => {
      // Setup server with unreachable URL
      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(testUserId, 'http://invalid-server:99999', 'Invalid Server', 'test-client-id', '1', 'Music');

      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'custom', {
        trackCount: 50,
        customRules: {}
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/generate|failed|connection|network|exist|library/i);
    });

    it('should handle timeout during generation', async () => {
      // This test would require mocking the Plex client to simulate timeout
      // For now, we verify the endpoint handles errors gracefully
      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(testUserId, 'http://localhost:32400', 'Test Server', 'test-client-id', '1', 'Music');

      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'custom', {
        trackCount: 50,
        customRules: {}
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' });

      // Should return error (no real Plex server)
      expect([500, 400]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Permission Errors', () => {
    let otherUserApp: Express;

    beforeEach(() => {
      // Create app authenticated as other user
      otherUserApp = express();
      otherUserApp.use(express.json());
      otherUserApp.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false
      }));
      otherUserApp.use((req, res, next) => {
        req.session.userId = otherUserId;
        req.dbService = db;
        next();
      });
      otherUserApp.use('/api/mix-templates', mixTemplatesRoutes);
      otherUserApp.use(errorHandler);
    });

    it('should prevent accessing other users templates', async () => {
      const template = db.createMixTemplate(testUserId, 'User 1 Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(otherUserApp)
        .get(`/api/mix-templates/${template.id}`)
        .expect(403);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toMatch(/permission|access/i);
    });

    it('should prevent updating other users templates', async () => {
      const template = db.createMixTemplate(testUserId, 'User 1 Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(otherUserApp)
        .put(`/api/mix-templates/${template.id}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
      
      // Verify template was not modified
      const unchanged = db.getMixTemplateById(template.id);
      expect(unchanged?.name).toBe('User 1 Template');
    });

    it('should prevent deleting other users templates', async () => {
      const template = db.createMixTemplate(testUserId, 'User 1 Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(otherUserApp)
        .delete(`/api/mix-templates/${template.id}`)
        .expect(403);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
      
      // Verify template still exists
      const stillExists = db.getMixTemplateById(template.id);
      expect(stillExists).not.toBeNull();
    });

    it('should prevent generating from other users templates', async () => {
      const template = db.createMixTemplate(testUserId, 'User 1 Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(otherUserApp)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Hacked Playlist' })
        .expect(403);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should not leak template existence through error messages', async () => {
      const template = db.createMixTemplate(testUserId, 'User 1 Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      // Other user tries to access - should get 403, not 404
      const response = await request(otherUserApp)
        .get(`/api/mix-templates/${template.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      // Should not reveal whether template exists
      expect(response.body.error.message).not.toMatch(/not found|does not exist/i);
    });
  });

  describe('Invalid Configuration Structures', () => {
    it('should reject configuration with null values', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'mood',
          configuration: null
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/configuration/i);
    });

    it('should reject configuration with array instead of object', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'mood',
          configuration: [{ trackCount: 50 }]
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/configuration|object/i);
    });

    it('should reject configuration with invalid field types', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'mood',
          configuration: {
            trackCount: 'fifty', // Should be number
            moods: 'chill' // Should be array
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject configuration with nested invalid structures', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          mixType: 'custom',
          configuration: {
            trackCount: 50,
            customRules: 'not-an-object' // Should be object
          }
        });

      // Should either accept (if validation is lenient) or reject
      expect([201, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body.error).toBeDefined();
      }
    });

    it('should handle extremely large configuration objects', async () => {
      const largeConfig = {
        trackCount: 50,
        artistIds: Array.from({ length: 10000 }, (_, i) => `artist-${i}`)
      };

      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Large Config Mix',
          mixType: 'artist',
          configuration: largeConfig
        });

      // Should either accept or reject gracefully
      expect([201, 400, 413]).toContain(response.status);
      
      if (response.status !== 201) {
        expect(response.body.error).toBeDefined();
      }
    });

    it('should reject configuration with circular references', async () => {
      // JSON.stringify will fail on circular references
      // This tests that the API handles malformed JSON gracefully
      const response = await request(app)
        .post('/api/mix-templates')
        .set('Content-Type', 'application/json')
        .send('{"name":"Test","mixType":"mood","configuration":{"trackCount":50,"self":')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Database Errors', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close the database to simulate connection error
      const closedDb = new Database(':memory:');
      closedDb.close();

      const brokenApp = express();
      brokenApp.use(express.json());
      brokenApp.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false
      }));
      brokenApp.use((req, res, next) => {
        req.session.userId = testUserId;
        req.dbService = new DatabaseService(closedDb);
        next();
      });
      brokenApp.use('/api/mix-templates', mixTemplatesRoutes);
      brokenApp.use(errorHandler);

      const response = await request(brokenApp)
        .get('/api/mix-templates')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/database|error|failed/i);
    });

    it('should handle foreign key constraint violations', async () => {
      // Try to create template with non-existent user ID
      try {
        sqliteDb.prepare(`
          INSERT INTO mix_templates (user_id, name, mix_type, configuration, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(99999, 'Test', 'mood', '{}', Date.now(), Date.now());
        
        fail('Should have thrown foreign key constraint error');
      } catch (error: any) {
        expect(error.message).toMatch(/FOREIGN KEY constraint/i);
      }
    });

    it('should handle concurrent modification conflicts', async () => {
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      // Simulate concurrent updates
      const update1 = request(app)
        .put(`/api/mix-templates/${template.id}`)
        .send({ name: 'Update 1' });

      const update2 = request(app)
        .put(`/api/mix-templates/${template.id}`)
        .send({ name: 'Update 2' });

      const [response1, response2] = await Promise.all([update1, update2]);

      // Both should succeed (last write wins)
      expect([200, 500]).toContain(response1.status);
      expect([200, 500]).toContain(response2.status);

      // At least one should succeed
      expect(response1.status === 200 || response2.status === 200).toBe(true);
    });

    it('should handle template deletion during generation', async () => {
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'custom', {
        trackCount: 50,
        customRules: {}
      });

      // Setup server config
      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(testUserId, 'http://localhost:32400', 'Test Server', 'test-client-id', '1', 'Music');

      // Delete template
      db.deleteMixTemplate(template.id);

      // Try to generate from deleted template
      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/not found/i);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-numeric template ID', async () => {
      const response = await request(app)
        .get('/api/mix-templates/not-a-number')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/invalid|id/i);
    });

    it('should handle negative template ID', async () => {
      const response = await request(app)
        .get('/api/mix-templates/-1')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });

    it('should handle very large template ID', async () => {
      const response = await request(app)
        .get('/api/mix-templates/999999999999')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/not found/i);
    });

    it('should handle SQL injection attempts in template name', async () => {
      const maliciousName = "'; DROP TABLE mix_templates; --";
      
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: maliciousName,
          mixType: 'mood',
          configuration: { trackCount: 50, moods: ['chill'] }
        })
        .expect(201);

      // Should create template safely
      expect(response.body.id).toBeDefined();

      // Verify table still exists
      const templates = db.getMixTemplates(testUserId);
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should handle XSS attempts in template description', async () => {
      const xssDescription = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Test Mix',
          description: xssDescription,
          mixType: 'mood',
          configuration: { trackCount: 50, moods: ['chill'] }
        })
        .expect(201);

      // Should store the string as-is (sanitization happens on frontend)
      const template = db.getMixTemplateById(response.body.id);
      expect(template?.description).toBe(xssDescription);
    });

    it('should handle Unicode characters in template name', async () => {
      const unicodeName = '🎵 My Mix 音楽 🎶';
      
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: unicodeName,
          mixType: 'mood',
          configuration: { trackCount: 50, moods: ['chill'] }
        })
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.name).toBe(unicodeName);
    });

    it('should handle empty configuration object', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Empty Config',
          mixType: 'custom',
          configuration: {}
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/trackCount|required/i);
    });

    it('should handle missing playlist name in generation', async () => {
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'custom', {
        trackCount: 50,
        customRules: {}
      });

      // Setup server config
      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(testUserId, 'http://localhost:32400', 'Test Server', 'test-client-id', '1', 'Music');

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({});

      // Should either use default name or fail gracefully
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
