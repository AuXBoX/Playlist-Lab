import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys for storage
const SECURE_TOKEN_KEY = 'plex_auth_token';
const USER_DATA_KEY = '@playlist_lab_user';
const SERVER_DATA_KEY = '@playlist_lab_server';
const SERVER_URL_KEY = '@playlist_lab_server_url';

/**
 * Secure token storage using expo-secure-store
 * Falls back to AsyncStorage if SecureStore is unavailable
 */
export const TokenStorage = {
  async save(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
    } catch (error) {
      console.warn('SecureStore unavailable, using AsyncStorage:', error);
      await AsyncStorage.setItem(SECURE_TOKEN_KEY, token);
    }
  },

  async get(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    } catch (error) {
      console.warn('SecureStore unavailable, using AsyncStorage:', error);
      return await AsyncStorage.getItem(SECURE_TOKEN_KEY);
    }
  },

  async remove(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    } catch (error) {
      console.warn('SecureStore unavailable, using AsyncStorage:', error);
      await AsyncStorage.removeItem(SECURE_TOKEN_KEY);
    }
  },
};

/**
 * User data storage using AsyncStorage
 */
export const UserStorage = {
  async save(user: any): Promise<void> {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  },

  async get(): Promise<any | null> {
    const data = await AsyncStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  },

  async remove(): Promise<void> {
    await AsyncStorage.removeItem(USER_DATA_KEY);
  },
};

/**
 * Server data storage using AsyncStorage
 */
export const ServerStorage = {
  async save(server: any): Promise<void> {
    await AsyncStorage.setItem(SERVER_DATA_KEY, JSON.stringify(server));
  },

  async get(): Promise<any | null> {
    const data = await AsyncStorage.getItem(SERVER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  },

  async remove(): Promise<void> {
    await AsyncStorage.removeItem(SERVER_DATA_KEY);
  },
};

/**
 * Server URL storage (the Playlist Lab server address)
 */
export const ServerUrlStorage = {
  async save(url: string): Promise<void> {
    await AsyncStorage.setItem(SERVER_URL_KEY, url);
  },

  async get(): Promise<string | null> {
    return await AsyncStorage.getItem(SERVER_URL_KEY);
  },

  async remove(): Promise<void> {
    await AsyncStorage.removeItem(SERVER_URL_KEY);
  },
};

/**
 * Clear all stored data
 */
export async function clearAllStorage(): Promise<void> {
  await Promise.all([
    TokenStorage.remove(),
    UserStorage.remove(),
    ServerStorage.remove(),
    // Note: we don't clear ServerUrlStorage here — user shouldn't have to re-enter it on logout
  ]);
}
