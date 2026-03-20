import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './CustomMixModal.css';

interface CustomMixModalProps {
  onClose: () => void;
  onGenerate: (settings: CustomMixSettings) => void;
  onSaveAsTemplate?: (settings: CustomMixSettings) => void;
  isGenerating: boolean;
  initialSettings?: Partial<CustomMixSettings>;
}

export interface CustomMixSettings {
  name: string;
  trackCount: number;
  
  // Time filters
  playedInLastDays?: number;
  notPlayedInLastDays?: number;
  addedInLastDays?: number;
  
  // Release date filters
  releasedAfterYear?: number;
  releasedBeforeYear?: number;
  
  // Rating & popularity
  minRating?: number;
  maxRating?: number;
  minPlayCount?: number;
  maxPlayCount?: number;
  popularTracksOnly?: boolean; // Only include tracks from Plex's "Popular Tracks" section
  
  // Track characteristics
  minDuration?: number; // in seconds
  maxDuration?: number; // in seconds
  minTrackNumber?: number;
  maxTrackNumber?: number;
  discNumber?: number;
  
  // Quality filters
  minBitrate?: number; // in kbps
  audioCodec?: string[];
  minSampleRate?: number; // in Hz
  losslessOnly?: boolean;
  
  // Metadata filters
  genres?: string[];
  excludeGenres?: string[];
  moods?: string[];
  excludeMoods?: string[];
  styles?: string[];
  excludeStyles?: string[];
  collections?: string[];
  labels?: string[];
  
  // Artist/Album filters
  artistNames?: string[];
  albumTitles?: string[];
  
  // Sonic Analysis filters
  sonicSeedTrackKey?: string; // Rating key of seed track for sonic similarity
  sonicSeedArtistKey?: string; // Rating key of seed artist for sonic similarity
  sonicMaxDistance?: number; // 0-1, lower = more similar (default 0.25)
  sonicIncludeSameArtist?: boolean; // Include tracks from same artist
  sonicIncludeSimilarArtists?: boolean; // Include tracks from similar artists
  sonicUsePopularTracks?: boolean; // Use popular tracks from the selected artist
  
  // Sorting
  sortBy: 'random' | 'playCount' | 'lastPlayed' | 'dateAdded' | 'releaseDate' | 'rating' | 'duration' | 'title';
  sortDirection: 'asc' | 'desc';
}

