/**
 * Compute the BEFORE/AFTER comparison for an MTA, plus the delta
 * rating breakdown the ceremony hashes against.
 *
 * Reuses module 5's runRating engine (sealed v3.2 / sha-7f2a) so the
 * before / after columns are arithmetically identical to what the
 * cockpit would have produced at bind time, with new inputs swapped
 * in for the after column.
 */

import { effectiveValue } from '@/lib/field';
import { runRating } from '@/lib/rating';
import type { Submission, MtaRequest } from '@/lib/fixtures';
import type { LossRun } from '@/lib/fixtures';
import { computeSha } from '@/lib/bind';
import { computeProRata } from './computeProRata';
import type {
  DeltaRatingBreakdown,
  RatingCellRow,
} from './types';

export type ComputeDeltaInputs = {
  /** The submission as it was at bind time (read live state — for MVP
   *  the submission is the v1 state since no MTAs have applied yet). */
  submission: Submission;
  /** The MTA request being rated. */
  mta: MtaRequest;
  /** £ premium the policy was bound at. */
  boundPremium: number;
};

export type SimplifiedSiteRow = {
  name: string;
  sqm: number | null;
  permitRef: string | null;
  permitExpiry: string | null;
};

export type PolicyContextDiff = {
  before: {
    turnover: number;
    siteCount: number;
    sites: SimplifiedSiteRow[];
    totalSqm: number;
    materials: string[];
    fireSuppression: 'present' | 'absent' | 'undisclosed';
  };
  after: {
    turnover: number;
    siteCount: number;
    sites: SimplifiedSiteRow[];
    totalSqm: number;
    materials: string[];
    fireSuppression: 'present' | 'absent' | 'undisclosed';
    /** Index of the newly-added row in `after.sites` for highlighting. */
    addedSiteIndex: number;
  };
  /** Convenience deltas computed once for the BEFORE/AFTER UI. */
  deltas: {
    turnoverAbs: number;
    turnoverPct: number;
    sqmAbs: number;
    sqmPct: number;
    siteCountAbs: number;
  };
};

/**
 * Build the BEFORE/AFTER policy context view used by the
 * PolicyContextReview UI. Pure projection.
 */
