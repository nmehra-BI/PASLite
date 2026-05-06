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
    | { kind: 'rating.computed'; submissionId: string; premium: number }
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
