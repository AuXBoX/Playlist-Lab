# CI/CD Setup Guide

## Overview

GitHub Actions automatically builds all Playlist Lab applications across multiple platforms:

- **Server Installers**: Linux (DEB, RPM) and macOS (DMG, PKG)
- **Desktop App**: Windows, macOS, and Linux
- **Mobile Apps**: iOS and Android (via Expo EAS Build)
- **Docker Images**: Multi-platform container images

## What GitHub Actions Can Build

### ✅ Fully Automated

1. **Linux Server Installer** (`.deb` and `.rpm`)
   - Built on `ubuntu-latest` runners
   - Creates systemd service
   - Includes all dependencies

2. **macOS Server Installer** (`.dmg` and `.pkg`)
   - Built on `macos-latest` runners
   - Creates application bundle
   - Code signing optional

3. **Desktop App - All Platforms**
   - Windows: `.exe` installer (built on Windows runners)
   - macOS: `.dmg` and `.app` (built on macOS runners)
   - Linux: `.deb`, `.AppImage`, `.tar.gz` (built on Linux runners)

4. **Mobile Apps** (via EAS Build)
   - iOS: `.ipa` file (built on Expo's cloud)
   - Android: `.apk` and `.aab` files (built on Expo's cloud)

5. **Docker Images**
   - Multi-platform support (amd64, arm64)
   - Pushed to Docker Hub automatically

### ⚠️ Limitations

**Windows Server Installer:**
- Requires Inno Setup which is not available on GitHub runners
- Must be built locally on Windows
- Alternative: Use Docker or Linux packages for server deployment

## Setup Instructions

### 1. Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

#### For Mobile Apps (Required)
```
EXPO_TOKEN
```
- Get from: https://expo.dev/accounts/[your-account]/settings/access-tokens
- Click "Create Token"
- Copy and add to GitHub secrets

#### For Docker (Optional)
```
DOCKER_USERNAME
DOCKER_PASSWORD
```
- Your Docker Hub credentials
- Only needed if you want to push Docker images

### 2. Expo Configuration

#### Update `apps/mobile/eas.json`:
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "production": {
      "distribution": "store",
      "ios": {
        "buildType": "release"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account.json",
        "track": "production"
      }
    }
  }
}
```

#### For iOS Builds:
1. Create an Apple Developer account
2. Add credentials to Expo:
   ```bash
   cd apps/mobile
   eas credentials
   ```

#### For Android Builds:
1. Create a Google Play Console account
2. Generate a service account key
3. Add to Expo:
   ```bash
   cd apps/mobile
   eas credentials
   ```

### 3. Triggering Builds

#### Automatic Builds (on Tag)
```bash
# Create and push a version tag
git tag v2.0.0
git push origin v2.0.0
```

This triggers:
- All server installers (Linux, macOS)
- All desktop apps (Windows, macOS, Linux)
- Mobile app builds (iOS, Android)
- Docker image build and push
- GitHub Release creation with all artifacts

#### Manual Builds
1. Go to Actions tab in GitHub
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Enter version number
5. Click "Run workflow"

### 4. Build Outputs

#### GitHub Releases
All builds are automatically attached to GitHub releases:
- `playlist-lab-server_2.0.0_amd64.deb`
- `playlist-lab-server-2.0.0-1.x86_64.rpm`
- `PlaylistLabServer-2.0.0.dmg`
- `PlaylistLabServer-2.0.0.pkg`
- `PlaylistLab-Setup-2.0.0.exe` (Windows desktop)
- `PlaylistLab-2.0.0.dmg` (macOS desktop)
- `PlaylistLab-2.0.0.deb` (Linux desktop)

#### Mobile Apps
Mobile apps are built on Expo's servers:
- Check build status: https://expo.dev/accounts/[your-account]/projects/playlist-lab/builds
- Download builds from Expo dashboard
- Submit to App Store/Play Store from Expo dashboard

#### Docker Hub
Docker images are pushed automatically:
- `your-username/playlist-lab-server:latest`
- `your-username/playlist-lab-server:2.0.0`

## Workflow Files

### `.github/workflows/ci.yml`
Runs on every push and PR:
- Linting
- Unit tests
- Property-based tests
- Build verification

### `.github/workflows/release.yml`
Runs on version tags:
- Builds all installers
- Builds desktop apps
- Triggers mobile builds
- Creates GitHub release
- Pushes Docker images

## Platform-Specific Notes

### Linux
- ✅ Fully automated
- Builds both DEB and RPM packages
- Includes systemd service
- No special setup required

### macOS
- ✅ Fully automated
- Builds DMG and PKG installers
- Code signing optional (add certificates to secrets)
- Notarization optional (requires Apple Developer account)

### Windows Desktop
- ✅ Fully automated
- Uses electron-builder
- Creates NSIS installer and portable exe
- Code signing optional (add certificate to secrets)

### Windows Server
- ❌ Not automated (requires Inno Setup)
- Must be built locally on Windows
- Alternative: Use Linux packages or Docker

### iOS
- ✅ Automated via EAS Build
- Requires Apple Developer account ($99/year)
- Builds on Expo's cloud infrastructure
- Can submit to App Store from Expo dashboard

### Android
- ✅ Automated via EAS Build
- Requires Google Play Console account ($25 one-time)
- Builds on Expo's cloud infrastructure
- Can submit to Play Store from Expo dashboard

## Cost Considerations

### GitHub Actions
- **Free tier**: 2,000 minutes/month for private repos
- **Public repos**: Unlimited minutes
- **Typical build times**:
  - Linux installer: ~5 minutes
  - macOS installer: ~8 minutes
  - Desktop app: ~10 minutes per platform
  - Total: ~40-50 minutes per release

### Expo EAS Build
- **Free tier**: Limited builds per month
- **Paid plans**: Starting at $29/month
  - Unlimited builds
  - Priority queue
  - Faster build times
- **Alternative**: Build locally with `eas build --local`

### Docker Hub
- **Free tier**: Unlimited public images
- **Private repos**: Limited pulls/month

## Troubleshooting

### Mobile Builds Fail
```bash
# Check Expo credentials
cd apps/mobile
eas credentials

# Test build locally
eas build --platform ios --profile preview --local
```

### Desktop Build Fails
```bash
# Check electron-builder config
cd apps/desktop
npm run build
npm run package:win  # or :mac, :linux
```

### Server Installer Fails
```bash
# Test locally
cd scripts/installers/linux
bash build-linux.sh

cd scripts/installers/macos
bash build-macos.sh
```

## Best Practices

1. **Version Tags**: Always use semantic versioning (v2.0.0, v2.1.0, etc.)
2. **Test Locally**: Test builds locally before pushing tags
3. **Changelog**: Update CHANGELOG.md before releases
4. **Mobile Testing**: Use preview builds for testing before production
5. **Code Signing**: Add certificates for production releases

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Electron Builder Documentation](https://www.electron.build/)
- [Docker Build Documentation](https://docs.docker.com/build/)

## Summary

GitHub Actions can build:
- ✅ Linux server installers (DEB, RPM)
- ✅ macOS server installers (DMG, PKG)
- ✅ Windows desktop app
- ✅ macOS desktop app
- ✅ Linux desktop app
- ✅ iOS mobile app (via EAS Build)
- ✅ Android mobile app (via EAS Build)
- ✅ Docker images
- ❌ Windows server installer (requires local build)

All builds are automated and attached to GitHub releases!
