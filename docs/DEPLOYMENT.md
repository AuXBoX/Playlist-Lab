# Playlist Lab Web Server - Deployment Guide

This comprehensive guide covers deploying Playlist Lab Web Server in various environments, from local development to production deployments with Docker, reverse proxies, and monitoring.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Production Deployment](#production-deployment)
4. [Environment Variables](#environment-variables)
5. [Reverse Proxy Configuration](#reverse-proxy-configuration)
6. [Database Management](#database-management)
7. [Backup and Restore](#backup-and-restore)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Updating](#updating)
10. [Troubleshooting](#troubleshooting)
11. [Security Best Practices](#security-best-practices)
12. [Performance Tuning](#performance-tuning)

---

## Prerequisites

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 10GB minimum, 50GB recommended
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+) or Windows Server 2019+

### Software Requirements

- **Docker**: 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose**: 2.0+ ([Install Docker Compose](https://docs.docker.com/compose/install/))
- **Node.js**: 18+ (for local development)
- **Git**: For cloning the repository

### Optional

- **Domain name**: For HTTPS access
- **SSL certificate**: Let's Encrypt recommended
- **Reverse proxy**: nginx, Apache, or Caddy

---

## Quick Start (Development)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/playlist-lab.git
cd playlist-lab
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set required variables:

```bash
# REQUIRED: Generate a strong random string
SESSION_SECRET=$(openssl rand -base64 32)

# Development settings
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/playlist-lab.db
LOG_LEVEL=debug
```

### 4. Initialize Database

```bash
npm run db:init
```

### 5. Start Development Server

```bash
npm run dev
```

The server will be available at `http://localhost:3000`

### 6. Verify Installation

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0"
}
```

---

---

## Environment Variables

All configuration is done through environment variables. Create a `.env` file in the project root.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | Secret key for session encryption (REQUIRED) | `openssl rand -base64 32` |

### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database file path | `./data/playlist-lab.db` |
| `DATABASE_BACKUP_PATH` | Backup directory | `./data/backups` |

### Session Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_MAX_AGE` | Session expiration in milliseconds | `2592000000` (30 days) |
| `SESSION_COOKIE_SECURE` | Use secure cookies (HTTPS only) | `true` in production |
| `SESSION_COOKIE_HTTPONLY` | HttpOnly cookie flag | `true` |

### Cache Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_MAX_AGE_HOURS` | Cached playlist validity period (hours) | `24` |
| `CACHE_CLEANUP_DAYS` | Days before cache cleanup | `7` |

### Background Jobs

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPER_SCHEDULE` | Cron schedule for daily scraper | `0 2 * * *` (2 AM daily) |
| `SCHEDULE_CHECKER_INTERVAL` | Schedule checker interval (minutes) | `60` |
| `CACHE_CLEANUP_SCHEDULE` | Cache cleanup cron schedule | `0 3 * * 0` (3 AM Sunday) |

### Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Admin Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PLEX_IDS` | Comma-separated Plex user IDs for admins | (empty) |

### Plex Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PLEX_CLIENT_ID` | Plex client identifier | `playlist-lab-server` |
| `PLEX_PRODUCT_NAME` | Product name for Plex | `Playlist Lab` |

### Example .env File

```bash
# Required
SESSION_SECRET=your-strong-random-secret-here

# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_PATH=/data/playlist-lab.db

# Cache
CACHE_MAX_AGE_HOURS=24

# Background Jobs
SCRAPER_SCHEDULE=0 2 * * *

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Admin (optional)
ADMIN_PLEX_IDS=123456,789012
```

---

## Production Deployment

### Docker Deployment (Recommended)

#### 1. Build Production Image

```bash
# Build server
cd apps/server
npm run build

# Build web client
cd ../web
npm run build

# Build Docker image
cd ../..
docker build -t playlist-lab:latest .
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  playlist-lab:
    image: playlist-lab:latest
    container_name: playlist-lab-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_PATH=/data/playlist-lab.db
      - SESSION_SECRET=${SESSION_SECRET}
      - LOG_LEVEL=info
      - CACHE_MAX_AGE_HOURS=24
      - SCRAPER_SCHEDULE=0 2 * * *
      - RATE_LIMIT_WINDOW_MS=60000
      - RATE_LIMIT_MAX_REQUESTS=100
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### 3. Start Services

```bash
docker-compose up -d
```

#### 4. Verify Deployment

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:3000/api/health
```

### Manual Deployment (Without Docker)

#### 1. Build Application

```bash
# Install dependencies
npm install

# Build server
cd apps/server
npm run build

# Build web client
cd ../web
npm run build

# Build shared package
cd ../../packages/shared
npm run build
```

#### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with production values
```

#### 3. Initialize Database

```bash
npm run db:init
```

#### 4. Start Server

```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start apps/server/dist/index.js --name playlist-lab

# Or using systemd (see below)
```

#### 5. Configure systemd Service

Create `/etc/systemd/system/playlist-lab.service`:

```ini
[Unit]
Description=Playlist Lab Web Server
After=network.target

[Service]
Type=simple
User=playlist-lab
WorkingDirectory=/opt/playlist-lab
Environment=NODE_ENV=production
EnvironmentFile=/opt/playlist-lab/.env
ExecStart=/usr/bin/node /opt/playlist-lab/apps/server/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable playlist-lab
sudo systemctl start playlist-lab
sudo systemctl status playlist-lab
```

---

## Reverse Proxy Configuration

### nginx Configuration

#### Basic Configuration

Create `/etc/nginx/sites-available/playlist-lab`:

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name playlist-lab.yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name playlist-lab.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/playlist-lab.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playlist-lab.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/playlist-lab-access.log;
    error_log /var/log/nginx/playlist-lab-error.log;

    # Proxy to application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/playlist-lab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Rate Limiting (nginx)

Add to nginx configuration:

```nginx
# Define rate limit zone
limit_req_zone $binary_remote_addr zone=playlist_lab_limit:10m rate=10r/s;

server {
    # ... other configuration ...
    
    location /api/ {
        limit_req zone=playlist_lab_limit burst=20 nodelay;
        proxy_pass http://localhost:3000;
        # ... other proxy settings ...
    }
}
```

### Apache Configuration

Create `/etc/apache2/sites-available/playlist-lab.conf`:

```apache
<VirtualHost *:80>
    ServerName playlist-lab.yourdomain.com
    Redirect permanent / https://playlist-lab.yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName playlist-lab.yourdomain.com

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/playlist-lab.yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/playlist-lab.yourdomain.com/privkey.pem
    
    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"

    # Proxy configuration
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://localhost:3000/$1 [P,L]

    # Logging
    ErrorLog ${APACHE_LOG_DIR}/playlist-lab-error.log
    CustomLog ${APACHE_LOG_DIR}/playlist-lab-access.log combined
</VirtualHost>
```

Enable required modules and site:

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl headers
sudo a2ensite playlist-lab
sudo apache2ctl configtest
sudo systemctl reload apache2
```

### Caddy Configuration

Create `Caddyfile`:

```caddy
playlist-lab.yourdomain.com {
    reverse_proxy localhost:3000
    
    # Automatic HTTPS with Let's Encrypt
    tls {
        protocols tls1.2 tls1.3
    }
    
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "no-referrer-when-downgrade"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
    
    # Gzip compression
    encode gzip
    
    # Logging
    log {
        output file /var/log/caddy/playlist-lab-access.log
    }
}
```

Start Caddy:

```bash
sudo caddy start --config Caddyfile
```

### SSL Certificate Setup (Let's Encrypt)

#### Using Certbot (nginx/Apache)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx  # For nginx
# OR
sudo apt install certbot python3-certbot-apache  # For Apache

# Obtain certificate
sudo certbot --nginx -d playlist-lab.yourdomain.com  # For nginx
# OR
sudo certbot --apache -d playlist-lab.yourdomain.com  # For Apache

# Test auto-renewal
sudo certbot renew --dry-run
```

#### Manual Certificate (for Caddy or custom setup)

```bash
sudo certbot certonly --standalone -d playlist-lab.yourdomain.com
```

---

## Database Management

### Database Location

The SQLite database is stored at the path specified in `DATABASE_PATH` environment variable (default: `./data/playlist-lab.db`).

### Database Initialization

```bash
# Initialize database with schema
npm run db:init

# Or manually
sqlite3 ./data/playlist-lab.db < apps/server/src/database/schema.sql
```

### Database Maintenance

#### Enable WAL Mode (Recommended)

Write-Ahead Logging improves concurrency:

```bash
sqlite3 ./data/playlist-lab.db "PRAGMA journal_mode=WAL;"
```

#### Vacuum Database

Reclaim unused space:

```bash
sqlite3 ./data/playlist-lab.db "VACUUM;"
```

#### Analyze Database

Update query optimizer statistics:

```bash
sqlite3 ./data/playlist-lab.db "ANALYZE;"
```

#### Check Database Integrity

```bash
sqlite3 ./data/playlist-lab.db "PRAGMA integrity_check;"
```

### Database Queries

#### View User Count

```bash
sqlite3 ./data/playlist-lab.db "SELECT COUNT(*) FROM users;"
```

#### View Playlist Count

```bash
sqlite3 ./data/playlist-lab.db "SELECT COUNT(*) FROM playlists;"
```

#### View Database Size

```bash
du -h ./data/playlist-lab.db
```

#### Export Data

```bash
# Export to SQL
sqlite3 ./data/playlist-lab.db .dump > backup.sql

# Export table to CSV
sqlite3 -header -csv ./data/playlist-lab.db "SELECT * FROM playlists;" > playlists.csv
```

---

## Backup and Restore

### Manual Backup

#### Using SQLite Backup Command

```bash
# Local backup
sqlite3 ./data/playlist-lab.db ".backup ./data/backups/backup-$(date +%Y%m%d).db"

# Docker backup
docker-compose exec playlist-lab sqlite3 /data/playlist-lab.db ".backup /data/backups/backup-$(date +%Y%m%d).db"
```

#### Using File Copy

```bash
# Stop the application first
docker-compose down

# Copy database files
cp ./data/playlist-lab.db ./data/backups/backup-$(date +%Y%m%d).db
cp ./data/playlist-lab.db-wal ./data/backups/backup-$(date +%Y%m%d).db-wal
cp ./data/playlist-lab.db-shm ./data/backups/backup-$(date +%Y%m%d).db-shm

# Restart application
docker-compose up -d
```

### Automated Backup Script

Create `/usr/local/bin/backup-playlist-lab.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/backups/playlist-lab"
DATE=$(date +%Y%m%d-%H%M%S)
CONTAINER="playlist-lab-server"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "Starting backup at $(date)"

if [ "$(docker ps -q -f name=$CONTAINER)" ]; then
    # Docker deployment
    docker exec $CONTAINER sqlite3 /data/playlist-lab.db ".backup /data/backup-$DATE.db"
    docker cp $CONTAINER:/data/backup-$DATE.db $BACKUP_DIR/
    docker exec $CONTAINER rm /data/backup-$DATE.db
else
    # Manual deployment
    sqlite3 /opt/playlist-lab/data/playlist-lab.db ".backup $BACKUP_DIR/backup-$DATE.db"
fi

# Compress backup
gzip $BACKUP_DIR/backup-$DATE.db

# Remove old backups
find $BACKUP_DIR -name "backup-*.db.gz" -mtime +$RETENTION_DAYS -delete

# Log completion
echo "Backup completed: $BACKUP_DIR/backup-$DATE.db.gz"
echo "Backup size: $(du -h $BACKUP_DIR/backup-$DATE.db.gz | cut -f1)"

# Optional: Upload to cloud storage
# aws s3 cp $BACKUP_DIR/backup-$DATE.db.gz s3://your-bucket/playlist-lab/
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/backup-playlist-lab.sh
```

### Schedule Automated Backups

#### Using Cron

```bash
sudo crontab -e
```

Add daily backup at 3 AM:

```cron
0 3 * * * /usr/local/bin/backup-playlist-lab.sh >> /var/log/playlist-lab-backup.log 2>&1
```

#### Using systemd Timer

Create `/etc/systemd/system/playlist-lab-backup.service`:

```ini
[Unit]
Description=Playlist Lab Database Backup
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup-playlist-lab.sh
User=root
```

Create `/etc/systemd/system/playlist-lab-backup.timer`:

```ini
[Unit]
Description=Playlist Lab Backup Timer
Requires=playlist-lab-backup.service

[Timer]
OnCalendar=daily
OnCalendar=03:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable playlist-lab-backup.timer
sudo systemctl start playlist-lab-backup.timer
sudo systemctl list-timers
```

### Restore from Backup

#### Stop Application

```bash
docker-compose down
# OR
sudo systemctl stop playlist-lab
```

#### Restore Database

```bash
# Decompress backup
gunzip /backups/playlist-lab/backup-20240101-030000.db.gz

# Replace current database
cp /backups/playlist-lab/backup-20240101-030000.db ./data/playlist-lab.db

# Fix permissions
chmod 644 ./data/playlist-lab.db
chown playlist-lab:playlist-lab ./data/playlist-lab.db
```

#### Start Application

```bash
docker-compose up -d
# OR
sudo systemctl start playlist-lab
```

#### Verify Restore

```bash
# Check database integrity
sqlite3 ./data/playlist-lab.db "PRAGMA integrity_check;"

# Check user count
sqlite3 ./data/playlist-lab.db "SELECT COUNT(*) FROM users;"

# Test application
curl http://localhost:3000/api/health
```

### Cloud Backup Integration

#### AWS S3

```bash
# Install AWS CLI
sudo apt install awscli

# Configure credentials
aws configure

# Add to backup script
aws s3 cp $BACKUP_DIR/backup-$DATE.db.gz s3://your-bucket/playlist-lab/
```

#### Google Cloud Storage

```bash
# Install gsutil
curl https://sdk.cloud.google.com | bash

# Authenticate
gcloud auth login

# Add to backup script
gsutil cp $BACKUP_DIR/backup-$DATE.db.gz gs://your-bucket/playlist-lab/
```

#### Azure Blob Storage

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login
az login

# Add to backup script
az storage blob upload --account-name youraccount --container-name playlist-lab --file $BACKUP_DIR/backup-$DATE.db.gz
```

---

## Monitoring and Logging

### Health Checks

#### Application Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0",
  "uptime": 3600
}
```

#### Docker Health Check

```bash
docker inspect --format='{{.State.Health.Status}}' playlist-lab-server
```

### Logging

#### View Application Logs

```bash
# Docker logs
docker-compose logs -f playlist-lab

# Last 100 lines
docker-compose logs --tail=100 playlist-lab

# Since specific time
docker-compose logs --since 2024-01-01T00:00:00 playlist-lab

# Manual deployment logs
tail -f /opt/playlist-lab/logs/combined.log
tail -f /opt/playlist-lab/logs/error.log
```

#### Log Rotation

Create `/etc/logrotate.d/playlist-lab`:

```
/opt/playlist-lab/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 playlist-lab playlist-lab
    sharedscripts
    postrotate
        systemctl reload playlist-lab > /dev/null 2>&1 || true
    endscript
}
```

### Resource Monitoring

#### Docker Stats

```bash
# Real-time stats
docker stats playlist-lab-server

# One-time snapshot
docker stats --no-stream playlist-lab-server
```

#### System Resources

```bash
# CPU and memory
top -p $(pgrep -f playlist-lab)

# Disk usage
df -h
du -sh ./data

# Network connections
netstat -tulpn | grep 3000
```

### Monitoring Tools Integration

#### Prometheus

Add to `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

volumes:
  prometheus-data:
```

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'playlist-lab'
    static_configs:
      - targets: ['playlist-lab:3000']
```

#### Grafana

Add to `docker-compose.yml`:

```yaml
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  grafana-data:
```

#### Uptime Monitoring

Use external services:
- **UptimeRobot**: https://uptimerobot.com
- **Pingdom**: https://www.pingdom.com
- **StatusCake**: https://www.statuscake.com

Configure to monitor: `https://playlist-lab.yourdomain.com/api/health`

### Alerting

#### Email Alerts (using mailx)

Create `/usr/local/bin/check-playlist-lab.sh`:

```bash
#!/bin/bash

HEALTH_URL="http://localhost:3000/api/health"
ALERT_EMAIL="admin@yourdomain.com"

if ! curl -f -s $HEALTH_URL > /dev/null; then
    echo "Playlist Lab health check failed at $(date)" | \
        mail -s "ALERT: Playlist Lab Down" $ALERT_EMAIL
fi
```

Add to cron (check every 5 minutes):

```cron
*/5 * * * * /usr/local/bin/check-playlist-lab.sh
```

#### Slack Alerts

```bash
#!/bin/bash

HEALTH_URL="http://localhost:3000/api/health"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

if ! curl -f -s $HEALTH_URL > /dev/null; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"🚨 Playlist Lab health check failed!"}' \
        $SLACK_WEBHOOK
fi
```

### Performance Metrics

#### Database Performance

```bash
# Query execution time
sqlite3 ./data/playlist-lab.db "EXPLAIN QUERY PLAN SELECT * FROM playlists WHERE user_id = 1;"

# Database size
sqlite3 ./data/playlist-lab.db "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"

# Table sizes
sqlite3 ./data/playlist-lab.db "SELECT name, SUM(pgsize) as size FROM dbstat GROUP BY name ORDER BY size DESC;"
```

#### API Response Times

```bash
# Test endpoint response time
time curl -s http://localhost:3000/api/health

# Using Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/health
```

---

## Updating

### Docker Deployment Update

#### 1. Pull Latest Changes

```bash
cd /opt/playlist-lab
git pull origin main
```

#### 2. Backup Database

```bash
./backup-playlist-lab.sh
```

#### 3. Rebuild Image

```bash
docker-compose build
```

#### 4. Stop Current Container

```bash
docker-compose down
```

#### 5. Start Updated Container

```bash
docker-compose up -d
```

#### 6. Verify Update

```bash
docker-compose ps
docker-compose logs -f
curl http://localhost:3000/api/health
```

### Manual Deployment Update

#### 1. Backup Database

```bash
sqlite3 ./data/playlist-lab.db ".backup ./data/backups/pre-update-$(date +%Y%m%d).db"
```

#### 2. Pull Latest Changes

```bash
git pull origin main
```

#### 3. Install Dependencies

```bash
npm install
```

#### 4. Build Application

```bash
npm run build
```

#### 5. Restart Service

```bash
# Using PM2
pm2 restart playlist-lab

# Using systemd
sudo systemctl restart playlist-lab
```

#### 6. Verify Update

```bash
curl http://localhost:3000/api/health
```

### Zero-Downtime Updates

For production environments requiring zero downtime:

#### 1. Set Up Load Balancer

Use nginx or HAProxy to distribute traffic between multiple instances.

#### 2. Deploy New Version

Start new instance on different port:

```bash
PORT=3001 docker-compose up -d playlist-lab-new
```

#### 3. Health Check New Instance

```bash
curl http://localhost:3001/api/health
```

#### 4. Switch Traffic

Update load balancer to point to new instance.

#### 5. Stop Old Instance

```bash
docker-compose down playlist-lab-old
```

### Rollback Procedure

If update fails:

#### 1. Stop Current Version

```bash
docker-compose down
# OR
sudo systemctl stop playlist-lab
```

#### 2. Restore Database

```bash
cp ./data/backups/pre-update-20240101.db ./data/playlist-lab.db
```

#### 3. Checkout Previous Version

```bash
git checkout <previous-commit-hash>
```

#### 4. Rebuild and Start

```bash
docker-compose build
docker-compose up -d
# OR
npm run build
sudo systemctl start playlist-lab
```

---

## Troubleshooting

### Common Issues

#### Container Won't Start

**Symptoms**: Container exits immediately after starting

**Diagnosis**:
```bash
docker-compose logs playlist-lab
docker inspect playlist-lab-server
```

**Common Causes**:
1. Missing `SESSION_SECRET` in `.env`
   ```bash
   echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
   ```

2. Port 3000 already in use
   ```bash
   # Find process using port
   lsof -i :3000
   # Kill process or change PORT in .env
   ```

3. Insufficient disk space
   ```bash
   df -h
   # Clean up Docker
   docker system prune -a
   ```

4. Database file permissions
   ```bash
   sudo chown -R 1000:1000 ./data
   sudo chmod -R 755 ./data
   ```

#### Database Locked Error

**Symptoms**: "database is locked" errors in logs

**Solution**:
```bash
# Stop application
docker-compose down

# Remove WAL files
rm -f ./data/playlist-lab.db-shm ./data/playlist-lab.db-wal

# Enable WAL mode
sqlite3 ./data/playlist-lab.db "PRAGMA journal_mode=WAL;"

# Restart application
docker-compose up -d
```

#### High Memory Usage

**Symptoms**: Container using excessive RAM

**Diagnosis**:
```bash
docker stats playlist-lab-server
```

**Solutions**:
1. Restart container
   ```bash
   docker-compose restart playlist-lab
   ```

2. Limit container memory
   ```yaml
   # docker-compose.yml
   services:
     playlist-lab:
       mem_limit: 2g
       mem_reservation: 1g
   ```

3. Check for memory leaks in logs
   ```bash
   docker-compose logs | grep -i "memory\|heap"
   ```

#### Authentication Failures

**Symptoms**: Users cannot log in

**Diagnosis**:
```bash
# Check Plex.tv connectivity
curl https://plex.tv/api/v2/ping

# Check logs
docker-compose logs | grep -i "auth\|plex"
```

**Solutions**:
1. Verify Plex.tv is accessible
2. Check firewall rules
3. Verify `PLEX_CLIENT_ID` is set correctly

#### Import/Scraping Failures

**Symptoms**: Playlist imports fail

**Diagnosis**:
```bash
# Check logs for specific errors
docker-compose logs | grep -i "import\|scrape"
```

**Solutions**:
1. Check external service availability
2. Verify network connectivity
3. Check rate limiting
4. Clear cache and retry
   ```bash
   sqlite3 ./data/playlist-lab.db "DELETE FROM cached_playlists WHERE scraped_at < strftime('%s', 'now', '-7 days');"
   ```

#### Background Jobs Not Running

**Symptoms**: Scheduled tasks not executing

**Diagnosis**:
```bash
# Check job status
curl http://localhost:3000/api/admin/jobs

# Check logs
docker-compose logs | grep -i "job\|schedule\|cron"
```

**Solutions**:
1. Verify cron schedule format
2. Check system time/timezone
3. Restart application
   ```bash
   docker-compose restart playlist-lab
   ```

#### SSL Certificate Issues

**Symptoms**: HTTPS not working, certificate errors

**Diagnosis**:
```bash
# Check certificate validity
openssl s_client -connect playlist-lab.yourdomain.com:443 -servername playlist-lab.yourdomain.com

# Check certbot status
sudo certbot certificates
```

**Solutions**:
1. Renew certificate
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

2. Check certificate paths in nginx config
3. Verify domain DNS records

#### Performance Issues

**Symptoms**: Slow response times

**Diagnosis**:
```bash
# Check API response time
time curl http://localhost:3000/api/health

# Check database performance
sqlite3 ./data/playlist-lab.db "PRAGMA optimize;"

# Check system resources
top
iostat
```

**Solutions**:
1. Enable database WAL mode
2. Add database indexes
3. Increase container resources
4. Enable response compression
5. Check network latency to Plex server

### Getting Help

If issues persist:

1. **Check Logs**: Always review application logs first
   ```bash
   docker-compose logs --tail=200 playlist-lab
   ```

2. **Enable Debug Logging**:
   ```bash
   # In .env
   LOG_LEVEL=debug
   docker-compose restart
   ```

3. **Collect System Information**:
   ```bash
   # System info
   uname -a
   docker --version
   docker-compose --version
   
   # Application info
   curl http://localhost:3000/api/health
   
   # Resource usage
   docker stats --no-stream
   df -h
   ```

4. **GitHub Issues**: https://github.com/your-org/playlist-lab/issues

5. **Community Support**: https://discord.gg/playlist-lab

---

## Security Best Practices

### Checklist

- [ ] **Strong Session Secret**: Use cryptographically secure random string
  ```bash
  SESSION_SECRET=$(openssl rand -base64 32)
  ```

- [ ] **HTTPS Enabled**: Always use HTTPS in production with valid SSL certificate

- [ ] **Firewall Configuration**: Only expose necessary ports (80, 443)
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

- [ ] **Database Permissions**: Restrict database file access
  ```bash
  chmod 600 ./data/playlist-lab.db
  chown playlist-lab:playlist-lab ./data/playlist-lab.db
  ```

- [ ] **Regular Backups**: Automated daily backups with off-site storage

- [ ] **Rate Limiting**: Enabled and configured appropriately

- [ ] **Security Headers**: Configured in reverse proxy (X-Frame-Options, CSP, etc.)

- [ ] **Regular Updates**: Keep application and dependencies up to date
  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **Monitoring**: Health checks and alerting configured

- [ ] **Log Rotation**: Prevent log files from filling disk

- [ ] **Secure Cookies**: httpOnly and secure flags enabled in production

- [ ] **Input Validation**: All user inputs sanitized (handled by application)

- [ ] **SQL Injection Prevention**: Parameterized queries used (handled by application)

### Additional Security Measures

#### Fail2Ban Integration

Protect against brute force attacks:

Create `/etc/fail2ban/filter.d/playlist-lab.conf`:

```ini
[Definition]
failregex = ^.*"error".*"AUTH_INVALID".*"ip":"<HOST>".*$
ignoreregex =
```

Create `/etc/fail2ban/jail.d/playlist-lab.conf`:

```ini
[playlist-lab]
enabled = true
port = http,https
filter = playlist-lab
logpath = /opt/playlist-lab/logs/combined.log
maxretry = 5
bantime = 3600
findtime = 600
```

Restart Fail2Ban:

```bash
sudo systemctl restart fail2ban
```

#### Network Isolation

Use Docker networks to isolate services:

```yaml
# docker-compose.yml
networks:
  frontend:
  backend:

services:
  playlist-lab:
    networks:
      - frontend
      - backend
  
  nginx:
    networks:
      - frontend
```

#### Secrets Management

Use Docker secrets for sensitive data:

```yaml
# docker-compose.yml
secrets:
  session_secret:
    file: ./secrets/session_secret.txt

services:
  playlist-lab:
    secrets:
      - session_secret
    environment:
      - SESSION_SECRET_FILE=/run/secrets/session_secret
```

#### Regular Security Audits

```bash
# Check for vulnerable dependencies
npm audit

# Update dependencies
npm update

# Check Docker image vulnerabilities
docker scan playlist-lab:latest
```

---

## Performance Tuning

### Database Optimization

#### Enable WAL Mode

Write-Ahead Logging improves concurrency:

```bash
sqlite3 ./data/playlist-lab.db "PRAGMA journal_mode=WAL;"
```

#### Optimize Database

```bash
# Analyze query patterns
sqlite3 ./data/playlist-lab.db "PRAGMA optimize;"

# Rebuild indexes
sqlite3 ./data/playlist-lab.db "REINDEX;"

# Vacuum to reclaim space
sqlite3 ./data/playlist-lab.db "VACUUM;"
```

#### Add Custom Indexes

For frequently queried columns:

```sql
CREATE INDEX IF NOT EXISTS idx_playlists_user_source 
ON playlists(user_id, source);

CREATE INDEX IF NOT EXISTS idx_missing_tracks_user_playlist 
ON missing_tracks(user_id, playlist_id);

CREATE INDEX IF NOT EXISTS idx_schedules_user_type 
ON schedules(user_id, schedule_type);
```

### Application Tuning

#### Increase Rate Limits

For high-traffic deployments, edit `.env`:

```bash
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=60000
```

#### Adjust Cache Settings

```bash
# Increase cache validity period
CACHE_MAX_AGE_HOURS=48

# Adjust cleanup frequency
CACHE_CLEANUP_DAYS=14
```

#### Node.js Memory Limits

For large deployments:

```yaml
# docker-compose.yml
services:
  playlist-lab:
    environment:
      - NODE_OPTIONS=--max-old-space-size=4096
```

### Reverse Proxy Optimization

#### nginx Caching

Add to nginx configuration:

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=playlist_lab_cache:10m max_size=1g inactive=60m;

server {
    # ... other configuration ...
    
    location /api/ {
        proxy_cache playlist_lab_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
        
        proxy_pass http://localhost:3000;
    }
}
```

#### Connection Pooling

```nginx
upstream playlist_lab_backend {
    server localhost:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    location / {
        proxy_pass http://playlist_lab_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### Docker Optimization

#### Resource Limits

```yaml
# docker-compose.yml
services:
  playlist-lab:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

#### Multi-Stage Build

Optimize Docker image size:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Scaling Strategies

#### Horizontal Scaling

Deploy multiple instances behind a load balancer:

```yaml
# docker-compose.yml
services:
  playlist-lab-1:
    image: playlist-lab:latest
    ports:
      - "3001:3000"
  
  playlist-lab-2:
    image: playlist-lab:latest
    ports:
      - "3002:3000"
  
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

nginx load balancer configuration:

```nginx
upstream playlist_lab_cluster {
    least_conn;
    server playlist-lab-1:3000;
    server playlist-lab-2:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://playlist_lab_cluster;
    }
}
```

#### Database Scaling

For very large deployments, consider:

1. **Read Replicas**: Use SQLite replication or migrate to PostgreSQL
2. **Connection Pooling**: Implement connection pooling
3. **Caching Layer**: Add Redis for session storage and caching

### Monitoring Performance

#### Measure Response Times

```bash
# Using curl
time curl http://localhost:3000/api/health

# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/health

# Using wrk
wrk -t4 -c100 -d30s http://localhost:3000/api/health
```

#### Database Query Performance

```bash
# Enable query logging
sqlite3 ./data/playlist-lab.db "PRAGMA query_only = ON;"

# Analyze slow queries
sqlite3 ./data/playlist-lab.db "EXPLAIN QUERY PLAN SELECT * FROM playlists WHERE user_id = 1;"
```

#### Application Profiling

```bash
# Node.js profiling
node --prof dist/index.js

# Generate profile report
node --prof-process isolate-*.log > profile.txt
```

---

## Additional Resources

### Documentation

- **API Documentation**: `/docs/API.md`
- **User Guide**: `/docs/USER_GUIDE.md`
- **Developer Guide**: `/docs/DEVELOPER_GUIDE.md`
- **Plex API Reference**: `/docs/PLEX_API_COMPLETE_REFERENCE.md`

### External Links

- **Docker Documentation**: https://docs.docker.com
- **nginx Documentation**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org
- **SQLite Documentation**: https://www.sqlite.org/docs.html

### Support

- **GitHub Issues**: https://github.com/your-org/playlist-lab/issues
- **Discussions**: https://github.com/your-org/playlist-lab/discussions
- **Discord Community**: https://discord.gg/playlist-lab
- **Email Support**: support@playlist-lab.com

---

## License

Playlist Lab Web Server is licensed under the MIT License. See LICENSE file for details.

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

---

**Last Updated**: January 2026  
**Version**: 1.0.0
