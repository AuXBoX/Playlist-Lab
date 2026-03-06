#!/bin/bash
# Unified Build Script for Playlist Lab Installers
# Builds Desktop App and Server installers for Windows, macOS, and Linux

set -e

echo "========================================="
echo "Playlist Lab - Build All Installers"
echo "========================================="
echo ""

# Configuration
APP_VERSION="2.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/release"
TEMP_DIR="$SCRIPT_DIR/temp"

# Parse arguments
BUILD_DESKTOP=true
BUILD_SERVER=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --desktop-only)
            BUILD_SERVER=false
            shift
            ;;
        --server-only)
            BUILD_DESKTOP=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--desktop-only|--server-only]"
            exit 1
            ;;
    esac
done

# Detect platform
PLATFORM="$(uname -s)"
case "$PLATFORM" in
    Linux*)     CURRENT_OS="linux";;
    Darwin*)    CURRENT_OS="macos";;
    CYGWIN*|MINGW*|MSYS*) CURRENT_OS="windows";;
    *)          CURRENT_OS="unknown";;
esac

echo "Current platform: $CURRENT_OS"
echo "Build directory: $BUILD_DIR"
echo ""

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
rm -rf "$TEMP_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$TEMP_DIR"

# Build Desktop App
if [ "$BUILD_DESKTOP" = true ]; then
    echo ""
    echo "========================================="
    echo "Building Desktop App"
    echo "========================================="
    bash "$SCRIPT_DIR/installers/desktop/build-desktop.sh"
fi

# Build Server Installer
if [ "$BUILD_SERVER" = true ]; then
    # Step 1: Build the server
    echo ""
    echo "========================================="
    echo "Building Server"
    echo "========================================="
    cd "$PROJECT_ROOT/apps/server"
    echo "Installing dependencies..."
    npm install
    echo "Building server..."
    npm run build
    echo "✓ Server built successfully"

    # Step 2: Build the web app
    echo ""
    echo "========================================="
    echo "Step 2: Building Web App"
    echo "========================================="
    cd "$PROJECT_ROOT/apps/web"
    echo "Installing dependencies..."
    npm install
    echo "Building web app..."
    npm run build
    echo "✓ Web app built successfully"

    # Step 3: Install production dependencies
    echo ""
    echo "========================================="
    echo "Step 3: Installing Production Dependencies"
    echo "========================================="
    cd "$PROJECT_ROOT"
    echo "Installing production dependencies..."
    npm ci --production --ignore-scripts
    echo "✓ Dependencies installed"

    # Step 4: Build Windows installer
    echo ""
    echo "========================================="
    echo "Step 4: Building Windows Installer"
    echo "========================================="
    if [ -f "$SCRIPT_DIR/installers/windows/build-windows.sh" ]; then
        bash "$SCRIPT_DIR/installers/windows/build-windows.sh"
        echo "✓ Windows installer built"
    else
        echo "⚠ Windows build script not found, skipping..."
    fi

    # Step 5: Build macOS installer
    echo ""
    echo "========================================="
    echo "Step 5: Building macOS Installer"
    echo "========================================="
    if [ "$CURRENT_OS" = "macos" ]; then
        if [ -f "$SCRIPT_DIR/installers/macos/build-macos.sh" ]; then
            bash "$SCRIPT_DIR/installers/macos/build-macos.sh"
            echo "✓ macOS installer built"
        else
            echo "⚠ macOS build script not found, skipping..."
        fi
    else
        echo "⚠ macOS installers can only be built on macOS, skipping..."
    fi

    # Step 6: Build Linux packages
    echo ""
    echo "========================================="
    echo "Step 6: Building Linux Packages"
    echo "========================================="
    if [ "$CURRENT_OS" = "linux" ]; then
        if [ -f "$SCRIPT_DIR/installers/linux/build-linux.sh" ]; then
            bash "$SCRIPT_DIR/installers/linux/build-linux.sh"
            echo "✓ Linux packages built"
        else
            echo "⚠ Linux build script not found, skipping..."
        fi
    else
        echo "⚠ Linux packages can only be built on Linux, skipping..."
    fi
fi  # End of BUILD_SERVER

# Step 7: Generate checksums
echo ""
echo "========================================="
echo "Step 7: Generating Checksums"
echo "========================================="
cd "$BUILD_DIR"
if command -v sha256sum &> /dev/null; then
    sha256sum * > checksums.txt 2>/dev/null || true
    echo "✓ Checksums generated"
elif command -v shasum &> /dev/null; then
    shasum -a 256 * > checksums.txt 2>/dev/null || true
    echo "✓ Checksums generated"
else
    echo "⚠ sha256sum/shasum not found, skipping checksums..."
fi

# Summary
echo ""
echo "========================================="
echo "Build Complete!"
echo "========================================="
echo ""
echo "Build artifacts:"
if [ "$BUILD_DESKTOP" = true ]; then
    echo ""
    echo "Desktop App:"
    ls -lh "$BUILD_DIR" 2>/dev/null || echo "  No desktop app artifacts found"
fi
if [ "$BUILD_SERVER" = true ]; then
    echo ""
    echo "Server Installer:"
    ls -lh "$BUILD_DIR" 2>/dev/null || echo "  No server artifacts found"
fi
echo ""

# Platform-specific notes
if [ "$CURRENT_OS" = "windows" ]; then
    echo "Note: To build macOS and Linux installers, run this script on those platforms."
elif [ "$CURRENT_OS" = "macos" ]; then
    echo "Note: To build Windows and Linux installers, run this script on those platforms."
elif [ "$CURRENT_OS" = "linux" ]; then
    echo "Note: To build Windows and macOS installers, run this script on those platforms."
fi

echo ""
echo "Done!"
