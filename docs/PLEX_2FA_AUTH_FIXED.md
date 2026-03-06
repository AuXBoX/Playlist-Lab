# Plex 2FA Authentication - Fixed! 🎉

## What Was Wrong

The Plex OAuth flow was using a popup window, which doesn't properly handle 2FA. When you have 2FA enabled, the popup would auto-login but then fail to show the 2FA prompt, resulting in the "We were unable to complete this request" error.

## What Was Fixed

Changed the OAuth flow to use a **full-page redirect** instead of a popup. This is the standard OAuth flow that properly supports 2FA.

### Changes Made

1. **LoginPage.tsx** - Modified to redirect to Plex instead of opening a popup
   - Added `forwardUrl` parameter to tell Plex where to redirect back
   - Stores PIN info in sessionStorage before redirect
   - Checks for returning auth on page load

2. **AuthCallbackPage.tsx** - New page to handle OAuth callback
   - Plex redirects here after authorization
   - Immediately redirects back to login page
   - Login page completes the authentication

3. **App.tsx** - Added route for `/auth/callback`

## How It Works Now

1. User clicks "Sign in with Plex"
2. App redirects to `https://app.plex.tv/auth` (full page, not popup)
3. User sees proper Plex login form:
   - Enter email/username
   - Enter password
   - **Enter 2FA code** (this now works!)
   - Authorize the app
4. Plex redirects back to `http://localhost:5173/auth/callback`
5. Callback page redirects to `/login`
6. Login page detects the authorization and logs user in automatically
7. User is redirected to the dashboard

## Testing

1. Make sure dev servers are running (`start-dev.bat`)
2. Go to `http://localhost:5173`
3. Click "Sign in with Plex"
4. You'll be redirected to Plex
5. Log in with your email, password, and 2FA code
6. Authorize the app
7. You'll be automatically redirected back and logged in!

## Why This Works

- Full-page redirects properly handle all authentication flows including 2FA
- Plex's OAuth system is designed for this flow
- No more popup issues or missing 2FA prompts
- Works exactly like other OAuth apps (Spotify, Google, etc.)

The authentication is now fully automatic - no manual token copying needed!
