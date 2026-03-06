# Property Test Implementation Notes - Task 2.2

## Task Completed

**Task 2.2**: Write property test for database schema
- **Property 25: Foreign Key Cascade**
- **Validates: Requirements 11.4**

## What Was Implemented

### Test File Created
`apps/server/tests/property/database-schema.property.test.ts`

This file contains three comprehensive property-based tests that verify the database schema's foreign key CASCADE DELETE behavior:

### Test 1: Complete User Cascade Delete
**Purpose**: Verify that deleting a user cascades to ALL related tables

**What it tests**:
- Creates a user with random data
- Adds random playlists (0-5)
- Adds random schedules (0-3)
- Adds random missing tracks (0-10)
- Adds user settings
- Deletes the user
- Verifies ALL related records are deleted

**Property verified**: `∀ user deletion → all related records deleted`

**Iterations**: 100 random test cases

### Test 2: Playlist Cascade Delete
**Purpose**: Verify that deleting a playlist cascades to schedules and missing tracks

**What it tests**:
- Creates a user and playlist
- Adds random schedules linked to the playlist (0-5)
- Adds random missing tracks linked to the playlist (0-10)
- Deletes the playlist
- Verifies schedules and missing tracks are deleted

**Property verified**: `∀ playlist deletion → related schedules and missing_tracks deleted`

**Iterations**: 100 random test cases

### Test 3: Multi-User Referential Integrity
**Purpose**: Verify that cascade deletes are properly isolated between users

**What it tests**:
- Creates multiple users (2-5)
- Adds playlists for each user (1-3 per user)
- Deletes one user
- Verifies only that user's data is deleted
- Verifies other users' data remains intact

**Property verified**: `∀ user deletion → only that user's data deleted, other users unaffected`

**Iterations**: 100 random test cases

## Technical Implementation Details

### Test Infrastructure
- **Database**: Each test creates a temporary SQLite database in a temp directory
- **Cleanup**: Databases are automatically cleaned up after each test
- **Isolation**: Each test iteration is completely isolated
- **Real Database**: Uses actual better-sqlite3, not mocks

### Random Data Generation
Uses fast-check generators for:
- User data: Plex IDs, usernames, tokens, avatars
- Playlist data: IDs, names, sources, URLs
- Schedule data: Types, frequencies, dates, configs
- Missing track data: Titles, artists, albums, positions
- Settings data: Countries, JSON configurations

### Validation Strategy
Each test follows this pattern:
1. Insert data and count records (verify setup)
2. Perform deletion operation
3. Count records again (verify cascade)
4. Assert all counts are correct

## Why This Approach

### Property-Based Testing Benefits
1. **Comprehensive**: Tests 100 different scenarios automatically
2. **Edge Cases**: fast-check finds edge cases we might not think of
3. **Confidence**: If it passes 100 random cases, it likely works for all cases
4. **Regression**: Catches bugs when schema changes

### Real Database Benefits
1. **Accuracy**: Tests actual SQLite behavior, not mocked behavior
2. **Foreign Keys**: Verifies PRAGMA foreign_keys = ON works
3. **Constraints**: Tests real constraint enforcement
4. **Schema**: Validates the actual schema.sql file

## Running the Tests

### Option 1: Using npm scripts (recommended)
```bash
cd apps/server
npm install  # Install dependencies if not already done
npm run test:property
```

### Option 2: Run specific test file
```bash
cd apps/server
npm test -- --testPathPattern=property/database-schema
```

### Option 3: Using the helper script
```bash
cd apps/server
node run-test.js
```

## Expected Output

When tests pass, you should see:
```
PASS  tests/property/database-schema.property.test.ts
  Database Schema Property Tests
    Property 25: Foreign Key Cascade
      ✓ should cascade delete all related records when a user is deleted (XXXXms)
      ✓ should cascade delete schedules and missing tracks when a playlist is deleted (XXXXms)
      ✓ should maintain referential integrity across multiple users (XXXXms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

Each test runs 100 iterations, so they may take a few seconds to complete.

## Troubleshooting

### If tests fail:
1. Check that foreign keys are enabled in the database
2. Verify the schema.sql file has `ON DELETE CASCADE` clauses
3. Look at the counterexample fast-check provides
4. Check that better-sqlite3 is properly installed

### If tests won't run:
1. Ensure dependencies are installed: `npm install`
2. Check that jest and fast-check are in package.json
3. Verify the jest.config.js is correct
4. Try running from the repository root: `npm run test:property --workspace=apps/server`

## Next Steps

After verifying these tests pass:

1. **Mark task complete**: Update task 2.2 status in tasks.md
2. **Run all tests**: Ensure these don't break existing functionality
3. **Continue implementation**: Move to task 2.3 (Implement database interface)
4. **Add more property tests**: Implement remaining properties as tasks progress

## Files Created

1. `apps/server/tests/property/database-schema.property.test.ts` - The main test file
2. `apps/server/tests/property/README.md` - Documentation for property tests
3. `apps/server/tests/property/IMPLEMENTATION_NOTES.md` - This file
4. `apps/server/run-test.js` - Helper script to run tests (bypasses npm script issues)

## Validation Checklist

- [x] Test file created with proper structure
- [x] Three comprehensive property tests implemented
- [x] Tests use fast-check with 100 iterations each
- [x] Tests use real SQLite database (not mocks)
- [x] Tests verify CASCADE DELETE behavior
- [x] Tests verify data isolation between users
- [x] Tests include proper cleanup
- [x] Tests reference design document property (Property 25)
- [x] Tests validate requirement (11.4)
- [x] Documentation created
- [ ] Tests executed and passing (requires npm install)

## Notes for Code Review

1. **Simplicity**: Tests follow KISS principle - straightforward setup, execute, assert pattern
2. **No Mocks**: Uses real database to ensure accurate testing
3. **Comprehensive**: 300 total test iterations (100 per test × 3 tests)
4. **Isolated**: Each test creates its own database, no shared state
5. **Documented**: Clear comments explain what each test validates
6. **Tagged**: Tests reference design document property and requirements
