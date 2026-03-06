# Installer Scripts Update Summary

## Date: February 28, 2026

## Overview
Updated all platform installer scripts to work with the new web-based Playlist Lab Server (v2.0.0) that no longer requires a tray application.

## Changes Made

### 1. Windows Installer (`scripts/installers/windows/setup.iss`)

**Removed:**
- Tray application files and directories
- Tray app shortcuts and icons
- References to `Playlist Lab Server Manager.exe`

**Added:**
- Web browser shortcuts to `http://localhost:3001`
- Start/Stop server shortcuts using Node.js directly
- Desktop shortcut to open server in browser
- Post-install option to start server and open browser

**Features:**
- Installs Node.js portable runtime (v20.11.0)
- Installs server, web app, and shared packages
- Installs production dependencies automatically
- Initializes database on installation
- Creates Start Menu shortcuts for easy access
- Option to launch server after installation

**Start Menu Items:**
- Playlist Lab Server (opens browser)
- Start Server
- Stop Server
- User Guide
- Server Logs
- Uninstall

### 2. Windows Startup Manager (`scripts/installers/windows/startup-manager.js`)

**Removed:**
- `add-tray` command
- `remove-tray` command
- Tray app shortcut creation functions
- Tray app path references

**Simplified:**
- Now only manages server startup (not tray app)
- Commands: `add`, `remove`
- Creates shortcut to launch server via Node.js

### 3. macOS Installer (`scripts/installers/macos/build-macos.sh`)

**Removed:**
- Tray app build steps
- Tray app packaging
- Tray app file copying

**Added:**
- Web app build step
- Application bundle that launches server and opens browser
- Automatic browser opening on app launch

**Features:**
- Creates DMG and PKG installers
- Application bundle structure (`Playlist Lab Server.app`)
- Launches server in background
- Opens browser to `http://localhost:3001` automatically
- Includes all dependencies
- Drag-and-drop installation (DMG)
- System-wide installation (PKG)

**Application Bundle:**
- `Contents/MacOS/playlist-lab-server` - Launcher script
- `Contents/Resources/server/` - Server files
- `Contents/Resources/web/` - Web app files
- `Contents/Resources/packages/shared/` - Shared package
- `Contents/Resources/node_modules/` - Dependencies

### 4. Linux Installer (`scripts/installers/linux/build-linux.sh`)

**Removed:**
- Tray app build steps
- Tray app packaging
- Tray app desktop entry

**Added:**
- Web app build step
- Systemd service configuration
- Desktop entry that opens browser
- Post-install scripts for service management

**Features:**
- Creates DEB and RPM packages
- Systemd service integration
- Automatic service start on boot
- Desktop entry for easy access
- Command-line launcher (`/usr/bin/playlist-lab-server`)
- Post-install scripts handle service setup

**Systemd Service:**
- Service name: `playlist-lab-server.service`
- Auto-restart on failure
- Runs as system service
- Logs to systemd journal

**Package Management:**
```bash
# Start/Stop/Restart
sudo systemctl start playlist-lab-server
sudo systemctl stop playlist-lab-server
sudo systemctl restart playlist-lab-server

# Status
sudo systemctl status playlist-lab-server

# Enable/Disable auto-start
sudo systemctl enable playlist-lab-server
sudo systemctl disable playlist-lab-server
```

## Installation Instructions

### Windows

1. Download `PlaylistLabServer-Setup-2.0.0.exe`
2. Run the installer
3. Choose installation directory
4. Select installation mode:
   - Windows Service (runs in background)
   - Startup Application (starts on login)
   - Standalone (manual start)
5. Complete installation
6. Server starts automatically (if selected)
7. Browser opens to `http://localhost:3001`

**Start Menu Shortcuts:**
- Click "Playlist Lab Server" to open in browser
- Use "Start Server" / "Stop Server" to control

### macOS

**DMG Installation:**
1. Download `PlaylistLabServer-2.0.0.dmg`
2. Open the DMG file
3. Drag `Playlist Lab Server.app` to Applications folder
4. Launch from Applications
5. Server starts and browser opens automatically

**PKG Installation:**
1. Download `PlaylistLabServer-2.0.0.pkg`
2. Double-click to install
3. Follow installation wizard
4. Launch from Applications folder

### Linux

**Debian/Ubuntu (DEB):**
```bash
# Install
sudo dpkg -i playlist-lab-server_2.0.0_amd64.deb

# The service starts automatically
# Access at http://localhost:3001

# Manage service
sudo systemctl status playlist-lab-server
sudo systemctl restart playlist-lab-server
```

**RHEL/CentOS/Fedora (RPM):**
```bash
# Install
sudo rpm -i playlist-lab-server-2.0.0-1.x86_64.rpm

# The service starts automatically
# Access at http://localhost:3001

# Manage service
sudo systemctl status playlist-lab-server
sudo systemctl restart playlist-lab-server
```

## Building Installers

### Build All Platforms

**Windows:**
```cmd
cd scripts
build-all-installers.bat
```

**macOS/Linux:**
```bash
bash scripts/build-all-installers.sh
```

### Build Specific Platform

**Windows Installer:**
```bash
bash scripts/installers/windows/build-windows.sh
```

**macOS Installer:**
```bash
bash scripts/installers/macos/build-macos.sh
```

**Linux Packages:**
```bash
bash scripts/installers/linux/build-linux.sh
```

## Output Locations

All installers are created in `scripts/release/`:

- **Windows**: `scripts/release/server/PlaylistLabServer-Setup-2.0.0.exe`
- **macOS**: 
  - `scripts/release/macos/PlaylistLabServer-2.0.0.dmg`
  - `scripts/release/macos/PlaylistLabServer-2.0.0.pkg`
- **Linux**:
  - `scripts/release/linux/playlist-lab-server_2.0.0_amd64.deb`
  - `scripts/release/linux/playlist-lab-server-2.0.0-1.x86_64.rpm`

## Requirements

### All Platforms
- Node.js 18+ (bundled in installers)
- npm (bundled in installers)

### Windows
- Inno Setup 6.x (for building installer)
- Windows 10 or later

### macOS
- macOS 10.15 (Catalina) or later
- Xcode Command Line Tools
- hdiutil (included with macOS)
- pkgbuild (included with macOS)

### Linux
- Debian/Ubuntu: dpkg-deb
- RHEL/CentOS: rpmbuild (optional)
- systemd (for service management)

## Testing

All installers have been updated and tested:

- ✅ Windows installer builds correctly
- ✅ macOS DMG/PKG build correctly
- ✅ Linux DEB/RPM build correctly
- ✅ No tray-app references remain
- ✅ Server starts and is accessible via browser
- ✅ All dependencies included
- ✅ Documentation updated

## Migration from Old Installers

If you have the old installer (with tray app) installed:

1. Uninstall the old version
2. Install the new version
3. Your database and settings will be preserved
4. Access the server via web browser instead of tray app

## Support

- Documentation: `docs/WINDOWS_INSTALLER_GUIDE.md`, `docs/MACOS_INSTALLER_GUIDE.md`, `docs/LINUX_INSTALLER_GUIDE.md`
- Issues: GitHub Issues
- Server logs: Check system logs or `~/.playlist-lab/logs/`

---

**All installer scripts are now up to date and ready for production use!**
