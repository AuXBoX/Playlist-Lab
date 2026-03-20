# Database Layer

This directory contains the complete database implementation for the Playlist Lab Web Server.

## Files

- **schema.sql** - SQLite database schema with all tables, indexes, and foreign key constraints
- **init.ts** - Database initialization and utility functions
- **types.ts** - TypeScript type definitions for all database entities
- **database.ts** - DatabaseService class with all CRUD operations
- **index.ts** - Main export file for the database module
- **example.ts** - Example usage of the database layer

## Database Schema

The database uses SQLite with the following tables:

- **users** - Authenticated Plex users
- **user_servers** - User's Plex server configurations
- **user_settings** - Per-user settings (matching, mix generation)
- **playlists** - User-created playlists
- **schedules** - Automated refresh and generation schedules
- **missing_tracks** - Tracks that couldn't be matched during import
- **cached_playlists** - Scraped playlist data cache
- **sessions** - User session storage
- **admin_users** - Admin privilege tracking
- **playlist_shares** - Playlist sharing between users
- **cross_import_jobs** - Cross-platform playlist import operations
- **oauth_connections** - OAuth tokens for external services
- **mix_templates** - Saved mix configurations for quick regeneration

All tables use foreign key constraints with CASCADE delete to maintain referential integrity.

## DatabaseService Class

The `DatabaseService` class provides a high-level interface for all database operations:

### User Operations
- `createUser()` - Create a new user
- `getUserByPlexId()` - Get user by Plex user ID
- `getUserById()` - Get user by internal ID
- `updateUserLogin()` - Update last login timestamp
- `updateUserToken()` - Update Plex token

### Server Operations
- `saveUserServer()` - Save user's server configuration
- `getUserServer()` - Get user's server configuration

### Settings Operations
- `getUserSettings()` - Get user settings (with defaults)
- `saveUserSettings()` - Save user settings

### Playlist Operations
- `createPlaylist()` - Create a new playlist
- `getUserPlaylists()` - Get all playlists for a user
- `getPlaylistById()` - Get playlist by ID
- `updatePlaylist()` - Update playlist fields
- `deletePlaylist()` - Delete playlist

### Schedule Operations
- `createSchedule()` - Create a new schedule
- `getUserSchedules()` - Get all schedules for a user
- `getScheduleById()` - Get schedule by ID
- `getDueSchedules()` - Get schedules that need to run
- `updateScheduleLastRun()` - Update last run timestamp
- `updateSchedule()` - Update schedule fields
- `deleteSchedule()` - Delete schedule

### Missing Tracks Operations
- `addMissingTracks()` - Add missing tracks
- `getUserMissingTracks()` - Get all missing tracks for a user
- `getPlaylistMissingTracks()` - Get missing tracks for a playlist
- `getAllMissingTracks()` - Get all missing tracks (admin only)
- `removeMissingTrack()` - Remove a missing track
- `clearPlaylistMissingTracks()` - Clear all missing tracks for a playlist

### Cached Playlists Operations
- `getCachedPlaylist()` - Get cached playlist
- `saveCachedPlaylist()` - Save cached playlist
- `getStaleCache()` - Get stale cached playlists
- `deleteOldCache()` - Delete old cached playlists

### Admin Operations
- `getAllUsers()` - Get all users
- `getUserCount()` - Get user count
- `getPlaylistCount()` - Get playlist count
- `getMissingTrackStats()` - Get missing track statistics
- `isAdmin()` - Check if user is admin
- `addAdmin()` - Add admin user
- `removeAdmin()` - Remove admin user

### Mix Template Operations
- `createMixTemplate()` - Create a new mix template
- `getUserMixTemplates()` - Get all templates for a user
- `getMixTemplateById()` - Get template by ID
- `updateMixTemplate()` - Update template fields
- `deleteMixTemplate()` - Delete template
- `updateTemplateUsage()` - Update last_used_at and use_count

## Usage Example

