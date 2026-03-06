# Playlist Lab Server - macOS Installation Guide

Complete guide for installing and running Playlist Lab Server on macOS.

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

Playlist Lab Server can be installed on macOS in three different modes:

1. **launchd Service** - Runs automatically in the background
2. **Login Item** - Starts when you log in
3. **Standalone Application** - Manual start/stop control

The installation includes the **Server Manager** menu bar application, which provides an easy-to-use interface for managing the server from your menu bar.

## System Requirements

### Minimum Requirements

- **Operating System**: macOS 10.15 (Catalina) or higher
- **RAM**: 512 MB available
- **Disk Space**: 200 MB for installation + space for database
- **Network**: Internet connection for Plex integration
- **Architecture**: Intel or Apple Silicon (M1/M2/M3)

### Recommended Requirements

- **Operating System**: macOS 12 (Monterey) or higher
- **RAM**: 1 GB available
- **Disk Space**: 500 MB
- **Processor**: Dual-core or better

### Prerequisites

- Administrator access (for service installation)
- Plex Media Server (for full functionality)
- Modern web browser (for web interface)

## Installation

### Step 1: Download the Installer

Download the latest installer:
```
PlaylistLabServer-2.0.0.dmg
```
or
```
PlaylistLabServer-2.0.0.pkg
```

### Step 2: Install from DMG

1. **Open the DMG file**
2. **Drag** "Playlist Lab Server" to the Applications folder
3. **Eject** the DMG

### Step 2 (Alternative): Install from PKG

1. **Double-click** the PKG file
2. Follow the installation wizard
3. Enter your password when prompted
4. Click **"Install"**

### Step 3: First Launch

1. Open **Applications** folder
2. Find **"Playlist Lab Server Manager"**
3. **Right-click** and select **"Open"** (first time only)
4. Click **"Open"** in the security dialog

**Note**: macOS Gatekeeper may warn about an unidentified developer on first launch. This is normal for applications not distributed through the App Store.

### Step 4: Choose Installation Mode

On first launch, the Server Manager will ask you to choose an installation mode:

#### Option 1: launchd Service (Recommended)

**Best for:**
- Always-on server usage
- Multiple users accessing the server
- Production environments
- Servers that should run 24/7

**Features:**
- Starts automatically when macOS boots
- Runs in background (no visible window)
- Continues running after logout
- Managed by launchd

**How it works:**
- Installed as a launchd daemon
- Plist file in `~/Library/LaunchAgents/`
- Automatic restart on failure

#### Option 2: Login Item

**Best for:**
- Personal use
- Single-user scenarios
- When you want visibility of the server

**Features:**
- Starts when you log in
- Runs in your user context
- Visible in menu bar
- No administrator required

**How it works:**
- Added to Login Items in System Preferences
- Runs as a regular application
- Stops when you log out

#### Option 3: Standalone Application

**Best for:**
- Development and testing
- Occasional use
- When you want full control

**Features:**
- Manual start/stop
- Full control over when server runs
- Easy to restart for testing

**How it works:**
- Launch from Applications folder
- You start/stop manually
- No automatic startup

### Step 5: Grant Permissions

macOS may ask for permissions:

- **Accessibility**: For menu bar icon management
- **Network**: For server communication
- **Files and Folders**: For log file access

Grant these permissions in **System Preferences > Security & Privacy > Privacy**.

### Step 6: Server Manager Setup

After installation:

**For launchd Service Mode:**
- The service starts automatically
- The Server Manager icon appears in your menu bar
- Access the web interface at: http://localhost:3000

**For Login Item Mode:**
- The server and Server Manager start automatically
- Look for the Server Manager icon in the menu bar
- Click the icon to see the menu

**For Standalone Mode:**
- Launch the Server Manager from Applications
- Use the Server Manager to start the server
- The menu bar icon shows the current server status

## Installation Modes

### launchd Service Mode

#### Starting the Service

The easiest way to manage the service is through the Server Manager menu bar application:

1. Click the Server Manager icon in the menu bar
2. Select "Start Server"
3. The icon will change to indicate the server is running

**Alternative Methods:**

**Method 1: Terminal**
```bash
launchctl load ~/Library/LaunchAgents/com.playlistlab.server.plist
```

**Method 2: Server Manager Window**
1. Click the menu bar icon
2. Select "Show Window"
3. Click the "Start" button

#### Stopping the Service

The easiest way is through the Server Manager:

1. Click the Server Manager icon in the menu bar
2. Select "Stop Server"

**Alternative Methods:**

**Method 1: Terminal**
```bash
launchctl unload ~/Library/LaunchAgents/com.playlistlab.server.plist
```

