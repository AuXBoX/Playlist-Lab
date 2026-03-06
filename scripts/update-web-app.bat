@echo off
REM Quick script to update the web app in the installed server
REM Run this after building the web app to update the running server

echo ========================================
echo Updating Playlist Lab Web App
echo ========================================
echo.

set INSTALL_DIR=C:\Program Files\Playlist Lab Server
set WEB_DIST=%~dp0..\apps\web\dist

echo Checking if server is installed...
if not exist "%INSTALL_DIR%" (
    echo ERROR: Playlist Lab Server is not installed at %INSTALL_DIR%
    echo Please install the server first or update INSTALL_DIR in this script
    pause
    exit /b 1
)

echo Checking if web app is built...
if not exist "%WEB_DIST%\index.html" (
    echo ERROR: Web app is not built
    echo Please run: cd apps\web ^&^& npm run build
    pause
    exit /b 1
)

echo.
echo Stopping server...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *playlist-lab*" >nul 2>&1

echo.
echo Backing up current web app...
if exist "%INSTALL_DIR%\web\dist.backup" (
    rmdir /s /q "%INSTALL_DIR%\web\dist.backup"
)
if exist "%INSTALL_DIR%\web\dist" (
    move "%INSTALL_DIR%\web\dist" "%INSTALL_DIR%\web\dist.backup" >nul
)

echo.
echo Copying new web app...
xcopy /E /I /Y "%WEB_DIST%" "%INSTALL_DIR%\web\dist" >nul

if errorlevel 1 (
    echo ERROR: Failed to copy web app
    echo Restoring backup...
    if exist "%INSTALL_DIR%\web\dist.backup" (
        move "%INSTALL_DIR%\web\dist.backup" "%INSTALL_DIR%\web\dist" >nul
    )
    pause
    exit /b 1
)

echo.
echo ========================================
echo Web app updated successfully!
echo ========================================
echo.
echo Starting server...
start "" "%INSTALL_DIR%\server-launcher.exe"

echo.
echo Done! The server is starting with the updated web app.
echo Open http://localhost:3001 in your browser
echo.
pause
