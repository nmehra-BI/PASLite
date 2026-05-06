/**
 * Module 8 — bind ceremony types.
 *
 * The four-hash ceremony is structured as a discriminated union over
 * the hash kinds. Each hash carries the artefact-specific provenance
 * the certificate will reproduce verbatim.
 */

export type HashId = 'premium' | 'subjectivities' | 'sanctions' | 'capacity';

export type HashStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'overridden';

/**
 * The replay-projected state of a single hash. Reconstructed from
 * bind.hashConfirmed / bind.hashFailed / bind.hashOverridden events.
 */
export type HashRecord = {
  id: HashId;
  status: HashStatus;
  /** The sha of the artefact at the moment the hash was signed. */
  artefactSha: string | null;
  /**
   * The sha that was *expected* (i.e. the hash recorded at the
   * artefact's seal time — rating-time for premium, quote-sent-time
   * for subjectivities). Used to detect drift.
   */
  expectedSha: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  /** Captured when the underwriter overrides a failed hash. */
  overrideReason: string | null;
};

export type BindCeremonyPhase =
  | 'idle'
  | 'in-progress'
  | 'committed'
  | 'held';

export type BindCeremonyReplay = {
  phase: BindCeremonyPhase;
  hashes: HashRecord[];
  startedAt: string | null;
  committedAt: string | null;
  /** POL-29481 once committed. */
  policyRef: string | null;
  signedBy: string | null;
  /** Note captured if ceremony was held for review. */
  heldReason: string | null;
};

export type SubjectivityType = 'permit-warranty' | 'maintenance-warranty';

export type SubjectivityRecord = {
  id: string;
  subjectivityType: SubjectivityType;
  description: string;
  affectedSites: string[];
  /** ISO date for the next critical event (e.g. permit expiry). */
  criticalDate: string | null;
  status: 'active' | 'satisfied' | 'breached';
  actionRequired: string | null;
  autoMonitor: boolean;
  createdAt: string;
};

export type ScheduleReplay = {
  generated: boolean;
  generatedAt: string | null;
  recipient: string | null;
  coveringNote: string | null;
  sentAt: string | null;
  sentBy: string | null;
};

export type PostBindReplay = {
  schedule: ScheduleReplay;
  subjectivities: SubjectivityRecord[];
};

/**
 * The formal, immutable bind certificate. Generated once, at the
 * moment of bind commit; replayable for compliance from the audit log.
 */
export type BindCertificate = {
  policyRef: string;
  insuredName: string;
  inceptionDate: string;
  expiryDate: string;
  term: string;
  premium: number;
  hashes: Array<{
    id: HashId;
    label: string;
    sha: string;
    confirmedAt: string;
    detail: string;
  }>;
  warranties: string[];
  capacity: { syndicate: string; line: string; consumption: number };
  signedBy: string;
  signedAt: string;
};

export type HashLabel = {
  id: HashId;
  title: string;
  /** Short label used on the certificate. */
  certificateLabel: string;
};

export const HASH_LABELS: HashLabel[] = [
  {
    id: 'premium',
    title: 'Premium',
    certificateLabel: 'PREMIUM',
  },
  {
    id: 'subjectivities',
    title: 'Subjectivities & warranties',
    certificateLabel: 'SUBJECTIVITIES & WARRANTIES',
  },
  {
    id: 'sanctions',
    title: 'Sanctions refresh',
    certificateLabel: 'SANCTIONS',
  },
  {
    id: 'capacity',
    title: 'Capacity allocation',
    certificateLabel: 'CAPACITY',
  },
];
