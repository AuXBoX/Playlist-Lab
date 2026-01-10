/**
 * Discovery Service - Fetches charts from external sources
 * Matching algorithm ported from matching.py
 */

// Last.fm country names
const LASTFM_COUNTRIES: Record<string, string> = {
  'global': 'united states', 'us': 'united states', 'gb': 'united kingdom',
  'au': 'australia', 'ca': 'canada', 'de': 'germany', 'fr': 'france',
  'es': 'spain', 'br': 'brazil', 'jp': 'japan',
};

export interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
  source: 'deezer' | 'lastfm';
}

export interface DiscoveryPlaylist {
  id: string;
  name: string;
  description: string;
  source: 'deezer' | 'lastfm';
  tracks: ExternalTrack[];
}

export interface MatchedTrack {
  title: string;
  artist: string;
  matched: boolean;
  plexRatingKey?: string;
  plexTitle?: string;
  plexArtist?: string;
  score?: number;
}

export interface MatchedPlaylist {
  id: string;
  name: string;
  description: string;
  source: 'deezer' | 'lastfm';
  tracks: MatchedTrack[];
  matchedCount: number;
  totalCount: number;
}

// ==================== FETCH CHARTS ====================

// Playlist categories with refresh schedules (in hours)
export const PLAYLIST_SCHEDULES = {
  'top-charts': 24,        // Daily - charts change frequently
  'decade': 168,           // Weekly - decade hits are stable
  'genre': 72,             // Every 3 days
  'decade-genre': 168,     // Weekly
};

export async function fetchAllCharts(country: string, selectedChartIds?: string[]): Promise<DiscoveryPlaylist[]> {
  // For Australia, use ARIA charts scraped from the official website
  if (country === 'au') {
    const ariaCharts = await fetchARIAChartsFromScraper(selectedChartIds).catch(() => []);
    // Only add decade/genre playlists from Deezer if ARIA scraping got nothing
    if (ariaCharts.length === 0) {
      const [deezerDecades, deezerGenres] = await Promise.all([
        fetchDeezerDecadePlaylists().catch(() => []),
        fetchDeezerGenrePlaylists().catch(() => []),
      ]);
      return [...deezerDecades, ...deezerGenres];
    }
    return ariaCharts;
  }
  
  const [deezer, deezerDecades, deezerGenres, lastfm] = await Promise.all([
    fetchDeezerCharts(country).catch(() => []),
    fetchDeezerDecadePlaylists().catch(() => []),
    fetchDeezerGenrePlaylists().catch(() => []),
    fetchLastfmCharts(country).catch(() => []),
  ]);
  return [...deezer, ...deezerDecades, ...deezerGenres, ...lastfm];
}

/**
 * Fetch ARIA charts using Electron's scraper (main process)
 */
async function fetchARIAChartsFromScraper(selectedChartIds?: string[]): Promise<DiscoveryPlaylist[]> {
  // Check if we're in Electron with the scraper API
  if (typeof window !== 'undefined' && (window as any).api?.scrapeAriaCharts) {
    const charts = await (window as any).api.scrapeAriaCharts(selectedChartIds);
    return charts.map((chart: any) => ({
      id: chart.id,
      name: chart.name,
      description: chart.description,
      source: 'deezer' as const, // Use deezer as source type for compatibility
      tracks: chart.tracks.map((t: any) => ({
        title: t.title,
        artist: t.artist,
        source: 'deezer' as const,
      })),
    }));
  }
  return [];
}

