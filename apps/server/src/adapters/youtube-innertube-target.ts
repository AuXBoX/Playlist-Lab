/**
 * YouTube Target Adapter (InnerTube API - No Quota Limits)
 * 
 * Uses YouTube's internal API via youtubei.js library.
 * This is the same API the YouTube website uses, so there are no quota limits.
 * Requires OAuth authentication (same tokens as youtube-oauth-target).
 */

import { TargetAdapter, TargetConfig, TrackInfo, MatchResult, ServiceMeta } from './types';
import { youtubeOAuthService } from '../services/youtube-oauth';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// Dynamic import for youtubei.js (ES Module)
let InnertubeClass: typeof import('youtubei.js').Innertube;
let innertubeReady = false;

async function getInnertube() {
  if (!innertubeReady) {
    const module = await import('youtubei.js');
    InnertubeClass = module.Innertube;
    innertubeReady = true;
  }
  return InnertubeClass;
}

/**
 * Normalize artist/channel names for comparison
 * Removes hyphens, spaces, underscores, "the" prefix, and converts to lowercase
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '') // Remove "the" prefix
    .replace(/[-_\s]/g, '') // Remove hyphens, underscores, spaces
    .replace(/music$/i, '') // Remove "music" suffix (common in channel names)
    .replace(/official$/i, '') // Remove "official" suffix
    .replace(/vevo$/i, ''); // Remove "vevo" suffix
}

/**
 * Clean track title by removing ALL parenthetical content and common suffixes
 */
