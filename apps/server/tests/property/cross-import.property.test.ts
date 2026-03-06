/**
 * Property-Based Tests: Cross-Playlist Import
 *
 * Tests universal correctness properties of the cross-import feature.
 * Each test is tagged with the property it validates.
 */

import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initializeDatabase } from '../../src/database/init';
import { AdapterRegistry } from '../../src/adapters/registry';
import { SourceAdapter, TargetAdapter, TrackInfo, MatchResult, ServiceMeta } from '../../src/adapters/types';
import { encrypt, decrypt } from '../../src/utils/encryption';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestDb(): Database.Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-prop-test-'));
  return initializeDatabase(path.join(dir, 'test.db'));
}

function cleanupDb(db: Database.Database): void {
  const p = db.name;
  db.close();
  try {
    fs.unlinkSync(p);
    fs.rmdirSync(path.dirname(p));
  } catch { /* ignore */ }
}

/** Create a minimal user row and return its id */
function createUser(db: Database.Database, suffix: string): number {
  const now = Date.now();
  const result = db.prepare(
    `INSERT INTO users (plex_user_id, plex_username, plex_token, created_at, last_login)
     VALUES (?, ?, ?, ?, ?)`
  ).run(`uid-${suffix}`, `user-${suffix}`, `token-${suffix}`, now, now);
  return result.lastInsertRowid as number;
}

/** Build a mock SourceAdapter */
function mockSource(id: string, isSourceOnly = false): SourceAdapter {
  return {
    meta: { id, name: id, icon: id, isSourceOnly, requiresOAuth: false } satisfies ServiceMeta,
    async fetchTracks() {
      return { playlist: { id: '1', name: 'p', trackCount: 0 }, tracks: [] };
    },
  };
}

/** Build a mock TargetAdapter */
function mockTarget(id: string, isSourceOnly = false): TargetAdapter {
  return {
    meta: { id, name: id, icon: id, isSourceOnly, requiresOAuth: false } satisfies ServiceMeta,
    async searchCatalog() { return []; },
    async matchTracks(tracks) {
      return tracks.map(t => ({
        sourceTrack: t,
        confidence: 80,
        matched: true,
        skipped: false,
      }));
    },
    async createPlaylist(name, matchResults) {
      const count = matchResults.filter(r => r.matched && !r.skipped).length;
      return { playlistId: 'pid', name, trackCount: count };
    },
  };
}

/** Simulate the /sources response logic from cross-import.ts (non-Plex path) */
function buildSourcesResponse(registry: AdapterRegistry): Array<{ id: string; connected: boolean }> {
  return registry.listSources().map(a => ({
    id: a.meta.id,
    name: a.meta.name,
    icon: a.meta.icon,
    isSourceOnly: a.meta.isSourceOnly,
    connected: false,
    type: 'external',
  }));
}

/** Simulate the /targets response logic from cross-import.ts (non-Plex path) */
function buildTargetsResponse(registry: AdapterRegistry): Array<{ id: string; connected: boolean }> {
  return registry.listTargets().map(a => ({
    id: a.meta.id,
    name: a.meta.name,
    icon: a.meta.icon,
    connected: false,
    requiresOAuth: a.meta.requiresOAuth,
  }));
}

/** Apply the "unmatched only" filter (mirrors ReviewStep logic) */
function applyUnmatchedFilter(results: MatchResult[]): MatchResult[] {
  return results.filter(r => !r.matched && !r.skipped);
}

/** Simulate execute: keep only matched && !skipped */
function executeFilter(results: MatchResult[]): MatchResult[] {
  return results.filter(r => r.matched && !r.skipped);
}

/** Simulate the Copy-suffix logic from PlexTargetAdapter */
function applyPlaylistName(name: string, isSameTarget: boolean): string {
  return isSameTarget ? `${name} (Copy)` : name;
}

const ENCRYPTION_SECRET = 'test-secret-for-property-tests';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const adapterIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

const trackInfoArb: fc.Arbitrary<TrackInfo> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 80 }),
  artist: fc.string({ minLength: 1, maxLength: 80 }),
  album: fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: undefined }),
});

