import type { CompetitorProfile, LossToCompetitor } from '@/lib/fixtures';
import type { RecommendationFactor } from '../types';
import { profileFromLoss, similarity, type RiskProfile } from '../similarity';

const STRONG_MATCH_THRESHOLD = 0.6;

/**
 * FCT-003 — Pricing competitiveness.
 *
 * Compares our premium against:
 *   • broker target premium (signal of where we land vs the broker's
 *     internal expectation)
 *   • observed competitor wins on similar profiles (the sharp competitor
 *     often comes in 8-15% under us)
 *
 * Returns the 3-5 most-similar lost-to-competitor records for the
 * detail card to cite.
 */
export function evaluatePricingCompetitiveness(
  target: RiskProfile,
  ourPremium: number,
  brokerTarget: number | null,
  losses: LossToCompetitor[],
  competitorIntel: CompetitorProfile[],
): RecommendationFactor {
  const similarLosses = losses
    .map((l) => ({ loss: l, score: similarity(profileFromLoss(l), target) }))
    .filter((r) => r.score >= STRONG_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  // The sharp competitor — RegentMGA in the fixture.
  const sharpComp = competitorIntel.find(
    (c) => c.estimatedAggressiveness === 'sharp',
  );
  const lossesToSharp = similarLosses.filter(
    (r) => r.loss.competitorWhoWon === sharpComp?.name,
  );

  // Broker target signal
  const belowTarget = brokerTarget !== null && ourPremium < brokerTarget;

  // Hold-floor: highest premium the sharp competitor has won at on
  // similar profiles. If our quote sits well above that, we have
  // direct evidence we will lose to them on price.
  const holdFloor = computeHoldFloor(target, losses, competitorIntel);
  const wellAboveHoldFloor =
    holdFloor !== null && holdFloor > 0 && ourPremium > holdFloor * 1.10;

  // Are we above the sharp competitor's typical winning band?
  let aboveSharpRange = false;
  if (sharpComp?.typicalDiscount && lossesToSharp.length > 0) {
    const expectedHigh = ourPremium * (1 + sharpComp.typicalDiscount.max); // closest to our quote
    aboveSharpRange = expectedHigh > 0 && ourPremium > expectedHigh * 1.02;
  }

  // Vote rules — pro-ntu wins when we have ≥2 sharp losses AND our
  // quote is materially above the demonstrated hold floor.
  const vote: RecommendationFactor['vote'] =
    lossesToSharp.length >= 2 && wellAboveHoldFloor
      ? 'pro-ntu'
      : lossesToSharp.length >= 2
        ? 'neutral'
        : belowTarget
          ? 'pro-bind'
          : 'neutral';

  const weight: RecommendationFactor['weight'] =
    lossesToSharp.length >= 2 && wellAboveHoldFloor
      ? 'high'
      : lossesToSharp.length >= 2
        ? 'moderate'
        : 'low';

  const sharpName = sharpComp?.name ?? 'Sharp competitor';
  const rangeText = sharpComp?.typicalDiscount
    ? `${Math.abs(sharpComp.typicalDiscount.max * 100).toFixed(0)}-${Math.abs(sharpComp.typicalDiscount.min * 100).toFixed(0)}%`
    : 'an unknown amount';
  const holdFloorText =
    holdFloor !== null ? `£${holdFloor.toLocaleString('en-GB')}` : null;
  const rationale =
    lossesToSharp.length >= 2 && wellAboveHoldFloor && holdFloorText
      ? `Our £${ourPremium.toLocaleString('en-GB')} sits above ${sharpName}'s demonstrated hold floor of ${holdFloorText} on similar profiles; price-loss likely.`
      : lossesToSharp.length >= 2
        ? `${belowTarget ? 'Below broker target' : 'In line with broker target'} but ${sharpName} may undercut by ${rangeText} on similar profiles.`
        : belowTarget
          ? 'Below broker target; competitive pricing.'
          : 'Pricing within market range.';

  return {
    id: 'FCT-003',
    label: 'Pricing competitiveness',
    vote,
    weight,
    rationale,
    evidence: {
      lossIds: similarLosses.slice(0, 5).map((r) => r.loss.id),
      ratingCells: ['H58'],
      competitorNames: [...new Set(similarLosses.map((r) => r.loss.competitorWhoWon))].slice(0, 3),
    },
    metadata: {
      ourPremium,
      brokerTarget,
      belowTarget,
      aboveSharpRange,
      wellAboveHoldFloor,
      holdFloor,
      similarLossCount: similarLosses.length,
      lossesToSharpCount: lossesToSharp.length,
      similarLossIds: similarLosses.slice(0, 5).map((r) => r.loss.id),
      sharpCompetitorName: sharpComp?.name ?? null,
    },
  };
}

/**
 * Hold-floor calculation: the minimum we should not go below if the
 * broker negotiates. Computed as the highest premium a sharp
 * competitor has won at on similar profiles, rounded up to the
 * nearest £500.
 */
export function computeHoldFloor(
  target: RiskProfile,
  losses: LossToCompetitor[],
  competitorIntel: CompetitorProfile[],
): number | null {
  const sharpName = competitorIntel.find(
    (c) => c.estimatedAggressiveness === 'sharp',
  )?.name;
  if (!sharpName) return null;
  const similarLosses = losses
    .filter((l) => similarity(profileFromLoss(l), target) >= STRONG_MATCH_THRESHOLD)
    .filter((l) => l.competitorWhoWon === sharpName)
    .map((l) => l.competitorWinningPremium ?? 0)
    .filter((p) => p > 0);
  if (similarLosses.length === 0) return null;
  const max = Math.max(...similarLosses);
  return Math.ceil(max / 500) * 500;
}