async function fetchDeezerCharts(country: string): Promise<DiscoveryPlaylist[]> {
  const playlists: DiscoveryPlaylist[] = [];
  
  const countryNames: Record<string, string> = {
    'global': 'Global', 'us': 'United States', 'gb': 'United Kingdom',
    'au': 'Australia', 'ca': 'Canada', 'de': 'Germany', 'fr': 'France',
    'es': 'Spain', 'br': 'Brazil', 'jp': 'Japan',
  };

  // Always fetch global top tracks
  const topRes = await fetch('https://api.deezer.com/chart/0/tracks?limit=50');
  if (topRes.ok) {
    const data = await topRes.json();
    if (data.data?.length) {
      playlists.push({
        id: 'deezer-top-global',
        name: 'Top 50 Global',
        description: 'Most played tracks worldwide',
        source: 'deezer',
        tracks: data.data.map((t: any) => ({
          title: t.title,
          artist: t.artist?.name || 'Unknown',
          album: t.album?.title,
          source: 'deezer' as const,
        })),
      });
    }
  }

  // For non-global, try to get country-specific playlist
  if (country !== 'global') {
    // Try searching for country top chart playlist
    const searchQuery = encodeURIComponent(`Top 50 ${countryNames[country] || country}`);
    const searchRes = await fetch(`https://api.deezer.com/search/playlist?q=${searchQuery}&limit=5`);
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const chartPlaylist = searchData.data?.find((p: any) => 
        p.title?.toLowerCase().includes('top') && 
        p.title?.toLowerCase().includes(countryNames[country]?.toLowerCase() || country)
      );
      
      if (chartPlaylist) {
        // Fetch the playlist tracks
        const playlistRes = await fetch(`https://api.deezer.com/playlist/${chartPlaylist.id}/tracks?limit=50`);
        if (playlistRes.ok) {
          const playlistData = await playlistRes.json();
          if (playlistData.data?.length) {
            playlists.push({
              id: `deezer-top-${country}`,
              name: `Top 50 ${countryNames[country] || country}`,
              description: `Top tracks in ${countryNames[country] || country}`,
              source: 'deezer',
              tracks: playlistData.data.map((t: any) => ({
                title: t.title,
                artist: t.artist?.name || 'Unknown',
                album: t.album?.title,
                source: 'deezer' as const,
              })),
            });
          }
        }
      }
    }
  }

  return playlists;
}

async function fetchDeezerDecadePlaylists(): Promise<DiscoveryPlaylist[]> {
  const playlists: DiscoveryPlaylist[] = [];
  
  const decades = [
    { query: '80s hits', name: '80s Hits', description: 'Best of the 1980s' },
    { query: '90s hits', name: '90s Hits', description: 'Best of the 1990s' },
    { query: '2000s hits', name: '2000s Hits', description: 'Best of the 2000s' },
    { query: '2010s hits', name: '2010s Hits', description: 'Best of the 2010s' },
  ];
  
  for (const decade of decades) {
    try {
      const searchRes = await fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(decade.query)}&limit=10`);
      if (!searchRes.ok) continue;
      
      const searchData = await searchRes.json();
      // Sort by number of fans (popularity) and pick the most popular
      const sortedPlaylists = (searchData.data || [])
        .filter((p: any) => p.title?.toLowerCase().includes('hits') || p.title?.toLowerCase().includes(decade.query.split(' ')[0]))
        .sort((a: any, b: any) => (b.nb_tracks || 0) - (a.nb_tracks || 0));
      
      const playlist = sortedPlaylists[0];
      
      if (playlist) {
        const tracksRes = await fetch(`https://api.deezer.com/playlist/${playlist.id}/tracks?limit=50`);
        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          if (tracksData.data?.length) {
            playlists.push({
              id: `deezer-${decade.query.replace(/\s+/g, '-')}`,
              name: decade.name,
              description: decade.description,
              source: 'deezer',
              tracks: tracksData.data.map((t: any) => ({
                title: t.title,
                artist: t.artist?.name || 'Unknown',
                album: t.album?.title,
                source: 'deezer' as const,
              })),
            });
          }
        }
      }
    } catch {
      // Skip this decade on error
    }
  }
  
  return playlists;
}

