# Requirements Document

## Introduction

The server-launcher feature removes the Electron tray-app entirely and replaces it with a self-contained server lifecycle model. The Node.js/Express server in `apps/server/` starts automatically via the chosen startup mode (Windows Service, user login startup, or manual). A simple cross-platform launcher script opens the server URL in the local browser. The web frontend gains a "Server Settings" page — gated to localhost-only access — that exposes all configuration previously managed by the tray-app, plus log viewing and server health status.

## Glossary

- **Server**: The Node.js/Express application in `apps/server/` that serves both the API and the built web frontend.
- **Launcher**: A platform-specific script (`open-playlist-lab.bat` on Windows, `open-playlist-lab.sh` on Linux/macOS) that opens the Server URL in the default browser.
- **Installer**: The platform-specific installation program (Inno Setup on Windows, shell scripts on Linux/macOS) that installs the Server and configures the startup mode.
- **Startup_Mode**: One of three modes selected during installation — Service, Startup, or Manual.
- **Service_Mode**: The Server runs as a Windows Service (via NSSM or node-windows), a systemd service on Linux, or a launchd daemon on macOS.
- **Startup_Mode_Login**: The Server is added to the user's login startup sequence (Windows startup folder shortcut, systemd --user on Linux, launchd user agent on macOS).
- **Manual_Mode**: The user starts the Server themselves; no automatic startup is configured.
- **Localhost_Detection**: The mechanism by which the Server determines whether an incoming HTTP request originates from the same machine (127.0.0.1, ::1, or `localhost`).
- **Server_Settings_API**: The set of API endpoints under `/api/server-settings` restricted to localhost-only callers.
- **Server_Settings_Page**: A page in the web frontend accessible only when the request originates from localhost, exposing all server-level configuration.
- **Web_Frontend**: The React application in `apps/web/` served by the Server.
- **Tray_App**: The Electron application previously located in `tray-app/` — to be deleted entirely.

---

## Requirements

### Requirement 1: Tray-App Removal

**User Story:** As a developer, I want the Electron tray-app removed from the codebase entirely, so that there is no confusion about which component manages the server and no Electron dependency to maintain.

#### Acceptance Criteria

1. THE Server SHALL start as a standalone process without requiring the Tray_App to be running.
2. THE Server SHALL not depend on any IPC or inter-process communication channel provided by the Tray_App for normal operation.
3. THE Tray_App directory (`tray-app/`) SHALL be deleted from the repository.
4. WHEN the Tray_App directory is deleted, all references to it in build scripts, installer scripts, CI configuration, and documentation SHALL be removed or updated.

---

### Requirement 2: Automatic Server Start

**User Story:** As a server owner, I want the server to start automatically when my machine starts (or when I log in), so that the app is always available without me having to manually launch anything.

#### Acceptance Criteria

1. WHEN Startup_Mode is Service_Mode, THE Server SHALL be registered as a system-level service that starts automatically on machine boot, before any user logs in.
2. WHEN Startup_Mode is Startup_Mode_Login, THE Server SHALL be registered to start automatically when the installing user logs in.
3. WHEN Startup_Mode is Manual_Mode, THE Server SHALL not be registered for any automatic startup.
4. WHILE the Server is running in any Startup_Mode, THE Server SHALL serve the web frontend and API without requiring the Tray_App or any other management process.

---

### Requirement 3: Installer Startup Mode Selection

**User Story:** As a server owner, I want the installer to ask me how I want the server to start, so that I can choose the option that fits my use case.

#### Acceptance Criteria

