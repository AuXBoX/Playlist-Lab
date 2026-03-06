@echo off
REM =========================================
REM Playlist Lab - Simple Manager
REM Easy-to-use interface for common tasks
REM =========================================

setlocal enabledelayedexpansion

REM Configuration
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set WEB_APP_DIR=%PROJECT_ROOT%\apps\web
set MOBILE_APP_DIR=%PROJECT_ROOT%\apps\mobile

REM Colors
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "RESET=[0m"

REM Check requirements
call :check_requirements
if errorlevel 1 (
    echo.
    echo %RED%Missing requirements! Please install them first.%RESET%
    pause
    exit /b 1
)

:main_menu
cls
echo =========================================
echo   Playlist Lab - Simple Manager
echo =========================================
echo.
echo   %GREEN%EVERYDAY TASKS:%RESET%
echo     [1] Save My Work (add, commit, push)
echo     [2] Get Latest Changes (pull)
echo     [3] What Changed? (status)
echo.
echo   %BLUE%RELEASE A NEW VERSION:%RESET%
echo     [4] Build Everything (all installers + apps)
echo     [5] Create New Version (tag + auto-build)
echo     [6] View All Versions
echo.
echo   %YELLOW%CHECK THINGS:%RESET%
echo     [7] Check if Mobile and Web Match
echo     [8] Check if Everything is OK
echo     [9] View My Changes
echo.
echo   %GREEN%ADVANCED (for developers):%RESET%
echo    [10] Create New Branch
echo    [11] Switch Branch
echo    [12] View Branches
echo    [13] View Commit History
echo    [14] Push Tag Only
echo    [15] Delete Version Tag
echo.
echo   %BLUE%HELP:%RESET%
echo    [16] Check Requirements
echo    [17] View Remote Info
echo    [18] Clean Cache
echo.
echo    [0] Exit
echo.
set /p CHOICE="Enter your choice (0-18): "

if "%CHOICE%"=="0" goto exit_script
if "%CHOICE%"=="1" call :save_work & goto main_menu
if "%CHOICE%"=="2" call :get_latest & goto main_menu
if "%CHOICE%"=="3" call :what_changed & goto main_menu
if "%CHOICE%"=="4" call :build_everything & goto main_menu
if "%CHOICE%"=="5" call :create_release & goto main_menu
if "%CHOICE%"=="6" call :view_versions & goto main_menu
if "%CHOICE%"=="7" call :check_mobile_web & goto main_menu
if "%CHOICE%"=="8" call :check_everything & goto main_menu
if "%CHOICE%"=="9" call :view_my_changes & goto main_menu
if "%CHOICE%"=="10" call :create_branch & goto main_menu
if "%CHOICE%"=="11" call :switch_branch & goto main_menu
if "%CHOICE%"=="12" call :view_branches & goto main_menu
if "%CHOICE%"=="13" call :view_history & goto main_menu
if "%CHOICE%"=="14" call :push_tag_only & goto main_menu
if "%CHOICE%"=="15" call :delete_version & goto main_menu
if "%CHOICE%"=="16" call :check_requirements & pause & goto main_menu
if "%CHOICE%"=="17" call :view_remote & goto main_menu
if "%CHOICE%"=="18" call :clean_cache & goto main_menu

echo %RED%Invalid choice. Please try again.%RESET%
timeout /t 2 >nul
goto main_menu

REM =========================================
REM CHECK REQUIREMENTS
REM =========================================

:check_requirements
echo.
echo %BLUE%Checking requirements...%RESET%
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo %RED%[X] Git is NOT installed%RESET%
    echo     Download from: https://git-scm.com/download/win
    set REQ_FAILED=1
) else (
    for /f "tokens=3" %%v in ('git --version') do set GIT_VERSION=%%v
    echo %GREEN%[OK] Git !GIT_VERSION! installed%RESET%
)

where node >nul 2>&1
if errorlevel 1 (
    echo %RED%[X] Node.js is NOT installed%RESET%
    echo     Download from: https://nodejs.org/
    set REQ_FAILED=1
) else (
    for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
    echo %GREEN%[OK] Node.js !NODE_VERSION! installed%RESET%
)

where npm >nul 2>&1
if errorlevel 1 (
    echo %RED%[X] npm is NOT installed%RESET%
    set REQ_FAILED=1
) else (
    for /f "tokens=*" %%v in ('npm --version') do set NPM_VERSION=%%v
    echo %GREEN%[OK] npm !NPM_VERSION! installed%RESET%
)

