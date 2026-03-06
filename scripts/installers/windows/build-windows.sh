#!/bin/bash
# Windows Installer Build Script
# Creates Windows installer using Inno Setup

set -e

echo "Building Windows installer..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/scripts/release"
APP_VERSION="2.0.0"

# Check if Inno Setup is available
INNO_SETUP=""
if [ -f "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" ]; then
    INNO_SETUP="/c/Program Files (x86)/Inno Setup 6/ISCC.exe"
elif [ -f "/c/Program Files/Inno Setup 6/ISCC.exe" ]; then
    INNO_SETUP="/c/Program Files/Inno Setup 6/ISCC.exe"
elif command -v iscc &> /dev/null; then
    INNO_SETUP="iscc"
else
    echo "Error: Inno Setup not found!"
    echo "Please install Inno Setup from: https://jrsoftware.org/isdl.php"
    exit 1
fi

# Copy setup script to temp location with updated paths
TEMP_SETUP="$PROJECT_ROOT/scripts/temp/setup-temp.iss"
cp "$SCRIPT_DIR/setup.iss" "$TEMP_SETUP"

# Update paths in setup script to be relative to project root
sed -i "s|OutputDir=.*|OutputDir=$BUILD_DIR|g" "$TEMP_SETUP"

# Build the installer
echo "Running Inno Setup..."
"$INNO_SETUP" "$TEMP_SETUP"

# Clean up
rm "$TEMP_SETUP"

echo "Windows installer created: $BUILD_DIR/PlaylistLabServer-Setup-${APP_VERSION}.exe"
