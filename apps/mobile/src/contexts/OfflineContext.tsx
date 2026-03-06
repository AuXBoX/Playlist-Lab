import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { Alert } from 'react-native';
import { getApiClient } from '../services/api';
import {
  isOnline,
  subscribeToNetworkChanges,
  getPendingActions,
  clearPendingActions,
  removePendingAction,
  setLastSyncTime,
  getLastSyncTime,
  cachePlaylists,
  cacheMissingTracks,
  cacheSchedules,
  type PendingAction,
} from '../services/offline';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActionsCount: number;
  lastSyncTime: number | null;
  syncPendingActions: () => Promise<void>;
  refreshPendingActionsCount: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    // Check initial online status
    checkOnlineStatus();

    // Load last sync time
    loadLastSyncTime();

    // Load pending actions count
    refreshPendingActionsCount();

    // Subscribe to network changes
    const unsubscribe = subscribeToNetworkChanges((connected) => {
      setOnline(connected);
      if (connected) {
        // Auto-sync when coming back online
        syncPendingActions();
      }
    });

    return unsubscribe;
  }, []);

  async function checkOnlineStatus() {
    const status = await isOnline();
    setOnline(status);
  }

  async function loadLastSyncTime() {
    const time = await getLastSyncTime();
    setLastSync(time);
  }

  async function refreshPendingActionsCount() {
    const actions = await getPendingActions();
    setPendingCount(actions.length);
  }

  const syncPendingActions = useCallback(async () => {
    if (syncing || !online) return;

    setSyncing(true);
    try {
      const actions = await getPendingActions();
      if (actions.length === 0) {
        setSyncing(false);
        return;
      }

      let successCount = 0;
      let failedActions: PendingAction[] = [];

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        try {
          await executeAction(action);
          successCount++;
          await removePendingAction(0); // Always remove first item after success
        } catch (error) {
          console.error('Failed to sync action:', error);
          failedActions.push(action);
        }
      }

      // Update cache with latest data
      try {
        const [playlists, missingTracks, schedules] = await Promise.all([
          getApiClient().getPlaylists(),
          getApiClient().getMissingTracks(),
          getApiClient().getSchedules(),
        ]);
        await cachePlaylists(playlists);
        await cacheMissingTracks(missingTracks);
        await cacheSchedules(schedules);
      } catch (error) {
        console.error('Failed to update cache:', error);
      }

      await setLastSyncTime();
      await loadLastSyncTime();
      await refreshPendingActionsCount();

      if (successCount > 0) {
        Alert.alert(
          'Sync Complete',
          `${successCount} action(s) synced successfully${
            failedActions.length > 0
              ? `, ${failedActions.length} failed`
              : ''
          }`
        );
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Failed', 'Failed to sync pending actions');
    } finally {
      setSyncing(false);
    }
  }, [syncing, online]);

  async function executeAction(action: PendingAction): Promise<void> {
    switch (action.type) {
      case 'DELETE_PLAYLIST':
        await getApiClient().deletePlaylist(action.payload.id);
        break;
      case 'CREATE_PLAYLIST':
        await getApiClient().createPlaylist(action.payload);
        break;
      case 'UPDATE_PLAYLIST':
        await getApiClient().updatePlaylist(
          action.payload.id,
          action.payload.updates
        );
        break;
      case 'DELETE_SCHEDULE':
        await getApiClient().deleteSchedule(action.payload.id);
        break;
      case 'CREATE_SCHEDULE':
        await getApiClient().createSchedule(action.payload);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  return (
    <OfflineContext.Provider
      value={{
        isOnline: online,
        isSyncing: syncing,
        pendingActionsCount: pendingCount,
        lastSyncTime: lastSync,
        syncPendingActions,
        refreshPendingActionsCount,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
}
