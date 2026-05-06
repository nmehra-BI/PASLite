/**
 * Module 10 — cancellation types and rules.
 */

export type CancellationReason =
  | 'insured-non-renewal'      // voluntary; default short-rate
  | 'insured-cancel-other'     // voluntary; default short-rate
  | 'non-payment'              // short-rate; FULL clawback
  | 'mga-cancel-underwriting'  // insurer cause; pro-rata; partial clawback
  | 'mga-cause-misrep';        // void ab initio; £0 refund; full clawback

export type RefundBasis = 'short-rate' | 'pro-rata' | 'void-ab-initio';

export type CancellationHashId = 'refund-basis' | 'runoff-claim' | 'bordereau';

export type CancellationHashStatus = 'pending' | 'confirmed' | 'overridden';

export type CancellationHashRecord = {
  id: CancellationHashId;
  status: CancellationHashStatus;
  artefactSha: string | null;
  expectedSha: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  overrideReason: string | null;
};

export type CancellationPhase =
  | 'idle'
  | 'received'
  | 'reason-review'
  | 'runoff-pending'
  | 'computed'
  | 'ceremony-in-progress'
  | 'committed'
  | 'sent';

/** Rules table — given a reason, what defaults apply. */
export type CancellationRule = {
  defaultBasis: RefundBasis;
  clawback: 'partial' | 'full' | 'none';
  /** Rendered into the endorsement document's reason block. */
  label: string;
};

export const REASON_RULES: Record<CancellationReason, CancellationRule> = {
  'insured-non-renewal': {
    defaultBasis: 'short-rate',
    clawback: 'partial',
    label: 'insured non-renewal',
  },
  'insured-cancel-other': {
    defaultBasis: 'short-rate',
    clawback: 'partial',
    label: 'insured request',
  },
  'non-payment': {
    defaultBasis: 'short-rate',
    clawback: 'full',
    label: 'non-payment of premium',
  },
  'mga-cancel-underwriting': {
    defaultBasis: 'pro-rata',
    clawback: 'partial',
    label: 'underwriter cause',
  },
  'mga-cause-misrep': {
    defaultBasis: 'void-ab-initio',
    clawback: 'full',
    label: 'material misrepresentation — void ab initio',
  },
};

/** Slip clause cl.14 — short-rate penalty applied to the proportional refund. */
export const SHORT_RATE_PENALTY = 0.075;

/**
 * Brokerage rate baked into the slip's cl.X commission clause. Used as
 * the basis for clawback computation. Calibrated so a full clawback on
 * Greenline's £38,265 lands at ~£8,222.
 */
export const SLIP_BROKERAGE_RATE = 0.215;

/**
 * Partial-clawback factor for voluntary short-rate cancellations.
 * Industry standard partial recovery formula; the spec calls out
 * £4,554 = full × 0.554 for Greenline.
 */
export const PARTIAL_CLAWBACK_FACTOR = 0.554;

/** Mock syndicate share — same as the bind ceremony. */
export const SYNDICATE_LINE = 0.65;

export type RunoffClaim = {
  ref: string;
  description: string;
  reserveAmount: number;
  capturedAt: string;
  capturedBy: string;
};

export type BordereauEntry = {
  netMovement: number;
  syndicate: string;
  line: number;
  writtenAt: string;
};

export type CancellationCalc = {
  annualPremium: number;
  daysRemaining: number;
  daysInTerm: number;
  basis: RefundBasis;
  refund: number;
  commissionClawback: number;
  clawbackKind: 'partial' | 'full' | 'none';
  bordereauNet: number;
  sha: string;
};

export type CancellationReplay = {
  phase: CancellationPhase;
  request: {
    id: string;
    broker: string;
    subject: string;
    effectiveDate: string;
    reasonCategory: CancellationReason;
    reasonDetail: string;
    switchingTo: string | null;
    receivedAt: string;
  } | null;
  basis: RefundBasis | null;
  basisOverride: {
    from: RefundBasis;
    to: RefundBasis;
    reason: string;
    overriddenBy: string;
    at: string;
  } | null;
  runoffClaim: RunoffClaim | null;
  calc: CancellationCalc | null;
  bordereau: BordereauEntry | null;
  hashes: CancellationHashRecord[];
  endorsementRef: string | null;
  endorsementNumber: number | null;
  committedAt: string | null;
  signedBy: string | null;
  sentAt: string | null;
  sentBy: string | null;
};

export function freshCancellation(): CancellationReplay {
  return {
    phase: 'idle',
    request: null,
    basis: null,
    basisOverride: null,
    runoffClaim: null,
    calc: null,
    bordereau: null,
    hashes: [],
    endorsementRef: null,
    endorsementNumber: null,
    committedAt: null,
    signedBy: null,
    sentAt: null,
    sentBy: null,
  };
}
