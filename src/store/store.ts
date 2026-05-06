import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AuditEvent } from '@/lib/audit';
import { nextEventId } from '@/lib/audit';
import type { Submission, LifecycleMilestone } from '@/lib/fixtures';
import type { Field, UnderwriterCorrected } from '@/lib/field';

/**
 * The single source of truth.
 *
 * - submission: the active risk on the canvas. Null until module 2 loads
 *   the Greenline fixture.
 * - auditLog: append-only record of every meaningful state transition.
 * - artifacts.computedAt: timestamps that drive `isStale` checks for
 *   downstream artifacts (enrichment, conflicts, rating, quote,
 *   recommendation). Set when a module computes; cleared when a field
 *   correction marks them stale.
 * - lifecycle.cursor: which milestone the ribbon is scrubbed to.
 */

export type ArtifactKey =
  | 'enrichment'
  | 'conflicts'
  | 'rating'
  | 'quote'
  | 'recommendation';

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
  correctField: <T>(
    fieldPath: string,
    field: Field<T>,
    correction: UnderwriterCorrected<T>,
  ) => Field<T>;
  markArtifactComputed: (key: ArtifactKey, at?: string) => void;
  markArtifactStale: (key: ArtifactKey) => void;
  scrubLifecycle: (milestone: LifecycleMilestone) => void;
  setCanvasMode: (mode: 'closed' | 'compact' | 'expanded') => void;
  reset: () => void;
};

const initialArtifacts: Record<ArtifactKey, ArtifactState> = {
  enrichment: { computedAt: null },
  conflicts: { computedAt: null },
  rating: { computedAt: null },
  quote: { computedAt: null },
  recommendation: { computedAt: null },
};

export const useRanBerri = create<RanBerriState>()(
  persist(
    immer((set, _get) => ({
      submission: null,
      auditLog: [],
      artifacts: initialArtifacts,
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

      correctField: (fieldPath, field, correction) => {
        const next = { ...field, underwriterCorrected: correction };
        set((s) => {
          // Every downstream artifact is stale after a correction.
          // Recomputation is explicit — never automatic.
          for (const key of Object.keys(s.artifacts) as ArtifactKey[]) {
            s.artifacts[key].computedAt = null;
          }
          if (s.submission) {
            s.auditLog.push({
              id: nextEventId(),
              at: correction.correctedAt,
              actor: { kind: 'underwriter', id: correction.correctedBy },
              kind: 'field.corrected',
              submissionId: s.submission.id,
              fieldPath,
              reason: correction.reason,
            });
          }
        });
        return next;
      },

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
          s.artifacts = initialArtifacts;
          s.lifecycle = { cursor: 'quote', now: 'quote' };
          s.ui = { canvasMode: 'compact' };
        }),
    })),
    {
      name: 'ranberri.v0',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
