import { type FC, useState, useEffect } from 'react';
import './EditTemplateModal.css';

interface MixTemplateConfiguration {
  mixType: 'artist' | 'album' | 'genre' | 'mood' | 'decade' | 'custom';
  trackCount: number;
  sortBy?: 'random' | 'rating' | 'playCount' | 'dateAdded';
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  moods?: string[];
  decades?: number[];
  customRules?: {
    includeGenres?: string[];
    excludeGenres?: string[];
    minRating?: number;
    maxRating?: number;
    yearRange?: { min: number; max: number };
    includeUnplayed?: boolean;
  };
  allowDuplicateArtists?: boolean;
  allowDuplicateAlbums?: boolean;
  maxTracksPerArtist?: number;
  maxTracksPerAlbum?: number;
}

interface Template {
  id: number;
  name: string;
  description?: string;
  mix_type: string;
  configuration: MixTemplateConfiguration;
  created_at: number;
  updated_at: number;
  last_used_at?: number;
  use_count: number;
}

interface EditTemplateModalProps {
  template: Template;
  onClose: () => void;
  onSave: (id: number, name: string, description: string, configuration: MixTemplateConfiguration) => Promise<void>;
  isSaving: boolean;
}

export const EditTemplateModal: FC<EditTemplateModalProps> = ({ 
  template, 
  onClose, 
  onSave, 
  isSaving 
}) => {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [configuration, setConfiguration] = useState<MixTemplateConfiguration>(template.configuration);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    description?: string;
    configuration?: string;
  }>({});

  // Validation functions
  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Template name is required';
    }
    if (value.length > 255) {
      return 'Template name must be 255 characters or less';
    }
    return undefined;
  };

  const validateDescription = (value: string): string | undefined => {
    if (value.length > 1000) {
      return 'Description must be 1000 characters or less';
    }
    return undefined;
  };

  const validateConfiguration = (config: MixTemplateConfiguration): string | undefined => {
    try {
      // Validate it can be serialized to JSON
      JSON.stringify(config);
      
      // Validate track count
      if (config.trackCount < 1 || config.trackCount > 500) {
        return 'Track count must be between 1 and 500';
      }
      
      return undefined;
    } catch (err) {
      return 'Invalid configuration format';
    }
  };

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};
    
    const nameError = validateName(name);
    if (nameError) errors.name = nameError;
    
    const descError = validateDescription(description);
    if (descError) errors.description = descError;
    
    const configError = validateConfiguration(configuration);
    if (configError) errors.configuration = configError;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Clear validation error for a specific field
  const clearFieldError = (field: keyof typeof validationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle name change with validation
  const handleNameChange = (value: string) => {
    setName(value);
    clearFieldError('name');
    setError(null);
  };

  // Handle description change with validation
  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    clearFieldError('description');
    setError(null);
  };

  // Handle configuration change with validation
  const handleConfigurationChange = (updates: Partial<MixTemplateConfiguration>) => {
    setConfiguration({ ...configuration, ...updates });
    clearFieldError('configuration');
    setError(null);
  };

  // Validate on blur
  const handleNameBlur = () => {
    const error = validateName(name);
    if (error) {
      setValidationErrors(prev => ({ ...prev, name: error }));
    }
  };

  const handleDescriptionBlur = () => {
    const error = validateDescription(description);
    if (error) {
      setValidationErrors(prev => ({ ...prev, description: error }));
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (name.trim() && !isSaving) {
          handleSave();
        }
      }
      // Escape to close
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [name, isSaving, onClose]);

  // Focus trap
  useEffect(() => {
    const modal = document.querySelector('.edit-template-modal');
    const focusableElements = modal?.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, []);

  const handleSave = async () => {
    setError(null);

    // Validate all fields
    if (!validateForm()) {
      setError('Please fix the validation errors before saving');
      return;
    }

    try {
      await onSave(template.id, name.trim(), description.trim(), configuration);
      // Modal will be closed by parent component on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
  };

  const updateConfiguration = (updates: Partial<MixTemplateConfiguration>) => {
    handleConfigurationChange(updates);
  };

  return (
    <div 
      className="edit-template-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-template-title"
    >
      <div className="edit-template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-template-header">
          <h2 id="edit-template-title" className="edit-template-title">
            Edit Template: {template.name}
          </h2>
          <button 
            className="edit-template-close" 
            onClick={onClose} 
            disabled={isSaving}
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="edit-template-content">
          {error && (
            <div className="edit-template-error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          {/* Template Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-template-name">
              Template Name <span className="required" aria-label="required">*</span>
            </label>
            <input
              id="edit-template-name"
              type="text"
              className={`form-input ${validationErrors.name ? 'error' : ''}`}
              placeholder="e.g., Chill Evening Mix"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              disabled={isSaving}
              autoFocus
              maxLength={255}
              aria-required="true"
              aria-invalid={!!validationErrors.name}
              aria-describedby={validationErrors.name ? 'name-error' : 'name-hint'}
            />
            {validationErrors.name && (
              <div id="name-error" className="field-error" role="alert">
                {validationErrors.name}
              </div>
            )}
            <div id="name-hint" className="field-hint" aria-live="polite">
              {name.length}/255 characters
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-template-description">
              Description (optional)
            </label>
            <textarea
              id="edit-template-description"
              className={`form-textarea ${validationErrors.description ? 'error' : ''}`}
              placeholder="Add a description for this template..."
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onBlur={handleDescriptionBlur}
              disabled={isSaving}
              rows={3}
              maxLength={1000}
              aria-invalid={!!validationErrors.description}
              aria-describedby={validationErrors.description ? 'description-error' : 'description-hint'}
            />
            {validationErrors.description && (
              <div id="description-error" className="field-error" role="alert">
                {validationErrors.description}
              </div>
            )}
            <div id="description-hint" className="field-hint" aria-live="polite">
              {description.length}/1000 characters
            </div>
          </div>

          {/* Mix Configuration Section */}
          <div className="config-section">
            <h3 className="section-title">Mix Configuration</h3>

            {validationErrors.configuration && (
              <div className="field-error" role="alert">
                {validationErrors.configuration}
              </div>
            )}

            {/* Track Count */}
            <div className="form-group">
              <label className="form-label" htmlFor="track-count">
                Number of Tracks: {configuration.trackCount}
              </label>
              <input
                id="track-count"
                type="range"
                className="track-slider"
                min="10"
                max="200"
                step="10"
                value={configuration.trackCount}
                onChange={(e) => updateConfiguration({ trackCount: parseInt(e.target.value) })}
                disabled={isSaving}
                aria-valuemin={10}
                aria-valuemax={200}
                aria-valuenow={configuration.trackCount}
                aria-label={`Track count: ${configuration.trackCount}`}
              />
            </div>

            {/* Sort By */}
            <div className="form-group">
              <label className="form-label" htmlFor="sort-by">Sort By</label>
              <select
                id="sort-by"
                className="form-select"
                value={configuration.sortBy || 'random'}
                onChange={(e) => updateConfiguration({ 
                  sortBy: e.target.value as MixTemplateConfiguration['sortBy'] 
                })}
                disabled={isSaving}
                aria-label="Sort order"
              >
                <option value="random">Random</option>
                <option value="rating">Rating</option>
                <option value="playCount">Play Count</option>
                <option value="dateAdded">Date Added</option>
              </select>
            </div>

            {/* Mix Type Specific Fields */}
            {configuration.mixType === 'genre' && (
              <div className="form-group">
                <label className="form-label" htmlFor="genres">
                  Genres (comma-separated)
                </label>
                <input
                  id="genres"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Rock, Pop, Jazz"
                  value={configuration.genres?.join(', ') || ''}
                  onChange={(e) => updateConfiguration({
                    genres: e.target.value ? e.target.value.split(',').map(g => g.trim()) : []
                  })}
                  disabled={isSaving}
                  aria-label="Genre list"
                />
              </div>
            )}

            {configuration.mixType === 'mood' && (
              <div className="form-group">
                <label className="form-label" htmlFor="moods">
                  Moods (comma-separated)
                </label>
                <input
                  id="moods"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Chill, Energetic, Relaxing"
                  value={configuration.moods?.join(', ') || ''}
                  onChange={(e) => updateConfiguration({
                    moods: e.target.value ? e.target.value.split(',').map(m => m.trim()) : []
                  })}
                  disabled={isSaving}
                  aria-label="Mood list"
                />
              </div>
            )}

            {configuration.mixType === 'decade' && (
              <div className="form-group">
                <label className="form-label" htmlFor="decades">
                  Decades (comma-separated, e.g., 1980, 1990)
                </label>
                <input
                  id="decades"
                  type="text"
                  className="form-input"
                  placeholder="e.g., 1980, 1990, 2000"
                  value={configuration.decades?.join(', ') || ''}
                  onChange={(e) => updateConfiguration({
                    decades: e.target.value ? e.target.value.split(',').map(d => parseInt(d.trim())) : []
                  })}
                  disabled={isSaving}
                  aria-label="Decade list"
                />
              </div>
            )}

            {/* Advanced Options */}
            <div className="advanced-section">
              <button
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={isSaving}
                type="button"
                aria-expanded={showAdvanced}
                aria-controls="advanced-options"
                aria-label={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
              >
                <span className="advanced-icon" aria-hidden="true">
                  {showAdvanced ? '▼' : '▶'}
                </span>
                Advanced Options
              </button>

              {showAdvanced && (
                <div id="advanced-options" className="advanced-content" role="region">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={configuration.allowDuplicateArtists || false}
                        onChange={(e) => updateConfiguration({ 
                          allowDuplicateArtists: e.target.checked 
                        })}
                        disabled={isSaving}
                        aria-label="Allow duplicate artists"
                      />
                      <span>Allow duplicate artists</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={configuration.allowDuplicateAlbums || false}
                        onChange={(e) => updateConfiguration({ 
                          allowDuplicateAlbums: e.target.checked 
                        })}
                        disabled={isSaving}
                        aria-label="Allow duplicate albums"
                      />
                      <span>Allow duplicate albums</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="max-tracks-artist">
                      Max tracks per artist
                    </label>
                    <input
                      id="max-tracks-artist"
                      type="number"
                      className="form-input"
                      placeholder="No limit"
                      value={configuration.maxTracksPerArtist || ''}
                      onChange={(e) => updateConfiguration({
                        maxTracksPerArtist: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      disabled={isSaving}
                      min="1"
                      aria-label="Maximum tracks per artist"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="max-tracks-album">
                      Max tracks per album
                    </label>
                    <input
                      id="max-tracks-album"
                      type="number"
                      className="form-input"
                      placeholder="No limit"
                      value={configuration.maxTracksPerAlbum || ''}
                      onChange={(e) => updateConfiguration({
                        maxTracksPerAlbum: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      disabled={isSaving}
                      min="1"
                      aria-label="Maximum tracks per album"
                    />
                  </div>

                  {configuration.mixType === 'custom' && configuration.customRules && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Include Genres (comma-separated)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g., Rock, Pop"
                          value={configuration.customRules.includeGenres?.join(', ') || ''}
                          onChange={(e) => updateConfiguration({
                            customRules: {
                              ...configuration.customRules,
                              includeGenres: e.target.value ? e.target.value.split(',').map(g => g.trim()) : []
                            }
                          })}
                          disabled={isSaving}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Exclude Genres (comma-separated)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g., Country, Classical"
                          value={configuration.customRules.excludeGenres?.join(', ') || ''}
                          onChange={(e) => updateConfiguration({
                            customRules: {
                              ...configuration.customRules,
                              excludeGenres: e.target.value ? e.target.value.split(',').map(g => g.trim()) : []
                            }
                          })}
                          disabled={isSaving}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Minimum Rating (0-10)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Any"
                          value={configuration.customRules.minRating || ''}
                          onChange={(e) => updateConfiguration({
                            customRules: {
                              ...configuration.customRules,
                              minRating: e.target.value ? parseFloat(e.target.value) : undefined
                            }
                          })}
                          disabled={isSaving}
                          min="0"
                          max="10"
                          step="0.1"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="edit-template-hint" role="note">
            Press <kbd>Ctrl+S</kbd> to save quickly • <kbd>Esc</kbd> to cancel
          </div>
        </div>

        <div className="edit-template-actions">
          <button
            onClick={handleSave}
            className={`btn-save ${isSaving ? 'btn-loading' : ''}`}
            disabled={isSaving || !name.trim() || Object.keys(validationErrors).length > 0}
            aria-label={isSaving ? 'Saving changes...' : 'Save changes'}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="btn-cancel"
            disabled={isSaving}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
