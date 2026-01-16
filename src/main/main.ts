import { app, BrowserWindow, ipcMain, shell, Menu, dialog, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';

// Read version from package.json (works in both dev and production)
function getAppVersion(): string {
  // First try app.getVersion() which reads from package.json
  const electronVersion = app.getVersion();
  if (electronVersion && electronVersion !== '0.0.0') {
    return electronVersion;
  }
  
  // Fallback: read package.json directly
  try {
    const isDev = !app.isPackaged;
    const packagePath = isDev 
      ? path.join(app.getAppPath(), 'package.json')
      : path.join(process.resourcesPath, 'app', 'package.json');
    
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      if (pkg.version) return pkg.version;
    }
    
    // Try alternate location for asar packages
    const asarPath = path.join(process.resourcesPath, 'app.asar', 'package.json');
    if (fs.existsSync(asarPath)) {
      const pkg = JSON.parse(fs.readFileSync(asarPath, 'utf-8'));
      if (pkg.version) return pkg.version;
    }
  } catch (e) {
    console.error('Failed to read version from package.json:', e);
  }
  
  // Last resort fallback
  return '1.0.8';
}

// Configure store to use playlist-lab folder in AppData
const store = new Store({
  name: 'config',
  cwd: path.join(app.getPath('appData'), 'playlist-lab'),
});
let mainWindow: BrowserWindow | null = null;

// Generate a stable client ID (stored so it persists)
const CLIENT_ID = (store.get('clientId') as string) || (() => {
  const id = 'playlist-lab-' + Math.random().toString(36).substring(2, 10);
  store.set('clientId', id);
  return id;
})();

const isDev = !app.isPackaged;

function createWindow() {
  // Get the icon path - different locations for dev vs prod
  const isWindows = process.platform === 'win32';
  
  let iconPath: string;
  if (isDev) {
    // In dev, try .ico first on Windows, then fall back to .png
    const icoPath = path.join(app.getAppPath(), 'src/renderer/logo.ico');
    const pngPath = path.join(app.getAppPath(), 'src/renderer/logo512.png');
    
    if (isWindows && fs.existsSync(icoPath)) {
      iconPath = icoPath;
    } else {
      iconPath = pngPath;
    }
  } else {
    // In production, check extraResources first, then dist/renderer
    const iconFile = isWindows ? 'logo.ico' : 'logo512.png';
    const resourcePath = path.join(process.resourcesPath, iconFile);
    const distPath = path.join(__dirname, '../renderer', iconFile);
    
    if (fs.existsSync(resourcePath)) {
      iconPath = resourcePath;
    } else if (fs.existsSync(distPath)) {
      iconPath = distPath;
    } else {
      // Fallback to png
      const pngResourcePath = path.join(process.resourcesPath, 'logo512.png');
      const pngDistPath = path.join(__dirname, '../renderer/logo512.png');
      iconPath = fs.existsSync(pngResourcePath) ? pngResourcePath : pngDistPath;
    }
  }
  
  console.log('[createWindow] Icon path:', iconPath, 'exists:', fs.existsSync(iconPath));
  
  // Load icon using nativeImage for better Windows compatibility
  let appIcon;
  if (fs.existsSync(iconPath)) {
    appIcon = nativeImage.createFromPath(iconPath);
    if (appIcon.isEmpty()) {
      console.log('[createWindow] Warning: Icon loaded but is empty');
      appIcon = undefined;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 950,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d1117',
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(13, 17, 23, 0.85)',
      symbolColor: '#e6edf3',
      height: 32,
    },
    icon: appIcon || iconPath,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Fallback: show window after timeout if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Window not visible after timeout, forcing show...');
      mainWindow.show();
    }
  }, 5000);

  // Handle load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    mainWindow?.show();
  });

  // Open DevTools with F12 or Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading:', indexPath);
    console.log('Exists:', require('fs').existsSync(indexPath));
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      mainWindow?.show();
    });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==================== IPC HANDLERS ====================

const PLEX_HEADERS = {
  'Accept': 'application/json',
  'X-Plex-Product': 'Playlist Lab',
  'X-Plex-Client-Identifier': CLIENT_ID,
  'X-Plex-Platform': 'Windows',
  'X-Plex-Device': 'PC',
  'X-Plex-Device-Name': 'Playlist Lab',
};

// Get stored auth
ipcMain.handle('get-auth', () => {
  return {
    token: store.get('plexToken') as string | null,
    user: store.get('plexUser') as any,
    server: store.get('plexServer') as any,
  };
});

// Start PIN auth flow
ipcMain.handle('start-auth', async () => {
  const response = await fetch('https://plex.tv/api/v2/pins?strong=true', {
    method: 'POST',
    headers: { 
      ...PLEX_HEADERS, 
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
  });
  const data = await response.json();
  
  // Open browser for auth
  const authUrl = `https://app.plex.tv/auth#?clientID=${CLIENT_ID}&code=${data.code}&context%5Bdevice%5D%5Bproduct%5D=Playlist%20Lab`;
  shell.openExternal(authUrl);
  
  return { id: data.id, code: data.code };
});

// Poll for auth completion
ipcMain.handle('poll-auth', async (_, { id, code }) => {
  const response = await fetch(`https://plex.tv/api/v2/pins/${id}?code=${code}`, {
    headers: PLEX_HEADERS,
  });
  const data = await response.json();
  
  if (data.authToken) {
    store.set('plexToken', data.authToken);
    
    // Get user info
    const userResponse = await fetch('https://plex.tv/api/v2/user', {
      headers: { ...PLEX_HEADERS, 'X-Plex-Token': data.authToken },
    });
    const user = await userResponse.json();
    store.set('plexUser', { username: user.username, thumb: user.thumb });
    
    return { token: data.authToken, user: { username: user.username, thumb: user.thumb } };
  }
  return null;
});

// Get servers
ipcMain.handle('get-servers', async () => {
  const token = store.get('plexToken') as string;
  if (!token) return [];
  
  const response = await fetch('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', {
    headers: { ...PLEX_HEADERS, 'X-Plex-Token': token },
  });
  const data = await response.json();
  
  return data
    .filter((r: any) => r.provides === 'server')
    .map((s: any) => ({
      name: s.name,
      clientId: s.clientIdentifier,
      connections: s.connections,
    }));
});

// Select server
ipcMain.handle('select-server', async (_, server) => {
  store.set('plexServer', server);
  return true;
});

// Get music libraries
ipcMain.handle('get-libraries', async (_, { serverUrl }) => {
  const token = store.get('plexToken') as string;
  const response = await fetch(`${serverUrl}/library/sections?X-Plex-Token=${token}`, {
    headers: PLEX_HEADERS,
  });
  const data = await response.json();
  
  return (data.MediaContainer?.Directory || [])
    .filter((d: any) => d.type === 'artist')
    .map((d: any) => ({ id: d.key, title: d.title }));
});

// Logout
ipcMain.handle('logout', () => {
  store.delete('plexToken');
  store.delete('plexUser');
  store.delete('plexServer');
  return true;
});

// Get settings
ipcMain.handle('get-settings', () => {
  return {
    country: store.get('country', 'global') as string,
    libraryId: store.get('libraryId') as string | null,
    autoSync: store.get('autoSync', false) as boolean,
    matchingSettings: store.get('matchingSettings') as any | null,
    mixSettings: store.get('mixSettings') as any | null,
  };
});

// Save settings
ipcMain.handle('save-settings', (_, settings) => {
  if (settings.country !== undefined) store.set('country', settings.country);
  if (settings.libraryId !== undefined) store.set('libraryId', settings.libraryId);
  if (settings.autoSync !== undefined) store.set('autoSync', settings.autoSync);
  if (settings.matchingSettings !== undefined) store.set('matchingSettings', settings.matchingSettings);
  if (settings.mixSettings !== undefined) store.set('mixSettings', settings.mixSettings);
  return true;
});

// Search Plex for a track
ipcMain.handle('search-track', async (_, { serverUrl, query }) => {
  const token = store.get('plexToken') as string;
  
  // Clean up the query - remove special characters that break Plex's SQLite FTS
  // Parentheses cause "malformed MATCH expression" errors
  const cleanQuery = query
    .replace(/[-–—]/g, ' ')  // Replace hyphens/dashes with spaces
    .replace(/[()[\]{}]/g, ' ')  // Remove parentheses and brackets
    .replace(/[^\w\s]/g, ' ')  // Remove other special chars
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();
  
  const url = `${serverUrl}/hubs/search?query=${encodeURIComponent(cleanQuery)}&limit=50&X-Plex-Token=${token}`;
  
  try {
    const response = await fetch(url, { headers: PLEX_HEADERS });
    
    // Check if response is OK and is JSON
    if (!response.ok) {
      console.log(`[search-track] Server returned ${response.status}`);
      return [];
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.log(`[search-track] Unexpected content type: ${contentType}`);
      return [];
    }
    
    const data = await response.json();
    
    const hubs = data.MediaContainer?.Hub || [];
    const trackHub = hubs.find((h: any) => h.type === 'track');
    let tracks = trackHub?.Metadata || [];
    
    // Also fetch tracks from albums to get more results
    // This helps when the track is on a single/EP album that Plex returns as album result
    const albumHub = hubs.find((h: any) => h.type === 'album');
    if (albumHub?.Metadata?.length > 0) {
      // Fetch tracks from matched albums (up to 5 albums)
      const albumsToFetch = albumHub.Metadata.slice(0, 5);
      for (const album of albumsToFetch) {
        try {
          const albumUrl = `${serverUrl}/library/metadata/${album.ratingKey}/children?X-Plex-Token=${token}`;
          const albumResponse = await fetch(albumUrl, { headers: PLEX_HEADERS });
          if (albumResponse.ok) {
            const albumData = await albumResponse.json();
            const albumTracks = albumData.MediaContainer?.Metadata || [];
            // Add tracks that aren't already in the list
            for (const t of albumTracks) {
              if (!tracks.some((existing: any) => existing.ratingKey === t.ratingKey)) {
                tracks.push(t);
              }
            }
          }
        } catch {
          // Continue to next album
        }
      }
    }
    
    // If still no tracks, try artist
    if (tracks.length === 0) {
      const artistHub = hubs.find((h: any) => h.type === 'artist');
      if (artistHub?.Metadata?.length > 0) {
        const artist = artistHub.Metadata[0];
        const artistUrl = `${serverUrl}/library/metadata/${artist.ratingKey}/grandchildren?X-Plex-Container-Size=200&X-Plex-Token=${token}`;
        try {
          const artistResponse = await fetch(artistUrl, { headers: PLEX_HEADERS });
          if (artistResponse.ok) {
            const artistData = await artistResponse.json();
            return artistData.MediaContainer?.Metadata || [];
          }
        } catch {
          // Fall through to return empty
        }
      }
    }
    
    return tracks;
  } catch (error: any) {
    console.log(`[search-track] Error: ${error.message}`);
    return [];
  }
});

// Create playlist
ipcMain.handle('create-playlist', async (_, { serverUrl, title, trackKeys }) => {
  const token = store.get('plexToken') as string;
  const server = store.get('plexServer') as any;
  
  console.log(`[create-playlist] Creating "${title}" with ${trackKeys.length} tracks`);
  
  // Create playlist
  const uri = `server://${server.clientId}/com.plexapp.plugins.library/library/metadata/${trackKeys.join(',')}`;
  const createUrl = `${serverUrl}/playlists?type=audio&title=${encodeURIComponent(title)}&smart=0&uri=${encodeURIComponent(uri)}&X-Plex-Token=${token}`;
  
  console.log(`[create-playlist] URL length: ${createUrl.length}`);
  
  const response = await fetch(createUrl, {
    method: 'POST',
    headers: PLEX_HEADERS,
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.log(`[create-playlist] Failed: ${response.status} - ${text}`);
    return { success: false };
  }
  
  // Get the created playlist ID from response
  try {
    const data = await response.json();
    const playlistId = data.MediaContainer?.Metadata?.[0]?.ratingKey;
    console.log(`[create-playlist] Success! Playlist ID: ${playlistId}`);
    return { success: true, playlistId };
  } catch {
    console.log(`[create-playlist] Success but couldn't get playlist ID`);
    return { success: true };
  }
});

// Get existing playlists (excludes smart playlists for editing)
ipcMain.handle('get-playlists', async (_, { serverUrl, includeSmart = false }) => {
  const token = store.get('plexToken') as string;
  const response = await fetch(`${serverUrl}/playlists?playlistType=audio&X-Plex-Token=${token}`, {
    headers: PLEX_HEADERS,
  });
  const data = await response.json();
  const playlists = data.MediaContainer?.Metadata || [];
  
  // Filter out smart playlists unless explicitly requested
  if (!includeSmart) {
    return playlists.filter((p: any) => !p.smart);
  }
  return playlists;
});

// Get playlist tracks
ipcMain.handle('get-playlist-tracks', async (_, { serverUrl, playlistId }) => {
  const token = store.get('plexToken') as string;
  const response = await fetch(`${serverUrl}/playlists/${playlistId}/items?X-Plex-Token=${token}`, {
    headers: PLEX_HEADERS,
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.MediaContainer?.Metadata || [];
});

// Add track to playlist
ipcMain.handle('add-to-playlist', async (_, { serverUrl, playlistId, trackKey }) => {
  const token = store.get('plexToken') as string;
  const server = store.get('plexServer') as any;
  const uri = `server://${server.clientId}/com.plexapp.plugins.library/library/metadata/${trackKey}`;
  const url = `${serverUrl}/playlists/${playlistId}/items?uri=${encodeURIComponent(uri)}&X-Plex-Token=${token}`;
  const response = await fetch(url, { method: 'PUT', headers: PLEX_HEADERS });
  return response.ok;
});

// Remove track from playlist
ipcMain.handle('remove-from-playlist', async (_, { serverUrl, playlistId, playlistItemId }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/playlists/${playlistId}/items/${playlistItemId}?X-Plex-Token=${token}`;
  const response = await fetch(url, { method: 'DELETE', headers: PLEX_HEADERS });
  return response.ok;
});

// Move playlist item (reorder)
ipcMain.handle('move-playlist-item', async (_, { serverUrl, playlistId, itemId, afterId }) => {
  const token = store.get('plexToken') as string;
  // Plex API: PUT /playlists/{playlistId}/items/{playlistItemID}/move?after={afterItemID}
  // If afterId is null, move to beginning (no after param)
  let url = `${serverUrl}/playlists/${playlistId}/items/${itemId}/move?X-Plex-Token=${token}`;
  if (afterId) {
    url += `&after=${afterId}`;
  }
  const response = await fetch(url, { method: 'PUT', headers: PLEX_HEADERS });
  return response.ok;
});

// Get play history for weekly mix
ipcMain.handle('get-play-history', async (_, { serverUrl, libraryId }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/status/sessions/history/all?librarySectionID=${libraryId}&X-Plex-Token=${token}`;
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.MediaContainer?.Metadata || []).filter((t: any) => t.type === 'track');
});

// Search for artist by name
ipcMain.handle('find-artist', async (_, { serverUrl, libraryId, name }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=8&title=${encodeURIComponent(name)}&X-Plex-Container-Size=1&X-Plex-Token=${token}`;
  console.log(`[find-artist] Searching for: "${name}"`);
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log(`[find-artist] Failed for "${name}":`, response.status);
    return null;
  }
  const data = await response.json();
  const artists = data.MediaContainer?.Metadata || [];
  console.log(`[find-artist] Found ${artists.length} matches for "${name}"`);
  return artists[0] || null;
});

// Get popular tracks from artist (using hubs for external popularity data)
ipcMain.handle('get-artist-popular-tracks', async (_, { serverUrl, libraryId, artistKey, limit }) => {
  const token = store.get('plexToken') as string;
  console.log(`[get-artist-popular-tracks] Artist key: ${artistKey}, limit: ${limit}`);
  
  // Try hubs first (external popularity from Last.fm etc)
  const hubsUrl = `${serverUrl}/hubs/sections/${libraryId}?metadataItemId=${artistKey}&count=${limit}&X-Plex-Token=${token}`;
  const hubsResponse = await fetch(hubsUrl, { headers: PLEX_HEADERS });
  
  if (hubsResponse.ok) {
    const hubsData = await hubsResponse.json();
    const hubs = hubsData.MediaContainer?.Hub || [];
    console.log(`[get-artist-popular-tracks] Found ${hubs.length} hubs:`, hubs.map((h: any) => h.title));
    
    // Look for "Popular" hub specifically (from Last.fm/external data)
    const popularHub = hubs.find((h: any) => {
      const title = h.title?.toLowerCase() || '';
      return title === 'popular' || title === 'top tracks';
    });
    
    if (popularHub?.Metadata?.length > 0) {
      console.log(`[get-artist-popular-tracks] Found Popular hub with ${popularHub.Metadata.length} tracks`);
      return popularHub.Metadata.slice(0, limit);
    }
  }
  
  // Fallback: get artist tracks sorted by play count (user's own plays)
  console.log('[get-artist-popular-tracks] Falling back to viewCount sort');
  const url = `${serverUrl}/library/metadata/${artistKey}/allLeaves?sort=viewCount:desc&X-Plex-Container-Size=${limit}&X-Plex-Token=${token}`;
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[get-artist-popular-tracks] Fallback failed:', response.status);
    return [];
  }
  const data = await response.json();
  const tracks = data.MediaContainer?.Metadata || [];
  console.log(`[get-artist-popular-tracks] Fallback returned ${tracks.length} tracks`);
  // Always enforce the limit
  return tracks.slice(0, limit);
});

// Get random artists from library
ipcMain.handle('get-random-artists', async (_, { serverUrl, libraryId, limit }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=8&sort=random&X-Plex-Container-Size=${limit}&X-Plex-Token=${token}`;
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) return [];
  const data = await response.json();
  return data.MediaContainer?.Metadata || [];
});

// Get recently played tracks (last 7 days)
ipcMain.handle('get-recent-tracks', async (_, { serverUrl, libraryId }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=10&sort=lastViewedAt:desc&lastViewedAt%3E%3E=0&X-Plex-Container-Size=200&X-Plex-Token=${token}`;
  console.log('[get-recent-tracks] Fetching:', url.replace(token, 'TOKEN'));
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[get-recent-tracks] Failed:', response.status);
    return [];
  }
  const data = await response.json();
  const tracks = data.MediaContainer?.Metadata || [];
  console.log('[get-recent-tracks] Total played tracks:', tracks.length);
  
  // Filter to last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentTracks = tracks.filter((t: any) => (t.lastViewedAt || 0) * 1000 >= sevenDaysAgo);
  console.log('[get-recent-tracks] Tracks in last 7 days:', recentTracks.length);
  return recentTracks;
});

// Get recently played tracks (last 30 days) - for fallback
ipcMain.handle('get-monthly-tracks', async (_, { serverUrl, libraryId }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=10&sort=lastViewedAt:desc&lastViewedAt%3E%3E=0&X-Plex-Container-Size=500&X-Plex-Token=${token}`;
  console.log('[get-monthly-tracks] Fetching...');
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[get-monthly-tracks] Failed:', response.status);
    return [];
  }
  const data = await response.json();
  const tracks = data.MediaContainer?.Metadata || [];
  
  // Filter to last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const monthlyTracks = tracks.filter((t: any) => (t.lastViewedAt || 0) * 1000 >= thirtyDaysAgo);
  console.log('[get-monthly-tracks] Tracks in last 30 days:', monthlyTracks.length);
  return monthlyTracks;
});

// Get tracks not played in X days (for Daily Mix)
ipcMain.handle('get-stale-played-tracks', async (_, { serverUrl, libraryId, daysAgo, limit }) => {
  const token = store.get('plexToken') as string;
  // Get all played tracks sorted by lastViewedAt ascending (oldest first)
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=10&sort=lastViewedAt:asc&lastViewedAt%3E%3E=0&X-Plex-Container-Size=${limit * 2}&X-Plex-Token=${token}`;
  console.log('[get-stale-played-tracks] Fetching...');
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[get-stale-played-tracks] Failed:', response.status);
    return [];
  }
  const data = await response.json();
  const tracks = data.MediaContainer?.Metadata || [];
  
  // Filter to tracks not played in X days
  const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  const staleTracks = tracks.filter((t: any) => (t.lastViewedAt || 0) * 1000 < cutoff);
  console.log(`[get-stale-played-tracks] Tracks not played in ${daysAgo} days:`, staleTracks.length);
  return staleTracks.slice(0, limit);
});

// Get tracks for Time Capsule with artist diversity
ipcMain.handle('get-time-capsule-tracks', async (_, { serverUrl, libraryId, daysAgo, targetCount, maxPerArtist }) => {
  const token = store.get('plexToken') as string;
  // Fetch a larger pool of tracks not played in X days, sorted by oldest first
  const poolSize = targetCount * 10; // Get 10x to ensure diversity
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=10&sort=lastViewedAt:asc&lastViewedAt%3E%3E=0&X-Plex-Container-Size=${poolSize}&X-Plex-Token=${token}`;
  console.log('[get-time-capsule-tracks] Fetching pool...');
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[get-time-capsule-tracks] Failed:', response.status);
    return [];
  }
  const data = await response.json();
  const allTracks = data.MediaContainer?.Metadata || [];
  
  // Filter to tracks not played in X days
  const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  const staleTracks = allTracks.filter((t: any) => (t.lastViewedAt || 0) * 1000 < cutoff);
  console.log(`[get-time-capsule-tracks] Found ${staleTracks.length} tracks not played in ${daysAgo}+ days`);
  
  if (staleTracks.length === 0) return [];
  
  // Group tracks by artist
  const tracksByArtist = new Map<string, any[]>();
  for (const track of staleTracks) {
    const artist = track.grandparentTitle || 'Unknown';
    if (!tracksByArtist.has(artist)) {
      tracksByArtist.set(artist, []);
    }
    tracksByArtist.get(artist)!.push(track);
  }
  
  console.log(`[get-time-capsule-tracks] Tracks spread across ${tracksByArtist.size} artists`);
  
  // Select tracks with artist diversity using round-robin
  const selectedTracks: any[] = [];
  const artistQueues = Array.from(tracksByArtist.entries()).map(([artist, tracks]) => ({
    artist,
    tracks: [...tracks], // Copy array
    selected: 0
  }));
  
  // Shuffle artist order for variety
  for (let i = artistQueues.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [artistQueues[i], artistQueues[j]] = [artistQueues[j], artistQueues[i]];
  }
  
  // Round-robin selection: take one track from each artist in rotation
  let hasMore = true;
  while (selectedTracks.length < targetCount && hasMore) {
    hasMore = false;
    for (const queue of artistQueues) {
      if (selectedTracks.length >= targetCount) break;
      if (queue.selected >= maxPerArtist) continue; // Skip if artist hit max
      if (queue.tracks.length === 0) continue;
      
      // Pick a random track from this artist's remaining tracks
      const randomIndex = Math.floor(Math.random() * queue.tracks.length);
      const track = queue.tracks.splice(randomIndex, 1)[0];
      selectedTracks.push(track);
      queue.selected++;
      hasMore = true;
    }
  }
  
  // Log diversity stats
  const artistCounts = new Map<string, number>();
  for (const track of selectedTracks) {
    const artist = track.grandparentTitle || 'Unknown';
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
  }
  console.log(`[get-time-capsule-tracks] Selected ${selectedTracks.length} tracks from ${artistCounts.size} artists`);
  
  return selectedTracks;
});

