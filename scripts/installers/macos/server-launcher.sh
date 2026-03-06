#!/bin/bash
# Playlist Lab Server Launcher for macOS

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load port from tray config if available
CONFIG_FILE="$SCRIPT_DIR/tray-config.json"
ENV_FILE="$SCRIPT_DIR/server/.env"
PORT=3001

if [ -f "$CONFIG_FILE" ]; then
    # Extract port from JSON config
    PORT_FROM_CONFIG=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
    if [ ! -z "$PORT_FROM_CONFIG" ]; then
        PORT=$PORT_FROM_CONFIG
        echo "Using port from tray config: $PORT"
    fi
fi

# Check .env file
if [ -f "$ENV_FILE" ]; then
    PORT_FROM_ENV=$(grep "^PORT=" "$ENV_FILE" | cut -d '=' -f2)
    if [ ! -z "$PORT_FROM_ENV" ]; then
        PORT=$PORT_FROM_ENV
        echo "Using port from .env file: $PORT"
    fi
fi

# Set environment variables
export NODE_ENV=production
export PORT=$PORT
export LOG_DIR="$HOME/Library/Application Support/PlaylistLabServer/logs"
export DATA_DIR="$HOME/Library/Application Support/PlaylistLabServer"
export DB_PATH="$DATA_DIR/playlist-lab.db"
export WEB_APP_PATH="$SCRIPT_DIR/web/dist"

# Create directories
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"

# Log file
LOG_FILE="$LOG_DIR/server.log"

echo "=========================================" >> "$LOG_FILE"
echo "Playlist Lab Server Starting..." >> "$LOG_FILE"
echo "Time: $(date)" >> "$LOG_FILE"
echo "Port: $PORT" >> "$LOG_FILE"
echo "=========================================" >> "$LOG_FILE"

# Change to server directory
cd "$SCRIPT_DIR/server"

# Start the server
node dist/index.js >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID" >> "$LOG_FILE"
echo "Access the web interface at: http://localhost:$PORT" >> "$LOG_FILE"

# Save PID for later
echo $SERVER_PID > "$DATA_DIR/server.pid"

# Keep the script running
wait $SERVER_PID
