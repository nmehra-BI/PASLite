/**
 * Module 15 — at-risk pattern detection.
 *
 * Three rule-based patterns for MVP. Each pattern is informational —
 * it surfaces a downstream signal that may indicate the AI's
 * autonomy bands are loose, not a verdict that the AI was wrong.
 * The underwriter judges.
 *
 *   1. claim-within-30        — auto-bound, then claim within 30 days
 *   2. cancel-within-60       — auto-bound, then cancelled within 60 days
 *   3. similar-profile-referred — auto-passed triage where similar
 *                                  profiles got referred by humans
 *                                  (carried by the fixture for MVP)
 */

import type { AtRiskPattern, AutonomyAction } from './types';

const DAY_MS = 86_400_000;

export function detectAtRisk(action: AutonomyAction): AtRiskPattern[] {
  const out: AtRiskPattern[] = [];

  // Pattern 1: BIND-AUTO-COMMIT followed by a claim within 30 days.
  if (action.classId === 'BIND-AUTO-COMMIT' && action.claim) {
    const filed = new Date(action.claim.filedAt).getTime();
    const fired = new Date(action.firedAt).getTime();
    if (filed - fired <= 30 * DAY_MS) {
      out.push({
        pattern: 'claim-within-30',
        description: `Pattern: claim filed within 30 days of auto-bind. ${action.claim.ref} · ${action.claim.category} · reserve £${action.claim.reserve.toLocaleString('en-GB')}.`,
        link: { label: '↗ open claim record', href: `#/claim/${action.claim.ref}` },
      });
    }
  }

  // Pattern 2: BIND-AUTO-COMMIT followed by cancellation within 60 days.
  if (
    action.classId === 'BIND-AUTO-COMMIT' &&
    action.cancelledAt &&
    action.outcome === 'cancelled'
  ) {
    const cancelled = new Date(action.cancelledAt).getTime();
    const fired = new Date(action.firedAt).getTime();
    const days = Math.floor((cancelled - fired) / DAY_MS);
    if (days <= 60) {
      out.push({
        pattern: 'cancel-within-60',
        description: `Pattern: insured cancelled ${days} days after auto-bind. The AI's bind band may not have surfaced a fit signal that should have referred.`,
      });
    }
  }

  // Pattern 3: TRIAGE-AUTO-PASS flagged at fixture-time as a similar
  // profile that humans referred. The fixture carries the signal so
  // downstream code can render it without recomputing similarity.
  for (const carried of action.atRiskPatterns) {
    if (carried.pattern === 'similar-profile-referred') {
      out.push(carried);
    }
  }

  return out;
}

/** Apply detection across a list, returning a new list with the
 *  atRiskPatterns field replaced by the union of carried + detected
 *  patterns. */
export function applyAtRiskDetection(actions: AutonomyAction[]): AutonomyAction[] {
  return actions.map((a) => {
    const patterns = detectAtRisk(a);
    if (patterns.length === 0) return { ...a, atRiskPatterns: [] };
    return { ...a, atRiskPatterns: patterns };
  });
}
