# GitHub Actions CI/CD Setup

This document explains how to set up automated builds for all Playlist Lab applications using GitHub Actions.

## Overview

GitHub Actions can automatically build:
- ✅ **Server installers**: Windows (.exe), macOS (.dmg, .pkg), Linux (.deb, .rpm)
- ✅ **Desktop app**: Windows, macOS, Linux versions
- ✅ **Mobile apps**: iOS and Android (via Expo EAS Build)
- ✅ **Docker images**: Multi-platform container images
- ✅ **Web app**: Static files for deployment

## What Gets Built

### Server Installers
- **Windows**: `.exe` installer with Inno Setup
- **macOS**: `.dmg` and `.pkg` installers
- **Linux**: `.deb` (Debian/Ubuntu) and `.rpm` (Fedora/RHEL) packages

### Desktop App
- **Windows**: `.exe` installer and portable version
- **macOS**: `.dmg` installer
- **Linux**: `.AppImage`, `.deb`, and `.tar.gz`

### Mobile Apps
- **iOS**: `.ipa` file (requires Apple Developer account)
- **Android**: `.apk` and `.aab` files

### Docker
- Multi-platform Docker images pushed to Docker Hub

## Required Secrets

You need to configure these secrets in your GitHub repository:

### For Mobile Builds (Expo)
1. **EXPO_TOKEN**: Your Expo access token
   - Get it from: https://expo.dev/accounts/[username]/settings/access-tokens
   - Click "Create Token"
   - Copy the token
   - Add to GitHub: Settings → Secrets → Actions → New repository secret

### For Docker Builds
2. **DOCKER_USERNAME**: Your Docker Hub username
3. **DOCKER_PASSWORD**: Your Docker Hub password or access token
   - Get token from: https://hub.docker.com/settings/security
   - Click "New Access Token"
   - Add both to GitHub secrets

### For iOS Builds (Optional - if you want to sign)
4. **APPLE_ID**: Your Apple ID email
5. **APPLE_APP_SPECIFIC_PASSWORD**: App-specific password
6. **APPLE_TEAM_ID**: Your Apple Developer Team ID

### For Android Builds (Optional - if you want to sign)
7. **ANDROID_KEYSTORE**: Base64-encoded keystore file
8. **ANDROID_KEYSTORE_PASSWORD**: Keystore password
9. **ANDROID_KEY_ALIAS**: Key alias
10. **ANDROID_KEY_PASSWORD**: Key password

## How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value
5. Click **Add secret**

## Triggering Builds

### Automatic Builds (on Tag Push)

Create and push a version tag:

```bash
# Create a new version tag
git tag v2.0.0

# Push the tag to GitHub
git push origin v2.0.0
```

This will automatically:
1. Build all server installers (Windows, macOS, Linux)
2. Build desktop apps for all platforms
3. Build mobile apps (iOS and Android)
4. Create a GitHub Release with all artifacts
5. Build and push Docker images

### Manual Builds

You can also trigger builds manually:

1. Go to **Actions** tab in your GitHub repository
2. Click **Build and Release** workflow
3. Click **Run workflow**
4. Enter the version number
5. Click **Run workflow**

## Build Process

### Server Installers

**Linux** (runs on `ubuntu-latest`):
- Installs `dpkg-dev` and `rpm` tools
- Builds server and web app
- Creates `.deb` and `.rpm` packages
- Uploads to GitHub Release

**macOS** (runs on `macos-latest`):
- Builds server and web app
- Creates `.dmg` and `.pkg` installers
- Uploads to GitHub Release

**Windows** (runs on `windows-latest`):
- Installs Inno Setup via Chocolatey
- Builds server and web app
- Creates `.exe` installer
- Uploads to GitHub Release

### Desktop App

Builds on all three platforms using Electron Builder:
- Windows: NSIS installer and portable
- macOS: DMG installer
- Linux: AppImage, DEB, and tar.gz

### Mobile Apps

