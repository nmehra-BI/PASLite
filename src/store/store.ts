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
import {
  applyExtraction,
  freshArtifacts,
  freshEnrichment,
  freshQuote,
  freshRating,
  freshRecommendation,
  freshTriage,
  replay,
  type ArtifactState,
  type DeclineRecord,
  type EnrichmentReplayState,
  type QuoteReplay,
  type RatingReplay,
  type RecommendationReplay,
  type ReferralRecord,
  type SourceStatus,
  type SubmissionLifecycleState,
  type TriageReplayState,
} from './replay';

/**
 * The single source of truth.
 *
 * The audit log is **the canonical persistence form**: `partialize`
 * writes the log (and stable UI prefs) to localStorage, and on
 * rehydrate the `replay` reducer reconstructs `submission` and
 * `artifacts` from that log alone. The materialised state in the
 * store is derived &mdash; modules 3-6 must keep this contract
 * (every state change writes a replay-sufficient event).
 */

export type { ArtifactKey } from '@/lib/deps';
export type { ArtifactState } from './replay';

/**
 * Distributive Omit: applied to a discriminated union, removes the
 * given keys from each member individually so the variant tags stay
 * exclusive.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type NewAuditEvent = DistributiveOmit<AuditEvent, 'id' | 'at'> & {
  at?: string;
};

export type RanBerriState = {
  submission: Submission | null;
  auditLog: AuditEvent[];
  artifacts: Record<ArtifactKey, ArtifactState>;
  enrichment: EnrichmentReplayState;
  triage: TriageReplayState;
  rating: RatingReplay;
  quote: QuoteReplay;
  recommendation: RecommendationReplay;
  submissionState: SubmissionLifecycleState;
  referral: ReferralRecord | null;
  decline: DeclineRecord | null;
  lifecycle: {
    cursor: LifecycleMilestone;
    now: LifecycleMilestone;
  };
  ui: {
    canvasMode: 'closed' | 'compact' | 'expanded';
  };

  // Actions
  appendAuditEvent: (event: NewAuditEvent) => void;

  /**
   * Underwriter-driven correction. Reads the Field<T> at `path`,
   * stamps it, walks the dependency graph, and emits one
   * `field.corrected` plus one `artifact.stale` per affected artifact.
   * Throws on no-active-submission or non-Field path.
   */
  applyCorrection: <T>(
    path: FieldPath | string,
    correction: UnderwriterCorrected<T>,
  ) => void;

  /**
   * System-driven re-application of a previously-recorded correction
   * (used by re-extraction to preserve underwriter overrides). Writes
   * the `field.corrected` event with `actor: { kind: 'system', ...
   * }` and `note: 'preserved across rerun'`. Does **not** walk the
   * dependency graph &mdash; downstream artifacts were already
   * invalidated by the rerun.
   */
  restoreCorrection: <T>(
    path: FieldPath | string,
    correction: UnderwriterCorrected<T>,
    modelVersion: string,
  ) => void;

  markArtifactComputed: (key: ArtifactKey, at?: string) => void;
  markArtifactStale: (key: ArtifactKey) => void;

  /**
   * Resolve a detected cross-source conflict. Writes a
   * `conflict.resolved` event (intent / provenance) AND a
   * `field.corrected` event (the actual mutation, plus its dep-graph
   * stale propagation).
   */
  resolveConflict: (input: {
    conflictId: string;
    fieldPath: string;
    choice: 'broker' | 'external' | 'custom';
    value: unknown;
    reason: string;
    resolvedBy: string;
  }) => void;

  /**
   * Resolve a gap. For `present`/`absent`, writes a `gap.resolved`
   * event AND a `field.corrected` event with the chosen boolean. For
   * `request`, writes `gap.resolved` + `gap.requestSent` (no field
   * correction; the submission stays in pending-information state).
   */
  resolveGap: (input: {
    gapId: string;
    fieldPath: string;
    choice: 'present' | 'absent' | 'request';
    reason: string;
    resolvedBy: string;
    /** Required when choice === 'request'. */
    recipient?: string;
  }) => void;

  /**
   * Override a triage check outcome with a recorded reason.
   */
  overrideTriageCheck: (input: {
    check: 'appetite' | 'capacity' | 'subjectivities' | 'sanctions';
    from: 'pass' | 'refer' | 'decline';
    to: 'pass' | 'refer' | 'decline';
    reason: string;
    overriddenBy: string;
  }) => void;

  /** Advance submission to rating-pending. */
  proceedToRating: () => void;

  /** Move the submission into referred state. */
  referToSenior: (input: {
    reviewer: string;
    urgency: 'today' | 'week' | 'next-available';
    reason: string;
    referredBy: string;
  }) => void;

  /** Recall a referred submission (placeholder for v0.2). */
  recallReferral: (recalledBy: string) => void;

  /** Move the submission into declined state and trigger module 7 placeholder. */
  declineSubmission: (input: {
    reasonCategory: string;
    detail: string;
    notifyBroker: boolean;
    declinedBy: string;
  }) => void;

  /** Edit a slip field in place (auditable). */
  editSlipField: (input: {
    fieldKey: string;
    previousValue: string;
    nextValue: string;
    editedBy: string;
  }) => void;

  /** Edit the email draft in place. */
  editEmailField: (input: {
    field: 'subject' | 'body' | 'cc';
    nextValue: string;
    editedBy: string;
  }) => void;

  /** Submit the drafted quote to the broker. */
  sendQuote: (input: {
    sentBy: string;
  }) => void;

  /** Recall a sent quote (placeholder for v0.2). */
  recallQuote: (recalledBy: string) => void;

  /**
   * Act on the recommendation: bind / refer / ntu. Each action emits
   * `recommendation.actedUpon` plus a state-advance event. For bind,
   * lifecycle.now advances to the Bind milestone. Module 7 (NTU) and
   * module 8 (bind ceremony) take over from these placeholders.
   */
  actOnRecommendation: (input: {
    action: 'bind' | 'refer' | 'ntu';
    actedBy: string;
  }) => void;

  scrubLifecycle: (milestone: LifecycleMilestone) => void;
  setCanvasMode: (mode: 'closed' | 'compact' | 'expanded') => void;
  reset: () => void;
};

