#!/bin/bash
# Linux Package Build Script for Playlist Lab Server
# Creates DEB and RPM packages for web-based server

set -e

echo "Building Playlist Lab Server for Linux..."

# Configuration
APP_NAME="playlist-lab-server"
APP_VERSION="2.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/release/linux"
TEMP_DIR="$PROJECT_ROOT/scripts/temp/linux-build"

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
cp "$PROJECT_ROOT/apps/server/package-lock.json" "$DEB_ROOT/opt/$APP_NAME/server/" 2>/dev/null || true

# Copy web app files
echo "Copying web app files..."
mkdir -p "$DEB_ROOT/opt/$APP_NAME/web"
cp -R "$PROJECT_ROOT/apps/web/dist" "$DEB_ROOT/opt/$APP_NAME/web/"

# Copy shared package
echo "Copying shared package..."
mkdir -p "$DEB_ROOT/opt/$APP_NAME/packages/shared"
cp -R "$PROJECT_ROOT/packages/shared/dist" "$DEB_ROOT/opt/$APP_NAME/packages/shared/"
cp "$PROJECT_ROOT/packages/shared/package.json" "$DEB_ROOT/opt/$APP_NAME/packages/shared/"

# Copy dependencies
echo "Copying dependencies..."
cp -R "$PROJECT_ROOT/node_modules" "$DEB_ROOT/opt/$APP_NAME/"
cp -R "$PROJECT_ROOT/apps/server/node_modules" "$DEB_ROOT/opt/$APP_NAME/server/" 2>/dev/null || true

# Copy launcher script
cp "$SCRIPT_DIR/server-launcher.sh" "$DEB_ROOT/opt/$APP_NAME/"
chmod +x "$DEB_ROOT/opt/$APP_NAME/server-launcher.sh"

# Copy cross-platform tray app
cp "$SCRIPT_DIR/../common/tray-app.js" "$DEB_ROOT/opt/$APP_NAME/"
cp "$SCRIPT_DIR/../common/package.json" "$DEB_ROOT/opt/$APP_NAME/"
chmod +x "$DEB_ROOT/opt/$APP_NAME/tray-app.js"

# Install tray dependencies
echo "Installing tray dependencies..."
cd "$DEB_ROOT/opt/$APP_NAME"
npm install --production 2>/dev/null || echo "Warning: tray npm install failed, will run headless"
cd "$PROJECT_ROOT"

# Copy tray app launcher
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

# Create tray app desktop entry
cat > "$DEB_ROOT/usr/share/applications/$APP_NAME-tray.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Playlist Lab Tray
Comment=Playlist Lab Server system tray application
Exec=/opt/$APP_NAME/start-tray-app.sh
Terminal=false
Categories=AudioVideo;Audio;Network;
StartupNotify=false
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
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME
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
 .
 Features:
  - Multi-source playlist import (Spotify, Apple Music, YouTube)
  - Smart playlist generation
  - Plex integration
  - Multi-user support
  - Scheduling
EOF

# Create postinst script
cat > "$DEB_ROOT/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable playlist-lab-server.service
systemctl start playlist-lab-server.service

echo ""
echo "Playlist Lab Server installed successfully!"
echo ""
echo "The server is now running at: http://localhost:3001"
echo ""
echo "To manage the service:"
echo "  Start:   sudo systemctl start playlist-lab-server"
echo "  Stop:    sudo systemctl stop playlist-lab-server"
echo "  Restart: sudo systemctl restart playlist-lab-server"
echo "  Status:  sudo systemctl status playlist-lab-server"
echo ""

exit 0
EOF
chmod +x "$DEB_ROOT/DEBIAN/postinst"

# Create prerm script
cat > "$DEB_ROOT/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e

# Stop and disable service
systemctl stop playlist-lab-server.service || true
systemctl disable playlist-lab-server.service || true

exit 0
EOF
chmod +x "$DEB_ROOT/DEBIAN/prerm"

# Build DEB package
echo ""
echo "Building DEB package..."
dpkg-deb --build "$DEB_ROOT" "$BUILD_DIR/${APP_NAME}_${APP_VERSION}_amd64.deb"
echo "✓ DEB package created: $BUILD_DIR/${APP_NAME}_${APP_VERSION}_amd64.deb"

# Build RPM package (if rpmbuild is available)
if command -v rpmbuild &> /dev/null; then
    echo ""
    echo "Building RPM package..."
    
    RPM_ROOT="$TEMP_DIR/rpm"
    mkdir -p "$RPM_ROOT/BUILD"
    mkdir -p "$RPM_ROOT/RPMS"
    mkdir -p "$RPM_ROOT/SOURCES"
    mkdir -p "$RPM_ROOT/SPECS"
    mkdir -p "$RPM_ROOT/SRPMS"
    
    # Create spec file
    cat > "$RPM_ROOT/SPECS/$APP_NAME.spec" << EOF
Name:           $APP_NAME
Version:        $APP_VERSION
Release:        1%{?dist}
Summary:        Music playlist management server
License:        MIT
URL:            https://github.com/yourusername/playlist-lab
Requires:       nodejs >= 18.0.0

%description
Playlist Lab Server is a multi-user web-based music playlist
management system with Plex Media Server integration.

%install
mkdir -p %{buildroot}/opt/$APP_NAME
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/etc/systemd/system

cp -R $DEB_ROOT/opt/$APP_NAME/* %{buildroot}/opt/$APP_NAME/
cp $DEB_ROOT/usr/bin/$APP_NAME %{buildroot}/usr/bin/
cp $DEB_ROOT/usr/share/applications/$APP_NAME.desktop %{buildroot}/usr/share/applications/
cp $DEB_ROOT/etc/systemd/system/$APP_NAME.service %{buildroot}/etc/systemd/system/

%files
/opt/$APP_NAME
/usr/bin/$APP_NAME
/usr/share/applications/$APP_NAME.desktop
/etc/systemd/system/$APP_NAME.service

%post
systemctl daemon-reload
systemctl enable $APP_NAME.service
systemctl start $APP_NAME.service

%preun
systemctl stop $APP_NAME.service || true
systemctl disable $APP_NAME.service || true

%changelog
* $(date "+%a %b %d %Y") Playlist Lab <audexa@users.noreply.github.com> - $APP_VERSION-1
- Initial release
EOF
    
    rpmbuild --define "_topdir $RPM_ROOT" -bb "$RPM_ROOT/SPECS/$APP_NAME.spec"
    cp "$RPM_ROOT/RPMS/x86_64/${APP_NAME}-${APP_VERSION}-1."*.rpm "$BUILD_DIR/" 2>/dev/null || true
    echo "✓ RPM package created"
else
    echo ""
    echo "⚠ rpmbuild not found, skipping RPM package creation"
    echo "  Install: sudo apt install rpm (Debian/Ubuntu)"
    echo "           sudo yum install rpm-build (RHEL/CentOS)"
fi

# Clean up
echo ""
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "========================================="
echo "Linux packages built successfully!"
echo "========================================="
echo ""
ls -lh "$BUILD_DIR"
echo ""
echo "To install:"
echo "  DEB: sudo dpkg -i $BUILD_DIR/${APP_NAME}_${APP_VERSION}_amd64.deb"
echo "  RPM: sudo rpm -i $BUILD_DIR/${APP_NAME}-${APP_VERSION}-1.*.rpm"
echo ""