function cleanTrackTitle(title: string): string {
  return title
    // Remove ALL parenthetical content
    .replace(/\s*\([^)]*\)/g, '')
    // Remove ALL bracketed content
    .replace(/\s*\[[^\]]*\]/g, '')
    // Remove common suffixes after dashes
    .replace(/\s*-\s*(?:remaster|remastered|version|edit|mix|demo|bonus)(?:\s|$)/gi, '')
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshtein(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculate YouTube-specific match confidence
 */
function calculateYouTubeConfidence(
  sourceTitle: string,
  sourceArtist: string,
  videoTitle: string,
  channelName: string,
  qualityLabel?: string,
  allowLive: boolean = false,
  isStaticImage: boolean = false,
  allowStatic: boolean = false
): number {
  const cleanSource = cleanTrackTitle(sourceTitle).toLowerCase();
  const cleanVideo = cleanTrackTitle(videoTitle).toLowerCase();
  
  // Check if video has parenthetical content that source doesn't
  const sourceHasParens = /\([^)]+\)/.test(sourceTitle);
  const videoHasParens = /\([^)]+\)/.test(videoTitle);
  const unnecessaryParens = !sourceHasParens && videoHasParens;
  
  // Base similarity scores
  const titleSim = similarity(cleanSource, cleanVideo);
  const artistSim = similarity(sourceArtist.toLowerCase(), channelName.toLowerCase());
  
  // Normalized artist comparison (removes hyphens, spaces, "music" suffix, etc.)
  const normalizedArtist = normalizeArtistName(sourceArtist);
  const normalizedChannel = normalizeArtistName(channelName);
  const normalizedArtistSim = similarity(normalizedArtist, normalizedChannel);
  
  // Use the better of the two artist similarity scores
  const bestArtistSim = Math.max(artistSim, normalizedArtistSim);
  
  // Check if channel name contains "official" - strong indicator of official channel
  const channelHasOfficial = channelName.toLowerCase().includes('official');
  
  // Check if artist name appears in video title (common for music videos)
  const artistInTitle = videoTitle.toLowerCase().includes(sourceArtist.toLowerCase());
  
  // Check if source title appears in video title (for exact matches)
  const sourceTitleInVideo = videoTitle.toLowerCase().includes(sourceTitle.toLowerCase());
  
  // Check if cleaned source appears in cleaned video (more lenient)
  const cleanedMatch = cleanVideo.includes(cleanSource);
  
  // Check if all significant words from source appear in video (order-independent)
  const sourceWords = cleanSource.split(/\s+/).filter(w => w.length > 2); // Words longer than 2 chars
  const videoWords = cleanVideo.split(/\s+/);
  const allWordsPresent = sourceWords.every(word => 
    videoWords.some(vw => vw.includes(word) || word.includes(vw))
  );
  
  // IMPORTANT: If channel name matches artist, the video title doesn't need the artist name
  // This is the official artist channel pattern
  // Also consider channels with "official" in the name as potential artist channels
  const isArtistChannel = bestArtistSim > 0.85 || (channelHasOfficial && bestArtistSim > 0.60); // Artist channel threshold
  
  // Log artist matching details for debugging
  if (sourceArtist && channelName) {
    logger.info('[YouTubeInnertubeAdapter] Artist matching', {
      sourceArtist,
      channelName,
      normalizedArtist,
      normalizedChannel,
      artistSim: artistSim.toFixed(3),
      normalizedArtistSim: normalizedArtistSim.toFixed(3),
      bestArtistSim: bestArtistSim.toFixed(3),
      isArtistChannel
    });
  }
  
  // CRITICAL: Heavy penalties for non-music content
  const videoLower = videoTitle.toLowerCase();
  const isGuitarLesson = videoLower.match(/\b(guitar\s+lesson|how\s+to\s+play|tutorial|tab|chord|fingerstyle)\b/);
  const isLyrics = videoLower.match(/\b(lyric|lyrics)\b/);
  const isLive = videoLower.match(/\b(live|concert|performance|awards|festival)\b/);
  const isCover = videoLower.match(/\b(cover|acoustic|karaoke|instrumental)\b/);
  const isUnplugged = videoLower.includes('unplugged');
  const isAudioOnly = videoLower.match(/\b(audio)\b/); // Audio-only uploads (not proper videos)
  const isCommentary = videoLower.match(/\b(commentary|reaction|review|analysis|breakdown)\b/); // Commentary/reaction videos
  const hasLocation = videoTitle.match(/\([^)]*(?:arena|stadium|theatre|theater|festival|awards|city|country|state|19\d{2}|20\d{2}|[A-Z][a-z]+,\s*[A-Z])/i); // Location/date in title (e.g., "(Melbourne, Australia)" or "1998 ARIA Awards")
  
  // If we have a source artist, require channel to match OR artist in title
  // This prevents matching videos by wrong artists
  const hasArtistMatch = !sourceArtist || isArtistChannel || artistInTitle || bestArtistSim > 0.5;
  
  // CRITICAL: If artist is provided and channel is very different, this is likely wrong
  const isWrongArtist = sourceArtist && !isArtistChannel && !artistInTitle && bestArtistSim < 0.3;
  
  // Start with a strong base for good title matches
  let confidence = 0;
  
  // SPECIAL CASE: Artist channel + exact title match = nearly perfect
  if (isArtistChannel && titleSim > 0.95) {
    confidence = 0.95; // Start at 95% for artist channel + perfect title
  } else if (isArtistChannel && (titleSim > 0.85 || allWordsPresent)) {
    confidence = 0.90; // 90% for artist channel + very good title or all words present
  } else if (isArtistChannel && titleSim > 0.75) {
    confidence = 0.85; // 85% for artist channel + good title
  } else if (sourceTitleInVideo && hasArtistMatch) {
    confidence = 0.90; // 90% for exact title in video (with artist match)
  } else if ((cleanedMatch || allWordsPresent) && hasArtistMatch) {
    confidence = 0.85; // 85% for cleaned matches or all words present (with artist match)
  } else if (titleSim > 0.8 && hasArtistMatch) {
    confidence = 0.75; // 75% for very similar titles (with artist match)
  } else if (hasArtistMatch) {
    confidence = titleSim * 0.70; // Scale down for lower similarity
  } else {
    // No artist match - heavily penalize
    confidence = titleSim * 0.30; // Very low confidence without artist match
  }
  
  // Artist channel bonus - if channel IS the artist, this is highly reliable
  if (isArtistChannel) {
    confidence += 0.20; // Strong bonus for artist's official channel (increased from 0.15)
  } else if (bestArtistSim > 0.7) {
    confidence += 0.05; // Small bonus for similar channel name
  } else if (artistInTitle) {
    confidence += 0.05; // Artist in title
  }
  
  // MASSIVE penalty for wrong artist
  if (isWrongArtist) {
    confidence -= 0.70; // Huge penalty - this is almost certainly wrong
  }
  
  // Strong boost for "Official" in title or channel
  if (videoTitle.toLowerCase().includes('official')) {
    confidence += 0.10;
  }
  
  if (channelHasOfficial) {
    confidence += 0.15; // Strong boost for official channel (increased from 0.05)
  }
  
  // MASSIVE penalties for non-music content
  if (isGuitarLesson) {
    confidence -= 0.60; // Huge penalty for guitar lessons/tutorials
  }
  
  if (isLyrics) {
    confidence -= 0.40; // Heavy penalty for lyrics videos
  }
  
  if (isCommentary) {
    confidence -= 0.50; // Heavy penalty for commentary/reaction videos
  }
  
  if (isAudioOnly) {
    confidence -= 0.30; // Penalty for audio-only uploads (not proper videos)
  }
  
  if (isStaticImage && !allowStatic) {
    confidence -= 0.35; // Heavy penalty for static image videos (unless user allows them)
  }
  
  if (isLive && !allowLive) {
    confidence -= 0.25; // Penalty for live versions (unless user allows them)
  }
  
  if (hasLocation && !allowLive) {
    confidence -= 0.30; // Penalty for videos with location in title (usually live performances, unless user allows them)
  }
  
  if (isCover) {
    confidence -= 0.35; // Penalty for covers, acoustic, karaoke
  }
  
  if (isUnplugged) {
    confidence -= 0.20; // Penalty for unplugged
  }
  
  // Small penalty for remaster
  if (videoTitle.toLowerCase().includes('remaster')) {
    confidence -= 0.02;
  }
  
  // Small penalty for unnecessary parenthetical content
  // If source doesn't have parens but video does, slightly prefer videos without
  if (unnecessaryParens) {
    confidence -= 0.03;
  }
  
  // Boost for higher quality videos (HUGE boost to prefer HD and break ties)
  // Resolution is very important - penalize low quality heavily
  if (qualityLabel) {
    if (qualityLabel.includes('4K')) {
      confidence += 0.25; // Massive boost for 4K
    } else if (qualityLabel.includes('1440p')) {
      confidence += 0.20; // Huge boost for 1440p
    } else if (qualityLabel.includes('1080p')) {
      confidence += 0.15; // Very strong boost for 1080p (Full HD)
    } else if (qualityLabel.includes('720p')) {
      confidence += 0.05; // Small boost for 720p (HD)
    } else if (qualityLabel.includes('480p')) {
      confidence -= 0.10; // Strong penalty for 480p (SD)
    } else if (qualityLabel.includes('360p')) {
      confidence -= 0.15; // Heavy penalty for 360p
    } else if (qualityLabel.includes('240p')) {
      confidence -= 0.20; // Massive penalty for 240p
    }
  }
  
  // Don't cap confidence - let it go above 1.0 for better sorting
  // Only cap when displaying to user
  const finalConfidence = Math.max(0, confidence);
  
  // Debug logging for confidence calculation
  if (sourceArtist && channelName) {
    logger.info('[YouTubeInnertubeAdapter] Confidence breakdown', {
      sourceTitle,
      sourceArtist,
      videoTitle,
      channelName,
      qualityLabel,
      isArtistChannel,
      hasArtistMatch,
      baseConfidence: confidence.toFixed(3),
      finalConfidence: finalConfidence.toFixed(3)
    });
  }
  
  return finalConfidence;
}

