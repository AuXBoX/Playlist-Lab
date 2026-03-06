# Playlist Lab Documentation Index

This directory contains all project documentation. For the main project overview, see [../README.md](../README.md).

## User Documentation

### Getting Started
- [User Guide](USER_GUIDE.md) - Complete guide for end users
- [Windows Installer Guide](WINDOWS_INSTALLER_GUIDE.md) - Windows installation instructions
- [macOS Installer Guide](MACOS_INSTALLER_GUIDE.md) - macOS installation instructions
- [Linux Installer Guide](LINUX_INSTALLER_GUIDE.md) - Linux installation instructions

### Features
- [Plex Playlist Sharing Explained](PLEX_PLAYLIST_SHARING_EXPLAINED.md) - How playlist sharing works
- [AI Features Summary](AI_FEATURES_SUMMARY.md) - AI-powered features overview

## Developer Documentation

### Setup & Development
- [Developer Guide](DEVELOPER_GUIDE.md) - Development environment setup
- [Monorepo Guide](MONOREPO_GUIDE.md) - Working with the monorepo structure
- [Project Structure](PROJECT_STRUCTURE.md) - Codebase organization

### API & Integration
- [API Documentation](API.md) - REST API reference
- [Postman Collection](Playlist-Lab-API.postman_collection.json) - API testing collection
- [Plex API Complete Reference](.kiro/steering/PLEX_API_COMPLETE_REFERENCE.md) - Plex API documentation

### Platform-Specific
- [Web vs Mobile Comparison](WEB_MOBILE_COMPARISON.md) - Platform differences and sync status
- [Apple Music Import Status](APPLE_MUSIC_IMPORT_STATUS.md) - Apple Music integration details
- [Spotify Dual Method Summary](SPOTIFY_DUAL_METHOD_SUMMARY.md) - Spotify import methods

## Deployment & Operations

### Deployment
- [Deployment Anywhere](DEPLOYMENT_ANYWHERE.md) - Deploy to VPS, cloud, or local network
- [Docker Setup](DOCKER_SETUP.md) - Docker configuration and deployment
- [Deployment Guide](../deployment/DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [Server README](SERVER_README.md) - Server-specific documentation

### CI/CD & Automation
- [CI/CD Setup](CI_CD_SETUP.md) - Continuous integration overview
- [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md) - Automated builds configuration
- [GitHub Actions Summary](GITHUB_ACTIONS_SUMMARY.md) - CI/CD capabilities overview

## Tools & Utilities

### Build & Release
- [GitHub Manager Guide](GITHUB_MANAGER_GUIDE.md) - Git operations made easy (Windows)
- [GitHub Manager Summary](GITHUB_MANAGER_SUMMARY.md) - Quick reference
- [Installer Updates](INSTALLER_UPDATES.md) - Installer modernization summary
- [Cleanup Summary](CLEANUP_SUMMARY.md) - Project cleanup documentation

### Status & Progress
- [Project Status](PROJECT_STATUS.md) - Current project status
- [Import Fix Summary](IMPORT_FIX_SUMMARY.md) - Import functionality fixes
- [Review Screen Implementation Summary](REVIEW_SCREEN_IMPLEMENTATION_SUMMARY.md) - Review screen details
- [Windows Server Issues Summary](WINDOWS_SERVER_ISSUES_SUMMARY.md) - Windows-specific fixes

## Quick Links by Task

### I want to...

**Install Playlist Lab**
- Windows: [Windows Installer Guide](WINDOWS_INSTALLER_GUIDE.md)
- macOS: [macOS Installer Guide](MACOS_INSTALLER_GUIDE.md)
- Linux: [Linux Installer Guide](LINUX_INSTALLER_GUIDE.md)

**Set up development environment**
1. [Developer Guide](DEVELOPER_GUIDE.md)
2. [Monorepo Guide](MONOREPO_GUIDE.md)
3. [Project Structure](PROJECT_STRUCTURE.md)

**Deploy to production**
1. [Docker Setup](DOCKER_SETUP.md)
2. [Deployment Anywhere](DEPLOYMENT_ANYWHERE.md)
3. [Deployment Guide](../deployment/DEPLOYMENT_GUIDE.md)
4. [CI/CD Setup](CI_CD_SETUP.md)

**Use Git operations**
1. [GitHub Manager Guide](GITHUB_MANAGER_GUIDE.md)
2. [GitHub Manager Summary](GITHUB_MANAGER_SUMMARY.md)

**Build installers**
1. [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md)
2. [Installer Updates](INSTALLER_UPDATES.md)
3. [../scripts/README.md](../scripts/README.md)

**Understand the API**
1. [API Documentation](API.md)
2. [Postman Collection](Playlist-Lab-API.postman_collection.json)
3. [Plex API Reference](.kiro/steering/PLEX_API_COMPLETE_REFERENCE.md)

**Check mobile/web sync**
1. [Web vs Mobile Comparison](WEB_MOBILE_COMPARISON.md)
2. [GitHub Manager Guide](GITHUB_MANAGER_GUIDE.md) - Option 15

## Documentation Standards

As per project rules:
- All documentation files must be in the `docs/` folder
- Exception: `README.md` stays in the project root
- App-specific READMEs stay in their app folders (e.g., `apps/web/README.md`)
- Use clear, descriptive filenames in UPPERCASE_WITH_UNDERSCORES.md format
- Include a table of contents for documents longer than 100 lines
- Keep documentation up to date with code changes

## Contributing to Documentation

When adding new documentation:
1. Place it in the `docs/` folder
2. Use Markdown format (.md)
3. Add an entry to this INDEX.md file
4. Link to it from relevant documents
5. Update the main README.md if it's a major guide

---

**Last Updated**: February 28, 2026
