import type { HistoricalBinder } from '@/lib/fixtures';
import type { RecommendationFactor } from '../types';
import { profileFromBinder, similarity, type RiskProfile } from '../similarity';

const STRONG_MATCH_THRESHOLD = 0.7;

/**
 * FCT-001 — Profile match strength.
 *
 * Counts how many historical binders match the active submission
 * above a strong-match threshold. The recommendation engine uses the
 * same similarity calc to surface the top 7 in the deep-dive panel.
 */
export function evaluateProfileMatch(
  target: RiskProfile,
  binders: HistoricalBinder[],
): RecommendationFactor {
  const strongMatches = binders.filter(
    (b) => similarity(profileFromBinder(b), target) >= STRONG_MATCH_THRESHOLD,
  );

  const vote: RecommendationFactor['vote'] =
    strongMatches.length >= 7
      ? 'pro-bind'
      : strongMatches.length >= 3
        ? 'neutral'
        : 'pro-refer';
  const weight: RecommendationFactor['weight'] =
    strongMatches.length >= 7
      ? 'high'
      : strongMatches.length >= 3
        ? 'moderate'
        : 'high';

  const rationale =
    strongMatches.length >= 7
      ? `Profile aligns with ${strongMatches.length} prior binders in this segment.`
      : strongMatches.length > 0
        ? `Profile aligns with ${strongMatches.length} prior binders — thin sample.`
        : 'No close historical match in the MGA book.';

  return {
    id: 'FCT-001',
    label: 'Profile match strength',
    vote,
    weight,
    rationale,
    evidence: { binderIds: strongMatches.slice(0, 7).map((b) => b.id) },
    metadata: { strongMatchCount: strongMatches.length, threshold: STRONG_MATCH_THRESHOLD },
  };
}
