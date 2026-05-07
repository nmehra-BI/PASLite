/**
 * Module 15 — cross-submission ledger query.
 *
 * Reads the 30-day fixture history (the canonical body of demo
 * actions) and merges in the live autonomy store's firedByRef map
 * (so any action the user fired during the current cockpit session
 * also surfaces in the ledger). Live entries override fixture
 * entries on entryRef collision.
 *
 * Returns a fully enriched AutonomyAction list with at-risk patterns
 * applied.
 */

import { getLedgerHistory } from '@/lib/fixtures';
import { useAutonomy } from '@/store/autonomy';
import type {
  AutonomyAction,
  LedgerFilters,
} from './types';
import { applyAtRiskDetection } from './detectAtRisk';

const DAY_MS = 86_400_000;

/** Returns the full enriched action list, ready for filtering. */
export function getAllAutonomyActions(): AutonomyAction[] {
  const fixture = getLedgerHistory();
  const live = useAutonomy.getState().firedByRef;

  // Build a map keyed by entryRef so live entries override fixture.
  const map = new Map<string, AutonomyAction>();
  for (const a of fixture) map.set(a.entryRef, a);
  for (const ref of Object.keys(live)) {
    const fired = live[ref]!;
    if (map.has(ref)) {
      // Update the existing fixture row's recall fields with live state.
      const existing = map.get(ref)!;
      map.set(ref, {
        ...existing,
        recalled: fired.recalled,
        recalledAt: fired.recalledAt,
        recallReason: fired.recallReason,
      });
    } else {
      // Live-only action — present, but with sparse outcome data.
      map.set(ref, {
        id: `live-${ref}`,
        entryRef: ref,
        insuredName: 'Greenline Recycling Ltd',
        brokerName: 'SureStep Brokers Ltd',
        brokerHistoryCount: 12,
        classId: fired.classId,
        action: fired.action,
        policyVersion: fired.policyVersion,
        firedAt: fired.firedAt,
        conditionsMet: fired.conditionsMet,
        conditionsBlocked: [],
        confidence: fired.confidence,
        byAi: fired.byAi,
        recallExpiresAt: fired.recallExpiresAt,
        recalled: fired.recalled,
        recalledAt: fired.recalledAt,
        recallReason: fired.recallReason,
        recalledBy: fired.recalled ? 'nm' : null,
        premium: null,
        capacityConsumption: null,
        outcome: fired.recalled ? 'in-flight' : 'in-flight',
        policyRef: null,
        cancelledAt: null,
        claim: null,
        atRiskPatterns: [],
      });
    }
  }

  const merged = Array.from(map.values()).sort((a, b) =>
    b.firedAt.localeCompare(a.firedAt),
  );
  return applyAtRiskDetection(merged);
}

/** Filtered query — applied on top of getAllAutonomyActions. */
export function queryAutonomyActions(
  filters: LedgerFilters,
  now: Date = new Date(),
): AutonomyAction[] {
  const all = getAllAutonomyActions();
  const search = filters.search.trim().toLowerCase();
  const cutoff =
    filters.tab === 'last-7-days'
      ? now.getTime() - 7 * DAY_MS
      : filters.tab === 'last-30-days'
        ? now.getTime() - 30 * DAY_MS
        : null;

  return all.filter((a) => {
    if (cutoff !== null && new Date(a.firedAt).getTime() < cutoff) return false;
    if (filters.tab === 'recalled' && !a.recalled) return false;
    if (filters.tab === 'at-risk' && a.atRiskPatterns.length === 0) return false;
    if (filters.classes.length > 0 && !filters.classes.includes(a.classId)) {
      return false;
    }
    if (search.length > 0) {
      const hay = `${a.entryRef} ${a.insuredName} ${a.brokerName} ${a.classId}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

/** Per-policy lookup — used by AutonomyProvenancePanel. */
export function autonomyActionsForPolicy(policyRef: string): AutonomyAction[] {
  const all = getAllAutonomyActions();
  return all.filter(
    (a) => a.policyRef === policyRef || a.entryRef === policyRef,
  );
}
