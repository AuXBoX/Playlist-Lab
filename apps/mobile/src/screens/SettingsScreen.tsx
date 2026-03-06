import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Button,
  Card,
  List,
  ActivityIndicator,
  Dialog,
  Portal,
  TextInput,
  Switch,
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { getApiClient, getServerUrl, setServerUrl, testServerConnection } from '../services/api';
import { ServerUrlStorage } from '../services/storage';
import type { PlexServer, MatchingSettings, MixSettings } from '@playlist-lab/shared';

export default function SettingsScreen() {
  const { user, server, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [matchingSettings, setMatchingSettings] = useState<MatchingSettings | null>(null);
  const [mixSettings, setMixSettings] = useState<MixSettings | null>(null);
  const [serverDialogVisible, setServerDialogVisible] = useState(false);
  const [matchingDialogVisible, setMatchingDialogVisible] = useState(false);
  const [mixDialogVisible, setMixDialogVisible] = useState(false);
  const [serverUrlDialogVisible, setServerUrlDialogVisible] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [serverUrlError, setServerUrlError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [serversData, settingsData] = await Promise.all([
        getApiClient().getServers(),
        getApiClient().getSettings(),
      ]);
      setServers(serversData);
      setMatchingSettings(settingsData.matchingSettings);
      setMixSettings(settingsData.mixSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleServerSelect(selectedServer: PlexServer) {
    try {
      await getApiClient().selectServer(selectedServer);
      Alert.alert('Success', `Connected to ${selectedServer.name}`);
      setServerDialogVisible(false);
      // Reload to update server info
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to select server');
    }
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to logout');
          }
        },
      },
    ]);
  }

  async function handleUpdateMatchingSettings(updates: Partial<MatchingSettings>) {
    try {
      const result = await getApiClient().updateMatchingSettings(updates);
      setMatchingSettings(result.matchingSettings);
      Alert.alert('Success', 'Matching settings updated');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update settings');
    }
  }

  async function handleUpdateMixSettings(updates: Partial<MixSettings>) {
    try {
      const result = await getApiClient().updateMixSettings(updates);
      setMixSettings(result.mixSettings);
      Alert.alert('Success', 'Mix settings updated');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update settings');
    }
  }

  async function handleChangeServerUrl() {
    const trimmed = newServerUrl.trim();
    if (!trimmed) {
      setServerUrlError('Please enter a server address');
      return;
    }

    let url = trimmed;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }

    setTestingConnection(true);
    setServerUrlError(null);

    const reachable = await testServerConnection(url);
    setTestingConnection(false);

    if (!reachable) {
      setServerUrlError('Could not connect. Check the address and try again.');
      return;
    }

    await ServerUrlStorage.save(url);
    setServerUrl(url);
    setServerUrlDialogVisible(false);
    Alert.alert('Server Updated', 'Connected to new server. You may need to log in again.', [
      {
        text: 'OK',
        onPress: () => {
          // Reload settings from new server
          loadData();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Settings
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Account
          </Text>
          <List.Item
            title={user?.plexUsername || 'Not logged in'}
            description="Plex Account"
            left={(props) => <List.Icon {...props} icon="account" />}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Server Connection
          </Text>
          <List.Item
            title={getServerUrl()}
            description="Playlist Lab Server Address"
            left={(props) => <List.Icon {...props} icon="server-network" />}
            right={(props) => <List.Icon {...props} icon="pencil" />}
            onPress={() => {
              setNewServerUrl(getServerUrl());
              setServerUrlError(null);
              setServerUrlDialogVisible(true);
            }}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Server
          </Text>
          <List.Item
            title={server?.name || 'Not connected'}
            description={server?.url || 'No server selected'}
            left={(props) => <List.Icon {...props} icon="server" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setServerDialogVisible(true)}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Configuration
          </Text>
          <List.Item
            title="Matching Settings"
            description={
              matchingSettings
                ? `Threshold: ${matchingSettings.minMatchScore}%`
                : 'Configure track matching'
            }
            left={(props) => <List.Icon {...props} icon="tune" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setMatchingDialogVisible(true)}
          />
          <List.Item
            title="Mix Settings"
            description={
              mixSettings
                ? `Weekly: ${mixSettings.weeklyMix.topArtists} artists`
                : 'Configure mix generation'
            }
            left={(props) => <List.Icon {...props} icon="music-box-multiple" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setMixDialogVisible(true)}
          />
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        style={styles.button}
        onPress={handleLogout}
        buttonColor="#d32f2f"
        icon="logout"
      >
        Logout
      </Button>

      {/* Server Selection Dialog */}
      <Portal>
        <Dialog
          visible={serverDialogVisible}
          onDismiss={() => setServerDialogVisible(false)}
        >
          <Dialog.Title>Select Server</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              {servers.map((srv) => (
                <List.Item
                  key={srv.clientId}
                  title={srv.name}
                  description={srv.url}
                  onPress={() => handleServerSelect(srv)}
                  right={(props) =>
                    server?.clientId === srv.clientId ? (
                      <List.Icon {...props} icon="check" />
                    ) : null
                  }
                />
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setServerDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Matching Settings Dialog */}
      <Portal>
        <Dialog
          visible={matchingDialogVisible}
          onDismiss={() => setMatchingDialogVisible(false)}
        >
          <Dialog.Title>Matching Settings</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {matchingSettings && (
                <>
                  <TextInput
                    label="Match Threshold (%)"
                    value={matchingSettings.minMatchScore.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setMatchingSettings({
                        ...matchingSettings,
                        minMatchScore: value,
                      });
                    }}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                  />
                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium">Strip Parentheses</Text>
                    <Switch
                      value={matchingSettings.stripParentheses}
                      onValueChange={(value) =>
                        setMatchingSettings({
                          ...matchingSettings,
                          stripParentheses: value,
                        })
                      }
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium">Strip Brackets</Text>
                    <Switch
                      value={matchingSettings.stripBrackets}
                      onValueChange={(value) =>
                        setMatchingSettings({
                          ...matchingSettings,
                          stripBrackets: value,
                        })
                      }
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium">Use First Artist Only</Text>
                    <Switch
                      value={matchingSettings.useFirstArtistOnly}
                      onValueChange={(value) =>
                        setMatchingSettings({
                          ...matchingSettings,
                          useFirstArtistOnly: value,
                        })
                      }
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setMatchingDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={() => {
                if (matchingSettings) {
                  handleUpdateMatchingSettings(matchingSettings);
                  setMatchingDialogVisible(false);
                }
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Mix Settings Dialog */}
      <Portal>
        <Dialog
          visible={mixDialogVisible}
          onDismiss={() => setMixDialogVisible(false)}
        >
          <Dialog.Title>Mix Settings</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {mixSettings && (
                <>
                  <Text variant="titleSmall" style={styles.subsectionTitle}>
                    Weekly Mix
                  </Text>
                  <TextInput
                    label="Top Artists"
                    value={mixSettings.weeklyMix.topArtists.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setMixSettings({
                        ...mixSettings,
                        weeklyMix: {
                          ...mixSettings.weeklyMix,
                          topArtists: value,
                        },
                      });
                    }}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                  />
                  <TextInput
                    label="Tracks Per Artist"
                    value={mixSettings.weeklyMix.tracksPerArtist.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setMixSettings({
                        ...mixSettings,
                        weeklyMix: {
                          ...mixSettings.weeklyMix,
                          tracksPerArtist: value,
                        },
                      });
                    }}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                  />

                  <Text variant="titleSmall" style={styles.subsectionTitle}>
                    Daily Mix
                  </Text>
                  <TextInput
                    label="Recent Tracks"
                    value={mixSettings.dailyMix.recentTracks.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setMixSettings({
                        ...mixSettings,
                        dailyMix: {
                          ...mixSettings.dailyMix,
                          recentTracks: value,
                        },
                      });
                    }}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                  />
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setMixDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (mixSettings) {
                  handleUpdateMixSettings(mixSettings);
                  setMixDialogVisible(false);
                }
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Server URL Dialog */}
      <Portal>
        <Dialog
          visible={serverUrlDialogVisible}
          onDismiss={() => setServerUrlDialogVisible(false)}
        >
          <Dialog.Title>Change Server Address</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Server Address"
              placeholder="192.168.1.100:3000"
              value={newServerUrl}
              onChangeText={(text) => {
                setNewServerUrl(text);
                setServerUrlError(null);
              }}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={!!serverUrlError}
            />
            {serverUrlError && (
              <Text variant="bodySmall" style={{ color: '#d32f2f', marginTop: 4 }}>
                {serverUrlError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setServerUrlDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleChangeServerUrl}
              loading={testingConnection}
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Save'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  button: {
    marginTop: 16,
    marginBottom: 32,
  },
  dialogContent: {
    paddingHorizontal: 24,
  },
  input: {
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  subsectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
});
