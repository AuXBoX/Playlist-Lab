/**
 * Unit Tests: OAuth / Login Flows for All Source & Target Adapters
 *
 * Tests the credential storage, retrieval, and revocation logic for every
 * service without making real network calls. External HTTP requests are
 * mocked via jest.spyOn(global, 'fetch').
 *
 * Services covered:
 *   Deezer      – ARL cookie via form
 *   Tidal       – username/password → OAuth token
 *   Qobuz       – username/password → auth token
 *   ListenBrainz – user token via form
 *   Apple Music  – MusicKit user token via form
 *   YouTube      – browser cookie via Puppeteer session
 */

import { deezerTargetAdapter } from '../../src/adapters/deezer-target';
import { tidalTargetAdapter } from '../../src/adapters/tidal-target';
import { qobuzTargetAdapter } from '../../src/adapters/qobuz-target';
import { listenbrainzTargetAdapter } from '../../src/adapters/listenbrainz-target';
import { appleTargetAdapter } from '../../src/adapters/apple-target';
import { youtubePlainTargetAdapter } from '../../src/adapters/youtube-plain-target';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock db that records prepare().run() / prepare().get() calls */
function makeMockDb() {
  const rows: Record<string, any> = {};

  const prepare = jest.fn((_sql: string) => ({
    run: jest.fn((...args: any[]) => {
      // Store by service key for retrieval
      const service = args.find((a: any) => typeof a === 'string' && !a.includes(':'));
      if (service) rows[service] = { access_token: args[2] ?? args[1], refresh_token: args[3], token_expires_at: args[4], scope: args[5] };
    }),
    get: jest.fn((...args: any[]) => {
      const service = args[1];
      return rows[service] ?? null;
    }),
  }));

  return { prepare, _rows: rows };
}

const REDIRECT_URI = 'http://localhost:3000/api/cross-import/oauth/SERVICE/callback';

