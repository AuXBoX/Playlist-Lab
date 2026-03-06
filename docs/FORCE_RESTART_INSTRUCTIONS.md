# Force Restart Instructions - Fix tsx watch Cache Issue

## Problem
tsx watch is aggressively caching the old version of `matching.ts`, preventing the progress emission code from running.

## Solution Options

### Option 1: Force Restart with Cache Clearing (Recommended)

1. **Stop the current server** (Ctrl+C in the terminal)

2. **Run the force restart script:**
   ```cmd
   cd apps\server
   force-restart.bat
   ```

   This script will:
   - Kill any lingering Node processes
   - Clear `node_modules\.cache`
   - Delete `tsconfig.tsbuildinfo`
   - Clear `dist` folder
   - Clear tsx cache from temp folder
   - Restart server with `npm run dev`

3. **Hard refresh browser** (Ctrl+Shift+R)

4. **Try import again** and check logs

### Option 2: Build and Run Compiled Version (Bypasses tsx watch entirely)

1. **Stop the current server** (Ctrl+C in the terminal)

2. **Run the build script:**
   ```cmd
   cd apps\server
   build-and-run.bat
   ```

   This script will:
   - Kill any lingering Node processes
   - Clean old build
   - Compile TypeScript to JavaScript
   - Run the compiled code directly (no tsx watch)

3. **Hard refresh browser** (Ctrl+Shift+R)

4. **Try import again** and check logs

## Verification

After restarting, check the logs to confirm the new code is running:

```cmd
cd apps\server
type logs\combined.log | findstr "hasProgressEmitter"
```

You should see:
```json
{"level":"info","message":"[Matching] Starting","trackCount":105,"hasProgressEmitter":true,"progressEmitterType":"object",...}
```

If you still see the old log format without `hasProgressEmitter`, the cache is still being used.

## What to Look For

### In Server Logs (apps/server/logs/combined.log)
- Look for: `"hasProgressEmitter":true` in the matching started log
- Look for: `"[Matching] About to emit progress event"` for each track
- Look for: `"[Matching] Progress event emitted successfully"` for each track

### In Browser Console
- Progress events should show individual track names during matching
- Progress bar should move during matching phase

### In import-debug.log
- SSE events should include individual track progress events with `currentTrackName`

## If Still Not Working

If both options fail, the issue might be:
1. File system not syncing (rare on Windows)
2. Multiple Node processes running (check Task Manager)
3. IDE file watcher interfering (close and reopen Kiro)

Try:
1. Close Kiro completely
2. Open Task Manager and kill ALL node.exe processes
3. Reopen Kiro
4. Run Option 2 (build-and-run.bat)
