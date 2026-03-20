/**
 * Mix Templates Schema Versioning Tests
 * Tests for schema version handling and migration
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

describe('Mix Templates Schema Versioning', () => {
  let app: Express;
  let sqliteDb: Database.Database;
  let db: DatabaseService;
  let testUserId: number;

  beforeAll(() => {
    // Create in-memory database
    sqliteDb = new Database(':memory:');
    sqliteDb.pragma('foreign_keys = ON');
    
    // Load and execute schema
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    sqliteDb.exec(schema);
    
    db = new DatabaseService(sqliteDb);
    
    // Create test user
    const user = db.createUser('plex123', 'testuser', 'token123', 'thumb.jpg');
    testUserId = user.id;

    // Create server configuration for generation tests
    const stmt = sqliteDb.prepare(`
      INSERT INTO user_servers (user_id, server_url, server_name, server_client_id, library_id, library_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(testUserId, 'http://localhost:32400', 'Test Server', 'test-client-id', '1', 'Music');
  });

  beforeEach(() => {
    // Set up authenticated app
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

    // Clean up templates
    sqliteDb.exec('DELETE FROM mix_templates');
  });

  afterAll(() => {
    sqliteDb.close();
  });

  describe('Schema Version Addition', () => {
    it('should automatically add schema version when creating a template', async () => {
      const templateData = {
        name: 'Test Mix',
        mixType: 'mood',
        configuration: {
          trackCount: 50,
          moods: ['chill']
        }
      };

      const response = await request(app)
        .post('/api/mix-templates')
        .send(templateData)
        .expect(201);

      expect(response.body.id).toBeDefined();

      // Retrieve the template and check schema version
      const template = db.getMixTemplateById(response.body.id);
      expect(template).toBeDefined();
      expect(template?.configuration).toHaveProperty('schemaVersion');
      expect(template?.configuration.schemaVersion).toBe(1);
    });

    it('should preserve existing schema version if provided', async () => {
      const templateData = {
        name: 'Test Mix',
        mixType: 'mood',
        configuration: {
          schemaVersion: 1,
          trackCount: 50,
          moods: ['chill']
        }
      };

      const response = await request(app)
        .post('/api/mix-templates')
        .send(templateData)
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.configuration.schemaVersion).toBe(1);
    });

    it('should add schema version when updating a template configuration', async () => {
      // Create template without schema version (simulating old data)
      const template = db.createMixTemplate(testUserId, 'Test Mix', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      // Update the configuration
      const response = await request(app)
        .put(`/api/mix-templates/${template.id}`)
        .send({
          configuration: {
            trackCount: 75,
            moods: ['energetic']
          }
        })
        .expect(200);

      // Check that schema version was added
      const updated = db.getMixTemplateById(template.id);
      expect(updated?.configuration).toHaveProperty('schemaVersion');
      expect(updated?.configuration.schemaVersion).toBe(1);
    });

    it('should reject invalid schema version type', async () => {
      const templateData = {
        name: 'Test Mix',
        mixType: 'mood',
        configuration: {
          schemaVersion: 'invalid',
          trackCount: 50,
          moods: ['chill']
        }
      };

      const response = await request(app)
        .post('/api/mix-templates')
        .send(templateData)
        .expect(400);

      expect(response.body.error.message).toContain('Schema version must be a number');
    });
  });

  describe('Schema Migration', () => {
    it('should handle templates without schema version (version 0)', async () => {
      // Create template without schema version (simulating old data)
      const template = db.createMixTemplate(testUserId, 'Old Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      // Verify no schema version
      expect(template.configuration).not.toHaveProperty('schemaVersion');

      // Try to generate from it - should migrate automatically
      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .catch(err => err.response); // Will fail due to no real Plex server

      // Should not fail with schema version error
      if (response && response.body.error) {
        expect(response.body.error.message).not.toContain('schema version');
        expect(response.body.error.message).not.toContain('Schema version');
      }
    });

    it('should accept templates with current schema version', async () => {
      const template = db.createMixTemplate(testUserId, 'Current Template', null, 'mood', {
        schemaVersion: 1,
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' })
        .catch(err => err.response);

      // Should not fail with schema version error
      if (response && response.body.error) {
        expect(response.body.error.message).not.toContain('schema version');
      }
    });

    it('should reject templates with future schema version', async () => {
      // Manually create template with future schema version
      const template = db.createMixTemplate(testUserId, 'Future Template', null, 'mood', {
        schemaVersion: 999,
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(app)
        .post(`/api/mix-templates/${template.id}/generate`)
        .send({ playlistName: 'Generated Mix' });

      // Should fail with validation error about schema version
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('schema version');
      expect(response.body.error.message).toContain('newer than supported');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with templates created before schema versioning', async () => {
      // Create template without schema version
      const template = db.createMixTemplate(testUserId, 'Legacy Template', null, 'artist', {
        trackCount: 30,
        artistIds: ['artist1', 'artist2']
      });

      // Should be able to retrieve it
      const response = await request(app)
        .get(`/api/mix-templates/${template.id}`)
        .expect(200);

      expect(response.body.id).toBe(template.id);
      expect(response.body.configuration.trackCount).toBe(30);
    });

    it('should allow updating legacy templates', async () => {
      const template = db.createMixTemplate(testUserId, 'Legacy Template', null, 'mood', {
        trackCount: 50,
        moods: ['chill']
      });

      const response = await request(app)
        .put(`/api/mix-templates/${template.id}`)
        .send({ name: 'Updated Legacy Template' })
        .expect(200);

      expect(response.body.message).toContain('updated successfully');
    });

    it('should preserve all configuration fields during migration', async () => {
      const originalConfig = {
        trackCount: 50,
        moods: ['chill', 'relaxing'],
        sortBy: 'rating',
        sortDirection: 'desc'
      };

      const template = db.createMixTemplate(testUserId, 'Test Template', null, 'mood', originalConfig);

      // Update to trigger migration
      await request(app)
        .put(`/api/mix-templates/${template.id}`)
        .send({
          configuration: originalConfig
        })
        .expect(200);

      const updated = db.getMixTemplateById(template.id);
      expect(updated?.configuration.trackCount).toBe(50);
      expect(updated?.configuration.moods).toEqual(['chill', 'relaxing']);
      expect(updated?.configuration.sortBy).toBe('rating');
      expect(updated?.configuration.sortDirection).toBe('desc');
      expect(updated?.configuration.schemaVersion).toBe(1);
    });
  });

  describe('Schema Version in Different Mix Types', () => {
    it('should add schema version to artist mix', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Artist Mix',
          mixType: 'artist',
          configuration: {
            trackCount: 30,
            artistIds: ['artist1', 'artist2']
          }
        })
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.configuration.schemaVersion).toBe(1);
    });

    it('should add schema version to album mix', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Album Mix',
          mixType: 'album',
          configuration: {
            trackCount: 40,
            albumIds: ['album1', 'album2']
          }
        })
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.configuration.schemaVersion).toBe(1);
    });

    it('should add schema version to genre mix', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Genre Mix',
          mixType: 'genre',
          configuration: {
            trackCount: 50,
            genres: ['rock', 'pop']
          }
        })
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.configuration.schemaVersion).toBe(1);
    });

    it('should add schema version to decade mix', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Decade Mix',
          mixType: 'decade',
          configuration: {
            trackCount: 60,
            decades: [1980, 1990]
          }
        })
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.configuration.schemaVersion).toBe(1);
    });

    it('should add schema version to custom mix', async () => {
      const response = await request(app)
        .post('/api/mix-templates')
        .send({
          name: 'Custom Mix',
          mixType: 'custom',
          configuration: {
            trackCount: 100,
            customRules: {
              minRating: 8,
              includeGenres: ['jazz']
            }
          }
        })
        .expect(201);

      const template = db.getMixTemplateById(response.body.id);
      expect(template?.configuration.schemaVersion).toBe(1);
    });
  });
});
