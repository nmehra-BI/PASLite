import type { CompetitorProfile, LossToCompetitor, Submission } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import type {
  Recommendation,
  RecommendationFactor,
  RecommendationVerdict,
} from './types';

/**
 * Generate the 2-3 sentence narrative that opens the recommendation.
 * Deterministic for MVP (template, not LLM). The "gold sentence" — the
 * specific competitor + premium + actionable hold-floor — is what
 * makes this read as advice rather than analysis. See module 6 spec.
 */
export function buildHeadline(args: {
  primary: RecommendationVerdict;
  factors: RecommendationFactor[];
  /** Generic top-N similar losses (for context). */
  similarLosses: LossToCompetitor[];
  /**
   * Sharp-competitor-only cohort. The gold sentence cites the count,
   * average premium, and hold floor based on these — independent of
   * which losses ranked highest in the generic top-5.
   */
  sharpLosses: LossToCompetitor[];
  competitorIntel: CompetitorProfile[];
  submission: Submission;
  /** Pre-computed hold floor (£) from pricingCompetitiveness. */
  holdFloor: number | null;
}): string {
  const { primary, factors, sharpLosses, competitorIntel, submission, holdFloor } = args;

  const fProfile = factors.find((f) => f.id === 'FCT-001');
  const fHistory = factors.find((f) => f.id === 'FCT-002');
  const fPricing = factors.find((f) => f.id === 'FCT-003');
  const fSubj = factors.find((f) => f.id === 'FCT-004');

  // Sentence 1 — the verb + the headline grounding.
  const matchCount =
    (fProfile?.metadata?.['strongMatchCount'] as number | undefined) ?? 0;
  const performance = fHistory?.metadata as
    | { profitable?: number; total?: number; profitableShare?: number }
    | undefined;
  const profitable = performance?.profitable ?? 0;
  const total = performance?.total ?? 0;

  const verb =
    primary === 'bind'
      ? 'Recommend BIND'
      : primary === 'refer'
        ? 'Recommend REFER'
        : 'Recommend NTU';

  let s1: string;
  if (matchCount >= 7 && total >= 5) {
    s1 = `${verb}. Profile matches ${matchCount} prior binders in this segment, of which ${profitable} of ${total} matured profitably.`;
  } else if (matchCount > 0) {
    s1 = `${verb}. Profile aligns with ${matchCount} prior binders; matured-outcome sample is thin.`;
  } else {
    s1 = `${verb}. No close historical match in the MGA book — recommendation is uncalibrated.`;
  }

  // Sentence 2 — the price + warranties summary.
  const pricingNeutral = fPricing?.vote === 'neutral';
  const subjOk = fSubj?.vote === 'pro-bind';
  let s2: string;
  if (subjOk && !pricingNeutral) {
    s2 = 'Pricing is competitive and the warranty load is manageable.';
  } else if (subjOk && pricingNeutral) {
    s2 = 'Pricing is competitive and the warranty load is manageable.';
  } else if (!subjOk && !pricingNeutral) {
    s2 = 'Pricing is competitive; warranty load needs review.';
  } else {
    s2 = 'Warranty load is manageable; pricing should be tested against market.';
  }

  // Sentence 3 — the gold sentence. Specific competitor name, specific
  // loss premiums, specific actionable hold-floor. Uses the
  // sharp-competitor-only cohort so the count + average reflect the
  // named competitor; the generic top-5 may include lots of other
  // losses, but the gold sentence speaks specifically about RegentMGA
  // (or whoever the sharp player is).
  const sharpName =
    competitorIntel.find((c) => c.estimatedAggressiveness === 'sharp')?.name ??
    null;

  const brokerFirstName = ((effectiveValue(submission.broker) as string | null) ?? '')
    .toLowerCase()
    .includes('surestep')
    ? 'Sarah'
    : 'the broker';

  let s3 = '';
  if (sharpName && sharpLosses.length >= 2 && holdFloor !== null) {
    const sample = sharpLosses
      .map((l) => l.competitorWinningPremium ?? 0)
      .filter((p) => p > 0);
    const avg = Math.round(
      sample.reduce((a, b) => a + b, 0) / Math.max(1, sample.length),
    );
    s3 = ` ${sharpName} may undercut on price (we've lost ${sharpLosses.length} similar risks to them at ~£${avg.toLocaleString('en-GB')}); if ${brokerFirstName} negotiates, hold firm above £${holdFloor.toLocaleString('en-GB')}.`;
  } else if (sharpName && sharpLosses.length === 1) {
    const px = sharpLosses[0]!.competitorWinningPremium;
    if (px) {
      s3 = ` ${sharpName} won a similar risk at £${px.toLocaleString('en-GB')} recently; price-sensitive.`;
    }
  }

  return `${s1} ${s2}${s3}`.trim();
}

export function summariseRecommendation(r: Recommendation): string {
  return `${r.primary.toUpperCase()} · ${r.confidence} confidence`;
}
