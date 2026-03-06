import type { FC } from 'react';
import { useState } from 'react';
import './CustomMixModal.css';

interface CustomMixModalProps {
  onClose: () => void;
  onGenerate: (settings: CustomMixSettings) => void;
  isGenerating: boolean;
}

export interface CustomMixSettings {
  name: string;
  trackCount: number;
  // Time filters
  playedInLastDays?: number;
  notPlayedInLastDays?: number;
  addedInLastDays?: number;
  releasedAfterYear?: number;
  releasedBeforeYear?: number;
  // Content filters
  genres?: string[];
  excludeGenres?: string[];
  minRating?: number;
  // Sorting
  sortBy: 'random' | 'playCount' | 'lastPlayed' | 'dateAdded' | 'releaseDate' | 'rating';
  sortDirection: 'asc' | 'desc';
}

export const CustomMixModal: FC<CustomMixModalProps> = ({ onClose, onGenerate, isGenerating }) => {
  const [settings, setSettings] = useState<CustomMixSettings>({
    name: 'My Custom Mix',
    trackCount: 50,
    sortBy: 'random',
    sortDirection: 'desc',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGenerate = () => {
    onGenerate(settings);
  };

  return (
    <div className="custom-mix-overlay" onClick={onClose}>
      <div className="custom-mix-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-mix-header">
          <h2 className="custom-mix-title">Create Custom Mix</h2>
          <button className="custom-mix-close" onClick={onClose}>×</button>
        </div>

        <div className="custom-mix-content">
          {/* Playlist Name */}
          <div className="form-group">
            <label className="form-label">Playlist Name</label>
            <input
              type="text"
              className="form-input"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            />
          </div>

          {/* Number of Tracks */}
          <div className="form-group">
            <label className="form-label">Number of Tracks: {settings.trackCount}</label>
            <input
              type="range"
              className="track-slider"
              min="10"
              max="200"
              step="10"
              value={settings.trackCount}
              onChange={(e) => setSettings({ ...settings, trackCount: parseInt(e.target.value) })}
            />
          </div>

          {/* Time Filters */}
          <div className="filter-section">
            <h3 className="section-title">Time Filters</h3>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={settings.playedInLastDays !== undefined}
                onChange={(e) => setSettings({
                  ...settings,
                  playedInLastDays: e.target.checked ? 30 : undefined
                })}
              />
              <span>Played in last days</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={settings.notPlayedInLastDays !== undefined}
                onChange={(e) => setSettings({
                  ...settings,
                  notPlayedInLastDays: e.target.checked ? 90 : undefined
                })}
              />
              <span>Not played in last days</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={settings.addedInLastDays !== undefined}
                onChange={(e) => setSettings({
                  ...settings,
                  addedInLastDays: e.target.checked ? 30 : undefined
                })}
              />
              <span>Added to library in last days</span>
            </label>
          </div>

          {/* Release Date */}
          <div className="filter-section">
            <h3 className="section-title">Release Date</h3>
            
            <div className="year-inputs">
              <div className="year-input-group">
                <label className="form-label">From Year</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Any"
                  value={settings.releasedAfterYear || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    releasedAfterYear: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                />
              </div>

              <div className="year-input-group">
                <label className="form-label">To Year</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Any"
                  value={settings.releasedBeforeYear || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    releasedBeforeYear: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                />
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="filter-section">
            <button
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className="advanced-icon">{showAdvanced ? '▼' : '▶'}</span>
              Advanced Filters
            </button>

            {showAdvanced && (
              <div className="advanced-content">
                <div className="form-group">
                  <label className="form-label">Genres (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Rock, Pop, Jazz"
                    value={settings.genres?.join(', ') || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      genres: e.target.value ? e.target.value.split(',').map(g => g.trim()) : undefined
                    })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Exclude Genres (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Country, Classical"
                    value={settings.excludeGenres?.join(', ') || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      excludeGenres: e.target.value ? e.target.value.split(',').map(g => g.trim()) : undefined
                    })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Rating (0-10)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Any"
                    value={settings.minRating || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      minRating: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sorting */}
          <div className="filter-section">
            <h3 className="section-title">Sorting</h3>
            
            <div className="sorting-inputs">
              <div className="sorting-input-group">
                <label className="form-label">Sort By</label>
                <select
                  className="form-select"
                  value={settings.sortBy}
                  onChange={(e) => setSettings({ ...settings, sortBy: e.target.value as any })}
                >
                  <option value="random">Random</option>
                  <option value="playCount">Play Count</option>
                  <option value="lastPlayed">Last Played</option>
                  <option value="dateAdded">Date Added</option>
                  <option value="releaseDate">Release Date</option>
                  <option value="rating">Rating</option>
                </select>
              </div>

              <div className="sorting-input-group">
                <label className="form-label">Direction</label>
                <select
                  className="form-select"
                  value={settings.sortDirection}
                  onChange={(e) => setSettings({ ...settings, sortDirection: e.target.value as any })}
                  disabled={settings.sortBy === 'random'}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="custom-mix-actions">
          <button
            onClick={handleGenerate}
            className="btn-generate"
            disabled={isGenerating || !settings.name.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Mix'}
          </button>
          <button
            onClick={onClose}
            className="btn-cancel"
            disabled={isGenerating}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
