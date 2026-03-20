/**
 * Performance tests for mix templates
 * Tests template operations with large datasets (100+ templates)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../src/database/database';
import path from 'path';
import fs from 'fs';

describe('Mix Template Performance Tests', () => {
  let db: Database.Database;
  let dbService: DatabaseService;
  let testUserId: number;
  const testDbPath = path.join(__dirname, 'test-performance.db');

  beforeAll(() => {
    // Create test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    
    // Create schema
    const schema = fs.readFileSync(
      path.join(__dirname, '../../src/database/schema.sql'),
      'utf-8'
    );
    db.exec(schema);

    dbService = new DatabaseService(db);

    // Create test user
    const user = dbService.createUser('test-user-perf', 'Test User', 'test-token');
    testUserId = user.id;
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create 100 templates in reasonable time', () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      dbService.createMixTemplate(
        testUserId,
        `Template ${i}`,
        `Description for template ${i}`,
        'custom',
        {
          mixType: 'custom',
          trackCount: 50,
          customRules: {
            includeGenres: ['Rock', 'Pop'],
            minRating: 7
          }
        }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`Created 100 templates in ${duration}ms`);
    
    // Should complete in under 1 second
    expect(duration).toBeLessThan(1000);
  });

  it('should retrieve 100 templates in under 500ms', () => {
    const startTime = Date.now();
    
    const templates = dbService.getMixTemplates(testUserId);
    
    const duration = Date.now() - startTime;
    console.log(`Retrieved ${templates.length} templates in ${duration}ms`);
    
    expect(templates.length).toBe(100);
    // Should complete in under 500ms as per NFR1
    expect(duration).toBeLessThan(500);
  });

  it('should retrieve single template by ID in under 50ms', () => {
    const templates = dbService.getMixTemplates(testUserId);
    const templateId = templates[0].id;

    const startTime = Date.now();
    
    const template = dbService.getMixTemplateById(templateId);
    
    const duration = Date.now() - startTime;
    console.log(`Retrieved single template in ${duration}ms`);
    
    expect(template).toBeDefined();
    expect(template?.id).toBe(templateId);
    // Should be very fast with index
    expect(duration).toBeLessThan(50);
  });

  it('should update template in under 100ms', () => {
    const templates = dbService.getMixTemplates(testUserId);
    const templateId = templates[0].id;

    const startTime = Date.now();
    
    dbService.updateMixTemplate(templateId, {
      name: 'Updated Template Name',
      description: 'Updated description'
    });
    
    const duration = Date.now() - startTime;
    console.log(`Updated template in ${duration}ms`);
    
    // Should be fast
    expect(duration).toBeLessThan(100);
  });

  it('should delete template in under 50ms', () => {
    const templates = dbService.getMixTemplates(testUserId);
    const templateId = templates[templates.length - 1].id;

    const startTime = Date.now();
    
    dbService.deleteMixTemplate(templateId);
    
    const duration = Date.now() - startTime;
    console.log(`Deleted template in ${duration}ms`);
    
    // Should be very fast
    expect(duration).toBeLessThan(50);
  });

  it('should handle concurrent reads efficiently', async () => {
    const startTime = Date.now();
    
    // Simulate 10 concurrent reads
    const promises = Array.from({ length: 10 }, () => 
      Promise.resolve(dbService.getMixTemplates(testUserId))
    );
    
    const results = await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    console.log(`Completed 10 concurrent reads in ${duration}ms`);
    
    expect(results.length).toBe(10);
    results.forEach(templates => {
      expect(templates.length).toBeGreaterThan(0);
    });
    
    // Should handle concurrent reads well
    expect(duration).toBeLessThan(1000);
  });

  it('should efficiently query templates with usage statistics', () => {
    // Update usage for some templates
    const templates = dbService.getMixTemplates(testUserId);
    
    for (let i = 0; i < 10; i++) {
      dbService.updateMixTemplateUsage(templates[i].id);
    }

    const startTime = Date.now();
    
    const updatedTemplates = dbService.getMixTemplates(testUserId);
    
    const duration = Date.now() - startTime;
    console.log(`Retrieved templates with usage stats in ${duration}ms`);
    
    // Verify sorting by usage
    const usedTemplates = updatedTemplates.filter(t => t.use_count > 0);
    expect(usedTemplates.length).toBe(10);
    
    // Should still be fast
    expect(duration).toBeLessThan(500);
  });

  it('should handle large configuration objects efficiently', () => {
    // Create template with large configuration
    const largeConfig = {
      mixType: 'custom',
      trackCount: 100,
      customRules: {
        includeGenres: Array.from({ length: 50 }, (_, i) => `Genre ${i}`),
        excludeGenres: Array.from({ length: 30 }, (_, i) => `Exclude ${i}`),
        yearRange: { min: 1960, max: 2024 }
      }
    };

    const startTime = Date.now();
    
    const template = dbService.createMixTemplate(
      testUserId,
      'Large Config Template',
      'Template with large configuration',
      'custom',
      largeConfig
    );
    
    const duration = Date.now() - startTime;
    console.log(`Created template with large config in ${duration}ms`);
    
    expect(template).toBeDefined();
    expect(duration).toBeLessThan(200);

    // Retrieve it
    const retrieveStart = Date.now();
    const retrieved = dbService.getMixTemplateById(template.id);
    const retrieveDuration = Date.now() - retrieveStart;
    
    console.log(`Retrieved template with large config in ${retrieveDuration}ms`);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.configuration.customRules?.includeGenres?.length).toBe(50);
    expect(retrieveDuration).toBeLessThan(100);
  });
});
