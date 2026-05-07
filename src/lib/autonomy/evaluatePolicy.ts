/**
 * Evaluate a submission's eligibility for autonomous handling under
 * the live policy. Returns either:
 *   - eligible: true  with classId + conditionsMet + confidence
 *   - eligible: false with reason + closestClassId
 *
 * Pure function over the snapshot. Same inputs → same output. Tests
 * exercise this directly without spinning up the store.
 */

import type {
  AutonomyPolicy,
  ConditionSet,
  DecisionClassConfig,
  DecisionClassId,
  EvaluationOutcome,
} from './types';

/**
 * Submission-derived snapshot the evaluator reads. Whoever calls
 * evaluatePolicy is responsible for projecting from the audit log
 * + listing fixture into this shape.
 */
export type EvaluationSnapshot = {
  /** AI confidence in the proposed action (0–1). */
  confidence: number;
  /** £ premium currently on the slip / proposed at bind. */
  premium: number | null;
  /** Capacity consumption as fraction of headroom (0–1). */
  capacityConsumption: number;
  /** Capacity headroom as fraction of total cap (0–1). */
  capacityHeadroomFraction: number;
  /** Historical LR for the matched profile cohort. */
  cohortLossRatio: number | null;
  /** Number of close-profile binders in the cohort. */
  profileMatchCount: number;
  /** Average historical loss across cohort. */
  cohortLossesAvg: number | null;
  siteCount: number;
  turnover: number | null;
  materialClasses: string[];
  geographies: string[];
  brokerHistoryCount: number;
  sanctionsAlertLevel: 'clear' | 'partial-match' | 'hit';
  appetiteFailureCategorical: boolean;
  anyConflictUnresolved: boolean;
  anyGapUnresolved: boolean;
  anyOverrideRequired: boolean;
  /** Recommendation verdict if computed. */
  recommendationVerdict: 'bind' | 'refer' | 'ntu' | null;
  recommendationConfidence: 'high' | 'moderate' | 'low' | null;
  /** Conflict-specific fields (when evaluating CONFLICT-AUTO-RESOLVE). */
  conflictType?: 'timing-mismatch' | 'rounding' | 'data-source-lag';
  gapAmountAbs?: number;
  gapAmountPercent?: number;
  sourceConfidence?: number;
  /** NTU-specific fields. */
  brokerExplicitlyConfirmedNTU?: boolean;
  competitorIdentifiedFromKnownList?: boolean;
  competitorPriceConfirmed?: boolean;
};

const SANCTIONS_RANK: Record<'clear' | 'partial-match' | 'hit', number> = {
  clear: 0,
  'partial-match': 1,
  hit: 2,
};

/** Evaluate a snapshot against every enabled class; return the first match. */
export function evaluatePolicy(
  snapshot: EvaluationSnapshot,
  policy: AutonomyPolicy,
): EvaluationOutcome {
  let closestClassId: DecisionClassId | undefined;
  let closestReason = 'No enabled autonomy class matched.';

  for (const cls of Object.values(policy.decisionClasses)) {
    if (!cls.enabled) continue;
    const result = evaluateClass(snapshot, cls);
    if (result.eligible) return result;
    if (!closestClassId) {
      closestClassId = cls.id;
      closestReason = result.reason;
    }
  }
  return {
    eligible: false,
    reason: closestReason,
    closestClassId,
  };
}

/** Evaluate a snapshot against a single class. Exposed for tests. */
export function evaluateClass(
  snapshot: EvaluationSnapshot,
  cls: DecisionClassConfig,
): EvaluationOutcome {
  if (!cls.enabled) {
    return { eligible: false, reason: `${cls.id} is disabled`, closestClassId: cls.id };
  }
  const conditionsMet: string[] = [];

  // mustMatch — every defined condition must be satisfied.
  const must = cls.autonomyBands.mustMatch;
  const mustResult = checkConditionSet(snapshot, must, 'must');
  if (!mustResult.passed) {
    return { eligible: false, reason: mustResult.reason, closestClassId: cls.id };
  }
  conditionsMet.push(...mustResult.conditionsMet);

  // cannotExceed — any defined condition that's TRUE blocks autonomy.
  const cannot = cls.autonomyBands.cannotExceed;
  if (cannot) {
    const blockReason = checkBlockers(snapshot, cannot);
    if (blockReason) {
      return { eligible: false, reason: blockReason, closestClassId: cls.id };
    }
  }

  return {
    eligible: true,
    classId: cls.id,
    conditionsMet,
    confidence: snapshot.confidence,
  };
}