async function fetchDeezerGenrePlaylists(): Promise<DiscoveryPlaylist[]> {
  const playlists: DiscoveryPlaylist[] = [];
  
  // Popular genres and decade+genre combos
  const genres = [
    { query: 'pop hits', name: 'Pop Hits', description: 'Top pop tracks' },
    { query: 'rock hits', name: 'Rock Hits', description: 'Top rock tracks' },
    { query: 'hip hop hits', name: 'Hip-Hop Hits', description: 'Top hip-hop tracks' },
    { query: 'r&b hits', name: 'R&B Hits', description: 'Top R&B tracks' },
    { query: 'country hits', name: 'Country Hits', description: 'Top country tracks' },
    { query: 'dance hits', name: 'Dance Hits', description: 'Top dance tracks' },
    // Decade + Genre combos
    { query: '80s rock', name: '80s Rock', description: 'Rock hits from the 1980s' },
    { query: '90s hip hop', name: '90s Hip-Hop', description: 'Hip-hop hits from the 1990s' },
    { query: '90s rock', name: '90s Rock', description: 'Rock hits from the 1990s' },
    { query: '2000s pop', name: '2000s Pop', description: 'Pop hits from the 2000s' },
    { query: '2000s hip hop', name: '2000s Hip-Hop', description: 'Hip-hop hits from the 2000s' },
  ];
  
  for (const genre of genres) {
    try {
      const searchRes = await fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(genre.query)}&limit=10`);
      if (!searchRes.ok) continue;
      
      const searchData = await searchRes.json();
      // Sort by track count to get most popular
      const sortedPlaylists = (searchData.data || [])
        .filter((p: any) => p.nb_tracks >= 20)
        .sort((a: any, b: any) => (b.nb_tracks || 0) - (a.nb_tracks || 0));
      
      const playlist = sortedPlaylists[0];
      
      if (playlist) {
        const tracksRes = await fetch(`https://api.deezer.com/playlist/${playlist.id}/tracks?limit=50`);
        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          if (tracksData.data?.length >= 10) {
            playlists.push({
              id: `genre-${genre.query.replace(/\s+/g, '-')}`,
              name: genre.name,
              description: genre.description,
              source: 'deezer',
              tracks: tracksData.data.map((t: any) => ({
                title: t.title,
                artist: t.artist?.name || 'Unknown',
                album: t.album?.title,
                source: 'deezer' as const,
              })),
            });
          }
        }
      }
    } catch {
      // Skip on error
    }
  }
  
  return playlists;
}

async function fetchLastfmCharts(country: string): Promise<DiscoveryPlaylist[]> {
  const playlists: DiscoveryPlaylist[] = [];
  const apiKey = 'b25b959554ed76058ac220b7b2e0a026'; // Public demo key

  // Country top tracks
  const countryName = LASTFM_COUNTRIES[country] || 'united states';
  const displayName = countryName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  const geoRes = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=geo.gettoptracks&country=${encodeURIComponent(countryName)}&api_key=${apiKey}&format=json&limit=50`
  );
  if (geoRes.ok) {
    const data = await geoRes.json();
    const tracks = data.tracks?.track || [];
    if (tracks.length) {
      playlists.push({
        id: `lastfm-top-${country}`,
        name: `Top Scrobbled - ${displayName}`,
        description: `Most scrobbled in ${displayName}`,
        source: 'lastfm',
        tracks: tracks.map((t: any) => ({
          title: t.name,
          artist: t.artist?.name || 'Unknown',
          source: 'lastfm' as const,
        })),
      });
    }
  }

  // Global chart
  const globalRes = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${apiKey}&format=json&limit=50`
  );
  if (globalRes.ok) {
    const data = await globalRes.json();
    const tracks = data.tracks?.track || [];
    if (tracks.length) {
      playlists.push({
        id: 'lastfm-global',
        name: 'Top Scrobbled - Global',
        description: 'Most scrobbled worldwide',
        source: 'lastfm',
        tracks: tracks.map((t: any) => ({
          title: t.name,
          artist: t.artist?.name || 'Unknown',
          source: 'lastfm' as const,
        })),
      });
    }
  }

  return playlists;
}

// ==================== MATCHING (ported from matching.py) ====================

/**
 * Clean track title - remove feat/featuring, remaster suffixes, parenthetical extras
 */
