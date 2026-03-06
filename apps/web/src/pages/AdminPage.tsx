import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import type { User } from '@playlist-lab/shared';

interface AdminStats {
  userCount: number;
  activeUsers: number;
  playlistCount: number;
  missingTrackCount: number;
}

interface MissingTrackStat {
  track: string;
  artist: string;
  count: number;
}

interface JobStatus {
  name: string;
  status: string;
  lastRun?: number;
}

export const AdminPage: FC = () => {
  const { apiClient } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [missingTracks, setMissingTracks] = useState<MissingTrackStat[]>([]);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'missing' | 'jobs'>('stats');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, usersData, missingData, jobsData] = await Promise.all([
        apiClient.getAdminStats(),
        apiClient.getAdminUsers(),
        apiClient.getAdminMissingTracks(),
        apiClient.getAdminJobs(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setMissingTracks(missingData);
      setJobs(jobsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableUser = async (userId: number) => {
    setActionLoading(userId);
    try {
      await apiClient.enableUser(userId);
      // Refresh users list
      const usersData = await apiClient.getAdminUsers();
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisableUser = async (userId: number) => {
    setActionLoading(userId);
    try {
      await apiClient.disableUser(userId);
      const usersData = await apiClient.getAdminUsers();
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}" and all their data?`)) {
      return;
    }
    setActionLoading(userId);
    try {
      await apiClient.deleteUser(userId);
      const [usersData, statsData] = await Promise.all([
        apiClient.getAdminUsers(),
        apiClient.getAdminStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        Loading admin data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        border: '1px solid var(--error)',
        borderRadius: '4px',
        color: 'var(--error)',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title" style={{ marginBottom: '2rem' }}>Admin Dashboard</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'stats' as const, label: 'Statistics' },
          { id: 'users' as const, label: 'Users' },
          { id: 'missing' as const, label: 'Missing Tracks' },
          { id: 'jobs' as const, label: 'Background Jobs' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'none',
              color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary-color)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 500 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Statistics Tab */}
      {activeTab === 'stats' && stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem' 
        }}>
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Total Users
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
              {stats.userCount}
            </p>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Active Users
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
              {stats.activeUsers}
            </p>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Total Playlists
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
              {stats.playlistCount}
            </p>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Missing Tracks
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
              {stats.missingTrackCount}
            </p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>User Management</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Plex Home members are auto-approved. Other users need manual approval.
          </p>
          {users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No users found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>User</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>Role</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>Server</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>Last Login</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {user.plexThumb && (
                            <img
                              src={user.plexThumb}
                              alt=""
                              style={{ width: 28, height: 28, borderRadius: '50%' }}
                            />
                          )}
                          <span>{user.plexUsername}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: user.isAdmin ? 'var(--primary-color)' : 'var(--surface-hover)',
                          color: user.isAdmin ? 'white' : 'var(--text-secondary)',
                        }}>
                          {user.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: user.isEnabled ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                          color: user.isEnabled ? 'var(--success)' : 'var(--error)',
                        }}>
                          {user.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {user.hasServer ? '✓ Configured' : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {user.lastLogin ? new Date(user.lastLogin * 1000).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {!user.isAdmin && (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {user.isEnabled ? (
                              <button
                                className="btn"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                onClick={() => handleDisableUser(user.id)}
                                disabled={actionLoading === user.id}
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                onClick={() => handleEnableUser(user.id)}
                                disabled={actionLoading === user.id}
                              >
                                Enable
                              </button>
                            )}
                            <button
                              className="btn"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.6rem',
                                color: 'var(--error)',
                                borderColor: 'var(--error)',
                              }}
                              onClick={() => handleDeleteUser(user.id, user.plexUsername)}
                              disabled={actionLoading === user.id}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Missing Tracks Tab */}
      {activeTab === 'missing' && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Most Common Missing Tracks</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Tracks that multiple users are missing from their libraries
          </p>
          {missingTracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No missing tracks data
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>Track</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>Artist</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>Users Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {missingTracks.map((track, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem' }}>{track.track}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {track.artist}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500, color: 'var(--warning)' }}>
                        {track.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Background Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Background Jobs</h2>
          {jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No jobs data
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {jobs.map((job, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--surface-hover)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{job.name}</div>
                    {job.lastRun && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Last run: {new Date(job.lastRun).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      backgroundColor: job.status === 'running' ? 'var(--success)' : 'var(--surface)',
                      color: job.status === 'running' ? 'white' : 'var(--text-primary)',
                    }}
                  >
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
