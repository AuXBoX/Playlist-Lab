# Playlist Lab

A comprehensive music playlist management system with Plex Media Server integration. Import playlists from multiple sources, generate smart mixes, and sync them to your Plex server.

## 🎵 Features

- **Multi-Source Import**: Import playlists from Spotify, Apple Music, YouTube, and more
- **Smart Playlist Generation**: Create dynamic playlists based on genres, moods, and listening patterns
- **Plex Integration**: Seamless sync with Plex Media Server
- **Multi-User Support**: Manage playlists for multiple Plex users and share between them
- **Scheduling**: Automatically update playlists on a schedule
- **Missing Track Detection**: Identify and track songs not available in your library
- **Cross-Platform**: Available as web app, desktop app, and mobile app

## 📦 Applications

This is a monorepo containing multiple applications:

### Server (Multi-User Web Server)
- **Location**: `apps/server/`
- **Type**: Express.js REST API with SQLite database
- **Features**: Multi-user authentication, playlist management, Plex integration, scheduling
- **Deployment**: Can be deployed anywhere (VPS, cloud, local network)
- **Port**: 3001 (configurable)

### Web App (Responsive PWA)
- **Location**: `apps/web/`
- **Type**:![alt text](image.png) (PWA)
- **Features**: Full-featured interface, works on desktop and mobile
- **Responsive**: Adapts to any screen size (desktop, tablet, mobile)
- **Installable**: Add to home screen on mobile devices
- **Access**: Connect to any Playlist Lab server
- **Platforms**: Any device with a modern browser

### Desktop App
- **Location**: `apps/desktop/`
- **Type**: Standalone Electron application
- **Features**: Embedded server, single-user, portable
- **Platforms**: Windows, macOS, Linux

### Mobile App (Deprecated)
- **Location**: `apps/mobile/`
- **Status**: ⚠️ DEPRECATED - Use responsive web app instead
- **Reason**: Web app now works perfectly on mobile devices
- **See**: [apps/mobile/DEPRECATED.md](apps/mobile/DEPRECATED.md)

## 🚀 Quick Start

### Server Installation

**Option 1: Windows Installer**
```cmd
# Download and run the installer
PlaylistLabServer-Setup-2.0.0.exe
```

**Option 2: Docker (Recommended for Development)**
```bash
# Quick start
docker-compose up -d

# View logs
docker-compose logs -f

# Access at http://localhost:3001
```

**Option 3: Manual Installation**
```bash
# Install dependencies
npm install

# Build shared package
cd packages/shared && npm run build && cd ../..

# Build server
cd apps/server && npm run build && cd ../..

# Build web app
cd apps/web && npm run build && cd ../..

# Start server
cd apps/server && npm start
```

### Desktop App

Download the appropriate installer for your platform:
- Windows: `PlaylistLab-Setup-1.1.2.exe`
- macOS: `PlaylistLab-1.1.2.dmg`
- Linux: `PlaylistLab-1.1.2.deb`

### Web App on Mobile

The web app works perfectly on mobile devices:

**iOS (iPhone/iPad)**
1. Open Safari and navigate to your server URL
2. Tap Share → "Add to Home Screen"
3. App icon appears on home screen

**Android**
1. Open Chrome and navigate to your server URL
2. Tap menu → "Install app"
3. App icon appears in app drawer

See [docs/RESPONSIVE_WEB_APP.md](docs/RESPONSIVE_WEB_APP.md) for details.

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Setup
```bash
# Clone repository
git clone https://github.com/yourusername/playlist-lab.git
cd playlist-lab

# Install dependencies
npm install

# Build shared package
cd packages/shared && npm run build && cd ../..

# Start development servers
npm run dev:server  # Server on port 3001
npm run dev:web     # Web app on port 5173
npm run dev:mobile  # Mobile app with Expo
```

### Git Operations
Use the GitHub Manager for easy Git operations:
```cmd
scripts\github-manager.bat
```

Features:
- ✅ Automatic requirement checks
- ✅ 28 Git operations with easy menu
- ✅ Color-coded interface
- ✅ Safety confirmations for dangerous operations
- ✅ One-click release tagging (triggers CI/CD)

See [GitHub Manager Guide](docs/GITHUB_MANAGER_GUIDE.md) for details.

### Building

**Build Everything**
```bash
# Windows
scripts\build-all-installers.bat

# macOS/Linux
bash scripts/build-all-installers.sh
```

