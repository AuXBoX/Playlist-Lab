# Session Authentication Debug Guide

## Problem
After successful Plex authentication, the session cookie is being sent by the browser but the server returns 401 Unauthorized on `/api/auth/me`.

## Recent Changes

### 1. Added Detailed Logging

**Session Store** (`apps/server/src/middleware/session-store.ts`):
- Logs when sessions are saved
- Logs when sessions are loaded
- Logs when sessions are not found
- Verifies session write to database

**Auth Middleware** (`apps/server/src/middleware/auth.ts`):
- Logs authentication checks
- Logs session ID and userId
- Logs cookie presence
- Logs user lookup results

**Server Index** (`apps/server/src/index.ts`):
- Added debug middleware for `/api/auth` endpoints
- Logs raw cookie headers
- Logs session ID
- Logs full session data

**Auth Routes** (`apps/server/src/routes/auth.ts`):
- Logs session creation
- Logs session save success/failure

### 2. Increased Client-Side Delay

**LoginPage** (`apps/web/src/pages/LoginPage.tsx`):
- Increased delay from 500ms to 1000ms before checking auth status
- Gives more time for session to be fully persisted

## How to Debug

### Step 1: Rebuild and Start Server

```bash
# Rebuild the server
cd apps/server
npm run build

# Start the server (watch the console output)
npm start
```

### Step 2: Open Browser Console

1. Open `http://localhost:3001` in your browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Keep it open during the login process

### Step 3: Attempt Login

1. Click "Sign in with Plex (PIN Method)"
2. Complete authentication in the Plex tab
3. Return to the app tab

### Step 4: Check Server Logs

Look for these log entries in the server console:

```
[Session Store] Session saved successfully for sid: ...
[Session Debug] POST /api/auth/poll
[Session Debug] Cookie header: ...
[Session Debug] Session ID: ...
[Session Debug] Session data: { userId: ..., plexUserId: ... }
```

Then when the `/api/auth/me` request is made:

```
[Session Debug] GET /api/auth/me
[Session Debug] Cookie header: ...
[Session Debug] Session ID: ...
[Session Debug] Session data: { userId: ..., plexUserId: ... }
[Session Store] Session loaded successfully for sid: ..., userId: ...
[Auth] Checking authentication for GET /api/auth/me
[Auth] Session ID: ...
[Auth] Session userId: ...
[Auth] Authentication successful for user ...
```

### Step 5: Identify the Issue

Compare the session IDs:

1. **Session ID from `/api/auth/poll`** (when session is created)
2. **Session ID from `/api/auth/me`** (when session is checked)

**If they're different:**
- The cookie is not being sent correctly
- The cookie domain/path is wrong
- The browser is creating a new session

**If they're the same but userId is missing:**
- The session is not being loaded from the database
- The session store has an issue
- The session expired immediately

**If session is not found in database:**
- The session write failed
- SQLite database is locked
- File permissions issue

## Common Issues and Solutions

### Issue 1: Session ID Changes Between Requests

**Symptom:** Different session IDs in logs

**Cause:** Cookie not being sent or parsed correctly

**Solution:**
- Check cookie domain matches (should be `localhost` or undefined)
- Check cookie path is `/`
- Check `sameSite` is `lax` not `strict`
- Check browser is not blocking cookies

### Issue 2: Session Saved But Not Loaded

**Symptom:** Session save succeeds, but load returns null

**Cause:** Database write not flushed, or session expired

**Solution:**
- Check SQLite database file permissions
- Check session expiration time
- Verify database file is not locked
- Check disk space

### Issue 3: Cookie Not Sent by Browser

**Symptom:** Cookie header is missing in `/api/auth/me` request

**Cause:** Browser security policy or cookie settings

**Solution:**
- Check `credentials: 'include'` in fetch calls
- Check CORS allows credentials
- Check cookie is not `secure: true` on HTTP
- Check browser cookie settings

## Expected Flow

1. User clicks login → `/api/auth/start` creates PIN
2. User authorizes in Plex
3. Client polls `/api/auth/poll`
4. Server gets auth token from Plex
5. Server creates user in database
6. Server sets `req.session.userId = user.id`
7. Server calls `req.session.save(callback)`
8. Session store writes to SQLite database
9. Session store verifies write succeeded
10. Server sends response with `Set-Cookie` header
11. Browser stores cookie
12. Client waits 1000ms
13. Client calls `/api/auth/me` with cookie
14. Server receives cookie
15. Session middleware parses cookie → session ID
16. Session store loads session from database
17. Session has `userId` property
18. Auth middleware loads user from database
19. Server returns user data

## Next Steps

After running the debug steps above, check the server logs and identify which step is failing. The detailed logging should show exactly where the authentication flow breaks down.

If the issue persists, check:
- SQLite database file: `apps/server/data/playlist-lab.db`
- Session table: `SELECT * FROM sessions;`
- User table: `SELECT * FROM users;`
