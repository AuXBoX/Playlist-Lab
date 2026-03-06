# Windows Build Guide - Interactive Menu

This guide explains how to build Playlist Lab installers on Windows using the interactive menu system.

## Quick Start - Interactive Menu

1. Open File Explorer
2. Navigate to the `scripts/` folder
3. Double-click `build-all-installers.bat`
4. Follow the interactive menu:
   - Select what to build (All, Desktop Only, or Server Only)
   - Enter the version number (e.g., 2.0.1)
   - Confirm and wait for completion

The script will automatically:
- Update version numbers in package.json files
- Build selected components
- Create installers with the specified version
- Pause at the end to show results

## Menu Options

### 1. Build Everything - All Platforms
Builds both the desktop app (for Windows, macOS, and Linux) and Windows server installer with the version you specify.

**Note:** Cross-platform building from Windows has limitations. macOS builds require macOS or CI/CD, and Linux builds may not be code-signed.

### 2. Desktop App - All Platforms
Builds the standalone desktop application for Windows, macOS, and Linux.

### 3. Desktop App - Windows Only (Installer + Portable)
Builds both the Windows installer and portable executable (fastest option for complete Windows release).

### 4. Desktop App - Windows Portable Only
Builds only the portable executable (no installation required, runs from any folder).

### 5. Desktop App - macOS Only
Attempts to build macOS version from Windows (limited support - best built on macOS).

### 6. Desktop App - Linux Only
Builds Linux version of the desktop app (AppImage, DEB, tar.gz).

### 7. Server Installer - Windows Only
Builds only the multi-user server installer with tray app for Windows.

### 8. Exit
Closes the menu without building anything.

## Version Number

When prompted for a version number:
- Use semantic versioning format: `MAJOR.MINOR.PATCH`
- Examples: `1.1.1`, `2.0.0`, `2.1.5`
- The version will be updated in:
  - `apps/desktop/package.json`
  - Inno Setup installer script
  - Generated installer filenames

## Command Line Usage

You can also run from Command Prompt with options to skip the menu:

```cmd
cd scripts

REM Build everything for all platforms with custom version
build-all-installers.bat --version 2.1.0

REM Build desktop app for all platforms
build-all-installers.bat --desktop-only --platform all --version 1.2.0

REM Build desktop app for Windows (installer + portable)
build-all-installers.bat --desktop-only --platform win --version 1.2.0

REM Build desktop app for Windows portable only
build-all-installers.bat --desktop-only --platform win --portable --version 1.2.0

REM Build desktop app for macOS only
build-all-installers.bat --desktop-only --platform mac --version 1.2.0

REM Build desktop app for Linux only
build-all-installers.bat --desktop-only --platform linux --version 1.2.0

REM Build server installer only
build-all-installers.bat --server-only --version 2.1.0
```

### Command Line Options

| Option | Values | Description |
|--------|--------|-------------|
| `--version` | `X.Y.Z` | Set version number (e.g., 2.1.0) |
| `--platform` | `all`, `win`, `mac`, `linux` | Target platform(s) for desktop app |
| `--portable` | - | Build portable version only (Windows only) |
| `--desktop-only` | - | Build only desktop app |
| `--server-only` | - | Build only server installer |

## Requirements

