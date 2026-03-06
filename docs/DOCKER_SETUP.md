# Docker Setup Guide

## Overview

Playlist Lab Server can be run in Docker for easy deployment and consistent environments. This guide covers Docker setup, configuration, and deployment.

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Start the Server

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop
docker-compose down
```

The server will be available at http://localhost:3001

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

```env
# Required
SESSION_SECRET=your-random-secret-here
PORT=3001

# Optional
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
CACHE_MAX_AGE_HOURS=24
```

See `.env.example` for all available options.

### Volumes

Data is persisted in Docker volumes:

- `playlist-lab-data` - Database files
- `playlist-lab-logs` - Server logs

## Docker Image Details

### Multi-Stage Build

The Dockerfile uses a two-stage build:

1. **Builder Stage**
   - Node.js 20 Alpine
   - Installs all dependencies
   - Builds shared package and server
   - ~500MB

2. **Production Stage**
   - Node.js 20 Alpine
   - Only production dependencies
   - Runs as non-root user
   - ~200MB final image

### Security Features

- ✅ Runs as non-root user (`node`)
- ✅ Uses dumb-init for proper signal handling
- ✅ Minimal Alpine Linux base
- ✅ Only production dependencies
- ✅ Health checks enabled
- ✅ No unnecessary packages

### Health Checks

The container includes automatic health checks:

- Endpoint: `/api/health`
- Interval: Every 30 seconds
- Timeout: 3 seconds
- Retries: 3 before marking unhealthy
- Start period: 10 seconds

## Building the Image

### Build Locally

```bash
# From project root
docker build -f docker/Dockerfile -t playlist-lab-server:2.0.0 .
```

### Build with Docker Compose

```bash
docker-compose build
```

### Build with No Cache

```bash
docker-compose build --no-cache
```

## Running the Container

### Using Docker Compose (Recommended)

```bash
# Start in background
docker-compose up -d

# Start with logs
docker-compose up

# Rebuild and start
docker-compose up -d --build

# Stop
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Using Docker Run

```bash
docker run -d \
  --name playlist-lab-server \
  -p 3001:3001 \
  -v playlist-lab-data:/data \
  -v playlist-lab-logs:/app/logs \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e SESSION_SECRET=your-secret-here \
  -e CORS_ORIGIN=http://localhost:5173 \
  --restart unless-stopped \
  playlist-lab-server:2.0.0
```

## Data Management

### Backup Database

```bash
# Create backup
docker run --rm \
  -v playlist-lab-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/playlist-lab-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Database

```bash
# Restore from backup
docker run --rm \
  -v playlist-lab-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/playlist-lab-backup-20260228.tar.gz -C /data
```

### View Database

```bash
# Access database with sqlite3
docker run --rm -it \
  -v playlist-lab-data:/data \
  alpine/sqlite sqlite3 /data/playlist-lab.db
```

### Clear All Data

```bash
# Stop container
docker-compose down

# Remove volumes
docker volume rm playlist-lab-data playlist-lab-logs

# Restart
docker-compose up -d
```

## Monitoring

### View Logs

```bash
# All logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f playlist-lab-server
```

### Check Health

```bash
# Container health status
docker inspect playlist-lab-server | grep -A 10 Health

# Test health endpoint
curl http://localhost:3001/api/health

# Inside container
docker exec playlist-lab-server wget -O- http://localhost:3001/api/health
```

### Resource Usage

```bash
# Container stats
docker stats playlist-lab-server

# Disk usage
docker system df

# Volume size
docker system df -v | grep playlist-lab
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Check container status
docker-compose ps

# Inspect container
docker inspect playlist-lab-server

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Health Check Failing

```bash
# Check health status
docker inspect playlist-lab-server | grep -A 10 Health

# Test endpoint manually
docker exec playlist-lab-server node -e "require('http').get('http://localhost:3001/api/health', (r) => console.log(r.statusCode))"

# Check if server is running
docker exec playlist-lab-server ps aux
```

### Permission Issues

```bash
# Check file permissions
docker exec playlist-lab-server ls -la /data
docker exec playlist-lab-server ls -la /app/logs

# Fix permissions (if needed)
docker exec -u root playlist-lab-server chown -R node:node /data /app/logs
```

### Database Locked

```bash
# Stop container
docker-compose down

# Remove lock files
docker run --rm -v playlist-lab-data:/data alpine sh -c "rm -f /data/*.db-wal /data/*.db-shm"

# Restart
docker-compose up -d
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Change port in docker-compose.yml
ports:
  - "3002:3001"  # Use 3002 instead
```

### Out of Disk Space

```bash
# Clean up Docker
docker system prune -a

# Remove unused volumes
docker volume prune

# Remove old images
docker image prune -a
```

## Production Deployment

### Staging Environment

Use the staging compose file:

```bash
docker-compose -f docker/docker-compose.staging.yml up -d
```

Features:
- Only exposes to localhost (for reverse proxy)
- Uses production environment file
- Configured logging
- Persistent volumes in `/var/lib` and `/var/log`

### Production Checklist

- [ ] Set strong `SESSION_SECRET`
- [ ] Configure `CORS_ORIGIN` for your domain
- [ ] Set up reverse proxy (nginx/traefik)
- [ ] Configure SSL/TLS certificates
- [ ] Set up automated backups
- [ ] Configure monitoring and alerts
- [ ] Set up log rotation
- [ ] Test health checks
- [ ] Document recovery procedures

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 80;
    server_name playlist-lab.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## CI/CD Integration

Docker images are automatically built via GitHub Actions:

```bash
# Tag a release
git tag v2.0.1
git push origin v2.0.1
```

This triggers:
- Docker image build
- Push to Docker Hub
- GitHub Release creation

Pull the latest image:

```bash
docker pull yourusername/playlist-lab-server:latest
docker pull yourusername/playlist-lab-server:2.0.1
```

## Advanced Usage

### Custom Network

```yaml
networks:
  playlist-lab-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Resource Limits

```yaml
services:
  playlist-lab-server:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Multiple Instances

```bash
# Start multiple instances
docker-compose up -d --scale playlist-lab-server=3
```

### Development Override

Create `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  playlist-lab-server:
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - ./apps/server/src:/app/apps/server/src
    command: npm run dev
```

## Related Documentation

- [Docker README](../docker/README.md) - Docker configuration details
- [Deployment Guide](DEPLOYMENT_ANYWHERE.md) - Full deployment instructions
- [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md) - CI/CD configuration

## Support

For issues:
- Check logs: `docker-compose logs`
- Check health: `curl http://localhost:3001/api/health`
- Review [Troubleshooting](#troubleshooting) section
- Open an issue on GitHub

---

**Docker Version**: 2.0.0  
**Last Updated**: February 28, 2026
