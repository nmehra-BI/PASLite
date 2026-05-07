/**
 * Module 14 — 30-day rolling metrics per decision class.
 *
 * Hand-curated for the demo. In production these would derive from
 * the audit log over the rolling window.
 */

import type {
  DecisionClassId,
  DecisionClassMetrics,
} from '@/lib/autonomy/types';

const SEED: Record<DecisionClassId, DecisionClassMetrics> = {
  'TRIAGE-AUTO-PASS': {
    classId: 'TRIAGE-AUTO-PASS',
    windowDays: 30,
    autoFired: 47,
    recalled: 0,
    accuracy: 1.0,
    recentRefs: ['SUB-29487', 'SUB-29442', 'SUB-29401', 'SUB-29388'],
  },
  'TRIAGE-AUTO-DECLINE': {
    classId: 'TRIAGE-AUTO-DECLINE',
    windowDays: 30,
    autoFired: 8,
    recalled: 0,
    accuracy: 1.0,
    recentRefs: ['SUB-29345'],
  },
  'CONFLICT-AUTO-RESOLVE': {
    classId: 'CONFLICT-AUTO-RESOLVE',
    windowDays: 30,
    autoFired: 0,
    recalled: 0,
    accuracy: 1.0,
    recentRefs: [],
  },
  'BIND-AUTO-COMMIT': {
    classId: 'BIND-AUTO-COMMIT',
    windowDays: 30,
    autoFired: 0,
    recalled: 0,
    accuracy: 1.0,
    recentRefs: [],
  },
  'NTU-AUTO-CAPTURE': {
    classId: 'NTU-AUTO-CAPTURE',
    windowDays: 30,
    autoFired: 0,
    recalled: 0,
    accuracy: 1.0,
    recentRefs: [],
  },
};

export function getAutonomyMetrics(): Record<DecisionClassId, DecisionClassMetrics> {
  return JSON.parse(JSON.stringify(SEED)) as Record<
    DecisionClassId,
    DecisionClassMetrics
  >;
}
