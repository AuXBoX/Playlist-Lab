@echo off
REM =========================================
REM Playlist Lab - Comprehensive Build Script
REM Builds shared package, web app, server, desktop app, and installers
REM =========================================

setlocal enabledelayedexpansion

REM Configuration
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set BUILD_DIR=%SCRIPT_DIR%release
set TEMP_DIR=%SCRIPT_DIR%temp
set CACHE_DIR=%SCRIPT_DIR%cache

REM Auto-detect version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /r "\"version\":" "%PROJECT_ROOT%\package.json"') do (
    set APP_VERSION=%%a
    set APP_VERSION=!APP_VERSION:"=!
    goto version_found
)
:version_found
if "%APP_VERSION%"=="" set APP_VERSION=2.0.0
echo Detected version: %APP_VERSION%

REM Check if running with command line arguments
if not "%~1"=="" goto parse_args

REM Interactive Menu Mode
:menu
cls
echo =========================================
echo   Playlist Lab - Build Menu
echo =========================================
echo.
echo   Individual Builds:
echo     [1] Shared Package only
echo     [2] Web App only
echo     [3] Server only
echo     [4] Mobile App - iOS only
echo     [5] Mobile App - Android only
echo     [6] Mobile App - Both (iOS + Android)
echo.
echo   Combined Builds:
echo     [7] Web App + Server (no installer)
echo     [8] Full Stack (Shared + Web + Server)
echo.
echo   Installers:
echo     [9] Windows Server Installer (full pipeline)
echo    [10] Desktop App - Windows Only
echo    [11] Everything (Desktop + Server + Mobile)
echo.
echo    [0] Exit
echo.
set /p CHOICE="Enter your choice (0-11): "