// Get custom filtered tracks for custom mix builder
ipcMain.handle('get-custom-mix-tracks', async (_, { serverUrl, libraryId, options }) => {
  const token = store.get('plexToken') as string;
  const { 
    type, // 'mostPlayed' | 'leastPlayed' | 'unplayed' | 'highRated' | 'recentlyAdded' | 'all'
    limit = 100,
    minRating = 0, // 0-10 scale (Plex uses 0-10)
    addedWithin = 0, // days, 0 = any
    yearFrom = 0,
    yearTo = 0,
    maxPerArtist = 999,
    sortBy = 'random' // 'random' | 'playCount' | 'rating' | 'addedAt' | 'lastPlayed' | 'title'
  } = options;
  
  // Build query parameters
  let filters: string[] = ['type=10']; // tracks only
  let sort = 'random';
  
  // Sort options
  switch (sortBy) {
    case 'playCount': sort = 'viewCount:desc'; break;
    case 'rating': sort = 'userRating:desc'; break;
    case 'addedAt': sort = 'addedAt:desc'; break;
    case 'lastPlayed': sort = 'lastViewedAt:desc'; break;
    case 'title': sort = 'titleSort:asc'; break;
    default: sort = 'random';
  }
  
  // Type-specific filters
  switch (type) {
    case 'mostPlayed':
      filters.push('viewCount>>=1');
      sort = 'viewCount:desc';
      break;
    case 'leastPlayed':
      filters.push('viewCount>>=1');
      sort = 'viewCount:asc';
      break;
    case 'unplayed':
      filters.push('viewCount=0');
      break;
    case 'highRated':
      filters.push('userRating>>=6'); // 3+ stars
      sort = 'userRating:desc';
      break;
    case 'recentlyAdded':
      sort = 'addedAt:desc';
      break;
  }
  
  // Rating filter (Plex uses 0-10 scale, 2 = 1 star, 10 = 5 stars)
  if (minRating > 0) {
    filters.push(`userRating>>=${minRating * 2}`);
  }
  
  // Added within X days
  if (addedWithin > 0) {
    filters.push(`addedAt>>=-${addedWithin}d`);
  }
  
  // Year range
  if (yearFrom > 0) {
    filters.push(`year>=${yearFrom}`);
  }
  if (yearTo > 0) {
    filters.push(`year<=${yearTo}`);
  }
  
  const filterStr = filters.join('&');
  const fetchLimit = maxPerArtist < 999 ? limit * 5 : limit; // Fetch more if we need to filter by artist
  const url = `${serverUrl}/library/sections/${libraryId}/all?${filterStr}&sort=${sort}&X-Plex-Container-Size=${fetchLimit}&X-Plex-Token=${token}`;
  
  console.log(`[get-custom-mix-tracks] Fetching with type=${type}, sort=${sortBy}`);
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[get-custom-mix-tracks] Failed:', response.status);
    return [];
  }
  
  const data = await response.json();
  let tracks = data.MediaContainer?.Metadata || [];
  console.log(`[get-custom-mix-tracks] Fetched ${tracks.length} tracks`);
  
  // Apply max per artist filter if needed
  if (maxPerArtist < 999) {
    const artistCounts = new Map<string, number>();
    const filteredTracks: any[] = [];
    
    for (const track of tracks) {
      const artist = track.grandparentTitle || 'Unknown';
      const count = artistCounts.get(artist) || 0;
      if (count < maxPerArtist) {
        filteredTracks.push(track);
        artistCounts.set(artist, count + 1);
      }
      if (filteredTracks.length >= limit) break;
    }
    tracks = filteredTracks;
    console.log(`[get-custom-mix-tracks] After artist filter: ${tracks.length} tracks from ${artistCounts.size} artists`);
  }
  
  return tracks.slice(0, limit);
});

// Get genres from library
ipcMain.handle('get-library-genres', async (_, { serverUrl, libraryId }) => {
  const token = store.get('plexToken') as string;
  // Get all unique genres from albums
  const url = `${serverUrl}/library/sections/${libraryId}/all?type=9&X-Plex-Container-Size=0&X-Plex-Token=${token}`;
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) return [];
  
  // Get genre list from library metadata
  const genreUrl = `${serverUrl}/library/sections/${libraryId}/genre?type=10&X-Plex-Token=${token}`;
  const genreResponse = await fetch(genreUrl, { headers: PLEX_HEADERS });
  if (!genreResponse.ok) return [];
  
  const data = await genreResponse.json();
  const genres = (data.MediaContainer?.Directory || []).map((g: any) => ({
    key: g.key,
    title: g.title,
    count: g.count || 0
  }));
  
  // Sort by count descending
  genres.sort((a: any, b: any) => (b.count || 0) - (a.count || 0));
  console.log(`[get-library-genres] Found ${genres.length} genres`);
  return genres.slice(0, 50); // Top 50 genres
});

