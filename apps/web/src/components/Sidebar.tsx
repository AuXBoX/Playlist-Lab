import type { FC } from 'react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

export const Sidebar: FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isManageOpen, setIsManageOpen] = useState(
    location.pathname.startsWith('/playlists/') || location.pathname === '/playlists'
  );

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
    </aside>
  );
};
