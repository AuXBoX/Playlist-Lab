import type { FC } from 'react';
import { useState, useRef } from 'react';
import { SourceStep } from '../components/cross-import/SourceStep';
import { PlaylistStep } from '../components/cross-import/PlaylistStep';
import { TargetStep } from '../components/cross-import/TargetStep';
import { OAuthStep } from '../components/cross-import/OAuthStep';
import { MatchingStep } from '../components/cross-import/MatchingStep';
import { ReviewStep } from '../components/cross-import/ReviewStep';
import { ConfirmationStep } from '../components/cross-import/ConfirmationStep';
import { ImportHistoryTab } from '../components/cross-import/ImportHistoryTab';
import { ServiceIcon } from '../components/cross-import/ServiceIcon';
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
  isDefault?: boolean;
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
}

type ActiveTab = 'import' | 'history';

// Services that require OAuth/token
const OAUTH_REQUIRED_SOURCES = ['spotify', 'deezer', 'youtube-music', 'youtube', 'amazon', 'apple', 'tidal', 'qobuz', 'listenbrainz'];

export const CrossImportPage: FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('import');
  const [currentStep, setCurrentStep] = useState(0);
  const [importState, setImportState] = useState<ImportState>({});
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  const updateImportState = (updates: Partial<ImportState>) => {
    setImportState(prev => ({ ...prev, ...updates }));
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const startOver = () => {
    setCurrentStep(0);
    setImportState({});
  };

  const handleReconnect = async () => {
    if (!importState.source) return;
    const serviceId = importState.source.id.split(':')[0];
    setReconnectError(null);
    setReconnecting(true);

    try {
      const res = await fetch(`/api/cross-import/oauth/${serviceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to get auth URL (${res.status})`);
      const data = await res.json();

      const popup = window.open(data.authUrl, 'oauth_reconnect_popup', 'width=600,height=700,scrollbars=yes');
      if (!popup) {
        setReconnectError('Popup blocked. Please allow popups and try again.');
        setReconnecting(false);
        return;
      }
      popupRef.current = popup;

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'cross_import_oauth') {
          window.removeEventListener('message', onMessage);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          popupRef.current?.close();
          setReconnecting(false);
          if (event.data.status !== 'connected') {
            setReconnectError(`Reconnect failed: ${event.data.detail || 'unknown error'}`);
          }
        }
      };
      window.addEventListener('message', onMessage);

      pollRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          window.removeEventListener('message', onMessage);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setReconnecting(false);
        }
      }, 500);
    } catch (err: any) {
      setReconnectError(err.message || 'Failed to reconnect');
      setReconnecting(false);
    }
  };

  // Step 3 (index 3) is OAuth — only shown when target requires it and isn't connected
  const needsOAuth = importState.target && !importState.target.connected && !importState.target.id?.startsWith('plex');

  const handleSourceSelected = (source: SourceInfo) => {
    updateImportState({ source, playlist: undefined, playlistUrlOrId: undefined });
    goToStep(1);
  };

  const handlePlaylistSelected = (playlist: PlaylistInfo, urlOrId: string) => {
    updateImportState({ playlist, playlistUrlOrId: urlOrId });
    goToStep(2);
  };

  const handleTargetSelected = (target: TargetInfo, config: TargetConfig) => {
    updateImportState({ target, targetConfig: config });
    const requiresOAuth = target && !target.connected && !target.id?.startsWith('plex');
    goToStep(requiresOAuth ? 3 : 4);
  };

  const handleOAuthComplete = () => {
    // Refresh target connected status then advance
    goToStep(4);
  };

  const handleMatchingComplete = (results: MatchResult[], jobId: number, sessionId: string) => {
    updateImportState({ matchResults: results, jobId, sessionId });
    goToStep(5);
  };

  const handleReviewConfirmed = (reviewedTracks: MatchResult[]) => {
    updateImportState({ matchResults: reviewedTracks });
    goToStep(6);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <SourceStep onSourceSelected={handleSourceSelected} />;
      case 1:
        return (
          <PlaylistStep
            source={importState.source!}
            onPlaylistSelected={handlePlaylistSelected}
          />
        );
      case 2:
        return (
          <TargetStep
            onTargetSelected={handleTargetSelected}
          />
        );
      case 3:
        return needsOAuth ? (
          <OAuthStep
            target={importState.target!}
            onOAuthComplete={handleOAuthComplete}
          />
        ) : null;
      case 4:
        return (
          <MatchingStep
            source={importState.source!}
            playlistUrlOrId={importState.playlistUrlOrId!}
            target={importState.target!}
            targetConfig={importState.targetConfig!}
            onMatchingComplete={handleMatchingComplete}
          />
        );
      case 5:
        return (
          <ReviewStep
            matchResults={importState.matchResults!}
            target={importState.target!}
            targetConfig={importState.targetConfig!}
            onConfirm={handleReviewConfirmed}
          />
        );
      case 6:
        return (
          <ConfirmationStep
            jobId={importState.jobId!}
            matchResults={importState.matchResults!}
            target={importState.target!}
            targetConfig={importState.targetConfig!}
            playlistName={importState.playlist?.name || 'Imported Playlist'}
            onStartOver={startOver}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="cross-import-page">
      <div className="cross-import-header">
        <div className="cross-import-header-row">
          <h1 className="cross-import-title">Cross Import</h1>
          {importState.source && currentStep > 0 ? (
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <ServiceIcon serviceId={importState.source.id} size={120} />
            </div>
          ) : (
            <p className="cross-import-description" style={{ margin: 0 }}>
              Transfer playlists between any supported music service
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {importState.source && currentStep > 0 && OAUTH_REQUIRED_SOURCES.includes(importState.source.id.split(':')[0]) && (
              <div className="cross-import-reconnect-area">
                {reconnectError && (
                  <span className="cross-import-reconnect-error">{reconnectError}</span>
                )}
                <button
                  className="btn btn-secondary cross-import-reconnect-btn"
                  onClick={handleReconnect}
                  disabled={reconnecting}
                  title={`Reconnect ${importState.source.name}`}
                >
                  {reconnecting ? '…' : '↺ Reconnect'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cross-import-tabs">
        {currentStep > 0 && currentStep < 6 && (
          <button className="back-button tab-back-button" onClick={goBack}>
            ← Back
          </button>
        )}
        <button
          className={`cross-import-tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          Import
        </button>
        <button
          className={`cross-import-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {activeTab === 'history' ? (
        <ImportHistoryTab />
      ) : (
        <div className="cross-import-flow">
          {/* Active step */}
          <div className="step-content">
            {renderStep()}
          </div>
        </div>
      )}
    </div>
  );
};
