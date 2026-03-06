# Playlist Lab - Scripts Directory

This directory contains all build, deployment, and utility scripts for the Playlist Lab project.

## Directory Structure

```
scripts/
├── cache/               # Build cache (Node.js portable, etc.) - gitignored
│   └── README.md        # Cache documentation
├── installers/          # Platform-specific installer build scripts
│   ├── desktop/         # Desktop app build scripts
│   ├── windows/         # Windows installer (Inno Setup)
│   ├── macos/           # macOS installer (DMG/PKG)
│   ├── linux/           # Linux packages (DEB/RPM)
│   └── README.md        # Installer documentation
├── release/             # Build output directory
│   ├── server/          # Windows installer output
│   ├── macos/           # macOS installer output
│   └── linux/           # Linux package output
├── temp/                # Temporary build files - gitignored
├── windows/             # Windows-specific utilities
│   ├── build.bat        # Windows build script
│   ├── build-production.bat  # Windows production build
│   ├── dev.bat          # Windows development mode
│   ├── github-manager.bat    # GitHub utilities (batch)
│   └── github-manager.ps1    # GitHub utilities (PowerShell)
├── build-all-installers.bat   # Unified installer build (Windows - double-click)
├── build-all-installers.sh    # Unified installer build (macOS/Linux)
├── build-production.js        # Production build (Node.js)
├── build-production.sh        # Production build (Bash)
├── backup-database.js         # Database backup utility
├── restore-database.js        # Database restore utility
├── init-database.js           # Database initialization
├── update-server.js           # Server update utility
└── BUILD_OPTIMIZATION.md      # Build optimization notes
```

## Quick Start

### Build All Installers (Recommended)

**Windows (Double-click):**
1. Navigate to `scripts/` folder in File Explorer
2. Double-click `build-all-installers.bat`
3. The build will run and pause at the end to show results

**Windows (Command Line):**
```cmd
cd scripts
build-all-installers.bat
```

**macOS/Linux:**
```bash
bash scripts/build-all-installers.sh
```

This builds installers for all platforms (Windows, macOS, Linux) based on your current OS.

### Platform-Specific Builds

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

#### Windows Server
**Windows:**
```cmd
# Build Windows installer
cd scripts\installers\windows
build-windows.bat

# Or use Windows batch scripts
scripts\windows\build.bat
scripts\windows\build-production.bat
```

**macOS/Linux (Git Bash/WSL):**
```bash
# Build Windows installer
bash scripts/installers/windows/build-windows.sh
```

#### macOS
```bash
# Build macOS installers (DMG and PKG)
bash scripts/installers/macos/build-macos.sh
```

#### Linux
```bash
# Build Linux packages (DEB and RPM)
bash scripts/installers/linux/build-linux.sh
```

## Utility Scripts

### Development & Testing

**Diagnose Windows Issues**
```cmd
scripts\diagnose-windows.bat
```
Comprehensive Windows environment diagnostics.

### Database Management

**Initialize Database**
```bash
node scripts/init-database.js
```

**Backup Database**
```bash
node scripts/backup-database.js
```

**Restore Database**
```bash
node scripts/restore-database.js [backup-file]
```

### Server Management

**Update Server**
```bash
node scripts/update-server.js
```

### GitHub Management (Windows)

**GitHub Manager (Recommended)**
```cmd
scripts\github-manager.bat
```
Interactive menu-driven interface for all Git operations:
- Repository management (status, branches, commits)
- Commit operations (stage, commit, push, pull, sync)
- Release management (create tags, trigger CI/CD)
- Mobile/Web sync validation
- Requirement checks

See [GitHub Manager Guide](../docs/GITHUB_MANAGER_GUIDE.md) for full documentation.

**Legacy Scripts (Deprecated)**
```cmd
scripts\windows\github-manager.bat [command]
scripts\windows\github-manager.ps1 [command]
```

## Build Process

### Build Cache

The build system uses a cache directory (`scripts/cache/`) to store downloaded dependencies:
- **Node.js Portable**: Downloaded once and reused for all Windows server builds
- Saves ~50MB download and 30-60 seconds per build

To clear the cache and force fresh downloads:
```cmd
rmdir /s /q scripts\cache
```

### Development Build
1. Install dependencies: `npm install`
2. Build server: `cd apps/server && npm run build`
3. Build web: `cd apps/web && npm run build`
4. Build desktop app: `cd apps/desktop && npm run build`

### Production Build
```bash
# Unix/Linux/macOS
bash scripts/build-production.sh

# Windows
scripts\windows\build-production.bat

# Node.js (cross-platform)
node scripts/build-production.js
```

### Installer Build

**Windows (Double-click):**
- Navigate to `scripts/` folder
- Double-click `build-all-installers.bat`

**Windows (Command Line):**
```cmd
REM Build all installers
cd scripts
build-all-installers.bat

REM Build specific platform
cd scripts\installers\desktop
build-desktop.bat

cd scripts\installers\windows
build-windows.bat
```

**macOS/Linux:**
```bash
# Build all installers
bash scripts/build-all-installers.sh

# Build specific platform
bash scripts/installers/desktop/build-desktop.sh
bash scripts/installers/windows/build-windows.sh
bash scripts/installers/macos/build-macos.sh
bash scripts/installers/linux/build-linux.sh
```

## Output Locations

All build artifacts are placed in `scripts/release/`:
- `scripts/release/server/` - Windows installers (.exe)
- `scripts/release/macos/` - macOS installers (.dmg, .pkg)
- `scripts/release/linux/` - Linux packages (.deb, .rpm)
- `scripts/release/checksums.txt` - SHA256 checksums

## Requirements

### All Platforms
- Node.js 18+
- npm or yarn

### Windows
- Inno Setup 6.x (for .exe installer)
- Git Bash or WSL (for bash scripts)

### macOS
- Xcode Command Line Tools
- hdiutil (included with macOS)
- pkgbuild (included with macOS)

### Linux
- dpkg-deb (for .deb packages)
- rpmbuild (optional, for .rpm packages)

## Notes

- The unified build script (`build-all-installers.sh`) automatically detects your platform
- Cross-platform builds require running on each target platform
- All scripts use relative paths from the project root
- Production dependencies are installed automatically during installer builds
- Build outputs are gitignored and not committed to the repository
- **Node.js Caching**: The Windows build script caches the downloaded Node.js portable in `scripts/cache/` to avoid re-downloading on every build. This cache persists across builds and can be safely deleted if needed.

## Troubleshooting

### Windows Build Issues
- Ensure Inno Setup is installed and in PATH
- Check that Node.js bundled runtime is in `installer/nodejs/`
- Verify desktop app was built: `apps/desktop/release/`

### macOS Build Issues
- Must be run on macOS for DMG/PKG creation
- Ensure Xcode Command Line Tools are installed: `xcode-select --install`
- Check desktop app build: `apps/desktop/release/`

### Linux Build Issues
- Install dpkg-deb: `sudo apt install dpkg-dev`
- Install rpmbuild: `sudo apt install rpm` or `sudo yum install rpm-build`
- Check desktop app build: `apps/desktop/release/`

## See Also

- [Installer Documentation](./installers/README.md)
- [Windows Installer Guide](../docs/WINDOWS_INSTALLER_GUIDE.md)
- [macOS Installer Guide](../docs/MACOS_INSTALLER_GUIDE.md)
- [Linux Installer Guide](../docs/LINUX_INSTALLER_GUIDE.md)
- [Developer Guide](../docs/DEVELOPER_GUIDE.md)
