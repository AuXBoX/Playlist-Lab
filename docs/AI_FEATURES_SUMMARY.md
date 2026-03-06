# AI Features Summary

## Overview

Playlist Lab now includes AI-powered playlist generation using Grok's free API. Users can describe the playlist they want in natural language, and Grok will intelligently generate search queries to find matching tracks in their Plex library.

## Features

### 1. Grok API Key Management

**Settings Page:**
- New "AI Features (Grok)" section
- Secure password field for API key storage
- "Save API Key" button to store the key in the database (encrypted)
- "Test Connection" button to verify the API key works
- Visual feedback showing success/failure of the test
- Link to console.x.ai to get a free API key

**Database:**
- Added `grok_api_key` column to `user_settings` table
- Automatic migration runs on server startup
- API key is stored encrypted in the database

### 2. AI Playlist Generation

**Import Page - AI Generated Source:**
- If API key is saved in Settings: Shows green checkmark "Using Grok API key from Settings"
- If API key is NOT saved: Shows password field to enter key for this session only
- Text area to describe the desired playlist
- Helpful tips and examples
- Link to Settings page to save the API key permanently

**How It Works:**
1. User describes playlist (e.g., "upbeat 80s rock songs")
2. Request sent to `/api/import/ai` endpoint
3. Backend uses Grok to extract 5-10 smart search queries
4. Each query is searched in the user's Plex library
5. Results are deduplicated and shuffled
6. Grok generates a creative playlist name
7. Up to 50 tracks returned to the user

### 3. API Endpoints

**POST /api/import/ai**
- Generates AI playlist from text prompt
- Uses stored API key from settings OR accepts `grokApiKey` in request body
- Returns matched tracks and generated playlist name

**POST /api/import/ai/test**
- Tests if the Grok API key is valid
- Makes a simple request to Grok API
- Returns success/failure with descriptive message

**PUT /api/settings/grok-api-key**
- Saves or updates the user's Grok API key
- Accepts `null` to clear the key
- Stores encrypted in database

## User Experience

### First Time Setup

1. User goes to Settings
2. Clicks link to console.x.ai
3. Signs in with X (Twitter) account
4. Creates free API key
5. Copies and pastes into Playlist Lab Settings
6. Clicks "Test Connection" to verify
7. Clicks "Save API Key"
8. Green success message appears

### Using AI Generation

**With Saved API Key:**
1. Go to Import page
2. Select "AI Generated" source
3. See green checkmark confirming API key is configured
4. Enter playlist description
5. Click "Generate Playlist"
6. Review results and confirm

**Without Saved API Key:**
1. Go to Import page
2. Select "AI Generated" source
3. Enter API key in the password field
4. Enter playlist description
5. Click "Generate Playlist"
6. (Optional) Go to Settings to save the key for future use

## Security

- API keys are stored encrypted in the database
- Password fields hide the API key from view
- API key is only sent from browser to user's own server
- Server uses the key to make requests to Grok API
- No API key is ever exposed in logs or error messages

## Error Handling

**Invalid API Key:**
- Test button shows: "Invalid Grok API key. Please check your API key."
- Generation fails with: "Invalid Grok API key. Please check your API key and try again."

**No Library Selected:**
- Generation fails with: "No library selected. Please go to Settings and select a music library first."

**Connection Timeout:**
- Test button shows: "Connection timeout. Please check your internet connection."

**No Tracks Found:**
- Returns empty playlist with message explaining no matches were found

## Fallback Behavior

If Grok API fails for any reason (except authentication errors), the system falls back to simple keyword extraction:
- Extracts keywords from the prompt
- Removes common stop words
- Searches Plex library with extracted keywords
- Still generates a playlist, just with less intelligent queries

## Technical Details

### Database Schema

```sql
ALTER TABLE user_settings ADD COLUMN grok_api_key TEXT;
```

### Migration

Automatic migration runs on server startup:
- Checks if `grok_api_key` column exists
- Adds it if missing
- No data loss, safe to run multiple times

### API Integration

- Uses Grok Beta model (`grok-beta`)
- Endpoint: `https://api.x.ai/v1/chat/completions`
- Temperature: 0.7 for search queries, 0.8 for playlist names
- Timeout: 10 seconds for test requests
- No streaming (uses complete responses)

### Search Strategy

1. Grok extracts 5-10 search queries from prompt
2. Each query searches Plex library (limited to user's selected library)
3. Top 5 tracks from each query are collected
4. Duplicates removed by `ratingKey`
5. Results shuffled for variety
6. Limited to 50 tracks total

## Future Enhancements

Possible improvements:
- Support for other AI providers (OpenAI, Claude, etc.)
- More sophisticated track selection algorithms
- Playlist refinement based on user feedback
- Mood/energy analysis of tracks
- Collaborative filtering based on listening history
- Integration with music recommendation services

## Documentation

- **User Guide:** docs/GROK_API_SETUP.md
- **API Reference:** docs/API.md
- **This Summary:** docs/AI_FEATURES_SUMMARY.md
