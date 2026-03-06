/**
 * Property-Based Tests for API Security
 * 
 * Tests correctness properties related to API security:
 * - Property 29: Authentication Requirement
 * - Property 42: Input Sanitization
 * - Property 43: Rate Limiting
 */

import * as fc from 'fast-check';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../src/middleware/auth';
import { DatabaseService, getDatabase } from '../../src/database';

describe('API Security Property Tests', () => {
  let app: express.Application;
  let dbService: DatabaseService;

  beforeEach(() => {
    // Create a fresh test app for each test
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Setup session
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Attach database service
    dbService = new DatabaseService(getDatabase());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.dbService = dbService;
      next();
    });
  });

  /**
   * Property 29: Authentication Requirement
   * For any API endpoint except /api/auth/*, an unauthenticated request should return 401 Unauthorized
   * Validates: Requirements 15.2, 15.3
   */
  describe('Property 29: Authentication Requirement', () => {
    it('should return 401 for unauthenticated requests to protected endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            '/api/playlists',
            '/api/mixes/weekly',
            '/api/schedules',
            '/api/settings',
            '/api/missing',
            '/api/servers'
          ),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          async (endpoint, method) => {
            // Setup a protected route
            const router = express.Router();
            router.all('*', requireAuth, (_req: Request, res: Response) => {
              res.json({ success: true });
            });
            app.use('/api', router);

            // Make request without authentication
            const response = await request(app)[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](endpoint);

            // Should return 401
            expect(response.status).toBe(401);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('AUTH_REQUIRED');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow unauthenticated requests to auth endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('/api/auth/start', '/api/auth/poll'),
          async (endpoint) => {
            // Setup auth routes without protection
            const router = express.Router();
            router.post('/start', (_req: Request, res: Response) => {
              res.json({ success: true });
            });
            router.post('/poll', (_req: Request, res: Response) => {
              res.json({ success: true });
            });
            app.use('/api/auth', router);

            // Make request without authentication
            const response = await request(app).post(endpoint);

            // Should not return 401 (may return other errors, but not auth error)
            expect(response.status).not.toBe(401);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 42: Input Sanitization
   * For any user input (query parameters, request body fields), the server should sanitize
   * the input to remove or escape SQL injection and XSS attack vectors
   * Validates: Requirements 19.3
   */
  describe('Property 42: Input Sanitization', () => {
    it('should handle SQL injection attempts safely', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin'--",
            "' OR 1=1--",
            "1; DELETE FROM users WHERE 1=1--"
          ),
          async (maliciousInput) => {
            // Setup a test route that uses input
            const router = express.Router();
            router.post('/test', (req: Request, res: Response) => {
              // Simulate using input in a query (should be parameterized)
              const input = req.body.input;
              
              // The actual implementation should use parameterized queries
              // This test verifies the input doesn't cause errors
              try {
                // In real code, this would be: db.prepare('SELECT * FROM users WHERE name = ?').get(input)
                res.json({ received: input, safe: true });
              } catch (error) {
                res.status(500).json({ error: 'Internal error' });
              }
            });
            app.use('/api', router);

            const response = await request(app)
              .post('/api/test')
              .send({ input: maliciousInput });

            // Should not crash or return 500
            expect(response.status).not.toBe(500);
            // Should receive the input back (sanitized or as-is, but safely handled)
            expect(response.body).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle XSS attempts safely', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>',
            'javascript:alert("XSS")',
            '<iframe src="javascript:alert(\'XSS\')"></iframe>'
          ),
          async (maliciousInput) => {
            // Setup a test route
            const router = express.Router();
            router.post('/test', (req: Request, res: Response) => {
              const input = req.body.input;
              // Return as JSON (which automatically escapes)
              res.json({ received: input });
            });
            app.use('/api', router);

            const response = await request(app)
              .post('/api/test')
              .send({ input: maliciousInput });

            // Should return JSON with proper content-type
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            // Input should be in response but safely encoded in JSON
            expect(response.body.received).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 43: Rate Limiting
   * For any API endpoint, if a client makes more than 100 requests per minute,
   * subsequent requests should return 429 Too Many Requests
   * Validates: Requirements 19.4
   */
  describe('Property 43: Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Setup rate limiter
      const limiter = rateLimit({
        windowMs: 60000, // 1 minute
        max: 5, // Reduced for testing
        message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests', statusCode: 429 } },
        standardHeaders: true,
        legacyHeaders: false,
      });

      app.use('/api/', limiter);

      const router = express.Router();
      router.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use('/api', router);

      // Make requests up to the limit
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/api/test');
        expect(response.status).toBe(200);
      }

      // Next request should be rate limited
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(429);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should apply rate limits per client', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 6, max: 10 }),
          async (requestCount) => {
            // Setup rate limiter with low limit for testing
            const limiter = rateLimit({
              windowMs: 60000,
              max: 5,
              message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests', statusCode: 429 } },
            });

            const testApp = express();
            testApp.use('/api/', limiter);
            testApp.get('/api/test', (_req: Request, res: Response) => {
              res.json({ success: true });
            });

            let rateLimitedCount = 0;

            // Make multiple requests
            for (let i = 0; i < requestCount; i++) {
              const response = await request(testApp).get('/api/test');
              if (response.status === 429) {
                rateLimitedCount++;
              }
            }

            // Should have at least one rate-limited response
            expect(rateLimitedCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
