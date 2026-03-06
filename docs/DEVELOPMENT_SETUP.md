# Development Setup Guide

## The Problem

When you start the server via the tray app and copy the URL (e.g., `http://localhost:3001`), nothing loads in the browser. This happens because:

1. The server was running in **production mode** by default
2. In production mode, the server tries to serve the built web app from `apps/web/dist`
3. The web app hasn't been built yet, so there's nothing to serve

## The Solution

I've changed the default `NODE_ENV` from `production` to `development`. Now you need to **rebuild the tray app** for this change to take effect.

## How to Use the Application

### Option 1: Development Mode (Recommended for Development)

Run the server and web app separately:

1. **Start the API Server** (via tray app or manually):
   ```bash
   cd apps/server
   npm run dev
   ```
   Server runs on `http://localhost:3000` (or 3001)

2. **Start the Web App** (in a separate terminal):
   ```bash
   cd apps/web
   npm run dev
   ```
   Web app runs on `http://localhost:5173`

3. **Open your browser** to `http://localhost:5173`

The web app will automatically proxy API requests to the server.

### Option 2: Production Mode (For Testing Production Build)

Build and serve everything together:

1. **Build the web app**:
   ```bash
   cd apps/web
   npm run build
   ```

2. **Start the server in production mode**:
   ```bash
   cd apps/server
   NODE_ENV=production npm start
   ```

3. **Open your browser** to `http://localhost:3000`

The server will serve both the API and the built web app.

### Option 3: Using the Tray App (After Rebuild)

1. **Rebuild the tray app** with the new configuration:
   ```bash
   cd tray-app
   npm run build
   ```

2. **Start the tray app**

3. **Click "Start" in the tray app**

4. **For development**: Open `http://localhost:5173` after starting the web app separately
   **For production**: Build the web app first, then open the server URL

## Quick Reference

| Mode | Server URL | Web App URL | Notes |
|------|-----------|-------------|-------|
| Development | `http://localhost:3000` | `http://localhost:5173` | Run separately, hot reload |
| Production | `http://localhost:3000` | Same as server | Build web app first |

## Troubleshooting

**Q: I see "Cannot GET /" when opening the server URL**
- A: You're in development mode. Open `http://localhost:5173` instead (after starting the web app)

**Q: I see a blank page**
- A: The web app isn't built. Either:
  - Switch to development mode and run `npm run dev` in `apps/web`
  - Build the web app with `npm run build` in `apps/web`

**Q: The tray app still shows production mode**
- A: Rebuild the tray app: `cd tray-app && npm run build`