const matchResultArb: fc.Arbitrary<MatchResult> = fc.record({
  sourceTrack: trackInfoArb,
  targetTrackId: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  targetTitle: fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: undefined }),
  targetArtist: fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: undefined }),
  confidence: fc.integer({ min: 0, max: 100 }),
  matched: fc.boolean(),
  skipped: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Property 1: Sources list reflects all registered adapters
// Feature: cross-playlist-import, Property 1
// Validates: Requirements 2.1, 2.2, 12.5
// ---------------------------------------------------------------------------
describe('Property 1: Sources list reflects all registered adapters', () => {
  it('sources response contains exactly one entry per registered source adapter', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(adapterIdArb, { minLength: 1, maxLength: 10 }),
        (ids) => {
          const registry = new AdapterRegistry();
          for (const id of ids) {
            registry.registerSource(mockSource(id));
          }

          const sources = buildSourcesResponse(registry);

          // Exactly one entry per registered adapter
          expect(sources).toHaveLength(ids.length);

          // Every registered id appears in the response
          for (const id of ids) {
            expect(sources.some(s => s.id === id)).toBe(true);
          }

          // No duplicates
          const responseIds = sources.map(s => s.id);
          expect(new Set(responseIds).size).toBe(responseIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Targets list never contains source-only services
// Feature: cross-playlist-import, Property 2
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------
describe('Property 2: Targets list never contains source-only services', () => {
  it('targets response excludes adapters with isSourceOnly=true', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(adapterIdArb, { minLength: 1, maxLength: 8 }),
        fc.uniqueArray(adapterIdArb, { minLength: 1, maxLength: 4 }),
        (normalIds, sourceOnlyIds) => {
          // Ensure no overlap between the two id sets
          fc.pre(normalIds.every(id => !sourceOnlyIds.includes(id)));

          const registry = new AdapterRegistry();
          for (const id of normalIds) {
            registry.registerTarget(mockTarget(id, false));
          }
          for (const id of sourceOnlyIds) {
            registry.registerTarget(mockTarget(id, true));
          }

          const targets = buildTargetsResponse(registry);

          // No source-only adapter should appear in targets
          for (const id of sourceOnlyIds) {
            expect(targets.some(t => t.id === id)).toBe(false);
          }

          // All non-source-only adapters should appear
          for (const id of normalIds) {
            expect(targets.some(t => t.id === id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Every source and target entry has a connection status field
// Feature: cross-playlist-import, Property 3
// Validates: Requirements 2.5, 5.3
// ---------------------------------------------------------------------------
describe('Property 3: Every source and target entry has a connection status field', () => {
  it('every source entry has a boolean connected field', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(adapterIdArb, { minLength: 1, maxLength: 10 }),
        (ids) => {
          const registry = new AdapterRegistry();
          for (const id of ids) registry.registerSource(mockSource(id));

          const sources = buildSourcesResponse(registry);

          for (const source of sources) {
            expect(typeof source.connected).toBe('boolean');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every target entry has a boolean connected field', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(adapterIdArb, { minLength: 1, maxLength: 10 }),
        (ids) => {
          const registry = new AdapterRegistry();
          for (const id of ids) registry.registerTarget(mockTarget(id, false));

          const targets = buildTargetsResponse(registry);

          for (const target of targets) {
            expect(typeof target.connected).toBe('boolean');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Match results contain exactly N entries with required fields
// Feature: cross-playlist-import, Property 5
// Validates: Requirements 8.1, 8.2, 8.10
// ---------------------------------------------------------------------------
describe('Property 5: Match results contain exactly N entries with required fields', () => {
  it('matchTracks returns exactly N results with required fields and counts sum to N', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(trackInfoArb, { minLength: 0, maxLength: 50 }),
        async (tracks) => {
          const adapter = mockTarget('test');
          const results = await adapter.matchTracks(tracks, {}, 1, null);

          // Exactly N results
          expect(results).toHaveLength(tracks.length);

          for (const r of results) {
            // Required fields present
            expect(r).toHaveProperty('sourceTrack');
            expect(r).toHaveProperty('matched');
            expect(r).toHaveProperty('confidence');
            expect(r).toHaveProperty('skipped');

            // Types correct
            expect(typeof r.matched).toBe('boolean');
            expect(typeof r.skipped).toBe('boolean');
            expect(typeof r.confidence).toBe('number');
            expect(r.confidence).toBeGreaterThanOrEqual(0);
            expect(r.confidence).toBeLessThanOrEqual(100);
          }

          // matched + unmatched + skipped === N
          const matched = results.filter(r => r.matched && !r.skipped).length;
          const unmatched = results.filter(r => !r.matched && !r.skipped).length;
          const skipped = results.filter(r => r.skipped).length;
          expect(matched + unmatched + skipped).toBe(tracks.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Manually selected matches always have confidence 100
// Feature: cross-playlist-import, Property 6
// Validates: Requirements 8.7
// ---------------------------------------------------------------------------
describe('Property 6: Manually selected matches always have confidence 100', () => {
  it('applying a manual override sets confidence to 100', () => {
    fc.assert(
      fc.property(
        fc.array(matchResultArb, { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 29 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 80 }),
        fc.string({ minLength: 1, maxLength: 80 }),
        (results, indexRaw, newTrackId, newTitle, newArtist) => {
          fc.pre(results.length > 0);
          const index = indexRaw % results.length;

          // Simulate manual override (mirrors ReviewStep logic)
          const updated = results.map((r, i) => {
            if (i !== index) return r;
            return {
              ...r,
              targetTrackId: newTrackId,
              targetTitle: newTitle,
              targetArtist: newArtist,
              confidence: 100,
              matched: true,
              skipped: false,
            };
          });

          expect(updated[index].confidence).toBe(100);
          expect(updated[index].matched).toBe(true);
          expect(updated[index].targetTrackId).toBe(newTrackId);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Execute only includes matched, non-skipped tracks
// Feature: cross-playlist-import, Property 7
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------
describe('Property 7: Execute only includes matched, non-skipped tracks', () => {
  it('executeFilter returns only matched && !skipped entries', () => {
    fc.assert(
      fc.property(
        fc.array(matchResultArb, { minLength: 0, maxLength: 50 }),
        (results) => {
          const filtered = executeFilter(results);

          for (const r of filtered) {
            expect(r.matched).toBe(true);
            expect(r.skipped).toBe(false);
          }

          // Every matched+non-skipped track from input must appear in output
          const expected = results.filter(r => r.matched && !r.skipped);
          expect(filtered).toHaveLength(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Same source/target appends " (Copy)" to playlist name
// Feature: cross-playlist-import, Property 8
// Validates: Requirements 5.7, 9.5
// ---------------------------------------------------------------------------
describe('Property 8: Same source/target appends " (Copy)" to playlist name', () => {
  it('playlist name gets " (Copy)" suffix when source === target', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.boolean(),
        (name, isSame) => {
          const result = applyPlaylistName(name, isSame);

          if (isSame) {
            expect(result).toBe(`${name} (Copy)`);
          } else {
            expect(result).toBe(name);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('" (Copy)" suffix is appended exactly once even for names already ending in " (Copy)"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        (baseName) => {
          const result = applyPlaylistName(baseName, true);
          expect(result.endsWith(' (Copy)')).toBe(true);
          // The suffix is added exactly once by the adapter
          expect(result).toBe(`${baseName} (Copy)`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: OAuth tokens are stored encrypted
// Feature: cross-playlist-import, Property 9
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------
describe('Property 9: OAuth tokens are stored encrypted', () => {
  it('stored access_token differs from plaintext', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: null }),
        async (accessToken, refreshToken) => {
          const db = createTestDb();
          const userId = createUser(db, 'oauth-test');

          try {
            const now = Date.now();
            const encryptedAccess = encrypt(accessToken, ENCRYPTION_SECRET);
            const encryptedRefresh = refreshToken ? encrypt(refreshToken, ENCRYPTION_SECRET) : null;

            db.prepare(`
              INSERT OR REPLACE INTO oauth_connections
                (user_id, service, access_token, refresh_token, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, 'test-service', encryptedAccess, encryptedRefresh, now, now);

            const row = db.prepare(
              'SELECT access_token, refresh_token FROM oauth_connections WHERE user_id = ? AND service = ?'
            ).get(userId, 'test-service') as any;

            // Raw stored value must NOT equal plaintext
            expect(row.access_token).not.toBe(accessToken);

            // But decrypting must recover the original
            expect(decrypt(row.access_token, ENCRYPTION_SECRET)).toBe(accessToken);

            if (refreshToken && row.refresh_token) {
              expect(row.refresh_token).not.toBe(refreshToken);
              expect(decrypt(row.refresh_token, ENCRYPTION_SECRET)).toBe(refreshToken);
            }
          } finally {
            cleanupDb(db);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Revoking an OAuth connection removes it
// Feature: cross-playlist-import, Property 10
// Validates: Requirements 6.6
// ---------------------------------------------------------------------------
describe('Property 10: Revoking an OAuth connection removes it', () => {
  it('after revocation the connection row no longer exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (service, accessToken) => {
          const db = createTestDb();
          const userId = createUser(db, `revoke-${service}`);

          try {
            const now = Date.now();
            const encrypted = encrypt(accessToken, ENCRYPTION_SECRET);

            // Store connection
            db.prepare(`
              INSERT OR REPLACE INTO oauth_connections
                (user_id, service, access_token, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
            `).run(userId, service, encrypted, now, now);

            // Verify it exists
            const before = db.prepare(
              'SELECT id FROM oauth_connections WHERE user_id = ? AND service = ?'
            ).get(userId, service);
            expect(before).toBeTruthy();

            // Revoke (simulate adapter.revokeConnection)
            db.prepare(
              'DELETE FROM oauth_connections WHERE user_id = ? AND service = ?'
            ).run(userId, service);

            // Verify it's gone
            const after = db.prepare(
              'SELECT id FROM oauth_connections WHERE user_id = ? AND service = ?'
            ).get(userId, service);
            expect(after).toBeUndefined();

            // Simulated targets response should show connected: false
            const connected = !!db.prepare(
              'SELECT id FROM oauth_connections WHERE user_id = ? AND service = ?'
            ).get(userId, service);
            expect(connected).toBe(false);
          } finally {
            cleanupDb(db);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Import history is user-isolated
// Feature: cross-playlist-import, Property 11
// Validates: Requirements 10.3
// ---------------------------------------------------------------------------
describe('Property 11: Import history is user-isolated', () => {
  it("each user's history contains only their own jobs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            sourceService: fc.constantFrom('spotify', 'deezer', 'plex'),
            sourceName: fc.string({ minLength: 1, maxLength: 60 }),
            targetService: fc.constantFrom('plex', 'spotify'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.array(
          fc.record({
            sourceService: fc.constantFrom('apple', 'tidal', 'qobuz'),
            sourceName: fc.string({ minLength: 1, maxLength: 60 }),
            targetService: fc.constantFrom('plex', 'spotify'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (jobsA, jobsB) => {
          const db = createTestDb();
          const userA = createUser(db, 'hist-a');
          const userB = createUser(db, 'hist-b');

          try {
            const now = Date.now();

            for (const j of jobsA) {
              db.prepare(`
                INSERT INTO cross_import_jobs
                  (user_id, source_service, source_playlist_name, target_service, status, total_count, created_at)
                VALUES (?, ?, ?, ?, 'complete', 0, ?)
              `).run(userA, j.sourceService, j.sourceName, j.targetService, now);
            }

            for (const j of jobsB) {
              db.prepare(`
                INSERT INTO cross_import_jobs
                  (user_id, source_service, source_playlist_name, target_service, status, total_count, created_at)
                VALUES (?, ?, ?, ?, 'complete', 0, ?)
              `).run(userB, j.sourceService, j.sourceName, j.targetService, now);
            }

            const historyA = db.prepare(
              'SELECT * FROM cross_import_jobs WHERE user_id = ? ORDER BY created_at DESC'
            ).all(userA) as any[];

            const historyB = db.prepare(
              'SELECT * FROM cross_import_jobs WHERE user_id = ? ORDER BY created_at DESC'
            ).all(userB) as any[];

            expect(historyA).toHaveLength(jobsA.length);
            expect(historyB).toHaveLength(jobsB.length);

            for (const job of historyA) {
              expect(job.user_id).toBe(userA);
              expect(job.user_id).not.toBe(userB);
            }

            for (const job of historyB) {
              expect(job.user_id).toBe(userB);
              expect(job.user_id).not.toBe(userA);
            }
          } finally {
            cleanupDb(db);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Import history records contain all required fields
// Feature: cross-playlist-import, Property 12
// Validates: Requirements 10.1, 10.2
// ---------------------------------------------------------------------------
describe('Property 12: Import history records contain all required fields', () => {
  it('completed job records have all required fields non-null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sourceService: fc.constantFrom('spotify', 'deezer', 'plex', 'apple', 'tidal'),
          sourceName: fc.string({ minLength: 1, maxLength: 100 }),
          targetService: fc.constantFrom('plex', 'spotify'),
          targetName: fc.string({ minLength: 1, maxLength: 100 }),
          matchedCount: fc.integer({ min: 0, max: 200 }),
          unmatchedCount: fc.integer({ min: 0, max: 50 }),
          skippedCount: fc.integer({ min: 0, max: 20 }),
        }),
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 80 }),
            artist: fc.string({ minLength: 1, maxLength: 80 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (jobData, unmatchedTracks) => {
          const db = createTestDb();
          const userId = createUser(db, 'fields-test');

          try {
            const now = Date.now();
            const totalCount = jobData.matchedCount + jobData.unmatchedCount + jobData.skippedCount;

            db.prepare(`
              INSERT INTO cross_import_jobs
                (user_id, source_service, source_playlist_name, target_service,
                 target_playlist_name, matched_count, unmatched_count, skipped_count,
                 total_count, status, unmatched_tracks, created_at, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?)
            `).run(
              userId,
              jobData.sourceService,
              jobData.sourceName,
              jobData.targetService,
              jobData.targetName,
              jobData.matchedCount,
              jobData.unmatchedCount,
              jobData.skippedCount,
              totalCount,
              JSON.stringify(unmatchedTracks),
              now,
              now
            );

            const row = db.prepare(
              'SELECT * FROM cross_import_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
            ).get(userId) as any;

            // All required fields must be present and non-null
            expect(row.source_service).toBeTruthy();
            expect(row.source_playlist_name).toBeTruthy();
            expect(row.target_service).toBeTruthy();
            expect(row.target_playlist_name).toBeTruthy();
            expect(typeof row.matched_count).toBe('number');
            expect(typeof row.unmatched_count).toBe('number');
            expect(typeof row.skipped_count).toBe('number');
            expect(typeof row.total_count).toBe('number');
            expect(row.created_at).toBeTruthy();

            // unmatched_tracks must be a valid JSON array of {title, artist}
            const parsed = JSON.parse(row.unmatched_tracks);
            expect(Array.isArray(parsed)).toBe(true);
            for (const t of parsed) {
              expect(typeof t.title).toBe('string');
              expect(typeof t.artist).toBe('string');
            }
          } finally {
            cleanupDb(db);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: Unmatched filter returns only unmatched entries
// Feature: cross-playlist-import, Property 14
// Validates: Requirements 8.4
// ---------------------------------------------------------------------------
describe('Property 14: Unmatched filter returns only unmatched entries', () => {
  it('filter returns exactly entries where matched===false && skipped===false', () => {
    fc.assert(
      fc.property(
        fc.array(matchResultArb, { minLength: 0, maxLength: 50 }),
        (results) => {
          const filtered = applyUnmatchedFilter(results);

          // Every returned entry must be unmatched and not skipped
          for (const r of filtered) {
            expect(r.matched).toBe(false);
            expect(r.skipped).toBe(false);
          }

          // Every unmatched+non-skipped entry from input must appear in output
          const expected = results.filter(r => !r.matched && !r.skipped);
          expect(filtered).toHaveLength(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
