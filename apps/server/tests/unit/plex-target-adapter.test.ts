/**
 * Unit Tests for PlexTargetAdapter
 *
 * Tests:
 * - matchTracks delegates to matchPlaylist with correct arguments
 * - " (Copy)" suffix logic when source and target are the same
 */

import { plexTargetAdapter } from '../../src/adapters/plex-target';
import * as matchingModule from '../../src/services/matching';
import { PlexClient } from '../../src/services/plex';
import { TrackInfo, MatchResult, TargetConfig } from '../../src/adapters/types';

jest.mock('../../src/services/matching');
jest.mock('../../src/services/plex');

const mockMatchPlaylist = matchingModule.matchPlaylist as jest.MockedFunction<typeof matchingModule.matchPlaylist>;
const MockPlexClient = PlexClient as jest.MockedClass<typeof PlexClient>;

const mockDb = {
  getUserServer: jest.fn().mockReturnValue({ server_url: 'http://plex:32400' }),
  getUserById: jest.fn().mockReturnValue({ plex_token: 'test-token' }),
  getMatchingSettings: jest.fn().mockReturnValue(null),
};

const targetConfig: TargetConfig = {
  serverUrl: 'http://plex:32400',
  plexToken: 'test-token',
  libraryId: '1',
};

const sampleTracks: TrackInfo[] = [
  { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' },
  { title: 'Hotel California', artist: 'Eagles', album: 'Hotel California' },
];

const matchedResults: matchingModule.MatchedTrack[] = [
  {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    matched: true,
    plexRatingKey: '101',
    plexTitle: 'Bohemian Rhapsody',
    plexArtist: 'Queen',
    score: 100,
  },
  {
    title: 'Hotel California',
    artist: 'Eagles',
    album: 'Hotel California',
    matched: false,
    score: 0,
  },
];

describe('PlexTargetAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('meta', () => {
    it('has correct metadata', () => {
      expect(plexTargetAdapter.meta.id).toBe('plex');
      expect(plexTargetAdapter.meta.isSourceOnly).toBe(false);
      expect(plexTargetAdapter.meta.requiresOAuth).toBe(false);
    });
  });

  describe('matchTracks', () => {
    it('delegates to matchPlaylist with correct serverUrl, token, and libraryId', async () => {
      mockMatchPlaylist.mockResolvedValue(matchedResults);

      await plexTargetAdapter.matchTracks(sampleTracks, targetConfig, 1, mockDb);

      expect(mockMatchPlaylist).toHaveBeenCalledTimes(1);
      const [tracks, serverUrl, plexToken, libraryId] = mockMatchPlaylist.mock.calls[0];
      expect(serverUrl).toBe(targetConfig.serverUrl);
      expect(plexToken).toBe(targetConfig.plexToken);
      expect(libraryId).toBe(targetConfig.libraryId);
      expect(tracks).toHaveLength(sampleTracks.length);
      expect(tracks[0].title).toBe('Bohemian Rhapsody');
    });

    it('maps MatchedTrack results to MatchResult shape', async () => {
      mockMatchPlaylist.mockResolvedValue(matchedResults);

      const results = await plexTargetAdapter.matchTracks(sampleTracks, targetConfig, 1, mockDb);

      expect(results).toHaveLength(2);
      expect(results[0].matched).toBe(true);
      expect(results[0].targetTrackId).toBe('101');
      expect(results[0].confidence).toBe(100);
      expect(results[0].skipped).toBe(false);
      expect(results[1].matched).toBe(false);
    });

    it('passes progressEmitter and isCancelled to matchPlaylist', async () => {
      mockMatchPlaylist.mockResolvedValue(matchedResults);
      const emitter = { emit: jest.fn() } as any;
      const isCancelled = jest.fn().mockReturnValue(false);

      await plexTargetAdapter.matchTracks(sampleTracks, targetConfig, 1, mockDb, emitter, isCancelled);

      const call = mockMatchPlaylist.mock.calls[0];
      expect(call[5]).toBe(emitter);
      expect(call[8]).toBe(isCancelled);
    });

    it('throws when serverUrl is missing', async () => {
      await expect(
        plexTargetAdapter.matchTracks(sampleTracks, { libraryId: '1' }, 1, mockDb)
      ).rejects.toThrow('Plex target requires serverUrl and plexToken');
    });
  });

  describe('createPlaylist — " (Copy)" suffix', () => {
    const matchResultsForCreate: MatchResult[] = [
      {
        sourceTrack: { title: 'Bohemian Rhapsody', artist: 'Queen' },
        targetTrackId: '101',
        targetTitle: 'Bohemian Rhapsody',
        targetArtist: 'Queen',
        confidence: 100,
        matched: true,
        skipped: false,
      },
    ];

    beforeEach(() => {
      MockPlexClient.prototype.getMachineIdentifier = jest.fn().mockResolvedValue('machine-abc');
      MockPlexClient.prototype.buildLibraryUri = jest.fn().mockReturnValue('server://machine-abc/com.plexapp.plugins.library/library/sections/1');
      MockPlexClient.prototype.buildTrackUri = jest.fn().mockReturnValue('server://machine-abc/com.plexapp.plugins.library/library/metadata/101');
      MockPlexClient.prototype.createPlaylist = jest.fn().mockResolvedValue({
        ratingKey: '999',
        title: 'My Playlist (Copy)',
        leafCount: 1,
      });
    });

    it('appends " (Copy)" when isSameSourceAndTarget is true', async () => {
      const configWithSameTarget = { ...targetConfig, isSameSourceAndTarget: true } as any;

      const result = await plexTargetAdapter.createPlaylist(
        'My Playlist',
        matchResultsForCreate,
        configWithSameTarget,
        1,
        mockDb
      );

      const createCall = MockPlexClient.prototype.createPlaylist as jest.Mock;
      expect(createCall.mock.calls[0][0]).toBe('My Playlist (Copy)');
      expect(result.playlistId).toBe('999');
    });

    it('does NOT append " (Copy)" when isSameSourceAndTarget is false', async () => {
      MockPlexClient.prototype.createPlaylist = jest.fn().mockResolvedValue({
        ratingKey: '998',
        title: 'My Playlist',
        leafCount: 1,
      });

      await plexTargetAdapter.createPlaylist(
        'My Playlist',
        matchResultsForCreate,
        targetConfig,
        1,
        mockDb
      );

      const createCall = MockPlexClient.prototype.createPlaylist as jest.Mock;
      expect(createCall.mock.calls[0][0]).toBe('My Playlist');
    });

    it('only includes matched and non-skipped tracks', async () => {
      const mixed: MatchResult[] = [
        { sourceTrack: { title: 'A', artist: 'X' }, targetTrackId: '1', confidence: 90, matched: true, skipped: false },
        { sourceTrack: { title: 'B', artist: 'Y' }, targetTrackId: '2', confidence: 80, matched: true, skipped: true },
        { sourceTrack: { title: 'C', artist: 'Z' }, confidence: 0, matched: false, skipped: false },
      ];

      MockPlexClient.prototype.createPlaylist = jest.fn().mockResolvedValue({
        ratingKey: '997',
        title: 'Test',
        leafCount: 1,
      });

      const result = await plexTargetAdapter.createPlaylist('Test', mixed, targetConfig, 1, mockDb);

      // Only track A should be included (matched=true, skipped=false)
      const buildTrackUri = MockPlexClient.prototype.buildTrackUri as jest.Mock;
      expect(buildTrackUri).toHaveBeenCalledTimes(1);
      expect(buildTrackUri.mock.calls[0][0]).toBe('1');
      expect(result.trackCount).toBe(1);
    });
  });
});
