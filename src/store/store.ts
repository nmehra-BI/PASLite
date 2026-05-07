import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AuditEvent } from '@/lib/audit';
import { nextEventId } from '@/lib/audit';
import type {
  HistoricalBinder,
  Submission,
  LifecycleMilestone,
} from '@/lib/fixtures';
// Import directly (not via the barrel) to avoid a circular load
// through @/lib/bind/runBindCeremony, which imports the store back.
import { deriveBoundLedgerEntry } from '@/lib/bind/deriveBoundLedgerEntry';
import { getActiveConfig } from '@/config';
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
  freshBind,
  freshEnrichment,
  freshPostBind,
  freshQuote,
  freshRating,
  freshRecommendation,
  freshTriage,
  replay,
  type ArtifactState,
  type BindReplay,
  type DeclineRecord,
  type EnrichmentReplayState,
  type PostBindReplay,
  type QuoteReplay,
  type RatingReplay,
  type RecommendationReplay,
  type ReferralRecord,
  type SourceStatus,
  type SubmissionLifecycleState,
  type SubjectivityRecord,
  type TriageReplayState,
} from './replay';
import { freshMta, freshPolicy } from '@/lib/mta/types';
import type {
  MtaHashRecord,
  MtaReplay,
  PolicyReplay,
  PolicyVersionRecord,
} from '@/lib/mta/types';
import { freshCancellation } from '@/lib/cancellation/types';
import type {
  CancellationHashRecord,
  CancellationReplay,
} from '@/lib/cancellation/types';
import { freshRenewal } from '@/lib/renewal/types';
import type {
  RenewalHashRecord,
  RenewalReplay,
} from '@/lib/renewal/types';
import type { HashId } from '@/lib/bind/types';

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
  bind: BindReplay;
  postBind: PostBindReplay;
  /**
   * Same-MGA bound binders ledger. Compounds across submissions —
   * each bind appends a HistoricalBinder, and recommendation engines
   * concat this onto the fixture pool so subsequent risks see the
   * just-bound policy in their FCT-001 / FCT-002 cohorts.
   *
   * Survives `reset()` (a fresh submission shouldn't unlearn the
   * prior book).
   */
  boundLedger: HistoricalBinder[];
  /** Active MTA workflow state (module 9). */
  mta: MtaReplay;
  /** Policy version stack: baseBind + chronological MTAs. */
  policy: PolicyReplay;
  /** Active or terminal cancellation workflow (module 10). */
  cancellation: CancellationReplay;
  /** Active or committed renewal workflow (module 11). */
  renewal: RenewalReplay;
  lifecycle: {
    cursor: LifecycleMilestone;
    now: LifecycleMilestone;
  };
  ui: {
    canvasMode: 'closed' | 'compact' | 'expanded';
    auditLogOpen: boolean;
    inspectingSubjectivityId: string | null;
    showCertificate: boolean;
    /** True while the seam animation is mid-flight. */
    seamFiring: boolean;
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

  // Module 8 — bind ceremony orchestration. These actions mirror
  // `src/lib/bind/runBindCeremony.ts` so the ceremony is reachable
  // both from React (via the store) and from tests / future
  // cinematics (via the lib helpers). Both paths emit identical
  // audit events.
  setSeamFiring: (firing: boolean) => void;
  setAuditLogOpen: (open: boolean) => void;
  setInspectingSubjectivity: (id: string | null) => void;
  setShowCertificate: (show: boolean) => void;
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
      bind: freshBind(),
      postBind: freshPostBind(),
      boundLedger: [],
      mta: freshMta(),
      policy: freshPolicy(),
      cancellation: freshCancellation(),
      renewal: freshRenewal(),
      lifecycle: { cursor: 'quote', now: 'quote' },
      ui: {
        canvasMode: 'compact',
        auditLogOpen: false,
        inspectingSubjectivityId: null,
        showCertificate: false,
        seamFiring: false,
      },

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
        // 'refer' is congruent with the 'referred' terminal state — an
        // underwriter recording their intent against the recommendation
        // after the referral has fired is not a write to the submission,
        // it's a log entry. Allow it through.
        const isCongruentRefer = input.action === 'refer' && state === 'referred';
        if ((state === 'referred' || state === 'declined') && !isCongruentRefer) {
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

        // 2. Advance the submission state. Bind starts the four-hash
        //    ceremony; NTU goes to module 7's loss-capture; refer
        //    reuses module 4's submission.referred path.
        if (input.action === 'bind') {
          // Module 8: start the bind ceremony. The hash rows render in
          // place of the recommendation; commit drives the seam.
          get().appendAuditEvent({
            actor: { kind: 'underwriter', id: input.actedBy },
            kind: 'bind.ceremonyStarted',
            submissionId,
            startedBy: input.actedBy,
          });
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

      setSeamFiring: (firing) =>
        set((s) => {
          s.ui.seamFiring = firing;
        }),

      setAuditLogOpen: (open) =>
        set((s) => {
          s.ui.auditLogOpen = open;
        }),

      setInspectingSubjectivity: (id) =>
        set((s) => {
          s.ui.inspectingSubjectivityId = id;
        }),

      setShowCertificate: (show) =>
        set((s) => {
          s.ui.showCertificate = show;
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
          s.bind = freshBind();
          s.postBind = freshPostBind();
          s.mta = freshMta();
          s.policy = freshPolicy();
          s.cancellation = freshCancellation();
          s.renewal = freshRenewal();
          // Preserve boundLedger across reset — the moat compounds.
          // Use deepReset to wipe it.
          s.lifecycle = { cursor: 'quote', now: 'quote' };
          s.ui = {
            canvasMode: 'compact',
            auditLogOpen: false,
            inspectingSubjectivityId: null,
            showCertificate: false,
            seamFiring: false,
          };
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
        // Persist the cross-submission ledger separately. This is the
        // moat: bound binders compound across demo sessions.
        boundLedger: state.boundLedger,
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
          merged.bind = result.bind;
          merged.postBind = result.postBind;
          merged.mta = result.mta;
          merged.policy = result.policy;
          merged.cancellation = result.cancellation;
          merged.renewal = result.renewal;
          // Merge the persisted ledger with whatever this log replayed
          // — both contribute, and we de-duplicate on policyRef so
          // re-loading an already-recorded bind doesn't double-count.
          const fromLog = result.boundLedger;
          const existing = merged.boundLedger ?? [];
          const seen = new Set(existing.map((b) => b.id));
          merged.boundLedger = [
            ...existing,
            ...fromLog.filter((b) => !seen.has(b.id)),
          ];
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

    // ---------- bind ceremony (module 8) ----------

    case 'bind.ceremonyStarted':
      s.bind.phase = 'in-progress';
      s.bind.startedAt = e.at;
      s.submissionState = 'bind-pending';
      break;

    case 'bind.hashConfirmed':
      writeHash(s, e.hashId, {
        status: 'confirmed',
        artefactSha: e.artefactSha,
        expectedSha: e.artefactSha,
        confirmedAt: e.at,
        confirmedBy: e.confirmedBy,
      });
      break;

    case 'bind.hashFailed':
      writeHash(s, e.hashId, {
        status: 'failed',
        artefactSha: e.currentSha,
        expectedSha: e.expectedSha,
      });
      break;

    case 'bind.hashOverridden':
      writeHash(s, e.hashId, {
        status: 'overridden',
        artefactSha: e.currentSha,
        expectedSha: e.expectedSha,
        confirmedAt: e.at,
        confirmedBy: e.overriddenBy,
        overrideReason: e.reason,
      });
      break;

    case 'bind.committed':
      s.bind.phase = 'committed';
      s.bind.committedAt = e.at;
      s.bind.policyRef = e.policyRef;
      s.bind.signedBy = e.signedBy;
      s.submissionState = 'bound';
      s.policy.bound = true;
      s.policy.baseBindAt = e.at;
      // Seed the prior-endorsement offset from config. Greenline ships
      // 3 (original schedule + 2 admin endorsements) so the first MTA
      // renders as MTA-04; a tenant with no prior admin endorsements
      // would default to 0 and their first MTA would be MTA-01.
      s.policy.priorEndorsementCount =
        getActiveConfig().metadata.priorAdministrativeEndorsements ?? 0;
      // Advance the lifecycle 'now' to the Bind milestone — this is
      // what fills the seam in the ribbon and shifts the playhead.
      s.lifecycle.now = 'bind';
      s.lifecycle.cursor = 'bind';
      // Compound the same-MGA ledger: append this just-bound policy
      // so subsequent submissions' recommendation engines see it as
      // a similar in-force binder. Idempotent on policyRef.
      if (s.submission && !s.boundLedger.some((b) => b.id === e.policyRef)) {
        s.boundLedger.push(
          deriveBoundLedgerEntry({
            submission: s.submission,
            policyRef: e.policyRef,
            premium: e.premium,
            signedBy: e.signedBy,
            signedAt: e.at,
          }),
        );
      }
      break;

    case 'bind.held':
      s.bind.phase = 'held';
      s.bind.heldReason = e.reason;
      break;

    case 'schedule.generated':
      s.postBind.schedule.generated = true;
      s.postBind.schedule.generatedAt = e.at;
      s.postBind.schedule.recipient = e.recipient;
      s.postBind.schedule.coveringNote = e.coveringNote;
      break;

    case 'schedule.sent':
      s.postBind.schedule.sentAt = e.at;
      s.postBind.schedule.sentBy = e.sentBy;
      s.postBind.schedule.coveringNote = e.coveringNote;
      s.postBind.schedule.recipient = e.recipient;
      break;

    case 'subjectivity.created': {
      const idx = s.postBind.subjectivities.findIndex(
        (x) => x.id === e.subjectivityId,
      );
      const next: SubjectivityRecord = {
        id: e.subjectivityId,
        subjectivityType: e.subjectivityType,
        description: e.description,
        affectedSites: e.affectedSites,
        criticalDate: e.criticalDate,
        status: 'active',
        actionRequired: e.actionRequired,
        autoMonitor: e.autoMonitor,
        createdAt: e.at,
      };
      if (idx >= 0) s.postBind.subjectivities[idx] = next;
      else s.postBind.subjectivities.push(next);
      break;
    }

    case 'subjectivity.tracked': {
      const sub = s.postBind.subjectivities.find((x) => x.id === e.subjectivityId);
      if (sub) sub.status = e.status;
      break;
    }

    case 'audit.viewed':
    case 'audit.exported':
    case 'audit.stateReplayed':
      // Compliance-only events; no state mutation.
      break;

    // ---------- MTA / endorsement (module 9) ----------
    case 'mta.requestReceived':
      s.mta.phase = 'received';
      s.mta.request = {
        id: e.mtaId,
        policyRef: e.submissionId,
        effectiveDate: e.effectiveDate,
        changeType: e.changeType,
        brokerName: e.broker,
        receivedAt: e.at,
        subject: e.subject,
        emailBody: '',
      };
      if (s.submissionState === 'bound') s.submissionState = 'mta-pending';
      break;

    case 'mta.extracted':
      if (s.mta.request) {
        s.mta.phase = 'extracted';
        s.mta.fields = e.fields as MtaReplay['fields'];
        s.mta.extractionConfidence = e.avgConfidence;
        s.mta.fieldCount = e.fieldCount;
      }
      break;

    case 'mta.gapFlagged':
      s.mta.gaps.push({
        id: e.gapId,
        description: e.description,
        detectedAt: e.at,
        resolution: null,
      });
      if (s.mta.phase !== 'context-review') s.mta.phase = 'gap-pending';
      break;

    case 'mta.gapResolved': {
      const g = s.mta.gaps.find((x) => x.id === e.gapId);
      if (g) {
        g.resolution = {
          choice: e.choice,
          reason: e.reason,
          resolvedBy: e.resolvedBy,
          resolvedAt: e.at,
        };
      }
      const allResolved = s.mta.gaps.every((x) => x.resolution !== null);
      if (allResolved) s.mta.phase = 'context-review';
      break;
    }

    case 'mta.deltaRated':
      s.mta.delta = {
        beforePremium: e.beforePremium,
        afterAnnualEquivalent: e.afterAnnualEquivalent,
        annualDelta: e.annualDelta,
        daysRemaining: e.daysRemaining,
        daysInTerm: e.daysInTerm,
        proRatedAP: e.proRatedAP,
        sha: e.sha,
        beforeCells: [],
        afterCells: [],
      };
      s.mta.phase = 'delta-rating';
      s.mta.staleSince = null;
      break;

    case 'mta.capacityRechecked':
      s.mta.capacity = {
        deltaConsumption: e.deltaConsumption,
        newTotalConsumption: e.newTotalConsumption,
        sufficient: e.sufficient,
        headroomAfter: 0,
      };
      s.mta.phase = 'capacity-rechecked';
      break;

    case 'mta.scheduleGenerated':
      if (s.mta.request) {
        s.mta.schedule = {
          scheduleRef: e.scheduleRef,
          endorsementNumber: s.policy.versions.length + 1,
          effectiveDate: s.mta.request.effectiveDate,
          endorsementNote: e.endorsementNote,
          addedWarranty: e.addedWarranty,
          warranties: [],
          recipient: '',
          recipientName: '',
          coveringNote: '',
        };
        s.mta.phase = 'schedule-ready';
      }
      break;

    case 'mta.scheduleEdited':
      break;

    case 'mta.hashConfirmed': {
      const idx = s.mta.hashes.findIndex((h) => h.id === e.hashId);
      const next: MtaHashRecord = {
        id: e.hashId,
        status: 'confirmed',
        artefactSha: e.artefactSha,
        expectedSha: e.artefactSha,
        confirmedAt: e.at,
        confirmedBy: e.confirmedBy,
        overrideReason: null,
      };
      if (idx >= 0) s.mta.hashes[idx] = next;
      else s.mta.hashes.push(next);
      s.mta.phase = 'ceremony-in-progress';
      break;
    }

    case 'mta.hashOverridden': {
      const idx = s.mta.hashes.findIndex((h) => h.id === e.hashId);
      const next: MtaHashRecord = {
        id: e.hashId,
        status: 'overridden',
        artefactSha: e.currentSha,
        expectedSha: e.expectedSha,
        confirmedAt: e.at,
        confirmedBy: e.overriddenBy,
        overrideReason: e.reason,
      };
      if (idx >= 0) s.mta.hashes[idx] = next;
      else s.mta.hashes.push(next);
      break;
    }

    case 'mta.committed': {
      s.mta.phase = 'committed';
      s.mta.committedAt = e.at;
      s.mta.signedBy = e.signedBy;
      const versionRecord: PolicyVersionRecord = {
        versionId: e.scheduleRef,
        endorsementNumber: e.endorsementNumber,
        effectiveDate: e.effectiveDate,
        changeType: s.mta.request?.changeType ?? 'multi-change',
        proRatedAP: e.proRatedAP,
        afterAnnualEquivalent: e.afterAnnualEquivalent,
        scheduleRef: e.scheduleRef,
        signedBy: e.signedBy,
        signedAt: e.at,
      };
      s.policy.versions.push(versionRecord);
      s.submissionState = 'in-force-with-mta';
      // Move the lifecycle 'now' to MTA-04 milestone.
      s.lifecycle.now = 'mta-04';
      s.lifecycle.cursor = 'mta-04';
      break;
    }

    case 'mta.scheduleSent':
      s.mta.sentAt = e.at;
      s.mta.sentBy = e.sentBy;
      s.mta.phase = 'sent';
      break;

    case 'mta.fieldCorrected':
      if (e.fieldKey === 'newTurnover') s.mta.corrections.newTurnover = e.nextValue;
      else if (e.fieldKey === 'newSiteSqm') s.mta.corrections.newSiteSqm = e.nextValue;
      s.mta.hashes = [];
      s.mta.phase = 'context-review';
      break;

    case 'mta.markedStale':
      s.mta.staleSince = e.at;
      s.mta.delta = null;
      s.mta.capacity = null;
      s.mta.schedule = null;
      s.mta.hashes = [];
      if (
        s.mta.phase === 'ceremony-in-progress' ||
        s.mta.phase === 'schedule-ready' ||
        s.mta.phase === 'capacity-rechecked' ||
        s.mta.phase === 'delta-rating'
      ) {
        s.mta.phase = 'context-review';
      }
      break;

    // ---------- cancellation (module 10) ----------
    case 'cancellation.requestReceived':
      s.cancellation.phase = 'reason-review';
      s.cancellation.request = {
        id: e.cancellationId,
        broker: e.broker,
        subject: e.subject,
        effectiveDate: e.effectiveDate,
        reasonCategory: e.reasonCategory,
        reasonDetail: e.reasonDetail,
        switchingTo: e.switchingTo ?? null,
        receivedAt: e.at,
      };
      if (s.submissionState === 'bound' || s.submissionState === 'in-force-with-mta') {
        s.submissionState = 'cancel-pending';
      }
      break;

    case 'cancellation.basisSelected':
      s.cancellation.basis = e.basis;
      break;

    case 'cancellation.basisOverridden':
      s.cancellation.basisOverride = {
        from: e.from,
        to: e.to,
        reason: e.reason,
        overriddenBy: e.overriddenBy,
        at: e.at,
      };
      s.cancellation.basis = e.to;
      s.cancellation.calc = null;
      s.cancellation.bordereau = null;
      s.cancellation.hashes = [];
      break;

    case 'cancellation.runoffClaimCaptured':
      s.cancellation.runoffClaim = {
        ref: e.claimRef,
        description: e.description,
        reserveAmount: e.reserveAmount,
        capturedAt: e.at,
        capturedBy: e.capturedBy,
      };
      if (s.cancellation.phase === 'reason-review') {
        s.cancellation.phase = 'runoff-pending';
      }
      break;

    case 'cancellation.refundComputed':
      s.cancellation.calc = {
        annualPremium: e.annualPremium,
        daysRemaining: e.daysRemaining,
        daysInTerm: e.daysInTerm,
        basis: e.basis,
        refund: e.refund,
        commissionClawback: e.commissionClawback,
        clawbackKind: e.clawbackKind,
        bordereauNet: e.bordereauNet,
        sha: e.sha,
      };
      s.cancellation.phase = 'computed';
      break;

    case 'cancellation.hashConfirmed': {
      const idx = s.cancellation.hashes.findIndex((h) => h.id === e.hashId);
      const next: CancellationHashRecord = {
        id: e.hashId,
        status: 'confirmed',
        artefactSha: e.artefactSha,
        expectedSha: e.artefactSha,
        confirmedAt: e.at,
        confirmedBy: e.confirmedBy,
        overrideReason: null,
      };
      if (idx >= 0) s.cancellation.hashes[idx] = next;
      else s.cancellation.hashes.push(next);
      s.cancellation.phase = 'ceremony-in-progress';
      break;
    }

    case 'cancellation.hashOverridden': {
      const idx = s.cancellation.hashes.findIndex((h) => h.id === e.hashId);
      const next: CancellationHashRecord = {
        id: e.hashId,
        status: 'overridden',
        artefactSha: e.currentSha,
        expectedSha: e.expectedSha,
        confirmedAt: e.at,
        confirmedBy: e.overriddenBy,
        overrideReason: e.reason,
      };
      if (idx >= 0) s.cancellation.hashes[idx] = next;
      else s.cancellation.hashes.push(next);
      break;
    }

    case 'cancellation.committed':
      s.cancellation.phase = 'committed';
      s.cancellation.committedAt = e.at;
      s.cancellation.signedBy = e.signedBy;
      s.cancellation.endorsementRef = e.endorsementRef;
      s.cancellation.endorsementNumber = e.endorsementNumber;
      s.submissionState = 'cancelled';
      // Move lifecycle 'now' to Cancel — fills the second seam and
      // hides Renewal in the ribbon.
      s.lifecycle.now = 'cancel';
      s.lifecycle.cursor = 'cancel';
      break;

    case 'cancellation.endorsementSent':
      s.cancellation.sentAt = e.at;
      s.cancellation.sentBy = e.sentBy;
      s.cancellation.phase = 'sent';
      break;

    case 'bordereau.entryWritten':
      s.cancellation.bordereau = {
        netMovement: e.netMovement,
        syndicate: e.syndicate,
        line: e.line,
        writtenAt: e.at,
      };
      break;

    case 'competitor.switchRecorded':
      // Surfaced by recommendation engine; no state change.
      break;

    // ---------- renewal (module 11) ----------
    case 'claim.recorded':
    case 'subjectivity.satisfied':
      // Recorded for audit; year-1 review projects from these.
      break;

    case 'renewal.triggered':
      s.renewal.phase = 'triggered';
      s.renewal.triggeredAt = e.at;
      s.renewal.renewalId = e.renewalId;
      s.renewal.priorPolicyRef = e.priorPolicyRef;
      if (
        s.submissionState === 'bound' ||
        s.submissionState === 'in-force-with-mta'
      ) {
        s.submissionState = 'renewal-pending';
      }
      break;

    case 'renewal.year1ReviewBuilt':
      s.renewal.phase = 'year1-review';
      s.renewal.year1Review = {
        earnedPremium: e.earnedPremium,
        totalLosses: e.totalLosses,
        lossRatio: e.lossRatio,
        claimCount: e.claimCount,
        claims: [],
        mtaCount: e.mtaCount,
        mtaRefs: [],
        subjectivitiesSatisfied: e.subjectivitiesSatisfied,
        subjectivitiesTotal: e.subjectivitiesSatisfied,
        brokerRelationship: {
          name: 'Sarah Whitfield (SureStep)',
          sentiment: 'strong',
          note: 'High broker engagement throughout year-1.',
        },
        marginalia: 'Year-1 ran clean.',
      };
      break;

    case 'renewal.insuredChangesCaptured':
      s.renewal.phase = 'changes-captured';
      s.renewal.insuredChanges = {
        newTurnover: e.newTurnover,
        materialAdditions: e.materialAdditions,
        brokerTargetPremium: e.brokerTargetPremium,
        competitivePressure: e.competitivePressure,
        notes: e.notes,
      };
      break;

    case 'renewal.year2Rated':
      s.renewal.phase = 'year2-rated';
      s.renewal.year2 = {
        technicalPremium: e.technicalPremium,
        sha: e.sha,
        deltaFromYear1Annual: e.deltaFromYear1Annual,
      };
      break;

    case 'renewal.defencePricingComputed':
      s.renewal.phase = 'defence-priced';
      s.renewal.defencePricing = {
        options: e.options,
        holdFloor: e.holdFloor,
      };
      break;

    case 'renewal.optionSelected':
      s.renewal.phase = 'option-selected';
      s.renewal.selectedOption = {
        id: e.optionId,
        premium: e.premium,
        selectedBy: e.selectedBy,
        selectedAt: e.at,
      };
      break;

    case 'renewal.recommendationCompleted':
      s.renewal.phase = 'recommendation-ready';
      s.renewal.recommendation = {
        primary: e.primary,
        confidence: e.confidence,
        headline: e.headline,
        factorIds: e.factorIds,
      };
      break;

    case 'renewal.slipGenerated':
      s.renewal.phase = 'slip-ready';
      s.renewal.slip = {
        slipRef: e.slipRef,
        premium: e.premium,
        sha: e.sha,
        sentAt: null,
      };
      break;

    case 'renewal.slipSent':
      s.renewal.slip.sentAt = e.at;
      break;

    case 'renewal.hashConfirmed': {
      const idx = s.renewal.hashes.findIndex((h) => h.id === e.hashId);
      const next: RenewalHashRecord = {
        id: e.hashId,
        status: 'confirmed',
        artefactSha: e.artefactSha,
        confirmedAt: e.at,
        confirmedBy: e.confirmedBy,
      };
      if (idx >= 0) s.renewal.hashes[idx] = next;
      else s.renewal.hashes.push(next);
      s.renewal.phase = 'ceremony-in-progress';
      break;
    }

    case 'renewal.committed':
      s.renewal.phase = 'committed';
      s.renewal.committedAt = e.at;
      s.renewal.signedBy = e.signedBy;
      s.renewal.successorPolicyRef = e.successorPolicyRef;
      s.renewal.inceptionDate = e.inceptionDate;
      s.renewal.expiryDate = e.expiryDate;
      s.submissionState = 'renewed';
      // Renewal becomes the live 'now' milestone; the lifecycle
      // ribbon's third seam (succession) fills.
      s.lifecycle.now = 'renewal';
      s.lifecycle.cursor = 'renewal';
      // Augment the boundLedger with the successor policy so the
      // data flywheel sees the renewal binder.
      if (
        s.submission &&
        !s.boundLedger.some((b) => b.id === e.successorPolicyRef)
      ) {
        s.boundLedger.push(
          deriveBoundLedgerEntry({
            submission: s.submission,
            policyRef: e.successorPolicyRef,
            premium: e.premium,
            signedBy: e.signedBy,
            signedAt: e.at,
          }),
        );
      }
      break;

    case 'renewal.scheduleSent':
      s.renewal.scheduleSentAt = e.at;
      s.renewal.phase = 'sent';
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

const HASH_ORDER: HashId[] = ['premium', 'subjectivities', 'sanctions', 'capacity'];

/**
 * Mirror of replay.ts setHashStatus, operating on the immer draft.
 * Ensures the per-event reducer keeps the bind slice consistent.
 */
function writeHash(
  s: RanBerriState,
  id: HashId,
  patch: Partial<BindReplay['hashes'][number]> & {
    status: BindReplay['hashes'][number]['status'];
  },
): void {
  let h = s.bind.hashes.find((x) => x.id === id);
  if (!h) {
    h = {
      id,
      status: 'pending',
      artefactSha: null,
      expectedSha: null,
      confirmedAt: null,
      confirmedBy: null,
      overrideReason: null,
    };
    s.bind.hashes.push(h);
    s.bind.hashes.sort(
      (a, b) => HASH_ORDER.indexOf(a.id) - HASH_ORDER.indexOf(b.id),
    );
  }
  Object.assign(h, patch);
}
