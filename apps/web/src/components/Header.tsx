import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { MobileNav } from './MobileNav';
import './Header.css';

interface HeaderProps {
  user?: { plexUsername: string; plexThumb?: string } | null;
  onLogout?: () => void;
}

export const Header: FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <MobileNav />
          <Link to="/" className="header-logo">
            <img src="/logo.svg" alt="Playlist Lab" className="header-logo-icon" />
            <h1><span className="logo-playlist">Playlist </span><span className="logo-lab">Lab</span></h1>
          </Link>
        </div>
        
        {user && (
          <div className="header-user">
            {user.plexThumb && (
              <img 
                src={user.plexThumb} 
                alt={user.plexUsername}
                className="header-user-avatar"
              />
            )}
            <span className="header-user-name">{user.plexUsername}</span>
            {onLogout && (
              <button onClick={onLogout} className="btn btn-secondary btn-logout">
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
