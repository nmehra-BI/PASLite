import { useEffect, useRef } from 'react';
import { useRanBerri } from '@/store';
import { useAutonomy } from '@/store/autonomy';
import {
  fireAutonomousAction,
  scheduleAutonomousAction,
} from '@/lib/autonomy/runAutonomousAction';
import type { EvaluationSnapshot } from '@/lib/autonomy/evaluatePolicy';

/**
 * Module 14 — runtime autonomy orchestrator.
 *
 * Watches the audit log for `triage.completed` and, when the verdict
 * is PASS, projects an EvaluationSnapshot from the live cockpit
 * state and calls `scheduleAutonomousAction`. The submission ref is
 * the live submission's `id`. A short delay (10s) is used in the
 * demo so the underwriter can see the scheduled countdown before the
 * action fires; production would use the policy's configured delay.
 *
 * Independently runs a 1Hz tick that fires any scheduled action
 * whose firesAt < now. The same hook is responsible for cleanup on
 * unmount.
 */

const DEMO_DELAY_SECONDS = 10;

/** Project an EvaluationSnapshot from the live cockpit state. */
function projectSnapshot(
  triage: ReturnType<typeof useRanBerri.getState>['triage'],
  rating: ReturnType<typeof useRanBerri.getState>['rating'],
): EvaluationSnapshot | null {
  if (triage.phase !== 'settled' || triage.verdict !== 'pass') return null;

  // Demo confidence — Greenline triage is a clean pass, so confidence
  // sits comfortably above the 0.95 auto-pass band.
  const confidence = 0.97;

  return {
    confidence,
    premium: rating.output?.premium ?? null,
    capacityConsumption: 0.04,
    capacityHeadroomFraction: 0.45,
    cohortLossRatio: 0.32,
    profileMatchCount: 6,
    cohortLossesAvg: 0.3,
    siteCount: 1,
    turnover: 4_000_000,
    materialClasses: ['mixed-recyclables'],
    geographies: ['UK'],
    brokerHistoryCount: 8,
    sanctionsAlertLevel: 'clear',
    appetiteFailureCategorical: false,
    anyConflictUnresolved: false,
    anyGapUnresolved: false,
    anyOverrideRequired: triage.checks.some((c) => c.override !== undefined),
    recommendationVerdict: 'bind',
    recommendationConfidence: 'high',
  };
}

export function useAutonomyOrchestrator() {
  const submission = useRanBerri((s) => s.submission);
  const triage = useRanBerri((s) => s.triage);
  const rating = useRanBerri((s) => s.rating);
  const auditLog = useRanBerri((s) => s.auditLog);
  const lastScheduledForRef = useRef<string | null>(null);

  // 1. Schedule on triage completion when verdict is pass + class enabled.
  useEffect(() => {
    if (!submission) return;
    const ref = submission.id;
    if (lastScheduledForRef.current === ref) return;
    if (useAutonomy.getState().scheduledByRef[ref]) return;
    if (useAutonomy.getState().firedByRef[ref]) return;

    // Wait until the audit log carries triage.completed.
    const triageCompleted = auditLog.some((e) => e.kind === 'triage.completed');
    if (!triageCompleted) return;

    const snapshot = projectSnapshot(triage, rating);
    if (!snapshot) return;

    const result = scheduleAutonomousAction({
      entryRef: ref,
      snapshot,
      delaySeconds: DEMO_DELAY_SECONDS,
    });
    if (result.kind === 'scheduled' || result.kind === 'exception') {
      lastScheduledForRef.current = ref;
    }
  }, [submission, triage, rating, auditLog]);

  // 2. Fire any scheduled action whose firesAt has elapsed.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const scheduled = useAutonomy.getState().scheduledByRef;
      for (const ref of Object.keys(scheduled)) {
        const s = scheduled[ref]!;
        if (new Date(s.firesAt).getTime() <= now) {
          fireAutonomousAction({ entryRef: ref });
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
}