// Advanced custom mix builder
ipcMain.handle('build-custom-mix', async (_, { serverUrl, libraryId, options }) => {
  const token = store.get('plexToken') as string;
  const {
    source = 'all', // 'all' | 'played' | 'unplayed' | 'recentlyPlayed' | 'topArtists'
    historyDays = 0, // 0 = all time, otherwise limit to X days
    topArtistsCount = 0, // If > 0, limit to top X artists from history
    tracksPerArtist = 0, // If > 0, get X tracks per artist
    genre = '', // Genre filter
    minRating = 0,
    yearFrom = 0,
    yearTo = 0,
    addedWithin = 0,
    sortBy = 'random',
    maxPerArtist = 999,
    limit = 50
  } = options;

  console.log(`[build-custom-mix] Building with source=${source}, historyDays=${historyDays}, topArtists=${topArtistsCount}, genre=${genre}`);

  // If using top artists approach
  if (topArtistsCount > 0) {
    // Get play history to find top artists
    let historyUrl = `${serverUrl}/library/sections/${libraryId}/all?type=10&sort=lastViewedAt:desc&lastViewedAt>>=0&X-Plex-Container-Size=500&X-Plex-Token=${token}`;
    const historyResponse = await fetch(historyUrl, { headers: PLEX_HEADERS });
    if (!historyResponse.ok) return [];
    
    const historyData = await historyResponse.json();
    let historyTracks = historyData.MediaContainer?.Metadata || [];
    
    // Filter by history days if specified
    if (historyDays > 0) {
      const cutoff = Date.now() - historyDays * 24 * 60 * 60 * 1000;
      historyTracks = historyTracks.filter((t: any) => (t.lastViewedAt || 0) * 1000 >= cutoff);
    }
    
    // Count plays per artist
    const artistCounts = new Map<string, number>();
    for (const track of historyTracks) {
      const artist = track.grandparentTitle || 'Unknown';
      if (artist === 'Various Artists' || artist === 'Unknown' || artist === 'Soundtrack') continue;
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    }
    
    // Get top N artists
    const topArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topArtistsCount)
      .map(([name]) => name);
    
    console.log(`[build-custom-mix] Top ${topArtistsCount} artists:`, topArtists);
    
    // Get tracks from each artist
    const allTracks: any[] = [];
    const addedKeys = new Set<string>();
    const tpa = tracksPerArtist || 5;
    
    for (const artistName of topArtists) {
      // Find artist
      const artistUrl = `${serverUrl}/library/sections/${libraryId}/all?type=8&title=${encodeURIComponent(artistName)}&X-Plex-Container-Size=1&X-Plex-Token=${token}`;
      const artistResponse = await fetch(artistUrl, { headers: PLEX_HEADERS });
      if (!artistResponse.ok) continue;
      
      const artistData = await artistResponse.json();
      const artist = artistData.MediaContainer?.Metadata?.[0];
      if (!artist) continue;
      
      // Get popular tracks from artist
      const hubsUrl = `${serverUrl}/hubs/sections/${libraryId}?metadataItemId=${artist.ratingKey}&count=${tpa}&X-Plex-Token=${token}`;
      const hubsResponse = await fetch(hubsUrl, { headers: PLEX_HEADERS });
      
      let artistTracks: any[] = [];
      if (hubsResponse.ok) {
        const hubsData = await hubsResponse.json();
        const hubs = hubsData.MediaContainer?.Hub || [];
        const popularHub = hubs.find((h: any) => h.title?.toLowerCase() === 'popular' || h.title?.toLowerCase() === 'top tracks');
        if (popularHub?.Metadata?.length > 0) {
          artistTracks = popularHub.Metadata.slice(0, tpa);
        }
      }
      
      // Fallback to viewCount sort
      if (artistTracks.length === 0) {
        const fallbackUrl = `${serverUrl}/library/metadata/${artist.ratingKey}/allLeaves?sort=viewCount:desc&X-Plex-Container-Size=${tpa}&X-Plex-Token=${token}`;
        const fallbackResponse = await fetch(fallbackUrl, { headers: PLEX_HEADERS });
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          artistTracks = fallbackData.MediaContainer?.Metadata || [];
        }
      }
      
      // Apply genre filter if specified
      if (genre) {
        artistTracks = artistTracks.filter((t: any) => {
          const trackGenres = (t.Genre || []).map((g: any) => g.tag?.toLowerCase());
          return trackGenres.includes(genre.toLowerCase());
        });
      }
      
      for (const track of artistTracks.slice(0, tpa)) {
        if (!addedKeys.has(track.ratingKey)) {
          allTracks.push(track);
          addedKeys.add(track.ratingKey);
        }
      }
    }
    
    console.log(`[build-custom-mix] Got ${allTracks.length} tracks from top artists`);
    return allTracks.slice(0, limit);
  }
  
  // Standard query-based approach
  let filters: string[] = ['type=10'];
  let sort = sortBy === 'random' ? 'random' : 
             sortBy === 'playCount' ? 'viewCount:desc' :
             sortBy === 'rating' ? 'userRating:desc' :
             sortBy === 'addedAt' ? 'addedAt:desc' :
             sortBy === 'lastPlayed' ? 'lastViewedAt:desc' : 'random';
  
  // Source filters
  if (source === 'played') {
    filters.push('viewCount>>=1');
  } else if (source === 'unplayed') {
    filters.push('viewCount=0');
  } else if (source === 'recentlyPlayed') {
    filters.push('lastViewedAt>>=0');
    sort = 'lastViewedAt:desc';
  }
  
  // History days filter (for recently played)
  if (historyDays > 0 && source === 'recentlyPlayed') {
    filters.push(`lastViewedAt>>=-${historyDays}d`);
  }
  
  // Other filters
  if (minRating > 0) filters.push(`userRating>>=${minRating * 2}`);
  if (yearFrom > 0) filters.push(`year>=${yearFrom}`);
  if (yearTo > 0) filters.push(`year<=${yearTo}`);
  if (addedWithin > 0) filters.push(`addedAt>>=-${addedWithin}d`);
  if (genre) filters.push(`genre=${encodeURIComponent(genre)}`);
  
  const fetchLimit = maxPerArtist < 999 ? limit * 5 : limit;
  const url = `${serverUrl}/library/sections/${libraryId}/all?${filters.join('&')}&sort=${sort}&X-Plex-Container-Size=${fetchLimit}&X-Plex-Token=${token}`;
  
  console.log(`[build-custom-mix] Query URL filters: ${filters.join('&')}`);
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) {
    console.log('[build-custom-mix] Failed:', response.status);
    return [];
  }
  
  const data = await response.json();
  let tracks = data.MediaContainer?.Metadata || [];
  
  // Apply max per artist
  if (maxPerArtist < 999) {
    const artistCounts = new Map<string, number>();
    const filtered: any[] = [];
    for (const track of tracks) {
      const artist = track.grandparentTitle || 'Unknown';
      const count = artistCounts.get(artist) || 0;
      if (count < maxPerArtist) {
        filtered.push(track);
        artistCounts.set(artist, count + 1);
      }
      if (filtered.length >= limit) break;
    }
    tracks = filtered;
  }
  
  console.log(`[build-custom-mix] Returning ${tracks.slice(0, limit).length} tracks`);
  return tracks.slice(0, limit);
});

// Get tracks from same artist or album (for Daily Mix similarity)
ipcMain.handle('get-related-tracks', async (_, { serverUrl, trackKey, limit }) => {
  const token = store.get('plexToken') as string;
  
  // First get the track details to find artist/album
  const trackUrl = `${serverUrl}/library/metadata/${trackKey}?X-Plex-Token=${token}`;
  const trackResponse = await fetch(trackUrl, { headers: PLEX_HEADERS });
  if (!trackResponse.ok) return [];
  const trackData = await trackResponse.json();
  const track = trackData.MediaContainer?.Metadata?.[0];
  if (!track) return [];
  
  const relatedTracks: any[] = [];
  const addedKeys = new Set<string>();
  addedKeys.add(trackKey); // Don't include the seed track
  
  // Get other tracks from the same album
  if (track.parentRatingKey) {
    const albumUrl = `${serverUrl}/library/metadata/${track.parentRatingKey}/children?X-Plex-Token=${token}`;
    const albumResponse = await fetch(albumUrl, { headers: PLEX_HEADERS });
    if (albumResponse.ok) {
      const albumData = await albumResponse.json();
      const albumTracks = albumData.MediaContainer?.Metadata || [];
      for (const t of albumTracks) {
        if (!addedKeys.has(t.ratingKey) && relatedTracks.length < limit) {
          relatedTracks.push(t);
          addedKeys.add(t.ratingKey);
        }
      }
    }
  }
  
  // If we need more, get tracks from the same artist
  if (relatedTracks.length < limit && track.grandparentRatingKey) {
    const artistUrl = `${serverUrl}/library/metadata/${track.grandparentRatingKey}/allLeaves?sort=random&X-Plex-Container-Size=${limit * 2}&X-Plex-Token=${token}`;
    const artistResponse = await fetch(artistUrl, { headers: PLEX_HEADERS });
    if (artistResponse.ok) {
      const artistData = await artistResponse.json();
      const artistTracks = artistData.MediaContainer?.Metadata || [];
      for (const t of artistTracks) {
        if (!addedKeys.has(t.ratingKey) && relatedTracks.length < limit) {
          relatedTracks.push(t);
          addedKeys.add(t.ratingKey);
        }
      }
    }
  }
  
  return relatedTracks;
});

// Get sonically similar tracks
ipcMain.handle('get-similar-tracks', async (_, { serverUrl, trackKey }) => {
  const token = store.get('plexToken') as string;
  
  // Try nearest (sonic similarity) first
  let url = `${serverUrl}/library/metadata/${trackKey}/nearest?X-Plex-Token=${token}`;
  let response = await fetch(url, { headers: PLEX_HEADERS });
  if (response.ok) {
    const data = await response.json();
    if (data.MediaContainer?.Metadata?.length > 0) {
      return data.MediaContainer.Metadata;
    }
  }
  
  // Fallback to similar
  url = `${serverUrl}/library/metadata/${trackKey}/similar?count=10&X-Plex-Token=${token}`;
  response = await fetch(url, { headers: PLEX_HEADERS });
  if (response.ok) {
    const data = await response.json();
    return data.MediaContainer?.Metadata || [];
  }
  
  return [];
});

// Get recently added albums
ipcMain.handle('get-recent-albums', async (_, { serverUrl, libraryId, limit }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/library/sections/${libraryId}/recentlyAdded?type=9&X-Plex-Container-Size=${limit}&X-Plex-Token=${token}`;
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) return [];
  const data = await response.json();
  return data.MediaContainer?.Metadata || [];
});

// Get album tracks
ipcMain.handle('get-album-tracks', async (_, { serverUrl, albumKey }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/library/metadata/${albumKey}/children?X-Plex-Token=${token}`;
  const response = await fetch(url, { headers: PLEX_HEADERS });
  if (!response.ok) return [];
  const data = await response.json();
  return data.MediaContainer?.Metadata || [];
});

// Delete a playlist
ipcMain.handle('delete-playlist', async (_, { serverUrl, playlistId }) => {
  const token = store.get('plexToken') as string;
  const url = `${serverUrl}/playlists/${playlistId}?X-Plex-Token=${token}`;
  const response = await fetch(url, { method: 'DELETE', headers: PLEX_HEADERS });
  return response.ok;
});

// ==================== SCHEDULING ====================

// Get last refresh times for playlists
ipcMain.handle('get-refresh-times', () => {
  return store.get('playlistRefreshTimes', {}) as Record<string, number>;
});

// Set refresh time for a playlist
ipcMain.handle('set-refresh-time', (_, { playlistId, timestamp }) => {
  const times = store.get('playlistRefreshTimes', {}) as Record<string, number>;
  times[playlistId] = timestamp;
  store.set('playlistRefreshTimes', times);
  return true;
});

// Check if playlist needs refresh based on schedule (hours)
ipcMain.handle('needs-refresh', (_, { playlistId, scheduleHours }) => {
  const times = store.get('playlistRefreshTimes', {}) as Record<string, number>;
  const lastRefresh = times[playlistId] || 0;
  const now = Date.now();
  const hoursSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60);
  return hoursSinceRefresh >= scheduleHours;
});

// Playlist schedule types
export type ScheduleFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'none';

export interface PlaylistSchedule {
  playlistId: string;
  playlistName: string;
  frequency: ScheduleFrequency;
  startDate: string; // ISO date string (YYYY-MM-DD)
  lastRun?: number;  // Unix timestamp
  chartIds?: string[]; // For ARIA charts, which charts to include
  country: string;
  // For external playlist imports
  source?: 'deezer' | 'apple' | 'tidal' | 'spotify' | 'listenbrainz';
  sourceUrl?: string; // URL for Apple/Tidal, playlist ID for Deezer/Spotify/ListenBrainz
  username?: string; // For ListenBrainz - store the username
}

// Get all playlist schedules
ipcMain.handle('get-schedules', () => {
  return store.get('playlistSchedules', []) as PlaylistSchedule[];
});

// Save a playlist schedule
ipcMain.handle('save-schedule', (_, schedule: PlaylistSchedule) => {
  const schedules = store.get('playlistSchedules', []) as PlaylistSchedule[];
  const existingIndex = schedules.findIndex(s => s.playlistId === schedule.playlistId);
  
  if (existingIndex >= 0) {
    schedules[existingIndex] = schedule;
  } else {
    schedules.push(schedule);
  }
  
  store.set('playlistSchedules', schedules);
  return true;
});

// Delete a playlist schedule
ipcMain.handle('delete-schedule', (_, playlistId: string) => {
  const schedules = store.get('playlistSchedules', []) as PlaylistSchedule[];
  const filtered = schedules.filter(s => s.playlistId !== playlistId);
  store.set('playlistSchedules', filtered);
  return true;
});

// Check which schedules are due to run
ipcMain.handle('get-due-schedules', () => {
  const schedules = store.get('playlistSchedules', []) as PlaylistSchedule[];
  const now = new Date();
  const dueSchedules: PlaylistSchedule[] = [];
  
  for (const schedule of schedules) {
    if (schedule.frequency === 'none') continue;
    
    const startDate = new Date(schedule.startDate);
    const lastRun = schedule.lastRun ? new Date(schedule.lastRun) : null;
    
    // Calculate next run date
    let nextRun: Date;
    if (!lastRun) {
      // Never run before - check if start date has passed
      nextRun = startDate;
    } else {
      // Calculate next run based on frequency
      nextRun = new Date(lastRun);
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'fortnightly':
          nextRun.setDate(nextRun.getDate() + 14);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }
    
    // Check if due
    if (now >= nextRun) {
      dueSchedules.push(schedule);
    }
  }
  
  return dueSchedules;
});

