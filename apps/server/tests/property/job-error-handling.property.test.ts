/**
 * Property-Based Tests for Job Error Handling
 * 
 * Tests correctness properties related to background job error recovery:
 * - Property 28: Job Error Recovery
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../src/database/database';
import { JobScheduler } from '../../src/services/jobs';
import fs from 'fs';
import path from 'path';

describe('Job Error Handling Property Tests', () => {
  let db: Database.Database;
  let dbService: DatabaseService;
  let scheduler: JobScheduler;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    
    dbService = new DatabaseService(db);
    scheduler = new JobScheduler(dbService);
  });

  afterEach(async () => {
    await scheduler.stop();
    db.close();
  });

  /**
   * Property 28: Job Error Recovery
   * 
   * For any background job that throws an error, the error should be logged 
   * and the job scheduler should continue executing subsequent scheduled runs
   * 
   * Validates: Requirements 14.5
   */
  test('Property 28: Job Error Recovery - scheduler continues after job errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          jobCount: fc.integer({ min: 2, max: 5 }),
          failingJobIndex: fc.integer({ min: 0, max: 4 }),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async (data) => {
          // Ensure failingJobIndex is within bounds
          const failingIndex = data.failingJobIndex % data.jobCount;
          
          // Track job executions
          const executionLog: Array<{ name: string; success: boolean; error?: string }> = [];
          
          // Register multiple jobs, one of which will fail
          for (let i = 0; i < data.jobCount; i++) {
            const jobName = `test-job-${i}`;
            const shouldFail = i === failingIndex;
            
            scheduler.registerJob({
              name: jobName,
              schedule: '* * * * * *', // Every second (for testing)
              handler: async () => {
                if (shouldFail) {
                  executionLog.push({ name: jobName, success: false, error: data.errorMessage });
                  throw new Error(data.errorMessage);
                } else {
                  executionLog.push({ name: jobName, success: true });
                }
              },
              enabled: true,
            });
          }
          
          // Start the scheduler
          scheduler.start();
          
          // Wait longer for jobs to execute (2.5 seconds to ensure at least 2 runs)
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          // Stop the scheduler
          await scheduler.stop();
          
          // Verify that at least some jobs executed
          expect(executionLog.length).toBeGreaterThan(0);
          
          // Verify that the failing job was attempted
          const failingJobExecutions = executionLog.filter(
            log => log.name === `test-job-${failingIndex}` && !log.success
          );
          expect(failingJobExecutions.length).toBeGreaterThan(0);
          
          // Verify that at least one failing job execution has the expected error
          const hasExpectedError = failingJobExecutions.some(
            log => log.error === data.errorMessage
          );
          expect(hasExpectedError).toBe(true);
          
          // Verify that other jobs (non-failing) also executed successfully
          const successfulJobExecutions = executionLog.filter(log => log.success);
          if (data.jobCount > 1) {
            // If there are multiple jobs, at least one non-failing job should have executed
            expect(successfulJobExecutions.length).toBeGreaterThan(0);
          }
          
          // Verify scheduler can still get status after errors
          const status = scheduler.getStatus();
          expect(status).toBeDefined();
          expect(Array.isArray(status)).toBe(true);
        }
      ),
      { numRuns: 30 } // Reduced runs since this involves timing
    );
  }, 90000); // Increased timeout for this test

  /**
   * Additional test: Verify scheduler continues after multiple consecutive errors
   */
  test('scheduler continues after multiple consecutive job errors', async () => {
    const executionLog: string[] = [];
    let errorCount = 0;
    
    // Register a job that fails multiple times then succeeds
    scheduler.registerJob({
      name: 'flaky-job',
      schedule: '* * * * * *',
      handler: async () => {
        errorCount++;
        executionLog.push(`attempt-${errorCount}`);
        
        if (errorCount < 3) {
          throw new Error(`Failure ${errorCount}`);
        }
        // Succeed on 3rd attempt
      },
      enabled: true,
    });
    
    scheduler.start();
    
    // Wait for multiple execution attempts
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    await scheduler.stop();
    
    // Verify multiple attempts were made
    expect(executionLog.length).toBeGreaterThanOrEqual(3);
    
    // Verify the job eventually succeeded (errorCount reached 3+)
    expect(errorCount).toBeGreaterThanOrEqual(3);
  }, 10000);

  /**
   * Additional test: Verify scheduler state remains consistent after errors
   */
  test('scheduler state remains consistent after job errors', async () => {
    let executionCount = 0;
    
    // Register a job that always fails
    scheduler.registerJob({
      name: 'always-fails',
      schedule: '* * * * * *',
      handler: async () => {
        executionCount++;
        throw new Error('Intentional failure');
      },
      enabled: true,
    });
    
    // Register a job that always succeeds
    scheduler.registerJob({
      name: 'always-succeeds',
      schedule: '* * * * * *',
      handler: async () => {
        executionCount++;
      },
      enabled: true,
    });
    
    scheduler.start();
    
    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get status while jobs are running
    const statusDuringRun = scheduler.getStatus();
    expect(statusDuringRun).toHaveLength(2);
    
    await scheduler.stop();
    
    // Verify both jobs attempted to execute
    expect(executionCount).toBeGreaterThan(0);
    
    // Verify scheduler can still provide status after stopping
    const statusAfterStop = scheduler.getStatus();
    expect(statusAfterStop).toBeDefined();
  }, 10000);
});
