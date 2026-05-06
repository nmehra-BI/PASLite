import type { ISO8601 } from '@/lib/field';
import type { Submission } from '@/lib/fixtures/types';

/**
 * The audit trail is the spine of the cockpit. Every meaningful state
 * transition writes one event. Events are append-only and ordered.
 *
 * Event payloads are designed to be **replay-sufficient**: the
 * reducer in `src/store/replay.ts` reconstructs `submission`,
 * `artifacts`, and intake metadata from the log alone. That means the
 * audit log is the canonical persistence form &mdash; the materialised
 * state in the store is derived.
 *
 * Snapshot vs delta:
 *   - submission.created  carries the full Submission tree
 *                         (broker layer populated). Replays as a state
 *                         replacement.
 *   - extraction.fieldExtracted  carries the AI's extracted value.
 *                         Replays as setting systemExtracted at path.
 *   - field.corrected     carries the corrected value + correctedBy.
 *                         Replays as setting underwriterCorrected.
 *   - artifact.computed   replays as { computedAt, staleSince: null }.
 *   - artifact.stale      replays as { computedAt: null, staleSince }.
 *
 * Future modules (rating, bind, NTU) extend this discriminated union
 * with their own kinds. Existing kinds are append-only for backward
 * compatibility of replay across versions.
 */

export type AuditActor =
  | { kind: 'system'; modelVersion?: string }
  | { kind: 'underwriter'; id: string }
  | { kind: 'broker'; id: string };

export type AuditEventBase = {
  id: string;
  at: ISO8601;
  actor: AuditActor;
  /** Optional human-readable note. Used e.g. by 'preserved across rerun'. */
  note?: string;
};

