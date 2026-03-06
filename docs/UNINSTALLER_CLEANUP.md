# Uninstaller Cleanup Process

## Overview

The Windows installer includes comprehensive cleanup during uninstallation to ensure all server processes are stopped and files can be removed without "files in use" errors.

**CRITICAL**: The tray app is killed FIRST because it's the main culprit that keeps files locked.

## Cleanup Steps

The `InitializeUninstall()` function in `setup.iss` performs the following steps in order:

### Step 1: Stop Tray Application (CRITICAL - FIRST)
The tray app runs as a hidden PowerShell process and keeps file handles open. It MUST be killed first.

- **PowerShell command line search**: Finds PowerShell processes with `tray-app.ps1` in command line
- **Kill wscript.exe**: Terminates the VBS launcher that starts the tray app
- **Kill by window title**: Catches any remaining PowerShell processes with "tray-app" in title
- **Wait 2 seconds**: Allows tray app to fully terminate and release file handles

### Step 2: Kill Processes on Port 3001
- Uses PowerShell `Get-NetTCPConnection` to find processes listening on port 3001
- Kills each process by PID
- Ensures the server port is freed

### Step 3: Kill Node.js Processes by Path
- Finds all node.exe processes with path containing "Playlist Lab Server"
- Kills each process
- Catches server processes started from the installation directory

### Step 4: Kill Node.js Processes by Command Line
- Uses WMI to find node.exe processes with the installation directory in their command line
- Most reliable method for finding Playlist Lab Server processes
- Ensures all server processes are terminated

### Step 5: Wait for Process Termination
- Sleeps for 3 seconds to allow processes to fully terminate
- Ensures file handles are released

### Step 6: Stop and Remove Windows Service
- Stops the Windows service if installed
- Uninstalls the Windows service
- Uses the service-manager.js script

### Step 7: Remove from Startup
- Removes the tray app from Windows startup
- Uses the startup-manager.js script

### Step 8: Final Wait
- Sleeps for 2 more seconds
- Ensures all file handles are fully released before uninstaller proceeds

**Total wait time: 7 seconds** (2 + 3 + 2) to ensure clean uninstallation.

## Why the Tray App is Killed First

The tray app is the PRIMARY cause of "files in use" errors during uninstallation because:

1. **Hidden PowerShell process**: Runs as a background PowerShell process that's not visible
2. **File handles**: Keeps handles open on:
   - `tray-app.ps1` script file
   - PowerShell DLLs in the installation directory
   - .NET assemblies loaded by the tray app
3. **Hard to kill**: Standard taskkill commands don't work well because:
   - The process has no window title (runs hidden)
   - Multiple PowerShell processes may be running
   - Need to identify by command line, not just process name

## How the Tray App is Killed

The uninstaller uses multiple methods to ensure the tray app is terminated:

1. **PowerShell command line search** (most reliable):
   ```powershell
   Get-Process -Name powershell | Where-Object { $_.CommandLine -like '*tray-app.ps1*' } | Stop-Process -Force
   ```

2. **Kill VBS launcher**:
   ```cmd
   taskkill /F /IM wscript.exe
   ```

3. **Kill by window title** (backup method):
   ```cmd
   taskkill /F /FI "IMAGENAME eq powershell.exe" /FI "WINDOWTITLE eq *tray-app*"
   ```

## Testing the Uninstaller

To verify the uninstaller works correctly:

1. Install Playlist Lab Server with any startup mode
2. Start the tray app (it should appear in system tray)
3. Verify the server is running at http://localhost:3001
4. Run the uninstaller
5. Check that:
   - The tray icon disappears immediately
   - All node.exe processes are terminated
   - Port 3001 is freed
   - All files are removed from the installation directory
   - No "files in use" errors occur

## Troubleshooting

If files remain after uninstallation:

1. **Check for tray app**: Look in Task Manager for hidden PowerShell processes
2. **Kill manually**:
   ```powershell
   Get-Process powershell | Where-Object { $_.CommandLine -like '*tray-app*' } | Stop-Process -Force
   ```
3. **Check for server processes**: `Get-Process node`
4. **Check port 3001**: `netstat -ano | findstr :3001`
5. **Delete installation directory manually** after killing all processes

## Related Files

- `scripts/installers/windows/setup.iss` - Inno Setup script with InitializeUninstall function
- `scripts/installers/windows/tray-app.ps1` - Tray application (main culprit for file locks)
- `scripts/installers/windows/start-tray-app.bat` - Tray app launcher (uses VBS)
- `scripts/installers/windows/server-launcher.js` - Server launcher script
- `scripts/installers/windows/service-manager.js` - Windows service management
- `scripts/installers/windows/startup-manager.js` - Startup configuration management
