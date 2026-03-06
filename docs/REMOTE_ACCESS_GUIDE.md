# Remote Access Guide

This guide explains how to access your Playlist Lab Server from anywhere, not just your local network.

## Authentication

Playlist Lab uses **Plex authentication** - no separate passwords needed!

1. Visit your Playlist Lab web interface
2. Click "Sign in with Plex"
3. Authorize the app with your Plex account
4. You're logged in!

Your Plex account credentials are never stored on the Playlist Lab server. The app only receives an authorization token from Plex.

## Remote Access Options

### Option 1: Simple Port Forwarding

**Pros**: Easy to set up
**Cons**: No encryption, exposes server to internet

1. **Find your server's local IP**:
   ```cmd
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., 192.168.1.100)

2. **Forward port 3001** on your router:
   - Log into your router (usually 192.168.1.1 or 192.168.0.1)
   - Find "Port Forwarding" or "Virtual Server" settings
   - Forward external port 3001 to internal IP:3001

3. **Find your public IP**:
   - Visit https://whatismyipaddress.com/

4. **Access remotely**:
   ```
   http://YOUR-PUBLIC-IP:3001
   ```

5. **Update server configuration**:
   Edit `C:\Program Files\Playlist Lab Server\server\.env`:
   ```env
   CORS_ORIGIN=*
   ```
   Restart the server.

**Security Warning**: This method sends data unencrypted over the internet. Only use on trusted networks.

---

### Option 2: Reverse Proxy with HTTPS (Recommended)

**Pros**: Encrypted, professional, works everywhere
**Cons**: Requires domain name and some setup

#### Prerequisites
- A domain name (can use free services like DuckDNS, No-IP, or Cloudflare)
- Port 80 and 443 forwarded to your server

#### Using Caddy (Easiest)

1. **Install Caddy**:
   - Download from https://caddyserver.com/download
   - Or use Chocolatey: `choco install caddy`

2. **Create Caddyfile** (e.g., `C:\Caddy\Caddyfile`):
   ```
   playlist-lab.yourdomain.com {
       reverse_proxy localhost:3001
   }
   ```

3. **Run Caddy**:
   ```cmd
   caddy run --config C:\Caddy\Caddyfile
   ```
   Caddy automatically gets and renews SSL certificates!

4. **Update Playlist Lab configuration**:
   Edit `C:\Program Files\Playlist Lab Server\server\.env`:
   ```env
   CORS_ORIGIN=https://playlist-lab.yourdomain.com
   TRUST_PROXY=true
   COOKIE_SECURE=true
   COOKIE_SAMESITE=none
   ```

5. **Restart Playlist Lab Server**

6. **Access remotely**:
   ```
   https://playlist-lab.yourdomain.com
   ```

#### Using Nginx

1. **Install Nginx**:
   - Download from https://nginx.org/en/download.html

2. **Create config** (`nginx.conf`):
   ```nginx
   server {
       listen 80;
       server_name playlist-lab.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Get SSL certificate** with Certbot:
   ```cmd
   certbot --nginx -d playlist-lab.yourdomain.com
   ```

4. **Update Playlist Lab** (same as Caddy step 4)

---

### Option 3: Cloudflare Tunnel (No Port Forwarding!)

**Pros**: No port forwarding, free SSL, DDoS protection
**Cons**: Requires Cloudflare account

1. **Sign up** at https://cloudflare.com (free)

2. **Add your domain** to Cloudflare

3. **Install Cloudflared**:
   ```cmd
   # Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

4. **Authenticate**:
   ```cmd
   cloudflared tunnel login
   ```

5. **Create tunnel**:
   ```cmd
   cloudflared tunnel create playlist-lab
   ```

6. **Configure tunnel** (`config.yml`):
   ```yaml
   tunnel: <TUNNEL-ID>
   credentials-file: C:\Users\YourUser\.cloudflared\<TUNNEL-ID>.json
   
   ingress:
     - hostname: playlist-lab.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```

7. **Route DNS**:
   ```cmd
   cloudflared tunnel route dns playlist-lab playlist-lab.yourdomain.com
   ```

8. **Run tunnel**:
   ```cmd
   cloudflared tunnel run playlist-lab
   ```

9. **Update Playlist Lab** (same as Option 2, step 4)

---

### Option 4: VPN (Most Secure)

**Pros**: Fully encrypted, no public exposure, works like local network
**Cons**: Requires VPN client on all devices

#### Using Tailscale (Recommended)

1. **Install Tailscale** on your server:
   - Download from https://tailscale.com/download/windows

2. **Sign up and authenticate**

3. **Install Tailscale** on your devices (phone, laptop, etc.)

4. **Access via Tailscale IP**:
   ```
   http://100.x.x.x:3001
   ```
   (Find IP in Tailscale admin console)

5. **No server configuration changes needed!**

#### Using ZeroTier

1. **Create network** at https://my.zerotier.com/

2. **Install ZeroTier** on server and devices

3. **Join network** with Network ID

4. **Access via ZeroTier IP**:
   ```
   http://172.x.x.x:3001
   ```

---

## Dynamic DNS (For Home Networks)

If your ISP changes your public IP address, use a Dynamic DNS service:

### Free Options:
- **DuckDNS**: https://www.duckdns.org/
- **No-IP**: https://www.noip.com/
- **Dynu**: https://www.dynu.com/

### Setup:
1. Create account and choose a hostname (e.g., `myplaylist.duckdns.org`)
2. Install update client on your server
3. Client automatically updates DNS when IP changes
4. Use hostname instead of IP address

---

## Firewall Configuration

### Windows Firewall

Allow incoming connections on port 3001:

```cmd
netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3001
```

Or use Windows Defender Firewall GUI:
1. Open "Windows Defender Firewall with Advanced Security"
2. Click "Inbound Rules" → "New Rule"
3. Select "Port" → TCP → Specific local ports: 3001
4. Allow the connection
5. Apply to all profiles
6. Name it "Playlist Lab Server"

---

## Security Best Practices

1. **Always use HTTPS** for remote access (Option 2 or 3)
2. **Keep server updated** - install updates regularly
3. **Use strong Plex password** - enable 2FA on your Plex account
4. **Monitor access logs** - check `%APPDATA%\PlaylistLabServer\server.log`
5. **Limit admin users** - set `ADMIN_PLEX_IDS` in .env to specific Plex user IDs
6. **Use VPN** when possible (Option 4) for maximum security
7. **Regular backups** - backup `%APPDATA%\PlaylistLabServer\playlist-lab.db`

---

## Troubleshooting

### Can't connect remotely

1. **Check server is running**:
   - Visit http://localhost:3001 on the server itself

2. **Check firewall**:
   ```cmd
   netsh advfirewall firewall show rule name="Playlist Lab Server"
   ```

3. **Check port forwarding**:
   - Use https://www.yougetsignal.com/tools/open-ports/
   - Enter your public IP and port 3001

4. **Check router**:
   - Ensure port forwarding is enabled
   - Some ISPs block incoming connections on residential plans

5. **Check logs**:
   ```
   %APPDATA%\PlaylistLabServer\server.log
   %APPDATA%\PlaylistLabServer\server-error.log
   ```

### CORS errors

If you see CORS errors in browser console:

1. **Update .env**:
   ```env
   CORS_ORIGIN=https://your-domain.com
   # Or allow all (less secure):
   CORS_ORIGIN=*
   ```

2. **Restart server**

### Cookie/session issues

If you can't stay logged in:

1. **For HTTPS access**, update .env:
   ```env
   COOKIE_SECURE=true
   COOKIE_SAMESITE=none
   TRUST_PROXY=true
   ```

2. **For HTTP access** (local/VPN only):
   ```env
   COOKIE_SECURE=false
   COOKIE_SAMESITE=lax
   ```

---

## Mobile Access

The web interface is fully responsive and works great on mobile browsers!

1. **Access via browser**:
   - Use any of the remote access methods above
   - Open in Safari (iOS) or Chrome (Android)

2. **Add to home screen**:
   - iOS: Tap Share → Add to Home Screen
   - Android: Tap Menu → Add to Home Screen
   - Works like a native app!

---

## Multi-User Setup

Playlist Lab supports multiple users through Plex authentication:

1. **Each user signs in** with their own Plex account
2. **Data is isolated** - users only see their own playlists and settings
3. **Admin users** can be designated in .env:
   ```env
   ADMIN_PLEX_IDS=12345,67890
   ```
   (Find Plex user IDs in the Admin page after logging in)

4. **Shared Plex servers** - if users share a Plex server, they can all use Playlist Lab

---

## Performance Tips

For remote access:

1. **Use a wired connection** for the server (not WiFi)
2. **Ensure good upload speed** - at least 5 Mbps for smooth operation
3. **Use Cloudflare** (Option 3) for caching and acceleration
4. **Enable compression** - already enabled by default in Playlist Lab
5. **Close unused browser tabs** - each tab maintains a connection

---

## Need Help?

- Check the logs: `%APPDATA%\PlaylistLabServer\`
- Review the User Guide: `C:\Program Files\Playlist Lab Server\docs\USER_GUIDE.md`
- Check GitHub issues: https://github.com/yourusername/playlist-lab/issues
