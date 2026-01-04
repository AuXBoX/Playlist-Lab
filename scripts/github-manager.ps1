# Interactive script for managing GitHub operations
# Playlist Lab GitHub Manager

# Configuration
$RepoOwner = "AuXBoX"
$RepoName = "Playlist-Lab"

# Set working directory
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

# Color functions
function Write-Title($Message) { Write-Host "`n$Message" -ForegroundColor Cyan -BackgroundColor DarkBlue }
function Write-Step($Message) { Write-Host "`n=> $Message" -ForegroundColor Cyan }
function Write-Success($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Fail($Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Warn($Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Info($Message) { Write-Host "  $Message" -ForegroundColor Gray }
function Write-Option($Number, $Text) { Write-Host "  [$Number] $Text" -ForegroundColor White }

# Helper function to handle commits with user choice
function Invoke-GitCommit {
    param(
        [string]$DefaultMessage = "Update - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    )
    
    Write-Host ""
    Write-Host "  How to handle changes:" -ForegroundColor White
    Write-Option "1" "Create new commit"
    Write-Option "2" "Amend last commit (no new commit)"
    Write-Option "3" "Skip commit (don't commit)"
    $commitChoice = Read-Host "Choose option (1-3)"
    
    if ($commitChoice -eq "1") {
        $message = Read-Host "Enter commit message (or press Enter for default)"
        if ([string]::IsNullOrWhiteSpace($message)) {
            $message = $DefaultMessage
        }
        
        git add .
        git commit -m $message
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "New commit created"
            return $true
        } else {
            Write-Fail "Commit failed"
            return $false
        }
    }
    elseif ($commitChoice -eq "2") {
        Write-Info "Amending last commit..."
        git add .
        git commit --amend --no-edit
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Last commit amended (no new commit created)"
            return $true
        } else {
            Write-Fail "Amend failed"
            return $false
        }
    }
    else {
        Write-Info "Skipping commit"
        return $true
    }
}

# Show main menu
function Show-Menu {
    Clear-Host
    
    Write-Title "Playlist Lab GitHub Manager"
    Write-Host ""
    Write-Host "  Repository: $RepoOwner/$RepoName" -ForegroundColor Gray
    Write-Host "  Location: $ProjectRoot" -ForegroundColor Gray
    Write-Host ""
    Write-Host "What would you like to do?" -ForegroundColor White
    Write-Host ""
    Write-Option "1" "Check Git Status"
    Write-Option "2" "Commit Changes"
    Write-Option "3" "Push to GitHub"
    Write-Option "4" "Force Sync Local to GitHub"
    Write-Option "5" "Manage .gitignore"
    Write-Option "6" "Create Release (Full Process)"
    Write-Option "7" "View Releases"
    Write-Option "8" "Delete Release/Tag"
    Write-Option "9" "Setup GitHub Token"
    Write-Option "B" "Build Application"
    Write-Option "I" "View Repository Info"
    Write-Option "G" "Initialize Git Repository"
    Write-Option "S" "Switch GitHub User"
    Write-Option "O" "Open GitHub in Browser"
    Write-Option "0" "Exit"
    Write-Host ""
}

# Check Git status
function Check-Status {
    Write-Step "Checking Git Status..."
    
    $status = git status --porcelain
    $branch = git branch --show-current
    
    Write-Host ""
    Write-Host "  Current Branch: " -NoNewline -ForegroundColor Gray
    Write-Host $branch -ForegroundColor Yellow
    Write-Host ""
    
    if ($status) {
        Write-Warn "You have uncommitted changes:"
        Write-Host ""
        git status --short
        Write-Host ""
        
        $commit = Read-Host "Would you like to commit these changes? (Y/n)"
        if ($commit -ne 'n' -and $commit -ne 'N') {
            Commit-Changes
        }
    } else {
        Write-Success "Working directory is clean"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Commit changes
function Commit-Changes {
    Write-Step "Committing Changes..."
    
    Write-Host ""
    Write-Host "  Current changes:" -ForegroundColor White
    Write-Host ""
    git status --short
    Write-Host ""
    
    $success = Invoke-GitCommit -DefaultMessage "Update Playlist Lab - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    
    if ($success) {
        Write-Host ""
        $push = Read-Host "Push to GitHub now? (Y/n)"
        if ($push -ne 'n' -and $push -ne 'N') {
            Push-Changes
        }
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Push to GitHub
function Push-Changes {
    Write-Step "Pushing to GitHub..."
    
    $branch = git branch --show-current
    Write-Info "Pushing branch: $branch"
    
    git push origin $branch
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Pushed successfully"
    } else {
        Write-Fail "Push failed"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}


# Manage .gitignore
function Manage-GitIgnore {
    Write-Step "Manage .gitignore"
    
    $gitignorePath = Join-Path $ProjectRoot ".gitignore"
    
    while ($true) {
        Clear-Host
        Write-Title ".gitignore Manager"
        Write-Host ""
        
        if (Test-Path $gitignorePath) {
            Write-Host "  Current .gitignore entries:" -ForegroundColor White
            Write-Host ""
            $content = Get-Content $gitignorePath
            if ($content) {
                $lineNum = 1
                foreach ($line in $content) {
                    if ($line.Trim() -and -not $line.StartsWith('#')) {
                        Write-Host "  [$lineNum] " -NoNewline -ForegroundColor Gray
                        Write-Host $line -ForegroundColor Cyan
                        $lineNum++
                    } elseif ($line.StartsWith('#')) {
                        Write-Host "      $line" -ForegroundColor DarkGray
                    }
                }
            } else {
                Write-Host "  (empty)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  .gitignore file does not exist" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "  Untracked files that could be ignored:" -ForegroundColor White
        $untracked = git ls-files --others --exclude-standard
        if ($untracked) {
            $untrackedList = $untracked -split "`n" | Where-Object { $_ }
            for ($i = 0; $i -lt [Math]::Min(10, $untrackedList.Count); $i++) {
                Write-Host "  - $($untrackedList[$i])" -ForegroundColor Yellow
            }
            if ($untrackedList.Count -gt 10) {
                Write-Host "  ... and $($untrackedList.Count - 10) more" -ForegroundColor Gray
            }
        } else {
            Write-Host "  (none)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "  Options:" -ForegroundColor White
        Write-Option "1" "Add file/pattern to .gitignore"
        Write-Option "2" "Add untracked file (from list)"
        Write-Option "3" "Remove entry from .gitignore"
        Write-Option "4" "Remove tracked files in .gitignore"
        Write-Option "5" "Add common patterns (templates)"
        Write-Option "6" "View full .gitignore"
        Write-Option "7" "Edit .gitignore in notepad"
        Write-Option "0" "Back to main menu"
        Write-Host ""
        
        $choice = Read-Host "Choose option (0-7)"
        
        switch ($choice) {
            "1" {
                Write-Host ""
                Write-Host "  Examples:" -ForegroundColor Gray
                Write-Info "*.log          - Ignore all .log files"
                Write-Info "temp/          - Ignore temp directory"
                Write-Info "*.dll          - Ignore all DLL files"
                Write-Info "node_modules/  - Ignore node_modules"
                Write-Host ""
                
                $pattern = Read-Host "Enter pattern to ignore"
                if (-not [string]::IsNullOrWhiteSpace($pattern)) {
                    Add-Content -Path $gitignorePath -Value $pattern
                    Write-Success "Added '$pattern' to .gitignore"
                    Start-Sleep -Seconds 1
                }
            }
            "2" {
                if ($untracked) {
                    Write-Host ""
                    $untrackedList = $untracked -split "`n" | Where-Object { $_ }
                    for ($i = 0; $i -lt $untrackedList.Count; $i++) {
                        Write-Host "  [$($i+1)] $($untrackedList[$i])" -ForegroundColor Yellow
                    }
                    Write-Host ""
                    
                    $fileNum = Read-Host "Enter file number to ignore (or 0 to cancel)"
                    $fileIndex = [int]$fileNum - 1
                    
                    if ($fileIndex -ge 0 -and $fileIndex -lt $untrackedList.Count) {
                        $fileToIgnore = $untrackedList[$fileIndex]
                        Add-Content -Path $gitignorePath -Value $fileToIgnore
                        Write-Success "Added '$fileToIgnore' to .gitignore"
                        Start-Sleep -Seconds 1
                    }
                } else {
                    Write-Info "No untracked files to add"
                    Start-Sleep -Seconds 2
                }
            }
            "3" {
                if (Test-Path $gitignorePath) {
                    Write-Host ""
                    $content = Get-Content $gitignorePath
                    $entries = $content | Where-Object { $_.Trim() -and -not $_.StartsWith('#') }
                    
                    if ($entries) {
                        for ($i = 0; $i -lt $entries.Count; $i++) {
                            Write-Host "  [$($i+1)] $($entries[$i])" -ForegroundColor Cyan
                        }
                        Write-Host ""
                        
                        $entryNum = Read-Host "Enter entry number to remove (or 0 to cancel)"
                        $entryIndex = [int]$entryNum - 1
                        
                        if ($entryIndex -ge 0 -and $entryIndex -lt $entries.Count) {
                            $entryToRemove = $entries[$entryIndex]
                            $newContent = $content | Where-Object { $_ -ne $entryToRemove }
                            Set-Content -Path $gitignorePath -Value $newContent
                            Write-Success "Removed '$entryToRemove' from .gitignore"
                            Start-Sleep -Seconds 1
                        }
                    } else {
                        Write-Info "No entries to remove"
                        Start-Sleep -Seconds 2
                    }
                }
            }
            "4" {
                Write-Host ""
                Write-Warn "This will remove files from Git tracking (but keep them locally)"
                Write-Host ""
                
                $pattern = Read-Host "Enter file/folder to remove from tracking (e.g., build/, *.log)"
                if (-not [string]::IsNullOrWhiteSpace($pattern)) {
                    Write-Info "Removing '$pattern' from Git tracking..."
                    git rm -r --cached $pattern 2>$null
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "Removed '$pattern' from Git tracking"
                        Write-Info "Run 'Commit Changes' to save this change"
                    } else {
                        Write-Fail "Failed to remove '$pattern'"
                    }
                    Start-Sleep -Seconds 2
                }
            }
            "5" {
                Write-Host ""
                Write-Host "  Common patterns:" -ForegroundColor White
                Write-Option "1" "Go (*.exe, *.dll, build/)"
                Write-Option "2" "Node.js (node_modules/, *.log)"
                Write-Option "3" "Wails (build/, frontend/dist/)"
                Write-Option "4" "Logs (*.log, logs/)"
                Write-Option "5" "OS files (.DS_Store, Thumbs.db)"
                Write-Option "6" "Temporary files (*.tmp, temp/)"
                Write-Host ""
                
                $templateChoice = Read-Host "Choose template (1-6, or 0 to cancel)"
                
                $templates = @{
                    "1" = @("# Go", "*.exe", "*.dll", "*.so", "*.dylib", "build/")
                    "2" = @("# Node.js", "node_modules/", "npm-debug.log*", "yarn-debug.log*", "pnpm-debug.log*")
                    "3" = @("# Wails", "build/", "frontend/dist/", "frontend/wailsjs/")
                    "4" = @("# Logs", "*.log", "logs/", "*.log.*")
                    "5" = @("# OS files", ".DS_Store", "Thumbs.db", "desktop.ini")
                    "6" = @("# Temporary files", "*.tmp", "*.temp", "temp/", "tmp/")
                }
                
                if ($templates.ContainsKey($templateChoice)) {
                    Add-Content -Path $gitignorePath -Value ""
                    foreach ($line in $templates[$templateChoice]) {
                        Add-Content -Path $gitignorePath -Value $line
                    }
                    Write-Success "Template added to .gitignore"
                    Start-Sleep -Seconds 1
                }
            }
            "6" {
                Write-Host ""
                if (Test-Path $gitignorePath) {
                    Write-Host "  Full .gitignore content:" -ForegroundColor White
                    Write-Host ""
                    Get-Content $gitignorePath | ForEach-Object {
                        if ($_.StartsWith('#')) {
                            Write-Host "  $_" -ForegroundColor DarkGray
                        } else {
                            Write-Host "  $_" -ForegroundColor Cyan
                        }
                    }
                } else {
                    Write-Info ".gitignore does not exist"
                }
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
            "7" {
                if (-not (Test-Path $gitignorePath)) {
                    New-Item -Path $gitignorePath -ItemType File -Force | Out-Null
                }
                Start-Process notepad $gitignorePath
                Write-Info "Opening in notepad..."
                Start-Sleep -Seconds 1
            }
            "0" {
                return
            }
        }
    }
}


# Force sync local to GitHub
function Force-Sync {
    Write-Step "Force Sync Local to GitHub"
    Write-Host ""
    Write-Warn "This will OVERWRITE GitHub with your local version!"
    Write-Warn "Any changes on GitHub that aren't local will be LOST!"
    Write-Host ""
    
    $branch = git branch --show-current
    Write-Host "  Current branch: $branch" -ForegroundColor Gray
    Write-Host ""
    
    $status = git status --porcelain
    if ($status) {
        Write-Warn "You have uncommitted changes:"
        Write-Host ""
        git status --short
        Write-Host ""
        
        $success = Invoke-GitCommit -DefaultMessage "Sync local changes - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        
        if (-not $success) {
            Read-Host "Press Enter to continue"
            return
        }
        Write-Host ""
    }
    
    Write-Host ""
    Write-Host "  This will:" -ForegroundColor Yellow
    Write-Info "1. Force push current branch to GitHub"
    Write-Info "2. Overwrite remote history completely"
    Write-Info "3. Make GitHub match your local repository exactly"
    Write-Host ""
    
    $confirm = Read-Host "Type 'FORCE SYNC' to confirm (case sensitive)"
    if ($confirm -ne "FORCE SYNC") {
        Write-Info "Cancelled - sync not performed"
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    Write-Step "Force pushing to GitHub..."
    
    git push origin $branch --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Branch pushed successfully!"
        
        Write-Host ""
        Write-Info "Checking for other branches..."
        $allBranches = git branch | ForEach-Object { $_.Trim('* ') }
        $otherBranches = $allBranches | Where-Object { $_ -ne $branch }
        
        if ($otherBranches) {
            Write-Info "Force pushing all branches..."
            git push origin --force --all
        }
        
        Write-Host ""
        Write-Success "Successfully synced to GitHub!"
        Write-Info "GitHub now matches your local repository"
    } else {
        Write-Fail "Force push failed"
        Write-Host ""
        Write-Info "Check your network connection and GitHub permissions"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Build application
function Build-Application {
    Write-Step "Build Playlist Lab"
    Write-Host ""
    
    Write-Host "  Build Options:" -ForegroundColor White
    Write-Option "1" "Build Portable"
    Write-Option "2" "Build Installer (NSIS)"
    Write-Option "3" "Build Both"
    Write-Option "0" "Cancel"
    Write-Host ""
    
    $choice = Read-Host "Choose option (0-3)"
    
    if ($choice -eq "0") {
        return
    }
    
    # Ask for version
    $version = Read-Host "Enter version number (e.g. 1.0.1)"
    if ([string]::IsNullOrWhiteSpace($version)) {
        Write-Fail "Version is required"
        Read-Host "Press Enter to continue"
        return
    }
    
    # Update version in package.json
    Write-Info "Updating version to $version..."
    $packageJson = Join-Path $ProjectRoot "package.json"
    (Get-Content $packageJson) -replace '"version": "[^"]+"', "`"version`": `"$version`"" | Set-Content $packageJson
    
    if ($choice -eq "1" -or $choice -eq "3") {
        Write-Step "Building portable version..."
        Set-Location $ProjectRoot
        npm run build:portable
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Portable build failed"
        } else {
            Write-Success "Portable build complete"
        }
    }
    
    if ($choice -eq "2" -or $choice -eq "3") {
        Write-Step "Building installer..."
        Set-Location $ProjectRoot
        npm run build:installer
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Installer build failed"
        } else {
            Write-Success "Installer build complete"
        }
    }
    
    Write-Host ""
    Write-Info "Opening release folder..."
    Start-Process (Join-Path $ProjectRoot "release")
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Create release
function Create-Release {
    Write-Step "Create Release - Full Process"
    
    Write-Host ""
    $version = Read-Host "Enter version number (example: 1.0.1)"
    if ([string]::IsNullOrWhiteSpace($version)) {
        Write-Fail "Version is required"
        Read-Host "Press Enter to continue"
        return
    }
    
    $tagExists = git tag -l "v$version"
    if ($tagExists) {
        Write-Warn "Tag v$version already exists"
        $delete = Read-Host "Delete existing tag? (y/N)"
        if ($delete -eq 'y' -or $delete -eq 'Y') {
            git tag -d "v$version"
            git push origin ":refs/tags/v$version" 2>$null
            Write-Success "Deleted existing tag"
        } else {
            Read-Host "Press Enter to continue"
            return
        }
    }
    
    Write-Host ""
    Write-Host "  Build Options:" -ForegroundColor White
    Write-Option "1" "Build Portable + Installer"
    Write-Option "2" "Skip build (binaries exist)"
    $buildChoice = Read-Host "Choose option (1-2)"
    $skipBuild = $buildChoice -eq "2"
    
    Write-Host ""
    $draft = Read-Host "Create as draft release? (y/N)"
    $isDraft = $draft -eq 'y' -or $draft -eq 'Y'
    
    # Check for GitHub CLI
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghInstalled) {
        Write-Fail "GitHub CLI (gh) is required for creating releases"
        Write-Info "Install with: winget install GitHub.cli"
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    Write-Host "  Release Summary:" -ForegroundColor White
    Write-Host "  Version:     v$version" -ForegroundColor Gray
    Write-Host "  Build:       $(if ($skipBuild) { 'Skip' } else { 'Yes' })" -ForegroundColor Gray
    Write-Host "  Draft:       $(if ($isDraft) { 'Yes' } else { 'No' })" -ForegroundColor Gray
    Write-Host ""
    
    $confirm = Read-Host "Proceed with release? (Y/n)"
    if ($confirm -eq 'n' -or $confirm -eq 'N') {
        Write-Info "Cancelled"
        Read-Host "Press Enter to continue"
        return
    }
    
    # Update version in package.json
    Write-Host ""
    Write-Step "Updating version to $version..."
    Set-Location $ProjectRoot
    npm version $version --no-git-tag-version --allow-same-version
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to update version"
        Read-Host "Press Enter to continue"
        return
    }
    Write-Success "Version updated"
    
    # Build if needed
    if (-not $skipBuild) {
        Write-Step "Building portable version..."
        npm run build:portable
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Portable build failed"
            Read-Host "Press Enter to continue"
            return
        }
        Write-Success "Portable build complete"
        
        Write-Step "Building installer..."
        npm run build:installer
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Installer build failed"
            Read-Host "Press Enter to continue"
            return
        }
        Write-Success "Installer build complete"
    }
    
    # Commit version change
    Write-Step "Committing version change..."
    git add package.json package-lock.json
    git commit -m "Release v$version"
    Write-Success "Committed"
    
    # Create tag
    Write-Step "Creating tag v$version..."
    git tag -a "v$version" -m "Release v$version"
    Write-Success "Tag created"
    
    # Push to GitHub
    Write-Step "Pushing to GitHub..."
    git push origin main
    git push origin "v$version"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Push failed"
        Read-Host "Press Enter to continue"
        return
    }
    Write-Success "Pushed to GitHub"
    
    # Find release files
    $releaseDir = Join-Path $ProjectRoot "scripts\release"
    $portableFile = Get-ChildItem -Path $releaseDir -Filter "PlaylistLab-Portable-$version.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    $installerFile = Get-ChildItem -Path $releaseDir -Filter "*$version*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike "*Portable*" } | Select-Object -First 1
    
    # Create GitHub release
    Write-Step "Creating GitHub release..."
    
    $releaseArgs = @("release", "create", "v$version", "--repo", "$RepoOwner/$RepoName", "--title", "v$version", "--notes", "Release v$version")
    if ($isDraft) { $releaseArgs += "--draft" }
    
    # Add files if they exist
    if ($portableFile) {
        $releaseArgs += $portableFile.FullName
        Write-Info "Adding: $($portableFile.Name)"
    }
    if ($installerFile) {
        $releaseArgs += $installerFile.FullName
        Write-Info "Adding: $($installerFile.Name)"
    }
    
    & gh @releaseArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Success "Release v$version created successfully!"
        Write-Host ""
        $open = Read-Host "Open release page in browser? (Y/n)"
        if ($open -ne 'n' -and $open -ne 'N') {
            Start-Process "https://github.com/$RepoOwner/$RepoName/releases/tag/v$version"
        }
    } else {
        Write-Fail "Failed to create release"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}


# View releases
function View-Releases {
    Write-Step "Viewing Releases..."
    
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghInstalled) {
        Write-Warn "GitHub CLI not installed"
        Write-Info "Install with: winget install GitHub.cli"
        
        $open = Read-Host "Open releases page in browser? (Y/n)"
        if ($open -ne 'n' -and $open -ne 'N') {
            Start-Process "https://github.com/$RepoOwner/$RepoName/releases"
        }
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    gh release list --repo "$RepoOwner/$RepoName" --limit 10
    Write-Host ""
    
    Write-Host "  Options:" -ForegroundColor White
    Write-Option "1" "View release details"
    Write-Option "2" "Open releases page"
    Write-Option "3" "Back to menu"
    $choice = Read-Host "Choose option (1-3)"
    
    if ($choice -eq "1") {
        $tag = Read-Host "`nEnter release tag (example: v6.5)"
        if (-not [string]::IsNullOrWhiteSpace($tag)) {
            Write-Host ""
            gh release view $tag --repo "$RepoOwner/$RepoName"
            Write-Host ""
        }
        Read-Host "Press Enter to continue"
    }
    elseif ($choice -eq "2") {
        Start-Process "https://github.com/$RepoOwner/$RepoName/releases"
        Start-Sleep -Seconds 1
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Delete release/tag
function Delete-Release {
    Write-Step "Delete Release/Tag"
    Write-Host ""
    Write-Warn "This will delete a release and/or tag from GitHub"
    Write-Host ""
    
    $tag = Read-Host "Enter tag to delete (example: v6.5)"
    if ([string]::IsNullOrWhiteSpace($tag)) {
        Write-Fail "Tag is required"
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    Write-Host "  What to delete:" -ForegroundColor White
    Write-Option "1" "Delete release only"
    Write-Option "2" "Delete tag only"
    Write-Option "3" "Delete both"
    Write-Option "4" "Cancel"
    $choice = Read-Host "Choose option (1-4)"
    
    if ($choice -eq "4") {
        Write-Info "Cancelled"
        Read-Host "Press Enter to continue"
        return
    }
    
    $confirm = Read-Host "Are you sure? Type 'yes' to confirm"
    if ($confirm -ne "yes") {
        Write-Info "Cancelled"
        Read-Host "Press Enter to continue"
        return
    }
    
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    
    if ($choice -eq "1" -and $ghInstalled) {
        gh release delete $tag --repo "$RepoOwner/$RepoName" --yes
        Write-Success "Release deleted"
    }
    elseif ($choice -eq "2") {
        git tag -d $tag
        git push origin ":refs/tags/$tag"
        Write-Success "Tag deleted"
    }
    elseif ($choice -eq "3" -and $ghInstalled) {
        gh release delete $tag --repo "$RepoOwner/$RepoName" --yes
        git tag -d $tag
        git push origin ":refs/tags/$tag"
        Write-Success "Release and tag deleted"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Setup token
function Setup-Token {
    Write-Step "Setup GitHub Token"
    
    Write-Host ""
    Write-Host "  GitHub Token Required For:" -ForegroundColor White
    Write-Info "- Creating releases"
    Write-Info "- Uploading files"
    Write-Info "- Managing releases"
    Write-Host ""
    
    Write-Host "  How to get a token:" -ForegroundColor White
    Write-Info "1. Go to: https://github.com/settings/tokens"
    Write-Info "2. Click 'Generate new token (classic)'"
    Write-Info "3. Select scope: checkboxes 'repo' (all)"
    Write-Info "4. Click 'Generate token'"
    Write-Info "5. Copy the token (starts with ghp_)"
    Write-Host ""
    
    $choice = Read-Host "Do you have a token already? (Y/n)"
    if ($choice -eq 'n' -or $choice -eq 'N') {
        $open = Read-Host "Open GitHub tokens page? (Y/n)"
        if ($open -ne 'n' -and $open -ne 'N') {
            Start-Process "https://github.com/settings/tokens"
        }
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    Write-Host "  Storage Options:" -ForegroundColor White
    Write-Option "1" "Temporary (current session)"
    Write-Option "2" "Permanent (environment variable)"
    Write-Option "3" "Cancel"
    $storageChoice = Read-Host "Choose option (1-3)"
    
    if ($storageChoice -eq "3") {
        Write-Info "Cancelled"
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    $token = Read-Host "Enter GitHub token"
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Fail "Token cannot be empty"
        Read-Host "Press Enter to continue"
        return
    }
    
    if ($storageChoice -eq "1") {
        $env:GITHUB_TOKEN = $token
        Write-Success "Token set for current session only"
    }
    elseif ($storageChoice -eq "2") {
        [System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', $token, 'User')
        $env:GITHUB_TOKEN = $token
        Write-Success "Token saved permanently"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}


# View repository info
function View-Info {
    Write-Step "Repository Information"
    Write-Host ""
    
    Write-Host "  Repository:" -ForegroundColor White
    Write-Host "  Owner:       $RepoOwner" -ForegroundColor Gray
    Write-Host "  Name:        $RepoName" -ForegroundColor Gray
    Write-Host "  URL:         https://github.com/$RepoOwner/$RepoName" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "  API URL:     https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "  Status:      " -NoNewline -ForegroundColor White
    Write-Host "[OK] Configured" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "  Local:" -ForegroundColor White
    Write-Host "  Path:        $ProjectRoot" -ForegroundColor Gray
    
    $branch = git branch --show-current
    Write-Host "  Branch:      $branch" -ForegroundColor Gray
    
    if ($env:GITHUB_TOKEN) {
        $preview = $env:GITHUB_TOKEN.Substring(0, [Math]::Min(10, $env:GITHUB_TOKEN.Length))
        $tokenDisplay = "[OK] Set (" + $preview + "...)"
        Write-Host "  Token:       $tokenDisplay" -ForegroundColor Green
    } else {
        Write-Host "  Token:       [ERROR] Not set" -ForegroundColor Red
    }
    
    Write-Host ""
    
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghInstalled) {
        $ghVersion = (gh --version | Select-Object -First 1)
        Write-Host "  GitHub CLI:" -ForegroundColor White
        Write-Host "  Status:      [OK] Installed" -ForegroundColor Green
        Write-Host "  Version:     $ghVersion" -ForegroundColor Gray
    } else {
        Write-Host "  GitHub CLI:" -ForegroundColor White
        Write-Host "  Status:      [ERROR] Not installed" -ForegroundColor Red
        Write-Info "Install with: winget install GitHub.cli"
    }
    
    # Check Node.js
    $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeInstalled) {
        Write-Host ""
        Write-Host "  Node.js:" -ForegroundColor White
        $nodeVersion = node --version
        Write-Host "  Status:      [OK] Installed" -ForegroundColor Green
        Write-Host "  Version:     $nodeVersion" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "  Node.js:" -ForegroundColor White
        Write-Host "  Status:      [ERROR] Not installed" -ForegroundColor Red
        Write-Info "Install from: https://nodejs.org/"
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Initialize Git Repository
function Initialize-GitRepo {
    Write-Step "Initialize Git Repository"
    
    # Check if already initialized
    $gitExists = Test-Path (Join-Path $ProjectRoot ".git")
    if ($gitExists) {
        Write-Warn "Git repository already exists!"
        $reinit = Read-Host "Reinitialize? This will NOT delete history (y/N)"
        if ($reinit -ne 'y' -and $reinit -ne 'Y') {
            Read-Host "Press Enter to continue"
            return
        }
    }
    
    Write-Host ""
    Write-Host "  This will:" -ForegroundColor White
    Write-Info "1. Initialize a new Git repository"
    Write-Info "2. Set remote origin to: https://github.com/$RepoOwner/$RepoName.git"
    Write-Info "3. Set default branch to 'main'"
    Write-Host ""
    
    $confirm = Read-Host "Continue? (Y/n)"
    if ($confirm -eq 'n' -or $confirm -eq 'N') {
        Write-Info "Cancelled"
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host ""
    
    # Initialize
    if (-not $gitExists) {
        Write-Info "Initializing Git repository..."
        git init
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Failed to initialize repository"
            Read-Host "Press Enter to continue"
            return
        }
        Write-Success "Repository initialized"
    }
    
    # Set remote
    Write-Info "Setting remote origin..."
    $remoteUrl = "https://github.com/$RepoOwner/$RepoName.git"
    
    # Check if remote exists
    $existingRemote = git remote get-url origin 2>$null
    if ($existingRemote) {
        git remote set-url origin $remoteUrl
    } else {
        git remote add origin $remoteUrl
    }
    Write-Success "Remote set to: $remoteUrl"
    
    # Set branch name
    Write-Info "Setting branch to 'main'..."
    git branch -M main
    Write-Success "Branch set to 'main'"
    
    Write-Host ""
    Write-Success "Git repository initialized!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Info "1. Use 'Commit Changes' to create your first commit"
    Write-Info "2. Use 'Push to GitHub' or 'Force Sync' to push"
    Write-Host ""
    
    Read-Host "Press Enter to continue"
}

# Switch GitHub User
function Switch-GitHubUser {
    Write-Step "Switch GitHub User"
    
    Write-Host ""
    Write-Host "  Current Git config:" -ForegroundColor White
    $currentName = git config user.name
    $currentEmail = git config user.email
    Write-Info "Name:  $currentName"
    Write-Info "Email: $currentEmail"
    Write-Host ""
    
    Write-Host "  Options:" -ForegroundColor White
    Write-Option "1" "Clear cached credentials (will prompt on next push)"
    Write-Option "2" "Set Git user name and email"
    Write-Option "3" "Switch to SSH authentication"
    Write-Option "4" "View current remote URL"
    Write-Option "0" "Cancel"
    Write-Host ""
    
    $choice = Read-Host "Choose option (0-4)"
    
    switch ($choice) {
        "1" {
            Write-Host ""
            Write-Info "Clearing cached Git credentials..."
            
            # Try to clear Windows Credential Manager entries for GitHub
            cmdkey /delete:git:https://github.com 2>$null
            cmdkey /delete:LegacyGeneric:target=git:https://github.com 2>$null
            
            # Also try git credential reject
            Write-Host "protocol=https`nhost=github.com`n" | git credential reject 2>$null
            
            Write-Success "Credentials cleared!"
            Write-Info "You will be prompted to login on your next push."
            Write-Host ""
            
            $push = Read-Host "Try pushing now? (Y/n)"
            if ($push -ne 'n' -and $push -ne 'N') {
                Push-Changes
                return
            }
        }
        "2" {
            Write-Host ""
            $newName = Read-Host "Enter Git user name (or press Enter to keep current)"
            $newEmail = Read-Host "Enter Git email (or press Enter to keep current)"
            
            if (-not [string]::IsNullOrWhiteSpace($newName)) {
                git config user.name $newName
                Write-Success "Name set to: $newName"
            }
            
            if (-not [string]::IsNullOrWhiteSpace($newEmail)) {
                git config user.email $newEmail
                Write-Success "Email set to: $newEmail"
            }
        }
        "3" {
            Write-Host ""
            Write-Info "Switching remote to SSH..."
            $sshUrl = "git@github.com:$RepoOwner/$RepoName.git"
            git remote set-url origin $sshUrl
            Write-Success "Remote URL changed to: $sshUrl"
            Write-Host ""
            Write-Warn "Make sure you have SSH keys set up with GitHub!"
            Write-Info "Guide: https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
        }
        "4" {
            Write-Host ""
            $remoteUrl = git remote get-url origin 2>$null
            if ($remoteUrl) {
                Write-Info "Current remote URL: $remoteUrl"
            } else {
                Write-Warn "No remote configured"
            }
        }
        "0" {
            Write-Info "Cancelled"
        }
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Open GitHub
function Open-GitHub {
    Write-Step "Opening GitHub..."
    
    Write-Host ""
    Write-Host "  What to open:" -ForegroundColor White
    Write-Option "1" "Repository home"
    Write-Option "2" "Releases"
    Write-Option "3" "Issues"
    Write-Option "4" "Settings"
    $choice = Read-Host "Choose option (1-4)"
    
    $url = "https://github.com/$RepoOwner/$RepoName"
    switch ($choice) {
        "2" { $url = "$url/releases" }
        "3" { $url = "$url/issues" }
        "4" { $url = "$url/settings" }
    }
    
    Write-Info "Opening: $url"
    Start-Process $url
    Start-Sleep -Seconds 1
}

# Main loop
try {
    while ($true) {
        Show-Menu
        $choice = Read-Host "Choose option"
        
        switch ($choice.ToUpper()) {
            "1" { Check-Status }
            "2" { Commit-Changes }
            "3" { Push-Changes }
            "4" { Force-Sync }
            "5" { Manage-GitIgnore }
            "6" { Create-Release }
            "7" { View-Releases }
            "8" { Delete-Release }
            "9" { Setup-Token }
            "B" { Build-Application }
            "I" { View-Info }
            "G" { Initialize-GitRepo }
            "S" { Switch-GitHubUser }
            "O" { Open-GitHub }
            "0" {
                Write-Host ""
                Write-Success "Goodbye!"
                Write-Host ""
                exit 0
            }
            default {
                Write-Warn "Invalid option. Please choose a valid option."
                Write-Host ""
                Start-Sleep -Seconds 2
            }
        }
    }
} catch {
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}