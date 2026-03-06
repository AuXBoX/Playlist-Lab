@echo off
REM Windows Development Script for Playlist Lab
REM Starts the server in development mode

echo ========================================
echo Playlist Lab - Development Mode
echo ========================================
echo.

REM Navigate to server directory
cd /d "%~dp0..\..\apps\server"

echo Starting server in development mode...
echo Press Ctrl+C to stop
echo.

call npm run dev
