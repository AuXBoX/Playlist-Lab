# Design Document: Playlist Lab Web Server

## Overview

Playlist Lab Web Server is a multi-user web application built with Node.js/Express backend and React frontend. The architecture separates concerns into three main layers: the web client (React SPA), the API server (Express), and the data layer (SQLite). Background jobs handle scheduled tasks like playlist scraping and mix generation. The system reuses existing Electron app code where possible, particularly the matching algorithm and external service integrations.

## Architecture

### System Components

```
┌─────────────────┐
│  React Client   │ (Browser)
│  - UI Pages     │
│  - State Mgmt   │
└────────┬────────┘
         │ HTTPS/REST
         ▼
┌─────────────────┐
│  Express Server │
│  - API Routes   │
│  - Auth Middleware
│  - Session Mgmt │
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌────────┐ ┌──────┐ ┌────────────┐
│ SQLite │ │ Plex │ │ Background │
│   DB   │ │ API  │ │    Jobs    │
└────────┘ └──────┘ └────────────┘
```

### Technology Stack

- **Backend**: Node.js 18+, Express 4.x
- **Web Frontend**: React 18, TypeScript, Vite
- **Mobile Apps**: React Native with Expo (iOS + Android)
- **Database**: SQLite 3 with better-sqlite3
- **Scheduling**: node-cron
- **Session**: express-session with SQLite store
- **Authentication**: Plex OAuth (PIN flow)
- **Deployment**: Docker, docker-compose
- **Mobile Build**: Expo EAS Build (cloud-based iOS builds from Windows)

### Deployment Architecture

