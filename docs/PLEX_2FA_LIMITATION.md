# Plex 2FA Authentication Limitation

## The Problem

Plex's PIN-based OAuth flow has a known limitation with 2FA-enabled accounts:

1. When you're already logged into Plex in your browser with 2FA
2. The OAuth popup auto-logs you in
3. But it doesn't properly complete the PIN authorization
4. Results in "We were unable to complete this request" error
5. The PIN never gets an auth token attached to it

This is a **Plex API limitation**, not something we can fix in our app.

## The Solution

We need to add a manual token entry option as a fallback for 2FA users.

### How to Get Your Plex Token

1. Go to https://app.plex.tv in your browser
2. Log in with your 2FA
3. Open browser console (F12)
4. Type: `localStorage.getItem('myPlexAccessToken')`
5. Copy the token (long string)
6. Paste it into the "Manual Token" field in the app

This is a one-time setup. The token doesn't expire unless you change your Plex password.

## Next Steps

I'll add a "Use Token Instead" option to the login page that:
- Shows a text input for the token
- Has instructions on how to get it
- Validates and saves the token
- Works perfectly with 2FA

This is how many Plex apps handle 2FA authentication.
