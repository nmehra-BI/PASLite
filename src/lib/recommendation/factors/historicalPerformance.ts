import type { HistoricalBinder } from '@/lib/fixtures';
import type { RecommendationFactor } from '../types';
import { profileFromBinder, similarity, type RiskProfile } from '../similarity';

const STRONG_MATCH_THRESHOLD = 0.7;
const MARKET_AVERAGE_UNPROFITABLE_RATE = 0.12; // ~12% across UK W&R Tier-2

/**
 * FCT-002 — Historical performance of the matched profile.
 *
 * Of the matched binders that have matured, what's the LR
 * distribution? The recommendation surfaces the 11/3/1 split for the
 * Greenline default state.
 */
export function evaluateHistoricalPerformance(
  target: RiskProfile,
  binders: HistoricalBinder[],
): RecommendationFactor {
  const matched = binders.filter(
    (b) => similarity(profileFromBinder(b), target) >= STRONG_MATCH_THRESHOLD,
  );
  const matured = matched.filter((b) => b.matured);

  const profitable = matured.filter((b) => b.profitability === 'profitable').length;
  const breakeven = matured.filter((b) => b.profitability === 'breakeven').length;
  const unprofitable = matured.filter((b) => b.profitability === 'unprofitable').length;
  const total = matured.length;

  const profitableShare = total === 0 ? 0 : profitable / total;
  const unprofitableShare = total === 0 ? 0 : unprofitable / total;

  const vote: RecommendationFactor['vote'] =
    total === 0
      ? 'neutral'
      : profitableShare >= 0.6 && unprofitableShare <= 0.15
        ? 'pro-bind'
        : profitableShare >= 0.4
          ? 'neutral'
          : 'pro-ntu';

  const weight: RecommendationFactor['weight'] =
    total >= 10 ? 'high' : total >= 5 ? 'moderate' : 'low';

  const rationale =
    total === 0
      ? 'No matured binders match this profile — recommendation is uncalibrated for outcomes.'
      : `${profitable} of ${total} matured similar binders performed within target LR (≤50%).`;

  // Surface the top 3 most-similar matured binders for the detail card.
  const topMatured = matched
    .filter((b) => b.matured)
    .map((b) => ({ binder: b, score: similarity(profileFromBinder(b), target) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    id: 'FCT-002',
    label: 'Historical performance',
    vote,
    weight,
    rationale,
    evidence: { binderIds: topMatured.map((m) => m.binder.id) },
    metadata: {
      total,
      profitable,
      breakeven,
      unprofitable,
      profitableShare,
      unprofitableShare,
      marketAverageUnprofitableRate: MARKET_AVERAGE_UNPROFITABLE_RATE,
      topMaturedBinderIds: topMatured.map((m) => m.binder.id),
    },
  };
}
