import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import type { Schedule } from '@playlist-lab/shared';

export const SchedulesPage: FC = () => {
  const { schedules, apiClient, refreshSchedules, isLoading } = useApp();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [formData, setFormData] = useState({
    scheduleType: 'playlist_refresh' as 'playlist_refresh' | 'mix_generation',
    frequency: 'weekly' as 'daily' | 'weekly' | 'fortnightly' | 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    runTime: '',
    playlistId: '',
    config: {} as any,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showCreateForm && formData.scheduleType === 'playlist_refresh' && !editingSchedule) {
      loadPlaylists();
    }
  }, [showCreateForm, formData.scheduleType]);

  const loadPlaylists = async () => {
    setIsLoadingPlaylists(true);
    try {
      const response = await apiClient.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    console.log('Submitting schedule with formData:', formData);
    console.log('Is editing:', !!editingSchedule);
    console.log('Schedule ID:', editingSchedule?.id);

    try {
      if (editingSchedule) {
        console.log('Calling updateSchedule with:', {
          id: editingSchedule.id,
          data: formData
        });
        await apiClient.updateSchedule(editingSchedule.id, {
          ...formData,
          playlistId: formData.playlistId ? parseInt(formData.playlistId) : undefined,
          config: { ...(formData.config as any), run_time: formData.runTime || undefined },
        });
      } else {
        await apiClient.createSchedule({
          ...formData,
          playlistId: formData.playlistId ? parseInt(formData.playlistId) : undefined,
          config: { ...(formData.config as any), run_time: formData.runTime || undefined },
        } as any);
      }
      await refreshSchedules();
      setShowCreateForm(false);
      setEditingSchedule(null);
      resetForm();
    } catch (err) {
      console.error('Error saving schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    console.log('Editing schedule:', schedule);
    console.log('Schedule startDate:', schedule.startDate);
    setEditingSchedule(schedule);
    setFormData({
      scheduleType: schedule.scheduleType,
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      runTime: schedule.config?.run_time || '',
      playlistId: schedule.playlistId ? String(schedule.playlistId) : '',
      config: schedule.config || {},
    });
    console.log('FormData after setting:', {
      scheduleType: schedule.scheduleType,
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      config: schedule.config || {},
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`Are you sure you want to delete this schedule?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await apiClient.deleteSchedule(schedule.id);
      await refreshSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      scheduleType: 'playlist_refresh',
      frequency: 'weekly',
      startDate: new Date().toISOString().split('T')[0],
      runTime: '',
      playlistId: '',
      config: {} as any,
    });
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingSchedule(null);
    resetForm();
    setError(null);
  };

  const getScheduleTitle = (schedule: Schedule) => {
    // Check if it's a chart import schedule
    if (schedule.config?.chartName) {
      // Use custom playlist name if set, otherwise use chart name
      return schedule.config.playlistName || schedule.config.chartName;
    }
    // For regular playlist refresh or mix generation, return a descriptive title
    if (schedule.scheduleType === 'playlist_refresh') {
      return 'Playlist Refresh';
    }
    return 'Mix Generation';
  };

  const getNextRunDate = (schedule: Schedule) => {
    try {
      if (!schedule.lastRun) {
        // startDate is in YYYY-MM-DD format, add time to ensure proper parsing
        const startDate = new Date(schedule.startDate + 'T00:00:00');
        if (isNaN(startDate.getTime())) {
          return 'Not scheduled';
        }
        return startDate.toLocaleDateString();
      }

      // lastRun is a Unix timestamp in seconds, convert to milliseconds
      const lastRun = new Date(schedule.lastRun * 1000);
      if (isNaN(lastRun.getTime())) {
        return 'Invalid date';
      }

      const daysToAdd = {
        daily: 1,
        weekly: 7,
        fortnightly: 14,
        monthly: 30,
      }[schedule.frequency];

      if (!daysToAdd) {
        return 'Custom schedule';
      }

      const nextRun = new Date(lastRun);
      nextRun.setDate(nextRun.getDate() + daysToAdd);
      return nextRun.toLocaleDateString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title">Schedules</h1>
        {!showCreateForm && (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create Schedule
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: '4px',
          color: 'var(--error)',
        }}>
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>
            {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {!editingSchedule && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Schedule Type
                  </label>
                  <select
                    value={formData.scheduleType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setFormData({ ...formData, scheduleType: newType, config: {} });
                      if (newType === 'playlist_refresh') {
                        loadPlaylists();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="playlist_refresh">Playlist Refresh</option>
                    <option value="mix_generation">Mix Generation</option>
                  </select>
                </div>
              )}

              {!editingSchedule && formData.scheduleType === 'playlist_refresh' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Playlist
                  </label>
                  {isLoadingPlaylists ? (
                    <div style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                      Loading playlists...
                    </div>
                  ) : (
                    <select
                      value={formData.playlistId || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        playlistId: e.target.value
                      })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">Select a playlist</option>
                      {playlists.map(playlist => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name} ({playlist.trackCount} tracks)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {editingSchedule && formData.config?.chartName && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Playlist Name in Plex
                  </label>
                  <input
                    type="text"
                    value={formData.config?.playlistName || formData.config?.chartName || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      config: { ...formData.config, playlistName: e.target.value }
                    })}
                    placeholder="Enter playlist name"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Chart: {formData.config?.chartName}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Run Time (optional)
                </label>
                <input
                  type="time"
                  value={formData.runTime}
                  onChange={(e) => setFormData({ ...formData, runTime: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Leave blank to run at the next hourly check
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ flex: 1 }}
              >
                {isSaving ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={isSaving}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading schedules...
        </div>
      ) : schedules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          No schedules configured
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {schedules.map(schedule => {
            const isChartImport = schedule.config?.chartName;
            return (
            <div key={schedule.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    {getScheduleTitle(schedule)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {isChartImport && (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: 'var(--surface-hover)', 
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}>
                        Chart Import
                      </span>
                    )}
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: 'var(--primary-color)', 
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}>
                      {schedule.frequency}
                    </span>
                    {isChartImport && schedule.config?.chartSource && (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: 'var(--accent-color)', 
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                      }}>
                        {schedule.config.chartSource}
                      </span>
                    )}
                    {isChartImport && schedule.config?.overwriteExisting && (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: 'rgba(255, 152, 0, 0.2)', 
                        color: 'var(--warning-color)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}>
                        Overwrites
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Next run: {getNextRunDate(schedule)}{schedule.config?.run_time ? ` at ${schedule.config.run_time}` : ''}
                  </div>
                  {schedule.lastRun && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Last run: {new Date(schedule.lastRun).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleEdit(schedule)}
                    disabled={isDeleting}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleDelete(schedule)}
                    disabled={isDeleting}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};