1. THE Installer SHALL present the user with a choice of three startup modes: Service_Mode, Startup_Mode_Login, and Manual_Mode.
2. WHEN the user selects Service_Mode on Windows, THE Installer SHALL register the Server as a Windows Service using NSSM or node-windows.
3. WHEN the user selects Service_Mode on Linux, THE Installer SHALL install a systemd unit file and enable it via `systemctl enable`.
4. WHEN the user selects Service_Mode on macOS, THE Installer SHALL install a launchd plist in `/Library/LaunchDaemons` and load it.
5. WHEN the user selects Startup_Mode_Login on Windows, THE Installer SHALL create a shortcut in the user's Windows startup folder pointing to the Server start script.
6. WHEN the user selects Startup_Mode_Login on Linux, THE Installer SHALL install a systemd user unit file and enable it via `systemctl --user enable`.
7. WHEN the user selects Startup_Mode_Login on macOS, THE Installer SHALL install a launchd plist in `~/Library/LaunchAgents` and load it.
8. WHEN the user selects Manual_Mode, THE Installer SHALL not configure any automatic startup mechanism.
9. THE Installer SHALL record the selected Startup_Mode so that the Server Settings page can display it.
10. IF the Installer fails to register the selected startup mechanism, THEN THE Installer SHALL display a descriptive error and offer to fall back to Manual_Mode.

---

### Requirement 4: Launcher Script

**User Story:** As a server owner, I want to double-click a launcher to open the Playlist Lab web UI in my browser, so that I can access the app without manually typing a URL.

#### Acceptance Criteria

1. THE Launcher SHALL open the Server URL (e.g., `http://localhost:3000`) in the system default browser when executed.
2. WHEN the Launcher is executed on Windows, THE Launcher SHALL be a `.bat` file named `open-playlist-lab.bat` that runs without requiring administrator privileges.
3. WHEN the Launcher is executed on Linux or macOS, THE Launcher SHALL be a shell script named `open-playlist-lab.sh` that runs without requiring elevated privileges.
4. WHERE the server port is configurable, THE Launcher SHALL read the configured port value and construct the URL accordingly, defaulting to port `3000`.
5. IF the Launcher cannot determine the port from the environment or config file, THEN THE Launcher SHALL fall back to `http://localhost:3000`.
6. THE Launcher SHALL NOT attempt to start the Server process; the Server is expected to already be running via the configured Startup_Mode.

---

### Requirement 5: Localhost Detection Middleware

**User Story:** As a server owner, I want server-level settings to be accessible only from the machine running the server, so that remote users cannot modify server configuration.

#### Acceptance Criteria

1. THE Server SHALL expose a middleware function that determines whether an incoming request originates from localhost (IPv4 `127.0.0.1`, IPv6 `::1`, or the hostname `localhost`).
2. WHEN a request passes through the localhost detection middleware and the remote address is not a localhost address, THE Server SHALL respond with HTTP status `403` and a JSON error body.
3. WHEN a request passes through the localhost detection middleware and the remote address is a localhost address, THE Server SHALL pass the request to the next handler.
4. THE Server SHALL expose a `GET /api/server-settings/is-local` endpoint that returns `{ "isLocal": true }` for localhost requests and `{ "isLocal": false }` for all other requests, without requiring authentication.

---

### Requirement 6: Server Settings API

**User Story:** As a server owner, I want to view and change all server-level configuration from the web UI when on the local machine, so that I can manage the server without editing config files manually.

#### Acceptance Criteria

1. THE Server_Settings_API SHALL require all read and mutating endpoints to pass the Localhost_Detection middleware before processing.
2. THE Server_Settings_API SHALL also require standard user authentication (`requireAuth`) for all endpoints except `GET /api/server-settings/is-local`.
3. WHEN a request is made to `GET /api/server-settings`, THE Server_Settings_API SHALL return the current server configuration including all of the following fields: `port`, `nodeEnv`, `dbPath`, `sessionSecret` (masked), `logLevel`, `cacheMaxAgeHours`, `scraperSchedule`, `rateLimitWindowMs`, `rateLimitMaxRequests`, `adminPlexIds`, and `startupMode`.
4. WHEN a request is made to `PUT /api/server-settings` with a valid configuration object, THE Server_Settings_API SHALL persist the updated values and return the updated configuration.
5. IF a request to `PUT /api/server-settings` contains a port number outside the range 1024–65535, THEN THE Server_Settings_API SHALL respond with HTTP status `400` and a descriptive error message.
6. IF a request to `PUT /api/server-settings` contains an invalid cron expression for `scraperSchedule`, THEN THE Server_Settings_API SHALL respond with HTTP status `400` and a descriptive error message.
7. IF a request to `PUT /api/server-settings` contains an invalid log level (not one of `error`, `warn`, `info`, `debug`), THEN THE Server_Settings_API SHALL respond with HTTP status `400` and a descriptive error message.
8. WHEN a request is made to `POST /api/server-settings/restart`, THE Server_Settings_API SHALL initiate a graceful server restart and respond with HTTP status `202`.