### Essential
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### For Windows Server Installer
- **Inno Setup 6.x** - [Download](https://jrsoftware.org/isdl.php)
  - Install to default location: `C:\Program Files (x86)\Inno Setup 6\`

## Output Locations

After building, you'll find installers in:

### Desktop App
- `apps/desktop/release/`
  - **Windows:**
    - `Playlist Lab Setup X.X.X.exe` - NSIS installer
    - `PlaylistLab-Portable-X.X.X.exe` - Portable version
  - **macOS:**
    - `PlaylistLab-X.X.X-x64.dmg` - Intel Mac installer
    - `PlaylistLab-X.X.X-arm64.dmg` - Apple Silicon installer
    - `PlaylistLab-X.X.X-x64.zip` - Intel Mac ZIP
    - `PlaylistLab-X.X.X-arm64.zip` - Apple Silicon ZIP
  - **Linux:**
    - `PlaylistLab-X.X.X-x64.deb` - Debian/Ubuntu package
    - `PlaylistLab-X.X.X-x64.AppImage` - Universal Linux app
    - `PlaylistLab-X.X.X-x64.tar.gz` - Tarball

### Server Installer
- `scripts/release/server/`
  - `PlaylistLabServer-Setup-X.X.X.exe` - Windows installer with service

### Checksums
- `scripts/release/checksums.txt` - SHA256 checksums for all builds

## Troubleshooting

### "npm is not recognized"
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart Command Prompt after installation

### "Inno Setup not found"
- Install Inno Setup from [jrsoftware.org](https://jrsoftware.org/isdl.php)
- Make sure it's installed to the default location

### Build fails with errors
- Make sure you're in the project root directory
- Delete `node_modules` folders and run `npm install` in each app directory
- Check that all dependencies are installed

### "Access denied" errors
- Run Command Prompt as Administrator
- Or: Right-click the batch file → "Run as administrator"

## What Gets Built

### Desktop App Build Process
1. Installs desktop app dependencies
2. Builds the server component
3. Builds the web UI
4. Compiles TypeScript
5. Packages with Electron Builder
6. Creates Windows installer and portable executable

### Server Installer Build Process
1. Builds the Node.js server
2. Builds the tray app for Windows
3. Installs production dependencies
4. Copies all files to installer structure
5. Runs Inno Setup to create installer
6. Generates checksums

## Build Time

Typical build times on a modern PC:
- **Desktop App**: 5-10 minutes (first build)
- **Server Installer**: 10-15 minutes (first build)
- **Subsequent builds**: 2-5 minutes (cached dependencies)

## What is a Portable Version?

A portable version is a standalone executable that:
- Requires no installation
- Can run from any folder (USB drive, Downloads, etc.)
- Stores data in the same folder as the executable
- Perfect for testing or running on multiple computers
- No administrator rights required

**When to use:**
- Quick testing without installation
- Running from USB drive
- Temporary usage
- No admin access to install software

**When to use installer:**
- Permanent installation
- Start menu shortcuts
- File associations
- Auto-updates
- Professional deployment

## Cross-Platform Building

### What Works from Windows

| Platform | Support Level | Notes |
|----------|--------------|-------|
| **Windows** | ✅ Full | Native builds with code signing support |
| **Linux** | ⚠️ Partial | Builds work but may not be code-signed |
| **macOS** | ❌ Limited | Requires macOS for proper code signing and notarization |

### Building for macOS

While electron-builder can create macOS installers from Windows, they will:
- Not be code-signed
- Not be notarized by Apple
- Show security warnings when users try to open them

**For production macOS releases:**
1. Use a Mac computer or CI/CD with macOS runner
2. Run: `bash scripts/build-all-installers.sh`
3. Or use GitHub Actions with macOS runner

### Building for Linux

Linux builds from Windows generally work well and include:
- DEB packages (Debian/Ubuntu)
- AppImage (universal)
- tar.gz archives

These can be used on Linux systems without issues.

## Advanced Usage

### Clean Build
To force a complete rebuild:

```cmd
REM Delete all build artifacts
rmdir /s /q apps\desktop\release
rmdir /s /q scripts\release
rmdir /s /q scripts\temp

REM Delete node_modules (optional, for complete clean)
rmdir /s /q apps\desktop\node_modules
rmdir /s /q apps\server\node_modules
rmdir /s /q apps\web\node_modules
rmdir /s /q tray-app\node_modules

REM Rebuild
cd scripts
build-all-installers.bat
```

### Modify Build Settings

Edit these files to customize builds:

- `apps/desktop/package.json` - Desktop app version, name, build settings
- `scripts/installers/windows/setup.iss` - Windows installer settings
- `scripts/build-all-installers.bat` - Build script configuration

## See Also

- [Scripts README](scripts/README.md) - All available scripts
- [Installers README](scripts/installers/README.md) - Detailed installer documentation
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Development setup
- [Windows Installer Guide](docs/WINDOWS_INSTALLER_GUIDE.md) - End-user installation guide