**Build Individual Components**
```bash
# Server only
cd apps/server && npm run build

# Web app only
cd apps/web && npm run build

# Desktop app only
cd apps/desktop && npm run build

# Mobile app (requires EAS CLI)
cd apps/mobile && eas build --platform ios
```

## 📖 Documentation

**Complete Index**: [docs/INDEX.md](docs/INDEX.md)

### User Documentation
- [User Guide](docs/USER_GUIDE.md) - How to use Playlist Lab
- [Windows Installer Guide](docs/WINDOWS_INSTALLER_GUIDE.md) - Windows installation details
- [macOS Installer Guide](docs/MACOS_INSTALLER_GUIDE.md) - macOS installation details
- [Linux Installer Guide](docs/LINUX_INSTALLER_GUIDE.md) - Linux installation details

### Developer Documentation
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Development setup and guidelines
- [API Documentation](docs/API.md) - REST API reference
- [Project Structure](docs/PROJECT_STRUCTURE.md) - Codebase organization
- [Web vs Mobile Comparison](docs/WEB_MOBILE_COMPARISON.md) - Platform differences

### Deployment & CI/CD
- [Deployment Guide](docs/DEPLOYMENT_ANYWHERE.md) - Deploy to VPS, cloud, or local network
- [Docker Setup](docs/DOCKER_SETUP.md) - Docker configuration and deployment
- [CI/CD Setup](docs/CI_CD_SETUP.md) - Automated builds with GitHub Actions
- [GitHub Actions Setup](docs/GITHUB_ACTIONS_SETUP.md) - Detailed CI/CD configuration

### Tools & Utilities
- [GitHub Manager Guide](docs/GITHUB_MANAGER_GUIDE.md) - Git operations made easy
- [Build Scripts](scripts/README.md) - Build and installer scripts

## 🏗️ Architecture

```
playlist-lab/
├── apps/
│   ├── desktop/          # Electron desktop app
│   ├── mobile/           # React Native mobile app
│   ├── server/           # Express.js API server
│   └── web/              # React web app
├── packages/
│   └── shared/           # Shared TypeScript code
├── scripts/              # Build and deployment scripts
├── docs/                 # Documentation
└── deployment/           # Deployment configurations
```

## 🔧 Technology Stack

- **Backend**: Node.js, Express.js, SQLite, TypeScript
- **Frontend**: React, TypeScript, Vite
- **Mobile**: React Native, Expo
- **Desktop**: Electron
- **Testing**: Jest, fast-check (property-based testing)
- **Build**: TypeScript, Vite, Electron Builder, EAS Build

## 📝 Version History

### Version 2.0.0 (Current - Server)
- Multi-user web server with authentication
- User management and permissions
- Playlist sharing between users
- RESTful API
- Deployable anywhere
- Web-based interface (no tray app needed)

### Version 1.1.2 (Desktop App)
- Standalone desktop application
- Embedded server
- Single-user mode
- Cross-platform support

## ⚠️ Important Notes

### Server Installers
The Windows/macOS/Linux server installers have been updated for the web-based server (v2.0.0). These installers no longer include a tray application - the server runs as a background service and is accessed via web browser at `http://localhost:3001`.

**Installation Methods:**
- **Windows**: Run the `.exe` installer - creates Start Menu shortcuts and optionally starts on boot
- **macOS**: Install the `.dmg` or `.pkg` - creates an application bundle in Applications
- **Linux**: Install the `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL) - includes systemd service
- **Docker**: Use `docker-compose up -d` (recommended for development)
- **Manual**: Build and run the server directly (see Quick Start)
- **VPS/Cloud**: Deploy using the deployment scripts in `deployment/`

**Access**: After installation, open your browser to `http://localhost:3001`

After installation, access the server at `http://localhost:3001` in your web browser.

## 🤝 Contributing

Contributions are welcome! Please read the [Developer Guide](docs/DEVELOPER_GUIDE.md) for guidelines.

## 📄 License

See LICENSE file for details.

## 🙏 Acknowledgments

- Plex Media Server for the excellent media platform
- All the open-source libraries that make this possible

## 📧 Support

- Issues: [GitHub Issues](https://github.com/yourusername/playlist-lab/issues)
- Documentation: [docs/](docs/)
- Email: audexa@users.noreply.github.com

---

Made with ❤️ by Audexa
