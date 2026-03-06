# Requirements Document: Playlist Lab Web Server

## Introduction

Playlist Lab Web Server is a multi-user web application that enables users to import, generate, and manage Plex playlists through a centralized server. Unlike the existing Electron desktop application which stores data locally for a single user, this web server version supports multiple concurrent users, each with their own Plex account, settings, schedules, and playlists. The server performs scheduled background tasks including daily scraping of popular music playlists from external services and automated generation of personalized mixes.

## Glossary

- **User**: An individual authenticated via their Plex account, identified by Plex user ID
- **Server**: The Node.js/Express web application backend
- **Client**: The React-based web frontend accessed via browser
- **Plex_Server**: A user's Plex Media Server instance
- **Music_Library**: A music library section within a Plex_Server
- **External_Playlist**: A playlist from services like Spotify, Apple Music, Deezer, Tidal, etc.
- **Matched_Playlist**: An External_Playlist with tracks matched to a user's Music_Library
- **Schedule**: A configuration defining when to automatically refresh or generate playlists
- **Scraper**: A background job that fetches playlist data from external services
- **Missing_Track**: A track from an External_Playlist that could not be matched to the Music_Library
- **Mix**: A personalized playlist generated from user's listening history (Weekly Mix, Daily Mix, Time Capsule, New Music Mix)
- **Matching_Settings**: User-specific configuration for track matching algorithm
- **Admin**: A privileged user with access to system-wide statistics and user management

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to sign in with my Plex account, so that I can access my personal playlists and settings.

#### Acceptance Criteria

1. WHEN a user visits the application, THE Server SHALL display a login page with Plex authentication option
2. WHEN a user initiates Plex login, THE Server SHALL use the PIN-based OAuth flow to authenticate
3. WHEN authentication succeeds, THE Server SHALL store the user's Plex token and user ID in the database
4. WHEN a user returns to the application, THE Server SHALL restore their session using stored credentials
5. WHEN a user logs out, THE Server SHALL invalidate their session and clear authentication data

### Requirement 2: Multi-User Data Isolation

**User Story:** As a user, I want my playlists and settings to be private, so that other users cannot see or modify my data.

#### Acceptance Criteria

1. THE Server SHALL store all user data partitioned by Plex user ID
2. WHEN a user requests their data, THE Server SHALL return only data associated with their Plex user ID
3. WHEN a user modifies data, THE Server SHALL only allow modifications to their own data
4. THE Server SHALL prevent users from accessing other users' playlists, settings, or schedules
5. THE Server SHALL maintain separate matching settings for each user

### Requirement 3: Playlist Import

**User Story:** As a user, I want to import playlists from external music services, so that I can create corresponding playlists in my Plex library.

#### Acceptance Criteria

1. WHEN a user imports a playlist, THE Server SHALL check if cached playlist data exists
2. IF cached data exists and is recent, THE Server SHALL use cached data instead of re-scraping
3. IF cached data does not exist or is stale, THE Server SHALL scrape the playlist from the external service
4. WHEN playlist data is retrieved, THE Server SHALL match tracks against the user's Music_Library
5. WHEN matching completes, THE Server SHALL present matched and unmatched tracks to the user
6. WHEN a user confirms the playlist, THE Server SHALL create the playlist in the user's Plex_Server
7. THE Server SHALL support importing from Spotify, Deezer, Apple Music, Tidal, YouTube Music, Amazon Music, Qobuz, and ListenBrainz

### Requirement 4: Scheduled Playlist Scraping

**User Story:** As a system administrator, I want the server to automatically scrape popular playlists daily, so that users can import them quickly without waiting for scraping.

#### Acceptance Criteria

1. THE Server SHALL run a daily background job to scrape popular playlists from external services
2. WHEN the scraper runs, THE Server SHALL fetch playlists from Spotify charts, Apple Music charts, Deezer charts, Tidal charts, YouTube Music charts, Amazon Music charts, Qobuz charts, and ARIA charts
3. WHEN playlist data is scraped, THE Server SHALL store it in the database with a timestamp
4. THE Server SHALL mark cached playlist data as stale after 24 hours
5. WHEN a user imports a popular playlist, THE Server SHALL use cached data if available and fresh

### Requirement 5: Personal Mix Generation

**User Story:** As a user, I want to generate personalized playlists based on my listening history, so that I can discover music tailored to my tastes.

#### Acceptance Criteria

1. THE Server SHALL support generating Weekly Mix, Daily Mix, Time Capsule, and New Music Mix
2. WHEN a user requests a mix, THE Server SHALL fetch the user's play history from their Plex_Server
3. WHEN generating Weekly Mix, THE Server SHALL select tracks from the user's most-played artists
4. WHEN generating Daily Mix, THE Server SHALL combine recent plays, related tracks, and rediscoveries
5. WHEN generating Time Capsule, THE Server SHALL select tracks not played recently with artist diversity
6. WHEN generating New Music Mix, THE Server SHALL select tracks from recently added albums
7. WHEN a mix is generated, THE Server SHALL create the playlist in the user's Plex_Server

