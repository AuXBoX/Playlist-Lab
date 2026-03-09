#!/bin/bash
# Windows Installer Build Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/release/windows"

# Read version from package.json
# Use Node.js to read the file with proper path handling
APP_VERSION=$(node -e "const fs = require('fs'); const path = require('path'); const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps', 'server', 'package.json'), 'utf8')); console.log(pkg.version);" 2>&1)

# Fallback: try reading from relative path if above fails
if [ -z "$APP_VERSION" ] || [ "$APP_VERSION" = "undefined" ]; then
    APP_VERSION=$(node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('./apps/server/package.json', 'utf8')); console.log(pkg.version);" 2>&1)
fi

# Final fallback: use default version
if [ -z "$APP_VERSION" ] || [ "$APP_VERSION" = "undefined" ]; then
    echo "Warning: Could not read version from package.json, using default"
    APP_VERSION="1.1.5"
fi

echo "Building version: $APP_VERSION"

NODE_VERSION="20.11.0"

mkdir -p "$BUILD_DIR"

# Download Node.js portable if not already present
NODEJS_DIR="$BUILD_DIR/nodejs"
if [ ! -d "$NODEJS_DIR" ]; then
    echo "Downloading Node.js $NODE_VERSION..."
    NODE_ZIP="node-v${NODE_VERSION}-win-x64.zip"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}"
    
    curl -L -o "$BUILD_DIR/$NODE_ZIP" "$NODE_URL"
    
    echo "Extracting Node.js..."
    unzip -q "$BUILD_DIR/$NODE_ZIP" -d "$BUILD_DIR"
    mv "$BUILD_DIR/node-v${NODE_VERSION}-win-x64" "$NODEJS_DIR"
    rm "$BUILD_DIR/$NODE_ZIP"
    
    echo "Node.js extracted to $NODEJS_DIR"
else
    echo "Node.js already present in $NODEJS_DIR"
fi

# Find Inno Setup
INNO_SETUP=""
if [ -f "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" ]; then
    INNO_SETUP="/c/Program Files (x86)/Inno Setup 6/ISCC.exe"
elif command -v iscc &> /dev/null; then
    INNO_SETUP="iscc"
else
    echo "Error: Inno Setup not found"
    exit 1
fi

echo "Running Inno Setup..."
# Convert paths to Windows format for Inno Setup
SETUP_ISS=$(cygpath -w "$SCRIPT_DIR/setup.iss" 2>/dev/null || echo "$SCRIPT_DIR/setup.iss")
WIN_BUILD_DIR=$(cygpath -w "$BUILD_DIR" 2>/dev/null || echo "$BUILD_DIR")
WIN_PROJECT_ROOT=$(cygpath -w "$PROJECT_ROOT" 2>/dev/null || echo "$PROJECT_ROOT")
"$INNO_SETUP" "$SETUP_ISS" /O"$WIN_BUILD_DIR" /DMyAppSourceDir="$WIN_PROJECT_ROOT" /DMyAppVersion="$APP_VERSION"

echo "Windows installer created in: $BUILD_DIR"