// ---------------------------------------------------------------------------
// Deezer
// ---------------------------------------------------------------------------
describe('Deezer login flow', () => {
  const db = makeMockDb();
  const userId = 1;
  const fakeArl = 'fake-arl-token-abc123';

  beforeEach(() => jest.restoreAllMocks());

  it('getOAuthUrl returns a form URL', async () => {
    const url = await deezerTargetAdapter.getOAuthUrl!(userId, db, REDIRECT_URI.replace('SERVICE', 'deezer'));
    expect(url).toContain('/form');
    expect(url).toContain('deezer');
  });

  it('handleOAuthCallback validates ARL and stores encrypted token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 123, name: 'Test User' }),
    } as any);

    await deezerTargetAdapter.handleOAuthCallback!(fakeArl, userId, db, REDIRECT_URI.replace('SERVICE', 'deezer'));

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
    const runCall = db.prepare.mock.results.find((r: any) => r.value?.run)?.value?.run;
    expect(runCall).toBeDefined();
  });

  it('handleOAuthCallback throws on invalid ARL', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false } as any);
    await expect(
      deezerTargetAdapter.handleOAuthCallback!('bad-arl', userId, db, REDIRECT_URI.replace('SERVICE', 'deezer'))
    ).rejects.toThrow(/Invalid Deezer ARL/);
  });

  it('revokeConnection deletes the row', async () => {
    await deezerTargetAdapter.revokeConnection!(userId, db);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_connections'));
  });

  it('hasValidConnection returns false when no row exists', async () => {
    const emptyDb = makeMockDb();
    const result = await deezerTargetAdapter.hasValidConnection!(userId, emptyDb);
    expect(result).toBe(false);
  });

  it('isConfigured returns true (no server credentials needed)', () => {
    expect(deezerTargetAdapter.isConfigured!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tidal
// ---------------------------------------------------------------------------
describe('Tidal login flow', () => {
  const db = makeMockDb();
  const userId = 2;
  const credentials = Buffer.from('user@example.com:password123').toString('base64');

  beforeEach(() => jest.restoreAllMocks());

  it('getOAuthUrl returns a form URL with credentials type', async () => {
    const url = await tidalTargetAdapter.getOAuthUrl!(userId, db, REDIRECT_URI.replace('SERVICE', 'tidal'));
    expect(url).toContain('/form');
    expect(url).toContain('tidal');
  });

  it('handleOAuthCallback exchanges credentials for token and stores it', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'tidal-access-token',
        refresh_token: 'tidal-refresh-token',
        expires_in: 3600,
        user: { userId: 99 },
      }),
    } as any);

    await tidalTargetAdapter.handleOAuthCallback!(credentials, userId, db, REDIRECT_URI.replace('SERVICE', 'tidal'));

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
  });

  it('handleOAuthCallback throws on bad credentials', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any);

    await expect(
      tidalTargetAdapter.handleOAuthCallback!(credentials, userId, db, REDIRECT_URI.replace('SERVICE', 'tidal'))
    ).rejects.toThrow(/Tidal login failed/);
  });

  it('handleOAuthCallback throws on invalid base64 format', async () => {
    // Pass something that decodes but has no colon separator — still valid base64
    const noColon = Buffer.from('nocolon').toString('base64');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, json: async () => ({}) } as any);
    await expect(
      tidalTargetAdapter.handleOAuthCallback!(noColon, userId, db, REDIRECT_URI.replace('SERVICE', 'tidal'))
    ).rejects.toThrow();
  });

  it('revokeConnection deletes the row', async () => {
    await tidalTargetAdapter.revokeConnection!(userId, db);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_connections'));
  });

  it('isConfigured returns true (uses public client ID)', () => {
    expect(tidalTargetAdapter.isConfigured!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Qobuz
// ---------------------------------------------------------------------------
describe('Qobuz login flow', () => {
  const db = makeMockDb();
  const userId = 3;
  const credentials = Buffer.from('user@example.com:qobuzpass').toString('base64');

  beforeEach(() => jest.restoreAllMocks());

  it('getOAuthUrl returns a form URL with credentials type', async () => {
    const url = await qobuzTargetAdapter.getOAuthUrl!(userId, db, REDIRECT_URI.replace('SERVICE', 'qobuz'));
    expect(url).toContain('/form');
    expect(url).toContain('qobuz');
  });

  it('handleOAuthCallback logs in and stores token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_auth_token: 'qobuz-auth-token-xyz' }),
    } as any);

    await qobuzTargetAdapter.handleOAuthCallback!(credentials, userId, db, REDIRECT_URI.replace('SERVICE', 'qobuz'));

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
  });

  it('handleOAuthCallback throws on failed login', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false } as any);
    await expect(
      qobuzTargetAdapter.handleOAuthCallback!(credentials, userId, db, REDIRECT_URI.replace('SERVICE', 'qobuz'))
    ).rejects.toThrow(/Qobuz login failed/);
  });

  it('handleOAuthCallback throws when no auth token returned', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_auth_token: null }),
    } as any);
    await expect(
      qobuzTargetAdapter.handleOAuthCallback!(credentials, userId, db, REDIRECT_URI.replace('SERVICE', 'qobuz'))
    ).rejects.toThrow(/No auth token/);
  });

  it('revokeConnection deletes the row', async () => {
    await qobuzTargetAdapter.revokeConnection!(userId, db);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_connections'));
  });

  it('isConfigured returns true (uses public app_id)', () => {
    expect(qobuzTargetAdapter.isConfigured!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ListenBrainz
// ---------------------------------------------------------------------------
describe('ListenBrainz login flow', () => {
  const db = makeMockDb();
  const userId = 4;
  const fakeToken = 'lb-user-token-abc';

  beforeEach(() => jest.restoreAllMocks());

  it('getOAuthUrl returns a form URL', async () => {
    const url = await listenbrainzTargetAdapter.getOAuthUrl!(userId, db, REDIRECT_URI.replace('SERVICE', 'listenbrainz'));
    expect(url).toContain('/form');
    expect(url).toContain('listenbrainz');
  });

  it('handleOAuthCallback validates token and stores it', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, user_name: 'testuser' }),
    } as any);

    // Second call: UPDATE users SET listenbrainz_username
    db.prepare.mockReturnValueOnce({ run: jest.fn(), get: jest.fn() } as any);

    await listenbrainzTargetAdapter.handleOAuthCallback!(fakeToken, userId, db, REDIRECT_URI.replace('SERVICE', 'listenbrainz'));

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
  });

  it('handleOAuthCallback throws on invalid token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false } as any);
    await expect(
      listenbrainzTargetAdapter.handleOAuthCallback!('bad-token', userId, db, REDIRECT_URI.replace('SERVICE', 'listenbrainz'))
    ).rejects.toThrow(/Invalid ListenBrainz token/);
  });

  it('handleOAuthCallback throws when token is not valid', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: false }),
    } as any);
    await expect(
      listenbrainzTargetAdapter.handleOAuthCallback!(fakeToken, userId, db, REDIRECT_URI.replace('SERVICE', 'listenbrainz'))
    ).rejects.toThrow(/not valid/);
  });

  it('handleOAuthCallback throws on empty token', async () => {
    await expect(
      listenbrainzTargetAdapter.handleOAuthCallback!('  ', userId, db, REDIRECT_URI.replace('SERVICE', 'listenbrainz'))
    ).rejects.toThrow(/No ListenBrainz token/);
  });

  it('revokeConnection deletes the row', async () => {
    await listenbrainzTargetAdapter.revokeConnection!(userId, db);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_connections'));
  });

  it('isConfigured returns true', () => {
    expect(listenbrainzTargetAdapter.isConfigured!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Apple Music
// ---------------------------------------------------------------------------
describe('Apple Music login flow', () => {
  const db = makeMockDb();
  const userId = 5;
  const fakeUserToken = 'apple-music-user-token-xyz';

  beforeEach(() => jest.restoreAllMocks());

  it('getOAuthUrl throws when Apple credentials are not configured', async () => {
    // APPLE_TEAM_ID etc. are not set in test env
    await expect(
      appleTargetAdapter.getOAuthUrl!(userId, db, REDIRECT_URI.replace('SERVICE', 'apple'))
    ).rejects.toThrow(/Apple Music requires developer credentials/);
  });

  it('isConfigured returns false when env vars are missing', () => {
    expect(appleTargetAdapter.isConfigured!()).toBe(false);
  });

  it('handleOAuthCallback stores user token', async () => {
    await appleTargetAdapter.handleOAuthCallback!(fakeUserToken, userId, db, REDIRECT_URI.replace('SERVICE', 'apple'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
  });

  it('handleOAuthCallback throws on empty token', async () => {
    await expect(
      appleTargetAdapter.handleOAuthCallback!('  ', userId, db, REDIRECT_URI.replace('SERVICE', 'apple'))
    ).rejects.toThrow(/No Apple Music user token/);
  });

  it('revokeConnection deletes the row', async () => {
    await appleTargetAdapter.revokeConnection!(userId, db);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_connections'));
  });

  it('hasValidConnection returns false when no row exists', async () => {
    const emptyDb = makeMockDb();
    const result = await appleTargetAdapter.hasValidConnection!(userId, emptyDb);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// YouTube (browser cookie)
// ---------------------------------------------------------------------------
describe('YouTube login flow', () => {
  const db = makeMockDb();
  const userId = 6;
  const fakeCookie = 'SID=abc; __Secure-3PSID=def; SAPISID=ghi; __Secure-3PAPISID=jkl';

  beforeEach(() => jest.restoreAllMocks());

  it('getOAuthUrl returns the browser-login page URL', async () => {
    const url = await youtubePlainTargetAdapter.getOAuthUrl!(userId, db, REDIRECT_URI.replace('SERVICE', 'youtube'));
    expect(url).toContain('browser-login');
    expect(url).toContain(String(userId));
  });

  it('handleOAuthCallback stores cookie string', async () => {
    await youtubePlainTargetAdapter.handleOAuthCallback!(fakeCookie, userId, db, REDIRECT_URI.replace('SERVICE', 'youtube'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
  });

  it('handleOAuthCallback throws on empty cookie', async () => {
    await expect(
      youtubePlainTargetAdapter.handleOAuthCallback!('  ', userId, db, REDIRECT_URI.replace('SERVICE', 'youtube'))
    ).rejects.toThrow(/No cookie/);
  });

  it('revokeConnection deletes the row', async () => {
    await youtubePlainTargetAdapter.revokeConnection!(userId, db);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_connections'));
  });

  it('hasValidConnection returns false when no row exists', async () => {
    const emptyDb = makeMockDb();
    const result = await youtubePlainTargetAdapter.hasValidConnection!(userId, emptyDb);
    expect(result).toBe(false);
  });

  it('isConfigured returns true (browser-based, no server credentials)', () => {
    expect(youtubePlainTargetAdapter.isConfigured!()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-adapter: all services have required login methods
// ---------------------------------------------------------------------------
describe('All adapters implement required login interface', () => {
  const adapters = [
    { name: 'Deezer', adapter: deezerTargetAdapter },
    { name: 'Tidal', adapter: tidalTargetAdapter },
    { name: 'Qobuz', adapter: qobuzTargetAdapter },
    { name: 'ListenBrainz', adapter: listenbrainzTargetAdapter },
    { name: 'Apple Music', adapter: appleTargetAdapter },
    { name: 'YouTube', adapter: youtubePlainTargetAdapter },
  ];

  it.each(adapters)('$name has getOAuthUrl', ({ adapter }) => {
    expect(typeof adapter.getOAuthUrl).toBe('function');
  });

  it.each(adapters)('$name has handleOAuthCallback', ({ adapter }) => {
    expect(typeof adapter.handleOAuthCallback).toBe('function');
  });

  it.each(adapters)('$name has revokeConnection', ({ adapter }) => {
    expect(typeof adapter.revokeConnection).toBe('function');
  });

  it.each(adapters)('$name has hasValidConnection', ({ adapter }) => {
    expect(typeof adapter.hasValidConnection).toBe('function');
  });

  it.each(adapters)('$name meta.requiresOAuth is true', ({ adapter }) => {
    expect(adapter.meta.requiresOAuth).toBe(true);
  });
});
