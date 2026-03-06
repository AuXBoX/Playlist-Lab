# Quick Fix: Login with 2FA (Two-Factor Authentication)

## Your Current Situation
You're stuck on the Plex success page that says "Thanks! You have successfully signed in. You may now close this window."

## Immediate Solution (2 minutes)

### Step 1: Get Your Plex Token
1. Open a new tab and go to: https://www.plex.tv/claim/
2. Log in with your Plex account (including your 2FA code)
3. You'll see a token that looks like: `claim-xxxxxxxxxxxx`
4. **Copy this entire token** (it expires in 4 minutes, so work quickly)

### Step 2: Login to Playlist Lab
1. Go back to http://localhost:3001
2. You should see the login page
3. Click the button that says **"Login with Plex Token"** (at the bottom)
4. Paste your token into the text field
5. Click **"Login"**
6. You'll be logged in immediately!

## Why This Works Better for 2FA Users

The normal PIN-based OAuth flow sometimes has timing issues with 2FA:
- You enter your password
- You enter your 2FA code
- Plex shows success
- But the polling mechanism might not detect it immediately

The token login bypasses this by using your token directly, which already includes your 2FA authentication.

## For Future Logins

You have two options:

### Option 1: Use Token Login Every Time (Easiest)
- Just click "Login with Plex Token"
- Get a fresh token from https://www.plex.tv/claim/
- Paste and login

### Option 2: Try PIN Login (May Work Sometimes)
- Click "Sign in with Plex"
- Complete 2FA in the new tab
- Close that tab
- Wait on the login page for 5-10 seconds
- If it doesn't work, use token login instead

## Getting a Permanent Token (Advanced)

If you want to save your token for repeated use:

1. Log into https://app.plex.tv
2. Press F12 to open Developer Tools
3. Go to the Console tab
4. Type this and press Enter:
   ```javascript
   window.localStorage.getItem('myPlexAccessToken')
   ```
5. Copy the token (without the quotes)
6. Save it securely (it's like a password!)

**Warning:** This token doesn't expire, so keep it secure. Anyone with this token can access your Plex account.

## Still Having Issues?

If token login also fails:
1. Check that the server is running (open http://localhost:3001)
2. Check the tray app logs for errors
3. Try restarting the server
4. Check that cookies are enabled in your browser

## Security Note

Your Plex token is sensitive - it's equivalent to your password. Don't share it with anyone or post it publicly.
