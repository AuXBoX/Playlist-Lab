/**
 * Plex Target Adapter
 *
 * Implements TargetAdapter for Plex Media Server.
 * Delegates track matching to the existing matchPlaylist service and
 * creates playlists via the PlexClient.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { PlexClient } from '../services/plex';
import { matchPlaylist, MatchedTrack } from '../services/matching';
import { logger } from '../utils/logger';

/** Default matching settings used when none are stored for the user */
const DEFAULT_MATCHING_SETTINGS = {
  minMatchScore: 60,
  stripParentheses: false,
  stripBrackets: false,
  useFirstArtistOnly: false,
  ignoreFeaturedArtists: false,
  ignoreRemixInfo: false,
  ignoreVersionInfo: false,
  preferNonCompilation: false,
  penalizeMonoVersions: false,
  penalizeLiveVersions: false,
  preferHigherRated: false,
  minRatingForMatch: 0,
  autoCompleteOnPerfectMatch: false,
  playlistPrefixes: {
    enabled: false,
    spotify: '',
    deezer: '',
    apple: '',
    tidal: '',
    youtube: '',
    amazon: '',
    qobuz: '',
    listenbrainz: '',
    file: '',
    ai: '',
  },
  customStripPatterns: [],
  featuredArtistPatterns: [],
  versionSuffixPatterns: [],
  remasterPatterns: [],
  variousArtistsNames: [],
  penaltyKeywords: [],
  priorityKeywords: [],
};

/** Convert a MatchedTrack (from matching.ts) to the adapter's MatchResult shape */
function toMatchResult(matched: MatchedTrack): MatchResult {
  return {
    sourceTrack: {
      title: matched.title,
      artist: matched.artist,
      album: matched.album,
    },
    targetTrackId: matched.plexRatingKey,
    targetTitle: matched.plexTitle,
    targetArtist: matched.plexArtist,
    targetAlbum: matched.plexAlbum,
    confidence: matched.score ?? (matched.matched ? 80 : 0),
    matched: matched.matched,
    skipped: false,
  };
}

export const plexTargetAdapter: TargetAdapter = {
  meta: {
    id: 'plex',
    name: 'Plex',
    icon: 'plex',
    isSourceOnly: false,
    requiresOAuth: false,
  } satisfies ServiceMeta,

  /**
   * Search the Plex library catalog for a track by query string.
   * Returns up to 10 results as MatchResult entries.
   */
  async searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]> {
    const userServer = db.getUserServer(userId);
    if (!userServer) throw new Error('No Plex server configured for this user');

    const user = db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const client = new PlexClient(userServer.server_url, user.plex_token);
    const results = await client.searchTrack(query);

    return results.slice(0, 10).map(track => ({
      sourceTrack: { title: query, artist: '' },
      targetTrackId: track.ratingKey,
      targetTitle: track.title,
      targetArtist: track.grandparentTitle ?? '',
      targetAlbum: track.parentTitle ?? undefined,
      confidence: 100,
      matched: true,
      skipped: false,
    }));
  },

  /**
   * Match source tracks against the Plex library using the existing matchPlaylist service.
   * Emits 'progress' events on progressEmitter after each batch.
   */
  async matchTracks(
    tracks: TrackInfo[],
    targetConfig: TargetConfig,
    userId: number,
    db: any,
    progressEmitter?: NodeJS.EventEmitter,
    isCancelled?: () => boolean
  ): Promise<MatchResult[]> {
    const serverUrl = targetConfig.serverUrl;
    const plexToken = targetConfig.plexToken;
    const libraryId = targetConfig.libraryId;

    if (!serverUrl || !plexToken) {
      throw new Error('Plex target requires serverUrl and plexToken in targetConfig');
    }

    // Retrieve user matching settings if available
    let settings = DEFAULT_MATCHING_SETTINGS;
    try {
      const userSettings = db.getMatchingSettings?.(userId);
      if (userSettings) settings = userSettings;
    } catch {
      // fall back to defaults
    }

    // matchPlaylist expects ExternalTrack shape (title, artist, album)
    const externalTracks = tracks.map(t => ({
      title: t.title,
      artist: t.artist,
      album: t.album ?? '',
    }));

    logger.info('[PlexTargetAdapter] Starting matchTracks', {
      trackCount: tracks.length,
      serverUrl,
      libraryId,
    });

    const matched = await matchPlaylist(
      externalTracks,
      serverUrl,
      plexToken,
      libraryId,
      settings,
      progressEmitter,
      undefined,
      undefined,
      isCancelled
    );

    return matched.map(toMatchResult);
  },

  /**
   * Create a playlist on the Plex server with the matched tracks.
   * Appends " (Copy)" to the name when source and target are the same server/library.
   */
  async createPlaylist(
    name: string,
    matchResults: MatchResult[],
    targetConfig: TargetConfig,
    _userId: number,
    _db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }> {
    const serverUrl = targetConfig.serverUrl;
    const plexToken = targetConfig.plexToken;
    const libraryId = targetConfig.libraryId;

    if (!serverUrl || !plexToken) {
      throw new Error('Plex target requires serverUrl and plexToken in targetConfig');
    }

    const client = new PlexClient(serverUrl, plexToken);

    // Determine if source and target are the same server+library (Copy suffix)
    const isSameTarget = (targetConfig as any).isSameSourceAndTarget === true;
    const finalName = isSameTarget ? `${name} (Copy)` : name;

    // Only include matched, non-skipped tracks
    const tracksToAdd = matchResults.filter(r => r.matched && !r.skipped && r.targetTrackId);

    if (tracksToAdd.length === 0) {
      throw new Error('No matched tracks to create playlist with');
    }

    logger.info('[PlexTargetAdapter] Creating playlist', {
      name: finalName,
      trackCount: tracksToAdd.length,
      serverUrl,
      libraryId,
    });

    const machineId = await client.getMachineIdentifier();
    const libraryUri = client.buildLibraryUri(libraryId ?? '1', machineId);
    const trackUris = tracksToAdd.map(r => client.buildTrackUri(r.targetTrackId!, machineId));

    const playlist = await client.createPlaylist(finalName, libraryUri, trackUris);

    return {
      playlistId: playlist.ratingKey,
      name: playlist.title,
      trackCount: tracksToAdd.length,
    };
  },
};