if "%CHOICE%"=="0" goto exit_script
if "%CHOICE%"=="1" (
    set DO_SHARED=true
    set DO_WEB=false
    set DO_SERVER=false
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="2" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=false
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="3" (
    set DO_SHARED=true
    set DO_WEB=false
    set DO_SERVER=true
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="4" (
    set DO_SHARED=true
    set DO_WEB=false
    set DO_SERVER=false
    set DO_TRAY=false
    set DO_MOBILE_IOS=true
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="5" (
    set DO_SHARED=true
    set DO_WEB=false
    set DO_SERVER=false
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=true
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="6" (
    set DO_SHARED=true
    set DO_WEB=false
    set DO_SERVER=false
    set DO_MOBILE_IOS=true
    set DO_MOBILE_ANDROID=true
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="7" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=true
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="8" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=true
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=true
    goto start_build
)
if "%CHOICE%"=="9" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=true
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=true
    set DO_DESKTOP=false
    set DESKTOP_PLATFORM=none
    set SKIP_VERSION=false
    goto version_prompt
)
if "%CHOICE%"=="10" (
    set DO_SHARED=false
    set DO_WEB=false
    set DO_SERVER=false
    set DO_MOBILE_IOS=false
    set DO_MOBILE_ANDROID=false
    set DO_INSTALLER=false
    set DO_DESKTOP=true
    set DESKTOP_PLATFORM=all
    set SKIP_VERSION=false
    goto version_prompt
)
if "%CHOICE%"=="11" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=true
    set DO_MOBILE_IOS=true
    set DO_MOBILE_ANDROID=true
    set DO_INSTALLER=true
    set DO_DESKTOP=true
    set DESKTOP_PLATFORM=win
    set SKIP_VERSION=false
    goto version_prompt
)
echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu
goto menu

:version_prompt
echo.
echo =========================================
echo   Version Number
echo =========================================
echo.
echo Auto-detected version from package.json: %APP_VERSION%
echo.
set /p VERSION_INPUT="Press Enter to use %APP_VERSION%, or enter a different version: "
if not "%VERSION_INPUT%"=="" set APP_VERSION=%VERSION_INPUT%
echo.
echo Using version: %APP_VERSION%
set /p CONFIRM="Correct? (Y/N): "
if /i not "%CONFIRM%"=="Y" goto version_prompt
goto start_build

REM =========================================
REM Parse command line arguments
REM =========================================
:parse_args
set DO_SHARED=false
set DO_WEB=false
set DO_SERVER=false
set DO_MOBILE_IOS=false
set DO_MOBILE_ANDROID=false
set DO_INSTALLER=false
set DO_DESKTOP=false
set DESKTOP_PLATFORM=none
set SKIP_VERSION=true
set APP_VERSION=2.0.0

:parse_loop
if "%~1"=="" goto start_build
if /i "%~1"=="--shared" (
    set DO_SHARED=true
    shift & goto parse_loop
)
if /i "%~1"=="--web" (
    set DO_SHARED=true
    set DO_WEB=true
    shift & goto parse_loop
)
if /i "%~1"=="--server" (
    set DO_SHARED=true
    set DO_SERVER=true
    shift & goto parse_loop
)
if /i "%~1"=="--mobile-ios" (
    set DO_SHARED=true
    set DO_MOBILE_IOS=true
    shift & goto parse_loop
)
if /i "%~1"=="--mobile-android" (
    set DO_SHARED=true
    set DO_MOBILE_ANDROID=true
    shift & goto parse_loop
)
if /i "%~1"=="--mobile" (
    set DO_SHARED=true
    set DO_MOBILE_IOS=true
    set DO_MOBILE_ANDROID=true
    shift & goto parse_loop
)
if /i "%~1"=="--installer" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=true
    set DO_INSTALLER=true
    shift & goto parse_loop
)
if /i "%~1"=="--desktop" (
    set DO_DESKTOP=true
    set DESKTOP_PLATFORM=win
    shift & goto parse_loop
)
if /i "%~1"=="--desktop-all" (
    set DO_DESKTOP=true
    set DESKTOP_PLATFORM=win
    shift & goto parse_loop
)
if /i "%~1"=="--all" (
    set DO_SHARED=true
    set DO_WEB=true
    set DO_SERVER=true
    set DO_MOBILE_IOS=true
    set DO_MOBILE_ANDROID=true
    set DO_INSTALLER=true
    set DO_DESKTOP=true
    set DESKTOP_PLATFORM=win
    shift & goto parse_loop
)
if /i "%~1"=="--version" (
    set APP_VERSION=%~2
    shift & shift & goto parse_loop
)
if /i "%~1"=="--help" goto show_help
echo Unknown option: %~1
goto show_help

:show_help
echo.
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo   --shared         Build shared package only
echo   --web            Build web app (includes shared)
echo   --server         Build server (includes shared)
echo   --mobile-ios     Build mobile app for iOS (EAS Build)
echo   --mobile-android Build mobile app for Android (EAS Build)
echo   --mobile         Build mobile app for both platforms
echo   --installer      Build Windows server installer (full pipeline)
echo   --desktop        Build desktop app (Windows)
echo   --desktop-all    Build desktop app (Windows only - cross-platform not supported)
echo   --all            Build everything
echo   --version VER    Set version number (default: 2.0.0)
echo   --help           Show this help
echo.
echo Examples:
echo   %~nx0 --web --server
echo   %~nx0 --mobile-ios
echo   %~nx0 --installer --version 2.1.0
echo   %~nx0 --all --version 2.1.0
exit /b 0

REM =========================================
REM Start Build
REM =========================================
:start_build
cls
echo =========================================
echo   Playlist Lab - Build
echo =========================================
echo.
if not "%SKIP_VERSION%"=="true" echo   Version: %APP_VERSION%
echo   Building:
if "%DO_SHARED%"=="true" echo     - Shared Package
if "%DO_WEB%"=="true" echo     - Web App
if "%DO_SERVER%"=="true" echo     - Server
if "%DO_MOBILE_IOS%"=="true" echo     - Mobile App (iOS)
if "%DO_MOBILE_ANDROID%"=="true" echo     - Mobile App (Android)
if "%DO_INSTALLER%"=="true" echo     - Windows Server Installer
if "%DO_DESKTOP%"=="true" echo     - Desktop App (%DESKTOP_PLATFORM%)
echo.

REM Build Shared Package
if "%DO_SHARED%"=="true" call :build_shared
if errorlevel 1 goto build_failed

REM Build Web App
if "%DO_WEB%"=="true" call :build_web
if errorlevel 1 goto build_failed

REM Build Server
if "%DO_SERVER%"=="true" call :build_server
if errorlevel 1 goto build_failed

REM Build Mobile App (iOS)
if "%DO_MOBILE_IOS%"=="true" call :build_mobile_ios
if errorlevel 1 goto build_failed

REM Build Mobile App (Android)
if "%DO_MOBILE_ANDROID%"=="true" call :build_mobile_android
if errorlevel 1 goto build_failed

REM Build Desktop App
if "%DO_DESKTOP%"=="true" call :build_desktop
if errorlevel 1 goto build_failed

REM Build Windows Server Installer
if "%DO_INSTALLER%"=="true" call :build_windows_installer
if errorlevel 1 goto build_failed

echo.
echo =========================================
echo   Build Complete!
echo =========================================
echo.
if "%DO_INSTALLER%"=="true" (
    if exist "%BUILD_DIR%" (
        echo   Artifacts in %BUILD_DIR%:
        dir /b "%BUILD_DIR%" 2>nul
        echo.
        echo =========================================
        echo   REINSTALL INSTRUCTIONS
        echo =========================================
        echo.
        echo To install the new version:
        echo.
        echo 1. Uninstall current version:
        echo    - Open Settings ^> Apps ^> Installed apps
        echo    - Find "Playlist Lab Server"
        echo    - Click Uninstall and wait for completion
        echo.
        echo 2. Install new version:
        for %%f in ("%BUILD_DIR%\*.exe") do (
            echo    - Run: %%~nxf
        )
        echo    - Choose your startup mode
        echo    - Wait for installation to complete
        echo.
        echo 3. Verify installation:
        echo    - The tray app will start automatically
        echo    - Open http://localhost:3001 in your browser
        echo    - The web interface should load immediately
        echo.
        echo Opening installer location...
        explorer "%BUILD_DIR%"
    )
)
echo.
pause
exit /b 0

:build_failed
echo.
echo =========================================
echo   BUILD FAILED
echo =========================================
echo.
pause
exit /b 1

:exit_script
echo Exiting...
exit /b 0

REM =========================================
REM BUILD FUNCTIONS
REM =========================================

:build_shared
echo.
echo =========================================
echo   Building Shared Package
echo =========================================
cd /d "%PROJECT_ROOT%\packages\shared"
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error installing shared dependencies!
    exit /b 1
)
echo Compiling TypeScript...
call npm run build
if errorlevel 1 (
    echo Error building shared package!
    exit /b 1
)
echo Shared package built successfully
cd /d "%PROJECT_ROOT%"
exit /b 0