export function buildPolicyContextDiff(input: ComputeDeltaInputs): PolicyContextDiff {
  const { submission, mta } = input;
  const beforeTurnover =
    (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  const beforeMaterials =
    (effectiveValue(submission.materials) as string[] | null) ?? [];
  const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fireSuppression: 'present' | 'absent' | 'undisclosed' =
    fsValue === true ? 'present' : fsValue === false ? 'absent' : 'undisclosed';

  const beforeSites: SimplifiedSiteRow[] = submission.sites.map((s) => ({
    name: (effectiveValue(s.name) as string | null) ?? '—',
    sqm: (effectiveValue(s.sqm) as number | null) ?? null,
    permitRef: (effectiveValue(s.permitRef) as string | null) ?? null,
    permitExpiry: (effectiveValue(s.permitExpiry) as string | null) ?? null,
  }));
  const beforeTotalSqm = beforeSites.reduce((a, s) => a + (s.sqm ?? 0), 0);

  const afterSites: SimplifiedSiteRow[] = [
    ...beforeSites,
    {
      name: mta.newSite.name,
      sqm: mta.newSite.sqm,
      permitRef: mta.newSite.expectedPermitRef ?? null,
      permitExpiry: null,
    },
  ];
  const afterTotalSqm = afterSites.reduce((a, s) => a + (s.sqm ?? 0), 0);

  const turnoverAbs = mta.newTurnover - beforeTurnover;
  const turnoverPct = beforeTurnover > 0 ? turnoverAbs / beforeTurnover : 0;
  const sqmAbs = afterTotalSqm - beforeTotalSqm;
  const sqmPct = beforeTotalSqm > 0 ? sqmAbs / beforeTotalSqm : 0;

  return {
    before: {
      turnover: beforeTurnover,
      siteCount: submission.sites.length,
      sites: beforeSites,
      totalSqm: beforeTotalSqm,
      materials: beforeMaterials,
      fireSuppression,
    },
    after: {
      turnover: mta.newTurnover,
      siteCount: mta.newSiteCount,
      sites: afterSites,
      totalSqm: afterTotalSqm,
      materials: beforeMaterials, // unchanged for the Manchester MTA
      fireSuppression,
      addedSiteIndex: afterSites.length - 1,
    },
    deltas: {
      turnoverAbs,
      turnoverPct,
      sqmAbs,
      sqmPct,
      siteCountAbs: mta.newSiteCount - submission.sites.length,
    },
  };
}

function cellRow(cell: {
  ref: string;
  label: string;
  op?: '×' | '+' | '−' | '';
  value: number;
  format: 'currency' | 'percent' | 'multiplier';
  subtotalAfter: number | null;
  formula: string;
}): RatingCellRow {
  return {
    ref: cell.ref,
    label: cell.label,
    op: cell.op ?? '',
    value: cell.value,
    format: cell.format,
    subtotalAfter: cell.subtotalAfter,
    formula: cell.formula,
  };
}

/**
 * Run the rating engine twice (BEFORE = bound state, AFTER = MTA
 * inputs) and pro-rate the delta against the unexpired term.
 */
export function computeDeltaRating(input: ComputeDeltaInputs): DeltaRatingBreakdown {
  const { submission, mta, boundPremium } = input;

  const lossRatio =
    (effectiveValue(submission.statedLossRatio) as number | null) ?? 0;
  const lossRuns =
    (effectiveValue(submission.lossRuns) as LossRun[] | null) ?? [];
  const largestSingleClaim = lossRuns.reduce(
    (max, r) => Math.max(max, r.amount),
    0,
  );
  const yearsInBusiness =
    (effectiveValue(submission.insured.yearsTrading) as number | null) ?? 0;
  const materials =
    (effectiveValue(submission.materials) as string[] | null) ?? [];
  const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fireSuppression: 'present' | 'absent' | 'undisclosed' =
    fsValue === true ? 'present' : fsValue === false ? 'absent' : 'undisclosed';

  // BEFORE — re-rate at the bound state (sites = current count).
  const before = runRating({
    turnover: (effectiveValue(submission.insured.turnover) as number | null) ?? 0,
    siteCount: submission.sites.length,
    materials,
    fireSuppression,
    lossRatio,
    largestSingleClaim,
    yearsInBusiness,
  });

  // AFTER — swap in the MTA inputs (turnover + siteCount + materials
  // unchanged for Manchester; fireSuppression unchanged at 'present').
  const after = runRating({
    turnover: mta.newTurnover,
    siteCount: mta.newSiteCount,
    materials,
    fireSuppression,
    lossRatio,
    largestSingleClaim,
    yearsInBusiness,
  });

  // Annual delta is between the new annual-equivalent and the
  // ORIGINAL bound premium (i.e. what's actually owed in delta vs the
  // sealed quote — not what the engine would produce today against
  // its own BEFORE rerun, which can drift a pound or two from float
  // precision in subsequent runs of the same fixture).
  const annualDelta = after.premium - boundPremium;

  const inception =
    (effectiveValue(submission.cover.inceptionDate) as string | null) ??
    new Date().toISOString();
  const expiry =
    (effectiveValue(submission.cover.expiryDate) as string | null) ??
    new Date(Date.now() + 365 * 86_400_000).toISOString();
  const proRata = computeProRata({
    annualDelta,
    effectiveDate: mta.effectiveDate,
    policyInception: inception,
    policyExpiry: expiry,
  });

  const sha = computeSha({
    engine: 'recyclesure_v3.2',
    boundPremium,
    afterAnnualEquivalent: after.premium,
    annualDelta,
    proRatedAP: proRata.proRatedAP,
    daysInTerm: proRata.daysInTerm,
    daysRemaining: proRata.daysRemaining,
    effectiveDate: mta.effectiveDate,
  });

  return {
    beforePremium: boundPremium,
    afterAnnualEquivalent: after.premium,
    annualDelta,
    daysRemaining: proRata.daysRemaining,
    daysInTerm: proRata.daysInTerm,
    proRatedAP: proRata.proRatedAP,
    sha,
    beforeCells: before.cells.map(cellRow),
    afterCells: after.cells.map(cellRow),
  };
}
