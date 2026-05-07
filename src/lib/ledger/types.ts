/**
 * Module 15 — autonomy ledger types.
 *
 * The ledger is a portfolio-scale, cross-submission view of every
 * autonomous action the AI has taken. It is purely a derived view:
 * the AutonomyAction shape is enriched from the live autonomy store
 * + the 30-day fixture history, joined to insured names, broker
 * history, and downstream outcome signals.
 */

import type {
  AutonomousAction,
  DecisionClassId,
} from '@/lib/autonomy/types';

/** What happened to the policy after the autonomous action fired. */
export type LedgerOutcomeStatus =
  | 'in-flight'
  | 'bound'
  | 'cancelled'
  | 'declined'
  | 'ntu'
  | 'renewed';

/** A claim that landed against a policy after an autonomous bind.
 *  Used by the at-risk detector. */
export type LedgerClaim = {
  ref: string;
  category: string;
  filedAt: string;
  reserve: number;
};

/** Cross-submission projection of a single autonomous action. The
 *  primary record the ledger renders. */
export type AutonomyAction = {
  id: string;
  entryRef: string;
  insuredName: string;
  brokerName: string;
  brokerHistoryCount: number;
  classId: DecisionClassId;
  action: AutonomousAction;
  policyVersion: string;
  firedAt: string;
  conditionsMet: string[];
  /** Conditions that were checked but did NOT match. Empty for the
   *  vast majority — populated only when the orchestrator surfaces
   *  near-miss diagnostic information for transparency. */
  conditionsBlocked: string[];
  confidence: number;
  byAi: string;
  recallExpiresAt: string;
  recalled: boolean;
  recalledAt: string | null;
  recallReason: string | null;
  recalledBy: string | null;
  premium: number | null;
  capacityConsumption: number | null;
  outcome: LedgerOutcomeStatus;
  policyRef: string | null;
  cancelledAt: string | null;
  claim: LedgerClaim | null;
  /** Patterns flagged by detectAtRisk; empty for clean actions. */
  atRiskPatterns: AtRiskPattern[];
};

/** A single at-risk pattern flag. The annotation surfaces a signal,
 *  not a verdict — the underwriter judges. */
export type AtRiskPattern = {
  pattern:
    | 'claim-within-30'
    | 'cancel-within-60'
    | 'similar-profile-referred';
  description: string;
  /** Optional outbound link from the row (e.g. the claim record). */
  link?: { label: string; href: string };
};

/** Ledger filter UI state. */
export type LedgerFilters = {
  tab: 'all' | 'last-7-days' | 'last-30-days' | 'recalled' | 'at-risk';
  /** Trimmed lower-cased search query — '' means no search. */
  search: string;
  /** Multi-select restriction to specific classes; empty array = all. */
  classes: DecisionClassId[];
};

/** Per-class aggregation rendered on the main ledger page. */
export type LedgerClassSummary = {
  classId: DecisionClassId;
  classLabel: string;
  enabled: boolean;
  count: number;
  recalledCount: number;
  recallRate: number;
  mostRecent: AutonomyAction | null;
  recentRefs: string[];
};

/** Configuration for an export request from the ExportModal. */
export type ExportRequest = {
  period: ExportPeriod;
  classes: DecisionClassId[];
  format: 'csv' | 'json';
  recipient: 'capacity-provider' | 'mga-archive' | 'download';
};

export type ExportPeriod =
  | { kind: 'last-7-days' }
  | { kind: 'last-30-days' }
  | { kind: 'last-calendar-month' }
  | { kind: 'custom'; from: string; to: string };

/** A generated report ready to be previewed, downloaded, or sent. */
export type GeneratedReport = {
  format: 'csv' | 'json';
  filename: string;
  body: string;
  actionCount: number;
  recallCount: number;
  atRiskCount: number;
  chainHash: string;
  period: { fromISO: string; toISO: string };
  classes: DecisionClassId[];
};