function checkConditionSet(
  snapshot: EvaluationSnapshot,
  cond: ConditionSet,
  _bandKind: 'must' | 'block',
): { passed: boolean; reason: string; conditionsMet: string[] } {
  const met: string[] = [];

  if (cond.confidenceMin !== undefined) {
    if (snapshot.confidence < cond.confidenceMin) {
      return {
        passed: false,
        reason: `confidence ${snapshot.confidence.toFixed(2)} below ${cond.confidenceMin.toFixed(2)}`,
        conditionsMet: met,
      };
    }
    met.push(`confidence ≥ ${cond.confidenceMin}`);
  }
  if (cond.premiumRangeMax !== undefined) {
    if (snapshot.premium === null || snapshot.premium > cond.premiumRangeMax) {
      return {
        passed: false,
        reason: `premium ${snapshot.premium === null ? '—' : `£${snapshot.premium.toLocaleString('en-GB')}`} exceeds £${cond.premiumRangeMax.toLocaleString('en-GB')}`,
        conditionsMet: met,
      };
    }
    met.push(`premium ≤ £${cond.premiumRangeMax.toLocaleString('en-GB')}`);
  }
  if (cond.capacityConsumptionMax !== undefined) {
    if (snapshot.capacityConsumption > cond.capacityConsumptionMax) {
      return {
        passed: false,
        reason: `capacity consumption ${(snapshot.capacityConsumption * 100).toFixed(1)}% exceeds ${(cond.capacityConsumptionMax * 100).toFixed(0)}%`,
        conditionsMet: met,
      };
    }
    met.push(`capacity consumption ≤ ${(cond.capacityConsumptionMax * 100).toFixed(0)}%`);
  }
  if (cond.lossRatioMax !== undefined && snapshot.cohortLossRatio !== null) {
    if (snapshot.cohortLossRatio > cond.lossRatioMax) {
      return {
        passed: false,
        reason: `cohort LR ${(snapshot.cohortLossRatio * 100).toFixed(0)}% above ${(cond.lossRatioMax * 100).toFixed(0)}%`,
        conditionsMet: met,
      };
    }
    met.push(`cohort LR ≤ ${(cond.lossRatioMax * 100).toFixed(0)}%`);
  }
  if (cond.profileMatchMin !== undefined) {
    if (snapshot.profileMatchCount < cond.profileMatchMin) {
      return {
        passed: false,
        reason: `profile match ${snapshot.profileMatchCount} below ${cond.profileMatchMin}`,
        conditionsMet: met,
      };
    }
    met.push(`profile match ≥ ${cond.profileMatchMin}`);
  }
  if (cond.lossesAvgMax !== undefined && snapshot.cohortLossesAvg !== null) {
    if (snapshot.cohortLossesAvg > cond.lossesAvgMax) {
      return {
        passed: false,
        reason: `cohort avg loss ${(snapshot.cohortLossesAvg * 100).toFixed(0)}% above ${(cond.lossesAvgMax * 100).toFixed(0)}%`,
        conditionsMet: met,
      };
    }
    met.push(`cohort avg loss ≤ ${(cond.lossesAvgMax * 100).toFixed(0)}%`);
  }
  if (cond.brokerHistoryMin !== undefined) {
    if (snapshot.brokerHistoryCount < cond.brokerHistoryMin) {
      return {
        passed: false,
        reason: `broker history ${snapshot.brokerHistoryCount} below ${cond.brokerHistoryMin}`,
        conditionsMet: met,
      };
    }
    met.push(`broker history ≥ ${cond.brokerHistoryMin}`);
  }
  if (cond.sanctionsAlertLevelMax) {
    const observed = SANCTIONS_RANK[snapshot.sanctionsAlertLevel];
    const limit = SANCTIONS_RANK[cond.sanctionsAlertLevelMax];
    if (observed > limit) {
      return {
        passed: false,
        reason: `sanctions ${snapshot.sanctionsAlertLevel} above ${cond.sanctionsAlertLevelMax}`,
        conditionsMet: met,
      };
    }
    met.push(`sanctions ≤ ${cond.sanctionsAlertLevelMax}`);
  }
  if (cond.appetiteFailureCategorical === true) {
    if (!snapshot.appetiteFailureCategorical) {
      return {
        passed: false,
        reason: 'appetite failure not categorical',
        conditionsMet: met,
      };
    }
    met.push('appetite failure categorical');
  }
  if (cond.conflictType !== undefined) {
    if (snapshot.conflictType !== cond.conflictType) {
      return {
        passed: false,
        reason: `conflict type ${snapshot.conflictType ?? '—'} ≠ ${cond.conflictType}`,
        conditionsMet: met,
      };
    }
    met.push(`conflict type = ${cond.conflictType}`);
  }
  if (cond.gapAmountAbs !== undefined && snapshot.gapAmountAbs !== undefined) {
    if (snapshot.gapAmountAbs > cond.gapAmountAbs) {
      return {
        passed: false,
        reason: `gap £${snapshot.gapAmountAbs.toLocaleString('en-GB')} exceeds £${cond.gapAmountAbs.toLocaleString('en-GB')}`,
        conditionsMet: met,
      };
    }
    met.push(`gap ≤ £${cond.gapAmountAbs.toLocaleString('en-GB')}`);
  }
  if (cond.gapAmountPercent !== undefined && snapshot.gapAmountPercent !== undefined) {
    if (snapshot.gapAmountPercent > cond.gapAmountPercent) {
      return {
        passed: false,
        reason: `gap pct ${(snapshot.gapAmountPercent * 100).toFixed(1)}% exceeds ${(cond.gapAmountPercent * 100).toFixed(0)}%`,
        conditionsMet: met,
      };
    }
    met.push(`gap pct ≤ ${(cond.gapAmountPercent * 100).toFixed(0)}%`);
  }
  if (cond.sourceConfidenceMin !== undefined && snapshot.sourceConfidence !== undefined) {
    if (snapshot.sourceConfidence < cond.sourceConfidenceMin) {
      return {
        passed: false,
        reason: `source confidence ${snapshot.sourceConfidence.toFixed(2)} below ${cond.sourceConfidenceMin.toFixed(2)}`,
        conditionsMet: met,
      };
    }
    met.push(`source confidence ≥ ${cond.sourceConfidenceMin}`);
  }
  if (cond.brokerExplicitlyConfirmedNTU === true) {
    if (!snapshot.brokerExplicitlyConfirmedNTU) {
      return {
        passed: false,
        reason: 'broker NTU not explicitly confirmed',
        conditionsMet: met,
      };
    }
    met.push('broker NTU confirmed');
  }
  if (cond.competitorIdentifiedFromKnownList === true) {
    if (!snapshot.competitorIdentifiedFromKnownList) {
      return {
        passed: false,
        reason: 'competitor not in known list',
        conditionsMet: met,
      };
    }
    met.push('competitor known');
  }
  if (cond.competitorPriceConfirmed === true) {
    if (!snapshot.competitorPriceConfirmed) {
      return {
        passed: false,
        reason: 'competitor price unconfirmed',
        conditionsMet: met,
      };
    }
    met.push('competitor price confirmed');
  }

  return { passed: true, reason: 'all conditions met', conditionsMet: met };
}

