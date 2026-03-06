# Installation Instructions for Fixed Version

## What Was Fixed

The server was failing to start because the `schema.sql` file wasn't being copied to the compiled output directory. This has been fixed by updating the build script to copy the schema file after TypeScript compilation.

## Installation Steps

### 1. Uninstall Current Version

1. Open **Control Panel** → **Programs and Features**
2. Find **Playlist Lab Server** in the list
3. Right-click and select **Uninstall**
4. Follow the uninstall wizard

**Note:** Your data is safe! The database and logs are stored in:
- `%APPDATA%\Playlist Lab Server\data\playlist-lab.db`
- `%APPDATA%\Playlist Lab Server\logs\`

These will NOT be deleted during uninstallation.

### 2. Install New Version

1. Navigate to: `K:\Projects\Playlist Lab\scripts\release\`
2. Run: `PlaylistLabServer-Setup-1.1.2.exe`
3. Follow the installation wizard
4. Choose installation location (default: `C:\Program Files\Playlist Lab Server`)

### 3. Start the Server

1. The tray app should start automatically after installation
2. Look for the Playlist Lab icon in your system tray (bottom-right corner)
3. Right-click the tray icon
4. Select **Start Server**
5. Wait for the status to change to "Running"

### 4. Verify Installation

1. Once the server shows "Running" status, right-click the tray icon
2. Select **Open Web Interface**
3. Your browser should open to `http://localhost:3000`
4. You should see the Playlist Lab login page

## What Changed

### Build Script Update
The `apps/server/package.json` build script now includes:
```json
"build": "tsc && node -e \"const fs=require('fs');const path=require('path');fs.mkdirSync('dist/database',{recursive:true});fs.copyFileSync('src/database/schema.sql','dist/database/schema.sql');\""
```

This ensures `schema.sql` is copied from `src/database/` to `dist/database/` after compilation.

### Database Location
The database is created at:
```
%APPDATA%\Playlist Lab Server\data\playlist-lab.db
```

This location has proper write permissions and persists across installations.

## Troubleshooting

### If the server still won't start:

1. **Check the logs:**
   - Navigate to: `%APPDATA%\Playlist Lab Server\logs\`
   - Open `error.log` and `combined.log`
   - Look for any error messages

2. **Verify schema.sql exists:**
   - Navigate to: `C:\Program Files\Playlist Lab Server\server\database\`
   - Confirm `schema.sql` file is present

3. **Check database directory:**
   - Navigate to: `%APPDATA%\Playlist Lab Server\data\`
   - Confirm the directory exists and is writable

4. **Run diagnostic:**
   ```cmd
   cd "K:\Projects\Playlist Lab\scripts"
   diagnose-windows.bat
   ```

### If you see "Port already in use":

1. Stop any other instances of the server
2. Check if port 3000 is in use:
   ```cmd
   netstat -ano | findstr :3000
   ```
3. Kill the process using the port if needed

## File Locations Reference

| Item | Location |
|------|----------|
| Installer | `K:\Projects\Playlist Lab\scripts\release\PlaylistLabServer-Setup-1.1.2.exe` |
| Installation Directory | `C:\Program Files\Playlist Lab Server\` |
| Database | `%APPDATA%\Playlist Lab Server\data\playlist-lab.db` |
| Logs | `%APPDATA%\Playlist Lab Server\logs\` |
| Tray App Config | `%APPDATA%\Playlist Lab Server\config.json` |

## SHA256 Checksum

To verify the installer integrity:
```
0d8f8539fcfc479ee8959f51730b37002b83ed6c943b999d732e5b866feb28ca
```

## Support

If you encounter any issues:
1. Check the logs in `%APPDATA%\Playlist Lab Server\logs\`
2. Run the diagnostic script: `scripts\diagnose-windows.bat`
3. Review the troubleshooting guide: `TROUBLESHOOTING_GUIDE.md`
