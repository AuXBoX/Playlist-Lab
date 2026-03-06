# Playlist Lab Mobile App

React Native mobile application for Playlist Lab, built with Expo for iOS and Android.

## Features

- **Cross-Platform**: Single codebase for iOS and Android
- **Plex Authentication**: Secure PIN-based OAuth flow
- **Playlist Management**: Import, generate, and manage playlists
- **Personal Mixes**: Generate Weekly Mix, Daily Mix, Time Capsule, and New Music Mix
- **Offline Support**: Cached data and queued actions
- **Native UI**: Platform-specific components and gestures
- **Haptic Feedback**: Tactile feedback for interactions
- **Swipe Gestures**: Native swipe-to-delete and long-press actions

## Documentation

- **[Setup Guide](SETUP_COMPLETE.md)** - Initial setup and configuration
- **[Platform Features](PLATFORM_FEATURES.md)** - Platform-specific UI patterns and native features
- **[Assets Guide](ASSETS_GUIDE.md)** - App icons and splash screens specifications
- **[Build Guide](BUILD_GUIDE.md)** - Building and deploying for iOS and Android
- **[Offline Support](OFFLINE_SUPPORT.md)** - Offline functionality and sync

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) for building
- iOS: iPhone with Expo Go app
- Android: Android device or emulator with Expo Go app

## Quick Start

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm start
# or
expo start
```

Scan the QR code with:
- **iOS**: Camera app (opens in Expo Go)
- **Android**: Expo Go app

### Run on Specific Platform

```bash
# iOS (requires Mac or Expo Go on iPhone)
npm run ios

# Android
npm run android

# Web (for testing)
npm run web
```

## Building for Production

See [BUILD_GUIDE.md](BUILD_GUIDE.md) for detailed instructions.

### Quick Build Commands

```bash
# Android APK
npm run build:android

# iOS IPA (Cloud Build - No Mac Required)
npm run build:ios

# Both platforms
npm run build:all
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── screens/          # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── ImportScreen.tsx
│   │   ├── GenerateScreen.tsx
│   │   ├── PlaylistsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── navigation/       # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── contexts/         # React contexts
│   │   ├── AuthContext.tsx
│   │   └── OfflineContext.tsx
│   ├── services/         # API and storage services
│   │   ├── api.ts
│   │   ├── storage.ts
│   │   └── offline.ts
│   ├── components/       # Reusable components
│   │   ├── OfflineIndicator.tsx
│   │   └── SwipeablePlaylistItem.tsx
│   ├── utils/            # Utility functions
│   │   ├── haptics.ts
│   │   └── platformIcons.ts
│   └── hooks/            # Custom hooks
│       └── useAuth.ts
├── assets/               # App icons and splash screens
├── scripts/              # Build and utility scripts
├── App.tsx               # Root component
├── app.json              # Expo configuration
├── eas.json              # EAS Build configuration
└── package.json
```

## Platform-Specific Features

### iOS
- Bottom tab navigation
- SF Symbols-style icons
- iOS-style haptic feedback
- Native gestures and animations

### Android
- Drawer navigation
- Material Design icons
- Android haptic feedback
- Material Design components

See [PLATFORM_FEATURES.md](PLATFORM_FEATURES.md) for details.

## Authentication Flow

1. User taps "Sign in with Plex"
2. App requests PIN from server
3. Opens Plex auth page in browser
4. User enters PIN on Plex website
5. App polls for auth completion
6. Token stored securely with expo-secure-store
7. User data cached with AsyncStorage

## API Configuration

The app connects to the Playlist Lab server:

- **Development**: `http://localhost:3000`
- **Production**: Configure in `src/services/api.ts`

## Storage

- **Secure Storage**: Plex auth token (expo-secure-store)
- **AsyncStorage**: User data, server info, cached playlists, offline queue

## Testing

```bash
npm test
```

## Deployment

See [BUILD_GUIDE.md](BUILD_GUIDE.md) for complete deployment instructions.

### iOS App Store

1. Configure Apple Developer account
2. Build: `npm run build:ios`
3. Submit: `npm run submit:ios`

### Google Play Store

1. Configure Google Play account
2. Build: `npm run build:android`
3. Submit: `npm run submit:android`

## App Icons and Splash Screens

See [ASSETS_GUIDE.md](ASSETS_GUIDE.md) for specifications and guidelines.

Required assets:
- `icon.png` - 1024x1024px universal icon
- `icon-ios.png` - 1024x1024px iOS-specific icon
- `adaptive-icon.png` - 1024x1024px Android adaptive icon
- `splash.png` - 1242x2436px splash screen
- `favicon.png` - 48x48px web favicon
- `notification-icon.png` - 96x96px notification icon

## Environment Variables

Create `.env` file:

```
API_BASE_URL=https://your-server.com
```

## Troubleshooting

### iOS Build from Windows

Use Expo EAS Build cloud service:
```bash
eas build --platform ios
```

No Mac required - builds on Expo's servers.

### Android Build Issues

Clear cache and rebuild:
```bash
npm run clean
npm install
npm run build:android
```

### Network Errors

Check API_BASE_URL in `src/services/api.ts` matches your server.

### Offline Mode

See [OFFLINE_SUPPORT.md](OFFLINE_SUPPORT.md) for offline functionality details.

## Contributing

See main project README for contribution guidelines.

## License

See main project LICENSE file.
