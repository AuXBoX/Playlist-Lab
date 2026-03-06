# Playlist Lab - Desktop Application

Standalone Electron desktop application with embedded server. Single-user, local installation.

## Features

- **Standalone**: No separate server installation required
- **Single-User**: Personal playlist management
- **Local Storage**: All data stored locally on your computer
- **System Tray**: Runs in background with tray icon
- **Auto-Start**: Optional auto-start with system

## vs Server Installation

| Feature | Desktop App | Server Installation |
|---------|-------------|---------------------|
| Users | Single user | Multiple users |
| Installation | Simple, one-click | Requires server setup |
| Access | Local only | Network/remote access |
| Data | Local SQLite | Centralized database |
| Updates | Auto-update | Manual deployment |
| Best For | Personal use | Family/team use |

## Development

```bash
# Install dependencies
cd apps/desktop
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Package for current platform
npm run package
```

## Building

### Windows
```bash
npm run package:win
```

Output: `release/Playlist Lab Setup.exe` and `Playlist Lab.exe` (portable)

### macOS
```bash
npm run package:mac
```

Output: `release/Playlist Lab.dmg` and `Playlist Lab.app.zip`

### Linux
```bash
npm run package:linux
```

Output: `release/Playlist Lab.AppImage` and `Playlist Lab.deb`

## Architecture

The desktop app consists of:

1. **Electron Main Process** (`src/main.ts`)
   - Manages application lifecycle
   - Starts/stops embedded server
   - Creates windows and tray icon

2. **Embedded Server** (from `apps/server`)
   - Express.js API server
   - Runs as child process
   - SQLite database in user data directory

3. **Web UI** (from `apps/web`)
   - React frontend
   - Loaded in Electron window
   - Communicates with embedded server

## Data Storage

- **Database**: `%APPDATA%/playlist-lab-desktop/playlist-lab.db` (Windows)
- **Database**: `~/Library/Application Support/playlist-lab-desktop/playlist-lab.db` (macOS)
- **Database**: `~/.config/playlist-lab-desktop/playlist-lab.db` (Linux)
- **Logs**: Same directory as database

## Distribution

The desktop app is distributed as:
- **Windows**: NSIS installer (.exe) and portable executable
- **macOS**: DMG disk image and ZIP archive
- **Linux**: AppImage and DEB package

## Tech Stack

- **Electron**: Desktop application framework
- **Node.js**: Embedded server runtime
- **Express**: API server
- **React**: Web UI
- **SQLite**: Local database
- **TypeScript**: Type-safe development

## See Also

- [Server Installation](../docs/SERVER_README.md) - Multi-user server version
- [User Guide](../docs/USER_GUIDE.md) - How to use Playlist Lab
- [Developer Guide](../docs/DEVELOPER_GUIDE.md) - Development setup
