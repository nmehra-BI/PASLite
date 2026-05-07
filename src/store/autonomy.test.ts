import { describe, it, expect, beforeEach } from 'vitest';
import { useAutonomy } from './autonomy';
import {
  scheduleAutonomousAction,
  fireAutonomousAction,
  recallAutonomousAction,
} from '@/lib/autonomy/runAutonomousAction';
import { useRanBerri } from './store';
import { getSeedAutonomyPolicy } from '@/lib/fixtures/autonomyPolicy';
import { getAutonomyMetrics } from '@/lib/fixtures/autonomyMetrics';
import type { EvaluationSnapshot } from '@/lib/autonomy/evaluatePolicy';

function snap(): EvaluationSnapshot {
  return {
    confidence: 0.97,
    premium: 28_000,
    capacityConsumption: 0.05,
    capacityHeadroomFraction: 0.4,
    cohortLossRatio: 0.3,
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
    anyOverrideRequired: false,
    recommendationVerdict: 'bind',
    recommendationConfidence: 'high',
  };
}

describe('autonomy store + lifecycle', () => {
  beforeEach(() => {
    useAutonomy.setState({
      policy: getSeedAutonomyPolicy(),
      metrics: getAutonomyMetrics(),
      scheduledByRef: {},
      firedByRef: {},
      exceptions: [],
    });
    useRanBerri.setState({ ...useRanBerri.getState(), auditLog: [] });
  });

  it('toggleClass flips a class on/off without mutating other classes', () => {
    useAutonomy.getState().toggleClass('TRIAGE-AUTO-PASS', false, 'nm');
    expect(
      useAutonomy.getState().policy.decisionClasses['TRIAGE-AUTO-PASS'].enabled,
    ).toBe(false);
    expect(
      useAutonomy.getState().policy.decisionClasses['TRIAGE-AUTO-DECLINE'].enabled,
    ).toBe(true);
  });

  it('scheduleAutonomousAction → fireAutonomousAction → recallAutonomousAction lifecycle', () => {
    const ref = 'SUB-99001';
    const out = scheduleAutonomousAction({ entryRef: ref, snapshot: snap() });
    expect(out.kind).toBe('scheduled');
    expect(useAutonomy.getState().scheduledByRef[ref]).toBeDefined();

    const fired = fireAutonomousAction({ entryRef: ref });
    expect(fired).toBe(true);
    expect(useAutonomy.getState().scheduledByRef[ref]).toBeUndefined();
    expect(useAutonomy.getState().firedByRef[ref]).toBeDefined();
    expect(useAutonomy.getState().firedByRef[ref].action).toBe('pass');

    const recalled = recallAutonomousAction({
      entryRef: ref,
      reason: 'Want to check geography manually before passing.',
      recalledBy: 'nm',
      overrideTo: 'refer',
    });
    expect(recalled).toBe(true);
    expect(useAutonomy.getState().firedByRef[ref].recalled).toBe(true);
    expect(useAutonomy.getState().firedByRef[ref].recallReason).toMatch(/geography/);
  });

  it('recallAutonomousAction throws when reason is too short', () => {
    const ref = 'SUB-99002';
    scheduleAutonomousAction({ entryRef: ref, snapshot: snap() });
    fireAutonomousAction({ entryRef: ref });
    expect(() =>
      recallAutonomousAction({
        entryRef: ref,
        reason: 'too short',
        recalledBy: 'nm',
      }),
    ).toThrow(/10 chars/);
  });

  it('scheduleAutonomousAction promotes ineligible snapshots to exceptions', () => {
    const s = snap();
    s.confidence = 0.85;
    const out = scheduleAutonomousAction({ entryRef: 'SUB-99003', snapshot: s });
    expect(out.kind).toBe('exception');
    expect(useAutonomy.getState().exceptions.some((e) => e.entryRef === 'SUB-99003')).toBe(true);
  });

  it('pushException is idempotent for the same ref', () => {
    const r = {
      entryRef: 'SUB-99004',
      reasonCategory: 'confidence' as const,
      reason: 'test',
      marginalia: null,
      priority: 'medium' as const,
      flaggedAt: new Date().toISOString(),
    };
    useAutonomy.getState().pushException(r);
    useAutonomy.getState().pushException(r);
    expect(
      useAutonomy.getState().exceptions.filter((e) => e.entryRef === 'SUB-99004').length,
    ).toBe(1);
  });

  it('resolveException removes the record', () => {
    const r = {
      entryRef: 'SUB-99005',
      reasonCategory: 'confidence' as const,
      reason: 'test',
      marginalia: null,
      priority: 'low' as const,
      flaggedAt: new Date().toISOString(),
    };
    useAutonomy.getState().pushException(r);
    useAutonomy.getState().resolveException('SUB-99005');
    expect(useAutonomy.getState().exceptions.find((e) => e.entryRef === 'SUB-99005')).toBeUndefined();
  });
});
