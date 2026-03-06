#!/bin/bash
# Windows Installer Build Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/release/windows"
APP_VERSION="2.0.0"

mkdir -p "$BUILD_DIR"

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
"$INNO_SETUP" "$SCRIPT_DIR/setup.iss" "/O$BUILD_DIR"

echo "Windows installer created in: $BUILD_DIR"
