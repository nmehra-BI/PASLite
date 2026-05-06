/**
 * Refund + clawback math for cancellation.
 *
 * Refund formulas:
 *   pro-rata:        refund = annual × daysRem / daysInTerm
 *   short-rate:      refund = pro_rata × (1 - SHORT_RATE_PENALTY)
 *   void-ab-initio:  refund = 0
 *
 * Clawback formulas (against fullBrokerage = annual × SLIP_BROKERAGE_RATE):
 *   partial:  fullBrokerage × PARTIAL_CLAWBACK_FACTOR
 *   full:     fullBrokerage
 *   none:     0
 *
 * Bordereau net movement = -refund × SYNDICATE_LINE (the syndicate's
 * share of the refund leaving the book — negative because it's an
 * outflow).
 */

import { computeSha } from '@/lib/bind';
import {
  PARTIAL_CLAWBACK_FACTOR,
  SHORT_RATE_PENALTY,
  SLIP_BROKERAGE_RATE,
  SYNDICATE_LINE,
  type CancellationCalc,
  type CancellationReason,
  type RefundBasis,
  REASON_RULES,
} from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ComputeRefundInputs = {
  annualPremium: number;
  policyInception: string;
  policyExpiry: string;
  cancellationEffective: string;
  basis: RefundBasis;
  reason: CancellationReason;
};

export function computeRefundAndClawback(input: ComputeRefundInputs): CancellationCalc {
  const { annualPremium, basis, reason } = input;
  const inception = new Date(input.policyInception).getTime();
  const expiry = new Date(input.policyExpiry).getTime();
  const effective = new Date(input.cancellationEffective).getTime();
  const daysInTerm = Math.max(1, Math.round((expiry - inception) / MS_PER_DAY));
  const daysRemainingRaw = Math.round((expiry - effective) / MS_PER_DAY);
  const daysRemaining = Math.min(daysInTerm, Math.max(0, daysRemainingRaw));

  let refund = 0;
  if (basis === 'pro-rata') {
    refund = Math.round((annualPremium * daysRemaining) / daysInTerm);
  } else if (basis === 'short-rate') {
    const proRata = (annualPremium * daysRemaining) / daysInTerm;
    refund = Math.round(proRata * (1 - SHORT_RATE_PENALTY));
  } // void-ab-initio: refund stays 0

  const fullBrokerage = Math.round(annualPremium * SLIP_BROKERAGE_RATE);
  const clawbackKind = REASON_RULES[reason].clawback;
  const commissionClawback =
    clawbackKind === 'full'
      ? fullBrokerage
      : clawbackKind === 'partial'
        ? Math.round(fullBrokerage * PARTIAL_CLAWBACK_FACTOR)
        : 0;

  // Bordereau net = syndicate share of premium movement.
  // For void-ab-initio there is no premium movement (premium already
  // retained); bordereau net is zero.
  const bordereauNet =
    basis === 'void-ab-initio' ? 0 : -Math.round(refund * SYNDICATE_LINE);

  const sha = computeSha({
    engine: 'cancellation_v1',
    annualPremium,
    daysRemaining,
    daysInTerm,
    basis,
    reason,
    refund,
    commissionClawback,
    bordereauNet,
  });

  return {
    annualPremium,
    daysRemaining,
    daysInTerm,
    basis,
    refund,
    commissionClawback,
    clawbackKind,
    bordereauNet,
    sha,
  };
}
