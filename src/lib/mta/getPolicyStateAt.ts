/**
 * Reconstruct the policy state at any historical timestamp.
 *
 * Folds the immutable baseBind + chronological MTAs that are
 * effective at-or-before the target timestamp. Returns the
 * computed state — turnover, site list, premium, version label.
 *
 * For MVP this is a deterministic projection over the policy slice
 * (baseBind + versions). It does not re-run extraction; it only
 * applies the changes recorded by each committed MTA.
 */

import { effectiveValue } from '@/lib/field';
import type { Submission } from '@/lib/fixtures';
import type { PolicyVersionRecord } from './types';

export type PolicyStateAt = {
  /** ISO of the requested timestamp. */
  asOf: string;
  /** v1 = base bind only; v(n+1) = base + n MTAs applied. */
  versionLabel: string;
  endorsementCount: number;
  /** Effective annual-equivalent premium as of asOf. */
  annualEquivalent: number;
  /** Cumulative additional premium across MTAs effective ≤ asOf. */
  cumulativeAP: number;
  /** Effective site count. */
  siteCount: number;
  /** Effective turnover. */
  turnover: number;
};

export type GetPolicyStateAtInputs = {
  submission: Submission;
  /** £ premium the policy was bound at. */
  boundPremium: number;
  /** Committed MTA versions, in chronological order. */
  versions: PolicyVersionRecord[];
  /** Target timestamp. */
  asOf: string;
};

export function getPolicyStateAt(input: GetPolicyStateAtInputs): PolicyStateAt {
  const { submission, boundPremium, versions, asOf } = input;
  const asOfMs = new Date(asOf).getTime();

  let annualEquivalent = boundPremium;
  let cumulativeAP = 0;
  let siteCount = submission.sites.length;
  let turnover =
    (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  let endorsementCount = 0;

  for (const v of versions) {
    if (new Date(v.effectiveDate).getTime() > asOfMs) break;
    annualEquivalent = v.afterAnnualEquivalent;
    cumulativeAP += v.proRatedAP;
    endorsementCount += 1;
    if (v.changeType === 'add-site') siteCount += 1;
    else if (v.changeType === 'remove-site') siteCount = Math.max(0, siteCount - 1);
  }

  return {
    asOf,
    versionLabel: `v${endorsementCount + 1}`,
    endorsementCount,
    annualEquivalent,
    cumulativeAP,
    siteCount,
    turnover,
  };
}
