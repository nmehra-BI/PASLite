/**
 * Module 15 — group actions by decision class for the main ledger
 * page. Returns one summary per class in the canonical taxonomy
 * order, even when a class has zero actions (those render as muted
 * "not currently enabled" rows).
 */

import type { AutonomyPolicy, DecisionClassId } from '@/lib/autonomy/types';
import type { AutonomyAction, LedgerClassSummary } from './types';
import { computeRecallRate } from './computeRecallRate';

const CLASS_ORDER: DecisionClassId[] = [
  'TRIAGE-AUTO-PASS',
  'TRIAGE-AUTO-DECLINE',
  'CONFLICT-AUTO-RESOLVE',
  'BIND-AUTO-COMMIT',
  'NTU-AUTO-CAPTURE',
];

export function aggregateByClass(
  actions: AutonomyAction[],
  policy: AutonomyPolicy,
): LedgerClassSummary[] {
  return CLASS_ORDER.map((classId) => {
    const cls = policy.decisionClasses[classId];
    const ofClass = actions.filter((a) => a.classId === classId);
    const recall = computeRecallRate(ofClass);
    const sorted = [...ofClass].sort((a, b) =>
      b.firedAt.localeCompare(a.firedAt),
    );
    return {
      classId,
      classLabel: cls?.label ?? classId,
      enabled: cls?.enabled ?? false,
      count: ofClass.length,
      recalledCount: recall.recalled,
      recallRate: recall.rate,
      mostRecent: sorted[0] ?? null,
      recentRefs: sorted.slice(0, 5).map((a) => a.entryRef),
    };
  });
}
