@echo off
REM Windows Production Build Script
REM Builds all applications for production deployment

echo ========================================
echo Playlist Lab - Production Build
echo ========================================
echo.

REM Navigate to project root
cd /d "%~dp0..\.."

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error installing dependencies
    exit /b 1
)

echo.
echo Step 2: Building server...
cd apps\server
call npm run build
if errorlevel 1 (
    echo Error building server
    exit /b 1
)

echo.
echo Step 3: Building web app...
cd ..\web
call npm run build
if errorlevel 1 (
    echo Error building web app
    exit /b 1
)

echo.
echo Step 4: Building shared package...
cd ..\..\packages\shared
call npm run build
if errorlevel 1 (
    echo Error building shared package
    exit /b 1
)

echo.
echo ========================================
echo Production Build Complete!
echo ========================================
echo.
echo All applications built successfully
echo Ready for deployment
echo.

cd ..\..
