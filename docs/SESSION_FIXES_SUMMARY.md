# Session Authentication Fixes Summary

## Problem

The web app PIN authentication was completing successfully in Plex, but the session was not being recognized when checking `/api/auth/me`. The browser would receive a 401 Unauthorized response even though the session cookie was being sent.

## Root Causes Identified

1. **Session Save Race Condition**: Sessions weren't being explicitly saved before sending responses, causing race conditions where the client would check for the session before it was written to the database.

2. **Port Mismatch**: The tray app was checking port 3000 but the server runs on port 3001, causing status check failures.

3. **Cookie Configuration**: Initial cookie settings weren't optimized for localhost development.

## Fixes Implemented

### 1. Explicit Session Saving (apps/server/src/routes/auth.ts)

Added explicit `req.session.save()` calls with callbacks in both authentication endpoints:

**POST /api/auth/poll** (PIN method):
```typescript
// Create session
req.session.userId = user.id;
req.session.plexUserId = user.plex_user_id;

// Explicitly save session before responding
req.session.save((err) => {
  if (err) {
    logger.error('Failed to save session:', err);
    return next(createInternalError('Failed to create session'));
  }

  res.json({
    authenticated: true,
    user: { ... }
  });
});
```

**POST /api/auth/token** (manual token):
```typescript
// Create session
req.session.userId = user.id;
req.session.plexUserId = user.plex_user_id;

// Explicitly save session before responding
req.session.save((err) => {
  if (err) {
    logger.error('Failed to save session:', err);
    return next(createInternalError('Failed to create session'));
  }

  res.json({
    success: true,
    user: { ... }
  });
});
```

### 2. Cookie Configuration (apps/server/src/index.ts)

Optimized cookie settings for localhost development:

```typescript
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'playlist-lab.sid',
  cookie: {
    httpOnly: true,
    secure: useSecureCookies, // false for localhost, true for production HTTPS
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax',
    path: '/',
    domain: undefined, // Let browser handle domain (works for localhost)
  },
}));
```

### 3. HTTPS Support (apps/server/src/index.ts)

Added optional HTTPS support with self-signed certificates:

```typescript
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';

if (ENABLE_HTTPS) {
  // Load or generate self-signed certificates
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    logger.info(`HTTPS Server running on https://localhost:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    logger.info(`HTTP Server running on http://localhost:${PORT}`);
  });
}
```

### 4. Enhanced Logging

Added comprehensive logging throughout the authentication flow:

**Session Store (apps/server/src/middleware/session-store.ts)**:
```typescript
// Log session operations
console.log(`[Session Store] Session saved successfully for sid: ${sid.substring(0, 10)}...`);
console.log(`[Session Store] Session loaded successfully for sid: ${sid.substring(0, 10)}..., userId: ${session.userId || 'none'}`);
console.log(`[Session Store] Session not found for sid: ${sid.substring(0, 10)}...`);
```

**Auth Middleware (apps/server/src/middleware/auth.ts)**:
```typescript
console.log(`[Auth] Checking authentication for ${req.method} ${req.path}`);
console.log(`[Auth] Session ID: ${req.sessionID?.substring(0, 10)}...`);
console.log(`[Auth] Session userId: ${req.session.userId || 'none'}`);
console.log(`[Auth] Cookie header: ${req.headers.cookie ? 'present' : 'missing'}`);
```

**Auth Routes (apps/server/src/routes/auth.ts)**:
```typescript
logger.info('Creating session for user', { 
  userId: user.id, 
  plexUserId: user.plex_user_id,
  sessionId: req.sessionID 
});

logger.info('Session saved successfully', { 
  sessionId: req.sessionID,
  userId: user.id 
});
```

### 5. Debug Endpoint (apps/server/src/routes/auth.ts)

Added a debug endpoint to inspect session state:

```typescript
router.get('/debug-session', (req: Request, res: Response) => {
  res.json({
    sessionID: req.sessionID,
    sessionData: {
      userId: req.session.userId,
      plexUserId: req.session.plexUserId,
      cookie: req.session.cookie,
    },
    headers: {
      cookie: req.headers.cookie,
      userAgent: req.headers['user-agent'],
    },
    timestamp: new Date().toISOString(),
  });
});
```

Access at: `http://localhost:3001/api/auth/debug-session`

### 6. Tray App Port Fix (scripts/installers/windows/tray-app.js)

Updated default port to match server:

```javascript
const SERVER_PORT = process.env.PORT || 3001; // Changed from 3000
```

### 7. Login Page Improvements (apps/web/src/pages/LoginPage.tsx)

- Removed confusing claim token instructions
- Added better error handling and logging
- Improved user feedback during authentication
- Added proper credentials handling in fetch requests

## Testing Tools Created

