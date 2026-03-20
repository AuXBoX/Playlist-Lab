import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './AdvancedMixModal.css';

interface AdvancedMixModalProps {
  mixType: 'artistdiscovery' | 'mood' | 'era' | 'genreevolution' | 'artistjourney' | 'genreblend';
  onClose: () => void;
  onGenerate: (settings: any) => void;
  onAddToSchedule?: (settings: any) => void;
  isGenerating: boolean;
}

export const AdvancedMixModal: FC<AdvancedMixModalProps> = ({ mixType, onClose, onGenerate, onAddToSchedule, isGenerating }) => {
  const { apiClient } = useApp();
  
  // Common settings
  const [playlistName, setPlaylistName] = useState('');
  const [trackCount, setTrackCount] = useState(50);
  
  // Artist Discovery settings
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [tracksPerArtist, setTracksPerArtist] = useState(3);
  
  // Mood Mix settings
  const [availableMoods, setAvailableMoods] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [useSonicAnalysis, setUseSonicAnalysis] = useState(false);
  
  // Era Mix settings
  const [startYear, setStartYear] = useState(1970);
  const [endYear, setEndYear] = useState(1979);
  
  // Genre Evolution settings
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [tracksPerDecade, setTracksPerDecade] = useState(5);
  
  // Artist Journey settings (uses same artist search as Artist Discovery)
  const [tracksPerAlbum, setTracksPerAlbum] = useState(3);
  
  // Genre Blend settings
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minGenres, setMinGenres] = useState(2);

  // Load metadata on mount
  useEffect(() => {
    const loadMetadata = async () => {
      if (mixType === 'mood' || mixType === 'genreblend' || mixType === 'genreevolution') {
        try {
          if (mixType === 'mood') {
            const { moods } = await apiClient.getLibraryMoods();
            setAvailableMoods(moods);
          }
          if (mixType === 'genreblend' || mixType === 'genreevolution') {
            const { genres } = await apiClient.getLibraryGenres();
            setAvailableGenres(genres);
          }
        } catch (error) {
          console.error('Failed to load metadata:', error);
        }
      }
    };
    loadMetadata();
  }, [mixType, apiClient]);

  // Set default playlist name based on mix type
  useEffect(() => {
    switch (mixType) {
      case 'artistdiscovery':
        setPlaylistName('Artist Discovery');
        break;
      case 'mood':
        setPlaylistName('Mood Mix');
        break;
      case 'era':
        setPlaylistName(`${startYear}s Mix`);
        break;
      case 'genreevolution':
        setPlaylistName('Genre Evolution');
        break;
      case 'artistjourney':
        setPlaylistName('Artist Journey');
        break;
      case 'genreblend':
        setPlaylistName('Genre Blend');
        break;
    }
  }, [mixType, startYear]);

  const searchArtists = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setArtistSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/search/artists?query=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setArtistSearchResults(data.artists || []);
      }
    } catch (error) {
      console.error('Failed to search artists:', error);
    }
  };

  const handleSelectArtist = (artist: any) => {
    setSelectedArtist(artist);
    setArtistSearchQuery(artist.title);
    setArtistSearchResults([]);
  };

  const toggleMood = (mood: string) => {
    setSelectedMoods(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleGenerate = () => {
    let settings: any = { playlistName, trackCount };

    switch (mixType) {
      case 'artistdiscovery':
        if (!selectedArtist) return;
        settings.seedArtistKey = selectedArtist.ratingKey;
        settings.tracksPerArtist = tracksPerArtist;
        break;
      case 'mood':
        if (selectedMoods.length === 0) return;
        settings.moods = selectedMoods;
        settings.useSonicAnalysis = useSonicAnalysis;
        break;
      case 'era':
        settings.startYear = startYear;
        settings.endYear = endYear;
        break;
      case 'genreevolution':
        if (!selectedGenre) return;
        settings.genre = selectedGenre;
        settings.tracksPerDecade = tracksPerDecade;
        break;
      case 'artistjourney':
        if (!selectedArtist) return;
        settings.artistKey = selectedArtist.ratingKey;
        settings.tracksPerAlbum = tracksPerAlbum;
        break;
      case 'genreblend':
        if (selectedGenres.length < 2) return;
        settings.genres = selectedGenres;
        settings.minGenres = minGenres;
        break;
    }

    onGenerate(settings);
  };

  const getTitle = () => {
    switch (mixType) {
      case 'artistdiscovery': return 'Artist Discovery Mix';
      case 'mood': return 'Mood Mix';
      case 'era': return 'Era Mix';
      case 'genreevolution': return 'Genre Evolution Mix';
      case 'artistjourney': return 'Artist Journey Mix';
      case 'genreblend': return 'Genre Blend Mix';
    }
  };

  const handleAddToSchedule = () => {
    let settings: any = { playlistName, trackCount };

    switch (mixType) {
      case 'artistdiscovery':
        if (!selectedArtist) return;
        settings.seedArtistKey = selectedArtist.ratingKey;
        settings.tracksPerArtist = tracksPerArtist;
        break;
      case 'mood':
        if (selectedMoods.length === 0) return;
        settings.moods = selectedMoods;
        settings.useSonicAnalysis = useSonicAnalysis;
        break;
      case 'era':
        settings.startYear = startYear;
        settings.endYear = endYear;
        break;
      case 'genreevolution':
        if (!selectedGenre) return;
        settings.genre = selectedGenre;
        settings.tracksPerDecade = tracksPerDecade;
        break;
      case 'artistjourney':
        if (!selectedArtist) return;
        settings.artistKey = selectedArtist.ratingKey;
        settings.tracksPerAlbum = tracksPerAlbum;
        break;
      case 'genreblend':
        if (selectedGenres.length < 2) return;
        settings.genres = selectedGenres;
        settings.minGenres = minGenres;
        break;
    }

    if (onAddToSchedule) {
      onAddToSchedule(settings);
    }
  };

  const canGenerate = () => {
    switch (mixType) {
      case 'artistdiscovery':
      case 'artistjourney':
        return selectedArtist !== null;
      case 'mood':
        return selectedMoods.length > 0;
      case 'era':
        return startYear && endYear && startYear <= endYear;
      case 'genreevolution':
        return selectedGenre !== '';
      case 'genreblend':
        return selectedGenres.length >= 2;
      default:
        return false;
    }
  };

  return (
    <div className="advanced-mix-overlay" onClick={onClose}>
      <div className="advanced-mix-modal" onClick={(e) => e.stopPropagation()}>
        <div className="advanced-mix-header">
          <h2 className="advanced-mix-title">{getTitle()}</h2>
          <button className="advanced-mix-close" onClick={onClose} disabled={isGenerating}>×</button>
        </div>

        <div className="advanced-mix-content">
          {/* Playlist Name */}
          <div className="form-group">
            <label className="form-label">Playlist Name</label>
            <input
              type="text"
              className="form-input"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          {/* Track Count */}
          <div className="form-group">
            <label className="form-label">Number of Tracks: {trackCount}</label>
            <input
              type="range"
              className="track-slider"
              min="10"
              max="200"
              step="10"
              value={trackCount}
              onChange={(e) => setTrackCount(parseInt(e.target.value))}
              disabled={isGenerating}
            />
          </div>

          {/* Artist Discovery / Artist Journey - Artist Search */}
          {(mixType === 'artistdiscovery' || mixType === 'artistjourney') && (
            <>
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
                    disabled={isGenerating}
                    placeholder="Search for an artist..."
                  />
                  {artistSearchResults.length > 0 && (
                    <div className="search-results-dropdown">
                      {artistSearchResults.slice(0, 10).map((artist) => (
                        <div
                          key={artist.ratingKey}
                          className="search-result-item"
                          onClick={() => handleSelectArtist(artist)}
                        >
                          <div className="search-result-title">{artist.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedArtist && (
                  <div className="selected-item-badge">
                    <span>✓ {selectedArtist.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArtist(null);
                        setArtistSearchQuery('');
                      }}
                      className="remove-badge-btn"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {mixType === 'artistdiscovery' && (
                <div className="form-group">
                  <label className="form-label">Tracks Per Artist: {tracksPerArtist}</label>
                  <input
                    type="range"
                    className="track-slider"
                    min="1"
                    max="10"
                    value={tracksPerArtist}
                    onChange={(e) => setTracksPerArtist(parseInt(e.target.value))}
                    disabled={isGenerating}
                  />
                </div>
              )}

              {mixType === 'artistjourney' && (
                <div className="form-group">
                  <label className="form-label">Tracks Per Album: {tracksPerAlbum}</label>
                  <input
                    type="range"
                    className="track-slider"
                    min="1"
                    max="10"
                    value={tracksPerAlbum}
                    onChange={(e) => setTracksPerAlbum(parseInt(e.target.value))}
                    disabled={isGenerating}
                  />
                </div>
              )}
            </>
          )}

          {/* Mood Mix - Mood Selection */}
          {mixType === 'mood' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Moods</label>
                <div className="tag-grid">
                  {availableMoods.map((mood) => (
                    <button
                      key={mood}
                      className={`tag-button ${selectedMoods.includes(mood) ? 'selected' : ''}`}
                      onClick={() => toggleMood(mood)}
                      disabled={isGenerating}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={useSonicAnalysis}
                    onChange={(e) => setUseSonicAnalysis(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Use Sonic Analysis (more accurate mood matching)</span>
                </label>
              </div>
            </>
          )}

          {/* Era Mix - Year Range */}
          {mixType === 'era' && (
            <div className="form-group">
              <label className="form-label">Year Range</label>
              <div className="year-range-inputs">
                <div>
                  <label className="form-label-small">Start Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value))}
                    min="1900"
                    max={new Date().getFullYear()}
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label className="form-label-small">End Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={endYear}
                    onChange={(e) => setEndYear(parseInt(e.target.value))}
                    min="1900"
                    max={new Date().getFullYear()}
                    disabled={isGenerating}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Genre Evolution - Genre Selection */}
          {mixType === 'genreevolution' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Genre</label>
                <select
                  className="form-select"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  disabled={isGenerating}
                >
                  <option value="">Choose a genre...</option>
                  {availableGenres.map((genre) => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tracks Per Decade: {tracksPerDecade}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="1"
                  max="15"
                  value={tracksPerDecade}
                  onChange={(e) => setTracksPerDecade(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
              </div>
            </>
          )}

          {/* Genre Blend - Multiple Genre Selection */}
          {mixType === 'genreblend' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Genres (minimum 2)</label>
                <div className="tag-grid">
                  {availableGenres.map((genre) => (
                    <button
                      key={genre}
                      className={`tag-button ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                      onClick={() => toggleGenre(genre)}
                      disabled={isGenerating}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Genres Per Track: {minGenres}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="2"
                  max={Math.min(selectedGenres.length, 5)}
                  value={minGenres}
                  onChange={(e) => setMinGenres(parseInt(e.target.value))}
                  disabled={isGenerating || selectedGenres.length < 2}
                />
                <p className="form-hint">
                  Tracks must have at least this many of the selected genres
                </p>
              </div>
            </>
          )}
        </div>

        <div className="advanced-mix-actions">
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate()}
          >
            {isGenerating ? 'Generating...' : 'Generate Mix'}
          </button>
          {onAddToSchedule && (
            <button
              className="btn-schedule"
              onClick={handleAddToSchedule}
              disabled={isGenerating || !canGenerate()}
            >
              Schedule
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
