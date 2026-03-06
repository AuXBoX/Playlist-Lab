# GitHub Actions Build Capabilities

## Quick Answer: YES! ✅

GitHub Actions can build **almost everything** for Playlist Lab:

## What Gets Built Automatically

### ✅ Server Installers
- **Linux**: `.deb` (Debian/Ubuntu) and `.rpm` (Fedora/RHEL)
- **macOS**: `.dmg` and `.pkg` installers
- Built on GitHub's cloud runners
- **Free** for public repos

### ✅ Desktop Apps
- **Windows**: `.exe` installer
- **macOS**: `.dmg` and `.app` bundle
- **Linux**: `.deb`, `.AppImage`, `.tar.gz`
- Built using electron-builder
- **Free** for public repos

### ✅ Mobile Apps (React Native/Expo)
- **iOS**: `.ipa` file for App Store
- **Android**: `.apk` and `.aab` files for Play Store
- Built using **EAS Build** (Expo Application Services)
- Builds run on Expo's cloud (not GitHub runners)
- **Cost**: Free tier available, paid plans start at $29/month

### ✅ Docker Images
- Multi-platform containers (amd64, arm64)
- Pushed to Docker Hub automatically
- **Free** for public images

### ❌ Windows Server Installer
- Requires Inno Setup (not available on GitHub runners)
- Must be built locally on Windows
- **Alternative**: Use Linux packages or Docker for server deployment

## How It Works

### 1. Push a Version Tag
```bash
git tag v2.0.0
git push origin v2.0.0
```

### 2. GitHub Actions Automatically:
- Builds Linux server installer (5 min)
- Builds macOS server installer (8 min)
- Builds Windows desktop app (10 min)
- Builds macOS desktop app (10 min)
- Builds Linux desktop app (10 min)
- Triggers iOS build on Expo (15-30 min)
- Triggers Android build on Expo (15-30 min)
- Builds and pushes Docker image (5 min)
- Creates GitHub Release with all files

### 3. Download from GitHub Releases
All installers are automatically attached to the release!

## Setup Required

### For Mobile Apps (iOS/Android)
1. Create Expo account (free)
2. Get Expo token: https://expo.dev/accounts/[your-account]/settings/access-tokens
3. Add to GitHub Secrets as `EXPO_TOKEN`

**For iOS:**
- Apple Developer account ($99/year)
- Add credentials via `eas credentials`

**For Android:**
- Google Play Console account ($25 one-time)
- Add credentials via `eas credentials`

### For Docker (Optional)
1. Add `DOCKER_USERNAME` to GitHub Secrets
2. Add `DOCKER_PASSWORD` to GitHub Secrets

## Cost Breakdown

### GitHub Actions
- **Public repos**: FREE unlimited minutes
- **Private repos**: 2,000 free minutes/month
- Each release uses ~50 minutes total

### Expo EAS Build
- **Free tier**: Limited builds per month
- **Production**: $29/month for unlimited builds
- **Alternative**: Build locally for free with `eas build --local`

### Apple/Google
- **Apple Developer**: $99/year (for iOS)
- **Google Play**: $25 one-time (for Android)

## Files Created

### GitHub Release Artifacts
```
playlist-lab-server_2.0.0_amd64.deb          # Linux DEB
playlist-lab-server-2.0.0-1.x86_64.rpm       # Linux RPM
PlaylistLabServer-2.0.0.dmg                  # macOS DMG
PlaylistLabServer-2.0.0.pkg                  # macOS PKG
PlaylistLab-Setup-2.0.0.exe                  # Windows Desktop
PlaylistLab-2.0.0.dmg                        # macOS Desktop
PlaylistLab-2.0.0.deb                        # Linux Desktop
```

### Expo Dashboard
```
PlaylistLab-2.0.0.ipa                        # iOS App
PlaylistLab-2.0.0.apk                        # Android APK
PlaylistLab-2.0.0.aab                        # Android Bundle
```

### Docker Hub
```
your-username/playlist-lab-server:latest
your-username/playlist-lab-server:2.0.0
```

## Workflow Files

- `.github/workflows/ci.yml` - Runs on every push (tests, linting)
- `.github/workflows/release.yml` - Runs on version tags (builds everything)

## Summary

**YES**, GitHub Actions can build:
- ✅ Linux server installers
- ✅ macOS server installers  
- ✅ Windows desktop app
- ✅ macOS desktop app
- ✅ Linux desktop app
- ✅ iOS mobile app (via Expo)
- ✅ Android mobile app (via Expo)
- ✅ Docker images

**The only exception** is the Windows server installer (requires local build with Inno Setup).

For mobile apps, you just need to:
1. Add `EXPO_TOKEN` to GitHub Secrets
2. Configure Apple/Google credentials in Expo
3. Push a version tag

Everything else is **100% automated**! 🚀

See [docs/CI_CD_SETUP.md](docs/CI_CD_SETUP.md) for detailed setup instructions.
