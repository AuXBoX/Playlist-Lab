import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Banner, Button } from 'react-native-paper';
import { useOffline } from '../contexts/OfflineContext';

export default function OfflineIndicator() {
  const { isOnline, isSyncing, pendingActionsCount, syncPendingActions } =
    useOffline();

  if (isOnline && pendingActionsCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <Banner
        visible={true}
        icon="wifi-off"
        style={styles.offlineBanner}
      >
        You are offline. Changes will be synced when connection is restored.
      </Banner>
    );
  }

  if (pendingActionsCount > 0) {
    return (
      <Banner
        visible={true}
        icon="sync"
        actions={[
          {
            label: isSyncing ? 'Syncing...' : 'Sync Now',
            onPress: syncPendingActions,
            disabled: isSyncing,
          },
        ]}
        style={styles.syncBanner}
      >
        {pendingActionsCount} pending action{pendingActionsCount > 1 ? 's' : ''}{' '}
        to sync
      </Banner>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#ff9800',
  },
  syncBanner: {
    backgroundColor: '#2196f3',
  },
});
