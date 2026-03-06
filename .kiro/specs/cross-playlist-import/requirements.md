# Requirements Document

## Introduction

Cross-Playlist Import is a universal playlist transfer tool. The user picks any supported service as a source, selects a playlist from that source, picks any write-capable service as a target, and the app transfers the playlist — matching tracks against the target's catalog, presenting a mandatory review screen, then creating the playlist on the target.

Any service can be a source or a target, with three exceptions: ARIA Charts, File/M3U, and AI Generated are source-only because they are read-only or generative by nature. All other services — Plex (any connected server or Plex Home user), Spotify, Deezer, YouTube Music, Apple Music, Amazon Music, Tidal, Qobuz, and ListenBrainz — can be either source or target when properly authenticated.

The architecture is explicitly extensible: new sources and new write-capable targets can be added by implementing a defined adapter interface without restructuring existing code.

## Glossary

- **Cross_Import_Page**: The dedicated top-level navigation page for this feature, with sub-page navigation similar to Manage Plex Playlists.
- **Source**: Any supported origin of a playlist — a streaming service, a file, AI generation, or a Plex server/user.
- **Target**: Any write-capable service where the imported playlist will be created.
- **Source_Adapter**: A pluggable module that knows how to fetch playlists and track lists from a specific source service.
- **Target_Adapter**: A pluggable module that knows how to search a target service's catalog and create playlists on that service.
- **Source_Only_Service**: A service that can only be a source, not a target: ARIA Charts, File/M3U, and AI Generated.
- **Symmetric_Service**: A service that can be either a source or a target: Plex, Spotify, Deezer, YouTube Music, Apple Music, Amazon Music, Tidal, Qobuz, ListenBrainz.
- **Plex_Source**: A connected Plex server or Plex Home managed user selected as the source.
- **Plex_Target**: A connected Plex server and music library selected as the destination.
- **External_Service**: Any non-Plex streaming service (Spotify, Deezer, YouTube Music, Apple Music, Amazon Music, Tidal, Qobuz, ListenBrainz).
- **OAuth_Connection**: A stored OAuth token granting the app write access to an External_Service on behalf of the Playlist_Lab_User.
- **Track_Matcher**: The existing matching service that maps track metadata (title, artist, album) to tracks in a Plex library.
- **Catalog_Search**: A Target_Adapter operation that searches an External_Service's catalog by title, artist, and album to find the best matching track.
- **Match_Review_Screen**: The mandatory step after auto-matching where the user inspects, overrides, or skips any track before confirming.
- **Import_Job**: A single cross-import operation, persisted with status, results, and unmatched track details.
- **Playlist_Lab_User**: An authenticated user of the Playlist Lab application.
- **Plex_Home_User**: A managed user profile within a Plex Home account, accessible via the admin token switch endpoint.
- **Match_Confidence**: A numeric score (0–100) indicating how closely a matched target track corresponds to the source track.

## Requirements

### Requirement 1: Dedicated Page and Sub-Page Navigation

**User Story:** As a Playlist Lab user, I want a dedicated Cross Import page with clear step-by-step navigation, so that the import flow is easy to follow and does not interfere with other features.

#### Acceptance Criteria

1. THE Cross_Import_Page SHALL be accessible from the main application navigation as a top-level page.
2. THE Cross_Import_Page SHALL present the import flow as sequential sub-pages: Source Selection → Playlist Selection → Target Selection → Target Authentication (if needed) → Matching Progress → Match Review → Confirmation.
3. WHEN the user is on any sub-page other than Source Selection, THE Cross_Import_Page SHALL provide a way to navigate back to the previous step.
4. WHEN the user navigates back to a previous step, THE Cross_Import_Page SHALL preserve previously entered values where possible.
5. THE Cross_Import_Page SHALL display the current step number and total step count so the user knows their progress through the flow.

### Requirement 2: Source Selection

**User Story:** As a Playlist Lab user, I want to choose from all supported import sources including Plex servers and streaming services, so that I can bring in playlists from wherever my music lives.

#### Acceptance Criteria

