# Playlist Lab Server - System Tray Application
# Shows server status in system tray with quick access

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Configuration
$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = Join-Path $installDir "nodejs\node.exe"
$serverLauncherPath = Join-Path $installDir "server-launcher.js"
$configPath = Join-Path $installDir "tray-config.json"

# Load or create config
$script:config = @{
    port = 3001
    autoDetectPort = $true
}

if (Test-Path $configPath) {
    try {
        $script:config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Host "Config loaded: Port=$($script:config.port), AutoDetect=$($script:config.autoDetectPort)"
    } catch {
        Write-Host "Failed to load config, using defaults"
    }
}

$serverPort = $script:config.port
$serverUrl = "http://localhost:$serverPort"

# Common ports to check when auto-detecting
$commonPorts = @(3001, 3000, 3002, 3003, 8080, 8000)

# Create a simple icon (green circle for running, red for stopped)
function Create-Icon {
    param([string]$color)
    
    $bitmap = New-Object System.Drawing.Bitmap(16, 16)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    if ($color -eq "green") {
        $brush = [System.Drawing.Brushes]::LimeGreen
    } else {
        $brush = [System.Drawing.Brushes]::Red
    }
    
    $graphics.FillEllipse($brush, 2, 2, 12, 12)
    $graphics.Dispose()
    
    $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
    return $icon
}

# Save config to file
function Save-Config {
    try {
        $script:config | ConvertTo-Json | Set-Content $configPath
        Write-Host "Config saved: Port=$($script:config.port), AutoDetect=$($script:config.autoDetectPort)"
    } catch {
        Write-Host "Failed to save config: $_"
    }
}

