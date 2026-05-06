import type { Submission, LossRun } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import type { RatingInputs } from './types';

/**
 * Derive rating engine inputs from the live submission tree. Used by
 * the cinematic engine, the banner's projected-premium calculation,
 * and the revised-quote orchestrator. Centralised so the two paths
 * never drift.
 */
export function buildRatingInputs(submission: Submission): RatingInputs {
  const turnover = (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  const yearsInBusiness =
    (effectiveValue(submission.insured.yearsTrading) as number | null) ?? 0;
  const sites = submission.sites.length;
  const materials =
    (effectiveValue(submission.materials) as string[] | null) ?? [];
  const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fireSuppression: 'present' | 'absent' | 'undisclosed' =
    fsValue === true ? 'present' : fsValue === false ? 'absent' : 'undisclosed';
  const lossRatio =
    (effectiveValue(submission.statedLossRatio) as number | null) ?? 0;
  const lossRuns = (effectiveValue(submission.lossRuns) as LossRun[] | null) ?? [];
  const largestSingleClaim = lossRuns.reduce(
    (max, r) => Math.max(max, r.amount),
    0,
  );
  const brokerTargetPremium =
    (effectiveValue(submission.brokerTargetPremium) as number | null) ?? undefined;

  return {
    turnover,
    siteCount: sites,
    materials,
    fireSuppression,
    lossRatio,
    largestSingleClaim,
    yearsInBusiness,
    brokerTargetPremium,
  };
}