cd /d "%PROJECT_ROOT%"
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo %RED%[X] Not in a Git repository%RESET%
    set REQ_FAILED=1
) else (
    echo %GREEN%[OK] Git repository detected%RESET%
)

if defined REQ_FAILED (
    exit /b 1
)
exit /b 0

REM =========================================
REM EVERYDAY TASKS
REM =========================================

:save_work
cls
echo =========================================
echo   Save My Work
echo =========================================
echo.
echo This will:
echo   1. Add all your changes
echo   2. Save them with a message
echo   3. Upload to GitHub
echo.
cd /d "%PROJECT_ROOT%"
echo %YELLOW%Your changes:%RESET%
git status --short
echo.
set /p COMMIT_MSG="What did you change? (describe your work): "
if "%COMMIT_MSG%"=="" (
    echo %RED%Please describe what you changed!%RESET%
    pause
    exit /b 1
)
echo.
echo %YELLOW%Step 1: Adding all changes...%RESET%
git add -A
echo %GREEN%Done!%RESET%
echo.
echo %YELLOW%Step 2: Saving with message...%RESET%
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo %RED%Failed to save!%RESET%
    pause
    exit /b 1
)
echo %GREEN%Done!%RESET%
echo.
echo %YELLOW%Step 3: Uploading to GitHub...%RESET%
for /f "tokens=*" %%b in ('git branch --show-current') do set CURRENT_BRANCH=%%b
git push origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo %RED%Failed to upload!%RESET%
    echo.
    echo If this is a new branch, try option [14] instead.
    pause
    exit /b 1
)
echo %GREEN%All done! Your work is saved and uploaded.%RESET%
pause
exit /b 0

:get_latest
cls
echo =========================================
echo   Get Latest Changes
echo =========================================
echo.
echo This will download the latest changes from GitHub.
echo.
cd /d "%PROJECT_ROOT%"
for /f "tokens=*" %%b in ('git branch --show-current') do set CURRENT_BRANCH=%%b
echo Current branch: %GREEN%%CURRENT_BRANCH%%RESET%
echo.
echo Downloading latest changes...
git pull origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo %RED%Failed to download!%RESET%
    pause
    exit /b 1
)
echo %GREEN%All done! You have the latest changes.%RESET%
pause
exit /b 0

:what_changed
cls
echo =========================================
echo   What Changed?
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"
git status
echo.
pause
exit /b 0

REM =========================================
REM RELEASE A NEW VERSION
REM =========================================

:build_everything
cls
echo =========================================
echo   Build Everything
echo =========================================
echo.
echo This will build ALL installers and apps:
echo   - Windows installer
echo   - macOS installer
echo   - Linux packages
echo   - Desktop apps
echo   - Mobile apps (if EAS CLI is installed)
echo.
echo %YELLOW%This may take 10-30 minutes!%RESET%
echo.
set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo %YELLOW%Build cancelled.%RESET%
    pause
    exit /b 0
)
echo.
cd /d "%PROJECT_ROOT%"
echo %BLUE%Starting build process...%RESET%
echo.
if exist "scripts\build-all-installers.bat" (
    call scripts\build-all-installers.bat --all
    if errorlevel 1 (
        echo %RED%Build failed!%RESET%
        pause
        exit /b 1
    )
    echo.
    echo %GREEN%Build complete!%RESET%
    echo.
    echo Installers are in: scripts\release\
    echo.
) else (
    echo %RED%Build script not found!%RESET%
)
pause
exit /b 0

:create_release
cls
echo =========================================
echo   Create New Version
echo =========================================
echo.
echo This will:
echo   1. Create a version tag (like v2.0.1)
echo   2. Upload it to GitHub
echo   3. Automatically build everything
echo   4. Create a GitHub Release
echo.
echo %YELLOW%Current versions:%RESET%
cd /d "%PROJECT_ROOT%"
git tag -l | findstr /R "v[0-9]" | sort /R | more +0
echo.
set /p TAG_NAME="Enter new version (e.g., v2.0.1): "
if "%TAG_NAME%"=="" (
    echo %RED%Version cannot be empty!%RESET%
    pause
    exit /b 1
)
echo.
set /p TAG_MSG="What's new in this version? (optional): "
echo.
echo Creating version %TAG_NAME%...
if "%TAG_MSG%"=="" (
    git tag %TAG_NAME%
) else (
    git tag -a %TAG_NAME% -m "%TAG_MSG%"
)
if errorlevel 1 (
    echo %RED%Failed to create version!%RESET%
    pause
    exit /b 1
)
echo %GREEN%Version created!%RESET%
echo.
echo %YELLOW%WARNING: Uploading this version will trigger automatic builds!%RESET%
echo This will build:
echo   - All installers (Windows, macOS, Linux)
echo   - Desktop apps (all platforms)
echo   - Mobile apps (iOS, Android)
echo   - Docker images
echo.
echo Build time: ~30-45 minutes
echo.
set /p CONFIRM="Upload version and start builds? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo %YELLOW%Version created but not uploaded.%RESET%
    echo Use option [14] to upload it later.
    pause
    exit /b 0
)
echo.
echo Uploading version %TAG_NAME%...
git push origin %TAG_NAME%
if errorlevel 1 (
    echo %RED%Failed to upload!%RESET%
    pause
    exit /b 1
)
echo %GREEN%Version uploaded! Builds starting...%RESET%
echo.
echo Check progress at:
echo https://github.com/[username]/[repo]/actions
echo.
pause
exit /b 0

