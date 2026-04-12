import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import { PlaylistStep } from '../components/cross-import/PlaylistStep';
import { MatchingStep } from '../components/cross-import/MatchingStep';
import { ReviewStep } from '../components/cross-import/ReviewStep';
import { ConfirmationStep } from '../components/cross-import/ConfirmationStep';
import type { MatchResult } from '../components/cross-import/types';
import './CrossImportPage.css';

export interface SourceInfo {
  id: string;
  name: string;
  icon: string;
  isSourceOnly: boolean;
  connected: boolean;
  type: 'plex-server' | 'plex-home-user' | 'external';
}

export interface TargetInfo {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  requiresOAuth?: boolean;
  configured?: boolean;
  libraries?: Array<{ id: string; name: string }>;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  trackCount: number;
  durationMs?: number;
  coverUrl?: string;
}

export interface TargetConfig {
  serverUrl?: string;
  libraryId?: string;
  plexToken?: string;
  accessToken?: string;
}

export interface ImportState {
  source?: SourceInfo;
  playlist?: PlaylistInfo;
  playlistUrlOrId?: string;
  target?: TargetInfo;
  targetConfig?: TargetConfig;
  sessionId?: string;
  matchResults?: MatchResult[];
  jobId?: number;
  allowLive?: boolean;
  allowStatic?: boolean;
}