function cleanTrackTitle(title: string): string {
  if (!title) return '';
  
  let cleaned = title;
  
  // Remove remaster/remastered suffixes FIRST (before other cleaning)
  // Handles: "- Remastered 2010", "- 2004 Remaster", "- Remastered", "(Remastered 1999)"
  const remasterPatterns = [
    /\s*-\s*remastered\s*\d{4}/gi,
    /\s*-\s*\d{4}\s*remaster(ed)?/gi,
    /\s*-\s*remaster(ed)?/gi,
    /\s*\(remaster(ed)?\s*\d{4}\)/gi,
    /\s*\(remaster(ed)?\)/gi,
    /\s*\[\remaster(ed)?\s*\d{4}\]/gi,
    /\s*\[remaster(ed)?\]/gi,
  ];
  
  for (const pattern of remasterPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove feat/featuring variations (including content after them)
  const featPatterns = [
    /\s*\(feat\.?\s+[^)]+\)/gi,
    /\s*\(ft\.?\s+[^)]+\)/gi,
    /\s*\(featuring\s+[^)]+\)/gi,
    /\s*\(with\s+[^)]+\)/gi,
    /\s*\[feat\.?\s+[^\]]+\]/gi,
    /\s*\[ft\.?\s+[^\]]+\]/gi,
    /\s*-\s*feat\.?\s+.+$/gi,
    /\s*-\s*ft\.?\s+.+$/gi,
    /\s*feat\.?\s+.+$/gi,
    /\s*ft\.?\s+.+$/gi,
    /\s*featuring\s+.+$/gi,
  ];
  
  for (const pattern of featPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove common suffixes in parentheses that cause mismatches
  const suffixPatterns = [
    /\s*\(radio edit[^)]*\)/gi,
    /\s*\(single version[^)]*\)/gi,
    /\s*\(album version[^)]*\)/gi,
    /\s*\(original[^)]*\)/gi,
    /\s*\(explicit[^)]*\)/gi,
    /\s*\(clean[^)]*\)/gi,
  ];
  
  for (const pattern of suffixPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[\s\-\(\)\[\]]+|[\s\-\(\)\[\]]+$/g, '');
  
  return cleaned;
}

/**
 * Get the core title without any parenthetical content
 */
function getCoreTitle(title: string): string {
  // Remove everything in parentheses and brackets
  let core = title.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '');
  return core.replace(/\s+/g, ' ').trim();
}

/**
 * Check if title has a version suffix like (Radio Edit), (Album Version), (2000 Version)
 */
function hasVersionSuffix(title: string): boolean {
  const versionPatterns = [
    /\(radio\s*edit[^)]*\)/i,
    /\(album\s*version[^)]*\)/i,
    /\(single\s*version[^)]*\)/i,
    /\(original[^)]*\)/i,
    /\(explicit[^)]*\)/i,
    /\(clean[^)]*\)/i,
    /\(extended[^)]*\)/i,
    /\(remix[^)]*\)/i,
    /\(\d{4}\s*version[^)]*\)/i,  // (2000 Version)
    /\(\d{4}\s*remaster[^)]*\)/i, // (2000 Remaster)
    /\(remaster[^)]*\)/i,
  ];
  
  return versionPatterns.some(pattern => pattern.test(title));
}

/**
 * Check if title is a Mono version - these should be deprioritized
 */
function isMonoVersion(title: string): boolean {
  // Match "Mono" in parentheses or brackets: (Mono), (Mono Mix), [Mono], etc.
  const monoPatterns = [
    /\(mono[^)]*\)/i,
    /\[mono[^\]]*\]/i,
    /\s+-\s+mono\s*(mix|version)?$/i,
  ];
  
  return monoPatterns.some(pattern => pattern.test(title));
}

/**
 * Extract the actual track title from formats like "01 - Artist - Title" or "01. Title"
 */