:view_versions
cls
echo =========================================
echo   All Versions
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"
echo %GREEN%Local versions:%RESET%
git tag -l -n1
echo.
echo %BLUE%Remote versions:%RESET%
git ls-remote --tags origin
echo.
pause
exit /b 0

REM =========================================
REM CHECK THINGS
REM =========================================

:check_mobile_web
cls
echo =========================================
echo   Check if Mobile and Web Match
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"

echo %BLUE%Checking version numbers...%RESET%
echo.

for /f "tokens=2 delims=:, " %%v in ('findstr /C:"\"version\"" "%WEB_APP_DIR%\package.json"') do (
    set WEB_VERSION=%%v
    set WEB_VERSION=!WEB_VERSION:"=!
)
for /f "tokens=2 delims=:, " %%v in ('findstr /C:"\"version\"" "%MOBILE_APP_DIR%\package.json"') do (
    set MOBILE_VERSION=%%v
    set MOBILE_VERSION=!MOBILE_VERSION:"=!
)

echo Web App version:    %GREEN%%WEB_VERSION%%RESET%
echo Mobile App version: %GREEN%%MOBILE_VERSION%%RESET%
echo.

if "%WEB_VERSION%"=="%MOBILE_VERSION%" (
    echo %GREEN%[OK] Versions match!%RESET%
) else (
    echo %RED%[!] Versions don't match!%RESET%
    echo.
    echo You should update them to match before releasing.
)

echo.
echo %BLUE%Checking screens...%RESET%
echo.

set SCREENS=LoginScreen DashboardScreen PlaylistsScreen SettingsScreen ImportScreen GenerateScreen
set MISSING_COUNT=0

for %%s in (%SCREENS%) do (
    if exist "%MOBILE_APP_DIR%\src\screens\%%s.tsx" (
        echo %GREEN%[OK]%RESET% %%s exists in mobile
    ) else (
        echo %RED%[X]%RESET% %%s missing in mobile
        set /a MISSING_COUNT+=1
    )
)

echo.
if %MISSING_COUNT% GTR 0 (
    echo %RED%Found %MISSING_COUNT% missing screens!%RESET%
) else (
    echo %GREEN%All screens present!%RESET%
)
echo.
pause
exit /b 0

:check_everything
cls
echo =========================================
echo   Check if Everything is OK
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"

echo %BLUE%Checking Web App...%RESET%
cd /d "%WEB_APP_DIR%"
if exist "package.json" (
    echo %GREEN%[OK]%RESET% Web app configured
) else (
    echo %RED%[X]%RESET% Web app missing
)

echo.
echo %BLUE%Checking Mobile App...%RESET%
cd /d "%MOBILE_APP_DIR%"
if exist "package.json" (
    if exist "app.json" (
        echo %GREEN%[OK]%RESET% Mobile app configured
    ) else (
        echo %RED%[X]%RESET% Mobile app missing config
    )
) else (
    echo %RED%[X]%RESET% Mobile app missing
)

echo.
echo %BLUE%Checking Server...%RESET%
cd /d "%PROJECT_ROOT%\apps\server"
if exist "package.json" (
    if exist "src\database\schema.sql" (
        echo %GREEN%[OK]%RESET% Server configured
    ) else (
        echo %RED%[X]%RESET% Server missing database
    )
) else (
    echo %RED%[X]%RESET% Server missing
)

echo.
echo %BLUE%Checking Desktop App...%RESET%
cd /d "%PROJECT_ROOT%\apps\desktop"
if exist "package.json" (
    echo %GREEN%[OK]%RESET% Desktop app configured
) else (
    echo %RED%[X]%RESET% Desktop app missing
)