:build_web
echo.
echo =========================================
echo   Building Web App
echo =========================================
cd /d "%PROJECT_ROOT%\apps\web"
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error installing web dependencies!
    exit /b 1
)
echo Cleaning previous build...
if exist "dist" rmdir /s /q "dist"
echo Building web app (tsc + vite)...
call npm run build
if errorlevel 1 (
    echo Error building web app!
    exit /b 1
)
echo Web app built successfully
echo.
echo Verifying compiled files...
if not exist "dist\index.html" (
    echo ERROR: dist\index.html not found after build!
    exit /b 1
)
echo All compiled files verified
cd /d "%PROJECT_ROOT%"
exit /b 0

:build_server
echo.
echo =========================================
echo   Building Server
echo =========================================
cd /d "%PROJECT_ROOT%\apps\server"
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error installing server dependencies!
    exit /b 1
)
echo Cleaning previous build...
call npm run clean
echo Building server (tsc --build + copy schema)...
call npm run build
if errorlevel 1 (
    echo Error building server!
    exit /b 1
)
echo Server built successfully
echo.
echo Verifying compiled files...
if not exist "dist\index.js" (
    echo ERROR: dist\index.js not found after build!
    echo Current directory: %CD%
    dir dist /b 2>nul
    exit /b 1
)
if not exist "dist\utils\logger.js" (
    echo ERROR: dist\utils\logger.js not found after build!
    dir dist\utils /b 2>nul
    exit /b 1
)
if not exist "dist\database\schema.sql" (
    echo ERROR: dist\database\schema.sql not found after build!
    dir dist\database /b 2>nul
    exit /b 1
)
echo All compiled files verified
cd /d "%PROJECT_ROOT%"
exit /b 0

