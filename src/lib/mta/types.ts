/**
 * Module 9 — MTA / endorsement types.
 *
 * The MTA workflow shape mirrors the new-business journey but at
 * smaller scale: extraction → context review → delta rating →
 * capacity recheck → revised schedule → two-hash ceremony → issue.
 *
 * The policy version model layers MTAs on top of the immutable
 * baseBind: getPolicyStateAt(timestamp) folds them in chronological
 * order to reconstruct any historical state.
 */

import type { MtaChangeType, MtaNewSite } from '@/lib/fixtures/mtaRequest';

export type MtaPhase =
  | 'idle'
  | 'received'
  | 'extracting'
  | 'extracted'
  | 'gap-pending'
  | 'context-review'
  | 'delta-rating'
  | 'capacity-rechecked'
  | 'schedule-ready'
  | 'ceremony-in-progress'
  | 'committed'
  | 'sent'
  | 'held';

export type MtaHashId = 'delta-premium' | 'capacity-update';

export type MtaHashStatus = 'pending' | 'confirmed' | 'overridden';

export type MtaHashRecord = {
  id: MtaHashId;
  status: MtaHashStatus;
  artefactSha: string | null;
  expectedSha: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  overrideReason: string | null;
};

export type MtaGapResolutionChoice = 'conditional' | 'wait' | 'decline';

export type MtaGapRecord = {
  id: string;
  description: string;
  detectedAt: string;
  resolution: {
    choice: MtaGapResolutionChoice;
    reason: string;
    resolvedBy: string;
    resolvedAt: string;
  } | null;
};

export type MtaExtractedFields = {
  effectiveDate: string;
  changeType: MtaChangeType;
  newSite: MtaNewSite;
  newTurnover: number;
  newSiteCount: number;
};

export type DeltaRatingBreakdown = {
  beforePremium: number;
  afterAnnualEquivalent: number;
  annualDelta: number;
  daysRemaining: number;
  daysInTerm: number;
  proRatedAP: number;
  /** Sealed sha for this delta calculation (versioned per MTA). */
  sha: string;
  /** Cell-level breakdown for both columns; each cell has the same
   * shape as module 5's RatingCell so the inspector can reuse. */
  beforeCells: RatingCellRow[];
  afterCells: RatingCellRow[];
};

export type RatingCellRow = {
  ref: string;
  label: string;
  op: '×' | '+' | '−' | '';
  value: number;
  format: 'currency' | 'percent' | 'multiplier';
  subtotalAfter: number | null;
  formula: string;
};

export type MtaCapacityRecheck = {
  /** £ delta consumption above the bound allocation. */
  deltaConsumption: number;
  /** £ new total consumption (bound + MTA). */
  newTotalConsumption: number;
  /** True if the new total fits within syndicate headroom. */
  sufficient: boolean;
  /** £ headroom remaining after this MTA. */
  headroomAfter: number;
};

export type MtaScheduleArtefact = {
  scheduleRef: string;
  endorsementNumber: number;
  effectiveDate: string;
  endorsementNote: string;
  addedWarranty: string | null;
  /** Full warranty array on the policy AFTER this MTA, in display order. */
  warranties: string[];
  recipient: string;
  recipientName: string;
  coveringNote: string;
};

export type MtaReplay = {
  phase: MtaPhase;
  request: {
    id: string;
    policyRef: string;
    effectiveDate: string;
    changeType: MtaChangeType;
    brokerName: string;
    receivedAt: string;
    subject: string;
    emailBody: string;
  } | null;
  fields: MtaExtractedFields | null;
  /** Avg confidence at extraction settle. */
  extractionConfidence: number | null;
  fieldCount: number;
  /** Pending gaps from extraction (e.g. permit pending). */
  gaps: MtaGapRecord[];
  delta: DeltaRatingBreakdown | null;
  capacity: MtaCapacityRecheck | null;
  schedule: MtaScheduleArtefact | null;
  hashes: MtaHashRecord[];
  committedAt: string | null;
  sentAt: string | null;
  sentBy: string | null;
  signedBy: string | null;
  /** Underwriter-applied corrections to the extracted MTA fields. */
  corrections: { newTurnover?: number; newSiteSqm?: number };
  /** Set when an upstream correction has invalidated downstream
   *  artefacts; ceremony cannot proceed until rerun. */
  staleSince: string | null;
};

export function freshMta(): MtaReplay {
  return {
    phase: 'idle',
    request: null,
    fields: null,
    extractionConfidence: null,
    fieldCount: 0,
    gaps: [],
    delta: null,
    capacity: null,
    schedule: null,
    hashes: [],
    committedAt: null,
    sentAt: null,
    sentBy: null,
    signedBy: null,
    corrections: {},
    staleSince: null,
  };
}

/**
 * The policy version stack. baseBind is the original committed bind
 * (capturing the v1 state); mtas[] are committed MTAs in
 * chronological order. The current effective state is
 * baseBind + apply(mta1) + apply(mta2) + ...
 */
export type PolicyVersionRecord = {
  versionId: string;
  endorsementNumber: number;
  effectiveDate: string;
  changeType: MtaChangeType;
  proRatedAP: number;
  afterAnnualEquivalent: number;
  scheduleRef: string;
  signedBy: string;
  signedAt: string;
};

export type PolicyReplay = {
  /** True once the bind ceremony committed this submission. */
  bound: boolean;
  baseBindAt: string | null;
  versions: PolicyVersionRecord[];
  /** Count of administrative endorsements that exist BEFORE the
   *  cockpit's tracked window (versions[]). The cockpit's first MTA
   *  is endorsement (priorEndorsementCount + 1).
   *
   *  For the Greenline demo this is 3 (original schedule + two
   *  prior administrative endorsements), so the first MTA renders
   *  as MTA-04. A future tenant's policy with no prior administrative
   *  endorsements would set this to 0; their first MTA would be
   *  MTA-01.
   *
   *  Populated on bind.committed from
   *  config.metadata.priorAdministrativeEndorsements.
   */
  priorEndorsementCount: number;
};

export function freshPolicy(): PolicyReplay {
  return {
    bound: false,
    baseBindAt: null,
    versions: [],
    priorEndorsementCount: 0,
  };
}
