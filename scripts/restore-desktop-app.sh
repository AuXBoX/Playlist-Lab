#!/bin/bash

# Script to restore desktop app files from v1.1.1 tag

set -e

echo "Restoring desktop app files from v1.1.1..."

# Create directory structure
mkdir -p apps/desktop/src/main
mkdir -p apps/desktop/src/renderer

# Extract files from git tag
echo "Extracting source files..."
git show v1.1.1:src/main/main.ts > apps/desktop/src/main/main.ts
git show v1.1.1:src/main/preload.ts > apps/desktop/src/main/preload.ts
git show v1.1.1:src/renderer/App.tsx > apps/desktop/src/renderer/App.tsx
git show v1.1.1:src/renderer/BackupRestorePage.tsx > apps/desktop/src/renderer/BackupRestorePage.tsx
git show v1.1.1:src/renderer/ImportPage.tsx > apps/desktop/src/renderer/ImportPage.tsx
git show v1.1.1:src/renderer/MissingTracksPage.tsx > apps/desktop/src/renderer/MissingTracksPage.tsx
git show v1.1.1:src/renderer/SharingPage.tsx > apps/desktop/src/renderer/SharingPage.tsx
git show v1.1.1:src/renderer/discovery.ts > apps/desktop/src/renderer/discovery.ts
git show v1.1.1:src/renderer/index.html > apps/desktop/src/renderer/index.html
git show v1.1.1:src/renderer/main.tsx > apps/desktop/src/renderer/main.tsx
git show v1.1.1:src/renderer/styles.css > apps/desktop/src/renderer/styles.css
git show v1.1.1:src/renderer/vite-env.d.ts > apps/desktop/src/renderer/vite-env.d.ts

# Extract assets
echo "Extracting assets..."
mkdir -p apps/desktop/src/renderer
git show v1.1.1:src/renderer/logo.ico > apps/desktop/src/renderer/logo.ico
git show v1.1.1:src/renderer/logo.png > apps/desktop/src/renderer/logo.png
git show v1.1.1:src/renderer/logo512.png > apps/desktop/src/renderer/logo512.png

# Extract config files
echo "Extracting config files..."
git show v1.1.1:package.json > apps/desktop/package.json
git show v1.1.1:tsconfig.main.json > apps/desktop/tsconfig.main.json
git show v1.1.1:vite.config.ts > apps/desktop/vite.config.ts

echo ""
echo "Desktop app files restored successfully!"
echo "Location: apps/desktop/"
