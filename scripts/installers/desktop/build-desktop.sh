#!/bin/bash

# Build script for Playlist Lab Desktop Application
# Builds standalone Electron app with embedded server

set -e

echo "========================================="
echo "Building Playlist Lab Desktop App"
echo "========================================="

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo "Step 1: Installing dependencies..."
cd apps/desktop
npm install

echo ""
echo "Step 2: Building desktop app..."
npm run build

echo ""
echo "Step 3: Packaging desktop app..."

# Detect platform
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "Building for Windows..."
    npm run package:win
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building for macOS..."
    npm run package:mac
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Building for Linux..."
    npm run package:linux
else
    echo "Unknown platform: $OSTYPE"
    echo "Building for current platform..."
    npm run package
fi

echo ""
echo "========================================="
echo "Desktop App Build Complete!"
echo "========================================="
echo ""
echo "Output location: $PROJECT_ROOT/release/"
echo ""

# List built files
if [ -d "$PROJECT_ROOT/release" ]; then
    echo "Built files:"
    ls -lh "$PROJECT_ROOT/release/"
fi

echo ""
echo "Done!"
