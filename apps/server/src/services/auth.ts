/**
 * Authentication Service
 * 
 * Handles Plex PIN-based OAuth authentication flow.
 * Provides methods for initiating auth, polling for completion,
 * and fetching user information and servers.
 */

import axios from 'axios';

const PLEX_API_BASE = 'https://plex.tv/api/v2';
const PLEX_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

/**
 * PIN response from Plex
 */
export interface PlexPin {
  id: number;
  code: string;
  product: string;
  trusted: boolean;
  clientIdentifier: string;
  location: {
    code: string;
    european_union_member: boolean;
    continent_code: string;
    country: string;
    city: string;
    time_zone: string;
    postal_code: string;
    in_privacy_restricted_country: boolean;
    subdivisions: string;
    coordinates: string;
  };
  expiresIn: number;
  createdAt: string;
  expiresAt: string;
  authToken: string | null;
  newRegistration: boolean | null;
}

/**
 * Plex user information
 */
export interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  title: string;
  email: string;
  friendlyName: string;
  locale: string | null;
  confirmed: boolean;
  joinedAt: string;
  emailOnlyAuth: boolean;
  hasPassword: boolean;
  protected: boolean;
  thumb: string;
  authToken: string;
  mailingListStatus: string;
  mailingListActive: boolean;
  scrobbleTypes: string;
  country: string;
  subscription: {
    active: boolean;
    status: string;
    plan: string | null;
    features: string[];
  };
  subscriptionDescription: string;
  restricted: boolean;
  anonymous: boolean | null;
  home: boolean;
  guest: boolean;
  homeSize: number;
  homeAdmin: boolean;
  maxHomeSize: number;
  rememberExpiresAt: string;
  profile: {
    autoSelectAudio: boolean;
    defaultAudioLanguage: string;
    defaultSubtitleLanguage: string;
    autoSelectSubtitle: number;
    defaultSubtitleAccessibility: number;
    defaultSubtitleForced: number;
    watchedIndicator: number;
    mediaReviewsVisibility: number;
  };
  entitlements: string[];
  roles: string[];
  services: Array<{
    identifier: string;
    endpoint: string;
    token: string | null;
    secret: string | null;
    status: string;
  }>;
  adsConsent: boolean | null;
  adsConsentSetAt: string | null;
  adsConsentReminderAt: string | null;
  experimentalFeatures: boolean;
  twoFactorEnabled: boolean;
  backupCodesCreated: boolean;
}

/**
 * Plex server resource
 */
export interface PlexServer {
  name: string;
  product: string;
  productVersion: string;
  platform: string;
  platformVersion: string;
  device: string;
  clientIdentifier: string;
  createdAt: string;
  lastSeenAt: string;
  provides: string;
  ownerId: number;
  sourceTitle: string | null;
  publicAddress: string;
  accessToken: string;
  owned: boolean;
  home: boolean;
  synced: boolean;
  relay: boolean;
  presence: boolean;
  httpsRequired: boolean;
  publicAddressMatches: boolean;
  dnsRebindingProtection: boolean;
  natLoopbackSupported: boolean;
  connections: Array<{
    protocol: string;
    address: string;
    port: number;
    uri: string;
    local: boolean;
    relay: boolean;
    IPv6: boolean;
  }>;
}

/**
 * Plex Home user (managed user)
 */
export interface PlexHomeUser {
  id: number;
  uuid: string;
  title: string;
  username: string;
  email: string;
  thumb: string;
  home: boolean;
  guest: boolean;
  restricted: boolean;
  friendlyName: string;
  admin: boolean;
  protected: boolean;
}

export class AuthService {
  private clientId: string;
  private productName: string;

  constructor(clientId: string, productName: string = 'Playlist Lab') {
    this.clientId = clientId;
    this.productName = productName;
  }

