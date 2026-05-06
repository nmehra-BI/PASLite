/**
 * Bound-authority triage primitives.
 *
 * Triage is rules-based: every check is a deterministic function over
 * the submission state. The model can SURFACE the rule that fired and
 * EXPLAIN it, but it does not override. The underwriter can override
 * any check with a recorded reason — that override becomes part of
 * the audit trail and the bind history.
 */

export type CheckId = 'appetite' | 'capacity' | 'subjectivities' | 'sanctions';

export type CheckOutcome = 'pass' | 'refer' | 'decline';

export type RuleEvaluation = {
  ruleId: string;
  description: string;
  passed: boolean;
  /** Pretty-printed value the rule was tested against. */
  testedValue?: string;
};

export type TriageResult = {
  outcome: CheckOutcome;
  /** Human-readable rationale: what the rule collectively means. */
  rationale: string;
  /** Each rule evaluated by the check. */
  rules: RuleEvaluation[];
  /** Optional structured data (e.g. capacity headroom). */
  metadata?: Record<string, unknown>;
};

export type TriageVerdict = 'pass' | 'refer' | 'decline';
