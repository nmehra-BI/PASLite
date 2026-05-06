import type {
  CompetitorProfile,
  HistoricalBinder,
  LossToCompetitor,
  Submission,
} from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import { aggregate } from './aggregate';
import { evaluateBrokerRelationship } from './factors/brokerRelationship';
import { evaluateHistoricalPerformance } from './factors/historicalPerformance';
import {
  computeHoldFloor,
  evaluatePricingCompetitiveness,
} from './factors/pricingCompetitiveness';
import { evaluateProfileMatch } from './factors/profileMatch';
import { evaluateSubjectivityRisk } from './factors/subjectivityRisk';
import { buildHeadline } from './headline';
import {
  profileFromBinder,
  profileFromLoss,
  similarity,
  type RiskProfile,
} from './similarity';
import type { CompetitorSwitch } from './competitorSwitches';
import type { Recommendation } from './types';

export type RecommendationInputs = {
  submission: Submission;
  ourPremium: number;
  binders: HistoricalBinder[];
  losses: LossToCompetitor[];
  competitorIntel: CompetitorProfile[];
  /** Resolved gap state from enrichment, used by FCT-004. */
  fireSuppressionResolved: boolean;
  fireSuppressionRequested: boolean;
  /**
   * Mid-term competitor switches projected from the audit log. These
   * are bound policies the MGA cancelled in favour of a competitor;
   * a stronger signal than NTUs because the competitor displaced an
   * in-force risk. Optional — old call sites remain valid.
   */
  competitorSwitches?: CompetitorSwitch[];
};

/** Project the live submission down to a risk profile. */
export function buildTargetProfile(submission: Submission): RiskProfile {
  const turnover = (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  const materials = (effectiveValue(submission.materials) as string[] | null) ?? [];
  const lossRatio =
    (effectiveValue(submission.statedLossRatio) as number | null) ?? 0;
  const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fireSuppression: 'present' | 'absent' | 'undisclosed' =
    fsValue === true ? 'present' : fsValue === false ? 'absent' : 'undisclosed';
  const geography = submission.sites
    .map((s) => effectiveValue(s.name) as string | null)
    .filter((n): n is string => n !== null)
    // Drop the "(HQ)" decoration so geography matches plain city names.
    .map((s) => s.replace(/\s*\(.*\)\s*/, '').trim());

  return {
    turnover,
    siteCount: submission.sites.length,
    materials,
    fireSuppression,
    priorLossRatio: lossRatio,
    geography,
  };
}

/**
 * Detect whether any insured-site permit expires within the policy
 * term. Used by FCT-004's subjectivity check and by the slip's Leeds
 * permit warranty.
 */
function permitExpiringInTerm(submission: Submission) {
  const inception = effectiveValue(submission.cover.inceptionDate) as
    | string
    | null;
  const expiry = effectiveValue(submission.cover.expiryDate) as string | null;
  if (!inception || !expiry) return null;
  for (const s of submission.sites) {
    const exp = effectiveValue(s.permitExpiry) as string | null;
    if (!exp) continue;
    if (exp >= inception && exp <= expiry) {
      return {
        siteName: (effectiveValue(s.name) as string | null) ?? 'site',
        expiry: exp,
        permitRef: (effectiveValue(s.permitRef) as string | null) ?? '—',
      };
    }
  }
  return null;
}

export function runRecommendation(
  inputs: RecommendationInputs,
  generatedAt: string = new Date().toISOString(),
): Recommendation {
  const target = buildTargetProfile(inputs.submission);
  const brokerName = effectiveValue(inputs.submission.broker) as string | null;
  const brokerTarget =
    (effectiveValue(inputs.submission.brokerTargetPremium) as number | null) ?? null;

  const fct1 = evaluateProfileMatch(target, inputs.binders);
  const fct2 = evaluateHistoricalPerformance(target, inputs.binders);
  const fct3 = evaluatePricingCompetitiveness(
    target,
    inputs.ourPremium,
    brokerTarget,
    inputs.losses,
    inputs.competitorIntel,
  );
  // Annotate FCT-003 with mid-term switches (the cancellation
  // feedback loop). These are stronger signals than NTUs and the
  // deep-dive inspector renders them as a distinct "mid-term switch"
  // group in the competitive intel section.
  if (inputs.competitorSwitches && inputs.competitorSwitches.length > 0) {
    const meta = (fct3.metadata ?? {}) as Record<string, unknown>;
    meta.midTermSwitches = inputs.competitorSwitches.map((s) => ({
      policyRef: s.policyRef,
      toCompetitor: s.toCompetitor,
      cancelledAt: s.cancelledAt,
      retainedPremium: s.retainedPremium,
      notes: s.notes,
    }));
    fct3.metadata = meta;
  }
  const fct4 = evaluateSubjectivityRisk(
    inputs.submission,
    inputs.fireSuppressionResolved,
    inputs.fireSuppressionRequested,
    permitExpiringInTerm(inputs.submission),
  );
  const fct5 = evaluateBrokerRelationship(brokerName);

  const factors = [fct1, fct2, fct3, fct4, fct5];
  const { primary, confidence } = aggregate(factors);

  // Top-similar references for the deep dive.
  const similarBinders = inputs.binders
    .map((b) => ({ b, score: similarity(profileFromBinder(b), target) }))
    .filter((r) => r.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
    .map((r) => r.b);

  const similarLosses = inputs.losses
    .map((l) => ({ l, score: similarity(profileFromLoss(l), target) }))
    .filter((r) => r.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.l);

  // Sharp-competitor cohort: ALL named-sharp losses above similarity
  // threshold, ranked top 3. Used by the headline gold sentence so
  // the count + average premium + hold-floor reflect the named
  // competitor specifically ("we've lost 3 similar risks to
  // RegentMGA at ~£35k"), independent of which losses make the
  // generic top-5 by similarity.
  const sharpName = inputs.competitorIntel.find(
    (c) => c.estimatedAggressiveness === 'sharp',
  )?.name;
  const sharpLosses = sharpName
    ? inputs.losses
        .filter((l) => l.competitorWhoWon === sharpName)
        .map((l) => ({ l, score: similarity(profileFromLoss(l), target) }))
        .filter((r) => r.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((r) => r.l)
    : [];

  // Competitor profiles relevant to the cited losses.
  const relevantCompetitorNames = new Set([
    ...similarLosses.map((l) => l.competitorWhoWon),
    ...sharpLosses.map((l) => l.competitorWhoWon),
  ]);
  const competitorContext = inputs.competitorIntel
    .filter(
      (c) =>
        relevantCompetitorNames.has(c.name) ||
        c.estimatedAggressiveness === 'sharp',
    )
    .slice(0, 5);

  const holdFloor = computeHoldFloor(target, inputs.losses, inputs.competitorIntel);

  const headline = buildHeadline({
    primary,
    factors,
    similarLosses,
    sharpLosses,
    competitorIntel: inputs.competitorIntel,
    submission: inputs.submission,
    holdFloor,
  });

  return {
    primary,
    confidence,
    factors,
    similarBinders,
    similarLosses,
    competitorContext,
    headline,
    generatedAt,
  };
}
