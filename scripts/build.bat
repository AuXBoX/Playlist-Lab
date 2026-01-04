@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Playlist Lab - Build Script
echo ========================================
echo.

:: Change to project root (parent of scripts folder)
cd /d "%~dp0.."

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo Select build option:
echo   1. Portable (no installation required)
echo   2. Installer (NSIS setup)
echo   3. Both
echo   4. Dev mode (run without building)
echo.
set /p choice="Enter choice (1-4): "

if "%choice%"=="4" goto dev

:: Ask for version number for build options
echo.
set /p version="Enter version number (e.g. 1.0.1): "

if "%version%"=="" (
    echo Version number is required
    pause
    exit /b 1
)

:: Update version in package.json using npm
echo.
echo Updating version to %version%...
call npm version %version% --no-git-tag-version --allow-same-version

if "%choice%"=="1" goto portable
if "%choice%"=="2" goto installer
if "%choice%"=="3" goto both
echo Invalid choice
pause
exit /b 1

:portable
echo.
echo Building portable version...
call npm run build:portable
if errorlevel 1 (
    echo Build failed
    pause
    exit /b 1
)
echo.
echo Portable build complete! Check release folder.
goto done

:installer
echo.
echo Building installer...
call npm run build:installer
if errorlevel 1 (
    echo Build failed
    pause
    exit /b 1
)
echo.
echo Installer build complete! Check release folder.
goto done

:both
echo.
echo Building portable version...
call npm run build:portable
if errorlevel 1 (
    echo Portable build failed
    pause
    exit /b 1
)
echo.
echo Building installer...
call npm run build:installer
if errorlevel 1 (
    echo Installer build failed
    pause
    exit /b 1
)
echo.
echo Both builds complete! Check release folder.
goto done

:dev
echo.
echo Starting dev mode...
call npm run electron:dev
goto end

:done
echo.
echo Opening release folder...
start "" "%~dp0release"

:end
echo.
pause
