/**
 * Plex API Client
 * 
 * Provides methods for interacting with Plex Media Server API.
 * Handles track searching, library management, playlist operations,
 * and play history retrieval.
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

/**
 * Plex library section
 */
export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  createdAt: number;
  scannedAt: number;
  content: boolean;
  directory: boolean;
  contentChangedAt: number;
  hidden: number;
}

/**
 * Plex track metadata
 */
export interface PlexTrack {
  ratingKey: string;
  key: string;
  parentRatingKey: string;
  grandparentRatingKey: string;
  guid: string;
  parentGuid: string;
  grandparentGuid: string;
  type: string;
  title: string;
  grandparentKey: string;
  parentKey: string;
  grandparentTitle: string;
  parentTitle: string;
  summary: string;
  index: number;
  parentIndex: number;
  ratingCount: number;
  thumb: string;
  art: string;
  parentThumb: string;
  grandparentThumb: string;
  grandparentArt: string;
  duration: number;
  addedAt: number;
  updatedAt: number;
  year?: number;
  viewCount?: number;
  lastViewedAt?: number;
  userRating?: number;
  Genre?: Array<{ tag: string }>;
  playlistItemID?: number; // Present when track is part of a playlist
  librarySectionID?: number;
  librarySectionTitle?: string;
  librarySectionKey?: string;
  Media?: Array<{
    id: number;
    duration: number;
    bitrate: number;
    audioChannels: number;
    audioCodec: string;
    container: string;
    Part: Array<{
      id: number;
      key: string;
      duration: number;
      file: string;
      size: number;
      container: string;
    }>;
  }>;
}

/**
 * Plex playlist
 */
export interface PlexPlaylist {
  ratingKey: string;
  key: string;
  guid: string;
  type: string;
  title: string;
  summary: string;
  smart: boolean;
  playlistType: string;
  composite: string;
  duration: number;
  leafCount: number;
  addedAt: number;
  updatedAt: number;
}

/**
 * Plex play history item
 */
export interface PlexHistoryItem {
  historyKey: string;
  key: string;
  ratingKey: string;
  title: string;
  type: string;
  thumb: string;
  parentThumb: string;
  grandparentThumb: string;
  grandparentTitle: string;
  parentTitle: string;
  index: number;
  parentIndex: number;
  viewedAt: number;
  accountID: number;
  deviceID: number;
}

/**
 * Plex API response container
 */
interface PlexMediaContainer<T = any> {
  MediaContainer: {
    size: number;
    totalSize?: number;
    offset?: number;
    allowSync?: boolean;
    identifier?: string;
    mediaTagPrefix?: string;
    [key: string]: any;
  } & T;
}

export class PlexClient {
  private serverUrl: string;
  private token: string;
  private client: AxiosInstance;
  private clientId: string;
  private productName: string;
  private searchCache: Map<string, { results: PlexTrack[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    serverUrl: string,
    token: string,
    clientId: string = 'playlist-lab-server',
    productName: string = 'Playlist Lab'
  ) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
    this.clientId = clientId;
    this.productName = productName;

    this.client = axios.create({
      baseURL: this.serverUrl,
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': this.token,
        'X-Plex-Product': this.productName,
        'X-Plex-Client-Identifier': this.clientId,
        'X-Plex-Platform': 'Node.js',
        'X-Plex-Container-Size': '50' // Default page size, prevents future 400 errors
      },
      timeout: 30000 // 30 second timeout
    });

