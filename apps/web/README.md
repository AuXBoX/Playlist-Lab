# Playlist Lab Web Client

Multi-user **responsive Progressive Web App (PWA)** for managing Plex playlists.

## Overview

The web client is a fully responsive React application that works seamlessly on:
- 🖥️ **Desktop**: Full layout with sidebar navigation
- 📱 **Mobile**: Touch-optimized with hamburger menu
- 📱 **Tablets**: Adaptive layouts for comfortable use

### Progressive Web App (PWA)
- ✅ **Installable**: Add to home screen on mobile and desktop
- ✅ **Offline Support**: Service worker caches assets
- ✅ **App-Like**: Standalone mode without browser chrome
- ✅ **Fast Loading**: Cached assets load instantly

## Features Implemented

### Task 20.1: React App Initialization ✅
- **Vite + React + TypeScript** setup with optimized build configuration
- **React Router** for client-side routing with protected routes
- **Global Styles & Theme** with CSS variables for consistent design
  - Dark theme with Plex-inspired color scheme
  - Responsive layout with CSS Grid and Flexbox
  - Utility classes for common UI patterns
- **Layout Components**:
  - `Header`: Top navigation with user info and logout
  - `Sidebar`: Navigation menu with active link highlighting
  - `Footer`: Simple footer with copyright
  - `Layout`: Main layout wrapper combining all components

### Task 20.2: Authentication Context ✅
- **AuthContext** with React Context API for authentication state
- **Plex OAuth Flow** implementation:
  - PIN-based authentication
  - Automatic polling for auth completion
  - Session persistence with cookies
- **Protected Routes** with automatic redirect to login
- **Login Page** with Plex authentication UI
- **Session Management**:
  - Check auth status on mount
  - Restore session from cookies
  - Logout functionality

### Task 20.3: App State Management ✅
- **AppContext** for global application state:
  - Server configuration
  - User settings (matching & mix settings)
  - Playlists list
  - Schedules list
  - Missing tracks count
- **State Management Functions**:
  - `setServer`: Update selected Plex server
  - `updateSettings`: Save user settings to API
  - `refreshPlaylists`: Fetch latest playlists
  - `refreshSchedules`: Fetch latest schedules
  - `refreshMissingTracksCount`: Update missing tracks count
  - `refreshAll`: Refresh all data in parallel
- **Dashboard Page** displaying stats and quick actions

### Responsive Design & PWA ✅
- **Mobile Navigation**:
  - Hamburger menu with slide-out drawer
  - Touch-friendly navigation (44px minimum touch targets)
  - Auto-close on route change
  - Overlay backdrop
- **Responsive Layouts**:
  - Desktop: Full sidebar, multi-column layouts
  - Tablet: Optimized spacing
  - Mobile: Stacked layouts, hamburger menu
- **PWA Features**:
  - Service worker for offline support
  - Installable on mobile and desktop
  - App manifest with icons and shortcuts
  - Fast loading with asset caching
- **Touch Optimization**:
  - 16px font size (prevents iOS zoom)
  - 44-48px touch targets
  - Smooth animations
  - Safe area insets for notched devices

## Project Structure

```
apps/web/
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker
│   ├── icon_192x192.png         # App icon (small)
│   ├── icon_512x512.png         # App icon (large)
│   ├── apple_touch_180x180.png  # iOS icon
│   └── favicon_*.png            # Favicons
├── src/
│   ├── components/
│   │   ├── Header.tsx/css       # Top navigation with mobile nav
│   │   ├── Sidebar.tsx/css      # Desktop side navigation
│   │   ├── MobileNav.tsx/css    # Mobile hamburger menu
│   │   ├── Footer.tsx/css       # Footer
│   │   ├── Layout.tsx/css       # Main layout wrapper
│   │   └── ProtectedRoute.tsx   # Route guard
│   ├── contexts/
│   │   ├── AuthContext.tsx      # Authentication state
│   │   └── AppContext.tsx       # Application state
│   ├── pages/
│   │   ├── LoginPage.tsx        # Login with Plex OAuth
│   │   ├── DashboardPage.tsx    # Dashboard with stats
│   │   ├── ImportPage.tsx       # Import playlists
│   │   ├── GenerateMixesPage.tsx # Generate mixes
│   │   ├── PlaylistsPage.tsx    # View playlists
│   │   ├── EditPlaylistsPage.tsx # Edit playlists
│   │   ├── SharePlaylistsPage.tsx # Share playlists
│   │   ├── BackupRestorePage.tsx # Backup & restore
│   │   ├── MissingTracksPage.tsx # Missing tracks
│   │   ├── SchedulesPage.tsx    # Schedules
│   │   ├── SettingsPage.tsx     # Settings
│   │   └── AdminPage.tsx        # Admin panel
│   ├── utils/
│   │   └── serviceWorker.ts     # SW registration
│   ├── App.tsx                  # Root component with routing
│   ├── main.tsx                 # Entry point with SW
│   └── index.css                # Global responsive styles
├── index.html                   # HTML with PWA meta tags
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Integration

The web client communicates with the Express API server at `/api/*`:

- **Authentication**: `/api/auth/*`
- **Settings**: `/api/settings`
- **Playlists**: `/api/playlists`
- **Schedules**: `/api/schedules`
- **Missing Tracks**: `/api/missing`

All requests use `credentials: 'include'` for cookie-based session management.

## Responsive Design

### Breakpoints
- **Mobile**: ≤768px - Hamburger menu, stacked layouts
- **Tablet**: 769-1024px - Optimized spacing
- **Desktop**: ≥1025px - Full sidebar, multi-column layouts

### Mobile Features
- Hamburger menu with slide-out drawer (280px)
- Touch-friendly buttons (44px minimum height)
- No zoom on input focus (16px font size)
- Smooth animations (GPU-accelerated)
- Safe area insets for notched devices

### PWA Installation

#### iOS (Safari)
1. Open in Safari
2. Tap Share → "Add to Home Screen"
3. App icon appears on home screen

#### Android (Chrome)
1. Open in Chrome
2. Tap menu → "Install app"
3. App icon appears in app drawer

#### Desktop (Chrome/Edge)
1. Look for install icon in address bar
2. Click "Install"
3. App opens in standalone window

## Browser Support

### Desktop
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile
- iOS Safari 14+ (iOS 14+)
- Chrome for Android 90+
- Samsung Internet 14+

## Next Steps

All core pages are implemented. Future enhancements:
- Full offline mode with data sync
- Push notifications
- Background sync
- Share target API
- Media session API

## Design System

### Colors
- Primary: `#e5a00d` (Plex orange)
- Background: `#1a1a1a` (Dark)
- Surface: `#282a2d` (Card background)
- Text Primary: `#ffffff`
- Text Secondary: `#b3b3b3`

### Layout
- Header Height: `64px`
- Sidebar Width: `240px`
- Max Content Width: `1400px`

### Components
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`
- Cards: `.card`
- Inputs: `.input`, `.label`