### Requirement 6: Scheduled Mix Generation

**User Story:** As a user, I want my personal mixes to be automatically regenerated on a schedule, so that I always have fresh personalized playlists.

#### Acceptance Criteria

1. THE Server SHALL allow users to configure automatic mix generation schedules
2. WHEN a user enables scheduled mix generation, THE Server SHALL store the schedule configuration in the database
3. THE Server SHALL run a background job to check for due mix generation schedules
4. WHEN a schedule is due, THE Server SHALL generate the configured mixes for that user
5. WHEN mix generation completes, THE Server SHALL update the last run timestamp for that schedule

### Requirement 7: Playlist Scheduling

**User Story:** As a user, I want to schedule automatic playlist refreshes, so that my imported playlists stay up-to-date with external sources.

#### Acceptance Criteria

1. THE Server SHALL allow users to configure refresh schedules for imported playlists
2. WHEN a user creates a schedule, THE Server SHALL store the frequency (daily, weekly, fortnightly, monthly) and start date
3. THE Server SHALL run a background job to check for due playlist refresh schedules
4. WHEN a refresh is due, THE Server SHALL re-import the playlist using cached data if available
5. WHEN refresh completes, THE Server SHALL update the playlist in the user's Plex_Server and record the last run timestamp

### Requirement 8: Missing Tracks Management

**User Story:** As a user, I want to track which tracks couldn't be matched during import, so that I can add them to my library and retry matching later.

#### Acceptance Criteria

1. WHEN a track cannot be matched during import, THE Server SHALL store it in the missing tracks database with the user's ID, playlist ID, track details, and original position
2. WHEN a user views missing tracks, THE Server SHALL display all missing tracks grouped by playlist
3. WHEN a user retries matching for missing tracks, THE Server SHALL attempt to match them again and insert successfully matched tracks at their original positions
4. WHEN a user adds music to their library, THE Server SHALL allow bulk retry of all missing tracks
5. WHEN a track is successfully matched, THE Server SHALL remove it from the missing tracks database

### Requirement 9: Matching Settings

**User Story:** As a user, I want to customize how tracks are matched to my library, so that I can optimize matching accuracy for my collection.

#### Acceptance Criteria

1. THE Server SHALL store matching settings per user in the database
2. WHEN a user modifies matching settings, THE Server SHALL save the updated settings to the database
3. WHEN matching tracks, THE Server SHALL apply the user's matching settings
4. THE Server SHALL support configurable match threshold, strict mode, album matching, rating preferences, penalty keywords, and priority keywords
5. THE Server SHALL allow users to reset matching settings to defaults

### Requirement 10: Admin Dashboard

**User Story:** As an administrator, I want to view system statistics and user activity, so that I can monitor the application's health and usage.

#### Acceptance Criteria

1. THE Server SHALL provide an admin dashboard accessible only to admin users
2. WHEN an admin views the dashboard, THE Server SHALL display total user count, active users, and total playlists created
3. WHEN an admin views the dashboard, THE Server SHALL display all missing tracks across all users
4. WHEN an admin views missing tracks, THE Server SHALL show which tracks are most commonly missing across users
5. THE Server SHALL display scraper job status and last run times

### Requirement 11: Database Schema

**User Story:** As a developer, I want a well-structured database schema, so that user data is organized and queryable.

#### Acceptance Criteria

1. THE Server SHALL use SQLite for data storage
2. THE Server SHALL create tables for users, playlists, schedules, missing_tracks, cached_playlists, and settings
3. WHEN the server starts, THE Server SHALL initialize the database schema if it doesn't exist
4. THE Server SHALL use foreign keys to maintain referential integrity between tables
5. THE Server SHALL index frequently queried columns for performance

### Requirement 12: Session Management

**User Story:** As a user, I want my session to persist across browser restarts, so that I don't have to log in repeatedly.

#### Acceptance Criteria

1. THE Server SHALL use secure session cookies for authentication
2. WHEN a user logs in, THE Server SHALL create a session with a 30-day expiration
3. WHEN a user's session expires, THE Server SHALL redirect them to the login page
4. THE Server SHALL validate session tokens on every authenticated request
5. WHEN a user logs out, THE Server SHALL destroy their session

### Requirement 13: Web UI Feature Parity

**User Story:** As a user, I want all features from the desktop app available in the web app, so that I have a consistent experience.

#### Acceptance Criteria

