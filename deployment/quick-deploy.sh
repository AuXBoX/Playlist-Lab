#!/bin/bash
# Quick Deployment Script for Playlist Lab
# This script automates the deployment process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/playlist-lab}"
DATA_DIR="${DATA_DIR:-/var/lib/playlist-lab}"
LOG_DIR="${LOG_DIR:-/var/log/playlist-lab}"
BACKUP_DIR="${BACKUP_DIR:-$INSTALL_DIR/backups}"
WEB_DIR="${WEB_DIR:-/var/www/playlist-lab/web}"
APP_USER="${APP_USER:-playlist-lab}"
DOMAIN="${DOMAIN:-localhost}"
DEPLOYMENT_METHOD="${DEPLOYMENT_METHOD:-docker}"

# Functions
print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

print_header "Playlist Lab - Quick Deployment"

# Step 1: Check prerequisites
print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_status "Node.js $(node -v) installed"
    else
        print_error "Node.js 18+ required. Current: $(node -v)"
        exit 1
    fi
else
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check deployment method
if [ "$DEPLOYMENT_METHOD" = "docker" ]; then
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Install Docker or use DEPLOYMENT_METHOD=pm2"
        exit 1
    fi
    print_status "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') installed"
fi

# Step 2: Create directories
print_header "Step 2: Creating Directories"

mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$WEB_DIR"

print_status "Directories created"

# Step 3: Create application user
print_header "Step 3: Creating Application User"

if id "$APP_USER" &>/dev/null; then
    print_warning "User $APP_USER already exists"
else
    useradd -r -m -s /bin/bash "$APP_USER"
    if [ "$DEPLOYMENT_METHOD" = "docker" ]; then
        usermod -aG docker "$APP_USER"
    fi
    print_status "User $APP_USER created"
fi

# Step 4: Set permissions
print_header "Step 4: Setting Permissions"

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$BACKUP_DIR"

print_status "Permissions set"

# Step 5: Copy application files
print_header "Step 5: Copying Application Files"

if [ ! -d "apps/server" ]; then
    print_error "Application files not found. Run this script from the project root."
    exit 1
fi

cp -r . "$INSTALL_DIR/"
print_status "Application files copied"

# Step 6: Install dependencies and build
print_header "Step 6: Building Application"

cd "$INSTALL_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build:prod

print_status "Application built"

# Step 7: Initialize database
print_header "Step 7: Initializing Database"

export DATABASE_PATH="$DATA_DIR/playlist-lab.db"
sudo -u "$APP_USER" npm run db:init

print_status "Database initialized"

# Step 8: Configure environment
print_header "Step 8: Configuring Environment"

if [ ! -f "$INSTALL_DIR/.env.production" ]; then
    cp "$INSTALL_DIR/.env.production.example" "$INSTALL_DIR/.env.production"
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" "$INSTALL_DIR/.env.production"
    sed -i "s|DATABASE_PATH=.*|DATABASE_PATH=$DATA_DIR/playlist-lab.db|" "$INSTALL_DIR/.env.production"
    sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN|" "$INSTALL_DIR/.env.production"
    
    print_status "Environment configured"
    print_warning "Review and update $INSTALL_DIR/.env.production"
else
    print_warning "Environment file already exists"
fi

# Step 9: Deploy application
print_header "Step 9: Deploying Application"

if [ "$DEPLOYMENT_METHOD" = "docker" ]; then
    # Docker deployment
    cd "$INSTALL_DIR"
    docker-compose up -d
    print_status "Application deployed with Docker"
    
elif [ "$DEPLOYMENT_METHOD" = "pm2" ]; then
    # PM2 deployment
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    sudo -u "$APP_USER" pm2 start "$INSTALL_DIR/deployment/ecosystem.config.js"
    sudo -u "$APP_USER" pm2 save
    pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER"
    
    print_status "Application deployed with PM2"
    
elif [ "$DEPLOYMENT_METHOD" = "systemd" ]; then
    # Systemd deployment
    cp "$INSTALL_DIR/deployment/playlist-lab.service" /etc/systemd/system/
    
    # Update paths in service file
    sed -i "s|/opt/playlist-lab|$INSTALL_DIR|g" /etc/systemd/system/playlist-lab.service
    sed -i "s|/var/lib/playlist-lab|$DATA_DIR|g" /etc/systemd/system/playlist-lab.service
    sed -i "s|/var/log/playlist-lab|$LOG_DIR|g" /etc/systemd/system/playlist-lab.service
    
    systemctl daemon-reload
    systemctl enable playlist-lab
    systemctl start playlist-lab
    
    print_status "Application deployed with systemd"
fi

# Step 10: Deploy web client
print_header "Step 10: Deploying Web Client"

cp -r "$INSTALL_DIR/apps/web/dist/"* "$WEB_DIR/"
chown -R www-data:www-data "$WEB_DIR"

print_status "Web client deployed to $WEB_DIR"

# Step 11: Wait for application to start
print_header "Step 11: Waiting for Application"

sleep 5

# Check health
if curl -f http://localhost:3000/api/health &> /dev/null; then
    print_status "Application is healthy"
else
    print_warning "Application may not be ready yet. Check logs."
fi

# Summary
print_header "Deployment Complete!"

echo ""
echo "Installation directory: $INSTALL_DIR"
echo "Database location: $DATA_DIR/playlist-lab.db"
echo "Log directory: $LOG_DIR"
echo "Web client: $WEB_DIR"
echo ""
echo "Next steps:"
echo "1. Configure reverse proxy (Nginx/Apache/Caddy)"
echo "2. Set up SSL certificate"
echo "3. Review environment configuration: $INSTALL_DIR/.env.production"
echo "4. Configure admin users (ADMIN_PLEX_IDS)"
echo "5. Set up automated backups"
echo ""
echo "Useful commands:"
if [ "$DEPLOYMENT_METHOD" = "docker" ]; then
    echo "  View logs: docker logs -f playlist-lab-server"
    echo "  Stop: docker-compose down"
    echo "  Restart: docker-compose restart"
elif [ "$DEPLOYMENT_METHOD" = "pm2" ]; then
    echo "  View logs: pm2 logs playlist-lab-server"
    echo "  Stop: pm2 stop playlist-lab-server"
    echo "  Restart: pm2 restart playlist-lab-server"
elif [ "$DEPLOYMENT_METHOD" = "systemd" ]; then
    echo "  View logs: journalctl -u playlist-lab -f"
    echo "  Stop: systemctl stop playlist-lab"
    echo "  Restart: systemctl restart playlist-lab"
fi
echo "  Backup: cd $INSTALL_DIR && npm run db:backup"
echo "  Health check: curl http://localhost:3000/api/health"
echo ""
print_status "Deployment successful!"
