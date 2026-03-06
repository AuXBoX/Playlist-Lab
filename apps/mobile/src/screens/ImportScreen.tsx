import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  ActivityIndicator,
  List,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import { getApiClient } from '../services/api';
import type { MatchedTrack } from '@playlist-lab/shared';

type ImportSource =
  | 'spotify'
  | 'apple'
  | 'deezer'
  | 'tidal'
  | 'youtube'
  | 'amazon'
  | 'qobuz'
  | 'listenbrainz';

export default function ImportScreen() {
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(
    null
  );
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    playlistName: string;
    matched: MatchedTrack[];
    unmatched: MatchedTrack[];
  } | null>(null);

  const sources = [
    { id: 'spotify' as ImportSource, name: 'Spotify', icon: 'spotify' },
    { id: 'apple' as ImportSource, name: 'Apple Music', icon: 'apple' },
    { id: 'deezer' as ImportSource, name: 'Deezer', icon: 'music' },
    { id: 'tidal' as ImportSource, name: 'Tidal', icon: 'waves' },
    { id: 'youtube' as ImportSource, name: 'YouTube Music', icon: 'youtube' },
    { id: 'amazon' as ImportSource, name: 'Amazon Music', icon: 'amazon' },
    { id: 'qobuz' as ImportSource, name: 'Qobuz', icon: 'music-note' },
    {
      id: 'listenbrainz' as ImportSource,
      name: 'ListenBrainz',
      icon: 'brain',
    },
  ];

  function getPlaceholder(source: ImportSource): string {
    switch (source) {
      case 'spotify':
        return 'https://open.spotify.com/playlist/...';
      case 'apple':
        return 'https://music.apple.com/playlist/...';
      case 'deezer':
        return 'Playlist ID or URL';
      case 'tidal':
        return 'https://tidal.com/browse/playlist/...';
      case 'youtube':
        return 'https://music.youtube.com/playlist?list=...';
      case 'amazon':
        return 'https://music.amazon.com/playlists/...';
      case 'qobuz':
        return 'https://www.qobuz.com/playlist/...';
      case 'listenbrainz':
        return 'Username';
      default:
        return 'Enter URL or ID';
    }
  }

  async function handleImport() {
    if (!selectedSource || !url.trim()) {
      Alert.alert('Error', 'Please enter a URL or ID');
      return;
    }

    setLoading(true);
    try {
      let result;
      switch (selectedSource) {
        case 'spotify':
          result = await getApiClient().importSpotify(url);
          break;
        case 'apple':
          result = await getApiClient().importAppleMusic(url);
          break;
        case 'deezer':
          result = await getApiClient().importDeezer(url);
          break;
        case 'tidal':
          result = await getApiClient().importTidal(url);
          break;
        case 'youtube':
          result = await getApiClient().importYouTubeMusic(url);
          break;
        case 'amazon':
          result = await getApiClient().importAmazonMusic(url);
          break;
        case 'qobuz':
          result = await getApiClient().importQobuz(url);
          break;
        case 'listenbrainz':
          result = await getApiClient().importListenBrainz(url);
          break;
      }
      setImportResult(result);
    } catch (error: any) {
      Alert.alert('Import Failed', error.message || 'Failed to import playlist');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!importResult || !selectedSource) return;

    setImporting(true);
    try {
      await getApiClient().confirmImport({
        playlistName: importResult.playlistName,
        source: selectedSource,
        sourceUrl: url,
        tracks: importResult.matched,
      });
      Alert.alert('Success', 'Playlist imported successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedSource(null);
            setUrl('');
            setImportResult(null);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create playlist');
    } finally {
      setImporting(false);
    }
  }

  function handleCancel() {
    setImportResult(null);
    setUrl('');
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Importing playlist...
        </Text>
      </View>
    );
  }

  if (importResult) {
    const matchRate =
      (importResult.matched.length /
        (importResult.matched.length + importResult.unmatched.length)) *
      100;

    return (
      <ScrollView style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          Import Results
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.playlistName}>
              {importResult.playlistName}
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Match Rate: {matchRate.toFixed(1)}%
            </Text>
            <ProgressBar
              progress={matchRate / 100}
              style={styles.progressBar}
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.statsTitle}>
              Track Statistics
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.matchedNumber}>
                  {importResult.matched.length}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Matched
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.unmatchedNumber}>
                  {importResult.unmatched.length}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Unmatched
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {importResult.matched.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Matched Tracks (Sample)</Text>
              {importResult.matched.slice(0, 5).map((track, index) => (
                <List.Item
                  key={index}
                  title={track.plexTitle || track.title}
                  description={track.plexArtist || track.artist}
                  left={(props) => <List.Icon {...props} icon="check-circle" />}
                />
              ))}
              {importResult.matched.length > 5 && (
                <Text variant="bodySmall" style={styles.moreText}>
                  ... and {importResult.matched.length - 5} more
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {importResult.unmatched.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Unmatched Tracks (Sample)</Text>
              {importResult.unmatched.slice(0, 5).map((track, index) => (
                <List.Item
                  key={index}
                  title={track.title}
                  description={track.artist}
                  left={(props) => <List.Icon {...props} icon="alert-circle" />}
                />
              ))}
              {importResult.unmatched.length > 5 && (
                <Text variant="bodySmall" style={styles.moreText}>
                  ... and {importResult.unmatched.length - 5} more
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            style={styles.halfButton}
            onPress={handleCancel}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            style={styles.halfButton}
            onPress={handleConfirm}
            loading={importing}
            disabled={importing || importResult.matched.length === 0}
          >
            Confirm Import
          </Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Import Playlist
      </Text>

      {!selectedSource ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Select Source
            </Text>
            {sources.map((source) => (
              <React.Fragment key={source.id}>
                <List.Item
                  title={source.name}
                  left={(props) => <List.Icon {...props} icon={source.icon} />}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" />
                  )}
                  onPress={() => setSelectedSource(source.id)}
                />
                <Divider />
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {sources.find((s) => s.id === selectedSource)?.name}
              </Text>
              <TextInput
                label={
                  selectedSource === 'listenbrainz' ? 'Username' : 'URL or ID'
                }
                value={url}
                onChangeText={setUrl}
                placeholder={getPlaceholder(selectedSource)}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.buttonRow}>
                <Button
                  mode="outlined"
                  style={styles.halfButton}
                  onPress={() => {
                    setSelectedSource(null);
                    setUrl('');
                  }}
                >
                  Back
                </Button>
                <Button
                  mode="contained"
                  style={styles.halfButton}
                  onPress={handleImport}
                  disabled={!url.trim()}
                >
                  Import
                </Button>
              </View>
            </Card.Content>
          </Card>
        </>
      )}
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
  sectionTitle: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  halfButton: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
  },
  playlistName: {
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    marginTop: 8,
    height: 8,
    borderRadius: 4,
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
  matchedNumber: {
    fontWeight: 'bold',
    color: '#4caf50',
  },
  unmatchedNumber: {
    fontWeight: 'bold',
    color: '#ff9800',
  },
  statLabel: {
    marginTop: 4,
    color: '#666',
  },
  moreText: {
    marginTop: 8,
    color: '#666',
    fontStyle: 'italic',
  },
});
