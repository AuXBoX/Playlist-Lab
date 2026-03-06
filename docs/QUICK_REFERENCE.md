# Playlist Lab Server - Quick Reference Card

## 🚀 Quick Start

### Access the Server
```
http://localhost:3000
```

### Start the Server
1. Look for tray icon (bottom-right corner)
2. Double-click to open window
3. Click "Start" button

### Stop the Server
1. Open tray app window
2. Click "Stop" button

## 🔧 Quick Fixes

### Buttons Not Working?
```cmd
REM Run as Administrator
Right-click Start Menu → Playlist Lab Server Manager → Run as Administrator
```

### Port Already in Use?
```cmd
REM Check what's using port 3000
netstat -ano | findstr :3000

REM Or change the port
notepad "C:\Program Files\Playlist Lab Server\server\.env"
REM Change: PORT=3000 to PORT=3001
```

### Server Won't Start?
```cmd
REM Test manually
cd "C:\Program Files\Playlist Lab Server"
nodejs\node.exe server\dist\index.js
```

### Copy URL Not Working?
```
1. Click the URL text
2. Press Ctrl+A (select all)
3. Press Ctrl+C (copy)
```

## 📱 Remote Access (Simple)

### Step 1: Get Your IP
```cmd
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.1.100)

### Step 2: Allow Firewall
```cmd
netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000
```

### Step 3: Access from Phone/Tablet
```
http://192.168.1.100:3000
```
(Use your actual IP address)

## 🔍 Diagnostics

### Run Diagnostic Script
```cmd
cd path\to\playlist-lab
scripts\diagnose-windows.bat
```

### Check Logs
```cmd
notepad "%APPDATA%\PlaylistLabServer\server.log"
```

### Check if Server is Running
```cmd
netstat -ano | findstr :3000
```

### Check Installation
```cmd
dir "C:\Program Files\Playlist Lab Server"
```

## 📂 Important Locations

### Installation Directory
```
C:\Program Files\Playlist Lab Server\
```

### Data Directory
```
%APPDATA%\PlaylistLabServer\
```
Full path: `C:\Users\YourName\AppData\Roaming\PlaylistLabServer\`

### Configuration File
```
C:\Program Files\Playlist Lab Server\server\.env
```

### Log Files
```
%APPDATA%\PlaylistLabServer\server.log
%APPDATA%\PlaylistLabServer\server-error.log
```

### Database
```
%APPDATA%\PlaylistLabServer\playlist-lab.db
```

## 🛠️ Common Commands

### Start Server (Manual)
```cmd
cd "C:\Program Files\Playlist Lab Server"
nodejs\node.exe server\dist\index.js
```

### Check Node.js Version
```cmd
"C:\Program Files\Playlist Lab Server\nodejs\node.exe" --version
```

### Test Server Health
```cmd
curl http://localhost:3000/health
```

### Kill Server Process
```cmd
taskkill /F /IM node.exe
```

### Backup Database
```cmd
copy "%APPDATA%\PlaylistLabServer\playlist-lab.db" "%USERPROFILE%\Documents\backup.db"
```

### Reset Configuration
```cmd
del "%APPDATA%\PlaylistLabServer\tray-preferences.json"
del "C:\Program Files\Playlist Lab Server\server\.env"
```

## 🌐 Network Configuration

### Find Your IP Address
```cmd
ipconfig | findstr IPv4
```

### Check Port Usage
```cmd
netstat -ano | findstr :3000
```

### Add Firewall Rule
```cmd
netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000
```

### Remove Firewall Rule
```cmd
netsh advfirewall firewall delete rule name="Playlist Lab Server"
```

### Test from Another Computer
```cmd
REM On the other computer
curl http://YOUR_IP:3000/health
```

## 🔐 Security

### Change Port
Edit: `C:\Program Files\Playlist Lab Server\server\.env`
```
PORT=3001
```

### Enable HTTPS (with Caddy)
1. Download Caddy: https://caddyserver.com/download
2. Create Caddyfile:
```
yourname.ddns.net {
    reverse_proxy localhost:3000
}
```
3. Run: `caddy run`

## 📋 Troubleshooting Checklist

- [ ] Installation directory exists
- [ ] Server files present (`server\dist\index.js`)
- [ ] Node.js available (`nodejs\node.exe`)
- [ ] Data directory exists (`%APPDATA%\PlaylistLabServer`)
- [ ] Port 3000 is free
- [ ] Firewall allows port 3000
- [ ] Running as Administrator (if needed)
- [ ] Configuration file valid
- [ ] Logs show no errors

## 🆘 Get Help

### Run Diagnostics
```cmd
scripts\diagnose-windows.bat
```

### Check Documentation
- `TROUBLESHOOTING_GUIDE.md` - Detailed troubleshooting
- `docs/WINDOWS_INSTALLER_GUIDE.md` - Installation guide
- `docs/USER_GUIDE.md` - User manual

### Check Logs
```cmd
type "%APPDATA%\PlaylistLabServer\server.log"
```

### System Information
```cmd
systeminfo | findstr /C:"OS Name" /C:"OS Version"
```

## 💡 Tips

### Tip 1: Use Keyboard Shortcuts
- `Ctrl+C` - Copy
- `Ctrl+V` - Paste
- `Win+R` - Run dialog
- `Win+E` - File Explorer

### Tip 2: Quick Access to Folders
```cmd
REM Open data folder
explorer "%APPDATA%\PlaylistLabServer"

