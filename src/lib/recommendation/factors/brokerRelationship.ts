import type { RecommendationFactor } from '../types';

/**
 * FCT-005 — Broker relationship signal.
 *
 * In production this would query the MGA's broker-history database;
 * for the demo we hand-curate realistic numbers that show a strong
 * relationship with SureStep.
 */
export type BrokerHistory = {
  brokerName: string;
  priorSubmissions: number;
  bound: number;
  ntu: number;
  declined: number;
  averageBoundLossRatio: number;
};

const SURESTEP_HISTORY: BrokerHistory = {
  brokerName: 'SureStep',
  priorSubmissions: 8,
  bound: 6,
  ntu: 1,
  declined: 1,
  averageBoundLossRatio: 0.41,
};

const DEFAULT_HISTORY: BrokerHistory = {
  brokerName: 'unknown broker',
  priorSubmissions: 0,
  bound: 0,
  ntu: 0,
  declined: 0,
  averageBoundLossRatio: 0,
};

export function getBrokerHistory(brokerName: string | null): BrokerHistory {
  if (brokerName?.toLowerCase().includes('surestep')) return SURESTEP_HISTORY;
  return DEFAULT_HISTORY;
}

export function evaluateBrokerRelationship(
  brokerName: string | null,
): RecommendationFactor {
  const h = getBrokerHistory(brokerName);
  const winRate = h.priorSubmissions === 0 ? 0 : h.bound / h.priorSubmissions;
  const known = h.priorSubmissions > 0;

  const vote: RecommendationFactor['vote'] = !known
    ? 'neutral'
    : winRate >= 0.6 && h.averageBoundLossRatio < 0.5
      ? 'pro-bind'
      : winRate >= 0.4
        ? 'neutral'
        : 'pro-refer';

  const weight: RecommendationFactor['weight'] =
    h.priorSubmissions >= 5 ? 'moderate' : h.priorSubmissions >= 2 ? 'low' : 'low';

  const rationale = !known
    ? 'No broker history with this MGA.'
    : `Strong broker relationship; ${h.bound} of ${h.priorSubmissions} prior submissions bound, average LR ${(h.averageBoundLossRatio * 100).toFixed(0)}%.`;

  return {
    id: 'FCT-005',
    label: 'Broker relationship',
    vote,
    weight,
    rationale,
    evidence: {},
    metadata: {
      ...h,
      winRate,
    },
  };
}
