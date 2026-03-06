@echo off
REM Playlist Lab Server - Windows Diagnostic Script
REM This script checks your installation and helps diagnose issues

echo ========================================
echo Playlist Lab Server - Diagnostic Tool
echo ========================================
echo.

REM Create output file
set OUTPUT=%USERPROFILE%\Desktop\playlist-lab-diagnostic.txt
echo Diagnostic Report > "%OUTPUT%"
echo Generated: %DATE% %TIME% >> "%OUTPUT%"
echo. >> "%OUTPUT%"

echo Checking installation...
echo.

REM Check installation directory
echo [1/10] Checking installation directory...
echo ======================================== >> "%OUTPUT%"
echo Installation Directory Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

if exist "C:\Program Files\Playlist Lab Server" (
    echo [OK] Installation directory exists
    echo [OK] Installation directory exists >> "%OUTPUT%"
    dir "C:\Program Files\Playlist Lab Server" >> "%OUTPUT%" 2>&1
) else (
    echo [ERROR] Installation directory not found!
    echo [ERROR] Installation directory not found at: C:\Program Files\Playlist Lab Server >> "%OUTPUT%"
    echo.
    echo The application may not be installed correctly.
    echo Please reinstall Playlist Lab Server.
    pause
    exit /b 1
)
echo. >> "%OUTPUT%"

REM Check server files
echo [2/10] Checking server files...
echo ======================================== >> "%OUTPUT%"
echo Server Files Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

if exist "C:\Program Files\Playlist Lab Server\server\dist\index.js" (
    echo [OK] Server files found
    echo [OK] Server files found >> "%OUTPUT%"
) else (
    echo [ERROR] Server files missing!
    echo [ERROR] Server files missing at: C:\Program Files\Playlist Lab Server\server\dist\index.js >> "%OUTPUT%"
)

dir "C:\Program Files\Playlist Lab Server\server\dist" >> "%OUTPUT%" 2>&1
echo. >> "%OUTPUT%"

REM Check Node.js
echo [3/10] Checking Node.js...
echo ======================================== >> "%OUTPUT%"
echo Node.js Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

if exist "C:\Program Files\Playlist Lab Server\nodejs\node.exe" (
    echo [OK] Bundled Node.js found
    echo [OK] Bundled Node.js found >> "%OUTPUT%"
    "C:\Program Files\Playlist Lab Server\nodejs\node.exe" --version >> "%OUTPUT%" 2>&1
    echo Node.js version: >> "%OUTPUT%"
    "C:\Program Files\Playlist Lab Server\nodejs\node.exe" --version
) else (
    echo [WARNING] Bundled Node.js not found, checking system Node.js...
    echo [WARNING] Bundled Node.js not found >> "%OUTPUT%"
    where node >> "%OUTPUT%" 2>&1
    if errorlevel 1 (
        echo [ERROR] Node.js not found!
        echo [ERROR] Node.js not found in system PATH >> "%OUTPUT%"
    ) else (
        echo [OK] System Node.js found
        echo [OK] System Node.js found >> "%OUTPUT%"
        node --version >> "%OUTPUT%" 2>&1
    )
)
echo. >> "%OUTPUT%"

REM Check data directory
echo [4/10] Checking data directory...
echo ======================================== >> "%OUTPUT%"
echo Data Directory Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

if exist "%APPDATA%\PlaylistLabServer" (
    echo [OK] Data directory exists
    echo [OK] Data directory exists >> "%OUTPUT%"
    dir "%APPDATA%\PlaylistLabServer" >> "%OUTPUT%" 2>&1
) else (
    echo [WARNING] Data directory not found, creating...
    echo [WARNING] Data directory not found, creating... >> "%OUTPUT%"
    mkdir "%APPDATA%\PlaylistLabServer" 2>> "%OUTPUT%"
    if errorlevel 1 (
        echo [ERROR] Failed to create data directory!
        echo [ERROR] Failed to create data directory >> "%OUTPUT%"
    ) else (
        echo [OK] Data directory created
        echo [OK] Data directory created >> "%OUTPUT%"
    )
)
echo. >> "%OUTPUT%"

REM Check configuration
echo [5/10] Checking configuration...
echo ======================================== >> "%OUTPUT%"
echo Configuration Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

if exist "C:\Program Files\Playlist Lab Server\server\.env" (
    echo [OK] Configuration file exists
    echo [OK] Configuration file exists >> "%OUTPUT%"
    echo Configuration contents: >> "%OUTPUT%"
    type "C:\Program Files\Playlist Lab Server\server\.env" >> "%OUTPUT%" 2>&1
) else (
    echo [WARNING] Configuration file not found
    echo [WARNING] Configuration file not found >> "%OUTPUT%"
    echo Server will use default configuration.
)
echo. >> "%OUTPUT%"

