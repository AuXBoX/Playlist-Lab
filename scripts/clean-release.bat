@echo off
REM Clean release and temp directories

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

echo Cleaning release and temp directories...

if exist "%PROJECT_ROOT%\release" (
    echo Removing release folder...
    rmdir /s /q "%PROJECT_ROOT%\release"
)

if exist "%SCRIPT_DIR%temp" (
    echo Removing temp folder...
    rmdir /s /q "%SCRIPT_DIR%temp"
)

echo.
echo Cleanup complete!
echo.
pause