export type AuditEvent = AuditEventBase &
  (
    | { kind: 'submission.received'; submissionId: string; broker: string }
    | {
        kind: 'submission.created';
        submissionId: string;
        folio: string;
        broker: string;
        /** Full Submission tree at creation; broker layer populated. */
        submission: Submission;
      }
    | {
        kind: 'email.received';
        submissionId: string;
        broker: string;
        subject: string;
      }
    | { kind: 'extraction.started'; submissionId: string }
    | {
        kind: 'extraction.fieldExtracted';
        submissionId: string;
        fieldPath: string;
        value: unknown;
        confidence: number;
        sourceRef: string;
        extractedAt: ISO8601;
        modelVersion: string;
      }
    | {
        kind: 'extraction.completed';
        submissionId: string;
        fieldCount: number;
        avgConfidence: number;
      }
    | {
        kind: 'extraction.rerun';
        submissionId: string;
        preservedCorrections: number;
      }
    | {
        kind: 'gap.flagged';
        submissionId: string;
        fieldPath: string;
        description: string;
      }

    // Enrichment phase (module 3)
    | { kind: 'enrichment.started'; submissionId: string }
    | {
        kind: 'enrichment.sourceQueried';
        submissionId: string;
        source: string;
        queryRef: string;
      }
    | {
        kind: 'enrichment.sourceReturned';
        submissionId: string;
        source: string;
        queryRef: string;
        latencyMs: number;
        payload: unknown;
        summary: string;
        verdict: 'confirmed' | 'conflict' | 'no-prior';
      }
    | {
        kind: 'enrichment.completed';
        submissionId: string;
        sources: string[];
        conflictCount: number;
        gapCount: number;
      }
    | { kind: 'enrichment.rerun'; submissionId: string; preservedResolutions: number }
    | {
        kind: 'conflict.detected';
        submissionId: string;
        conflictId: string;
        fieldPath: string;
        brokerValue: unknown;
        brokerSourceRef: string;
        externalSource: string;
        externalValue: unknown;
        externalSourceRef: string;
        marginalia: string;
      }
    | {
        kind: 'conflict.resolved';
        submissionId: string;
        conflictId: string;
        fieldPath: string;
        choice: 'broker' | 'external' | 'custom';
        value: unknown;
        reason: string;
        resolvedBy: string;
      }
    | {
        /**
         * Emitted by the enrichment engine when a previously-detected
         * conflict no longer manifests on a fresh detection pass
         * (e.g. the underwriter corrected the broker value to match
         * the external source, reconciling the disagreement). The
         * conflict record stays in memory marked `dismissed: true`
         * so prior resolution can be re-attached if the conflict
         * re-emerges.
         */
        kind: 'conflict.dismissed';
        submissionId: string;
        conflictId: string;
        reason: string;
      }
    | {
        kind: 'gap.detected';
        submissionId: string;
        gapId: string;
        fieldPath: string;
        description: string;
      }
    | {
        kind: 'gap.resolved';
        submissionId: string;
        gapId: string;
        fieldPath: string;
        choice: 'present' | 'absent' | 'request';
        value: boolean | null;
        reason: string;
        resolvedBy: string;
      }
    | {
        kind: 'gap.dismissed';
        submissionId: string;
        gapId: string;
        reason: string;
      }
    | {
        kind: 'gap.requestSent';
        submissionId: string;
        gapId: string;
        fieldPath: string;
        recipient: string;
      }

    | { kind: 'conflict.flagged'; submissionId: string; fieldPath: string }
    | {
        kind: 'field.corrected';
        submissionId: string;
        fieldPath: string;
        value: unknown;
        reason: string;
        /**
         * Identity of the underwriter who originally made this correction.
         * For system-driven re-applies (preserved across rerun) this stays
         * the original human's id; the event's `actor` is the system.
         */
        correctedBy: string;
      }
    // Triage phase (module 4)
    | { kind: 'triage.started'; submissionId: string }
    | {
        kind: 'triage.checkEvaluated';
        submissionId: string;
        check: 'appetite' | 'capacity' | 'subjectivities' | 'sanctions';
        outcome: 'pass' | 'refer' | 'decline';
        rationale: string;
        ruleIds: string[];
        rules: Array<{
          ruleId: string;
          description: string;
          passed: boolean;
          testedValue?: string;
        }>;
        metadata?: unknown;
      }
    | {
        kind: 'triage.completed';
        submissionId: string;
        verdict: 'pass' | 'refer' | 'decline';
      }
    | {
        kind: 'triage.verdictChanged';
        submissionId: string;
        from: 'pass' | 'refer' | 'decline';
        to: 'pass' | 'refer' | 'decline';
        cause: string;
      }
    | { kind: 'triage.rerun'; submissionId: string }
    | {
        kind: 'triage.checkOverridden';
        submissionId: string;
        check: 'appetite' | 'capacity' | 'subjectivities' | 'sanctions';
        from: 'pass' | 'refer' | 'decline';
        to: 'pass' | 'refer' | 'decline';
        reason: string;
        overriddenBy: string;
      }
    | { kind: 'triage.passedToRating'; submissionId: string }
    | {
        kind: 'submission.referred';
        submissionId: string;
        reviewer: string;
        urgency: 'today' | 'week' | 'next-available';
        reason: string;
        referredBy: string;
      }
    | { kind: 'submission.recalled'; submissionId: string; recalledBy: string }
    | {
        kind: 'submission.declined';
        submissionId: string;
        reasonCategory: string;
        detail: string;
        notifyBroker: boolean;
        declinedBy: string;
      }
    | { kind: 'rating.computed'; submissionId: string; premium: number }

    // Rating phase (module 5)
    | { kind: 'rating.started'; submissionId: string; iteration: number }
    | {
        kind: 'rating.cellComputed';
        submissionId: string;
        ref: string;
        label: string;
        value: number;
        format: 'currency' | 'percent' | 'multiplier';
        op?: '×' | '+' | '−' | '';
        subtotalAfter: number | null;
        formula: string;
        cellInputs: Array<{ label: string; path: string; value: unknown }>;
      }
    | {
        kind: 'rating.completed';
        submissionId: string;
        premium: number;
        sha: string;
        version: string;
        tier: string;
        iteration: number;
      }
    | { kind: 'rating.rerun'; submissionId: string; nextIteration: number }

    // Slip phase
    | {
        kind: 'slip.generated';
        submissionId: string;
        slipRef: string;
        premium: number;
        sha: string;
      }
    | {
        kind: 'slip.fieldEdited';
        submissionId: string;
        fieldKey: string;
        previousValue: string;
        nextValue: string;
        editedBy: string;
      }
    | {
        kind: 'slip.regenerated';
        submissionId: string;
        preservedEdits: number;
        /** Stable field keys whose user edits survived the regen. */
        preservedEditKeys: string[];
        /**
         * True when the regen is part of a revised-quote send (after
         * a sent quote went stale). The covering email is redrafted
         * with revision context.
         */
        revision?: boolean;
      }

    // Email + send
    | { kind: 'email.drafted'; submissionId: string; subject: string; body: string; recipient: string; revision?: boolean }
    | {
        /**
         * Emitted by the email editor when the word-by-word stream
         * completes. On subsequent opens (including post-refresh),
         * the editor checks for this event after the most recent
         * `email.drafted` and skips the stream if found.
         */
        kind: 'email.streamFinished';
        submissionId: string;
      }
    | {
        kind: 'email.edited';
        submissionId: string;
        field: 'subject' | 'body' | 'cc';
        nextValue: string;
        editedBy: string;
      }
    | {
        kind: 'quote.sent';
        submissionId: string;
        slipRef: string;
        recipient: string;
        subject: string;
        body: string;
        sentBy: string;
      }
    | { kind: 'quote.recalled'; submissionId: string; recalledBy: string }
    | { kind: 'quote.markedStale'; submissionId: string; reason: string }
    | { kind: 'quote.issued'; submissionId: string; quoteRef: string }
    | {
        kind: 'recommendation.generated';
        submissionId: string;
        verdict: 'bind' | 'refer' | 'decline';
      }
    | {
        kind: 'decision.recorded';
        submissionId: string;
        outcome: 'bound' | 'referred' | 'ntu';
      }
    | {
        kind: 'artifact.computed';
        submissionId: string;
        artifact: string;
        computedAt: ISO8601;
      }
    | { kind: 'artifact.stale'; submissionId: string; artifact: string }
  );

export type AuditEventKind = AuditEvent['kind'];
