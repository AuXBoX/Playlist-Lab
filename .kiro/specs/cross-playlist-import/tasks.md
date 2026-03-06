# Implementation Plan: Cross-Playlist Import

## Overview

Implement a universal playlist transfer tool with a pluggable adapter architecture. The feature spans database schema additions, a new adapter layer, a new backend route file, and a new frontend page with step-based navigation.

## Tasks

- [x] 1. Database schema additions
  - Add `cross_import_jobs` and `oauth_connections` tables to `apps/server/src/database/schema.sql`
  - Add migration logic in `apps/server/src/database/init.ts` to create both tables if they don't exist (using `CREATE TABLE IF NOT EXISTS`)
  - Add indexes: `idx_cross_import_jobs_user_id`, `idx_cross_import_jobs_created_at`, `idx_oauth_connections_user_service`
  - _Requirements: 10.1, 10.2, 6.4_

- [x] 2. Adapter interfaces and registry
  - [x] 2.1 Create `apps/server/src/adapters/types.ts` with `TrackInfo`, `PlaylistInfo`, `MatchResult`, `ServiceMeta`, `TargetConfig`, `SourceAdapter`, and `TargetAdapter` interfaces exactly as specified in the design
    - _Requirements: 12.1, 12.2_
  - [x] 2.2 Create `apps/server/src/adapters/registry.ts` with the `AdapterRegistry` class and exported `adapterRegistry` singleton
    - Implement `registerSource`, `registerTarget`, `getSource`, `getTarget`, `listSources`, `listTargets` (targets filtered to non-source-only)
    - _Requirements: 12.5_
  - [x] 2.3 Write unit tests for AdapterRegistry
    - Test register/retrieve, listSources returns all, listTargets excludes source-only adapters
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 3. Plex source adapter
  - [x] 3.1 Create `apps/server/src/adapters/plex-source.ts` implementing `SourceAdapter`
    - `meta`: `{ id: 'plex', name: 'Plex', icon: 'plex', isSourceOnly: false, requiresOAuth: false }`
    - `listPlaylists`: calls `GET /playlists?playlistType=audio` on the configured Plex server using `PlexClient` from `plex.ts`
    - `fetchTracks`: fetches playlist items via `GET /playlists/{id}/items`, maps to `TrackInfo[]`
    - For Plex Home users (sourceId prefixed `plex-home:`), call `POST https://plex.tv/api/v2/home/users/{userId}/switch` to get the managed user token before fetching
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Plex target adapter
  - [x] 4.1 Create `apps/server/src/adapters/plex-target.ts` implementing `TargetAdapter`
    - `meta`: `{ id: 'plex', name: 'Plex', icon: 'plex', isSourceOnly: false, requiresOAuth: false }`
    - `matchTracks`: delegates to existing `matchPlaylist` from `apps/server/src/services/matching.ts`; emits `progress` events on `progressEmitter` after each batch
    - `searchCatalog`: calls Plex library search endpoint with the query string
    - `createPlaylist`: calls `POST /playlists` on the target Plex server with the matched track URIs
    - Append `" (Copy)"` to playlist name when source and target resolve to the same server and library
    - _Requirements: 7.2, 9.2, 5.7_
  - [x] 4.2 Write unit tests for PlexTargetAdapter
    - Verify `matchTracks` delegates to `matchPlaylist` with correct arguments
    - Verify `" (Copy)"` suffix logic
    - _Requirements: 5.7, 9.5_

- [x] 5. Spotify source and target adapters
  - [x] 5.1 Create `apps/server/src/adapters/spotify-source.ts` implementing `SourceAdapter`
    - `listPlaylists`: uses existing `getSpotifyToken` from `spotify-auth.ts` to call Spotify `/me/playlists`
    - `fetchTracks`: calls Spotify `/playlists/{id}/tracks`, maps to `TrackInfo[]`
    - Reuse existing scraper functions from `scrapers.ts` / `browser-scrapers.ts` where applicable
    - _Requirements: 3.1, 3.4_
  - [x] 5.2 Create `apps/server/src/adapters/spotify-target.ts` implementing `TargetAdapter`
    - `searchCatalog`: calls Spotify `GET /v1/search?type=track&q={query}` with stored token
    - `matchTracks`: iterates tracks, calls `searchCatalog` per track, picks top result, emits progress events
    - `createPlaylist`: calls Spotify `POST /v1/users/{userId}/playlists` then `POST /v1/playlists/{id}/tracks`
    - `getOAuthUrl`, `handleOAuthCallback`, `hasValidConnection`, `revokeConnection`: follow the same pattern as `spotify-auth.ts` but use the `oauth_connections` table (Spotify already stores tokens in `users` table — continue using that for backward compatibility)
    - _Requirements: 6.1, 6.2, 6.3, 7.3, 9.3_

