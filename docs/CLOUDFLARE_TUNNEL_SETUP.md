# Cloudflare Tunnel Setup Guide (Free)

Cloudflare Tunnel lets you expose your Playlist Lab Server to the internet without port forwarding, completely free! It includes automatic HTTPS, DDoS protection, and works even behind restrictive firewalls.

## What You Get (Free)

- ✅ No port forwarding needed
- ✅ Automatic HTTPS/SSL certificates
- ✅ DDoS protection
- ✅ Works behind CGNAT/restrictive ISPs
- ✅ Custom domain support
- ✅ Free forever for personal use

## Prerequisites

- A domain name (you can use a free subdomain from Cloudflare)
- Playlist Lab Server installed and running
- Windows, macOS, or Linux

## Step-by-Step Setup

### Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with your email (completely free)
3. Verify your email address

### Step 2: Add Your Domain (or Get a Free One)

#### Option A: Use Your Own Domain

1. In Cloudflare dashboard, click "Add a site"
2. Enter your domain name (e.g., `yourdomain.com`)
3. Select the "Free" plan
4. Follow instructions to change your domain's nameservers to Cloudflare's
5. Wait for DNS propagation (usually 5-30 minutes)

#### Option B: Use a Free Subdomain

If you don't have a domain, you can use a free service:

1. **Get a free domain from**:
   - DuckDNS: https://www.duckdns.org/ (e.g., `myplaylist.duckdns.org`)
   - FreeDNS: https://freedns.afraid.org/
   - No-IP: https://www.noip.com/

2. **Add it to Cloudflare** as described in Option A

### Step 3: Install Cloudflared

#### Windows:

1. **Download cloudflared**:
   - Visit: https://github.com/cloudflare/cloudflared/releases/latest
   - Download `cloudflared-windows-amd64.exe`

2. **Rename and move**:
   ```cmd
   # Rename the file to cloudflared.exe
   # Move it to C:\Windows\System32\ (or add to PATH)
   ```

3. **Verify installation**:
   ```cmd
   cloudflared --version
   ```

#### macOS:

```bash
brew install cloudflare/cloudflare/cloudflared
```

#### Linux:

```bash
# Debian/Ubuntu
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Or use package manager
sudo apt install cloudflared
```

### Step 4: Authenticate Cloudflared

1. **Run the login command**:
   ```cmd
   cloudflared tunnel login
   ```

2. **Browser will open** - select your domain from the list

3. **Authorize** - click "Authorize"

4. **Success!** - You'll see a confirmation message

### Step 5: Create a Tunnel

1. **Create the tunnel**:
   ```cmd
   cloudflared tunnel create playlist-lab
   ```

2. **Note the Tunnel ID** - you'll see output like:
   ```
   Created tunnel playlist-lab with id: abc123def-456g-789h-012i-345jklmnopqr
   ```

3. **Credentials file created** at:
   - Windows: `C:\Users\YourName\.cloudflared\abc123def-456g-789h-012i-345jklmnopqr.json`
   - macOS/Linux: `~/.cloudflared/abc123def-456g-789h-012i-345jklmnopqr.json`

### Step 6: Configure the Tunnel

1. **Create config file**:
   - Windows: `C:\Users\YourName\.cloudflared\config.yml`
   - macOS/Linux: `~/.cloudflared/config.yml`

2. **Add this configuration** (replace `TUNNEL-ID` with your actual ID):
   ```yaml
   tunnel: TUNNEL-ID
   credentials-file: C:\Users\YourName\.cloudflared\TUNNEL-ID.json
   
   ingress:
     - hostname: playlist.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```

   **Example**:
   ```yaml
   tunnel: abc123def-456g-789h-012i-345jklmnopqr
   credentials-file: C:\Users\John\.cloudflared\abc123def-456g-789h-012i-345jklmnopqr.json
   
   ingress:
     - hostname: playlist.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```

### Step 7: Route DNS to Your Tunnel

```cmd
cloudflared tunnel route dns playlist-lab playlist.yourdomain.com
```

This creates a CNAME record in Cloudflare pointing to your tunnel.

### Step 8: Update Playlist Lab Configuration

1. **Edit the .env file**:
   - Location: `C:\Program Files\Playlist Lab Server\server\.env`

2. **Update these settings**:
   ```env
   # Your Cloudflare domain
   CORS_ORIGIN=https://playlist.yourdomain.com
   
   # Enable proxy mode
   TRUST_PROXY=true
   
   # Secure cookies for HTTPS
   COOKIE_SECURE=true
   COOKIE_SAMESITE=none
   ```

3. **Save the file**

4. **Restart Playlist Lab Server**:
   - Use the "Stop Server" shortcut
   - Then "Start Server" shortcut
   - Or restart the Windows service if installed as a service

### Step 9: Start the Tunnel

#### Option A: Run Manually (Testing)

```cmd
cloudflared tunnel run playlist-lab
```

Keep this window open. You should see:
```
Connection registered
```

#### Option B: Install as Windows Service (Recommended)

1. **Install the service**:
   ```cmd
   cloudflared service install
   ```

2. **Start the service**:
   ```cmd
   sc start cloudflared
   ```

3. **Set to start automatically**:
   ```cmd
   sc config cloudflared start=auto
   ```

