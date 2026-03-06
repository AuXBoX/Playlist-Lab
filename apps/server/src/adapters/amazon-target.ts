/**
 * Amazon Music Target Adapter
 *
 * Amazon Music does not provide a public API for playlist creation.
 * This adapter is a stub that informs users of this limitation.
 *
 * If Amazon ever opens their API, this can be implemented using
 * Login with Amazon (LWA) OAuth and the Amazon Music API.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';

export const amazonTargetAdapter: TargetAdapter = {
  meta: {
    id: 'amazon',
    name: 'Amazon Music',
    icon: 'amazon',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return false; // Amazon Music has no public write API
  },

  async searchCatalog(_query: string, _userId: number, _db: any): Promise<MatchResult[]> {
    throw new Error('Amazon Music does not provide a public API for playlist creation. You can import FROM Amazon Music but not TO it.');
  },

  async matchTracks(
    _tracks: TrackInfo[],
    _targetConfig: TargetConfig,
    _userId: number,
    _db: any,
    _progressEmitter?: NodeJS.EventEmitter,
    _isCancelled?: () => boolean
  ): Promise<MatchResult[]> {
    throw new Error('Amazon Music does not provide a public API for playlist creation.');
  },

  async createPlaylist(
    _name: string,
    _matchResults: MatchResult[],
    _targetConfig: TargetConfig,
    _userId: number,
    _db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }> {
    throw new Error('Amazon Music does not provide a public API for playlist creation.');
  },

  async getOAuthUrl(_userId: number, _db: any, _redirectUri: string): Promise<string> {
    throw new Error('Amazon Music does not support importing playlists via this app. Amazon Music has no public write API.');
  },

  async handleOAuthCallback(_code: string, _userId: number, _db: any, _redirectUri: string): Promise<void> {
    throw new Error('Amazon Music does not support OAuth for playlist creation.');
  },

  async hasValidConnection(_userId: number, _db: any): Promise<boolean> {
    return false;
  },

  async revokeConnection(_userId: number, _db: any): Promise<void> {
    // nothing to revoke
  },
};
