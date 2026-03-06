# Playlist Lab Server

Welcome to Playlist Lab Server! This is a self-hosted music playlist management system that integrates with your Plex Media Server to create intelligent playlists and mixes.

## Quick Start

### ⚠️ Buttons Not Working?

If you see the Server Manager window but the Start/Stop/Restart buttons are grayed out or not working:

1. **Close and restart the Server Manager** (right-click tray icon → Exit, then relaunch)
2. **Run as Administrator**: Right-click the Server Manager shortcut → "Run as Administrator"
3. **Check installation**: Verify files exist at `C:\Program Files\Playlist Lab Server` (Windows)
4. **See the [Tray App Troubleshooting Guide](TRAY_APP_TROUBLESHOOTING.md)** for detailed solutions

### Normal Startup

1. **Access the Web Interface**: Open your browser and go to:
   ```
   http://localhost:3000
   ```

2. **Launch the Server Manager**: Use the system tray/menu bar application to control the server:
   - **Windows**: Look for the Playlist Lab icon in your system tray (bottom-right corner)
   - **macOS**: Look for the Playlist Lab icon in your menu bar (top-right corner)
   - **Linux**: Look for the Playlist Lab icon in your system tray (varies by desktop environment)

3. **Connect to Plex**: Follow the setup wizard in the web interface to connect your Plex Media Server

## What You Installed

You've installed the **Playlist Lab Server** - a Node.js application that runs in the background on your computer. This is different from the Playlist Lab desktop application.

### Installation Mode

Your server is running in one of these modes:

- **Service Mode**: The server runs as a system service (Windows Service, macOS launchd, or Linux systemd)
- **Startup Mode**: The server starts automatically when you log in
- **Standalone Mode**: You manually start/stop the server when needed

You can check your installation mode in the Server Manager tray application.

## Managing the Server

### Using the Server Manager (Tray Application)

The easiest way to manage your server is through the Server Manager tray application:

#### Windows
- **Find it**: System tray icon in the notification area (bottom-right corner)
- **Open Manager**: Double-click the tray icon
- **Quick Menu**: Right-click the tray icon for quick actions
- **Launch**: Start Menu → Playlist Lab Server Manager

#### macOS
- **Find it**: Menu bar icon (top-right corner)
- **Open Manager**: Click the menu bar icon and select "Show Window"
- **Quick Menu**: Click the menu bar icon for quick actions
- **Launch**: Applications → Playlist Lab Server Manager

#### Linux
- **Find it**: System tray icon (location varies by desktop environment)
- **Open Manager**: Double-click the tray icon
- **Quick Menu**: Right-click the tray icon for quick actions
- **Launch**: Applications menu → Utilities → Playlist Lab Server Manager

### Server Manager Features

The Server Manager window provides:

- **Status Indicator**: Visual indicator showing if the server is running, stopped, or has errors
- **Server URL**: The address to access the web interface (with copy button)
- **Control Buttons**: Start, Stop, and Restart the server
- **Log Viewer**: Real-time view of server logs
- **Quick Actions**: Open web interface, open log folder

### Manual Server Management

If you prefer command-line control or the tray app isn't available:

#### Windows (Service Mode)
```cmd
# Start the server
sc start PlaylistLabServer

# Stop the server
sc stop PlaylistLabServer

# Check status
sc query PlaylistLabServer
```

#### Windows (Startup/Standalone Mode)
```cmd
# Navigate to installation directory
cd "C:\Program Files\Playlist Lab Server"

# Start the server
node server\src\index.js
```

#### macOS (Service Mode)
```bash
# Start the server
launchctl load ~/Library/LaunchAgents/com.playlistlab.server.plist

# Stop the server
launchctl unload ~/Library/LaunchAgents/com.playlistlab.server.plist

# Check status
launchctl list | grep playlist-lab-server
```

#### macOS (Startup/Standalone Mode)
```bash
# Navigate to installation directory
cd "/Applications/Playlist Lab Server.app/Contents/Resources"

# Start the server
node server/src/index.js
```

#### Linux (Service Mode)
```bash
# Start the server
systemctl start playlist-lab-server

# Stop the server
systemctl stop playlist-lab-server

# Check status
systemctl status playlist-lab-server

# Enable auto-start on boot
systemctl enable playlist-lab-server
```