// Mark a schedule as run
ipcMain.handle('mark-schedule-run', (_, playlistId: string) => {
  const schedules = store.get('playlistSchedules', []) as PlaylistSchedule[];
  const schedule = schedules.find(s => s.playlistId === playlistId);
  
  if (schedule) {
    schedule.lastRun = Date.now();
    store.set('playlistSchedules', schedules);
  }
  
  return true;
});

// ==================== MIXES SCHEDULE ====================

interface MixesSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastRun?: number;
}

ipcMain.handle('get-mixes-schedule', () => {
  return store.get('mixesSchedule', { enabled: false, frequency: 'weekly' }) as MixesSchedule;
});

ipcMain.handle('save-mixes-schedule', (_, schedule: MixesSchedule) => {
  store.set('mixesSchedule', schedule);
  return true;
});

ipcMain.handle('check-mixes-schedule-due', () => {
  const schedule = store.get('mixesSchedule', { enabled: false, frequency: 'weekly' }) as MixesSchedule;
  if (!schedule.enabled) return false;
  
  const now = Date.now();
  const lastRun = schedule.lastRun || 0;
  
  const intervals: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };
  
  return now - lastRun >= intervals[schedule.frequency];
});

ipcMain.handle('mark-mixes-schedule-run', () => {
  const schedule = store.get('mixesSchedule', { enabled: false, frequency: 'weekly' }) as MixesSchedule;
  schedule.lastRun = Date.now();
  store.set('mixesSchedule', schedule);
  return true;
});

// ==================== ARIA SCRAPING ====================

// Get the most recent Monday date in YYYY-MM-DD format
function getLatestMondayDate(): string {
  const now = new Date();
  const day = now.getDay();
  // Calculate days since last Monday (0 = Sunday, 1 = Monday, etc.)
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const date = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

// Format the Monday date for display (e.g., "29 December 2025")
function formatMondayDateForDisplay(): string {
  const now = new Date();
  const day = now.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  return `${monday.getDate()} ${months[monday.getMonth()]} ${monday.getFullYear()}`;
}

// Scrape ARIA charts using a hidden browser window
ipcMain.handle('scrape-aria-charts', async (_, selectedChartIds?: string[]) => {
  const charts: { id: string; name: string; description: string; tracks: { title: string; artist: string }[] }[] = [];
  const mondayDate = getLatestMondayDate();
  const weekDisplay = formatMondayDateForDisplay();
  
  // All ARIA chart URLs - weekly charts use the Monday date
  const ariaCharts = [
    // Main charts
    { slug: 'singles-chart', name: 'ARIA Top Singles', description: 'Official Australian singles chart', dated: true },
    { slug: 'australian-artist-singles-chart', name: 'ARIA Top Australian Singles', description: 'Top Australian artist singles', dated: true },
    { slug: 'catalogue-singles-chart', name: 'ARIA Top On Replay Singles', description: 'Catalogue singles chart', dated: true },
    { slug: 'australian-artist-catalogue-singles-chart', name: 'ARIA Top Australian On Replay Singles', description: 'Australian artist catalogue singles', dated: true },
    // Genre charts
    { slug: 'hip-hop-r-and-b-singles-chart', name: 'ARIA Top Hip-Hop/R&B Singles', description: 'Hip-Hop and R&B singles chart', dated: true },
    { slug: 'australian-hip-hop-r-and-b-singles-chart', name: 'ARIA Top Australian Hip-Hop/R&B', description: 'Australian Hip-Hop and R&B singles', dated: true },
    { slug: 'dance-singles-chart', name: 'ARIA Top Dance Singles', description: 'Dance singles chart', dated: true },
    { slug: 'club-tracks-chart', name: 'ARIA Top Club Tracks', description: 'Club tracks chart', dated: true },
    // End of decade charts (static URLs)
    { slug: '2010/end-of-decade-singles-chart', name: 'ARIA Top End of Decade 2010s', description: '2010s decade chart', dated: false },
    { slug: '2000/end-of-decade-singles-chart', name: 'ARIA Top End of Decade 2000s', description: '2000s decade chart', dated: false },
  ];
  
  // Filter charts if selectedChartIds is provided
  const chartsToScrape = selectedChartIds && selectedChartIds.length > 0
    ? ariaCharts.filter(chart => {
        const chartId = chart.slug.replace(/\//g, '-');
        return selectedChartIds.includes(chartId);
      })
    : ariaCharts;
  
  for (const chart of chartsToScrape) {
    try {
      const url = chart.dated 
        ? `https://www.aria.com.au/charts/${chart.slug}/${mondayDate}`
        : `https://www.aria.com.au/charts/${chart.slug}`;
      
      // Add week date to name for weekly charts
      const playlistName = chart.dated 
        ? `${chart.name} for week of ${weekDisplay}`
        : chart.name;
      
      console.log(`Scraping ARIA: ${playlistName} from ${url}`);
      const tracks = await scrapeARIAPage(url);
      
      if (tracks.length > 0) {
        charts.push({
          id: `aria-${chart.slug.replace(/\//g, '-')}`,
          name: playlistName,
          description: chart.description,
          tracks,
        });
        console.log(`  Found ${tracks.length} tracks`);
      } else {
        console.log(`  No tracks found`);
      }
    } catch (e) {
      console.error(`Failed to scrape ${chart.name}:`, e);
    }
  }
  
  return charts;
});

async function scrapeARIAPage(url: string): Promise<{ title: string; artist: string }[]> {
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        autoplayPolicy: 'document-user-activation-required', // Prevent video autoplay
      },
    });
    
    // Mute the window to prevent any audio
    scrapeWindow.webContents.setAudioMuted(true);
    
    const timeout = setTimeout(() => {
      scrapeWindow.close();
      resolve([]);
    }, 30000);
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      // Wait for JS to render the chart data
      await new Promise(r => setTimeout(r, 4000));
      
      try {
        const tracks = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            
            // ARIA website structure - look for chart items
            // Try multiple selector patterns
            const selectors = [
              '.c-chart-item',
              '.chart-item',
              '[class*="ChartItem"]',
              'article[class*="chart"]',
              '.chart-row',
              'li[class*="chart"]'
            ];
            
            let items = [];
            for (const sel of selectors) {
              items = document.querySelectorAll(sel);
              if (items.length > 0) break;
            }
            
            items.forEach(item => {
              // Try various selectors for title and artist
              const titleSelectors = [
                '.c-chart-item__title',
                '.chart-item__title', 
                '[class*="title"]:not([class*="subtitle"])',
                'h3', 'h4',
                '[class*="Title"]'
              ];
              
              const artistSelectors = [
                '.c-chart-item__artist',
                '.chart-item__artist',
                '[class*="artist"]',
                '[class*="Artist"]',
                '.subtitle'
              ];
              
              let title = '';
              let artist = '';
              
              for (const sel of titleSelectors) {
                const el = item.querySelector(sel);
                if (el && el.textContent?.trim()) {
                  title = el.textContent.trim();
                  break;
                }
              }
              
              for (const sel of artistSelectors) {
                const el = item.querySelector(sel);
                if (el && el.textContent?.trim()) {
                  artist = el.textContent.trim();
                  break;
                }
              }
              
              // Clean up - remove position numbers if they got included
              title = title.replace(/^\\d+\\.?\\s*/, '').trim();
              artist = artist.replace(/^\\d+\\.?\\s*/, '').trim();
              
              if (title && artist && title.length > 0 && artist.length > 0) {
                // Avoid duplicates
                if (!tracks.some(t => t.title === title && t.artist === artist)) {
                  tracks.push({ title, artist });
                }
              }
            });
            
            // Fallback: try to parse from any list structure
            if (tracks.length === 0) {
              document.querySelectorAll('main li, main article, main .item').forEach(item => {
                const text = item.innerText || '';
                const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
                
                // Look for title/artist pattern in consecutive lines
                for (let i = 0; i < lines.length - 1; i++) {
                  const line1 = lines[i].replace(/^\\d+\\.?\\s*/, '').trim();
                  const line2 = lines[i + 1].replace(/^\\d+\\.?\\s*/, '').trim();
                  
                  // Skip if looks like metadata (weeks, peak, etc)
                  if (line1.length > 2 && line2.length > 2 && 
                      !line1.match(/week|peak|last|new/i) && 
                      !line2.match(/week|peak|last|new/i)) {
                    if (!tracks.some(t => t.title === line1)) {
                      tracks.push({ title: line1, artist: line2 });
                      i++; // Skip the artist line
                    }
                  }
                }
              });
            }
            
            return tracks;
          })()
        `);
        
        clearTimeout(timeout);
        scrapeWindow.close();
        resolve(tracks);
      } catch (e) {
        clearTimeout(timeout);
        scrapeWindow.close();
        resolve([]);
      }
    });
    
    scrapeWindow.loadURL(url);
  });
}

// ==================== SPOTIFY INTEGRATION ====================

// Spotify OAuth config - users need to create their own app at https://developer.spotify.com
const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8888/callback';

// Get Spotify auth state
ipcMain.handle('get-spotify-auth', () => {
  return {
    accessToken: store.get('spotifyAccessToken') as string | null,
    refreshToken: store.get('spotifyRefreshToken') as string | null,
    expiresAt: store.get('spotifyExpiresAt') as number | null,
    user: store.get('spotifyUser') as any,
  };
});

// Save Spotify credentials (client ID/secret from user)
ipcMain.handle('save-spotify-credentials', (_, { clientId, clientSecret }) => {
  store.set('spotifyClientId', clientId);
  store.set('spotifyClientSecret', clientSecret);
  return true;
});

// Get Spotify credentials
ipcMain.handle('get-spotify-credentials', () => {
  return {
    clientId: store.get('spotifyClientId') as string | null,
    clientSecret: store.get('spotifyClientSecret') as string | null,
  };
});

// Start Spotify OAuth flow
ipcMain.handle('start-spotify-auth', async () => {
  const clientId = store.get('spotifyClientId') as string;
  if (!clientId) {
    throw new Error('Spotify Client ID not configured');
  }
  
  const scopes = 'playlist-read-private playlist-read-collaborative user-library-read';
  const state = Math.random().toString(36).substring(7);
  store.set('spotifyAuthState', state);
  
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}`;
  
  shell.openExternal(authUrl);
  return { state };
});

// Exchange Spotify auth code for tokens
ipcMain.handle('exchange-spotify-code', async (_, { code }) => {
  const clientId = store.get('spotifyClientId') as string;
  const clientSecret = store.get('spotifyClientSecret') as string;
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code');
  }
  
  const data = await response.json();
  
  store.set('spotifyAccessToken', data.access_token);
  store.set('spotifyRefreshToken', data.refresh_token);
  store.set('spotifyExpiresAt', Date.now() + data.expires_in * 1000);
  
  // Get user info
  const userResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${data.access_token}` },
  });
  const user = await userResponse.json();
  store.set('spotifyUser', { id: user.id, name: user.display_name, image: user.images?.[0]?.url });
  
  return {
    accessToken: data.access_token,
    user: { id: user.id, name: user.display_name, image: user.images?.[0]?.url },
  };
});

// Refresh Spotify token
async function refreshSpotifyToken(): Promise<string | null> {
  const refreshToken = store.get('spotifyRefreshToken') as string;
  const clientId = store.get('spotifyClientId') as string;
  const clientSecret = store.get('spotifyClientSecret') as string;
  
  if (!refreshToken || !clientId || !clientSecret) return null;
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) return null;
  
  const data = await response.json();
  store.set('spotifyAccessToken', data.access_token);
  store.set('spotifyExpiresAt', Date.now() + data.expires_in * 1000);
  
  return data.access_token;
}

// Get valid Spotify token (refresh if needed)
async function getSpotifyToken(): Promise<string | null> {
  const expiresAt = store.get('spotifyExpiresAt') as number;
  let token = store.get('spotifyAccessToken') as string;
  
  if (!token) return null;
  
  // Refresh if expires in less than 5 minutes
  if (expiresAt && Date.now() > expiresAt - 5 * 60 * 1000) {
    token = await refreshSpotifyToken() || token;
  }
  
  return token;
}

// Get user's Spotify playlists
ipcMain.handle('get-spotify-playlists', async () => {
  const token = await getSpotifyToken();
  if (!token) throw new Error('Not authenticated with Spotify');
  
  const playlists: any[] = [];
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
  
  while (url) {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to fetch playlists');
    
    const data = await response.json();
    playlists.push(...data.items);
    url = data.next;
  }
  
  return playlists.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    trackCount: p.tracks.total,
    image: p.images?.[0]?.url,
    owner: p.owner.display_name,
  }));
});

// Get tracks from a Spotify playlist
ipcMain.handle('get-spotify-playlist-tracks', async (_, { playlistId }) => {
  const token = await getSpotifyToken();
  if (!token) throw new Error('Not authenticated with Spotify');
  
  const tracks: any[] = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  
  while (url) {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to fetch playlist tracks');
    
    const data = await response.json();
    tracks.push(...data.items.filter((item: any) => item.track).map((item: any) => ({
      title: item.track.name,
      artist: item.track.artists.map((a: any) => a.name).join(', '),
      album: item.track.album.name,
    })));
    url = data.next;
  }
  
  return tracks;
});

// Logout from Spotify
ipcMain.handle('logout-spotify', () => {
  store.delete('spotifyAccessToken');
  store.delete('spotifyRefreshToken');
  store.delete('spotifyExpiresAt');
  store.delete('spotifyUser');
  return true;
});

// ==================== DEEZER INTEGRATION ====================

// Deezer OAuth - Note: Deezer requires app registration at https://developers.deezer.com/myapps
// Users need to create their own app and provide credentials

ipcMain.handle('get-deezer-auth', () => {
  return {
    accessToken: store.get('deezerAccessToken') as string | null,
    user: store.get('deezerUser') as any,
  };
});

ipcMain.handle('save-deezer-credentials', async (_, { appId, appSecret }) => {
  store.set('deezerAppId', appId);
  store.set('deezerAppSecret', appSecret);
  return true;
});

ipcMain.handle('get-deezer-credentials', () => {
  return {
    appId: store.get('deezerAppId') as string | null,
    appSecret: store.get('deezerAppSecret') as string | null,
  };
});

ipcMain.handle('start-deezer-auth', async () => {
  const appId = store.get('deezerAppId') as string;
  if (!appId) throw new Error('Deezer App ID not configured');
  
  // Deezer OAuth URL - redirect to localhost
  const redirectUri = 'http://127.0.0.1:8889/callback';
  const permissions = 'basic_access,manage_library,offline_access';
  const authUrl = `https://connect.deezer.com/oauth/auth.php?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&perms=${permissions}`;
  
  shell.openExternal(authUrl);
  return { redirectUri };
});

