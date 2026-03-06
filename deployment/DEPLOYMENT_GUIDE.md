# Playlist Lab - Production Deployment Guide

This guide covers deploying Playlist Lab to a production environment with HTTPS, reverse proxy, and monitoring.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Build Production Artifacts](#build-production-artifacts)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Methods](#deployment-methods)
7. [Reverse Proxy Setup](#reverse-proxy-setup)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Backup and Maintenance](#backup-and-maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows Server
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: Minimum 10GB free space
- **Network**: Public IP address or domain name

### Required Software

- **Docker** (recommended) or Node.js runtime
- **Reverse Proxy**: Nginx, Apache, or Caddy
- **SSL Certificate**: Let's Encrypt (free) or commercial certificate

---

## Server Setup

### 1. Update System

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl build-essential
```

### 2. Install Node.js

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should be 18.x or higher
npm -v   # Should be 9.x or higher
```

### 3. Install Docker (Recommended)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install -y docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### 4. Create Application User

```bash
# Create dedicated user for the application
sudo useradd -r -m -s /bin/bash playlist-lab
sudo usermod -aG docker playlist-lab
```

---

## Build Production Artifacts

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/playlist-lab.git
cd playlist-lab

# Checkout the desired version/tag
git checkout v2.0.0
```

### 2. Build Application

```bash
# Install dependencies
npm ci

# Build all production artifacts
npm run build:prod

# This will build:
# - Server: apps/server/dist/
# - Web Client: apps/web/dist/
# - Build info: build-info.json
```

### 3. Verify Build

```bash
# Check build artifacts
ls -lh apps/server/dist/
ls -lh apps/web/dist/

# View build info
cat build-info.json
```

---

## Database Setup

### 1. Initialize Database

```bash
# Set database path
export DATABASE_PATH=/var/lib/playlist-lab/playlist-lab.db

# Create data directory
sudo mkdir -p /var/lib/playlist-lab
sudo chown playlist-lab:playlist-lab /var/lib/playlist-lab

# Initialize database
npm run db:init
```

### 2. Verify Database

```bash
# Check database file
ls -lh /var/lib/playlist-lab/playlist-lab.db

# Verify tables (using sqlite3)
sqlite3 /var/lib/playlist-lab/playlist-lab.db ".tables"
```

---

## Environment Configuration

### 1. Create Production Environment File

```bash
# Copy example file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

### 2. Required Configuration

Update these critical values:

```bash
# Generate a strong session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Set your domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Set database path
DATABASE_PATH=/var/lib/playlist-lab/playlist-lab.db

# Configure logging
LOG_LEVEL=info
LOG_FILE_COMBINED=/var/log/playlist-lab/combined.log
LOG_FILE_ERROR=/var/log/playlist-lab/error.log
```

### 3. Create Log Directory

```bash
sudo mkdir -p /var/log/playlist-lab
sudo chown playlist-lab:playlist-lab /var/log/playlist-lab
```

---

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### 1. Update docker-compose.yml

```yaml
version: '3.8'

services:
  playlist-lab-server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    container_name: playlist-lab-server
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"  # Only expose to localhost
    volumes:
      - /var/lib/playlist-lab:/data
      - /var/log/playlist-lab:/app/logs
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
```

#### 2. Deploy

```bash
# Build and start
npm run docker:build
npm run docker:up

# Check status
docker ps
docker logs playlist-lab-server

# Check health
curl http://localhost:3000/api/health
```

### Method 2: PM2 (Process Manager)

#### 1. Install PM2

```bash
sudo npm install -g pm2
```

#### 2. Create PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'playlist-lab-server',
    cwd: '/opt/playlist-lab/apps/server',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_PATH: '/var/lib/playlist-lab/playlist-lab.db',
    },
    error_file: '/var/log/playlist-lab/pm2-error.log',
    out_file: '/var/log/playlist-lab/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
  }]
};
```

#### 3. Deploy

```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions printed

# Check status
pm2 status
pm2 logs playlist-lab-server
```

### Method 3: Systemd Service

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/playlist-lab.service
```

```ini
[Unit]
Description=Playlist Lab Server
After=network.target

[Service]
Type=simple
User=playlist-lab
WorkingDirectory=/opt/playlist-lab/apps/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/playlist-lab/output.log
StandardError=append:/var/log/playlist-lab/error.log

Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_PATH=/var/lib/playlist-lab/playlist-lab.db
EnvironmentFile=/opt/playlist-lab/.env.production

[Install]
WantedBy=multi-user.target
```

#### 2. Enable and Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable playlist-lab

# Start service
sudo systemctl start playlist-lab

# Check status
sudo systemctl status playlist-lab

# View logs
sudo journalctl -u playlist-lab -f
```

---

## Reverse Proxy Setup

### Nginx

#### 1. Install Nginx

```bash
sudo apt install -y nginx
```

#### 2. Configure Site

```bash
# Copy configuration
sudo cp deployment/nginx.conf /etc/nginx/sites-available/playlist-lab

# Update domain and SSL paths
sudo nano /etc/nginx/sites-available/playlist-lab

# Enable site
sudo ln -s /etc/nginx/sites-available/playlist-lab /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 3. Deploy Web Client

