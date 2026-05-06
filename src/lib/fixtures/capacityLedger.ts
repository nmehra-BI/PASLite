/**
 * Mock capacity ledger for Syndicate 2358 / UK W&R / Tier-2.
 *
 * Real production reads this from a backend; for the demo it's a
 * frozen snapshot. The triage capacity check projects this submission's
 * estimated consumption against the headroom.
 */

export type CapacityLedger = {
  syndicate: string;
  segment: string;
  /** Annual aggregate cap in £. */
  annualAggregateCap: number;
  consumedYTD: number;
  openReferrals: number;
  /** Updated-at timestamp. */
  refreshedAt: string;
};

export function getCapacityLedger(): CapacityLedger {
  return {
    syndicate: 'Syndicate 2358',
    segment: 'UK W&R · Tier-2',
    annualAggregateCap: 50_000_000,
    consumedYTD: 36_420_000,
    openReferrals: 1_200_000,
    refreshedAt: new Date().toISOString(),
  };
}

export function capacityHeadroom(l: CapacityLedger): number {
  return l.annualAggregateCap - l.consumedYTD - l.openReferrals;
}

export function capacityHeadroomPct(l: CapacityLedger): number {
  return capacityHeadroom(l) / l.annualAggregateCap;
}
