/**
 * Module 11 — Greenline year-1 claims fixture.
 *
 * Two recorded claims summing to £17,854 — drives the year-1 LR
 * calculation that feeds renewal credit.
 */

export type ClaimRecord = {
  ref: string;
  siteName: string;
  date: string;
  category: string;
  paid: number;
  reserved: number;
  status: 'open' | 'paid' | 'closed';
  notes: string;
};

export const GREENLINE_YEAR1_CLAIMS: ClaimRecord[] = [
  {
    ref: 'CLM-29481-001',
    siteName: 'Birmingham (HQ)',
    date: '2026-07-12T00:00:00+01:00',
    category: 'contamination',
    paid: 6_500,
    reserved: 0,
    status: 'closed',
    notes:
      'Contamination event at Birmingham — in-house clean-up; no third-party impact. Captured during cancellation run-off; closed at full reserve.',
  },
  {
    ref: 'CLM-29481-002',
    siteName: 'Leeds',
    date: '2027-01-18T09:00:00+00:00',
    category: 'fire',
    paid: 11_354,
    reserved: 0,
    status: 'closed',
    notes:
      'Small-fire event at Leeds storage yard; suppression system contained. PD repair + interruption costs settled in full.',
  },
];

/** Total losses for the year. */
export const GREENLINE_YEAR1_TOTAL_LOSSES = GREENLINE_YEAR1_CLAIMS.reduce(
  (a, c) => a + c.paid + c.reserved,
  0,
);

export function getGreenlineYear1Claims(): ClaimRecord[] {
  return JSON.parse(JSON.stringify(GREENLINE_YEAR1_CLAIMS)) as ClaimRecord[];
}
