/**
 * Module 14 — exception queue seed.
 *
 * 12 exceptions across the four reason categories from the spec.
 * Some refs overlap with listingDemo (those submissions that
 * fall outside autonomy bands appear in both surfaces).
 */

import type { ExceptionRecord } from '@/lib/autonomy/types';

const NOW = '2027-05-09T08:30:00+01:00';

function hoursAgo(h: number): string {
  return new Date(new Date(NOW).getTime() - h * 60 * 60_000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(new Date(NOW).getTime() - d * 86_400_000).toISOString();
}

export const EXCEPTION_QUEUE_SEED: ExceptionRecord[] = [
  // ─── HIGH PRIORITY ────────────────────────────────────────────────
  {
    entryRef: 'SUB-29512',
    reasonCategory: 'profile-edge',
    reason: 'Confidence 0.89 — below 0.95 auto-pass threshold',
    marginalia:
      'Profile borderline — 4 binders matched, but 1 had LR 78%. The cockpit pulled this for human review because the loss in that one binder is significant.',
    priority: 'high',
    flaggedAt: hoursAgo(28),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29509',
    reasonCategory: 'capacity',
    reason: 'Capacity edge: this submission would consume 11.4% of headroom (band ≤ 10%)',
    marginalia:
      'Capacity reading at 24% of cap; this one risk would tip three concentration concerns. Worth a senior glance.',
    priority: 'high',
    flaggedAt: hoursAgo(31),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },

  // ─── NEEDS REVIEW THIS WEEK ───────────────────────────────────────
  {
    entryRef: 'SUB-29498',
    reasonCategory: 'conflict',
    reason: 'Companies House turnover £5.4M vs broker-stated £6.2M — 14.8% gap',
    marginalia:
      'First-time broker; over-stated turnover by ~15%. The cockpit will not auto-resolve gaps from new brokers without a track record.',
    priority: 'medium',
    flaggedAt: hoursAgo(12),
    closestClassId: 'CONFLICT-AUTO-RESOLVE',
  },
  {
    entryRef: 'SUB-29495',
    reasonCategory: 'capacity',
    reason: 'Triage REFER · capacity edge case (Synd 2358 at 89%)',
    marginalia:
      'Edge of capacity; standard triage would refer rather than pass. Senior review for line-size adjustment.',
    priority: 'medium',
    flaggedAt: hoursAgo(8),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29488',
    reasonCategory: 'confidence',
    reason: 'AI confidence 0.91 — below 0.95 auto-pass threshold',
    marginalia:
      'Mixed signals on materials class — broker described "mixed dry recyclables" but the slip mentions hazardous waste storage at one site.',
    priority: 'medium',
    flaggedAt: hoursAgo(18),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29476',
    reasonCategory: 'profile-edge',
    reason: 'Profile match: 2 binders (3 needed for auto-pass)',
    marginalia:
      'Unusual geography (Cornwall); the W&R book has limited recent precedent. Defer to underwriter judgment on geographic risk.',
    priority: 'medium',
    flaggedAt: hoursAgo(20),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29472',
    reasonCategory: 'broker-history',
    reason: 'Broker has 1 prior submission (band requires ≥3)',
    marginalia:
      'New broker — Cromer Broking second-ever submission. Build trust with manual review until pattern is established.',
    priority: 'medium',
    flaggedAt: hoursAgo(14),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29468',
    reasonCategory: 'confidence',
    reason: 'Recommendation confidence "moderate" — auto-bind requires "high"',
    marginalia:
      "FCT-002 historical performance only moderate; matured cohort thin (5 binders, 60% profitable). Underwriter call.",
    priority: 'medium',
    flaggedAt: hoursAgo(16),
    closestClassId: 'BIND-AUTO-COMMIT',
  },

  // ─── MONITORING ───────────────────────────────────────────────────
  {
    entryRef: 'SUB-29455',
    reasonCategory: 'profile-edge',
    reason: 'Profile match 6 binders, but one outlier loss (88% LR)',
    marginalia:
      'Cohort otherwise clean. Outlier loss was a 2023 fire at a now-closed site; not material for this risk. Recommend pass on review.',
    priority: 'low',
    flaggedAt: daysAgo(2),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29449',
    reasonCategory: 'capacity',
    reason: 'Capacity consumption 9.8% — narrowly under threshold',
    marginalia:
      'Just under 10% threshold for auto-pass. The cockpit erred toward review given the proximity.',
    priority: 'low',
    flaggedAt: daysAgo(3),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29441',
    reasonCategory: 'sanctions',
    reason: 'Companies House director name partial-match · 0.62 score',
    marginalia:
      'Common UK name (J. Smith); likely false-positive but autonomy bands require zero sanctions ambiguity.',
    priority: 'low',
    flaggedAt: daysAgo(4),
    closestClassId: 'TRIAGE-AUTO-PASS',
  },
  {
    entryRef: 'SUB-29435',
    reasonCategory: 'conflict',
    reason: 'EA permit registry not yet returned — gap detected',
    marginalia:
      'Permit registry slow this week (EA reported maintenance). Standard gap-resolution path.',
    priority: 'low',
    flaggedAt: daysAgo(5),
    closestClassId: 'CONFLICT-AUTO-RESOLVE',
  },
];

export function getExceptionQueueSeed(): ExceptionRecord[] {
  return JSON.parse(JSON.stringify(EXCEPTION_QUEUE_SEED)) as ExceptionRecord[];
}