- [x] 6. External source-only adapters (Deezer, YouTube Music, Apple Music, Amazon Music, Tidal, Qobuz, ListenBrainz)
  - [x] 6.1 Create `apps/server/src/adapters/deezer-source.ts`
    - `fetchTracks`: parses Deezer playlist URL, calls Deezer public API `/playlist/{id}/tracks`, maps to `TrackInfo[]`
    - `meta.isSourceOnly: false` (Deezer can be a target later; source-only flag is false)
    - _Requirements: 2.1, 3.1_
  - [x] 6.2 Create `apps/server/src/adapters/youtube-source.ts`
    - `fetchTracks`: uses existing scraper from `browser-scrapers.ts` for YouTube Music playlist URLs
    - _Requirements: 2.1, 3.1_
  - [x] 6.3 Create `apps/server/src/adapters/apple-source.ts`
    - `fetchTracks`: uses existing scraper for Apple Music playlist URLs
    - _Requirements: 2.1, 3.1_
  - [x] 6.4 Create `apps/server/src/adapters/amazon-source.ts`
    - `fetchTracks`: uses existing scraper for Amazon Music playlist URLs
    - _Requirements: 2.1, 3.1_
  - [x] 6.5 Create `apps/server/src/adapters/tidal-source.ts`
    - `fetchTracks`: uses existing scraper for Tidal playlist URLs
    - _Requirements: 2.1, 3.1_
  - [x] 6.6 Create `apps/server/src/adapters/qobuz-source.ts`
    - `fetchTracks`: uses existing scraper for Qobuz playlist URLs
    - _Requirements: 2.1, 3.1_
  - [x] 6.7 Create `apps/server/src/adapters/listenbrainz-source.ts`
    - `fetchTracks`: calls ListenBrainz public API `/1/user/{username}/playlists` and `/1/playlist/{mbid}`, maps to `TrackInfo[]`
    - Input method is username (not URL)
    - _Requirements: 2.1, 3.1_

- [x] 7. Adapter registration entry point
  - Create `apps/server/src/adapters/index.ts` that imports all adapter modules and calls `adapterRegistry.registerSource` / `adapterRegistry.registerTarget` for each
  - Import and call this file from the server startup (`apps/server/src/index.ts` or equivalent entry point)
  - _Requirements: 12.3, 12.4, 12.5_

- [x] 8. Backend route file — core endpoints
  - [x] 8.1 Create `apps/server/src/routes/cross-import.ts` with Express router
    - Apply `requireAuth` middleware to all routes
    - `GET /sources`: calls `adapterRegistry.listSources()`, enriches with Plex server/home-user entries from DB, checks OAuth connection status for external services, returns sources list
    - `GET /targets`: calls `adapterRegistry.listTargets()`, enriches Plex entries with available libraries, checks OAuth status, marks default target
    - `GET /sources/:sourceId/playlists`: resolves source adapter, calls `adapter.listPlaylists()`, returns playlist list
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 8.2 Add match, search, execute, and history endpoints to `cross-import.ts`
    - `POST /search`: resolves target adapter, calls `adapter.searchCatalog(query, ...)`, returns results
    - `POST /execute`: resolves target adapter, calls `adapter.createPlaylist(...)`, updates job record to `status=complete`, returns `{ playlistId, name, trackCount }`
    - `GET /history`: queries `cross_import_jobs` for the authenticated user ordered by `created_at DESC`
    - _Requirements: 11.5, 11.6, 11.7_
  - [x] 8.3 Mount the cross-import router in the server entry point
    - Add `app.use('/api/cross-import', crossImportRouter)` in the main server file
    - _Requirements: 11.1_

- [x] 9. SSE matching progress endpoints
  - [x] 9.1 Add SSE session management to `cross-import.ts`
    - `GET /match/progress/:sessionId`: sets SSE headers, stores `EventEmitter` keyed by `sessionId`, sends keep-alive comments every 15s
    - `POST /match`: validates body `{ sourceId, playlistUrlOrId, targetId, targetConfig, sessionId }`, inserts `cross_import_jobs` record with `status=matching`, starts async matching via source and target adapters, emits `progress` / `complete` / `error` events on the stored emitter
    - `GET /match/status/:sessionId`: polling fallback — returns last known progress for the session
    - `POST /match/cancel/:sessionId`: sets cancellation flag for the session; adapter checks `isCancelled()` between batches and stops; deletes the job record on cancellation
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8, 11.4_
  - [x] 9.2 Write unit tests for SSE session management
    - Test that cancel sets the flag, that progress events are emitted, that job status transitions correctly
    - _Requirements: 7.8_