echo.
echo %GREEN%Check complete!%RESET%
cd /d "%PROJECT_ROOT%"
pause
exit /b 0

:view_my_changes
cls
echo =========================================
echo   View My Changes
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"
git diff --stat
echo.
echo %YELLOW%Show detailed changes? (Y/N):%RESET%
set /p SHOW_DIFF="> "
if /i "%SHOW_DIFF%"=="Y" (
    echo.
    git diff
)
echo.
pause
exit /b 0

REM =========================================
REM ADVANCED (for developers)
REM =========================================

:create_branch
cls
echo =========================================
echo   Create New Branch
echo =========================================
echo.
echo A branch is like a separate workspace for your changes.
echo.
set /p BRANCH_NAME="Enter branch name (e.g., feature/new-feature): "
if "%BRANCH_NAME%"=="" (
    echo %RED%Branch name cannot be empty!%RESET%
    pause
    exit /b 1
)
echo.
cd /d "%PROJECT_ROOT%"
git checkout -b %BRANCH_NAME%
if errorlevel 1 (
    echo %RED%Failed to create branch!%RESET%
    pause
    exit /b 1
)
echo %GREEN%Branch created and switched!%RESET%
pause
exit /b 0

:switch_branch
cls
echo =========================================
echo   Switch Branch
echo =========================================
echo.
echo %GREEN%Available branches:%RESET%
cd /d "%PROJECT_ROOT%"
git branch
echo.
set /p BRANCH_NAME="Enter branch name to switch to: "
if "%BRANCH_NAME%"=="" goto main_menu
echo.
git checkout %BRANCH_NAME%
if errorlevel 1 (
    echo %RED%Failed to switch!%RESET%
    pause
    exit /b 1
)
echo %GREEN%Switched to %BRANCH_NAME%!%RESET%
pause
exit /b 0

:view_branches
cls
echo =========================================
echo   View Branches
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"
echo %GREEN%Your branches:%RESET%
git branch
echo.
echo %BLUE%Remote branches:%RESET%
git branch -r
echo.
pause
exit /b 0

:view_history
cls
echo =========================================
echo   View Commit History
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"
git log --oneline --graph --decorate -10
echo.
pause
exit /b 0

:push_tag_only
cls
echo =========================================
echo   Push Tag Only
echo =========================================
echo.
echo %YELLOW%Your versions:%RESET%
cd /d "%PROJECT_ROOT%"
git tag -l
echo.
set /p TAG_NAME="Enter version to upload: "
if "%TAG_NAME%"=="" goto main_menu
echo.
echo %YELLOW%WARNING: This will trigger automatic builds!%RESET%
set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" goto main_menu
echo.
git push origin %TAG_NAME%
if errorlevel 1 (
    echo %RED%Failed to upload!%RESET%
    pause
    exit /b 1
)
echo %GREEN%Version uploaded! Builds starting...%RESET%
pause
exit /b 0

:delete_version
cls
echo =========================================
echo   Delete Version Tag
echo =========================================
echo.
echo %YELLOW%Your versions:%RESET%
cd /d "%PROJECT_ROOT%"
git tag -l
echo.
set /p TAG_NAME="Enter version to delete: "
if "%TAG_NAME%"=="" goto main_menu
echo.
set /p CONFIRM="Delete %TAG_NAME% locally and from GitHub? (Y/N): "
if /i not "%CONFIRM%"=="Y" goto main_menu
echo.
git tag -d %TAG_NAME%
git push origin :refs/tags/%TAG_NAME%
echo %GREEN%Version deleted!%RESET%
pause
exit /b 0

REM =========================================
REM HELP
REM =========================================

:view_remote
cls
echo =========================================
echo   Remote Repository Info
echo =========================================
echo.
cd /d "%PROJECT_ROOT%"
echo %GREEN%Your remote:%RESET%
git remote -v
echo.
echo %BLUE%Remote branches:%RESET%
git branch -r
echo.
pause
exit /b 0

:clean_cache
cls
echo =========================================
echo   Clean Cache
echo =========================================
echo.
echo This removes all files from Git cache and re-adds them.
echo Useful after updating .gitignore
echo.
set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" goto main_menu
echo.
cd /d "%PROJECT_ROOT%"
git rm -r --cached .
git add .
echo %GREEN%Cache cleaned!%RESET%
echo Don't forget to save your work (option 1).
pause
exit /b 0

:exit_script
cls
echo.
echo %GREEN%Thanks for using Simple Manager!%RESET%
echo.
exit /b 0