export const CustomMixModal: FC<CustomMixModalProps> = ({ onClose, onGenerate, onSaveAsTemplate, isGenerating, initialSettings }) => {
  const { apiClient } = useApp();
  const [settings, setSettings] = useState<CustomMixSettings>({
    name: 'My Custom Mix',
    trackCount: 50,
    sortBy: 'random',
    sortDirection: 'desc',
    ...initialSettings,
  });

  const [showQualityFilters, setShowQualityFilters] = useState(false);
  const [showMetadataFilters, setShowMetadataFilters] = useState(false);
  const [showSonicFilters, setShowSonicFilters] = useState(false);
  
  // Search state for sonic analysis
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const [trackSearchResults, setTrackSearchResults] = useState<any[]>([]);
  const [isSearchingTracks, setIsSearchingTracks] = useState(false);
  const [showTrackResults, setShowTrackResults] = useState(false);
  
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState<any[]>([]);
  const [isSearchingArtists, setIsSearchingArtists] = useState(false);
  const [showArtistResults, setShowArtistResults] = useState(false);
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  
  // Available options from library (loaded but not yet used in UI - will be used for dropdowns)
  const [_availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [_availableMoods, setAvailableMoods] = useState<string[]>([]);
  const [_availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [_availableCollections, setAvailableCollections] = useState<string[]>([]);
  
  // Load available metadata options
  useEffect(() => {
    const loadMetadata = async () => {
      if (!apiClient) return;
      
      try {
        const [genresRes, moodsRes, stylesRes, collectionsRes] = await Promise.all([
          apiClient.getLibraryGenres().catch(() => ({ genres: [] })),
          apiClient.getLibraryMoods().catch(() => ({ moods: [] })),
          apiClient.getLibraryStyles().catch(() => ({ styles: [] })),
          apiClient.getLibraryCollections().catch(() => ({ collections: [] })),
        ]);
        
        setAvailableGenres(genresRes.genres);
        setAvailableMoods(moodsRes.moods);
        setAvailableStyles(stylesRes.styles);
        setAvailableCollections(collectionsRes.collections);
      } catch (error) {
        console.error('Failed to load metadata options:', error);
      }
    };
    
    loadMetadata();
  }, [apiClient]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-results-dropdown') && !target.closest('.form-input')) {
        setShowTrackResults(false);
        setShowArtistResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = () => {
    onGenerate(settings);
  };

  const updateSetting = <K extends keyof CustomMixSettings>(key: K, value: CustomMixSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const parseCommaSeparated = (value: string): string[] | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  // Search for tracks
  const searchTracks = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setTrackSearchResults([]);
      return;
    }

    setIsSearchingTracks(true);
    try {
      const response = await fetch(`/api/search/tracks?query=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTrackSearchResults(data.tracks || []);
        setShowTrackResults(true);
      }
    } catch (error) {
      console.error('Failed to search tracks:', error);
    } finally {
      setIsSearchingTracks(false);
    }
  };

  // Search for artists
  const searchArtists = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setArtistSearchResults([]);
      return;
    }

    setIsSearchingArtists(true);
    try {
      const response = await fetch(`/api/search/artists?query=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setArtistSearchResults(data.artists || []);
        setShowArtistResults(true);
      }
    } catch (error) {
      console.error('Failed to search artists:', error);
    } finally {
      setIsSearchingArtists(false);
    }
  };

  // Handle track selection
  const handleSelectTrack = (track: any) => {
    setSelectedTrack(track);
    updateSetting('sonicSeedTrackKey', track.ratingKey);
    setTrackSearchQuery(`${track.title} - ${track.grandparentTitle}`);
    setShowTrackResults(false);
  };

  // Handle artist selection
  const handleSelectArtist = (artist: any) => {
    setSelectedArtist(artist);
    updateSetting('sonicSeedArtistKey', artist.ratingKey);
    setArtistSearchQuery(artist.title);
    setShowArtistResults(false);
  };

  return (
    <div className="custom-mix-overlay" onClick={onClose}>
      <div className="custom-mix-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-mix-header">
          <h2 className="custom-mix-title">Create Custom Mix</h2>
          <button className="custom-mix-close" onClick={onClose} disabled={isGenerating}>×</button>
        </div>

        <div className="custom-mix-content">
          {/* Playlist Name */}
          <div className="form-group">
            <label className="form-label">Playlist Name</label>
            <input
              type="text"
              className="form-input"
              value={settings.name}
              onChange={(e) => updateSetting('name', e.target.value)}
              disabled={isGenerating}
            />
          </div>

          {/* Number of Tracks */}
          <div className="form-group">
            <label className="form-label">Number of Tracks: {settings.trackCount}</label>
            <input
              type="range"
              className="track-slider"
              min="10"
              max="500"
              step="10"
              value={settings.trackCount}
              onChange={(e) => updateSetting('trackCount', parseInt(e.target.value))}
              disabled={isGenerating}
            />
          </div>

          {/* Sorting */}
          <div className="form-group">
            <label className="form-label">Sort By</label>
            <select
              className="form-select"
              value={settings.sortBy}
              onChange={(e) => updateSetting('sortBy', e.target.value as any)}
              disabled={isGenerating}
            >
              <option value="random">Random</option>
              <option value="playCount">Play Count</option>
              <option value="lastPlayed">Last Played</option>
              <option value="dateAdded">Date Added</option>
              <option value="releaseDate">Release Date</option>
              <option value="rating">Rating</option>
              <option value="duration">Duration</option>
              <option value="title">Title</option>
            </select>
            {settings.sortBy !== 'random' && (
              <select
                className="form-select"
                value={settings.sortDirection}
                onChange={(e) => updateSetting('sortDirection', e.target.value as any)}
                disabled={isGenerating}
                style={{ marginTop: '0.5rem' }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            )}
          </div>

          {/* Time Filters Section */}
          <div className="filter-section">
            <h3 className="section-title">Time Filters</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.playedInLastDays !== undefined}
                  onChange={(e) => updateSetting('playedInLastDays', e.target.checked ? 30 : undefined)}
                  disabled={isGenerating}
                />
                <span>Played in last</span>
              </label>
              {settings.playedInLastDays !== undefined && (
                <input
                  type="number"
                  className="form-input-small"
                  value={settings.playedInLastDays}
                  onChange={(e) => updateSetting('playedInLastDays', parseInt(e.target.value) || undefined)}
                  min="1"
                  disabled={isGenerating}
                  placeholder="days"
                />
              )}
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notPlayedInLastDays !== undefined}
                  onChange={(e) => updateSetting('notPlayedInLastDays', e.target.checked ? 90 : undefined)}
                  disabled={isGenerating}
                />
                <span>NOT played in last</span>
              </label>
              {settings.notPlayedInLastDays !== undefined && (
                <input
                  type="number"
                  className="form-input-small"
                  value={settings.notPlayedInLastDays}
                  onChange={(e) => updateSetting('notPlayedInLastDays', parseInt(e.target.value) || undefined)}
                  min="1"
                  disabled={isGenerating}
                  placeholder="days"
                />
              )}
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.addedInLastDays !== undefined}
                  onChange={(e) => updateSetting('addedInLastDays', e.target.checked ? 30 : undefined)}
                  disabled={isGenerating}
                />
                <span>Added in last</span>
              </label>
              {settings.addedInLastDays !== undefined && (
                <input
                  type="number"
                  className="form-input-small"
                  value={settings.addedInLastDays}
                  onChange={(e) => updateSetting('addedInLastDays', parseInt(e.target.value) || undefined)}
                  min="1"
                  disabled={isGenerating}
                  placeholder="days"
                />
              )}
            </div>
          </div>

          {/* Release Date Filters */}
          <div className="filter-section">
            <h3 className="section-title">Release Date</h3>
            
            <div className="form-group">
              <label className="form-label">Released After Year</label>
              <input
                type="number"
                className="form-input"
                value={settings.releasedAfterYear || ''}
                onChange={(e) => updateSetting('releasedAfterYear', e.target.value ? parseInt(e.target.value) : undefined)}
                min="1900"
                max={new Date().getFullYear()}
                disabled={isGenerating}
                placeholder="e.g., 2010"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Released Before Year</label>
              <input
                type="number"
                className="form-input"
                value={settings.releasedBeforeYear || ''}
                onChange={(e) => updateSetting('releasedBeforeYear', e.target.value ? parseInt(e.target.value) : undefined)}
                min="1900"
                max={new Date().getFullYear()}
                disabled={isGenerating}
                placeholder="e.g., 2020"
              />
            </div>
          </div>

          {/* Rating & Popularity Filters */}
          <div className="filter-section">
            <h3 className="section-title">Rating & Popularity</h3>
            
            <div className="form-group">
              <label className="form-label">Minimum Rating (0-10)</label>
              <input
                type="number"
                className="form-input"
                value={settings.minRating || ''}
                onChange={(e) => updateSetting('minRating', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                max="10"
                step="0.5"
                disabled={isGenerating}
                placeholder="e.g., 7.5"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maximum Rating (0-10)</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxRating || ''}
                onChange={(e) => updateSetting('maxRating', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                max="10"
                step="0.5"
                disabled={isGenerating}
                placeholder="e.g., 9.5"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Minimum Play Count</label>
              <input
                type="number"
                className="form-input"
                value={settings.minPlayCount || ''}
                onChange={(e) => updateSetting('minPlayCount', e.target.value ? parseInt(e.target.value) : undefined)}
                min="0"
                disabled={isGenerating}
                placeholder="e.g., 5"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maximum Play Count</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxPlayCount || ''}
                onChange={(e) => updateSetting('maxPlayCount', e.target.value ? parseInt(e.target.value) : undefined)}
                min="0"
                disabled={isGenerating}
                placeholder="e.g., 100"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.popularTracksOnly || false}
                  onChange={(e) => updateSetting('popularTracksOnly', e.target.checked || undefined)}
                  disabled={isGenerating}
                />
                <span>Only include popular tracks</span>
              </label>
              <p className="form-hint">
                Uses external popularity data (Last.fm, MusicBrainz) to select only the most popular tracks from each artist.
              </p>
            </div>
          </div>

          {/* Track Characteristics */}
          <div className="filter-section">
            <h3 className="section-title">Track Characteristics</h3>
            
            <div className="form-group">
              <label className="form-label">Minimum Duration (seconds)</label>
              <input
                type="number"
                className="form-input"
                value={settings.minDuration || ''}
                onChange={(e) => updateSetting('minDuration', e.target.value ? parseInt(e.target.value) : undefined)}
                min="0"
                disabled={isGenerating}
                placeholder="e.g., 180 (3 minutes)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maximum Duration (seconds)</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxDuration || ''}
                onChange={(e) => updateSetting('maxDuration', e.target.value ? parseInt(e.target.value) : undefined)}
                min="0"
                disabled={isGenerating}
                placeholder="e.g., 300 (5 minutes)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Track Number Range</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  className="form-input"
                  value={settings.minTrackNumber || ''}
                  onChange={(e) => updateSetting('minTrackNumber', e.target.value ? parseInt(e.target.value) : undefined)}
                  min="1"
                  disabled={isGenerating}
                  placeholder="Min"
                />
                <input
                  type="number"
                  className="form-input"
                  value={settings.maxTrackNumber || ''}
                  onChange={(e) => updateSetting('maxTrackNumber', e.target.value ? parseInt(e.target.value) : undefined)}
                  min="1"
                  disabled={isGenerating}
                  placeholder="Max"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Disc Number</label>
              <input
                type="number"
                className="form-input"
                value={settings.discNumber || ''}
                onChange={(e) => updateSetting('discNumber', e.target.value ? parseInt(e.target.value) : undefined)}
                min="1"
                disabled={isGenerating}
                placeholder="e.g., 1"
              />
            </div>
          </div>

          {/* Sonic Analysis Filters (Collapsible) */}
          <div className="filter-section-collapsible">
            <button
              className="section-toggle"
              onClick={() => setShowSonicFilters(!showSonicFilters)}
              type="button"
            >
              <span className="toggle-icon">{showSonicFilters ? '▼' : '▶'}</span>
              Sonic Analysis (Similar Tracks)
            </button>
            
            {showSonicFilters && (
              <div className="filter-section-content">
                <div className="form-group">
                  <label className="form-label">Search for Track</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={trackSearchQuery}
                      onChange={(e) => {
                        setTrackSearchQuery(e.target.value);
                        searchTracks(e.target.value);
                      }}
                      onFocus={() => trackSearchResults.length > 0 && setShowTrackResults(true)}
                      disabled={isGenerating}
                      placeholder="Search for a track..."
                    />
                    {isSearchingTracks && (
                      <div style={{ 
                        position: 'absolute', 
                        right: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Searching...
                      </div>
                    )}
                    {showTrackResults && trackSearchResults.length > 0 && (
                      <div className="search-results-dropdown">
                        {trackSearchResults.slice(0, 10).map((track) => (
                          <div
                            key={track.ratingKey}
                            className="search-result-item"
                            onClick={() => handleSelectTrack(track)}
                          >
                            <div className="search-result-title">{track.title}</div>
                            <div className="search-result-subtitle">
                              {track.grandparentTitle} • {track.parentTitle}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="form-hint">
                    Search and select a track to find sonically similar tracks.
                  </p>
                  {selectedTrack && (
                    <div className="selected-item-badge">
                      <span>✓ {selectedTrack.title} - {selectedTrack.grandparentTitle}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrack(null);
                          setTrackSearchQuery('');
                          updateSetting('sonicSeedTrackKey', undefined);
                        }}
                        className="remove-badge-btn"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Search for Artist</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={artistSearchQuery}
                      onChange={(e) => {
                        setArtistSearchQuery(e.target.value);
                        searchArtists(e.target.value);
                      }}
                      onFocus={() => artistSearchResults.length > 0 && setShowArtistResults(true)}
                      disabled={isGenerating}
                      placeholder="Search for an artist..."
                    />
                    {isSearchingArtists && (
                      <div style={{ 
                        position: 'absolute', 
                        right: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Searching...
                      </div>
                    )}
                    {showArtistResults && artistSearchResults.length > 0 && (
                      <div className="search-results-dropdown">
                        {artistSearchResults.slice(0, 10).map((artist) => (
                          <div
                            key={artist.ratingKey}
                            className="search-result-item"
                            onClick={() => handleSelectArtist(artist)}
                          >
                            <div className="search-result-title">{artist.title}</div>
                            {artist.summary && (
                              <div className="search-result-subtitle">{artist.summary.substring(0, 100)}...</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="form-hint">
                    Search and select an artist to find tracks from sonically similar artists.
                  </p>
                  {selectedArtist && (
                    <div className="selected-item-badge">
                      <span>✓ {selectedArtist.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedArtist(null);
                          setArtistSearchQuery('');
                          updateSetting('sonicSeedArtistKey', undefined);
                        }}
                        className="remove-badge-btn"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {(settings.sonicSeedTrackKey || settings.sonicSeedArtistKey) && (
                  <>
                    <div className="form-group">
                      <label className="form-label">
                        Similarity Threshold: {settings.sonicMaxDistance !== undefined ? settings.sonicMaxDistance.toFixed(2) : '0.25'}
                      </label>
                      <input
                        type="range"
                        className="track-slider"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.sonicMaxDistance !== undefined ? settings.sonicMaxDistance : 0.25}
                        onChange={(e) => updateSetting('sonicMaxDistance', parseFloat(e.target.value))}
                        disabled={isGenerating}
                      />
                      <p className="form-hint">
                        Lower values = more similar tracks. 0.25 is recommended for good variety.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.sonicIncludeSameArtist || false}
                          onChange={(e) => updateSetting('sonicIncludeSameArtist', e.target.checked || undefined)}
                          disabled={isGenerating}
                        />
                        <span>Include tracks from the same artist</span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.sonicIncludeSimilarArtists || false}
                          onChange={(e) => updateSetting('sonicIncludeSimilarArtists', e.target.checked || undefined)}
                          disabled={isGenerating}
                        />
                        <span>Include tracks from similar artists</span>
                      </label>
                    </div>

                    {settings.sonicSeedArtistKey && (
                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={settings.sonicUsePopularTracks || false}
                            onChange={(e) => updateSetting('sonicUsePopularTracks', e.target.checked || undefined)}
                            disabled={isGenerating}
                          />
                          <span>Use popular tracks from selected artist</span>
                        </label>
                        <p className="form-hint">
                          Uses external popularity data (Last.fm, MusicBrainz) to select the artist's most popular tracks.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quality Filters (Collapsible) */}
          <div className="filter-section-collapsible">
            <button
              className="section-toggle"
              onClick={() => setShowQualityFilters(!showQualityFilters)}
              type="button"
            >
              <span className="toggle-icon">{showQualityFilters ? '▼' : '▶'}</span>
              Quality Filters
            </button>
            
            {showQualityFilters && (
              <div className="filter-section-content">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.losslessOnly || false}
                      onChange={(e) => updateSetting('losslessOnly', e.target.checked || undefined)}
                      disabled={isGenerating}
                    />
                    <span>Lossless Only (FLAC, ALAC, APE, WAV)</span>
                  </label>
                </div>

                {!settings.losslessOnly && (
                  <div className="form-group">
                    <label className="form-label">Audio Codecs (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.audioCodec?.join(', ') || ''}
                      onChange={(e) => updateSetting('audioCodec', parseCommaSeparated(e.target.value))}
                      disabled={isGenerating}
                      placeholder="e.g., flac, mp3, aac"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Minimum Bitrate (kbps)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.minBitrate || ''}
                    onChange={(e) => updateSetting('minBitrate', e.target.value ? parseInt(e.target.value) : undefined)}
                    min="0"
                    disabled={isGenerating}
                    placeholder="e.g., 320"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Sample Rate (Hz)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.minSampleRate || ''}
                    onChange={(e) => updateSetting('minSampleRate', e.target.value ? parseInt(e.target.value) : undefined)}
                    min="0"
                    disabled={isGenerating}
                    placeholder="e.g., 44100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Metadata Filters (Collapsible) */}
          <div className="filter-section-collapsible">
            <button
              className="section-toggle"
              onClick={() => setShowMetadataFilters(!showMetadataFilters)}
              type="button"
            >
              <span className="toggle-icon">{showMetadataFilters ? '▼' : '▶'}</span>
              Metadata Filters
            </button>
            
            {showMetadataFilters && (
              <div className="filter-section-content">
                <div className="form-group">
                  <label className="form-label">Include Genres (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.genres?.join(', ') || ''}
                    onChange={(e) => updateSetting('genres', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Rock, Pop, Jazz"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Exclude Genres (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.excludeGenres?.join(', ') || ''}
                    onChange={(e) => updateSetting('excludeGenres', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Country, Classical"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Include Moods (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.moods?.join(', ') || ''}
                    onChange={(e) => updateSetting('moods', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Energetic, Chill, Upbeat"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Exclude Moods (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.excludeMoods?.join(', ') || ''}
                    onChange={(e) => updateSetting('excludeMoods', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Sad, Melancholy"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Include Styles (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.styles?.join(', ') || ''}
                    onChange={(e) => updateSetting('styles', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Indie Rock, Synthpop"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Exclude Styles (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.excludeStyles?.join(', ') || ''}
                    onChange={(e) => updateSetting('excludeStyles', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Heavy Metal"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Collections (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.collections?.join(', ') || ''}
                    onChange={(e) => updateSetting('collections', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Favorites, Workout"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Record Labels (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.labels?.join(', ') || ''}
                    onChange={(e) => updateSetting('labels', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Columbia, Atlantic"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Artist Names (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.artistNames?.join(', ') || ''}
                    onChange={(e) => updateSetting('artistNames', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Beatles, Pink Floyd"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Album Titles (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.albumTitles?.join(', ') || ''}
                    onChange={(e) => updateSetting('albumTitles', parseCommaSeparated(e.target.value))}
                    disabled={isGenerating}
                    placeholder="e.g., Abbey Road, Dark Side"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="custom-mix-actions">
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating || !settings.name.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Mix'}
          </button>
          {onSaveAsTemplate && (
            <button
              className="btn-secondary-action"
              onClick={() => onSaveAsTemplate(settings)}
              disabled={isGenerating || !settings.name.trim()}
              title="Save these settings as a reusable mix template"
            >
              Save Mix
            </button>
          )}
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
