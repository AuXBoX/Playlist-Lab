@echo off
echo ========================================
echo Starting Playlist Lab in Development Mode
echo ========================================
echo.

REM Change to project root directory (one level up from scripts folder)
cd /d "%~dp0.."

echo [1/4] Cleaning up old processes...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Old Node processes killed
    timeout /t 2 /nobreak > nul
) else (
    echo     ℹ No old processes found
)

echo [2/6] Clearing playlist cache...
cd apps\server
node clear-cache.js 2>nul
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Playlist cache cleared
) else (
    echo     ℹ No cache to clear
)
cd ..\..
echo.

echo [3/6] Clearing tsx/TypeScript cache...
if exist "apps\server\node_modules\.cache" (
    rmdir /s /q "apps\server\node_modules\.cache"
    echo     ✓ tsx cache cleared
) else (
    echo     ℹ No tsx cache to clear
)
if exist "apps\server\dist" (
    rmdir /s /q "apps\server\dist"
    echo     ✓ dist folder cleared
) else (
    echo     ℹ No dist folder to clear
)
if exist "apps\server\tsconfig.tsbuildinfo" (
    del /f /q "apps\server\tsconfig.tsbuildinfo"
    echo     ✓ tsbuildinfo cleared
) else (
    echo     ℹ No tsbuildinfo to clear
)
echo.

echo [4/6] Cleaning Vite cache...
if exist "apps\web\node_modules\.vite" (
    rmdir /s /q "apps\web\node_modules\.vite"
    echo     ✓ Vite cache cleared
) else (
    echo     ℹ No Vite cache to clear
)

echo [5/6] Cleaning ports 3001 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
    echo     ✓ Port 3001 cleaned
)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
    echo     ✓ Port 5173 cleaned
)
timeout /t 2 /nobreak > nul

echo [6/6] Starting servers...
echo     API Server: http://localhost:3001
echo     Web App: http://localhost:5173
echo.

start "Playlist Lab API Server" cmd /k "cd apps\server && npm run dev"
timeout /t 3 /nobreak > nul
start "Playlist Lab Web App" cmd /k "cd apps\web && npm run dev"

echo.
echo ========================================
echo SERVERS STARTING!
echo ========================================
echo.
echo IMPORTANT: Clear your browser cache to see latest changes!
echo   - Press Ctrl+Shift+R (Chrome/Edge)
echo   - Press Ctrl+F5 (Firefox)
echo   - OR open in Incognito/Private window
echo.
echo Wait 10-15 seconds, then open: http://localhost:5173
echo.
echo Press F12 and check Console for: "BUILD_TIMESTAMP: 2025-01-XX-FORCE-REFRESH"
echo.
pause
