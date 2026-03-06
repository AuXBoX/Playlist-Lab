import React, { useState } from 'react';
import { View, StyleSheet, Linking, Alert } from 'react-native';
import { Text, Button, Card, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { getApiClient } from '../services/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinId, setPinId] = useState<number | null>(null);

  async function handlePlexLogin() {
    try {
      setIsLoading(true);

      // Step 1: Start auth and get PIN
      const pinData = await getApiClient().startAuth();
      setPinCode(pinData.code);
      setPinId(pinData.id);

      // Step 2: Open Plex auth page in browser
      const authUrl = `https://app.plex.tv/auth#?clientID=playlist-lab-mobile&code=${pinData.code}&context[device][product]=Playlist Lab`;
      const canOpen = await Linking.canOpenURL(authUrl);
      
      if (canOpen) {
        await Linking.openURL(authUrl);
      } else {
        Alert.alert('Error', 'Cannot open Plex authentication page');
        setIsLoading(false);
        return;
      }

      // Step 3: Poll for auth completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes (5 second intervals)
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          setIsLoading(false);
          setPinCode(null);
          setPinId(null);
          Alert.alert('Timeout', 'Authentication timed out. Please try again.');
          return;
        }

        try {
          await login(pinData.id, pinData.code);
          clearInterval(pollInterval);
          setIsLoading(false);
          // Navigation will happen automatically via AuthContext
        } catch (error: any) {
          // Continue polling if not authenticated yet
          if (error.message !== 'Not authenticated yet') {
            clearInterval(pollInterval);
            setIsLoading(false);
            setPinCode(null);
            setPinId(null);
            Alert.alert('Error', error.message || 'Authentication failed');
          }
        }
      }, 5000); // Poll every 5 seconds
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Failed to start authentication');
    }
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineLarge" style={styles.title}>
            Playlist Lab
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in with your Plex account to get started
          </Text>
          
          {isLoading && pinCode && (
            <View style={styles.pinContainer}>
              <Text variant="bodyMedium" style={styles.pinLabel}>
                Enter this code on the Plex website:
              </Text>
              <Text variant="displaySmall" style={styles.pinCode}>
                {pinCode}
              </Text>
              <ActivityIndicator size="large" style={styles.loader} />
              <Text variant="bodySmall" style={styles.waitingText}>
                Waiting for authentication...
              </Text>
            </View>
          )}
          
          <Button
            mode="contained"
            style={styles.button}
            onPress={handlePlexLogin}
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Sign in with Plex'}
          </Button>
        </Card.Content>
      </Card>
    </View>
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
  pinContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  pinLabel: {
    marginBottom: 8,
    color: '#666',
  },
  pinCode: {
    fontWeight: 'bold',
    color: '#1DB954',
    letterSpacing: 4,
  },
  loader: {
    marginTop: 16,
  },
  waitingText: {
    marginTop: 8,
    color: '#999',
  },
  button: {
    marginTop: 16,
  },
});