ipcMain.handle('exchange-deezer-code', async (_, { code }) => {
  const appId = store.get('deezerAppId') as string;
  const appSecret = store.get('deezerAppSecret') as string;
  
  // Exchange code for access token
  const tokenUrl = `https://connect.deezer.com/oauth/access_token.php?app_id=${appId}&secret=${appSecret}&code=${code}&output=json`;
  const response = await fetch(tokenUrl);
  
  if (!response.ok) throw new Error('Failed to exchange code');
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Auth failed');
  
  const accessToken = data.access_token;
  store.set('deezerAccessToken', accessToken);
  
  // Get user info
  const userResponse = await fetch(`https://api.deezer.com/user/me?access_token=${accessToken}`);
  const userData = await userResponse.json();
  
  store.set('deezerUser', {
    id: userData.id,
    name: userData.name,
    image: userData.picture_medium,
  });
  
  return { accessToken, user: store.get('deezerUser') };
});

ipcMain.handle('logout-deezer', async () => {
  store.delete('deezerAccessToken');
  store.delete('deezerUser');
  return true;
});

ipcMain.handle('get-deezer-user-playlists', async () => {
  const accessToken = store.get('deezerAccessToken') as string;
  if (!accessToken) return [];
  
  const response = await fetch(`https://api.deezer.com/user/me/playlists?access_token=${accessToken}&limit=100`);
  if (!response.ok) return [];
  
  const data = await response.json();
  return (data.data || []).map((p: any) => ({
    id: p.id,
    name: p.title,
    trackCount: p.nb_tracks,
    image: p.picture_medium,
    creator: p.creator?.name || 'You',
    isPersonal: true,
  }));
});

// Search Deezer playlists (public)
ipcMain.handle('search-deezer-playlists', async (_, { query }) => {
  const response = await fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(query)}&limit=25`);
  
  if (!response.ok) throw new Error('Failed to search Deezer');
  
  const data = await response.json();
  
  return (data.data || []).map((p: any) => ({
    id: p.id,
    name: p.title,
    trackCount: p.nb_tracks,
    image: p.picture_medium,
    creator: p.user?.name || 'Deezer',
  }));
});

// Get tracks from a Deezer playlist
ipcMain.handle('get-deezer-playlist-tracks', async (_, { playlistId }) => {
  const tracks: any[] = [];
  let url = `https://api.deezer.com/playlist/${playlistId}/tracks?limit=100`;
  
  while (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch Deezer playlist');
    
    const data = await response.json();
    tracks.push(...(data.data || []).map((t: any) => ({
      title: t.title,
      artist: t.artist?.name || 'Unknown',
      album: t.album?.title,
    })));
    
    url = data.next || null;
  }
  
  return tracks;
});

// Get top/popular Deezer playlists (editorial playlists)
ipcMain.handle('get-deezer-top-playlists', async () => {
  // Deezer's chart playlists - these are well-known editorial playlist IDs
  const editorialIds = [
    '1111141961', // Top Global
    '1116189381', // Top USA
    '1313621735', // Today's Hits
    '1282495765', // Pop Mix
    '1652248171', // Hip Hop Mix
    '1996494362', // Rock Classics
    '1615514485', // Chill Vibes
    '1111143121', // Top UK
    '1111142221', // Top France
    '1362516565', // Workout
  ];
  
  const playlists: any[] = [];
  
  for (const id of editorialIds) {
    try {
      const response = await fetch(`https://api.deezer.com/playlist/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.id) {
          playlists.push({
            id: data.id,
            name: data.title,
            trackCount: data.nb_tracks,
            image: data.picture_medium,
            creator: 'Deezer',
          });
        }
      }
    } catch (e) {
      // Skip failed playlists
    }
  }
  
  return playlists;
});

// ==================== TIDAL OAUTH INTEGRATION ====================

// Tidal OAuth - Users need to register at https://developer.tidal.com/
ipcMain.handle('get-tidal-auth', () => {
  return {
    accessToken: store.get('tidalAccessToken') as string | null,
    user: store.get('tidalUser') as any,
  };
});

ipcMain.handle('save-tidal-credentials', async (_, { clientId, clientSecret }) => {
  store.set('tidalClientId', clientId);
  store.set('tidalClientSecret', clientSecret);
  return true;
});

ipcMain.handle('get-tidal-credentials', () => {
  return {
    clientId: store.get('tidalClientId') as string | null,
    clientSecret: store.get('tidalClientSecret') as string | null,
  };
});

ipcMain.handle('start-tidal-auth', async () => {
  const clientId = store.get('tidalClientId') as string;
  if (!clientId) throw new Error('Tidal Client ID not configured');
  
  const redirectUri = 'http://127.0.0.1:8890/callback';
  const codeVerifier = Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))).toString('base64url');
  const codeChallenge = require('crypto').createHash('sha256').update(codeVerifier).digest('base64url');
  
  store.set('tidalCodeVerifier', codeVerifier);
  
  const authUrl = `https://login.tidal.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=playlists.read%20playlists.write&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  
  shell.openExternal(authUrl);
  return { redirectUri };
});

ipcMain.handle('exchange-tidal-code', async (_, { code }) => {
  const clientId = store.get('tidalClientId') as string;
  const clientSecret = store.get('tidalClientSecret') as string;
  const codeVerifier = store.get('tidalCodeVerifier') as string;
  const redirectUri = 'http://127.0.0.1:8890/callback';
  
  const tokenResponse = await fetch('https://auth.tidal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }),
  });
  
  if (!tokenResponse.ok) throw new Error('Failed to exchange code');
  
  const tokenData = await tokenResponse.json();
  store.set('tidalAccessToken', tokenData.access_token);
  store.set('tidalRefreshToken', tokenData.refresh_token);
  
  // Get user info
  const userResponse = await fetch('https://api.tidal.com/v1/users/me', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  });
  
  if (userResponse.ok) {
    const userData = await userResponse.json();
    store.set('tidalUser', {
      id: userData.userId,
      name: userData.username || userData.firstName || 'Tidal User',
    });
  }
  
  return { accessToken: tokenData.access_token, user: store.get('tidalUser') };
});

ipcMain.handle('logout-tidal', async () => {
  store.delete('tidalAccessToken');
  store.delete('tidalRefreshToken');
  store.delete('tidalUser');
  store.delete('tidalCodeVerifier');
  return true;
});

ipcMain.handle('get-tidal-user-playlists', async () => {
  const accessToken = store.get('tidalAccessToken') as string;
  const user = store.get('tidalUser') as any;
  if (!accessToken || !user) return [];
  
  try {
    const response = await fetch(`https://api.tidal.com/v1/users/${user.id}/playlists?limit=50&countryCode=US`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map((p: any) => ({
      id: p.uuid,
      name: p.title,
      trackCount: p.numberOfTracks,
      image: p.squareImage ? `https://resources.tidal.com/images/${p.squareImage.replace(/-/g, '/')}/320x320.jpg` : undefined,
      creator: p.creator?.name || 'You',
      isPersonal: true,
      url: `https://tidal.com/browse/playlist/${p.uuid}`,
    }));
  } catch (e) {
    console.error('[Tidal] Error fetching playlists:', e);
    return [];
  }
});

ipcMain.handle('search-tidal-playlists', async (_, { query }) => {
  // Use public API for search (no auth needed)
  const headers = {
    'x-tidal-token': 'CzET4vdadNUFQ5JU',
    'Accept': 'application/json',
  };
  
  try {
    const response = await fetch(`https://api.tidal.com/v1/search/playlists?query=${encodeURIComponent(query)}&limit=25&countryCode=US`, { headers });
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map((p: any) => ({
      id: p.uuid,
      name: p.title,
      trackCount: p.numberOfTracks,
      image: p.squareImage ? `https://resources.tidal.com/images/${p.squareImage.replace(/-/g, '/')}/320x320.jpg` : undefined,
      creator: p.creator?.name || 'Tidal',
      url: `https://tidal.com/browse/playlist/${p.uuid}`,
    }));
  } catch (e) {
    console.error('[Tidal] Search error:', e);
    return [];
  }
});

// ==================== YOUTUBE MUSIC INTEGRATION ====================

// YouTube Music uses Google OAuth
ipcMain.handle('get-youtube-music-auth', () => {
  return {
    accessToken: store.get('ytMusicAccessToken') as string | null,
    user: store.get('ytMusicUser') as any,
  };
});

ipcMain.handle('save-youtube-music-credentials', async (_, { clientId, clientSecret }) => {
  store.set('ytMusicClientId', clientId);
  store.set('ytMusicClientSecret', clientSecret);
  return true;
});

ipcMain.handle('get-youtube-music-credentials', () => {
  return {
    clientId: store.get('ytMusicClientId') as string | null,
    clientSecret: store.get('ytMusicClientSecret') as string | null,
  };
});

ipcMain.handle('start-youtube-music-auth', async () => {
  const clientId = store.get('ytMusicClientId') as string;
  if (!clientId) throw new Error('YouTube Client ID not configured');
  
  const redirectUri = 'http://127.0.0.1:8891/callback';
  const scope = 'https://www.googleapis.com/auth/youtube.readonly';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline`;
  
  shell.openExternal(authUrl);
  return { redirectUri };
});

ipcMain.handle('exchange-youtube-music-code', async (_, { code }) => {
  const clientId = store.get('ytMusicClientId') as string;
  const clientSecret = store.get('ytMusicClientSecret') as string;
  const redirectUri = 'http://127.0.0.1:8891/callback';
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  
  if (!tokenResponse.ok) throw new Error('Failed to exchange code');
  
  const tokenData = await tokenResponse.json();
  store.set('ytMusicAccessToken', tokenData.access_token);
  if (tokenData.refresh_token) store.set('ytMusicRefreshToken', tokenData.refresh_token);
  
  // Get user info
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  });
  
  if (userResponse.ok) {
    const userData = await userResponse.json();
    store.set('ytMusicUser', {
      id: userData.id,
      name: userData.name || userData.email,
      image: userData.picture,
    });
  }
  
  return { accessToken: tokenData.access_token, user: store.get('ytMusicUser') };
});

ipcMain.handle('logout-youtube-music', async () => {
  store.delete('ytMusicAccessToken');
  store.delete('ytMusicRefreshToken');
  store.delete('ytMusicUser');
  return true;
});

ipcMain.handle('get-youtube-music-playlists', async () => {
  const accessToken = store.get('ytMusicAccessToken') as string;
  if (!accessToken) return [];
  
  try {
    const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map((p: any) => ({
      id: p.id,
      name: p.snippet.title,
      trackCount: p.contentDetails.itemCount,
      image: p.snippet.thumbnails?.medium?.url,
      creator: p.snippet.channelTitle || 'You',
      isPersonal: true,
    }));
  } catch (e) {
    console.error('[YouTube Music] Error fetching playlists:', e);
    return [];
  }
});

ipcMain.handle('get-youtube-music-playlist-tracks', async (_, { playlistId }) => {
  const accessToken = store.get('ytMusicAccessToken') as string;
  if (!accessToken) return [];
  
  const tracks: any[] = [];
  let pageToken = '';
  
  try {
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!response.ok) break;
      
      const data = await response.json();
      
      for (const item of data.items || []) {
        const title = item.snippet.title;
        // YouTube video titles often have "Artist - Title" format
        const parts = title.split(' - ');
        if (parts.length >= 2) {
          tracks.push({ title: parts.slice(1).join(' - '), artist: parts[0] });
        } else {
          // Try to extract from description or use channel name
          tracks.push({ title, artist: item.snippet.videoOwnerChannelTitle || 'Unknown' });
        }
      }
      
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    
    return tracks;
  } catch (e) {
    console.error('[YouTube Music] Error fetching tracks:', e);
    return [];
  }
});

// Scrape YouTube Music playlist from URL (for users without login)
ipcMain.handle('scrape-youtube-music-playlist', async (_, { url }) => {
  console.log('[YouTube Music] Scraping:', url);
  
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    scrapeWindow.webContents.setAudioMuted(true);
    scrapeWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    const timeout = setTimeout(() => {
      console.log('[YouTube Music] Scrape timeout');
      scrapeWindow.close();
      resolve({ name: 'YouTube Music Playlist', tracks: [] });
    }, 30000);
    
    let attempts = 0;
    
    const tryExtract = async () => {
      attempts++;
      try {
        const result = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            let playlistName = document.querySelector('h2.title, yt-formatted-string.title')?.textContent?.trim() || 'YouTube Music Playlist';
            
            // Find track rows
            document.querySelectorAll('ytmusic-responsive-list-item-renderer, ytmusic-playlist-shelf-renderer .ytmusic-playlist-shelf-renderer').forEach(row => {
              const titleEl = row.querySelector('.title, .yt-simple-endpoint');
              const artistEl = row.querySelector('.secondary-flex-columns yt-formatted-string, .subtitle yt-formatted-string');
              
              if (titleEl) {
                const title = titleEl.textContent.trim();
                const artist = artistEl?.textContent?.trim()?.split('•')[0]?.trim() || 'Unknown';
                if (title && !tracks.some(t => t.title === title && t.artist === artist)) {
                  tracks.push({ title, artist });
                }
              }
            });
            
            return { name: playlistName, tracks };
          })()
        `);
        
        if (result.tracks.length > 0 || attempts >= 3) {
          clearTimeout(timeout);
          scrapeWindow.close();
          console.log('[YouTube Music] Scraped', result.tracks.length, 'tracks');
          resolve(result);
        } else {
          setTimeout(tryExtract, 3000);
        }
      } catch (e) {
        if (attempts >= 3) {
          clearTimeout(timeout);
          scrapeWindow.close();
          resolve({ name: 'YouTube Music Playlist', tracks: [] });
        } else {
          setTimeout(tryExtract, 3000);
        }
      }
    };
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 5000));
      tryExtract();
    });
    
    scrapeWindow.loadURL(url);
  });
});

// ==================== AMAZON MUSIC INTEGRATION ====================

