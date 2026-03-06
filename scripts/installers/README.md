# Playlist Lab Server - Installer Scripts

This directory contains all installer build scripts and associated files for creating platform-specific installers.

## Directory Structure

```
scripts/installers/
├── desktop/          # Desktop app build scripts
│   ├── build-desktop.sh
│   └── build-desktop.bat
├── windows/          # Windows installer files
│   ├── build-windows.sh
│   ├── build-windows.bat
│   ├── setup.iss     # Inno Setup script
│   ├── server-launcher.js
│   ├── service-manager.js
│   └── startup-manager.js
├── macos/            # macOS installer files
│   ├── build-macos.sh
│   └── server-launcher.sh
└── linux/            # Linux package files
    ├── build-linux.sh
    └── server-launcher.sh
```

## Building Installers

### Build All Platforms (Recommended)

#### Windows (Double-click or Command Line)

**Option 1: Double-click**
- Navigate to `scripts/` folder in File Explorer
- Double-click `build-all-installers.bat`
- The build will run and pause at the end to show results

**Option 2: Command Prompt**
```cmd
cd scripts
build-all-installers.bat
```

Or build specific components:
```cmd
REM Desktop app only
build-all-installers.bat --desktop-only

REM Server installers only
build-all-installers.bat --server-only
```

#### macOS/Linux (Bash Script)

From the project root:

```bash
bash scripts/build-all-installers.sh
```

Or build specific components:
```bash
# Desktop app only
bash scripts/build-all-installers.sh --desktop-only

# Server installers only
bash scripts/build-all-installers.sh --server-only
```

This will:
1. Build the server
2. Build the tray app for all platforms
3. Install production dependencies
4. Build platform-specific installers (based on current OS)
5. Generate checksums

### Build Specific Platform

#### Desktop App
**Windows:**
```cmd
cd scripts\installers\desktop
build-desktop.bat
```

**macOS/Linux:**
```bash
bash scripts/installers/desktop/build-desktop.sh
```

Creates: `apps/desktop/release/` with platform-specific installers

#### Windows Server
**Windows:**
```cmd
cd scripts\installers\windows
build-windows.bat
```

**macOS/Linux (Git Bash/WSL):**
```bash
bash scripts/installers/windows/build-windows.sh
```

Creates: `scripts/release/server/PlaylistLabServer-Setup-2.0.0.exe`

#### macOS
```bash
bash scripts/installers/macos/build-macos.sh
```

Creates:
- `scripts/release/macos/PlaylistLabServer-2.0.0.dmg`
- `scripts/release/macos/PlaylistLabServer-2.0.0.pkg`

#### Linux
```bash
bash scripts/installers/linux/build-linux.sh
```

Creates:
- `scripts/release/linux/playlist-lab-server_2.0.0_amd64.deb`
- `scripts/release/linux/playlist-lab-server-2.0.0-1.x86_64.rpm` (if rpmbuild available)

## Platform Requirements

### Windows
- Inno Setup 6.x (for .exe installer)
- Node.js 18+
- Git Bash or WSL (for running bash scripts)

### macOS
- Xcode Command Line Tools
- Node.js 18+
- hdiutil (included with macOS)
- pkgbuild (included with macOS)

### Linux
- Node.js 18+
- dpkg-deb (for .deb packages)
- rpmbuild (optional, for .rpm packages)

## Helper Scripts

### Windows

**server-launcher.js**
- Launches the server with proper environment setup
- Handles logging to user data directory
- Used by all Windows installation modes

**service-manager.js**
- Manages Windows service installation/uninstallation
- Uses node-windows package
- Commands: install, uninstall, start, stop, restart

**startup-manager.js**
- Manages Windows startup shortcuts
- Supports both server and tray app
- Commands: add, add-tray, remove, remove-tray

### macOS/Linux

**server-launcher.sh**
- Bash script to launch the server
- Sets up environment variables
- Handles logging

## Installation Modes

### Windows
1. **Windows Service** - Runs in background, starts automatically
2. **Startup Application** - Starts when user logs in
3. **Standalone** - Manual start only

All modes include the Server Manager tray application.

### macOS
- Application bundle (.app)
- DMG installer (drag-and-drop)
- PKG installer (system-wide)

### Linux
- DEB package (Debian/Ubuntu)
- RPM package (Fedora/RHEL)
- Systemd service integration

## Output Locations

All build artifacts are placed in:
- `scripts/release/server/` - Windows installers
- `scripts/release/macos/` - macOS installers
- `scripts/release/linux/` - Linux packages
- `scripts/release/checksums.txt` - SHA256 checksums

## Troubleshooting

### Windows Build Issues
- Ensure Inno Setup is installed and in PATH
- Check that Node.js bundled runtime is in `installer/nodejs/`
- Verify desktop app was built: `apps/desktop/release/`

### macOS Build Issues
- Must be run on macOS for DMG/PKG creation
- Ensure Xcode Command Line Tools are installed
- Check desktop app build: `apps/desktop/release/`

### Linux Build Issues
- Install dpkg-deb: `sudo apt install dpkg-dev`
- Install rpmbuild: `sudo apt install rpm` or `sudo yum install rpm-build`
- Check desktop app build: `apps/desktop/release/`

## Notes

- The unified build script (`build-all-installers.sh` or `build-all-installers.bat`) automatically detects the current platform
- Cross-platform builds require running on each target platform
- All scripts use relative paths from the project root
- Production dependencies are installed automatically during build
- Desktop app can only be built for the current platform (electron-builder limitation)
