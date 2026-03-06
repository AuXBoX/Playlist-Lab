# Playlist Lab Server - Windows Installation Guide

Complete guide for installing and running Playlist Lab Server on Windows.

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

Playlist Lab Server can be installed on Windows in three different modes:

1. **Windows Service** - Runs automatically in the background
2. **Startup Application** - Starts when you log in
3. **Standalone Application** - Manual start/stop control

The installation includes the **Server Manager** tray application, which provides an easy-to-use interface for managing the server from your system tray.

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10 (64-bit) or higher
- **RAM**: 512 MB available
- **Disk Space**: 200 MB for installation + space for database
- **Network**: Internet connection for Plex integration
- **.NET Framework**: 4.5 or higher (usually pre-installed)

### Recommended Requirements

- **Operating System**: Windows 10/11 (64-bit)
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
PlaylistLabServer-Setup-2.0.0.exe
```

### Step 2: Run the Installer

1. **Right-click** the installer
2. Select **"Run as Administrator"**
3. Click **"Yes"** on the User Account Control prompt

### Step 3: Choose Installation Type

The installer will present three options:

#### Option 1: Windows Service (Recommended)

**Best for:**
- Always-on server usage
- Multiple users accessing the server
- Production environments
- Servers that should run 24/7

**Features:**
- Starts automatically with Windows
- Runs in background (no visible window)
- Continues running after logout
- Requires administrator privileges

**How it works:**
- Installed as a Windows service named "PlaylistLabServer"
- Managed through Windows Services console
- Automatic restart on failure

#### Option 2: Startup Application

**Best for:**
- Personal use
- Single-user scenarios
- When you want visibility of the server

**Features:**
- Starts when you log in
- Runs in your user context
- Visible in system tray
- No administrator required

**How it works:**
- Shortcut added to Windows Startup folder
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
- Desktop and Start Menu shortcuts created
- You start/stop manually
- No automatic startup

### Step 4: Choose Installation Location

Default: `C:\Program Files\Playlist Lab Server\`

You can change this if needed, but the default is recommended.

### Step 5: Select Additional Options

- ☑ **Create desktop shortcut** - Quick access icon
- ☑ **Create Start Menu folder** - Organized shortcuts

### Step 6: Complete Installation

Click **"Install"** and wait for the process to complete.

The installer will:
1. Copy all necessary files
2. Configure the selected installation mode
3. Create shortcuts
4. Set up the data directory

### Step 7: First Run

After installation:

**For Service Mode:**
- The service starts automatically
- Launch the Server Manager from Start Menu > Playlist Lab Server Manager
- The Server Manager icon appears in your system tray
- Access the web interface at: http://localhost:3000

**For Startup Mode:**
- The server and Server Manager start automatically
- Look for the Server Manager icon in the system tray
- Double-click the tray icon to open the management window

**For Standalone Mode:**
- Launch the Server Manager from the desktop shortcut or Start Menu
- Use the Server Manager to start the server
- The tray icon shows the current server status

### Step 8: Using the Server Manager

The Server Manager tray application provides:

- **System Tray Icon**: Visual indicator of server status (green = running, gray = stopped, red = error)
- **Management Window**: Double-click the tray icon to open
  - Server status display
  - Start/Stop/Restart buttons
  - Real-time log viewer
  - Quick access to web interface
- **Context Menu**: Right-click the tray icon for quick actions
  - Open Web Interface
  - Show/Hide Window
  - View Logs
  - Start/Stop/Restart Server
  - Exit

**Tip**: The Server Manager can be minimized to the tray - it won't close when you click the X button, just minimize.

## Installation Modes

### Windows Service Mode

#### Starting the Service

The easiest way to manage the service is through the Server Manager tray application:

1. Launch Server Manager from Start Menu > Playlist Lab Server Manager
2. Click the "Start" button in the management window
3. Or right-click the tray icon and select "Start Server"

**Alternative Methods:**

**Method 1: Services Console**
1. Press `Win + R`
2. Type `services.msc`
3. Find "PlaylistLabServer"
4. Right-click > Start

**Method 2: Command Line**
```batch
net start PlaylistLabServer
```

**Method 3: Start Menu**
- Start Menu > Playlist Lab Server > Start Server

#### Stopping the Service

The easiest way is through the Server Manager:

1. Open the Server Manager window (double-click tray icon)
2. Click the "Stop" button
3. Or right-click the tray icon and select "Stop Server"

**Alternative Methods:**

**Method 1: Services Console**
1. Open Services console
2. Find "PlaylistLabServer"
3. Right-click > Stop

**Method 2: Command Line**
```batch
net stop PlaylistLabServer
```

**Method 3: Start Menu**
- Start Menu > Playlist Lab Server > Stop Server

#### Checking Service Status

```batch
sc query PlaylistLabServer
```

#### Service Configuration

The service is configured to:
- Start automatically with Windows
- Run as Local System account
- Restart automatically on failure
- Log to: `%APPDATA%\PlaylistLabServer\server.log`

### Startup Application Mode

#### How It Works

A shortcut is placed in:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
```