:build_mobile_ios
echo.
echo =========================================
echo   Building Mobile App (iOS)
echo =========================================
cd /d "%PROJECT_ROOT%\apps\mobile"
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error installing mobile dependencies!
    exit /b 1
)
echo.
echo Checking for EAS CLI...
where eas >nul 2>&1
if errorlevel 1 (
    echo EAS CLI not found. Installing globally...
    call npm install -g eas-cli
    if errorlevel 1 (
        echo Error installing EAS CLI!
        echo Install manually: npm install -g eas-cli
        exit /b 1
    )
)
echo.
echo Starting EAS Build for iOS (production)...
echo This will build in the cloud via Expo Application Services.
echo Make sure you are logged in: eas login
echo.
call eas build --platform ios --profile production --non-interactive
if errorlevel 1 (
    echo Error building iOS app!
    echo Make sure you have:
    echo   - An Expo account (eas login)
    echo   - A valid Apple Developer account configured
    echo   - The correct bundle identifier in app.json
    exit /b 1
)
echo iOS build submitted successfully
cd /d "%PROJECT_ROOT%"
exit /b 0

:build_mobile_android
echo.
echo =========================================
echo   Building Mobile App (Android)
echo =========================================
cd /d "%PROJECT_ROOT%\apps\mobile"
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error installing mobile dependencies!
    exit /b 1
)
echo.
echo Checking for EAS CLI...
where eas >nul 2>&1
if errorlevel 1 (
    echo EAS CLI not found. Installing globally...
    call npm install -g eas-cli
    if errorlevel 1 (
        echo Error installing EAS CLI!
        echo Install manually: npm install -g eas-cli
        exit /b 1
    )
)
echo.
echo Starting EAS Build for Android (production)...
echo This will build in the cloud via Expo Application Services.
echo Make sure you are logged in: eas login
echo.
call eas build --platform android --profile production --non-interactive
if errorlevel 1 (
    echo Error building Android app!
    echo Make sure you have:
    echo   - An Expo account (eas login)
    echo   - The correct package name in app.json
    exit /b 1
)
echo Android build submitted successfully
cd /d "%PROJECT_ROOT%"
exit /b 0

:build_desktop
echo.
echo =========================================
echo   Building Desktop App (%DESKTOP_PLATFORM%)
echo =========================================
if exist "%SCRIPT_DIR%installers\desktop\build-desktop.bat" (
    call "%SCRIPT_DIR%installers\desktop\build-desktop.bat" "%APP_VERSION%" "%DESKTOP_PLATFORM%" "false"
    if errorlevel 1 (
        echo Error building desktop app!
        exit /b 1
    )
    echo Desktop app built successfully
) else (
    echo Warning: Desktop build script not found at:
    echo   %SCRIPT_DIR%installers\desktop\build-desktop.bat
    echo Skipping desktop build.
)
exit /b 0

:build_windows_installer
echo.
echo =========================================
echo   Building Windows Server Installer
echo =========================================

REM Clean previous release/temp
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%BUILD_DIR%"
mkdir "%TEMP_DIR%"
if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"

