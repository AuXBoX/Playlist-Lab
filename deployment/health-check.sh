#!/bin/bash
# Health Check Script for Playlist Lab
# Can be used with monitoring tools or cron jobs

set -e

# Configuration
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
TIMEOUT="${TIMEOUT:-5}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-2}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check health
check_health() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo "Attempt $attempt of $MAX_RETRIES..."
        
        # Make request
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "000")
        
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✓ Health check passed${NC}"
            echo "Status: Healthy"
            echo "URL: $HEALTH_URL"
            echo "Response code: $response"
            return 0
        else
            echo -e "${YELLOW}⚠ Health check failed (attempt $attempt)${NC}"
            echo "Response code: $response"
            
            if [ $attempt -lt $MAX_RETRIES ]; then
                echo "Retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ Health check failed after $MAX_RETRIES attempts${NC}"
    echo "Status: Unhealthy"
    echo "URL: $HEALTH_URL"
    return 1
}

# Function to get detailed status
get_status() {
    echo "Checking server status..."
    echo ""
    
    # Check if process is running
    if command -v docker &> /dev/null; then
        echo "Docker containers:"
        docker ps --filter "name=playlist-lab" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
    fi
    
    if command -v pm2 &> /dev/null; then
        echo "PM2 processes:"
        pm2 list | grep playlist-lab || echo "No PM2 processes found"
        echo ""
    fi
    
    if command -v systemctl &> /dev/null; then
        echo "Systemd service:"
        systemctl status playlist-lab --no-pager -l || echo "Service not found"
        echo ""
    fi
    
    # Check port
    echo "Port status:"
    if command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep :3000 || echo "Port 3000 not listening"
    elif command -v ss &> /dev/null; then
        ss -tlnp | grep :3000 || echo "Port 3000 not listening"
    fi
    echo ""
}

# Main
case "${1:-check}" in
    check)
        check_health
        exit $?
        ;;
    status)
        get_status
        check_health
        exit $?
        ;;
    *)
        echo "Usage: $0 {check|status}"
        echo ""
        echo "Commands:"
        echo "  check   - Perform health check only"
        echo "  status  - Show detailed status and perform health check"
        echo ""
        echo "Environment variables:"
        echo "  HEALTH_URL     - Health check URL (default: http://localhost:3000/api/health)"
        echo "  TIMEOUT        - Request timeout in seconds (default: 5)"
        echo "  MAX_RETRIES    - Maximum retry attempts (default: 3)"
        echo "  RETRY_DELAY    - Delay between retries in seconds (default: 2)"
        exit 1
        ;;
esac