**Method 2: Server Manager Window**
1. Click the menu bar icon
2. Select "Show Window"
3. Click the "Stop" button

#### Checking Service Status

**Terminal:**
```bash
launchctl list | grep com.playlistlab.server
```

**Server Manager:**
- The menu bar icon color indicates status (green = running, gray = stopped)
- Click the icon to see detailed status

#### Service Configuration

The service is configured to:
- Start automatically with macOS
- Run as your user account
- Restart automatically on failure
- Log to: `~/Library/Application Support/PlaylistLabServer/server.log`

### Login Item Mode

#### How It Works

The Server Manager is added to Login Items in System Preferences.

#### Managing Login Items

**To disable automatic startup:**
1. Open **System Preferences**
2. Go to **Users & Groups**
3. Select your user account
4. Click **Login Items** tab
5. Select "Playlist Lab Server Manager"
6. Click the **-** button

**To re-enable:**
1. Run the Server Manager
2. It will offer to add itself to Login Items
3. Or manually add it in System Preferences

#### Using the Server Manager

- Look for the icon in the menu bar (top-right)
- **Click** to open the menu
- Menu options:
  - Open Web Interface
  - Show Window
  - View Logs
  - Stop Server
  - Restart Server
  - Quit

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
1. Launch Server Manager from Applications folder
2. Click the menu bar icon
3. Select "Start Server"
4. The icon will turn green when the server is running

**Method 2: Terminal**
```bash
cd "/Applications/Playlist Lab Server.app/Contents/Resources"
node server/src/index.js
```

#### Stopping the Server

**Method 1: Server Manager (Recommended)**
1. Click the Server Manager icon in the menu bar
2. Select "Stop Server"

**Method 2: Terminal**
- Press `Ctrl + C` in the terminal window

**Method 3: Activity Monitor**
1. Open Activity Monitor
2. Find "node" process
3. Click **Quit Process**

## Configuration

### Configuration File

Location: `/Applications/Playlist Lab Server.app/Contents/Resources/server/.env`

### Common Settings

```env
# Server Port
PORT=3000

# Environment
NODE_ENV=production

# Database Location
DB_PATH=~/Library/Application Support/PlaylistLabServer/playlist-lab.db

# Session Secret (change this!)
SESSION_SECRET=your-secret-key-here

# Plex Settings
PLEX_CLIENT_ID=playlist-lab-server

# Logging
LOG_LEVEL=info
```

### Editing Configuration

1. **Stop the server** (important!)
2. Open Terminal
3. Edit the file:
   ```bash
   nano "/Applications/Playlist Lab Server.app/Contents/Resources/server/.env"
   ```
4. Make your changes
5. Save: `Ctrl + O`, then `Enter`
6. Exit: `Ctrl + X`
7. **Start the server**

### Data Directory

Default location: `~/Library/Application Support/PlaylistLabServer/`

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

### Server Manager Menu Bar Application

The Server Manager is your primary tool for managing Playlist Lab Server on macOS.

#### Finding the Server Manager

- **Menu Bar**: Look for the Playlist Lab icon in the top-right corner
- **Launch**: Applications folder > Playlist Lab Server Manager

#### Menu Bar Icon States

The menu bar icon adapts to your system theme (light/dark mode):

- **Solid Icon**: Server is running normally
- **Dimmed Icon**: Server is stopped
- **Red Tint**: Server has an error

**Status Text**: Click the icon to see detailed status in the menu.

#### Menu Options

Click the menu bar icon to see:

- **Server Status**: Current state (Running/Stopped/Error)
- **Open Web Interface**: Launches browser to http://localhost:3000
- **Show Window**: Opens the management window
- **View Logs**: Opens management window to logs section
- **Start Server**: Starts the server (when stopped)
- **Stop Server**: Stops the server (when running)
- **Restart Server**: Restarts the server (when running)
- **Quit**: Closes the Server Manager (server continues running)

**Note**: Quitting the Server Manager does NOT stop the server. The server will continue running in the background.

#### Management Window Features

The management window provides:

1. **Status Indicator**: Large visual indicator showing server state
2. **Server Information**:
   - Server URL with copy button
   - Installation mode (Service/Login Item/Standalone)
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

#### Window Behavior