REM Open installation folder
explorer "C:\Program Files\Playlist Lab Server"
```

### Tip 3: Create Desktop Shortcuts
Right-click Desktop → New → Shortcut:
- Target: `http://localhost:3000`
- Name: "Playlist Lab"

### Tip 4: Bookmark in Browser
Add `http://localhost:3000` to your browser bookmarks

### Tip 5: Mobile Access
Save `http://YOUR_IP:3000` as a bookmark on your phone

## 📞 Support

### Before Asking for Help

1. Run the diagnostic script
2. Check the logs
3. Try the quick fixes
4. Read the troubleshooting guide

### When Reporting Issues

Include:
- Diagnostic report
- Log files
- Error messages
- What you were trying to do
- Steps to reproduce

### Useful Information

```cmd
REM System info
systeminfo

REM Node version
"C:\Program Files\Playlist Lab Server\nodejs\node.exe" --version

REM Check files
dir "C:\Program Files\Playlist Lab Server\server\dist"

REM Check data
dir "%APPDATA%\PlaylistLabServer"

REM Check port
netstat -ano | findstr :3000
```

## 🎯 Common Scenarios

### Scenario 1: Fresh Install
1. Run installer
2. Launch tray app
3. Click Start
4. Open browser to `http://localhost:3000`
5. Connect to Plex

### Scenario 2: Can't Start Server
1. Run diagnostic script
2. Check if port 3000 is free
3. Try running as Administrator
4. Check logs for errors

### Scenario 3: Remote Access
1. Get your IP: `ipconfig`
2. Allow firewall: `netsh advfirewall...`
3. Test locally: `http://localhost:3000`
4. Test remotely: `http://YOUR_IP:3000`

### Scenario 4: Update to New Version
1. Backup database
2. Download new installer
3. Run installer (will upgrade)
4. Launch tray app
5. Verify everything works

### Scenario 5: Uninstall
1. Stop server
2. Settings → Apps → Uninstall
3. (Optional) Delete `%APPDATA%\PlaylistLabServer`

## 📚 Additional Resources

- **Main README**: `README.md`
- **Installation Guide**: `docs/WINDOWS_INSTALLER_GUIDE.md`
- **User Guide**: `docs/USER_GUIDE.md`
- **Troubleshooting**: `TROUBLESHOOTING_GUIDE.md`
- **API Documentation**: `docs/API.md`

---

**Quick Help**: Run `scripts\diagnose-windows.bat` for automated diagnostics
