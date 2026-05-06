/**
 * Subjectivity records created at bind. These are the warranties and
 * tracking obligations the policy carries through its term. Each
 * record originates from a warranty on the slip; in production they
 * would be monitored against external feeds (EA permit registry,
 * broker-disclosure cadence). For MVP the data structures exist and
 * the records are persisted to the audit log; the monitoring
 * automation is out of scope.
 */

import { effectiveValue } from '@/lib/field';
import type { Submission } from './types';
import type { SubjectivityRecord, SubjectivityType } from '@/lib/bind/types';

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Generate the subjectivity records that should be created when the
 * given submission is bound. For Greenline this returns two records:
 * the EA permit warranty (with a critical date) and the fire
 * suppression maintenance warranty.
 *
 * Pure — no IDs are randomised; the same submission produces the same
 * records every time so the seed is reproducible.
 */
export function deriveSubjectivities(
  submission: Submission,
): Array<Omit<SubjectivityRecord, 'createdAt' | 'status'>> {
  const records: Array<Omit<SubjectivityRecord, 'createdAt' | 'status'>> = [];

  // Subjectivity 1 — EA permit warranty.
  const sites = submission.sites ?? [];
  const inceptionRaw = effectiveValue(submission.cover.inceptionDate) as string | null;
  const expiryRaw = effectiveValue(submission.cover.expiryDate) as string | null;

  const sitesWithPermit = sites.filter((s) => {
    const ref = effectiveValue(s.permitRef) as string | null;
    return ref !== null && ref !== '—';
  });

  const expiringInTerm = sites.find((s) => {
    const exp = effectiveValue(s.permitExpiry) as string | null;
    if (!exp || !inceptionRaw || !expiryRaw) return false;
    return exp >= inceptionRaw && exp <= expiryRaw;
  });

  const criticalDate = expiringInTerm
    ? (effectiveValue(expiringInTerm.permitExpiry) as string)
    : null;

  const permitDescription = criticalDate
    ? `EA permit must remain in force throughout the policy term. Earliest expiry: ${SHORT_DATE_FMT.format(new Date(criticalDate))}.`
    : 'EA permit must remain in force throughout the policy term.';

  const affectedSites = expiringInTerm
    ? [
        `${effectiveValue(expiringInTerm.name) as string} (${effectiveValue(expiringInTerm.permitRef) as string})`,
      ]
    : sitesWithPermit
        .map((s) => effectiveValue(s.name) as string | null)
        .filter((n): n is string => n !== null);

  records.push({
    id: 'SUBJ-001',
    subjectivityType: 'permit-warranty',
    description: permitDescription,
    affectedSites,
    criticalDate,
    actionRequired: criticalDate
      ? `Request renewed permit evidence by ${SHORT_DATE_FMT.format(addDays(new Date(criticalDate), 14))}`
      : null,
    autoMonitor: true,
  });

  // Subjectivity 2 — Fire suppression maintenance warranty.
  records.push({
    id: 'SUBJ-002',
    subjectivityType: 'maintenance-warranty',
    description:
      'Fire suppression to be maintained at all sites; material change to be notified within 7 days.',
    affectedSites: sites
      .map((s) => effectiveValue(s.name) as string | null)
      .filter((n): n is string => n !== null),
    criticalDate: null,
    actionRequired: null,
    autoMonitor: false,
  });

  return records;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Stable label per type, used by the panel + inspector. */
export function subjectivityTypeLabel(t: SubjectivityType): string {
  return t === 'permit-warranty' ? 'permit warranty' : 'maintenance warranty';
}

/**
 * Days from now to the critical date, or null if there isn't one.
 * Used by both the panel ("53 days") and the lifecycle ribbon (tick
 * position).
 */
export function daysUntilCritical(
  iso: string | null,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime() - now.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}