/**
 * cannotExceed: each TRUE flag is a blocker. Returns the reason
 * for the first blocker encountered, or null if none fire.
 */
function checkBlockers(snapshot: EvaluationSnapshot, cond: ConditionSet): string | null {
  if (cond.anyConflictUnresolved && snapshot.anyConflictUnresolved) {
    return 'unresolved conflict on the submission';
  }
  if (cond.anyGapUnresolved && snapshot.anyGapUnresolved) {
    return 'unresolved gap on the submission';
  }
  if (cond.anyOverrideRequired && snapshot.anyOverrideRequired) {
    return 'a triage check requires override';
  }
  if (cond.sanctionsAlertLevelMax) {
    const observed = SANCTIONS_RANK[snapshot.sanctionsAlertLevel];
    const limit = SANCTIONS_RANK[cond.sanctionsAlertLevelMax];
    if (observed > limit) return `sanctions ${snapshot.sanctionsAlertLevel}`;
  }
  if (cond.capacityHeadroomBelow !== undefined) {
    if (snapshot.capacityHeadroomFraction < cond.capacityHeadroomBelow) {
      return `capacity headroom ${(snapshot.capacityHeadroomFraction * 100).toFixed(0)}% below ${(cond.capacityHeadroomBelow * 100).toFixed(0)}%`;
    }
  }
  return null;
}
