# Script to restore desktop app files from v1.1.1 tag

Write-Host "Restoring desktop app files from v1.1.1..." -ForegroundColor Green

# Create directory structure
Write-Host "Creating directory structure..."
New-Item -ItemType Directory -Force -Path "apps/desktop/src/main" | Out-Null
New-Item -ItemType Directory -Force -Path "apps/desktop/src/renderer" | Out-Null

# Extract files from git tag
Write-Host "Extracting source files..."
git show v1.1.1:src/main/main.ts | Out-File -FilePath "apps/desktop/src/main/main.ts" -Encoding utf8
git show v1.1.1:src/main/preload.ts | Out-File -FilePath "apps/desktop/src/main/preload.ts" -Encoding utf8
git show v1.1.1:src/renderer/App.tsx | Out-File -FilePath "apps/desktop/src/renderer/App.tsx" -Encoding utf8
git show v1.1.1:src/renderer/BackupRestorePage.tsx | Out-File -FilePath "apps/desktop/src/renderer/BackupRestorePage.tsx" -Encoding utf8
git show v1.1.1:src/renderer/ImportPage.tsx | Out-File -FilePath "apps/desktop/src/renderer/ImportPage.tsx" -Encoding utf8
git show v1.1.1:src/renderer/MissingTracksPage.tsx | Out-File -FilePath "apps/desktop/src/renderer/MissingTracksPage.tsx" -Encoding utf8
git show v1.1.1:src/renderer/SharingPage.tsx | Out-File -FilePath "apps/desktop/src/renderer/SharingPage.tsx" -Encoding utf8
git show v1.1.1:src/renderer/discovery.ts | Out-File -FilePath "apps/desktop/src/renderer/discovery.ts" -Encoding utf8
git show v1.1.1:src/renderer/index.html | Out-File -FilePath "apps/desktop/src/renderer/index.html" -Encoding utf8
git show v1.1.1:src/renderer/main.tsx | Out-File -FilePath "apps/desktop/src/renderer/main.tsx" -Encoding utf8
git show v1.1.1:src/renderer/styles.css | Out-File -FilePath "apps/desktop/src/renderer/styles.css" -Encoding utf8
git show v1.1.1:src/renderer/vite-env.d.ts | Out-File -FilePath "apps/desktop/src/renderer/vite-env.d.ts" -Encoding utf8

# Extract config files
Write-Host "Extracting config files..."
git show v1.1.1:package.json | Out-File -FilePath "apps/desktop/package.json" -Encoding utf8
git show v1.1.1:tsconfig.main.json | Out-File -FilePath "apps/desktop/tsconfig.main.json" -Encoding utf8
git show v1.1.1:vite.config.ts | Out-File -FilePath "apps/desktop/vite.config.ts" -Encoding utf8

Write-Host ""
Write-Host "Desktop app files restored successfully!" -ForegroundColor Green
Write-Host "Location: apps/desktop/" -ForegroundColor Cyan

# Note about binary files
Write-Host ""
Write-Host "Note: Logo images need to be extracted separately (binary files)" -ForegroundColor Yellow
Write-Host "Run: git show v1.1.1:src/renderer/logo.png > apps/desktop/src/renderer/logo.png" -ForegroundColor Yellow
