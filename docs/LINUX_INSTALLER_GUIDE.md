# Playlist Lab Server - Linux Installation Guide

Complete guide for installing and running Playlist Lab Server on Linux.

## Table of Contents

- [Overview](#overview)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Installation Modes](#installation-modes)
- [Configuration](#configuration)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

## Overview

Playlist Lab Server can be installed on Linux in three different modes:

1. **systemd Service** - Runs automatically in the background
2. **Autostart Application** - Starts when you log in
3. **Standalone Application** - Manual start/stop control

The installation includes the **Server Manager** tray application, which provides an easy-to-use interface for managing the server from your system tray.

**Note**: System tray support varies by desktop environment. The Server Manager works best on KDE Plasma, XFCE, Cinnamon, and MATE. GNOME users may need to install the "AppIndicator Support" extension.

## System Requirements

### Minimum Requirements

- **Operating System**: Ubuntu 20.04, Fedora 34, Debian 11, or equivalent
- **RAM**: 512 MB available
- **Disk Space**: 200 MB for installation + space for database
- **Network**: Internet connection for Plex integration
- **Desktop Environment**: Any with system tray support

### Recommended Requirements

- **Operating System**: Ubuntu 22.04, Fedora 38, Debian 12, or equivalent
- **RAM**: 1 GB available
- **Disk Space**: 500 MB
- **Processor**: Dual-core or better

### Supported Distributions

- **Debian-based**: Ubuntu, Debian, Linux Mint, Pop!_OS, Elementary OS
- **Red Hat-based**: Fedora, RHEL, CentOS, Rocky Linux, AlmaLinux
- **Arch-based**: Arch Linux, Manjaro, EndeavourOS
- **SUSE-based**: openSUSE Leap, openSUSE Tumbleweed
- **Others**: Any distribution with systemd and Node.js support

### Prerequisites

- sudo/root access (for system service installation)
- Plex Media Server (for full functionality)
- Modern web browser (for web interface)
- System tray support (for tray application)

## Installation

### Installation Methods

Choose the method that matches your distribution:

1. **DEB Package** (Debian, Ubuntu, Mint, etc.)
2. **RPM Package** (Fedora, RHEL, CentOS, etc.)
3. **AppImage** (Universal, works on all distributions)
4. **Manual Installation** (From source)

### Method 1: DEB Package (Debian/Ubuntu)

#### Download and Install

```bash
# Download the package
wget https://example.com/playlist-lab-server_2.0.0_amd64.deb

# Install
sudo dpkg -i playlist-lab-server_2.0.0_amd64.deb

# Install dependencies if needed
sudo apt-get install -f
```

#### What Gets Installed

- Server files: `/opt/playlist-lab-server/`
- Server Manager: `/opt/playlist-lab-server/tray-app/`
- Desktop entry: `/usr/share/applications/playlist-lab-server.desktop`
- Systemd service: `/etc/systemd/system/playlist-lab-server.service`
- Data directory: `~/.local/share/PlaylistLabServer/`

### Method 2: RPM Package (Fedora/RHEL)

#### Download and Install

```bash
# Download the package
wget https://example.com/playlist-lab-server-2.0.0-1.x86_64.rpm

# Install (Fedora/RHEL 8+)
sudo dnf install playlist-lab-server-2.0.0-1.x86_64.rpm

# Or (RHEL 7/CentOS 7)
sudo yum install playlist-lab-server-2.0.0-1.x86_64.rpm
```

#### What Gets Installed

- Server files: `/opt/playlist-lab-server/`
- Server Manager: `/opt/playlist-lab-server/tray-app/`
- Desktop entry: `/usr/share/applications/playlist-lab-server.desktop`
- Systemd service: `/etc/systemd/system/playlist-lab-server.service`
- Data directory: `~/.local/share/PlaylistLabServer/`

### Method 3: AppImage (Universal)

#### Download and Run

```bash
# Download the AppImage
wget https://example.com/PlaylistLabServer-2.0.0-x86_64.AppImage

# Make it executable
chmod +x PlaylistLabServer-2.0.0-x86_64.AppImage

# Run it
./PlaylistLabServer-2.0.0-x86_64.AppImage
```

#### Integration (Optional)

To integrate with your desktop environment:

```bash
# Install AppImageLauncher (recommended)
# Ubuntu/Debian:
sudo add-apt-repository ppa:appimagelauncher-team/stable
sudo apt update
sudo apt install appimagelauncher

# Fedora:
sudo dnf install appimagelauncher

# Then run the AppImage - AppImageLauncher will handle integration
```

### Method 4: Manual Installation

```bash
# Clone or download the repository
git clone https://github.com/yourrepo/playlist-lab.git
cd playlist-lab

# Install dependencies
npm install

# Build the server
npm run build --workspace=apps/server

# Build the tray app
cd tray-app
npm install
npm run build
npm run package:linux

# Copy files to installation directory
sudo mkdir -p /opt/playlist-lab-server
sudo cp -r dist/* /opt/playlist-lab-server/

# Create systemd service (see Configuration section)
```

### First Launch

After installation:

1. **Launch the Server Manager**:
   - From application menu: Applications > Utilities > Playlist Lab Server Manager
   - Or from terminal: `playlist-lab-server-manager`

2. **Choose Installation Mode** (first launch):
   - systemd Service (recommended for always-on)
   - Autostart Application (starts on login)
   - Standalone (manual control)

3. **Grant Permissions** (if prompted):
   - System tray access
   - Network access
   - File access for logs

4. **Server Manager appears in system tray**:
   - Look for the Playlist Lab icon
   - Icon color indicates server status

## Installation Modes

### systemd Service Mode

#### Starting the Service

The easiest way to manage the service is through the Server Manager tray application:

1. Click the Server Manager icon in the system tray
2. Select "Start Server"
3. The icon will change to green when running

**Alternative Methods:**

**Method 1: systemctl**
```bash
sudo systemctl start playlist-lab-server
```

**Method 2: Server Manager Window**
1. Double-click the tray icon
2. Click the "Start" button

#### Stopping the Service

**Server Manager:**
1. Click the tray icon
2. Select "Stop Server"

**Terminal:**
```bash
sudo systemctl stop playlist-lab-server
```

#### Checking Service Status

**Terminal:**
```bash
systemctl status playlist-lab-server
```

**Server Manager:**
- Icon color indicates status (green = running, gray = stopped, red = error)
- Double-click to see detailed status

#### Enable Auto-Start on Boot

```bash
sudo systemctl enable playlist-lab-server
```

#### Service Configuration

The service is configured to:
- Start automatically with the system (if enabled)
- Run as your user account
- Restart automatically on failure
- Log to: `~/.local/share/PlaylistLabServer/server.log` or `/var/log/playlist-lab-server/`

### Autostart Application Mode

#### How It Works

A desktop entry is placed in:
```
~/.config/autostart/playlist-lab-server-manager.desktop
```

The Server Manager starts automatically and manages the server process.

#### Managing Autostart

**To disable automatic startup:**
```bash
rm ~/.config/autostart/playlist-lab-server-manager.desktop
```

**To re-enable:**
1. Launch the Server Manager
2. It will offer to add itself to autostart
3. Or manually copy the desktop entry:
```bash
cp /usr/share/applications/playlist-lab-server-manager.desktop ~/.config/autostart/
```

#### Using the Server Manager

- Look for the icon in the system tray
- **Double-click** to open the management window
- **Right-click** for quick actions:
  - Open Web Interface
  - Show/Hide Window
  - View Logs
  - Stop Server
  - Restart Server
  - Exit

**Management Window Features:**
- Real-time server status indicator
- Server URL with copy button
- Start/Stop/Restart buttons
- Live log viewer (last 20 lines)
- "Open Web Interface" button
- "Open Log Folder" button

### Standalone Mode

#### Starting the Server

**Method 1: Server Manager (Recommended)**
1. Launch Server Manager from application menu
2. Double-click the tray icon
3. Click "Start" button
4. The icon will turn green when running

**Method 2: Terminal**
```bash
cd /opt/playlist-lab-server
node server/src/index.js
```

#### Stopping the Server

**Method 1: Server Manager (Recommended)**
1. Double-click the tray icon
2. Click "Stop" button

**Method 2: Terminal**
- Press `Ctrl + C` in the terminal window

**Method 3: Kill Process**
```bash
pkill -f "node.*playlist-lab"
```

## Configuration

### Configuration File

**System Installation:**
```
/opt/playlist-lab-server/server/.env
```

**User Installation:**
```
~/.local/share/playlist-lab-server/server/.env
```

### Common Settings

```env
# Server Port
PORT=3000

# Environment
NODE_ENV=production

# Database Location
DB_PATH=~/.local/share/PlaylistLabServer/playlist-lab.db

# Session Secret (change this!)
SESSION_SECRET=your-secret-key-here

# Plex Settings
PLEX_CLIENT_ID=playlist-lab-server

# Logging
LOG_LEVEL=info
```

### Editing Configuration

1. **Stop the server** (important!)
2. Edit the file:
   ```bash
   nano /opt/playlist-lab-server/server/.env
   # or
   nano ~/.local/share/playlist-lab-server/server/.env
   ```
3. Make your changes
4. Save: `Ctrl + O`, then `Enter`
5. Exit: `Ctrl + X`
6. **Start the server**

### Data Directory

**Default location:**
```
~/.local/share/PlaylistLabServer/
```

**Or for system service:**
```
/var/lib/playlist-lab-server/
```

Contains:
- `playlist-lab.db` - SQLite database
- `server.log` - Application logs
- `server-error.log` - Error logs
- `tray-preferences.json` - Server Manager preferences

### Changing the Port

If port 3000 is already in use:

1. Stop the server
2. Edit `.env` file (see above)
3. Change `PORT=3000` to `PORT=3001` (or any available port)
4. Save the file
5. Start the server
6. Access at: http://localhost:3001

## Usage

### Server Manager Tray Application

The Server Manager is your primary tool for managing Playlist Lab Server on Linux.

#### Finding the Server Manager

- **System Tray**: Look for the Playlist Lab icon
- **Launch**: Applications menu > Utilities > Playlist Lab Server Manager
- **Terminal**: `playlist-lab-server-manager`

**Desktop Environment Notes:**
- **KDE Plasma**: Full support, icon appears in system tray
- **XFCE**: Full support, icon appears in system tray
- **Cinnamon**: Full support, icon appears in system tray
- **MATE**: Full support, icon appears in system tray
- **GNOME**: Requires "AppIndicator Support" extension
  ```bash
  # Install extension
  sudo apt install gnome-shell-extension-appindicator
  # or
  sudo dnf install gnome-shell-extension-appindicator
  # Then enable in Extensions app
  ```

#### Tray Icon States

The tray icon changes color to show server status:

- **Green Icon**: Server is running normally
- **Gray Icon**: Server is stopped
- **Red Icon**: Server has an error

**Tooltip**: Hover over the icon to see the current status text.

#### Opening the Management Window

- **Double-click** the tray icon
- Or **right-click** and select "Show Window"

#### Management Window Features

The management window provides:

1. **Status Indicator**: Large visual indicator showing server state
2. **Server Information**:
   - Server URL with copy button
   - Installation mode (Service/Autostart/Standalone)
   - Current status
3. **Control Buttons**:
   - Start Server (when stopped)
   - Stop Server (when running)
   - Restart Server (when running)
   - Open Web Interface (launches browser)
4. **Log Viewer**:
   - Real-time display of server logs
   - Last 20 lines shown
   - Auto-scrolls to newest entries
   - Error lines highlighted in red
5. **Quick Actions**:
   - Open Log Folder button
   - Copy URL button

#### Context Menu (Right-Click)

Right-click the tray icon for quick actions:

- **Open Web Interface**: Launches browser to http://localhost:3000
- **Show Window**: Opens the management window
- **View Logs**: Opens management window to logs section
- **Start Server**: Starts the server (when stopped)
- **Stop Server**: Stops the server (when running)
- **Restart Server**: Restarts the server (when running)
- **Exit**: Closes the Server Manager (server continues running)

**Note**: Exiting the Server Manager does NOT stop the server. The server will continue running in the background.

#### Window Behavior

- **Minimize**: Clicking the minimize button hides the window to the tray
- **Close**: Clicking the X button also hides the window (doesn't exit)
- **Reopen**: Double-click the tray icon to show the window again

This design ensures you don't accidentally stop the server by closing the window.

### Accessing the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

Or from another computer on your network:
```
http://YOUR-COMPUTER-IP:3000
```

### First-Time Setup

1. **Connect to Plex**
   - Click "Connect to Plex"
   - Log in with your Plex account
   - Authorize the application

2. **Select Your Server**
   - Choose your Plex Media Server
   - Grant access to your libraries

3. **Configure Settings**
   - Set your preferences
   - Configure automatic playlist updates
   - Set up schedules (optional)

### Common Tasks

#### Viewing Logs

**Method 1: Server Manager (Easiest)**
1. Double-click the tray icon
2. Scroll through the log viewer at the bottom
3. Click "Open Log Folder" to view full log files

**Method 2: Terminal**
```bash
tail -f ~/.local/share/PlaylistLabServer/server.log
# or
sudo journalctl -u playlist-lab-server -f
```

**Method 3: File Manager**
- Navigate to: `~/.local/share/PlaylistLabServer/`
- Open `server.log` or `server-error.log`

#### Backing Up Data

1. Stop the server
2. Copy the database file:
   ```bash
   cp ~/.local/share/PlaylistLabServer/playlist-lab.db ~/Documents/
   ```
3. Start the server

#### Restoring Data

1. Stop the server
2. Replace the database file:
   ```bash
   cp ~/Documents/playlist-lab.db ~/.local/share/PlaylistLabServer/
   ```
3. Start the server

#### Updating the Server

**DEB Package:**
```bash
sudo dpkg -i playlist-lab-server_2.1.0_amd64.deb
```

**RPM Package:**
```bash
sudo dnf upgrade playlist-lab-server-2.1.0-1.x86_64.rpm
```

**AppImage:**
- Download the new AppImage
- Replace the old one
- Your data and settings will be preserved

## Troubleshooting

### Server Manager Tray Application Issues

#### Tray Icon Not Appearing

**GNOME Users:**
Install AppIndicator Support extension:
```bash
# Ubuntu/Debian
sudo apt install gnome-shell-extension-appindicator

# Fedora
sudo dnf install gnome-shell-extension-appindicator

# Then enable in Extensions app or:
gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
```

**Check if it's running:**
```bash
ps aux | grep playlist-lab-server-manager
```

**Restart the Server Manager:**
```bash
pkill -f playlist-lab-server-manager
playlist-lab-server-manager &
```

**Check desktop environment:**
```bash
echo $XDG_CURRENT_DESKTOP
```

Some desktop environments have limited or no system tray support.

#### Server Manager Won't Start

**Check for errors:**
```bash
playlist-lab-server-manager
# Look for error messages in the terminal
```

**Check dependencies:**
```bash
# Ubuntu/Debian
sudo apt install libappindicator3-1 libnotify4

# Fedora
sudo dnf install libappindicator-gtk3 libnotify
```

**Reset preferences:**
```bash
rm ~/.config/playlist-lab-server/tray-preferences.json
```

#### Management Window Not Opening

**Try these steps:**
1. Right-click the tray icon
2. Select "Show Window"
3. If that doesn't work, restart the Server Manager

**Check window position:**
```bash
rm ~/.config/playlist-lab-server/tray-preferences.json
```
Then restart the Server Manager.

### Server Won't Start

**Check if port is in use:**
```bash
sudo lsof -i :3000
# or
sudo netstat -tulpn | grep :3000
```

**Solution:** Change the port in `.env` file or stop the other application.

**Check logs:**
```bash
cat ~/.local/share/PlaylistLabServer/server-error.log
# or
sudo journalctl -u playlist-lab-server -n 50
```

### Can't Access Web Interface

**Check if server is running:**
```bash
sudo lsof -i :3000
# or
systemctl status playlist-lab-server
```

**Check firewall:**

**Ubuntu/Debian (ufw):**
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

**Fedora/RHEL (firewalld):**
```bash
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

**Check SELinux (Fedora/RHEL):**
```bash
sudo semanage port -a -t http_port_t -p tcp 3000
```

### systemd Service Won't Start

**Check service status:**
```bash
systemctl status playlist-lab-server
```

**View service logs:**
```bash
sudo journalctl -u playlist-lab-server -n 50
```

**Reload service:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart playlist-lab-server
```

**Check permissions:**
```bash
ls -la /opt/playlist-lab-server/
ls -la ~/.local/share/PlaylistLabServer/
```

### Database Errors

**Check database file exists:**
```bash
ls -la ~/.local/share/PlaylistLabServer/playlist-lab.db
```

**Check permissions:**
```bash
chmod 644 ~/.local/share/PlaylistLabServer/playlist-lab.db
```

**Reset database (WARNING: deletes all data):**
```bash
rm ~/.local/share/PlaylistLabServer/playlist-lab.db
```
Then restart the server to create a new database.

### High CPU Usage

**Check background jobs:**
- Open web interface
- Go to Settings > Background Jobs
- Disable unnecessary jobs

**Check system resources:**
```bash
top
# or
htop
```

### Memory Issues

**Increase Node.js memory limit:**

Edit the systemd service file:
```bash
sudo systemctl edit playlist-lab-server
```

Add:
```ini
[Service]
Environment="NODE_OPTIONS=--max_old_space_size=4096"
```

Then reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart playlist-lab-server
```

## Uninstallation

### DEB Package

```bash
sudo apt remove playlist-lab-server
# or to remove configuration too:
sudo apt purge playlist-lab-server
```

### RPM Package

```bash
sudo dnf remove playlist-lab-server
# or
sudo yum remove playlist-lab-server
```

### AppImage

Simply delete the AppImage file:
```bash
rm PlaylistLabServer-2.0.0-x86_64.AppImage
```

### Manual Installation

```bash
sudo rm -rf /opt/playlist-lab-server
sudo rm /etc/systemd/system/playlist-lab-server.service
sudo rm /usr/share/applications/playlist-lab-server*.desktop
sudo systemctl daemon-reload
```

### Remove systemd Service

If you installed in Service mode:

```bash
sudo systemctl stop playlist-lab-server
sudo systemctl disable playlist-lab-server
sudo rm /etc/systemd/system/playlist-lab-server.service
sudo systemctl daemon-reload
```

### Remove Autostart Entry

If you installed in Autostart mode:

```bash
rm ~/.config/autostart/playlist-lab-server-manager.desktop
```

### What Gets Removed

- Application files in /opt/playlist-lab-server/
- Server Manager application
- Desktop entries
- systemd service file (if installed)
- Autostart entry (if configured)

### What Gets Kept

Your data is preserved:
- Database: `~/.local/share/PlaylistLabServer/playlist-lab.db`
- Logs: `~/.local/share/PlaylistLabServer/*.log`
- Configuration: `~/.local/share/PlaylistLabServer/.env`
- Server Manager preferences: `~/.config/playlist-lab-server/tray-preferences.json`

### Complete Removal

To remove all data:

```bash
rm -rf ~/.local/share/PlaylistLabServer/
rm -rf ~/.config/playlist-lab-server/
```

**WARNING:** This deletes all your playlists, settings, and data!

## Advanced Topics

### Running on a Different Port

1. Stop the server
2. Edit `.env`:
   ```bash
   nano /opt/playlist-lab-server/server/.env
   ```
3. Change `PORT=3000` to your desired port
4. Update firewall rules (see Troubleshooting section)
5. Start the server

### Accessing from Other Devices

1. **Find your computer's IP address:**
   ```bash
   ip addr show
   # or
   hostname -I
   ```

2. **Configure firewall** (see Troubleshooting section)

3. **Access from other device:**
   ```
   http://YOUR-COMPUTER-IP:3000
   ```

### Running Multiple Instances

1. Install to different directories
2. Use different ports in each `.env`
3. Create separate systemd services with different names

### HTTPS Configuration

For secure connections, use a reverse proxy like:
- nginx
- Apache
- Caddy

Example with nginx:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Automatic Backups

Create a systemd timer for automatic backups:

1. Create `/etc/systemd/system/playlist-lab-backup.service`:
```ini
[Unit]
Description=Playlist Lab Server Backup

[Service]
Type=oneshot
User=youruser
ExecStart=/bin/bash -c 'cp ~/.local/share/PlaylistLabServer/playlist-lab.db ~/Documents/Backups/playlist-lab-$(date +\%Y\%m\%d).db'
```

2. Create `/etc/systemd/system/playlist-lab-backup.timer`:
```ini
[Unit]
Description=Playlist Lab Server Backup Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

3. Enable the timer:
```bash
sudo systemctl enable playlist-lab-backup.timer
sudo systemctl start playlist-lab-backup.timer
```

### Running as a Different User

Edit the systemd service:
```bash
sudo systemctl edit playlist-lab-server
```

Add:
```ini
[Service]
User=youruser
Group=yourgroup
```

Then reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart playlist-lab-server
```

## Support

### Getting Help

- **Documentation**: Check the docs folder
- **GitHub Issues**: Report bugs and request features
- **Community**: Join our Discord/Forum
- **Email**: support@playlistlab.com

### Reporting Issues

When reporting issues, include:
1. Linux distribution and version
2. Desktop environment
3. Installation mode (service/autostart/standalone)
4. Error messages from logs
5. Steps to reproduce

### Logs Location

Always check logs first:
```
~/.local/share/PlaylistLabServer/server.log
~/.local/share/PlaylistLabServer/server-error.log
```

Or for systemd service:
```bash
sudo journalctl -u playlist-lab-server -n 100
```

## FAQ

**Q: Which distributions are supported?**
A: Any modern Linux distribution with systemd and Node.js support. Tested on Ubuntu, Fedora, Debian, and Arch Linux.

**Q: Does it work on Raspberry Pi?**
A: Yes, if you have an ARM build. Performance depends on the Pi model.

**Q: Why doesn't the tray icon appear in GNOME?**
A: GNOME removed native system tray support. Install the "AppIndicator Support" extension.

**Q: Can I run this on a headless server?**
A: Yes, use systemd Service mode and manage via command line or web interface. The tray app is optional.

**Q: Can I access it from my phone?**
A: Yes, use the mobile app or web interface at http://YOUR-COMPUTER-IP:3000

**Q: How much disk space does it use?**
A: ~200MB for installation (including Server Manager), plus database size (varies by usage)

**Q: Can I move the installation to another computer?**
A: Yes, copy the database file and install on the new computer.

**Q: Is my data encrypted?**
A: The database is not encrypted by default. Use LUKS or dm-crypt for full disk encryption.

**Q: Can multiple users access it simultaneously?**
A: Yes, the server supports multiple concurrent users.

**Q: How do I update to a new version?**
A: Use your package manager to update, or download and install the new package/AppImage.

**Q: Does the Server Manager use a lot of resources?**
A: No, it uses less than 100MB of RAM and minimal CPU when idle.

**Q: Can I run the server without the Server Manager?**
A: Yes, the Server Manager is optional. You can manage the server using systemctl or terminal commands.

**Q: What happens if I close the Server Manager window?**
A: The window minimizes to the tray. The server continues running. To fully exit, right-click the tray icon and select "Exit".

**Q: Which desktop environments support the system tray?**
A: KDE Plasma, XFCE, Cinnamon, and MATE have full support. GNOME requires an extension. Some minimal desktop environments may not support system trays.

## License

See LICENSE file in the project root.
