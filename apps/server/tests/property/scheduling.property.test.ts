/**
 * Property-Based Tests for Scheduling
 * 
 * Tests universal properties of schedule management, including schedule
 * persistence, due schedule execution, and timestamp updates.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/database/init';
import { DatabaseService } from '../../src/database/database';
import { SchedulerService } from '../../src/services/scheduler';
import { ScheduleType, ScheduleFrequency } from '../../src/database/types';
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

/**
 * Arbitrary generator for schedule frequency
 */
const scheduleFrequencyArb = fc.constantFrom<ScheduleFrequency>('daily', 'weekly', 'fortnightly', 'monthly');

/**
 * Arbitrary generator for schedule type
 */
const scheduleTypeArb = fc.constantFrom<ScheduleType>('playlist_refresh', 'mix_generation');

/**
 * Arbitrary generator for mix types configuration
 */
const mixTypesConfigArb = fc.array(
  fc.constantFrom('weekly', 'daily', 'timecapsule', 'newmusic'),
  { minLength: 1, maxLength: 4 }
).map(types => ({ mixTypes: types }));

describe('Scheduling Property Tests', () => {
  describe('Property 17: Schedule Persistence', () => {
    /**
     * **Validates: Requirements 6.2, 7.2**
     * 
     * For any schedule creation (mix generation or playlist refresh), 
     * the schedule configuration should be stored in the database and 
     * retrievable by user ID.
     */
    it('should persist and retrieve schedule configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate schedule data
          fc.record({
            scheduleType: scheduleTypeArb,
            frequency: scheduleFrequencyArb,
            startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            config: fc.option(mixTypesConfigArb, { nil: undefined }),
          }),
          async (userData, scheduleData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create playlist if schedule type is playlist_refresh
              let playlistId: number | undefined;
              if (scheduleData.scheduleType === 'playlist_refresh') {
                const playlist = dbService.createPlaylist(
                  user.id,
                  'plex-playlist-123',
                  'Test Playlist',
                  'spotify',
                  'https://spotify.com/playlist/123'
                );
                playlistId = playlist.id;
              }
              
              // Create schedule
              const schedule = dbService.createSchedule(user.id, {
                playlist_id: playlistId,
                schedule_type: scheduleData.scheduleType,
                frequency: scheduleData.frequency,
                start_date: scheduleData.startDate,
                config: scheduleData.config, // Pass as object, not stringified
              });
              
              // Verify schedule was created
              expect(schedule).toBeDefined();
              expect(schedule.id).toBeGreaterThan(0);
              expect(schedule.user_id).toBe(user.id);
              expect(schedule.schedule_type).toBe(scheduleData.scheduleType);
              expect(schedule.frequency).toBe(scheduleData.frequency);
              expect(schedule.start_date).toBe(scheduleData.startDate);
              
              if (scheduleData.scheduleType === 'playlist_refresh') {
                expect(schedule.playlist_id).toBe(playlistId);
              }
              
              if (scheduleData.config) {
                const storedConfig = typeof schedule.config === 'string' 
                  ? schedule.config 
                  : JSON.stringify(schedule.config);
                expect(storedConfig).toBe(JSON.stringify(scheduleData.config));
              }
              
              // Retrieve schedules by user ID
              const userSchedules = dbService.getUserSchedules(user.id);
              expect(userSchedules.length).toBeGreaterThan(0);
              
              const retrievedSchedule = userSchedules.find(s => s.id === schedule.id);
              expect(retrievedSchedule).toBeDefined();
              expect(retrievedSchedule!.schedule_type).toBe(scheduleData.scheduleType);
              expect(retrievedSchedule!.frequency).toBe(scheduleData.frequency);
              expect(retrievedSchedule!.start_date).toBe(scheduleData.startDate);
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: Due Schedule Execution', () => {
    /**
     * **Validates: Requirements 6.4, 7.4**
     * 
     * For any schedule that is due (current time >= next run time based on 
     * frequency), the server should execute the scheduled action (generate 
     * mix or refresh playlist).
     */
    it('should identify and return due schedules', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate schedule data with controlled last_run
          fc.record({
            scheduleType: scheduleTypeArb,
            frequency: scheduleFrequencyArb,
            startDate: fc.constant('2020-01-01'), // Fixed past date
            // Generate last_run that makes schedule due or not due
            isDue: fc.boolean(),
          }),
          async (userData, scheduleData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            const schedulerService = new SchedulerService();
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create schedule
              const schedule = dbService.createSchedule(user.id, {
                schedule_type: scheduleData.scheduleType,
                frequency: scheduleData.frequency,
                start_date: scheduleData.startDate,
                config: scheduleData.scheduleType === 'mix_generation' 
                  ? { mixTypes: ['weekly'] } 
                  : undefined,
              });
              
              // Set last_run to make schedule due or not due
              if (!scheduleData.isDue) {
                // Set last_run to current time (not due)
                const now = Math.floor(Date.now() / 1000);
                dbService.updateScheduleLastRun(schedule.id, now);
              }
              // If isDue is true, leave last_run as null (always due)
              
              // Get due schedules
              const dueSchedules = schedulerService.getDueSchedules(dbService);
              
              // Verify schedule is in due list if it should be
              const foundSchedule = dueSchedules.find(s => s.id === schedule.id);
              
              if (scheduleData.isDue) {
                // Schedule should be in due list
                expect(foundSchedule).toBeDefined();
                expect(foundSchedule!.id).toBe(schedule.id);
                expect(foundSchedule!.schedule_type).toBe(scheduleData.scheduleType);
              } else {
                // Schedule should NOT be in due list (just ran)
                expect(foundSchedule).toBeUndefined();
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

  describe('Property 19: Schedule Timestamp Update', () => {
    /**
     * **Validates: Requirements 6.5, 7.5**
     * 
     * For any completed scheduled action, the schedule's last run timestamp 
     * should be updated to the current time.
     */
    it('should update last_run timestamp after schedule execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate schedule data
          fc.record({
            scheduleType: scheduleTypeArb,
            frequency: scheduleFrequencyArb,
            startDate: fc.constant('2020-01-01'),
          }),
          async (userData, scheduleData) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create schedule
              const schedule = dbService.createSchedule(user.id, {
                schedule_type: scheduleData.scheduleType,
                frequency: scheduleData.frequency,
                start_date: scheduleData.startDate,
                config: scheduleData.scheduleType === 'mix_generation' 
                  ? { mixTypes: ['weekly'] } 
                  : undefined,
              });
              
              // Verify initial state (no last_run or null)
              const initialSchedule = dbService.getScheduleById(schedule.id);
              expect(initialSchedule).toBeDefined();
              expect(initialSchedule!.last_run).toBeFalsy(); // null or undefined
              
              // Record time before update
              const beforeUpdate = Math.floor(Date.now() / 1000);
              
              // Update last_run timestamp
              dbService.updateScheduleLastRun(schedule.id);
              
              // Record time after update
              const afterUpdate = Math.floor(Date.now() / 1000);
              
              // Retrieve updated schedule
              const updatedSchedule = dbService.getScheduleById(schedule.id);
              expect(updatedSchedule).toBeDefined();
              expect(updatedSchedule!.last_run).toBeDefined();
              
              // Verify timestamp is within reasonable range
              expect(updatedSchedule!.last_run).toBeGreaterThanOrEqual(beforeUpdate);
              expect(updatedSchedule!.last_run).toBeLessThanOrEqual(afterUpdate);
              
              // Verify schedule is no longer due immediately after update
              const dueSchedules = dbService.getDueSchedules();
              const foundSchedule = dueSchedules.find(s => s.id === schedule.id);
              expect(foundSchedule).toBeUndefined();
              
            } finally {
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept custom timestamp for last_run update', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user data
          fc.record({
            plexUserId: fc.string({ minLength: 1, maxLength: 50 }),
            plexUsername: fc.string({ minLength: 1, maxLength: 50 }),
            plexToken: fc.string({ minLength: 20, maxLength: 200 }),
          }),
          // Generate custom timestamp
          fc.integer({ min: 1577836800, max: 1893456000 }), // 2020-2030 range
          async (userData, customTimestamp) => {
            const db = createTestDatabase();
            const dbService = new DatabaseService(db);
            
            try {
              // Create user
              const user = dbService.createUser(
                userData.plexUserId,
                userData.plexUsername,
                userData.plexToken
              );
              
              // Create schedule
              const schedule = dbService.createSchedule(user.id, {
                schedule_type: 'mix_generation',
                frequency: 'daily',
                start_date: '2020-01-01',
                config: { mixTypes: ['weekly'] },
              });
              
              // Update with custom timestamp
              dbService.updateScheduleLastRun(schedule.id, customTimestamp);
              
              // Retrieve and verify
              const updatedSchedule = dbService.getScheduleById(schedule.id);
              expect(updatedSchedule).toBeDefined();
              expect(updatedSchedule!.last_run).toBe(customTimestamp);
              
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
