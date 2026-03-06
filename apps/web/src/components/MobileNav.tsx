import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './MobileNav.css';

export const MobileNav: FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(
    location.pathname.startsWith('/playlists/') || location.pathname === '/playlists'
  );

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/import', label: 'Import' },
    { path: '/generate', label: 'Generate Mixes' },
    { path: '/schedules', label: 'Schedules' },
    { path: '/settings', label: 'Settings' },
    ...(user?.isAdmin ? [{ path: '/admin', label: 'Admin' }] : []),
  ];

  const managePlaylistsItems = [
    { path: '/playlists/edit', label: 'Edit Playlists' },
    { path: '/playlists/share', label: 'Share Playlists' },
    { path: '/playlists/backup', label: 'Backup & Restore' },
    { path: '/playlists/missing', label: 'Missing Tracks' },
  ];

  return (
    <>
      <button
        className="mobile-nav-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      >
        <span className={`hamburger ${isOpen ? 'hamburger-open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {isOpen && (
        <div className="mobile-nav-overlay" onClick={() => setIsOpen(false)} />
      )}

      <nav className={`mobile-nav ${isOpen ? 'mobile-nav-open' : ''}`}>
        <div className="mobile-nav-header">
          <h2>Menu</h2>
          <button
            className="mobile-nav-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="mobile-nav-content">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive ? 'mobile-nav-link-active' : ''}`
              }
              end={item.path === '/'}
            >
              {item.label}
            </NavLink>
          ))}

          <div className="mobile-nav-section">
            <button
              className="mobile-nav-section-toggle"
              onClick={() => setIsManageOpen(!isManageOpen)}
            >
              <span>Manage Plex Playlists</span>
              <span className="mobile-nav-section-icon">
                {isManageOpen ? '▼' : '▶'}
              </span>
            </button>
            {isManageOpen && (
              <div className="mobile-nav-section-items">
                {managePlaylistsItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `mobile-nav-link mobile-nav-link-nested ${
                        isActive ? 'mobile-nav-link-active' : ''
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};
