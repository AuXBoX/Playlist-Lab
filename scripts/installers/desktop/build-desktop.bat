@echo off
REM Build script for Playlist Lab Desktop Application
REM Builds standalone Electron app with embedded server

setlocal enabledelayedexpansion

REM Get version from parameter or use default
set APP_VERSION=%~1
if "%APP_VERSION%"=="" set APP_VERSION=1.1.1

REM Get platform from parameter or use default (win)
set PLATFORM=%~2
if "%PLATFORM%"=="" set PLATFORM=win

REM Get portable flag from parameter or use default (false)
set PORTABLE_ONLY=%~3
if "%PORTABLE_ONLY%"=="" set PORTABLE_ONLY=false

echo =========================================
echo Building Playlist Lab Desktop App
echo Version: %APP_VERSION%
if "%PLATFORM%"=="all" (
    echo Platforms: Windows, macOS, Linux
) else if "%PLATFORM%"=="win" (
    echo Platform: Windows
    if "%PORTABLE_ONLY%"=="true" (
        echo Type: Portable Only
    ) else (
        echo Type: Installer + Portable
    )
) else if "%PLATFORM%"=="mac" (
    echo Platform: macOS
) else if "%PLATFORM%"=="linux" (
    echo Platform: Linux
)
echo =========================================

REM Get the project root directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..\..

echo.
echo Step 1: Updating version in package.json...
cd /d "%PROJECT_ROOT%\apps\desktop"

REM Update version in package.json using PowerShell
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"%APP_VERSION%\"' | Set-Content package.json"
echo Version updated to %APP_VERSION%

echo.
echo Step 2: Installing desktop app dependencies...
cd /d "%PROJECT_ROOT%\apps\desktop"
call npm install
if errorlevel 1 (
    echo Error installing desktop app dependencies!
    exit /b 1
)

echo.
echo Step 3: Building desktop app...
cd /d "%PROJECT_ROOT%\apps\desktop"
call npm run build
if errorlevel 1 (
    echo Error building desktop app!
    exit /b 1
)

echo.
echo Step 4: Packaging desktop app...

REM Build based on platform selection
if "%PLATFORM%"=="all" (
    echo Building for all platforms on Windows...
    echo NOTE: On Windows, only Windows builds are supported.
    echo Building for Windows only...
    call npm run package:win
) else (
    if "%PLATFORM%"=="win" (
        if "%PORTABLE_ONLY%"=="true" (
            echo Building Windows Portable version only...
            call npm run package:win:portable
        ) else (
            echo Building for Windows ^(Installer + Portable^)...
            call npm run package:win
        )
    ) else (
        if "%PLATFORM%"=="mac" (
            echo Building for macOS...
            call npm run package:mac
        ) else (
            if "%PLATFORM%"=="linux" (
                echo Building for Linux...
                call npm run package:linux
            ) else (
                echo Unknown platform: %PLATFORM%
                echo Building for Windows ^(default^)...
                call npm run package:win
            )
        )
    )
)

if errorlevel 1 (
    echo Error packaging desktop app!
    exit /b 1
)

echo.
echo =========================================
echo Desktop App Build Complete!
echo =========================================
echo.
echo Output location: %SCRIPT_DIR%release\
echo.

REM Show platform-specific notes
if "%PLATFORM%"=="all" (
    echo NOTE: Cross-platform building from Windows has limitations:
    echo   - Windows builds: Full support
    echo   - macOS builds: Requires macOS or CI/CD with macOS runner
    echo   - Linux builds: May work but not code-signed
    echo.
    echo For production releases, build macOS installers on macOS.
    echo.
) else if "%PLATFORM%"=="mac" (
    echo NOTE: Building macOS installers from Windows has limitations.
    echo For production releases, build on macOS for proper code signing.
    echo.
)

REM List built files
if exist "%SCRIPT_DIR%release" (
    echo Built files:
    dir /b "%SCRIPT_DIR%release"
)

echo.
echo Done!