#### Linux (Startup/Standalone Mode)
```bash
# Navigate to installation directory
cd /opt/playlist-lab-server
# or
cd ~/.local/share/playlist-lab-server

# Start the server
node server/src/index.js
```

## Troubleshooting

### Server Won't Start

**Port Already in Use**
- Error: `EADDRINUSE: address already in use :::3000`
- Solution: Another application is using port 3000. Either:
  - Stop the other application
  - Change the port in the configuration file (see Configuration section)

**Permission Errors (Windows Service)**
- Error: Access denied when starting/stopping service
- Solution: Run the Server Manager as Administrator:
  - Right-click the tray app shortcut
  - Select "Run as Administrator"

**Permission Errors (Linux Service)**
- Error: Failed to start service
- Solution: Use `sudo` for service commands:
  ```bash
  sudo systemctl start playlist-lab-server
  ```

### Can't Access Web Interface

**Check Server Status**
- Open the Server Manager and verify the server is running (green status)
- Look for error messages in the log viewer

**Firewall Issues**
- Windows: Allow Node.js through Windows Firewall
- macOS: System Preferences → Security & Privacy → Firewall → Allow incoming connections
- Linux: Configure firewall to allow port 3000:
  ```bash
  sudo ufw allow 3000/tcp
  ```

**Wrong URL**
- Default URL: `http://localhost:3000`
- If you changed the port, use: `http://localhost:YOUR_PORT`
- From another device: `http://YOUR_COMPUTER_IP:3000`

### Tray App Not Appearing

**Windows**
- Check if the icon is hidden: Click the up arrow (^) in the system tray
- Restart the tray app: Start Menu → Playlist Lab Server Manager

**macOS**
- Menu bar icons may be hidden if too many apps are running
- Try quitting other menu bar apps to make space
- Restart the tray app: Applications → Playlist Lab Server Manager

