# Test script to verify tray app can be killed
# This simulates what the uninstaller does

Write-Host "Testing Tray App Kill Methods" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if tray app is running
Write-Host "Checking for running tray app..." -ForegroundColor Yellow
$trayProcesses = Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { 
    try {
        $_.CommandLine -like '*tray-app.ps1*'
    } catch {
        $false
    }
}

if ($trayProcesses) {
    Write-Host "Found $($trayProcesses.Count) tray app process(es)" -ForegroundColor Green
    $trayProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) - $($_.ProcessName)" -ForegroundColor Gray
    }
} else {
    Write-Host "No tray app processes found" -ForegroundColor Red
    Write-Host "Start the tray app first to test killing it" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Killing tray app processes..." -ForegroundColor Yellow

# Method 1: Kill by command line (most reliable)
Write-Host "Method 1: Kill by command line..." -ForegroundColor Cyan
Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { 
    try {
        $_.CommandLine -like '*tray-app.ps1*'
    } catch {
        $false
    }
} | Stop-Process -Force

Start-Sleep -Seconds 1

# Method 2: Kill wscript.exe
Write-Host "Method 2: Kill wscript.exe..." -ForegroundColor Cyan
Get-Process -Name wscript -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

# Verify tray app is killed
Write-Host ""
Write-Host "Verifying tray app is stopped..." -ForegroundColor Yellow
$remainingProcesses = Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { 
    try {
        $_.CommandLine -like '*tray-app.ps1*'
    } catch {
        $false
    }
}

if ($remainingProcesses) {
    Write-Host "WARNING: $($remainingProcesses.Count) tray app process(es) still running!" -ForegroundColor Red
    $remainingProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) - $($_.ProcessName)" -ForegroundColor Gray
    }
    exit 1
} else {
    Write-Host "SUCCESS: All tray app processes killed" -ForegroundColor Green
    exit 0
}
