# Port Configuration Feature

## Overview

Added a port configuration feature to the tray app that allows users to change the server port from the UI without manually editing configuration files.

## Changes Made

### 1. Config Manager (`tray-app/src/main/config-manager.ts`)
- Added `updatePort(port: number)` method to update the port and save to .env file
- Added `saveServerConfig()` private method to write complete configuration to disk
- Validates port range (1-65535) before saving

### 2. UI Components (`tray-app/src/renderer/index.html`)
- Added port input field in the server info section
- Added "Save" button next to the port input
- Port input is pre-filled with current port on startup

### 3. Styles (`tray-app/src/renderer/styles.css`)
- Added `.port-config` - Container for port input and button
- Added `.port-input` - Styled number input for port
- Added `.btn-small` - Small button style for save action

### 4. Renderer App (`tray-app/src/renderer/app.ts`)
- Added `handleSavePort()` method to handle port save button clicks
- Validates port input before sending to main process
- Shows success message after saving
- Updates server URL display immediately
- Loads current port value on startup

### 5. Preload Script (`tray-app/src/preload/preload.ts` & `types.d.ts`)
- Added `updatePort(port: number)` to ElectronAPI interface
- Added `server:update-port` to IPC channel whitelist
- Provides type-safe IPC communication for port updates

### 6. Window Manager (`tray-app/src/main/window-manager.ts`)
- Added IPC handler for `server:update-port` channel
- Calls config manager to save the new port
- Returns success/error response to renderer

## How It Works

1. **User enters new port**: User types a port number (1-65535) in the input field
2. **Clicks Save**: Triggers validation and save process
3. **Port is validated**: Checks if port is within valid range
4. **Saved to .env**: Updates the PORT value in the server's .env file
5. **Success feedback**: Shows message: "Port updated to {port}. Restart the server for changes to take effect."
6. **URL updates**: Server URL display updates immediately to reflect new port
7. **Restart required**: User must restart the server for the new port to take effect

## Usage

### From the Tray App UI:

1. Open the Playlist Lab Server Manager from the system tray
2. Find the "Port:" field in the server info section
3. Enter a new port number (e.g., 3001, 8080, 5000)
4. Click "Save"
5. Wait for success message
6. Click "Restart" to apply the new port

### Recommended Ports:

- **3001** - Good alternative to 3000
- **8080** - Common web server port
- **5000** - Another common alternative
- **3333** - Less commonly used

## Solving Port Conflicts

This feature solves the "signal SIGTERM" error that occurs when port 3000 is already in use by another application. Users can now easily change to an available port without:

- Manually editing the .env file
- Using command-line scripts
- Restarting the entire application

## Technical Details

### Port Validation

- Range: 1-65535
- Type: Integer
- Validated on both client and server side

### Configuration Persistence

- Saved to: `{installDir}/server/.env`
- Format: `PORT=3001`
- Persists across application restarts

### Error Handling

- Invalid port numbers show error message
- File write errors are caught and reported
- User-friendly error messages

## Build Status

✅ All TypeScript errors resolved
✅ Build completes successfully
✅ Ready for testing and deployment

## Next Steps

1. Test the feature with the tray app
2. Verify port changes persist after restart
3. Test with various port numbers
4. Include in next installer build
