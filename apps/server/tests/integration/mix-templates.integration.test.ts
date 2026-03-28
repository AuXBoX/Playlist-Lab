/**
 * Integration Tests for Mix Templates Workflows
 * 
 * Tests complete end-to-end workflows for saved mix templates:
 * - Save template workflow
 * - Load template workflow
 * - Edit template workflow
 * - Delete template workflow
 * - Quick generate workflow
 * - Templates with missing Plex items
 */

import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { DatabaseService } from '../../src/database/database';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Create a temporary test database
 */
function createTestDatabase(): Database.Database {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-lab-integration-'));
  const dbPath = path.join(tempDir, 'test.db');
  return initializeDatabase(dbPath);
}

/**
 * Clean up test database
 */
function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = db.name;
  db.close();
  
  if (dbPath && dbPath !== ':memory:') {
    try {
      fs.unlinkSync(dbPath);
      fs.rmdirSync(path.dirname(dbPath));
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

describe('Mix Templates Integration Tests', () => {
  let db: Database.Database;
  let dbService: DatabaseService;
  let userId: number;

  beforeEach(() => {
    // Create test database
    db = createTestDatabase();
    dbService = new DatabaseService(db);

    // Create test user
    const user = dbService.createUser(
      'test-plex-user-id',
      'testuser',
      'test-token',
      'https://example.com/thumb.jpg'
    );
    userId = user.id;
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  describe('Save Template Workflow', () => {
    it('should save a custom mix template with all parameters', () => {
      const configuration = {
        mixType: 'custom',
        trackCount: 50,
        sortBy: 'random',
        sortDirection: 'desc',
        customRules: {
          includeGenres: ['Rock', 'Alternative'],
          excludeGenres: ['Country'],
          minRating: 7,
          yearRange: { min: 2000, max: 2020 },
          includeUnplayed: true
        }
      };

      const template = dbService.createMixTemplate(
        userId,
        'My Custom Mix',
        'A mix of rock and alternative from 2000-2020',
        'custom',
        configuration
      );

      expect(template.id).toBeDefined();
      expect(template.name).toBe('My Custom Mix');
      expect(template.description).toBe('A mix of rock and alternative from 2000-2020');
      expect(template.mix_type).toBe('custom');
      expect(template.configuration).toEqual(configuration);
      expect(template.use_count).toBe(0);
      expect(template.created_at).toBeDefined();
      expect(template.updated_at).toBeDefined();
    });

    it('should save an artist mix template', () => {
      const configuration = {
        mixType: 'artist',
        trackCount: 30,
        artistIds: ['artist-1', 'artist-2', 'artist-3'],
        maxTracksPerArtist: 10,
        allowDuplicateArtists: false,
        sortBy: 'random'
      };

      const template = dbService.createMixTemplate(
        userId,
        'Favorite Artists Mix',
        null,
        'artist',
        configuration
      );

      expect(template.id).toBeDefined();
      expect(template.mix_type).toBe('artist');
      expect(template.configuration.artistIds).toHaveLength(3);
      expect(template.configuration.maxTracksPerArtist).toBe(10);
    });

    it('should save an album mix template', () => {
      const configuration = {
        mixType: 'album',
        trackCount: 40,
        albumIds: ['album-1', 'album-2'],
        maxTracksPerAlbum: 20,
        sortBy: 'random'
      };

      const template = dbService.createMixTemplate(
        userId,
        'Best Albums Mix',
        'My favorite albums',
        'album',
        configuration
      );

      expect(template.id).toBeDefined();
      expect(template.mix_type).toBe('album');
      expect(template.configuration.albumIds).toHaveLength(2);
    });

    it('should save a genre mix template', () => {
      const configuration = {
        mixType: 'genre',
        trackCount: 50,
        genres: ['Jazz', 'Blues', 'Soul'],
        sortBy: 'random'
      };

      const template = dbService.createMixTemplate(
        userId,
        'Jazz & Blues Mix',
        null,
        'genre',
        configuration
      );

      expect(template.id).toBeDefined();
      expect(template.mix_type).toBe('genre');
      expect(template.configuration.genres).toHaveLength(3);
    });

    it('should save a mood mix template', () => {
      const configuration = {
        mixType: 'mood',
        trackCount: 30,
        moods: ['Chill', 'Relaxing', 'Ambient'],
        sortBy: 'random'
      };

      const template = dbService.createMixTemplate(
        userId,
        'Chill Evening Mix',
        'Perfect for relaxing',
        'mood',
        configuration
      );

      expect(template.id).toBeDefined();
      expect(template.mix_type).toBe('mood');
      expect(template.configuration.moods).toHaveLength(3);
    });

    it('should save a decade mix template', () => {
      const configuration = {
        mixType: 'decade',
        trackCount: 50,
        decades: [1980, 1990, 2000],
        sortBy: 'random'
      };

      const template = dbService.createMixTemplate(
        userId,
        '80s-00s Mix',
        'Three decades of great music',
        'decade',
        configuration
      );

      expect(template.id).toBeDefined();
      expect(template.mix_type).toBe('decade');
      expect(template.configuration.decades).toHaveLength(3);
    });
  });

  describe('Load Template Workflow', () => {
    it('should retrieve a saved template by ID', () => {
      const configuration = {
        mixType: 'custom',
        trackCount: 50,
        customRules: { includeGenres: ['Rock'] }
      };

      const saved = dbService.createMixTemplate(
        userId,
        'Test Template',
        'Test description',
        'custom',
        configuration
      );

      const loaded = dbService.getMixTemplateById(saved.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(saved.id);
      expect(loaded!.name).toBe('Test Template');
      expect(loaded!.description).toBe('Test description');
      expect(loaded!.configuration).toEqual(configuration);
    });

    it('should retrieve all templates for a user', () => {
      // Create multiple templates
      dbService.createMixTemplate(userId, 'Template 1', null, 'custom', { trackCount: 50 });
      dbService.createMixTemplate(userId, 'Template 2', null, 'artist', { trackCount: 30, artistIds: ['1'] });
      dbService.createMixTemplate(userId, 'Template 3', null, 'genre', { trackCount: 40, genres: ['Rock'] });

      const templates = dbService.getMixTemplates(userId);

      expect(templates).toHaveLength(3);
      expect(templates.map(t => t.name)).toContain('Template 1');
      expect(templates.map(t => t.name)).toContain('Template 2');
      expect(templates.map(t => t.name)).toContain('Template 3');
    });

    it('should only retrieve templates owned by the user', () => {
      // Create another user
      const otherUser = dbService.createUser(
        'other-plex-user-id',
        'otheruser',
        'other-token',
        'https://example.com/other-thumb.jpg'
      );

      // Create templates for both users
      dbService.createMixTemplate(userId, 'My Template', null, 'custom', { trackCount: 50 });
      dbService.createMixTemplate(otherUser.id, 'Other Template', null, 'custom', { trackCount: 50 });

      const myTemplates = dbService.getMixTemplates(userId);
      const otherTemplates = dbService.getMixTemplates(otherUser.id);

      expect(myTemplates).toHaveLength(1);
      expect(myTemplates[0].name).toBe('My Template');
      expect(otherTemplates).toHaveLength(1);
      expect(otherTemplates[0].name).toBe('Other Template');
    });
  });

  describe('Edit Template Workflow', () => {
    it('should update template name', () => {
      const template = dbService.createMixTemplate(
        userId,
        'Original Name',
        'Original description',
        'custom',
        { trackCount: 50 }
      );

      dbService.updateMixTemplate(template.id, {
        name: 'Updated Name'
      });

      const updated = dbService.getMixTemplateById(template.id);
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.description).toBe('Original description'); // Unchanged
      expect(updated!.updated_at).toBeGreaterThan(template.updated_at);
    });

    it('should update template description', () => {
      const template = dbService.createMixTemplate(
        userId,
        'Test Template',
        'Original description',
        'custom',
        { trackCount: 50 }
      );

      dbService.updateMixTemplate(template.id, {
        description: 'Updated description'
      });

      const updated = dbService.getMixTemplateById(template.id);
      expect(updated!.description).toBe('Updated description');
      expect(updated!.name).toBe('Test Template'); // Unchanged
    });

    it('should update template configuration', () => {
      const originalConfig = {
        mixType: 'custom',
        trackCount: 50,
        customRules: { includeGenres: ['Rock'] }
      };

      const template = dbService.createMixTemplate(
        userId,
        'Test Template',
        null,
        'custom',
        originalConfig
      );

      const newConfig = {
        mixType: 'custom',
        trackCount: 100,
        customRules: { includeGenres: ['Rock', 'Alternative'], minRating: 8 }
      };

      dbService.updateMixTemplate(template.id, {
        configuration: newConfig
      });

      const updated = dbService.getMixTemplateById(template.id);
      expect(updated!.configuration.trackCount).toBe(100);
      expect(updated!.configuration.customRules.includeGenres).toHaveLength(2);
      expect(updated!.configuration.customRules.minRating).toBe(8);
    });

    it('should update multiple fields at once', () => {
      const template = dbService.createMixTemplate(
        userId,
        'Original Name',
        'Original description',
        'custom',
        { trackCount: 50 }
      );

      dbService.updateMixTemplate(template.id, {
        name: 'New Name',
        description: 'New description',
        configuration: { trackCount: 75, customRules: {} }
      });

      const updated = dbService.getMixTemplateById(template.id);
      expect(updated!.name).toBe('New Name');
      expect(updated!.description).toBe('New description');
      expect(updated!.configuration.trackCount).toBe(75);
    });
  });

  describe('Delete Template Workflow', () => {
    it('should delete a template', () => {
      const template = dbService.createMixTemplate(
        userId,
        'Template to Delete',
        null,
        'custom',
        { trackCount: 50 }
      );

      dbService.deleteMixTemplate(template.id);

      const deleted = dbService.getMixTemplateById(template.id);
      expect(deleted).toBeNull();
    });

    it('should not affect other templates when deleting one', () => {
      const template1 = dbService.createMixTemplate(userId, 'Template 1', null, 'custom', { trackCount: 50 });
      const template2 = dbService.createMixTemplate(userId, 'Template 2', null, 'custom', { trackCount: 50 });
      const template3 = dbService.createMixTemplate(userId, 'Template 3', null, 'custom', { trackCount: 50 });

      dbService.deleteMixTemplate(template2.id);

      const remaining = dbService.getMixTemplates(userId);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(t => t.id)).toContain(template1.id);
      expect(remaining.map(t => t.id)).toContain(template3.id);
      expect(remaining.map(t => t.id)).not.toContain(template2.id);
    });
  });

  describe('Quick Generate Workflow', () => {
    it('should update template usage statistics after generation', () => {
      const template = dbService.createMixTemplate(
        userId,
        'Test Mix',
        null,
        'custom',
        { trackCount: 50 }
      );

      expect(template.use_count).toBe(0);
      expect(template.last_used_at).toBeUndefined();

      // Simulate usage
      dbService.updateMixTemplateUsage(template.id);

      const updated = dbService.getMixTemplateById(template.id);
      expect(updated!.use_count).toBe(1);
      expect(updated!.last_used_at).toBeDefined();
      expect(updated!.last_used_at).toBeGreaterThan(0);
    });

    it('should increment use count on multiple generations', () => {
      const template = dbService.createMixTemplate(
        userId,
        'Test Mix',
        null,
        'custom',
        { trackCount: 50 }
      );

      dbService.updateMixTemplateUsage(template.id);
      dbService.updateMixTemplateUsage(template.id);
      dbService.updateMixTemplateUsage(template.id);

      const updated = dbService.getMixTemplateById(template.id);
      expect(updated!.use_count).toBe(3);
    });
  });

  describe('Templates with Missing Plex Items', () => {
    it('should preserve template even when all items are missing', () => {
      const configuration = {
        mixType: 'artist',
        trackCount: 50,
        artistIds: ['missing-1', 'missing-2', 'missing-3']
      };

      const template = dbService.createMixTemplate(
        userId,
        'All Missing Artists',
        'This template has artists that no longer exist',
        'artist',
        configuration
      );

      // Template should still be saved
      const saved = dbService.getMixTemplateById(template.id);
      expect(saved).not.toBeNull();
      expect(saved!.configuration.artistIds).toHaveLength(3);
    });

    it('should handle genre template with non-existent genres', () => {
      const configuration = {
        mixType: 'genre',
        trackCount: 50,
        genres: ['Rock', 'NonExistentGenre', 'Jazz']
      };

      const template = dbService.createMixTemplate(
        userId,
        'Genre Mix',
        null,
        'genre',
        configuration
      );

      // Verify template was saved with all genres
      const saved = dbService.getMixTemplateById(template.id);
      expect(saved!.configuration.genres).toHaveLength(3);
      expect(saved!.configuration.genres).toContain('NonExistentGenre');
    });
  });

  describe('Template Persistence', () => {
    it('should persist templates across database sessions', () => {
      const configuration = {
        mixType: 'custom',
        trackCount: 50,
        customRules: { includeGenres: ['Rock'] }
      };

      const template = dbService.createMixTemplate(
        userId,
        'Persistent Template',
        'Should survive database restart',
        'custom',
        configuration
      );

      // Create new database service instance (simulating restart)
      const newDbService = new DatabaseService(db);
      const loaded = newDbService.getMixTemplateById(template.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Persistent Template');
      expect(loaded!.configuration).toEqual(configuration);
    });

    it('should maintain template relationships after user operations', () => {
      const template1 = dbService.createMixTemplate(userId, 'Template 1', null, 'custom', { trackCount: 50 });
      const template2 = dbService.createMixTemplate(userId, 'Template 2', null, 'custom', { trackCount: 50 });

      // Update one template
      dbService.updateMixTemplate(template1.id, { name: 'Updated Template 1' });

      // Both templates should still exist
      const templates = dbService.getMixTemplates(userId);
      expect(templates).toHaveLength(2);
      expect(templates.find(t => t.id === template1.id)!.name).toBe('Updated Template 1');
      expect(templates.find(t => t.id === template2.id)!.name).toBe('Template 2');
    });
  });

  describe('Complex Configuration Scenarios', () => {
    it('should handle custom mix with all filter types', () => {
      const configuration = {
        mixType: 'custom',
        trackCount: 100,
        sortBy: 'rating',
        sortDirection: 'desc',
        customRules: {
          playedInLastDays: 7,
          notPlayedInLastDays: 30,
          addedInLastDays: 90,
          yearRange: { min: 1990, max: 2020 },
          includeGenres: ['Rock', 'Alternative', 'Indie'],
          excludeGenres: ['Country', 'Pop'],
          minRating: 8,
          maxRating: 10,
          includeUnplayed: false
        }
      };

      const template = dbService.createMixTemplate(
        userId,
        'Complex Custom Mix',
        'Uses all available filters',
        'custom',
        configuration
      );

      const saved = dbService.getMixTemplateById(template.id);
      expect(saved!.configuration.customRules.playedInLastDays).toBe(7);
      expect(saved!.configuration.customRules.notPlayedInLastDays).toBe(30);
      expect(saved!.configuration.customRules.addedInLastDays).toBe(90);
      expect(saved!.configuration.customRules.yearRange).toEqual({ min: 1990, max: 2020 });
      expect(saved!.configuration.customRules.includeGenres).toHaveLength(3);
      expect(saved!.configuration.customRules.excludeGenres).toHaveLength(2);
      expect(saved!.configuration.customRules.minRating).toBe(8);
      expect(saved!.configuration.customRules.maxRating).toBe(10);
      expect(saved!.configuration.customRules.includeUnplayed).toBe(false);
    });

    it('should handle artist mix with advanced options', () => {
      const configuration = {
        mixType: 'artist',
        trackCount: 60,
        artistIds: ['artist-1', 'artist-2', 'artist-3', 'artist-4', 'artist-5'],
        maxTracksPerArtist: 12,
        allowDuplicateArtists: true,
        sortBy: 'playCount',
        sortDirection: 'desc'
      };

      const template = dbService.createMixTemplate(
        userId,
        'Top Artists Mix',
        'Most played tracks from favorite artists',
        'artist',
        configuration
      );

      const saved = dbService.getMixTemplateById(template.id);
      expect(saved!.configuration.artistIds).toHaveLength(5);
      expect(saved!.configuration.maxTracksPerArtist).toBe(12);
      expect(saved!.configuration.allowDuplicateArtists).toBe(true);
      expect(saved!.configuration.sortBy).toBe('playCount');
    });
  });
});
