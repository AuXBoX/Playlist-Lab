import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Auth
  getAuth: () => ipcRenderer.invoke('get-auth'),
  startAuth: () => ipcRenderer.invoke('start-auth'),
  pollAuth: (data: { id: string; code: string }) => ipcRenderer.invoke('poll-auth', data),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Servers
  getServers: () => ipcRenderer.invoke('get-servers'),
  selectServer: (server: any) => ipcRenderer.invoke('select-server', server),
  getLibraries: (data: { serverUrl: string }) => ipcRenderer.invoke('get-libraries', data),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  
  // Plex operations
  searchTrack: (data: { serverUrl: string; query: string }) => ipcRenderer.invoke('search-track', data),
  createPlaylist: (data: { serverUrl: string; title: string; trackKeys: string[] }) => ipcRenderer.invoke('create-playlist', data),
  getPlaylists: (data: { serverUrl: string }) => ipcRenderer.invoke('get-playlists', data),
  getPlaylistTracks: (data: { serverUrl: string; playlistId: string }) => ipcRenderer.invoke('get-playlist-tracks', data),
  addToPlaylist: (data: { serverUrl: string; playlistId: string; trackKey: string }) => ipcRenderer.invoke('add-to-playlist', data),
  removeFromPlaylist: (data: { serverUrl: string; playlistId: string; playlistItemId: string }) => ipcRenderer.invoke('remove-from-playlist', data),
  
  // Weekly mix operations
  getPlayHistory: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-play-history', data),
  findArtist: (data: { serverUrl: string; libraryId: string; name: string }) => ipcRenderer.invoke('find-artist', data),
  getArtistPopularTracks: (data: { serverUrl: string; libraryId: string; artistKey: string; limit: number }) => ipcRenderer.invoke('get-artist-popular-tracks', data),
  getRandomArtists: (data: { serverUrl: string; libraryId: string; limit: number }) => ipcRenderer.invoke('get-random-artists', data),
  
  // Mixes operations
  getRecentTracks: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-recent-tracks', data),
  getMonthlyTracks: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-monthly-tracks', data),
  getSimilarTracks: (data: { serverUrl: string; trackKey: string }) => ipcRenderer.invoke('get-similar-tracks', data),
  getRecentAlbums: (data: { serverUrl: string; libraryId: string; limit: number }) => ipcRenderer.invoke('get-recent-albums', data),
  getAlbumTracks: (data: { serverUrl: string; albumKey: string }) => ipcRenderer.invoke('get-album-tracks', data),
  deletePlaylist: (data: { serverUrl: string; playlistId: string }) => ipcRenderer.invoke('delete-playlist', data),
  
  // Scheduling
  getRefreshTimes: () => ipcRenderer.invoke('get-refresh-times'),
  setRefreshTime: (data: { playlistId: string; timestamp: number }) => ipcRenderer.invoke('set-refresh-time', data),
  needsRefresh: (data: { playlistId: string; scheduleHours: number }) => ipcRenderer.invoke('needs-refresh', data),
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  saveSchedule: (schedule: any) => ipcRenderer.invoke('save-schedule', schedule),
  deleteSchedule: (playlistId: string) => ipcRenderer.invoke('delete-schedule', playlistId),
  getDueSchedules: () => ipcRenderer.invoke('get-due-schedules'),
  markScheduleRun: (playlistId: string) => ipcRenderer.invoke('mark-schedule-run', playlistId),
  
  // Mixes schedule
  getMixesSchedule: () => ipcRenderer.invoke('get-mixes-schedule'),
  saveMixesSchedule: (schedule: any) => ipcRenderer.invoke('save-mixes-schedule', schedule),
  checkMixesScheduleDue: () => ipcRenderer.invoke('check-mixes-schedule-due'),
  markMixesScheduleRun: () => ipcRenderer.invoke('mark-mixes-schedule-run'),
  
  // ARIA scraping (Australia)
  scrapeAriaCharts: (selectedChartIds?: string[]) => ipcRenderer.invoke('scrape-aria-charts', selectedChartIds),
  
  // Spotify integration
  getSpotifyAuth: () => ipcRenderer.invoke('get-spotify-auth'),
  saveSpotifyCredentials: (data: { clientId: string; clientSecret: string }) => ipcRenderer.invoke('save-spotify-credentials', data),
  getSpotifyCredentials: () => ipcRenderer.invoke('get-spotify-credentials'),
  startSpotifyAuth: () => ipcRenderer.invoke('start-spotify-auth'),
  exchangeSpotifyCode: (data: { code: string }) => ipcRenderer.invoke('exchange-spotify-code', data),
  getSpotifyPlaylists: () => ipcRenderer.invoke('get-spotify-playlists'),
  getSpotifyPlaylistTracks: (data: { playlistId: string }) => ipcRenderer.invoke('get-spotify-playlist-tracks', data),
  logoutSpotify: () => ipcRenderer.invoke('logout-spotify'),
  
  // Deezer integration
  searchDeezerPlaylists: (data: { query: string }) => ipcRenderer.invoke('search-deezer-playlists', data),
  getDeezerPlaylistTracks: (data: { playlistId: string }) => ipcRenderer.invoke('get-deezer-playlist-tracks', data),
  getDeezerTopPlaylists: () => ipcRenderer.invoke('get-deezer-top-playlists'),
  
  // Apple Music integration
  scrapeAppleMusicPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-apple-music-playlist', data),
  getAppleMusicTopPlaylists: () => ipcRenderer.invoke('get-apple-music-top-playlists'),
  
  // Tidal integration
  scrapeTidalPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-tidal-playlist', data),
  getTidalTopPlaylists: () => ipcRenderer.invoke('get-tidal-top-playlists'),
  
  // Playlist sharing
  getHomeUsers: () => ipcRenderer.invoke('get-home-users'),
  getSharedServers: () => ipcRenderer.invoke('get-shared-servers'),
  getUserPlaylists: (data: { serverUrl: string; userToken: string }) => ipcRenderer.invoke('get-user-playlists', data),
  copyPlaylistToUser: (data: { serverUrl: string; sourcePlaylistId: string; targetUserToken: string; newTitle: string }) => ipcRenderer.invoke('copy-playlist-to-user', data),
  deleteUserPlaylist: (data: { serverUrl: string; playlistId: string; userToken: string }) => ipcRenderer.invoke('delete-user-playlist', data),
});
