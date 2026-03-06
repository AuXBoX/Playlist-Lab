# Server URL Loading Issue - Fixed

## Problem
When starting the server via the tray app and copying the URL (e.g., `http://localhost:3001`), nothing loaded in the browser.

## Root Cause
The server was running in **production mode** by default (`NODE_ENV=production`), which meant it tried to serve the built web app from `apps/web/dist`. Since the web app wasn't built, there was nothing to serve.

## Changes Made

### 1. Changed Default NODE_ENV to Development
**File:** `tray-app/src/main/config-manager.ts`
- Changed `nodeEnv: 'production'` to `nodeEnv: 'development'`
- This makes the server run in development mode by default

### 2. Added Helpful Development Page
**File:** `apps/server/src/index.ts`
- When accessing the root URL (`/`) in development mode, the server now shows a helpful HTML page
- The page explains that you're in development mode and provides instructions
- Includes a link to start the web app and open `http://localhost:5173`

### 3. Created Documentation
**File:** `DEVELOPMENT_SETUP.md`
- Complete guide on how to use the application in development vs production mode
- Troubleshooting section for common issues

## How to Use Now

### For Development (Recommended)

1. **Start the server** (via tray app or manually):
   - The server will run on `http://localhost:3001` (or 3000)
   - Opening this URL will show a helpful page with instructions

2. **Start the web app** (in a separate terminal):
   ```bash
   cd apps/web
   npm run dev
   ```

3. **Open your browser** to `http://localhost:5173`

### For Production

1. **Build the web app first**:
   ```bash
   cd apps/web
   npm run build
   ```

2. **Change NODE_ENV to production** (in tray app config or environment)

3. **Start the server** - it will serve both API and web app on the same port

## Next Steps

To use the new development mode:

1. **Rebuild the tray app** (so it uses the new default):
   ```bash
   cd tray-app
   npm run build
   ```

2. **Or manually set NODE_ENV** in your environment before starting

## Testing

You can test the fix right now:

1. Stop the server in the tray app
2. Restart it
3. Open `http://localhost:3001` in your browser
4. You should see a helpful page with instructions (if the server was rebuilt)
5. Follow the instructions to start the web app

## Files Modified

- `tray-app/src/main/config-manager.ts` - Changed default NODE_ENV
- `apps/server/src/index.ts` - Added helpful development page
- `DEVELOPMENT_SETUP.md` - New documentation
- `SERVER_URL_FIX.md` - This file