### 1. Session Debug Guide (docs/SESSION_DEBUG_GUIDE.md)
Comprehensive guide for debugging session issues with:
- Step-by-step debugging procedures
- Database queries to check session state
- Browser DevTools instructions
- Common issues and solutions

### 2. Login Testing Steps (docs/LOGIN_TESTING_STEPS.md)
Step-by-step testing procedure with:
- Quick rebuild script
- Debug endpoint usage
- Server log interpretation
- Database verification
- Browser cookie inspection

### 3. Quick Rebuild Script (scripts/rebuild-server-quick.bat)
Automated script to:
- Build the server
- Stop running instances
- Start server with new code

## How to Test

1. Run the quick rebuild script:
   ```bash
   scripts\rebuild-server-quick.bat
   ```

2. Open browser to http://localhost:3001

3. Try logging in with PIN method

4. Check debug endpoint:
   ```
   http://localhost:3001/api/auth/debug-session
   ```

5. Review server logs in the console window

6. Check database:
   ```sql
   SELECT sid, substr(sess, 1, 200), datetime(expired, 'unixepoch') 
   FROM sessions 
   ORDER BY expired DESC 
   LIMIT 5;
   ```

## Expected Behavior

### Successful Login Flow

1. User clicks "Sign in with Plex"
2. POST `/api/auth/start` returns PIN code
3. User authorizes in Plex
4. POST `/api/auth/poll` returns:
   ```json
   {
     "authenticated": true,
     "user": { "id": 1, ... }
   }
   ```
5. Server logs show:
   ```
   Creating session for user { userId: 1, ... }
   [Session Store] Session saved successfully
   Session saved successfully { sessionId: '...', userId: 1 }
   ```
6. Browser receives `Set-Cookie: playlist-lab.sid=...`
7. GET `/api/auth/me` returns:
   ```json
   {
     "id": 1,
     "plexUserId": "...",
     "plexUsername": "...",
     "isAdmin": true
   }
   ```

### Debug Endpoint Response (Logged In)

```json
{
  "sessionID": "abc123...",
  "sessionData": {
    "userId": 1,
    "plexUserId": "12345",
    "cookie": {
      "originalMaxAge": 2592000000,
      "expires": "2026-03-31T...",
      "httpOnly": true,
      "path": "/"
    }
  },
  "headers": {
    "cookie": "playlist-lab.sid=s%3Aabc123...",
    "userAgent": "Mozilla/5.0..."
  },
  "timestamp": "2026-03-01T..."
}
```

## Remaining Issues

### Tray App Status

The tray app may still show "Stopped" even when the server is running on port 3001. This requires rebuilding the installer with the updated tray-app.js file.

**To fix**:
1. Rebuild the Windows installer:
   ```bash
   scripts\installers\windows\build-windows.bat
   ```
2. Reinstall Playlist Lab Server
3. Tray app will now check port 3001

## Files Modified

1. `apps/server/src/routes/auth.ts` - Added session.save() and logging
2. `apps/server/src/index.ts` - Updated cookie config and HTTPS support
3. `apps/server/src/middleware/auth.ts` - Added debug logging
4. `apps/server/src/middleware/session-store.ts` - Added logging
5. `apps/web/src/pages/LoginPage.tsx` - Improved error handling
6. `scripts/installers/windows/tray-app.js` - Updated default port

## Files Created

1. `docs/SESSION_DEBUG_GUIDE.md` - Debugging procedures
2. `docs/LOGIN_TESTING_STEPS.md` - Testing instructions
3. `docs/SESSION_FIXES_SUMMARY.md` - This file
4. `scripts/rebuild-server-quick.bat` - Quick rebuild script

## Next Steps

1. Test the login flow with the new debug logging
2. If issues persist, collect:
   - Server console logs
   - Debug endpoint response
   - Database session data
   - Browser cookie details
   - Network request headers
3. Rebuild installer to fix tray app status
4. Consider adding automated tests for session management

## Additional Notes

### Session Store Implementation

The custom SQLite session store (`SQLiteStore`) handles:
- Session persistence in the database
- Automatic cleanup of expired sessions
- Session verification after writes
- Detailed logging of all operations

### Security Considerations

- Sessions expire after 30 days
- HttpOnly cookies prevent XSS attacks
- SameSite=Lax prevents CSRF attacks
- Secure cookies in production (HTTPS)
- Session secrets should be changed in production

### Performance

- Session cleanup runs every hour
- Expired sessions are automatically deleted
- Database uses indexes on session ID
- Session store operations are synchronous (better-sqlite3)

## References

- Express Session Documentation: https://github.com/expressjs/session
- Cookie Attributes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
- SQLite Session Store: Custom implementation in `apps/server/src/middleware/session-store.ts`
