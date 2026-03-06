# Testing Plex Authentication

## Quick Test Steps

1. **Start the development environment:**
   ```bash
   start-dev.bat
   ```
   This will start both the server (port 3000) and web app (port 5173).

2. **Open your browser:**
   Navigate to `http://localhost:5173`

3. **You should see the login page:**
   - Title: "Login"
   - Text: "Sign in with your Plex account to continue"
   - Button: "Sign in with Plex"

4. **Click "Sign in with Plex":**
   - A new popup window should open to `app.plex.tv/auth`
   - The main window should show a PIN code (e.g., "ABCD1234")
   - Text should say "Waiting for authentication..."

5. **In the popup window:**
   - You'll see "Link Playlist Lab"
   - Click "Continue" or "Accept"
   - The popup should close automatically

6. **Back in the main window:**
   - You should be automatically redirected to the dashboard
   - You should see your Plex username in the top right

## What Was Fixed

Previously, the authentication would fail at step 5 with the error:
> "We were unable to complete this request. You may now close this window."

This was because:
1. The web app wasn't sending the `pinId` parameter to the server
2. The server response field names didn't match what the client expected

Both issues have been fixed.

## Troubleshooting

### "Failed to start authentication"
- Check that the server is running on port 3000
- Check browser console for errors
- Verify `start-dev.bat` started both processes

### "Authentication timed out"
- The PIN expires after 5 minutes
- Click "Sign in with Plex" again to get a new PIN
- Make sure you clicked "Accept" in the Plex popup

### Popup window doesn't open
- Check if your browser is blocking popups
- Allow popups for `localhost:5173`
- Try clicking the button again

### Still seeing "We were unable to complete this request"
- Make sure you rebuilt the server: `npm run build` in `apps/server`
- Restart the development environment
- Clear your browser cache and cookies for localhost

## Expected Behavior

### Server Logs
You should see in the server console:
```
[INFO] New user created { plexUserId: '12345', username: 'YourUsername' }
```
or
```
[INFO] User logged in { plexUserId: '12345', username: 'YourUsername' }
```

### Browser Network Tab
1. `POST /api/auth/start` → Returns `{ id, code, authUrl }`
2. Multiple `POST /api/auth/poll` → Returns `{ authenticated: false }` until authorized
3. Final `POST /api/auth/poll` → Returns `{ authenticated: true, user: {...} }`
4. `GET /api/auth/me` → Returns user info

## Next Steps

Once authentication works:
1. You'll be redirected to the dashboard
2. You can configure your Plex server connection
3. You can start importing playlists and generating mixes

## Need Help?

If authentication still doesn't work:
1. Check the server logs in the console
2. Check the browser console for JavaScript errors
3. Check the Network tab in browser DevTools
4. Verify both server and web app are running
