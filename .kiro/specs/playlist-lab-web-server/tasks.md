# Implementation Plan: Playlist Lab Web Server

## Overview

This implementation plan breaks down the Playlist Lab Web Server into discrete coding tasks. The approach is incremental: start with core infrastructure (database, API server, authentication), then add features (import, mixes, schedules), build the web UI, and finally create the mobile apps. Each task builds on previous work, with checkpoints to validate functionality.

## Tasks

- [x] 1. Project Setup and Infrastructure
  - Initialize monorepo structure with workspaces for server, web client, mobile app, and shared code
  - Configure TypeScript, ESLint, Prettier for all packages
  - Set up build scripts and development environment
  - Create Docker configuration for server deployment
  - _Requirements: 20.1, 20.2_

- [x] 2. Database Layer
  - [x] 2.1 Create SQLite database schema
    - Define tables: users, user_servers, user_settings, playlists, schedules, missing_tracks, cached_playlists, sessions, admin_users
    - Add foreign key constraints with CASCADE delete
    - Create indexes on frequently queried columns
    - Write database initialization script
    - _Requirements: 11.2, 11.3, 11.4, 11.5_
  
  - [x] 2.2 Write property test for database schema
    - **Property 25: Foreign Key Cascade**
    - **Validates: Requirements 11.4**
  
  - [x] 2.3 Implement database interface
    - Create Database class with methods for all CRUD operations
    - Implement user operations (create, get, update)
    - Implement settings operations (get, save)
    - Implement playlist operations (create, get, update, delete)
    - Implement schedule operations (create, get, update, delete, getDue)
    - Implement missing tracks operations (add, get, remove, clear)
    - Implement cached playlists operations (get, save, getStale)
    - Implement admin operations (getAllUsers, getStats, getMissingTrackStats)
    - _Requirements: 2.1, 11.1_
  
  - [x] 2.4 Write unit tests for database operations
    - Test CRUD operations for each table
    - Test foreign key cascades
    - Test query filters and pagination
    - _Requirements: 11.4_

- [x] 3. Checkpoint - Database Layer Complete
  - Ensure all database tests pass, verify schema is correct

