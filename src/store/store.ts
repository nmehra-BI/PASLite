import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AuditEvent } from '@/lib/audit';
import { nextEventId } from '@/lib/audit';
import type { Submission, LifecycleMilestone } from '@/lib/fixtures';
import type { UnderwriterCorrected } from '@/lib/field';
import {
  ALL_ARTIFACTS,
  affectedArtifacts,
  isField,
  type ArtifactKey,
} from '@/lib/deps';
import { getAtPath, setAtPath, type FieldPath } from '@/lib/paths';

/**
 * The single source of truth.
 *
 * - submission: the active risk on the canvas. Null until module 2
 *   loads the Greenline fixture.
 * - auditLog: append-only record of every meaningful state transition.
 * - artifacts.computedAt: timestamps that drive `isStale` checks for
 *   downstream artifacts. Set when a module computes; cleared by
 *   `applyCorrection` for exactly the artifacts the dependency graph
 *   says are affected.
 * - lifecycle.cursor: which milestone the ribbon is scrubbed to.
 */

export type { ArtifactKey } from '@/lib/deps';

export type ArtifactState = {
  computedAt: string | null;
};

export type RanBerriState = {
  submission: Submission | null;
  auditLog: AuditEvent[];
  artifacts: Record<ArtifactKey, ArtifactState>;
  lifecycle: {
    cursor: LifecycleMilestone;
    now: LifecycleMilestone;
  };
  ui: {
    canvasMode: 'closed' | 'compact' | 'expanded';
  };

  // Actions
  setSubmission: (submission: Submission) => void;
  appendAuditEvent: (
    event: Omit<AuditEvent, 'id' | 'at'> & { at?: string },
  ) => void;

  /**
   * Apply an underwriter correction to a field at the given path:
   *   1. Read the current Field<T> at `path`
   *   2. Stamp `underwriterCorrected` on it
   *   3. Write it back into the submission tree
   *   4. Invalidate the artifact closure derived from the dependency
   *      graph (only the affected artifacts, not all of them)
   *   5. Append one `field.corrected` audit event plus one
   *      `artifact.stale` event per invalidated artifact
   *
   * Throws if there is no active submission or the path does not
   * resolve to a Field<T>.
   */
  applyCorrection: <T>(path: FieldPath | string, correction: UnderwriterCorrected<T>) => void;

  markArtifactComputed: (key: ArtifactKey, at?: string) => void;
  markArtifactStale: (key: ArtifactKey) => void;
  scrubLifecycle: (milestone: LifecycleMilestone) => void;
  setCanvasMode: (mode: 'closed' | 'compact' | 'expanded') => void;
  reset: () => void;
};

function freshArtifacts(): Record<ArtifactKey, ArtifactState> {
  return {
    enrichment: { computedAt: null },
    conflicts: { computedAt: null },
    rating: { computedAt: null },
    quote: { computedAt: null },
    recommendation: { computedAt: null },
  };
}

/**
 * Memory-backed Storage shim used when localStorage is unavailable
 * (Node tests, SSR). The persist middleware reads/writes through this
 * the same way it does in the browser.
 */
function safeStorage(): Storage {
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as { localStorage?: Storage }).localStorage
  ) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
    key: (i) => Array.from(mem.keys())[i] ?? null,
  };
}

export const useRanBerri = create<RanBerriState>()(
  persist(
    immer((set) => ({
      submission: null,
      auditLog: [],
      artifacts: freshArtifacts(),
      lifecycle: { cursor: 'quote', now: 'quote' },
      ui: { canvasMode: 'compact' },

      setSubmission: (submission) =>
        set((s) => {
          s.submission = submission;
        }),

      appendAuditEvent: (event) =>
        set((s) => {
          const full = {
            ...event,
            id: nextEventId(),
            at: event.at ?? new Date().toISOString(),
          } as AuditEvent;
          s.auditLog.push(full);
        }),

      applyCorrection: (path, correction) =>
        set((s) => {
          if (!s.submission) {
            throw new Error('applyCorrection: no active submission');
          }
          const current = getAtPath(s.submission, path);
          if (!isField(current)) {
            throw new Error(
              `applyCorrection: '${path}' does not resolve to a Field`,
            );
          }
          const updated = { ...current, underwriterCorrected: correction };
          setAtPath(s.submission, path, updated);

          const affected = affectedArtifacts(path);
          for (const key of ALL_ARTIFACTS) {
            if (affected.has(key)) {
              s.artifacts[key].computedAt = null;
            }
          }

          s.auditLog.push({
            id: nextEventId(),
            at: correction.correctedAt,
            actor: { kind: 'underwriter', id: correction.correctedBy },
            kind: 'field.corrected',
            submissionId: s.submission.id,
            fieldPath: path,
            reason: correction.reason,
          });
          for (const key of affected) {
            s.auditLog.push({
              id: nextEventId(),
              at: correction.correctedAt,
              actor: { kind: 'system' },
              kind: 'artifact.stale',
              submissionId: s.submission.id,
              artifact: key,
            });
          }
        }),

      markArtifactComputed: (key, at) =>
        set((s) => {
          s.artifacts[key].computedAt = at ?? new Date().toISOString();
        }),

      markArtifactStale: (key) =>
        set((s) => {
          s.artifacts[key].computedAt = null;
        }),

      scrubLifecycle: (milestone) =>
        set((s) => {
          s.lifecycle.cursor = milestone;
        }),

      setCanvasMode: (mode) =>
        set((s) => {
          s.ui.canvasMode = mode;
        }),

      reset: () =>
        set((s) => {
          s.submission = null;
          s.auditLog = [];
          s.artifacts = freshArtifacts();
          s.lifecycle = { cursor: 'quote', now: 'quote' };
          s.ui = { canvasMode: 'compact' };
        }),
    })),
    {
      name: 'ranberri.v0',
      version: 1,
      storage: createJSONStorage(() => safeStorage()),
    },
  ),
);
