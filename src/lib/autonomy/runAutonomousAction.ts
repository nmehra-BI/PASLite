/**
 * Schedule + fire + recall autonomous actions.
 *
 * The orchestrator is event-sourced like the rest of the cockpit:
 * scheduling, firing, and recalling each emit a single audit event
 * the autonomy store reducer applies.
 */

import { useRanBerri } from '@/store';
import { useAutonomy } from '@/store/autonomy';
import { evaluatePolicy, type EvaluationSnapshot } from './evaluatePolicy';
import type {
  DecisionClassId,
  ExceptionPriority,
  ExceptionRecord,
} from './types';

const MS_PER_HOUR = 60 * 60_000;

export type ScheduleInputs = {
  entryRef: string;
  snapshot: EvaluationSnapshot;
  /** Seconds before the action fires; default 120s. */
  delaySeconds?: number;
  /** "Now" override for tests / determinism. */
  now?: Date;
};

export type ScheduleOutcome =
  | {
      kind: 'scheduled';
      classId: DecisionClassId;
      firesAt: string;
      conditionsMet: string[];
    }
  | { kind: 'exception'; record: ExceptionRecord }
  | { kind: 'no-eligible-class'; reason: string };

export function scheduleAutonomousAction(input: ScheduleInputs): ScheduleOutcome {
  const policy = useAutonomy.getState().policy;
  const evalOutcome = evaluatePolicy(input.snapshot, policy);
  const now = input.now ?? new Date();

  if (!evalOutcome.eligible) {
    // Promote to exception when there's a closest class — i.e. the
    // submission tried to qualify but missed by a clear band check.
    if (evalOutcome.closestClassId) {
      const priority = derivePriority(input.snapshot, evalOutcome.reason, now);
      const record: ExceptionRecord = {
        entryRef: input.entryRef,
        reasonCategory: categorise(evalOutcome.reason),
        reason: evalOutcome.reason,
        marginalia: null,
        priority,
        flaggedAt: now.toISOString(),
        closestClassId: evalOutcome.closestClassId,
      };
      useRanBerri.getState().appendAuditEvent({
        actor: { kind: 'system' },
        kind: 'autonomy.exceptionFlagged',
        entryRef: input.entryRef,
        reasonCategory: record.reasonCategory,
        reason: record.reason,
        priority,
      });
      useAutonomy.getState().pushException(record);
      return { kind: 'exception', record };
    }
    return { kind: 'no-eligible-class', reason: evalOutcome.reason };
  }

  const delay = (input.delaySeconds ?? 120) * 1000;
  const firesAt = new Date(now.getTime() + delay).toISOString();
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'autonomy.actionScheduled',
    entryRef: input.entryRef,
    classId: evalOutcome.classId,
    firesAt,
    conditionsMet: evalOutcome.conditionsMet,
    confidence: evalOutcome.confidence,
  });
  useAutonomy.getState().scheduleAction({
    entryRef: input.entryRef,
    classId: evalOutcome.classId,
    scheduledAt: now.toISOString(),
    firesAt,
    conditionsMet: evalOutcome.conditionsMet,
    confidence: evalOutcome.confidence,
  });
  return {
    kind: 'scheduled',
    classId: evalOutcome.classId,
    firesAt,
    conditionsMet: evalOutcome.conditionsMet,
  };
}

export type FireInputs = {
  entryRef: string;
  byAi?: string;
  now?: Date;
};