The Server Manager tray application starts automatically and manages the server process.

#### Managing Startup

**To disable automatic startup:**
1. Press `Win + R`
2. Type `shell:startup`
3. Delete "Playlist Lab Server Manager.lnk"

**To re-enable:**
1. Run the installer again
2. Choose "Repair"
3. Select "Startup Application" mode

#### Using the Server Manager

- Look for the icon in the system tray (bottom-right)
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
1. Launch Server Manager from desktop shortcut or Start Menu
2. Click the "Start" button in the management window
3. The tray icon will turn green when the server is running

**Method 2: Desktop Shortcut**
- Double-click the "Playlist Lab Server" icon

**Method 3: Start Menu**
- Start Menu > Playlist Lab Server > Start Server

**Method 4: Command Line**
```batch
cd "C:\Program Files\Playlist Lab Server"
node server-launcher.js
```

#### Stopping the Server

**Method 1: Server Manager (Recommended)**
1. Open the Server Manager window (double-click tray icon)
2. Click the "Stop" button

**Method 2: Console Window**
- Press `Ctrl + C` in the console window (if visible)

**Method 3: Task Manager**
1. Open Task Manager (`Ctrl + Shift + Esc`)
2. Find "Node.js: Server Host"
3. Right-click > End Task

**Method 4: Start Menu**
- Start Menu > Playlist Lab Server > Stop Server

## Configuration

### Configuration File

Location: `C:\Program Files\Playlist Lab Server\server\.env`

### Common Settings

```env
# Server Port
PORT=3000

# Environment
NODE_ENV=production

# Database Location
DB_PATH=%APPDATA%\PlaylistLabServer\playlist-lab.db

# Session Secret (change this!)
SESSION_SECRET=your-secret-key-here

# Plex Settings
PLEX_CLIENT_ID=playlist-lab-server

# Logging
LOG_LEVEL=info
```

### Editing Configuration

1. **Stop the server** (important!)
2. Open `.env` file in a text editor
3. Make your changes
4. Save the file
5. **Start the server**

### Data Directory