1. THE Client SHALL provide Import, Generate Mixes, Discovery, Manage Playlists, and Missing Tracks pages
2. WHEN a user navigates between pages, THE Client SHALL maintain state and display appropriate content
3. THE Client SHALL support all import sources available in the desktop app
4. THE Client SHALL support all mix generation types available in the desktop app
5. THE Client SHALL support playlist editing, scheduling, and sharing features

### Requirement 14: Background Job Scheduling

**User Story:** As a system administrator, I want background jobs to run reliably, so that scheduled tasks execute on time.

#### Acceptance Criteria

1. THE Server SHALL use a job scheduler (node-cron or similar) for background tasks
2. THE Server SHALL schedule daily scraper jobs at a configured time
3. THE Server SHALL check for due playlist refresh schedules every hour
4. THE Server SHALL check for due mix generation schedules every hour
5. WHEN a background job fails, THE Server SHALL log the error and continue with the next scheduled run

### Requirement 15: API Endpoints

**User Story:** As a developer, I want well-defined API endpoints, so that the frontend can communicate with the backend.

#### Acceptance Criteria

1. THE Server SHALL provide RESTful API endpoints for all user operations
2. THE Server SHALL require authentication for all endpoints except login
3. WHEN an unauthenticated request is made, THE Server SHALL return 401 Unauthorized
4. WHEN an invalid request is made, THE Server SHALL return appropriate error codes and messages
5. THE Server SHALL return JSON responses for all API endpoints

### Requirement 16: Data Migration Support

**User Story:** As a user of the desktop app, I want to migrate my data to the web server, so that I can transition without losing my playlists and settings.

#### Acceptance Criteria

1. THE Server SHALL provide an import endpoint for desktop app data
2. WHEN a user uploads their desktop app data, THE Server SHALL parse the electron-store format
3. WHEN importing data, THE Server SHALL convert desktop app settings to web server format
4. WHEN importing data, THE Server SHALL preserve playlists, schedules, and matching settings
5. THE Server SHALL validate imported data before storing it in the database

### Requirement 17: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and how to fix it.

#### Acceptance Criteria

1. WHEN an error occurs, THE Server SHALL return a descriptive error message
2. WHEN a Plex server is unreachable, THE Server SHALL inform the user and suggest checking connectivity
3. WHEN scraping fails, THE Server SHALL log the error and continue with cached data if available
4. WHEN matching fails, THE Server SHALL display which tracks couldn't be matched and why
5. THE Server SHALL log all errors to a file for debugging

### Requirement 18: Performance Optimization

**User Story:** As a user, I want the application to respond quickly, so that I can work efficiently.

#### Acceptance Criteria

1. THE Server SHALL cache frequently accessed data in memory
2. WHEN multiple users request the same cached playlist, THE Server SHALL serve it from cache
3. THE Server SHALL use database indexes for common queries
4. THE Server SHALL paginate large result sets to reduce response size
5. THE Server SHALL compress API responses to reduce bandwidth

### Requirement 19: Security

**User Story:** As a user, I want my Plex credentials to be secure, so that my account is protected.

#### Acceptance Criteria

1. THE Server SHALL store Plex tokens encrypted in the database
2. THE Server SHALL use HTTPS for all communication in production
3. THE Server SHALL validate and sanitize all user inputs to prevent injection attacks
4. THE Server SHALL implement rate limiting to prevent abuse
5. THE Server SHALL use secure session cookies with httpOnly and secure flags

### Requirement 20: Deployment

**User Story:** As a system administrator, I want to deploy the application easily, so that I can run it on my server.

#### Acceptance Criteria

1. THE Server SHALL provide a Docker container for easy deployment
2. THE Server SHALL support environment variables for configuration
3. THE Server SHALL include a setup script for initial database creation
4. THE Server SHALL provide documentation for deployment and configuration
5. THE Server SHALL support running behind a reverse proxy (nginx, Apache)

### Requirement 21: Mobile Applications

**User Story:** As a user, I want native mobile apps for iOS and Android, so that I can manage my playlists on the go.

#### Acceptance Criteria

1. THE Mobile_Apps SHALL provide all core features available in the web app (import, generate, manage, schedules)
2. WHEN a user logs in on mobile, THE Mobile_Apps SHALL authenticate using the same Plex OAuth flow as the web app
3. WHEN a user performs actions on mobile, THE Mobile_Apps SHALL communicate with the same API server as the web app
4. THE Mobile_Apps SHALL store authentication tokens securely using platform-specific secure storage
5. THE Mobile_Apps SHALL support both iOS and Android from a single codebase using React Native and Expo
6. THE iOS_App SHALL be buildable from Windows using Expo EAS Build cloud service
7. WHEN the mobile device is offline, THE Mobile_Apps SHALL display cached data and queue actions for later sync
8. THE Mobile_Apps SHALL use native UI components and gestures for platform-appropriate user experience
