/**
 * YouTube OAuth Target Adapter
 * 
 * Creates playlists on YouTube using OAuth 2.0 authentication and YouTube Data API v3.
 * Replaces the cookie-based adapter with proper OAuth flow and token management.
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { youtubeOAuthService } from '../services/youtube-oauth';
import { logger } from '../utils/logger';

/**
 * Clean track title by removing remastered tags and parenthetical content
 */
function cleanTrackTitle(title: string): string {
  let cleaned = title.replace(/\([^)]*\)/g, ''); // Remove anything in parentheses
  cleaned = cleaned.replace(/\bremastered?\b/gi, ''); // Remove "remastered"
  cleaned = cleaned.replace(/\s+/g, ' ').trim(); // Clean up whitespace
  return cleaned;
}

/**
 * Calculate similarity score between two strings
 */
function similarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  
  if (na === nb) return 100;
  if (!na || !nb) return 0;
  
  // Word-based matching
  const wordsA = na.split(/\s+/);
  const wordsB = nb.split(/\s+/);
  const shorterWords = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longerWords = wordsA.length <= wordsB.length ? wordsB : wordsA;
  
  let matchedWords = 0;
  for (const word of shorterWords) {
    if (longerWords.some(w => w.includes(word) || word.includes(w))) {
      matchedWords++;
    }
  }
  
  const wordMatchRatio = matchedWords / shorterWords.length;
  if (wordMatchRatio >= 0.8) {
    return Math.round(wordMatchRatio * 100);
  }
  
  // Fall back to character-based matching
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let matches = 0, pos = 0;
  
  for (const ch of shorter) {
    const idx = longer.indexOf(ch, pos);
    if (idx !== -1) { 
      matches++; 
      pos = idx + 1; 
    }
  }
  
  return Math.round((matches / longer.length) * 100);
}

/**
 * Map YouTube contentDetails.definition to user-friendly resolution
 */
function mapResolution(definition: string | undefined): string | undefined {
  if (!definition) return undefined;
  // YouTube API returns 'hd' or 'sd'
  if (definition === 'hd') return '720p+'; // HD is 720p or higher
  if (definition === 'sd') return '480p';  // SD is typically 480p or lower
  return undefined;
}

