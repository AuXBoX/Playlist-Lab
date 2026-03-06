export interface TrackInfo {
  title: string;
  artist: string;
  album?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  trackCount: number;
  durationMs?: number;
  coverUrl?: string;
}

export interface MatchResult {
  sourceTrack: TrackInfo;
  targetTrackId?: string;
  targetTitle?: string;
  targetArtist?: string;
  targetAlbum?: string;
  confidence: number; // 0–100
  matched: boolean;
  skipped: boolean;
}

export interface ServiceMeta {
  id: string;
  name: string;
  icon: string;
  isSourceOnly: boolean;
  requiresOAuth: boolean;
}

export interface TargetConfig {
  serverUrl?: string;
  libraryId?: string;
  plexToken?: string;
  accessToken?: string;
}

export interface SourceAdapter {
  meta: ServiceMeta;
  listPlaylists?(userId: number, db: any): Promise<PlaylistInfo[]>;
  searchPlaylists?(query: string, userId: number, db: any): Promise<PlaylistInfo[]>;
  fetchTracks(
    playlistUrlOrId: string,
    userId: number,
    db: any
  ): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }>;
}

export interface TargetAdapter {
  meta: ServiceMeta;
  searchCatalog(query: string, userId: number, db: any): Promise<MatchResult[]>;
  matchTracks(
    tracks: TrackInfo[],
    targetConfig: TargetConfig,
    userId: number,
    db: any,
    progressEmitter?: NodeJS.EventEmitter,
    isCancelled?: () => boolean
  ): Promise<MatchResult[]>;
  createPlaylist(
    name: string,
    matchResults: MatchResult[],
    targetConfig: TargetConfig,
    userId: number,
    db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }>;
  getOAuthUrl?(userId: number, db: any, redirectUri: string): Promise<string>;
  handleOAuthCallback?(
    code: string,
    userId: number,
    db: any,
    redirectUri: string
  ): Promise<void>;
  hasValidConnection?(userId: number, db: any): Promise<boolean>;
  revokeConnection?(userId: number, db: any): Promise<void>;
  /** Returns false if required server-side credentials (env vars) are missing */
  isConfigured?(): boolean;
}
