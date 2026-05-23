import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createValidationError, createInternalError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { PlexClient } from '../services/plex';

const router = Router();

// All export routes require authentication
router.use(requireAuth);

/**
 * POST /api/playlists/export
 * Export a playlist to various formats
 */
router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playlistId, format, pathType } = req.body;

    if (!playlistId || typeof playlistId !== 'string') {
      return next(createValidationError('playlistId is required'));
    }

    if (!format || !['m3u', 'm3u8', 'pls', 'xspf', 'csv'].includes(format)) {
      return next(createValidationError('Invalid format'));
    }

    const userId = req.session.userId!;
    const db = req.dbService!;

    // Get user's Plex token
    const userRow = (db as any).db.prepare('SELECT plex_token FROM users WHERE id = ?').get(userId);
    if (!userRow) {
      return next(createValidationError('User not found'));
    }

    const { plex_token: plexToken } = userRow;
    if (!plexToken) {
      return next(createValidationError('No Plex token found'));
    }

    // Get user's server configuration
    const serverRow = (db as any).db.prepare('SELECT server_url FROM user_servers WHERE user_id = ? LIMIT 1').get(userId);
    if (!serverRow) {
      return next(createValidationError('No Plex server configured'));
    }

    const { server_url: serverUrl } = serverRow;

    // Create Plex client
    const plexClient = new PlexClient(serverUrl, plexToken);

    // Get playlist details
    const playlistDetails = await plexClient.getPlaylistDetails(playlistId);
    if (!playlistDetails) {
      return next(createValidationError('Playlist not found'));
    }

    // Get playlist tracks
    const tracks = await plexClient.getPlaylistTracks(playlistId);

    logger.info(`Exporting playlist: ${playlistDetails.title} (${tracks.length} tracks) to ${format}`);

    // Generate the export content based on format
    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case 'm3u':
        content = generateM3U(tracks, playlistDetails.title, pathType === 'relative');
        contentType = 'audio/x-mpegurl';
        extension = 'm3u';
        break;
      case 'm3u8':
        content = generateM3U8(tracks, playlistDetails.title, pathType === 'relative');
        contentType = 'application/vnd.apple.mpegurl';
        extension = 'm3u8';
        break;
      case 'pls':
        content = generatePLS(tracks, playlistDetails.title);
        contentType = 'audio/x-scpls';
        extension = 'pls';
        break;
      case 'xspf':
        content = generateXSPF(tracks, playlistDetails.title);
        contentType = 'application/xspf+xml';
        extension = 'xspf';
        break;
      case 'csv':
        content = generateCSV(tracks);
        contentType = 'text/csv';
        extension = 'csv';
        break;
      default:
        return next(createValidationError('Unsupported format'));
    }

    // Send the file
    const filename = `${sanitizeFilename(playlistDetails.title)}.${extension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);

  } catch (error: any) {
    logger.error('Failed to export playlist', { error: error.message });
    next(createInternalError(`Failed to export playlist: ${error.message}`));
  }
});

/**
 * Generate M3U format
 */
function generateM3U(tracks: any[], playlistName: string, relative: boolean): string {
  let content = '#EXTM3U\n';
  content += `#PLAYLIST:${playlistName}\n`;

  for (const track of tracks) {
    const duration = Math.floor((track.duration || 0) / 1000);
    const artist = track.grandparentTitle || 'Unknown Artist';
    const title = track.title || 'Unknown Track';
    const filePath = getTrackPath(track, relative);

    content += `#EXTINF:${duration},${artist} - ${title}\n`;
    content += `${filePath}\n`;
  }

  return content;
}

/**
 * Generate M3U8 format (UTF-8 encoded M3U)
 */
function generateM3U8(tracks: any[], playlistName: string, relative: boolean): string {
  // M3U8 is the same as M3U but with UTF-8 encoding
  return generateM3U(tracks, playlistName, relative);
}

/**
 * Generate PLS format
 */
function generatePLS(tracks: any[], playlistName: string): string {
  let content = '[playlist]\n';
  content += `PlaylistName=${playlistName}\n`;
  content += `NumberOfEntries=${tracks.length}\n\n`;

  tracks.forEach((track, index) => {
    const num = index + 1;
    const filePath = getTrackPath(track, false);
    const title = `${track.grandparentTitle || 'Unknown'} - ${track.title || 'Unknown'}`;
    const duration = Math.floor((track.duration || 0) / 1000);

    content += `File${num}=${filePath}\n`;
    content += `Title${num}=${title}\n`;
    content += `Length${num}=${duration}\n\n`;
  });

  content += 'Version=2\n';
  return content;
}

/**
 * Generate XSPF format (XML)
 */
function generateXSPF(tracks: any[], playlistName: string): string {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
  content += '<playlist version="1" xmlns="http://xspf.org/ns/0/">\n';
  content += `  <title>${escapeXml(playlistName)}</title>\n`;
  content += '  <trackList>\n';

  for (const track of tracks) {
    const filePath = getTrackPath(track, false);
    const title = track.title || 'Unknown Track';
    const artist = track.grandparentTitle || 'Unknown Artist';
    const album = track.parentTitle || 'Unknown Album';
    const duration = track.duration || 0;

    content += '    <track>\n';
    content += `      <location>file://${escapeXml(filePath)}</location>\n`;
    content += `      <title>${escapeXml(title)}</title>\n`;
    content += `      <creator>${escapeXml(artist)}</creator>\n`;
    content += `      <album>${escapeXml(album)}</album>\n`;
    content += `      <duration>${duration}</duration>\n`;
    if (track.index) {
      content += `      <trackNum>${track.index}</trackNum>\n`;
    }
    content += '    </track>\n';
  }

  content += '  </trackList>\n';
  content += '</playlist>\n';
  return content;
}

/**
 * Generate CSV format
 */
function generateCSV(tracks: any[]): string {
  let content = 'Track,Artist,Album,Duration,File Path\n';

  for (const track of tracks) {
    const title = escapeCSV(track.title || 'Unknown Track');
    const artist = escapeCSV(track.grandparentTitle || 'Unknown Artist');
    const album = escapeCSV(track.parentTitle || 'Unknown Album');
    const duration = formatDuration(track.duration || 0);
    const filePath = escapeCSV(getTrackPath(track, false));

    content += `${title},${artist},${album},${duration},${filePath}\n`;
  }

  return content;
}

/**
 * Get the file path for a track
 */
function getTrackPath(track: any, relative: boolean): string {
  const part = track.Media?.[0]?.Part?.[0];
  if (!part || !part.file) {
    return '';
  }

  let filePath = part.file;

  if (relative) {
    // Convert to relative path (remove leading slash and add ../)
    filePath = filePath.replace(/^\//, '../');
  }

  return filePath;
}

/**
 * Sanitize filename for safe file system usage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape CSV special characters
 */
function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format duration in milliseconds to MM:SS
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default router;
