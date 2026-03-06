import type { FC } from 'react';
import './Footer.css';

export const Footer: FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="footer-text">
          © {new Date().getFullYear()} Playlist Lab. Multi-user web application for managing Plex playlists.
        </p>
      </div>
    </footer>
  );
};
