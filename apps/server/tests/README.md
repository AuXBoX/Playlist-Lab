# Test Suite Documentation

This directory contains all tests for the Playlist Lab Web Server, organized into three categories: property-based tests, unit tests, and integration tests.

## Directory Structure

```
tests/
├── property/           # Property-based tests (45 properties)
├── unit/              # Unit tests (specific examples)
├── integration/       # Integration tests (end-to-end workflows)
└── README.md          # This file
```

## Test Categories

### Property-Based Tests (`property/`)

Property-based tests validate universal correctness properties that should hold true across all valid inputs. These tests use the `fast-check` library to generate hundreds of random test cases.

**Key Characteristics:**
- Each test runs 100+ iterations with random inputs
- Tests universal properties, not specific examples
- Validates correctness across the entire input space
- Uses `fast-check` library for property-based testing

**Files:**
- `auth.property.test.ts` - Authentication and session properties
- `data-isolation.property.test.ts` - User data isolation properties
- `import.property.test.ts` - Import workflow properties
- `cache.property.test.ts` - Cache management properties
- `mixes.property.test.ts` - Mix generation properties
- `scheduling.property.test.ts` - Schedule execution properties
- `missing-tracks.property.test.ts` - Missing tracks properties
- `matching.property.test.ts` - Matching settings properties
- `admin.property.test.ts` - Admin features properties
- `database-schema.property.test.ts` - Database schema properties
- `session.property.test.ts` - Session management properties
- `job-error-handling.property.test.ts` - Background job properties
- `api-security.property.test.ts` - API security properties
- `api-responses.property.test.ts` - API response properties
- `migration.property.test.ts` - Data migration properties
- `performance.property.test.ts` - Performance and configuration properties

**Total Properties:** 45

### Unit Tests (`unit/`)

Unit tests validate specific examples and edge cases for individual functions, classes, and modules.

**Key Characteristics:**
- Test specific examples with known inputs/outputs
- Test edge cases (empty inputs, boundary values, errors)
- Mock external dependencies
- Fast execution (< 5 seconds total)

**Files:**
- `auth.test.ts` - Authentication service tests
- `database.test.ts` - Database operations tests
- `matching.test.ts` - Matching algorithm tests
- `plex.test.ts` - Plex API client tests
- `schedules.test.ts` - Schedule operations tests
- `scrapers.test.ts` - External service scraper tests

**Coverage Goal:** > 80% (statements, branches, functions, lines)

### Integration Tests (`integration/`)

Integration tests validate end-to-end workflows that involve multiple components working together.

**Key Characteristics:**
- Test complete workflows from start to finish
- Use real database (in-memory SQLite)
- Mock only external services (Plex API, scrapers)
- Validate data flow between components

**Files:**
- `import.integration.test.ts` - Full import workflow
  - Cache-first logic
  - Scraping fallback
  - Track matching
  - Missing tracks storage
  - Playlist creation

- `mixes.integration.test.ts` - Mix generation workflow
  - Play history fetching
  - Mix algorithm execution
  - Playlist creation in Plex
  - Settings application

## Running Tests

### Run All Tests

```bash
# Run all tests (property + unit + integration)
npm test

# Run all tests with coverage
npm run test:coverage
```

### Run Specific Test Categories

```bash
# Run only property tests
npm run test:property

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Run Specific Test Files

```bash
# Run a specific property test
npx jest tests/property/auth.property.test.ts

# Run a specific unit test
npx jest tests/unit/database.test.ts

# Run a specific integration test
npx jest tests/integration/import.integration.test.ts
```

### Run Tests in Watch Mode

```bash
# Watch all tests
npm run test:watch