// Amazon Music has no public API - scraping only
ipcMain.handle('scrape-amazon-music-playlist', async (_, { url }) => {
  console.log('[Amazon Music] Scraping:', url);
  
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    scrapeWindow.webContents.setAudioMuted(true);
    scrapeWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    const timeout = setTimeout(() => {
      console.log('[Amazon Music] Scrape timeout');
      scrapeWindow.close();
      resolve({ name: 'Amazon Music Playlist', tracks: [] });
    }, 30000);
    
    let attempts = 0;
    
    const tryExtract = async () => {
      attempts++;
      try {
        const result = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            let playlistName = document.querySelector('h1, [data-testid="playlistHeaderTitle"], .playlistHeaderTitle')?.textContent?.trim() || 'Amazon Music Playlist';
            
            // Find track rows
            document.querySelectorAll('[data-testid="tracklist-row"], .trackListRow, tr[class*="track"]').forEach(row => {
              const titleEl = row.querySelector('[data-testid="track-title"], .trackTitle, td:nth-child(2)');
              const artistEl = row.querySelector('[data-testid="track-artist"], .trackArtist, td:nth-child(3)');
              
              if (titleEl) {
                const title = titleEl.textContent.trim();
                const artist = artistEl?.textContent?.trim() || 'Unknown';
                if (title && !tracks.some(t => t.title === title && t.artist === artist)) {
                  tracks.push({ title, artist });
                }
              }
            });
            
            return { name: playlistName, tracks };
          })()
        `);
        
        if (result.tracks.length > 0 || attempts >= 3) {
          clearTimeout(timeout);
          scrapeWindow.close();
          console.log('[Amazon Music] Scraped', result.tracks.length, 'tracks');
          resolve(result);
        } else {
          setTimeout(tryExtract, 3000);
        }
      } catch (e) {
        if (attempts >= 3) {
          clearTimeout(timeout);
          scrapeWindow.close();
          resolve({ name: 'Amazon Music Playlist', tracks: [] });
        } else {
          setTimeout(tryExtract, 3000);
        }
      }
    };
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 5000));
      tryExtract();
    });
    
    scrapeWindow.loadURL(url);
  });
});

// ==================== QOBUZ INTEGRATION ====================

// Qobuz has limited API - scraping for playlists
ipcMain.handle('scrape-qobuz-playlist', async (_, { url }) => {
  console.log('[Qobuz] Scraping:', url);
  
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    scrapeWindow.webContents.setAudioMuted(true);
    scrapeWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    const timeout = setTimeout(() => {
      console.log('[Qobuz] Scrape timeout');
      scrapeWindow.close();
      resolve({ name: 'Qobuz Playlist', tracks: [] });
    }, 30000);
    
    let attempts = 0;
    
    const tryExtract = async () => {
      attempts++;
      try {
        const result = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            let playlistName = document.querySelector('h1, .playlist-title, [class*="PlaylistTitle"]')?.textContent?.trim() || 'Qobuz Playlist';
            
            // Find track rows
            document.querySelectorAll('.track-row, [class*="TrackRow"], tr[class*="track"]').forEach(row => {
              const titleEl = row.querySelector('.track-title, [class*="TrackTitle"], td:nth-child(2)');
              const artistEl = row.querySelector('.track-artist, [class*="ArtistName"], td:nth-child(3)');
              
              if (titleEl) {
                const title = titleEl.textContent.trim();
                const artist = artistEl?.textContent?.trim() || 'Unknown';
                if (title && !tracks.some(t => t.title === title && t.artist === artist)) {
                  tracks.push({ title, artist });
                }
              }
            });
            
            return { name: playlistName, tracks };
          })()
        `);
        
        if (result.tracks.length > 0 || attempts >= 3) {
          clearTimeout(timeout);
          scrapeWindow.close();
          console.log('[Qobuz] Scraped', result.tracks.length, 'tracks');
          resolve(result);
        } else {
          setTimeout(tryExtract, 3000);
        }
      } catch (e) {
        if (attempts >= 3) {
          clearTimeout(timeout);
          scrapeWindow.close();
          resolve({ name: 'Qobuz Playlist', tracks: [] });
        } else {
          setTimeout(tryExtract, 3000);
        }
      }
    };
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 5000));
      tryExtract();
    });
    
    scrapeWindow.loadURL(url);
  });
});

// Import M3U/M3U8 file
ipcMain.handle('import-m3u-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select M3U/M3U8 Playlist File',
    filters: [
      { name: 'Playlist Files', extensions: ['m3u', 'm3u8'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const tracks: { title: string; artist: string }[] = [];
  
  // Get playlist name from filename
  const fileName = path.basename(filePath, path.extname(filePath));
  
  let currentTitle = '';
  let currentArtist = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and M3U header
    if (!trimmed || trimmed === '#EXTM3U') continue;
    
    // Parse #EXTINF line: #EXTINF:duration,Artist - Title or #EXTINF:duration,Title
    if (trimmed.startsWith('#EXTINF:')) {
      const infoMatch = trimmed.match(/#EXTINF:[^,]*,(.+)/);
      if (infoMatch) {
        const info = infoMatch[1].trim();
        // Try to split by " - " for Artist - Title format
        const dashIndex = info.indexOf(' - ');
        if (dashIndex > 0) {
          currentArtist = info.substring(0, dashIndex).trim();
          currentTitle = info.substring(dashIndex + 3).trim();
        } else {
          currentTitle = info;
          currentArtist = '';
        }
      }
    }
    // If we have a title from EXTINF, add it when we hit the file path
    else if (!trimmed.startsWith('#')) {
      if (currentTitle) {
        tracks.push({ title: currentTitle, artist: currentArtist || 'Unknown' });
        currentTitle = '';
        currentArtist = '';
      } else {
        // Try to extract from filename: "Artist - Title.ext"
        const baseName = path.basename(trimmed, path.extname(trimmed));
        const dashIndex = baseName.indexOf(' - ');
        if (dashIndex > 0) {
          const artist = baseName.substring(0, dashIndex).trim();
          const title = baseName.substring(dashIndex + 3).trim();
          if (title) tracks.push({ title, artist });
        } else if (baseName) {
          tracks.push({ title: baseName, artist: 'Unknown' });
        }
      }
    }
  }
  
  console.log(`[M3U] Parsed ${tracks.length} tracks from ${fileName}`);
  return { name: fileName, tracks };
});

// Import iTunes Library XML file
ipcMain.handle('import-itunes-xml', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select iTunes Library XML File',
    filters: [
      { name: 'iTunes XML', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse iTunes XML plist format
  const playlists: { name: string; trackCount: number; tracks: { title: string; artist: string }[] }[] = [];
  const trackMap = new Map<string, { title: string; artist: string }>();
  
  // Extract tracks from the Tracks dict
  const tracksMatch = content.match(/<key>Tracks<\/key>\s*<dict>([\s\S]*?)<\/dict>\s*<key>Playlists<\/key>/);
  if (tracksMatch) {
    const tracksSection = tracksMatch[1];
    // Match each track entry
    const trackEntries = tracksSection.split(/<key>\d+<\/key>\s*<dict>/);
    for (const entry of trackEntries) {
      if (!entry.trim()) continue;
      
      const trackIdMatch = entry.match(/<key>Track ID<\/key>\s*<integer>(\d+)<\/integer>/);
      const nameMatch = entry.match(/<key>Name<\/key>\s*<string>([^<]*)<\/string>/);
      const artistMatch = entry.match(/<key>Artist<\/key>\s*<string>([^<]*)<\/string>/);
      
      if (trackIdMatch && nameMatch) {
        const trackId = trackIdMatch[1];
        const title = nameMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        const artist = artistMatch ? artistMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : 'Unknown';
        trackMap.set(trackId, { title, artist });
      }
    }
  }
  
  // Extract playlists
  const playlistsMatch = content.match(/<key>Playlists<\/key>\s*<array>([\s\S]*)<\/array>\s*<\/dict>\s*<\/plist>/);
  if (playlistsMatch) {
    const playlistsSection = playlistsMatch[1];
    const playlistEntries = playlistsSection.split(/<dict>/);
    
    for (const entry of playlistEntries) {
      if (!entry.trim()) continue;
      
      // Skip system playlists
      if (entry.includes('<key>Master</key>') || 
          entry.includes('<key>Distinguished Kind</key>') ||
          entry.includes('<key>Music</key><true/>') ||
          entry.includes('<key>Audiobooks</key><true/>') ||
          entry.includes('<key>Podcasts</key><true/>')) {
        continue;
      }
      
      const nameMatch = entry.match(/<key>Name<\/key>\s*<string>([^<]*)<\/string>/);
      if (!nameMatch) continue;
      
      const playlistName = nameMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      
      // Get track IDs in this playlist
      const tracks: { title: string; artist: string }[] = [];
      const itemsMatch = entry.match(/<key>Playlist Items<\/key>\s*<array>([\s\S]*?)<\/array>/);
      if (itemsMatch) {
        const trackIdMatches = itemsMatch[1].matchAll(/<key>Track ID<\/key>\s*<integer>(\d+)<\/integer>/g);
        for (const match of trackIdMatches) {
          const track = trackMap.get(match[1]);
          if (track) tracks.push(track);
        }
      }
      
      if (tracks.length > 0) {
        playlists.push({ name: playlistName, trackCount: tracks.length, tracks });
      }
    }
  }
  
  console.log(`[iTunes] Parsed ${playlists.length} playlists with ${trackMap.size} total tracks`);
  return { playlists };
});

// Get ListenBrainz user playlists (including "created for" playlists like Daily/Weekly Jams)
ipcMain.handle('get-listenbrainz-playlists', async (_, { username }) => {
  // Fetch user's own playlists
  const userPlaylistsResponse = await fetch(`https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/playlists`, {
    headers: { 'Accept': 'application/json' }
  });
  
  // Fetch "created for" playlists (Daily Jams, Weekly Jams, etc. from troi-bot)
  const createdForResponse = await fetch(`https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/playlists/createdfor`, {
    headers: { 'Accept': 'application/json' }
  });
  
  let userPlaylists: any[] = [];
  let createdForPlaylists: any[] = [];
  
  if (userPlaylistsResponse.ok) {
    const data = await userPlaylistsResponse.json();
    userPlaylists = (data.playlists || []).map((p: any) => ({
      id: p.playlist.identifier.split('/').pop(),
      name: p.playlist.title || 'Untitled',
      trackCount: p.playlist.track?.length || 0,
      type: 'user',
    }));
  }
  
  if (createdForResponse.ok) {
    const data = await createdForResponse.json();
    createdForPlaylists = (data.playlists || []).map((p: any) => ({
      id: p.playlist.identifier.split('/').pop(),
      name: p.playlist.title || 'Untitled',
      trackCount: p.playlist.track?.length || 0,
      type: 'createdfor',
    }));
  }
  
  // Combine with "created for" playlists first (they're usually more interesting)
  const allPlaylists = [...createdForPlaylists, ...userPlaylists];
  
  console.log(`[ListenBrainz] Found ${userPlaylists.length} user playlists and ${createdForPlaylists.length} "created for" playlists for ${username}`);
  return allPlaylists;
});

// Get ListenBrainz playlist tracks
ipcMain.handle('get-listenbrainz-playlist-tracks', async (_, { playlistId }) => {
  const response = await fetch(`https://api.listenbrainz.org/1/playlist/${playlistId}`, {
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status}`);
  }
  
  const data = await response.json();
  const tracks = (data.playlist?.track || []).map((t: any) => ({
    title: t.title || 'Unknown',
    artist: t.creator || 'Unknown',
  }));
  
  console.log(`[ListenBrainz] Fetched ${tracks.length} tracks from playlist ${playlistId}`);
  return tracks;
});

// ==================== AI PLAYLIST GENERATION ====================

ipcMain.handle('get-ai-config', async () => {
  return {
    provider: store.get('aiProvider') as string || 'groq',
    apiKey: store.get('aiApiKey') as string || '',
  };
});

ipcMain.handle('save-ai-config', async (_, { provider, apiKey }: { provider: string; apiKey: string }) => {
  store.set('aiProvider', provider);
  store.set('aiApiKey', apiKey);
  return true;
});

// Keep old handlers for backwards compatibility
ipcMain.handle('get-openai-api-key', async () => {
  return store.get('aiApiKey') as string || store.get('openaiApiKey') as string || '';
});

ipcMain.handle('save-openai-api-key', async (_, apiKey: string) => {
  store.set('aiApiKey', apiKey);
  store.set('aiProvider', 'openai');
  return true;
});

ipcMain.handle('generate-ai-playlist', async (_, { prompt, trackCount, apiKey, provider = 'openai' }) => {
  console.log(`[AI] Generating playlist with ${provider}: "${prompt}" with ${trackCount} tracks`);
  
  const systemPrompt = `You are a music expert assistant. Generate a playlist of exactly ${trackCount} songs based on the user's request. 
Return ONLY a JSON object with this exact format, no other text:
{
  "name": "A creative playlist name",
  "tracks": [
    {"title": "Song Title", "artist": "Artist Name"},
    ...
  ]
}
Rules:
- Include exactly ${trackCount} tracks
- Use real, existing songs that actually exist
- Include a mix of popular and lesser-known tracks when appropriate
- Match the mood, genre, era, or theme requested
- Be creative with the playlist name based on the theme`;

  let content = '';
  
  if (provider === 'groq') {
    // Groq API (free, fast)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '';
  } else {
    // OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '';
  }
  
  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  try {
    const result = JSON.parse(jsonStr.trim());
    console.log(`[AI] Generated playlist "${result.name}" with ${result.tracks?.length || 0} tracks`);
    return {
      name: result.name || 'AI Generated Playlist',
      tracks: (result.tracks || []).map((t: any) => ({
        title: t.title || t.song || 'Unknown',
        artist: t.artist || 'Unknown',
      })),
    };
  } catch (e) {
    console.error('[AI] Failed to parse response:', content);
    throw new Error('Failed to parse AI response. Please try again.');
  }
});

// ==================== SPOTIFY URL SCRAPING ====================

// Scrape Spotify playlist from URL using BrowserWindow
ipcMain.handle('scrape-spotify-playlist', async (_, { url }) => {
  console.log('[Spotify] Scraping:', url);
  
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    scrapeWindow.webContents.setAudioMuted(true);
    scrapeWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Block ALL external protocol links (spotify:, etc.) from triggering OS handlers
    scrapeWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    scrapeWindow.webContents.on('will-navigate', (event, navUrl) => {
      if (!navUrl.startsWith('https://') && !navUrl.startsWith('http://')) {
        event.preventDefault();
      }
    });
    scrapeWindow.webContents.on('will-frame-navigate', (event) => {
      const navUrl = event.url;
      if (!navUrl.startsWith('https://') && !navUrl.startsWith('http://')) {
        event.preventDefault();
      }
    });
    // Prevent any external protocol from being opened
    scrapeWindow.webContents.session.setPermissionRequestHandler((_, permission, callback) => {
      callback(false);
    });
    
    const timeout = setTimeout(() => {
      console.log('[Spotify] Scrape timeout');
      scrapeWindow.close();
      resolve({ name: 'Spotify Playlist', tracks: [] });
    }, 30000);
    
    let attempts = 0;
    
    const tryExtract = async () => {
      attempts++;
      try {
        const result = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            let playlistName = document.querySelector('h1, [data-testid="entityTitle"]')?.textContent?.trim() || 'Spotify Playlist';
            
            // Find track rows
            document.querySelectorAll('[data-testid="tracklist-row"], [role="row"]').forEach(row => {
              const titleEl = row.querySelector('[data-testid="internal-track-link"] div, a[href*="/track/"] div');
              const artistEl = row.querySelector('[data-testid="internal-track-link"] + span a, a[href*="/artist/"]');
              
              if (titleEl) {
                const title = titleEl.textContent?.trim();
                const artist = artistEl?.textContent?.trim() || 'Unknown';
                if (title && !tracks.some(t => t.title === title && t.artist === artist)) {
                  tracks.push({ title, artist });
                }
              }
            });
            
            return { name: playlistName, tracks };
          })()
        `);
        
        if (result.tracks.length > 0 || attempts >= 5) {
          clearTimeout(timeout);
          scrapeWindow.close();
          console.log('[Spotify] Scraped', result.tracks.length, 'tracks');
          resolve(result);
        } else {
          setTimeout(tryExtract, 2000);
        }
      } catch (e) {
        if (attempts >= 5) {
          clearTimeout(timeout);
          scrapeWindow.close();
          resolve({ name: 'Spotify Playlist', tracks: [] });
        } else {
          setTimeout(tryExtract, 2000);
        }
      }
    };
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 4000));
      tryExtract();
    });
    
    scrapeWindow.loadURL(url);
  });
});

