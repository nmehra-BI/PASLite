/**
 * Tier-2 W&R rating engine — types.
 *
 * Voice: deterministic, mathematical, reproducible. Every cell carries a
 * spreadsheet reference (A1, B14, ...), a label, the input(s) that fed
 * it, and the rounded integer pound output. Same inputs → same outputs.
 *
 * The engine is sealed against a versioned content hash. Module 5 ships
 * recyclesure_v3.2.xlsx · sha-7f2a; later modules may bump the hash to
 * indicate a new sheet without breaking replay (the audit log carries
 * the sha that produced each output).
 */

export type RatingInputs = {
  /** Effective FY24 turnover in £, post-conflict-resolution. */
  turnover: number;
  /** Number of operating sites. */
  siteCount: number;
  /** Material classes handled. */
  materials: string[];
  /** Fire-suppression disclosure state at rating time. */
  fireSuppression: 'present' | 'absent' | 'undisclosed';
  /** 5-year loss ratio as a decimal (0.38 == 38%). */
  lossRatio: number;
  /** Largest single-claim quantum in £. */
  largestSingleClaim: number;
  /** Years in business per Companies House. */
  yearsInBusiness: number;
  /** Broker target premium — informational only, not used in the calc. */
  brokerTargetPremium?: number;
};

/**
 * One row of the build-up table. Modelled to read like a spreadsheet
 * cell: cell ref + label + the value it computed. The optional
 * `subtotalAfter` carries the running subtotal for visual chains.
 */
export type Cell = {
  /** Spreadsheet-style reference, e.g. "B14". */
  ref: string;
  /** Plain-English label rendered in the build-up. */
  label: string;
  /**
   * Operation symbol shown next to the label. '×', '+', '−', or empty
   * for the base/final rows.
   */
  op?: '×' | '+' | '−' | '';
  /**
   * Whatever this row contributes — could be a £ figure or a multiplier.
   * Always rounded; never carries fractional pence.
   */
  value: number;
  /**
   * Display style for `value`:
   *   'currency' — £X,XXX
   *   'percent'  — X.X%
   *   'multiplier' — Xx
   */
  format: 'currency' | 'percent' | 'multiplier';
  /** Running subtotal after applying this row, or null for non-running rows. */
  subtotalAfter: number | null;
  /** Plain-English explanation for the inspector. */
  formula: string;
  /** Field path(s) on the submission tree that fed this cell. */
  inputs: Array<{ label: string; path: string; value: unknown }>;
};

export type RatingOutput = {
  /** The final premium in £. */
  premium: number;
  /** All eight cells in calc order. */
  cells: Cell[];
  /** Versioned content hash of the rating sheet. */
  sha: string;
  /** Engine version label, e.g. "v3.2". */
  version: string;
  /** Tier label, e.g. "Tier-2". */
  tier: string;
  /** ISO timestamp of when the engine ran. */
  computedAt: string;
};

export type CellRecord = Cell & {
  /** When the cinematic emitted this cell event. */
  emittedAt: string;
};

export type RatingReplayState = {
  phase: 'pending' | 'evaluating' | 'settled';
  cells: CellRecord[];
  output: {
    premium: number;
    sha: string;
    version: string;
    tier: string;
    computedAt: string;
  } | null;
  /**
   * Suffix appended to the sha for re-rate iterations (`-r2`, `-r3`).
   * The base sha-7f2a is sealed; replay tracks the iteration so
   * downstream artifacts (slip, email) can show "rated again".
   */
  iteration: number;
};
