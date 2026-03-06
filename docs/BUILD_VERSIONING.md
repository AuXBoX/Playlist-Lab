# Build Versioning Guide

This guide explains how versioning works in the Playlist Lab build system.

## Version Numbers

Playlist Lab uses semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes (e.g., 1.x.x → 2.0.0)
- **MINOR**: New features, backwards compatible (e.g., 2.0.x → 2.1.0)
- **PATCH**: Bug fixes, backwards compatible (e.g., 2.0.0 → 2.0.1)

## Where Versions Are Defined

### 1. Inno Setup Script (Windows Installer)
File: `scripts/installers/windows/setup.iss`
```
#define MyAppVersion "2.0.0"
```

### 2. Package.json Files
- Root: `package.json`
- Server: `apps/server/package.json`
- Web: `apps/web/package.json`
- Mobile: `apps/mobile/package.json`
- Desktop: `apps/desktop/package.json`
- Shared: `packages/shared/package.json`

### 3. Build Scripts
The build scripts accept version as a parameter and override the default.

## Building with Versions

### Interactive Mode (Recommended)
```batch
cd scripts
build-all-installers.bat
```
Choose option 9 (Build Installers) or 10 (Build Everything), then enter the version when prompted.

### Command Line Mode
```batch
cd scripts
build-all-installers.bat --installer --version 2.0.1
```

### Individual Installer Builds
```batch
# Windows
cd scripts/installers/windows
build-windows.bat 2.0.1

# Linux
cd scripts/installers/linux
./build-linux.sh 2.0.1

# macOS
cd scripts/installers/macos
./build-macos.sh 2.0.1
```

## Version Consistency

### Before Building a Release

1. **Update all package.json files** to the same version:
   ```batch
   # Use npm version command (updates package.json and creates git tag)
   npm version 2.0.1
   ```

2. **Update setup.iss** manually:
   ```
   #define MyAppVersion "2.0.1"
   ```

3. **Update version.html** (for web app):
   ```html
   <div>Version 2.0.1</div>
   ```

4. **Build with the same version**:
   ```batch
   build-all-installers.bat --all --version 2.0.1
   ```

### Automated Version Update Script

We provide a script to update all versions at once:

```batch
cd scripts
update-version.bat 2.0.1
```

This updates:
- All package.json files
- setup.iss
- version.html
- Creates a git tag

## Output Files

Installers are created in the `release/` folder:

```
release/
├── PlaylistLabServer-Setup-2.0.1.exe    (Windows)
├── linux/
│   ├── playlist-lab-server-2.0.1.deb    (Debian/Ubuntu)
│   └── playlist-lab-server-2.0.1.rpm    (RedHat/Fedora)
└── macos/
    └── PlaylistLabServer-2.0.1.dmg      (macOS)
```

## Common Issues

### Multiple Installers with Different Versions

**Problem**: You see files like:
- `PlaylistLabServer-Setup-1.1.2.exe`
- `PlaylistLabServer-Setup-2.0.0.exe`

**Cause**: The build script was run multiple times with different versions without cleaning.

**Solution**:
1. Run `scripts/clean-release.bat` to remove old builds
2. Build again with the correct version
3. Only run the build once per version

### Version Mismatch

**Problem**: Installer version doesn't match package.json version.

**Cause**: setup.iss wasn't updated before building.

**Solution**:
1. Update `scripts/installers/windows/setup.iss`
2. Rebuild the installer

## Best Practices

1. **Always clean before building releases**:
   ```batch
   scripts/clean-release.bat
   ```

2. **Use the same version everywhere**:
   - Update all package.json files
   - Update setup.iss
   - Use the same version parameter when building

3. **Tag releases in git**:
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```

4. **Document changes**:
   - Update CHANGELOG.md
   - Create GitHub release notes

5. **Test before releasing**:
   - Install the built installer
   - Verify version numbers in the app
   - Test core functionality

## Version Update Checklist

Before creating a new release:

- [ ] Update CHANGELOG.md with changes
- [ ] Run `scripts/update-version.bat X.Y.Z` (or update manually)
- [ ] Verify all package.json files have the same version
- [ ] Verify setup.iss has the correct version
- [ ] Clean previous builds: `scripts/clean-release.bat`
- [ ] Build installers: `build-all-installers.bat --all --version X.Y.Z`
- [ ] Test the installer
- [ ] Commit version changes
- [ ] Create git tag: `git tag vX.Y.Z`
- [ ] Push to GitHub: `git push && git push --tags`
- [ ] Create GitHub release with installers
