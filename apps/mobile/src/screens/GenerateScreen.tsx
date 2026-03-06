import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  List,
  Divider,
} from 'react-native-paper';
import { getApiClient } from '../services/api';
import type { MixSettings } from '@playlist-lab/shared';

type MixType = 'weekly' | 'daily' | 'timecapsule' | 'newmusic' | 'all';

export default function GenerateScreen() {
  const [generating, setGenerating] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [mixSettings, setMixSettings] = useState<MixSettings | null>(null);
  const [currentMix, setCurrentMix] = useState<MixType | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const settings = await getApiClient().getSettings();
      setMixSettings(settings.mixSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function handleGenerate(type: MixType) {
    setGenerating(true);
    setCurrentMix(type);

    try {
      let result;
      switch (type) {
        case 'weekly':
          result = await getApiClient().generateWeeklyMix();
          Alert.alert('Success', `Weekly Mix "${result.name}" created!`);
          break;
        case 'daily':
          result = await getApiClient().generateDailyMix();
          Alert.alert('Success', `Daily Mix "${result.name}" created!`);
          break;
        case 'timecapsule':
          result = await getApiClient().generateTimeCapsule();
          Alert.alert('Success', `Time Capsule "${result.name}" created!`);
          break;
        case 'newmusic':
          result = await getApiClient().generateNewMusicMix();
          Alert.alert('Success', `New Music Mix "${result.name}" created!`);
          break;
        case 'all':
          const results = await getApiClient().generateAllMixes();
          Alert.alert(
            'Success',
            `Generated ${results.length} mixes successfully!`
          );
          break;
      }
    } catch (error: any) {
      Alert.alert(
        'Generation Failed',
        error.message || 'Failed to generate mix'
      );
    } finally {
      setGenerating(false);
      setCurrentMix(null);
    }
  }

  const mixes = [
    {
      id: 'weekly' as MixType,
      name: 'Weekly Mix',
      description: 'Tracks from your most-played artists',
      icon: 'calendar-week',
      settings: mixSettings?.weeklyMix
        ? `${mixSettings.weeklyMix.topArtists} artists, ${mixSettings.weeklyMix.tracksPerArtist} tracks each`
        : null,
    },
    {
      id: 'daily' as MixType,
      name: 'Daily Mix',
      description: 'Recent plays, related tracks, and rediscoveries',
      icon: 'calendar-today',
      settings: mixSettings?.dailyMix
        ? `${mixSettings.dailyMix.recentTracks + mixSettings.dailyMix.relatedTracks + mixSettings.dailyMix.rediscoveryTracks} total tracks`
        : null,
    },
    {
      id: 'timecapsule' as MixType,
      name: 'Time Capsule',
      description: 'Tracks you haven\'t heard in a while',
      icon: 'history',
      settings: mixSettings?.timeCapsule
        ? `${mixSettings.timeCapsule.trackCount} tracks from ${mixSettings.timeCapsule.daysAgo} days ago`
        : null,
    },
    {
      id: 'newmusic' as MixType,
      name: 'New Music Mix',
      description: 'Recently added albums',
      icon: 'new-box',
      settings: mixSettings?.newMusic
        ? `${mixSettings.newMusic.albumCount} albums, ${mixSettings.newMusic.tracksPerAlbum} tracks each`
        : null,
    },
  ];

  if (loadingSettings) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (generating) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Generating {currentMix === 'all' ? 'all mixes' : `${currentMix} mix`}
          ...
        </Text>
        <Text variant="bodySmall" style={styles.loadingSubtext}>
          This may take a moment
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Generate Mixes
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Mixes
          </Text>
          <Text variant="bodySmall" style={styles.description}>
            Generate personalized playlists based on your listening history
          </Text>
        </Card.Content>
      </Card>

      {mixes.map((mix, index) => (
        <React.Fragment key={mix.id}>
          <Card style={styles.card}>
            <Card.Content>
              <List.Item
                title={mix.name}
                description={mix.description}
                left={(props) => <List.Icon {...props} icon={mix.icon} />}
              />
              {mix.settings && (
                <Text variant="bodySmall" style={styles.settingsText}>
                  Settings: {mix.settings}
                </Text>
              )}
              <Button
                mode="contained"
                style={styles.generateButton}
                onPress={() => handleGenerate(mix.id)}
                icon="play"
              >
                Generate
              </Button>
            </Card.Content>
          </Card>
          {index < mixes.length - 1 && <Divider style={styles.divider} />}
        </React.Fragment>
      ))}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Generate All
          </Text>
          <Text variant="bodySmall" style={styles.description}>
            Generate all personal mixes at once
          </Text>
          <Button
            mode="contained"
            style={styles.generateButton}
            onPress={() => handleGenerate('all')}
            icon="playlist-music"
            buttonColor="#6200ee"
          >
            Generate All Mixes
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Mix Settings
          </Text>
          <Text variant="bodySmall" style={styles.description}>
            Customize mix generation in Settings
          </Text>
          <Button
            mode="outlined"
            style={styles.generateButton}
            icon="cog"
            onPress={() => {
              // TODO: Navigate to mix settings
            }}
          >
            Configure Settings
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
  sectionTitle: {
    marginBottom: 8,
  },
  description: {
    color: '#666',
    marginBottom: 12,
  },
  settingsText: {
    color: '#999',
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  generateButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 8,
  },
  loadingText: {
    marginTop: 16,
  },
  loadingSubtext: {
    marginTop: 8,
    color: '#666',
  },
});
