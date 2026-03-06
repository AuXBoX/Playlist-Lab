#!/bin/bash
# Start Playlist Lab Server Tray App for Linux

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set INSTALL_DIR environment variable
export INSTALL_DIR="$SCRIPT_DIR"

# Start the tray app
node "$SCRIPT_DIR/tray-app.js"
