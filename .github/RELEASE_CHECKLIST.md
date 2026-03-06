# Release Checklist

Quick reference for creating a new release.

## Pre-Release

- [ ] All tests passing
- [ ] Version numbers updated in:
  - [ ] `package.json` (root)
  - [ ] `apps/server/package.json`
  - [ ] `apps/web/package.json`
  - [ ] `apps/desktop/package.json`
  - [ ] `apps/mobile/app.json`
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] All changes committed and pushed

## GitHub Secrets Configured

- [ ] `EXPO_TOKEN` - For mobile builds
- [ ] `DOCKER_USERNAME` - For Docker Hub
- [ ] `DOCKER_PASSWORD` - For Docker Hub

## Create Release

```bash
# 1. Create and push tag
git tag v2.0.0
git push origin v2.0.0

# 2. Monitor builds
# Go to: https://github.com/[username]/[repo]/actions

# 3. Check Expo builds
# Go to: https://expo.dev
```

## What Gets Built

- ✅ Windows server installer (.exe)
- ✅ macOS server installers (.dmg, .pkg)
- ✅ Linux server packages (.deb, .rpm)
- ✅ Windows desktop app (.exe)
- ✅ macOS desktop app (.dmg)
- ✅ Linux desktop app (.AppImage, .deb)
- ✅ iOS mobile app (.ipa) - via Expo
- ✅ Android mobile app (.apk, .aab) - via Expo
- ✅ Docker image (Docker Hub)

## Build Time

- Server installers: ~5-10 min per platform
- Desktop apps: ~10-15 min per platform
- Mobile apps: ~15-30 min per platform (Expo)
- Total: ~30-45 minutes

## After Build Completes

- [ ] Download and test installers
- [ ] Verify GitHub Release created
- [ ] Check Docker image on Docker Hub
- [ ] Download mobile apps from Expo
- [ ] Test on each platform
- [ ] Announce release

## Troubleshooting

**Build fails?**
- Check Actions tab for error logs
- Verify all secrets are set
- Check Expo dashboard for mobile build errors

**Missing artifacts?**
- Wait for all jobs to complete
- Check if job was skipped (conditional)
- Verify upload-artifact step succeeded

## Manual Build (if needed)

```bash
# Server installers
bash scripts/installers/linux/build-linux.sh
bash scripts/installers/macos/build-macos.sh
bash scripts/installers/windows/build-windows.sh

# Desktop app
cd apps/desktop && npm run package:all

# Mobile apps
cd apps/mobile
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Resources

- [GitHub Actions Setup](../docs/GITHUB_ACTIONS_SETUP.md)
- [Expo Dashboard](https://expo.dev)
- [Docker Hub](https://hub.docker.com)