```typescript
import { initializeDatabase, DatabaseService } from './database';

// Initialize database
const db = initializeDatabase('./data/playlist-lab.db');
const dbService = new DatabaseService(db);

// Create a user
const user = dbService.createUser(
  'plex123',
  'testuser',
  'encrypted_token',
  'https://plex.tv/users/avatar.jpg'
);

// Save user settings
dbService.saveUserSettings(user.id, {
  country: 'US',
  matching_settings: {
    minMatchScore: 0.85,
    // ... other settings
  }
});

// Create a playlist
const playlist = dbService.createPlaylist(
  user.id,
  'plex_playlist_123',
  'My Spotify Playlist',
  'spotify',
  'https://open.spotify.com/playlist/123'
);

// Add missing tracks
dbService.addMissingTracks(user.id, playlist.id, [
  {
    title: 'Song Title',
    artist: 'Artist Name',
    album: 'Album Name',
    position: 0,
    source: 'spotify'
  }
]);
```

## Testing

Comprehensive unit tests are available in `tests/unit/database.test.ts`. The tests cover:

- All CRUD operations for each table
- Foreign key cascade behavior
- Data isolation between users
- Query filters and pagination
- Edge cases and error conditions

Run tests with:
```bash
npm test -- tests/unit/database.test.ts
```

## Default Settings

The database layer provides sensible defaults for user settings:

- **Matching Settings**: Configured for high-quality matches with smart filtering
- **Mix Settings**: Balanced mix generation with reasonable track counts

Users can customize these settings through the `saveUserSettings()` method.

## Foreign Key Cascades

The schema uses CASCADE delete to maintain data integrity:

- Deleting a user cascades to: user_servers, user_settings, playlists, schedules, missing_tracks, mix_templates
- Deleting a playlist cascades to: schedules, missing_tracks

This ensures no orphaned records remain in the database.

## Mix Templates Table

The `mix_templates` table stores saved mix configurations that users can quickly regenerate without rebuilding settings each time.

**Migration Documentation**: See `docs/MIX_TEMPLATES_MIGRATION.md` for complete migration procedures, including staging tests, backup procedures, and rollback plans.

### Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key to users table |
| `name` | TEXT | User-defined template name |
| `description` | TEXT | Optional description |
| `mix_type` | TEXT | Type: 'artist', 'album', 'genre', 'mood', 'decade', 'custom' |
| `configuration` | TEXT | JSON blob with all mix parameters |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |
| `last_used_at` | INTEGER | Unix timestamp of last generation |
| `use_count` | INTEGER | Number of times template has been used |

### Configuration JSON Structure

The `configuration` field stores a JSON object with the following structure:

```typescript
interface MixTemplateConfiguration {
  // Mix type
  mixType: 'artist' | 'album' | 'genre' | 'mood' | 'decade' | 'custom';
  
  // Common parameters
  trackCount: number;
  sortBy?: 'random' | 'rating' | 'playCount' | 'dateAdded';
  
  // Type-specific parameters
  artistIds?: string[];      // For artist mix
  albumIds?: string[];       // For album mix
  genres?: string[];         // For genre mix
  moods?: string[];          // For mood mix
  decades?: number[];        // For decade mix
  
  // Custom mix parameters
  customRules?: {
    includeGenres?: string[];
    excludeGenres?: string[];
    minRating?: number;
    maxRating?: number;
    yearRange?: { min: number; max: number };
    includeUnplayed?: boolean;
  };
  
  // Advanced options
  allowDuplicateArtists?: boolean;
  allowDuplicateAlbums?: boolean;
  maxTracksPerArtist?: number;
  maxTracksPerAlbum?: number;
}
```

### Example Configuration

```json
{
  "mixType": "mood",
  "trackCount": 50,
  "moods": ["chill", "relaxing"],
  "sortBy": "random",
  "allowDuplicateArtists": false,
  "maxTracksPerArtist": 3
}
```

### Indexes

- `idx_mix_templates_user_id` - Fast lookup by user
- `idx_mix_templates_mix_type` - Filter by mix type

### Usage Tracking

The `last_used_at` and `use_count` fields track template usage:
- `last_used_at` is updated each time a mix is generated from the template
- `use_count` is incremented on each generation
- These fields enable sorting by popularity and showing recently used templates

## Performance Considerations

- All frequently queried columns have indexes
- WAL mode is enabled for better concurrent read performance
- Transactions are used for bulk operations (e.g., adding multiple missing tracks)
- JSON fields are used for complex nested data (settings, cached tracks)

## Security

- Plex tokens should be encrypted before storage (handled by calling code)
- User data is strictly isolated by user_id
- All queries use parameterized statements to prevent SQL injection