function extractTrackTitle(title: string): string {
  // Handle "01 - Artist - Title (Radio Edit)" format
  // Match: number followed by separator, then possibly artist, then title
  const trackNumArtistMatch = title.match(/^\d+\s*[-\.]\s*[^-]+\s*-\s*(.+)$/);
  if (trackNumArtistMatch) {
    return trackNumArtistMatch[1].trim();
  }
  
  // Handle "01 - Title" or "01. Title" format
  const trackNumMatch = title.match(/^\d+\s*[-\.]\s*(.+)$/);
  if (trackNumMatch) {
    return trackNumMatch[1].trim();
  }
  
  return title;
}

/**
 * Clean artist name - remove featured artists and extract primary artist only
 */
function cleanArtistName(artist: string): string {
  if (!artist) return '';
  
  let cleaned = artist;
  
  // FIRST: Extract only the first artist from comma-separated list
  // "Timmy Trumpet, POLTERGST, Naeleck" -> "Timmy Trumpet"
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }
  
  // Remove feat/featuring patterns
  // "Gwen Stefani Feat. Blake Shelton" -> "Gwen Stefani"
  const featPatterns = [
    /\s+feat\.?\s+.+$/gi,   // " Feat. Blake Shelton" or " feat Blake"
    /\s+ft\.?\s+.+$/gi,     // " Ft. Someone" or " ft someone"
    /\s+featuring\s+.+$/gi, // " featuring Someone"
  ];
  
  for (const pattern of featPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Handle "x" separator: "Hugel x Topic x Arash" -> "Hugel"
  const xMatch = cleaned.match(/^([^x]+?)\s+x\s+/i);
  if (xMatch) {
    cleaned = xMatch[1].trim();
  }
  
  // Remove "& Other Artist" but keep the primary artist
  cleaned = cleaned.replace(/\s*&\s+.+$/gi, '');
  cleaned = cleaned.replace(/\s+and\s+.+$/gi, '');
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[\s\-,&\(\)\[\]]+|[\s\-,&\(\)\[\]]+$/g, '');
  
  return cleaned.length > 0 ? cleaned : artist;
}

/**
 * Normalize string for comparison - lowercase, remove special chars, normalize accents
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    // Normalize accented characters (é→e, ñ→n, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove ALL apostrophe variants entirely (ain't → aint)
    .replace(/[\u2018\u2019\u201A\u201B\u0027\u0060\u00B4'`´]/g, '')
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '') // Remove quotes too
    .replace(/\$/g, 's') // $ign -> sign
    .replace(/\//g, '')  // AC/DC -> ACDC
    .replace(/\./g, '')  // T.N.T. -> TNT
    .replace(/[^a-z0-9\s]/g, '') // Remove all special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple word-based matching
 */
function wordsMatch(a: string, b: string, threshold = 0.5): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  
  let matches = 0;
  for (const wordA of wordsA) {
    for (const wordB of wordsB) {
      if (wordA === wordB || wordA.includes(wordB) || wordB.includes(wordA)) {
        matches++;
        break;
      }
    }
  }
  
  const minWords = Math.min(wordsA.length, wordsB.length);
  return matches >= minWords * threshold;
}

/**
 * Check if titles are similar enough
 */