    // Interceptor: log outgoing URL and prevent axios from re-encoding server:// URIs
    this.client.interceptors.request.use((config) => {
      // Build the full URL for logging
      const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
      if (fullUrl.includes('playlist')) {
        logger.info('Plex outgoing request', { method: config.method, url: fullUrl });
      }
      return config;
    });
  }

  /**
   * Search for a track in the Plex library
   * Returns matching tracks sorted by relevance
   */
  async searchTrack(query: string, libraryId?: string, artist?: string, title?: string): Promise<PlexTrack[]> {
      try {
        const cacheKey = `${query}|${libraryId || 'all'}|${artist || ''}|${title || ''}`;

        // Check cache first
        const cached = this.searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          logger.info(`[Plex] Cache hit for: ${cacheKey}`);
          return cached.results;
        }

        let tracks: PlexTrack[] = [];

        if (libraryId && artist && title) {
          // Use separate artist and title filters for precise matching
          logger.info(`[Plex] Using filtered search: library=${libraryId}, artist="${artist}", title="${title}"`);
          const response = await this.client.get<PlexMediaContainer>(
            `/library/sections/${libraryId}/all`,
            { 
              params: { 
                type: 10,
                'artist.title': artist,
                'track.title': title
              } 
            }
          );
          tracks = response.data.MediaContainer.Metadata || [];
          logger.info(`[Plex] Filtered search returned ${tracks.length} tracks`);
        } else if (libraryId && title) {
          // Search by title only
          logger.info(`[Plex] Using title-only search: library=${libraryId}, title="${title}"`);
          const response = await this.client.get<PlexMediaContainer>(
            `/library/sections/${libraryId}/all`,
            { params: { type: 10, 'track.title': title } }
          );
          tracks = response.data.MediaContainer.Metadata || [];
          logger.info(`[Plex] Title-only search returned ${tracks.length} tracks`);
        } else {
          // Fall back to hub search for combined query
          logger.info(`[Plex] Using hub search: query="${query}", library=${libraryId || 'all'}`);
          const response = await this.client.get<PlexMediaContainer>('/hubs/search', {
            params: { query: query, limit: 50 }
          });
          const hubs = response.data.MediaContainer.Hub || [];
          const trackHub = hubs.find((hub: any) => hub.type === 'track');
          let allTracks = trackHub?.Metadata || [];
          logger.info(`[Plex] Hub search returned ${allTracks.length} tracks before filtering`);
          
          // Filter by library if specified
          if (libraryId && allTracks.length > 0) {
            // Convert libraryId to number for comparison (Plex returns numbers, we receive strings)
            const libraryIdNum = parseInt(libraryId, 10);
            tracks = allTracks.filter((track: PlexTrack) => track.librarySectionID === libraryIdNum);
            logger.info(`[Plex] After library filter (${libraryId}): ${tracks.length} tracks`);
          } else {
            tracks = allTracks;
          }
          
          // ALWAYS try direct track search too (not just when hub search is empty)
          // This helps when track name = album name (Plex hub search shows albums instead of tracks)
          if (libraryId) {
            logger.info(`[Plex] Also trying direct track search in library ${libraryId} to find album tracks`);
            try {
              // Try searching with the full query first
              let directResponse = await this.client.get<PlexMediaContainer>(
                `/library/sections/${libraryId}/all`,
                { 
                  params: { 
                    type: 10,
                    'track.title': query
                  } 
                }
              );
              const directTracks = directResponse.data.MediaContainer.Metadata || [];
              logger.info(`[Plex] Direct track search (full query) returned ${directTracks.length} tracks`);
              
              // Merge with hub search results (avoid duplicates)
              for (const track of directTracks) {
                if (!tracks.some((t: PlexTrack) => t.ratingKey === track.ratingKey)) {
                  tracks.push(track);
                }
              }
              logger.info(`[Plex] After merging: ${tracks.length} total tracks`);
              
              // If we got few results, try removing potential artist name from the query
              // Common patterns: "Artist - Title", "Artist Title"
              if (directTracks.length < 3) {
                const words = query.trim().split(/\s+/);
                
                // Try removing first word (potential artist name)
                if (words.length >= 3) {
                  const withoutFirstWord = words.slice(1).join(' ');
                  logger.info(`[Plex] Trying without first word: "${withoutFirstWord}"`);
                  directResponse = await this.client.get<PlexMediaContainer>(
                    `/library/sections/${libraryId}/all`,
                    { 
                      params: { 
                        type: 10,
                        'track.title': withoutFirstWord
                      } 
                    }
                  );
                  const moreDirectTracks = directResponse.data.MediaContainer.Metadata || [];
                  logger.info(`[Plex] Direct track search (without first word) returned ${moreDirectTracks.length} tracks`);
                  
                  // Merge results
                  for (const track of moreDirectTracks) {
                    if (!tracks.some((t: PlexTrack) => t.ratingKey === track.ratingKey)) {
                      tracks.push(track);
                    }
                  }
                  logger.info(`[Plex] After merging without first word: ${tracks.length} total tracks`);
                }
                
                // Try last 2-3 words (likely the core title)
                if (words.length >= 2) {
                  const lastTwoWords = words.slice(-2).join(' ');
                  logger.info(`[Plex] Trying with last 2 words: "${lastTwoWords}"`);
                  directResponse = await this.client.get<PlexMediaContainer>(
                    `/library/sections/${libraryId}/all`,
                    { 
                      params: { 
                        type: 10,
                        'track.title': lastTwoWords
                      } 
                    }
                  );
                  const lastWordTracks = directResponse.data.MediaContainer.Metadata || [];
                  logger.info(`[Plex] Direct track search (last 2 words) returned ${lastWordTracks.length} tracks`);
                  
                  // Merge results
                  for (const track of lastWordTracks) {
                    if (!tracks.some((t: PlexTrack) => t.ratingKey === track.ratingKey)) {
                      tracks.push(track);
                    }
                  }
                  logger.info(`[Plex] After merging last words: ${tracks.length} total tracks`);
                }
              }
            } catch (err) {
              logger.warn(`[Plex] Direct track search failed: ${err}`);
            }
          }
        }

        // Cache the results
        this.searchCache.set(cacheKey, { results: tracks, timestamp: Date.now() });

        // Clean up old cache entries
        if (this.searchCache.size > 1000) {
          const now = Date.now();
          for (const [key, value] of this.searchCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
              this.searchCache.delete(key);
            }
          }
        }

        return tracks;
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new Error('Plex server is unreachable');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid Plex token');
        }
        if (error.isAxiosError) {
          throw new Error(`Failed to search tracks: ${error.message}`);
        }
        throw error;
      }
    }




  /**
   * Clear the search cache
   * Useful when library content has been updated
   */
  clearSearchCache(): void {
    this.searchCache.clear();
  }

  /**
   * Search for albums in the Plex library
   */
  async searchAlbums(query: string, libraryId?: string): Promise<any[]> {
    try {
      const params: any = { query };
      const response = await this.client.get<PlexMediaContainer>('/hubs/search', { params });
      
      const hubs = response.data.MediaContainer.Hub || [];
      const albumHub = hubs.find((hub: any) => hub.type === 'album');
      let albums = albumHub?.Metadata || [];
      
      if (libraryId && albums.length > 0) {
        albums = albums.filter((album: any) => album.librarySectionID === libraryId);
      }
      
      return albums;
    } catch (error: any) {
      logger.error('Failed to search albums', { error });
      return [];
    }
  }

  /**
   * Get full metadata for a single track
   */
  async getTrackDetails(ratingKey: string): Promise<PlexTrack | null> {
    try {
      const response = await this.client.get<PlexMediaContainer>(`/library/metadata/${ratingKey}`);
      const metadata = response.data.MediaContainer.Metadata || [];
      return metadata[0] || null;
    } catch (error: any) {
      logger.error('Failed to get track details', { ratingKey, error: error.message });
      return null;
    }
  }

  /**
   * Get all tracks from an album
   */
  async getAlbumTracks(albumRatingKey: string): Promise<PlexTrack[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(`/library/metadata/${albumRatingKey}/children`);
      return response.data.MediaContainer.Metadata || [];
    } catch (error: any) {
      logger.error('Failed to get album tracks', { albumRatingKey, error });
      return [];
    }
  }

  /**
   * Get all music libraries from the server
   */
  async getLibraries(): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      logger.info('Fetching libraries from Plex', { serverUrl: this.serverUrl });
      
      const response = await this.client.get<PlexMediaContainer>('/library/sections');
      
      logger.info('Plex libraries response', { 
        hasDirectory: !!response.data.MediaContainer.Directory,
        directoryCount: response.data.MediaContainer.Directory?.length || 0
      });
      
      const sections = response.data.MediaContainer.Directory || [];
      
      // Map to simplified format with id, name, type
      const libraries = sections.map((section: any) => ({
        id: section.key,
        name: section.title,
        type: section.type
      }));
      
      logger.info('Mapped libraries', { 
        totalCount: libraries.length,
        libraries: libraries.map((l: any) => ({ id: l.id, name: l.name, type: l.type }))
      });
      
      return libraries;
    } catch (error: any) {
      logger.error('Failed to get libraries', { 
        error: error.message,
        code: error.code,
        status: error.response?.status
      });
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to get libraries: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Scan/refresh a library section
   * Triggers Plex to scan for new or changed files in the library
   */
  /**
     * Scan/refresh a library section
     * Triggers Plex to scan for new or changed files in the library
     * @param libraryId - The library section ID
     * @param path - Optional specific folder path to scan
     */
    async scanLibrary(libraryId: string, path?: string): Promise<void> {
      try {
        const url = path 
          ? `/library/sections/${libraryId}/refresh?path=${encodeURIComponent(path)}`
          : `/library/sections/${libraryId}/refresh`;

        logger.info('Triggering library scan', { 
          serverUrl: this.serverUrl, 
          libraryId,
          path: path || 'full library'
        });

        await this.client.get(url);

        logger.info('Library scan triggered successfully', { libraryId, path });
      } catch (error: any) {
        logger.error('Failed to scan library', { 
          error: error.message,
          code: error.code,
          status: error.response?.status,
          libraryId,
          path
        });

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new Error('Plex server is unreachable');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid Plex token');
        }
        if (error.response?.status === 404) {
          throw new Error('Library not found');
        }
        if (error.isAxiosError) {
          throw new Error(`Failed to scan library: ${error.message}`);
        }
        throw error;
      }
    }

    /**
     * Get library folder structure
     * Returns the folder paths configured for a library section
     */
    /**
       * Get library folder structure
       * Returns the folder paths configured for a library section
       */
      /**
         * Get library folder structure
         * Returns the root folder paths for a library section
         */
        async getLibraryFolders(libraryId: string): Promise<Array<{ path: string; accessible: boolean }>> {
            try {
              logger.info('Fetching library folders', { serverUrl: this.serverUrl, libraryId });

              // Get library section details which includes Location array
              const response = await this.client.get<PlexMediaContainer>(
                `/library/sections/${libraryId}`
              );

              logger.info('Library section response', { 
                hasMediaContainer: !!response.data.MediaContainer,
                hasDirectory: !!response.data.MediaContainer.Directory,
                directoryLength: response.data.MediaContainer.Directory?.length
              });

              const section = response.data.MediaContainer.Directory?.[0];
              if (!section) {
                logger.warn('No section found in library response', { libraryId });
                return [];
              }

              // Extract Location array which contains the configured folder paths
              const locations = section.Location || [];
              if (locations.length === 0) {
                logger.warn('No locations found in library section', { libraryId });
                return [];
              }

              // Map locations to folder objects
              const folders = locations.map((loc: any) => ({
                path: loc.path,
                accessible: true // Plex only returns accessible folders
              }));

              logger.info('Library folders retrieved', { libraryId, folderCount: folders.length, folders });

              return folders;
            } catch (error: any) {
              logger.error('Failed to get library folders', { 
                error: error.message,
                code: error.code,
                status: error.response?.status,
                libraryId,
                responseData: error.response?.data
              });

              if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                throw new Error('Plex server is unreachable');
              }
              if (error.response?.status === 401) {
                throw new Error('Invalid Plex token');
              }
              if (error.response?.status === 404) {
                throw new Error('Library not found');
              }
              if (error.isAxiosError) {
                throw new Error(`Failed to get library folders: ${error.message}`);
              }
              throw error;
            }
          }


  /**
   * Get play history for a library section
   * Returns tracks sorted by most recently played
   */
  async getPlayHistory(libraryId: string, limit: number = 100): Promise<PlexHistoryItem[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        '/status/sessions/history/all',
        {
          params: {
            librarySectionID: libraryId,
            'X-Plex-Container-Size': limit
          }
        }
      );

      return response.data.MediaContainer.Metadata || [];
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to get play history: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all playlists from Plex
   * Returns all playlists (audio, video, photo)
   */
  async getPlaylists(): Promise<PlexPlaylist[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        '/playlists'
      );

      return response.data.MediaContainer.Metadata || [];
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to get playlists: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create a new playlist
   * Returns the created playlist
   */
  async createPlaylist(
        name: string,
        libraryUri: string,
        trackUris: string[]
      ): Promise<PlexPlaylist> {
        try {
          logger.info('Creating playlist', { name, libraryUri, trackCount: trackUris.length });

          // URL-encode the URI value (matching python-plexapi's joinArgs behavior)
          const url = `/playlists?type=audio&title=${encodeURIComponent(name)}&smart=0&uri=${encodeURIComponent(libraryUri)}`;
          logger.info('createPlaylist URL', { url: url.substring(0, 300) });

          const createResponse = await this.client.post<PlexMediaContainer>(url, null);

          const playlist = createResponse.data.MediaContainer.Metadata?.[0];
          if (!playlist) {
            throw new Error('Failed to create playlist - no playlist returned');
          }

          logger.info('Playlist created in Plex', { ratingKey: playlist.ratingKey, title: playlist.title });

          // Add tracks to playlist if provided
          if (trackUris.length > 0) {
            await this.addToPlaylist(playlist.ratingKey, trackUris);
          }

          return playlist;
        } catch (error: any) {
          logger.error('Failed to create playlist', { name, error: error.message });
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            throw new Error('Plex server is unreachable');
          }
          if (error.response?.status === 401) {
            throw new Error('Invalid Plex token');
          }
          if (error.isAxiosError) {
            throw new Error(`Failed to create playlist: ${error.message}`);
          }
          throw error;
        }
      }

  /**
   * Get tracks from a playlist
   */
  async getPlaylistTracks(playlistId: string): Promise<PlexTrack[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        `/playlists/${playlistId}/items`
      );

      return response.data.MediaContainer.Metadata || [];
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.response?.status === 404) {
        throw new Error('Playlist not found');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to get playlist tracks: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Add tracks to a playlist
   * trackUris should be in format: server://libraryId/item/ratingKey
   */
  async addToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
        try {
          logger.info('Adding tracks to playlist', { playlistId, trackCount: trackUris.length, sampleUri: trackUris[0] });

          // Match python-plexapi approach: batch ratingKeys into a single URI, URL-encode the value
          // python-plexapi uses: uri = f'{server._uriRoot()}/library/metadata/{ratingKeys}'
          // where ratingKeys are comma-separated, and joinArgs URL-encodes the value
          const uriPrefix = trackUris[0]?.replace(/\/library\/metadata\/.*$/, '');

          const BATCH_SIZE = 50;
          for (let i = 0; i < trackUris.length; i += BATCH_SIZE) {
            const batch = trackUris.slice(i, i + BATCH_SIZE);
            const ratingKeys = batch.map(uri => uri.split('/library/metadata/')[1]);
            const batchUri = `${uriPrefix}/library/metadata/${ratingKeys.join(',')}`;
            const url = `/playlists/${playlistId}/items?uri=${encodeURIComponent(batchUri)}`;

            if (i === 0) {
              logger.info('First add-to-playlist request', { url: url.substring(0, 300), batchUri: batchUri.substring(0, 200) });
            }

            const response = await this.client.put(url, null);

            logger.info('Add to playlist batch response', { 
              playlistId, 
              batchIndex: Math.floor(i / BATCH_SIZE), 
              batchSize: batch.length,
              status: response.status,
              leafCountAdded: response.data?.MediaContainer?.leafCountAdded,
              leafCount: response.data?.MediaContainer?.Metadata?.[0]?.leafCount,
            });
          }

          logger.info('All tracks added to playlist', { playlistId, count: trackUris.length });
        } catch (error: any) {
          logger.error('Failed to add tracks to playlist', { 
            playlistId, 
            trackCount: trackUris.length,
            error: error.message,
            responseStatus: error.response?.status,
            responseData: JSON.stringify(error.response?.data)?.substring(0, 500)
          });
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            throw new Error('Plex server is unreachable');
          }
          if (error.response?.status === 401) {
            throw new Error('Invalid Plex token');
          }
          if (error.response?.status === 404) {
            throw new Error('Playlist not found');
          }
          if (error.isAxiosError) {
            throw new Error(`Failed to add tracks to playlist: ${error.message}`);
          }
          throw error;
        }
      }

  /**
   * Upload a poster image to a playlist from a URL
   */
  async uploadPlaylistPoster(playlistId: string, imageUrl: string): Promise<void> {
    try {
      // Download the image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Playlist Lab/1.0' },
      });

      const contentType = imageResponse.headers['content-type'] || 'image/jpeg';

      // Upload to Plex
      await this.client.post(
        `/library/metadata/${playlistId}/posters`,
        imageResponse.data,
        {
          headers: { 'Content-Type': contentType },
          maxBodyLength: 10 * 1024 * 1024,
        }
      );
    } catch (error: any) {
      logger.warn('Failed to upload playlist poster', { playlistId, error: error.message });
      // Non-fatal — playlist still works without a poster
    }
  }

  /**
   * Remove a track from a playlist
   */
  async removeFromPlaylist(playlistId: string, playlistItemId: string): Promise<void> {
    try {
      await this.client.delete(
        `/playlists/${playlistId}/items/${playlistItemId}`
      );
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.response?.status === 404) {
        throw new Error('Playlist or item not found');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to remove track from playlist: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Move a playlist item to a new position
   * @param playlistId - The playlist ID
   * @param playlistItemId - The playlist item ID to move
   * @param afterItemId - The playlist item ID to place this item after (or '0' for first position)
   */
  async movePlaylistItem(playlistId: string, playlistItemId: string, afterItemId: string): Promise<void> {
    try {
      await this.client.put(
        `/playlists/${playlistId}/items/${playlistItemId}/move`,
        null,
        { params: { after: afterItemId } }
      );
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.response?.status === 404) {
        throw new Error('Playlist or item not found');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to move playlist item: ${error.message}`);
      }
      throw error;
    }
  }


  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      await this.client.delete(`/playlists/${playlistId}`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      if (error.response?.status === 404) {
        throw new Error('Playlist not found');
      }
      if (error.isAxiosError) {
        throw new Error(`Failed to delete playlist: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build a track URI for use in playlist operations
   */
  buildTrackUri(ratingKey: string, machineIdentifier?: string): string {
    const id = machineIdentifier || this.clientId;
    return `server://${id}/com.plexapp.plugins.library/library/metadata/${ratingKey}`;
  }
  
  /**
   * Get the machine identifier for this Plex server
   */
  async getMachineIdentifier(): Promise<string> {
    try {
      const response = await this.client.get('/');
      return response.data.MediaContainer.machineIdentifier;
    } catch (error: any) {
      logger.error('Failed to get machine identifier', { error: error.message });
      throw new Error('Failed to get machine identifier');
    }
  }
  
  /**
   * Get library URI for playlist creation
   */
  buildLibraryUri(libraryId: string, machineIdentifier?: string): string {
    const id = machineIdentifier || this.clientId;
    return `server://${id}/com.plexapp.plugins.library/library/sections/${libraryId}`;
  }

  /**
   * Get recently played tracks from a library
   * @param libraryId Library section ID
   * @param days Number of days to look back (7 or 30)
   * @param limit Maximum number of tracks to return
   */
  async getRecentTracks(libraryId: string, days: number = 7, limit: number = 200): Promise<PlexTrack[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        `/library/sections/${libraryId}/all`,
        {
          params: {
            type: 10, // Tracks
            sort: 'lastViewedAt:desc',
            'lastViewedAt>>': 0, // Has been played
            'X-Plex-Container-Size': limit
          }
        }
      );

      const tracks = response.data.MediaContainer.Metadata || [];
      
      // Filter to tracks played within the specified days
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return tracks.filter((t: PlexTrack) => {
        const lastViewed = (t as any).lastViewedAt || 0;
        return lastViewed * 1000 >= cutoff;
      });
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      throw error;
    }
  }

  /**
   * Search for an artist by name
   */
  async searchArtist(libraryId: string, name: string): Promise<PlexTrack | null> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        `/library/sections/${libraryId}/all`,
        {
          params: {
            type: 8, // Artist
            title: name,
            'X-Plex-Container-Size': 1
          }
        }
      );

      const artists = response.data.MediaContainer.Metadata || [];
      return artists[0] || null;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      throw error;
    }
  }

  /**
   * Get popular tracks from an artist using hubs (external popularity data)
   * Falls back to play count if hubs unavailable
   */
  async getArtistPopularTracks(libraryId: string, artistKey: string, limit: number = 10): Promise<PlexTrack[]> {
    try {
      // Try hubs first (external popularity from Last.fm etc)
      const hubsResponse = await this.client.get<PlexMediaContainer>(
        `/hubs/sections/${libraryId}`,
        {
          params: {
            metadataItemId: artistKey,
            count: limit
          }
        }
      );

      const hubs = hubsResponse.data.MediaContainer.Hub || [];
      const popularHub = hubs.find((h: any) => {
        const title = h.title?.toLowerCase() || '';
        return title === 'popular' || title === 'top tracks';
      });

      if (popularHub?.Metadata?.length > 0) {
        return popularHub.Metadata.slice(0, limit);
      }

      // Fallback: get artist tracks sorted by play count
      const response = await this.client.get<PlexMediaContainer>(
        `/library/metadata/${artistKey}/allLeaves`,
        {
          params: {
            sort: 'viewCount:desc',
            'X-Plex-Container-Size': limit
          }
        }
      );

      const tracks = response.data.MediaContainer.Metadata || [];
      return tracks.slice(0, limit);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      throw error;
    }
  }

  /**
   * Get similar/related tracks (sonically similar or from same artist/album)
   */
  async getSimilarTracks(trackKey: string, limit: number = 10): Promise<PlexTrack[]> {
    try {
      // Try nearest (sonically similar) first
      const response = await this.client.get<PlexMediaContainer>(
        `/library/metadata/${trackKey}/nearest`,
        {
          params: {
            'X-Plex-Container-Size': limit
          }
        }
      );

      return response.data.MediaContainer.Metadata || [];
    } catch (error: any) {
      // If nearest fails, try similar (metadata-based)
      try {
        const response = await this.client.get<PlexMediaContainer>(
          `/library/metadata/${trackKey}/similar`,
          {
            params: {
              count: limit
            }
          }
        );

        return response.data.MediaContainer.Metadata || [];
      } catch {
        return [];
      }
    }
  }

  /**
   * Get tracks not played in X days (for rediscoveries)
   */
  async getStalePlayedTracks(libraryId: string, daysAgo: number, limit: number): Promise<PlexTrack[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        `/library/sections/${libraryId}/all`,
        {
          params: {
            type: 10, // Tracks
            sort: 'lastViewedAt:asc', // Oldest first
            'lastViewedAt>>': 0, // Has been played
            'X-Plex-Container-Size': limit * 2
          }
        }
      );

      const tracks = response.data.MediaContainer.Metadata || [];
      
      // Filter to tracks not played in X days
      const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
      const staleTracks = tracks.filter((t: PlexTrack) => {
        const lastViewed = (t as any).lastViewedAt || 0;
        return lastViewed * 1000 < cutoff;
      });

      return staleTracks.slice(0, limit);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      throw error;
    }
  }

  /**
   * Get recently added albums
   */
  async getRecentlyAddedAlbums(libraryId: string, limit: number = 10): Promise<PlexTrack[]> {
    try {
      const response = await this.client.get<PlexMediaContainer>(
        `/library/sections/${libraryId}/recentlyAdded`,
        {
          params: {
            type: 9, // Albums
            'X-Plex-Container-Size': limit
          }
        }
      );

      return response.data.MediaContainer.Metadata || [];
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      throw error;
    }
  }

  /**
   * Get tracks with custom filters
   */
  async getTracksWithFilters(libraryId: string, filters: string[], limit: number = 1000): Promise<PlexTrack[]> {
    try {
      const filterQuery = filters.join('&');
      const url = `/library/sections/${libraryId}/all?type=10&${filterQuery}&X-Plex-Container-Size=${limit}`;

      const response = await this.client.get<PlexMediaContainer>(url);

      if (!response.data.MediaContainer?.Metadata) {
        return [];
      }

      return response.data.MediaContainer.Metadata as PlexTrack[];
    } catch (error) {
      logger.error('Failed to get tracks with filters', { error, libraryId, filters });
      return [];
    }
  }


  /**
   * Get users who have access to the Plex server
   * Returns list of users with library access
   */
  async getServerUsers(): Promise<Array<{ username: string; email: string; thumb?: string }>> {
    try {
      const response = await this.client.get('/accounts');
      
      // Extract user information from the response
      const accounts = response.data.MediaContainer?.Account || [];
      
      return accounts.map((account: any) => ({
        username: account.name || account.title,
        email: account.email || '',
        thumb: account.thumb
      }));
    } catch (error: any) {
      logger.error('Failed to get Plex server users', { error: error.message });
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      throw new Error('Failed to retrieve server users');
    }
  }

  /**
   * Get list of Plex friends (users with library access)
   */
  async getFriends(): Promise<Array<{ username: string; email: string; thumb?: string; friendlyName?: string }>> {
    try {
      // Get friends from Plex.tv API (not server API)
      const response = await axios.get('https://plex.tv/api/v2/friends', {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': this.token
        }
      });

      const friends = response.data || [];
      
      logger.info('Friends API response', { 
        count: friends.length,
        friends: friends.map((f: any) => ({
          id: f.id,
          username: f.username,
          title: f.title,
          friendlyName: f.friendlyName,
          email: f.email
        }))
      });
      
      return friends.map((friend: any) => ({
        username: friend.username || friend.title,
        email: friend.email,
        thumb: friend.thumb,
        friendlyName: friend.friendlyName || friend.title
      }));
    } catch (error: any) {
      logger.error('Failed to get Plex friends', { error: error.message });
      
      if (error.response?.status === 401) {
        throw new Error('Invalid Plex token');
      }
      
      throw new Error('Failed to retrieve Plex friends');
    }
  }

  /**
   * Get playlists from a friend's account
   * Uses their access token to retrieve their playlists
   * 
   * @param friendUsername - Username of the friend
   * @returns Array of playlists from the friend's account
   */
  async getFriendPlaylists(friendUsername: string): Promise<Array<{ playlistId: string; playlistName: string; trackCount: number; duration: number }>> {
    try {
      logger.info('Getting friend playlists', { friendUsername });
      
      // First, get the friend's ID from the friends API
      const friendsResponse = await axios.get('https://plex.tv/api/v2/friends', {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': this.token
        }
      });
      
      const friends = friendsResponse.data || [];
      const friend = friends.find((f: any) => 
        f.username === friendUsername || 
        f.title === friendUsername ||
        f.username?.toLowerCase() === friendUsername.toLowerCase() ||
        f.title?.toLowerCase() === friendUsername.toLowerCase()
      );
      
      if (!friend) {
        const availableFriends = friends.map((f: any) => f.username || f.title);
        logger.error('Friend not found', { 
          friendUsername, 
          availableFriends 
        });
        throw new Error(`Friend "${friendUsername}" not found. Available friends: ${availableFriends.join(', ')}`);
      }
      
      logger.info('Found friend', { 
        friendUsername, 
        friendId: friend.id,
        friendTitle: friend.title 
      });
      
      // Get the friend's access token from shared_servers
      // Note: This returns users who have access to YOUR server
      // To browse THEIR playlists, they need to have shared their server with YOU
      
      // First, try to find if this friend has shared their server with you
      const resourcesResponse = await axios.get('https://plex.tv/api/v2/resources', {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': this.token
        },
        params: {
          includeHttps: 1,
          includeRelay: 1
        }
      });
      
      const resources = resourcesResponse.data || [];
      logger.info('Resources (servers shared with you)', { 
        count: resources.length,
        servers: resources.map((r: any) => ({
          name: r.name,
          owned: r.owned,
          ownerId: r.ownerId
        }))
      });
      
      // Find a server owned by this friend
      const friendServer = resources.find((r: any) => 
        r.ownerId === friend.id && r.provides?.includes('server')
      );
      
      if (!friendServer) {
        logger.error('Friend has not shared their server with you', { 
          friendId: friend.id,
          friendUsername,
          note: 'This friend needs to share their Plex server with you to view their playlists'
        });
        throw new Error(`Friend "${friendUsername}" has not shared their Plex server with you. They need to share their library with you in Plex settings to view their playlists.`);
      }
      
      const friendToken = friendServer.accessToken;
      const friendServerUrl = friendServer.connections?.[0]?.uri || `https://${friendServer.address}:${friendServer.port}`;
      
      logger.info('Found friend server', { 
        friendUsername,
        serverName: friendServer.name,
        serverUrl: friendServerUrl
      });
      
      // Create a Plex client with the friend's server and token
      const friendClient = new PlexClient(
        friendServerUrl,
        friendToken,
        this.clientId,
        this.productName
      );
      
      // Get their playlists
      const playlists = await friendClient.getPlaylists();
      logger.info('Retrieved playlists from friend', { 
        friendUsername, 
        totalPlaylists: playlists.length 
      });
      
      // Filter to audio playlists and map to simplified format
      const audioPlaylists = playlists
        .filter(p => p.playlistType === 'audio')
        .map(p => ({
          playlistId: p.ratingKey,
          playlistName: p.title,
          trackCount: p.leafCount || 0,
          duration: p.duration || 0
        }));
      
      logger.info('Filtered to audio playlists', { 
        friendUsername, 
        audioPlaylistCount: audioPlaylists.length 
      });
      
      return audioPlaylists;
    } catch (error: any) {
      logger.error('Failed to get friend playlists', { 
        friendUsername, 
        error: error.message,
        stack: error.stack
      });
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - invalid token');
      }
      
      throw new Error(error.message || 'Failed to retrieve friend playlists');
    }
  }

  /**
   * Share a playlist with a Plex friend by copying it to their account
   * 
   * NOTE: Plex doesn't have a native "share" feature. This method creates a copy
   * of the playlist in the target user's account using their access token.
   * 
   * @param playlistId - The Plex playlist rating key
   * @param targetUsername - Username of the friend to share with
   */
  async sharePlaylist(playlistId: string, targetUsername: string): Promise<void> {
    try {
      logger.info('Sharing playlist (copying to user account)', { playlistId, targetUsername });
      
      // Step 1: Get the playlist details and items
      const playlistResponse = await this.client.get(`/playlists/${playlistId}`);
      const playlist = playlistResponse.data.MediaContainer?.Metadata?.[0];
      
      if (!playlist) {
        throw new Error('Playlist not found');
      }
      
      const itemsResponse = await this.client.get(`/playlists/${playlistId}/items`);
      const items = itemsResponse.data.MediaContainer?.Metadata || [];
      
      logger.info('Retrieved playlist details', { 
        title: playlist.title, 
        itemCount: items.length 
      });
      
      // Step 2: Get the target user's access token from plex.tv
      const machineId = await this.getMachineIdentifier();
      const sharedServersResponse = await axios.get(
        `https://plex.tv/api/servers/${machineId}/shared_servers`,
        {
          headers: {
            'Accept': 'application/json',
            'X-Plex-Token': this.token
          }
        }
      );
      
      const sharedServers = sharedServersResponse.data.MediaContainer?.SharedServer || [];
      
      // Also get user info to match by username
      const usersResponse = await axios.get('https://plex.tv/api/users', {
        headers: {
          'Accept': 'application/json',
          'X-Plex-Token': this.token
        }
      });
      
      const users = usersResponse.data.MediaContainer?.User || [];
      const userIdMap = new Map(
        users.map((u: any) => [u['@id'], u['@username'] || u['@title']])
      );
      
      // Find the target user's access token
      let targetUserToken: string | null = null;
      for (const server of sharedServers) {
        const userId = server['@userID'];
        const username = userIdMap.get(userId);
        if (username === targetUsername) {
          targetUserToken = server['@accessToken'];
          break;
        }
      }
      
      if (!targetUserToken) {
        throw new Error(`User "${targetUsername}" not found in shared users or doesn't have access to this server`);
      }
      
      logger.info('Found target user token', { targetUsername });
      
      // Step 3: Create a new Plex client with the target user's token
      const targetUserClient = new PlexClient(
        this.serverUrl,
        targetUserToken,
        this.clientId,
        this.productName
      );
      
      // Step 4: Delete existing playlist with same name (if it exists)
      try {
        const existingPlaylists = await targetUserClient.getPlaylists();
        const existingPlaylist = existingPlaylists.find(p => p.title === playlist.title);
        if (existingPlaylist) {
          logger.info('Deleting existing playlist in target user account', { 
            title: playlist.title 
          });
          await targetUserClient.deletePlaylist(existingPlaylist.ratingKey);
        }
      } catch (err) {
        // Ignore errors when checking for existing playlist
        logger.warn('Could not check for existing playlist', { error: err });
      }
      
      // Step 5: Create the playlist in the target user's account
      const trackUris = items.map((item: any) => 
        this.buildTrackUri(item.ratingKey, machineId)
      );
      
      // Get library URI from first track
      const libraryId = items[0]?.librarySectionID;
      if (!libraryId) {
        throw new Error('Could not determine library ID from playlist items');
      }
      
      const libraryUri = this.buildLibraryUri(libraryId.toString(), machineId);
      
      await targetUserClient.createPlaylist(
        playlist.title,
        libraryUri,
        trackUris
      );
      
      logger.info('Successfully shared playlist (created copy in user account)', { 
        playlistTitle: playlist.title,
        targetUsername,
        trackCount: items.length
      });
    } catch (error: any) {
      logger.error('Failed to share playlist', { 
        error: error.message, 
        playlistId, 
        targetUsername 
      });
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Plex server is unreachable');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Playlist not found');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - invalid token');
      }
      
      throw new Error(error.message || 'Failed to share playlist');
    }
  }

  
}

// Export PlexService as an alias for PlexClient for backward compatibility
export const PlexService = PlexClient;