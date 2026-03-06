# How to Change the Server Port

The server is currently trying to use port 3000, which is already in use. This is causing the "signal SIGTERM" error when you try to restart.

## Quick Fix - Change Port to 3001

Run this command in Command Prompt **as Administrator**:

```cmd
scripts\change-server-port.bat
```

When prompted, enter: `3001`

Then:
1. Open the Playlist Lab Server Manager from your system tray
2. Click "Stop" (if running)
3. Click "Start"
4. The server will now run on http://localhost:3001

## Manual Method

If you prefer to edit the file manually:

1. Open: `C:\Program Files\Playlist Lab Server\server\.env`
2. Find the line: `PORT=3000`
3. Change it to: `PORT=3001`
4. Save the file
5. Restart the server

## Why This Happened

Port 3000 is commonly used by development servers. Something else on your system is already using it, so the Playlist Lab Server can't start.

## Recommended Ports

- **3001** - Good alternative to 3000
- **8080** - Common web server port
- **5000** - Another common alternative
- **3333** - Less commonly used

Choose any port between 1-65535 that isn't already in use.

## Future Enhancement

The tray app UI will be updated to include a port configuration field, making this easier to change without editing files or running scripts.