- **Minimize**: Clicking the minimize button hides the window
- **Close**: Clicking the red button also hides the window (doesn't quit)
- **Reopen**: Click the menu bar icon and select "Show Window"

This design ensures you don't accidentally stop the server by closing the window.

### Accessing the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

Or from another computer on your network:
```
http://YOUR-MAC-IP:3000
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
1. Click the menu bar icon
2. Select "Show Window"
3. Scroll through the log viewer at the bottom
4. Click "Open Log Folder" to view full log files

**Method 2: Terminal**
```bash
tail -f ~/Library/Application\ Support/PlaylistLabServer/server.log
```

**Method 3: Console App**
1. Open Console.app
2. Search for "playlist-lab"
3. View real-time logs

#### Backing Up Data

1. Stop the server
2. Copy the database file:
   ```bash
   cp ~/Library/Application\ Support/PlaylistLabServer/playlist-lab.db ~/Documents/
   ```
3. Start the server

#### Restoring Data

1. Stop the server
2. Replace the database file:
   ```bash
   cp ~/Documents/playlist-lab.db ~/Library/Application\ Support/PlaylistLabServer/
   ```
3. Start the server

#### Updating the Server

1. Download the new DMG or PKG
2. Stop the server using the Server Manager
3. Install the new version (it will replace the old one)
4. Your data and settings will be preserved
5. Launch the Server Manager

## Troubleshooting

### Server Manager Menu Bar Application Issues

#### Menu Bar Icon Not Appearing

**Check if it's running:**
```bash
ps aux | grep "Playlist Lab Server Manager"
```

**Restart the Server Manager:**
1. Open Activity Monitor
2. Find "Playlist Lab Server Manager"
3. Quit the process
4. Launch from Applications folder

**Check menu bar space:**
- macOS hides menu bar icons if there's not enough space
- Try quitting other menu bar apps
- Or use a menu bar management app like Bartender

#### Server Manager Won't Start

**Check for errors:**
1. Open Console.app
2. Search for "Playlist Lab"
3. Look for error messages

**Reset preferences:**
```bash
rm ~/Library/Application\ Support/PlaylistLabServer/tray-preferences.json
```

**Reinstall:**
1. Drag the app to Trash
2. Empty Trash
3. Reinstall from DMG or PKG

#### Management Window Not Opening

**Try these steps:**
1. Click the menu bar icon
2. Select "Show Window"
3. If that doesn't work, restart the Server Manager

**Check window position:**
```bash
rm ~/Library/Application\ Support/PlaylistLabServer/tray-preferences.json
```
Then restart the Server Manager.

### Server Won't Start

**Check if port is in use:**
```bash
lsof -i :3000
```

**Solution:** Change the port in `.env` file or stop the other application.

**Check logs:**
```bash
cat ~/Library/Application\ Support/PlaylistLabServer/server-error.log
```

### Can't Access Web Interface

**Check if server is running:**
```bash
lsof -i :3000
```

**Check macOS Firewall:**
1. System Preferences > Security & Privacy > Firewall
2. Click "Firewall Options"
3. Ensure "Playlist Lab Server" is allowed

**Add firewall rule:**
1. System Preferences > Security & Privacy > Firewall
2. Click the lock to make changes
3. Click "Firewall Options"
4. Click "+" and add the server application
5. Set to "Allow incoming connections"

### launchd Service Won't Start

**Check service status:**
```bash
launchctl list | grep com.playlistlab.server
```

**View service logs:**
```bash
cat ~/Library/Application\ Support/PlaylistLabServer/server-error.log
```

**Reload service:**
```bash
launchctl unload ~/Library/LaunchAgents/com.playlistlab.server.plist
launchctl load ~/Library/LaunchAgents/com.playlistlab.server.plist
```

### Database Errors

**Check database file exists:**
```bash
ls -la ~/Library/Application\ Support/PlaylistLabServer/playlist-lab.db
```

**Check permissions:**
```bash
chmod 644 ~/Library/Application\ Support/PlaylistLabServer/playlist-lab.db
```

**Reset database (WARNING: deletes all data):**
```bash
rm ~/Library/Application\ Support/PlaylistLabServer/playlist-lab.db
```
Then restart the server to create a new database.

### High CPU Usage

**Check background jobs:**
- Open web interface
- Go to Settings > Background Jobs
- Disable unnecessary jobs

**Adjust job schedules:**
- Reduce frequency of automatic updates
- Schedule jobs during off-peak hours

### Memory Issues

**Increase Node.js memory limit:**

Edit the launchd plist file:
```bash
nano ~/Library/LaunchAgents/com.playlistlab.server.plist
```

Add to ProgramArguments:
```xml
<string>--max_old_space_size=4096</string>
```

Then reload the service.

## Uninstallation

### Standard Uninstall

1. **Stop the server** using the Server Manager
2. **Quit the Server Manager** (menu bar icon > Quit)
3. **Drag to Trash**:
   - Playlist Lab Server.app (from Applications)
   - Playlist Lab Server Manager.app (from Applications)
4. **Empty Trash**

### Remove launchd Service

If you installed in Service mode:

```bash
launchctl unload ~/Library/LaunchAgents/com.playlistlab.server.plist
rm ~/Library/LaunchAgents/com.playlistlab.server.plist
```

### Remove Login Item

If you installed in Login Item mode:

1. System Preferences > Users & Groups
2. Select your user
3. Click Login Items tab
4. Select "Playlist Lab Server Manager"
5. Click the - button

### What Gets Removed

- Application bundle in /Applications/
- Server Manager application
- launchd plist file (if installed)
- Login Item (if configured)
- Menu bar icon

### What Gets Kept

Your data is preserved:
- Database: `~/Library/Application Support/PlaylistLabServer/playlist-lab.db`
- Logs: `~/Library/Application Support/PlaylistLabServer/*.log`
- Configuration: `~/Library/Application Support/PlaylistLabServer/.env`
- Server Manager preferences: `~/Library/Application Support/PlaylistLabServer/tray-preferences.json`

### Complete Removal

To remove all data:

```bash
rm -rf ~/Library/Application\ Support/PlaylistLabServer/
```

**WARNING:** This deletes all your playlists, settings, and data!

## Advanced Topics

### Running on a Different Port

1. Stop the server
2. Edit `.env`:
   ```bash
   nano "/Applications/Playlist Lab Server.app/Contents/Resources/server/.env"
   ```
3. Change `PORT=3000` to your desired port
4. Save and exit
5. Start the server

### Accessing from Other Devices

1. **Find your Mac's IP address:**
   - System Preferences > Network
   - Or in Terminal: `ifconfig | grep "inet "`

2. **Configure firewall** (see Troubleshooting section)

3. **Access from other device:**
   ```
   http://YOUR-MAC-IP:3000
   ```

### Running Multiple Instances

1. Create separate application bundles
2. Use different ports in each `.env`
3. For services, create separate plist files with different names

### HTTPS Configuration

For secure connections, use a reverse proxy like:
- nginx
- Caddy
- Apache

Example with Caddy:
```
your-domain.com {
    reverse_proxy localhost:3000
}
```

### Automatic Backups

Create a launchd job for automatic backups:

1. Create `~/Library/LaunchAgents/com.playlistlab.backup.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.playlistlab.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cp ~/Library/Application\ Support/PlaylistLabServer/playlist-lab.db ~/Documents/Backups/playlist-lab-$(date +%Y%m%d).db</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

2. Load the job:
```bash
launchctl load ~/Library/LaunchAgents/com.playlistlab.backup.plist
```

## Support

### Getting Help

- **Documentation**: Check the docs folder
- **GitHub Issues**: Report bugs and request features
- **Community**: Join our Discord/Forum
- **Email**: support@playlistlab.com

### Reporting Issues

When reporting issues, include:
1. macOS version
2. Installation mode (service/login item/standalone)
3. Error messages from logs
4. Steps to reproduce

### Logs Location

Always check logs first:
```
~/Library/Application Support/PlaylistLabServer/server.log
~/Library/Application Support/PlaylistLabServer/server-error.log
```

## FAQ

**Q: Does it work on Apple Silicon (M1/M2/M3)?**
A: Yes, the application is universal and runs natively on both Intel and Apple Silicon Macs.

**Q: Can I run this on macOS Server?**
A: Yes, all installation modes work on macOS Server.

**Q: What's the minimum macOS version?**
A: macOS 10.15 (Catalina) or higher is required.

**Q: Can I access it from my iPhone?**
A: Yes, use the mobile app or web interface at http://YOUR-MAC-IP:3000

**Q: How much disk space does it use?**
A: ~200MB for installation (including Server Manager), plus database size (varies by usage)

**Q: Can I move the installation to another Mac?**
A: Yes, copy the database file and install on the new Mac.

**Q: Is my data encrypted?**
A: The database is not encrypted by default. Use FileVault for full disk encryption.

**Q: Can multiple users access it simultaneously?**
A: Yes, the server supports multiple concurrent users.

**Q: How do I update to a new version?**
A: Download and install the new DMG or PKG. It will replace the old version automatically.

**Q: Does the Server Manager use a lot of resources?**
A: No, it uses less than 100MB of RAM and minimal CPU when idle.

**Q: Can I run the server without the Server Manager?**
A: Yes, the Server Manager is optional. You can manage the server using Terminal or Activity Monitor.

**Q: What happens if I quit the Server Manager?**
A: The server continues running in the background. To stop the server, use the "Stop Server" menu option before quitting.

**Q: Why doesn't the menu bar icon show up?**
A: macOS hides menu bar icons when there's not enough space. Try quitting other menu bar apps or use a menu bar management tool.

## License

See LICENSE file in the project root.
