@echo off
REM Update version across all project files

setlocal enabledelayedexpansion

set NEW_VERSION=%~1

if "%NEW_VERSION%"=="" (
    echo Usage: update-version.bat VERSION
    echo Example: update-version.bat 2.0.1
    exit /b 1
)

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

echo =========================================
echo   Updating Version to %NEW_VERSION%
echo =========================================
echo.

REM Update package.json files using npm
echo Updating package.json files...
cd /d "%PROJECT_ROOT%"
call npm version %NEW_VERSION% --no-git-tag-version --workspaces --include-workspace-root
if errorlevel 1 (
    echo Error updating package.json files!
    exit /b 1
)

REM Update setup.iss
echo Updating setup.iss...
powershell -Command "(Get-Content '%PROJECT_ROOT%\scripts\installers\windows\setup.iss') -replace '#define MyAppVersion \".*\"', '#define MyAppVersion \"%NEW_VERSION%\"' | Set-Content '%PROJECT_ROOT%\scripts\installers\windows\setup.iss'"

REM Update version.html
echo Updating version.html...
if exist "%PROJECT_ROOT%\apps\web\public\version.html" (
    powershell -Command "(Get-Content '%PROJECT_ROOT%\apps\web\public\version.html') -replace 'Version [0-9]+\.[0-9]+\.[0-9]+', 'Version %NEW_VERSION%' | Set-Content '%PROJECT_ROOT%\apps\web\public\version.html'"
)

echo.
echo =========================================
echo   Version Updated Successfully!
echo =========================================
echo.
echo Updated files:
echo   - All package.json files
echo   - scripts/installers/windows/setup.iss
echo   - apps/web/public/version.html
echo.
echo Next steps:
echo   1. Review changes: git diff
echo   2. Commit: git add . ^&^& git commit -m "Bump version to %NEW_VERSION%"
echo   3. Tag: git tag v%NEW_VERSION%
echo   4. Build: build-all-installers.bat --all --version %NEW_VERSION%
echo.
pause