REM Check port availability
echo [6/10] Checking port 3000...
echo ======================================== >> "%OUTPUT%"
echo Port Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

netstat -ano | findstr :3000 > nul
if errorlevel 1 (
    echo [OK] Port 3000 is available
    echo [OK] Port 3000 is available >> "%OUTPUT%"
) else (
    echo [WARNING] Port 3000 is in use!
    echo [WARNING] Port 3000 is in use >> "%OUTPUT%"
    echo Processes using port 3000: >> "%OUTPUT%"
    netstat -ano | findstr :3000 >> "%OUTPUT%"
    echo.
    echo Another application is using port 3000.
    echo You may need to stop it or change the server port.
)
echo. >> "%OUTPUT%"

REM Check firewall
echo [7/10] Checking firewall rules...
echo ======================================== >> "%OUTPUT%"
echo Firewall Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

netsh advfirewall firewall show rule name="Playlist Lab Server" > nul 2>&1
if errorlevel 1 (
    echo [WARNING] Firewall rule not found
    echo [WARNING] Firewall rule not found >> "%OUTPUT%"
    echo.
    echo To allow remote access, run this command as Administrator:
    echo netsh advfirewall firewall add rule name="Playlist Lab Server" dir=in action=allow protocol=TCP localport=3000
) else (
    echo [OK] Firewall rule exists
    echo [OK] Firewall rule exists >> "%OUTPUT%"
    netsh advfirewall firewall show rule name="Playlist Lab Server" >> "%OUTPUT%" 2>&1
)
echo. >> "%OUTPUT%"

REM Check tray app
echo [8/10] Checking tray application...
echo ======================================== >> "%OUTPUT%"
echo Tray Application Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

if exist "C:\Program Files\Playlist Lab Server\tray-app" (
    echo [OK] Tray app directory exists
    echo [OK] Tray app directory exists >> "%OUTPUT%"
    dir "C:\Program Files\Playlist Lab Server\tray-app" >> "%OUTPUT%" 2>&1
) else (
    echo [ERROR] Tray app directory not found!
    echo [ERROR] Tray app directory not found >> "%OUTPUT%"
)
echo. >> "%OUTPUT%"

REM Check running processes
echo [9/10] Checking running processes...
echo ======================================== >> "%OUTPUT%"
echo Process Check >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

tasklist | findstr /I "node.exe" > nul
if errorlevel 1 (
    echo [INFO] Server is not currently running
    echo [INFO] Server is not currently running >> "%OUTPUT%"
) else (
    echo [INFO] Node.js process found (server may be running)
    echo [INFO] Node.js process found >> "%OUTPUT%"
    tasklist | findstr /I "node.exe" >> "%OUTPUT%"
)
echo. >> "%OUTPUT%"

REM Check system info
echo [10/10] Collecting system information...
echo ======================================== >> "%OUTPUT%"
echo System Information >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"

systeminfo | findstr /C:"OS Name" /C:"OS Version" /C:"System Type" >> "%OUTPUT%"
echo. >> "%OUTPUT%"

REM Network configuration
echo ======================================== >> "%OUTPUT%"
echo Network Configuration >> "%OUTPUT%"
echo ======================================== >> "%OUTPUT%"
ipconfig | findstr /C:"IPv4" /C:"Subnet" >> "%OUTPUT%"
echo. >> "%OUTPUT%"

REM Summary
echo.
echo ========================================
echo Diagnostic Complete!
echo ========================================
echo.
echo Report saved to: %OUTPUT%
echo.

REM Check for critical errors
set CRITICAL_ERROR=0

if not exist "C:\Program Files\Playlist Lab Server" set CRITICAL_ERROR=1
if not exist "C:\Program Files\Playlist Lab Server\server\dist\index.js" set CRITICAL_ERROR=1
if not exist "C:\Program Files\Playlist Lab Server\nodejs\node.exe" (
    where node > nul 2>&1
    if errorlevel 1 set CRITICAL_ERROR=1
)

if %CRITICAL_ERROR%==1 (
    echo [!] CRITICAL ERRORS FOUND
    echo.
    echo Your installation has critical issues that prevent the server from running.
    echo Please reinstall Playlist Lab Server.
    echo.
) else (
    echo [OK] No critical errors found
    echo.
    echo Your installation appears to be correct.
    echo.
    echo If you're still having issues:
    echo 1. Check the diagnostic report for warnings
    echo 2. Try running the tray app as Administrator
    echo 3. Check the troubleshooting guide
    echo.
)

echo Press any key to open the diagnostic report...
pause > nul
notepad "%OUTPUT%"
