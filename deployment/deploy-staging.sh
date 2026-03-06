#!/bin/bash

###############################################################################
# Playlist Lab - Staging Deployment Script
# 
# This script automates the deployment of Playlist Lab to a staging environment
# for final verification before production deployment.
#
# Usage: sudo ./deployment/deploy-staging.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_DIR="/opt/playlist-lab-staging"
DATA_DIR="/var/lib/playlist-lab-staging"
LOG_DIR="/var/log/playlist-lab-staging"
BACKUP_DIR="/var/backups/playlist-lab-staging"
DOMAIN="staging.yourdomain.com"  # Update this!

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        print_info "Install Docker: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    print_success "Docker installed"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        print_info "Install Docker Compose: sudo apt install docker-compose"
        exit 1
    fi
    print_success "Docker Compose installed"
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        print_info "Install Git: sudo apt install git"
        exit 1
    fi
    print_success "Git installed"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed (required for building)"
        print_info "Install Node.js: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
        exit 1
    fi
    print_success "Node.js installed ($(node -v))"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm installed ($(npm -v))"
    
    echo ""
}

create_directories() {
    print_header "Creating Directories"
    
    mkdir -p "$STAGING_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    
    print_success "Directories created"
    echo ""
}

clone_repository() {
    print_header "Cloning Repository"
    
    if [ -d "$STAGING_DIR/.git" ]; then
        print_info "Repository already exists, pulling latest changes..."
        cd "$STAGING_DIR"
        git pull origin main
    else
        print_info "Cloning repository..."
        git clone https://github.com/your-org/playlist-lab.git "$STAGING_DIR"
        cd "$STAGING_DIR"
    fi
    
    # Checkout specific version if specified
    if [ ! -z "$1" ]; then
        print_info "Checking out version: $1"
        git checkout "$1"
    fi
    
    print_success "Repository ready"
    echo ""
}

configure_environment() {
    print_header "Configuring Environment"
    
    cd "$STAGING_DIR"
    
    if [ ! -f ".env.production" ]; then
        print_info "Creating .env.production from template..."
        cp .env.production.example .env.production
        
        # Generate session secret
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s/your-strong-random-secret-here/$SESSION_SECRET/" .env.production
        
        # Update paths
        sed -i "s|DATABASE_PATH=.*|DATABASE_PATH=/data/playlist-lab.db|" .env.production
        sed -i "s|LOG_LEVEL=.*|LOG_LEVEL=info|" .env.production
        sed -i "s|NODE_ENV=.*|NODE_ENV=production|" .env.production
        
        print_warning "Please review and update .env.production with your settings"
        print_info "Especially update CORS_ORIGINS with your staging domain"
        
        read -p "Press Enter to continue after reviewing .env.production..."
    else
        print_info ".env.production already exists"
    fi
    
    print_success "Environment configured"
    echo ""
}

build_application() {
    print_header "Building Application"
    
    cd "$STAGING_DIR"
    
    print_info "Installing dependencies..."
    npm ci --production=false
    
    print_info "Building production artifacts..."
    npm run build:prod
    
    # Verify build
    if [ ! -d "apps/server/dist" ]; then
        print_error "Server build failed"
        exit 1
    fi
    
    if [ ! -d "apps/web/dist" ]; then
        print_error "Web client build failed"
        exit 1
    fi
    
    print_success "Application built successfully"
    echo ""
}

initialize_database() {
    print_header "Initializing Database"
    
    cd "$STAGING_DIR"
    
    if [ -f "$DATA_DIR/playlist-lab.db" ]; then
        print_warning "Database already exists"
        read -p "Do you want to backup and reinitialize? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Backing up existing database..."
            cp "$DATA_DIR/playlist-lab.db" "$BACKUP_DIR/playlist-lab-$(date +%Y%m%d-%H%M%S).db"
            print_success "Backup created"
            
            print_info "Initializing new database..."
            DATABASE_PATH="$DATA_DIR/playlist-lab.db" npm run db:init
        fi
    else
        print_info "Initializing database..."
        DATABASE_PATH="$DATA_DIR/playlist-lab.db" npm run db:init
    fi
    
    # Set permissions
    chown -R 1000:1000 "$DATA_DIR"
    chmod -R 755 "$DATA_DIR"
    
    print_success "Database initialized"
    echo ""
}