- [x] 4. Authentication and Session Management
  - [x] 4.1 Implement Plex OAuth flow
    - Create auth service with PIN-based OAuth methods
    - Implement startAuth (create PIN)
    - Implement pollAuth (check PIN status)
    - Implement getUserInfo (fetch Plex user details)
    - Implement getServers (fetch user's Plex servers)
    - _Requirements: 1.2, 1.3_
  
  - [x] 4.2 Write property tests for authentication
    - **Property 1: Authentication Token Storage**
    - **Property 2: Session Restoration**
    - **Property 3: Session Invalidation**
    - **Validates: Requirements 1.3, 1.4, 1.5, 12.5**
  
  - [x] 4.3 Implement session management
    - Configure express-session with SQLite store
    - Create session middleware for authentication
    - Implement requireAuth middleware
    - Implement requireAdmin middleware
    - Implement token encryption/decryption for database storage
    - _Requirements: 12.1, 12.2, 19.1_
  
  - [x] 4.4 Write property tests for session management
    - **Property 26: Session Expiration**
    - **Property 27: Session Validation**
    - **Property 44: Secure Session Cookies**
    - **Validates: Requirements 12.3, 12.4, 19.5**

- [x] 5. API Server Core
  - [x] 5.1 Set up Express server
    - Initialize Express app with middleware (cors, helmet, compression, rate-limiting)
    - Configure error handling middleware
    - Set up logging with winston
    - Implement health check endpoint
    - _Requirements: 15.1, 19.3, 19.4_
  
  - [x] 5.2 Write property tests for API security
    - **Property 29: Authentication Requirement**
    - **Property 42: Input Sanitization**
    - **Property 43: Rate Limiting**
    - **Validates: Requirements 15.2, 15.3, 19.3, 19.4**
  
  - [x] 5.3 Implement authentication routes
    - POST /api/auth/start - Initiate Plex PIN auth
    - POST /api/auth/poll - Poll for auth completion
    - POST /api/auth/logout - Destroy session
    - GET /api/auth/me - Get current user info
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [x] 5.4 Write unit tests for auth routes
    - Test successful auth flow
    - Test failed auth scenarios
    - Test logout
    - _Requirements: 1.2, 1.5_

- [x] 6. Checkpoint - Authentication Working
  - Ensure auth flow works end-to-end, test with Postman or curl

- [x] 7. Plex Integration Service
  - [x] 7.1 Create Plex API client
    - Implement searchTrack method
    - Implement getLibraries method
    - Implement getPlayHistory method
    - Implement createPlaylist method
    - Implement getPlaylistTracks method
    - Implement addToPlaylist method
    - Implement removeFromPlaylist method
    - Implement deletePlaylist method
    - _Requirements: 3.4, 5.2, 5.7_
  
  - [x] 7.2 Write unit tests for Plex client
    - Mock Plex API responses
    - Test all client methods
    - Test error handling for unreachable servers
    - _Requirements: 17.2_

- [x] 8. Matching Service
  - [x] 8.1 Port matching algorithm from Electron app
    - Copy matching logic from src/renderer/discovery.ts
    - Adapt for server-side use (remove browser-specific code)
    - Implement calculateScore function
    - Implement matchPlaylist function
    - Apply user's matching settings
    - _Requirements: 3.4, 9.3_
  
  - [x] 8.2 Write property tests for matching
    - **Property 23: Settings Persistence**
    - **Validates: Requirements 9.2, 9.3**
  
  - [x] 8.3 Write unit tests for matching algorithm
    - Test score calculation with various inputs
    - Test matching settings application
    - Test edge cases (empty strings, special characters)
    - _Requirements: 9.3_

- [x] 9. External Service Scrapers
  - [x] 9.1 Port scrapers from Electron app
    - Copy scraper code from Electron app
    - Adapt for server-side use
    - Implement Spotify scraper
    - Implement Deezer scraper
    - Implement Apple Music scraper
    - Implement Tidal scraper
    - Implement YouTube Music scraper
    - Implement Amazon Music scraper
    - Implement Qobuz scraper
    - Implement ListenBrainz scraper
    - Implement ARIA Charts scraper
    - _Requirements: 3.7, 4.2_
  
  - [x] 9.2 Write unit tests for scrapers
    - Mock external service responses
    - Test each scraper
    - Test error handling
    - _Requirements: 17.3_

- [x] 10. Playlist Import Feature
  - [x] 10.1 Implement import service
    - Create import service with cache-first logic
    - Check cached_playlists table before scraping
    - Use cached data if fresh (< 24 hours)
    - Scrape if cache miss or stale
    - Store scraped data in cache
    - Match tracks using matching service
    - Store unmatched tracks in missing_tracks table
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1_
  
  - [x] 10.2 Write property tests for import workflow
    - **Property 6: Cache-First Import**
    - **Property 7: Stale Cache Scraping**
    - **Property 8: Import Workflow Completeness**
    - **Property 20: Missing Track Storage**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 8.1**
  
  - [x] 10.3 Implement import API routes
    - POST /api/import/spotify
    - POST /api/import/deezer
    - POST /api/import/apple
    - POST /api/import/tidal
    - POST /api/import/youtube
    - POST /api/import/amazon
    - POST /api/import/qobuz
    - POST /api/import/listenbrainz
    - POST /api/import/file
    - _Requirements: 3.1, 3.6_
  
  - [x] 10.4 Write integration tests for import
    - Test full import workflow with mocked services
    - Test cache behavior
    - Test missing tracks storage
    - _Requirements: 3.1, 3.2, 3.3, 8.1_

- [x] 11. Checkpoint - Import Feature Working
  - Test importing a playlist end-to-end, verify cache and missing tracks

- [x] 12. Personal Mix Generation
  - [x] 12.1 Implement mix generation algorithms
    - Port mix generation logic from Electron app
    - Implement Weekly Mix generator (top artists)
    - Implement Daily Mix generator (recent + related + rediscoveries)
    - Implement Time Capsule generator (old tracks with diversity)
    - Implement New Music Mix generator (recently added albums)
    - Apply user's mix settings
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 12.2 Write property tests for mix generation
    - **Property 11: Mix Generation Requires Play History**
    - **Property 12: Weekly Mix Artist Selection**
    - **Property 13: Daily Mix Composition**
    - **Property 14: Time Capsule Staleness and Diversity**
    - **Property 15: New Music Mix Recency**
    - **Property 16: Mix Playlist Creation**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
  
  - [x] 12.3 Implement mix API routes
    - POST /api/mixes/weekly
    - POST /api/mixes/daily
    - POST /api/mixes/timecapsule
    - POST /api/mixes/newmusic
    - POST /api/mixes/custom
    - POST /api/mixes/all
    - _Requirements: 5.1, 5.7_
  
  - [x] 12.4 Write integration tests for mix generation
    - Test each mix type with mocked Plex data
    - Test mix settings application
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [x] 13. Scheduling System
  - [x] 13.1 Implement schedule service
    - Create schedule checker that queries due schedules
    - Implement schedule execution logic
    - Update last_run timestamp after execution
    - Handle playlist refresh schedules
    - Handle mix generation schedules
    - _Requirements: 6.4, 6.5, 7.4, 7.5_
  
  - [x] 13.2 Write property tests for scheduling
    - **Property 17: Schedule Persistence**
    - **Property 18: Due Schedule Execution**
    - **Property 19: Schedule Timestamp Update**
    - **Validates: Requirements 6.2, 6.4, 6.5, 7.2, 7.4, 7.5**
  
  - [x] 13.3 Implement schedule API routes
    - GET /api/schedules
    - POST /api/schedules
    - PUT /api/schedules/:id
    - DELETE /api/schedules/:id
    - _Requirements: 6.1, 7.1_
  
  - [x] 13.4 Write unit tests for schedule routes
    - Test CRUD operations
    - Test schedule validation
    - _Requirements: 6.2, 7.2_

- [x] 14. Background Jobs
  - [x] 14.1 Set up job scheduler
    - Configure node-cron
    - Create job registry
    - Implement graceful shutdown
    - _Requirements: 14.1, 14.2_
  
  - [x] 14.2 Implement daily scraper job
    - Schedule for 2:00 AM daily
    - Scrape popular playlists from all services
    - Store in cached_playlists table
    - Mark old cache as stale
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 14.3 Write property tests for cache management
    - **Property 9: Cache Timestamp Storage**
    - **Property 10: Cache Staleness**
    - **Property 38: Cached Playlist Reuse**
    - **Validates: Requirements 4.3, 4.4, 18.2**
  
  - [x] 14.4 Implement schedule checker jobs
    - Schedule playlist refresh checker (hourly)
    - Schedule mix generation checker (hourly)
    - Execute due schedules
    - _Requirements: 14.3, 14.4_
  
  - [x] 14.5 Write property test for job error handling
    - **Property 28: Job Error Recovery**
    - **Validates: Requirements 14.5**
  
  - [x] 14.6 Implement cache cleanup job
    - Schedule for weekly
    - Remove cached playlists older than 7 days
    - Vacuum database
    - _Requirements: 4.4_

- [x] 15. Checkpoint - Background Jobs Working
  - Test scraper job manually, verify schedules execute on time

- [x] 16. Remaining API Routes
  - [x] 16.1 Implement server and settings routes
    - GET /api/servers
    - POST /api/servers/select
    - GET /api/servers/libraries
    - GET /api/settings
    - PUT /api/settings
    - PUT /api/settings/matching
    - PUT /api/settings/mixes
    - _Requirements: 9.1, 9.2_
  
  - [x] 16.2 Implement playlist management routes
    - GET /api/playlists
    - GET /api/playlists/:id
    - POST /api/playlists
    - PUT /api/playlists/:id
    - DELETE /api/playlists/:id
    - GET /api/playlists/:id/tracks
    - POST /api/playlists/:id/tracks
    - DELETE /api/playlists/:id/tracks/:trackId
    - _Requirements: 3.6_
  
  - [x] 16.3 Implement missing tracks routes
    - GET /api/missing
    - POST /api/missing/retry
    - DELETE /api/missing/:id
    - DELETE /api/missing/playlist/:playlistId
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [x] 16.4 Write property tests for missing tracks
    - **Property 21: Missing Tracks Grouping**
    - **Property 22: Missing Track Retry and Insertion**
    - **Validates: Requirements 8.2, 8.3, 8.5**
  
  - [x] 16.5 Implement discovery routes
    - GET /api/discovery/charts
    - POST /api/discovery/charts/import
    - _Requirements: 4.5_
  
  - [x] 16.6 Implement admin routes
    - GET /api/admin/stats
    - GET /api/admin/users
    - GET /api/admin/missing
    - GET /api/admin/jobs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 16.7 Write property tests for admin features
    - **Property 24: Admin Missing Tracks Aggregation**
    - **Validates: Requirements 10.3, 10.4**
  
  - [x] 16.8 Implement migration routes
    - POST /api/migrate/desktop
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [x] 16.9 Write property tests for migration
    - **Property 32: Desktop Data Import Round-Trip**
    - **Property 33: Import Data Validation**
    - **Validates: Requirements 16.2, 16.3, 16.4, 16.5**

- [x] 17. Data Isolation and Security
  - [x] 17.1 Write property tests for data isolation
    - **Property 4: User Data Isolation**
    - **Property 5: Independent User Settings**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
  
  - [x] 17.2 Write property tests for API responses
    - **Property 30: Invalid Request Errors**
    - **Property 31: JSON Response Format**
    - **Property 34: Error Message Descriptiveness**
    - **Property 36: Matching Error Details**
    - **Property 37: Error Logging**
    - **Validates: Requirements 15.4, 15.5, 17.1, 17.4, 17.5**
  
  - [x] 17.3 Write property tests for performance
    - **Property 39: Result Set Pagination**
    - **Property 40: Response Compression**
    - **Property 41: Token Encryption**
    - **Property 45: Environment Variable Configuration**
    - **Validates: Requirements 18.4, 18.5, 19.1, 20.2**

- [x] 18. Checkpoint - API Server Complete
  - Test all API endpoints, verify authentication, data isolation, error handling

- [x] 19. Shared Package
  - [x] 19.1 Create shared package
    - Initialize @playlist-lab/shared package
    - Define TypeScript interfaces for all data models
    - Create API client class
    - Implement auth methods
    - Implement playlist methods
    - Implement mix methods
    - Implement schedule methods
    - Implement settings methods
    - _Requirements: 15.1_
  
  - [x] 19.2 Write unit tests for shared package
    - Test API client methods
    - Test error handling
    - Test request/response serialization
    - _Requirements: 15.4, 15.5_

- [x] 20. Web Client - Core Setup
  - [x] 20.1 Initialize React app
    - Set up Vite + React + TypeScript
    - Configure routing with React Router
    - Set up global styles and theme
    - Create layout components (header, sidebar, footer)
    - _Requirements: 13.1_
  
  - [x] 20.2 Implement authentication context
    - Create AuthContext with login/logout methods
    - Implement protected route wrapper
    - Create login page with Plex auth
    - Implement session persistence
    - _Requirements: 1.1, 1.4_
  
  - [x] 20.3 Implement app state management
    - Create AppContext for global state
    - Implement user state
    - Implement server state
    - Implement settings state
    - Implement playlists state
    - Implement schedules state
    - _Requirements: 13.2_

- [x] 21. Web Client - Pages
  - [x] 21.1 Create Dashboard page
    - Display user info and server status
    - Show quick stats (playlist count, missing tracks count)
    - Add quick action buttons
    - _Requirements: 13.1_
  
  - [x] 21.2 Create Import page
    - Port ImportPage component from Electron app
    - Add source selection (Spotify, Deezer, etc.)
    - Implement import progress display
    - Show matched/unmatched tracks
    - Add confirm/cancel actions
    - _Requirements: 13.3, 3.5_
  
  - [x] 21.3 Create Generate Mixes page
    - Add buttons for each mix type
    - Show mix settings configuration
    - Display generation progress
    - Show generated playlist preview
    - _Requirements: 13.4, 5.1_
  
  - [x] 21.4 Create Discovery page
    - Display available charts by category
    - Add search/filter for charts
    - Implement chart import
    - _Requirements: 13.1, 4.5_
  
  - [x] 21.5 Create Manage Playlists page
    - List user's playlists
    - Add edit/delete actions
    - Show playlist details
    - Implement track list with add/remove
    - _Requirements: 13.5_
  
  - [x] 21.6 Create Schedules page
    - List user's schedules
    - Add create/edit/delete schedule forms
    - Show next run time for each schedule
    - _Requirements: 13.5, 6.1, 7.1_
  
  - [x] 21.7 Create Missing Tracks page
    - Port MissingTracksPage from Electron app
    - Group missing tracks by playlist
    - Add retry matching button
    - Add export to CSV button
    - _Requirements: 13.1, 8.2_
  
  - [x] 21.8 Create Settings page
    - Add matching settings configuration
    - Add mix settings configuration
    - Add server selection
    - Add library selection
    - _Requirements: 13.5, 9.1_
  
  - [x] 21.9 Create Admin page (admin only)
    - Display system statistics
    - Show all users
    - Display aggregated missing tracks
    - Show background job status
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 22. Checkpoint - Web Client Complete
  - Test all pages, verify functionality matches Electron app

- [x] 23. Mobile App - Setup
  - [x] 23.1 Initialize React Native app with Expo
    - Run `npx create-expo-app mobile`
    - Configure TypeScript
    - Set up navigation with React Navigation
    - Install React Native Paper for UI components
    - Configure EAS Build
    - _Requirements: 21.5, 21.6_
  
  - [x] 23.2 Configure shared package usage
    - Link @playlist-lab/shared package
    - Configure module resolution
    - Test API client in mobile environment
    - _Requirements: 21.3_
  
  - [x] 23.3 Implement mobile authentication
    - Create auth context with AsyncStorage
    - Implement secure token storage with expo-secure-store
    - Create login screen with Plex auth
    - Implement session persistence
    - _Requirements: 21.2, 21.4_

- [x] 24. Mobile App - Screens
  - [x] 24.1 Create Dashboard screen
    - Display user info and stats
    - Add quick action cards
    - Implement pull-to-refresh
    - _Requirements: 21.1_
  
  - [x] 24.2 Create Import screen
    - Add source selection
    - Implement import flow
    - Show progress indicator
    - Display matched/unmatched tracks
    - _Requirements: 21.1, 21.3_
  
  - [x] 24.3 Create Generate Mixes screen
    - Add mix type selection
    - Show mix settings
    - Display generation progress
    - _Requirements: 21.1, 21.3_
  
  - [x] 24.4 Create Playlists screen
    - List user's playlists with FlatList
    - Add search/filter
    - Implement swipe-to-delete
    - Show playlist details on tap
    - _Requirements: 21.1, 21.3_
  
  - [x] 24.5 Create Settings screen
    - Add matching settings
    - Add mix settings
    - Add server selection
    - Add logout button
    - _Requirements: 21.1, 21.3_
  
  - [x] 24.6 Implement offline support
    - Cache data in AsyncStorage
    - Queue actions when offline
    - Sync when connection restored
    - Show offline indicator
    - _Requirements: 21.7_

- [x] 25. Mobile App - Platform-Specific Features
  - [x] 25.1 Implement native UI patterns
    - Add platform-specific navigation (tabs for iOS, drawer for Android)
    - Implement native gestures (swipe, long-press)
    - Add haptic feedback
    - Use platform-specific icons
    - _Requirements: 21.8_
  
  - [x] 25.2 Configure app icons and splash screens
    - Create app icons for iOS and Android
    - Configure splash screens
    - Set up app metadata (name, description, version)
    - _Requirements: 21.5_

- [x] 26. Checkpoint - Mobile Apps Complete
  - Test on iOS simulator and Android emulator, verify all features work

- [x] 27. Testing and Quality Assurance
  - [x] 27.1 Run all property tests
    - Execute all 45 property tests
    - Verify 100+ iterations per test
    - Fix any failing tests
    - _Requirements: All_
  
  - [x] 27.2 Run all unit tests
    - Execute full unit test suite
    - Verify > 80% code coverage
    - Fix any failing tests
    - _Requirements: All_
  
  - [x] 27.3 Run integration tests
    - Test import workflow end-to-end
    - Test mix generation workflow
    - Test schedule execution
    - _Requirements: 3.1, 5.1, 6.4, 7.4_
  
  - [x] 27.4 Perform manual testing
    - Test web app in multiple browsers
    - Test mobile apps on real devices
    - Test all user workflows
    - Verify error handling
    - _Requirements: All_

- [x] 28. Documentation
  - [x] 28.1 Write API documentation
    - Document all endpoints with examples
    - Add authentication requirements
    - Document error responses
    - Create Postman collection
    - _Requirements: 15.1_
  
  - [x] 28.2 Write deployment documentation
    - Document Docker setup
    - Document environment variables
    - Document reverse proxy configuration
    - Document backup procedures
    - _Requirements: 20.3, 20.4, 20.5_
  
  - [x] 28.3 Write user documentation
    - Create user guide for web app
    - Create user guide for mobile apps
    - Document migration from desktop app
    - Add troubleshooting section
    - _Requirements: 16.1_
  
  - [x] 28.4 Write developer documentation
    - Document project structure
    - Document development setup
    - Document testing procedures
    - Document contribution guidelines
    - _Requirements: 20.4_

- [x] 29. Deployment Preparation
  - [x] 29.1 Build production artifacts
    - Build server with optimizations
    - Build web client with production config
    - Build mobile apps with EAS Build
    - _Requirements: 20.1, 21.6_
  
  - [x] 29.2 Create deployment scripts
    - Create database initialization script
    - Create backup script
    - Create update script
    - _Requirements: 20.3_
  
  - [x] 29.3 Configure production environment
    - Set up environment variables
    - Configure HTTPS
    - Set up reverse proxy
    - Configure monitoring
    - _Requirements: 19.2, 20.2, 20.5_

- [x] 30. Final Checkpoint
  - Deploy to staging environment, perform full system test, verify all requirements met

## Notes

- All tasks are required for comprehensive testing from the start
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation reuses existing Electron app code where possible (matching algorithm, scrapers)
- Mobile apps use Expo EAS Build to enable iOS builds from Windows
- All three clients (web, iOS, Android) share the same API server and business logic