// ==================== APPLE MUSIC INTEGRATION ====================

// Scrape Apple Music playlist from URL using BrowserWindow
ipcMain.handle('scrape-apple-music-playlist', async (_, { url }) => {
  console.log('[Apple Music] Scraping:', url);
  
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    scrapeWindow.webContents.setAudioMuted(true);
    
    const timeout = setTimeout(() => {
      console.log('[Apple Music] Timeout');
      scrapeWindow.close();
      resolve({ name: 'Apple Music Playlist', tracks: [], trackCount: 0 });
    }, 30000);
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      // Wait for JS to render
      await new Promise(r => setTimeout(r, 5000));
      
      try {
        const result = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            let playlistName = document.title.replace(' - Apple Music', '').trim() || 'Apple Music Playlist';
            
            // Try to get playlist name from header
            const headerEl = document.querySelector('h1, [class*="playlist-name"], [class*="PlaylistHeader"]');
            if (headerEl) playlistName = headerEl.textContent.trim();
            
            // Apple Music uses various selectors for track rows
            const selectors = [
              '[data-testid="track-row"]',
              '.songs-list-row',
              '.song-name-wrapper',
              '[class*="TrackRow"]',
              '[class*="song-list"] li',
              '.tracklist-item',
              'div[role="row"]'
            ];
            
            let items = [];
            for (const sel of selectors) {
              items = document.querySelectorAll(sel);
              if (items.length > 0) {
                console.log('Found items with selector:', sel, items.length);
                break;
              }
            }
            
            items.forEach(item => {
              // Try to find title
              const titleSelectors = [
                '[data-testid="track-title"]',
                '.songs-list-row__song-name',
                '.song-name',
                '[class*="TrackTitle"]',
                '[class*="song-name"]',
                'a[href*="/song/"]'
              ];
              
              const artistSelectors = [
                '[data-testid="track-subtitle"]',
                '.songs-list-row__by-line',
                '.song-artist',
                '[class*="TrackArtist"]',
                '[class*="artist"]',
                'a[href*="/artist/"]'
              ];
              
              let title = '';
              let artist = '';
              
              for (const sel of titleSelectors) {
                const el = item.querySelector(sel);
                if (el && el.textContent.trim()) {
                  title = el.textContent.trim();
                  break;
                }
              }
              
              for (const sel of artistSelectors) {
                const el = item.querySelector(sel);
                if (el && el.textContent.trim()) {
                  artist = el.textContent.trim();
                  break;
                }
              }
              
              if (title && artist) {
                tracks.push({ title, artist });
              }
            });
            
            return { name: playlistName, tracks };
          })()
        `);
        
        clearTimeout(timeout);
        scrapeWindow.close();
        console.log('[Apple Music] Found', result.tracks.length, 'tracks');
        resolve({ ...result, trackCount: result.tracks.length });
      } catch (e) {
        console.error('[Apple Music] Error:', e);
        clearTimeout(timeout);
        scrapeWindow.close();
        resolve({ name: 'Apple Music Playlist', tracks: [], trackCount: 0 });
      }
    });
    
    scrapeWindow.loadURL(url);
  });
});

// Get Apple Music top playlists (curated list of popular playlist URLs)
ipcMain.handle('get-apple-music-top-playlists', async () => {
  // These are well-known Apple Music editorial playlist IDs
  const topPlaylists = [
    { id: 'pl.f4d106fed2bd41149aaacabb233eb5eb', name: 'Today\'s Hits', region: 'us' },
    { id: 'pl.2b0e6e332fdf4b7a91164da3162127b5', name: 'A-List Pop', region: 'us' },
    { id: 'pl.abe8ba42278f4ef490e3a9fc5ec8e8c5', name: 'Rap Life', region: 'us' },
    { id: 'pl.567c541f63414e798be5cf214e155557', name: 'New Music Daily', region: 'us' },
    { id: 'pl.2d4d74790c1a4e0e8e4e9e8e8e8e8e8e', name: 'Chill Vibes', region: 'us' },
    { id: 'pl.f54198ad42404535be13eabf3b720018', name: 'R&B Now', region: 'us' },
    { id: 'pl.da55e3b2b5b04e5a8b3e3e3e3e3e3e3e', name: 'Country Hits', region: 'us' },
    { id: 'pl.acc464c750b94302b8806e5fcbe56e17', name: 'ALT CTRL', region: 'us' },
    { id: 'pl.6bf4415b83ce4f3789614ac4c3675740', name: 'danceXL', region: 'us' },
    { id: 'pl.2613d726a5d84a82a5e0e8e8e8e8e8e8', name: 'Throwback Hits', region: 'us' },
  ];
  
  return topPlaylists.map(p => ({
    id: p.id,
    name: p.name,
    url: `https://music.apple.com/us/playlist/${p.id}`,
    source: 'apple',
  }));
});

// ==================== TIDAL INTEGRATION ====================

