import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { PlexServer } from '@playlist-lab/shared';
import './SettingsPage.css';

const DEFAULT_MATCHING_SETTINGS = {
  minMatchScore: 0.8,
  stripParentheses: true,
  stripBrackets: true,
  useFirstArtistOnly: false,
  ignoreFeaturedArtists: true,
  ignoreRemixInfo: true,
  ignoreVersionInfo: false,
};

const DEFAULT_MIX_SETTINGS = {
  weeklyMix: { topArtists: 10, tracksPerArtist: 5 },
  dailyMix: { recentTracks: 20, relatedTracks: 15, rediscoveryTracks: 15, rediscoveryDays: 90 },
  timeCapsule: { trackCount: 50, daysAgo: 365, maxPerArtist: 3 },
  newMusic: { albumCount: 10, tracksPerAlbum: 3 },
};

type SettingsTab = 'plex' | 'ai' | 'matching' | 'mixes' | 'services';



export const SettingsPage: FC = () => {
  const { settings, server, apiClient, refreshSettings, setServer } = useApp();
  const location = useLocation();
  const isFirstTimeSetup = location.state?.firstTimeSetup;

  const [activeTab, setActiveTab] = useState<SettingsTab>('plex');
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [libraries, setLibraries] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [matchingSettings, setMatchingSettings] = useState({ ...DEFAULT_MATCHING_SETTINGS });

  const [mixSettings, setMixSettings] = useState({ ...DEFAULT_MIX_SETTINGS });

  useEffect(() => {
    if (settings) {
      if (settings.matchingSettings) setMatchingSettings(settings.matchingSettings);
      if (settings.mixSettings) setMixSettings(settings.mixSettings);
      setGeminiApiKey(settings.geminiApiKey || settings.grokApiKey || '');
    }
  }, [settings]);

  useEffect(() => { loadServers(); }, []);
  useEffect(() => { if (server) loadLibraries(); }, [server]);

  const clearMessages = () => { setError(null); setSuccessMessage(null); };

  const loadServers = async () => {
    setIsLoadingServers(true);
    setError(null);
    try {
      const response = await fetch('/api/servers', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load servers');
      const data = await response.json();
      const serversList = data.servers || data;
      setServers(Array.isArray(serversList) ? serversList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers');
      setServers([]);
    } finally {
      setIsLoadingServers(false);
    }
  };

  const loadLibraries = async () => {
    setIsLoadingLibraries(true);
    setError(null);
    try {
      const response = await fetch('/api/servers/libraries', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load libraries');
      const data = await response.json();
      const librariesList = data.libraries || data;
      const musicLibraries = Array.isArray(librariesList)
        ? librariesList.filter((lib: any) => lib.type === 'artist')
        : [];
      setLibraries(musicLibraries);
      if (musicLibraries.length === 0) {
        setError('No music libraries found on this server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load libraries');
      setLibraries([]);
    } finally {
      setIsLoadingLibraries(false);
    }
  };

  const handleSelectServer = async (selectedServer: PlexServer) => {
    clearMessages();
    try {
      const response = await fetch('/api/servers/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serverName: selectedServer.name,
          serverClientId: selectedServer.clientId,
          serverUrl: selectedServer.url,
          libraryId: selectedServer.libraryId || undefined,
          libraryName: selectedServer.libraryName || undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to select server');
      }
      await response.json();
      setServer({
        name: selectedServer.name,
        clientId: selectedServer.clientId,
        url: selectedServer.url,
        libraryId: selectedServer.libraryId,
        libraryName: selectedServer.libraryName,
      });
      await refreshSettings();
      await loadLibraries();
      setSuccessMessage('Server selected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select server');
    }
  };

  const handleSaveMatchingSettings = async () => {
    setIsSaving(true);
    clearMessages();
    try {
      await apiClient.updateMatchingSettings(matchingSettings);
      await refreshSettings();
      setSuccessMessage('Matching settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetMatchingSettings = async () => {
    setMatchingSettings({ ...DEFAULT_MATCHING_SETTINGS });
    setIsSaving(true);
    clearMessages();
    try {
      await apiClient.updateMatchingSettings(DEFAULT_MATCHING_SETTINGS);
      await refreshSettings();
      setSuccessMessage('Matching settings reset to defaults');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetMixSettings = async () => {
    setMixSettings({ ...DEFAULT_MIX_SETTINGS });
    setIsSaving(true);
    clearMessages();
    try {
      await apiClient.updateMixSettings(DEFAULT_MIX_SETTINGS);
      await refreshSettings();
      setSuccessMessage('Mix settings reset to defaults');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMixSettings = async () => {
    setIsSaving(true);
    clearMessages();
    try {
      await apiClient.updateMixSettings(mixSettings);
      await refreshSettings();
      setSuccessMessage('Mix settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGrokApiKey = async () => {
    setIsSaving(true);
    clearMessages();
    setGeminiTestResult(null);
    try {
      const response = await fetch('/api/settings/grok-api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ grokApiKey: geminiApiKey || null }),
      });
      if (!response.ok) throw new Error('Failed to save API key');
      await refreshSettings();
      setSuccessMessage('API key saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestGrokApiKey = async () => {
    setIsTestingGemini(true);
    setError(null);
    setGeminiTestResult(null);
    try {
      const response = await fetch('/api/import/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ grokApiKey: geminiApiKey }),
      });
      const data = await response.json();
      setGeminiTestResult(data);
    } catch (err) {
      setGeminiTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to test API key',
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; description: string }[] = [
    { id: 'plex', label: 'Plex Server', description: 'Server & library' },
    { id: 'ai', label: 'AI Features', description: 'Gemini API' },
    { id: 'matching', label: 'Matching', description: 'Track matching' },
    { id: 'mixes', label: 'Mixes', description: 'Mix generation' },
    { id: 'services', label: 'Connected Services', description: 'OAuth connections' },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        {isFirstTimeSetup && (
          <div className="settings-welcome">
            <p>
              To get started, select your Plex server and music library below.
              Playlist Lab will use this to access your music collection.
            </p>
          </div>
        )}
      </div>

      {error && <div className="settings-alert settings-alert--error">{error}</div>}
      {successMessage && <div className="settings-alert settings-alert--success">{successMessage}</div>}

      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-nav-item${activeTab === tab.id ? ' settings-nav-item--active' : ''}`}
              onClick={() => { setActiveTab(tab.id); clearMessages(); }}
            >
              <span className="settings-nav-label">{tab.label}</span>
              <span className="settings-nav-desc">{tab.description}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'plex' && (
            <PlexTab
              servers={servers}
              libraries={libraries}
              server={server}
              isLoadingServers={isLoadingServers}
              isLoadingLibraries={isLoadingLibraries}
              onSelectServer={handleSelectServer}
            />
          )}
          {activeTab === 'ai' && (
            <AITab
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              isSaving={isSaving}
              isTestingGemini={isTestingGemini}
              geminiTestResult={geminiTestResult}
              hasExistingKey={!!(settings?.grokApiKey)}
              onSave={handleSaveGrokApiKey}
              onTest={handleTestGrokApiKey}
            />
          )}
          {activeTab === 'matching' && (
            <MatchingTab
              matchingSettings={matchingSettings}
              setMatchingSettings={setMatchingSettings}
              isSaving={isSaving}
              onSave={handleSaveMatchingSettings}
              onReset={handleResetMatchingSettings}
            />
          )}
          {activeTab === 'mixes' && (
            <MixesTab
              mixSettings={mixSettings}
              setMixSettings={setMixSettings}
              isSaving={isSaving}
              onSave={handleSaveMixSettings}
              onReset={handleResetMixSettings}
            />
          )}
          {activeTab === 'services' && <ConnectedServicesTab />}
        </div>
      </div>
    </div>
  );
};

interface PlexTabProps {
  servers: PlexServer[];
  libraries: Array<{ id: string; name: string; type: string }>;
  server: PlexServer | null;
  isLoadingServers: boolean;
  isLoadingLibraries: boolean;
  onSelectServer: (server: PlexServer) => void;
}

const PlexTab: FC<PlexTabProps> = ({
  servers, libraries, server, isLoadingServers, isLoadingLibraries, onSelectServer,
}) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <h2>Plex Server</h2>
      <p>Connect Playlist Lab to your Plex Media Server and choose a music library.</p>
    </div>
    <div className="settings-field-group">
      <div className="settings-field">
        <label className="settings-label">Server</label>
        {isLoadingServers ? (
          <p className="settings-loading">Loading servers...</p>
        ) : (
          <select
            className="settings-select"
            value={server?.clientId || ''}
            onChange={(e) => {
              const selected = servers.find(s => s.clientId === e.target.value);
              if (selected) onSelectServer(selected);
            }}
          >
            <option value="">Select a server...</option>
            {servers.map(s => (
              <option key={s.clientId} value={s.clientId}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      {server && (
        <div className="settings-field">
          <label className="settings-label">Music Library</label>
          {isLoadingLibraries ? (
            <p className="settings-loading">Loading libraries...</p>
          ) : (
            <select
              className="settings-select"
              value={server.libraryId || ''}
              onChange={(e) => {
                const lib = libraries.find(l => l.id === e.target.value);
                if (lib) onSelectServer({ ...server, libraryId: lib.id, libraryName: lib.name });
              }}
            >
              <option value="">Select a library...</option>
              {libraries.map(lib => (
                <option key={lib.id} value={lib.id}>{lib.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
    {server?.libraryId && (
      <div className="settings-subsection">
        <h3>Library Scan</h3>
        <p className="settings-hint">Trigger Plex to scan for new or changed files in your library.</p>
        <LibraryScanSection />
      </div>
    )}
  </div>
);

interface AITabProps {
  geminiApiKey: string;
  setGeminiApiKey: (v: string) => void;
  isSaving: boolean;
  isTestingGemini: boolean;
  geminiTestResult: { success: boolean; message: string } | null;
  hasExistingKey: boolean;
  onSave: () => void;
  onTest: () => void;
}

const AITab: FC<AITabProps> = ({
  geminiApiKey, setGeminiApiKey, isSaving, isTestingGemini,
  geminiTestResult, hasExistingKey, onSave, onTest,
}) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <h2>AI Features</h2>
      <p>
        Playlist Lab uses Google Gemini to power AI-assisted playlist imports.{' '}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
          Get a free API key
        </a>
      </p>
    </div>
    {hasExistingKey && !geminiApiKey && (
      <div className="settings-alert settings-alert--success" style={{ marginBottom: '1.5rem' }}>
        A Gemini API key is currently configured.
      </div>
    )}
    <div className="settings-field-group">
      <div className="settings-field">
        <label className="settings-label">Gemini API Key</label>
        <input
          type="password"
          className="settings-input"
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
          placeholder="Enter your Gemini API key"
          disabled={isSaving || isTestingGemini}
        />
      </div>
    </div>
    <div className="settings-actions">
      <button className="btn btn-primary" onClick={onSave} disabled={isSaving || isTestingGemini}>
        {isSaving ? 'Saving...' : 'Save Key'}
      </button>
      <button
        className="btn btn-secondary"
        onClick={onTest}
        disabled={!geminiApiKey || isSaving || isTestingGemini}
      >
        {isTestingGemini ? 'Testing...' : 'Test Connection'}
      </button>
    </div>
    {geminiTestResult && (
      <div
        className={`settings-alert ${geminiTestResult.success ? 'settings-alert--success' : 'settings-alert--error'}`}
        style={{ marginTop: '1rem' }}
      >
        {geminiTestResult.message}
      </div>
    )}
  </div>
);

interface MatchingTabProps {
  matchingSettings: {
    minMatchScore: number;
    stripParentheses: boolean;
    stripBrackets: boolean;
    useFirstArtistOnly: boolean;
    ignoreFeaturedArtists: boolean;
    ignoreRemixInfo: boolean;
    ignoreVersionInfo: boolean;
  };
  setMatchingSettings: (s: any) => void;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

const MatchingTab: FC<MatchingTabProps> = ({ matchingSettings, setMatchingSettings, isSaving, onSave, onReset }) => {
  const toggles = [
    { key: 'stripParentheses', label: 'Strip parentheses from titles', tooltip: 'Removes text in parentheses from track titles before matching. e.g. "Song Title (Radio Edit)" → "Song Title"' },
    { key: 'stripBrackets', label: 'Strip brackets from titles', tooltip: 'Removes text in square brackets from track titles before matching. e.g. "Song Title [Remastered]" → "Song Title"' },
    { key: 'useFirstArtistOnly', label: 'Use first artist only', tooltip: 'When a track has multiple artists, only use the first one for matching. Helps with tracks listed as "Artist A, Artist B" vs "Artist A"' },
    { key: 'ignoreFeaturedArtists', label: 'Ignore featured artists', tooltip: 'Strips featured artist info before matching. e.g. "Song (feat. Artist B)" is matched as just "Song"' },
    { key: 'ignoreRemixInfo', label: 'Ignore remix info', tooltip: 'Ignores remix credits when matching. e.g. "Song (Artist B Remix)" will match against "Song"' },
    { key: 'ignoreVersionInfo', label: 'Ignore version info', tooltip: 'Ignores version labels like "Deluxe Edition", "Remastered", "Live" when matching tracks' },
  ];
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Matching</h2>
        <p>Control how Playlist Lab matches tracks when importing from external sources.</p>
      </div>
      <div className="settings-field-group">
        <div className="settings-field">
          <label className="settings-label" title="How closely a track title and artist must match to be considered the same track. Lower values accept more fuzzy matches; higher values require near-exact matches.">
            Minimum match score
            <span className="settings-value-badge">{matchingSettings.minMatchScore}</span>
          </label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={matchingSettings.minMatchScore}
            onChange={(e) => setMatchingSettings({ ...matchingSettings, minMatchScore: parseFloat(e.target.value) })}
            className="settings-range"
            title="How closely a track title and artist must match to be considered the same track. Lower = more lenient, Higher = stricter"
          />
          <div className="settings-range-labels">
            <span>Loose</span>
            <span>Strict</span>
          </div>
        </div>
        <div className="settings-field">
          <label className="settings-label" title="These options normalise track titles before comparing them, improving match rates for tracks with extra info in their names">Title normalisation</label>
          <div className="settings-toggles">
            {toggles.map(({ key, label, tooltip }) => (
              <label key={key} className="settings-toggle" title={tooltip}>
                <input
                  type="checkbox"
                  checked={matchingSettings[key as keyof typeof matchingSettings] as boolean}
                  onChange={(e) => setMatchingSettings({ ...matchingSettings, [key]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="settings-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-secondary" onClick={onReset} disabled={isSaving}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

interface MixesTabProps {
  mixSettings: {
    weeklyMix: { topArtists: number; tracksPerArtist: number };
    dailyMix: { recentTracks: number; relatedTracks: number; rediscoveryTracks: number; rediscoveryDays: number };
    timeCapsule: { trackCount: number; daysAgo: number; maxPerArtist: number };
    newMusic: { albumCount: number; tracksPerAlbum: number };
  };
  setMixSettings: (s: any) => void;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

const MixesTab: FC<MixesTabProps> = ({ mixSettings, setMixSettings, isSaving, onSave, onReset }) => {
  const SliderField = ({
    label, value, min, max, step = 1, onChange, title,
  }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; title?: string }) => (
    <div className="settings-slider-row" title={title}>
      <div className="settings-slider-label">
        <span>{label}</span>
        <span className="settings-value-badge">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="settings-range"
      />
    </div>
  );
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Mixes</h2>
        <p>Tune how each mix type is generated.</p>
      </div>
      <div className="settings-mix-grid">
        <div className="settings-mix-card">
          <h3 title="A weekly playlist built from your most-played artists">Weekly Mix</h3>
          <SliderField label="Top artists" value={mixSettings.weeklyMix.topArtists} min={5} max={20}
            title="How many of your top-played artists to pull tracks from"
            onChange={(v) => setMixSettings({ ...mixSettings, weeklyMix: { ...mixSettings.weeklyMix, topArtists: v } })} />
          <SliderField label="Tracks per artist" value={mixSettings.weeklyMix.tracksPerArtist} min={1} max={10}
            title="How many tracks to include per artist in the weekly mix"
            onChange={(v) => setMixSettings({ ...mixSettings, weeklyMix: { ...mixSettings.weeklyMix, tracksPerArtist: v } })} />
        </div>
        <div className="settings-mix-card">
          <h3 title="A daily playlist mixing your recent listens with related and rediscovered tracks">Daily Mix</h3>
          <SliderField label="Recent tracks" value={mixSettings.dailyMix.recentTracks} min={5} max={20}
            title="Number of tracks pulled from your recent listening history"
            onChange={(v) => setMixSettings({ ...mixSettings, dailyMix: { ...mixSettings.dailyMix, recentTracks: v } })} />
          <SliderField label="Related tracks" value={mixSettings.dailyMix.relatedTracks} min={5} max={20}
            title="Number of tracks from artists related to your recent listens"
            onChange={(v) => setMixSettings({ ...mixSettings, dailyMix: { ...mixSettings.dailyMix, relatedTracks: v } })} />
          <SliderField label="Rediscovery tracks" value={mixSettings.dailyMix.rediscoveryTracks} min={0} max={15}
            title="Number of tracks from your library that you haven't played in a while"
            onChange={(v) => setMixSettings({ ...mixSettings, dailyMix: { ...mixSettings.dailyMix, rediscoveryTracks: v } })} />
        </div>
        <div className="settings-mix-card">
          <h3 title="A nostalgic playlist of tracks you loved but haven't played in a long time">Time Capsule</h3>
          <SliderField label="Track count" value={mixSettings.timeCapsule.trackCount} min={25} max={100} step={5}
            title="Total number of tracks in the Time Capsule mix"
            onChange={(v) => setMixSettings({ ...mixSettings, timeCapsule: { ...mixSettings.timeCapsule, trackCount: v } })} />
          <SliderField label="Days ago" value={mixSettings.timeCapsule.daysAgo} min={180} max={730} step={30}
            title="How far back to look for tracks you haven't played recently (in days)"
            onChange={(v) => setMixSettings({ ...mixSettings, timeCapsule: { ...mixSettings.timeCapsule, daysAgo: v } })} />
        </div>
        <div className="settings-mix-card">
          <h3 title="A playlist of recently added albums you haven't fully explored yet">New Music</h3>
          <SliderField label="Album count" value={mixSettings.newMusic.albumCount} min={5} max={20}
            title="How many recently added albums to sample tracks from"
            onChange={(v) => setMixSettings({ ...mixSettings, newMusic: { ...mixSettings.newMusic, albumCount: v } })} />
          <SliderField label="Tracks per album" value={mixSettings.newMusic.tracksPerAlbum} min={1} max={10}
            title="How many tracks to include from each new album"
            onChange={(v) => setMixSettings({ ...mixSettings, newMusic: { ...mixSettings.newMusic, tracksPerAlbum: v } })} />
        </div>
      </div>
      <div className="settings-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-secondary" onClick={onReset} disabled={isSaving}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

interface ConnectedTarget {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  requiresOAuth?: boolean;
}

const ConnectedServicesTab: FC = () => {
  const [targets, setTargets] = useState<ConnectedTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTargets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cross-import/targets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load connected services');
      const data = await res.json();
      // Only show external OAuth services (not Plex)
      const oauthTargets = (data.targets || []).filter((t: ConnectedTarget) => t.requiresOAuth);
      setTargets(oauthTargets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadTargets(); }, []);

  const handleRevoke = async (serviceId: string, serviceName: string) => {
    setRevoking(serviceId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cross-import/oauth/${serviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to revoke ${serviceName} connection`);
      setMessage(`${serviceName} connection revoked`);
      await loadTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke connection');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Connected Services</h2>
        <p>Manage OAuth connections for external streaming services used in Cross Import.</p>
      </div>
      {message && <div className="settings-alert settings-alert--success">{message}</div>}
      {error && <div className="settings-alert settings-alert--error">{error}</div>}
      {isLoading ? (
        <p className="settings-loading">Loading services...</p>
      ) : targets.length === 0 ? (
        <p className="settings-hint">No external services available. Use Cross Import to connect services.</p>
      ) : (
        <div className="settings-services-list">
          {targets.map((target) => (
            <div key={target.id} className="settings-service-row">
              <div className="settings-service-info">
                <span className="settings-service-name">{target.name}</span>
                <span className={`settings-service-status ${target.connected ? 'settings-service-status--connected' : 'settings-service-status--disconnected'}`}>
                  {target.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {target.connected && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRevoke(target.id, target.name)}
                  disabled={revoking === target.id}
                >
                  {revoking === target.id ? 'Revoking...' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LibraryScanSection: FC = () => {
  const [folders, setFolders] = useState<Array<{ path: string; accessible: boolean }>>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => { loadFolders(); }, []);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const response = await fetch('/api/servers/library-folders', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load library folders');
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleScan = async (path?: string) => {
    setIsScanning(true);
    setScanMessage(null);
    setScanError(null);
    try {
      const response = await fetch('/api/servers/scan-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path }),
      });
      if (!response.ok) throw new Error('Failed to trigger library scan');
      const data = await response.json();
      setScanMessage(data.message);
      setTimeout(() => setScanMessage(null), 5000);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan library');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="settings-scan">
      {scanMessage && <div className="settings-alert settings-alert--success">{scanMessage}</div>}
      {scanError && <div className="settings-alert settings-alert--error">{scanError}</div>}
      <button className="btn btn-secondary" onClick={() => handleScan()} disabled={isScanning}>
        {isScanning ? 'Scanning...' : 'Scan Entire Library'}
      </button>
      <div className="settings-scan-folder">
        <label className="settings-label">Scan specific folder</label>
        {isLoadingFolders ? (
          <p className="settings-loading">Loading folders...</p>
        ) : folders.length > 0 && (
          <div className="settings-folder-list">
            {folders.map((folder, i) => (
              <span key={i} className="settings-folder-path">{folder.path}</span>
            ))}
          </div>
        )}
        <input
          type="text"
          className="settings-input settings-input--mono"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
          placeholder="/music/Artist or C:\Music\Artist"
        />
        <button
          className="btn btn-secondary"
          onClick={() => handleScan(selectedFolder)}
          disabled={isScanning || !selectedFolder}
        >
          {isScanning ? 'Scanning...' : 'Scan Folder'}
        </button>
      </div>
    </div>
  );
};
