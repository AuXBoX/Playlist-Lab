# Playlist Lab Web Server - Developer Guide

This guide is for developers who want to contribute to Playlist Lab, understand the codebase, or extend its functionality.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Technology Stack](#technology-stack)
6. [Database Schema](#database-schema)
7. [API Design](#api-design)
8. [Testing](#testing)
9. [Code Style](#code-style)
10. [Contributing](#contributing)
11. [Release Process](#release-process)

---

## Project Overview

### What is Playlist Lab?

Playlist Lab is a multi-user web application that enables users to:
- Import playlists from external music services into Plex
- Generate personalized playlists based on listening history
- Schedule automatic playlist updates
- Manage missing tracks
- Access via web, iOS, and Android clients

### Key Features

- **Multi-user**: Each user has isolated data and settings
- **Multi-platform**: Web app + native mobile apps (React Native)
- **Background jobs**: Automated scraping and schedule execution
- **Property-based testing**: 45+ correctness properties validated
- **Monorepo**: Shared code between server, web, and mobile

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Web Client  │  │  iOS App     │  │ Android App  │ │
│  │  (React)     │  │ (React Native)│  │(React Native)│ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS/REST
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   API Server Layer                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Express Server (Node.js + TypeScript)          │  │
│  │  - Authentication (Plex OAuth)                   │  │
│  │  - API Routes                                    │  │
│  │  - Session Management                            │  │
│  │  - Background Jobs (node-cron)                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   SQLite     │  │  Plex API    │  │  External    │
│   Database   │  │              │  │  Services    │
│              │  │              │  │  (Scrapers)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Data Flow

1. **Authentication**: User authenticates via Plex OAuth
2. **API Request**: Client sends authenticated request to server
3. **Business Logic**: Server processes request (import, generate, etc.)
4. **External Services**: Server fetches data from Plex or external services
5. **Database**: Server reads/writes data to SQLite
6. **Response**: Server returns JSON response to client

### Background Jobs

- **Daily Scraper**: Scrapes popular playlists at 2 AM
- **Schedule Checker**: Checks for due schedules every hour
- **Cache Cleanup**: Removes stale cache weekly

---

## Development Setup

### Prerequisites

- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **Git**: For version control
- **SQLite**: Included with Node.js
- **Code Editor**: VS Code recommended

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/playlist-lab.git
cd playlist-lab

# Install dependencies
npm install

# Install dependencies for all packages
npm run install:all

# Set up environment
cp .env.example .env
# Edit .env and set SESSION_SECRET

# Initialize database
npm run db:init

# Build shared package
cd packages/shared
npm run build
cd ../..
```

### Running Development Server

```bash
# Start server (with hot reload)
cd apps/server
npm run dev

# In another terminal, start web client
cd apps/web
npm run dev

# In another terminal, start mobile app (optional)
cd apps/mobile
npx expo start
```

### Development URLs

- **API Server**: http://localhost:3000
- **Web Client**: http://localhost:5173
- **Mobile App**: Scan QR code with Expo Go

### Running Tests

```bash
# Run all tests
npm test

# Run server tests only
cd apps/server
npm test

# Run property tests
npm run test:property

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

### Linting and Formatting

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

---

## Project Structure

```
playlist-lab/
├── apps/
│   ├── server/              # Express API server
│   │   ├── src/
│   │   │   ├── database/    # Database layer
│   │   │   ├── middleware/  # Express middleware
│   │   │   ├── routes/      # API routes
│   │   │   ├── services/    # Business logic
│   │   │   ├── utils/       # Utilities
│   │   │   └── index.ts     # Entry point
│   │   ├── tests/           # Tests
│   │   │   ├── unit/        # Unit tests
│   │   │   ├── integration/ # Integration tests
│   │   │   └── property/    # Property-based tests
│   │   └── package.json
│   ├── web/                 # React web client
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── contexts/    # React contexts
│   │   │   ├── pages/       # Page components
│   │   │   └── main.tsx     # Entry point
│   │   └── package.json
│   └── mobile/              # React Native mobile app
│       ├── src/
│       │   ├── screens/     # Screen components
│       │   ├── components/  # Reusable components
│       │   ├── navigation/  # Navigation setup
│       │   ├── services/    # API client
│       │   └── contexts/    # React contexts
│       └── package.json
├── packages/
│   └── shared/              # Shared code
│       ├── src/
│       │   ├── api/         # API client
│       │   ├── types/       # TypeScript types
│       │   └── utils/       # Shared utilities
│       └── package.json
├── docs/                    # Documentation
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── USER_GUIDE.md
│   └── DEVELOPER_GUIDE.md
├── .github/
│   └── workflows/           # CI/CD workflows
├── docker-compose.yml       # Docker setup
├── Dockerfile               # Docker image
├── package.json             # Root package.json
└── tsconfig.json            # TypeScript config
```

### Key Directories

- **`apps/server/src/database/`**: Database schema, queries, and migrations
- **`apps/server/src/routes/`**: API endpoint definitions
- **`apps/server/src/services/`**: Business logic (import, mixes, matching, etc.)
- **`apps/server/tests/property/`**: Property-based tests (45 properties)
- **`packages/shared/`**: Code shared between server, web, and mobile

---

## Technology Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express 4.x
- **Language**: TypeScript 5.x
- **Database**: SQLite 3 (better-sqlite3)
- **Session**: express-session with SQLite store
- **Scheduling**: node-cron
- **Logging**: winston
- **Security**: helmet, express-rate-limit
- **Testing**: Jest, fast-check (property-based testing)

### Frontend (Web)

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Routing**: React Router 6
- **State Management**: React Context + hooks
- **HTTP Client**: fetch API
- **Styling**: CSS modules

### Mobile

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation
- **UI Components**: React Native Paper
- **Storage**: AsyncStorage, expo-secure-store
- **Build**: Expo EAS Build

### Shared

- **Language**: TypeScript
- **Package Manager**: npm workspaces
- **Linting**: ESLint
- **Formatting**: Prettier

---

## Database Schema

### Tables

#### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plex_user_id TEXT UNIQUE NOT NULL,
  plex_username TEXT NOT NULL,
  plex_token TEXT NOT NULL,  -- Encrypted
  plex_thumb TEXT,
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);
```

#### user_servers
```sql
CREATE TABLE user_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  server_name TEXT NOT NULL,
  server_client_id TEXT NOT NULL,
  server_url TEXT NOT NULL,
  library_id TEXT,
  library_name TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### user_settings
```sql
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY,
  country TEXT DEFAULT 'global',
  matching_settings TEXT,  -- JSON
  mix_settings TEXT,       -- JSON
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### playlists
```sql
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plex_playlist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### schedules
```sql
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER,
  schedule_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date TEXT NOT NULL,
  last_run INTEGER,
  config TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
```

#### missing_tracks
```sql
CREATE TABLE missing_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  position INTEGER NOT NULL,
  after_track_key TEXT,
  added_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
```

#### cached_playlists
```sql
CREATE TABLE cached_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tracks TEXT NOT NULL,  -- JSON
  scraped_at INTEGER NOT NULL,
  UNIQUE(source, source_id)
);
```

### Database Interface

See `apps/server/src/database/database.ts` for the complete database interface.

Key methods:
- `createUser()`, `getUserById()`, `getUserByPlexId()`
- `getUserSettings()`, `saveUserSettings()`
- `createPlaylist()`, `getUserPlaylists()`, `deletePlaylist()`
- `createSchedule()`, `getDueSchedules()`, `updateScheduleLastRun()`
- `addMissingTracks()`, `getUserMissingTracks()`
- `getCachedPlaylist()`, `saveCachedPlaylist()`

---

## API Design

### RESTful Principles

- **Resources**: Users, playlists, schedules, etc.
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **Status Codes**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)
- **JSON**: All requests and responses use JSON

### Authentication

- **Method**: Session-based with cookies
- **Flow**: Plex PIN OAuth
- **Middleware**: `requireAuth` checks session validity
- **Admin**: `requireAdmin` checks admin privileges

### Error Handling

All errors follow a consistent format:

```typescript
{
  error: {
    code: "ERROR_CODE",
    message: "Human-readable message",
    details: {},
    statusCode: 400
  }
}
```

### Adding a New Endpoint

1. **Define Route** in `apps/server/src/routes/`:

```typescript
// apps/server/src/routes/example.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId!;
    // Business logic here
    res.json({ success: true, data: {} });
  } catch (error) {
    next(createInternalError('Failed to process request'));
  }
});

export default router;
```

2. **Register Route** in `apps/server/src/index.ts`:

```typescript
import exampleRoutes from './routes/example';
app.use('/api/example', exampleRoutes);
```

3. **Add Tests** in `apps/server/tests/unit/`:

```typescript
describe('Example API', () => {
  it('should return data', async () => {
    const response = await request(app)
      .get('/api/example')
      .set('Cookie', sessionCookie);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

4. **Update API Documentation** in `docs/API.md`

---

## Testing

### Testing Philosophy

Playlist Lab uses a dual testing approach:

1. **Unit Tests**: Test specific examples and edge cases
2. **Property-Based Tests**: Test universal properties across all inputs

### Unit Tests

Located in `apps/server/tests/unit/`

Example:
```typescript
describe('Database', () => {
  it('should create a user', () => {
    const user = db.createUser('123', 'john', 'token');
    expect(user.plex_user_id).toBe('123');
    expect(user.plex_username).toBe('john');
  });
});
```

### Property-Based Tests

Located in `apps/server/tests/property/`

Example:
```typescript
import * as fc from 'fast-check';

// Feature: playlist-lab-web-server, Property 4: User Data Isolation
test('users cannot access other users data', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({ plexUserId: fc.string(), username: fc.string() }),
      fc.record({ plexUserId: fc.string(), username: fc.string() }),
      async (userA, userB) => {
        // Create two users
        const dbUserA = db.createUser(userA.plexUserId, userA.username, 'tokenA');
        const dbUserB = db.createUser(userB.plexUserId, userB.username, 'tokenB');
        
        // Create playlist for user A
        const playlist = db.createPlaylist(dbUserA.id, 'plexId', 'Test', 'spotify');
        
        // User B should not see user A's playlists
        const userBPlaylists = db.getUserPlaylists(dbUserB.id);
        expect(userBPlaylists).not.toContainEqual(expect.objectContaining({ id: playlist.id }));
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Tests

Located in `apps/server/tests/integration/`

Test complete workflows:
- Import playlist end-to-end
- Generate mix end-to-end
- Schedule execution

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Property tests only
npm run test:property

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

1. **Test file naming**: `*.test.ts` for unit, `*.property.test.ts` for property
2. **Test organization**: Group related tests with `describe()`
3. **Test isolation**: Each test should be independent
4. **Cleanup**: Always clean up test data
5. **Assertions**: Use Jest matchers (`expect()`)

### Coverage Goals

- **Unit Tests**: > 80% line coverage
- **Property Tests**: All 45 correctness properties
- **Integration Tests**: All major workflows

---

## Code Style

### TypeScript

- **Strict mode**: Enabled
- **No implicit any**: Enforced
- **Explicit return types**: For public functions
- **Interfaces over types**: Prefer interfaces for objects

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`)
- **Classes**: PascalCase (`UserService`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase (`User`, `Playlist`)

### Code Organization

- **One class per file**: Except for small related classes
- **Barrel exports**: Use `index.ts` for public API
- **Dependency injection**: Pass dependencies as constructor parameters
- **Error handling**: Use try-catch and custom error types

### Comments

- **JSDoc**: For public APIs
- **Inline comments**: For complex logic
- **TODO comments**: For future improvements

Example:
```typescript
/**
 * Import a playlist from an external service
 * @param source - The external service (spotify, deezer, etc.)
 * @param url - The playlist URL
 * @param options - Import options
 * @returns Import result with matched/unmatched tracks
 */
export async function importPlaylist(
  source: string,
  url: string,
  options: ImportOptions
): Promise<ImportResult> {
  // Implementation
}
```

### Linting

ESLint configuration in `.eslintrc.json`:
- Extends `@typescript-eslint/recommended`
- Prettier integration
- Custom rules for project

### Formatting

Prettier configuration in `.prettierrc.json`:
- Single quotes
- 2 space indentation
- Trailing commas
- 100 character line width

---

## Contributing

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/playlist-lab.git
   ```
3. **Create a branch**:
   ```bash
   git checkout -b feature/my-feature
   ```
4. **Make changes** and commit:
   ```bash
   git commit -m "Add my feature"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/my-feature
   ```
6. **Open a Pull Request** on GitHub

### Contribution Guidelines

- **Code quality**: Follow code style guidelines
- **Tests**: Add tests for new features
- **Documentation**: Update docs for API changes
- **Commit messages**: Use conventional commits format
- **Pull requests**: Provide clear description and context

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(import): add support for Tidal playlists

- Implement Tidal scraper
- Add Tidal import route
- Update documentation

Closes #123
```

### Code Review Process

1. **Automated checks**: CI runs tests and linting
2. **Peer review**: At least one approval required
3. **Maintainer review**: Final approval from maintainer
4. **Merge**: Squash and merge to main branch

### What to Contribute

- **Bug fixes**: Fix reported issues
- **New features**: Add requested features
- **Documentation**: Improve docs
- **Tests**: Add missing tests
- **Performance**: Optimize slow code
- **Refactoring**: Improve code quality

---

## Release Process

### Versioning

Playlist Lab follows [Semantic Versioning](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features (backward compatible)
- **Patch** (1.1.1): Bug fixes

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Run all tests**: `npm test`
4. **Build all packages**: `npm run build`
5. **Create git tag**: `git tag v1.0.0`
6. **Push tag**: `git push origin v1.0.0`
7. **Create GitHub release** with notes
8. **Build Docker image**: `docker build -t playlist-lab:1.0.0 .`
9. **Push Docker image**: `docker push playlist-lab:1.0.0`
10. **Deploy to production**

### Continuous Integration

GitHub Actions workflow (`.github/workflows/ci.yml`):
- **On push**: Run tests and linting
- **On PR**: Run tests, linting, and build
- **On tag**: Build and publish Docker image

### Deployment

See `docs/DEPLOYMENT.md` for deployment instructions.

---

## Additional Resources

### Documentation

- **API Documentation**: `docs/API.md`
- **Deployment Guide**: `docs/DEPLOYMENT.md`
- **User Guide**: `docs/USER_GUIDE.md`
- **Plex API Reference**: `docs/PLEX_API_COMPLETE_REFERENCE.md`

### External Resources

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Express**: https://expressjs.com/
- **React**: https://react.dev/
- **React Native**: https://reactnative.dev/
- **Expo**: https://docs.expo.dev/
- **SQLite**: https://www.sqlite.org/docs.html
- **fast-check**: https://fast-check.dev/

### Community

- **GitHub**: https://github.com/your-org/playlist-lab
- **Discord**: https://discord.gg/playlist-lab
- **Discussions**: https://github.com/your-org/playlist-lab/discussions

---

## License

Playlist Lab is licensed under the MIT License. See LICENSE file for details.

---

**Last Updated**: January 2026  
**Version**: 1.0.0

Happy coding! 🚀