- [x] 10. Checkpoint — backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend — CrossImportPage and step components
  - [x] 11.1 Create `apps/web/src/pages/CrossImportPage.tsx` and `CrossImportPage.css`
    - Manage `currentStep` index (0–6: Source → Playlist → Target → OAuth → Matching → Review → Confirmation)
    - Manage `importState` object accumulating selections across steps
    - Render the active step component; show step counter (e.g. "Step 2 of 7")
    - Provide back navigation for steps > 0; preserve state on back
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 11.2 Create `apps/web/src/components/cross-import/SourceStep.tsx`
    - Fetch `GET /api/cross-import/sources` on mount
    - Render a grid of service cards (icon, name, connection badge)
    - On card click, advance to next step with selected source
    - Show error with retry button if fetch fails
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_
  - [x] 11.3 Create `apps/web/src/components/cross-import/PlaylistStep.tsx`
    - For Plex sources: fetch `GET /api/cross-import/sources/:sourceId/playlists`, render browsable list with name, track count, duration
    - For external sources with `listPlaylists` support: render browsable list plus URL input
    - For other external sources: render URL/username/file input appropriate to the service
    - Show playlist metadata preview after successful fetch
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.4_
  - [x] 11.4 Create `apps/web/src/components/cross-import/TargetStep.tsx`
    - Fetch `GET /api/cross-import/targets` on mount
    - Render target service cards with OAuth status badges
    - For Plex targets: show library picker dropdown after server selection
    - Default-select the user's configured Plex server/library
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 11.5 Create `apps/web/src/components/cross-import/OAuthStep.tsx`
    - Call `GET /api/cross-import/oauth/:service` to get the auth URL
    - Open auth URL in a popup window
    - Poll for `?cross_import_connected=service` query param or listen for `window.postMessage`
    - On success, auto-advance to matching step
    - On token expiry detected (401 with `TOKEN_EXPIRED` code), re-show this step
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [x] 11.6 Create `apps/web/src/components/cross-import/MatchingStep.tsx`
    - Open SSE connection to `GET /api/cross-import/match/progress/:sessionId`
    - POST to `POST /api/cross-import/match` to start matching
    - Display progress bar with phase label ("Fetching tracks…" / "Matching tracks…") and `current / total` count
    - Show cancel button; on cancel POST to `/match/cancel/:sessionId`
    - On `complete` event, store results in `importState` and advance to review step
    - _Requirements: 7.4, 7.5, 7.7, 7.8_
  - [x] 11.7 Create `apps/web/src/components/cross-import/ReviewStep.tsx`
    - Render all tracks in a list: source title/artist, matched target title/artist (or "Unmatched"), confidence badge
    - Visually distinguish matched (green), unmatched (yellow/orange), and skipped (grey/strikethrough) tracks
    - "Show only unmatched" filter toggle
    - Per-track skip/unskip button
    - Per-track manual search: text input → POST `/api/cross-import/search` → show results → user selects → updates match to confidence 100
    - Summary bar: total / matched / unmatched / skipped counts
    - "Confirm Import" button advances to confirmation step
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_
  - [x] 11.8 Create `apps/web/src/components/cross-import/ConfirmationStep.tsx`
    - On mount, POST to `POST /api/cross-import/execute` with reviewed tracks
    - Show loading state during creation
    - On success: display success message with new playlist name and track count; offer "Start another import" button
    - On failure: display descriptive error; offer retry button
    - _Requirements: 9.1, 9.4, 9.5, 9.6, 9.7_

- [x] 12. Frontend — Import History sub-page
  - [x] 12.1 Create `apps/web/src/components/cross-import/ImportHistoryTab.tsx`
    - Fetch `GET /api/cross-import/history` on mount
    - Render list of past jobs: source service, source playlist name, target service, target playlist name, matched/unmatched/skipped counts, timestamp
    - Expandable row to show unmatched track list for each job
    - Empty state when no history exists
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  - [x] 12.2 Add history tab to `CrossImportPage.tsx`
    - Add a "History" tab/sub-page alongside the import flow (similar to `SharePlaylistsPage.tsx` sub-page pattern)
    - _Requirements: 10.5_

- [x] 13. Navigation integration
  - Add "Cross Import" as a top-level navigation item in the web app's main nav (same pattern as other top-level pages)
  - Add the route for `CrossImportPage` in `apps/web/src/main.tsx` (or the router config file)
  - _Requirements: 1.1_

- [x] 14. OAuth endpoints
  - Add `GET /api/cross-import/oauth/:service` to `cross-import.ts`
    - Resolves target adapter by service name, calls `adapter.getOAuthUrl(userId, db, redirectUri)`, returns `{ authUrl }`
  - Add `GET /api/cross-import/oauth/:service/callback` to `cross-import.ts`
    - Calls `adapter.handleOAuthCallback(code, userId, db, redirectUri)`, stores encrypted tokens in `oauth_connections`, redirects to web app with `?cross_import_connected=service`
  - Add `DELETE /api/cross-import/oauth/:service` to `cross-import.ts`
    - Calls `adapter.revokeConnection(userId, db)`, deletes row from `oauth_connections`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 11.8, 11.9_