```
┌──────────────────────────────────┐
│         Reverse Proxy            │
│      (nginx/Apache/Caddy)        │
│   - HTTPS termination            │
│   - Static file serving          │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│      Express Application         │
│   - API endpoints                │
│   - Session management           │
│   - Background jobs              │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│        SQLite Database           │
│   - User data                    │
│   - Playlists & schedules        │
│   - Cached playlist data         │
└──────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Layer

#### Schema

**users**
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

**user_servers**
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

**user_settings**
```sql
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY,
  country TEXT DEFAULT 'global',
  matching_settings TEXT,  -- JSON
  mix_settings TEXT,       -- JSON
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**playlists**
```sql
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plex_playlist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,  -- 'spotify', 'deezer', etc.
  source_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**schedules**
```sql
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER,
  schedule_type TEXT NOT NULL,  -- 'playlist_refresh' or 'mix_generation'
  frequency TEXT NOT NULL,      -- 'daily', 'weekly', 'fortnightly', 'monthly'
  start_date TEXT NOT NULL,
  last_run INTEGER,
  config TEXT,  -- JSON for additional config
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
```

**missing_tracks**
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

**cached_playlists**
```sql
CREATE TABLE cached_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,      -- 'spotify', 'deezer', etc.
  source_id TEXT NOT NULL,   -- External playlist ID or chart ID
  name TEXT NOT NULL,
  description TEXT,
  tracks TEXT NOT NULL,      -- JSON array of tracks
  scraped_at INTEGER NOT NULL,
  UNIQUE(source, source_id)
);
```

**sessions**
```sql
CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER NOT NULL
);
```

**admin_users**
```sql
CREATE TABLE admin_users (
  user_id INTEGER PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Database Interface

```typescript
interface Database {
  // User operations
  createUser(plexUserId: string, username: string, token: string, thumb?: string): User;
  getUserByPlexId(plexUserId: string): User | null;
  getUserById(id: number): User | null;
  updateUserLogin(userId: number, timestamp: number): void;
  
  // Settings operations
  getUserSettings(userId: number): UserSettings;
  saveUserSettings(userId: number, settings: Partial<UserSettings>): void;
  
  // Playlist operations
  createPlaylist(userId: number, plexPlaylistId: string, name: string, source: string, sourceUrl?: string): Playlist;
  getUserPlaylists(userId: number): Playlist[];
  getPlaylistById(id: number): Playlist | null;
  updatePlaylist(id: number, updates: Partial<Playlist>): void;
  deletePlaylist(id: number): void;
  
  // Schedule operations
  createSchedule(userId: number, schedule: ScheduleInput): Schedule;
  getUserSchedules(userId: number): Schedule[];
  getDueSchedules(): Schedule[];
  updateScheduleLastRun(id: number, timestamp: number): void;
  deleteSchedule(id: number): void;
  
  // Missing tracks operations
  addMissingTracks(userId: number, playlistId: number, tracks: MissingTrackInput[]): void;
  getUserMissingTracks(userId: number): MissingTrack[];
  getAllMissingTracks(): MissingTrack[];  // Admin only
  removeMissingTrack(id: number): void;
  clearPlaylistMissingTracks(playlistId: number): void;
  
  // Cached playlists operations
  getCachedPlaylist(source: string, sourceId: string): CachedPlaylist | null;
  saveCachedPlaylist(source: string, sourceId: string, name: string, description: string, tracks: ExternalTrack[]): void;
  getStaleCache(maxAgeHours: number): CachedPlaylist[];
  
  // Admin operations
  getAllUsers(): User[];
  getUserCount(): number;
  getPlaylistCount(): number;
  getMissingTrackStats(): { track: string; artist: string; count: number }[];
}
```

### 2. API Server

#### Authentication Middleware

```typescript
interface AuthMiddleware {
  // Verify session and attach user to request
  requireAuth(req: Request, res: Response, next: NextFunction): void;
  
  // Verify admin privileges
  requireAdmin(req: Request, res: Response, next: NextFunction): void;
  
  // Optional auth (attach user if present, continue if not)
  optionalAuth(req: Request, res: Response, next: NextFunction): void;
}
```

#### API Routes

**Authentication Routes** (`/api/auth`)
- `POST /api/auth/start` - Initiate Plex PIN auth
- `POST /api/auth/poll` - Poll for auth completion
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/me` - Get current user info

**Server Routes** (`/api/servers`)
- `GET /api/servers` - Get user's Plex servers
- `POST /api/servers/select` - Select and save server
- `GET /api/servers/libraries` - Get music libraries from selected server

**Settings Routes** (`/api/settings`)
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings
- `PUT /api/settings/matching` - Update matching settings
- `PUT /api/settings/mixes` - Update mix generation settings

**Import Routes** (`/api/import`)
- `POST /api/import/spotify` - Import Spotify playlist
- `POST /api/import/deezer` - Import Deezer playlist
- `POST /api/import/apple` - Import Apple Music playlist
- `POST /api/import/tidal` - Import Tidal playlist
- `POST /api/import/youtube` - Import YouTube Music playlist
- `POST /api/import/amazon` - Import Amazon Music playlist
- `POST /api/import/qobuz` - Import Qobuz playlist
- `POST /api/import/listenbrainz` - Import ListenBrainz playlist
- `POST /api/import/file` - Import M3U/iTunes XML file

**Playlist Routes** (`/api/playlists`)
- `GET /api/playlists` - Get user's playlists
- `GET /api/playlists/:id` - Get playlist details
- `POST /api/playlists` - Create playlist in Plex
- `PUT /api/playlists/:id` - Update playlist
- `DELETE /api/playlists/:id` - Delete playlist
- `GET /api/playlists/:id/tracks` - Get playlist tracks
- `POST /api/playlists/:id/tracks` - Add track to playlist
- `DELETE /api/playlists/:id/tracks/:trackId` - Remove track from playlist

**Mix Routes** (`/api/mixes`)
- `POST /api/mixes/weekly` - Generate Weekly Mix
- `POST /api/mixes/daily` - Generate Daily Mix
- `POST /api/mixes/timecapsule` - Generate Time Capsule
- `POST /api/mixes/newmusic` - Generate New Music Mix
- `POST /api/mixes/custom` - Generate custom mix
- `POST /api/mixes/all` - Generate all mixes

**Schedule Routes** (`/api/schedules`)
- `GET /api/schedules` - Get user's schedules
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

**Missing Tracks Routes** (`/api/missing`)
- `GET /api/missing` - Get user's missing tracks
- `POST /api/missing/retry` - Retry matching missing tracks
- `DELETE /api/missing/:id` - Remove missing track
- `DELETE /api/missing/playlist/:playlistId` - Clear playlist missing tracks

**Discovery Routes** (`/api/discovery`)
- `GET /api/discovery/charts` - Get available charts
- `POST /api/discovery/charts/import` - Import chart as playlist

**Admin Routes** (`/api/admin`)
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/missing` - Get all missing tracks across users
- `GET /api/admin/jobs` - Get background job status

**Migration Routes** (`/api/migrate`)
- `POST /api/migrate/desktop` - Import desktop app data

### 3. Background Jobs

#### Job Scheduler

```typescript
interface JobScheduler {
  // Start all scheduled jobs
  start(): void;
  
  // Stop all scheduled jobs
  stop(): void;
  
  // Register a job
  registerJob(name: string, schedule: string, handler: () => Promise<void>): void;
}
```

#### Jobs

**Daily Scraper Job**
- Schedule: Daily at 2:00 AM
- Scrapes popular playlists from all supported services
- Stores results in cached_playlists table
- Marks old cache as stale

**Playlist Refresh Job**
- Schedule: Every hour
- Checks for due playlist refresh schedules
- Re-imports playlists using cached data
- Updates playlists in Plex
- Records last run timestamp

**Mix Generation Job**
- Schedule: Every hour
- Checks for due mix generation schedules
- Generates configured mixes for users
- Creates/updates playlists in Plex
- Records last run timestamp

**Cache Cleanup Job**
- Schedule: Weekly on Sunday at 3:00 AM
- Removes cached playlists older than 7 days
- Vacuums database to reclaim space

### 4. Matching Service

Reuse existing matching algorithm from Electron app (`src/renderer/discovery.ts`).

```typescript
interface MatchingService {
  // Match external tracks to Plex library
  matchPlaylist(
    tracks: ExternalTrack[],
    serverUrl: string,
    plexToken: string,
    settings: MatchingSettings
  ): Promise<MatchedTrack[]>;
  
  // Search Plex for a single track
  searchTrack(
    query: string,
    serverUrl: string,
    plexToken: string
  ): Promise<PlexTrack[]>;
  
  // Calculate match score between two tracks
  calculateScore(
    sourceTrack: ExternalTrack,
    plexTrack: PlexTrack,
    settings: MatchingSettings
  ): number;
}
```

### 5. External Service Integrations

Reuse existing scrapers from Electron app.

```typescript
interface ExternalService {
  // Spotify
  scrapeSpotifyPlaylist(url: string): Promise<ExternalPlaylist>;
  getSpotifyUserPlaylists(accessToken: string): Promise<ExternalPlaylist[]>;
  
  // Deezer
  scrapeDeezerPlaylist(playlistId: string): Promise<ExternalPlaylist>;
  getDeezerCharts(country: string): Promise<ExternalPlaylist[]>;
  
  // Apple Music
  scrapeAppleMusicPlaylist(url: string): Promise<ExternalPlaylist>;
  
  // Tidal
  scrapeTidalPlaylist(url: string): Promise<ExternalPlaylist>;
  
  // YouTube Music
  scrapeYouTubeMusicPlaylist(url: string): Promise<ExternalPlaylist>;
  
  // Amazon Music
  scrapeAmazonMusicPlaylist(url: string): Promise<ExternalPlaylist>;
  
  // Qobuz
  scrapeQobuzPlaylist(url: string): Promise<ExternalPlaylist>;
  
  // ListenBrainz
  getListenBrainzPlaylists(username: string): Promise<ExternalPlaylist[]>;
  
  // ARIA Charts
  scrapeAriaCharts(chartIds?: string[]): Promise<ExternalPlaylist[]>;
}
```

### 6. Web Client (React)

#### Page Components

- **LoginPage**: Plex authentication
- **DashboardPage**: Overview with quick actions
- **ImportPage**: Import playlists from external services
- **GeneratePage**: Generate personal mixes
- **DiscoveryPage**: Browse and import charts
- **ManagePage**: View and edit playlists
- **SchedulePage**: Manage playlist and mix schedules
- **MissingTracksPage**: View and retry missing tracks
- **SettingsPage**: Configure matching and mix settings
- **AdminPage**: System statistics and user management (admin only)

#### State Management

Use React Context + hooks for global state:

```typescript
interface AppState {
  user: User | null;
  server: PlexServer | null;
  settings: UserSettings;
  playlists: Playlist[];
  schedules: Schedule[];
  missingTracksCount: number;
}

interface AppActions {
  login(token: string, user: User): void;
  logout(): void;
  selectServer(server: PlexServer): void;
  updateSettings(settings: Partial<UserSettings>): void;
  refreshPlaylists(): Promise<void>;
  refreshSchedules(): Promise<void>;
  refreshMissingTracksCount(): Promise<void>;
}
```

### 7. Mobile Apps (React Native + Expo)

#### Architecture

The mobile apps use React Native with Expo to share code between iOS and Android while maintaining native performance. The apps communicate with the same Express API server as the web client.

#### Technology Choice: React Native + Expo

**Why React Native + Expo:**
- **Cross-Platform**: Single codebase for iOS and Android
- **Code Reuse**: Share business logic and API client with web app
- **Windows Development**: Expo EAS Build enables iOS builds from Windows without a Mac
- **Fast Iteration**: Hot reload and over-the-air updates
- **Native Performance**: Compiled to native code
- **Rich Ecosystem**: Large library of pre-built components

**Expo EAS Build for iOS (from Windows):**
- Cloud-based build service
- No Mac required for iOS builds
- Handles code signing and provisioning
- Supports TestFlight and App Store deployment
- Command: `eas build --platform ios` (runs on Expo's servers)

#### Mobile App Structure

```
mobile/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── ImportScreen.tsx
│   │   ├── GenerateScreen.tsx
│   │   ├── DiscoveryScreen.tsx
│   │   ├── ManageScreen.tsx
│   │   ├── ScheduleScreen.tsx
│   │   ├── MissingTracksScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── components/
│   │   ├── PlaylistCard.tsx
│   │   ├── TrackList.tsx
│   │   ├── MatchingProgress.tsx
│   │   └── ScheduleForm.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx
│   ├── services/
│   │   ├── api.ts          // Shared API client
│   │   ├── auth.ts
│   │   └── storage.ts      // AsyncStorage for tokens
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePlaylists.ts
│   │   └── useSchedules.ts
│   └── types/
│       └── index.ts        // Shared types with web app
├── app.json
├── eas.json                // EAS Build configuration
└── package.json
```

#### Shared Code Strategy

Create a shared package for common code:

```
packages/
├── shared/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts       // API client
│   │   │   ├── auth.ts
│   │   │   ├── playlists.ts
│   │   │   └── mixes.ts
│   │   ├── types/
│   │   │   └── index.ts        // TypeScript interfaces
│   │   └── utils/
│   │       ├── matching.ts     // Matching algorithm
│   │       └── formatting.ts
│   └── package.json
```

Both web and mobile apps import from `@playlist-lab/shared`.

#### Mobile-Specific Features

**Push Notifications** (optional future enhancement):
- Notify when scheduled mixes are generated
- Alert when missing tracks are found in library
- Notify when playlist refresh completes

**Offline Support**:
- Cache playlist data locally
- Queue actions when offline
- Sync when connection restored

**Native Features**:
- Biometric authentication (Face ID, Touch ID, fingerprint)
- Share playlists via native share sheet
- Background refresh for schedules

#### Mobile Navigation

Use React Navigation with bottom tabs:

```typescript
<Tab.Navigator>
  <Tab.Screen name="Dashboard" component={DashboardScreen} />
  <Tab.Screen name="Import" component={ImportScreen} />
  <Tab.Screen name="Generate" component={GenerateScreen} />
  <Tab.Screen name="Playlists" component={ManageScreen} />
  <Tab.Screen name="Settings" component={SettingsScreen} />
</Tab.Navigator>
```

#### Mobile State Management

Use React Context + AsyncStorage for persistence:

```typescript
interface MobileAppState extends AppState {
  isOffline: boolean;
  pendingActions: Action[];
}

// Persist auth token in AsyncStorage
await AsyncStorage.setItem('auth_token', token);
```

#### Mobile API Client

Reuse web API client with mobile-specific error handling:

```typescript
// packages/shared/src/api/client.ts
export class APIClient {
  constructor(private baseURL: string) {}
  
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
      
      if (!response.ok) {
        throw new APIError(response.status, await response.json());
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof TypeError) {
        // Network error - handle offline mode
        throw new NetworkError('No internet connection');
      }
      throw error;
    }
  }
}
```

#### Mobile Build Configuration

**eas.json** (Expo Application Services):
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "bundleIdentifier": "com.playlistlab.app"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json"
      }
    }
  }
}
```

#### Mobile Development Workflow (Windows)

1. **Setup**:
   ```bash
   npm install -g expo-cli eas-cli
   cd mobile
   npm install
   ```

2. **Development** (Android):
   ```bash
   npx expo start
   # Scan QR code with Expo Go app on Android device
   ```

3. **Development** (iOS - requires iOS device):
   ```bash
   npx expo start
   # Scan QR code with Expo Go app on iPhone
   ```

4. **Build Android APK** (local):
   ```bash
   eas build --platform android --profile production
   ```

5. **Build iOS IPA** (cloud - no Mac needed):
   ```bash
   eas build --platform ios --profile production
   # Builds on Expo's servers, downloads IPA when complete
   ```

6. **Submit to App Stores**:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

#### Mobile Testing

- **Unit Tests**: Jest + React Native Testing Library
- **E2E Tests**: Detox (Android on Windows, iOS via cloud)
- **Manual Testing**: Expo Go app for quick testing
- **Beta Testing**: TestFlight (iOS), Google Play Internal Testing (Android)

#### Mobile UI Components

Use React Native Paper for Material Design components:

```typescript
import { Button, Card, List, TextInput } from 'react-native-paper';

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Card>
      <Card.Title title={playlist.name} subtitle={playlist.source} />
      <Card.Content>
        <Text>{playlist.tracks.length} tracks</Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => openPlaylist(playlist)}>Open</Button>
      </Card.Actions>
    </Card>
  );
}
```

#### Mobile Deployment

**iOS Deployment (from Windows via EAS):**
1. Create Apple Developer account ($99/year)
2. Generate App Store Connect API key
3. Configure `eas.json` with credentials
4. Run `eas build --platform ios`
5. EAS builds on cloud, handles signing
6. Download IPA or submit directly to TestFlight/App Store

**Android Deployment:**
1. Create Google Play Developer account ($25 one-time)
2. Generate upload keystore
3. Configure `eas.json` with keystore
4. Run `eas build --platform android`
5. Submit to Google Play Console

#### Mobile-Specific Considerations

**Performance:**
- Use FlatList for long lists (virtualization)
- Optimize images with react-native-fast-image
- Lazy load screens with React.lazy
- Minimize re-renders with React.memo

**Security:**
- Store tokens in secure storage (expo-secure-store)
- Use HTTPS for all API calls
- Implement certificate pinning for production
- Enable biometric authentication

**User Experience:**
- Pull-to-refresh on all list screens
- Loading skeletons for better perceived performance
- Offline indicators
- Haptic feedback for actions
- Native gestures (swipe to delete, etc.)

## Data Models

### TypeScript Interfaces

```typescript
interface User {
  id: number;
  plexUserId: string;
  plexUsername: string;
  plexToken: string;
  plexThumb?: string;
  createdAt: number;
  lastLogin: number;
}

