@echo off
REM Windows Build Script for Playlist Lab
REM Builds the server and web applications

echo ========================================
echo Playlist Lab - Windows Build
echo ========================================
echo.

REM Navigate to project root
cd /d "%~dp0..\.."

echo Building server...
cd apps\server
call npm run build
if errorlevel 1 (
    echo Error building server
    exit /b 1
)

echo.
echo Building web app...
cd ..\web
call npm run build
if errorlevel 1 (
    echo Error building web app
    exit /b 1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Server build: apps\server\dist
echo Web build: apps\web\dist
echo.

cd ..\..