export const youtubeOAuthTargetAdapter: TargetAdapter = {
  meta: {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    isSourceOnly: false,
    requiresOAuth: true,
  } satisfies ServiceMeta,

  isConfigured(): boolean {
    return youtubeOAuthService.isReady();
  },

  async searchCatalog(query: string, userId: number, db: any, _allowLive?: boolean, _allowStatic?: boolean): Promise<MatchResult[]> {
    const youtube = await youtubeOAuthService.getYouTubeClient(userId, db);
    
    try {
      const response = await youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults: 10,
        videoCategoryId: '10', // Music category
      });

      const sourceTrack: TrackInfo = { title: query, artist: '' };
      const items = response.data.items || [];

      const results = items.map(item => {
        const videoId = item.id?.videoId;
        const title = item.snippet?.title || '';
        const channelTitle = item.snippet?.channelTitle || '';
        
        if (!videoId) return null;

        let confidence = similarity(query, title);
        
        // Boost for "Official"
        if (/official/i.test(title)) {
          confidence = Math.min(100, confidence + 15);
        }
        
        // Penalties
        const titleLower = title.toLowerCase();
        if (titleLower.includes('live')) confidence = Math.max(0, confidence - 20);
        if (/\blyrics?\b/i.test(title)) confidence = Math.max(0, confidence - 20);
        if (titleLower.includes('acoustic')) confidence = Math.max(0, confidence - 20);
        
        return {
          sourceTrack,
          targetTrackId: videoId,
          targetTitle: title,
          targetArtist: channelTitle,
          confidence,
          matched: true,
          skipped: false,
        };
      }).filter(Boolean) as MatchResult[];
      
      return results.sort((a, b) => b.confidence - a.confidence);
    } catch (err: any) {
      logger.error('[YouTubeOAuthAdapter] Search catalog error', { query, error: err.message });
      throw new Error(`YouTube search failed: ${err.message}`);
    }
  },

  async matchTracks(
    tracks: TrackInfo[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any,
    progressEmitter?: NodeJS.EventEmitter,
    isCancelled?: () => boolean
  ): Promise<MatchResult[]> {
    const youtube = await youtubeOAuthService.getYouTubeClient(userId, db);
    
    logger.info('[YouTubeOAuthAdapter] Starting matchTracks', { trackCount: tracks.length, userId });

    const results: MatchResult[] = [];
    const videoIds: string[] = []; // Collect video IDs for batch resolution fetch

    for (let i = 0; i < tracks.length; i++) {
      if (isCancelled?.()) {
        logger.info('[YouTubeOAuthAdapter] Matching cancelled by user', { userId, processedTracks: i });
        break;
      }
      
      const track = tracks[i];
      const cleanedTitle = cleanTrackTitle(track.title);
      const query = `${cleanedTitle} ${track.artist}`.trim();
      let matchResult: MatchResult = { sourceTrack: track, confidence: 0, matched: false, skipped: false };

      try {
        logger.debug('[YouTubeOAuthAdapter] Searching track', { 
          index: i + 1, 
          total: tracks.length, 
          query,
          originalTitle: track.title
        });
        
        const response = await youtube.search.list({
          part: ['snippet'],
          q: query,
          type: ['video'],
          maxResults: 5,
          videoCategoryId: '10', // Music category
        });

        const items = response.data.items || [];
        const candidates = items.map(item => ({
          videoId: item.id?.videoId,
          title: item.snippet?.title || '',
          channelTitle: item.snippet?.channelTitle || '',
        })).filter(c => c.videoId);

        if (candidates.length > 0) {
          const scored = candidates.map(c => {
            const titleSim = similarity(cleanedTitle, c.title);
            const artistSim = similarity(track.artist, c.channelTitle);
            let baseScore = titleSim * 0.6 + artistSim * 0.4;
            
            // Boost for "Official"
            if (/official/i.test(c.title)) {
              baseScore = Math.min(100, baseScore + 15);
            }
            
            // Penalties
            const titleLower = c.title.toLowerCase();
            if (titleLower.includes('live')) baseScore = Math.max(0, baseScore - 20);
            if (/\blyrics?\b/i.test(c.title)) baseScore = Math.max(0, baseScore - 20);
            if (titleLower.includes('acoustic')) baseScore = Math.max(0, baseScore - 20);
            
            return { c, score: Math.round(baseScore) };
          });
          
          scored.sort((a, b) => b.score - a.score);
          const best = scored[0];
          
          matchResult = {
            sourceTrack: track,
            targetTrackId: best.c.videoId!,
            targetTitle: best.c.title,
            targetArtist: best.c.channelTitle,
            confidence: best.score,
            matched: best.score >= 40,
            skipped: false,
          };

          // Collect video ID for batch resolution fetch
          if (matchResult.matched && matchResult.targetTrackId) {
            videoIds.push(matchResult.targetTrackId);
          }
        }
      } catch (err: any) {
        logger.error('[YouTubeOAuthAdapter] Search error for track', { 
          index: i + 1, 
          track: track.title, 
          error: err.message 
        });
        // Continue with unmatched result
      }

      results.push(matchResult);
      
      // Emit progress
      const progressData = { 
        current: i + 1, 
        total: tracks.length,
        currentTrackName: track.title 
      };
      progressEmitter?.emit('progress', progressData);
    }

    // Batch fetch resolutions for all matched videos
    if (videoIds.length > 0 && !isCancelled?.()) {
      try {
        logger.info('[YouTubeOAuthAdapter] Fetching resolutions for matched videos', { count: videoIds.length });
        
        // YouTube API allows up to 50 IDs per request
        const batchSize = 50;
        for (let i = 0; i < videoIds.length; i += batchSize) {
          const batch = videoIds.slice(i, i + batchSize);
          
          const videoResponse = await youtube.videos.list({
            part: ['contentDetails'],
            id: batch,
          });

          const videoDetails = videoResponse.data.items || [];
          const resolutionMap = new Map<string, string>();
          
          videoDetails.forEach(video => {
            if (video.id && video.contentDetails?.definition) {
              const resolution = mapResolution(video.contentDetails.definition);
              if (resolution) {
                resolutionMap.set(video.id, resolution);
              }
            }
          });

          // Update results with resolutions
          results.forEach(result => {
            if (result.targetTrackId && resolutionMap.has(result.targetTrackId)) {
              result.targetResolution = resolutionMap.get(result.targetTrackId);
            }
          });
        }
        
        logger.info('[YouTubeOAuthAdapter] Resolutions fetched successfully', { 
          totalVideos: videoIds.length,
          resolvedCount: results.filter(r => r.targetResolution).length
        });
      } catch (err: any) {
        logger.error('[YouTubeOAuthAdapter] Failed to fetch resolutions', { error: err.message });
        // Continue without resolutions - not critical
      }
    }
    
    const matchedCount = results.filter(r => r.matched).length;
    logger.info('[YouTubeOAuthAdapter] Matching complete', { 
      trackCount: tracks.length, 
      matchedCount,
      unmatchedCount: tracks.length - matchedCount
    });
    
    return results;
  },

  async createPlaylist(
    name: string,
    matchResults: MatchResult[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }> {
    const youtube = await youtubeOAuthService.getYouTubeClient(userId, db);

    try {
      // Create playlist
      logger.info('[YouTubeOAuthAdapter] Creating playlist', { name, userId });
      
      const playlistResponse = await youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: name,
            description: 'Created by Playlist Lab',
          },
          status: {
            privacyStatus: 'private',
          },
        },
      });

      const playlistId = playlistResponse.data.id;
      if (!playlistId) {
        throw new Error('Failed to create playlist - no playlist ID returned');
      }

      logger.info('[YouTubeOAuthAdapter] Playlist created successfully', { playlistId, name });

      // Add videos to playlist
      const videoIds = matchResults
        .filter(r => r.matched && !r.skipped && r.targetTrackId)
        .map(r => r.targetTrackId!);

      logger.info('[YouTubeOAuthAdapter] Adding videos to playlist', { 
        playlistId, 
        videoCount: videoIds.length 
      });

      let addedCount = 0;
      for (const videoId of videoIds) {
        try {
          await youtube.playlistItems.insert({
            part: ['snippet'],
            requestBody: {
              snippet: {
                playlistId,
                resourceId: {
                  kind: 'youtube#video',
                  videoId,
                },
              },
            },
          });
          addedCount++;
        } catch (err: any) {
          logger.warn('[YouTubeOAuthAdapter] Failed to add video to playlist', { 
            videoId, 
            playlistId,
            error: err.message 
          });
          // Continue adding other videos
        }
      }

      logger.info('[YouTubeOAuthAdapter] Playlist creation complete', { 
        playlistId, 
        name, 
        requestedCount: videoIds.length,
        addedCount
      });
      
      return { playlistId, name, trackCount: addedCount };
    } catch (err: any) {
      logger.error('[YouTubeOAuthAdapter] Playlist creation failed', { 
        name, 
        userId,
        error: err.message,
        stack: err.stack
      });
      throw new Error(`Failed to create YouTube playlist: ${err.message}`);
    }
  },

  async getOAuthUrl(userId: number, _db: any, _redirectUri: string): Promise<string> {
    return youtubeOAuthService.getAuthUrl(String(userId));
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    const tokens = await youtubeOAuthService.exchangeCode(code);
    await youtubeOAuthService.storeTokens(userId, tokens, db);
    logger.info('[YouTubeOAuthAdapter] OAuth callback handled successfully', { userId });
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    try {
      const tokens = await youtubeOAuthService.getTokens(userId, db);
      return !!tokens?.access_token;
    } catch {
      return false;
    }
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    await youtubeOAuthService.revokeConnection(userId, db);
  },
};