function titlesMatch(sourceTitle: string, plexTitle: string): boolean {
  // First, try to extract actual title from "01 - Artist - Title" format
  const extractedPlexTitle = extractTrackTitle(plexTitle);
  
  const cleanSource = normalizeForComparison(cleanTrackTitle(sourceTitle));
  const cleanPlex = normalizeForComparison(cleanTrackTitle(extractedPlexTitle));
  
  // Exact match after cleaning
  if (cleanSource === cleanPlex) return true;
  
  // Match without spaces (handles "Funky Town" vs "Funkytown")
  const noSpaceSource = cleanSource.replace(/\s+/g, '');
  const noSpacePlex = cleanPlex.replace(/\s+/g, '');
  if (noSpaceSource === noSpacePlex && noSpaceSource.length >= 3) return true;
  
  // Core title match (without parentheses) - this is key for variants
  const coreSource = normalizeForComparison(getCoreTitle(sourceTitle));
  const corePlex = normalizeForComparison(getCoreTitle(extractedPlexTitle));
  if (coreSource === corePlex && coreSource.length >= 3) return true;
  
  // Core match without spaces
  const coreNoSpaceSource = coreSource.replace(/\s+/g, '');
  const coreNoSpacePlex = corePlex.replace(/\s+/g, '');
  if (coreNoSpaceSource === coreNoSpacePlex && coreNoSpaceSource.length >= 3) return true;
  
  // One contains the other (cleaned versions)
  if (cleanSource.includes(cleanPlex) || cleanPlex.includes(cleanSource)) return true;
  
  // Core contains core
  if (coreSource.length >= 3 && corePlex.length >= 3) {
    if (coreSource.includes(corePlex) || corePlex.includes(coreSource)) return true;
  }
  
  // Word-based matching on cleaned titles
  if (wordsMatch(cleanSource, cleanPlex, 0.6)) return true;
  
  // Word-based matching on core titles (more lenient)
  if (wordsMatch(coreSource, corePlex, 0.7)) return true;
  
  return false;
}

/**
 * Check if artists match
 */
function artistsMatch(sourceArtist: string, plexArtist: string): boolean {
  const cleanSource = normalizeForComparison(cleanArtistName(sourceArtist));
  const cleanPlex = normalizeForComparison(cleanArtistName(plexArtist));
  
  // Exact match
  if (cleanSource === cleanPlex) return true;
  
  // One contains the other (handles "Elton John" matching "Elton John, Dua Lipa")
  if (cleanSource.includes(cleanPlex) || cleanPlex.includes(cleanSource)) return true;
  
  // Check if primary artist matches (first artist before comma or &)
  const primarySource = cleanSource.split(/[,&]/)[0].trim();
  const primaryPlex = cleanPlex.split(/[,&]/)[0].trim();
  if (primarySource === primaryPlex && primarySource.length > 2) return true;
  
  // Word match
  if (wordsMatch(cleanSource, cleanPlex, 0.5)) return true;
  
  // Check if source artist appears anywhere in plex artist string
  if (cleanPlex.includes(primarySource) && primarySource.length > 3) return true;
  if (cleanSource.includes(primaryPlex) && primaryPlex.length > 3) return true;
  
  return false;
}

/**
 * Check if artist name appears in a track title (for badly tagged files like "01 - Artist - Title")
 */
function artistInTitle(sourceArtist: string, plexTitle: string): boolean {
  const cleanArtist = normalizeForComparison(cleanArtistName(sourceArtist));
  const cleanTitle = normalizeForComparison(plexTitle);
  
  return cleanTitle.includes(cleanArtist) && cleanArtist.length > 3;
}

// ==================== PLEX MATCHING ====================

export async function matchPlaylistToPlex(
  playlist: DiscoveryPlaylist,
  serverUrl: string,
  searchFn: (data: { serverUrl: string; query: string }) => Promise<any[]>,
  onProgress?: (current: number, total: number, trackName: string) => void
): Promise<MatchedPlaylist> {
  const matchedTracks: MatchedTrack[] = [];
  const total = playlist.tracks.length;

  for (let i = 0; i < playlist.tracks.length; i++) {
    const track = playlist.tracks[i];
    onProgress?.(i + 1, total, `${track.artist} - ${track.title}`);
    const match = await findBestMatch(track, serverUrl, searchFn);
    matchedTracks.push({
      title: track.title,
      artist: track.artist,
      matched: match !== null,
      plexRatingKey: match?.ratingKey,
      plexTitle: match?.plexTitle,
      plexArtist: match?.plexArtist,
      score: match?.score,
    });
  }

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    source: playlist.source,
    tracks: matchedTracks,
    matchedCount: matchedTracks.filter(t => t.matched).length,
    totalCount: matchedTracks.length,
  };
}