Uses Expo EAS Build (cloud-based):
- **iOS**: Builds `.ipa` file (requires Apple Developer account)
- **Android**: Builds `.apk` and `.aab` files
- Builds run on Expo's servers (not GitHub runners)
- You'll receive a notification when builds complete

## Expo EAS Build Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Login to Expo

```bash
eas login
```

### 3. Configure EAS Build

Your `apps/mobile/eas.json` is already configured. To customize:

```bash
cd apps/mobile
eas build:configure
```

### 4. Create Expo Access Token

```bash
# Generate a token
eas whoami
# Go to https://expo.dev/accounts/[username]/settings/access-tokens
# Create a new token
# Add it to GitHub secrets as EXPO_TOKEN
```

### 5. iOS Setup (Optional)

For iOS builds, you need:
- Apple Developer account ($99/year)
- App Store Connect API key

```bash
cd apps/mobile
eas credentials
```

### 6. Android Setup (Optional)

For Android builds, you can use Expo's managed credentials or provide your own:

```bash
cd apps/mobile
eas credentials
```

## Monitoring Builds

### GitHub Actions

1. Go to **Actions** tab in your repository
2. Click on the running workflow
3. View logs for each job

### Expo Builds

1. Go to https://expo.dev
2. Navigate to your project
3. Click **Builds** to see iOS/Android build status
4. Download completed builds

## Build Artifacts

After a successful build, you'll find:

### GitHub Release
- All installers attached to the release
- Automatically created when you push a tag
- Download from: `https://github.com/[username]/[repo]/releases`

### Docker Hub
- Images available at: `[username]/playlist-lab-server:latest`
- Tagged versions: `[username]/playlist-lab-server:2.0.0`

### Expo
- iOS and Android builds available in Expo dashboard
- Can be downloaded and submitted to app stores

## Build Times

Approximate build times:
- **Server installers**: 5-10 minutes per platform
- **Desktop app**: 10-15 minutes per platform
- **Mobile apps**: 15-30 minutes per platform (on Expo servers)
- **Docker**: 5-10 minutes

Total time for all builds: ~30-45 minutes

## Cost Considerations

### GitHub Actions
- **Free tier**: 2,000 minutes/month for private repos
- **Public repos**: Unlimited minutes
- **macOS runners**: Count as 10x minutes (1 minute = 10 minutes)
- **Windows runners**: Count as 2x minutes

### Expo EAS Build
- **Free tier**: Limited builds per month
- **Paid plans**: Starting at $29/month for unlimited builds
- See: https://expo.dev/pricing

## Troubleshooting

### Build Fails on macOS
- Ensure you're using `macos-latest` runner
- Check that all dependencies are installed
- Verify code signing certificates (if applicable)

### Build Fails on Windows
- Ensure Inno Setup is installed correctly
- Check that paths use forward slashes in bash scripts
- Verify Node.js version compatibility

### Mobile Build Fails
- Check Expo token is valid
- Verify `eas.json` configuration
- Check Expo dashboard for detailed error logs
- Ensure app.json has correct bundle identifiers

### Docker Build Fails
- Verify Docker Hub credentials
- Check Dockerfile syntax
- Ensure all dependencies are available

## Manual Build Commands

If you need to build locally:

```bash
# Server installers
bash scripts/installers/linux/build-linux.sh
bash scripts/installers/macos/build-macos.sh
bash scripts/installers/windows/build-windows.sh

# Desktop app
cd apps/desktop
npm run package:win
npm run package:mac
npm run package:linux

# Mobile apps
cd apps/mobile
eas build --platform ios --profile production
eas build --platform android --profile production

# Docker
docker build -t playlist-lab-server .
```

## Next Steps

1. **Add secrets** to your GitHub repository
2. **Create a tag** to trigger your first build
3. **Monitor** the Actions tab for build progress
4. **Download** artifacts from the GitHub Release
5. **Test** the installers on each platform

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Electron Builder Documentation](https://www.electron.build/)
- [Inno Setup Documentation](https://jrsoftware.org/isinfo.php)

---

**Questions?** Check the GitHub Actions logs or Expo dashboard for detailed error messages.