/**
 * Memory-backed Storage shim used when localStorage is unavailable
 * (Node tests, SSR).
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

function newAuditEvent(event: NewAuditEvent): AuditEvent {
  return {
    ...event,
    id: nextEventId(),
    at: event.at ?? new Date().toISOString(),
  } as AuditEvent;
}

export const useRanBerri = create<RanBerriState>()(
  persist(
    immer((set, get) => ({
      submission: null,
      auditLog: [],
      artifacts: freshArtifacts(),
      enrichment: freshEnrichment(),
      triage: freshTriage(),
      rating: freshRating(),
      quote: freshQuote(),
      recommendation: freshRecommendation(),
      submissionState: 'active',
      referral: null,
      decline: null,
      lifecycle: { cursor: 'quote', now: 'quote' },
      ui: { canvasMode: 'compact' },

      appendAuditEvent: (event) =>
        set((s) => {
          const full = newAuditEvent(event);
          s.auditLog.push(full);
          // Keep materialised state consistent with the log via a
          // single-event replay applied on top of current state.
          applySingleEvent(s, full);
        }),

      applyCorrection: (path, correction) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('applyCorrection: no active submission');
        }
        const current = getAtPath(submission, path);
        if (!isField(current)) {
          throw new Error(
            `applyCorrection: '${path}' does not resolve to a Field`,
          );
        }
        const submissionId = submission.id;
        const affected = affectedArtifacts(path);

        // Field correction event
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: correction.correctedBy },
          at: correction.correctedAt,
          kind: 'field.corrected',
          submissionId,
          fieldPath: path,
          value: correction.value,
          reason: correction.reason,
          correctedBy: correction.correctedBy,
        });

        // One artifact.stale per affected artifact
        for (const artifact of affected) {
          get().appendAuditEvent({
            actor: { kind: 'system' },
            at: correction.correctedAt,
            kind: 'artifact.stale',
            submissionId,
            artifact,
          });
        }
      },

      restoreCorrection: (path, correction, modelVersion) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('restoreCorrection: no active submission');
        }
        const current = getAtPath(submission, path);
        if (!isField(current)) {
          throw new Error(
            `restoreCorrection: '${path}' does not resolve to a Field`,
          );
        }
        // System-driven re-apply. No dep-graph walk: artifacts were
        // already invalidated by the rerun (or never computed). The
        // event truthfully records the system as actor; the original
        // human's id stays in `correctedBy`, and the original
        // timestamp stays in the event's `at`.
        get().appendAuditEvent({
          actor: { kind: 'system', modelVersion },
          at: correction.correctedAt,
          kind: 'field.corrected',
          submissionId: submission.id,
          fieldPath: path,
          value: correction.value,
          reason: correction.reason,
          correctedBy: correction.correctedBy,
          note: 'preserved across rerun',
        });
      },

      markArtifactComputed: (key, at) => {
        const submission = get().submission;
        const stamp = at ?? new Date().toISOString();
        get().appendAuditEvent({
          actor: { kind: 'system' },
          at: stamp,
          kind: 'artifact.computed',
          submissionId: submission?.id ?? '',
          artifact: key,
          computedAt: stamp,
        });
      },

      markArtifactStale: (key) => {
        const submission = get().submission;
        get().appendAuditEvent({
          actor: { kind: 'system' },
          kind: 'artifact.stale',
          submissionId: submission?.id ?? '',
          artifact: key,
        });
      },

      resolveConflict: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('resolveConflict: no active submission');
        }
        const at = new Date().toISOString();
        const submissionId = submission.id;

        // 1. The conflict.resolved event records the intent/provenance.
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.resolvedBy },
          at,
          kind: 'conflict.resolved',
          submissionId,
          conflictId: input.conflictId,
          fieldPath: input.fieldPath,
          choice: input.choice,
          value: input.value,
          reason: input.reason,
          resolvedBy: input.resolvedBy,
        });

        // 2. The field.corrected event is the actual mutation plus
        // dep-graph stale propagation. We invoke applyCorrection so
        // the same closure logic + audit cascade fires (rating /
        // quote / recommendation will go stale; conflicts will too,
        // and we restore it below).
        get().applyCorrection(input.fieldPath, {
          value: input.value,
          reason: `[conflict ${input.conflictId}] ${input.reason}`,
          correctedBy: input.resolvedBy,
          correctedAt: at,
        });

        // 3. The conflicts artifact is NOT actually stale at this
        // point: the resolution we just emitted is the latest
        // declaration of conflict state. The cascade fired
        // artifact.stale for it because turnover is in
        // conflicts.sources; we follow up with artifact.computed so
        // the UI doesn't show "rerun enrichment" the moment the user
        // settles a conflict.
        get().appendAuditEvent({
          actor: { kind: 'system' },
          at,
          kind: 'artifact.computed',
          submissionId,
          artifact: 'conflicts',
          computedAt: at,
        });
      },

      resolveGap: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('resolveGap: no active submission');
        }
        const at = new Date().toISOString();
        const submissionId = submission.id;

        const value: boolean | null =
          input.choice === 'present'
            ? true
            : input.choice === 'absent'
              ? false
              : null;

        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.resolvedBy },
          at,
          kind: 'gap.resolved',
          submissionId,
          gapId: input.gapId,
          fieldPath: input.fieldPath,
          choice: input.choice,
          value,
          reason: input.reason,
          resolvedBy: input.resolvedBy,
        });

        if (input.choice === 'request') {
          if (!input.recipient) {
            throw new Error('resolveGap: recipient required for request');
          }
          get().appendAuditEvent({
            actor: { kind: 'system' },
            at,
            kind: 'gap.requestSent',
            submissionId,
            gapId: input.gapId,
            fieldPath: input.fieldPath,
            recipient: input.recipient,
          });
          // No field.corrected — submission stays in pending state.
          return;
        }

        // present / absent: write the boolean as an underwriter
        // correction and let the dep-graph cascade fire.
        get().applyCorrection(input.fieldPath, {
          value,
          reason: `[gap ${input.gapId}] ${input.reason}`,
          correctedBy: input.resolvedBy,
          correctedAt: at,
        });
      },

      overrideTriageCheck: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('overrideTriageCheck: no active submission');
        }
        if (get().submissionState !== 'active') {
          throw new Error('overrideTriageCheck: submission is read-only');
        }
        const submissionId = submission.id;
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.overriddenBy },
          kind: 'triage.checkOverridden',
          submissionId,
          check: input.check,
          from: input.from,
          to: input.to,
          reason: input.reason,
          overriddenBy: input.overriddenBy,
        });

        // The verdict may have changed as a result of the override.
        const next = computeVerdictFromState(get());
        const prev = get().triage.verdict;
        if (prev && next && prev !== next) {
          get().appendAuditEvent({
            actor: { kind: 'system' },
            kind: 'triage.verdictChanged',
            submissionId,
            from: prev,
            to: next,
            cause: `${input.check} overridden ${input.from} → ${input.to}`,
          });
        }
      },

      proceedToRating: () => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('proceedToRating: no active submission');
        }
        if (get().submissionState !== 'active') {
          throw new Error('proceedToRating: submission is read-only');
        }
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: 'nm' },
          kind: 'triage.passedToRating',
          submissionId: submission.id,
        });
      },

      referToSenior: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('referToSenior: no active submission');
        }
        if (get().submissionState !== 'active') {
          throw new Error('referToSenior: submission is read-only');
        }
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.referredBy },
          kind: 'submission.referred',
          submissionId: submission.id,
          reviewer: input.reviewer,
          urgency: input.urgency,
          reason: input.reason,
          referredBy: input.referredBy,
        });
      },

      recallReferral: (recalledBy) => {
        const submission = get().submission;
        if (!submission) return;
        if (get().submissionState !== 'referred') return;
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: recalledBy },
          kind: 'submission.recalled',
          submissionId: submission.id,
          recalledBy,
        });
      },

      declineSubmission: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('declineSubmission: no active submission');
        }
        if (get().submissionState !== 'active') {
          throw new Error('declineSubmission: submission is read-only');
        }
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.declinedBy },
          kind: 'submission.declined',
          submissionId: submission.id,
          reasonCategory: input.reasonCategory,
          detail: input.detail,
          notifyBroker: input.notifyBroker,
          declinedBy: input.declinedBy,
        });
        // Module 7 placeholder: NTU loss-capture flow lands here.
        // For MVP we just emit a console marker so the wiring is
        // visible in the demo.
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.info(
            '[module 7 placeholder] Decline recorded — NTU loss-capture would now run.',
            { submissionId: submission.id, reasonCategory: input.reasonCategory },
          );
        }
      },

      editSlipField: (input) => {
        const submission = get().submission;
        if (!submission) return;
        if (get().submissionState !== 'active' && get().submissionState !== 'rating-pending')
          return;
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.editedBy },
          kind: 'slip.fieldEdited',
          submissionId: submission.id,
          fieldKey: input.fieldKey,
          previousValue: input.previousValue,
          nextValue: input.nextValue,
          editedBy: input.editedBy,
        });
      },

      editEmailField: (input) => {
        const submission = get().submission;
        if (!submission) return;
        if (get().submissionState === 'declined' || get().submissionState === 'referred')
          return;
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.editedBy },
          kind: 'email.edited',
          submissionId: submission.id,
          field: input.field,
          nextValue: input.nextValue,
          editedBy: input.editedBy,
        });
      },

      sendQuote: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('sendQuote: no active submission');
        }
        const email = get().quote.email;
        if (!email) {
          throw new Error('sendQuote: no email drafted');
        }
        if (get().submissionState === 'declined' || get().submissionState === 'referred') {
          throw new Error('sendQuote: submission is read-only');
        }
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.sentBy },
          kind: 'quote.sent',
          submissionId: submission.id,
          slipRef: get().quote.slipRef ?? '',
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          sentBy: input.sentBy,
        });
        // Lifecycle 'now' advances to the new 'quoted' marker.
        set((s) => {
          s.lifecycle.now = 'quoted';
          s.lifecycle.cursor = 'quoted';
        });
      },

      recallQuote: (recalledBy) => {
        const submission = get().submission;
        if (!submission) return;
        if (get().submissionState !== 'quote-sent') return;
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: recalledBy },
          kind: 'quote.recalled',
          submissionId: submission.id,
          recalledBy,
        });
        set((s) => {
          s.lifecycle.now = 'quote';
          s.lifecycle.cursor = 'quote';
        });
      },

      actOnRecommendation: (input) => {
        const submission = get().submission;
        if (!submission) {
          throw new Error('actOnRecommendation: no active submission');
        }
        const state = get().submissionState;
        if (state === 'referred' || state === 'declined') {
          throw new Error('actOnRecommendation: submission is read-only');
        }
        const submissionId = submission.id;

        // 1. Record the underwriter's intent against the recommendation.
        get().appendAuditEvent({
          actor: { kind: 'underwriter', id: input.actedBy },
          kind: 'recommendation.actedUpon',
          submissionId,
          action: input.action,
          actedBy: input.actedBy,
        });

        // 2. Advance the submission state. Bind and NTU are placeholder
        //    state transitions for modules 7/8; refer reuses module 4's
        //    submission.referred path via the existing referral modal.
        if (input.action === 'bind') {
          get().appendAuditEvent({
            actor: { kind: 'system' },
            kind: 'submission.advancedToBindPending',
            submissionId,
            actedBy: input.actedBy,
          });
          set((s) => {
            s.lifecycle.now = 'bind';
            s.lifecycle.cursor = 'bind';
          });
          if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.info(
              '[module 8 placeholder] Bind ceremony will run here. State advanced to bind-pending.',
              { submissionId },
            );
          }
        } else if (input.action === 'ntu') {
          get().appendAuditEvent({
            actor: { kind: 'system' },
            kind: 'submission.advancedToNtuPending',
            submissionId,
            actedBy: input.actedBy,
          });
          if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.info(
              '[module 7 placeholder] NTU loss-capture will run here. State advanced to ntu-pending.',
              { submissionId },
            );
          }
        }
        // 'refer' action does not advance state itself — the
        // ReferralModal calls referToSenior which writes the
        // submission.referred event.
      },

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
          s.enrichment = freshEnrichment();
          s.triage = freshTriage();
          s.rating = freshRating();
          s.quote = freshQuote();
          s.recommendation = freshRecommendation();
          s.submissionState = 'active';
          s.referral = null;
          s.decline = null;
          s.lifecycle = { cursor: 'quote', now: 'quote' };
          s.ui = { canvasMode: 'compact' };
        }),
    })),
    {
      name: 'ranberri.v0',
      version: 2,
      storage: createJSONStorage(() => safeStorage()),
      // Audit log is canonical. Submission and artifacts are derived
      // via replay on rehydrate.
      partialize: (state) => ({
        auditLog: state.auditLog,
        lifecycle: state.lifecycle,
        ui: state.ui,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<RanBerriState>) };
        if (merged.auditLog && merged.auditLog.length > 0) {
          const result = replay(merged.auditLog);
          merged.submission = result.submission;
          merged.artifacts = result.artifacts;
          merged.enrichment = result.enrichment;
          merged.triage = result.triage;
          merged.rating = result.rating;
          merged.quote = result.quote;
          merged.recommendation = result.recommendation;
          merged.submissionState = result.submissionState;
          merged.referral = result.referral;
          merged.decline = result.decline;
        }
        return merged;
      },
    },
  ),
);

/**
 * Apply a single new event to the live materialised state in the
 * store. Mirrors `replay()` but operates on a draft for the immer
 * middleware. Keeps the in-memory store consistent with what replay
 * would produce from the log on rehydrate.
 */
