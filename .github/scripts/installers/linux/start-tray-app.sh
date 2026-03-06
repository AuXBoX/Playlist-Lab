#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export INSTALL_DIR="$SCRIPT_DIR"
node "$SCRIPT_DIR/tray-app.js"
