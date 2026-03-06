import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ImportScreen from '../screens/ImportScreen';
import GenerateScreen from '../screens/GenerateScreen';
import PlaylistsScreen from '../screens/PlaylistsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import ServerConnectScreen from '../screens/ServerConnectScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// iOS-style bottom tabs
function IOSTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4fc3f7',
        tabBarInactiveTintColor: '#7a8fa3',
        tabBarStyle: {
          backgroundColor: '#0c1420',
          borderTopWidth: 1,
          borderTopColor: '#1a2a3a',
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: '#0c1420',
        },
        headerTintColor: '#e8edf2',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Import"
        component={ImportScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="download" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Generate"
        component={GenerateScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="auto-fix" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="playlist-music" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Android-style drawer navigation
function AndroidDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: '#4fc3f7',
        drawerInactiveTintColor: '#7a8fa3',
        drawerStyle: {
          backgroundColor: '#0c1420',
        },
        headerStyle: {
          backgroundColor: '#0c1420',
        },
        headerTintColor: '#e8edf2',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
          drawerLabel: 'Home',
        }}
      />
      <Drawer.Screen
        name="Import"
        component={ImportScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="download" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Generate"
        component={GenerateScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="auto-fix" size={size} color={color} />
          ),
          drawerLabel: 'Generate Mixes',
        }}
      />
      <Drawer.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="playlist-music" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

// Platform-specific main navigation
function MainNavigation() {
  return Platform.OS === 'ios' ? <IOSTabs /> : <AndroidDrawer />;
}

interface AppNavigatorProps {
  initialHasServerUrl: boolean;
}

export default function AppNavigator({ initialHasServerUrl }: AppNavigatorProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [hasServerUrl, setHasServerUrl] = useState(initialHasServerUrl);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4fc3f7" />
      </View>
    );
  }

  // No server URL configured — show connect screen
  if (!hasServerUrl) {
    return (
      <ServerConnectScreen
        onConnected={() => setHasServerUrl(true)}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigation} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a1018',
  },
});
