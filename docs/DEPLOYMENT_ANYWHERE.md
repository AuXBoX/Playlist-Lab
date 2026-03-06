# Deploy Playlist Lab Anywhere

This guide explains how Playlist Lab's architecture allows it to run on any device and be accessed from anywhere.

## Architecture Overview

Playlist Lab uses a **client-server architecture**:

```
┌─────────────────┐
│   Web Browser   │ ← Access from any device (phone, tablet, laptop)
│  (apps/web)     │
└────────┬────────┘
         │ HTTP/HTTPS
         │ API Calls
         ▼
┌─────────────────┐
│  Backend Server │ ← Runs on one machine (home server, VPS, etc.)
│  (apps/server)  │
│                 │
│  • Database     │
│  • Plex API     │
│  • Scrapers     │
│  • Matching     │
│  • Scheduling   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Plex Server   │
└─────────────────┘
```

## Key Features

✅ **All logic runs on the backend** - No client-side processing
✅ **RESTful API** - Standard HTTP endpoints
✅ **Session-based auth** - Secure authentication with cookies
✅ **SQLite database** - Portable, no external database needed
✅ **Static file serving** - Web app served from the same server
✅ **CORS support** - Can be accessed from different domains

## Deployment Options

### Option 1: Home Server (Recommended)

Run the server on the same machine as your Plex server or any always-on computer.

**Requirements:**
- Node.js 18+ installed
- Network access to Plex server
- Port 3000 available (or configure different port)

**Setup:**
```bash
# Clone the repository
git clone <repo-url>
cd playlist-lab

# Install dependencies
npm install

# Build the server and web app
npm run build

# Start the server
cd apps/server
npm start
```

**Access:**
- Local network: `http://<server-ip>:3000`
- Internet (with port forwarding): `http://<public-ip>:3000`

### Option 2: VPS/Cloud Server

Deploy to a cloud provider for access from anywhere.

**Providers:**
- DigitalOcean ($5/month)
- Linode ($5/month)
- AWS EC2 (free tier available)
- Google Cloud (free tier available)
- Azure (free tier available)

**Setup:**
```bash
# SSH into your server
ssh user@your-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <repo-url>
cd playlist-lab
npm install
npm run build

# Setup as a service (systemd)
sudo cp deployment/playlist-lab.service /etc/systemd/system/
sudo systemctl enable playlist-lab
sudo systemctl start playlist-lab
```

**Access:**
- `https://your-server.com` (with reverse proxy)

### Option 3: Docker Container

Run in a Docker container for easy deployment.

**Setup:**
```bash
# Build the Docker image
docker build -t playlist-lab .

# Run the container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e PLEX_CLIENT_ID=your-client-id \
  --name playlist-lab \
  playlist-lab
```

**Access:**
- `http://<docker-host>:3000`

### Option 4: Reverse Proxy (HTTPS)

Use Nginx or Caddy to add HTTPS and custom domain.

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name playlist.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name playlist.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
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

**Caddy Example (automatic HTTPS):**
```
playlist.yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Environment Configuration

Create a `.env` file in `apps/server/`:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security
SESSION_SECRET=your-random-secret-here-change-this
PLEX_CLIENT_ID=playlist-lab-server

# CORS (if web app is on different domain)
CORS_ORIGIN=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Database
DATABASE_PATH=./data/playlist-lab.db

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/combined.log
```

## Accessing from Different Devices

Once deployed, you can access Playlist Lab from:

### Desktop/Laptop
- Open browser: `http://your-server:3000`
- Bookmark for easy access

### Mobile Phone
- Open browser: `http://your-server:3000`
- Add to home screen for app-like experience

### Tablet
- Same as mobile

### Multiple Users
- Each user logs in with their own Plex account
- Sessions are isolated
- Each user has their own playlists and settings

## Network Access

### Local Network Only
- Server IP: `192.168.x.x:3000`
- Only accessible from same network
- Most secure option

### Internet Access (Port Forwarding)
1. Forward port 3000 on your router to server
2. Access via public IP: `http://<public-ip>:3000`
3. Consider using dynamic DNS for easier access

### Internet Access (VPN)
1. Setup VPN server (WireGuard, OpenVPN)
2. Connect to VPN from anywhere
3. Access via local IP: `http://192.168.x.x:3000`
4. Most secure for internet access

### Internet Access (Reverse Proxy + HTTPS)
1. Setup domain name
2. Configure reverse proxy (Nginx/Caddy)
3. Get SSL certificate (Let's Encrypt)
4. Access via: `https://playlist.yourdomain.com`
5. Best user experience

## Security Considerations

### Production Checklist
- [ ] Change `SESSION_SECRET` to random value
- [ ] Enable HTTPS (reverse proxy or Let's Encrypt)
- [ ] Configure firewall (only allow port 443/80)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Regular backups of database
- [ ] Keep Node.js and dependencies updated
- [ ] Monitor logs for suspicious activity

### Authentication
- Uses Plex OAuth for authentication
- Session cookies for maintaining login
- No passwords stored in database
- Plex tokens encrypted at rest

## Monitoring

### Check Server Status
```bash
# Check if server is running
curl http://localhost:3000/api/health

# View logs
tail -f apps/server/logs/combined.log

# Check systemd service
sudo systemctl status playlist-lab
```

### Performance
- SQLite handles thousands of playlists easily
- Rate limiting prevents abuse
- Compression reduces bandwidth
- Session store uses SQLite (no Redis needed)

## Backup

### Database Backup
```bash
# Backup database
cp apps/server/data/playlist-lab.db backups/playlist-lab-$(date +%Y%m%d).db

# Automated backup (cron)
0 2 * * * cp /path/to/playlist-lab.db /path/to/backups/playlist-lab-$(date +\%Y\%m\%d).db
```

### Full Backup
```bash
# Backup everything
tar -czf playlist-lab-backup.tar.gz \
  apps/server/data/ \
  apps/server/logs/ \
  apps/server/.env
```

## Troubleshooting

### Server won't start
```bash
# Check port availability
netstat -tulpn | grep 3000

# Check logs
cat apps/server/logs/error.log

# Check environment
node --version  # Should be 18+
npm --version
```

### Can't access from other devices
```bash
# Check firewall
sudo ufw status
sudo ufw allow 3000

# Check server is listening on all interfaces
netstat -tulpn | grep 3000
# Should show 0.0.0.0:3000, not 127.0.0.1:3000
```

### CORS errors
- Set `CORS_ORIGIN` in `.env` to your frontend domain
- Or use `CORS_ORIGIN=*` for development (not recommended for production)

## Updating

```bash
# Pull latest changes
git pull

# Rebuild
npm run build

# Restart server
sudo systemctl restart playlist-lab
# or
pm2 restart playlist-lab
```

## Process Management

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start server
cd apps/server
pm2 start npm --name "playlist-lab" -- start

# Auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 monit

# Logs
pm2 logs playlist-lab
```

### Using systemd
```bash
# Create service file
sudo nano /etc/systemd/system/playlist-lab.service

# Enable and start
sudo systemctl enable playlist-lab
sudo systemctl start playlist-lab

# Check status
sudo systemctl status playlist-lab
```

## Conclusion

Playlist Lab is designed to run anywhere:
- ✅ All features in backend
- ✅ Web-based frontend (no installation needed)
- ✅ Portable database (SQLite)
- ✅ Standard HTTP/HTTPS
- ✅ Works on any device with a browser

Deploy once, access from anywhere!
