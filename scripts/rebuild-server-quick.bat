@echo off
echo ========================================
echo Quick Server Rebuild
echo ========================================
echo.

cd /d "%~dp0\.."

echo [1/3] Building server...
cd apps\server
call npm run build
if errorlevel 1 (
    echo ERROR: Server build failed
    pause
    exit /b 1
)

echo.
echo [2/3] Stopping server...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *playlist-lab*" 2>nul

echo.
echo [3/3] Starting server...
cd dist
start "Playlist Lab Server" node index.js

echo.
echo ========================================
echo Server rebuilt and restarted!
echo ========================================
echo.
echo Server should be running at: http://localhost:3001
echo.
echo Check the server console window for logs
echo.
pause
