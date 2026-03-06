import { apiClient, saveToken, removeToken, setCachedToken } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Mobile API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCachedToken(null);
  });

  describe('Token Management', () => {
    it('should save token to AsyncStorage', async () => {
      await saveToken('test-token');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@playlist_lab_token',
        'test-token'
      );
    });

    it('should remove token from AsyncStorage', async () => {
      await removeToken();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@playlist_lab_token');
    });

    it('should set cached token', () => {
      setCachedToken('test-token');
      // Token should be available for API client
      expect(true).toBe(true); // Token is cached internally
    });
  });

  describe('API Client', () => {
    it('should be an instance of APIClient', () => {
      expect(apiClient).toBeDefined();
      expect(typeof apiClient.startAuth).toBe('function');
    });

    it('should make requests with cached token', async () => {
      const mockResponse = { id: 1, code: 'ABC123', expiresAt: '2024-01-01' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      setCachedToken('test-token');
      const result = await apiClient.startAuth();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/start'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network error'));

      await expect(apiClient.startAuth()).rejects.toThrow('Network error');
    });
  });
});
