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

  // Fetch version on mount
  useEffect(() => {
    fetch('/api/version', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setVersion(data.version))
      .catch(() => setVersion(''));
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
        // Show success message briefly before server restarts
        alert('Update started! The application will restart in a few seconds.');
      } else {
        const data = await res.json();
        alert(`Update failed: ${data.error || 'Unknown error'}`);
        setIsUpdating(false);
      }
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsUpdating(false);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/import', label: 'Import' },
    { path: '/generate', label: 'Generate Mixes' },
    { path: '/schedules', label: 'Schedules' },
  ];

  const managePlaylistsItems = [
    { path: '/playlists/edit', label: 'Edit Playlists' },
    { path: '/playlists/share', label: 'Share Playlists' },
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
        </div>

        {user?.isAdmin && (
          <div className="sidebar-nav-bottom">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <span className="sidebar-link-label">Admin</span>
            </NavLink>
          </div>
        )}
      </nav>
      
      {version && (
        <div className="sidebar-footer">
          <div className="sidebar-version">
            v{version}
          </div>
          {updateAvailable && (
            <button 
              className="sidebar-update-btn"
              onClick={handleUpdate}
              disabled={isUpdating}
              title={`Update to v${updateInfo?.latestVersion}`}
            >
              {isUpdating ? 'Updating...' : 'Update Available'}
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