deploy_docker() {
    print_header "Deploying with Docker"
    
    cd "$STAGING_DIR"
    
    print_info "Building Docker image..."
    docker-compose -f docker-compose.staging.yml build
    
    print_info "Stopping existing containers..."
    docker-compose -f docker-compose.staging.yml down
    
    print_info "Starting containers..."
    docker-compose -f docker-compose.staging.yml up -d
    
    print_info "Waiting for container to be healthy..."
    sleep 10
    
    # Check health
    for i in {1..30}; do
        if docker-compose -f docker-compose.staging.yml ps | grep -q "healthy"; then
            print_success "Container is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Container failed to become healthy"
            docker-compose -f docker-compose.staging.yml logs
            exit 1
        fi
        sleep 2
    done
    
    print_success "Docker deployment complete"
    echo ""
}

configure_nginx() {
    print_header "Configuring Nginx"
    
    if ! command -v nginx &> /dev/null; then
        print_warning "Nginx is not installed"
        read -p "Do you want to install Nginx? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            apt update
            apt install -y nginx
        else
            print_info "Skipping Nginx configuration"
            return
        fi
    fi
    
    print_info "Copying Nginx configuration..."
    cp "$STAGING_DIR/deployment/nginx.conf" /etc/nginx/sites-available/playlist-lab-staging
    
    # Update domain
    sed -i "s/playlist-lab.yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/playlist-lab-staging
    
    # Enable site
    ln -sf /etc/nginx/sites-available/playlist-lab-staging /etc/nginx/sites-enabled/
    
    # Test configuration
    if nginx -t; then
        print_success "Nginx configuration valid"
        systemctl reload nginx
        print_success "Nginx reloaded"
    else
        print_error "Nginx configuration invalid"
        exit 1
    fi
    
    echo ""
}

setup_ssl() {
    print_header "Setting Up SSL Certificate"
    
    if ! command -v certbot &> /dev/null; then
        print_warning "Certbot is not installed"
        read -p "Do you want to install Certbot? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            apt update
            apt install -y certbot python3-certbot-nginx
        else
            print_info "Skipping SSL setup"
            return
        fi
    fi
    
    print_info "Obtaining SSL certificate for $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@yourdomain.com
    
    # Test auto-renewal
    certbot renew --dry-run
    
    print_success "SSL certificate configured"
    echo ""
}

verify_deployment() {
    print_header "Verifying Deployment"
    
    print_info "Checking Docker container status..."
    docker-compose -f "$STAGING_DIR/docker-compose.staging.yml" ps
    
    print_info "Checking health endpoint..."
    if curl -f -s http://localhost:3000/api/health > /dev/null; then
        print_success "Health endpoint responding"
        curl -s http://localhost:3000/api/health | jq .
    else
        print_error "Health endpoint not responding"
        print_info "Checking logs..."
        docker-compose -f "$STAGING_DIR/docker-compose.staging.yml" logs --tail=50
        exit 1
    fi
    
    if [ ! -z "$DOMAIN" ]; then
        print_info "Checking external access..."
        if curl -f -s "https://$DOMAIN/api/health" > /dev/null; then
            print_success "External access working"
        else
            print_warning "External access not working (check DNS and firewall)"
        fi
    fi
    
    echo ""
}

