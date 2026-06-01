import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

export const Sidebar: FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [version, setVersion] = useState<string>('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(
    location.pathname.startsWith('/playlists/') || location.pathname === '/playlists'
  );

  // Fetch version on mount and poll for changes (detects post-update server restart)
  useEffect(() => {
    let initialVersion = '';
    
    const fetchVersion = async () => {
      try {
        const res = await fetch('/api/version', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!initialVersion) {
            initialVersion = data.version;
            setVersion(data.version);
          } else if (data.version !== initialVersion) {
            // Version changed - server was updated, reload to get new frontend
            console.log(`[Update] Version changed from ${initialVersion} to ${data.version}, reloading...`);
            window.location.reload();
          }
        }
      } catch {
        // Silently fail - server might be restarting
      }
    };
    
    fetchVersion();
    
    // Poll every 30 seconds to detect server updates
    const interval = setInterval(fetchVersion, 30 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Check for updates on mount and periodically
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const res = await fetch('/api/update/check', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUpdateAvailable(data.updateAvailable);
          setUpdateInfo(data);
        }
      } catch (err) {
        // Silently fail
      }
    };

    checkForUpdates();
    
    // Check every 6 hours
    const interval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (!confirm(`Update to version ${updateInfo.latestVersion}?\n\nThe application will restart automatically.`)) {
      return;
    }

    setIsUpdating(true);
    
    try {
      const res = await fetch('/api/update/install', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (res.ok) {
        // Update successful - server will restart soon
        // Keep showing "Updating..." until page reloads or connection drops
      } else {
        const data = await res.json();
        alert(`Update failed: ${data.error || 'Unknown error'}`);
        setIsUpdating(false);
      }
    } catch (err) {
      // Network error is expected when server restarts
      // Keep showing "Updating..." - this is normal behavior
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        // Server is restarting - this is expected, keep updating state
      } else {
        alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsUpdating(false);
      }
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/import', label: 'Import' },
    { path: '/queue', label: 'Queue' },
    { path: '/generate', label: 'Generate Mixes' },
    { path: '/schedules', label: 'Schedules' },
  ];

  const managePlaylistsItems = [
    { path: '/playlists/edit', label: 'Edit Playlists' },
    { path: '/playlists/share', label: 'Share Playlists' },
    { path: '/playlists/export', label: 'Export Playlists' },
    { path: '/playlists/backup', label: 'Backup & Restore' },
    { path: '/playlists/missing', label: 'Missing Tracks' },
  ];

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-nav-top">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              end={item.path === '/'}
            >
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
          
          <div className="sidebar-section">
            <button
              className="sidebar-section-toggle"
              onClick={() => setIsManageOpen(!isManageOpen)}
            >
              <span className="sidebar-section-label">Manage Plex Playlists</span>
              <span className="sidebar-section-icon">{isManageOpen ? '▼' : '▶'}</span>
            </button>
            {isManageOpen && (
              <div className="sidebar-section-items">
                {managePlaylistsItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-link sidebar-link-nested ${isActive ? 'sidebar-link-active' : ''}`
                    }
                  >
                    <span className="sidebar-link-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <span className="sidebar-link-label">Settings</span>
          </NavLink>

          {user?.isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <span className="sidebar-link-label">Admin</span>
            </NavLink>
          )}
        </div>

        {version && (
          <div className="sidebar-nav-bottom">
            <div className="sidebar-version-inline">
              <span className="sidebar-version-text">v{version}</span>
              {updateAvailable && (
                <button 
                  className="sidebar-update-btn-inline"
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  title={`Update to v${updateInfo?.latestVersion}`}
                >
                  {isUpdating ? 'Updating...' : 'Update'}
                </button>
              )}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
};
