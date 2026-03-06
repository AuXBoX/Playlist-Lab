# Design Document: Server Launcher

## Overview

The server-launcher feature eliminates the Electron tray-app dependency by transforming the Node.js/Express server into a self-contained, automatically-starting service. The server will start via platform-specific mechanisms (Windows Service, systemd, launchd, or user login startup) and expose a localhost-only "Server Settings" web interface that replaces all tray-app functionality.

### Key Design Decisions

1. **Tray-App Removal**: Complete deletion of the `tray-app/` directory and all Electron dependencies, reducing maintenance burden and eliminating IPC complexity.

2. **Platform-Native Startup**: Use native OS service managers (NSSM/node-windows on Windows, systemd on Linux, launchd on macOS) rather than custom process management, ensuring reliability and OS integration.

3. **Localhost-Only Settings**: Server configuration is restricted to localhost requests using IP address detection middleware, preventing remote configuration changes while maintaining security.

4. **Simple Launcher Scripts**: Platform-specific scripts (`open-playlist-lab.bat`, `open-playlist-lab.sh`) that only open the browser—they don't manage the server process.

5. **Web-Based Management**: All server configuration, log viewing, and health monitoring moves to a React-based "Server Settings" page in the web frontend, accessible only from localhost.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Operating System                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Service Manager│  │ Login Startup│  │  User Desktop   │ │
│  │ (systemd/NSSM) │  │   Scripts    │  │                 │ │
│  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│           │                  │                    │          │
└───────────┼──────────────────┼────────────────────┼──────────┘
            │                  │                    │
            ▼                  ▼                    │
    ┌───────────────────────────────┐              │
    │   Node.js/Express Server      │              │
    │   (apps/server/)              │              │
    │                               │              │
    │  ┌─────────────────────────┐  │              │
    │  │ Localhost Detection     │  │              │
    │  │ Middleware              │  │              │
    │  └─────────────────────────┘  │              │
    │                               │              │
    │  ┌─────────────────────────┐  │              │
    │  │ Server Settings API     │  │              │
    │  │ /api/server-settings/*  │  │              │
    │  └─────────────────────────┘  │              │
    │                               │              │
    │  ┌─────────────────────────┐  │              │
    │  │ Static File Server      │  │              │
    │  │ (Web Frontend)          │  │              │
    │  └─────────────────────────┘  │              │
    └───────────────┬───────────────┘              │
                    │                               │
                    │ HTTP (localhost:3000)         │
                    │                               │
            ┌───────┴────────┐                     │
            │                │                     │
            ▼                ▼                     ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Browser    │  │   Browser    │  │   Launcher   │
    │  (Localhost) │  │   (Remote)   │  │   Script     │
    │              │  │              │  │              │
    │ ✓ Settings   │  │ ✗ Settings   │  │ Opens URL    │
    │   Page       │  │   Hidden     │  │ in Browser   │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### Startup Flow by Mode

**Service Mode (System-Level)**
```
Boot → Service Manager → Start Server → Server Listens on Port
```

**Startup Mode (User Login)**
```
User Login → Startup Script → Start Server → Server Listens on Port
```

**Manual Mode**
```
User Action → Start Server Script → Server Listens on Port
```

### Request Flow for Server Settings

```
1. Browser → GET /api/server-settings/is-local
2. Server → Localhost Detection → Return { isLocal: true/false }
3. Frontend → Show/Hide "Server Settings" nav item
4. User → Navigate to /server-settings
5. Frontend → Check isLocal → Redirect if false
6. Frontend → GET /api/server-settings (with auth)
7. Server → Localhost Detection → Auth Check → Return config
8. Frontend → Display settings form
9. User → Submit changes
10. Frontend → PUT /api/server-settings (with auth)
11. Server → Localhost Detection → Auth Check → Validate → Save → Return
```

## Components and Interfaces

### 1. Localhost Detection Middleware

**Location**: `apps/server/src/middleware/localhost-detection.ts`

**Purpose**: Determine if an incoming request originates from the local machine.

**Interface**:
```typescript
export function isLocalhost(req: Request): boolean;
export function requireLocalhost(req: Request, res: Response, next: NextFunction): void;
```

**Implementation Strategy**:
- Check `req.ip` or `req.connection.remoteAddress` against localhost addresses
- Support IPv4 (`127.0.0.1`), IPv6 (`::1`), and hostname (`localhost`)
- Handle proxy scenarios where `X-Forwarded-For` might be present
- Return 403 Forbidden for non-localhost requests

**Edge Cases**:
- Reverse proxy configurations (check `X-Forwarded-For` header)
- IPv6 localhost variations (`::1`, `::ffff:127.0.0.1`)
- Docker/container networking (may need to allow Docker bridge IPs)

### 2. Server Settings API

**Location**: `apps/server/src/routes/server-settings.ts`

**Endpoints**:

```typescript
// Public endpoint (no auth required)
GET /api/server-settings/is-local
Response: { isLocal: boolean }

// Protected endpoints (localhost + auth required)
GET /api/server-settings
Response: {
  port: number;
  nodeEnv: string;
  dbPath: string;
  sessionSecret: string; // masked
  logLevel: string;
  cacheMaxAgeHours: number;
  scraperSchedule: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  adminPlexIds: string[];
  startupMode: 'service' | 'startup' | 'manual';
}

PUT /api/server-settings
Body: Partial<ServerSettings>
Response: ServerSettings (updated)
Validation:
  - port: 1024-65535
  - logLevel: 'error' | 'warn' | 'info' | 'debug'
  - scraperSchedule: valid cron expression
  - cacheMaxAgeHours: > 0
  - rateLimitWindowMs: > 0
  - rateLimitMaxRequests: > 0

POST /api/server-settings/restart
Response: { message: string } (202 Accepted)
Action: Graceful server restart

GET /api/server-settings/logs?lines=500
Response: { logs: string[] }

GET /api/server-settings/logs/stream
Response: Server-Sent Events stream
Content-Type: text/event-stream

GET /api/server-settings/logs/path
Response: { path: string }

GET /api/server-settings/status
Response: {
  uptime: number;
  version: string;
  port: number;
  nodeEnv: string;
  startupMode: string;
  dbPath: string;
  memoryUsageMb: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}
```

**Configuration Storage**:
- Store settings in `.env` file or `config.json` in the server directory
- Use `dotenv` for environment variable management
- Persist startup mode in a separate `startup-mode.txt` file written by installer

### 3. Configuration Manager Service

**Location**: `apps/server/src/services/config-manager.ts`

**Purpose**: Read and write server configuration with validation.

**Interface**:
```typescript
export class ConfigManager {
  getConfig(): ServerConfig;
  updateConfig(updates: Partial<ServerConfig>): Promise<ServerConfig>;
  validateConfig(config: Partial<ServerConfig>): ValidationResult;
  getStartupMode(): StartupMode;
}
```

**Implementation**:
- Read from environment variables and config file
- Validate all changes before persisting
- Use `cron-parser` to validate cron expressions
- Atomic file writes to prevent corruption
- Emit events when configuration changes

### 4. Log Manager Service

**Location**: `apps/server/src/services/log-manager.ts`

**Purpose**: Provide access to server logs for viewing and streaming.

**Interface**:
```typescript
export class LogManager {
  getRecentLogs(lines: number): Promise<string[]>;
  streamLogs(callback: (line: string) => void): () => void; // Returns cleanup function
  getLogFilePath(): string;
}
```

**Implementation**:
- Use `tail` or `fs.watch` to monitor log file
- Read last N lines efficiently (read from end of file)
- Stream new lines using file watchers
- Handle log rotation gracefully

### 5. Server Settings Page (Frontend)

**Location**: `apps/web/src/pages/ServerSettingsPage.tsx`

**Features**:
- Configuration form with validation
- Real-time log viewer with auto-scroll
- Server health status display
- Restart server button with confirmation
- Link to open log file folder

**State Management**:
```typescript
interface ServerSettingsState {
  isLocal: boolean;
  config: ServerConfig | null;
  status: ServerStatus | null;
  logs: string[];
  isStreaming: boolean;
  isSaving: boolean;
  error: string | null;
}
```

**UI Sections**:
1. Server Status Card (uptime, version, memory)
2. Configuration Form (all editable settings)
3. Log Viewer (recent logs + live stream toggle)
4. Actions (restart server, open log folder)

### 6. Launcher Scripts

**Windows**: `scripts/launcher/open-playlist-lab.bat`
```batch
@echo off
REM Read port from config or use default
set PORT=3000
if exist "%~dp0..\config.json" (
    REM Parse JSON to get port (simplified)
    for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"port\"" "%~dp0..\config.json"') do set PORT=%%a
)
start http://localhost:%PORT%
```

**Linux/macOS**: `scripts/launcher/open-playlist-lab.sh`
```bash
#!/bin/bash
# Read port from config or use default
PORT=3000
CONFIG_FILE="$(dirname "$0")/../config.json"
if [ -f "$CONFIG_FILE" ]; then
    PORT=$(grep -oP '"port"\s*:\s*\K\d+' "$CONFIG_FILE" || echo 3000)
fi
xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT"
```

### 7. Startup Mode Configuration

**Windows Service (NSSM)**:
```batch
nssm install PlaylistLabServer "C:\Program Files\Playlist Lab Server\node.exe" "C:\Program Files\Playlist Lab Server\server\dist\index.js"
nssm set PlaylistLabServer AppDirectory "C:\Program Files\Playlist Lab Server\server"
nssm set PlaylistLabServer DisplayName "Playlist Lab Server"
nssm set PlaylistLabServer Description "Self-hosted music playlist management server"
nssm set PlaylistLabServer Start SERVICE_AUTO_START
nssm set PlaylistLabServer AppStdout "C:\Program Files\Playlist Lab Server\logs\stdout.log"
nssm set PlaylistLabServer AppStderr "C:\Program Files\Playlist Lab Server\logs\stderr.log"
```

**Linux systemd (System Service)**:
```ini
[Unit]
Description=Playlist Lab Server
After=network.target

[Service]
Type=simple
User=playlist-lab
WorkingDirectory=/opt/playlist-lab-server
ExecStart=/usr/bin/node /opt/playlist-lab-server/server/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="PORT=3000"

[Install]
WantedBy=multi-user.target
```

**Linux systemd (User Service)**:
```ini
[Unit]
Description=Playlist Lab Server
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/.local/share/playlist-lab-server
ExecStart=/usr/bin/node %h/.local/share/playlist-lab-server/server/dist/index.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=3000"

[Install]
WantedBy=default.target
```

**macOS launchd (System Daemon)**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.playlistlab.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Applications/Playlist Lab Server.app/Contents/Resources/server/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Applications/Playlist Lab Server.app/Contents/Resources/server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/playlist-lab-server.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/playlist-lab-server-error.log</string>
</dict>
</plist>
```

**macOS launchd (User Agent)**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.playlistlab.server.user</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>~/Library/Application Support/Playlist Lab Server/server/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>~/Library/Application Support/Playlist Lab Server/server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>~/Library/Logs/playlist-lab-server.log</string>
    <key>StandardErrorPath</key>
    <string>~/Library/Logs/playlist-lab-server-error.log</string>
</dict>
</plist>
```

**Windows Startup Folder (User Login)**:
- Create shortcut in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`
- Target: `"C:\Program Files\Playlist Lab Server\start-server.bat"`
- Working Directory: `"C:\Program Files\Playlist Lab Server"`

## Data Models

### ServerConfig

```typescript
interface ServerConfig {
  port: number;                    // 1024-65535
  nodeEnv: 'development' | 'production';
  dbPath: string;                  // Absolute path to SQLite database
  sessionSecret: string;           // Masked in API responses
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  cacheMaxAgeHours: number;        // > 0
  scraperSchedule: string;         // Cron expression
  rateLimitWindowMs: number;       // > 0
  rateLimitMaxRequests: number;    // > 0
  adminPlexIds: string[];          // Array of Plex user IDs
  startupMode: 'service' | 'startup' | 'manual';
}
```

### ServerStatus

```typescript
interface ServerStatus {
  uptime: number;                  // Seconds
  version: string;                 // Semver
  port: number;
  nodeEnv: string;
  startupMode: string;
  dbPath: string;
  memoryUsageMb: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:
- Properties 5.1, 5.2, and 5.3 can be combined into a single comprehensive property about localhost detection behavior
- Properties 6.5, 6.6, and 6.7 can be combined into a single property about configuration validation
- Properties 7.2 and 7.3 can be combined into a single property about log retrieval with line limits
- Properties 8.1, 8.2, and 8.3 can be combined into a single property about health/status endpoints

### Property 1: Server Independence from Tray App

*For any* server startup, the server process SHALL listen on the configured port and serve HTTP requests without requiring any tray-app process to be running or any IPC communication channel to be established.

**Validates: Requirements 1.1, 2.4**

### Property 2: Localhost Detection Accuracy

*For any* incoming HTTP request, the localhost detection middleware SHALL correctly identify whether the request originates from a localhost address (127.0.0.1, ::1, or localhost hostname), allowing localhost requests to proceed and rejecting non-localhost requests to protected endpoints with HTTP 403.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 3: Is-Local Endpoint Correctness

*For any* request to `GET /api/server-settings/is-local`, the endpoint SHALL return `{ "isLocal": true }` when the request originates from localhost and `{ "isLocal": false }` otherwise, without requiring authentication.

**Validates: Requirements 5.4**

### Property 4: Server Settings API Protection

*For any* request to server settings endpoints (except `/is-local`), the server SHALL enforce both localhost detection and user authentication, rejecting requests that fail either check with appropriate HTTP status codes (403 for non-localhost, 401 for unauthenticated).

**Validates: Requirements 6.1, 6.2**

### Property 5: Configuration Retrieval Completeness

*For any* authenticated localhost request to `GET /api/server-settings`, the response SHALL include all required configuration fields: port, nodeEnv, dbPath, sessionSecret (masked), logLevel, cacheMaxAgeHours, scraperSchedule, rateLimitWindowMs, rateLimitMaxRequests, adminPlexIds, and startupMode.

**Validates: Requirements 6.3**

### Property 6: Configuration Persistence

*For any* valid configuration update via `PUT /api/server-settings`, the changes SHALL persist across server restarts, such that a subsequent `GET /api/server-settings` request returns the updated values.

**Validates: Requirements 6.4**

### Property 7: Configuration Validation

*For any* configuration update request, the server SHALL validate all fields according to their constraints (port: 1024-65535, logLevel: error|warn|info|debug, scraperSchedule: valid cron expression, numeric fields: > 0) and reject invalid values with HTTP 400 and descriptive error messages.

**Validates: Requirements 6.5, 6.6, 6.7**

### Property 8: Log Retrieval with Line Limits

*For any* request to `GET /api/server-settings/logs` with a `lines` parameter, the endpoint SHALL return at most that many lines from the end of the log file, defaulting to 500 lines when the parameter is omitted.

**Validates: Requirements 7.2, 7.3**

### Property 9: Log Path Accuracy

*For any* request to `GET /api/server-settings/logs/path`, the endpoint SHALL return an absolute file system path that points to the currently active log file.

**Validates: Requirements 7.6**

### Property 10: Health and Status Endpoints

*For any* request to `/health` or `/api/server-settings/status` when the server is operating normally, the endpoints SHALL return HTTP 200 with JSON bodies containing the required status fields (uptime, version, memory usage, etc.), with the status endpoint providing extended information and being restricted to localhost.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 11: Launcher Port Configuration

*For any* configured port value in the server configuration, the launcher script SHALL construct a URL using that port, falling back to port 3000 when no configuration is found or the configuration cannot be read.

**Validates: Requirements 4.4, 4.5**

## Error Handling

### Localhost Detection Errors

**Scenario**: Request to server settings endpoint from non-localhost address
- **Response**: HTTP 403 Forbidden
- **Body**: `{ "error": { "code": "FORBIDDEN", "message": "Server settings are only accessible from localhost", "statusCode": 403 } }`

**Scenario**: Proxy configuration causes incorrect localhost detection
- **Mitigation**: Check both `req.ip` and `X-Forwarded-For` header
- **Fallback**: Allow configuration to whitelist additional trusted IPs

### Configuration Validation Errors

**Scenario**: Invalid port number (< 1024 or > 65535)
- **Response**: HTTP 400 Bad Request
- **Body**: `{ "error": { "code": "INVALID_PORT", "message": "Port must be between 1024 and 65535", "statusCode": 400 } }`

**Scenario**: Invalid cron expression
- **Response**: HTTP 400 Bad Request
- **Body**: `{ "error": { "code": "INVALID_CRON", "message": "Invalid cron expression: [details]", "statusCode": 400 } }`

**Scenario**: Invalid log level
- **Response**: HTTP 400 Bad Request
- **Body**: `{ "error": { "code": "INVALID_LOG_LEVEL", "message": "Log level must be one of: error, warn, info, debug", "statusCode": 400 } }`

### Configuration Persistence Errors

**Scenario**: Unable to write configuration file (permissions, disk full)
- **Response**: HTTP 500 Internal Server Error
- **Body**: `{ "error": { "code": "CONFIG_WRITE_FAILED", "message": "Failed to save configuration", "statusCode": 500 } }`
- **Logging**: Log detailed error including file path and system error
- **Recovery**: Configuration remains unchanged; user can retry

### Log Access Errors

**Scenario**: Log file doesn't exist or can't be read
- **Response**: HTTP 500 Internal Server Error
- **Body**: `{ "error": { "code": "LOG_READ_FAILED", "message": "Unable to read log file", "statusCode": 500 } }`
- **Fallback**: Return empty array for logs endpoint

**Scenario**: Log streaming connection interrupted
- **Handling**: Clean up file watchers and event listeners
- **Client**: Implement reconnection logic with exponential backoff

### Server Restart Errors

**Scenario**: Restart requested but server cannot restart gracefully
- **Response**: HTTP 202 Accepted (restart initiated)
- **Logging**: Log restart attempt and any errors
- **Fallback**: If graceful restart fails, log error but don't crash

### Installer Errors

**Scenario**: Service registration fails (insufficient permissions)
- **Action**: Display error dialog with details
- **Fallback**: Offer to install in Manual mode instead
- **Logging**: Write error to installer log file

**Scenario**: Startup folder/systemd/launchd configuration fails
- **Action**: Display error dialog with details
- **Fallback**: Offer to install in Manual mode instead
- **Logging**: Write error to installer log file

### Launcher Errors

**Scenario**: Cannot read port from configuration file
- **Action**: Use default port 3000
- **Logging**: No logging (launcher is simple script)

**Scenario**: Browser fails to open
- **Action**: Script exits with error code
- **User Action**: User can manually open browser to localhost:3000

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of localhost detection (127.0.0.1, ::1, localhost)
- Configuration validation edge cases (boundary values for port)
- Error handling scenarios (file not found, permission denied)
- Frontend component rendering (Server Settings page visibility)
- Installer script execution (service registration, file creation)

**Property-Based Tests** focus on:
- Localhost detection across all valid IP address formats
- Configuration validation across all possible input combinations
- Log retrieval with various line count parameters
- API endpoint behavior across different request origins

### Property-Based Testing Configuration

**Library**: Use `fast-check` for JavaScript/TypeScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: server-launcher, Property {N}: {property text}`

### Unit Test Coverage

**Localhost Detection Middleware** (`localhost-detection.test.ts`):
- Test IPv4 localhost (127.0.0.1)
- Test IPv6 localhost (::1)
- Test hostname localhost
- Test non-localhost addresses (192.168.x.x, public IPs)
- Test X-Forwarded-For header handling
- Test proxy scenarios

**Server Settings API** (`server-settings.test.ts`):
- Test GET /api/server-settings returns all fields
- Test PUT /api/server-settings persists changes
- Test validation for each field type
- Test authentication requirement
- Test localhost requirement
- Test restart endpoint

**Configuration Manager** (`config-manager.test.ts`):
- Test reading configuration from file
- Test writing configuration to file
- Test validation logic for each field
- Test atomic file writes
- Test handling of missing config file

**Log Manager** (`log-manager.test.ts`):
- Test reading last N lines from log file
- Test streaming new log entries
- Test handling of log rotation
- Test cleanup of file watchers

**Server Settings Page** (`ServerSettingsPage.test.tsx`):
- Test page renders when isLocal is true
- Test page redirects when isLocal is false
- Test navigation item visibility based on isLocal
- Test form submission
- Test log viewer display
- Test restart button

**Launcher Scripts** (manual testing):
- Test launcher opens browser on Windows
- Test launcher opens browser on Linux
- Test launcher opens browser on macOS
- Test launcher reads custom port from config
- Test launcher falls back to default port

**Installer Scripts** (manual testing):
- Test Windows service installation
- Test Linux systemd service installation
- Test macOS launchd installation
- Test Windows startup folder shortcut
- Test Linux systemd user service
- Test macOS launchd user agent
- Test manual mode (no automatic startup)

### Property-Based Test Examples

**Property 1: Server Independence** (`server-independence.property.test.ts`):
```typescript
// Feature: server-launcher, Property 1: Server Independence from Tray App
test('server starts and serves requests without tray app', async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1024, max: 65535 }), async (port) => {
      // Start server on random port
      const server = await startServer({ port, trayApp: false });
      
      // Make HTTP request
      const response = await fetch(`http://localhost:${port}/health`);
      
      // Verify server responds
      expect(response.status).toBe(200);
      
      await server.close();
    }),
    { numRuns: 100 }
  );
});
```

**Property 2: Localhost Detection** (`localhost-detection.property.test.ts`):
```typescript
// Feature: server-launcher, Property 2: Localhost Detection Accuracy
test('localhost detection correctly identifies request origin', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.constant('127.0.0.1'),
        fc.constant('::1'),
        fc.constant('localhost'),
        fc.ipV4(),
        fc.ipV6()
      ),
      async (ip) => {
        const isLocalhost = ['127.0.0.1', '::1', 'localhost'].includes(ip);
        const req = createMockRequest({ ip });
        const res = createMockResponse();
        const next = jest.fn();
        
        requireLocalhost(req, res, next);
        
        if (isLocalhost) {
          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalledWith(403);
        } else {
          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 7: Configuration Validation** (`config-validation.property.test.ts`):
```typescript
// Feature: server-launcher, Property 7: Configuration Validation
test('configuration validation rejects invalid values', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        port: fc.integer(),
        logLevel: fc.string(),
        scraperSchedule: fc.string(),
        cacheMaxAgeHours: fc.integer(),
      }),
      async (config) => {
        const response = await request(app)
          .put('/api/server-settings')
          .send(config)
          .set('X-Forwarded-For', '127.0.0.1');
        
        const isValid = 
          config.port >= 1024 && config.port <= 65535 &&
          ['error', 'warn', 'info', 'debug'].includes(config.logLevel) &&
          isValidCron(config.scraperSchedule) &&
          config.cacheMaxAgeHours > 0;
        
        if (isValid) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toBeDefined();
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

**End-to-End Scenarios**:
1. Install server with Service mode → Verify service starts on boot → Access web UI → Change configuration → Verify changes persist
2. Install server with Startup mode → Verify server starts on login → Use launcher script → Access Server Settings page
3. Install server with Manual mode → Manually start server → Access web UI → View logs → Restart server
4. Access server from localhost → Verify Server Settings visible → Access from remote → Verify Server Settings hidden

### Manual Testing Checklist

**Windows**:
- [ ] Install with Service mode → Reboot → Verify server running
- [ ] Install with Startup mode → Logout/Login → Verify server running
- [ ] Install with Manual mode → Verify no automatic startup
- [ ] Run launcher script → Verify browser opens
- [ ] Access Server Settings page → Change port → Restart → Verify new port works

**Linux**:
- [ ] Install with Service mode → Reboot → Verify systemd service running
- [ ] Install with Startup mode → Logout/Login → Verify user service running
- [ ] Install with Manual mode → Verify no automatic startup
- [ ] Run launcher script → Verify browser opens
- [ ] Access Server Settings page → View logs → Verify log streaming works

**macOS**:
- [ ] Install with Service mode → Reboot → Verify launchd daemon running
- [ ] Install with Startup mode → Logout/Login → Verify launchd agent running
- [ ] Install with Manual mode → Verify no automatic startup
- [ ] Run launcher script → Verify browser opens
- [ ] Access Server Settings page → Change configuration → Verify persistence

