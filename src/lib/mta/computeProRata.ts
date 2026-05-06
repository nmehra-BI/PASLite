/**
 * Pro-rata premium calculation for an MTA.
 *
 * Given the annual delta between the new annual-equivalent premium
 * and the old bound premium, return the additional premium owed for
 * the unexpired term. Pro-rata is days-remaining / days-in-term, both
 * computed inclusively from the policy inception/expiry boundaries.
 *
 * Same inputs → same output. No floating-point drift; rounded to
 * whole pounds at the end.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ProRataInputs = {
  annualDelta: number;
  /** ISO date of MTA effective. */
  effectiveDate: string;
  /** ISO date of policy inception (when the term began). */
  policyInception: string;
  /** ISO date of policy expiry (term end). */
  policyExpiry: string;
};

export type ProRataResult = {
  daysInTerm: number;
  daysRemaining: number;
  /** Pro-rated additional / return premium, rounded to whole pounds. */
  proRatedAP: number;
  /** The fraction of term remaining at the effective date. */
  fractionRemaining: number;
};

export function computeProRata(input: ProRataInputs): ProRataResult {
  const inception = new Date(input.policyInception).getTime();
  const expiry = new Date(input.policyExpiry).getTime();
  const effective = new Date(input.effectiveDate).getTime();
  const daysInTerm = Math.max(1, Math.round((expiry - inception) / MS_PER_DAY));
  const daysRemainingRaw = Math.round((expiry - effective) / MS_PER_DAY);
  const daysRemaining = Math.min(daysInTerm, Math.max(0, daysRemainingRaw));
  const fractionRemaining = daysRemaining / daysInTerm;
  const proRatedAP = Math.round(input.annualDelta * fractionRemaining);
  return { daysInTerm, daysRemaining, proRatedAP, fractionRemaining };
}
