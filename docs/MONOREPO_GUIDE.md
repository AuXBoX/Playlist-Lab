# Playlist Lab - Monorepo Guide

## Overview

Playlist Lab uses a monorepo structure to manage multiple related applications and packages. This guide explains how to work with the monorepo effectively.

## Structure

```
playlist-lab/
├── apps/           # Applications
│   ├── mobile/     # React Native mobile app
│   ├── server/     # Express.js API server
│   └── web/        # React web application
├── packages/       # Shared packages
│   └── shared/     # Shared TypeScript code
└── tray-app/       # Electron tray application
```

## Package Management

### Root Dependencies

The root `package.json` contains:
- Shared development dependencies
- Build tools
- Testing frameworks
- Linting and formatting tools

### Application Dependencies

Each application (`apps/*` and `tray-app/`) has its own `package.json` with:
- Application-specific dependencies
- Build scripts
- Test scripts

### Shared Package

The `packages/shared` package contains:
- TypeScript types
- API client code
- Utility functions
- Shared between server, web, and mobile

## Development Workflow

### Initial Setup

```bash
# Install all dependencies
npm install

# Build shared package
cd packages/shared
npm run build
cd ../..
```

### Working on Applications

**Server:**
```bash
cd apps/server
npm run dev
```

**Web:**
```bash
cd apps/web
npm run dev
```

**Mobile:**
```bash
cd apps/mobile
npm start
```

**Tray App:**
```bash
cd tray-app
npm run dev
```

### Building for Production

```bash
# Build all applications
bash scripts/build-production.sh

# Or build individually
cd apps/server && npm run build
cd apps/web && npm run build
cd packages/shared && npm run build
cd tray-app && npm run build
```

## Dependency Management

### Adding Dependencies

**To a specific app:**
```bash
cd apps/server
npm install express
```

**To shared package:**
```bash
cd packages/shared
npm install lodash
```

**To root (dev dependencies):**
```bash
npm install -D typescript
```

### Updating Dependencies

```bash
# Update all dependencies
npm update

# Update specific app
cd apps/server
npm update
```

## Testing

### Run All Tests

```bash
# From root
npm test

# Or individually
cd apps/server && npm test
cd apps/web && npm test
cd apps/mobile && npm test
cd tray-app && npm test
```

### Run Specific Tests

```bash
cd apps/server
npm test -- --testPathPattern=auth
```

## Linting and Formatting

### Lint All Code

```bash
npm run lint
```

### Format All Code

```bash
npm run format
```

### Auto-fix Issues

```bash
npm run lint:fix
```

## TypeScript Configuration

### Base Configuration

`tsconfig.base.json` contains shared TypeScript settings used by all applications.

### Application Configurations

Each application extends the base configuration:
- `apps/server/tsconfig.json`
- `apps/web/tsconfig.json`
- `apps/mobile/tsconfig.json`
- `tray-app/tsconfig.json`

## Shared Package Usage

### In Server

```typescript
import { ApiClient } from '@playlist-lab/shared';
```

### In Web

```typescript
import { ApiClient } from '@playlist-lab/shared';
```

### In Mobile

```typescript
import { ApiClient } from '@playlist-lab/shared';
```

## Build System

### Development Builds

Development builds include:
- Source maps
- Hot module replacement
- Fast rebuild times

### Production Builds

Production builds include:
- Minification
- Tree shaking
- Optimized bundles
- No source maps

## Common Tasks

### Add a New Shared Type

1. Add to `packages/shared/src/types/index.ts`
2. Build shared package: `cd packages/shared && npm run build`
3. Use in applications

### Add a New API Endpoint

1. Add route in `apps/server/src/routes/`
2. Add service in `apps/server/src/services/`
3. Update API client in `packages/shared/src/api/`
4. Build shared package
5. Use in web/mobile apps

### Add a New Page

**Web:**
1. Create component in `apps/web/src/pages/`
2. Add route in `apps/web/src/main.tsx`

**Mobile:**
1. Create screen in `apps/mobile/src/screens/`
2. Add to navigator in `apps/mobile/src/navigation/`

## Troubleshooting

### Build Errors

```bash
# Clean all builds
rm -rf apps/*/dist packages/*/dist tray-app/dist

# Rebuild
npm run build
```

### Dependency Issues

```bash
# Clean all node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules tray-app/node_modules

# Reinstall
npm install
```

### TypeScript Errors

```bash
# Check TypeScript in all projects
npm run type-check
```

## Best Practices

1. **Always build shared package first** before working on applications
2. **Use workspace protocol** for internal dependencies
3. **Keep dependencies up to date** regularly
4. **Run tests before committing** code
5. **Use consistent code style** across all packages
6. **Document breaking changes** in shared package

## CI/CD

The monorepo uses GitHub Actions for:
- Running tests on all packages
- Building all applications
- Linting and type checking
- Deploying to staging/production

See `.github/workflows/ci.yml` for details.

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Monorepo Best Practices](https://monorepo.tools/)