async function findBestMatch(
  track: ExternalTrack,
  serverUrl: string,
  searchFn: (data: { serverUrl: string; query: string }) => Promise<any[]>
): Promise<{ ratingKey: string; score: number; plexTitle: string; plexArtist: string } | null> {
  try {
    // Skip very short titles (but allow acronyms like "T.N.T." which become "tnt")
    const titleWithoutPunctuation = track.title.replace(/[^a-zA-Z0-9]/g, '');
    if (titleWithoutPunctuation.length < 2) {
      return null;
    }
    
    const cleanedArtist = cleanArtistName(track.artist);
    const coreTitle = getCoreTitle(track.title);
    
    // Normalize for search - remove accents, handle special chars
    const normalizeSearch = (s: string) => s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents (é→e, ë→e)
      .replace(/[\u2018\u2019\u201A\u201B\u0027\u0060\u00B4'`´]/g, '') // Remove all apostrophe variants
      .replace(/\//g, ' ')             // AC/DC -> AC DC
      .replace(/\./g, '')              // T.N.T. -> TNT
      .replace(/[^\w\s\-]/g, ' ')      // Keep hyphens
      .replace(/\s+/g, ' ')
      .trim();
    
    const searchTitle = normalizeSearch(coreTitle);
    const searchArtist = normalizeSearch(cleanedArtist);
    const originalTitle = normalizeSearch(track.title);
    
    // Also try without hyphen for cases where Plex has "Jay Z" vs "JAY-Z"
    const searchArtistNoHyphen = searchArtist.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Search with artist first - Plex prioritizes earlier terms
    // For short titles, also try just the title alone
    const searchQueries = [
      `${searchArtist} ${searchTitle}`,
      `${searchArtistNoHyphen} ${searchTitle}`,
      `${searchArtist} ${originalTitle}`,
      `${searchTitle} ${searchArtist}`,
      searchTitle, // Title-only search as fallback for common titles with different artists
    ];
    
    // For long titles, also try first few words + artist (helps with "It's Beginning To Look A Lot Like Christmas")
    const titleWords = searchTitle.split(' ');
    if (titleWords.length > 4) {
      const shortTitle = titleWords.slice(0, 4).join(' ');
      searchQueries.push(`${searchArtist} ${shortTitle}`);
      searchQueries.push(`${shortTitle} ${searchArtist}`);
    }
    
    // For short titles (like "TNT"), add exact title in quotes
    if (searchTitle.length <= 5) {
      searchQueries.push(`"${track.title}"`);
    }
    
    // Also try artist-only search as fallback (helps when track name = album name)
    searchQueries.push(searchArtist);
    
    // Remove duplicates
    const uniqueQueries = [...new Set(searchQueries)].filter(q => q.trim().length > 1);
    
    const allResults: any[] = [];
    for (const query of uniqueQueries) {
      const results = await searchFn({ serverUrl, query });
      for (const r of results) {
        if (!allResults.some(existing => existing.ratingKey === r.ratingKey)) {
          allResults.push(r);
        }
      }
    }
    
    if (!allResults.length) return null;
    
    // Find best match - STRONGLY prefer album artist matches over Various Artists
    let bestMatch: { ratingKey: string; score: number; plexTitle: string; plexArtist: string } | null = null;
    let bestInternalScore = -Infinity;

    for (const result of allResults) {
      const plexTitle = result.title || '';
      const albumArtist = result.grandparentTitle || '';
      const trackArtist = result.originalTitle || '';
      
      // Check if this is a Various Artists / compilation album
      const isVariousArtists = albumArtist.toLowerCase() === 'various artists' || 
                               albumArtist.toLowerCase() === 'various' ||
                               albumArtist.toLowerCase() === 'soundtrack' ||
                               albumArtist.toLowerCase() === 'original soundtrack';
      
      // Check title match first
      const titleMatches = titlesMatch(track.title, plexTitle);
      if (!titleMatches) continue;
      
      // Check artist matches - try album artist first, then track artist
      const albumArtistMatches = albumArtist && !isVariousArtists && artistsMatch(track.artist, albumArtist);
      const trackArtistMatches = trackArtist && artistsMatch(track.artist, trackArtist);
      // Also check if artist name is embedded in the title (for "01 - Artist - Title" format)
      const artistInTitleMatches = artistInTitle(track.artist, plexTitle);
      
      if (!albumArtistMatches && !trackArtistMatches && !artistInTitleMatches) continue;
      
      // Calculate base score
      const plexArtist = albumArtistMatches ? albumArtist : trackArtist;
      let score = calculateMatchScore(track.title, track.artist, plexTitle, plexArtist);
      
      // STRONGLY prefer album artist matches (non-Various Artists)
      // This ensures we pick "Raye - Raye" over "Various Artists - Now That's What I Call Music"
      if (albumArtistMatches) {
        score += 50; // Big bonus for proper album artist match
      } else if (isVariousArtists) {
        score -= 30; // Penalty for Various Artists compilations
      }
      
      // Prefer tracks without version suffixes if source doesn't have them
      // But still match them as fallback
      const sourceHasVersionSuffix = hasVersionSuffix(track.title);
      const plexHasVersionSuffix = hasVersionSuffix(plexTitle);
      
      if (!sourceHasVersionSuffix && plexHasVersionSuffix) {
        // Source is "SOS", Plex is "SOS (Radio Edit)" - small penalty, still match
        score -= 10;
      } else if (sourceHasVersionSuffix && !plexHasVersionSuffix) {
        // Source is "SOS (Radio Edit)", Plex is "SOS" - prefer the clean version
        score -= 5;
      }
      
      // STRONGLY deprioritize Mono versions - prefer stereo/regular versions
      // "Fly Me High (Mono Mix)" should lose to "Fly Me High"
      const plexIsMonoVersion = isMonoVersion(plexTitle);
      if (plexIsMonoVersion) {
        score -= 40; // Big penalty for Mono versions
      }
      
      if (score > bestInternalScore) {
        bestInternalScore = score;
        const plexArtistName = albumArtistMatches ? albumArtist : (trackArtist || albumArtist);
        // Cap display score at 100 (internal score can be higher for ranking)
        const displayScore = Math.min(score, 100);
        bestMatch = { ratingKey: result.ratingKey, score: displayScore, plexTitle, plexArtist: plexArtistName };
      }
    }

    return bestMatch;
  } catch {
    return null;
  }
}

/**
 * Calculate a display score (0-100) for matched tracks
 */
function calculateMatchScore(sourceTitle: string, sourceArtist: string, plexTitle: string, plexArtist: string): number {
  const cleanSourceTitle = cleanTrackTitle(sourceTitle).toLowerCase();
  const cleanPlexTitle = cleanTrackTitle(plexTitle).toLowerCase();
  const cleanSourceArtist = cleanArtistName(sourceArtist).toLowerCase();
  const cleanPlexArtist = cleanArtistName(plexArtist).toLowerCase();
  
  // Title score
  let titleScore = 0;
  if (cleanSourceTitle === cleanPlexTitle) {
    titleScore = 100;
  } else if (cleanSourceTitle.includes(cleanPlexTitle) || cleanPlexTitle.includes(cleanSourceTitle)) {
    titleScore = 90;
  } else {
    // Word overlap score
    const sourceWords = cleanSourceTitle.split(/\s+/);
    const plexWords = cleanPlexTitle.split(/\s+/);
    const matches = sourceWords.filter(w => plexWords.some(pw => pw.includes(w) || w.includes(pw))).length;
    titleScore = Math.round((matches / Math.max(sourceWords.length, plexWords.length)) * 80);
  }
  
  // Artist score
  let artistScore = 0;
  if (cleanSourceArtist === cleanPlexArtist) {
    artistScore = 100;
  } else if (cleanSourceArtist.includes(cleanPlexArtist) || cleanPlexArtist.includes(cleanSourceArtist)) {
    artistScore = 90;
  } else {
    artistScore = 70; // Partial match
  }
  
  // Combined: 70% title, 30% artist
  return Math.round(titleScore * 0.7 + artistScore * 0.3);
}
