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
  getPlaylists: (data: { serverUrl: string; includeSmart?: boolean }) => ipcRenderer.invoke('get-playlists', data),
  getPlaylistTracks: (data: { serverUrl: string; playlistId: string }) => ipcRenderer.invoke('get-playlist-tracks', data),
  addToPlaylist: (data: { serverUrl: string; playlistId: string; trackKey: string }) => ipcRenderer.invoke('add-to-playlist', data),
  removeFromPlaylist: (data: { serverUrl: string; playlistId: string; playlistItemId: string }) => ipcRenderer.invoke('remove-from-playlist', data),
  movePlaylistItem: (data: { serverUrl: string; playlistId: string; itemId: string; afterId: string | null }) => ipcRenderer.invoke('move-playlist-item', data),
  
  // Weekly mix operations
  getPlayHistory: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-play-history', data),
  findArtist: (data: { serverUrl: string; libraryId: string; name: string }) => ipcRenderer.invoke('find-artist', data),
  getArtistPopularTracks: (data: { serverUrl: string; libraryId: string; artistKey: string; limit: number }) => ipcRenderer.invoke('get-artist-popular-tracks', data),
  getRandomArtists: (data: { serverUrl: string; libraryId: string; limit: number }) => ipcRenderer.invoke('get-random-artists', data),
  
  // Mixes operations
  getRecentTracks: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-recent-tracks', data),
  getMonthlyTracks: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-monthly-tracks', data),
  getStalePlayedTracks: (data: { serverUrl: string; libraryId: string; daysAgo: number; limit: number }) => ipcRenderer.invoke('get-stale-played-tracks', data),
  getTimeCapsuleTracks: (data: { serverUrl: string; libraryId: string; daysAgo: number; targetCount: number; maxPerArtist: number }) => ipcRenderer.invoke('get-time-capsule-tracks', data),
  getCustomMixTracks: (data: { serverUrl: string; libraryId: string; options: any }) => ipcRenderer.invoke('get-custom-mix-tracks', data),
  getLibraryGenres: (data: { serverUrl: string; libraryId: string }) => ipcRenderer.invoke('get-library-genres', data),
  buildCustomMix: (data: { serverUrl: string; libraryId: string; options: any }) => ipcRenderer.invoke('build-custom-mix', data),
  getRelatedTracks: (data: { serverUrl: string; trackKey: string; limit: number }) => ipcRenderer.invoke('get-related-tracks', data),
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
  getDeezerAuth: () => ipcRenderer.invoke('get-deezer-auth'),
  saveDeezerCredentials: (data: { appId: string; appSecret: string }) => ipcRenderer.invoke('save-deezer-credentials', data),
  getDeezerCredentials: () => ipcRenderer.invoke('get-deezer-credentials'),
  startDeezerAuth: () => ipcRenderer.invoke('start-deezer-auth'),
  exchangeDeezerCode: (data: { code: string }) => ipcRenderer.invoke('exchange-deezer-code', data),
  logoutDeezer: () => ipcRenderer.invoke('logout-deezer'),
  getDeezerUserPlaylists: () => ipcRenderer.invoke('get-deezer-user-playlists'),
  
  // Apple Music integration
  scrapeAppleMusicPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-apple-music-playlist', data),
  getAppleMusicTopPlaylists: () => ipcRenderer.invoke('get-apple-music-top-playlists'),
  
  // Tidal integration
  scrapeTidalPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-tidal-playlist', data),
  getTidalTopPlaylists: () => ipcRenderer.invoke('get-tidal-top-playlists'),
  getTidalAuth: () => ipcRenderer.invoke('get-tidal-auth'),
  saveTidalCredentials: (data: { clientId: string; clientSecret: string }) => ipcRenderer.invoke('save-tidal-credentials', data),
  getTidalCredentials: () => ipcRenderer.invoke('get-tidal-credentials'),
  startTidalAuth: () => ipcRenderer.invoke('start-tidal-auth'),
  exchangeTidalCode: (data: { code: string }) => ipcRenderer.invoke('exchange-tidal-code', data),
  logoutTidal: () => ipcRenderer.invoke('logout-tidal'),
  getTidalUserPlaylists: () => ipcRenderer.invoke('get-tidal-user-playlists'),
  searchTidalPlaylists: (data: { query: string }) => ipcRenderer.invoke('search-tidal-playlists', data),
  
  // YouTube Music integration
  getYouTubeMusicAuth: () => ipcRenderer.invoke('get-youtube-music-auth'),
  saveYouTubeMusicCredentials: (data: { clientId: string; clientSecret: string }) => ipcRenderer.invoke('save-youtube-music-credentials', data),
  getYouTubeMusicCredentials: () => ipcRenderer.invoke('get-youtube-music-credentials'),
  startYouTubeMusicAuth: () => ipcRenderer.invoke('start-youtube-music-auth'),
  exchangeYouTubeMusicCode: (data: { code: string }) => ipcRenderer.invoke('exchange-youtube-music-code', data),
  logoutYouTubeMusic: () => ipcRenderer.invoke('logout-youtube-music'),
  getYouTubeMusicPlaylists: () => ipcRenderer.invoke('get-youtube-music-playlists'),
  getYouTubeMusicPlaylistTracks: (data: { playlistId: string }) => ipcRenderer.invoke('get-youtube-music-playlist-tracks', data),
  scrapeYouTubeMusicPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-youtube-music-playlist', data),
  
  // Amazon Music integration (scraping only - no API)
  scrapeAmazonMusicPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-amazon-music-playlist', data),
  
  // Qobuz integration (scraping only - limited API)
  scrapeQobuzPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-qobuz-playlist', data),
  
  // Spotify URL scraping (for public playlists without login)
  scrapeSpotifyPlaylist: (data: { url: string }) => ipcRenderer.invoke('scrape-spotify-playlist', data),
  
  // File import (M3U/M3U8)
  importM3UFile: () => ipcRenderer.invoke('import-m3u-file'),
  importiTunesXML: () => ipcRenderer.invoke('import-itunes-xml'),
  
  // ListenBrainz
  getListenBrainzPlaylists: (data: { username: string }) => ipcRenderer.invoke('get-listenbrainz-playlists', data),
  getListenBrainzPlaylistTracks: (data: { playlistId: string }) => ipcRenderer.invoke('get-listenbrainz-playlist-tracks', data),
  
  // OpenAI AI Playlist Generation
  getAiConfig: () => ipcRenderer.invoke('get-ai-config'),
  saveAiConfig: (data: { provider: string; apiKey: string }) => ipcRenderer.invoke('save-ai-config', data),
  getOpenAiApiKey: () => ipcRenderer.invoke('get-openai-api-key'),
  saveOpenAiApiKey: (apiKey: string) => ipcRenderer.invoke('save-openai-api-key', apiKey),
  generateAiPlaylist: (data: { prompt: string; trackCount: number; apiKey: string; provider?: string }) => ipcRenderer.invoke('generate-ai-playlist', data),
  
  // Playlist sharing
  getHomeUsers: () => ipcRenderer.invoke('get-home-users'),
  getSharedServers: () => ipcRenderer.invoke('get-shared-servers'),
  getUserPlaylists: (data: { serverUrl: string; userToken: string }) => ipcRenderer.invoke('get-user-playlists', data),
  copyPlaylistToUser: (data: { serverUrl: string; sourcePlaylistId: string; targetUserToken: string; newTitle: string }) => ipcRenderer.invoke('copy-playlist-to-user', data),
  deleteUserPlaylist: (data: { serverUrl: string; playlistId: string; userToken: string }) => ipcRenderer.invoke('delete-user-playlist', data),
  
  // Missing tracks
  getMissingTracks: () => ipcRenderer.invoke('get-missing-tracks'),
  addMissingTracks: (data: { playlistId: string; playlistName: string; tracks: any[] }) => ipcRenderer.invoke('add-missing-tracks', data),
  removeMissingTrack: (data: { playlistId: string; title: string; artist: string }) => ipcRenderer.invoke('remove-missing-track', data),
  clearMissingTracks: (data: { playlistId: string }) => ipcRenderer.invoke('clear-missing-tracks', data),
  clearAllMissingTracks: () => ipcRenderer.invoke('clear-all-missing-tracks'),
  getMissingTracksCount: () => ipcRenderer.invoke('get-missing-tracks-count'),
  insertTrackAtPosition: (data: { serverUrl: string; playlistId: string; trackKey: string; afterTrackKey?: string }) => ipcRenderer.invoke('insert-track-at-position', data),
  
  // Update checker
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openReleasePage: (url: string) => ipcRenderer.invoke('open-release-page', url),
  downloadUpdate: (data: { downloadUrl: string; version: string }) => ipcRenderer.invoke('download-update', data),
  installUpdate: (data: { installerPath: string }) => ipcRenderer.invoke('install-update', data),
});
