import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export const DashboardPage: FC = () => {
  const { playlists, schedules, missingTracksCount, isLoading } = useApp();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: '2rem' }}>Dashboard</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="card">
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Playlists
          </h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            {playlists.length}
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Schedules
          </h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            {schedules.length}
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Missing Tracks
          </h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: missingTracksCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {missingTracksCount}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Welcome to Playlist Lab</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Multi-user web application for managing Plex playlists
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/import" className="btn btn-primary">Import Playlist</Link>
          <Link to="/generate" className="btn btn-secondary">Generate Mixes</Link>
        </div>
      </div>
    </div>
  );
};
