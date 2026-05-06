/**
 * Project competitor.switchRecorded events from the audit log into a
 * feedback signal the recommendation engine can read.
 *
 * Mid-term switches are distinct from NTUs (module 7's
 * lossesToCompetitors fixture): NTUs are quotes the broker DECLINED
 * before bind, switches are policies the insured CANCELLED in favour
 * of a competitor mid-term. They feed FCT-003 (pricing competitiveness)
 * as a stronger signal — losing a bound risk to the same competitor
 * is more material than losing a quote.
 */

import type { AuditEvent } from '@/lib/audit';

export type CompetitorSwitch = {
  policyRef: string;
  toCompetitor: string;
  cancelledAt: string;
  retainedPremium: number;
  notes: string;
};

export function projectCompetitorSwitches(log: AuditEvent[]): CompetitorSwitch[] {
  const out: CompetitorSwitch[] = [];
  for (const e of log) {
    if (e.kind !== 'competitor.switchRecorded') continue;
    out.push({
      policyRef: e.policyRef,
      toCompetitor: e.toCompetitor,
      cancelledAt: e.cancelledAt,
      retainedPremium: e.retainedPremium,
      notes: e.notes,
    });
  }
  return out;
}
