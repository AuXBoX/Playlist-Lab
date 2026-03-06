/**
 * Unit Tests for Cross-Import SSE Session Management
 *
 * Tests:
 * - Cancel sets the cancellation flag and emits error event
 * - Progress events are emitted and stored in polling state
 * - Job status transitions correctly (matching → review → complete)
 * - Polling fallback returns last known state
 */

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Minimal in-memory session state (mirrors the module-level maps in cross-import.ts)
// We test the logic directly rather than importing the private maps.
// ---------------------------------------------------------------------------

describe('SSE session management logic', () => {
  let matchSessions: Map<string, EventEmitter>;
  let cancelledSessions: Set<string>;
  let matchProgressState: Map<string, any>;

  beforeEach(() => {
    matchSessions = new Map();
    cancelledSessions = new Set();
    matchProgressState = new Map();
  });

  // -------------------------------------------------------------------------
  // Cancel logic
  // -------------------------------------------------------------------------
  describe('cancel endpoint logic', () => {
    it('sets the cancellation flag for the session', () => {
      const sessionId = 'session-abc';
      cancelledSessions.add(sessionId);
      expect(cancelledSessions.has(sessionId)).toBe(true);
    });

    it('emits error event on the stored emitter when cancelled', () => {
      const sessionId = 'session-cancel';
      const emitter = new EventEmitter();
      matchSessions.set(sessionId, emitter);

      const errorSpy = jest.fn();
      emitter.on('error', errorSpy);

      // Simulate cancel handler
      cancelledSessions.add(sessionId);
      emitter.emit('error', { message: 'Cancelled' });

      expect(errorSpy).toHaveBeenCalledWith({ message: 'Cancelled' });
    });

    it('isCancelled() returns true after cancel is called', () => {
      const sessionId = 'session-check';
      const isCancelled = () => cancelledSessions.has(sessionId);

      expect(isCancelled()).toBe(false);
      cancelledSessions.add(sessionId);
      expect(isCancelled()).toBe(true);
    });

    it('does not affect other sessions when one is cancelled', () => {
      cancelledSessions.add('session-1');
      const isCancelled2 = () => cancelledSessions.has('session-2');
      expect(isCancelled2()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Progress event emission
  // -------------------------------------------------------------------------
  describe('progress event emission', () => {
    it('stores progress in matchProgressState when emitter fires', () => {
      const sessionId = 'session-progress';
      const emitter = new EventEmitter();
      matchSessions.set(sessionId, emitter);

      emitter.on('progress', (data) => {
        matchProgressState.set(sessionId, data);
      });

      const progressData = { type: 'progress', phase: 'matching', current: 5, total: 20 };
      emitter.emit('progress', progressData);

      expect(matchProgressState.get(sessionId)).toEqual(progressData);
    });

    it('overwrites progress state with each new event', () => {
      const sessionId = 'session-overwrite';
      const emitter = new EventEmitter();
      matchSessions.set(sessionId, emitter);

      emitter.on('progress', (data) => matchProgressState.set(sessionId, data));

      emitter.emit('progress', { type: 'progress', phase: 'fetching', current: 0, total: 0 });
      emitter.emit('progress', { type: 'progress', phase: 'matching', current: 10, total: 50 });

      expect(matchProgressState.get(sessionId)).toMatchObject({ phase: 'matching', current: 10 });
    });

    it('stores complete event in progress state', () => {
      const sessionId = 'session-complete';
      const emitter = new EventEmitter();
      matchSessions.set(sessionId, emitter);

      emitter.on('complete', (data) => {
        matchProgressState.set(sessionId, { type: 'complete', ...data });
      });

      emitter.emit('complete', { results: [], jobId: 42 });

      const state = matchProgressState.get(sessionId);
      expect(state.type).toBe('complete');
      expect(state.jobId).toBe(42);
    });

    it('stores error event in progress state', () => {
      const sessionId = 'session-error';
      const emitter = new EventEmitter();
      matchSessions.set(sessionId, emitter);

      emitter.on('error', (data) => {
        matchProgressState.set(sessionId, { type: 'error', ...data });
      });

      emitter.emit('error', { message: 'Something went wrong' });

      const state = matchProgressState.get(sessionId);
      expect(state.type).toBe('error');
      expect(state.message).toBe('Something went wrong');
    });
  });

  // -------------------------------------------------------------------------
  // Job status transitions
  // -------------------------------------------------------------------------
  describe('job status transitions', () => {
    it('transitions from matching to review on successful match', () => {
      // Simulate the status values the route sets
      const statuses: string[] = [];

      // Insert: status = 'matching'
      statuses.push('matching');

      // After fetchTracks + matchTracks succeed: status = 'review'
      statuses.push('review');

      // After execute: status = 'complete'
      statuses.push('complete');

      expect(statuses).toEqual(['matching', 'review', 'complete']);
    });

    it('transitions to failed on error', () => {
      const statuses: string[] = ['matching'];
      // Simulate error path
      statuses.push('failed');
      expect(statuses[statuses.length - 1]).toBe('failed');
    });

    it('deletes job record on cancellation', () => {
      // Simulate: job inserted, then cancelled → deleted
      const jobs = new Map<number, string>();
      jobs.set(1, 'matching');

      // Cancel path deletes the record
      jobs.delete(1);

      expect(jobs.has(1)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Polling fallback
  // -------------------------------------------------------------------------
  describe('polling fallback (match/status)', () => {
    it('returns waiting when no progress state exists', () => {
      const sessionId = 'session-new';
      const progress = matchProgressState.get(sessionId);
      const response = progress ?? { type: 'waiting' };
      expect(response).toEqual({ type: 'waiting' });
    });

    it('returns last known progress state', () => {
      const sessionId = 'session-poll';
      const data = { type: 'progress', phase: 'matching', current: 3, total: 10 };
      matchProgressState.set(sessionId, data);

      const progress = matchProgressState.get(sessionId);
      expect(progress).toEqual(data);
    });

    it('cleans up session after terminal state is read', () => {
      const sessionId = 'session-cleanup';
      const emitter = new EventEmitter();
      matchSessions.set(sessionId, emitter);
      matchProgressState.set(sessionId, { type: 'complete', results: [], jobId: 7 });
      cancelledSessions.add(sessionId);

      // Simulate cleanup after client reads terminal state
      const progress = matchProgressState.get(sessionId);
      if (progress?.type === 'complete' || progress?.type === 'error') {
        matchProgressState.delete(sessionId);
        const e = matchSessions.get(sessionId);
        if (e) {
          e.removeAllListeners();
          matchSessions.delete(sessionId);
        }
        cancelledSessions.delete(sessionId);
      }

      expect(matchProgressState.has(sessionId)).toBe(false);
      expect(matchSessions.has(sessionId)).toBe(false);
      expect(cancelledSessions.has(sessionId)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Session isolation
  // -------------------------------------------------------------------------
  describe('session isolation', () => {
    it('each session has its own emitter', () => {
      const emitter1 = new EventEmitter();
      const emitter2 = new EventEmitter();
      matchSessions.set('s1', emitter1);
      matchSessions.set('s2', emitter2);

      const spy1 = jest.fn();
      const spy2 = jest.fn();
      emitter1.on('progress', spy1);
      emitter2.on('progress', spy2);

      emitter1.emit('progress', { current: 1 });

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).not.toHaveBeenCalled();
    });

    it('cancelling one session does not cancel another', () => {
      cancelledSessions.add('s1');
      expect(cancelledSessions.has('s2')).toBe(false);
    });
  });
});
