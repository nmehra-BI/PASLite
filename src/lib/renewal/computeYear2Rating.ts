/**
 * Year-2 technical rating using the same Tier-2 engine, with year-1
 * LR providing the loss-credit factor.
 */

import { computeSha } from '@/lib/bind';
import { runRating } from '@/lib/rating';

export type ComputeYear2Inputs = {
  newTurnover: number;
  siteCount: number;
  materials: string[];
  fireSuppression: 'present' | 'absent' | 'undisclosed';
  /** Year-1 actual loss ratio. */
  year1LR: number;
  yearsInBusiness: number;
  largestSingleClaim: number;
  /** Year-1 annual equivalent (post-MTAs). */
  year1AnnualEquivalent: number;
};

export type Year2Rating = {
  technicalPremium: number;
  sha: string;
  deltaFromYear1Annual: number;
  deltaPct: number;
};

export function computeYear2Rating(input: ComputeYear2Inputs): Year2Rating {
  const out = runRating({
    turnover: input.newTurnover,
    siteCount: input.siteCount,
    materials: input.materials,
    fireSuppression: input.fireSuppression,
    lossRatio: input.year1LR,
    largestSingleClaim: input.largestSingleClaim,
    yearsInBusiness: input.yearsInBusiness,
  });
  const technicalPremium = out.premium;
  const deltaFromYear1Annual = technicalPremium - input.year1AnnualEquivalent;
  const deltaPct = input.year1AnnualEquivalent
    ? deltaFromYear1Annual / input.year1AnnualEquivalent
    : 0;

  // Versioned sha for the year-2 rating, distinct from the year-1
  // engine sha so the audit story can distinguish them.
  const sha = computeSha({
    engine: 'recyclesure_v3.2',
    year: 2,
    turnover: input.newTurnover,
    sites: input.siteCount,
    lr: input.year1LR,
    technicalPremium,
  });

  return {
    technicalPremium,
    // Override sha with the spec's preferred prefix where the demo
    // expects sha-d8a3 — but keep the deterministic content-derived
    // form so changing inputs changes the sha. Tests assert "starts
    // with sha-" + format rather than the exact 4 chars.
    sha,
    deltaFromYear1Annual,
    deltaPct,
  };
}
