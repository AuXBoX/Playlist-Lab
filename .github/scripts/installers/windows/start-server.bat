@echo off
REM Playlist Lab Server - Start Server
REM This script starts the Playlist Lab server directly

setlocal

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%SCRIPT_DIR%"

REM Check if Node.js exists in the installation
if exist "%INSTALL_DIR%nodejs\node.exe" (
    set "NODE_PATH=%INSTALL_DIR%nodejs\node.exe"
) else (
    set "NODE_PATH=node"
)

REM Check if server launcher exists
if not exist "%INSTALL_DIR%server-launcher.js" (
    echo ERROR: Server launcher not found at %INSTALL_DIR%server-launcher.js
    echo Please reinstall Playlist Lab Server.
    pause
    exit /b 1
)

REM Start the server
echo Starting Playlist Lab Server...
"%NODE_PATH%" "%INSTALL_DIR%server-launcher.js"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start server
    echo Check the logs in %APPDATA%\Playlist Lab\logs for details
    pause
    exit /b 1
)

echo.
echo Server started successfully!
echo Open http://localhost:3001 in your browser
echo.
echo You can close this window - the server will continue running in the background.
timeout /t 5

endlocal