1. THE Cross_Import_Page SHALL present all Symmetric_Services as selectable sources: Plex, Spotify, Deezer, YouTube Music, Apple Music, Amazon Music, Tidal, Qobuz, and ListenBrainz.
2. THE Cross_Import_Page SHALL present all Source_Only_Services as selectable sources: ARIA Charts, File/M3U, and AI Generated.
3. THE Cross_Import_Page SHALL present all connected Plex servers as individually selectable Plex_Sources.
4. WHEN the authenticated Playlist_Lab_User has Plex Home enabled on a connected server, THE Cross_Import_Page SHALL also list each Plex_Home_User on that server as a selectable Plex_Source.
5. THE Cross_Import_Page SHALL indicate the connection status of each Symmetric_Service (connected, not connected) so the user knows which services are ready to use.
6. THE Cross_Import_Page SHALL be designed so that new Source_Adapters can be registered without modifying existing source handling logic.
7. IF the Plex API returns an error when fetching available Plex_Sources, THEN THE Cross_Import_Page SHALL display a descriptive error and allow the user to retry.

### Requirement 3: Playlist Selection for External Sources

**User Story:** As a Playlist Lab user, I want to provide a URL or other input for external sources, so that I can specify exactly which playlist to import.

#### Acceptance Criteria

1. WHEN an External_Service is selected as source, THE Cross_Import_Page SHALL present the appropriate input method for that service: URL input for streaming services, username input for ListenBrainz, file upload for File/M3U, and prompt with track count for AI Generated.
2. WHEN the user submits a valid input for an External_Service source, THE Cross_Import_Page SHALL fetch the playlist metadata (name, track count, cover art where available) and display it for confirmation before proceeding.
3. IF the provided input is invalid or the playlist cannot be fetched, THEN THE Cross_Import_Page SHALL display a descriptive error message and allow the user to correct the input.
4. WHERE an External_Service supports browsing connected playlists (e.g., a connected Spotify account), THE Cross_Import_Page SHALL display a browsable list of playlists the user can select directly in addition to URL input.

### Requirement 4: Playlist Selection for Plex Sources

**User Story:** As a Playlist Lab user, I want to browse and select a playlist from a connected Plex server or Plex Home user, so that I can copy playlists between Plex contexts or to another service.

#### Acceptance Criteria

1. WHEN a Plex_Source is selected, THE Cross_Import_Page SHALL fetch all audio playlists from that source using the Plex `/playlists?playlistType=audio` endpoint.
2. THE Cross_Import_Page SHALL display each Plex playlist with its name, track count, and total duration.
3. WHEN a Plex_Home_User is selected as the Plex_Source, THE Cross_Import_Page SHALL obtain that user's token via the Plex Home switch-user endpoint before fetching playlists.
4. IF the Plex API returns an error when fetching playlists from a Plex_Source, THEN THE Cross_Import_Page SHALL display a descriptive error identifying the source that failed.

### Requirement 5: Target Selection

**User Story:** As a Playlist Lab user, I want to choose which service to import the playlist into, so that the new playlist ends up in the right place.

#### Acceptance Criteria

1. THE Cross_Import_Page SHALL present all Symmetric_Services as selectable targets: Plex, Spotify, Deezer, YouTube Music, Apple Music, Amazon Music, Tidal, Qobuz, and ListenBrainz.
2. THE Cross_Import_Page SHALL NOT present Source_Only_Services (ARIA Charts, File/M3U, AI Generated) as selectable targets.
3. THE Cross_Import_Page SHALL indicate the connection/authentication status of each target service so the user knows which require OAuth before proceeding.
4. WHEN a Plex_Target is selected, THE Cross_Import_Page SHALL list the available music libraries on that server for the user to choose from.
5. THE Cross_Import_Page SHALL default the target to the Playlist_Lab_User's currently configured Plex server and library when one is set.
6. THE Cross_Import_Page SHALL be designed so that new Target_Adapters can be registered without modifying existing target handling logic.
7. IF the source and target resolve to the same Plex server and library, THEN THE Cross_Import_Page SHALL allow the import but SHALL append " (Copy)" to the new playlist name to avoid duplicate names.

### Requirement 6: OAuth and Write Access Management

**User Story:** As a Playlist Lab user, I want the app to handle OAuth authentication for each target service, so that I can grant write access once and then use that service as a target without re-authenticating every time.

#### Acceptance Criteria

