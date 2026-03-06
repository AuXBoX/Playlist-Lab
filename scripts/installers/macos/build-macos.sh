#!/bin/bash
# macOS Installer Build Script for Playlist Lab Server
# Creates DMG and PKG installers for web-based server

set -e

echo "Building Playlist Lab Server for macOS..."

# Configuration
APP_NAME="Playlist Lab Server"
APP_VERSION="2.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/release/macos"
TEMP_DIR="$PROJECT_ROOT/scripts/temp/macos-build"
DMG_NAME="PlaylistLabServer-${APP_VERSION}.dmg"
PKG_NAME="PlaylistLabServer-${APP_VERSION}.pkg"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
rm -rf "$TEMP_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$TEMP_DIR"

# Step 1: Build the server
echo ""
echo "Step 1: Building server..."
cd "$PROJECT_ROOT/apps/server"
npm install
npm run build
echo "✓ Server built"

# Step 2: Build the web app
echo ""
echo "Step 2: Building web app..."
cd "$PROJECT_ROOT/apps/web"
npm install
npm run build
echo "✓ Web app built"

# Step 3: Install production dependencies
echo ""
echo "Step 3: Installing production dependencies..."
cd "$PROJECT_ROOT"
npm ci --production --ignore-scripts
echo "✓ Dependencies installed"

# Create application bundle structure
echo ""
echo "Creating application bundle..."
APP_BUNDLE="$TEMP_DIR/$APP_NAME.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy server files
echo "Copying server files..."
mkdir -p "$APP_BUNDLE/Contents/Resources/server"
cp -R "$PROJECT_ROOT/apps/server/dist" "$APP_BUNDLE/Contents/Resources/server/"
cp "$PROJECT_ROOT/apps/server/package.json" "$APP_BUNDLE/Contents/Resources/server/"
cp "$PROJECT_ROOT/apps/server/package-lock.json" "$APP_BUNDLE/Contents/Resources/server/" 2>/dev/null || true

# Copy web app files
echo "Copying web app files..."
mkdir -p "$APP_BUNDLE/Contents/Resources/web"
cp -R "$PROJECT_ROOT/apps/web/dist" "$APP_BUNDLE/Contents/Resources/web/"

# Copy shared package
echo "Copying shared package..."
mkdir -p "$APP_BUNDLE/Contents/Resources/packages/shared"
cp -R "$PROJECT_ROOT/packages/shared/dist" "$APP_BUNDLE/Contents/Resources/packages/shared/"
cp "$PROJECT_ROOT/packages/shared/package.json" "$APP_BUNDLE/Contents/Resources/packages/shared/"

# Copy node_modules (production only)
echo "Copying dependencies..."
cp -R "$PROJECT_ROOT/node_modules" "$APP_BUNDLE/Contents/Resources/"
cp -R "$PROJECT_ROOT/apps/server/node_modules" "$APP_BUNDLE/Contents/Resources/server/" 2>/dev/null || true

# Copy launcher script
cp "$SCRIPT_DIR/server-launcher.sh" "$APP_BUNDLE/Contents/Resources/"

# Copy cross-platform tray app
cp "$SCRIPT_DIR/../common/tray-app.js" "$APP_BUNDLE/Contents/Resources/"
cp "$SCRIPT_DIR/../common/package.json" "$APP_BUNDLE/Contents/Resources/"
chmod +x "$APP_BUNDLE/Contents/Resources/tray-app.js"

# Install tray dependencies
echo "Installing tray dependencies..."
cd "$APP_BUNDLE/Contents/Resources"
npm install --production 2>/dev/null || echo "Warning: tray npm install failed, will run headless"
cd "$PROJECT_ROOT"

# Copy tray app launcher
cp "$SCRIPT_DIR/start-tray-app.sh" "$APP_BUNDLE/Contents/Resources/"
chmod +x "$APP_BUNDLE/Contents/Resources/start-tray-app.sh"

# Create Info.plist
echo "Creating Info.plist..."
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>playlist-lab-server</string>
    <key>CFBundleIdentifier</key>
    <string>com.playlistlab.server</string>
    <key>CFBundleName</key>
    <string>Playlist Lab Server</string>
    <key>CFBundleVersion</key>
    <string>${APP_VERSION}</string>
    <key>CFBundleShortVersionString</key>
    <string>${APP_VERSION}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
EOF

# Create launcher script
echo "Creating launcher script..."
cat > "$APP_BUNDLE/Contents/MacOS/playlist-lab-server" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RESOURCES="$DIR/../Resources"
cd "$RESOURCES"

# Start server
bash server-launcher.sh &

# Wait a moment for server to start
sleep 2

# Open browser
open "http://localhost:3001"

# Keep app running
wait
EOF
chmod +x "$APP_BUNDLE/Contents/MacOS/playlist-lab-server"

# Copy documentation
echo "Copying documentation..."
cp "$PROJECT_ROOT/docs/SERVER_README.md" "$APP_BUNDLE/Contents/Resources/README.md"
mkdir -p "$APP_BUNDLE/Contents/Resources/docs"
cp "$PROJECT_ROOT/docs/MACOS_INSTALLER_GUIDE.md" "$APP_BUNDLE/Contents/Resources/docs/"
cp "$PROJECT_ROOT/docs/USER_GUIDE.md" "$APP_BUNDLE/Contents/Resources/docs/"

# Create DMG
echo ""
echo "Creating DMG..."
DMG_TEMP="$TEMP_DIR/dmg"
mkdir -p "$DMG_TEMP"
cp -R "$APP_BUNDLE" "$DMG_TEMP/"

# Create Applications symlink
ln -s /Applications "$DMG_TEMP/Applications"

# Create DMG image
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_TEMP" -ov -format UDZO "$BUILD_DIR/$DMG_NAME"

echo "✓ DMG created: $BUILD_DIR/$DMG_NAME"

# Create PKG (requires productbuild)
echo ""
echo "Creating PKG..."
PKG_ROOT="$TEMP_DIR/pkg-root"
mkdir -p "$PKG_ROOT/Applications"
cp -R "$APP_BUNDLE" "$PKG_ROOT/Applications/"

# Create component plist
pkgbuild --analyze --root "$PKG_ROOT" "$TEMP_DIR/components.plist"

# Build package
pkgbuild --root "$PKG_ROOT" \
         --component-plist "$TEMP_DIR/components.plist" \
         --identifier "com.playlistlab.server" \
         --version "$APP_VERSION" \
         --install-location "/" \
         "$BUILD_DIR/$PKG_NAME"

echo "✓ PKG created: $BUILD_DIR/$PKG_NAME"

# Clean up
echo ""
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "========================================="
echo "macOS installers built successfully!"
echo "========================================="
echo "DMG: $BUILD_DIR/$DMG_NAME"
echo "PKG: $BUILD_DIR/$PKG_NAME"
echo ""
echo "To install:"
echo "  1. Open the DMG file"
echo "  2. Drag 'Playlist Lab Server.app' to Applications"
echo "  3. Launch from Applications folder"
echo "  4. Server will start and open in your browser"
echo ""

