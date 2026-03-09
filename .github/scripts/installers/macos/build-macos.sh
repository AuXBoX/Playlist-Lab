#!/bin/bash
# macOS Installer Build Script for Playlist Lab Server

set -e

echo "Building Playlist Lab Server for macOS..."

APP_NAME="Playlist Lab Server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Read version from package.json
# Use Node.js to read the file with proper path handling
APP_VERSION=$(node -e "const fs = require('fs'); const path = require('path'); const pkg = JSON.parse(fs.readFileSync(path.join('$PROJECT_ROOT', 'apps', 'server', 'package.json'), 'utf8')); console.log(pkg.version);")

BUILD_DIR="$PROJECT_ROOT/release/macos"
TEMP_DIR="/tmp/macos-build"
DMG_NAME="PlaylistLabServer-${APP_VERSION}.dmg"
PKG_NAME="PlaylistLabServer-${APP_VERSION}.pkg"

rm -rf "$BUILD_DIR" "$TEMP_DIR"
mkdir -p "$BUILD_DIR" "$TEMP_DIR"

# Create app bundle
APP_BUNDLE="$TEMP_DIR/$APP_NAME.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy server files
mkdir -p "$APP_BUNDLE/Contents/Resources/server"
cp -R "$PROJECT_ROOT/apps/server/dist" "$APP_BUNDLE/Contents/Resources/server/"
cp "$PROJECT_ROOT/apps/server/package.json" "$APP_BUNDLE/Contents/Resources/server/"
cp -R "$PROJECT_ROOT/apps/server/node_modules" "$APP_BUNDLE/Contents/Resources/server/" 2>/dev/null || true

# Copy web app
mkdir -p "$APP_BUNDLE/Contents/Resources/web"
cp -R "$PROJECT_ROOT/apps/web/dist" "$APP_BUNDLE/Contents/Resources/web/"

# Copy shared package
mkdir -p "$APP_BUNDLE/Contents/Resources/packages/shared"
cp -R "$PROJECT_ROOT/packages/shared/dist" "$APP_BUNDLE/Contents/Resources/packages/shared/"
cp "$PROJECT_ROOT/packages/shared/package.json" "$APP_BUNDLE/Contents/Resources/packages/shared/"

# Copy scripts
cp "$SCRIPT_DIR/server-launcher.sh" "$APP_BUNDLE/Contents/Resources/"
cp "$SCRIPT_DIR/../common/tray-app.js" "$APP_BUNDLE/Contents/Resources/"
cp "$SCRIPT_DIR/../common/package.json" "$APP_BUNDLE/Contents/Resources/"
cp "$SCRIPT_DIR/start-tray-app.sh" "$APP_BUNDLE/Contents/Resources/"
chmod +x "$APP_BUNDLE/Contents/Resources/"*.sh "$APP_BUNDLE/Contents/Resources/tray-app.js"

# Install tray app dependencies
echo "Installing tray app dependencies..."
cd "$APP_BUNDLE/Contents/Resources"
npm install --production --no-optional 2>/dev/null || true
cd "$PROJECT_ROOT"

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>playlist-lab-server</string>
    <key>CFBundleIdentifier</key><string>com.playlistlab.server</string>
    <key>CFBundleName</key><string>Playlist Lab Server</string>
    <key>CFBundleVersion</key><string>${APP_VERSION}</string>
    <key>CFBundleShortVersionString</key><string>${APP_VERSION}</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>10.15</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
EOF

# Launcher
cat > "$APP_BUNDLE/Contents/MacOS/playlist-lab-server" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RESOURCES="$DIR/../Resources"
cd "$RESOURCES"
bash server-launcher.sh &
sleep 2
open "http://localhost:3001"
wait
EOF
chmod +x "$APP_BUNDLE/Contents/MacOS/playlist-lab-server"

# Create DMG
DMG_TEMP="$TEMP_DIR/dmg"
mkdir -p "$DMG_TEMP"
cp -R "$APP_BUNDLE" "$DMG_TEMP/"
ln -s /Applications "$DMG_TEMP/Applications"

# Unmount any existing volumes with the same name
hdiutil detach "/Volumes/$APP_NAME" 2>/dev/null || true

# Remove any existing DMG file
rm -f "$BUILD_DIR/$DMG_NAME"

# Create DMG with retry logic
for i in {1..3}; do
    if hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_TEMP" -ov -format UDZO "$BUILD_DIR/$DMG_NAME" 2>/dev/null; then
        echo "✓ DMG created: $BUILD_DIR/$DMG_NAME"
        break
    else
        if [ $i -eq 3 ]; then
            echo "Failed to create DMG after 3 attempts"
            exit 1
        fi
        echo "Retrying DMG creation (attempt $((i+1))/3)..."
        sleep 2
    fi
done

# Create PKG
PKG_ROOT="$TEMP_DIR/pkg-root"
mkdir -p "$PKG_ROOT/Applications"
cp -R "$APP_BUNDLE" "$PKG_ROOT/Applications/"
pkgbuild --analyze --root "$PKG_ROOT" "$TEMP_DIR/components.plist"
pkgbuild --root "$PKG_ROOT" \
         --component-plist "$TEMP_DIR/components.plist" \
         --identifier "com.playlistlab.server" \
         --version "$APP_VERSION" \
         --install-location "/" \
         "$BUILD_DIR/$PKG_NAME"
echo "✓ PKG created: $BUILD_DIR/$PKG_NAME"

rm -rf "$TEMP_DIR"
echo "macOS installers built: $BUILD_DIR"