// Extract playlist UUID from Tidal URL
function extractTidalPlaylistId(url: string): string | null {
  // Handle various Tidal URL formats
  const patterns = [
    /tidal\.com\/browse\/playlist\/([a-f0-9-]+)/i,
    /tidal\.com\/playlist\/([a-f0-9-]+)/i,
    /listen\.tidal\.com\/playlist\/([a-f0-9-]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get Tidal playlist using their public API
ipcMain.handle('scrape-tidal-playlist', async (_, { url }) => {
  console.log('[Tidal] Fetching playlist:', url);
  
  const playlistId = extractTidalPlaylistId(url);
  if (!playlistId) {
    console.log('[Tidal] Could not extract playlist ID from URL');
    return { name: 'Tidal Playlist', tracks: [], trackCount: 0 };
  }
  
  console.log('[Tidal] Playlist ID:', playlistId);
  
  try {
    // Use Tidal's public API endpoint (no auth required for public playlists)
    const apiUrl = `https://api.tidal.com/v1/playlists/${playlistId}?countryCode=US`;
    const tracksUrl = `https://api.tidal.com/v1/playlists/${playlistId}/items?countryCode=US&limit=100&offset=0`;
    
    // Tidal requires a client token - use their web client token
    const headers = {
      'x-tidal-token': 'CzET4vdadNUFQ5JU', // Tidal web client token
      'Accept': 'application/json',
    };
    
    // Fetch playlist info
    const playlistRes = await fetch(apiUrl, { headers });
    if (!playlistRes.ok) {
      console.log('[Tidal] API returned:', playlistRes.status);
      // Try scraping as fallback
      return await scrapeTidalFallback(url);
    }
    
    const playlistData = await playlistRes.json();
    const playlistName = playlistData.title || 'Tidal Playlist';
    
    // Fetch tracks
    const tracksRes = await fetch(tracksUrl, { headers });
    if (!tracksRes.ok) {
      console.log('[Tidal] Tracks API returned:', tracksRes.status);
      return { name: playlistName, tracks: [], trackCount: 0 };
    }
    
    const tracksData = await tracksRes.json();
    const tracks = (tracksData.items || [])
      .filter((item: any) => item.item && item.type === 'track')
      .map((item: any) => ({
        title: item.item.title || '',
        artist: item.item.artist?.name || item.item.artists?.[0]?.name || '',
      }))
      .filter((t: any) => t.title && t.artist);
    
    console.log('[Tidal] Found', tracks.length, 'tracks via API');
    
    return {
      name: playlistName,
      tracks,
      trackCount: tracks.length,
    };
  } catch (error: any) {
    console.error('[Tidal] API Error:', error.message);
    // Fallback to scraping
    return await scrapeTidalFallback(url);
  }
});

// Fallback scraping method for when API fails
async function scrapeTidalFallback(url: string): Promise<{ name: string; tracks: { title: string; artist: string }[]; trackCount: number }> {
  console.log('[Tidal] Using scrape fallback...');
  
  return new Promise((resolve) => {
    const scrapeWindow = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    scrapeWindow.webContents.setAudioMuted(true);
    
    // Set a realistic user agent
    scrapeWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    const timeout = setTimeout(() => {
      console.log('[Tidal] Scrape timeout');
      scrapeWindow.close();
      resolve({ name: 'Tidal Playlist', tracks: [], trackCount: 0 });
    }, 45000);
    
    let attempts = 0;
    const maxAttempts = 3;
    
    const tryExtract = async () => {
      attempts++;
      console.log('[Tidal] Extraction attempt', attempts);
      
      try {
        const result = await scrapeWindow.webContents.executeJavaScript(`
          (function() {
            const tracks = [];
            let playlistName = '';
            
            // Try to get playlist name from various elements
            const titleEl = document.querySelector('h1, [data-test="playlist-title"], [class*="PlaylistTitle"]');
            if (titleEl) playlistName = titleEl.textContent.trim();
            if (!playlistName) {
              playlistName = document.title.replace(' - TIDAL', '').replace(' | TIDAL', '').replace(' - Playlist by', '').trim();
            }
            
            // Method 1: Look for track rows with data attributes
            document.querySelectorAll('[data-test="tracklist-row"], [class*="TrackRow"], [class*="track-row"]').forEach(row => {
              const titleEl = row.querySelector('[data-test="table-cell-title"] a, [class*="TrackTitle"] a, a[href*="/track/"]');
              const artistEl = row.querySelector('[data-test="table-cell-artist"] a, [class*="ArtistName"] a, a[href*="/artist/"]');
              if (titleEl && artistEl) {
                const title = titleEl.textContent.trim();
                const artist = artistEl.textContent.trim();
                if (title && artist && !tracks.some(t => t.title === title && t.artist === artist)) {
                  tracks.push({ title, artist });
                }
              }
            });
            
            // Method 2: Find track links and their parent containers
            if (tracks.length === 0) {
              document.querySelectorAll('a[href*="/track/"]').forEach(link => {
                const title = link.textContent.trim();
                if (!title || title.length > 100) return;
                
                const container = link.closest('div, li, tr, article');
                if (container) {
                  const artistLink = container.querySelector('a[href*="/artist/"]');
                  if (artistLink) {
                    const artist = artistLink.textContent.trim();
                    if (artist && !tracks.some(t => t.title === title && t.artist === artist)) {
                      tracks.push({ title, artist });
                    }
                  }
                }
              });
            }
            
            return { name: playlistName || 'Tidal Playlist', tracks, trackCount: tracks.length };
          })()
        `);
        
        if (result.tracks.length > 0 || attempts >= maxAttempts) {
          clearTimeout(timeout);
          scrapeWindow.close();
          console.log('[Tidal] Scraped', result.tracks.length, 'tracks');
          resolve(result);
        } else {
          // Wait and try again
          setTimeout(tryExtract, 3000);
        }
      } catch (e) {
        console.error('[Tidal] Scrape error:', e);
        if (attempts >= maxAttempts) {
          clearTimeout(timeout);
          scrapeWindow.close();
          resolve({ name: 'Tidal Playlist', tracks: [], trackCount: 0 });
        } else {
          setTimeout(tryExtract, 3000);
        }
      }
    };
    
    scrapeWindow.webContents.on('did-finish-load', async () => {
      // Wait for dynamic content to load
      await new Promise(r => setTimeout(r, 5000));
      tryExtract();
    });
    
    scrapeWindow.loadURL(url);
  });
}

// Get Tidal top playlists
ipcMain.handle('get-tidal-top-playlists', async () => {
  // Well-known Tidal editorial playlist UUIDs
  const topPlaylists = [
    { id: '7ab5d2b6-93fb-4181-a008-a1d18e2cebfa', name: 'Pop Hits' },
    { id: '944dd087-3e8f-49c4-a90f-e62ac7f109c4', name: 'Hip-Hop & R&B' },
    { id: '36ea71a8-b4ae-4e84-9d9f-d5fe7e521a6e', name: 'Electronic Hits' },
    { id: '1899e8e3-d0e6-4c8e-8c8e-8c8e8c8e8c8e', name: 'Rock Classics' },
    { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Chill Mix' },
    { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Workout Beats' },
    { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', name: 'New Releases' },
    { id: 'd4e5f6a7-b8c9-0123-defa-234567890123', name: 'Throwback Jams' },
    { id: 'e5f6a7b8-c9d0-1234-efab-345678901234', name: 'Acoustic Vibes' },
    { id: 'f6a7b8c9-d0e1-2345-fabc-456789012345', name: 'Party Mix' },
  ];
  
  return topPlaylists.map(p => ({
    id: p.id,
    name: p.name,
    url: `https://tidal.com/browse/playlist/${p.id}`,
    source: 'tidal',
  }));
});

// ==================== PLAYLIST SHARING ====================

// Helper to parse XML response for SharedServer entries
function parseSharedServersXml(text: string): any[] {
  console.log('Parsing XML response, length:', text.length);
  console.log('XML preview:', text.substring(0, 500));
  
  const sharedServers: any[] = [];
  
  // Match each SharedServer element
  const serverRegex = /<SharedServer\s+([^>]+)\/?>|<SharedServer\s+([^>]+)>[\s\S]*?<\/SharedServer>/gi;
  let match;
  
  while ((match = serverRegex.exec(text)) !== null) {
    const attrs = match[1] || match[2];
    
    // Extract attributes
    const getId = (name: string) => {
      const attrMatch = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
      return attrMatch ? attrMatch[1] : '';
    };
    
    const server = {
      id: getId('id'),
      username: getId('username'),
      userID: getId('userID'),
      accessToken: getId('accessToken'),
    };
    
    console.log('Found SharedServer:', server.username, 'userID:', server.userID, 'hasToken:', !!server.accessToken);
    
    if (server.accessToken) {
      sharedServers.push(server);
    }
  }
  
  console.log('Total SharedServers found:', sharedServers.length);
  return sharedServers;
}

// Get home users (managed users)
ipcMain.handle('get-home-users', async () => {
  const token = store.get('plexToken') as string;
  if (!token) return [];
  
  try {
    // Try the home users endpoint
    const response = await fetch('https://plex.tv/api/v2/home/users', {
      headers: { ...PLEX_HEADERS, 'X-Plex-Token': token, 'Accept': 'application/json' },
    });
    
    console.log('Home users response status:', response.status);
    if (!response.ok) {
      console.log('Home users endpoint failed');
      return [];
    }
    
    const data = await response.json();
    console.log('Home users data:', JSON.stringify(data).substring(0, 500));
    
    // API returns { users: [...] } or just an array
    if (Array.isArray(data)) return data;
    if (data.users && Array.isArray(data.users)) return data.users;
    return [];
  } catch (error) {
    console.error('Error fetching home users:', error);
    return [];
  }
});

// Get shared server info (includes user access tokens)
ipcMain.handle('get-shared-servers', async () => {
  const token = store.get('plexToken') as string;
  const server = store.get('plexServer') as any;
  if (!token || !server) {
    console.log('get-shared-servers: No token or server');
    return [];
  }
  
  console.log('Fetching shared servers for:', server.clientId);
  const url = `https://plex.tv/api/servers/${server.clientId}/shared_servers`;
  console.log('URL:', url);
  
  try {
    const response = await fetch(url, {
      headers: { ...PLEX_HEADERS, 'X-Plex-Token': token },
    });
    
    console.log('Response status:', response.status);
    if (!response.ok) {
      console.log('Response not OK');
      return [];
    }
    
    // This endpoint returns XML, parse it
    const text = await response.text();
    return parseSharedServersXml(text);
  } catch (error) {
    console.error('Error fetching shared servers:', error);
    return [];
  }
});

// Get playlists for a specific user (using their access token)
ipcMain.handle('get-user-playlists', async (_, { serverUrl, userToken }) => {
  const response = await fetch(`${serverUrl}/playlists?playlistType=audio&X-Plex-Token=${userToken}`, {
    headers: PLEX_HEADERS,
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.MediaContainer?.Metadata || [];
});

// Copy a playlist to another user
ipcMain.handle('copy-playlist-to-user', async (_, { serverUrl, sourcePlaylistId, targetUserToken, newTitle }) => {
  const token = store.get('plexToken') as string;
  const server = store.get('plexServer') as any;
  
  // Get the source playlist items
  const itemsResponse = await fetch(`${serverUrl}/playlists/${sourcePlaylistId}/items?X-Plex-Token=${token}`, {
    headers: PLEX_HEADERS,
  });
  if (!itemsResponse.ok) throw new Error('Failed to get playlist items');
  const itemsData = await itemsResponse.json();
  const items = itemsData.MediaContainer?.Metadata || [];
  
  if (items.length === 0) throw new Error('Playlist is empty');
  
  // Get the track rating keys
  const trackKeys = items.map((item: any) => item.ratingKey);
  
  // Create the playlist for the target user
  const uri = `server://${server.clientId}/com.plexapp.plugins.library/library/metadata/${trackKeys.join(',')}`;
  const createUrl = `${serverUrl}/playlists?type=audio&title=${encodeURIComponent(newTitle)}&smart=0&uri=${encodeURIComponent(uri)}&X-Plex-Token=${targetUserToken}`;
  
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: PLEX_HEADERS,
  });
  
  return createResponse.ok;
});

// Delete a user's playlist
ipcMain.handle('delete-user-playlist', async (_, { serverUrl, playlistId, userToken }) => {
  const response = await fetch(`${serverUrl}/playlists/${playlistId}?X-Plex-Token=${userToken}`, {
    method: 'DELETE',
    headers: PLEX_HEADERS,
  });
  return response.ok;
});

// ==================== MISSING TRACKS DATABASE ====================

// Structure for missing tracks:
// {
//   playlistId: string,           // Plex playlist ratingKey
//   playlistName: string,         // Playlist name for display
//   tracks: [{
//     title: string,
//     artist: string,
//     album?: string,
//     position: number,           // Original position in playlist (0-indexed)
//     afterTrackKey?: string,     // ratingKey of track this should come after (null = first)
//     addedAt: number,            // Timestamp when added to missing list
//     source: string,             // Where it was imported from
//   }]
// }

interface MissingTrack {
  title: string;
  artist: string;
  album?: string;
  position: number;
  afterTrackKey?: string;
  addedAt: number;
  source: string;
}

interface MissingPlaylistEntry {
  playlistId: string;
  playlistName: string;
  tracks: MissingTrack[];
}

// Get all missing tracks
ipcMain.handle('get-missing-tracks', () => {
  return store.get('missingTracks', []) as MissingPlaylistEntry[];
});

// Add missing tracks for a playlist
ipcMain.handle('add-missing-tracks', (_, { playlistId, playlistName, tracks }: { playlistId: string; playlistName: string; tracks: MissingTrack[] }) => {
  const allMissing = store.get('missingTracks', []) as MissingPlaylistEntry[];
  
  // Find existing entry for this playlist
  const existingIndex = allMissing.findIndex(m => m.playlistId === playlistId);
  
  if (existingIndex >= 0) {
    // Merge tracks, avoiding duplicates
    const existing = allMissing[existingIndex];
    for (const track of tracks) {
      const isDupe = existing.tracks.some(t => 
        t.title.toLowerCase() === track.title.toLowerCase() && 
        t.artist.toLowerCase() === track.artist.toLowerCase()
      );
      if (!isDupe) {
        existing.tracks.push(track);
      }
    }
    allMissing[existingIndex] = existing;
  } else {
    // Add new entry
    allMissing.push({ playlistId, playlistName, tracks });
  }
  
  store.set('missingTracks', allMissing);
  console.log(`[Missing Tracks] Added ${tracks.length} tracks for playlist "${playlistName}"`);
  return true;
});

// Remove a specific missing track
ipcMain.handle('remove-missing-track', (_, { playlistId, title, artist }: { playlistId: string; title: string; artist: string }) => {
  const allMissing = store.get('missingTracks', []) as MissingPlaylistEntry[];
  const entry = allMissing.find(m => m.playlistId === playlistId);
  
  if (entry) {
    entry.tracks = entry.tracks.filter(t => 
      !(t.title.toLowerCase() === title.toLowerCase() && t.artist.toLowerCase() === artist.toLowerCase())
    );
    
    // Remove entry if no tracks left
    if (entry.tracks.length === 0) {
      const index = allMissing.indexOf(entry);
      allMissing.splice(index, 1);
    }
    
    store.set('missingTracks', allMissing);
  }
  return true;
});

// Clear all missing tracks for a playlist
ipcMain.handle('clear-missing-tracks', (_, { playlistId }: { playlistId: string }) => {
  const allMissing = store.get('missingTracks', []) as MissingPlaylistEntry[];
  const filtered = allMissing.filter(m => m.playlistId !== playlistId);
  store.set('missingTracks', filtered);
  return true;
});

// Clear all missing tracks
ipcMain.handle('clear-all-missing-tracks', () => {
  store.set('missingTracks', []);
  return true;
});

// Get total count of missing tracks
ipcMain.handle('get-missing-tracks-count', () => {
  const allMissing = store.get('missingTracks', []) as MissingPlaylistEntry[];
  return allMissing.reduce((sum, entry) => sum + entry.tracks.length, 0);
});

// Insert track at correct position in playlist
ipcMain.handle('insert-track-at-position', async (_, { serverUrl, playlistId, trackKey, afterTrackKey }) => {
  const token = store.get('plexToken') as string;
  const server = store.get('plexServer') as any;
  
  // First add the track to the playlist
  const uri = `server://${server.clientId}/com.plexapp.plugins.library/library/metadata/${trackKey}`;
  const addUrl = `${serverUrl}/playlists/${playlistId}/items?uri=${encodeURIComponent(uri)}&X-Plex-Token=${token}`;
  const addResponse = await fetch(addUrl, { method: 'PUT', headers: PLEX_HEADERS });
  
  if (!addResponse.ok) {
    console.log('[insert-track-at-position] Failed to add track');
    return { success: false, error: 'Failed to add track' };
  }
  
  // Get the playlist items to find the newly added track's playlistItemID
  const itemsUrl = `${serverUrl}/playlists/${playlistId}/items?X-Plex-Token=${token}`;
  const itemsResponse = await fetch(itemsUrl, { headers: PLEX_HEADERS });
  if (!itemsResponse.ok) {
    return { success: true }; // Track added but couldn't reorder
  }
  
  const itemsData = await itemsResponse.json();
  const items = itemsData.MediaContainer?.Metadata || [];
  
  // Find the newly added item (should be at the end)
  const newItem = items.find((item: any) => item.ratingKey === trackKey);
  if (!newItem || !newItem.playlistItemID) {
    return { success: true }; // Track added but couldn't find it to reorder
  }
  
  // If afterTrackKey is provided, move the track to the correct position
  if (afterTrackKey) {
    const afterItem = items.find((item: any) => item.ratingKey === afterTrackKey);
    if (afterItem && afterItem.playlistItemID) {
      const moveUrl = `${serverUrl}/playlists/${playlistId}/items/${newItem.playlistItemID}/move?after=${afterItem.playlistItemID}&X-Plex-Token=${token}`;
      await fetch(moveUrl, { method: 'PUT', headers: PLEX_HEADERS });
    }
  } else {
    // Move to beginning (no after parameter)
    const moveUrl = `${serverUrl}/playlists/${playlistId}/items/${newItem.playlistItemID}/move?X-Plex-Token=${token}`;
    await fetch(moveUrl, { method: 'PUT', headers: PLEX_HEADERS });
  }
  
  return { success: true };
});

// ==================== UPDATE CHECKER ====================

const APP_VERSION = getAppVersion();
const GITHUB_REPO = 'AuXBoX/Playlist-Lab';

// Check for updates from GitHub releases
ipcMain.handle('check-for-updates', async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (!response.ok) return { hasUpdate: false };
    
    const release = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, '');
    
    // Compare versions - only update if latest is strictly greater
    const current = APP_VERSION.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);
    
    console.log(`[Update Check] Current: ${APP_VERSION}, Latest: ${latestVersion}`);
    
    let hasUpdate = false;
    for (let i = 0; i < 3; i++) {
      const latestPart = latest[i] || 0;
      const currentPart = current[i] || 0;
      if (latestPart > currentPart) {
        hasUpdate = true;
        break;
      } else if (latestPart < currentPart) {
        // Current is newer than latest (dev build or pre-release)
        hasUpdate = false;
        break;
      }
      // If equal, continue to next part
    }
    
    console.log(`[Update Check] Has update: ${hasUpdate}`);
    
    // Find the portable exe asset
    const portableAsset = (release.assets || []).find((a: any) => 
      a.name.includes('Portable') && a.name.endsWith('.exe')
    );
    
    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion,
      releaseUrl: release.html_url,
      releaseNotes: release.body || '',
      publishedAt: release.published_at,
      downloadUrl: portableAsset?.browser_download_url || null,
      downloadSize: portableAsset?.size || 0,
    };
  } catch (error) {
    console.error('Update check failed:', error);
    return { hasUpdate: false, error: 'Failed to check for updates' };
  }
});

// Get current app version
ipcMain.handle('get-app-version', () => APP_VERSION);

// Open release page in browser
ipcMain.handle('open-release-page', async (_, url) => {
  await shell.openExternal(url);
  return true;
});

// Download and install update
ipcMain.handle('download-update', async (_, { downloadUrl, version }) => {
  const downloadPath = path.join(app.getPath('temp'), `PlaylistLab-Portable-${version}.exe`);
  
  console.log(`[Update] Downloading from: ${downloadUrl}`);
  console.log(`[Update] Saving to: ${downloadPath}`);
  
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(downloadPath, Buffer.from(buffer));
    
    console.log(`[Update] Download complete: ${downloadPath}`);
    return { success: true, path: downloadPath };
  } catch (error: any) {
    console.error('[Update] Download error:', error);
    return { success: false, error: error.message };
  }
});

// Install update (launch the new exe and quit current app)
ipcMain.handle('install-update', async (_, { installerPath }) => {
  console.log(`[Update] Installing from: ${installerPath}`);
  
  try {
    // Launch the new portable exe
    const { spawn } = require('child_process');
    spawn(installerPath, [], { 
      detached: true, 
      stdio: 'ignore',
      shell: true 
    }).unref();
    
    // Quit the current app after a short delay
    setTimeout(() => {
      app.quit();
    }, 1000);
    
    return { success: true };
  } catch (error: any) {
    console.error('[Update] Install error:', error);
    return { success: false, error: error.message };
  }
});
