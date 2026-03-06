# 🚀 Quick Start Guide

## The Problem You're Having

The tray app starts the server, but it crashes immediately. The browser loads indefinitely because there's nothing to connect to.

## The Solution (2 Minutes)

**Don't use the tray app for development.** Run the server and web app directly:

### Step 1: Open Two Terminals

Open two PowerShell or Command Prompt windows in the project folder.

### Step 2: Start the API Server

In the first terminal:
```bash
cd apps/server
npm run dev
```

Wait until you see: `Server running on port 3000 in development mode`

### Step 3: Start the Web App

In the second terminal:
```bash
cd apps/web
npm run dev
```

Wait until you see: `Local: http://localhost:5173/`

### Step 4: Open Your Browser

Go to: **http://localhost:5173**

You should see the Playlist Lab login page!

## Why This Works

- **API Server** runs on port 3000
- **Web App** runs on port 5173 with hot reload
- Vite (the web app) automatically proxies API requests to the server
- You see errors immediately in the terminal
- Changes reload automatically

## The Tray App Issue

The tray app server crashes because of an unhandled error. I've added error handling, but you need to rebuild and reinstall for it to take effect.

For now, just use the development mode above. It's actually better for development anyway!

## Troubleshooting

**"Port 3000 is already in use"**
- Something else is using that port
- Kill it or change the port in `apps/server/.env`

**"npm: command not found"**
- Node.js isn't installed or not in PATH
- Install from: https://nodejs.org

**"Cannot find module"**
- Run `npm install` in both `apps/server` and `apps/web`

**Web app shows "Network Error"**
- Make sure the API server is running (Terminal 1)
- Check that it says "Server running on port 3000"

## Files to Check

If you want to see what I fixed:
- `apps/server/src/index.ts` - Added error handlers
- `TRAY_APP_SERVER_CRASH_FIX.md` - Detailed explanation
- `BROWSER_LOADING_ISSUE_FIXED.md` - Browser loading issue

## Summary

1. Open two terminals
2. Run `cd apps/server && npm run dev` in first
3. Run `cd apps/web && npm run dev` in second
4. Open `http://localhost:5173` in browser
5. Done!

The tray app is for production use. For development, this is the way.
