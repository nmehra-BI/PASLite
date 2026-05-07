import { describe, it, expect } from 'vitest';
import { evaluatePolicy, evaluateClass, type EvaluationSnapshot } from './evaluatePolicy';
import { SEED_AUTONOMY_POLICY } from '@/lib/fixtures/autonomyPolicy';
import type { AutonomyPolicy } from './types';

function baseSnapshot(): EvaluationSnapshot {
  return {
    confidence: 0.97,
    premium: 28_000,
    capacityConsumption: 0.05,
    capacityHeadroomFraction: 0.4,
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
    anyOverrideRequired: false,
    recommendationVerdict: 'bind',
    recommendationConfidence: 'high',
  };
}

function clonePolicy(): AutonomyPolicy {
  return JSON.parse(JSON.stringify(SEED_AUTONOMY_POLICY)) as AutonomyPolicy;
}

describe('evaluatePolicy — happy path', () => {
  it('returns eligible TRIAGE-AUTO-PASS for a clean snapshot', () => {
    const out = evaluatePolicy(baseSnapshot(), SEED_AUTONOMY_POLICY);
    expect(out.eligible).toBe(true);
    if (out.eligible) {
      expect(out.classId).toBe('TRIAGE-AUTO-PASS');
      expect(out.conditionsMet.length).toBeGreaterThan(0);
      expect(out.confidence).toBe(0.97);
    }
  });
});

describe('evaluatePolicy — mustMatch failures', () => {
  it('blocks when confidence below threshold', () => {
    const s = baseSnapshot();
    s.confidence = 0.89;
    const out = evaluatePolicy(s, SEED_AUTONOMY_POLICY);
    expect(out.eligible).toBe(false);
    if (!out.eligible) {
      expect(out.reason).toMatch(/confidence/);
      expect(out.closestClassId).toBeDefined();
    }
  });

  it('blocks when premium above threshold', () => {
    const s = baseSnapshot();
    s.premium = 75_000;
    const out = evaluatePolicy(s, SEED_AUTONOMY_POLICY);
    expect(out.eligible).toBe(false);
    if (!out.eligible) expect(out.reason).toMatch(/premium/);
  });

  it('blocks when broker history too thin', () => {
    const s = baseSnapshot();
    s.brokerHistoryCount = 1;
    const out = evaluatePolicy(s, SEED_AUTONOMY_POLICY);
    expect(out.eligible).toBe(false);
    if (!out.eligible) expect(out.reason).toMatch(/broker history/);
  });

  it('blocks when capacity consumption exceeds band', () => {
    const s = baseSnapshot();
    s.capacityConsumption = 0.13;
    const out = evaluatePolicy(s, SEED_AUTONOMY_POLICY);
    expect(out.eligible).toBe(false);
    if (!out.eligible) expect(out.reason).toMatch(/capacity/);
  });
});

describe('evaluatePolicy — cannotExceed blockers', () => {
  it('blocks TRIAGE-AUTO-PASS when sanctions are partial-match', () => {
    const s = baseSnapshot();
    s.sanctionsAlertLevel = 'partial-match';
    const out = evaluateClass(
      s,
      SEED_AUTONOMY_POLICY.decisionClasses['TRIAGE-AUTO-PASS'],
    );
    expect(out.eligible).toBe(false);
  });

  it('blocks TRIAGE-AUTO-PASS when any override required', () => {
    const s = baseSnapshot();
    s.anyOverrideRequired = true;
    const out = evaluateClass(
      s,
      SEED_AUTONOMY_POLICY.decisionClasses['TRIAGE-AUTO-PASS'],
    );
    expect(out.eligible).toBe(false);
    if (!out.eligible) expect(out.reason).toMatch(/override/);
  });
});

describe('evaluatePolicy — disabled classes', () => {
  it('skips disabled classes; falls through with no closest match', () => {
    const policy = clonePolicy();
    // Disable both default classes; only disabled classes remain.
    policy.decisionClasses['TRIAGE-AUTO-PASS'].enabled = false;
    policy.decisionClasses['TRIAGE-AUTO-DECLINE'].enabled = false;
    const out = evaluatePolicy(baseSnapshot(), policy);
    expect(out.eligible).toBe(false);
    if (!out.eligible) {
      expect(out.closestClassId).toBeUndefined();
    }
  });
});

describe('evaluatePolicy — auto-decline path', () => {
  it('auto-declines when appetite failure is categorical and confidence is high', () => {
    const policy = clonePolicy();
    policy.decisionClasses['TRIAGE-AUTO-PASS'].enabled = false;
    const s = baseSnapshot();
    s.confidence = 0.99;
    s.appetiteFailureCategorical = true;
    const out = evaluatePolicy(s, policy);
    expect(out.eligible).toBe(true);
    if (out.eligible) expect(out.classId).toBe('TRIAGE-AUTO-DECLINE');
  });
});
