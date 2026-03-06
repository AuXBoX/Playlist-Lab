# Login Troubleshooting Guide

## Stuck on "Thanks! You have successfully signed in" Page

### What's Happening
After authenticating with Plex, you see a success message but aren't automatically redirected back to Playlist Lab.

### Quick Fix (Immediate) - For 2FA Users
If you have Two-Factor Authentication (2FA) enabled on your Plex account:

**Option 1: Use Token Login (Recommended for 2FA)**
1. Go back to http://localhost:3001
2. Click "Login with Plex Token" at the bottom
3. Get your Plex token from https://www.plex.tv/claim/
4. Paste the token and click "Login"
5. You'll be logged in immediately

**Option 2: Try PIN Login Again**
1. **Close the Plex authentication tab** (the one showing the success message)
2. **Go back to the Playlist Lab tab** (should still show "Waiting for Plex...")
3. **Wait 5 seconds** - the polling mechanism should detect your authentication
4. If nothing happens after 10 seconds, **refresh the Playlist Lab page** - you should now be logged in

### Why This Happens
The Plex OAuth flow uses a PIN-based authentication system:
1. Playlist Lab creates a PIN and opens Plex's auth page in a new tab
2. You authenticate with Plex in that tab (including 2FA if enabled)
3. Plex shows a success message but doesn't automatically close the tab
4. Meanwhile, the original Playlist Lab tab polls every 5 seconds to check if you've authenticated
5. Once detected, it should redirect you to the dashboard

**For 2FA users:** Sometimes the polling doesn't detect the authentication immediately after 2FA completion. Using the token login method is more reliable.

### If the Quick Fix Doesn't Work

#### Check Browser Console
1. Open the Playlist Lab tab
2. Press F12 to open Developer Tools
3. Go to the Console tab
4. Look for any errors (red text)
5. Common issues:
   - CORS errors: Check that cookies are enabled
   - Network errors: Check that the server is running
   - Session errors: Try clearing cookies and logging in again

#### Check Server Logs
If you're running the installed version:
1. Open the tray app
2. Click "View Logs"
3. Look for authentication-related errors
4. Common issues:
   - Database errors
   - Session store errors
   - Plex API errors

#### Clear Browser Data
1. Open browser settings
2. Clear cookies and site data for `localhost:3001`
3. Try logging in again

#### Restart the Server
1. Stop the server (tray app → Stop Server)
2. Wait 5 seconds
3. Start the server (tray app → Start Server)
4. Try logging in again

### Alternative: Manual Token Login

If the PIN flow continues to fail (especially with 2FA), you can use your Plex token directly:

1. **Get your Plex token:**
   - **Option A - Claim Token (temporary, 4 minutes):**
     - Go to https://www.plex.tv/claim/
     - Copy the claim token (starts with `claim-`)
     - Use it immediately (expires in 4 minutes)
   
   - **Option B - Permanent Token (recommended):**
     - Log into https://app.plex.tv
     - Open your browser's Developer Tools (F12)
     - Go to Console tab
     - Paste this command and press Enter:
       ```javascript
       window.localStorage.getItem('myPlexAccessToken')
       ```
     - Copy the token (without quotes)

2. **Use the token in Playlist Lab:**
   - On the login page, click "Login with Plex Token"
   - Paste your token
   - Click "Login"

**Important:** Keep your token secure - it provides full access to your Plex account!

### Known Issues

#### Two-Factor Authentication (2FA)
- The PIN flow DOES work with 2FA
- You'll be prompted for your authenticator code in the Plex tab
- Complete the 2FA challenge before the success page appears
- **If polling fails after 2FA:** Use the "Login with Plex Token" option instead
- The token login bypasses the PIN flow entirely and works reliably with 2FA

#### Browser Popup Blockers
- The auth flow opens a new tab (not a popup)
- If the tab doesn't open, check your browser's popup blocker
- Allow popups for `localhost:3001`

#### Session Cookie Issues
- Playlist Lab uses session cookies for authentication
- Make sure cookies are enabled in your browser
- Check that "Block third-party cookies" doesn't affect localhost

#### Server Not Running
- The tray app might show "Stopped" even if the server is running
- Check by opening http://localhost:3001 in your browser
- If you see the login page, the server is running
- The tray app status detection may have a bug

### Still Having Issues?

1. Check the server logs for detailed error messages
2. Try the development mode login (if available)
3. Check that your Plex account is working by logging into https://app.plex.tv
4. Verify the server is accessible at http://localhost:3001

### For Developers

#### Debug the Polling Mechanism
```javascript
// In browser console on the login page
// Check if polling is active
console.log(window.__cancelPlexAuth);

// Manually trigger a poll
fetch('/api/auth/poll', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ pinId: YOUR_PIN_ID, code: 'YOUR_CODE' })
}).then(r => r.json()).then(console.log);
```

#### Check Session
```javascript
// Check if you're authenticated
fetch('/api/auth/me', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);
```

#### Force Logout
```javascript
// Clear session
fetch('/api/auth/logout', { 
  method: 'POST', 
  credentials: 'include' 
}).then(() => location.reload());
```
