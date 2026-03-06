# Spotify Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"** button
4. Fill in the form:
   - **App name**: `Playlist Lab` (or any name you want)
   - **App description**: `Personal playlist management`
   - **Redirect URI**: `http://localhost:3000/api/spotify/callback`
   - **Which API/SDKs are you planning to use?**: Check "Web API"
5. Accept the terms and click **"Save"**

### Step 2: Get Your Client ID and Client Secret

1. Click on your newly created app
2. Click **"Settings"** button
3. Copy the **Client ID** (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
4. Click **"View client secret"** and copy the **Client Secret**

### Step 3: Configure Playlist Lab

1. Open `apps/server/.env` file (create it if it doesn't exist)
2. Add your Client ID and Client Secret:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
   ```
3. Save the file

### Step 4: Restart Server

```bash
# Stop the server (Ctrl+C)
# Start it again
cd apps/server
npm run dev
```

### Step 5: Test Connection

1. Go to Import page
2. Select Spotify source
3. Click "Connect to Spotify"
4. Log in with your Spotify account
5. ✅ Done!

## Troubleshooting

### Error: "INVALID_CLIENT: Invalid redirect URI"

**Problem**: The redirect URI in your Spotify app doesn't match.

**Solution**:
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Click "Settings"
4. Under "Redirect URIs", make sure you have **exactly**:
   ```
   http://localhost:3000/api/spotify/callback
   ```
5. Click "Save"
6. Try connecting again

### Error: "Spotify integration not configured"

**Problem**: `SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_SECRET` is not set in environment variables.

**Solution**:
1. Make sure you created the `.env` file in `apps/server/`
2. Make sure you added both `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
3. Restart the server

### Error: "Invalid client"

**Problem**: The Client ID or Client Secret is incorrect.

**Solution**:
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Click "Settings"
4. Copy the Client ID again (make sure no extra spaces)
5. Click "View client secret" and copy the Client Secret
6. Update your `.env` file
7. Restart the server

## Production Setup

For production deployment, update the redirect URI:

### Step 1: Add Production Redirect URI

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Click "Settings"
4. Add your production redirect URI:
   ```
   https://yourdomain.com/api/spotify/callback
   ```
5. Click "Save"

### Step 2: Update Environment Variables

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=https://yourdomain.com/api/spotify/callback
```

## Security Notes

### Client ID and Client Secret are Confidential

- The Client ID is **public** - it's safe to include in client-side code
- The Client Secret is **confidential** - never expose it to clients
- Both are used for server-side OAuth flow
- The access token is tied to the user's Spotify account

### Refresh Tokens

- Authorization code flow provides refresh tokens
- Tokens are automatically refreshed when expired
- Users stay connected indefinitely
- Refresh tokens are encrypted before storage

### Token Security

- Access tokens are encrypted before storage
- Tokens expire after 1 hour
- Users must reconnect when tokens expire
- Tokens are never exposed to the client

## FAQ

### Do I need a Spotify Premium account?

No, a free Spotify account works fine for creating apps.

### Can multiple users use the same app?

Yes! Your Spotify app can be used by unlimited users. Each user logs in with their own Spotify account.

### What if Spotify rejects my app?

Spotify apps for personal use are usually approved automatically. If rejected:
1. Make sure you filled in all required fields
2. Use a descriptive app name and description
3. Accept the terms of service
4. Try creating the app again

### Can I use this in production?

Yes, but you should:
1. Add your production domain to redirect URIs
2. Use HTTPS (required for production)
3. Keep your `.env` file secure
4. Monitor your app's usage in Spotify Dashboard

### How many API calls can I make?

Spotify's rate limits are generous for personal use:
- Rate limiting is per user, not per app
- Typical limit: 180 requests per minute per user
- More than enough for playlist imports

## Support

If you're still having issues:

1. Check the server logs for detailed error messages
2. Verify your Client ID is correct (no extra spaces)
3. Make sure the redirect URI matches exactly
4. Try creating a new Spotify app
5. Check [Spotify's documentation](https://developer.spotify.com/documentation/web-api)

## Example .env File

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_PATH=./data/playlist-lab.db

# Session Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Spotify OAuth
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
```

## Next Steps

After setting up Spotify:

1. ✅ Connect your Spotify account
2. ✅ Import your playlists
3. ✅ Access private playlists
4. ✅ Schedule automatic imports
5. ✅ Use AI to generate playlists

Enjoy! 🎵