**Linux**
- Some desktop environments don't support system tray icons
- Try using the application window directly (it doesn't require the tray icon)
- GNOME users: Install the "AppIndicator Support" extension

### Server Logs

View detailed logs to diagnose issues:

**Using Server Manager**
- Open the Server Manager window
- Scroll through the log viewer
- Click "Open Log Folder" to view full log files

**Manual Log Access**

Windows:
```
%APPDATA%\PlaylistLabServer\server.log
```
Full path example: `C:\Users\YourName\AppData\Roaming\PlaylistLabServer\server.log`

macOS:
```
~/Library/Application Support/PlaylistLabServer/server.log
```

Linux:
```
~/.local/share/PlaylistLabServer/server.log
```
Or for system service:
```
/var/log/playlist-lab-server/server.log
```

### Common Error Messages

**"Cannot connect to Plex server"**
- Verify your Plex Media Server is running
- Check the Plex server URL in Settings
- Ensure your Plex token is valid

**"Database locked"**
- Another instance of the server may be running
- Stop all instances and restart
- Check Task Manager (Windows), Activity Monitor (macOS), or `ps` (Linux)

**"Failed to load configuration"**
- Configuration file may be corrupted
- Check the `.env` file in the installation directory
- Restore from backup or reinstall

## File Locations

### Windows

**Installation Directory**
```
C:\Program Files\Playlist Lab Server\
```

**Data Directory**
```
%APPDATA%\PlaylistLabServer\
```
Full path example: `C:\Users\YourName\AppData\Roaming\PlaylistLabServer\`

**Key Files**
- Database: `%APPDATA%\PlaylistLabServer\playlist-lab.db`
- Logs: `%APPDATA%\PlaylistLabServer\server.log`
- Configuration: `C:\Program Files\Playlist Lab Server\server\.env`
- Tray Preferences: `%APPDATA%\PlaylistLabServer\tray-preferences.json`

### macOS

**Installation Directory**
```
/Applications/Playlist Lab Server.app/
```

**Data Directory**
```
~/Library/Application Support/PlaylistLabServer/
```

**Key Files**
- Database: `~/Library/Application Support/PlaylistLabServer/playlist-lab.db`
- Logs: `~/Library/Application Support/PlaylistLabServer/server.log`
- Configuration: `/Applications/Playlist Lab Server.app/Contents/Resources/server/.env`
- Tray Preferences: `~/Library/Application Support/PlaylistLabServer/tray-preferences.json`

### Linux

**Installation Directory** (varies by installation method)
```
/opt/playlist-lab-server/
```
Or for user install:
```
~/.local/share/playlist-lab-server/
```

**Data Directory**
```
~/.local/share/PlaylistLabServer/
```
Or for system service:
```
/var/lib/playlist-lab-server/
```

**Key Files**
- Database: `~/.local/share/PlaylistLabServer/playlist-lab.db`
- Logs: `~/.local/share/PlaylistLabServer/server.log` or `/var/log/playlist-lab-server/server.log`
- Configuration: `/opt/playlist-lab-server/server/.env` or `~/.local/share/playlist-lab-server/server/.env`
- Tray Preferences: `~/.config/playlist-lab-server/tray-preferences.json`

## Backup and Maintenance

### Backing Up Your Data

**Important Files to Backup**
1. **Database**: Contains all your playlists, schedules, and settings
2. **Configuration**: Contains your Plex connection and server settings

**Backup Process**

Windows:
```cmd
# Create backup directory
mkdir "%USERPROFILE%\Documents\PlaylistLabBackup"

# Copy database
copy "%APPDATA%\PlaylistLabServer\playlist-lab.db" "%USERPROFILE%\Documents\PlaylistLabBackup\"

# Copy configuration
copy "C:\Program Files\Playlist Lab Server\server\.env" "%USERPROFILE%\Documents\PlaylistLabBackup\"
```

macOS:
```bash
# Create backup directory
mkdir -p ~/Documents/PlaylistLabBackup

# Copy database
cp ~/Library/Application\ Support/PlaylistLabServer/playlist-lab.db ~/Documents/PlaylistLabBackup/

# Copy configuration
cp /Applications/Playlist\ Lab\ Server.app/Contents/Resources/server/.env ~/Documents/PlaylistLabBackup/
```

Linux:
```bash
# Create backup directory
mkdir -p ~/Documents/PlaylistLabBackup

# Copy database
cp ~/.local/share/PlaylistLabServer/playlist-lab.db ~/Documents/PlaylistLabBackup/

# Copy configuration
cp /opt/playlist-lab-server/server/.env ~/Documents/PlaylistLabBackup/
# or
cp ~/.local/share/playlist-lab-server/server/.env ~/Documents/PlaylistLabBackup/
```

### Restoring from Backup

1. Stop the server using the Server Manager
2. Copy the backed-up files to their original locations
3. Start the server using the Server Manager

### Updating the Server

When a new version is released:

1. **Backup your data** (see above)
2. **Download the new installer** from the official website
3. **Run the installer** - it will detect and upgrade your existing installation
4. **Your data and configuration will be preserved**
5. **Launch the Server Manager** to verify everything works

### Uninstalling

**Windows**
1. Stop the server using the Server Manager
2. Go to Settings → Apps → Apps & features
3. Find "Playlist Lab Server" and click Uninstall
4. Your data directory will be preserved (delete manually if desired)

**macOS**
1. Stop the server using the Server Manager
2. Drag "Playlist Lab Server" from Applications to Trash
3. Remove data directory if desired:
   ```bash
   rm -rf ~/Library/Application\ Support/PlaylistLabServer/
   ```

**Linux**
1. Stop the server using the Server Manager
2. Use your package manager:
   ```bash
   # For DEB packages
   sudo apt remove playlist-lab-server
   
   # For RPM packages
   sudo dnf remove playlist-lab-server
   # or
   sudo yum remove playlist-lab-server
   ```
3. Remove data directory if desired:
   ```bash
   rm -rf ~/.local/share/PlaylistLabServer/
   ```

## Advanced Topics

### Changing the Port

If port 3000 is already in use or you want to use a different port:

1. Stop the server
2. Edit the configuration file (`.env`) in the installation directory
3. Find the line: `PORT=3000`
4. Change to your desired port: `PORT=8080`
5. Save the file
6. Start the server
7. Access the web interface at the new port: `http://localhost:8080`

### Accessing from Other Devices

To access the web interface from other devices on your network:

1. Find your computer's IP address:
   - Windows: `ipconfig` in Command Prompt
   - macOS: System Preferences → Network
   - Linux: `ip addr` or `ifconfig`

2. On the other device, open a browser and go to:
   ```
   http://YOUR_COMPUTER_IP:3000
   ```

3. **Firewall Configuration**: Ensure your firewall allows incoming connections on port 3000

### Running as a Service vs Startup App

**Service Mode** (Recommended for always-on servers)
- Starts automatically when the computer boots
- Runs even when no user is logged in
- Requires administrator/root privileges to install
- More reliable for 24/7 operation

**Startup Mode** (Recommended for personal use)
- Starts when you log in
- Stops when you log out
- No special privileges required
- Easier to manage

**Standalone Mode** (Manual control)
- You start/stop the server manually
- Full control over when it runs
- Good for development or testing

### Platform-Specific Service Configuration

**Windows Service**
- Service Name: `PlaylistLabServer`
- Startup Type: Automatic
- Log On As: Local System
- Manage: Services console (`services.msc`)

**macOS launchd**
- Plist Location: `~/Library/LaunchAgents/com.playlistlab.server.plist`
- Manage: `launchctl` commands
- Logs: Console.app or `log show --predicate 'process == "node"'`

**Linux systemd**
- Service File: `/etc/systemd/system/playlist-lab-server.service`
- Manage: `systemctl` commands
- Logs: `journalctl -u playlist-lab-server`

## Remote Access

To access the server from other devices on your network (phones, tablets, other computers):

### Quick Setup

1. **Find your computer's IP address**:
   - Windows: Run `ipconfig` in Command Prompt
   - macOS: System Preferences → Network
   - Linux: Run `ip addr` or `ifconfig`
   - Look for an address like `192.168.1.100` or `10.0.0.50`

2. **Configure your firewall** to allow incoming connections on port 3000:
   - Windows: `netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000`
   - macOS: System Preferences → Security & Privacy → Firewall → Firewall Options → Add port 3000
   - Linux: `sudo ufw allow 3000/tcp` (if using UFW)

3. **Access from other devices**:
   - Open a web browser on the other device
   - Go to: `http://YOUR_COMPUTER_IP:3000`
   - Example: `http://192.168.1.100:3000`

**Important**: Both devices must be on the same network (same WiFi or connected to the same router).

### Troubleshooting Remote Access

- **Can't connect**: Check firewall settings and ensure the server is running
- **IP address changes**: Configure a static IP or DHCP reservation in your router
- **Slow performance**: Ensure both devices have good WiFi signal or use wired connections

For detailed remote access setup, see the [Tray App Troubleshooting Guide](TRAY_APP_TROUBLESHOOTING.md#remote-access-setup).

## Support and Documentation

### Additional Resources

- **Platform-Specific Guides**:
  - [Windows Installation Guide](WINDOWS_INSTALLER_GUIDE.md)
  - [macOS Installation Guide](MACOS_INSTALLER_GUIDE.md) *(coming soon)*
  - [Linux Installation Guide](LINUX_INSTALLER_GUIDE.md) *(coming soon)*

- **Troubleshooting**:
  - [Tray App Troubleshooting Guide](TRAY_APP_TROUBLESHOOTING.md) - **Start here if buttons don't work!**

- **User Guide**: [Complete User Guide](USER_GUIDE.md)
- **API Documentation**: [API Reference](API.md)
- **Developer Guide**: [Developer Documentation](DEVELOPER_GUIDE.md)

### Getting Help

- **GitHub Issues**: Report bugs or request features at [github.com/yourrepo/playlist-lab](https://github.com/yourrepo/playlist-lab)
- **Community**: Join discussions and get help from other users
- **Documentation**: Check the comprehensive guides in the `docs` folder

### Version Information

To check your server version:
1. Open the Server Manager
2. Look at the window title or status section
3. Or check the web interface footer

---

**Thank you for using Playlist Lab Server!** 🎵

We hope you enjoy creating amazing playlists with your Plex music library.
