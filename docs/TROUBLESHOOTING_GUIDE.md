# Playlist Lab Server - Troubleshooting Guide

## Issue: Buttons Not Working in Tray App

### Symptoms
- Start/Stop/Restart buttons are grayed out or don't respond
- Copy URL button doesn't work
- No logs appear in the log viewer
- Server shows as "Stopped" but won't start

### Diagnostic Steps

#### Step 1: Verify Installation

Open Command Prompt and run:
```cmd
dir "C:\Program Files\Playlist Lab Server"
```

You should see:
- `nodejs\` folder (contains Node.js)
- `server\` folder (contains the server application)
- `tray-app\` folder (contains the tray application)
- `README.md`

#### Step 2: Check Server Files

```cmd
dir "C:\Program Files\Playlist Lab Server\server\dist"
```

You should see `index.js` file.

#### Step 3: Test Node.js

```cmd
"C:\Program Files\Playlist Lab Server\nodejs\node.exe" --version
```

Should display Node.js version (e.g., `v20.11.0`)

#### Step 4: Check Data Directory

```cmd
dir "%APPDATA%\PlaylistLabServer"
```

This directory should exist. If it doesn't, create it:
```cmd
mkdir "%APPDATA%\PlaylistLabServer"
```

#### Step 5: Check for Port Conflicts

```cmd
netstat -ano | findstr :3000
```

If you see output, another application is using port 3000. You'll need to either:
- Stop that application
- Change the server port (see Configuration section)

### Common Fixes

#### Fix 1: Run as Administrator

The tray app may need administrator privileges:

1. Close the tray app (right-click tray icon → Exit)
2. Go to Start Menu → Playlist Lab Server Manager
3. Right-click → Run as Administrator
4. Try starting the server again

#### Fix 2: Manual Server Start

Test if the server can start manually:

```cmd
cd "C:\Program Files\Playlist Lab Server"
nodejs\node.exe server\dist\index.js
```

If you see errors, note them down - they'll help diagnose the issue.

Press `Ctrl+C` to stop the server.

#### Fix 3: Reset Configuration

If configuration is corrupted:

```cmd
del "%APPDATA%\PlaylistLabServer\tray-preferences.json"
del "C:\Program Files\Playlist Lab Server\server\.env"
```

Then restart the tray app. It will create new configuration files with defaults.

#### Fix 4: Check Windows Firewall

Windows Firewall might be blocking the server:

```cmd
netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000
```

#### Fix 5: Reinstall

If nothing else works:

1. Uninstall via Settings → Apps
2. Delete remaining files:
   ```cmd
   rmdir /s /q "C:\Program Files\Playlist Lab Server"
   rmdir /s /q "%APPDATA%\PlaylistLabServer"
   ```
3. Download and run the installer again

## Issue: Copy URL Button Not Working

### Quick Fix

Instead of using the copy button:
1. Click on the URL text (`http://localhost:3000`)
2. Press `Ctrl+A` to select all
3. Press `Ctrl+C` to copy

### Permanent Fix

The copy button requires clipboard permissions. If it's not working:

1. Check if the tray app has clipboard access
2. Try running as Administrator
3. Update to the latest version

## Remote Access Setup

### Step 1: Find Your IP Address

```cmd
ipconfig
```

Look for "IPv4 Address" under your active network adapter (e.g., `192.168.1.100`)

### Step 2: Configure Firewall

Allow incoming connections on port 3000:

```cmd
netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000
```

### Step 3: Test Local Access

On the same computer, open a browser and go to:
```
http://localhost:3000
```

If this works, proceed to Step 4.

### Step 4: Test Network Access

On another device on the same network (phone, tablet, another computer):

1. Open a web browser
2. Go to: `http://YOUR_IP_ADDRESS:3000`
   - Replace `YOUR_IP_ADDRESS` with the IP from Step 1
   - Example: `http://192.168.1.100:3000`

### Step 5: Troubleshoot Network Access

If Step 4 doesn't work:

**Check Windows Firewall:**
```cmd
netsh advfirewall firewall show rule name="Playlist Lab Server"
```

**Temporarily disable firewall to test:**
```cmd
netsh advfirewall set allprofiles state off
```

Try accessing again. If it works, the firewall is blocking it.

**Re-enable firewall:**
```cmd
netsh advfirewall set allprofiles state on
```

**Check if server is listening on all interfaces:**

The server should listen on `0.0.0.0:3000` (all interfaces), not just `127.0.0.1:3000` (localhost only).

Edit `C:\Program Files\Playlist Lab Server\server\.env` and ensure there's no `HOST=127.0.0.1` line.

### Step 6: Router Configuration (Optional - Internet Access)

To access from outside your network:

1. **Log into your router** (usually `192.168.1.1` or `192.168.0.1`)
2. **Find Port Forwarding** settings
3. **Add a new rule:**
   - External Port: 3000
   - Internal IP: Your computer's IP (from Step 1)
   - Internal Port: 3000
   - Protocol: TCP
4. **Save** the rule

Now you can access via your public IP address:
```
http://YOUR_PUBLIC_IP:3000
```

Find your public IP at: https://whatismyipaddress.com/

