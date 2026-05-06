import type { ISO8601 } from '@/lib/field';

/**
 * The audit trail is the spine of the cockpit. Every meaningful state
 * transition writes one event. Events are append-only and ordered.
 *
 * The DecisionTrail rail in the canvas reads from this log directly.
 * Future modules (rating, bind, NTU) extend the discriminated union with
 * their own kinds — never overwriting earlier events.
 */

export type AuditActor =
  | { kind: 'system'; modelVersion?: string }
  | { kind: 'underwriter'; id: string }
  | { kind: 'broker'; id: string };

export type AuditEventBase = {
  id: string;
  at: ISO8601;
  actor: AuditActor;
  note?: string;
};

export type AuditEvent = AuditEventBase &
  (
    | { kind: 'submission.received'; submissionId: string; broker: string }
    | { kind: 'extraction.started'; submissionId: string }
    | { kind: 'extraction.completed'; submissionId: string; fieldCount: number }
    | { kind: 'enrichment.completed'; submissionId: string; sources: string[] }
    | { kind: 'conflict.flagged'; submissionId: string; fieldPath: string }
    | { kind: 'field.corrected'; submissionId: string; fieldPath: string; reason: string }
    | { kind: 'rating.computed'; submissionId: string; premium: number }
    | { kind: 'quote.issued'; submissionId: string; quoteRef: string }
    | { kind: 'recommendation.generated'; submissionId: string; verdict: 'bind' | 'refer' | 'decline' }
    | { kind: 'decision.recorded'; submissionId: string; outcome: 'bound' | 'referred' | 'ntu' }
    | { kind: 'artifact.stale'; submissionId: string; artifact: string }
  );

export type AuditEventKind = AuditEvent['kind'];
