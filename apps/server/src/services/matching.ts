// Copy this entire file content and paste it into apps/server/src/services/matching.ts

/**
 * Matching Service - Complete implementation ported from desktop app
 */

import { MatchingSettings } from '../database/types';
import { logger } from '../utils/logger';
import { ExternalTrack } from './scrapers';
import { PlexClient } from './plex';

export interface MatchedTrack {
  title: string;
  artist: string;
  album?: string;
  matched: boolean;
  plexRatingKey?: string;
  plexTitle?: string;
  plexArtist?: string;
  plexAlbum?: string;
  plexCodec?: string;
  plexBitrate?: number;
  score?: number;
}

let currentMatchingSettings: MatchingSettings;

export async function matchPlaylist(
  tracks: ExternalTrack[],
  serverUrl: string,
  plexToken: string,
  libraryId: string | undefined,
  settings: MatchingSettings,
  progressEmitter?: any,
  coverUrl?: string,
  playlistName?: string,
  isCancelled?: () => boolean
): Promise<MatchedTrack[]> {
  logger.info('[Matching] Starting', {
    trackCount: tracks.length
  });
  currentMatchingSettings = settings;

  if (currentMatchingSettings.minMatchScore <= 1) {
    currentMatchingSettings.minMatchScore = currentMatchingSettings.minMatchScore * 100;
  }

  const plexClient = new PlexClient(serverUrl, plexToken);
  const matchedTracks: MatchedTrack[] = new Array(tracks.length);
  
  // Process tracks in parallel batches to speed up matching without overloading Plex
  // BATCH_SIZE of 5 is a good balance:
  // - Too low (1-2): Slow, doesn't utilize Plex's capacity
  // - Too high (10+): May overload Plex, cause timeouts, or hit rate limits
  // - 5: Fast enough while keeping Plex responsive for other clients
  const BATCH_SIZE = 5;
  const batches: ExternalTrack[][] = [];
  
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    batches.push(tracks.slice(i, i + BATCH_SIZE));
  }

  let processedCount = 0;

  for (const batch of batches) {
    // Check for cancellation
    if (isCancelled && isCancelled()) {
      logger.info(`[Matching] Cancelled at track ${processedCount + 1}/${tracks.length}`);
      throw new Error('Import cancelled by user');
    }

    // Process batch in parallel
    const batchPromises = batch.map(async (track, batchIndex) => {
      const trackIndex = processedCount + batchIndex;
      logger.info(`[Matching] ${trackIndex + 1}/${tracks.length}: ${track.artist} - ${track.title}`);

      try {
        const match = await findBestMatch(track, plexClient, libraryId);
        const passesMinScore = match !== null && match.score >= currentMatchingSettings.minMatchScore;

        return {
          index: trackIndex,
          result: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            matched: passesMinScore,
            plexRatingKey: passesMinScore ? match?.ratingKey : undefined,
            plexTitle: passesMinScore ? match?.plexTitle : undefined,
            plexArtist: passesMinScore ? match?.plexArtist : undefined,
            plexAlbum: passesMinScore ? match?.plexAlbum : undefined,
            plexCodec: passesMinScore ? match?.plexCodec : undefined,
            plexBitrate: passesMinScore ? match?.plexBitrate : undefined,
            score: match?.score,
          }
        };
      } catch (error: any) {
        logger.error(`[Matching] Error`, { track: `${track.artist} - ${track.title}`, error: error.message });
        return {
          index: trackIndex,
          result: { title: track.title, artist: track.artist, album: track.album, matched: false }
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Store results in correct order
    for (const { index, result } of batchResults) {
      matchedTracks[index] = result;
    }

    processedCount += batch.length;

    // Emit progress after each batch
    if (progressEmitter) {
      progressEmitter.emit('progress', {
        type: 'progress',
        phase: 'matching',
        current: processedCount,
        total: tracks.length,
        currentTrackName: `Processing batch...`,
        coverUrl,
        playlistName
      });
    }
  }

  const matchedCount = matchedTracks.filter(t => t.matched).length;
  logger.info('[Matching] Complete', { total: matchedTracks.length, matched: matchedCount });
  return matchedTracks;
}

async function findBestMatch(
  track: ExternalTrack,
  plexClient: PlexClient,
  libraryId: string | undefined
): Promise<{ ratingKey: string; score: number; plexTitle: string; plexArtist: string; plexAlbum: string; plexCodec?: string; plexBitrate?: number } | null> {
  try {
    const titleWithoutPunctuation = track.title.replace(/[^a-zA-Z0-9]/g, '');
    if (titleWithoutPunctuation.length < 2) return null;
    
    const cleanedArtist = cleanArtistName(track.artist);
    const coreTitle = getCoreTitle(track.title);
    
    const normalizeSearch = (s: string) => s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201A\u201B\u0027\u0060\u00B4'`�]/g, '')
      .replace(/\//g, ' ').replace(/\./g, '')
      .replace(/[^\w\s\-]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const searchTitle = normalizeSearch(coreTitle);
    const searchArtist = normalizeSearch(cleanedArtist);
    const originalTitle = normalizeSearch(track.title);
    const searchArtistNoHyphen = searchArtist.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Search with artist and title separately for better Plex filtering
    const allResults: any[] = [];
    
    // Try with artist and title filters
    try {
      logger.info(`[Matching] Trying filtered search: artist="${searchArtist}", title="${searchTitle}"`);
      const results = await plexClient.searchTrack('', libraryId, searchArtist, searchTitle);
      logger.info(`[Matching] Filtered search returned ${results.length} results`);
      for (const r of results) {
        if (!allResults.some(existing => existing.ratingKey === r.ratingKey)) {
          allResults.push(r);
        }
      }
    } catch (err: any) {
      logger.error(`[Matching] Filtered search error: ${err.message}`);
    }
    
    // If no results, try with original title (handles different formatting like parentheses vs dashes)
    if (allResults.length === 0 && originalTitle !== searchTitle) {
      try {
        logger.info(`[Matching] Trying with original title: "${originalTitle}"`);
        const results = await plexClient.searchTrack('', libraryId, searchArtist, originalTitle);
        logger.info(`[Matching] Original title search returned ${results.length} results`);
        for (const r of results) {
          if (!allResults.some(existing => existing.ratingKey === r.ratingKey)) {
            allResults.push(r);
          }
        }
      } catch (err: any) {
        logger.error(`[Matching] Original title search error: ${err.message}`);
      }
    }
    
    // If still no results, try with artist variant (no hyphen)
    if (allResults.length === 0 && searchArtistNoHyphen !== searchArtist) {
      try {
        logger.info(`[Matching] Trying artist variant: "${searchArtistNoHyphen}"`);
        const results = await plexClient.searchTrack('', libraryId, searchArtistNoHyphen, searchTitle);
        logger.info(`[Matching] Artist variant search returned ${results.length} results`);
        for (const r of results) {
          if (!allResults.some(existing => existing.ratingKey === r.ratingKey)) {
            allResults.push(r);
          }
        }
      } catch (err: any) {
        logger.error(`[Matching] Artist variant search error: ${err.message}`);
      }
    }
    
    // If still no results, fall back to hub search (searches all fields, handles artist mismatches)
    if (allResults.length === 0) {
      try {
        // Use cleaned artist (first artist only) for hub search
        const hubQuery = `${cleanedArtist} ${track.title}`;
        logger.info(`[Matching] Trying hub search fallback: query="${hubQuery}" (cleaned from "${track.artist}")`);
        // Don't pass artist/title params to force hub search
        const results = await plexClient.searchTrack(hubQuery, libraryId, undefined, undefined);
        logger.info(`[Matching] Hub search returned ${results.length} results`);
        for (const r of results) {
          if (!allResults.some(existing => existing.ratingKey === r.ratingKey)) {
            allResults.push(r);
          }
        }
      } catch (err: any) {
        logger.error(`[Matching] Hub search error: ${err.message}`);
      }
    }
    
    logger.info(`[Matching] Search for "${cleanedArtist} - ${track.title}": results=${allResults.length}`, {
      artist: searchArtist,
      title: searchTitle,
      originalArtist: track.artist,
      cleanedArtist: cleanedArtist,
      originalTitle: track.title,
      topResults: allResults.slice(0, 5).map(r => ({ 
        title: r.title, 
        artist: r.grandparentTitle, 
        album: r.parentTitle,
        ratingKey: r.ratingKey 
      }))
    });
    
    if (!allResults.length) return null;
    
    let bestMatch: { ratingKey: string; score: number; rankScore: number; plexTitle: string; plexArtist: string; plexAlbum: string; plexCodec?: string; plexBitrate?: number } | null = null;
    
    for (const result of allResults) {
      const plexTitle = result.title || '';
      const albumArtist = result.grandparentTitle || '';
      const albumName = result.parentTitle || '';
      const trackArtist = result.originalTitle || '';
      
      logger.info(`[Matching] Checking result: "${plexTitle}" by "${albumArtist}"`, {
        plexTitle,
        albumArtist,
        trackArtist,
        albumName,
        ratingKey: result.ratingKey
      });
      
      if (!titlesMatch(track.title, plexTitle)) {
        logger.info(`[Matching] Title mismatch, skipping`, { sourceTitle: track.title, plexTitle });
        continue;
      }
      
      const albumArtistMatches = albumArtist && artistsMatch(track.artist, albumArtist);
      const trackArtistMatches = trackArtist && artistsMatch(track.artist, trackArtist);
      
      // Also check if any individual artist from a multi-artist string matches
      const sourceArtists = track.artist.split(/\s*[,&\/]\s*/).map(a => a.trim()).filter(Boolean);
      const anyArtistMatches = sourceArtists.length > 1 && sourceArtists.some(a => {
        const cleanA = normalizeForComparison(a);
        const cleanAlbum = normalizeForComparison(albumArtist);
        const cleanTrack = normalizeForComparison(trackArtist);
        return (cleanAlbum && (cleanA === cleanAlbum || cleanAlbum.includes(cleanA) || cleanA.includes(cleanAlbum))) ||
               (cleanTrack && (cleanA === cleanTrack || cleanTrack.includes(cleanA) || cleanA.includes(cleanTrack)));
      });
      
      // Check if this is a "Various Artists" compilation
      const isVariousArtists = normalizeForComparison(albumArtist).includes('various') || 
                               normalizeForComparison(albumArtist).includes('compilation');
      
      logger.info(`[Matching] Artist check results`, {
        albumArtistMatches,
        trackArtistMatches,
        anyArtistMatches,
        isVariousArtists,
        sourceArtist: track.artist,
        albumArtist,
        trackArtist
      });
      
      // Allow Various Artists matches but with penalty, or require artist match
      if (!albumArtistMatches && !trackArtistMatches && !anyArtistMatches && !isVariousArtists) {
        logger.info(`[Matching] Artist mismatch, skipping`);
        continue;
      }
      
      const plexArtist = albumArtistMatches ? albumArtist : (trackArtist || albumArtist);
      let score = calculateMatchScore(track.title, track.artist, plexTitle, plexArtist);
      
      logger.info(`[Matching] Initial score: ${score}`);
      
      // Penalize Various Artists compilations heavily (but still allow them as last resort)
      // BUT: Don't penalize if the track artist (originalTitle) matches
      if (isVariousArtists && !albumArtistMatches && !trackArtistMatches) {
        score -= 40;
        logger.info(`[Matching] Various Artists penalty applied, new score: ${score}`);
      }
      
      // Penalize remixes when source track is not a remix
      if (!hasRemixIndicator(track.title) && hasRemixIndicator(plexTitle)) {
        score -= 30;
        logger.info(`[Matching] Remix penalty applied, new score: ${score}`);
      }
      
      // Penalize alternate versions (unplugged, acoustic, live, etc.) when source doesn't have them
      if (!hasAlternateVersionIndicator(track.title) && hasAlternateVersionIndicator(plexTitle)) {
        score -= 35;
        logger.info(`[Matching] Alternate version penalty applied, new score: ${score}`);
      }
      
      // Prefer remasters (better quality of the same track)
      if (hasRemasterIndicator(plexTitle) && !hasRemixIndicator(plexTitle)) {
        score += 5;
        logger.info(`[Matching] Remaster bonus applied, new score: ${score}`);
      }
      
      // Prefer self-titled tracks (album name = track name)
      // This helps when searching for "Chameleon" and there's both:
      // - Album "Chameleon" with track "Chameleon" (self-titled)
      // - Album "Changa" with track "Chameleon"
      const normalizedAlbum = normalizeForComparison(albumName);
      const normalizedTrack = normalizeForComparison(plexTitle);
      if (normalizedAlbum && normalizedTrack && normalizedAlbum === normalizedTrack) {
        score += 10;
        logger.info(`[Matching] Self-titled track bonus applied (album="${albumName}" = track="${plexTitle}"), new score: ${score}`);
      }
      
      if (currentMatchingSettings.preferNonCompilation && albumArtistMatches) {
        score += 50;
        logger.info(`[Matching] Non-compilation bonus applied, new score: ${score}`);
      }
      
      logger.info(`[Matching] Final score: ${score}, minMatchScore: ${currentMatchingSettings.minMatchScore}`);
      
      if (!bestMatch || score > bestMatch.rankScore) {
        const displayScore = Math.min(100, Math.max(0, score)); // Use rankScore (with bonuses) for display
        const media = result.Media?.[0];
        bestMatch = { 
          ratingKey: result.ratingKey, 
          score: displayScore, 
          rankScore: score, 
          plexTitle, 
          plexArtist, 
          plexAlbum: albumName, 
          plexCodec: media?.audioCodec?.toUpperCase(), 
          plexBitrate: media?.bitrate 
        };
        logger.info(`[Matching] New best match!`, { ratingKey: result.ratingKey, score, displayScore });
      }
    }
    
    if (bestMatch) {
      return { 
        ratingKey: bestMatch.ratingKey, 
        score: bestMatch.score, 
        plexTitle: bestMatch.plexTitle, 
        plexArtist: bestMatch.plexArtist, 
        plexAlbum: bestMatch.plexAlbum, 
        plexCodec: bestMatch.plexCodec, 
        plexBitrate: bestMatch.plexBitrate 
      };
    }
    return null;
  } catch (error: any) {
    logger.error('[Matching] Error in findBestMatch', { error: error.message });
    return null;
  }
}

function getCoreTitle(title: string): string {
  let core = title;
  if (currentMatchingSettings.stripParentheses) core = core.replace(/\([^)]*\)/g, '');
  if (currentMatchingSettings.stripBrackets) core = core.replace(/\[[^\]]*\]/g, '');
  return core.replace(/\s+/g, ' ').trim();
}

function cleanTrackTitle(title: string): string {
  let cleaned = title;
  if (currentMatchingSettings.stripParentheses) cleaned = cleaned.replace(/\([^)]*\)/g, '');
  if (currentMatchingSettings.stripBrackets) cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  return cleaned.replace(/\s+/g, ' ').trim() || title;
}

function cleanArtistName(artist: string): string {
  if (!artist) return '';
  let cleaned = artist;
  
  // Always use first artist only when there are multiple artists
  // Handle various separators: &, and, ,, /
  const multiArtistPattern = /\s*(?:&|,|\/|\band\b)\s*/i;
  if (multiArtistPattern.test(cleaned)) {
    cleaned = cleaned.split(multiArtistPattern)[0].trim();
  }
  
  if (currentMatchingSettings.ignoreFeaturedArtists) {
    for (const pattern of currentMatchingSettings.featuredArtistPatterns) {
      const regex = new RegExp(`\\s+${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?\\s+.+$`, 'gi');
      cleaned = cleaned.replace(regex, '');
    }
  }
  return cleaned.replace(/\s+/g, ' ').trim() || artist;
}

function normalizeForComparison(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201A\u201B\u0027\u0060\u00B4'`�]/g, '')
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '')
    .replace(/\$/g, 's').replace(/\//g, '').replace(/\./g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/(\d)\s+([ap]m)\b/gi, '$1$2') // Normalize "9 PM" to "9pm", "3 AM" to "3am"
    .replace(/\s+/g, ' ').trim();
}

function titlesMatch(sourceTitle: string, plexTitle: string): boolean {
  const cleanSource = normalizeForComparison(cleanTrackTitle(sourceTitle));
  const cleanPlex = normalizeForComparison(cleanTrackTitle(plexTitle));
  if (cleanSource === cleanPlex) return true;
  if (cleanSource.replace(/\s+/g, '') === cleanPlex.replace(/\s+/g, '')) return true;
  if (cleanSource.includes(cleanPlex) || cleanPlex.includes(cleanSource)) return true;
  return false;
}

function artistsMatch(sourceArtist: string, plexArtist: string): boolean {
  const cleanSource = normalizeForComparison(cleanArtistName(sourceArtist));
  const cleanPlex = normalizeForComparison(cleanArtistName(plexArtist));
  if (cleanSource === cleanPlex) return true;
  if (cleanSource.includes(cleanPlex) || cleanPlex.includes(cleanSource)) return true;
  return false;
}

const REMIX_KEYWORDS = /\b(remix|remixed|edit|mix|version|acoustic|live|instrumental|radio edit|bootleg|dub|extended|vip|flip|rework|reimagined)\b/i;
const REMASTER_KEYWORDS = /\b(remaster(?:ed)?)\b/i;
const ALTERNATE_VERSION_KEYWORDS = /\b(unplugged|acoustic|live|instrumental|radio edit|session|performance|cover)\b/i;

function hasRemixIndicator(title: string): boolean {
  return REMIX_KEYWORDS.test(title);
}

function hasRemasterIndicator(title: string): boolean {
  return REMASTER_KEYWORDS.test(title);
}

function hasAlternateVersionIndicator(title: string): boolean {
  return ALTERNATE_VERSION_KEYWORDS.test(title);
}

function calculateMatchScore(sourceTitle: string, sourceArtist: string, plexTitle: string, plexArtist: string): number {
  const cleanSourceTitle = cleanTrackTitle(sourceTitle).toLowerCase();
  const cleanPlexTitle = cleanTrackTitle(plexTitle).toLowerCase();
  const cleanSourceArtist = cleanArtistName(sourceArtist).toLowerCase();
  const cleanPlexArtist = cleanArtistName(plexArtist).toLowerCase();
  
  let titleScore = 0;
  if (cleanSourceTitle === cleanPlexTitle) {
    titleScore = 100;
  } else if (cleanSourceTitle.includes(cleanPlexTitle) || cleanPlexTitle.includes(cleanSourceTitle)) {
    titleScore = 90;
  } else {
    const sourceWords = cleanSourceTitle.split(/\s+/);
    const plexWords = cleanPlexTitle.split(/\s+/);
    const matches = sourceWords.filter(w => plexWords.some(pw => pw.includes(w) || w.includes(pw))).length;
    titleScore = Math.round((matches / Math.max(sourceWords.length, plexWords.length)) * 80);
  }
  
  let artistScore = 0;
  if (cleanSourceArtist === cleanPlexArtist) {
    artistScore = 100;
  } else if (cleanSourceArtist.includes(cleanPlexArtist) || cleanPlexArtist.includes(cleanSourceArtist)) {
    artistScore = 90;
  } else {
    artistScore = 70;
  }
  
  return Math.round(titleScore * 0.7 + artistScore * 0.3);
}



