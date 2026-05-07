/**
 * Module 14 — autonomy policy types.
 *
 * Autonomy is policy-level, not user-level. The MGA owner (with
 * capacity provider sign-off) configures bands per decision class;
 * individual underwriters cannot loosen or tighten autonomy. They
 * can override autonomous decisions via the recall window — that
 * action itself becomes a tracked exception.
 */

export type AutonomousAction =
  | 'pass'
  | 'refer'
  | 'decline'
  | 'bind'
  | 'ntu'
  | 'resolve-conflict'
  | 'resolve-gap';

export type ConditionSet = {
  /** AI confidence ≥ this. */
  confidenceMin?: number;
  /** Premium ≤ this £. */
  premiumRangeMax?: number;
  /** Capacity consumption ≤ this fraction of headroom. */
  capacityConsumptionMax?: number;
  /** Historical loss ratio ≤ this. */
  lossRatioMax?: number;
  /** Profile match: ≥ this many similar binders. */
  profileMatchMin?: number;
  /** Avg historical loss ≤ this. */
  lossesAvgMax?: number;
  sitesMax?: number;
  turnoverMax?: number;
  /** Allowed material classes (if absent, no restriction). */
  materialClassesAllowed?: string[];
  /** Excluded geographies. */
  geographicExclude?: string[];
  /** Broker has at least this many prior submissions. */
  brokerHistoryMin?: number;
  /** Sanctions screening severity must NOT exceed this. */
  sanctionsAlertLevelMax?: 'clear' | 'partial-match' | 'hit';
  /** Categorical: appetite failure must be clear-cut. */
  appetiteFailureCategorical?: boolean;
  /** Cancel autonomy if any conflict / gap is unresolved. */
  anyConflictUnresolved?: boolean;
  anyGapUnresolved?: boolean;
  /** Cancel if any triage check requires override. */
  anyOverrideRequired?: boolean;
  /** Capacity headroom must be > this fraction of cap. */
  capacityHeadroomBelow?: number;
  /** NTU: broker explicitly confirmed loss to a known competitor with
   *  confirmed pricing. */
  brokerExplicitlyConfirmedNTU?: boolean;
  competitorIdentifiedFromKnownList?: boolean;
  competitorPriceConfirmed?: boolean;
  /** Conflict-specific: routine timing-mismatch with small £ delta. */
  conflictType?: 'timing-mismatch' | 'rounding' | 'data-source-lag';
  gapAmountAbs?: number;
  gapAmountPercent?: number;
  sourceConfidenceMin?: number;
};

export type DecisionClassId =
  | 'TRIAGE-AUTO-PASS'
  | 'TRIAGE-AUTO-DECLINE'
  | 'CONFLICT-AUTO-RESOLVE'
  | 'BIND-AUTO-COMMIT'
  | 'NTU-AUTO-CAPTURE';

export type DecisionClassConfig = {
  id: DecisionClassId;
  label: string;
  description: string;
  enabled: boolean;
  autonomyBands: {
    mustMatch: ConditionSet;
    cannotExceed?: ConditionSet;
  };
  autonomousAction: AutonomousAction;
  notifyUnderwriter: 'always' | 'on-action' | 'never';
  /** Hours after autonomous action during which the underwriter can
   *  recall. 0 = no recall, must override before action. */
  recallWindowHours: number;
  maxPerDay?: number;
  maxPerMonth?: number;
};

export type AutonomyPolicy = {
  version: string;
  approvedBy: {
    capacityProvider: string;
    mgaOwner: string;
    effectiveDate: string;
    expiresAt: string;
  };
  decisionClasses: Record<DecisionClassId, DecisionClassConfig>;
};

export type EvaluationOutcome =
  | { eligible: true; classId: DecisionClassId; conditionsMet: string[]; confidence: number }
  | { eligible: false; reason: string; closestClassId?: DecisionClassId };

export type ExceptionPriority = 'high' | 'medium' | 'low';

export type ExceptionRecord = {
  entryRef: string;
  reasonCategory:
    | 'confidence'
    | 'conflict'
    | 'capacity'
    | 'sanctions'
    | 'profile-edge'
    | 'broker-history';
  reason: string;
  /** Italic-serif marginalia explaining what the AI saw. */
  marginalia: string | null;
  priority: ExceptionPriority;
  flaggedAt: string;
  closestClassId?: DecisionClassId;
};

/** 30-day rolling metric snapshot used by the admin page. */
export type DecisionClassMetrics = {
  classId: DecisionClassId;
  windowDays: 30;
  autoFired: number;
  recalled: number;
  /** Accuracy = (autoFired - recalled) / autoFired. 1.0 if zero recalls. */
  accuracy: number;
  /** Examples (last few audit events of this class) for the "View all" link. */
  recentRefs: string[];
};

export type ScheduledAutonomousAction = {
  entryRef: string;
  classId: DecisionClassId;
  /** Snapshot of policy version at schedule-time. Eventual fired
   *  action carries this version even if the policy is later mutated. */
  policyVersion: string;
  scheduledAt: string;
  firesAt: string;
  conditionsMet: string[];
  confidence: number;
};

export type ExecutedAutonomousAction = {
  entryRef: string;
  classId: DecisionClassId;
  action: AutonomousAction;
  policyVersion: string;
  firedAt: string;
  conditionsMet: string[];
  confidence: number;
  byAi: string;
  recallExpiresAt: string;
  recalled: boolean;
  recalledAt: string | null;
  recallReason: string | null;
};
