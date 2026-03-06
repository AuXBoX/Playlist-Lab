# Login Issue Fix

## Problem
The login succeeds in Plex but fails to create a session in the web app.

## Root Cause
You're accessing the wrong port. The session cookie is tied to the port where it was created.

## Solution

### Check Which Port the Server is Running On

1. Look at the server logs (tray icon → View Logs or check the console)
2. You'll see a line like: `Server running on 0.0.0.0:3000 in production mode`
3. The number after the colon is the port (usually 3000)

### Access the Correct URL

- If server is on port 3000: Use `http://localhost:3000`
- If server is on port 3443 (HTTPS): Use `https://localhost:3443`

### If You Want to Use a Different Port

Edit the `.env` file in the server installation directory:

```
PORT=3001
```

Then restart the server.

## Why This Happens

Session cookies are tied to the specific port. If you:
- Create a session on port 3000
- Try to access it on port 3001
- The browser won't send the cookie (different port = different origin)

## Quick Test

1. Stop the server
2. Start it again
3. Check the logs for the port number
4. Access `http://localhost:[PORT_NUMBER]`
5. Try logging in again

## HTTPS Option (Recommended)

For better security, use HTTPS:

1. Access `https://localhost:3443`
2. Click "Advanced" → "Proceed to localhost" (ignore security warning)
3. Login will work with secure cookies

The security warning is normal for self-signed certificates.
