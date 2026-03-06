# Plex OAuth Authentication Fix

## Problem
When users tried to authenticate with Plex, they would see the error:
> "We were unable to complete this request. You may now close this window."

This occurred after clicking "Sign in with Plex" and being redirected to `app.plex.tv/auth`.

## Root Cause
There were two issues in the authentication flow:

### Issue 1: Missing Parameters
The web app's `AuthContext.tsx` was calling `/api/auth/poll` with only `pinCode`, but the server expected both `pinId` and `code`:

**Server Expected:**
```typescript
{ pinId: number, code: string }
```

**Client Was Sending:**
```typescript
{ pinCode: string }  // Missing pinId!
```

### Issue 2: Inconsistent Response Field Names
The `/api/auth/poll` endpoint returned different field names than `/api/auth/me`:

**Poll Response (Before Fix):**
```json
{
  "authenticated": true,
  "user": {
    "plexUserId": "...",
    "username": "...",      // ❌ Inconsistent
    "thumb": "..."          // ❌ Inconsistent
  }
}
```

**Me Response:**
```json
{
  "plexUserId": "...",
  "plexUsername": "...",    // ✅ Correct
  "plexThumb": "..."        // ✅ Correct
}
```

## Solution

### Fix 1: Pass Both pinId and code
Updated the web app to properly pass both parameters:

**apps/web/src/contexts/AuthContext.tsx:**
- Changed `login` function signature from `(pinCode: string)` to `(pinId: number, code: string)`
- Updated request body to include both `pinId` and `code`

**apps/web/src/pages/LoginPage.tsx:**
- Added `pinId` state variable
- Updated `pollForAuth` to accept both `pinId` and `code`
- Pass both parameters to the `login` function

### Fix 2: Standardize Response Field Names
Updated the server to use consistent field names:

**apps/server/src/routes/auth.ts:**
```typescript
// Changed from:
username: user.plex_username,
thumb: user.plex_thumb,

// To:
plexUsername: user.plex_username,
plexThumb: user.plex_thumb,
```

**apps/web/src/contexts/AuthContext.tsx:**
```typescript
// Updated to match server response:
plexUsername: data.user.plexUsername,
plexThumb: data.user.plexThumb,
```

## Files Modified
1. `apps/web/src/contexts/AuthContext.tsx` - Fixed login function parameters and response handling
2. `apps/web/src/pages/LoginPage.tsx` - Added pinId state and updated polling
3. `apps/server/src/routes/auth.ts` - Standardized response field names
4. Server rebuilt with `npm run build`

## Testing
To test the fix:

1. Start the development environment:
   ```bash
   start-dev.bat
   ```

2. Open browser to `http://localhost:5173`

3. Click "Sign in with Plex"

4. A new window should open to `app.plex.tv/auth`

5. Authorize the application

6. The window should close and you should be logged in

## Technical Details

### Plex PIN-Based OAuth Flow
1. Client calls `/api/auth/start` to create a PIN
2. Server returns `{ id, code, authUrl }`
3. Client opens `authUrl` in browser for user to authorize
4. Client polls `/api/auth/poll` with `pinId` and `code`
5. Server checks if PIN has been authorized
6. Once authorized, server creates session and returns user info
7. Client stores user info and redirects to dashboard

### Why This Happened
The original implementation was based on the mobile app's auth flow, which had the correct parameters. However, when the web app was created, the `login` function signature was simplified to only accept `pinCode`, breaking the flow.

The field name inconsistency was likely an oversight during initial development, where different naming conventions were used in different endpoints.

## Status
✅ **FIXED** - Plex OAuth authentication now works correctly
