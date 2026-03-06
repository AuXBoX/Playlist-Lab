# Authentication Fix Summary

## Problem Statement

User reported that Plex PIN authentication was not working in the web app. The authentication flow would complete successfully in Plex, but the web app would not log the user in. The browser would show "Authentication successful" but then immediately return to the login page.

## Root Cause Analysis

The issue was a **session persistence race condition**:

1. Server creates session and calls `req.session.save()`
2. Server sends response with `Set-Cookie` header
3. Client receives response and immediately makes `/api/auth/me` request
4. Session might not be fully written to SQLite database yet
5. Session store returns null when loading session
6. Auth middleware sees no userId in session → returns 401

## Implemented Fixes

### 1. Session Store Verification (apps/server/src/middleware/session-store.ts)

**Added:**
- Verification after session write to ensure data was persisted
- Detailed logging for session save/load operations
- Error logging for failed writes

**Code:**
```typescript
// Verify the session was written
const verify = this.db.prepare('SELECT sess FROM sessions WHERE sid = ?');
const row = verify.get(sid) as { sess: string } | undefined;

if (!row) {
  console.error(`[Session Store] Failed to verify session write for sid: ${sid}`);
  if (callback) callback(new Error('Session write verification failed'));
  return;
}

console.log(`[Session Store] Session saved successfully for sid: ${sid.substring(0, 10)}...`);
```

### 2. Auth Middleware Logging (apps/server/src/middleware/auth.ts)

**Added:**
- Detailed logging for every authentication check
- Session ID and userId logging
- Cookie header presence check
- User lookup result logging

**Code:**
```typescript
console.log(`[Auth] Checking authentication for ${req.method} ${req.path}`);
console.log(`[Auth] Session ID: ${req.sessionID?.substring(0, 10)}...`);
console.log(`[Auth] Session userId: ${req.session.userId || 'none'}`);
console.log(`[Auth] Cookie header: ${req.headers.cookie ? 'present' : 'missing'}`);
```

### 3. Server Debug Middleware (apps/server/src/index.ts)

**Added:**
- Debug middleware for `/api/auth` endpoints
- Logs raw cookie headers
- Logs session ID and full session data

**Code:**
```typescript
// Debug middleware to log session info
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/auth')) {
    console.log(`[Session Debug] ${req.method} ${req.path}`);
    console.log(`[Session Debug] Cookie header: ${req.headers.cookie || 'none'}`);
    console.log(`[Session Debug] Session ID: ${req.sessionID || 'none'}`);
    console.log(`[Session Debug] Session data:`, req.session);
  }
  next();
});
```

### 4. Client-Side Delay Increase (apps/web/src/pages/LoginPage.tsx)

**Changed:**
- Increased delay from 500ms to 1000ms before checking auth status
- Gives more time for session to be fully persisted to database

**Code:**
```typescript
// Wait longer for session to be fully saved and propagated
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 5. Tray App Port Fix (scripts/installers/windows/tray-app.js)

**Changed:**
- Updated default port from 3000 to 3001
- Matches user's actual server configuration

**Code:**
```javascript
const SERVER_PORT = process.env.PORT || 3001;
```

## Testing Instructions

### 1. Rebuild Everything

```bash
# From project root
npm run build

# Or rebuild installer
cd scripts
build-all-installers.bat
```

### 2. Start Server with Logging

```bash
cd apps/server
npm start
```

Watch the console output carefully during login.

### 3. Test Login Flow

1. Open `http://localhost:3001` in browser
2. Open browser Developer Tools (F12) → Console tab
3. Click "Sign in with Plex (PIN Method)"
4. Complete authentication in Plex tab
5. Return to app tab
6. Watch both server console and browser console

### 4. Expected Server Logs

```
[Session Debug] POST /api/auth/poll
[Session Debug] Cookie header: none
[Session Debug] Session ID: abc123...
[Session Store] Session saved successfully for sid: abc123...
Creating session for user { userId: 1, plexUserId: '12345', sessionId: 'abc123...' }

[Session Debug] GET /api/auth/me
[Session Debug] Cookie header: playlist-lab.sid=s%3Aabc123...
[Session Debug] Session ID: abc123...
[Session Store] Session loaded successfully for sid: abc123..., userId: 1
[Auth] Checking authentication for GET /api/auth/me
[Auth] Session ID: abc123...
[Auth] Session userId: 1
[Auth] Authentication successful for user 1 (username)
```

### 5. Expected Browser Logs

```
Authentication successful, checking auth status...
Auth check response: 200
User data: { id: 1, plexUserId: '12345', ... }
```

## Troubleshooting

### If Session ID Changes

**Problem:** Session ID in `/api/auth/poll` is different from `/api/auth/me`

**Cause:** Cookie not being sent or browser creating new session

**Check:**
- Browser cookie settings
- Cookie domain/path configuration
- CORS credentials setting

### If Session Not Found

**Problem:** Session saved but not loaded from database

**Cause:** Database write failed or session expired

**Check:**
- SQLite database file permissions
- Disk space
- Database file location: `apps/server/data/playlist-lab.db`
- Run: `SELECT * FROM sessions;` to see if session exists

### If Cookie Not Sent

**Problem:** Cookie header missing in `/api/auth/me` request

**Cause:** Browser security policy

**Check:**
- `credentials: 'include'` in fetch calls
- CORS `credentials: true` on server
- Cookie `secure` setting (should be false for HTTP)
- Cookie `sameSite` setting (should be 'lax')

## Files Modified

1. `apps/server/src/middleware/session-store.ts` - Session verification and logging
2. `apps/server/src/middleware/auth.ts` - Authentication logging
3. `apps/server/src/index.ts` - Debug middleware
4. `apps/web/src/pages/LoginPage.tsx` - Increased delay
5. `scripts/installers/windows/tray-app.js` - Port fix
6. `docs/SESSION_DEBUG_GUIDE.md` - New debug guide
7. `docs/AUTH_FIX_SUMMARY.md` - This file

## Additional Notes

- The session store uses SQLite with synchronous operations
- Session cookies are HTTP-only and last 30 days
- First user is automatically promoted to admin
- Plex Home users are auto-configured with admin's server settings
- Non-home users are disabled by default and require admin approval

## Next Steps

1. User should rebuild the installer with all fixes
2. Test login on `http://localhost:3001`
3. Check server logs for detailed session information
4. If issue persists, share server logs for further analysis
5. Verify tray app shows "Running" status after server starts
