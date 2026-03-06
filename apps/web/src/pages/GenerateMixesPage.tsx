import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import type { Playlist } from '@playlist-lab/shared';
import { CustomMixModal, type CustomMixSettings } from './CustomMixModal';
import './GenerateMixesPage.css';

type MixType = 'weekly' | 'daily' | 'timecapsule' | 'newmusic' | 'custom' | 'all';

export const GenerateMixesPage: FC = () => {
  const { apiClient, settings, refreshPlaylists, refreshSettings } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlaylists, setGeneratedPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMix, setSelectedMix] = useState<MixType | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCustomMixModal, setShowCustomMixModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mix settings state
  const [mixSettings, setMixSettings] = useState({
    weeklyMix: { topArtists: 10, tracksPerArtist: 3 },
    dailyMix: { recentTracks: 10, relatedTracks: 10, rediscoveryTracks: 5, rediscoveryDays: 90 },
    timeCapsule: { trackCount: 50, daysAgo: 365, maxPerArtist: 3 },
    newMusic: { albumCount: 10, tracksPerAlbum: 3 },
  });

  // Load settings when component mounts or settings change
  useEffect(() => {
    if (settings?.mixSettings) {
      setMixSettings(settings.mixSettings);
    }
  }, [settings]);

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

  const handleGenerate = async (mixType: MixType) => {
    if (mixType === 'custom') {
      setShowCustomMixModal(true);
      return;
    }

    setError(null);
    setGeneratedPlaylists([]);
    setIsGenerating(true);
    setSelectedMix(mixType);

    try {
      let result: Playlist | Playlist[];

      switch (mixType) {
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
        case 'all':
          result = await apiClient.generateAllMixes();
          break;
        default:
          throw new Error('Invalid mix type');
      }

      setGeneratedPlaylists(Array.isArray(result) ? result : [result]);
      await refreshPlaylists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate mix');
    } finally {
      setIsGenerating(false);
      setSelectedMix(null);
    }
  };

  const handleGenerateCustomMix = async (customSettings: CustomMixSettings) => {
    setError(null);
    setGeneratedPlaylists([]);
    setIsGenerating(true);
    setSelectedMix('custom');
    setShowCustomMixModal(false);

    try {
      const result = await apiClient.generateCustomMix(customSettings);
      setGeneratedPlaylists([result]);
      await refreshPlaylists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate custom mix');
    } finally {
      setIsGenerating(false);
      setSelectedMix(null);
    }
  };

  const handleSaveMixSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.updateMixSettings(mixSettings);
      await refreshSettings();
      setSuccessMessage('Mix settings saved successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        setShowSettingsModal(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Generate Mixes</h1>
        <p className="page-description">Generate personalized playlists based on your listening history</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
          gap: '1rem' 
        }}>
          {mixes.map(mix => (
            <div
              key={mix.id}
              className="card mix-card"
              style={{
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating && selectedMix !== mix.id ? 0.5 : 1,
                transition: 'all 0.2s',
                ...(mix.id === 'custom' ? { border: '2px dashed var(--primary-color)' } : {}),
              }}
              onClick={() => !isGenerating && handleGenerate(mix.id)}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{mix.name}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {mix.description}
              </p>
              {isGenerating && selectedMix === mix.id && (
                <div style={{ 
                  padding: '0.5rem', 
                  backgroundColor: 'var(--surface-hover)', 
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: 'var(--primary-color)'
                }}>
                  Generating...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mix Settings */}
      {settings && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Mix Settings</h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Weekly Mix</h3>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Top {settings.mixSettings?.weeklyMix?.topArtists || 10} artists, {settings.mixSettings?.weeklyMix?.tracksPerArtist || 3} tracks each
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Daily Mix</h3>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {settings.mixSettings?.dailyMix?.recentTracks || 10} recent + {settings.mixSettings?.dailyMix?.relatedTracks || 10} related + {settings.mixSettings?.dailyMix?.rediscoveryTracks || 5} rediscoveries
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Time Capsule</h3>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {settings.mixSettings?.timeCapsule?.trackCount || 50} tracks from {settings.mixSettings?.timeCapsule?.daysAgo || 365} days ago
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>New Music Mix</h3>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {settings.mixSettings?.newMusic?.albumCount || 10} albums, {settings.mixSettings?.newMusic?.tracksPerAlbum || 3} tracks each
              </div>
            </div>
          </div>

          <button 
            onClick={() => setShowSettingsModal(true)} 
            className="btn btn-secondary" 
            style={{ marginTop: '1rem' }}
          >
            Edit Settings
          </button>
        </div>
      )}

      {/* Generated Playlists */}
      {generatedPlaylists.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Generated Playlists</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {generatedPlaylists.map(playlist => (
              <div
                key={playlist.id}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{playlist.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Created successfully
                  </div>
                </div>
                <a href="/playlists" className="btn btn-secondary btn-small">
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: '4px',
          color: 'var(--error)',
        }}>
          {error}
        </div>
      )}

      {/* Custom Mix Modal */}
      {showCustomMixModal && (
        <CustomMixModal
          onClose={() => setShowCustomMixModal(false)}
          onGenerate={handleGenerateCustomMix}
          isGenerating={isGenerating}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="mix-settings-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="mix-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mix-settings-header">
              <h2 className="mix-settings-title">Mix Settings</h2>
              <button className="mix-settings-close" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>

            <div className="mix-settings-content">
              {successMessage && (
                <div className="mix-settings-success">{successMessage}</div>
              )}

              {/* Weekly Mix */}
              <div className="mix-settings-section">
                <h3 className="mix-settings-section-title">Weekly Mix</h3>
                <div className="mix-settings-fields">
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Top Artists: <span>{mixSettings.weeklyMix.topArtists}</span></label>
                    <input type="range" min="5" max="20" value={mixSettings.weeklyMix.topArtists}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, weeklyMix: { ...mixSettings.weeklyMix, topArtists: parseInt(e.target.value) } })} />
                  </div>
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Tracks Per Artist: <span>{mixSettings.weeklyMix.tracksPerArtist}</span></label>
                    <input type="range" min="1" max="10" value={mixSettings.weeklyMix.tracksPerArtist}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, weeklyMix: { ...mixSettings.weeklyMix, tracksPerArtist: parseInt(e.target.value) } })} />
                  </div>
                </div>
              </div>

              {/* Daily Mix */}
              <div className="mix-settings-section">
                <h3 className="mix-settings-section-title">Daily Mix</h3>
                <div className="mix-settings-fields">
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Recent Tracks: <span>{mixSettings.dailyMix.recentTracks}</span></label>
                    <input type="range" min="5" max="20" value={mixSettings.dailyMix.recentTracks}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, dailyMix: { ...mixSettings.dailyMix, recentTracks: parseInt(e.target.value) } })} />
                  </div>
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Related Tracks: <span>{mixSettings.dailyMix.relatedTracks}</span></label>
                    <input type="range" min="5" max="20" value={mixSettings.dailyMix.relatedTracks}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, dailyMix: { ...mixSettings.dailyMix, relatedTracks: parseInt(e.target.value) } })} />
                  </div>
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Rediscovery Tracks: <span>{mixSettings.dailyMix.rediscoveryTracks}</span></label>
                    <input type="range" min="0" max="15" value={mixSettings.dailyMix.rediscoveryTracks}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, dailyMix: { ...mixSettings.dailyMix, rediscoveryTracks: parseInt(e.target.value) } })} />
                  </div>
                </div>
              </div>

              {/* Time Capsule */}
              <div className="mix-settings-section">
                <h3 className="mix-settings-section-title">Time Capsule</h3>
                <div className="mix-settings-fields">
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Track Count: <span>{mixSettings.timeCapsule.trackCount}</span></label>
                    <input type="range" min="25" max="100" step="5" value={mixSettings.timeCapsule.trackCount}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, timeCapsule: { ...mixSettings.timeCapsule, trackCount: parseInt(e.target.value) } })} />
                  </div>
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Days Ago: <span>{mixSettings.timeCapsule.daysAgo}</span></label>
                    <input type="range" min="180" max="730" step="30" value={mixSettings.timeCapsule.daysAgo}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, timeCapsule: { ...mixSettings.timeCapsule, daysAgo: parseInt(e.target.value) } })} />
                  </div>
                </div>
              </div>

              {/* New Music Mix */}
              <div className="mix-settings-section">
                <h3 className="mix-settings-section-title">New Music Mix</h3>
                <div className="mix-settings-fields">
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Album Count: <span>{mixSettings.newMusic.albumCount}</span></label>
                    <input type="range" min="5" max="20" value={mixSettings.newMusic.albumCount}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, newMusic: { ...mixSettings.newMusic, albumCount: parseInt(e.target.value) } })} />
                  </div>
                  <div className="mix-settings-field">
                    <label className="mix-settings-label">Tracks Per Album: <span>{mixSettings.newMusic.tracksPerAlbum}</span></label>
                    <input type="range" min="1" max="10" value={mixSettings.newMusic.tracksPerAlbum}
                      className="mix-settings-slider"
                      onChange={(e) => setMixSettings({ ...mixSettings, newMusic: { ...mixSettings.newMusic, tracksPerAlbum: parseInt(e.target.value) } })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mix-settings-actions">
              <button className="btn btn-primary" onClick={handleSaveMixSettings} disabled={isSaving} style={{ flex: 1 }}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)} disabled={isSaving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
