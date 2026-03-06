# How to Start Playlist Lab - Simple Guide

## The Problem You're Having

The tray app is confusing and buggy. The server shows as "Stopped" even though it's running, and the browser just keeps loading forever.

## The Simple Solution

**Don't use the tray app for development!** Use this instead:

### Step 1: Open Two Terminals

**Terminal 1** - Start the API server:
```bash
cd K:\Projects\Playlist Lab\apps\server
npm run dev
```

Wait until you see: `Server running on port 3000 in development mode`

**Terminal 2** - Start the web app:
```bash
cd K:\Projects\Playlist Lab\apps\web
npm run dev
```

Wait until you see: `Local: http://localhost:5173/`

### Step 2: Open Your Browser

Go to: **http://localhost:5173**

That's it! You should see the Playlist Lab login page.

## Even Simpler: Use the Startup Script

Just double-click: **`start-dev.bat`** in the project root folder

This will open two windows automatically. Wait about 10 seconds, then open your browser to `http://localhost:5173`.

## Why This Works

- The **API server** runs on port 3000 (or 3001)
- The **web app** runs on port 5173 with Vite
- Vite automatically forwards API requests to the server
- You get hot reload - changes update automatically
- No need for the buggy tray app!

## Troubleshooting

**Q: I see "npm: command not found"**
- A: You need to install Node.js first

**Q: Port 3000 is already in use**
- A: Kill the other process or use a different port

**Q: The web app won't start**
- A: Run `npm install` in the `apps/web` folder first

**Q: I see errors in the terminal**
- A: Share the error message and I'll help

## For Production (End Users)

The tray app is meant for end users who install the application. For development, always use the method above.

## Summary

1. Open two terminals
2. Run `npm run dev` in `apps/server`
3. Run `npm run dev` in `apps/web`
4. Open `http://localhost:5173` in your browser
5. Done!

OR just double-click `start-dev.bat` and wait 10 seconds.