The tunnel will now start automatically when Windows boots!

### Step 10: Test Your Connection

1. **Open your browser**
2. **Visit**: `https://playlist.yourdomain.com`
3. **You should see** the Playlist Lab login page!
4. **Sign in with Plex** and start using it remotely

## Managing Your Tunnel

### Check Tunnel Status

```cmd
cloudflared tunnel list
```

### View Tunnel Info

```cmd
cloudflared tunnel info playlist-lab
```

### Stop the Tunnel

```cmd
# If running manually: Press Ctrl+C

# If running as service:
sc stop cloudflared
```

### Start the Tunnel

```cmd
# If running manually:
cloudflared tunnel run playlist-lab

# If running as service:
sc start cloudflared
```

### View Tunnel Logs

```cmd
# If running as service:
cloudflared service uninstall
cloudflared tunnel run playlist-lab
# Watch the output
```

### Delete a Tunnel

```cmd
# Stop the tunnel first
sc stop cloudflared

# Delete the tunnel
cloudflared tunnel delete playlist-lab
```

## Troubleshooting

### "Tunnel credentials file not found"

Make sure the path in `config.yml` matches where the credentials file was created:
```cmd
dir C:\Users\YourName\.cloudflared\
```

### "Connection refused" or "502 Bad Gateway"

1. **Check Playlist Lab is running**:
   ```cmd
   curl http://localhost:3001
   ```

2. **Check the port in config.yml** matches (should be 3001)

3. **Check firewall** isn't blocking localhost connections

### "DNS record not found"

1. **Check DNS was routed**:
   ```cmd
   cloudflared tunnel route dns playlist-lab playlist.yourdomain.com
   ```

2. **Wait a few minutes** for DNS propagation

3. **Check in Cloudflare dashboard**:
   - Go to DNS settings
   - Look for a CNAME record pointing to `TUNNEL-ID.cfargotunnel.com`

### Can't access from outside network

1. **Test from your phone** (disable WiFi, use cellular)
2. **Check tunnel is running**:
   ```cmd
   cloudflared tunnel list
   ```
3. **Check Cloudflare dashboard** for any errors

### CORS errors in browser

1. **Verify .env settings**:
   ```env
   CORS_ORIGIN=https://playlist.yourdomain.com
   ```

2. **Restart Playlist Lab Server**

3. **Clear browser cache** and try again

## Advanced Configuration

### Multiple Subdomains

You can route multiple subdomains through one tunnel:

```yaml
tunnel: TUNNEL-ID
credentials-file: C:\Users\YourName\.cloudflared\TUNNEL-ID.json

ingress:
  - hostname: playlist.yourdomain.com
    service: http://localhost:3001
  - hostname: admin.yourdomain.com
    service: http://localhost:3001
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

Then route each subdomain:
```cmd
cloudflared tunnel route dns playlist-lab playlist.yourdomain.com
cloudflared tunnel route dns playlist-lab admin.yourdomain.com
cloudflared tunnel route dns playlist-lab api.yourdomain.com
```

### Access Rules (Restrict Access)

In Cloudflare dashboard:

1. Go to "Zero Trust" → "Access" → "Applications"
2. Click "Add an application"
3. Choose "Self-hosted"
4. Set your domain: `playlist.yourdomain.com`
5. Add access policies (e.g., email domain, country, IP range)

This lets you restrict who can access your server!

### Cloudflare Firewall Rules

Add extra security in Cloudflare dashboard:

1. Go to "Security" → "WAF"
2. Create rules to:
   - Block specific countries
   - Rate limit requests
   - Block known bots
   - Require CAPTCHA for suspicious traffic

## Costs

Cloudflare Tunnel is **completely free** for personal use! There are no bandwidth limits, no connection limits, and no time limits.

The only cost would be if you need:
- Advanced features (Zero Trust Access, Teams, etc.) - optional
- A custom domain name - typically $10-15/year (or use free alternatives)

## Benefits Over Port Forwarding

| Feature | Port Forwarding | Cloudflare Tunnel |
|---------|----------------|-------------------|
| Setup Difficulty | Medium | Easy |
| Port Forwarding Required | Yes | No |
| Works Behind CGNAT | No | Yes |
| Automatic HTTPS | No | Yes |
| DDoS Protection | No | Yes |
| Firewall Friendly | No | Yes |
| IP Address Hidden | No | Yes |
| Free | Yes | Yes |

## Security Notes

1. **Cloudflare can see your traffic** - they act as a reverse proxy
2. **Still use Plex authentication** - Cloudflare doesn't replace app security
3. **Enable Access rules** for additional protection
4. **Monitor Cloudflare analytics** for suspicious activity
5. **Keep Playlist Lab updated** for security patches

## Next Steps

Once your tunnel is running:

1. **Test from different networks** (mobile data, friend's WiFi)
2. **Add to favorites** on all your devices
3. **Share the URL** with family/friends who use your Plex server
4. **Set up automatic backups** of your Playlist Lab database
5. **Monitor the logs** occasionally for any issues

---

**Congratulations!** Your Playlist Lab Server is now accessible from anywhere in the world, with automatic HTTPS and DDoS protection, completely free! 🎉