```bash
# Create web directory
sudo mkdir -p /var/www/playlist-lab/web

# Copy built files
sudo cp -r apps/web/dist/* /var/www/playlist-lab/web/

# Set permissions
sudo chown -R www-data:www-data /var/www/playlist-lab
```

### Apache

#### 1. Install Apache

```bash
sudo apt install -y apache2
```

#### 2. Enable Required Modules

```bash
sudo a2enmod ssl proxy proxy_http proxy_wstunnel headers rewrite
```

#### 3. Configure Site

```bash
# Copy configuration
sudo cp deployment/apache.conf /etc/apache2/sites-available/playlist-lab.conf

# Update domain and SSL paths
sudo nano /etc/apache2/sites-available/playlist-lab.conf

# Enable site
sudo a2ensite playlist-lab

# Test configuration
sudo apache2ctl configtest

# Reload Apache
sudo systemctl reload apache2
```

### Caddy

#### 1. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### 2. Configure Caddy

```bash
# Copy configuration
sudo cp deployment/caddy.conf /etc/caddy/Caddyfile

# Update domain
sudo nano /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy
```

---

## SSL/TLS Configuration

### Let's Encrypt (Free)

#### Using Certbot (Nginx/Apache)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (Nginx)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Obtain certificate (Apache)
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### Using Caddy (Automatic)

Caddy automatically obtains and renews Let's Encrypt certificates. No additional configuration needed!

### Commercial Certificate

1. Generate CSR:
```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout yourdomain.com.key \
  -out yourdomain.com.csr
```

2. Submit CSR to certificate authority

3. Install certificate:
```bash
# Copy certificate files
sudo cp yourdomain.com.crt /etc/ssl/certs/
sudo cp yourdomain.com.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/yourdomain.com.key

# Update reverse proxy configuration with paths
```

---

## Monitoring and Logging

### Application Logs

```bash
# Docker logs
docker logs -f playlist-lab-server

# PM2 logs
pm2 logs playlist-lab-server

# Systemd logs
sudo journalctl -u playlist-lab -f

# Application log files
tail -f /var/log/playlist-lab/combined.log
tail -f /var/log/playlist-lab/error.log
```

### Health Checks

```bash
# Check application health
curl http://localhost:3000/api/health

# Check from external
curl https://yourdomain.com/api/health
```

### Monitoring Tools (Optional)

#### Prometheus + Grafana

1. Add metrics endpoint to server
2. Configure Prometheus to scrape metrics
3. Create Grafana dashboards

#### Uptime Monitoring

- [UptimeRobot](https://uptimerobot.com/) (free)
- [Pingdom](https://www.pingdom.com/)
- [StatusCake](https://www.statuscake.com/)

---

## Backup and Maintenance

### Automated Backups

#### 1. Create Backup Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * cd /opt/playlist-lab && npm run db:backup

# Add weekly cleanup
0 4 * * 0 cd /opt/playlist-lab && find /opt/playlist-lab/backups -name "*.db" -mtime +30 -delete
```

#### 2. Manual Backup

```bash
# Create backup
npm run db:backup

# Backups are stored in: ./backups/
```

### Database Maintenance

```bash
# Vacuum database (reclaim space)
sqlite3 /var/lib/playlist-lab/playlist-lab.db "VACUUM;"

# Check integrity
sqlite3 /var/lib/playlist-lab/playlist-lab.db "PRAGMA integrity_check;"
```

### Updates

```bash
# Using update script
npm run deploy:update

# Manual update
git pull origin main
npm ci
npm run build:prod
npm run docker:down
npm run docker:up
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs playlist-lab-server
# or
pm2 logs playlist-lab-server
# or
sudo journalctl -u playlist-lab -n 50

# Common issues:
# - Port 3000 already in use
# - Database file permissions
# - Missing environment variables
```

### Database Errors

```bash
# Check database file
ls -lh /var/lib/playlist-lab/playlist-lab.db

# Check permissions
sudo chown playlist-lab:playlist-lab /var/lib/playlist-lab/playlist-lab.db

# Restore from backup
npm run db:restore
```

### SSL Certificate Issues

```bash
# Check certificate expiry
openssl x509 -in /etc/ssl/certs/yourdomain.com.crt -noout -dates

# Renew Let's Encrypt certificate
sudo certbot renew

# Test SSL configuration
curl -vI https://yourdomain.com
```

### Performance Issues

```bash
# Check system resources
htop
df -h
free -h

# Check database size
du -h /var/lib/playlist-lab/playlist-lab.db

# Optimize database
sqlite3 /var/lib/playlist-lab/playlist-lab.db "VACUUM; ANALYZE;"
```

### Connection Issues

```bash
# Check if server is listening
sudo netstat -tlnp | grep 3000

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check reverse proxy
sudo nginx -t
sudo systemctl status nginx
```

---

## Security Checklist

- [ ] Strong SESSION_SECRET configured
- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured (only 80/443 open)
- [ ] Database file permissions restricted
- [ ] Regular backups configured
- [ ] Log rotation configured
- [ ] Security headers enabled in reverse proxy
- [ ] Rate limiting enabled
- [ ] Admin users configured
- [ ] Server software up to date

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/playlist-lab/issues
- Documentation: https://github.com/yourusername/playlist-lab/docs
- Email: support@yourdomain.com
