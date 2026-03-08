#!/bin/bash
# Playlist Lab Server Launcher for Linux

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3001
ENV_FILE="$SCRIPT_DIR/server/.env"

if [ -f "$ENV_FILE" ]; then
    PORT_FROM_ENV=$(grep "^PORT=" "$ENV_FILE" | cut -d '=' -f2)
    [ -n "$PORT_FROM_ENV" ] && PORT=$PORT_FROM_ENV
fi

export NODE_ENV=production
export PORT=$PORT
export DATA_DIR="$HOME/.local/share/Playlist Lab"
export DB_PATH="$DATA_DIR/data/playlist-lab.db"
export WEB_APP_PATH="$SCRIPT_DIR/web/dist"

mkdir -p "$DATA_DIR/data"
mkdir -p "$DATA_DIR/logs"

cd "$SCRIPT_DIR/server"
node dist/index.js >> "$DATA_DIR/logs/server.log" 2>&1