Default location: `%APPDATA%\PlaylistLabServer\`

Contains:
- `playlist-lab.db` - SQLite database
- `server.log` - Application logs
- `server-error.log` - Error logs
- `.env` - Configuration (if customized)

### Changing the Port

If port 3000 is already in use:

1. Edit `.env` file
2. Change `PORT=3000` to `PORT=3001` (or any available port)
3. Restart the server
4. Access at: http://localhost:3001

### Database Location

To use a custom database location:

1. Edit `.env` file
2. Set `DB_PATH=C:\path\to\your\database.db`
3. Restart the server

## Usage

### Server Manager Tray Application

The Server Manager is your primary tool for managing Playlist Lab Server on Windows.

#### Finding the Server Manager

- **System Tray**: Look for the Playlist Lab icon in the notification area (bottom-right corner)
- **Hidden Icons**: If you don't see it, click the up arrow (^) to show hidden icons
- **Launch**: Start Menu > Playlist Lab Server Manager

#### Tray Icon States

The tray icon changes color to show server status:

- **Green Icon**: Server is running normally
- **Gray Icon**: Server is stopped
- **Red Icon**: Server has an error
- **Yellow/Animated**: Server is starting

**Tooltip**: Hover over the icon to see the current status text.

#### Opening the Management Window

- **Double-click** the tray icon
- Or **right-click** and select "Show Window"

#### Management Window Features

The management window provides:

1. **Status Indicator**: Large visual indicator at the top showing server state
2. **Server Information**:
   - Server URL with copy button
   - Installation mode (Service/Startup/Standalone)
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
1. Open the Server Manager window (double-click tray icon)
2. Scroll through the log viewer at the bottom
3. Click "Open Log Folder" to view full log files

**Method 2: Start Menu**
- Start Menu > Playlist Lab Server > Server Logs

**Method 3: File Explorer**
- Navigate to: `%APPDATA%\PlaylistLabServer\`
- Open `server.log` or `server-error.log`

**Method 4: Command Line**
```batch
type "%APPDATA%\PlaylistLabServer\server.log"
```

#### Backing Up Data

1. Stop the server
2. Copy the database file:
   ```batch
   copy "%APPDATA%\PlaylistLabServer\playlist-lab.db" "C:\Backups\"
   ```
3. Start the server

#### Restoring Data

1. Stop the server
2. Replace the database file:
   ```batch
   copy "C:\Backups\playlist-lab.db" "%APPDATA%\PlaylistLabServer\"
   ```
3. Start the server

#### Updating the Server

1. Download the new installer
2. Run the installer
3. Choose "Upgrade" when prompted
4. Your data and settings will be preserved

## Troubleshooting

### Server Manager Tray Application Issues

#### Tray Icon Not Appearing

**Check if it's hidden:**
1. Click the up arrow (^) in the system tray
2. Look for the Playlist Lab icon
3. If found, drag it to the main tray area

**Restart the Server Manager:**
1. Open Task Manager (`Ctrl + Shift + Esc`)
2. Find "Playlist Lab Server Manager"
3. End the task
4. Launch from Start Menu > Playlist Lab Server Manager

**Check if it's running:**
```batch
tasklist | findstr "PlaylistLabServerTray"
```

#### Server Manager Won't Start

**Check for errors:**
1. Press `Win + R`
2. Type `eventvwr.msc`
3. Check Windows Logs > Application for errors

**Reinstall:**
1. Run the installer again
2. Choose "Repair"
3. Complete the repair process

#### Management Window Not Opening

**Try these steps:**
1. Right-click the tray icon
2. Select "Show Window"
3. If that doesn't work, restart the Server Manager

**Check window position:**
- The window might be off-screen if you changed monitor setup
- Solution: Delete window state file:
  ```batch
  del "%APPDATA%\PlaylistLabServer\tray-preferences.json"
  ```
- Restart the Server Manager

### Server Won't Start

**Check if port is in use:**
```batch
netstat -ano | findstr :3000
```

**Solution:** Change the port in `.env` file

**Check logs:**
```batch
type "%APPDATA%\PlaylistLabServer\server-error.log"
```

### Can't Access Web Interface

**Check if server is running:**
```batch
netstat -ano | findstr :3000
```

**Check Windows Firewall:**
```batch
netsh advfirewall firewall show rule name="Playlist Lab Server"
```

**Add firewall rule:**
```batch
netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000
```

### Service Won't Start

**Check service status:**
```batch
sc query PlaylistLabServer
```

**View service logs:**
```batch
type "%APPDATA%\PlaylistLabServer\server-error.log"
```

**Reinstall service:**
```batch
cd "C:\Program Files\Playlist Lab Server"
node service-manager.js uninstall
node service-manager.js install
```

### Database Errors

**Check database file exists:**
```batch
dir "%APPDATA%\PlaylistLabServer\playlist-lab.db"
```

**Check permissions:**
- Right-click the PlaylistLabServer folder
- Properties > Security
- Ensure your user has Full Control

**Reset database (WARNING: deletes all data):**
```batch
del "%APPDATA%\PlaylistLabServer\playlist-lab.db"
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

Edit `service-manager.js` or `server-launcher.js`:
```javascript
nodeOptions: [
  '--max_old_space_size=4096'  // 4GB instead of 2GB
]
```

Then reinstall/restart.

## Uninstallation

### Standard Uninstall