interface PlexServer {
  name: string;
  clientId: string;
  url: string;
  libraryId?: string;
  libraryName?: string;
}

interface UserSettings {
  country: string;
  matchingSettings: MatchingSettings;
  mixSettings: MixSettings;
}

interface MatchingSettings {
  minMatchScore: number;
  stripParentheses: boolean;
  stripBrackets: boolean;
  useFirstArtistOnly: boolean;
  ignoreFeaturedArtists: boolean;
  ignoreRemixInfo: boolean;
  ignoreVersionInfo: boolean;
  preferNonCompilation: boolean;
  penalizeMonoVersions: boolean;
  penalizeLiveVersions: boolean;
  preferHigherRated: boolean;
  minRatingForMatch: number;
  autoCompleteOnPerfectMatch: boolean;
  playlistPrefixes: {
    enabled: boolean;
    spotify: string;
    deezer: string;
    apple: string;
    tidal: string;
    youtube: string;
    amazon: string;
    qobuz: string;
    listenbrainz: string;
    file: string;
    ai: string;
  };
  customStripPatterns: string[];
  featuredArtistPatterns: string[];
  versionSuffixPatterns: string[];
  remasterPatterns: string[];
  variousArtistsNames: string[];
  penaltyKeywords: string[];
  priorityKeywords: string[];
}

