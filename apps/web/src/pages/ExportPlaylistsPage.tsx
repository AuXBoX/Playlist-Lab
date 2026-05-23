import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import './ExportPlaylistsPage.css';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  duration: number;
  composite?: string;
}

type ExportFormat = 'm3u' | 'm3u8' | 'pls' | 'xspf' | 'csv';

interface FormatOption {
  id: ExportFormat;
  name: string;
  description: string;
  extension: string;
  icon: string;
}

export const ExportPlaylistsPage: FC = () => {
  const { apiClient, server } = useApp();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('m3u8');
  const [_savePath, _setSavePath] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formats: FormatOption[] = [
    {
      id: 'm3u',
      name: 'M3U',
      description: 'Standard M3U format - compatible with most players',
      extension: '.m3u',
      icon: 'M3U',
    },
    {
      id: 'm3u8',
      name: 'M3U8',
      description: 'UTF-8 encoded - best for international characters',
      extension: '.m3u8',
      icon: 'M3U8',
    },
    {
      id: 'pls',
      name: 'PLS',
      description: 'Winamp format - compatible with portable players',
      extension: '.pls',
      icon: 'PLS',
    },
    {
      id: 'xspf',
      name: 'XSPF',
      description: 'XML format - includes full metadata',
      extension: '.xspf',
      icon: 'XSPF',
    },
    {
      id: 'csv',
      name: 'CSV',
      description: 'Spreadsheet format - for databases',
      extension: '.csv',
      icon: 'CSV',
    },
  ];

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPlaylists();
      setPlaylists(data.playlists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedPlaylist) {
      setError('Please select a playlist');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playlistId: selectedPlaylist,
          format: selectedFormat,
          pathType: 'absolute',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export failed');
      }

      const blob = await response.blob();
      
      // If user selected a save location, use it
      const fileHandle = (window as any).__fileHandle;
      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          delete (window as any).__fileHandle;
          _setSavePath('');
        } catch (err) {
          // Fall back to download if write fails
          downloadBlob(blob, response);
        }
      } else {
        // Fall back to regular download
        downloadBlob(blob, response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, response: Response) => {
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
    const filename = filenameMatch ? filenameMatch[1] : `playlist${formats.find(f => f.id === selectedFormat)?.extension}`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getCoverUrl = (composite?: string) => {
    if (!composite || !server) {
      return null;
    }
    // Use the API proxy endpoint to avoid CORS issues
    const fullPlexUrl = `${server.url}${composite}`;
    return `/api/proxy/image?url=${encodeURIComponent(fullPlexUrl)}`;
  };

  const selectedPlaylistData = playlists.find(p => p.id === selectedPlaylist);
  const selectedFormatData = formats.find(f => f.id === selectedFormat);

  return (
    <div className="page-container">
      <h1>Export Playlists</h1>
      
      {error && (
        <div className="export-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="export-layout">
        {/* Column 1: Playlists */}
        <div className="export-column export-playlists-column">
          <h2>Select Playlist</h2>
          {loading ? (
            <div className="export-loading">
              <div className="loading-spinner"></div>
              <span>Loading playlists...</span>
            </div>
          ) : playlists.length === 0 ? (
            <div className="export-empty">
              <p>No playlists found</p>
              <small>Create a playlist first to export it</small>
            </div>
          ) : (
            <div className="export-playlists-list">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={`export-playlist-item ${selectedPlaylist === playlist.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlaylist(playlist.id)}
                >
                  {playlist.composite && (
                    <div className="playlist-thumb-container">
                      <img
                        src={getCoverUrl(playlist.composite) || ''}
                        alt=""
                        className="playlist-thumb"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="export-playlist-info">
                    <div className="export-playlist-title">{playlist.name}</div>
                    <div className="export-playlist-meta">
                      {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'} • {Math.floor(playlist.duration / 60000)} min
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Format */}
        <div className="export-column export-format-column">
          <h2>Choose Format</h2>
          <div className="export-formats-list">
            {formats.map((format) => (
              <div
                key={format.id}
                className={`export-format-item ${selectedFormat === format.id ? 'active' : ''}`}
                onClick={() => setSelectedFormat(format.id)}
              >
                <div className="export-format-badge">{format.icon}</div>
                <div className="export-format-info">
                  <div className="export-format-title">{format.name}</div>
                  <div className="export-format-description">{format.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Export */}
        <div className="export-column export-action-column">
          <h2>Export</h2>
          <div className="export-action-content">
            {selectedPlaylistData && selectedFormatData ? (
              <>
                <div className="export-summary">
                  <div className="export-summary-item">
                    <span className="export-summary-label">Playlist</span>
                    <span className="export-summary-value">{selectedPlaylistData.name}</span>
                  </div>
                  <div className="export-summary-item">
                    <span className="export-summary-label">Format</span>
                    <span className="export-summary-value">{selectedFormatData.name}</span>
                  </div>
                  <div className="export-summary-item">
                    <span className="export-summary-label">Tracks</span>
                    <span className="export-summary-value">{selectedPlaylistData.trackCount}</span>
                  </div>
                  <div className="export-summary-item">
                    <span className="export-summary-label">Duration</span>
                    <span className="export-summary-value">{Math.floor(selectedPlaylistData.duration / 60000)} min</span>
                  </div>
                </div>
                
                <button
                  className="btn-primary btn-export"
                  onClick={handleExport}
                  disabled={!selectedPlaylist || exporting}
                >
                  {exporting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Exporting...
                    </>
                  ) : (
                    'Export Playlist'
                  )}
                </button>
              </>
            ) : (
              <div className="export-placeholder">
                <p>Select a playlist and format to export</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
