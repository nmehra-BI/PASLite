/**
 * Derive a HistoricalBinder record from a just-bound submission so it
 * can be added to the same-MGA ledger and influence subsequent
 * recommendations. This is the data flywheel: each bind compounds the
 * book's signal for future submissions.
 *
 * The fresh entry has `matured: false`, `actualLossRatio: null`, and
 * `profitability: null` because no loss outcomes have rolled in yet —
 * those fields update as the policy ages. For the demo this means the
 * binder appears as a "similar profile in-force" match (lifting
 * FCT-001's strongMatchCount), without yet contributing to FCT-002's
 * matured-cohort profitable-share.
 */

import { effectiveValue } from '@/lib/field';
import type { HistoricalBinder, Submission } from '@/lib/fixtures';

export function deriveBoundLedgerEntry(input: {
  submission: Submission;
  policyRef: string;
  premium: number;
  signedBy: string;
  signedAt: string;
}): HistoricalBinder {
  const { submission, policyRef, premium, signedBy, signedAt } = input;
  const turnover = (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  const yearsTrading =
    (effectiveValue(submission.insured.yearsTrading) as number | null) ?? 0;
  const materials =
    (effectiveValue(submission.materials) as string[] | null) ?? [];
  const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fireSuppression: HistoricalBinder['fireSuppression'] =
    fsValue === true ? 'present' : 'absent';
  const priorLossRatio =
    (effectiveValue(submission.statedLossRatio) as number | null) ?? 0;
  const geography = submission.sites
    .map((s) => effectiveValue(s.name) as string | null)
    .filter((n): n is string => n !== null)
    .map((s) => s.replace(/\s*\(.*\)\s*/, '').trim());

  return {
    id: policyRef,
    insuredName:
      (effectiveValue(submission.insured.legalName) as string | null) ??
      'Unknown insured',
    boundAt: signedAt,
    turnover,
    siteCount: submission.sites.length,
    materials,
    fireSuppression,
    priorLossRatio,
    yearsInBusiness: yearsTrading,
    geography,
    matured: false,
    actualLossRatio: null,
    profitability: null,
    earnedPremium: null,
    incurredLoss: null,
    underwriter: signedBy,
    capacity: 'Synd 2358 65%',
    // The premium is captured as earnedPremium=null, but we annotate
    // the bound premium for trace alignment via the audit log.
    ...(premium > 0 ? {} : {}),
  };
}
