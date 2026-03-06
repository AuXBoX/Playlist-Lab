# Cache Folder - DO NOT DELETE

This folder contains cached downloads for building installers.

## Contents

- `node-v20.11.0-win-x64/` - Cached Node.js portable runtime

## Purpose

This folder caches the Node.js portable runtime so it doesn't need to be downloaded every time you build the Windows installer. The build process copies files from here to `scripts/temp/` when building.

## Important

**DO NOT DELETE THIS FOLDER**

If you delete this folder, you'll need to re-download Node.js portable, which is ~50MB and takes time.

## Gitignore

This folder is gitignored to keep the repository size small. The Node.js files will be downloaded automatically when needed during the build process.
