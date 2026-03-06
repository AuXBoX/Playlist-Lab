import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './BackupRestorePage.css';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  duration: number;
  composite?: string;
}

interface BackupPlaylist {
  title: string;
  tracks: { title: string; artist: string; album?: string }[];
  backupDate: string;
}

interface BackupData {
  version: 1;
  exportDate: string;
  serverName: string;
  playlists: BackupPlaylist[];
}

export const BackupRestorePage: FC = () => {
  const { apiClient } = useApp();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Restore state
  const [restoreData, setRestoreData] = useState<BackupData | null>(null);
  const [selectedRestorePlaylists, setSelectedRestorePlaylists] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load playlists');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlaylist = (id: string) => {
    setSelectedPlaylists(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedPlaylists(new Set(playlists.map(p => p.id)));
  const selectNone = () => setSelectedPlaylists(new Set());

  const handleBackup = async () => {
    if (selectedPlaylists.size === 0) return;
    
    setIsProcessing(true);
    setStatusMessage('Creating backup...');
    setError(null);
    
    try {
      const backupPlaylists: BackupPlaylist[] = [];
      const selectedArray = Array.from(selectedPlaylists);
      
      for (let i = 0; i < selectedArray.length; i++) {
        const playlistId = selectedArray[i];
        const playlist = playlists.find(p => p.id === playlistId);
        if (!playlist) continue;
        
        setStatusMessage(`Backing up "${playlist.name}" (${i + 1}/${selectedArray.length})...`);
        
        // Get playlist tracks
        const response = await apiClient.getPlaylistTracks(playlistId);
        const tracks = response.tracks || [];
        
        backupPlaylists.push({
          title: playlist.name,
          tracks: tracks.map((t: any) => ({
            title: t.title,
            artist: t.artist || t.grandparentTitle || 'Unknown',
            album: t.album || t.parentTitle,
          })),
          backupDate: new Date().toISOString(),
        });
      }
      
      const backupData: BackupData = {
        version: 1,
        exportDate: new Date().toISOString(),
        serverName: 'Plex Server',
        playlists: backupPlaylists,
      };
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plex-playlists-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatusMessage(`Backup complete! ${backupPlaylists.length} playlist(s) exported.`);
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to create backup');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as BackupData;
        if (data.version !== 1 || !data.playlists) {
          setError('Invalid backup file format');
          return;
        }
        setRestoreData(data);
        setSelectedRestorePlaylists(new Set(data.playlists.map((_, i) => i)));
        setError(null);
      } catch {
        setError('Failed to parse backup file');
      }
    };
    reader.readAsText(file);
  };

  const toggleRestorePlaylist = (index: number) => {
    setSelectedRestorePlaylists(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleRestore = async () => {
    if (!restoreData || selectedRestorePlaylists.size === 0) return;
    
    setIsProcessing(true);
    setError(null);
    let restoredCount = 0;
    let failedCount = 0;
    
    const selectedArray = Array.from(selectedRestorePlaylists);
    
    for (let i = 0; i < selectedArray.length; i++) {
      const playlistIndex = selectedArray[i];
      const playlist = restoreData.playlists[playlistIndex];
      
      setStatusMessage(`Restoring "${playlist.title}" (${i + 1}/${selectedArray.length})...`);
      
      try {
        // This would need backend support to search and match tracks
        // For now, show a message that this feature needs implementation
        setError('Restore functionality requires backend API support. Please implement the restore endpoint.');
        break;
      } catch (err) {
        console.error(`Failed to restore ${playlist.title}:`, err);
        failedCount++;
      }
    }
    
    if (!error) {
      setStatusMessage(`Restore complete! ${restoredCount} restored, ${failedCount} failed.`);
      setRestoreData(null);
      setSelectedRestorePlaylists(new Set());
      loadPlaylists();
    }
    
    setIsProcessing(false);
    setTimeout(() => setStatusMessage(''), 5000);
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <h1>Backup & Restore</h1>
        <div className="loading">Loading playlists...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Backup & Restore</h1>
      <p className="page-description">
        Backup your playlists to a JSON file or restore them from a previous backup.
      </p>

      {statusMessage && <div className="status-message">{statusMessage}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Restore Section */}
      {restoreData ? (
        <div className="backup-card">
          <h2>Restore from Backup</h2>
          <p className="backup-meta">
            Backup from {new Date(restoreData.exportDate).toLocaleDateString()} • {restoreData.playlists.length} playlist(s)
          </p>
          
          <div className="backup-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedRestorePlaylists(new Set(restoreData.playlists.map((_, i) => i)))}
            >
              Select All
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedRestorePlaylists(new Set())}
            >
              Select None
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setRestoreData(null)}
            >
              Cancel
            </button>
          </div>
          
          <div className="backup-list">
            {restoreData.playlists.map((playlist, index) => (
              <label key={index} className="backup-item">
                <input
                  type="checkbox"
                  checked={selectedRestorePlaylists.has(index)}
                  onChange={() => toggleRestorePlaylist(index)}
                />
                <div className="backup-item-info">
                  <span className="backup-item-name">{playlist.title}</span>
                  <span className="backup-item-meta">{playlist.tracks.length} tracks</span>
                </div>
              </label>
            ))}
          </div>
          
          <button
            className="btn btn-primary btn-full"
            onClick={handleRestore}
            disabled={selectedRestorePlaylists.size === 0 || isProcessing}
          >
            {isProcessing ? 'Restoring...' : `Restore ${selectedRestorePlaylists.size} Playlist(s)`}
          </button>
        </div>
      ) : (
        <div className="backup-card">
          <h2>Restore from Backup</h2>
          <p className="backup-description">
            Select a backup file to restore playlists
          </p>
          <label className="btn btn-secondary file-input-label">
            📁 Select Backup File
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="file-input"
            />
          </label>
        </div>
      )}

      {/* Backup Section */}
      <div className="backup-card">
        <h2>Backup Playlists</h2>
        <p className="backup-description">
          Select playlists to backup. The backup file can be used to restore playlists later.
        </p>
        
        <div className="backup-actions">
          <button className="btn btn-secondary btn-sm" onClick={selectAll}>Select All</button>
          <button className="btn btn-secondary btn-sm" onClick={selectNone}>Select None</button>
          <span className="backup-count">{selectedPlaylists.size} selected</span>
        </div>
        
        {playlists.length === 0 ? (
          <p className="empty-state">No playlists found</p>
        ) : (
          <div className="backup-list">
            {playlists.map(playlist => (
              <label key={playlist.id} className="backup-item">
                <input
                  type="checkbox"
                  checked={selectedPlaylists.has(playlist.id)}
                  onChange={() => togglePlaylist(playlist.id)}
                />
                <div className="backup-item-info">
                  <span className="backup-item-name">{playlist.name}</span>
                  <span className="backup-item-meta">
                    {playlist.trackCount} tracks • {formatDuration(playlist.duration)}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
        
        <button
          className="btn btn-primary btn-full"
          onClick={handleBackup}
          disabled={selectedPlaylists.size === 0 || isProcessing}
        >
          {isProcessing ? 'Creating Backup...' : `Backup ${selectedPlaylists.size} Playlist(s)`}
        </button>
      </div>
    </div>
  );
};
