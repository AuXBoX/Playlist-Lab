import type { FC } from 'react';
import { useState, useEffect } from 'react';
import './QuickMixSettingsModal.css';

interface QuickMixSettingsModalProps {
  mixType: 'weekly' | 'daily' | 'timecapsule' | 'newmusic' | 'deepcuts' | 'workout' | 'forgottenfavorites';
  onClose: () => void;
  onGenerate: (settings: any) => void;
  onAddToSchedule?: (settings: any) => void;
  isGenerating: boolean;
  defaultSettings?: any;
}

export const QuickMixSettingsModal: FC<QuickMixSettingsModalProps> = ({
  mixType,
  onClose,
  onGenerate,
  onAddToSchedule,
  isGenerating,
  defaultSettings,
}) => {
  // Weekly Mix settings
  const [topArtists, setTopArtists] = useState(defaultSettings?.weeklyMix?.topArtists || 10);
  const [tracksPerArtist, setTracksPerArtist] = useState(defaultSettings?.weeklyMix?.tracksPerArtist || 3);

  // Daily Mix settings
  const [recentTracks, setRecentTracks] = useState(defaultSettings?.dailyMix?.recentTracks || 10);
  const [relatedTracks, setRelatedTracks] = useState(defaultSettings?.dailyMix?.relatedTracks || 10);
  const [rediscoveryTracks, setRediscoveryTracks] = useState(defaultSettings?.dailyMix?.rediscoveryTracks || 5);
  const [rediscoveryDays, setRediscoveryDays] = useState(defaultSettings?.dailyMix?.rediscoveryDays || 90);

  // Time Capsule settings
  const [trackCount, setTrackCount] = useState(defaultSettings?.timeCapsule?.trackCount || 50);
  const [daysAgo, setDaysAgo] = useState(defaultSettings?.timeCapsule?.daysAgo || 365);
  const [maxPerArtist, setMaxPerArtist] = useState(defaultSettings?.timeCapsule?.maxPerArtist || 3);

  // New Music Mix settings
  const [albumCount, setAlbumCount] = useState(defaultSettings?.newMusic?.albumCount || 10);
  const [tracksPerAlbum, setTracksPerAlbum] = useState(defaultSettings?.newMusic?.tracksPerAlbum || 3);

  // Deep Cuts settings
  const [deepCutsTrackCount, setDeepCutsTrackCount] = useState(50);
  const [maxPlayCount, setMaxPlayCount] = useState(5);
  const [excludePopular, setExcludePopular] = useState(true);

  // Workout Mix settings
  const [workoutTrackCount, setWorkoutTrackCount] = useState(50);
  const [warmupTracks, setWarmupTracks] = useState(5);
  const [peakTracks, setPeakTracks] = useState(30);
  const [cooldownTracks, setCooldownTracks] = useState(5);

  // Forgotten Favorites settings
  const [forgottenTrackCount, setForgottenTrackCount] = useState(50);
  const [minPlayCount, setMinPlayCount] = useState(10);
  const [notPlayedDays, setNotPlayedDays] = useState(180);

  const [playlistName, setPlaylistName] = useState('');

  useEffect(() => {
    // Set default playlist name based on mix type
    switch (mixType) {
      case 'weekly':
        setPlaylistName('Your Weekly Mix');
        break;
      case 'daily':
        setPlaylistName('Daily Mix');
        break;
      case 'timecapsule':
        setPlaylistName('Time Capsule');
        break;
      case 'newmusic':
        setPlaylistName('New Music Mix');
        break;
      case 'deepcuts':
        setPlaylistName('Deep Cuts');
        break;
      case 'workout':
        setPlaylistName('Workout Mix');
        break;
      case 'forgottenfavorites':
        setPlaylistName('Forgotten Favorites');
        break;
    }
  }, [mixType]);

  const handleGenerate = () => {
    let settings: any = { playlistName };

    switch (mixType) {
      case 'weekly':
        settings.topArtists = topArtists;
        settings.tracksPerArtist = tracksPerArtist;
        break;
      case 'daily':
        settings.recentTracks = recentTracks;
        settings.relatedTracks = relatedTracks;
        settings.rediscoveryTracks = rediscoveryTracks;
        settings.rediscoveryDays = rediscoveryDays;
        break;
      case 'timecapsule':
        settings.trackCount = trackCount;
        settings.daysAgo = daysAgo;
        settings.maxPerArtist = maxPerArtist;
        break;
      case 'newmusic':
        settings.albumCount = albumCount;
        settings.tracksPerAlbum = tracksPerAlbum;
        break;
      case 'deepcuts':
        settings.trackCount = deepCutsTrackCount;
        settings.maxPlayCount = maxPlayCount;
        settings.excludePopular = excludePopular;
        break;
      case 'workout':
        settings.trackCount = workoutTrackCount;
        settings.warmupTracks = warmupTracks;
        settings.peakTracks = peakTracks;
        settings.cooldownTracks = cooldownTracks;
        break;
      case 'forgottenfavorites':
        settings.trackCount = forgottenTrackCount;
        settings.minPlayCount = minPlayCount;
        settings.notPlayedDays = notPlayedDays;
        break;
    }

    onGenerate(settings);
  };

  const getTitle = () => {
    switch (mixType) {
      case 'weekly': return 'Weekly Mix Settings';
      case 'daily': return 'Daily Mix Settings';
      case 'timecapsule': return 'Time Capsule Settings';
      case 'newmusic': return 'New Music Mix Settings';
      case 'deepcuts': return 'Deep Cuts Mix Settings';
      case 'workout': return 'Workout Mix Settings';
      case 'forgottenfavorites': return 'Forgotten Favorites Settings';
    }
  };

  const getDescription = () => {
    switch (mixType) {
      case 'weekly': return 'Tracks from your most-played artists';
      case 'daily': return 'Recent plays, related tracks, and rediscoveries';
      case 'timecapsule': return 'Tracks you haven\'t played in a while';
      case 'newmusic': return 'Recently added albums';
      case 'deepcuts': return 'Hidden gems with low play counts';
      case 'workout': return 'Progressive tempo build (warmup → peak → cooldown)';
      case 'forgottenfavorites': return 'High play count but not played recently';
    }
  };

  return (
    <div className="quick-mix-settings-overlay" onClick={onClose}>
      <div className="quick-mix-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="quick-mix-settings-header">
          <div>
            <h2 className="quick-mix-settings-title">{getTitle()}</h2>
            <p className="quick-mix-settings-description">{getDescription()}</p>
          </div>
          <button className="quick-mix-settings-close" onClick={onClose} disabled={isGenerating}>×</button>
        </div>

        <div className="quick-mix-settings-content">
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

          {/* Weekly Mix Settings */}
          {mixType === 'weekly' && (
            <>
              <div className="form-group">
                <label className="form-label">Top Artists: {topArtists}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="5"
                  max="20"
                  value={topArtists}
                  onChange={(e) => setTopArtists(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Number of your most-played artists to include</p>
              </div>
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
                <p className="form-hint">Number of tracks to include from each artist</p>
              </div>
            </>
          )}

          {/* Daily Mix Settings */}
          {mixType === 'daily' && (
            <>
              <div className="form-group">
                <label className="form-label">Recent Tracks: {recentTracks}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="5"
                  max="30"
                  value={recentTracks}
                  onChange={(e) => setRecentTracks(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Tracks you've played recently</p>
              </div>
              <div className="form-group">
                <label className="form-label">Related Tracks: {relatedTracks}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="5"
                  max="30"
                  value={relatedTracks}
                  onChange={(e) => setRelatedTracks(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Tracks similar to your recent plays</p>
              </div>
              <div className="form-group">
                <label className="form-label">Rediscovery Tracks: {rediscoveryTracks}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="0"
                  max="20"
                  value={rediscoveryTracks}
                  onChange={(e) => setRediscoveryTracks(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Tracks you haven't played in a while</p>
              </div>
              <div className="form-group">
                <label className="form-label">Rediscovery Period: {rediscoveryDays} days</label>
                <input
                  type="range"
                  className="track-slider"
                  min="30"
                  max="365"
                  step="30"
                  value={rediscoveryDays}
                  onChange={(e) => setRediscoveryDays(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">How long since last played for rediscovery tracks</p>
              </div>
            </>
          )}

          {/* Time Capsule Settings */}
          {mixType === 'timecapsule' && (
            <>
              <div className="form-group">
                <label className="form-label">Track Count: {trackCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="25"
                  max="100"
                  step="5"
                  value={trackCount}
                  onChange={(e) => setTrackCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Days Ago: {daysAgo}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="180"
                  max="730"
                  step="30"
                  value={daysAgo}
                  onChange={(e) => setDaysAgo(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Find tracks not played in the last {daysAgo} days</p>
              </div>
              <div className="form-group">
                <label className="form-label">Max Per Artist: {maxPerArtist}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="1"
                  max="10"
                  value={maxPerArtist}
                  onChange={(e) => setMaxPerArtist(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Maximum tracks from the same artist</p>
              </div>
            </>
          )}

          {/* New Music Mix Settings */}
          {mixType === 'newmusic' && (
            <>
              <div className="form-group">
                <label className="form-label">Album Count: {albumCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="5"
                  max="20"
                  value={albumCount}
                  onChange={(e) => setAlbumCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Number of recently added albums to include</p>
              </div>
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
                <p className="form-hint">Number of tracks to include from each album</p>
              </div>
            </>
          )}

          {/* Deep Cuts Settings */}
          {mixType === 'deepcuts' && (
            <>
              <div className="form-group">
                <label className="form-label">Track Count: {deepCutsTrackCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="10"
                  max="200"
                  step="10"
                  value={deepCutsTrackCount}
                  onChange={(e) => setDeepCutsTrackCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Play Count: {maxPlayCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="0"
                  max="20"
                  value={maxPlayCount}
                  onChange={(e) => setMaxPlayCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Only include tracks played {maxPlayCount} times or less</p>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={excludePopular}
                    onChange={(e) => setExcludePopular(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Exclude popular tracks (from external sources)</span>
                </label>
              </div>
            </>
          )}

          {/* Workout Mix Settings */}
          {mixType === 'workout' && (
            <>
              <div className="form-group">
                <label className="form-label">Total Track Count: {workoutTrackCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="20"
                  max="100"
                  step="5"
                  value={workoutTrackCount}
                  onChange={(e) => setWorkoutTrackCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Warmup Tracks: {warmupTracks}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="0"
                  max="15"
                  value={warmupTracks}
                  onChange={(e) => setWarmupTracks(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Lower tempo/energy tracks to start</p>
              </div>
              <div className="form-group">
                <label className="form-label">Peak Tracks: {peakTracks}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="10"
                  max="80"
                  value={peakTracks}
                  onChange={(e) => setPeakTracks(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">High tempo/energy tracks for main workout</p>
              </div>
              <div className="form-group">
                <label className="form-label">Cooldown Tracks: {cooldownTracks}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="0"
                  max="15"
                  value={cooldownTracks}
                  onChange={(e) => setCooldownTracks(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Lower tempo/energy tracks to finish</p>
              </div>
            </>
          )}

          {/* Forgotten Favorites Settings */}
          {mixType === 'forgottenfavorites' && (
            <>
              <div className="form-group">
                <label className="form-label">Track Count: {forgottenTrackCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="10"
                  max="200"
                  step="10"
                  value={forgottenTrackCount}
                  onChange={(e) => setForgottenTrackCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Play Count: {minPlayCount}</label>
                <input
                  type="range"
                  className="track-slider"
                  min="5"
                  max="50"
                  value={minPlayCount}
                  onChange={(e) => setMinPlayCount(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Only include tracks played at least {minPlayCount} times</p>
              </div>
              <div className="form-group">
                <label className="form-label">Not Played In: {notPlayedDays} days</label>
                <input
                  type="range"
                  className="track-slider"
                  min="30"
                  max="730"
                  step="30"
                  value={notPlayedDays}
                  onChange={(e) => setNotPlayedDays(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <p className="form-hint">Find tracks not played in the last {notPlayedDays} days</p>
              </div>
            </>
          )}
        </div>

        <div className="quick-mix-settings-actions">
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={isGenerating || !playlistName.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Mix'}
          </button>
          {onAddToSchedule && (
            <button
              className="btn-schedule"
              onClick={() => {
                let settings: any = { playlistName };
                switch (mixType) {
                  case 'weekly':
                    settings.topArtists = topArtists;
                    settings.tracksPerArtist = tracksPerArtist;
                    break;
                  case 'daily':
                    settings.recentTracks = recentTracks;
                    settings.relatedTracks = relatedTracks;
                    settings.rediscoveryTracks = rediscoveryTracks;
                    settings.rediscoveryDays = rediscoveryDays;
                    break;
                  case 'timecapsule':
                    settings.trackCount = trackCount;
                    settings.daysAgo = daysAgo;
                    settings.maxPerArtist = maxPerArtist;
                    break;
                  case 'newmusic':
                    settings.albumCount = albumCount;
                    settings.tracksPerAlbum = tracksPerAlbum;
                    break;
                  case 'deepcuts':
                    settings.trackCount = deepCutsTrackCount;
                    settings.maxPlayCount = maxPlayCount;
                    settings.excludePopular = excludePopular;
                    break;
                  case 'workout':
                    settings.trackCount = workoutTrackCount;
                    settings.warmupTracks = warmupTracks;
                    settings.peakTracks = peakTracks;
                    settings.cooldownTracks = cooldownTracks;
                    break;
                  case 'forgottenfavorites':
                    settings.trackCount = forgottenTrackCount;
                    settings.minPlayCount = minPlayCount;
                    settings.notPlayedDays = notPlayedDays;
                    break;
                }
                onAddToSchedule(settings);
              }}
              disabled={isGenerating || !playlistName.trim()}
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
