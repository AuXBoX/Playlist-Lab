# Login Testing Steps

## Quick Rebuild and Test

### 1. Rebuild the Server

Run the quick rebuild script:
```bash
scripts\rebuild-server-quick.bat
```

This will:
- Build the server with the new debug logging
- Stop any running server instances
- Start the server in a new console window

### 2. Test the Login Flow

1. Open your browser to http://localhost:3001
2. Open DevTools (F12) and go to the Console tab
3. Click "Sign in with Plex (PIN Method)"
4. Complete the Plex authorization
5. Watch the console for any errors

### 3. Check Debug Endpoint

After attempting to log in, visit:
```
http://localhost:3001/api/auth/debug-session
```

This will show you:
- Current session ID
- Session data (userId, plexUserId)
- Cookie headers
- Timestamp

Expected response if logged in:
```json
{
  "sessionID": "abc123...",
  "sessionData": {
    "userId": 1,
    "plexUserId": "12345",
    "cookie": { ... }
  },
  "headers": {
    "cookie": "playlist-lab.sid=s%3A...",
    "userAgent": "Mozilla/5.0..."
  },
  "timestamp": "2026-03-01T..."
}
```

Expected response if NOT logged in:
```json
{
  "sessionID": "xyz789...",
  "sessionData": {
    "userId": null,
    "plexUserId": null,
    "cookie": { ... }
  },
  "headers": {
    "cookie": "playlist-lab.sid=s%3A...",
    "userAgent": "Mozilla/5.0..."
  },
  "timestamp": "2026-03-01T..."
}
```

### 4. Check Server Logs

Look at the server console window for these log messages:

**During login (POST /api/auth/poll):**
```
Creating session for user { userId: 1, plexUserId: '12345', sessionId: 'abc123...' }
[Session Store] Session saved successfully for sid: abc123...
Session saved successfully { sessionId: 'abc123...', userId: 1 }
```

**When checking auth (GET /api/auth/me):**
```
[Auth] Checking authentication for GET /api/auth/me
[Auth] Session ID: abc123...
[Auth] Session userId: 1
[Auth] Cookie header: present
[Session Store] Session loaded successfully for sid: abc123..., userId: 1
[Auth] Authentication successful for user 1 (username)
```

### 5. Check Database

Open the database and verify the session was saved:

```bash
cd "C:\Program Files\Playlist Lab Server\server\data"
sqlite3 playlist-lab.db
```

```sql
-- Check sessions
SELECT 
  sid, 
  substr(sess, 1, 200) as session_data,
  datetime(expired, 'unixepoch') as expires_at,
  datetime('now') as current_time
FROM sessions
ORDER BY expired DESC
LIMIT 5;
```

You should see:
- A session with your session ID
- Session data containing your userId
- Expiration date in the future (30 days from now)

### 6. Check Browser Cookies

In Firefox DevTools:
1. Go to Storage tab
2. Click Cookies → http://localhost:3001
3. Find `playlist-lab.sid`
4. Verify:
   - Value starts with `s%3A`
   - Path is `/`
   - HttpOnly is checked
   - Secure is NOT checked (localhost)
   - SameSite is `Lax`

### 7. Test Auth Check

After logging in, open DevTools Network tab and visit:
```
http://localhost:3001/api/auth/me
```

Expected: 200 OK with user data
Actual (if bug persists): 401 Unauthorized

Check the request headers to verify the cookie is being sent:
```
Cookie: playlist-lab.sid=s%3A...
```

## Troubleshooting

### Issue: Session ID changes between requests

**Symptom**: The session ID in the debug endpoint is different from the one in the login logs.

**Cause**: Session is not being persisted, so each request creates a new session.

**Fix**: Check that `saveUninitialized: false` and `resave: false` are set in session config.

### Issue: Session saved but not loaded

**Symptom**: Login logs show "Session saved successfully" but auth check shows "Session not found".

**Cause**: Session store's `get()` method is not finding the session in the database.

**Fix**: 
1. Check database file permissions
2. Verify session isn't expired
3. Check session ID matches exactly (no extra characters)

### Issue: Cookie not being sent

**Symptom**: Auth check logs show "Cookie header: missing".

**Cause**: Browser is not sending the cookie with the request.

**Fix**:
1. Verify `credentials: 'include'` in fetch requests
2. Check CORS allows credentials
3. Verify cookie domain/path match the request URL

### Issue: Cookie sent but session empty

**Symptom**: Cookie is present but `userId` is null in debug endpoint.

**Cause**: Session data was not saved properly or was cleared.

**Fix**:
1. Check that `req.session.save()` callback is executing
2. Verify no errors in session store logs
3. Check database write succeeded

## What to Report

If the issue persists, please provide:

1. **Server logs** from the console window (copy all output from login attempt)
2. **Debug endpoint response** (visit http://localhost:3001/api/auth/debug-session after login)
3. **Database query results** (the SQL query from step 5)
4. **Browser cookie details** (screenshot from DevTools Storage tab)
5. **Network request details** (screenshot of /api/auth/me request in Network tab)

This will help identify exactly where the session is being lost.