/** Fire the scheduled action immediately (or once the timer elapses). */
export function fireAutonomousAction(input: FireInputs): boolean {
  const scheduled = useAutonomy.getState().scheduledByRef[input.entryRef];
  if (!scheduled) return false;
  const policy = useAutonomy.getState().policy;
  const cls = policy.decisionClasses[scheduled.classId];
  if (!cls) return false;

  const now = input.now ?? new Date();
  const recallExpiresAt = new Date(
    now.getTime() + cls.recallWindowHours * MS_PER_HOUR,
  ).toISOString();

  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'autonomy.actionFired',
    entryRef: input.entryRef,
    classId: scheduled.classId,
    action: cls.autonomousAction,
    policyVersion: policy.version,
    conditionsMet: scheduled.conditionsMet,
    confidence: scheduled.confidence,
    byAi: input.byAi ?? 'Sonnet',
    recallExpiresAt,
  });
  useAutonomy.getState().fireAction({
    entryRef: input.entryRef,
    classId: scheduled.classId,
    action: cls.autonomousAction,
    policyVersion: policy.version,
    firedAt: now.toISOString(),
    conditionsMet: scheduled.conditionsMet,
    confidence: scheduled.confidence,
    byAi: input.byAi ?? 'Sonnet',
    recallExpiresAt,
    recalled: false,
    recalledAt: null,
    recallReason: null,
  });
  return true;
}

export type RecallInputs = {
  entryRef: string;
  reason: string;
  recalledBy: string;
  overrideTo?: 'refer' | 'decline' | 'pass' | 'manual';
  now?: Date;
};

export function recallAutonomousAction(input: RecallInputs): boolean {
  const fired = useAutonomy.getState().firedByRef[input.entryRef];
  if (!fired || fired.recalled) return false;
  const now = input.now ?? new Date();
  if (new Date(fired.recallExpiresAt).getTime() < now.getTime()) return false;
  if (input.reason.trim().length < 10) {
    throw new Error('recallAutonomousAction: reason must be ≥10 chars');
  }
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'underwriter', id: input.recalledBy },
    kind: 'autonomy.actionRecalled',
    entryRef: input.entryRef,
    classId: fired.classId,
    firedAt: fired.firedAt,
    reason: input.reason.trim(),
    recalledBy: input.recalledBy,
    ...(input.overrideTo ? { overrideTo: input.overrideTo } : {}),
  });
  useAutonomy.getState().recallAction(
    input.entryRef,
    input.reason.trim(),
    now.toISOString(),
  );
  return true;
}

/** Categorise an evaluator reason string into one of the queue's
 *  reason buckets. Best-effort matching from the reason text. */
export function categorise(reason: string): ExceptionRecord['reasonCategory'] {
  const r = reason.toLowerCase();
  if (r.includes('confidence')) return 'confidence';
  if (r.includes('conflict')) return 'conflict';
  if (r.includes('gap')) return 'conflict';
  if (r.includes('capacity')) return 'capacity';
  if (r.includes('sanctions')) return 'sanctions';
  if (r.includes('broker history')) return 'broker-history';
  if (r.includes('profile match')) return 'profile-edge';
  if (r.includes('cohort')) return 'profile-edge';
  return 'profile-edge';
}

/** Derive an exception priority from the snapshot + reason + age. */
export function derivePriority(
  snapshot: EvaluationSnapshot,
  reason: string,
  now: Date = new Date(),
): ExceptionPriority {
  const r = reason.toLowerCase();
  // Capacity edge cases always HIGH — book-level concern.
  if (r.includes('capacity')) return 'high';
  // Sanctions ambiguity always at least MEDIUM.
  if (r.includes('sanctions')) return 'medium';
  // Anything where we have a high-LR cohort outlier.
  if ((snapshot.cohortLossRatio ?? 0) > 0.6) return 'high';
  // Default ladder by time-since-flagged is handled in
  // determineExceptionPriority for already-queued records.
  void now;
  return 'medium';
}

/** Re-rank an existing exception record based on time in queue. */
export function determineExceptionPriority(
  record: ExceptionRecord,
  now: Date = new Date(),
): ExceptionPriority {
  const ageHrs = (now.getTime() - new Date(record.flaggedAt).getTime()) / MS_PER_HOUR;
  if (ageHrs > 24) return 'high';
  if (ageHrs > 4) return 'medium';
  return record.priority;
}