interface MixSettings {
  weeklyMix: {
    topArtists: number;
    tracksPerArtist: number;
  };
  dailyMix: {
    recentTracks: number;
    relatedTracks: number;
    rediscoveryTracks: number;
    rediscoveryDays: number;
  };
  timeCapsule: {
    trackCount: number;
    daysAgo: number;
    maxPerArtist: number;
  };
  newMusic: {
    albumCount: number;
    tracksPerAlbum: number;
  };
}

interface Playlist {
  id: number;
  userId: number;
  plexPlaylistId: string;
  name: string;
  source: string;
  sourceUrl?: string;
  createdAt: number;
  updatedAt: number;
}

interface Schedule {
  id: number;
  userId: number;
  playlistId?: number;
  scheduleType: 'playlist_refresh' | 'mix_generation';
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
  startDate: string;
  lastRun?: number;
  config?: any;
}

interface MissingTrack {
  id: number;
  userId: number;
  playlistId: number;
  title: string;
  artist: string;
  album?: string;
  position: number;
  afterTrackKey?: string;
  addedAt: number;
  source: string;
}

interface CachedPlaylist {
  id: number;
  source: string;
  sourceId: string;
  name: string;
  description?: string;
  tracks: ExternalTrack[];
  scrapedAt: number;
}

interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
}

interface ExternalPlaylist {
  id: string;
  name: string;
  description?: string;
  source: string;
  tracks: ExternalTrack[];
}

interface MatchedTrack {
  title: string;
  artist: string;
  matched: boolean;
  plexRatingKey?: string;
  plexTitle?: string;
  plexArtist?: string;
  plexAlbum?: string;
  plexCodec?: string;
  plexBitrate?: number;
  score?: number;
}

interface PlexTrack {
  ratingKey: string;
  title: string;
  grandparentTitle: string;  // Artist
  parentTitle: string;        // Album
  Media?: Array<{
    audioCodec?: string;
    bitrate?: number;
  }>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

**Redundant Properties:**
- Properties 2.2, 2.3, and 2.4 all test data isolation - can be combined into one comprehensive property about user data access control
- Properties 12.2, 12.3, 12.4, and 12.5 all test session lifecycle - can be combined into session management properties
- Properties 3.4, 3.5, and 3.6 test the import workflow - can be combined into an import round-trip property
- Properties 15.2 and 15.3 both test authentication requirements - can be combined
- Properties 17.1, 17.4, and 17.5 all test error handling - can be combined into comprehensive error handling properties

**Consolidated Properties:**
The following properties provide unique validation value after consolidation:
- User authentication and session management
- Data isolation and access control
- Playlist import workflow with caching
- Mix generation algorithms
- Schedule execution
- Missing tracks lifecycle
- Database integrity
- API security and error handling

### Correctness Properties

**Property 1: Authentication Token Storage**
*For any* successful Plex authentication, storing the user's token and user ID in the database should allow subsequent retrieval of those exact values
**Validates: Requirements 1.3**

**Property 2: Session Restoration**
*For any* user with stored credentials, creating a session should restore access to their data without re-authentication
**Validates: Requirements 1.4**

**Property 3: Session Invalidation**
*For any* active user session, logging out should invalidate the session such that subsequent requests with that session fail authentication
**Validates: Requirements 1.5, 12.5**

**Property 4: User Data Isolation**
*For any* two different users A and B, user A should not be able to access, view, or modify any data (playlists, settings, schedules, missing tracks) belonging to user B
**Validates: Requirements 2.2, 2.3, 2.4**

**Property 5: Independent User Settings**
*For any* two users, modifying one user's matching settings should not affect the other user's matching settings
**Validates: Requirements 2.5**

**Property 6: Cache-First Import**
*For any* playlist import where cached data exists and is less than 24 hours old, the server should use cached data instead of scraping
**Validates: Requirements 3.2, 4.5**

**Property 7: Stale Cache Scraping**
*For any* playlist import where cached data does not exist or is older than 24 hours, the server should scrape fresh data from the external service
**Validates: Requirements 3.3**

**Property 8: Import Workflow Completeness**
*For any* playlist import, the workflow should retrieve data (cached or scraped), match tracks against the user's library, present results, and upon confirmation create the playlist in Plex
**Validates: Requirements 3.4, 3.5, 3.6**

**Property 9: Cache Timestamp Storage**
*For any* scraped playlist data, storing it in the cache should include a timestamp that can be used to determine freshness
**Validates: Requirements 4.3**

**Property 10: Cache Staleness**
*For any* cached playlist, if the current time minus the scraped timestamp exceeds 24 hours, the cache should be considered stale
**Validates: Requirements 4.4**

**Property 11: Mix Generation Requires Play History**
*For any* mix generation request (Weekly, Daily, Time Capsule, New Music), the server should fetch the user's play history from their Plex server before generating the mix
**Validates: Requirements 5.2**

**Property 12: Weekly Mix Artist Selection**
*For any* Weekly Mix generation, all selected tracks should come from artists that appear in the user's most-played artists list
**Validates: Requirements 5.3**

**Property 13: Daily Mix Composition**
*For any* Daily Mix generation, the resulting playlist should contain tracks from all three categories: recent plays, related tracks, and rediscoveries
**Validates: Requirements 5.4**

**Property 14: Time Capsule Staleness and Diversity**
*For any* Time Capsule generation with parameters (daysAgo, maxPerArtist), all selected tracks should have lastViewedAt older than daysAgo, and no artist should have more than maxPerArtist tracks
**Validates: Requirements 5.5**

**Property 15: New Music Mix Recency**
*For any* New Music Mix generation, all selected tracks should come from albums with addedAt timestamps within the configured recent period
**Validates: Requirements 5.6**

**Property 16: Mix Playlist Creation**
*For any* successfully generated mix, a playlist should be created in the user's Plex server with the generated tracks
**Validates: Requirements 5.7**

**Property 17: Schedule Persistence**
*For any* schedule creation (mix generation or playlist refresh), the schedule configuration should be stored in the database and retrievable by user ID
**Validates: Requirements 6.2, 7.2**

**Property 18: Due Schedule Execution**
*For any* schedule that is due (current time >= next run time based on frequency), the server should execute the scheduled action (generate mix or refresh playlist)
**Validates: Requirements 6.4, 7.4**

**Property 19: Schedule Timestamp Update**
*For any* completed scheduled action, the schedule's last run timestamp should be updated to the current time
**Validates: Requirements 6.5, 7.5**

**Property 20: Missing Track Storage**
*For any* track that fails to match during import, the track should be stored in the missing_tracks table with user_id, playlist_id, title, artist, position, and source
**Validates: Requirements 8.1**

**Property 21: Missing Tracks Grouping**
*For any* user's missing tracks query, the results should be grouped by playlist_id
**Validates: Requirements 8.2**

**Property 22: Missing Track Retry and Insertion**
*For any* missing track that successfully matches on retry, the track should be inserted at its original position in the playlist and removed from the missing_tracks table
**Validates: Requirements 8.3, 8.5**

**Property 23: Settings Persistence**
*For any* user's matching settings modification, the updated settings should be stored in the database and applied to all subsequent matching operations for that user
**Validates: Requirements 9.2, 9.3**

**Property 24: Admin Missing Tracks Aggregation**
*For any* admin query for missing tracks, the results should include missing tracks from all users, aggregated by (title, artist) with counts showing how many users are missing each track
**Validates: Requirements 10.3, 10.4**

**Property 25: Foreign Key Cascade**
*For any* user deletion, all related records (playlists, schedules, missing_tracks, settings) should be automatically deleted due to foreign key constraints
**Validates: Requirements 11.4**

**Property 26: Session Expiration**
*For any* session created at time T, accessing the session at time T + 31 days should fail and redirect to login
**Validates: Requirements 12.3**

**Property 27: Session Validation**
*For any* authenticated API request, the server should validate the session token before processing the request
**Validates: Requirements 12.4**

**Property 28: Job Error Recovery**
*For any* background job that throws an error, the error should be logged and the job scheduler should continue executing subsequent scheduled runs
**Validates: Requirements 14.5**

**Property 29: Authentication Requirement**
*For any* API endpoint except /api/auth/*, an unauthenticated request should return 401 Unauthorized
**Validates: Requirements 15.2, 15.3**

**Property 30: Invalid Request Errors**
*For any* API request with invalid parameters or malformed data, the server should return an appropriate 4xx error code with a descriptive error message
**Validates: Requirements 15.4**

**Property 31: JSON Response Format**
*For any* API endpoint response, the Content-Type header should be application/json and the body should be valid JSON
**Validates: Requirements 15.5**

**Property 32: Desktop Data Import Round-Trip**
*For any* valid desktop app data export, importing it should preserve all playlists, schedules, and matching settings such that the user's configuration is identical
**Validates: Requirements 16.2, 16.3, 16.4**

**Property 33: Import Data Validation**
*For any* desktop app data import, the server should validate the data structure before storing it, rejecting invalid data with a descriptive error
**Validates: Requirements 16.5**

**Property 34: Error Message Descriptiveness**
*For any* error condition, the server should return an error response containing a message field that describes what went wrong
**Validates: Requirements 17.1**

**Property 35: Scraping Fallback**
*For any* playlist scraping failure, if cached data exists (even if stale), the server should use the cached data instead of failing the import
**Validates: Requirements 17.3**

**Property 36: Matching Error Details**
*For any* track matching failure, the response should include the unmatched track's title, artist, and the reason it couldn't be matched (no results, low score, etc.)
**Validates: Requirements 17.4**

**Property 37: Error Logging**
*For any* error that occurs during request processing or background jobs, an entry should be written to the error log file
**Validates: Requirements 17.5**

**Property 38: Cached Playlist Reuse**
*For any* cached playlist, if multiple users import it within the cache validity period, the server should serve the same cached data to all users without re-scraping
**Validates: Requirements 18.2**

**Property 39: Result Set Pagination**
*For any* API endpoint returning a list with more than 100 items, the response should be paginated with offset and limit parameters
**Validates: Requirements 18.4**

**Property 40: Response Compression**
*For any* API response larger than 1KB, the server should compress the response body when the client supports compression (Accept-Encoding: gzip)
**Validates: Requirements 18.5**

**Property 41: Token Encryption**
*For any* Plex token stored in the database, the stored value should be encrypted such that reading the database file directly does not reveal the plaintext token
**Validates: Requirements 19.1**

**Property 42: Input Sanitization**
*For any* user input (query parameters, request body fields), the server should sanitize the input to remove or escape SQL injection and XSS attack vectors
**Validates: Requirements 19.3**

**Property 43: Rate Limiting**
*For any* API endpoint, if a client makes more than 100 requests per minute, subsequent requests should return 429 Too Many Requests
**Validates: Requirements 19.4**

**Property 44: Secure Session Cookies**
*For any* session cookie set by the server, the cookie should have httpOnly=true and secure=true flags (in production)
**Validates: Requirements 19.5**

**Property 45: Environment Variable Configuration**
*For any* configuration value (database path, port, session secret), the server should accept the value from an environment variable if set, otherwise use a default
**Validates: Requirements 20.2**

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Optional additional context
    statusCode: number;     // HTTP status code
  };
}
```

### Error Categories

**Authentication Errors (401)**
- `AUTH_REQUIRED`: No session token provided
- `AUTH_INVALID`: Invalid or expired session token
- `AUTH_PLEX_FAILED`: Plex authentication failed

**Authorization Errors (403)**
- `FORBIDDEN`: User lacks permission for this resource
- `ADMIN_REQUIRED`: Admin privileges required

**Validation Errors (400)**
- `INVALID_INPUT`: Request parameters are invalid
- `MISSING_FIELD`: Required field is missing
- `INVALID_FORMAT`: Data format is incorrect

**Resource Errors (404)**
- `NOT_FOUND`: Requested resource doesn't exist
- `PLAYLIST_NOT_FOUND`: Playlist ID not found
- `USER_NOT_FOUND`: User ID not found

**External Service Errors (502, 503)**
- `PLEX_UNREACHABLE`: Cannot connect to Plex server
- `SCRAPING_FAILED`: External service scraping failed
- `CACHE_MISS`: No cached data available

**Rate Limiting (429)**
- `RATE_LIMIT_EXCEEDED`: Too many requests

**Server Errors (500)**
- `INTERNAL_ERROR`: Unexpected server error
- `DATABASE_ERROR`: Database operation failed

### Error Handling Strategy

1. **Graceful Degradation**: Use cached data when external services fail
2. **Detailed Logging**: Log all errors with stack traces for debugging
3. **User-Friendly Messages**: Return clear, actionable error messages
4. **Retry Logic**: Automatically retry transient failures (network timeouts)
5. **Circuit Breaker**: Temporarily disable failing external services

## Testing Strategy

### Dual Testing Approach

The application requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of API endpoints
- Edge cases (empty playlists, missing fields)
- Error conditions (invalid tokens, unreachable servers)
- Integration points (database operations, Plex API calls)
- Authentication flow steps

**Property-Based Tests** focus on:
- Universal properties across all inputs
- Data isolation between users
- Session lifecycle management
- Matching algorithm correctness
- Schedule execution logic
- Cache behavior

### Property Test Configuration

- **Library**: fast-check (JavaScript/TypeScript property-based testing)
- **Iterations**: Minimum 100 runs per property test
- **Tagging**: Each property test must reference its design document property

Tag format:
```typescript
// Feature: playlist-lab-web-server, Property 4: User Data Isolation
test('users cannot access other users data', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({ plexUserId: fc.string(), username: fc.string() }),
      fc.record({ plexUserId: fc.string(), username: fc.string() }),
      async (userA, userB) => {
        // Property test implementation
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Organization

```
tests/
├── unit/
│   ├── api/
│   │   ├── auth.test.ts
│   │   ├── playlists.test.ts
│   │   ├── mixes.test.ts
│   │   └── schedules.test.ts
│   ├── database/
│   │   ├── users.test.ts
│   │   ├── playlists.test.ts
│   │   └── cache.test.ts
│   ├── services/
│   │   ├── matching.test.ts
│   │   ├── scrapers.test.ts
│   │   └── plex.test.ts
│   └── jobs/
│       ├── scraper.test.ts
│       └── scheduler.test.ts
├── property/
│   ├── auth.property.test.ts
│   ├── isolation.property.test.ts
│   ├── import.property.test.ts
│   ├── mixes.property.test.ts
│   ├── schedules.property.test.ts
│   ├── cache.property.test.ts
│   └── security.property.test.ts
└── integration/
    ├── import-workflow.test.ts
    ├── mix-generation.test.ts
    └── schedule-execution.test.ts
```

### Testing Best Practices

1. **Mock External Services**: Mock Plex API and external scrapers to avoid network dependencies
2. **In-Memory Database**: Use in-memory SQLite for fast test execution
3. **Isolated Tests**: Each test should create its own users and data
4. **Cleanup**: Always clean up test data after each test
5. **Deterministic**: Use fixed seeds for random data generation in tests
6. **Fast Execution**: Unit tests should complete in < 5 seconds, property tests in < 30 seconds

### Coverage Goals

- **Unit Test Coverage**: > 80% line coverage
- **Property Test Coverage**: All 45 correctness properties implemented
- **Integration Test Coverage**: All major workflows (import, generate, schedule)
- **API Test Coverage**: All endpoints with success and error cases

## Deployment

### Docker Configuration

**Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY dist/ ./dist/
COPY public/ ./public/

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server/index.js"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  playlist-lab:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/playlist-lab.db
      - SESSION_SECRET=${SESSION_SECRET}
      - PORT=3000
      - LOG_LEVEL=info
    restart: unless-stopped
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_PATH` | SQLite database file path | `./data/playlist-lab.db` |
| `SESSION_SECRET` | Secret for session encryption | (required) |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` |
| `CACHE_MAX_AGE_HOURS` | Cache validity period | `24` |
| `SCRAPER_SCHEDULE` | Cron schedule for scraper | `0 2 * * *` |
| `ADMIN_PLEX_IDS` | Comma-separated Plex user IDs for admins | (empty) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Reverse Proxy Configuration

**nginx example**
```nginx
server {
    listen 443 ssl http2;
    server_name playlist-lab.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Backup

Automated backup strategy:

1. **Daily Backups**: Cron job to copy SQLite database
2. **Retention**: Keep last 7 daily backups
3. **Location**: Separate volume or remote storage
4. **Verification**: Test restore process monthly

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d)
sqlite3 /data/playlist-lab.db ".backup /backups/playlist-lab-$DATE.db"
find /backups -name "playlist-lab-*.db" -mtime +7 -delete
```

### Monitoring

Recommended monitoring:

- **Health Check Endpoint**: `GET /api/health`
- **Metrics**: Request count, response time, error rate
- **Logs**: Structured JSON logs with correlation IDs
- **Alerts**: Database size, failed jobs, error rate spikes

### Security Checklist

- [ ] HTTPS enabled in production
- [ ] Session secret is strong and unique
- [ ] Database file permissions restricted (600)
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized outputs)
- [ ] CSRF protection for state-changing operations
- [ ] Secure headers (helmet.js)
- [ ] Regular dependency updates

## Migration from Desktop App

### Export from Desktop App

The desktop app should provide an export function:

```typescript
// Desktop app export format
interface DesktopExport {
  version: string;
  exportedAt: number;
  user: {
    plexToken: string;
    plexUser: any;
    plexServer: any;
  };
  settings: {
    country: string;
    libraryId: string;
    matchingSettings: MatchingSettings;
    mixSettings: MixSettings;
  };
  playlists: Array<{
    name: string;
    source: string;
    sourceUrl?: string;
    tracks: MatchedTrack[];
    createdAt: number;
  }>;
  schedules: Array<{
    playlistName: string;
    frequency: string;
    startDate: string;
    config: any;
  }>;
  missingTracks: Array<{
    playlistName: string;
    tracks: Array<{
      title: string;
      artist: string;
      album?: string;
      position: number;
    }>;
  }>;
}
```

### Import to Web Server

The web server import endpoint handles conversion:

1. **Validate Export**: Check version compatibility
2. **Create User**: If not exists, create from Plex credentials
3. **Import Settings**: Convert and store user settings
4. **Import Playlists**: Create playlist records (tracks already in Plex)
5. **Import Schedules**: Convert and create schedule records
6. **Import Missing Tracks**: Store in missing_tracks table

### Migration Steps for Users

1. Open desktop app
2. Go to Settings → Backup & Restore
3. Click "Export Data"
4. Save JSON file
5. Open web app
6. Log in with Plex account
7. Go to Settings → Import Desktop Data
8. Upload JSON file
9. Verify imported data

## Performance Considerations

### Database Optimization

- **Indexes**: Create indexes on frequently queried columns
  - `users.plex_user_id`
  - `playlists.user_id`
  - `schedules.user_id`
  - `missing_tracks.user_id, playlist_id`
  - `cached_playlists.source, source_id`
  - `sessions.expired`

- **Connection Pooling**: Use better-sqlite3 with WAL mode for concurrent reads

- **Query Optimization**: Use prepared statements for repeated queries

### Caching Strategy

**In-Memory Cache** (using node-cache):
- User settings (TTL: 5 minutes)
- Plex server info (TTL: 1 hour)
- Library metadata (TTL: 1 hour)

**Database Cache**:
- External playlist data (TTL: 24 hours)
- Chart data (TTL: 24 hours)

### API Response Optimization

- **Compression**: gzip responses > 1KB
- **Pagination**: Limit 50 items per page default
- **Field Selection**: Allow clients to request specific fields
- **ETags**: Cache validation for unchanged resources

### Background Job Optimization

- **Batch Processing**: Process multiple schedules in single job run
- **Parallel Execution**: Run independent scrapers in parallel
- **Job Queuing**: Use queue for long-running tasks
- **Graceful Shutdown**: Complete current job before shutdown

## Future Enhancements

Potential features for future versions:

1. **Collaborative Playlists**: Share playlists with other users
2. **Playlist Analytics**: Track popularity, play counts across users
3. **Smart Recommendations**: ML-based playlist suggestions
4. **Push Notifications**: Mobile alerts for completed mixes and schedules
5. **Webhook Integration**: Notify external services of playlist updates
6. **Advanced Scheduling**: More complex schedule patterns (e.g., "first Monday of month")
7. **Playlist Versioning**: Track changes to playlists over time
8. **Social Features**: Follow users, discover popular playlists
9. **API Keys**: Allow third-party integrations
10. **Multi-Server Support**: Manage playlists across multiple Plex servers
11. **Offline Mode**: Full offline support for mobile apps with sync
12. **Widget Support**: iOS/Android home screen widgets for quick access