export const CrossImportPage: FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [importState, setImportState] = useState<ImportState>({});
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentials, setCredentials] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: `${window.location.protocol}//${window.location.hostname}:3001/api/cross-import/oauth/youtube/callback`
  });
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  // Hardcoded source (first Plex server) and target (YouTube)
  const [plexSource, setPlexSource] = useState<SourceInfo | null>(null);
  const youtubeTarget: TargetInfo = {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    connected: youtubeConnected,
    requiresOAuth: true,
    configured: true,
  };

  // Check YouTube connection status on mount
  useEffect(() => {
    checkYouTubeConnection();
    fetchPlexSource();
  }, []);

  // Auto-advance to playlist selection if YouTube is already connected
  useEffect(() => {
    if (!checkingConnection && youtubeConnected && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [checkingConnection, youtubeConnected, currentStep]);

  const checkYouTubeConnection = async () => {
    try {
      const res = await fetch('/api/cross-import/targets', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const youtube = data.targets.find((t: any) => t.id === 'youtube');
        setYoutubeConnected(youtube?.connected || false);
      }
    } catch (err) {
      console.error('Failed to check YouTube connection:', err);
    } finally {
      setCheckingConnection(false);
    }
  };

  const fetchPlexSource = async () => {
    try {
      const res = await fetch('/api/cross-import/sources', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Get first Plex server
        const firstPlex = data.sources.find((s: any) => s.type === 'plex-server');
        if (firstPlex) {
          setPlexSource(firstPlex);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Plex sources:', err);
    }
  };

  const handleSaveCredentials = async () => {
    setSavingCredentials(true);
    try {
      const res = await fetch('/api/youtube-config/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save credentials');
      }

      alert('✅ Credentials saved! Please restart the Playlist Lab server for changes to take effect.');
      setShowSetupGuide(false);
    } catch (err: any) {
      alert('❌ Error: ' + (err.message || 'Failed to save credentials'));
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleConnectYouTube = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/cross-import/oauth/youtube', { credentials: 'include' });
      
      // Check if OAuth is not configured
      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = { error: 'Unknown error' };
        }
        
        console.log('[CrossImportPage] OAuth error response:', errorData);
        
        // Check for "not configured" error
        const errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
        if (errorMessage && (
          errorMessage.includes('not configured') || 
          errorMessage.includes('YOUTUBE_CLIENT_ID')
        )) {
          console.log('[CrossImportPage] Showing setup guide');
          setConnecting(false);
          setShowSetupGuide(true);
          return;
        }
        throw new Error(errorMessage || `Failed to get auth URL (${res.status})`);
      }
      
      const data = await res.json();

      const popup = window.open(data.authUrl, 'youtube_auth_popup', 'width=600,height=700,scrollbars=yes');
      if (!popup) {
        alert('Popup blocked. Please allow popups and try again.');
        setConnecting(false);
        return;
      }
      popupRef.current = popup;

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'cross_import_oauth' && event.data.service === 'youtube') {
          window.removeEventListener('message', onMessage);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          popupRef.current?.close();
          setConnecting(false);
          if (event.data.status === 'connected') {
            setYoutubeConnected(true);
            setCurrentStep(1); // Move to playlist selection
          } else {
            alert(`Connection failed: ${event.data.detail || 'unknown error'}`);
          }
        }
      };
      window.addEventListener('message', onMessage);

      pollRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          window.removeEventListener('message', onMessage);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setConnecting(false);
          
          // Popup closed - check connection status as fallback
          setTimeout(() => {
            checkYouTubeConnection();
          }, 500);
        }
      }, 500);
    } catch (err: any) {
      alert(err.message || 'Failed to connect to YouTube');
      setConnecting(false);
    }
  };

  const updateImportState = (updates: Partial<ImportState>) => {
    setImportState(prev => ({ ...prev, ...updates }));
  };

  const handlePlaylistSelected = (playlist: PlaylistInfo, urlOrId: string, allowLive: boolean, allowStatic: boolean) => {
    updateImportState({ 
      source: plexSource!,
      playlist, 
      playlistUrlOrId: urlOrId,
      target: youtubeTarget,
      targetConfig: {},
      allowLive,
      allowStatic,
    });
    setCurrentStep(2); // Move to matching
  };

  const handleMatchingComplete = (results: MatchResult[], jobId: number, sessionId: string) => {
    updateImportState({ matchResults: results, jobId, sessionId });
    setCurrentStep(3); // Move to review
  };

  const handleReviewConfirmed = (reviewedTracks: MatchResult[]) => {
    updateImportState({ matchResults: reviewedTracks });
    setCurrentStep(4); // Move to confirmation
  };

  const startOver = () => {
    setCurrentStep(youtubeConnected ? 1 : 0);
    setImportState({});
  };

  const renderStep = () => {
    // Step 0: YouTube connection (if not connected)
    if (currentStep === 0) {
      return (
        <div className="youtube-connect-container">
          <h2 className="step-section-title">Connect to YouTube</h2>
          <p style={{ marginBottom: '1.5rem', color: '#888' }}>
            Connect your YouTube account to export Plex playlists to YouTube.
          </p>
          {checkingConnection ? (
            <p>Checking connection...</p>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleConnectYouTube}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Connect YouTube'}
            </button>
          )}
          
          {/* Setup Guide Modal */}
          {showSetupGuide && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}>
              <div style={{
                background: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '32px',
                maxWidth: '700px',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative'
              }}>
                <button
                  onClick={() => setShowSetupGuide(false)}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'transparent',
                    border: 'none',
                    color: '#888',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  ×
                </button>
                
                <h2 style={{ marginBottom: '16px', fontSize: '24px' }}>YouTube OAuth Setup Required</h2>
                
                <p style={{ color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>
                  To export playlists to YouTube, you need to set up OAuth credentials from Google Cloud Console. 
                  This is a one-time setup that takes about 10 minutes.
                </p>
                
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#6c63ff' }}>Step 1: Create Google Cloud Project</h3>
                  <ol style={{ paddingLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
                    <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff' }}>Google Cloud Console</a></li>
                    <li>Click "Select a project" → "New Project"</li>
                    <li>Name it "Playlist Lab" and click "Create"</li>
                  </ol>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#6c63ff' }}>Step 2: Enable YouTube Data API v3</h3>
                  <ol style={{ paddingLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
                    <li>Go to "APIs & Services" → "Library"</li>
                    <li>Search for "YouTube Data API v3"</li>
                    <li>Click on it and click "Enable"</li>
                  </ol>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#6c63ff' }}>Step 3: Configure OAuth Consent Screen</h3>
                  <ol style={{ paddingLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
                    <li>Go to "APIs & Services" → "OAuth consent screen"</li>
                    <li>Select "External" and click "Create"</li>
                    <li>Fill in app name and your email</li>
                    <li>Add your email as a test user</li>
                    <li>Click "Save and Continue" through all steps</li>
                  </ol>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#6c63ff' }}>Step 4: Create OAuth Credentials</h3>
                  <ol style={{ paddingLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
                    <li>Go to "APIs & Services" → "Credentials"</li>
                    <li>Click "Create Credentials" → "OAuth client ID"</li>
                    <li>Select "Web application"</li>
                    <li>Add this redirect URI:</li>
                  </ol>
                  <div style={{
                    background: '#111',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    padding: '12px',
                    marginTop: '8px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#4caf50',
                    wordBreak: 'break-all'
                  }}>
                    {window.location.protocol}//{window.location.hostname}:3001/api/cross-import/oauth/youtube/callback
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.protocol}//${window.location.hostname}:3001/api/cross-import/oauth/youtube/callback`);
                      alert('Copied to clipboard!');
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: '#333',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#ccc',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  <ol start={5} style={{ paddingLeft: '20px', color: '#ccc', lineHeight: '1.8', marginTop: '12px' }}>
                    <li>Click "Create" and copy your Client ID and Client Secret</li>
                  </ol>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#6c63ff' }}>Step 5: Paste Your Credentials Here</h3>
                  <p style={{ color: '#888', marginBottom: '12px', fontSize: '14px' }}>
                    After completing steps 1-4 above, paste your credentials here and click Save. No need to manually edit files!
                  </p>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#ccc' }}>
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={credentials.clientId}
                      onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      placeholder="xxxxx.apps.googleusercontent.com"
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: '#111',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#ccc' }}>
                      Client Secret
                    </label>
                    <input
                      type="text"
                      value={credentials.clientSecret}
                      onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                      placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxx"
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: '#111',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#ccc' }}>
                      Redirect URI (auto-filled)
                    </label>
                    <input
                      type="text"
                      value={credentials.redirectUri}
                      readOnly
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        color: '#888',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                  
                  <button
                    onClick={handleSaveCredentials}
                    disabled={savingCredentials || !credentials.clientId || !credentials.clientSecret}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: credentials.clientId && credentials.clientSecret ? '#4caf50' : '#444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: credentials.clientId && credentials.clientSecret ? 'pointer' : 'not-allowed',
                      marginBottom: '12px'
                    }}
                  >
                    {savingCredentials ? 'Saving...' : '💾 Save Credentials'}
                  </button>
                </div>
                
                <div style={{
                  background: '#1a2332',
                  border: '1px solid #2d4a6e',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <p style={{ color: '#6c9bd1', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                    <strong>💡 Tip:</strong> For detailed instructions with screenshots, see the full setup guide in <code style={{ background: '#111', padding: '2px 6px', borderRadius: '3px' }}>docs/YOUTUBE_OAUTH_SETUP.md</code>
                  </p>
                </div>
                
                <button
                  onClick={() => setShowSetupGuide(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Got it!
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Step 1: Playlist selection
    if (currentStep === 1) {
      if (!plexSource) {
        return (
          <div className="loading-container">
            <div className="loading-spinner" />
            <span className="loading-text">Loading Plex servers...</span>
          </div>
        );
      }
      return (
        <PlaylistStep
          source={plexSource}
          onPlaylistSelected={handlePlaylistSelected}
          allowLive={importState.allowLive}
          allowStatic={importState.allowStatic}
        />
      );
    }

    // Step 2: Matching
    if (currentStep === 2) {
      if (!importState.source || !importState.playlistUrlOrId) {
        return <div className="error-message">Missing playlist information</div>;
      }
      return (
        <MatchingStep
          source={importState.source}
          playlistUrlOrId={importState.playlistUrlOrId}
          target={youtubeTarget}
          targetConfig={importState.targetConfig!}
          onMatchingComplete={handleMatchingComplete}
          allowLive={importState.allowLive}
          allowStatic={importState.allowStatic}
        />
      );
    }

    // Step 3: Review
    if (currentStep === 3) {
      if (!importState.matchResults) {
        return <div className="error-message">Missing match results</div>;
      }
      // Debug: Log first few match results to check targetTitle
      console.log('[CrossImportPage] Match results sample:', importState.matchResults.slice(0, 3).map(r => ({
        sourceTitle: r.sourceTrack.title,
        targetTitle: r.targetTitle,
        matched: r.matched
      })));
      return (
        <ReviewStep
          matchResults={importState.matchResults}
          target={youtubeTarget}
          targetConfig={importState.targetConfig!}
          onConfirm={handleReviewConfirmed}
        />
      );
    }

    // Step 4: Confirmation
    if (currentStep === 4) {
      if (!importState.matchResults) {
        return <div className="error-message">Missing match results</div>;
      }
      return (
        <ConfirmationStep
          jobId={importState.jobId!}
          matchResults={importState.matchResults}
          target={youtubeTarget}
          targetConfig={importState.targetConfig!}
          playlistName={importState.playlist?.name || 'Imported Playlist'}
          onStartOver={startOver}
        />
      );
    }

    return null;
  };

  return (
    <div className="cross-import-page" style={{ paddingBottom: 0, marginBottom: 0 }}>
      <div className="cross-import-header">
        <h1 className="cross-import-title">Export to YouTube</h1>
        <p className="cross-import-description">
          Export your Plex playlists to YouTube
        </p>
      </div>

      <div className="cross-import-flow" style={{ marginBottom: 0, paddingBottom: 0 }}>
        {currentStep > 0 && currentStep < 4 && (
          <button 
            className="back-button" 
            onClick={() => {
              // From review step (3), go back to playlist selection (1), not matching (2)
              if (currentStep === 3) {
                setCurrentStep(1);
              } else {
                setCurrentStep(prev => Math.max(0, prev - 1));
              }
            }}
            style={{ marginBottom: '1rem' }}
          >
            ← Back
          </button>
        )}
        <div className="step-content" style={{ marginBottom: 0, paddingBottom: 0 }}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
};