- [x] 15. OAuth connections settings UI
  - Add a "Connected Services" section to `apps/web/src/pages/SettingsPage.tsx`
  - List each external service with its connection status (fetched from `GET /api/cross-import/targets`)
  - "Revoke" button per connected service calls `DELETE /api/cross-import/oauth/:service`
  - _Requirements: 6.6_

- [x] 16. Property-based tests
  - [x] 16.1 Create `apps/server/tests/property/cross-import.property.test.ts`
    - Import `fast-check`; configure with minimum 100 iterations per property
    - Tag each test: `// Feature: cross-playlist-import, Property N: <text>`
  - [x] 16.2 Write property test for Property 1: Sources list reflects all registered adapters
    - Generate arbitrary sets of mock adapters, register them, assert sources response contains exactly one entry per adapter
    - **Property 1: Sources list reflects all registered adapters**
    - **Validates: Requirements 2.1, 2.2, 12.5**
  - [x] 16.3 Write property test for Property 2: Targets list never contains source-only services
    - Generate arbitrary adapter sets including source-only entries, assert targets response excludes them
    - **Property 2: Targets list never contains source-only services**
    - **Validates: Requirements 5.2**
  - [x] 16.4 Write property test for Property 3: Every source and target entry has a connection status field
    - For any sources/targets response, assert every entry has a boolean `connected` field
    - **Property 3: Every source and target entry has a connection status field**
    - **Validates: Requirements 2.5, 5.3**
  - [x] 16.5 Write property test for Property 5: Match results contain exactly N entries with required fields
    - Generate arbitrary track lists of length N, run matching, assert result length === N and each entry has required fields, and matched+unmatched+skipped === N
    - **Property 5: Match results contain exactly N entries with required fields**
    - **Validates: Requirements 8.1, 8.2, 8.10**
  - [x] 16.6 Write property test for Property 6: Manually selected matches always have confidence 100
    - Generate arbitrary match results, simulate manual override, assert confidence === 100
    - **Property 6: Manually selected matches always have confidence 100**
    - **Validates: Requirements 8.7**
  - [x] 16.7 Write property test for Property 7: Execute only includes matched, non-skipped tracks
    - Generate arbitrary reviewed track lists with mixed matched/unmatched/skipped states, call execute logic, assert created playlist contains only matched && !skipped tracks
    - **Property 7: Execute only includes matched, non-skipped tracks**
    - **Validates: Requirements 9.4**
  - [x] 16.8 Write property test for Property 8: Same source/target appends " (Copy)" to playlist name
    - Generate arbitrary playlist names, assert name + " (Copy)" when source === target
    - **Property 8: Same source/target appends " (Copy)" to playlist name**
    - **Validates: Requirements 5.7, 9.5**
  - [x] 16.9 Write property test for Property 9: OAuth tokens are stored encrypted
    - Generate arbitrary token strings, store via adapter, read raw DB value, assert raw value !== plaintext
    - **Property 9: OAuth tokens are stored encrypted**
    - **Validates: Requirements 6.4**
  - [x] 16.10 Write property test for Property 10: Revoking an OAuth connection removes it
    - Store a connection, revoke it, assert targets response shows `connected: false`
    - **Property 10: Revoking an OAuth connection removes it**
    - **Validates: Requirements 6.6**
  - [x] 16.11 Write property test for Property 11: Import history is user-isolated
    - Create jobs for two distinct users, assert each user's history contains only their own jobs
    - **Property 11: Import history is user-isolated**
    - **Validates: Requirements 10.3**
  - [x] 16.12 Write property test for Property 12: Import history records contain all required fields
    - Generate arbitrary completed jobs, assert all required fields are present and non-null
    - **Property 12: Import history records contain all required fields**
    - **Validates: Requirements 10.1, 10.2**
  - [x] 16.13 Write property test for Property 14: Unmatched filter returns only unmatched entries
    - Generate arbitrary match result lists, apply unmatched filter, assert result contains only entries where matched === false && skipped === false
    - **Property 14: Unmatched filter returns only unmatched entries**
    - **Validates: Requirements 8.4**

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The Spotify adapter reuses existing `users` table token columns for backward compatibility; all other external services use `oauth_connections`
- External service target adapters (Deezer, YouTube, Apple, Amazon, Tidal, Qobuz, ListenBrainz) are scaffolded as source-only initially; target adapter methods can be added per-service without restructuring
