# Quick 2FA Login Fix

## The Problem You're Seeing

You click "Sign in with Plex", it opens Plex, you sign in (with 2FA), and you see:

```
Thanks! You have successfully signed in.
You may now close this window.
```

But when you go back to Playlist Lab, it's still waiting and never logs you in.

## Why This Happens

The PIN-based authentication doesn't always detect when 2FA users complete sign-in. This is a known issue with Plex's PIN OAuth flow and 2FA.

## Solution: Use Token Login (Requires Rebuild)

### Step 1: Rebuild the Web App

```cmd
cd apps\web
npm run build
```

This will take 1-2 minutes. You'll see:
```
> @playlist-lab/web@2.0.0 build
> tsc && vite build

✓ built in 30s
```

### Step 2: Restart the Server

Close the server and restart it (or just refresh the page if it's already running in production mode).

### Step 3: Use Token Login

1. Go to http://localhost:3001
2. You'll now see TWO login options:
   - "Sign in with Plex (PIN Method)" - the old way
   - "Login with Claim Token (Recommended for 2FA)" - NEW!

3. Click "Login with Claim Token"

4. Click the "Get Claim Token from Plex →" button

5. This opens https://www.plex.tv/claim/ in a new tab

6. Sign in to Plex (with your 2FA code)

7. You'll see a token like: `claim-xxxxxxxxxxxx`

8. Copy that entire token

9. Go back to Playlist Lab

10. Paste the token in the text field

11. Click "Login"

You should be logged in immediately!

---

## Alternative: Wait Longer on PIN Method

Sometimes the PIN method DOES work with 2FA, but it takes longer. After you see the success screen:

1. Close the Plex tab
2. Go back to Playlist Lab
3. Wait up to 2-3 minutes
4. The app polls every 5 seconds, so it might eventually detect it

But the token method is much more reliable for 2FA users.

---

## If You Don't Want to Rebuild

You can manually get your Plex token and use it directly:

### Method 1: Get Token from Plex.tv

1. Go to https://www.plex.tv/claim/
2. Sign in (with 2FA)
3. Copy the claim token (starts with "claim-")
4. Use the browser console to login:

```javascript
fetch('/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ token: 'claim-YOUR-TOKEN-HERE' })
}).then(r => r.json()).then(console.log)
```

5. If it says `success: true`, refresh the page

### Method 2: Get Your Permanent Token

1. Sign in to Plex on the web
2. Open any Plex page
3. Open browser DevTools (F12)
4. Go to Console tab
5. Type: `localStorage.myPlexAccessToken`
6. Copy the token (without quotes)
7. Use the same console method above with your permanent token

---

## Recommended: Just Rebuild

The rebuild takes 2 minutes and gives you a proper UI for token login. It's worth it!

```cmd
cd apps\web
npm run build
```

Then refresh http://localhost:3001 and you'll see the new login options.