**Method 1: Settings**
1. Open Settings > Apps > Apps & features
2. Find "Playlist Lab Server"
3. Click Uninstall

**Method 2: Start Menu**
1. Start Menu > Playlist Lab Server
2. Click "Uninstall Playlist Lab Server"

**Method 3: Control Panel**
1. Control Panel > Programs > Uninstall a program
2. Select "Playlist Lab Server"
3. Click Uninstall

### What Gets Removed

- All program files in `C:\Program Files\Playlist Lab Server\`
- Server Manager tray application
- Start Menu shortcuts
- Desktop shortcut (if created)
- Windows Service (if installed)
- Startup entry (if configured)
- System tray icon

### What Gets Kept

Your data is preserved:
- Database: `%APPDATA%\PlaylistLabServer\playlist-lab.db`
- Logs: `%APPDATA%\PlaylistLabServer\*.log`
- Configuration: `%APPDATA%\PlaylistLabServer\.env`
- Server Manager preferences: `%APPDATA%\PlaylistLabServer\tray-preferences.json`

### Complete Removal

To remove all data:

```batch
rmdir /s /q "%APPDATA%\PlaylistLabServer"
```

**WARNING:** This deletes all your playlists, settings, and data!

## Advanced Topics

### Running on a Different Port

1. Edit `.env`:
   ```env
   PORT=8080
   ```

2. Update firewall:
   ```batch
   netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=8080
   ```

3. Restart server

### Accessing from Other Devices

1. **Find your computer's IP:**
   ```batch
   ipconfig
   ```
   Look for "IPv4 Address"

2. **Configure firewall** (see above)

3. **Access from other device:**
   ```
   http://YOUR-IP:3000
   ```

### Running Multiple Instances

1. Install to different directories
2. Use different ports in each `.env`
3. For services, edit `service-manager.js` to use different service names

### HTTPS Configuration

For secure connections, use a reverse proxy like:
- IIS with URL Rewrite
- nginx for Windows
- Caddy

Example with Caddy:
```
your-domain.com {
    reverse_proxy localhost:3000
}
```

### Automatic Backups

Create a scheduled task:

```batch
schtasks /create /tn "Backup Playlist Lab" /tr "xcopy \"%APPDATA%\PlaylistLabServer\playlist-lab.db\" \"C:\Backups\\" /sc daily /st 02:00
```

## Support

### Getting Help

- **Documentation**: Check the docs folder
- **GitHub Issues**: Report bugs and request features
- **Community**: Join our Discord/Forum
- **Email**: support@playlistlab.com

### Reporting Issues

When reporting issues, include:
1. Windows version
2. Installation mode (service/startup/standalone)
3. Error messages from logs
4. Steps to reproduce

### Logs Location

Always check logs first:
```
%APPDATA%\PlaylistLabServer\server.log
%APPDATA%\PlaylistLabServer\server-error.log
```

## FAQ

**Q: Can I run this on Windows Server?**
A: Yes, all installation modes work on Windows Server. The Server Manager tray application works on Windows Server 2016 and later.

**Q: Does it work with Windows 7?**
A: Windows 10 or higher is required for the Server Manager tray application.

**Q: Can I access it from my phone?**
A: Yes, use the mobile app or web interface at http://YOUR-IP:3000

**Q: How much disk space does it use?**
A: ~200MB for installation (including Server Manager), plus database size (varies by usage)

**Q: Can I move the installation to another computer?**
A: Yes, copy the database file and install on the new computer.

**Q: Is my data encrypted?**
A: The database is not encrypted by default. Use Windows BitLocker for encryption.

**Q: Can multiple users access it simultaneously?**
A: Yes, the server supports multiple concurrent users.

**Q: How do I update to a new version?**
A: Run the new installer, it will upgrade automatically. The Server Manager will also be updated.

**Q: Does the Server Manager use a lot of resources?**
A: No, it uses less than 100MB of RAM and minimal CPU when idle.

**Q: Can I run the server without the Server Manager?**
A: Yes, the Server Manager is optional. You can manage the server using command line or Services console.

**Q: What happens if I close the Server Manager window?**
A: The window minimizes to the tray. The server continues running. To fully exit, right-click the tray icon and select "Exit".

## License

See LICENSE file in the project root.
