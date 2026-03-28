import type { FC } from 'react';
import { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import type { Playlist } from '@playlist-lab/shared';
import { CustomMixModal, type CustomMixSettings } from './CustomMixModal';
import { AdvancedMixModal } from '../components/AdvancedMixModal';
import { QuickMixSettingsModal } from '../components/QuickMixSettingsModal';
import { SaveTemplateModal } from '../components/SaveTemplateModal';
import { TemplateList, type MixTemplate } from '../components/TemplateList';
import { EditTemplateModal } from '../components/EditTemplateModal';
import './GenerateMixesPage.css';

type MixType = 'weekly' | 'daily' | 'timecapsule' | 'newmusic' | 'deepcuts' | 'artistdiscovery' | 'mood' | 'era' | 'genreevolution' | 'artistjourney' | 'workout' | 'forgottenfavorites' | 'genreblend' | 'custom' | 'all';
type AdvancedMixType = 'artistdiscovery' | 'mood' | 'era' | 'genreevolution' | 'artistjourney' | 'genreblend';
type QuickMixType = 'weekly' | 'daily' | 'timecapsule' | 'newmusic' | 'deepcuts' | 'workout' | 'forgottenfavorites';

export const GenerateMixesPage: FC = () => {
  const { apiClient, settings, refreshPlaylists, refreshSchedules } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ message: string; progress: number } | null>(null);
  const [generatedPlaylists, setGeneratedPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMix, setSelectedMix] = useState<MixType | null>(null);
  const [showCustomMixModal, setShowCustomMixModal] = useState(false);
  const [showAdvancedMixModal, setShowAdvancedMixModal] = useState(false);
  const [showQuickMixSettingsModal, setShowQuickMixSettingsModal] = useState(false);
  const [advancedMixType, setAdvancedMixType] = useState<AdvancedMixType | null>(null);
  const [quickMixType, setQuickMixType] = useState<QuickMixType | null>(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentCustomSettings, setCurrentCustomSettings] = useState<CustomMixSettings | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<any>(null);
  const [initialCustomSettings, setInitialCustomSettings] = useState<Partial<CustomMixSettings> | undefined>(undefined);
  const [templateListKey, setTemplateListKey] = useState(0);
  const [scheduleTemplate, setScheduleTemplate] = useState<MixTemplate | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'fortnightly' | 'monthly'>('weekly');
  const [scheduleStartDate, setScheduleStartDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [scheduleRunTime, setScheduleRunTime] = useState<string>('09:00');
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [scheduleQuickMix, setScheduleQuickMix] = useState<{ mixType: QuickMixType; settings: any } | null>(null);

  const mixes = [
    {
      id: 'weekly' as const,
      name: 'Weekly Mix',
      description: 'Tracks from your most-played artists',
    },
    {
      id: 'daily' as const,
      name: 'Daily Mix',
      description: 'Recent plays, related tracks, and rediscoveries',
    },
    {
      id: 'timecapsule' as const,
      name: 'Time Capsule',
      description: 'Tracks you haven\'t played in a while',
    },
    {
      id: 'newmusic' as const,
      name: 'New Music Mix',
      description: 'Recently added albums',
    },
    {
      id: 'deepcuts' as const,
      name: 'Deep Cuts Mix',
      description: 'Hidden gems with low play counts',
    },
    {
      id: 'artistdiscovery' as const,
      name: 'Artist Discovery',
      description: 'Tracks from similar artists',
    },
    {
      id: 'mood' as const,
      name: 'Mood Mix',
      description: 'Tracks filtered by mood tags',
    },
    {
      id: 'era' as const,
      name: 'Era Mix',
      description: 'Tracks from a specific decade',
    },
    {
      id: 'genreevolution' as const,
      name: 'Genre Evolution',
      description: 'How a genre evolved over time',
    },
    {
      id: 'artistjourney' as const,
      name: 'Artist Journey',
      description: 'Chronological artist discography',
    },
    {
      id: 'workout' as const,
      name: 'Workout Mix',
      description: 'Progressive tempo build',
    },
    {
      id: 'forgottenfavorites' as const,
      name: 'Forgotten Favorites',
      description: 'High play count, not played recently',
    },
    {
      id: 'genreblend' as const,
      name: 'Genre Blend',
      description: 'Tracks spanning multiple genres',
    },
    {
      id: 'custom' as const,
      name: 'Custom Mix',
      description: 'Create a mix with your own filters',
    },
    {
      id: 'all' as const,
      name: 'Generate All',
      description: 'Create all mixes at once',
    },
  ];

  const handleGenerate = useCallback(async (mixType: MixType) => {
    // Show modal for mix types that require user input
    if (mixType === 'custom') {
      setShowCustomMixModal(true);
      return;
    }
    
    // Show advanced modal for complex mixes
    if (['artistdiscovery', 'mood', 'era', 'genreevolution', 'artistjourney', 'genreblend'].includes(mixType)) {
      setAdvancedMixType(mixType as AdvancedMixType);
      setShowAdvancedMixModal(true);
      return;
    }

    // Show quick settings modal for basic mixes
    if (['weekly', 'daily', 'timecapsule', 'newmusic', 'deepcuts', 'workout', 'forgottenfavorites'].includes(mixType)) {
      setQuickMixType(mixType as QuickMixType);
      setShowQuickMixSettingsModal(true);
      return;
    }

    // Only 'all' should reach here - generate without settings
    if (mixType === 'all') {
      setError(null);
      setGeneratedPlaylists([]);
      setIsGenerating(true);
      setSelectedMix(mixType);

      try {
        const result = await apiClient.generateAllMixes();
        setGeneratedPlaylists(Array.isArray(result) ? result : [result]);
        await refreshPlaylists();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate mixes');
      } finally {
        setIsGenerating(false);
        setSelectedMix(null);
      }
    }
  }, [apiClient, refreshPlaylists]);

  const handleGenerateCustomMix = async (customSettings: CustomMixSettings) => {
    setError(null);
    setGeneratedPlaylists([]);
    setIsGenerating(true);
    setGenerationProgress(null);
    setSelectedMix('custom');
    setShowCustomMixModal(false);
    setCurrentCustomSettings(customSettings); // Store settings for potential template save

    // Generate a unique session ID for progress tracking
    const sessionId = `custom-mix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up SSE connection for progress updates
    const eventSource = new EventSource(`/api/mixes/progress/${sessionId}`, {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setGenerationProgress({ message: data.message, progress: data.progress });
        } else if (data.type === 'complete') {
          setGenerationProgress({ message: 'Complete!', progress: 100 });
          eventSource.close();
        } else if (data.type === 'error') {
          setError(data.message);
          eventSource.close();
          setIsGenerating(false);
          setGenerationProgress(null);
          setSelectedMix(null);
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      const result = await apiClient.generateCustomMix({ ...customSettings, sessionId } as any);
      if (result.success) {
        // Convert the response to match the expected Playlist type
        const now = Date.now();
        setGeneratedPlaylists([{
          id: 0, // Temporary ID, will be replaced after refresh
          plexPlaylistId: result.playlist.id,
          name: result.playlist.name,
          source: 'custom-mix',
          trackCount: result.playlist.trackCount,
          createdAt: now,
          updatedAt: now,
        }]);
        await refreshPlaylists();
      } else {
        setError('Failed to generate custom mix');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate custom mix');
    } finally {
      eventSource.close();
      setIsGenerating(false);
      setGenerationProgress(null);
      setSelectedMix(null);
    }
  };

  const handleGenerateAdvancedMix = async (settings: any) => {
    setError(null);
    setGeneratedPlaylists([]);
    setIsGenerating(true);
    setSelectedMix(advancedMixType!);
    setShowAdvancedMixModal(false);

    try {
      let result: any;

      switch (advancedMixType) {
        case 'artistdiscovery':
          result = await apiClient.generateArtistDiscoveryMix(settings);
          break;
        case 'mood':
          result = await apiClient.generateMoodMix(settings);
          break;
        case 'era':
          result = await apiClient.generateEraMix(settings);
          break;
        case 'genreevolution':
          result = await apiClient.generateGenreEvolutionMix(settings);
          break;
        case 'artistjourney':
          result = await apiClient.generateArtistJourneyMix(settings);
          break;
        case 'genreblend':
          result = await apiClient.generateGenreBlendMix(settings);
          break;
      }

      if (result.success) {
        const now = Date.now();
        setGeneratedPlaylists([{
          id: 0,
          plexPlaylistId: result.playlist.id,
          name: result.playlist.name,
          source: advancedMixType!,
          trackCount: result.playlist.trackCount,
          createdAt: now,
          updatedAt: now,
        }]);
        await refreshPlaylists();
      } else {
        setError(result.message || 'Failed to generate mix');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate mix');
    } finally {
      setIsGenerating(false);
      setSelectedMix(null);
    }
  };

  const handleGenerateQuickMix = async (settings: any) => {
    setError(null);
    setGeneratedPlaylists([]);
    setIsGenerating(true);
    setSelectedMix(quickMixType!);
    setShowQuickMixSettingsModal(false);

    try {
      let result: any;

      switch (quickMixType) {
        case 'weekly':
          result = await apiClient.generateWeeklyMix();
          break;
        case 'daily':
          result = await apiClient.generateDailyMix();
          break;
        case 'timecapsule':
          result = await apiClient.generateTimeCapsule();
          break;
        case 'newmusic':
          result = await apiClient.generateNewMusicMix();
          break;
        case 'deepcuts':
          result = await apiClient.generateDeepCutsMix(settings);
          break;
        case 'workout':
          result = await apiClient.generateWorkoutMix(settings);
          break;
        case 'forgottenfavorites':
          result = await apiClient.generateForgottenFavoritesMix(settings);
          break;
      }

      // Handle response format
      if (result.success !== undefined) {
        if (result.success) {
          const now = Date.now();
          setGeneratedPlaylists([{
            id: 0,
            plexPlaylistId: result.playlist.id,
            name: result.playlist.name,
            source: quickMixType!,
            trackCount: result.playlist.trackCount,
            createdAt: now,
            updatedAt: now,
          }]);
        } else {
          setError(result.message || 'Failed to generate mix');
        }
      } else {
        setGeneratedPlaylists(Array.isArray(result) ? result : [result]);
      }
      
      await refreshPlaylists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate mix');
    } finally {
      setIsGenerating(false);
      setSelectedMix(null);
    }
  };

  const handleAddQuickMixToSchedule = (settings: any) => {
    // Store the mix type and settings, then open the schedule modal
    if (quickMixType) {
      setScheduleQuickMix({ mixType: quickMixType, settings });
      setShowQuickMixSettingsModal(false);
      setQuickMixType(null);
    }
  };

  const handleScheduleQuickMixConfirm = async () => {
    if (!scheduleQuickMix) return;

    setIsCreatingSchedule(true);
    setError(null);

    try {
      await apiClient.createSchedule({
        scheduleType: 'mix_generation',
        frequency: scheduleFrequency,
        startDate: scheduleStartDate,
        playlistId: undefined,
        config: {
          mixType: scheduleQuickMix.mixType,
          mixName: scheduleQuickMix.settings.playlistName || `${scheduleQuickMix.mixType} Mix`,
          ...scheduleQuickMix.settings,
          run_time: scheduleRunTime,
        },
      } as any);

      // Refresh schedules to show the new one (with small delay to ensure it's saved)
      await new Promise(resolve => setTimeout(resolve, 100));
      await refreshSchedules();

      setSuccessMessage(`Schedule created for "${scheduleQuickMix.settings.playlistName || scheduleQuickMix.mixType}"!`);
      setScheduleQuickMix(null);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsCreatingSchedule(false);
    }
  };

  const handleAddAdvancedMixToSchedule = (settings: any) => {
    setShowAdvancedMixModal(false);
    const currentMixType = advancedMixType;
    setAdvancedMixType(null);
    // Navigate to schedules page
    window.location.href = `/schedules?mixType=${currentMixType}&settings=${encodeURIComponent(JSON.stringify(settings))}`;
  };

  const handleSaveCustomMixAsTemplate = async (customSettings: CustomMixSettings) => {
    setCurrentCustomSettings(customSettings);
    setShowCustomMixModal(false);
    setShowSaveTemplateModal(true);
  };

  const handleSaveTemplate = async (name: string, description: string) => {
    if (!currentCustomSettings) {
      throw new Error('No custom mix settings to save');
    }

    setIsSaving(true);
    try {
      // Convert CustomMixSettings to template configuration
      const configuration = {
        mixType: 'custom',
        trackCount: currentCustomSettings.trackCount,
        sortBy: currentCustomSettings.sortBy,
        sortDirection: currentCustomSettings.sortDirection,
        customRules: {
          // Time filters
          playedInLastDays: currentCustomSettings.playedInLastDays,
          notPlayedInLastDays: currentCustomSettings.notPlayedInLastDays,
          addedInLastDays: currentCustomSettings.addedInLastDays,
          
          // Release date filters
          yearRange: {
            min: currentCustomSettings.releasedAfterYear,
            max: currentCustomSettings.releasedBeforeYear,
          },
          
          // Rating & popularity
          minRating: currentCustomSettings.minRating,
          maxRating: currentCustomSettings.maxRating,
          minPlayCount: currentCustomSettings.minPlayCount,
          maxPlayCount: currentCustomSettings.maxPlayCount,
          
          // Track characteristics
          minDuration: currentCustomSettings.minDuration,
          maxDuration: currentCustomSettings.maxDuration,
          minTrackNumber: currentCustomSettings.minTrackNumber,
          maxTrackNumber: currentCustomSettings.maxTrackNumber,
          discNumber: currentCustomSettings.discNumber,
          
          // Quality filters
          minBitrate: currentCustomSettings.minBitrate,
          audioCodec: currentCustomSettings.audioCodec,
          minSampleRate: currentCustomSettings.minSampleRate,
          losslessOnly: currentCustomSettings.losslessOnly,
          
          // Metadata filters
          includeGenres: currentCustomSettings.genres,
          excludeGenres: currentCustomSettings.excludeGenres,
          includeMoods: currentCustomSettings.moods,
          excludeMoods: currentCustomSettings.excludeMoods,
          includeStyles: currentCustomSettings.styles,
          excludeStyles: currentCustomSettings.excludeStyles,
          collections: currentCustomSettings.collections,
          labels: currentCustomSettings.labels,
          
          // Artist/Album filters
          artistNames: currentCustomSettings.artistNames,
          albumTitles: currentCustomSettings.albumTitles,
          
          // Sonic Analysis filters
          sonicSeedTrackKey: currentCustomSettings.sonicSeedTrackKey,
          sonicSeedArtistKey: currentCustomSettings.sonicSeedArtistKey,
          sonicMaxDistance: currentCustomSettings.sonicMaxDistance,
          sonicIncludeSameArtist: currentCustomSettings.sonicIncludeSameArtist,
          sonicIncludeSimilarArtists: currentCustomSettings.sonicIncludeSimilarArtists,
          sonicUsePopularTracks: currentCustomSettings.sonicUsePopularTracks,
        },
      };

      await apiClient.createMixTemplate({
        name,
        description: description || undefined,
        mixType: 'custom',
        configuration,
      });

      setSuccessMessage('Template saved successfully!');
      setShowSaveTemplateModal(false);
      setTemplateListKey(prev => prev + 1); // Force template list refresh
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      throw err; // Let the modal handle the error display
    } finally {
      setIsSaving(false);
    }
  };

  // Template handlers
  const handleScheduleTemplate = useCallback((template: MixTemplate) => {
    // Open schedule modal instead of navigating
    setScheduleTemplate(template);
  }, []);

  const handleQuickGenerate = useCallback(async (template: MixTemplate) => {
    setError(null);
    setGeneratedPlaylists([]);
    setIsGenerating(true);
    setGenerationProgress(null);
    setSelectedMix('custom');

    // Generate a unique session ID for progress tracking
    const sessionId = `template-mix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up SSE connection for progress updates
    const eventSource = new EventSource(`/api/mixes/progress/${sessionId}`, {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setGenerationProgress({ message: data.message, progress: data.progress });
        } else if (data.type === 'complete') {
          setGenerationProgress({ message: 'Complete!', progress: 100 });
          eventSource.close();
        } else if (data.type === 'error') {
          setError(data.message);
          eventSource.close();
          setIsGenerating(false);
          setGenerationProgress(null);
          setSelectedMix(null);
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      // Generate playlist name with timestamp
      const playlistName = `${template.name} - ${new Date().toLocaleDateString()}`;
      
      // Use the template generation endpoint which handles all mix types
      // and automatically updates usage statistics
      const result = await apiClient.generateMixFromTemplate(template.id, playlistName, sessionId);
      
      // Create a playlist object for display
      const playlist: Playlist = {
        id: parseInt(result.playlistId),
        plexPlaylistId: result.playlistId,
        name: playlistName,
        source: 'template',
        sourceUrl: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        trackCount: result.trackCount,
        userId: 0, // Will be set by backend
      };
      
      setGeneratedPlaylists([playlist]);
      await refreshPlaylists();
      setTemplateListKey(prev => prev + 1); // Force template list refresh
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        setSuccessMessage(`${result.message}\n\nWarnings:\n${result.warnings.join('\n')}`);
      } else {
        setSuccessMessage(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate mix from template');
    } finally {
      eventSource.close();
      setIsGenerating(false);
      setGenerationProgress(null);
      setSelectedMix(null);
    }
  }, [apiClient, refreshPlaylists]);

  const handleEditTemplate = (template: MixTemplate) => {
    // Convert MixTemplate to the format expected by EditTemplateModal
    const editTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      mix_type: template.mixType,
      configuration: template.configuration,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
      last_used_at: template.lastUsedAt,
      use_count: template.useCount,
    };
    setTemplateToEdit(editTemplate as any);
    setShowEditTemplateModal(true);
  };

  const handleSaveEditedTemplate = async (id: number, name: string, description: string, configuration: any) => {
    setIsSaving(true);
    try {
      await apiClient.updateMixTemplate(id, { name, description, configuration });

      setSuccessMessage('Template updated successfully!');
      setShowEditTemplateModal(false);
      setTemplateToEdit(null);
      setTemplateListKey(prev => prev + 1); // Force template list refresh
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleConfirm = async () => {
    if (!scheduleTemplate) return;

    setIsCreatingSchedule(true);
    setError(null);

    try {
      await apiClient.createSchedule({
        scheduleType: 'mix_generation',
        frequency: scheduleFrequency,
        startDate: scheduleStartDate,
        playlistId: undefined,
        config: {
          templateId: scheduleTemplate.id,
          templateName: scheduleTemplate.name,
          run_time: scheduleRunTime,
        },
      } as any);

      // Refresh schedules to show the new one (with small delay to ensure it's saved)
      await new Promise(resolve => setTimeout(resolve, 100));
      await refreshSchedules();

      setSuccessMessage(`Schedule created for "${scheduleTemplate.name}"!`);
      setScheduleTemplate(null);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsCreatingSchedule(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Generate Mixes</h1>
        <p className="page-description">Generate personalized playlists based on your listening history</p>
      </div>

      <div className="generate-mixes-content">
        {/* Quick Mixes Section */}
        <section className="quick-mixes-section">
          <div className="section-header">
            <h2 className="section-title">Quick Mixes</h2>
            <p className="section-description">Generate instant playlists with customizable settings</p>
          </div>
          <div className="quick-mixes-grid">
            {mixes.filter(mix => mix.id !== 'custom').map(mix => (
              <button
                key={mix.id}
                className={`quick-mix-card ${isGenerating && selectedMix === mix.id ? 'generating' : ''}`}
                onClick={() => !isGenerating && handleGenerate(mix.id)}
                disabled={isGenerating && selectedMix !== mix.id}
              >
                <div className="quick-mix-content">
                  <h3 className="quick-mix-name">{mix.name}</h3>
                  <p className="quick-mix-description">{mix.description}</p>
                </div>
                {isGenerating && selectedMix === mix.id && (
                  <div className="quick-mix-status">
                    <div className="spinner"></div>
                    <span>Generating...</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Custom Mixes Section */}
        <section className="custom-mixes-section">
          <div className="section-header">
            <h2 className="section-title">Custom Mixes</h2>
            <p className="section-description">Create advanced mixes with custom filters or use saved configurations</p>
          </div>
          
          <div className="custom-mixes-container">
            {/* Saved Mixes (Templates) */}
            <div className="saved-mixes-wrapper">
              <TemplateList
                key={templateListKey}
                onGenerate={handleQuickGenerate}
                onSchedule={handleScheduleTemplate}
                onEdit={handleEditTemplate}
              />
            </div>

            {/* Create New Custom Mix Button */}
            <button
              className="create-custom-mix-btn-compact"
              onClick={() => setShowCustomMixModal(true)}
              disabled={isGenerating}
            >
              <span className="create-custom-icon-compact">+</span>
              <span className="create-custom-text-compact">Create New Custom Mix</span>
            </button>
          </div>
        </section>

        {/* Generated Playlists */}
        {generatedPlaylists.length > 0 && (
          <section className="generated-playlists-section">
            <div className="section-header">
              <h2 className="section-title">Generated Playlists</h2>
            </div>
            <div className="generated-playlists-list">
              {generatedPlaylists.map(playlist => (
                <div key={playlist.id} className="generated-playlist-item">
                  <div className="playlist-info">
                    <div className="playlist-name">{playlist.name}</div>
                    <div className="playlist-status">Created successfully • {playlist.trackCount} tracks</div>
                  </div>
                  <div className="playlist-actions">
                    <a href="/playlists" className="btn btn-secondary btn-small">
                      View
                    </a>
                    <a href={`/schedules?playlist=${playlist.plexPlaylistId}`} className="btn btn-primary btn-small">
                      Schedule
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {successMessage && (
          <div className="generate-mixes-success">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="generate-mixes-error">
            {error}
          </div>
        )}

        {/* Progress Display */}
        {isGenerating && generationProgress && (
          <div className="generation-progress-container">
            <div className="progress-header">
              <div className="spinner"></div>
              <span className="progress-message">{generationProgress.message}</span>
            </div>
            <div className="progress-bar-wrapper">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${generationProgress.progress}%` }}
              />
            </div>
            <div className="progress-percentage">{Math.round(generationProgress.progress)}%</div>
          </div>
        )}
      </div>

      {/* Custom Mix Modal */}
      {showCustomMixModal && (
        <CustomMixModal
          onClose={() => {
            setShowCustomMixModal(false);
            setInitialCustomSettings(undefined);
          }}
          onGenerate={handleGenerateCustomMix}
          onSaveAsTemplate={handleSaveCustomMixAsTemplate}
          isGenerating={isGenerating}
          initialSettings={initialCustomSettings}
        />
      )}

      {/* Advanced Mix Modal */}
      {showAdvancedMixModal && advancedMixType && (
        <AdvancedMixModal
          mixType={advancedMixType}
          onClose={() => {
            setShowAdvancedMixModal(false);
            setAdvancedMixType(null);
          }}
          onGenerate={handleGenerateAdvancedMix}
          onAddToSchedule={handleAddAdvancedMixToSchedule}
          isGenerating={isGenerating}
        />
      )}

      {/* Quick Mix Settings Modal */}
      {showQuickMixSettingsModal && quickMixType && (
        <QuickMixSettingsModal
          mixType={quickMixType}
          onClose={() => {
            setShowQuickMixSettingsModal(false);
            setQuickMixType(null);
          }}
          onGenerate={handleGenerateQuickMix}
          onAddToSchedule={handleAddQuickMixToSchedule}
          isGenerating={isGenerating}
          defaultSettings={settings?.mixSettings}
        />
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <SaveTemplateModal
          onClose={() => setShowSaveTemplateModal(false)}
          onSave={handleSaveTemplate}
          isSaving={isSaving}
          initialName={currentCustomSettings?.name || ''}
        />
      )}

      {/* Edit Template Modal */}
      {showEditTemplateModal && templateToEdit && (
        <EditTemplateModal
          template={templateToEdit}
          onClose={() => {
            setShowEditTemplateModal(false);
            setTemplateToEdit(null);
          }}
          onSave={handleSaveEditedTemplate}
          isSaving={isSaving}
        />
      )}

      {/* Schedule Template Modal */}
      {scheduleTemplate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Schedule Mix</h2>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setScheduleTemplate(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{scheduleTemplate.name}</div>
              {scheduleTemplate.description && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {scheduleTemplate.description}
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                This schedule will generate a new playlist from this template
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Update Frequency
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'fortnightly', label: 'Fortnightly (Every 2 weeks)' },
                  { value: 'monthly', label: 'Monthly' },
                ].map(option => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: scheduleFrequency === option.value ? 'var(--surface-hover)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={scheduleFrequency === option.value}
                      onChange={(e) => setScheduleFrequency(e.target.value as any)}
                      style={{ marginRight: '0.75rem' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Start Date
              </label>
              <input
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                First update will occur on this date
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Run Time
              </label>
              <select
                value={scheduleRunTime}
                onChange={(e) => setScheduleRunTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              >
                {Array.from({ length: 144 }, (_, i) => {
                  const hour = Math.floor(i / 6);
                  const minute = (i % 6) * 10;
                  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                  return <option key={timeStr} value={timeStr}>{timeStr}</option>;
                })}
              </select>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Schedules are checked every 10 minutes
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleScheduleConfirm}
                disabled={isCreatingSchedule}
                style={{ flex: 1 }}
              >
                {isCreatingSchedule ? 'Creating...' : 'Create Schedule'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setScheduleTemplate(null)}
                disabled={isCreatingSchedule}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Quick Mix Modal */}
      {scheduleQuickMix && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Schedule Mix</h2>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setScheduleQuickMix(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                {scheduleQuickMix.settings.playlistName || `${scheduleQuickMix.mixType} Mix`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                This schedule will generate a new {scheduleQuickMix.mixType} mix
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Update Frequency
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'fortnightly', label: 'Fortnightly (Every 2 weeks)' },
                  { value: 'monthly', label: 'Monthly' },
                ].map(option => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: scheduleFrequency === option.value ? 'var(--surface-hover)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="quickFrequency"
                      value={option.value}
                      checked={scheduleFrequency === option.value}
                      onChange={(e) => setScheduleFrequency(e.target.value as any)}
                      style={{ marginRight: '0.75rem' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Start Date
              </label>
              <input
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                First update will occur on this date
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Run Time
              </label>
              <select
                value={scheduleRunTime}
                onChange={(e) => setScheduleRunTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              >
                {Array.from({ length: 144 }, (_, i) => {
                  const hour = Math.floor(i / 6);
                  const minute = (i % 6) * 10;
                  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                  return <option key={timeStr} value={timeStr}>{timeStr}</option>;
                })}
              </select>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Schedules are checked every 10 minutes
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleScheduleQuickMixConfirm}
                disabled={isCreatingSchedule}
                style={{ flex: 1 }}
              >
                {isCreatingSchedule ? 'Creating...' : 'Create Schedule'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setScheduleQuickMix(null)}
                disabled={isCreatingSchedule}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