# Check if server is running on specific port
function Test-ServerRunning {
    param([int]$port = $script:config.port)
    
    try {
        $url = "http://localhost:$port/health"
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Auto-detect which port the server is running on
function Find-ServerPort {
    $portsToCheck = $commonPorts | Select-Object -Unique
    
    # Always check current configured port first
    if ($script:config.port -notin $portsToCheck) {
        $portsToCheck = @($script:config.port) + $portsToCheck
    }
    
    foreach ($port in $portsToCheck) {
        if (Test-ServerRunning -port $port) {
            if ($script:config.port -ne $port) {
                Write-Host "Server detected on port $port (was checking $($script:config.port))"
                $script:config.port = $port
                $script:serverPort = $port
                $script:serverUrl = "http://localhost:$port"
                Save-Config
                return $true
            }
            return $true
        }
    }
    
    return $false
}

# Start server
function Start-Server {
    # Check if already running
    if (Test-ServerRunning) {
        Write-Host "Server is already running"
        $script:tray.ShowBalloonTip(3000, "Playlist Lab Server", "Server is already running.", [System.Windows.Forms.ToolTipIcon]::Info)
        return
    }
    
    # Check if port is in use
    $portInUse = Get-NetTCPConnection -LocalPort $serverPort -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "Port $serverPort is already in use"
        $script:tray.ShowBalloonTip(5000, "Playlist Lab Server", "Port $serverPort is already in use. Please stop any existing server instances.", [System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    
    Start-Process -FilePath $nodePath -ArgumentList "`"$serverLauncherPath`"" -WindowStyle Hidden
    
    # Wait for server to start with retry logic (up to 15 seconds)
    $maxAttempts = 15
    $attempt = 0
    $serverStarted = $false
    
    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        $attempt++
        
        if (Test-ServerRunning) {
            $serverStarted = $true
            break
        }
    }
    
    Update-TrayIcon
    
    if ($serverStarted) {
        $script:tray.ShowBalloonTip(3000, "Playlist Lab Server", "Server started successfully.", [System.Windows.Forms.ToolTipIcon]::Info)
    } else {
        $script:tray.ShowBalloonTip(5000, "Playlist Lab Server", "Server failed to start. Check logs for details.", [System.Windows.Forms.ToolTipIcon]::Error)
    }
}

# Stop server
function Stop-Server {
    # First, try to find processes listening on port 3001
    try {
        $netstatOutput = netstat -ano | Select-String ":$serverPort"
        $pids = @()
        
        foreach ($line in $netstatOutput) {
            if ($line -match '\s+(\d+)\s*$') {
                $pids += $matches[1]
            }
        }
        
        # Kill processes by PID
        foreach ($pid in ($pids | Select-Object -Unique)) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "Killed process $pid"
            } catch {
                Write-Host "Failed to kill process $pid"
            }
        }
    } catch {
        Write-Host "Error finding processes on port $serverPort"
    }
    
    # Also find node processes running from Playlist Lab Server directory
    $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $_.Path -like "*Playlist Lab Server*"
        } catch {
            $false
        }
    }
    
    if ($processes) {
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "Killed Playlist Lab Server node processes"
    }
    
    Start-Sleep -Seconds 2
    
    # Verify server is stopped
    if (-not (Test-ServerRunning)) {
        $script:tray.ShowBalloonTip(3000, "Playlist Lab Server", "Server stopped.", [System.Windows.Forms.ToolTipIcon]::Info)
    } else {
        $script:tray.ShowBalloonTip(3000, "Playlist Lab Server", "Server may still be running.", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
    
    Update-TrayIcon
}

# Restart server
function Restart-Server {
    Stop-Server
    Start-Sleep -Seconds 2
    Start-Server
}

# Open web interface
function Open-WebInterface {
    Start-Process $serverUrl
}

# Open logs folder
function Open-Logs {
    $logsPath = Join-Path $env:APPDATA "PlaylistLabServer"
    if (Test-Path $logsPath) {
        Start-Process $logsPath
    } else {
        [System.Windows.Forms.MessageBox]::Show("Logs folder not found: $logsPath", "Playlist Lab Server", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    }
}

# Change server port
function Change-Port {
    $newPort = [Microsoft.VisualBasic.Interaction]::InputBox("Enter new server port:", "Change Port", $script:config.port)
    
    if ($newPort -and $newPort -match '^\d+$') {
        $portNum = [int]$newPort
        if ($portNum -gt 0 -and $portNum -lt 65536) {
            $script:config.port = $portNum
            $script:serverPort = $portNum
            $script:serverUrl = "http://localhost:$portNum"
            Save-Config
            
            [System.Windows.Forms.MessageBox]::Show("Port changed to $portNum. Restart the server for changes to take effect.", "Port Changed", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
            
            Update-TrayIcon
        } else {
            [System.Windows.Forms.MessageBox]::Show("Invalid port number. Must be between 1 and 65535.", "Invalid Port", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        }
    }
}

# Toggle auto-detect port
function Toggle-AutoDetect {
    $script:config.autoDetectPort = -not $script:config.autoDetectPort
    Save-Config
    
    $status = if ($script:config.autoDetectPort) { "enabled" } else { "disabled" }
    [System.Windows.Forms.MessageBox]::Show("Auto-detect port is now $status.", "Auto-Detect", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    
    if ($script:config.autoDetectPort) {
        Find-ServerPort
    }
    
    Update-TrayIcon
}

# Update tray icon based on server status
function Update-TrayIcon {
    # Auto-detect port if enabled
    if ($script:config.autoDetectPort) {
        $isRunning = Find-ServerPort
    } else {
        $isRunning = Test-ServerRunning
    }
    
    if ($isRunning) {
        $script:tray.Icon = Create-Icon "green"
        $script:tray.Text = "Playlist Lab Server - Running (Port $($script:config.port))"
        $script:startItem.Enabled = $false
        $script:stopItem.Enabled = $true
        $script:restartItem.Enabled = $true
    } else {
        $script:tray.Icon = Create-Icon "red"
        $script:tray.Text = "Playlist Lab Server - Stopped"
        $script:startItem.Enabled = $true
        $script:stopItem.Enabled = $false
        $script:restartItem.Enabled = $false
    }
    
    # Update port display in menu
    $script:portItem.Text = "Server Port: $($script:config.port)"
    $script:autoDetectItem.Text = if ($script:config.autoDetectPort) { "✓ Auto-detect Port" } else { "Auto-detect Port" }
}

# Create tray icon
$script:tray = New-Object System.Windows.Forms.NotifyIcon
$script:tray.Text = "Playlist Lab Server"
$script:tray.Visible = $true

# Create context menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# Open Web Interface
$openItem = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = "Open Playlist Lab"
$openItem.Font = New-Object System.Drawing.Font($openItem.Font, [System.Drawing.FontStyle]::Bold)
$openItem.Add_Click({ Open-WebInterface })
$contextMenu.Items.Add($openItem)

# Separator
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# Server Manager submenu
$serverManagerItem = New-Object System.Windows.Forms.ToolStripMenuItem
$serverManagerItem.Text = "Server Manager"

# Start Server
$script:startItem = New-Object System.Windows.Forms.ToolStripMenuItem
$script:startItem.Text = "Start Server"
$script:startItem.Add_Click({ Start-Server })
$serverManagerItem.DropDownItems.Add($script:startItem)

# Stop Server
$script:stopItem = New-Object System.Windows.Forms.ToolStripMenuItem
$script:stopItem.Text = "Stop Server"
$script:stopItem.Add_Click({ Stop-Server })
$serverManagerItem.DropDownItems.Add($script:stopItem)

# Restart Server
$script:restartItem = New-Object System.Windows.Forms.ToolStripMenuItem
$script:restartItem.Text = "Restart Server"
$script:restartItem.Add_Click({ Restart-Server })
$serverManagerItem.DropDownItems.Add($script:restartItem)

$contextMenu.Items.Add($serverManagerItem)

# Separator
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# Port Configuration submenu
$portConfigItem = New-Object System.Windows.Forms.ToolStripMenuItem
$portConfigItem.Text = "Port Configuration"

# Change Port
$script:portItem = New-Object System.Windows.Forms.ToolStripMenuItem
$script:portItem.Text = "Server Port: $($script:config.port)"
$script:portItem.Add_Click({ Change-Port })
$portConfigItem.DropDownItems.Add($script:portItem)

# Auto-detect Port
$script:autoDetectItem = New-Object System.Windows.Forms.ToolStripMenuItem
$script:autoDetectItem.Text = if ($script:config.autoDetectPort) { "✓ Auto-detect Port" } else { "Auto-detect Port" }
$script:autoDetectItem.Add_Click({ Toggle-AutoDetect })
$portConfigItem.DropDownItems.Add($script:autoDetectItem)

$contextMenu.Items.Add($portConfigItem)

# Separator
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# View Logs
$logsItem = New-Object System.Windows.Forms.ToolStripMenuItem
$logsItem.Text = "View Logs"
$logsItem.Add_Click({ Open-Logs })
$contextMenu.Items.Add($logsItem)

# Separator
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# Exit
$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "Exit"
$exitItem.Add_Click({
    $script:tray.Visible = $false
    $script:tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$contextMenu.Items.Add($exitItem)

# Assign context menu
$script:tray.ContextMenuStrip = $contextMenu

# Double-click to open web interface
$script:tray.Add_DoubleClick({ Open-WebInterface })

# Load Visual Basic assembly for InputBox
Add-Type -AssemblyName Microsoft.VisualBasic

# Initial status check and auto-start if not running
Update-TrayIcon

# Auto-detect port on startup if enabled
if ($script:config.autoDetectPort) {
    Find-ServerPort
}

# Auto-start server if not already running
if (-not (Test-ServerRunning)) {
    # Check if port is available before starting
    $portInUse = Get-NetTCPConnection -LocalPort $serverPort -ErrorAction SilentlyContinue
    if (-not $portInUse) {
        Start-Server
    }
}

# Show balloon tip on startup
$script:tray.ShowBalloonTip(3000, "Playlist Lab Server", "Tray application started. Double-click to open.", [System.Windows.Forms.ToolTipIcon]::Info)

# Timer to check server status every 10 seconds
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000  # 10 seconds
$timer.Add_Tick({ Update-TrayIcon })
$timer.Start()

# Keep the application running
[System.Windows.Forms.Application]::Run()
