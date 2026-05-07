/**
 * Renewal recommendation — 7 factors (5 reweighted + 2 new).
 *
 * The new factors are FCT-006 (year-1 performance) and FCT-007
 * (defence-pricing fit). FCT-006 is the dominant factor at renewal:
 * a clean year-1 LR is the strongest signal for re-binding.
 */

import type { Year1Review, RenewalRecommendationFactor } from './types';

export type RenewalRecommendationInputs = {
  year1Review: Year1Review;
  year2TechnicalPremium: number;
  selectedDefencePremium: number;
  sharpCompetitorHoldFloor: number;
  brokerTargetPremium: number | null;
  brokerSentiment: 'strong' | 'neutral' | 'strained';
  /** Material additions for year-2 (e.g. WEEE). */
  materialAdditions: string[];
  /** Pre-existing factor history if recomputing. */
  previousFactorIds?: string[];
};

export type RenewalRecommendation = {
  factors: RenewalRecommendationFactor[];
  primary: 'bind' | 'refer' | 'ntu';
  confidence: 'high' | 'moderate' | 'low';
  headline: string;
};

export function buildRenewalRecommendation(
  input: RenewalRecommendationInputs,
): RenewalRecommendation {
  const factors: RenewalRecommendationFactor[] = [];

  // FCT-001 — Profile match strength (reweighted at renewal: lower
  // weight because the policy itself is the ground truth).
  factors.push({
    id: 'FCT-001',
    label: 'Profile match (reweighted)',
    vote: 'pro-bind',
    weight: 'low',
    rationale:
      'Profile is identical to the bound risk by definition — the existing policy IS the ground truth at renewal. Low weight.',
  });

  // FCT-002 — Historical performance (reweighted: heavier than at
  // new business because we have the same-policy track record).
  factors.push({
    id: 'FCT-002',
    label: 'Historical performance (same-MGA cohort)',
    vote: 'pro-bind',
    weight: 'moderate',
    rationale: `Greenline's bound cohort continues to perform at the profitable end. Year-2 prior LR ${(input.year1Review.lossRatio * 100).toFixed(0)}% is well below the 50% profitable threshold.`,
  });

  // FCT-003 — Pricing competitiveness (informed by the defence
  // pricing decision).
  const aboveTechnical = input.selectedDefencePremium >= input.year2TechnicalPremium;
  const aboveSharp = input.selectedDefencePremium > input.sharpCompetitorHoldFloor;
  factors.push({
    id: 'FCT-003',
    label: 'Pricing competitiveness (post-defence-pricing)',
    vote: aboveSharp ? 'pro-bind' : 'neutral',
    weight: 'moderate',
    rationale: aboveTechnical
      ? `Selected £${input.selectedDefencePremium.toLocaleString('en-GB')} holds the technical floor (£${input.year2TechnicalPremium.toLocaleString('en-GB')}); margin preserved.`
      : `Selected £${input.selectedDefencePremium.toLocaleString('en-GB')} defends above sharp floor (£${input.sharpCompetitorHoldFloor.toLocaleString('en-GB')}) but below technical (£${input.year2TechnicalPremium.toLocaleString('en-GB')}).`,
    metadata: {
      selectedDefencePremium: input.selectedDefencePremium,
      sharpCompetitorHoldFloor: input.sharpCompetitorHoldFloor,
      technicalPremium: input.year2TechnicalPremium,
    },
  });

  // FCT-004 — Subjectivity risk (reweighted: lower at renewal).
  factors.push({
    id: 'FCT-004',
    label: 'Subjectivity risk (reweighted)',
    vote: 'pro-bind',
    weight: 'low',
    rationale: `${input.year1Review.subjectivitiesSatisfied} of ${input.year1Review.subjectivitiesTotal} year-1 subjectivities satisfied; year-2 carries forward existing warranties + a WEEE conditional warranty.`,
  });

  // FCT-005 — Broker relationship.
  factors.push({
    id: 'FCT-005',
    label: 'Broker relationship',
    vote: input.brokerSentiment === 'strained' ? 'pro-refer' : 'pro-bind',
    weight: 'moderate',
    rationale: `${input.year1Review.brokerRelationship.name} · ${input.brokerSentiment} sentiment. ${input.year1Review.brokerRelationship.note}`,
  });

  // FCT-006 — NEW: Year-1 performance dominant signal.
  const cleanLR = input.year1Review.lossRatio < 0.5;
  factors.push({
    id: 'FCT-006',
    label: 'Year-1 performance (renewal-specific)',
    vote: cleanLR ? 'pro-bind' : 'pro-refer',
    weight: 'high',
    rationale: `Year-1 LR ${(input.year1Review.lossRatio * 100).toFixed(0)}% on £${input.year1Review.earnedPremium.toLocaleString('en-GB')} earned. ${input.year1Review.claimCount} claims, all closed cleanly. ${cleanLR ? 'A profitable year — strongest renewal signal.' : 'Cumulative losses material — re-evaluate retention.'}`,
    metadata: {
      lossRatio: input.year1Review.lossRatio,
      earnedPremium: input.year1Review.earnedPremium,
      totalLosses: input.year1Review.totalLosses,
      claimCount: input.year1Review.claimCount,
    },
  });

  // FCT-007 — NEW: Defence pricing fit (do we win at the chosen
  // premium given the competitive picture?).
  const fitsCompetitive =
    input.selectedDefencePremium <= input.year2TechnicalPremium * 1.05 &&
    input.selectedDefencePremium >= input.sharpCompetitorHoldFloor;
  factors.push({
    id: 'FCT-007',
    label: 'Defence pricing fit',
    vote: fitsCompetitive ? 'pro-bind' : 'neutral',
    weight: 'moderate',
    rationale: fitsCompetitive
      ? `Selected £${input.selectedDefencePremium.toLocaleString('en-GB')} sits between sharp floor and technical — defensible commercially without ceding margin.`
      : `Selected price sits outside the defendable band; review against technical and competitive intel.`,
    metadata: {
      selectedDefencePremium: input.selectedDefencePremium,
      brokerTargetPremium: input.brokerTargetPremium,
      materialAdditions: input.materialAdditions,
    },
  });

  // Verdict aggregation.
  const proBind = factors.filter((f) => f.vote === 'pro-bind').length;
  const proRefer = factors.filter((f) => f.vote === 'pro-refer').length;
  const proNtu = factors.filter((f) => f.vote === 'pro-ntu').length;
  const primary: 'bind' | 'refer' | 'ntu' =
    proNtu >= 3 ? 'ntu' : proRefer >= 3 ? 'refer' : 'bind';
  const highWeight = factors.filter(
    (f) => f.weight === 'high' && f.vote === (primary === 'bind' ? 'pro-bind' : `pro-${primary}`),
  ).length;
  const confidence: 'high' | 'moderate' | 'low' =
    proBind >= 5 && highWeight >= 1
      ? 'high'
      : proBind >= 4
        ? 'moderate'
        : 'low';

  const lrPct = (input.year1Review.lossRatio * 100).toFixed(0);
  const headline =
    primary === 'bind'
      ? `Recommend RENEWAL at £${input.selectedDefencePremium.toLocaleString('en-GB')}. Year-1 LR ${lrPct}% on £${input.year1Review.earnedPremium.toLocaleString('en-GB')} earned — clean book, no missed warranties. Defence price holds the margin between technical and the £${input.sharpCompetitorHoldFloor.toLocaleString('en-GB')} sharp-competitor floor; broker relationship strong.`
      : primary === 'refer'
        ? `Recommend REFER. Year-1 performance and competitive pressure warrant senior review.`
        : `Recommend NTU. Year-2 economics do not support retention.`;

  return { factors, primary, confidence, headline };
}
