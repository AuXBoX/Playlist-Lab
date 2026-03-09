#!/bin/bash
# Linux Package Build Script for Playlist Lab Server
# Creates DEB and RPM packages for web-based server

set -e

echo "Building Playlist Lab Server for Linux..."

# Configuration
APP_NAME="playlist-lab-server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Read version from package.json
APP_VERSION=$(node -p "require('$PROJECT_ROOT/apps/server/package.json').version")

BUILD_DIR="$PROJECT_ROOT/release/linux"
TEMP_DIR="/tmp/linux-build"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
rm -rf "$TEMP_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$TEMP_DIR"

# Create DEB package structure
echo ""
echo "Creating DEB package structure..."
DEB_ROOT="$TEMP_DIR/deb"
mkdir -p "$DEB_ROOT/DEBIAN"
mkdir -p "$DEB_ROOT/opt/$APP_NAME"
mkdir -p "$DEB_ROOT/usr/share/applications"
mkdir -p "$DEB_ROOT/usr/bin"
mkdir -p "$DEB_ROOT/etc/systemd/system"

# Copy server files
echo "Copying server files..."
mkdir -p "$DEB_ROOT/opt/$APP_NAME/server"
cp -R "$PROJECT_ROOT/apps/server/dist" "$DEB_ROOT/opt/$APP_NAME/server/"
cp "$PROJECT_ROOT/apps/server/package.json" "$DEB_ROOT/opt/$APP_NAME/server/"

# Copy web app files
echo "Copying web app files..."
mkdir -p "$DEB_ROOT/opt/$APP_NAME/web"
cp -R "$PROJECT_ROOT/apps/web/dist" "$DEB_ROOT/opt/$APP_NAME/web/"

# Copy shared package
echo "Copying shared package..."
mkdir -p "$DEB_ROOT/opt/$APP_NAME/packages/shared"
cp -R "$PROJECT_ROOT/packages/shared/dist" "$DEB_ROOT/opt/$APP_NAME/packages/shared/"
cp "$PROJECT_ROOT/packages/shared/package.json" "$DEB_ROOT/opt/$APP_NAME/packages/shared/"

# Copy server node_modules (exclude non-x64 prebuilds to avoid RPM strip errors)
echo "Copying dependencies..."
if [ -d "$PROJECT_ROOT/apps/server/node_modules" ]; then
    rsync -a --exclude='*/prebuilds/linux-arm*' --exclude='*/prebuilds/darwin-*' --exclude='*/prebuilds/win32-*' \
          "$PROJECT_ROOT/apps/server/node_modules/" "$DEB_ROOT/opt/$APP_NAME/server/node_modules/" 2>/dev/null || \
    cp -R "$PROJECT_ROOT/apps/server/node_modules" "$DEB_ROOT/opt/$APP_NAME/server/" 2>/dev/null || true
fi

# Copy launcher script
cp "$SCRIPT_DIR/server-launcher.sh" "$DEB_ROOT/opt/$APP_NAME/"
chmod +x "$DEB_ROOT/opt/$APP_NAME/server-launcher.sh"

# Copy tray app
cp "$SCRIPT_DIR/../common/tray-app.js" "$DEB_ROOT/opt/$APP_NAME/"
cp "$SCRIPT_DIR/../common/package.json" "$DEB_ROOT/opt/$APP_NAME/"
chmod +x "$DEB_ROOT/opt/$APP_NAME/tray-app.js"

# Install tray app dependencies
echo "Installing tray app dependencies..."
cd "$DEB_ROOT/opt/$APP_NAME"
npm install --production --no-optional 2>/dev/null || true
cd "$PROJECT_ROOT"

cp "$SCRIPT_DIR/start-tray-app.sh" "$DEB_ROOT/opt/$APP_NAME/"
chmod +x "$DEB_ROOT/opt/$APP_NAME/start-tray-app.sh"

# Create symlink in /usr/bin
cat > "$DEB_ROOT/usr/bin/$APP_NAME" << 'EOF'
#!/bin/bash
cd /opt/playlist-lab-server
bash server-launcher.sh
EOF
chmod +x "$DEB_ROOT/usr/bin/$APP_NAME"

# Create desktop entry
cat > "$DEB_ROOT/usr/share/applications/$APP_NAME.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Playlist Lab Server
Comment=Music playlist management server
Exec=xdg-open http://localhost:3001
Terminal=false
Categories=AudioVideo;Audio;Network;
EOF

# Create systemd service
cat > "$DEB_ROOT/etc/systemd/system/$APP_NAME.service" << EOF
[Unit]
Description=Playlist Lab Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/$APP_NAME
ExecStart=/usr/bin/node /opt/$APP_NAME/server/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# Create control file
cat > "$DEB_ROOT/DEBIAN/control" << EOF
Package: $APP_NAME
Version: $APP_VERSION
Section: sound
Priority: optional
Architecture: amd64
Depends: nodejs (>= 18.0.0)
Maintainer: Playlist Lab <audexa@users.noreply.github.com>
Description: Music playlist management server
 Playlist Lab Server is a multi-user web-based music playlist
 management system with Plex Media Server integration.
EOF

# Create postinst script
cat > "$DEB_ROOT/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e
systemctl daemon-reload
systemctl enable playlist-lab-server.service
systemctl start playlist-lab-server.service
echo "Playlist Lab Server installed. Access at: http://localhost:3001"
exit 0
EOF
chmod +x "$DEB_ROOT/DEBIAN/postinst"

# Create prerm script
cat > "$DEB_ROOT/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e
systemctl stop playlist-lab-server.service || true
systemctl disable playlist-lab-server.service || true
exit 0
EOF
chmod +x "$DEB_ROOT/DEBIAN/prerm"

# Build DEB package
echo ""
echo "Building DEB package..."
dpkg-deb --build "$DEB_ROOT" "$BUILD_DIR/${APP_NAME}_${APP_VERSION}_amd64.deb"
echo "✓ DEB package created"

# Build RPM if available
if command -v rpmbuild &> /dev/null; then
    echo "Building RPM package..."
    RPM_ROOT="$TEMP_DIR/rpm"
    mkdir -p "$RPM_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

    cat > "$RPM_ROOT/SPECS/$APP_NAME.spec" << EOF
%define __strip /bin/true
%define _build_id_links none

Name:           $APP_NAME
Version:        $APP_VERSION
Release:        1%{?dist}
Summary:        Music playlist management server
License:        MIT
Requires:       nodejs >= 18.0.0

%description
Playlist Lab Server - multi-user web-based music playlist management.

%install
mkdir -p %{buildroot}/opt/$APP_NAME
cp -R $DEB_ROOT/opt/$APP_NAME/* %{buildroot}/opt/$APP_NAME/

%files
/opt/$APP_NAME

%post
systemctl daemon-reload
systemctl enable $APP_NAME.service || true

%changelog
* $(date "+%a %b %d %Y") Playlist Lab - $APP_VERSION-1
- Release
EOF

    rpmbuild --define "_topdir $RPM_ROOT" -bb "$RPM_ROOT/SPECS/$APP_NAME.spec"
    cp "$RPM_ROOT/RPMS/x86_64/"*.rpm "$BUILD_DIR/" 2>/dev/null || true
    echo "✓ RPM package created"
fi

rm -rf "$TEMP_DIR"

echo ""
echo "Linux packages built: $BUILD_DIR"
ls -lh "$BUILD_DIR"