---

### Requirement 7: Log Viewing API

**User Story:** As a server owner, I want to view server logs from the web UI, so that I can diagnose issues without needing a separate log viewer application.

#### Acceptance Criteria

1. THE Server_Settings_API SHALL expose a `GET /api/server-settings/logs` endpoint restricted to localhost callers.
2. WHEN a request is made to `GET /api/server-settings/logs`, THE Server_Settings_API SHALL return the most recent log entries from the active log file, up to a configurable maximum (default 500 lines).
3. WHERE a `lines` query parameter is provided, THE Server_Settings_API SHALL return at most that many lines from the end of the log file.
4. THE Server_Settings_API SHALL expose a `GET /api/server-settings/logs/stream` endpoint that streams new log entries to the client using Server-Sent Events (SSE).
5. WHEN a client connects to `GET /api/server-settings/logs/stream`, THE Server_Settings_API SHALL emit new log lines as they are written, until the client disconnects.
6. THE Server_Settings_API SHALL expose a `GET /api/server-settings/logs/path` endpoint that returns the absolute path to the current log file, so the user can open the log folder manually.

---

### Requirement 8: Server Health Status API

**User Story:** As a server owner, I want to see the server's health status in the web UI, so that I know whether the server is running correctly without needing a tray icon.

#### Acceptance Criteria

1. THE Server SHALL expose a `GET /health` endpoint that returns HTTP status `200` and a JSON body including `{ "status": "ok", "uptime": <seconds>, "version": "<version>" }` when the server is operating normally.
2. THE Server_Settings_API SHALL expose a `GET /api/server-settings/status` endpoint restricted to localhost callers that returns extended status information including: `uptime`, `version`, `port`, `nodeEnv`, `startupMode`, `dbPath`, and `memoryUsageMb`.
3. WHEN the Server is operating normally, THE `GET /api/server-settings/status` endpoint SHALL return HTTP status `200`.

---

### Requirement 9: Server Settings Page (Web Frontend)

**User Story:** As a server owner, I want a "Server Settings" page in the web UI that is only visible when I'm accessing the app from the server machine, so that the page doesn't appear for remote users.

#### Acceptance Criteria

1. WHEN the Web_Frontend loads, THE Web_Frontend SHALL call `GET /api/server-settings/is-local` to determine whether the current session is from localhost.
2. WHILE the Web_Frontend has determined the session is from localhost, THE Web_Frontend SHALL display a "Server Settings" navigation item in the sidebar.
3. WHILE the Web_Frontend has determined the session is not from localhost, THE Web_Frontend SHALL not render the "Server Settings" navigation item.
4. WHEN a user navigates to the `/server-settings` route from a non-localhost context, THE Web_Frontend SHALL redirect the user to the home page (`/`).
5. THE Server_Settings_Page SHALL display all current server configuration fields returned by `GET /api/server-settings`: port, environment, database path, log level, cache max age, scraper schedule (cron), rate limit settings, admin Plex IDs, and startup mode.
6. THE Server_Settings_Page SHALL mask the session secret field, showing only that a value is set rather than the actual secret.
7. WHEN a user submits updated configuration on the Server_Settings_Page, THE Server_Settings_Page SHALL call `PUT /api/server-settings` and display a success or error message based on the response.
8. THE Server_Settings_Page SHALL display the current server health status as returned by `GET /api/server-settings/status`, including uptime and memory usage.
9. THE Server_Settings_Page SHALL include a log viewer section that displays recent log entries fetched from `GET /api/server-settings/logs` and optionally streams live log output via `GET /api/server-settings/logs/stream`.
10. THE Server_Settings_Page SHALL display a link or button to open the log file folder path returned by `GET /api/server-settings/logs/path`.
11. WHEN a user clicks the "Restart Server" button on the Server_Settings_Page, THE Server_Settings_Page SHALL call `POST /api/server-settings/restart` and display a confirmation message.
