# Docker Configuration

This directory contains all Docker-related files for the Playlist Lab project.

## Files

- `Dockerfile` - Multi-stage production Dockerfile
- `docker-compose.yml` - Production Docker Compose configuration
- `docker-compose.staging.yml` - Staging environment configuration
- `.dockerignore` - Files to exclude from Docker builds

## Quick Start

### Development/Local Testing

From the project root:

```bash
# Start the server
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop services
docker-compose -f docker/docker-compose.yml down
```

Or use the convenience symlink in the root:

```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Staging Environment

```bash
# Start staging environment
docker-compose -f docker/docker-compose.staging.yml up -d

# View logs
docker-compose -f docker/docker-compose.staging.yml logs -f

# Stop staging
docker-compose -f docker/docker-compose.staging.yml down
```

### Production

See [../docs/DEPLOYMENT_ANYWHERE.md](../docs/DEPLOYMENT_ANYWHERE.md) for production deployment instructions.

## Services

The Docker Compose configuration includes:
- **playlist-lab-server** - Express.js API server (v2.0.0)

## Configuration

### Environment Variables

Create a `.env` file in the project root with:

```env
# Server Configuration
NODE_ENV=production
PORT=3001
SESSION_SECRET=your-secret-here-change-in-production

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_PATH=/data/playlist-lab.db

# Logging
LOG_LEVEL=info

# Cache Settings
CACHE_MAX_AGE_HOURS=24

# Scraper Schedule (cron format)
SCRAPER_SCHEDULE=0 2 * * *

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Volumes

- `playlist-lab-data` - Database files (persisted)
- `playlist-lab-logs` - Server logs (persisted)

### Ports

- `3001` - API server (default)

## Docker Image Details

### Multi-Stage Build

The Dockerfile uses a multi-stage build process:

1. **Builder Stage** (node:20-alpine)
   - Installs all dependencies
   - Builds shared package
   - Builds server

2. **Production Stage** (node:20-alpine)
   - Installs only production dependencies
   - Copies built artifacts
   - Runs as non-root user
   - Includes dumb-init for proper signal handling

### Security Features

- Runs as non-root user (`node`)
- Uses dumb-init for proper signal handling
- Minimal Alpine Linux base image
- Only production dependencies included
- Health checks enabled

### Health Checks

The container includes health checks that verify:
- Server is responding on port 3001
- `/api/health` endpoint returns 200 OK
- Checks every 30 seconds
- 3 retries before marking unhealthy

## Building the Image

### Build Locally

```bash
# From project root
docker build -f docker/Dockerfile -t playlist-lab-server:latest .
```

### Build with Docker Compose

```bash
# From project root
docker-compose -f docker/docker-compose.yml build
```

## Running the Container

### Using Docker Compose (Recommended)

```bash
# Start
docker-compose -f docker/docker-compose.yml up -d

# Check status
docker-compose -f docker/docker-compose.yml ps

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop
docker-compose -f docker/docker-compose.yml down
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
  --restart unless-stopped \
  playlist-lab-server:latest
```

## Accessing the Server

Once running, the server is available at:
- API: http://localhost:3001
- Health Check: http://localhost:3001/api/health
- API Documentation: http://localhost:3001 (root shows available endpoints)

## Data Persistence

Data is persisted in Docker volumes:

```bash
# List volumes
docker volume ls | grep playlist-lab

# Inspect volume
docker volume inspect playlist-lab-data

# Backup database
docker run --rm \
  -v playlist-lab-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/playlist-lab-backup.tar.gz -C /data .

# Restore database
docker run --rm \
  -v playlist-lab-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/playlist-lab-backup.tar.gz -C /data
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker/docker-compose.yml logs

# Check container status
docker-compose -f docker/docker-compose.yml ps

# Rebuild image
docker-compose -f docker/docker-compose.yml build --no-cache
```

### Health check failing

```bash
# Check health status
docker inspect playlist-lab-server | grep -A 10 Health

# Test health endpoint manually
docker exec playlist-lab-server wget -O- http://localhost:3001/api/health
```

### Permission issues

```bash
# Ensure volumes have correct permissions
docker exec playlist-lab-server ls -la /data
docker exec playlist-lab-server ls -la /app/logs
```

### Database locked

```bash
# Stop container
docker-compose -f docker/docker-compose.yml down

# Remove database lock
docker run --rm -v playlist-lab-data:/data alpine rm -f /data/playlist-lab.db-wal /data/playlist-lab.db-shm

# Restart
docker-compose -f docker/docker-compose.yml up -d
```

## Production Deployment

For production deployment:

1. Use `docker-compose.staging.yml` as a template
2. Configure reverse proxy (nginx/traefik)
3. Set up SSL/TLS certificates
4. Configure proper environment variables
5. Set up backup strategy
6. Configure monitoring and logging

See [../docs/DEPLOYMENT_ANYWHERE.md](../docs/DEPLOYMENT_ANYWHERE.md) for detailed instructions.

## CI/CD Integration

The Docker image is automatically built and published via GitHub Actions when you push a version tag:

```bash
git tag v2.0.1
git push origin v2.0.1
```

This triggers the CI/CD pipeline which:
- Builds the Docker image
- Pushes to Docker Hub
- Creates a GitHub Release

See [../docs/GITHUB_ACTIONS_SETUP.md](../docs/GITHUB_ACTIONS_SETUP.md) for details.

## Notes

- The server runs on port 3001 (not 3000) to match the project standard
- Database is stored in `/data/playlist-lab.db` inside the container
- Logs are written to `/app/logs` inside the container
- The container runs as the `node` user (non-root) for security
- Health checks ensure the container is restarted if unhealthy
- Volumes persist data between container restarts
- Use `dumb-init` for proper signal handling and zombie process reaping
