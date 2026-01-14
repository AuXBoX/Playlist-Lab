/**
 * Backup & Restore Page - Backup and restore Plex playlists
 */

import { useState, useEffect } from 'react';

interface BackupRestorePageProps {
  serverUrl: string;
  onBack: () => void;
}

interface PlexPlaylist {
  ratingKey: string;
  title: string;
  leafCount: number;
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

export default function BackupRestorePage({ serverUrl, onBack }: BackupRestorePageProps) {
  const [playlists, setPlaylists] = useState<PlexPlaylist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Restore state
  const [restoreData, setRestoreData] = useState<BackupData | null>(null);
  const [selectedRestorePlaylists, setSelectedRestorePlaylists] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setIsLoading(true);
    try {
      const data = await window.api.getPlaylists({ serverUrl, includeSmart: true });
      setPlaylists(data || []);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlaylist = (ratingKey: string) => {
    setSelectedPlaylists(prev => {
      const next = new Set(prev);
      if (next.has(ratingKey)) {
        next.delete(ratingKey);
      } else {
        next.add(ratingKey);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedPlaylists(new Set(playlists.map(p => p.ratingKey)));
  const selectNone = () => setSelectedPlaylists(new Set());

  const handleBackup = async () => {
    if (selectedPlaylists.size === 0) return;
    
    setIsProcessing(true);
    setStatusMessage('Creating backup...');
    
    try {
      const backupPlaylists: BackupPlaylist[] = [];
      const selectedArray = Array.from(selectedPlaylists);
      
      for (let i = 0; i < selectedArray.length; i++) {
        const ratingKey = selectedArray[i];
        const playlist = playlists.find(p => p.ratingKey === ratingKey);
        if (!playlist) continue;
        
        setStatusMessage(`Backing up "${playlist.title}" (${i + 1}/${selectedArray.length})...`);
        
        // Get playlist tracks
        const tracks = await window.api.getPlaylistTracks({ serverUrl, playlistId: ratingKey });
        
        backupPlaylists.push({
          title: playlist.title,
          tracks: tracks.map((t: any) => ({
            title: t.title,
            artist: t.grandparentTitle || t.originalTitle || 'Unknown',
            album: t.parentTitle,
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
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
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
          setStatusMessage('Invalid backup file format');
          return;
        }
        setRestoreData(data);
        setSelectedRestorePlaylists(new Set(data.playlists.map((_, i) => i)));
      } catch {
        setStatusMessage('Failed to parse backup file');
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
    let restoredCount = 0;
    let failedCount = 0;
    
    const selectedArray = Array.from(selectedRestorePlaylists);
    
    for (let i = 0; i < selectedArray.length; i++) {
      const playlistIndex = selectedArray[i];
      const playlist = restoreData.playlists[playlistIndex];
      
      setStatusMessage(`Restoring "${playlist.title}" (${i + 1}/${selectedArray.length})...`);
      
      try {
        // Search for each track and collect rating keys
        const trackKeys: string[] = [];
        
        for (const track of playlist.tracks) {
          const query = `${track.artist} ${track.title}`;
          const results = await window.api.searchTrack({ serverUrl, query });
          
          if (results.length > 0) {
            // Find best match
            const match = results.find((r: any) => 
              r.title?.toLowerCase() === track.title.toLowerCase() ||
              r.title?.toLowerCase().includes(track.title.toLowerCase())
            ) || results[0];
            
            if (match?.ratingKey && !trackKeys.includes(match.ratingKey)) {
              trackKeys.push(match.ratingKey);
            }
          }
        }
        
        if (trackKeys.length > 0) {
          await window.api.createPlaylist({
            serverUrl,
            title: playlist.title,
            trackKeys,
          });
          restoredCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to restore ${playlist.title}:`, error);
        failedCount++;
      }
    }
    
    setStatusMessage(`Restore complete! ${restoredCount} restored, ${failedCount} failed.`);
    setRestoreData(null);
    setSelectedRestorePlaylists(new Set());
    loadPlaylists();
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
      <div className="page-content">
        <div className="page-header">
          <button className="btn btn-secondary btn-small" onClick={onBack}>← Back</button>
          <h1>Backup & Restore</h1>
        </div>
        <div className="loading">Loading playlists...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <button className="btn btn-secondary btn-small" onClick={onBack}>← Back</button>
        <h1>Backup & Restore</h1>
      </div>
      
      {statusMessage && <div className="status-message">{statusMessage}</div>}
      
      {/* Restore Section */}
      {restoreData ? (
        <div className="card">
          <div className="card-title">Restore from Backup</div>
          <p style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '12px' }}>
            Backup from {new Date(restoreData.exportDate).toLocaleDateString()} • {restoreData.playlists.length} playlist(s)
          </p>
          
          <div className="backup-actions">
            <button className="btn btn-secondary btn-small" onClick={() => setSelectedRestorePlaylists(new Set(restoreData.playlists.map((_, i) => i)))}>Select All</button>
            <button className="btn btn-secondary btn-small" onClick={() => setSelectedRestorePlaylists(new Set())}>Select None</button>
            <button className="btn btn-secondary btn-small" onClick={() => setRestoreData(null)}>Cancel</button>
          </div>
          
          <div className="playlist-backup-list">
            {restoreData.playlists.map((playlist, index) => (
              <label key={index} className="playlist-backup-item">
                <input
                  type="checkbox"
                  checked={selectedRestorePlaylists.has(index)}
                  onChange={() => toggleRestorePlaylist(index)}
                />
                <div className="playlist-backup-info">
                  <span className="playlist-name">{playlist.title}</span>
                  <span className="playlist-meta">{playlist.tracks.length} tracks</span>
                </div>
              </label>
            ))}
          </div>
          
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={handleRestore}
            disabled={selectedRestorePlaylists.size === 0 || isProcessing}
          >
            {isProcessing ? 'Restoring...' : `Restore ${selectedRestorePlaylists.size} Playlist(s)`}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Restore from Backup</div>
          <p style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '12px' }}>
            Select a backup file to restore playlists
          </p>
          <label className="btn btn-secondary" style={{ display: 'inline-block', cursor: 'pointer' }}>
            📂 Select Backup File
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}
      
      {/* Backup Section */}
      <div className="card">
        <div className="card-title">Backup Playlists</div>
        <p style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '12px' }}>
          Select playlists to backup. The backup file can be used to restore playlists later.
        </p>
        
        <div className="backup-actions">
          <button className="btn btn-secondary btn-small" onClick={selectAll}>Select All</button>
          <button className="btn btn-secondary btn-small" onClick={selectNone}>Select None</button>
          <span style={{ color: '#a0a0a0', fontSize: '13px' }}>{selectedPlaylists.size} selected</span>
        </div>
        
        {playlists.length === 0 ? (
          <p className="empty-state">No playlists found</p>
        ) : (
          <div className="playlist-backup-list">
            {playlists.map(playlist => (
              <label key={playlist.ratingKey} className="playlist-backup-item">
                <input
                  type="checkbox"
                  checked={selectedPlaylists.has(playlist.ratingKey)}
                  onChange={() => togglePlaylist(playlist.ratingKey)}
                />
                <div className="playlist-backup-info">
                  <span className="playlist-name">{playlist.title}</span>
                  <span className="playlist-meta">
                    {playlist.leafCount} tracks • {formatDuration(playlist.duration)}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
        
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '12px' }}
          onClick={handleBackup}
          disabled={selectedPlaylists.size === 0 || isProcessing}
        >
          {isProcessing ? 'Creating Backup...' : `Backup ${selectedPlaylists.size} Playlist(s)`}
        </button>
      </div>
    </div>
  );
}