  /**
   * Start Plex PIN-based authentication
   * Creates a PIN that the user will use to authorize the app
   */
  async startAuth(): Promise<PlexPin> {
    try {
      const response = await axios.post<PlexPin>(
        `${PLEX_API_BASE}/pins?strong=true`,
        {},
        {
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Product': this.productName,
            'X-Plex-Client-Identifier': this.clientId
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to start Plex auth: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Poll for PIN authentication completion
   * Returns the PIN with authToken if user has authorized, null otherwise
   */
  async pollAuth(pinId: number, code: string): Promise<PlexPin> {
    try {
      const response = await axios.get<PlexPin>(
        `${PLEX_API_BASE}/pins/${pinId}`,
        {
          params: { code },
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Product': this.productName,
            'X-Plex-Client-Identifier': this.clientId
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to poll Plex auth: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get auth URL for user to visit
   * User will authorize the app at this URL
   */
  getAuthUrl(code: string): string {
    const params = new URLSearchParams({
      clientID: this.clientId,
      code,
      'context[device][product]': this.productName
    });

    return `https://app.plex.tv/auth#?${params.toString()}`;
  }

  /**
   * Get user information using auth token
   */
  async getUserInfo(authToken: string): Promise<PlexUser> {
    try {
      const response = await axios.get<PlexUser>(
        `${PLEX_API_BASE}/user`,
        {
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Token': authToken
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid or expired Plex token');
        }
        throw new Error(`Failed to get user info: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get user's Plex servers
   */
  async getServers(authToken: string): Promise<PlexServer[]> {
    try {
      const response = await axios.get(
        `${PLEX_API_BASE}/resources`,
        {
          params: {
            includeHttps: 1,
            includeRelay: 1
          },
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Token': authToken,
            'X-Plex-Product': this.productName,
            'X-Plex-Client-Identifier': this.clientId
          }
        }
      );

      // Response can be either an array directly or wrapped in an object
      const resources = Array.isArray(response.data) ? response.data : response.data.resources || [];

      // Filter to only return server resources (not clients)
      return resources.filter((resource: PlexServer) => 
        resource.provides && resource.provides.includes('server')
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid or expired Plex token');
        }
        throw new Error(`Failed to get servers: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get Plex Home users (managed users)
   * Requires the admin/home owner's token
   */
  async getHomeUsers(authToken: string): Promise<PlexHomeUser[]> {
    try {
      const response = await axios.get(
        `${PLEX_API_BASE}/home/users`,
        {
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Token': authToken,
            'X-Plex-Client-Identifier': this.clientId
          }
        }
      );

      // Response is an array of home users
      const users = Array.isArray(response.data) ? response.data : response.data.users || [];
      return users;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid or expired Plex token');
        }
        throw new Error(`Failed to get home users: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Switch to a managed user and get their token
   * Requires the admin/home owner's token
   * Returns the managed user's authentication token
   */
  async switchToManagedUser(adminToken: string, userId: number): Promise<string> {
    try {
      const response = await axios.post(
        `${PLEX_API_BASE}/home/users/${userId}/switch`,
        {},
        {
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Token': adminToken,
            'X-Plex-Client-Identifier': this.clientId
          }
        }
      );

      // Response includes authToken for the managed user
      return response.data.authToken;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid or expired Plex token');
        }
        throw new Error(`Failed to switch to managed user: ${error.message}`);
      }
      throw error;
    }
  }


  /**
   * Get the best connection URL for a server
   * Prefers local connections over remote
   */
  getBestServerUrl(server: PlexServer): string {
    // Prefer local connections
    const localConnection = server.connections.find(conn => conn.local && !conn.relay);
    if (localConnection) {
      return localConnection.uri;
    }

    // Fall back to remote connections
    const remoteConnection = server.connections.find(conn => !conn.local && !conn.relay);
    if (remoteConnection) {
      return remoteConnection.uri;
    }

    // Last resort: relay connection
    const relayConnection = server.connections.find(conn => conn.relay);
    if (relayConnection) {
      return relayConnection.uri;
    }

    // Fallback to public address
    return `https://${server.publicAddress}:32400`;
  }
}