1. WHEN the user selects a target External_Service that does not have an active OAuth_Connection, THE Cross_Import_Page SHALL present an OAuth authentication step before proceeding to matching.
2. THE OAuth authentication step SHALL open the target service's OAuth authorization page and handle the callback to store the resulting token as an OAuth_Connection for the Playlist_Lab_User.
3. WHEN an OAuth_Connection is successfully established, THE Cross_Import_Page SHALL automatically advance to the matching step without requiring the user to re-select the target.
4. THE Cross_Import_Page SHALL store OAuth_Connections securely, encrypted at rest, associated with the Playlist_Lab_User.
5. WHEN an OAuth_Connection token is expired or revoked, THE Cross_Import_Page SHALL detect the failure and prompt the user to re-authenticate rather than displaying a generic error.
6. THE Cross_Import_Page SHALL provide a way for the Playlist_Lab_User to view and revoke stored OAuth_Connections for each External_Service from the application settings.
7. THE Cross_Import_Page SHALL be designed so that each External_Service's OAuth flow is implemented in its own Target_Adapter without coupling to other services' authentication logic.

### Requirement 7: Target-Specific Auto-Matching with Progress Tracking

**User Story:** As a Playlist Lab user, I want the app to automatically match source tracks against the target's catalog while showing me progress, so that I know the operation is running and can see how many tracks have been processed.

#### Acceptance Criteria

1. WHEN the user confirms the source playlist and target, THE Cross_Import_Page SHALL invoke the Target_Adapter for the selected target to run auto-matching for each source track.
2. WHEN the selected target is a Plex_Target, THE Cross_Import_Page SHALL match tracks against the selected Plex library using the Track_Matcher.
3. WHEN the selected target is an External_Service target, THE Cross_Import_Page SHALL match tracks using that service's Catalog_Search, searching by track title, artist name, and album name.
4. THE Cross_Import_Page SHALL display a progress indicator showing the current step (fetching tracks, matching tracks) and the number of tracks processed out of the total.
5. THE Cross_Import_Page SHALL stream matching progress to the client via SSE so the user sees real-time updates without polling.
6. THE Cross_Import_Page SHALL complete auto-matching within 60 seconds for playlists of up to 500 tracks.
7. WHEN auto-matching completes, THE Cross_Import_Page SHALL automatically advance to the Match_Review_Screen.
8. IF the user cancels during the matching phase, THEN THE Cross_Import_Page SHALL stop processing and SHALL NOT advance to the Match_Review_Screen.

### Requirement 8: Match Review Screen

**User Story:** As a Playlist Lab user, I want to review all matched and unmatched tracks before the playlist is created, so that I can correct mistakes and ensure the playlist is accurate.

#### Acceptance Criteria

1. THE Match_Review_Screen SHALL display all tracks from the source playlist — both matched and unmatched — in a single list.
2. THE Match_Review_Screen SHALL show for each track: the source track title and artist, the matched target track title and artist (or an "unmatched" indicator), and the Match_Confidence score.
3. THE Match_Review_Screen SHALL visually distinguish matched tracks, unmatched tracks, and skipped tracks using distinct indicators.
4. THE Match_Review_Screen SHALL allow the user to filter the list to show only unmatched tracks.
5. THE Match_Review_Screen SHALL allow the user to manually search the selected target's catalog or library for any track and override the auto-matched result.
6. WHEN the user initiates a manual search for a track, THE Match_Review_Screen SHALL accept a text query, invoke the Target_Adapter's Catalog_Search for the selected target, and display the results for the user to choose from.
7. WHEN the user selects a replacement from manual search results, THE Match_Review_Screen SHALL update that track's match to the selected result and set its Match_Confidence to 100.
8. THE Match_Review_Screen SHALL allow the user to mark any individual track as skipped, excluding it from the final playlist.
9. WHEN a track is marked as skipped, THE Match_Review_Screen SHALL visually indicate its skipped state and allow the user to undo the skip.
10. THE Match_Review_Screen SHALL display a summary showing total track count, matched count, unmatched count, and skipped count.
11. THE Match_Review_Screen is a mandatory step — THE Cross_Import_Page SHALL NOT create the playlist without the user explicitly confirming on this screen.

### Requirement 9: Confirm and Create Playlist

**User Story:** As a Playlist Lab user, I want to confirm the reviewed track list and have the playlist created on my chosen target service, so that I can start listening.

#### Acceptance Criteria

