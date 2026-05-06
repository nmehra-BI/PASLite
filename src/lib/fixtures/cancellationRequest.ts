/**
 * Module 10 — Greenline cancellation fixture.
 *
 * The insured is moving to RegentMGA mid-term (commercial reasons).
 * This is a voluntary insured-non-renewal at short-rate basis.
 */

import type { CancellationReason } from '@/lib/cancellation/types';

export type CancellationRequest = {
  id: string;
  policyRef: string;
  effectiveDate: string;
  reasonCategory: CancellationReason;
  reasonDetail: string;
  brokerName: string;
  brokerEmail: string;
  receivedAt: string;
  subject: string;
  emailBody: string;
  /** Named competitor the insured is switching to, when known. */
  switchingTo: string | null;
};

const GREENLINE_INCEPTION = '2026-05-15T12:00:00+01:00';
const GREENLINE_CANCELLATION_EFFECTIVE = '2026-07-26T00:00:00+01:00';

export const GREENLINE_CANCELLATION: CancellationRequest = {
  id: 'CAN-01',
  policyRef: 'POL-29481',
  effectiveDate: GREENLINE_CANCELLATION_EFFECTIVE,
  reasonCategory: 'insured-non-renewal',
  reasonDetail:
    "Insured giving notice — moving cover to RegentMGA effective 27 July 2026 on commercial terms.",
  brokerName: 'Sarah Whitfield',
  brokerEmail: 's.whitfield@surestep.co.uk',
  receivedAt: '2026-07-19T10:00:00+01:00',
  subject: 'Cancellation — POL-29481 Greenline Recycling — effective 27 July',
  emailBody: `Hi Nishit,

Greenline have given notice on POL-29481 — they're moving cover to RegentMGA from 27 July on commercial terms (RegentMGA quoted ~£35k flat). The board signed off this morning.

There's one open run-off matter to flag: a small contamination event reported on 12 July at the Birmingham site (no third-party impact, in-house clean-up underway). Reserve estimate £6,500 — handled in run-off as part of the cancellation endorsement.

Please confirm the refund (short-rate per cl.14 I believe) and the cancellation endorsement. Standard market terms.

Best,
Sarah`,
  switchingTo: 'RegentMGA',
};

export const GREENLINE_INCEPTION_DATE = GREENLINE_INCEPTION;

export function getGreenlineCancellationRequest(): CancellationRequest {
  return JSON.parse(JSON.stringify(GREENLINE_CANCELLATION)) as CancellationRequest;
}

/** The contamination claim seeded as a run-off entry. */
export const GREENLINE_RUNOFF_CLAIM = {
  ref: 'CLM-29481-001',
  description:
    'Contamination event reported 12 July 2026 at Birmingham (HQ); no third-party impact; in-house clean-up. Reserve £6,500.',
  reserveAmount: 6_500,
};