REM Install production dependencies (includes node-systray2 for tray app)
echo.
echo Installing production dependencies...
cd /d "%PROJECT_ROOT%"
if exist "node_modules" rmdir /s /q "node_modules"
if exist "apps\server\node_modules" rmdir /s /q "apps\server\node_modules"
if exist "packages\shared\node_modules" rmdir /s /q "packages\shared\node_modules"

call npm install --omit=dev --legacy-peer-deps
if errorlevel 1 (
    echo Error installing root production dependencies!
    exit /b 1
)

cd /d "%PROJECT_ROOT%\apps\server"
call npm install --production --no-optional
if errorlevel 1 (
    echo Error installing server production dependencies!
    exit /b 1
)

REM Install tray app dependencies (systray package for cross-platform tray icon)
echo.
echo Installing tray app dependencies...
cd /d "%PROJECT_ROOT%\scripts\installers\common"
call npm install --production
if errorlevel 1 (
    echo Warning: tray dependencies install failed - tray will run headless
)
cd /d "%PROJECT_ROOT%"

REM Rebuild native modules
echo.
echo Rebuilding native modules (better-sqlite3)...
call npm rebuild better-sqlite3
if errorlevel 1 (
    echo Warning: Failed to rebuild better-sqlite3, continuing...
) else (
    echo Native modules rebuilt
)

REM Download Node.js portable
echo.
echo Downloading Node.js portable...
set NODE_VERSION=20.11.0
set NODE_CACHE_DIR=!CACHE_DIR!\node-v%NODE_VERSION%-win-x64
set NODE_TEMP_DIR=!TEMP_DIR!\node-v%NODE_VERSION%-win-x64

if exist "!NODE_CACHE_DIR!" (
    echo Node.js %NODE_VERSION% found in cache
    xcopy /E /I /Y "!NODE_CACHE_DIR!" "!NODE_TEMP_DIR!" >nul
    goto installer_node_ready
)

echo Node.js %NODE_VERSION% not cached, downloading...
REM Create download script
(
echo param^([string]$OutputPath^)
echo $v = "%NODE_VERSION%"
echo $url = "https://nodejs.org/dist/v$v/node-v$v-win-x64.zip"
echo $zip = Join-Path $OutputPath "node-v$v-win-x64.zip"
echo try {
echo     Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
echo     Expand-Archive -Path $zip -DestinationPath $OutputPath -Force
echo     exit 0
echo } catch { Write-Host "Error: $_"; exit 1 }
) > "%TEMP_DIR%\download-node.ps1"

powershell -ExecutionPolicy Bypass -File "!TEMP_DIR!\download-node.ps1" -OutputPath "!TEMP_DIR!"
if errorlevel 1 (
    echo Error downloading Node.js!
    exit /b 1
)

REM Cache for next time
if not exist "!NODE_CACHE_DIR!" mkdir "!NODE_CACHE_DIR!"
xcopy "!NODE_TEMP_DIR!" "!NODE_CACHE_DIR!" /E /I /Y /Q >nul
echo Node.js cached for future builds

:installer_node_ready
echo Node.js portable ready

REM Run Inno Setup
echo.
echo Running Windows installer build...
if exist "%SCRIPT_DIR%installers\windows\build-windows.bat" (
    call "%SCRIPT_DIR%installers\windows\build-windows.bat" "%APP_VERSION%"
    if errorlevel 1 (
        echo Error building Windows installer!
        exit /b 1
    )
    echo Windows installer built successfully
) else (
    echo Warning: build-windows.bat not found, skipping installer creation
)

REM Generate checksums
echo.
echo Generating checksums...
cd /d "%BUILD_DIR%"
where certutil >nul 2>&1
if %errorlevel% equ 0 (
    for %%f in (*) do (
        if not "%%f"=="checksums.txt" (
            certutil -hashfile "%%f" SHA256 >> checksums.txt 2>nul
        )
    )
    echo Checksums generated
)
cd /d "%PROJECT_ROOT%"
exit /b 0