function applySingleEvent(s: RanBerriState, e: AuditEvent): void {
  switch (e.kind) {
    case 'submission.created':
      s.submission = structuredClone(e.submission);
      break;

    case 'extraction.fieldExtracted':
      if (!s.submission) break;
      applyExtraction(s.submission, e.fieldPath, e.value, {
        confidence: e.confidence,
        sourceRef: e.sourceRef,
        extractedAt: e.extractedAt,
        modelVersion: e.modelVersion,
      });
      break;

    case 'field.corrected': {
      if (!s.submission) break;
      const cur = getAtPath(s.submission, e.fieldPath);
      if (isField(cur)) {
        setAtPath(s.submission, e.fieldPath, {
          ...cur,
          underwriterCorrected: {
            value: e.value,
            reason: e.reason,
            correctedBy: e.correctedBy,
            correctedAt: e.at,
          },
        });
      }
      break;
    }

    case 'enrichment.started':
      s.enrichment.phase = 'querying';
      break;

    case 'enrichment.sourceQueried':
      s.enrichment.sources[e.source] = {
        id: e.source,
        name: e.source,
        status: 'querying',
        result: null,
        latencyMs: null,
        queriedAt: e.at,
        returnedAt: null,
      } as SourceStatus;
      break;

    case 'enrichment.sourceReturned': {
      const prev = s.enrichment.sources[e.source];
      s.enrichment.sources[e.source] = {
        id: e.source,
        name: e.source,
        status: 'returned',
        result: e.payload as SourceStatus['result'],
        latencyMs: e.latencyMs,
        queriedAt: prev?.queriedAt ?? null,
        returnedAt: e.at,
      };
      break;
    }

    case 'enrichment.completed':
      s.enrichment.phase = 'settled';
      s.enrichment.completedAt = e.at;
      s.enrichment.conflictCountAtSettle = e.conflictCount;
      s.enrichment.gapCountAtSettle = e.gapCount;
      break;

    case 'enrichment.rerun':
      s.enrichment.phase = 'idle';
      s.enrichment.sources = {};
      // conflicts/gaps preserved across rerun until subsequent
      // detection events overwrite them.
      break;

    case 'conflict.detected': {
      const idx = s.enrichment.conflicts.findIndex(
        (c) => c.id === e.conflictId,
      );
      const next = {
        id: e.conflictId,
        fieldPath: e.fieldPath,
        brokerValue: e.brokerValue,
        brokerSourceRef: e.brokerSourceRef,
        externalSource: e.externalSource,
        externalValue: e.externalValue,
        externalSourceRef: e.externalSourceRef,
        marginalia: e.marginalia,
        detectedAt: e.at,
        resolution: idx >= 0 ? s.enrichment.conflicts[idx]!.resolution : null,
        dismissed: false,
      };
      if (idx >= 0) s.enrichment.conflicts[idx] = next;
      else s.enrichment.conflicts.push(next);
      break;
    }

    case 'conflict.resolved': {
      const idx = s.enrichment.conflicts.findIndex(
        (c) => c.id === e.conflictId,
      );
      if (idx >= 0) {
        s.enrichment.conflicts[idx]!.resolution = {
          choice: e.choice,
          value: e.value,
          reason: e.reason,
          resolvedBy: e.resolvedBy,
          resolvedAt: e.at,
        };
      }
      break;
    }

    case 'conflict.dismissed': {
      const idx = s.enrichment.conflicts.findIndex(
        (c) => c.id === e.conflictId,
      );
      if (idx >= 0) {
        s.enrichment.conflicts[idx]!.dismissed = true;
      }
      break;
    }

    case 'gap.detected': {
      const idx = s.enrichment.gaps.findIndex((g) => g.id === e.gapId);
      const next = {
        id: e.gapId,
        fieldPath: e.fieldPath,
        description: e.description,
        detectedAt: e.at,
        resolution: idx >= 0 ? s.enrichment.gaps[idx]!.resolution : null,
        requestSent: idx >= 0 ? s.enrichment.gaps[idx]!.requestSent : null,
        dismissed: false,
      };
      if (idx >= 0) s.enrichment.gaps[idx] = next;
      else s.enrichment.gaps.push(next);
      break;
    }

    case 'gap.resolved': {
      const idx = s.enrichment.gaps.findIndex((g) => g.id === e.gapId);
      if (idx >= 0) {
        s.enrichment.gaps[idx]!.resolution = {
          choice: e.choice,
          value: e.value,
          reason: e.reason,
          resolvedBy: e.resolvedBy,
          resolvedAt: e.at,
        };
      }
      break;
    }

    case 'gap.dismissed': {
      const idx = s.enrichment.gaps.findIndex((g) => g.id === e.gapId);
      if (idx >= 0) {
        s.enrichment.gaps[idx]!.dismissed = true;
      }
      break;
    }

    case 'gap.requestSent': {
      const idx = s.enrichment.gaps.findIndex((g) => g.id === e.gapId);
      if (idx >= 0) {
        s.enrichment.gaps[idx]!.requestSent = {
          recipient: e.recipient,
          queuedAt: e.at,
        };
      }
      break;
    }

    case 'artifact.computed':
      if (isKnownArtifact(e.artifact)) {
        s.artifacts[e.artifact].computedAt = e.computedAt;
        s.artifacts[e.artifact].staleSince = null;
      }
      break;

    case 'artifact.stale':
      if (isKnownArtifact(e.artifact)) {
        s.artifacts[e.artifact].computedAt = null;
        s.artifacts[e.artifact].staleSince = e.at;
      }
      break;

    // ---------- triage ----------

    case 'triage.started':
      s.triage.phase = 'evaluating';
      s.triage.checks = [];
      s.triage.lastVerdictChange = null;
      break;

    case 'triage.checkEvaluated': {
      const idx = s.triage.checks.findIndex((c) => c.id === e.check);
      const next = {
        id: e.check,
        outcome: e.outcome,
        rationale: e.rationale,
        ruleIds: e.ruleIds,
        rules: e.rules,
        evaluatedAt: e.at,
        metadata: e.metadata,
        override: idx >= 0 ? s.triage.checks[idx]!.override : null,
      };
      if (idx >= 0) s.triage.checks[idx] = next;
      else s.triage.checks.push(next);
      break;
    }

    case 'triage.completed':
      s.triage.phase = 'settled';
      s.triage.completedAt = e.at;
      s.triage.verdict = e.verdict;
      break;

    case 'triage.verdictChanged':
      s.triage.lastVerdictChange = { from: e.from, to: e.to, cause: e.cause };
      break;

    case 'triage.rerun':
      s.triage.phase = 'idle';
      s.triage.checks = [];
      s.triage.verdict = null;
      s.triage.lastVerdictChange = null;
      break;

    case 'triage.checkOverridden': {
      const idx = s.triage.checks.findIndex((c) => c.id === e.check);
      if (idx >= 0) {
        s.triage.checks[idx]!.override = {
          outcome: e.to,
          reason: e.reason,
          overriddenBy: e.overriddenBy,
          overriddenAt: e.at,
        };
      }
      break;
    }

    case 'triage.passedToRating':
      s.submissionState = 'rating-pending';
      break;

    case 'submission.referred':
      s.submissionState = 'referred';
      s.referral = {
        reviewer: e.reviewer,
        urgency: e.urgency,
        reason: e.reason,
        referredBy: e.referredBy,
        referredAt: e.at,
        recalledAt: null,
        recalledBy: null,
      };
      break;

    case 'submission.recalled':
      if (s.referral) {
        s.referral.recalledAt = e.at;
        s.referral.recalledBy = e.recalledBy;
      }
      s.submissionState = 'active';
      break;

    case 'submission.declined':
      s.submissionState = 'declined';
      s.decline = {
        reasonCategory: e.reasonCategory,
        detail: e.detail,
        notifyBroker: e.notifyBroker,
        declinedBy: e.declinedBy,
        declinedAt: e.at,
      };
      break;

    // ---------- rating ----------

    case 'rating.started':
      s.rating.phase = 'evaluating';
      s.rating.cells = [];
      s.rating.iteration = e.iteration;
      s.rating.output = null;
      break;

    case 'rating.cellComputed': {
      const idx = s.rating.cells.findIndex((c) => c.ref === e.ref);
      const next = {
        ref: e.ref,
        label: e.label,
        op: e.op,
        value: e.value,
        format: e.format,
        subtotalAfter: e.subtotalAfter,
        formula: e.formula,
        inputs: e.cellInputs,
        emittedAt: e.at,
      };
      if (idx >= 0) s.rating.cells[idx] = next;
      else s.rating.cells.push(next);
      break;
    }

    case 'rating.completed':
      s.rating.phase = 'settled';
      s.rating.output = {
        premium: e.premium,
        sha: e.sha,
        version: e.version,
        tier: e.tier,
        computedAt: e.at,
      };
      break;

    case 'rating.rerun':
      s.rating.phase = 'pending';
      s.rating.cells = [];
      s.rating.iteration = e.nextIteration;
      s.rating.output = null;
      break;

    // ---------- slip + quote ----------

    case 'slip.generated':
      s.quote.phase = 'slip-ready';
      s.quote.slipRef = e.slipRef;
      s.quote.slipPremium = e.premium;
      s.quote.slipSha = e.sha;
      break;

    case 'slip.regenerated':
      s.quote.preservedEdits = e.preservedEdits;
      break;

    case 'email.streamFinished':
      // No materialised state mutation. The editor reads the log
      // directly to decide whether to skip the stream on mount.
      break;

    // ---------- recommendation ----------

    case 'recommendation.started':
      s.recommendation.phase = 'evaluating';
      s.recommendation.factors = [];
      s.recommendation.primary = null;
      s.recommendation.confidence = null;
      s.recommendation.headline = null;
      s.recommendation.iteration = e.iteration;
      s.recommendation.lastVerdictChange = null;
      s.recommendation.action = null;
      break;

    case 'recommendation.factorEvaluated': {
      const idx = s.recommendation.factors.findIndex((f) => f.id === e.factorId);
      const next = {
        id: e.factorId,
        label: e.label,
        vote: e.vote,
        weight: e.weight,
        rationale: e.rationale,
        evidence: e.evidence,
        metadata: e.metadata,
        evaluatedAt: e.at,
      };
      if (idx >= 0) s.recommendation.factors[idx] = next;
      else s.recommendation.factors.push(next);
      break;
    }

    case 'recommendation.completed':
      s.recommendation.phase = 'settled';
      s.recommendation.primary = e.primary;
      s.recommendation.confidence = e.confidence;
      s.recommendation.headline = e.headline;
      s.recommendation.similarBinderIds = e.similarBinderIds;
      s.recommendation.similarLossIds = e.similarLossIds;
      s.recommendation.competitorNames = e.competitorNames;
      s.recommendation.completedAt = e.at;
      break;

    case 'recommendation.verdictChanged':
      s.recommendation.lastVerdictChange = { from: e.from, to: e.to };
      break;

    case 'recommendation.rerun':
      s.recommendation.phase = 'idle';
      s.recommendation.factors = [];
      s.recommendation.primary = null;
      s.recommendation.confidence = null;
      s.recommendation.headline = null;
      s.recommendation.iteration = e.nextIteration;
      s.recommendation.lastVerdictChange = null;
      break;

    case 'recommendation.actedUpon':
      s.recommendation.action = {
        kind: e.action,
        actedBy: e.actedBy,
        actedAt: e.at,
      };
      break;

    case 'submission.advancedToBindPending':
      s.submissionState = 'bind-pending';
      break;

    case 'submission.advancedToNtuPending':
      s.submissionState = 'ntu-pending';
      break;

    case 'slip.fieldEdited':
      s.quote.slipEdits[e.fieldKey] = {
        value: e.nextValue,
        editedBy: e.editedBy,
        editedAt: e.at,
      };
      break;

    case 'email.drafted':
      s.quote.email = {
        subject: e.subject,
        body: e.body,
        recipient: e.recipient,
        cc: [],
      };
      break;

    case 'email.edited':
      if (s.quote.email) {
        if (e.field === 'subject') s.quote.email.subject = e.nextValue;
        else if (e.field === 'body') s.quote.email.body = e.nextValue;
        else if (e.field === 'cc')
          s.quote.email.cc = e.nextValue
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
      }
      break;

    case 'quote.sent':
      s.quote.phase = 'sent';
      s.quote.sentAt = e.at;
      s.quote.sentBy = e.sentBy;
      if (s.quote.email) {
        s.quote.email.subject = e.subject;
        s.quote.email.body = e.body;
        s.quote.email.recipient = e.recipient;
      } else {
        s.quote.email = {
          subject: e.subject,
          body: e.body,
          recipient: e.recipient,
          cc: [],
        };
      }
      s.submissionState = 'quote-sent';
      break;

    case 'quote.recalled':
      s.quote.phase = 'slip-ready';
      s.quote.sentAt = null;
      s.quote.sentBy = null;
      s.submissionState = 'rating-pending';
      break;

    case 'quote.markedStale':
      if (s.quote.phase === 'sent') {
        s.quote.staleSinceSent = { reason: e.reason, at: e.at };
      }
      break;

    default:
      break;
  }
}

/**
 * Re-derive the triage verdict from the current materialised checks
 * (taking overrides into account). Used by overrideTriageCheck to
 * detect when the verdict should change.
 */
function computeVerdictFromState(
  state: Pick<RanBerriState, 'triage'>,
): 'pass' | 'refer' | 'decline' | null {
  if (state.triage.checks.length === 0) return null;
  const effectives = state.triage.checks.map(
    (c) => c.override?.outcome ?? c.outcome,
  );
  if (effectives.includes('decline')) return 'decline';
  if (effectives.includes('refer')) return 'refer';
  return 'pass';
}

function isKnownArtifact(s: string): s is ArtifactKey {
  return (ALL_ARTIFACTS as readonly string[]).includes(s);
}
