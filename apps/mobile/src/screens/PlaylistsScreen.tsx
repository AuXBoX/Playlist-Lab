import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Searchbar,
  ActivityIndicator,
  IconButton,
  Menu,
  Divider,
  Chip,
} from 'react-native-paper';
import { getApiClient } from '../services/api';
import { useOffline } from '../contexts/OfflineContext';
import {
  cachePlaylists,
  getCachedPlaylists,
  queueAction,
} from '../services/offline';
import { hapticFeedback } from '../utils/haptics';
import SwipeablePlaylistItem from '../components/SwipeablePlaylistItem';
import type { Playlist } from '@playlist-lab/shared';

export default function PlaylistsScreen() {
  const { isOnline, refreshPendingActionsCount } = useOffline();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState<number | null>(null);

  useEffect(() => {
    loadPlaylists();
  }, []);

  useEffect(() => {
    filterPlaylists();
  }, [searchQuery, filterSource, playlists]);

  async function loadPlaylists() {
    try {
      if (isOnline) {
        // Load from API and cache
        const data = await getApiClient().getPlaylists();
        setPlaylists(data);
        await cachePlaylists(data);
      } else {
        // Load from cache when offline
        const cached = await getCachedPlaylists();
        setPlaylists(cached);
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
      // Try loading from cache on error
      const cached = await getCachedPlaylists();
      if (cached.length > 0) {
        setPlaylists(cached);
        Alert.alert(
          'Offline Mode',
          'Showing cached playlists. Some data may be outdated.'
        );
      } else {
        Alert.alert('Error', 'Failed to load playlists');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function filterPlaylists() {
    let filtered = playlists;

    if (searchQuery) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterSource) {
      filtered = filtered.filter((p) => p.source === filterSource);
    }

    setFilteredPlaylists(filtered);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadPlaylists();
  }

  async function handleDelete(playlist: Playlist) {
    hapticFeedback.warning();
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isOnline) {
                await getApiClient().deletePlaylist(playlist.id);
                hapticFeedback.success();
              } else {
                // Queue action for later sync
                await queueAction({
                  type: 'DELETE_PLAYLIST',
                  payload: { id: playlist.id },
                  timestamp: Date.now(),
                });
                await refreshPendingActionsCount();
                hapticFeedback.medium();
              }
              
              // Update local state immediately
              setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
              
              // Update cache
              const updated = playlists.filter((p) => p.id !== playlist.id);
              await cachePlaylists(updated);
              
              Alert.alert(
                'Success',
                isOnline
                  ? 'Playlist deleted'
                  : 'Playlist will be deleted when online'
              );
            } catch (error: any) {
              hapticFeedback.error();
              Alert.alert('Error', error.message || 'Failed to delete playlist');
            }
          },
        },
      ]
    );
  }

  function handlePlaylistTap(playlist: Playlist) {
    hapticFeedback.light();
    // TODO: Navigate to playlist details
    Alert.alert(
      playlist.name,
      `Source: ${playlist.source}\nCreated: ${new Date(playlist.createdAt).toLocaleDateString()}`
    );
  }

  function handlePlaylistLongPress(playlist: Playlist) {
    hapticFeedback.medium();
    // Show quick actions menu
    Alert.alert(
      playlist.name,
      'Quick Actions',
      [
        { text: 'View Details', onPress: () => handlePlaylistTap(playlist) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(playlist) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <SwipeablePlaylistItem
      title={item.name}
      subtitle={`${item.source} • ${new Date(item.createdAt).toLocaleDateString()}`}
      onPress={() => handlePlaylistTap(item)}
      onDelete={() => handleDelete(item)}
      onLongPress={() => handlePlaylistLongPress(item)}
    />
  );

  const uniqueSources = Array.from(new Set(playlists.map((p) => p.source)));

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        My Playlists
      </Text>

      <Searchbar
        placeholder="Search playlists"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {uniqueSources.length > 1 && (
        <View style={styles.filterRow}>
          <Chip
            selected={filterSource === null}
            onPress={() => {
              hapticFeedback.selection();
              setFilterSource(null);
            }}
            style={styles.filterChip}
          >
            All
          </Chip>
          {uniqueSources.map((source) => (
            <Chip
              key={source}
              selected={filterSource === source}
              onPress={() => {
                hapticFeedback.selection();
                setFilterSource(filterSource === source ? null : source);
              }}
              style={styles.filterChip}
            >
              {source}
            </Chip>
          ))}
        </View>
      )}

      {filteredPlaylists.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.emptyText}>
              {playlists.length === 0
                ? 'No playlists yet'
                : 'No playlists match your search'}
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              {playlists.length === 0
                ? 'Import or generate playlists to get started'
                : 'Try a different search term or filter'}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <FlatList
          data={filteredPlaylists}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPlaylistItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  searchBar: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
  },
  listContent: {
    paddingBottom: 16,
  },
  playlistCard: {
    marginBottom: 12,
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  sourceChip: {
    height: 24,
  },
  chipText: {
    fontSize: 11,
  },
  dateText: {
    color: '#666',
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 8,
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    margin: 0,
  },
  emptyCard: {
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    color: '#666',
    textAlign: 'center',
  },
});