export const youtubeInnertubeTargetAdapter: TargetAdapter = {
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

  async searchCatalog(query: string, _userId: number, _db: any, allowLive: boolean = false, allowStatic: boolean = false): Promise<MatchResult[]> {
    try {
      logger.info('[YouTubeInnertubeAdapter] Searching', { query, allowLive, allowStatic });

      // Initialize Innertube (no auth needed for search)
      const Innertube = await getInnertube();
      const youtube = await Innertube.create();

      // Search for videos
      const searchResults = await youtube.search(query, { type: 'video' });
      
      const results: MatchResult[] = [];
      
      // Process first 20 results (increased from 10 for better matching)
      const videos = searchResults.videos?.slice(0, 20) || [];
      
      // For manual search, fetch resolution/FPS for ALL results so user can see everything
      for (const video of videos) {
        // Type guard to ensure we have the right video type
        if (!('id' in video) || !('title' in video)) continue;
        if (!video.id || !video.title) continue;

        const title = video.title.toString();
        const author = ('author' in video && video.author) ? video.author.name : '';
        
        // Get actual video resolution and FPS by fetching video info
        let qualityLabel: string | undefined;
        let isStaticImage = false;
        
        try {
          if (video.id) {
            const videoInfo = await youtube.getInfo(video.id);
            
            // Get the highest quality format available
            if (videoInfo.streaming_data?.formats || videoInfo.streaming_data?.adaptive_formats) {
              const allFormats = [
                ...(videoInfo.streaming_data.formats || []),
                ...(videoInfo.streaming_data.adaptive_formats || [])
              ];
              
              // Find the highest resolution video format and check frame rate
              let maxHeight = 0;
              let maxFps = 0;
              for (const format of allFormats) {
                const height = (format as any).height || 0;
                const fps = (format as any).fps || (format as any).frame_rate || (format as any).frameRate || 0;
                
                // Log format details for debugging
                if (height > 0) {
                  logger.debug('[YouTubeInnertubeAdapter] Format details', {
                    videoId: video.id,
                    height,
                    fps,
                    hasHeight: !!(format as any).height,
                    hasFps: !!(format as any).fps,
                    hasFrameRate: !!(format as any).frame_rate,
                    hasFrameRateCamel: !!(format as any).frameRate,
                    formatKeys: Object.keys(format).join(', ')
                  });
                }
                
                if (height > maxHeight) {
                  maxHeight = height;
                }
                if (fps > maxFps) {
                  maxFps = fps;
                }
              }
              
              logger.info('[YouTubeInnertubeAdapter] Video analysis', {
                videoId: video.id,
                title: video.title.toString(),
                maxHeight,
                maxFps,
                formatCount: allFormats.length
              });
              
              // Detect static image videos (very low frame rate)
              // Real videos are typically 24-60 fps, static images are 1-5 fps
              if (maxFps > 0 && maxFps <= 5) {
                isStaticImage = true;
                logger.info('[YouTubeInnertubeAdapter] Detected static image video', {
                  videoId: video.id,
                  title: video.title.toString(),
                  fps: maxFps
                });
              }
              
              // Map height to quality label
              if (maxHeight >= 2160) qualityLabel = '4K';
              else if (maxHeight >= 1440) qualityLabel = '1440p';
              else if (maxHeight >= 1080) qualityLabel = '1080p';
              else if (maxHeight >= 720) qualityLabel = '720p';
              else if (maxHeight >= 480) qualityLabel = '480p';
              else if (maxHeight >= 360) qualityLabel = '360p';
              else if (maxHeight >= 240) qualityLabel = '240p';
            }
          }
        } catch (err: any) {
          // If we can't get video info, just continue without resolution/FPS
          logger.debug('[YouTubeInnertubeAdapter] Could not fetch video info', { 
            videoId: video.id,
            error: err.message 
          });
        }

        // Calculate confidence using YouTube-specific algorithm
        // For search catalog, we don't have separate artist, so try to extract it from query
        let extractedArtist = '';
        const queryLower = query.toLowerCase();
        const authorLower = (author || '').toLowerCase();
        
        // Try multiple approaches to extract artist from query
        if (author) {
          // Approach 1: Check if full author name appears in query
          if (queryLower.includes(authorLower)) {
            extractedArtist = author;
          } else {
            // Approach 2: Check if normalized author appears in normalized query
            const normalizedAuthor = normalizeArtistName(author);
            const normalizedQuery = normalizeArtistName(query);
            if (normalizedQuery.includes(normalizedAuthor) || normalizedAuthor.includes(normalizedQuery.replace(/\s+/g, ''))) {
              extractedArtist = author;
            }
          }
        }
        
        // For title comparison, remove the artist name from the query if we extracted it
        let titleForComparison = query;
        if (extractedArtist) {
          // Remove the artist name from the query for better title matching
          titleForComparison = query.replace(new RegExp(extractedArtist, 'gi'), '').trim();
        }
        
        const confidence = calculateYouTubeConfidence(
          titleForComparison,
          extractedArtist,
          title,
          author || '',
          qualityLabel,
          allowLive,
          isStaticImage,
          allowStatic
        );
        
        // Store uncapped confidence for sorting, but cap display at 100%
        const confidencePercent = Math.round(confidence * 100);
        const displayConfidence = Math.min(confidencePercent, 100);

        results.push({
          sourceTrack: { title: query, artist: '', album: '' },
          matched: true,
          confidence: displayConfidence,
          skipped: false,
          targetTrackId: video.id,
          targetTitle: title,
          targetArtist: author || '',
          targetAlbum: '',
          targetResolution: qualityLabel,
          isStaticImage,
          _sortScore: confidencePercent, // Internal uncapped score for sorting
        } as any);
      }

      // Sort by uncapped confidence (so 110% beats 100%)
      results.sort((a: any, b: any) => (b._sortScore || b.confidence) - (a._sortScore || a.confidence));
      
      // Remove internal sort score before returning
      results.forEach((r: any) => delete r._sortScore);

      logger.info('[YouTubeInnertubeAdapter] Search complete', { 
        query, 
        resultCount: results.length 
      });

      return results;
    } catch (err: any) {
      logger.error('[YouTubeInnertubeAdapter] Search catalog error', { 
        query, 
        error: err.message 
      });
      throw new Error(`YouTube search failed: ${err.message}`);
    }
  },

  async matchTracks(
    tracks: TrackInfo[],
    _targetConfig: TargetConfig,
    _userId: number,
    _db: any,
    progressEmitter?: EventEmitter,
    isCancelled?: () => boolean,
    allowLive: boolean = false,
    allowStatic: boolean = false
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];
    
    // Define candidate type for tracking video match candidates
    interface Candidate {
      video: any;
      confidence: number;
      confidencePercent: number;
      title: string;
      author: string;
      qualityLabel?: string;
      isStaticImage: boolean;
    }
    
    try {
      // Initialize Innertube (no auth needed for search/matching)
      const Innertube = await getInnertube();
      const youtube = await Innertube.create();

      for (let i = 0; i < tracks.length; i++) {
        if (isCancelled?.()) {
          logger.info('[YouTubeInnertubeAdapter] Matching cancelled');
          break;
        }

        const track = tracks[i];
        // Clean the track title to remove parenthetical content before searching
        const cleanedTitle = cleanTrackTitle(track.title);
        const query = `${cleanedTitle} ${track.artist}`.trim();

        progressEmitter?.emit('progress', {
          current: i + 1,
          total: tracks.length,
          currentTrackName: track.title,
        });

        try {
          const searchResults = await youtube.search(query, { type: 'video' });
          const videos = searchResults.videos || [];

          if (videos.length === 0) {
            results.push({
              sourceTrack: track,
              matched: false,
              confidence: 0,
              skipped: false,
            });
            continue;
          }

          // Evaluate ALL videos (up to 20) and pick the best one
          const videosToCheck = videos.slice(0, 20);
          const candidates: Candidate[] = [];

          // First pass: Calculate confidence WITHOUT resolution (fast)
          for (const video of videosToCheck) {
            // Type guard to ensure we have the right video type
            if (!('id' in video) || !('title' in video)) continue;
            if (!video.id || !video.title) continue;

            const title = video.title.toString();
            const author = ('author' in video && video.author) ? video.author.name : '';
            
            // Calculate confidence without resolution first
            const confidence = calculateYouTubeConfidence(
              track.title,
              track.artist,
              title,
              author || '',
              undefined, // No quality label yet
              allowLive,
              false, // No static image detection yet
              allowStatic
            );
            
            const confidencePercent = Math.round(confidence * 100);

            candidates.push({
              video,
              confidence,
              confidencePercent,
              title,
              author,
              qualityLabel: undefined,
              isStaticImage: false
            });
          }

          // Sort by confidence and only fetch resolution for top 5 candidates
          candidates.sort((a, b) => b.confidence - a.confidence);
          const topCandidates = candidates.slice(0, 5);

          // Second pass: Fetch resolution for top 5 and recalculate confidence
          for (const candidate of topCandidates) {
            try {
              if (candidate.video.id) {
                const videoInfo = await youtube.getInfo(candidate.video.id);
                
                // Get the highest quality format available
                if (videoInfo.streaming_data?.formats || videoInfo.streaming_data?.adaptive_formats) {
                  const allFormats = [
                    ...(videoInfo.streaming_data.formats || []),
                    ...(videoInfo.streaming_data.adaptive_formats || [])
                  ];
                  
                  // Find the highest resolution video format and check frame rate
                  let maxHeight = 0;
                  let maxFps = 0;
                  for (const format of allFormats) {
                    const height = (format as any).height || 0;
                    const fps = (format as any).fps || (format as any).frame_rate || (format as any).frameRate || 0;
                    if (height > maxHeight) {
                      maxHeight = height;
                    }
                    if (fps > maxFps) {
                      maxFps = fps;
                    }
                  }
                  
                  logger.info('[YouTubeInnertubeAdapter] Video analysis (matching)', {
                    videoId: candidate.video.id,
                    title: candidate.title,
                    maxHeight,
                    maxFps,
                    formatCount: allFormats.length
                  });
                  
                  // Detect static image videos (very low frame rate)
                  const isStaticImage = maxFps > 0 && maxFps <= 5;
                  candidate.isStaticImage = isStaticImage;
                  if (isStaticImage) {
                    logger.info('[YouTubeInnertubeAdapter] Detected static image video in matching', {
                      videoId: candidate.video.id,
                      title: candidate.title,
                      fps: maxFps
                    });
                  }
                  
                  // Map height to quality label
                  if (maxHeight >= 2160) candidate.qualityLabel = '4K';
                  else if (maxHeight >= 1440) candidate.qualityLabel = '1440p';
                  else if (maxHeight >= 1080) candidate.qualityLabel = '1080p';
                  else if (maxHeight >= 720) candidate.qualityLabel = '720p';
                  else if (maxHeight >= 480) candidate.qualityLabel = '480p';
                  else if (maxHeight >= 360) candidate.qualityLabel = '360p';
                  else if (maxHeight >= 240) candidate.qualityLabel = '240p';
                  
                  // Recalculate confidence with resolution
                  candidate.confidence = calculateYouTubeConfidence(
                    track.title,
                    track.artist,
                    candidate.title,
                    candidate.author,
                    candidate.qualityLabel,
                    allowLive,
                    isStaticImage,
                    allowStatic
                  );
                  candidate.confidencePercent = Math.round(candidate.confidence * 100);
                }
              }
            } catch (err: any) {
              // If we can't get video info, just continue without resolution
              logger.debug('[YouTubeInnertubeAdapter] Could not fetch video info', { 
                videoId: candidate.video.id,
                error: err.message 
              });
            }
          }

          // Re-sort after adding resolution data
          candidates.sort((a, b) => b.confidence - a.confidence);

          const bestMatch = candidates[0];
          
          if (!bestMatch) {
            results.push({
              sourceTrack: track,
              matched: false,
              confidence: 0,
              skipped: false,
            });
            continue;
          }

          // Log first few matches for debugging
          if (i < 3) {
            logger.info('[YouTubeInnertubeAdapter] Auto-match result', {
              trackTitle: track.title,
              trackArtist: track.artist,
              videoTitle: bestMatch.title,
              channelName: bestMatch.author,
              qualityLabel: bestMatch.qualityLabel,
              confidence: bestMatch.confidence.toFixed(3),
              confidencePercent: bestMatch.confidencePercent
            });
          }

          const displayConfidence = Math.min(bestMatch.confidencePercent, 100);

          results.push({
            sourceTrack: track,
            matched: bestMatch.confidence > 0.30, // Lower threshold to 30%
            confidence: displayConfidence, // Display capped at 100%
            skipped: false,
            targetTrackId: bestMatch.video.id || '',
            targetTitle: bestMatch.title,
            targetArtist: bestMatch.author || '',
            targetAlbum: '',
            targetResolution: bestMatch.qualityLabel,
            isStaticImage: bestMatch.isStaticImage,
            _sortScore: bestMatch.confidencePercent, // Internal uncapped score for sorting
          } as any);
        } catch (err: any) {
          logger.error('[YouTubeInnertubeAdapter] Track match error', { 
            track: track.title, 
            error: err.message 
          });
          results.push({
            sourceTrack: track,
            matched: false,
            confidence: 0,
            skipped: false,
          });
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      logger.info('[YouTubeInnertubeAdapter] Matching complete', { 
        total: tracks.length,
        matched: results.filter(r => r.matched).length 
      });

      return results;
    } catch (err: any) {
      logger.error('[YouTubeInnertubeAdapter] Match tracks error', { error: err.message });
      throw new Error(`YouTube matching failed: ${err.message}`);
    }
  },

  async createPlaylist(
    name: string,
    tracks: MatchResult[],
    _targetConfig: TargetConfig,
    userId: number,
    db: any
  ): Promise<{ playlistId: string; name: string; trackCount: number }> {
    try {
      logger.info('[YouTubeInnertubeAdapter] Creating playlist', { name, trackCount: tracks.length });

      // Get OAuth tokens
      const tokens = await youtubeOAuthService.getTokens(userId, db);
      if (!tokens) {
        throw new Error('Not authenticated with YouTube');
      }

      // Initialize Innertube with OAuth credentials
      const Innertube = await getInnertube();
      const youtube = await Innertube.create({
        retrieve_player: false,
      });

      // Authenticate with OAuth tokens
      await youtube.session.signIn({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expiry_date: new Date(tokens.expires_at || Date.now() + 3600000).toISOString(),
      } as any);

      // Create playlist
      const playlist = await youtube.playlist.create(name, ['Created by Playlist Lab']);

      const playlistId = playlist.playlist_id || '';
      logger.info('[YouTubeInnertubeAdapter] Playlist created', { playlistId });

      // Add videos to playlist
      const matchedTracks = tracks.filter(t => t.matched && !t.skipped && t.targetTrackId);
      let addedCount = 0;

      for (const track of matchedTracks) {
        try {
          await youtube.playlist.addVideos(playlistId, [track.targetTrackId!]);
          addedCount++;
          logger.info('[YouTubeInnertubeAdapter] Added video', { 
            videoId: track.targetTrackId,
            title: track.targetTitle 
          });
        } catch (err: any) {
          logger.error('[YouTubeInnertubeAdapter] Failed to add video', { 
            videoId: track.targetTrackId,
            error: err.message 
          });
        }

        // Small delay between additions
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info('[YouTubeInnertubeAdapter] Playlist creation complete', { 
        playlistId,
        addedCount 
      });

      return {
        playlistId,
        name,
        trackCount: addedCount,
      };
    } catch (err: any) {
      logger.error('[YouTubeInnertubeAdapter] Create playlist error', { error: err.message });
      throw new Error(`Failed to create YouTube playlist: ${err.message}`);
    }
  },

  async hasValidConnection(userId: number, db: any): Promise<boolean> {
    try {
      const tokens = await youtubeOAuthService.getTokens(userId, db);
      return tokens !== null;
    } catch (err) {
      return false;
    }
  },

  async getOAuthUrl(userId: number, _db: any, _redirectUri: string): Promise<string> {
    return youtubeOAuthService.getAuthUrl(String(userId));
  },

  async handleOAuthCallback(code: string, userId: number, db: any, _redirectUri: string): Promise<void> {
    const tokens = await youtubeOAuthService.exchangeCode(code);
    await youtubeOAuthService.storeTokens(userId, tokens, db);
  },

  async revokeConnection(userId: number, db: any): Promise<void> {
    await youtubeOAuthService.revokeConnection(userId, db);
  },
};
