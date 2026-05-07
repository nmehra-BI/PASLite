/**
 * Build the Year-1 Review from the audit log + the year-1 claims
 * fixture. Pure projection — same inputs ⇒ same review.
 */

import type { AuditEvent } from '@/lib/audit';
import { GREENLINE_YEAR1_CLAIMS } from '@/lib/fixtures/greenlineYear1Claims';
import type { Year1Review } from './types';

export type BuildYear1ReviewInputs = {
  auditLog: AuditEvent[];
  /** £ premium the policy was bound at. */
  boundPremium: number;
  /** £ pro-rated AP from any committed MTAs. */
  cumulativeAP: number;
  /** count of subjectivities created across the year. */
  subjectivitiesTotal: number;
};

export function buildYear1Review(input: BuildYear1ReviewInputs): Year1Review {
  const { auditLog, boundPremium, cumulativeAP, subjectivitiesTotal } = input;

  // Earned premium = bound premium + sum of pro-rated APs (a year fully
  // earns the bound premium plus all MTAs).
  const earnedPremium = boundPremium + cumulativeAP;

  // Claims from the fixture (in production these'd come from a
  // claims feed; for the demo they're seeded into the audit log too
  // as claim.recorded events).
  const claims = GREENLINE_YEAR1_CLAIMS.map((c) => ({
    ref: c.ref,
    siteName: c.siteName,
    date: c.date,
    category: c.category,
    amount: c.paid + c.reserved,
  }));
  const totalLosses = claims.reduce((a, c) => a + c.amount, 0);
  const lossRatio = earnedPremium > 0 ? totalLosses / earnedPremium : 0;

  // MTA count from the audit log.
  const mtaCommitted = auditLog.filter((e) => e.kind === 'mta.committed');
  const mtaRefs = mtaCommitted
    .filter((e): e is Extract<AuditEvent, { kind: 'mta.committed' }> => e.kind === 'mta.committed')
    .map((e) => e.scheduleRef);

  // Subjectivities satisfied — for the demo, all subjectivities settle
  // within the year if the policy reaches renewal trigger.
  const subjectivitiesSatisfied = subjectivitiesTotal;

  return {
    earnedPremium,
    totalLosses,
    lossRatio,
    claimCount: claims.length,
    claims,
    mtaCount: mtaCommitted.length,
    mtaRefs,
    subjectivitiesSatisfied,
    subjectivitiesTotal,
    brokerRelationship: {
      name: 'Sarah Whitfield (SureStep)',
      sentiment: 'strong',
      note: 'High broker engagement throughout year-1: prompt MTA on Manchester, claim disclosures within hours, no escalations.',
    },
    marginalia:
      'Year-1 ran clean — two recoverable claims, no missed subjectivities, broker relationship healthy. The book wants this back.',
  };
}
