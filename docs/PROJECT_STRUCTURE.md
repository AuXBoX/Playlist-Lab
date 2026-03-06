# Playlist Lab - Project Structure

## Overview

Playlist Lab is a monorepo containing multiple applications and packages for managing music playlists with Plex Media Server integration.

## Directory Structure

```
playlist-lab/
├── .github/                    # GitHub workflows and CI/CD
│   └── workflows/
│       └── ci.yml
│
├── .kiro/                      # Kiro AI specs and configuration
│   ├── specs/                  # Feature specifications
│   │   ├── multi-user-web-app/
│   │   ├── playlist-lab-web-server/
│   │   └── windows-server-tray-app/
│   └── steering/               # AI steering rules
│       └── PLEX_API_COMPLETE_REFERENCE.md
│
├── apps/                       # Application code
│   ├── desktop/                # Standalone desktop application
│   │   ├── src/
│   │   │   ├── main/           # Electron main process
│   │   │   └── renderer/       # React renderer
│   │   ├── release/            # Build output
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── mobile/                 # React Native mobile app
│   │   ├── src/
│   │   ├── App.tsx
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── server/                 # Express.js API server
│   │   ├── src/
│   │   │   ├── database/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── web/                    # React web application
│       ├── src/
│       │   ├── components/
│       │   ├── contexts/
│       │   ├── pages/
│       │   └── main.tsx
│       ├── package.json
│       └── README.md
│
├── deployment/                 # Deployment configurations
│   ├── apache.conf
│   ├── caddy.conf
│   ├── nginx.conf
│   ├── playlist-lab.service
│   ├── ecosystem.config.js
│   ├── deploy-staging.sh
│   ├── quick-deploy.sh
│   ├── run-staging-tests.sh
│   ├── health-check.sh
│   └── DEPLOYMENT_GUIDE.md
│
├── docs/                       # Documentation
│   ├── API.md                  # API documentation
│   ├── DEPLOYMENT.md           # Deployment guide
│   ├── DEVELOPER_GUIDE.md      # Developer guide
│   ├── USER_GUIDE.md           # User guide
│   ├── TESTING_SETUP.md        # Testing documentation
│   ├── PROJECT_STRUCTURE.md    # This file
│   ├── SERVER_README.md        # Server installation guide
│   ├── WINDOWS_INSTALLER_GUIDE.md
│   ├── MACOS_INSTALLER_GUIDE.md
│   ├── LINUX_INSTALLER_GUIDE.md
│   ├── PLEX_API_COMPLETE_REFERENCE.md
│   └── Playlist-Lab-API.postman_collection.json
│
├── packages/                   # Shared packages
│   └── shared/                 # Shared TypeScript code
│       ├── src/
│       │   ├── api/
│       │   ├── types/
│       │   └── utils/
│       ├── dist/
│       └── package.json
│
├── scripts/                    # Build and utility scripts
│   ├── installers/             # Platform-specific installers
│   │   ├── desktop/            # Desktop app build
│   │   │   └── build-desktop.sh
│   │   ├── windows/            # Windows installer files
│   │   │   ├── build-windows.sh
│   │   │   ├── setup.iss
│   │   │   ├── server-launcher.js
│   │   │   ├── service-manager.js
│   │   │   └── startup-manager.js
│   │   ├── macos/              # macOS installer files
│   │   │   ├── build-macos.sh
│   │   │   └── server-launcher.sh
│   │   ├── linux/              # Linux package files
│   │   │   ├── build-linux.sh
│   │   │   └── server-launcher.sh
│   │   └── README.md
│   │
│   ├── release/                # Build output directory
│   │   ├── server/             # Windows installers
│   │   ├── macos/              # macOS installers
│   │   └── linux/              # Linux packages
│   │
│   ├── windows/                # Windows-specific utilities
│   │   ├── build.bat
│   │   ├── build-production.bat
│   │   ├── dev.bat
│   │   ├── github-manager.bat
│   │   └── github-manager.ps1
│   │
│   ├── build-all-installers.sh    # Unified installer build
│   ├── build-production.js        # Production build (Node.js)
│   ├── build-production.sh        # Production build (Bash)
│   ├── backup-database.js         # Database backup
│   ├── restore-database.js        # Database restore
│   ├── init-database.js           # Database initialization
│   ├── update-server.js           # Server update utility
│   └── README.md
│

├── .dockerignore
├── .eslintrc.json
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── docker-compose.yml
├── docker-compose.staging.yml
├── package.json                # Root package.json (monorepo)
├── package-lock.json
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.main.json
├── vite.config.ts
├── README.md                   # Main README
├── README.monorepo.md          # Monorepo documentation
├── RELEASE_NOTES.md
└── PROJECT_STRUCTURE.md        # This file
```

## Key Components

### Applications

**Desktop App (`apps/desktop/`)**
- Standalone Electron application
- Embedded Express.js server
- Single-user, local installation
- Auto-update support
- Bundles server and web UI

**Server (`apps/server/`)**
- Express.js REST API
- SQLite database
- Plex Media Server integration
- Background job scheduling
- Session management
- Authentication
- Multi-user support

**Web App (`apps/web/`)**
- React + TypeScript
- Vite build system
- React Router
- Context API for state management
- Responsive design

**Mobile App (`apps/mobile/`)**
- React Native + Expo
- Cross-platform (iOS/Android)
- Offline support
- Platform-specific features
- Haptic feedback

### Shared Code

**Shared Package (`packages/shared/`)**
- TypeScript types
- API client
- Utility functions
- Shared between server, web, and mobile

### Build System

**Scripts (`scripts/`)**
- Unified build script for all platforms
- Platform-specific installer builders
- Database utilities
- Deployment scripts
- Windows-specific batch files

### Documentation

**Docs (`docs/`)**
- API documentation
- User guides
- Installation guides
- Developer documentation
- Deployment guides

## Technology Stack

### Backend
- Node.js 18+
- Express.js
- TypeScript
- SQLite (better-sqlite3)
- Winston (logging)
- node-cron (scheduling)

### Frontend (Web)
- React 18
- TypeScript
- Vite
- React Router
- CSS3

### Frontend (Mobile)
- React Native
- Expo
- TypeScript
- React Navigation
- AsyncStorage

### Desktop (Tray App)
- Electron
- TypeScript
- Platform-specific APIs

### Testing
- Jest
- fast-check (property-based testing)
- Supertest (API testing)
- React Testing Library

### Build Tools
- TypeScript Compiler
- Vite (web)
- Metro (mobile)
- Electron Builder (tray app)
- Inno Setup (Windows installer)
- pkgbuild/hdiutil (macOS installer)
- dpkg-deb/rpmbuild (Linux packages)

## Development Workflow

1. **Install dependencies**: `npm install` (root)
2. **Build shared package**: `cd packages/shared && npm run build`
3. **Start server**: `cd apps/server && npm run dev`
4. **Start web app**: `cd apps/web && npm run dev`
5. **Start mobile app**: `cd apps/mobile && npm start`
6. **Build desktop app**: `cd apps/desktop && npm run build`

## Build for Production

```bash
# Build all applications
bash scripts/build-production.sh

# Build installers
bash scripts/build-all-installers.sh
```

## Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## Testing

```bash
# Run all tests
npm test

# Run server tests
cd apps/server && npm test

# Run web tests
cd apps/web && npm test

# Run mobile tests
cd apps/mobile && npm test

# Run desktop app tests
cd apps/desktop && npm test
```

## Contributing

See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for contribution guidelines.

## License

See LICENSE file for details.
