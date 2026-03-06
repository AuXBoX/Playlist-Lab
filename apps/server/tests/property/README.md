# Property-Based Tests for Playlist Lab Web Server

This directory contains property-based tests using [fast-check](https://github.com/dubzzz/fast-check) to verify universal correctness properties of the Playlist Lab Web Server.

## Overview

Property-based testing validates that certain properties hold true across a wide range of randomly generated inputs. Unlike unit tests that check specific examples, property tests verify universal behaviors.

## Test Files

### `database-schema.property.test.ts`

Tests **Property 25: Foreign Key Cascade** from the design document.

**Validates: Requirements 11.4**

This test suite verifies that the database schema correctly implements CASCADE DELETE behavior for foreign key constraints. It includes three comprehensive property tests:

#### Test 1: User Deletion Cascades
- **Property**: When a user is deleted, ALL related records are automatically deleted
- **Validates**: 
  - User settings (user_settings table)
  - Playlists (playlists table)
  - Schedules (schedules table)
  - Missing tracks (missing_tracks table)
- **Iterations**: 100 random test cases
- **Generators**: 
  - Random user data (Plex ID, username, token, avatar)
  - 0-5 random playlists per user
  - 0-3 random schedules per user
  - 0-10 random missing tracks per user
  - Random settings data

#### Test 2: Playlist Deletion Cascades
- **Property**: When a playlist is deleted, related schedules and missing tracks are automatically deleted
- **Validates**:
  - Schedules linked to the playlist
  - Missing tracks linked to the playlist
- **Iterations**: 100 random test cases
- **Generators**:
  - Random user and playlist data
  - 0-5 schedules linked to the playlist
  - 0-10 missing tracks linked to the playlist

#### Test 3: Multi-User Referential Integrity
- **Property**: Deleting one user's data does not affect other users' data
- **Validates**:
  - Data isolation between users
  - Cascade deletes only affect the deleted user
  - Other users' playlists remain intact
- **Iterations**: 100 random test cases
- **Generators**:
  - 2-5 random users
  - 1-3 playlists per user

## Running the Tests

### Prerequisites

Ensure dependencies are installed:

```bash
# From the repository root
npm install

# Or from the server directory
cd apps/server
npm install
```

### Run All Property Tests

```bash
# From repository root
npm run test:property --workspace=apps/server

# Or from server directory
cd apps/server
npm run test:property
```

### Run Only Database Schema Tests

```bash
# From repository root
npm test -- --testPathPattern=property/database-schema --workspace=apps/server

# Or from server directory
cd apps/server
npm test -- --testPathPattern=property/database-schema
```

### Run with Verbose Output

```bash
cd apps/server
npm test -- --testPathPattern=property/database-schema --verbose
```

## Test Structure

Each property test follows this pattern:

1. **Setup**: Create a temporary SQLite database with the schema
2. **Generate**: Use fast-check to generate random test data
3. **Execute**: Insert data and perform the operation (e.g., delete user)
4. **Assert**: Verify the expected property holds (e.g., cascades worked)
5. **Cleanup**: Close and delete the temporary database

## Key Features

- **Isolated Tests**: Each test iteration uses a fresh temporary database
- **Random Data**: fast-check generates diverse test cases automatically
- **Comprehensive Coverage**: 100 iterations per property test
- **Real Database**: Tests use actual SQLite with better-sqlite3, not mocks
- **Automatic Cleanup**: Temporary databases are cleaned up after each test

## Debugging Failed Tests

If a property test fails, fast-check will:

1. Show the failing test case (the generated data that caused the failure)
2. Attempt to shrink the test case to find the minimal failing example
3. Display the assertion that failed

Example failure output:
```
Property failed after 42 tests
{ seed: 1234567890, path: "42", endOnFailure: true }
Counterexample: [
  { plexUserId: "abc", plexUsername: "user1", ... },
  [ { plexPlaylistId: "pl1", name: "Playlist", ... } ],
  ...
]
```

To reproduce a specific failure, you can use the seed:
```typescript
fc.assert(
  fc.asyncProperty(...),
  { numRuns: 100, seed: 1234567890 }
);
```

## Design Document Reference

These tests implement correctness properties defined in:
- `.kiro/specs/playlist-lab-web-server/design.md`
- Section: "Correctness Properties"
- Property 25: Foreign Key Cascade

## Related Requirements

- **Requirement 11.4**: The Server SHALL use foreign keys to maintain referential integrity between tables
- **Requirement 2.1**: The Server SHALL store all user data partitioned by Plex user ID

## Future Property Tests

Additional property tests to be implemented:

- Property 1-3: Authentication and session management
- Property 4-5: User data isolation
- Property 6-10: Cache behavior and import workflow
- Property 11-16: Mix generation algorithms
- Property 17-19: Schedule execution
- Property 20-24: Missing tracks and admin features
- Property 26-45: Security, performance, and API behavior

See `tasks.md` for the complete list of property tests to implement.
