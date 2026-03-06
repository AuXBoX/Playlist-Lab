import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { getApiClient } from '../services/api';
import { useNavigation } from '@react-navigation/native';

export default function DashboardScreen() {
  const { user, server } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    playlistCount: 0,
    missingTrackCount: 0,
  });

  async function loadStats() {
    try {
      const [playlists, missingTracks] = await Promise.all([
        getApiClient().getPlaylists(),
        getApiClient().getMissingTracks(),
      ]);
      setStats({
        playlistCount: playlists.length,
        missingTrackCount: missingTracks.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text variant="headlineMedium" style={styles.title}>
        Dashboard
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Welcome, {user?.plexUsername}!</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Manage your Plex playlists on the go
          </Text>
          {server && (
            <Text variant="bodySmall" style={styles.serverInfo}>
              Connected to: {server.name}
            </Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.statsTitle}>
            Quick Stats
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {stats.playlistCount}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Playlists
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {stats.missingTrackCount}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Missing Tracks
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.actionsTitle}>
            Quick Actions
          </Text>
          <Button
            mode="contained"
            style={styles.actionButton}
            icon="import"
            onPress={() => navigation.navigate('Import' as never)}
          >
            Import Playlist
          </Button>
          <Button
            mode="contained"
            style={styles.actionButton}
            icon="music-box-multiple"
            onPress={() => navigation.navigate('Generate' as never)}
          >
            Generate Mixes
          </Button>
          <Button
            mode="outlined"
            style={styles.actionButton}
            icon="playlist-music"
            onPress={() => navigation.navigate('Playlists' as never)}
          >
            View Playlists
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
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
  card: {
    marginBottom: 16,
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
  },
  serverInfo: {
    marginTop: 4,
    color: '#999',
    fontStyle: 'italic',
  },
  statsTitle: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  statLabel: {
    marginTop: 4,
    color: '#666',
  },
  actionsTitle: {
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 8,
  },
});
