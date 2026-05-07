/**
 * Module 13 — relevance ranking for the truncated decision-trail
 * rail. Given the full event log + the current submission state,
 * return up to N events ordered chronologically (newest first).
 *
 * Selection rules:
 *   1. Always include the most recent event from each chapter that
 *      has activity (cap one per chapter).
 *   2. Always include "milestone" events — bind.committed,
 *      mta.committed, cancellation.committed, renewal.committed,
 *      quote.sent, schedule.sent — regardless of recency.
 *   3. Backfill with the most-recent remaining events until we hit
 *      the cap.
 *   4. Filter out routine noise: extraction.fieldExtracted,
 *      rating.cellComputed, slip.fieldEdited, email.streamFinished,
 *      enrichment.sourceQueried/Returned (the per-cell / per-source
 *      noise that matters to the engine but not to the rail).
 */

import type { AuditEvent, AuditEventKind } from '@/lib/audit';

const NOISE_KINDS: ReadonlySet<AuditEventKind> = new Set([
  'extraction.fieldExtracted',
  'rating.cellComputed',
  'slip.fieldEdited',
  'email.streamFinished',
  'email.edited',
  'enrichment.sourceQueried',
  'enrichment.sourceReturned',
  'triage.checkEvaluated',
  'recommendation.factorEvaluated',
  'audit.viewed',
  'listing.viewed',
  'listing.actionTaken',
  'listing.searchPerformed',
]);

const MILESTONE_KINDS: ReadonlySet<AuditEventKind> = new Set([
  'bind.committed',
  'bind.ceremonyStarted',
  'mta.committed',
  'mta.requestReceived',
  'cancellation.committed',
  'cancellation.requestReceived',
  'renewal.committed',
  'renewal.triggered',
  'quote.sent',
  'schedule.sent',
  'schedule.generated',
  'rating.completed',
  'recommendation.completed',
  'triage.completed',
  'extraction.completed',
  'submission.created',
]);

export type RelevantEventsInput = {
  log: AuditEvent[];
  /** Maximum number of events to return. Default 8. */
  limit?: number;
};

export function getRelevantEvents(input: RelevantEventsInput): AuditEvent[] {
  const limit = input.limit ?? 8;
  const filtered = input.log.filter((e) => !NOISE_KINDS.has(e.kind));

  const picked = new Map<string, AuditEvent>();

  // (1) Always include milestones (most recent occurrence wins).
  for (const e of filtered) {
    if (MILESTONE_KINDS.has(e.kind)) picked.set(e.id, e);
  }

  // (2) One most-recent event per chapter family for non-milestones,
  //     where "chapter family" is the kind's prefix
  //     (e.g. 'enrichment.', 'rating.', 'bind.').
  const seenFamilies = new Set<string>();
  for (let i = filtered.length - 1; i >= 0; i--) {
    const e = filtered[i]!;
    if (picked.has(e.id)) {
      seenFamilies.add(family(e.kind));
      continue;
    }
    const fam = family(e.kind);
    if (!seenFamilies.has(fam)) {
      picked.set(e.id, e);
      seenFamilies.add(fam);
    }
  }

  // (3) Backfill the most-recent remaining events.
  for (let i = filtered.length - 1; i >= 0 && picked.size < limit; i--) {
    const e = filtered[i]!;
    if (!picked.has(e.id)) picked.set(e.id, e);
  }

  // Order chronologically newest-first by `at`, then trim to limit.
  const out = Array.from(picked.values()).sort((a, b) =>
    new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  return out.slice(0, limit);
}

function family(kind: AuditEventKind): string {
  const dot = kind.indexOf('.');
  return dot < 0 ? kind : kind.slice(0, dot);
}
