import { APIClient } from '@playlist-lab/shared';
import { ServerUrlStorage } from './storage';

// In-memory cached token (APIClient needs sync getter)
let cachedToken: string | null = null;

export function setCachedToken(token: string | null) {
  cachedToken = token;
}

// In-memory cached server URL for sync access
let cachedServerUrl: string = '';

// The API client instance — recreated when server URL changes
let apiClient: APIClient = new APIClient('', () => cachedToken);

export function getApiClient(): APIClient {
  return apiClient;
}

/**
 * Get the current server URL (sync, from memory cache).
 */
export function getServerUrl(): string {
  return cachedServerUrl;
}

/**
 * Set the server URL, save to storage, and recreate the API client.
 */
export async function setServerUrl(url: string): Promise<void> {
  const normalized = url.replace(/\/+$/, '');
  cachedServerUrl = normalized;
  await ServerUrlStorage.save(normalized);
  apiClient = new APIClient(normalized, () => cachedToken);
}

/**
 * Test if a server URL is reachable.
 * Returns true if the server responds (even with 401).
 */
export async function testServerConnection(url: string): Promise<boolean> {
  try {
    const normalized = url.replace(/\/+$/, '');
    const response = await fetch(`${normalized}/api/auth/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    // Any HTTP response means the server is reachable
    return response.status === 401 || response.ok || response.status === 403;
  } catch {
    return false;
  }
}

/**
 * Initialize the API client from stored server URL.
 * Returns true if a server URL was found, false if user needs to configure one.
 */
export async function initializeAPI(): Promise<boolean> {
  const url = await ServerUrlStorage.get();
  if (url) {
    cachedServerUrl = url;
    apiClient = new APIClient(url, () => cachedToken);
    return true;
  }
  return false;
}

// Re-export for backward compat
export { apiClient };
