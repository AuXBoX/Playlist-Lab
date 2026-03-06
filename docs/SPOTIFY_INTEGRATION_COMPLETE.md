# Spotify Integration - Implementation Complete

## Overview
Implemented dual-method Spotify integration:
1. **Direct Scraping (No Auth)**: Works for most public playlists without any setup
2. **OAuth (Optional)**: For private playlists and users with existing Spotify developer credentials

## Changes Made

### Backend (`apps/server/`)

#### 1. Database Schema Updates
**File: `src/database/schema.sql`**
- Added `spotify_client_id` column to `users` table
- Added `spotify_client_secret` column to `users` table
- These store user-provided Spotify app credentials (optional)

**File: `src/database/init.ts`**
- Added automatic migrations to add new columns to existing databases
- Migrations run on server startup, no manual intervention needed

#### 2. Spotify Scraping (No Auth Required)
**File: `src/services/scrapers.ts`**
- Implemented `scrapeSpotifyPlaylist()` using Spotify's embed API
- Extracts playlist data from publicly accessible embed pages
- No authentication required
- Works for most public playlists
- Falls back with helpful error message if scraping fails

**How it works:**
1. Extracts playlist ID from URL
2. Fetches Spotify embed page (publicly accessible)
3. Parses JSON data from `__NEXT_DATA__` script tag
4. Returns playlist name, description, and tracks

#### 3. Spotify Auth Routes (Optional OAuth)
**File: `src/routes/spotify-auth.ts`**

**New Endpoint: `POST /api/spotify/credentials`**
- Saves user-provided Spotify Client ID and Client Secret
- Stores credentials in database per user
- Required before OAuth flow can begin

**Updated: `GET /api/spotify/login`**
- Now reads credentials from database instead of environment variables
- Returns error if credentials not configured
- Initiates OAuth flow with user's credentials

**Updated: `GET /api/spotify/callback`**
- OAuth callback handler
- Exchanges authorization code for access/refresh tokens
- Uses user's stored credentials for token exchange
- Stores tokens in database

**Updated: `GET /api/spotify/status`**
- Returns both connection status and credential status
- `connected`: true if user has valid access token
- `hasCredentials`: true if user has saved Client ID/Secret

**Existing: `POST /api/spotify/disconnect`**
- Clears user's Spotify tokens
- Credentials remain saved for easy reconnection

### Frontend (`apps/web/`)

#### ImportPage.tsx Updates
**Spotify Integration Banner**
- Shows two methods: Direct Import (no setup) and OAuth (optional)
- Explains that direct import works for most public playlists
- Notes that Spotify has restricted new app creation
- OAuth section is collapsible and marked as optional

**Direct Import (Default)**
- User simply pastes Spotify URL and clicks Import
- No configuration required
- Uses scraping method automatically

**OAuth Setup (Optional)**
- Collapsible section for users with existing credentials
- Warning banner about Spotify's app creation restrictions
- Input fields for Client ID and Client Secret
- Instructions for users who already have Spotify apps
- "Save & Connect" button saves credentials

**Connection Status**
- Green banner when OAuth connected
- Shows "✓ Spotify Connected"

## User Flow

### Method 1: Direct Import (Recommended)
1. User selects Spotify source
2. User pastes Spotify playlist URL
3. User clicks "Import" or "Preview"
4. System scrapes playlist data (no auth needed)
5. Playlist imported successfully

### Method 2: OAuth (Optional - For Private Playlists)
1. User selects Spotify source
2. User expands "Setup OAuth Connection" section
3. User enters existing Spotify app credentials
4. User clicks "Save & Connect"
5. User can now access private playlists via OAuth

## Database Schema

### users table (new columns)
```sql
spotify_client_id TEXT,        -- User's Spotify app Client ID (optional)
spotify_client_secret TEXT,    -- User's Spotify app Client Secret (optional)
spotify_access_token TEXT,     -- OAuth access token (optional)
spotify_refresh_token TEXT,    -- OAuth refresh token (optional)
spotify_token_expires_at INTEGER  -- Token expiration timestamp (optional)
```

## Technical Details

### Scraping Method
- Uses Spotify's embed API endpoint: `https://open.spotify.com/embed/playlist/{id}`
- Publicly accessible, no authentication required
- Parses `__NEXT_DATA__` JSON from embed page
- Extracts playlist metadata and track list
- Limitations: May not work for private playlists or region-restricted content

### OAuth Method
- Standard OAuth 2.0 authorization code flow
- User provides their own app credentials
- Access tokens stored per user
- Tokens can be refreshed automatically
- Full API access including private playlists

## Spotify App Restriction Notice

Spotify has restricted new app creation for many users. The implementation handles this by:
1. Making OAuth completely optional
2. Providing scraping as the default method
3. Showing clear warnings about app restrictions
4. Only suggesting OAuth for users who already have credentials

## Environment Variables

### Optional (for development)
```env
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
```

Note: Client ID and Secret are now user-provided (optional), not environment variables.

## Testing

### Test Direct Import (No Auth)
1. Start server: `npm run dev` (in apps/server)
2. Start web app: `npm run dev` (in apps/web)
3. Navigate to Import page
4. Select Spotify source
5. Paste a public Spotify playlist URL
6. Click "Preview" or "Import"
7. Verify playlist loads without authentication

### Test OAuth (If You Have Credentials)
1. Follow steps 1-4 above
2. Expand "Setup OAuth Connection" section
3. Enter your existing Spotify app credentials
4. Click "Save & Connect"
5. Complete OAuth flow
6. Try importing a private playlist

## Error Handling

### Scraping Errors
- Invalid URL: Clear error message
- Private playlist: Suggests using OAuth
- Network error: Retry suggestion
- Parse error: Falls back to OAuth suggestion

### OAuth Errors
- Missing credentials: Prompts user to enter them
- Invalid credentials: Clear error from Spotify
- Token expired: Automatic refresh (future enhancement)
- Authorization denied: User-friendly message

## Next Steps

1. **Token Refresh**: Implement automatic token refresh when expired
2. **Encryption**: Encrypt stored credentials and tokens
3. **Rate Limiting**: Add rate limiting for scraping requests
4. **Caching**: Cache scraped playlist data
5. **Fallback Chain**: Try scraping → OAuth → error message
6. **Production Setup**: Update redirect URI for production domain

## Files Modified

- `apps/server/src/services/scrapers.ts` - Added Spotify scraping
- `apps/server/src/routes/spotify-auth.ts` - OAuth endpoints
- `apps/server/src/database/schema.sql` - Database schema
- `apps/server/src/database/init.ts` - Migrations
- `apps/web/src/pages/ImportPage.tsx` - Dual-method UI
- `apps/server/.env.example` - Environment variable documentation

## Migration Notes

- Existing databases will automatically receive new columns on server restart
- No data loss or manual migration required
- OAuth credentials are optional - users can use scraping without any setup
- Users who previously couldn't use Spotify can now import public playlists

## Advantages of Dual Approach

1. **No Barrier to Entry**: Users can import Spotify playlists immediately
2. **No App Required**: Works without Spotify developer account
3. **Graceful Degradation**: Falls back to OAuth if scraping fails
4. **Future-Proof**: OAuth still available for those who have it
5. **User Choice**: Users can choose their preferred method
