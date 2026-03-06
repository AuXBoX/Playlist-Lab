@echo off
REM Quick Windows Installer Build Script
REM Assumes apps are already built - just creates the installer

setlocal enabledelayedexpansion

REM Get version from parameter or use default
set APP_VERSION=%~1
if "%APP_VERSION%"=="" set APP_VERSION=2.0.0

echo Building Windows installer (quick mode - no rebuild)...
echo Version: %APP_VERSION%

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..\..
set BUILD_DIR=%PROJECT_ROOT%\release

REM Check if apps are built
if not exist "%PROJECT_ROOT%\apps\server\dist" (
    echo Error: Server not built! Run build-windows.bat first or build manually.
    exit /b 1
)
if not exist "%PROJECT_ROOT%\apps\web\dist" (
    echo Error: Web app not built! Run build-windows.bat first or build manually.
    exit /b 1
)

REM Check if Inno Setup is available
set INNO_SETUP=
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set "INNO_SETUP=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set "INNO_SETUP=C:\Program Files\Inno Setup 6\ISCC.exe"
) else (
    echo Error: Inno Setup not found!
    echo Please install Inno Setup from: https://jrsoftware.org/isdl.php
    exit /b 1
)

REM Create temp directory if it doesn't exist
if not exist "%PROJECT_ROOT%\scripts\temp" mkdir "%PROJECT_ROOT%\scripts\temp"

REM Copy Node.js runtime from cache to temp if not already there
if not exist "%PROJECT_ROOT%\scripts\temp\node-v20.11.0-win-x64" (
    echo Copying Node.js runtime from cache...
    if exist "%PROJECT_ROOT%\scripts\cache\node-v20.11.0-win-x64" (
        xcopy /E /I /Y "%PROJECT_ROOT%\scripts\cache\node-v20.11.0-win-x64" "%PROJECT_ROOT%\scripts\temp\node-v20.11.0-win-x64"
    ) else (
        echo Error: Node.js runtime not found in cache!
        echo Please download Node.js v20.11.0 portable and place in scripts\cache\
        exit /b 1
    )
)

REM Copy setup script to temp location
set TEMP_SETUP=%PROJECT_ROOT%\scripts\temp\setup-temp.iss
copy /y "%SCRIPT_DIR%setup.iss" "%TEMP_SETUP%"

REM Update version in the temp setup script using PowerShell
powershell -Command "(Get-Content '%TEMP_SETUP%') -replace '#define MyAppVersion \".*\"', '#define MyAppVersion \"%APP_VERSION%\"' | Set-Content '%TEMP_SETUP%'"

REM Build the installer (run from the installers/windows directory so relative paths work)
echo Running Inno Setup...
cd /d "%SCRIPT_DIR%"
"%INNO_SETUP%" "%TEMP_SETUP%"
if errorlevel 1 (
    echo Error running Inno Setup!
    exit /b 1
)

REM Clean up
del "%TEMP_SETUP%"

echo.
echo =========================================
echo Windows installer created successfully!
echo =========================================
echo Location: %BUILD_DIR%\PlaylistLabServer-Setup-%APP_VERSION%.exe
echo.

