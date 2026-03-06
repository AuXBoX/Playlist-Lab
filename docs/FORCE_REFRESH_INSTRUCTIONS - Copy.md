# Force Refresh Instructions - Import Page Not Updating

## Problem
The import page is still showing the old UI with:
- Long ID string instead of playlist name
- No progress bar
- Cancel button not working

This is a **browser caching issue** - the new code is in the files but your browser is serving old JavaScript.

## Solution - Follow These Steps EXACTLY

### Step 1: Stop All Servers
1. Close ALL command prompt windows running the dev servers
2. OR press Ctrl+C in each window to stop them

### Step 2: Run Force Refresh Script
```batch
scripts\force-refresh-dev.bat
```

This script will:
- Kill all Node processes
- Delete Vite cache
- Clean up ports 3000 and 5173
- Start fresh dev servers

### Step 3: Clear Browser Cache (CRITICAL!)

Choose ONE of these methods:

**Method A: Hard Refresh (Easiest)**
1. Open http://localhost:5173
2. Press `Ctrl + Shift + R` (Chrome/Edge)
3. OR Press `Ctrl + F5` (Firefox)

**Method B: Clear Cache**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"
4. Reload the page

**Method C: Incognito/Private Window (Best for Testing)**
1. Open a new Incognito/Private window
2. Go to http://localhost:5173
3. Log in again

### Step 4: Verify the Fix

After clearing cache, you should see:

**Import Progress Modal:**
- ✅ Shows actual playlist name (e.g., "Top 50 Global")
- ✅ Shows visual progress bar that fills up
- ✅ Shows "25 / 50 tracks" counter
- ✅ Shows current track name during matching
- ✅ Shows "Fetching playlist..." or "Matching tracks..."

**Cancel Button:**
- ✅ Clicking Cancel immediately closes the modal
- ✅ Import stops
- ✅ No error message appears

## Still Not Working?

### Check 1: Verify Servers Are Running
Open these URLs in your browser:
- http://localhost:3000 - Should show API response
- http://localhost:5173 - Should show the app

### Check 2: Check Browser Console
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for errors (red text)
4. Take a screenshot and share it

### Check 3: Check Network Tab
1. Press F12 to open DevTools
2. Go to Network tab
3. Reload the page (Ctrl+R)
4. Look for ImportPage files
5. Check if they're loading from cache (should say "200" not "304")

### Check 4: Verify File Changes
Run this command to verify the changes are in the file:
```batch
findstr /C:"importProgress.playlistName" apps\web\src\pages\ImportPage.tsx
```

Should output:
```
              {importProgress.playlistName}
```

### Check 5: Nuclear Option - Delete node_modules
If nothing else works:
```batch
cd apps\web
rmdir /s /q node_modules
npm install
cd ..\..
scripts\force-refresh-dev.bat
```

## Technical Details

### What Changed

**File: `apps/web/src/pages/ImportPage.tsx`**

**Lines 1916-1920** - Playlist Name Display:
```tsx
<h2 style={{ 
  margin: '0 0 0.5rem 0',
  fontSize: '1.75rem',
  fontWeight: 600,
  color: '#ffffff',
}}>
  {importProgress.playlistName}  // ← Changed from session ID
</h2>
```

**Lines 1935-1948** - Progress Bar:
```tsx
<div style={{
  width: '100%',
  height: '8px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: '4px',
  overflow: 'hidden',
  marginBottom: '1rem',
}}>
  <div style={{
    width: `${(importProgress.currentTrack / importProgress.totalTracks) * 100}%`,
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s ease',
  }} />
</div>
```

**Lines 358-383** - Cancel Handler:
```tsx
const handleCancelImport = async () => {
  if (currentSessionId && currentEventSource) {
    setUserCancelled(true);
    currentEventSource.close();
    setCurrentEventSource(null);
    setCurrentSessionId(null);
    setImportProgress(null);
    setIsImporting(false);
    
    try {
      await fetch(`/api/import/cancel/${currentSessionId}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to cancel import:', err);
    }
    
    setTimeout(() => setUserCancelled(false), 1000);
  }
};
```

### Why This Happens

1. **Vite HMR (Hot Module Replacement)** sometimes fails to update large files
2. **Browser caches JavaScript** aggressively for performance
3. **Service Workers** (if any) can cache old versions
4. **Disk cache** in node_modules/.vite can serve stale files

### Prevention

To avoid this in the future:
1. Always do a hard refresh (Ctrl+F5) after pulling code changes
2. Use Incognito mode for testing new features
3. Disable cache in DevTools (F12 → Network tab → "Disable cache" checkbox)

## Contact

If you're still having issues after following ALL these steps, please provide:
1. Screenshot of the import modal
2. Screenshot of browser console (F12 → Console)
3. Screenshot of Network tab showing ImportPage.tsx request
4. Output of: `findstr /C:"importProgress.playlistName" apps\web\src\pages\ImportPage.tsx`
