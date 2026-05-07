/**
 * Mock capacity ledger for the active tenant's capacity provider.
 *
 * Real production reads this from a backend; for the demo it's a
 * frozen snapshot. The triage capacity check projects this submission's
 * estimated consumption against the headroom. The syndicate name +
 * segment label + cap are derived from the active tenant config so
 * the ledger automatically tracks tenant changes.
 */

import { getActiveConfig } from '@/config';

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
  const config = getActiveConfig();
  const lob = config.metadata.lineOfBusiness;
  return {
    syndicate: config.metadata.capacityProvider.name,
    segment: `${lob.label} · ${lob.tier}`,
    annualAggregateCap: config.capacity.totalCapacity,
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