1. WHEN the user confirms on the Match_Review_Screen, THE Cross_Import_Page SHALL invoke the Target_Adapter for the selected target to create the playlist.
2. WHEN the selected target is a Plex_Target, THE Cross_Import_Page SHALL create the playlist using the Plex `POST /playlists` endpoint on the selected server and library.
3. WHEN the selected target is an External_Service target, THE Cross_Import_Page SHALL create the playlist using that service's playlist creation API via the stored OAuth_Connection.
4. THE Cross_Import_Page SHALL include only tracks that are matched and not skipped in the created playlist.
5. THE Cross_Import_Page SHALL use the source playlist's name as the new playlist name, appending " (Copy)" if the source and target resolve to the same Plex server and library.
6. IF playlist creation fails on the target service, THEN THE Cross_Import_Page SHALL display a descriptive error and SHALL NOT leave a partial playlist on the target.
7. WHEN the playlist is successfully created, THE Cross_Import_Page SHALL display a success message with the new playlist's name and a count of tracks added.

### Requirement 10: Import History

**User Story:** As a Playlist Lab user, I want to see a record of my past cross-imports, so that I can track what was imported and review match results.

#### Acceptance Criteria

1. THE Cross_Import_Page SHALL persist each completed Import_Job with: source service name, source playlist name, target service name, target playlist name, matched count, unmatched count, skipped count, total count, and timestamp.
2. THE Cross_Import_Page SHALL persist the list of unmatched track titles and artists for each Import_Job so the user can review what did not transfer.
3. WHEN a Playlist_Lab_User requests their import history, THE Cross_Import_Page SHALL return only Import_Jobs belonging to that user.
4. THE Cross_Import_Page SHALL retain Import_Job records for a minimum of 30 days.
5. THE Cross_Import_Page SHALL display import history as a list on a dedicated sub-page of the Cross_Import_Page, showing each Import_Job's source, target, playlist name, match stats, and timestamp.

### Requirement 11: API Endpoints

**User Story:** As a developer, I want well-defined API endpoints for the cross-import feature, so that web, mobile, and desktop clients can integrate consistently.

#### Acceptance Criteria

1. THE API SHALL expose a `GET /api/cross-import/sources` endpoint that returns all available sources (Plex servers, Plex Home users, and connected External_Services) with their connection status for the authenticated Playlist_Lab_User.
2. THE API SHALL expose a `GET /api/cross-import/targets` endpoint that returns all write-capable targets (Plex servers, and all Symmetric_Services) with their OAuth_Connection status for the authenticated Playlist_Lab_User.
3. THE API SHALL expose a `GET /api/cross-import/sources/:sourceId/playlists` endpoint that returns audio playlists from a specific Plex_Source.
4. THE API SHALL expose a `POST /api/cross-import/match` endpoint that accepts a source playlist identifier and a target identifier, runs target-specific auto-matching, and streams results via SSE progress events.
5. THE API SHALL expose a `POST /api/cross-import/search` endpoint that accepts a text query and a target identifier and returns matching tracks from that target's catalog or library.
6. THE API SHALL expose a `POST /api/cross-import/execute` endpoint that accepts the reviewed track list and target identifier, creates the playlist on the target service, and returns the new playlist's identifier and name.
7. THE API SHALL expose a `GET /api/cross-import/history` endpoint that returns the authenticated user's Import_Job history in reverse chronological order.
8. THE API SHALL expose `GET /api/cross-import/oauth/:service` and `GET /api/cross-import/oauth/:service/callback` endpoints to initiate and complete the OAuth flow for each External_Service target.
9. THE API SHALL expose a `DELETE /api/cross-import/oauth/:service` endpoint that revokes and removes the stored OAuth_Connection for a given service for the authenticated Playlist_Lab_User.
10. IF an unauthenticated request is made to any cross-import endpoint, THEN THE API SHALL return HTTP 401.

### Requirement 12: Extensible Adapter Architecture

**User Story:** As a developer, I want the cross-import system to be built on a pluggable adapter interface, so that new source and target services can be added without restructuring existing code.

#### Acceptance Criteria

1. THE Cross_Import_Page SHALL define a Source_Adapter interface with operations: fetch playlist list (where supported), fetch track list from a playlist, and return service metadata (name, icon, capabilities).
2. THE Cross_Import_Page SHALL define a Target_Adapter interface with operations: search catalog by query, create playlist with a given track list, and return service metadata (name, icon, OAuth requirements).
3. WHEN a new service is added as a source, THE system SHALL require only the implementation of a new Source_Adapter without changes to routing, matching, or review logic.
4. WHEN a new service is added as a target, THE system SHALL require only the implementation of a new Target_Adapter and its OAuth flow without changes to routing, review, or history logic.
5. THE system SHALL register all Source_Adapters and Target_Adapters in a central registry so that the sources and targets endpoints reflect all registered adapters automatically.
