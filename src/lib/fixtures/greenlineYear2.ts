/**
 * Module 11 — Greenline year-2 (renewal) attributes.
 *
 * Submitted at the renewal trigger (90 days to expiry). Carries the
 * year-2 changes: turnover up, WEEE class added, broker target,
 * competitive pressure note.
 */

export type GreenlineYear2 = {
  inceptionDate: string;
  expiryDate: string;
  newTurnover: number;
  /** Existing materials are unchanged; this is the additive set. */
  materialAdditions: string[];
  brokerTargetPremium: number | null;
  competitivePressure: string | null;
  notes: string;
};

export const GREENLINE_YEAR2: GreenlineYear2 = {
  inceptionDate: '2027-05-15T12:00:00+01:00',
  expiryDate: '2028-05-15T12:00:00+01:00',
  newTurnover: 11_200_000,
  materialAdditions: ['WEEE (small electrical & electronic equipment)'],
  brokerTargetPremium: 52_000,
  competitivePressure:
    'RegentMGA approached the broker with an indicative ~£50k flat for year 2 (no formal quote yet).',
  notes:
    'Greenline have grown 13% YoY into year-2 projections. WEEE class added at all sites following supplier-level diversification. EA permits all in force; Manchester permit (EAWML-77890) issued 09 Sept 2026 within the 60-day MTA-04 warranty.',
};

export function getGreenlineYear2(): GreenlineYear2 {
  return JSON.parse(JSON.stringify(GREENLINE_YEAR2)) as GreenlineYear2;
}
