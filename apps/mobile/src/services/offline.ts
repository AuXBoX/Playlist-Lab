import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { Playlist, MissingTrack, Schedule } from '@playlist-lab/shared';

// Storage keys
const CACHE_KEYS = {
  PLAYLISTS: '@playlist_lab_cache_playlists',
  MISSING_TRACKS: '@playlist_lab_cache_missing_tracks',
  SCHEDULES: '@playlist_lab_cache_schedules',
  PENDING_ACTIONS: '@playlist_lab_pending_actions',
  LAST_SYNC: '@playlist_lab_last_sync',
};

// Action types for offline queue
export type PendingAction =
  | {
      type: 'DELETE_PLAYLIST';
      payload: { id: number };
      timestamp: number;
    }
  | {
      type: 'CREATE_PLAYLIST';
      payload: { name: string; tracks: string[] };
      timestamp: number;
    }
  | {
      type: 'UPDATE_PLAYLIST';
      payload: { id: number; updates: any };
      timestamp: number;
    }
  | {
      type: 'DELETE_SCHEDULE';
      payload: { id: number };
      timestamp: number;
    }
  | {
      type: 'CREATE_SCHEDULE';
      payload: any;
      timestamp: number;
    };

// Cache management
export async function cacheData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error caching data:', error);
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Playlist cache
export async function cachePlaylists(playlists: Playlist[]): Promise<void> {
  await cacheData(CACHE_KEYS.PLAYLISTS, playlists);
}

export async function getCachedPlaylists(): Promise<Playlist[]> {
  return (await getCachedData<Playlist[]>(CACHE_KEYS.PLAYLISTS)) || [];
}

// Missing tracks cache
export async function cacheMissingTracks(
  tracks: MissingTrack[]
): Promise<void> {
  await cacheData(CACHE_KEYS.MISSING_TRACKS, tracks);
}

export async function getCachedMissingTracks(): Promise<MissingTrack[]> {
  return (await getCachedData<MissingTrack[]>(CACHE_KEYS.MISSING_TRACKS)) || [];
}

// Schedules cache
export async function cacheSchedules(schedules: Schedule[]): Promise<void> {
  await cacheData(CACHE_KEYS.SCHEDULES, schedules);
}

export async function getCachedSchedules(): Promise<Schedule[]> {
  return (await getCachedData<Schedule[]>(CACHE_KEYS.SCHEDULES)) || [];
}

// Pending actions queue
export async function queueAction(action: PendingAction): Promise<void> {
  try {
    const queue = await getPendingActions();
    queue.push(action);
    await AsyncStorage.setItem(
      CACHE_KEYS.PENDING_ACTIONS,
      JSON.stringify(queue)
    );
  } catch (error) {
    console.error('Error queuing action:', error);
  }
}

export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting pending actions:', error);
    return [];
  }
}

export async function clearPendingActions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_ACTIONS);
  } catch (error) {
    console.error('Error clearing pending actions:', error);
  }
}

export async function removePendingAction(index: number): Promise<void> {
  try {
    const queue = await getPendingActions();
    queue.splice(index, 1);
    await AsyncStorage.setItem(
      CACHE_KEYS.PENDING_ACTIONS,
      JSON.stringify(queue)
    );
  } catch (error) {
    console.error('Error removing pending action:', error);
  }
}

// Last sync timestamp
export async function setLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEYS.LAST_SYNC,
      Date.now().toString()
    );
  } catch (error) {
    console.error('Error setting last sync time:', error);
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  try {
    const time = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
    return time ? parseInt(time) : null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
}

// Network status
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// Subscribe to network changes
export function subscribeToNetworkChanges(
  callback: (isConnected: boolean) => void
): () => void {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected === true && state.isInternetReachable !== false);
  });
}
