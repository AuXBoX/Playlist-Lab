import { FC, useEffect, useState } from 'react';
import './ImportQueueStatus.css';

interface QueueStatus {
  processing: {
    id: string;
    source: string;
    url: string;
    playlistName?: string;
    status: string;
    progress?: {
      current: number;
      total: number;
      currentTrackName?: string;
      phase?: 'scraping' | 'matching' | 'complete';
    };
  } | null;
  queued: Array<{
    id: string;
    source: string;
    url: string;
    playlistName?: string;
    position: number;
  }>;
  position: number | null;
}

export const ImportQueueStatus: FC = () => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkQueue = async () => {
      try {
        const response = await fetch('/api/import/queue', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Only show if there's something in the queue
          const hasQueue = data.processing || (data.queued && data.queued.length > 0);
          setIsVisible(hasQueue);
          
          if (hasQueue) {
            setQueueStatus(data);
          }
        }
      } catch (error) {
        console.error('Failed to check queue status:', error);
      }
    };

    // Check immediately
    checkQueue();

    // Poll every 10 seconds
    const interval = setInterval(checkQueue, 10000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible || !queueStatus) {
    return null;
  }

  const handleCancel = async (jobId: string) => {
    try {
      await fetch(`/api/import/cancel/${jobId}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Refresh queue status immediately
      const response = await fetch('/api/import/queue', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const hasQueue = data.processing || (data.queued && data.queued.length > 0);
        setIsVisible(hasQueue);
        if (hasQueue) {
          setQueueStatus(data);
        }
      }
    } catch (error) {
      console.error('Failed to cancel import:', error);
    }
  };

  return (
    <div className="import-queue-status">
      <div className="queue-header">
        <h3>Import Queue</h3>
        {queueStatus.queued.length > 0 && (
          <span className="queue-count">{queueStatus.queued.length} queued</span>
        )}
      </div>

      {queueStatus.processing && (
        <div className="queue-item processing">
          <div className="queue-item-icon">
            <div className="spinner-small"></div>
          </div>
          <div className="queue-item-details">
            <div className="queue-item-source">{queueStatus.processing.source}</div>
            <div className="queue-item-url">
              {queueStatus.processing.playlistName || extractPlaylistNameFromUrl(queueStatus.processing.url, queueStatus.processing.source)}
            </div>
            {queueStatus.processing.progress && queueStatus.processing.progress.total > 0 ? (
              <>
                <div className="queue-item-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${Math.min(100, (queueStatus.processing.progress.current / queueStatus.processing.progress.total) * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {queueStatus.processing.progress.current} / {queueStatus.processing.progress.total} tracks
                  </div>
                </div>
                {queueStatus.processing.progress.currentTrackName && (
                  <div className="queue-item-current-track">
                    {queueStatus.processing.progress.currentTrackName}
                  </div>
                )}
              </>
            ) : (
              <div className="queue-item-status">Processing...</div>
            )}
          </div>
          <button
            className="queue-item-cancel"
            onClick={() => handleCancel(queueStatus.processing!.id)}
            title="Cancel import"
          >
            ✕
          </button>
        </div>
      )}

      {queueStatus.queued.map((job) => (
        <div key={job.id} className="queue-item queued">
          <div className="queue-item-icon">
            <span className="queue-position">{job.position}</span>
          </div>
          <div className="queue-item-details">
            <div className="queue-item-source">{job.source}</div>
            <div className="queue-item-url">
              {job.playlistName || extractPlaylistNameFromUrl(job.url, job.source)}
            </div>
            <div className="queue-item-status">Queued</div>
          </div>
          <button
            className="queue-item-cancel"
            onClick={() => handleCancel(job.id)}
            title="Cancel import"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

function extractPlaylistNameFromUrl(url: string, source: string): string {
  try {
    // For ARIA charts, extract year and chart type
    if (source === 'aria') {
      const ariaMatch = url.match(/\/charts\/(\d{4}|[\w-]+)\/([\w-]+)/);
      if (ariaMatch) {
        const [, yearOrType, chartType] = ariaMatch;
        const isYear = /^\d{4}$/.test(yearOrType);
        
        if (isYear) {
          // Format: /charts/2025/singles-chart
          const formattedType = chartType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `ARIA ${formattedType} ${yearOrType}`;
        } else {
          // Format: /charts/singles-chart/2025-01-01
          const formattedType = yearOrType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `ARIA ${formattedType}`;
        }
      }
    }
    
    // For Billboard charts
    if (source === 'billboard') {
      const billboardMatch = url.match(/\/charts\/([\w-]+)/);
      if (billboardMatch) {
        const chartType = billboardMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `Billboard ${chartType}`;
      }
    }
    
    // For Last.fm
    if (source === 'lastfm') {
      if (url.includes('/top-tracks')) return 'Last.fm Top Tracks';
      if (url.includes('/top-artists')) return 'Last.fm Top Artists';
    }
    
    // For Spotify, try to extract playlist name from URL
    if (source === 'spotify') {
      const spotifyMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
      if (spotifyMatch) {
        return 'Spotify Playlist';
      }
    }
    
    // For other sources, use a generic name
    const sourceNames: Record<string, string> = {
      deezer: 'Deezer Playlist',
      apple: 'Apple Music Playlist',
      tidal: 'Tidal Playlist',
      youtube: 'YouTube Playlist',
      amazon: 'Amazon Music Playlist',
      qobuz: 'Qobuz Playlist',
      listenbrainz: 'ListenBrainz Playlist',
    };
    
    return sourceNames[source] || truncateUrl(url);
  } catch (error) {
    return truncateUrl(url);
  }
}
