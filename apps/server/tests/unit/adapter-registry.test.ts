/**
 * Unit Tests for AdapterRegistry
 *
 * Tests register/retrieve, listSources, and listTargets filtering.
 * Requirements: 12.3, 12.4, 12.5
 */

import { adapterRegistry } from '../../src/adapters/registry';
import { SourceAdapter, TargetAdapter, ServiceMeta } from '../../src/adapters/types';

// Helper to build a minimal ServiceMeta
function makeMeta(id: string, isSourceOnly: boolean, requiresOAuth = false): ServiceMeta {
  return { id, name: id, icon: id, isSourceOnly, requiresOAuth };
}

// Minimal SourceAdapter stub
function makeSource(id: string, isSourceOnly = false): SourceAdapter {
  return {
    meta: makeMeta(id, isSourceOnly),
    fetchTracks: jest.fn(),
  };
}

// Minimal TargetAdapter stub
function makeTarget(id: string, isSourceOnly = false): TargetAdapter {
  return {
    meta: makeMeta(id, isSourceOnly),
    searchCatalog: jest.fn(),
    matchTracks: jest.fn(),
    createPlaylist: jest.fn(),
  };
}

describe('AdapterRegistry', () => {
  // Clear the registry maps between tests by re-registering fresh adapters
  // (the singleton persists across tests, so we track what we register per test)

  describe('registerSource / getSource', () => {
    it('retrieves a registered source by id', () => {
      const src = makeSource('test-src-1');
      adapterRegistry.registerSource(src);
      expect(adapterRegistry.getSource('test-src-1')).toBe(src);
    });

    it('returns undefined for an unregistered source id', () => {
      expect(adapterRegistry.getSource('nonexistent-source')).toBeUndefined();
    });

    it('overwrites a source when the same id is registered again', () => {
      const src1 = makeSource('overwrite-src');
      const src2 = makeSource('overwrite-src');
      adapterRegistry.registerSource(src1);
      adapterRegistry.registerSource(src2);
      expect(adapterRegistry.getSource('overwrite-src')).toBe(src2);
    });
  });

  describe('registerTarget / getTarget', () => {
    it('retrieves a registered target by id', () => {
      const tgt = makeTarget('test-tgt-1');
      adapterRegistry.registerTarget(tgt);
      expect(adapterRegistry.getTarget('test-tgt-1')).toBe(tgt);
    });

    it('returns undefined for an unregistered target id', () => {
      expect(adapterRegistry.getTarget('nonexistent-target')).toBeUndefined();
    });

    it('overwrites a target when the same id is registered again', () => {
      const tgt1 = makeTarget('overwrite-tgt');
      const tgt2 = makeTarget('overwrite-tgt');
      adapterRegistry.registerTarget(tgt1);
      adapterRegistry.registerTarget(tgt2);
      expect(adapterRegistry.getTarget('overwrite-tgt')).toBe(tgt2);
    });
  });

  describe('listSources', () => {
    it('includes all registered sources regardless of isSourceOnly flag', () => {
      const srcA = makeSource('list-src-a', false);
      const srcB = makeSource('list-src-b', true); // source-only
      adapterRegistry.registerSource(srcA);
      adapterRegistry.registerSource(srcB);

      const ids = adapterRegistry.listSources().map(s => s.meta.id);
      expect(ids).toContain('list-src-a');
      expect(ids).toContain('list-src-b');
    });
  });

  describe('listTargets', () => {
    it('includes targets where isSourceOnly is false', () => {
      const tgt = makeTarget('list-tgt-normal', false);
      adapterRegistry.registerTarget(tgt);

      const ids = adapterRegistry.listTargets().map(t => t.meta.id);
      expect(ids).toContain('list-tgt-normal');
    });

    it('excludes targets where isSourceOnly is true', () => {
      const srcOnly = makeTarget('list-tgt-srconly', true);
      adapterRegistry.registerTarget(srcOnly);

      const ids = adapterRegistry.listTargets().map(t => t.meta.id);
      expect(ids).not.toContain('list-tgt-srconly');
    });

    it('returns only non-source-only targets when both types are registered', () => {
      const normal = makeTarget('mixed-tgt-normal', false);
      const srcOnly = makeTarget('mixed-tgt-srconly', true);
      adapterRegistry.registerTarget(normal);
      adapterRegistry.registerTarget(srcOnly);

      const targets = adapterRegistry.listTargets();
      const ids = targets.map(t => t.meta.id);
      expect(ids).toContain('mixed-tgt-normal');
      expect(ids).not.toContain('mixed-tgt-srconly');
      targets.forEach(t => expect(t.meta.isSourceOnly).toBe(false));
    });
  });
});