**⚠️ Security Warning:**
- This exposes your server to the internet
- Anyone with your IP can access it
- Consider using a VPN instead
- Or set up HTTPS with authentication

### Step 7: Dynamic DNS (Optional)

If your public IP changes frequently:

1. Sign up for a free Dynamic DNS service:
   - No-IP: https://www.noip.com/
   - DuckDNS: https://www.duckdns.org/
   - Dynu: https://www.dynu.com/

2. Install their client software

3. Access your server via the hostname:
   ```
   http://yourname.ddns.net:3000
   ```

### Step 8: HTTPS Setup (Recommended for Internet Access)

For secure remote access:

1. **Install Caddy** (automatic HTTPS):
   - Download from: https://caddyserver.com/download
   - Extract to `C:\caddy\`

2. **Create Caddyfile** at `C:\caddy\Caddyfile`:
   ```
   yourname.ddns.net {
       reverse_proxy localhost:3000
   }
   ```

3. **Run Caddy:**
   ```cmd
   cd C:\caddy
   caddy run
   ```

4. **Access securely:**
   ```
   https://yourname.ddns.net
   ```

Caddy automatically gets and renews SSL certificates from Let's Encrypt.

## Advanced Troubleshooting

### Enable Debug Logging

Edit `C:\Program Files\Playlist Lab Server\server\.env`:
```
LOG_LEVEL=debug
```

Restart the server. Check logs at:
```
%APPDATA%\PlaylistLabServer\server.log
```

### Check Event Viewer

Windows Event Viewer may have additional error information:

1. Press `Win+R`
2. Type `eventvwr.msc`
3. Go to: Windows Logs → Application
4. Look for errors from "Node.js" or "PlaylistLabServer"

### Test Server Directly

Start the server manually and test the API:

```cmd
cd "C:\Program Files\Playlist Lab Server"
nodejs\node.exe server\dist\index.js
```

In another Command Prompt:
```cmd
curl http://localhost:3000/health
```

Should return: `{"status":"ok"}`

### Check Process

See if the server is running:

```cmd
tasklist | findstr node
```

If you see `node.exe`, the server is running.

Kill it if needed:
```cmd
taskkill /F /IM node.exe
```

### Database Issues

If the database is corrupted:

```cmd
del "%APPDATA%\PlaylistLabServer\playlist-lab.db"
```

The server will create a new database on next start.

**⚠️ Warning:** This deletes all your playlists and settings!

### Backup Before Troubleshooting

Always backup your data first:

```cmd
mkdir "%USERPROFILE%\Documents\PlaylistLabBackup"
copy "%APPDATA%\PlaylistLabServer\playlist-lab.db" "%USERPROFILE%\Documents\PlaylistLabBackup\"
copy "C:\Program Files\Playlist Lab Server\server\.env" "%USERPROFILE%\Documents\PlaylistLabBackup\"
```

## Getting Help

If you're still having issues:

1. **Collect diagnostic information:**
   ```cmd
   echo System Info > diagnostic.txt
   systeminfo >> diagnostic.txt
   echo. >> diagnostic.txt
   echo Node Version >> diagnostic.txt
   "C:\Program Files\Playlist Lab Server\nodejs\node.exe" --version >> diagnostic.txt
   echo. >> diagnostic.txt
   echo Server Files >> diagnostic.txt
   dir "C:\Program Files\Playlist Lab Server\server\dist" >> diagnostic.txt
   echo. >> diagnostic.txt
   echo Data Directory >> diagnostic.txt
   dir "%APPDATA%\PlaylistLabServer" >> diagnostic.txt
   echo. >> diagnostic.txt
   echo Port Check >> diagnostic.txt
   netstat -ano | findstr :3000 >> diagnostic.txt
   ```

2. **Check the logs:**
   ```
   %APPDATA%\PlaylistLabServer\server.log
   %APPDATA%\PlaylistLabServer\server-error.log
   ```

3. **Create a GitHub issue** with:
   - The diagnostic.txt file
   - The log files
   - Description of what you were trying to do
   - Any error messages you saw

## FAQ

**Q: Can I change the port?**
A: Yes, edit `C:\Program Files\Playlist Lab Server\server\.env` and change `PORT=3000` to your desired port.

**Q: Can I run multiple instances?**
A: Not easily. Each instance needs its own port and data directory.

**Q: Does it work on Windows 7?**
A: Windows 10 or higher is required.

**Q: Can I access it from my phone?**
A: Yes, follow the Remote Access Setup section.

**Q: Is my data encrypted?**
A: The database is not encrypted by default. Use Windows BitLocker for disk encryption.

**Q: Can I use a different database?**
A: Currently only SQLite is supported.

**Q: How do I update?**
A: Download the new installer and run it. Your data will be preserved.

**Q: How do I uninstall?**
A: Settings → Apps → Playlist Lab Server → Uninstall

**Q: Will uninstalling delete my data?**
A: No, your data in `%APPDATA%\PlaylistLabServer` is preserved.

**Q: How do I completely remove everything?**
A: After uninstalling, delete `%APPDATA%\PlaylistLabServer` manually.
