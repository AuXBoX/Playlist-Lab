import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import AppNavigator from './src/navigation/AppNavigator';
import OfflineIndicator from './src/components/OfflineIndicator';
import { initializeAPI } from './src/services/api';

export default function App() {
  const [apiReady, setApiReady] = useState(false);
  const [hasServerUrl, setHasServerUrl] = useState(false);

  useEffect(() => {
    async function init() {
      const configured = await initializeAPI();
      setHasServerUrl(configured);
      setApiReady(true);
    }
    init();
  }, []);

  if (!apiReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <AuthProvider>
          <OfflineProvider>
            <OfflineIndicator />
            <AppNavigator initialHasServerUrl={hasServerUrl} />
            <StatusBar style="auto" />
          </OfflineProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
