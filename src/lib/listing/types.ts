/**
 * Module 12 — listing types.
 *
 * The cockpit's workspace surface. Each entry is a rich projection of
 * a submission or bound policy with its current state, the cockpit's
 * recommended next action, and a priority that drives sort order.
 *
 * For MVP the entries are seeded from a fixture (listingDemo.ts).
 * In production they'd derive from the audit log + per-submission
 * states, with an entry per submissionId.
 */

export type ListingPhase =
  | 'extraction'
  | 'enrichment'
  | 'triage'
  | 'rating'
  | 'quoted'
  | 'awaiting-broker'
  | 'recommendation-ready'
  | 'bind-ceremony'
  | 'bound'
  | 'mta-pending'
  | 'in-force-with-mta'
  | 'cancel-pending'
  | 'cancelled'
  | 'ntu'
  | 'declined'
  | 'renewal-pending'
  | 'renewed';

export type ListingPriority = 'high' | 'medium' | 'watch' | 'steady';

export type ListingSection =
  | 'needs-attention'
  | 'awaiting-broker'
  | 'in-force'
  | 'recently-closed';

export type StageGlyphKind = 'action' | 'conflict' | 'watch' | 'steady' | 'closed' | 'declined';

export type ActionId =
  | 'open-bind-ceremony'
  | 'review-conflict'
  | 'review-triage-refer'
  | 'review-claim'
  | 'chase-broker'
  | 'mark-evidence-received'
  | 'open-canvas'
  | 'view-cancellation'
  | 'view-ntu'
  | 'view-declined'
  | 'view-bound'
  | 'open-renewal-trigger';

export type ListingAction = {
  id: ActionId;
  label: string;
  /** Coral primary | hairline secondary | ghost tertiary. */
  tone: 'primary' | 'secondary' | 'ghost';
  /** True when the action drills to the canvas; false when handled
   *  inline (e.g. chase email). */
  drillsToCanvas: boolean;
};

export type ListingEntry = {
  ref: string;
  insuredName: string;
  lob: string;
  phase: ListingPhase;
  priority: ListingPriority;
  section: ListingSection;
  glyph: StageGlyphKind;
  /** Italic-serif headline status — what's happening, in the
   *  cockpit's voice. */
  status: string;
  /** Optional italic-serif marginalia — why this matters. */
  context: string | null;
  /** Premium £, when quoted/bound. */
  premium: number | null;
  /** ISO timestamp of the most recent meaningful activity. */
  lastActivityAt: string;
  /** Broker name (lookup target for chase actions). */
  brokerName: string;
  brokerEmail: string;
  /** When set, indicates the underwriter chased the broker recently;
   *  the row replaces "Chase broker" with a non-clickable receipt. */
  lastChaseAt: string | null;
  actions: ListingAction[];
};

export type MorningBriefing = {
  greeting: string;
  countLabel: string;
  breakdown: string;
  marginalia: string;
};