setup_monitoring() {
    print_header "Setting Up Monitoring"
    
    print_info "Creating health check script..."
    cat > /usr/local/bin/check-playlist-lab-staging.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
LOG_FILE="/var/log/playlist-lab-staging/health-check.log"

if ! curl -f -s $HEALTH_URL > /dev/null; then
    echo "$(date): Health check failed" >> $LOG_FILE
    # Send alert (configure your alerting here)
else
    echo "$(date): Health check passed" >> $LOG_FILE
fi
EOF
    
    chmod +x /usr/local/bin/check-playlist-lab-staging.sh
    
    print_info "Adding cron job for health checks..."
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check-playlist-lab-staging.sh") | crontab -
    
    print_success "Monitoring configured"
    echo ""
}

setup_backups() {
    print_header "Setting Up Automated Backups"
    
    print_info "Creating backup script..."
    cat > /usr/local/bin/backup-playlist-lab-staging.sh << EOF
#!/bin/bash
BACKUP_DIR="$BACKUP_DIR"
DATE=\$(date +%Y%m%d-%H%M%S)
CONTAINER="playlist-lab-staging"
RETENTION_DAYS=30

mkdir -p \$BACKUP_DIR

echo "Starting backup at \$(date)"

if [ "\$(docker ps -q -f name=\$CONTAINER)" ]; then
    docker exec \$CONTAINER sqlite3 /data/playlist-lab.db ".backup /data/backup-\$DATE.db"
    docker cp \$CONTAINER:/data/backup-\$DATE.db \$BACKUP_DIR/
    docker exec \$CONTAINER rm /data/backup-\$DATE.db
    
    gzip \$BACKUP_DIR/backup-\$DATE.db
    
    find \$BACKUP_DIR -name "backup-*.db.gz" -mtime +\$RETENTION_DAYS -delete
    
    echo "Backup completed: \$BACKUP_DIR/backup-\$DATE.db.gz"
else
    echo "Container not running"
    exit 1
fi
EOF
    
    chmod +x /usr/local/bin/backup-playlist-lab-staging.sh
    
    print_info "Adding cron job for daily backups..."
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-playlist-lab-staging.sh >> /var/log/playlist-lab-staging/backup.log 2>&1") | crontab -
    
    print_success "Automated backups configured"
    echo ""
}

print_summary() {
    print_header "Deployment Summary"
    
    echo -e "${GREEN}Staging deployment completed successfully!${NC}"
    echo ""
    echo "Application Details:"
    echo "  - Staging Directory: $STAGING_DIR"
    echo "  - Data Directory: $DATA_DIR"
    echo "  - Log Directory: $LOG_DIR"
    echo "  - Backup Directory: $BACKUP_DIR"
    echo ""
    echo "Access Points:"
    echo "  - Local: http://localhost:3000"
    if [ ! -z "$DOMAIN" ]; then
        echo "  - External: https://$DOMAIN"
    fi
    echo ""
    echo "Useful Commands:"
    echo "  - View logs: docker-compose -f $STAGING_DIR/docker-compose.staging.yml logs -f"
    echo "  - Restart: docker-compose -f $STAGING_DIR/docker-compose.staging.yml restart"
    echo "  - Stop: docker-compose -f $STAGING_DIR/docker-compose.staging.yml down"
    echo "  - Start: docker-compose -f $STAGING_DIR/docker-compose.staging.yml up -d"
    echo "  - Health check: curl http://localhost:3000/api/health"
    echo ""
    echo "Next Steps:"
    echo "  1. Review FINAL_CHECKPOINT_VERIFICATION.md"
    echo "  2. Execute all test cases"
    echo "  3. Perform security audit"
    echo "  4. Verify all requirements"
    echo "  5. Prepare for production deployment"
    echo ""
}

# Main execution
main() {
    print_header "Playlist Lab - Staging Deployment"
    echo ""
    
    check_root
    check_prerequisites
    create_directories
    clone_repository "$1"
    configure_environment
    build_application
    initialize_database
    deploy_docker
    configure_nginx
    setup_ssl
    verify_deployment
    setup_monitoring
    setup_backups
    print_summary
}

# Run main function with optional version argument
main "$@"
