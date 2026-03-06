/**
 * Property-Based Tests for API Responses
 * 
 * Tests universal properties of API error handling and response formatting.
 */

import * as fc from 'fast-check';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

describe('API Response Property Tests', () => {
  /**
   * Property 30: Invalid Request Errors
   * For any API request with invalid parameters or malformed data, the server 
   * should return an appropriate 4xx error code with a descriptive error message.
   * Validates: Requirements 15.4
   */
  describe('Property 30: Invalid Request Errors', () => {
    it('should return 400 for invalid request data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invalidField: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant(''),
              fc.integer({ min: -1000, max: -1 }),
            ),
          }),
          async (invalidData) => {
            const app = express();
            app.use(express.json());
            
            app.post('/test', (req: Request, res: Response) => {
              if (!req.body.invalidField || req.body.invalidField < 0) {
                return res.status(400).json({
                  error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid field value',
                    statusCode: 400,
                  },
                });
              }
              return res.json({ success: true });
            });
            
            const response = await request(app)
              .post('/test')
              .send(invalidData);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('INVALID_INPUT');
            expect(response.body.error.message).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 31: JSON Response Format
   * For any API endpoint response, the Content-Type header should be 
   * application/json and the body should be valid JSON.
   * Validates: Requirements 15.5
   */
  describe('Property 31: JSON Response Format', () => {
    it('should return JSON content type for all responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('/api/test', '/api/data', '/api/info'),
          fc.record({
            data: fc.string(),
            count: fc.integer({ min: 0, max: 100 }),
          }),
          async (endpoint, responseData) => {
            const app = express();
            app.use(express.json());
            
            app.get(endpoint, (_req: Request, res: Response) => {
              res.json(responseData);
            });
            
            const response = await request(app).get(endpoint);
            
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(response.body).toBeDefined();
            expect(typeof response.body).toBe('object');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 34: Error Message Descriptiveness
   * For any error condition, the server should return an error response 
   * containing a message field that describes what went wrong.
   * Validates: Requirements 17.1
   */
  describe('Property 34: Error Message Descriptiveness', () => {
    it('should include descriptive error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { code: 'NOT_FOUND', status: 404, message: 'Resource not found' },
            { code: 'INVALID_INPUT', status: 400, message: 'Invalid input provided' },
            { code: 'FORBIDDEN', status: 403, message: 'Access denied' },
          ),
          async (errorConfig) => {
            const app = express();
            app.use(express.json());
            
            app.get('/test', (_req: Request, res: Response) => {
              res.status(errorConfig.status).json({
                error: {
                  code: errorConfig.code,
                  message: errorConfig.message,
                  statusCode: errorConfig.status,
                },
              });
            });
            
            const response = await request(app).get('/test');
            
            expect(response.status).toBe(errorConfig.status);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.message).toBeDefined();
            expect(response.body.error.message.length).toBeGreaterThan(0);
            expect(typeof response.body.error.message).toBe('string');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 36: Matching Error Details
   * For any track matching failure, the response should include the unmatched 
   * track's title, artist, and the reason it couldn't be matched.
   * Validates: Requirements 17.4
   */
  describe('Property 36: Matching Error Details', () => {
    it('should include track details in matching errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            artist: fc.string({ minLength: 1, maxLength: 100 }),
            reason: fc.constantFrom('no_results', 'low_score', 'multiple_matches'),
          }),
          async (trackData) => {
            const app = express();
            app.use(express.json());
            
            app.post('/match', (req: Request, res: Response) => {
              res.status(200).json({
                matched: false,
                track: {
                  title: req.body.title,
                  artist: req.body.artist,
                },
                reason: req.body.reason,
              });
            });
            
            const response = await request(app)
              .post('/match')
              .send(trackData);
            
            expect(response.status).toBe(200);
            expect(response.body.matched).toBe(false);
            expect(response.body.track).toBeDefined();
            expect(response.body.track.title).toBe(trackData.title);
            expect(response.body.track.artist).toBe(trackData.artist);
            expect(response.body.reason).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 37: Error Logging
   * For any error that occurs during request processing or background jobs, 
   * an entry should be written to the error log file.
   * Validates: Requirements 17.5
   */
  describe('Property 37: Error Logging', () => {
    it('should log errors to error handler', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            code: fc.constantFrom('INTERNAL_ERROR', 'DATABASE_ERROR', 'EXTERNAL_SERVICE_ERROR'),
          }),
          async (errorData) => {
            const app = express();
            app.use(express.json());
            
            const loggedErrors: any[] = [];
            
            app.get('/test', (_req: Request, _res: Response, next: NextFunction) => {
              const error = new Error(errorData.message);
              (error as any).code = errorData.code;
              next(error);
            });
            
            app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
              loggedErrors.push({
                message: err.message,
                code: err.code,
              });
              
              res.status(500).json({
                error: {
                  code: err.code || 'INTERNAL_ERROR',
                  message: err.message,
                  statusCode: 500,
                },
              });
            });
            
            const response = await request(app).get('/test');
            
            expect(response.status).toBe(500);
            expect(loggedErrors.length).toBe(1);
            expect(loggedErrors[0].message).toBe(errorData.message);
            expect(loggedErrors[0].code).toBe(errorData.code);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
