#!/bin/bash
# Production Build Script for Playlist Lab
# Builds all production artifacts: server, web client, and mobile apps

set -e  # Exit on error

echo "=========================================="
echo "Playlist Lab - Production Build"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
print_status "Node.js version: $(node -v)"
echo ""

# Clean previous builds
echo "Cleaning previous builds..."
npm run clean 2>/dev/null || true
print_status "Clean complete"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm ci
print_status "Dependencies installed"
echo ""

# Build shared package
echo "Building shared package..."
npm run build --workspace=packages/shared
print_status "Shared package built"
echo ""

# Build server
echo "Building server..."
npm run build --workspace=apps/server
print_status "Server built"
echo ""

# Build web client
echo "Building web client..."
npm run build --workspace=apps/web
print_status "Web client built"
echo ""

# Build mobile apps (if EAS CLI is available)
if command -v eas &> /dev/null; then
    echo "EAS CLI detected. Mobile builds can be triggered separately."
    print_warning "Run 'npm run build:mobile' to build mobile apps with EAS Build"
else
    print_warning "EAS CLI not found. Mobile builds skipped."
    print_warning "Install with: npm install -g eas-cli"
fi
echo ""

# Create build info
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_VERSION=$(node -p "require('./package.json').version")
BUILD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

cat > build-info.json << EOF
{
  "version": "$BUILD_VERSION",
  "buildDate": "$BUILD_DATE",
  "commit": "$BUILD_COMMIT",
  "nodeVersion": "$(node -v)",
  "npmVersion": "$(npm -v)"
}
EOF

print_status "Build info created: build-info.json"
echo ""

# Summary
echo "=========================================="
echo "Build Summary"
echo "=========================================="
echo "Version: $BUILD_VERSION"
echo "Commit: $BUILD_COMMIT"
echo "Build Date: $BUILD_DATE"
echo ""
print_status "Server: apps/server/dist/"
print_status "Web Client: apps/web/dist/"
echo ""
echo "=========================================="
echo "Production build complete!"
echo "=========================================="