# Watch specific category
npm run test:property -- --watch
```

## Test Configuration

Tests are configured in `jest.config.js`:

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

## Property Test Format

Each property test follows this format:

```typescript
describe('Feature Property Tests', () => {
  describe('Property N: Property Name', () => {
    /**
     * **Validates: Requirements X.Y**
     * 
     * For any [input description], [expected behavior].
     */
    it('should [behavior description]', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generators for random inputs
          fc.string(),
          fc.integer(),
          async (input1, input2) => {
            // Test setup
            const db = createTestDatabase();
            
            try {
              // Test execution
              const result = await someFunction(input1, input2);
              
              // Assertions
              expect(result).toBeDefined();
              expect(result).toSatisfyProperty();
              
            } finally {
              // Cleanup
              cleanupTestDatabase(db);
            }
          }
        ),
        { numRuns: 100 } // Run 100+ iterations
      );
    });
  });
});
```

## Unit Test Format

Each unit test follows this format:

```typescript
describe('Module Name', () => {
  describe('functionName', () => {
    it('should handle normal case', () => {
      const result = functionName('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      const result = functionName('');
      expect(result).toBe('default');
    });

    it('should throw error for invalid input', () => {
      expect(() => functionName(null)).toThrow();
    });
  });
});
```

## Integration Test Format

Each integration test follows this format:

```typescript
describe('Workflow Name Integration', () => {
  let db: Database.Database;
  let dbService: DatabaseService;

  beforeEach(() => {
    db = createTestDatabase();
    dbService = new DatabaseService(db);
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  it('should complete full workflow', async () => {
    // Step 1: Setup
    const user = dbService.createUser(...);
    
    // Step 2: Execute workflow
    const result = await executeWorkflow(...);
    
    // Step 3: Verify results
    expect(result).toBeDefined();
    
    // Step 4: Verify side effects
    const playlist = dbService.getPlaylist(...);
    expect(playlist).toBeDefined();
  });
});
```

## Test Utilities

### Database Utilities

```typescript
// Create in-memory test database
function createTestDatabase(): Database.Database {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-lab-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  return initializeDatabase(dbPath);
}

// Cleanup test database
function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = db.name;
  db.close();
  if (dbPath && dbPath !== ':memory:') {
    fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  }
}
```

### Mock Utilities

```typescript
// Mock Plex API responses
jest.mock('../../src/services/plex', () => ({
  searchTrack: jest.fn().mockResolvedValue([...]),
  getPlayHistory: jest.fn().mockResolvedValue([...]),
  createPlaylist: jest.fn().mockResolvedValue({ id: '123' }),
}));

// Mock external scrapers
jest.mock('../../src/services/scrapers', () => ({
  scrapeSpotifyPlaylist: jest.fn().mockResolvedValue({...}),
  scrapeDeezerPlaylist: jest.fn().mockResolvedValue({...}),
}));
```

## Coverage Reports

Generate coverage reports:

```bash
# Generate coverage report
npm run test:coverage

# Generate HTML coverage report
npm run test:coverage -- --coverageReporters=html

# Open coverage report in browser
# Open coverage/index.html
```

Coverage reports show:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage
- Uncovered lines highlighted

## Debugging Tests

### Run Single Test

```bash
# Run single test by name
npx jest -t "should store and retrieve authentication tokens"
```

### Debug with Node Inspector

```bash
# Run tests with debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Verbose Output

```bash
# Run tests with verbose output
npm test -- --verbose
```

### Show Console Logs

```bash
# Run tests and show console.log output
npm test -- --silent=false
```

## Best Practices

### Property Tests
1. Use appropriate generators for input types
2. Test universal properties, not specific examples
3. Ensure tests are deterministic (use seeds if needed)
4. Clean up resources in finally blocks
5. Run at least 100 iterations per property

### Unit Tests
1. Test one thing per test
2. Use descriptive test names
3. Follow Arrange-Act-Assert pattern
4. Mock external dependencies
5. Test edge cases and error conditions

### Integration Tests
1. Test complete workflows
2. Use real database (in-memory)
3. Mock only external services
4. Verify both results and side effects
5. Clean up after each test

### General
1. Keep tests fast (< 30 seconds total)
2. Make tests independent (no shared state)
3. Use meaningful assertions
4. Document complex test logic
5. Maintain high coverage (> 80%)

## Troubleshooting

### "Cannot find module"
- Run `npm install` to install dependencies

### "Database locked"
- Ensure tests clean up databases properly
- Use in-memory databases for tests

### "Timeout"
- Increase Jest timeout: `jest.setTimeout(30000)`
- Check for infinite loops or hanging promises

### "Mock not working"
- Ensure mock is defined before importing module
- Use `jest.clearAllMocks()` in beforeEach

### "Coverage not meeting threshold"
- Run `npm run test:coverage -- --coverageReporters=html`
- Open `coverage/index.html` to see uncovered lines
- Add tests for uncovered code

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [fast-check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/)
- [Testing Best Practices](https://testingjavascript.com/)

## Test Execution Script

For comprehensive test execution with reporting, use:

```bash
# Run all tests with detailed report
node run-all-tests.js
```

This script:
- Runs all property tests
- Runs all unit tests with coverage
- Runs all integration tests
- Generates `CHECKPOINT_27_RESULTS.md`
- Provides colored console output

See `TEST_EXECUTION_GUIDE.md` for more details.

## Manual Testing

For manual testing checklist, see:
- `MANUAL_TESTING_CHECKLIST.md` - Comprehensive manual testing checklist

## Questions?

For questions about testing:
1. Check `TEST_EXECUTION_GUIDE.md`
2. Review existing test files for examples
3. Consult design document for property definitions
4. See `TASK_27_INSTRUCTIONS.md` for step-by-step guidance
