/**
 * Re-derive a listing entry's priority from its current state.
 *
 * For MVP the fixture seeds priority directly. This function recomputes
 * priority on demand — used by tests and (in a real cockpit) by a
 * background re-rank as time passes.
 */

import type { ListingEntry, ListingPriority } from './types';

const MS_PER_DAY = 86_400_000;

export function computePriority(entry: ListingEntry, now: Date = new Date()): ListingPriority {
  const ageMs = now.getTime() - new Date(entry.lastActivityAt).getTime();
  const ageDays = ageMs / MS_PER_DAY;

  // Conflicts >1 day old → HIGH; recent → MEDIUM.
  if (entry.phase === 'enrichment' && entry.status.toLowerCase().includes('conflict')) {
    return ageDays > 1 ? 'high' : 'medium';
  }

  // Triage referrals → MEDIUM (need senior review but not time-critical).
  if (entry.phase === 'triage' && entry.status.toUpperCase().includes('REFER')) {
    return 'medium';
  }

  // Recommendation ready high-confidence → HIGH (the ai is waiting).
  if (entry.phase === 'recommendation-ready' && /high confidence/i.test(entry.status)) {
    return 'high';
  }

  // Bound + subjectivity expiring soon — extract days from status text.
  if (entry.phase === 'in-force-with-mta' || entry.phase === 'bound') {
    const m = entry.status.match(/(\d+)\s+days?\b/i);
    if (m) {
      const days = parseInt(m[1]!, 10);
      if (days <= 14) return 'high';
      if (days <= 30) return 'medium';
      if (days <= 90) return 'watch';
    }
  }

  // Quote sent + waiting longer than typical → MEDIUM.
  if (entry.phase === 'awaiting-broker') {
    if (ageDays >= 5) return 'medium';
    if (ageDays >= 2) return 'watch';
    return 'steady';
  }

  // Closed / NTU / declined / cancelled → STEADY (informational).
  if (
    entry.phase === 'ntu' ||
    entry.phase === 'declined' ||
    entry.phase === 'cancelled'
  ) {
    return 'steady';
  }

  return entry.priority;
}
