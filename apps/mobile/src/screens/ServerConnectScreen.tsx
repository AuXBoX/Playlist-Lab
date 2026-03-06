import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { setServerUrl } from '../services/api';

interface Props {
  onConnected: () => void;
}

export default function ServerConnectScreen({ onConnected }: Props) {
  const [url, setUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  async function handleConnect() {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your server address');
      return;
    }

    // Basic URL validation
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Error', 'Server address must start with http:// or https://');
      return;
    }

    setIsTesting(true);
    try {
      // Test the connection by hitting a simple endpoint
      const normalized = trimmed.replace(/\/+$/, '');
      const response = await fetch(`${normalized}/api/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Any response (even 401) means the server is reachable
      if (response.status === 401 || response.ok || response.status === 403) {
        await setServerUrl(normalized);
        onConnected();
      } else {
        Alert.alert('Connection Failed', `Server responded with status ${response.status}. Check the address and try again.`);
      }
    } catch (error: any) {
      Alert.alert(
        'Connection Failed',
        'Could not reach the server. Make sure:\n\n• The server is running\n• You\'re on the same network\n• The address is correct\n\nExample: http://192.168.1.100:3000'
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Connect to Server
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Enter your Playlist Lab server address
          </Text>

          <TextInput
            label="Server Address"
            placeholder="http://192.168.1.100:3000"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            mode="outlined"
          />

          <Text variant="bodySmall" style={styles.hint}>
            This is the address where your Playlist Lab server is running.
            You can find it in the server tray app or terminal output.
          </Text>

          <Button
            mode="contained"
            onPress={handleConnect}
            loading={isTesting}
            disabled={isTesting || !url.trim()}
            style={styles.button}
          >
            {isTesting ? 'Testing connection...' : 'Connect'}
          </Button>
        </Card.Content>
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  input: {
    marginBottom: 12,
  },
  hint: {
    color: '#999',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
