import type { Submission } from '@/lib/fixtures';
import {
  capacityHeadroom,
  capacityHeadroomPct,
  getCapacityLedger,
} from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import type { TriageResult, RuleEvaluation } from './types';

/** Tier-2 base rate for the parametric estimate. */
const BASE_RATE = 0.0056;
/** Syndicate line on this product. */
const LINE_PCT = 0.65;
/** Margin warning threshold (% of cap). */
const LOW_HEADROOM_PCT = 0.1;

/**
 * Project this submission's capacity consumption against the syndicate
 * ledger. The estimate here is a quick parametric (turnover × base
 * rate × line %); module 5 will compute the full Tier-2 figure.
 */
export function checkCapacity(submission: Submission): TriageResult {
  const ledger = getCapacityLedger();
  const turnover = (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  const estimatedPremium = Math.round(turnover * BASE_RATE);
  const consumption = Math.round(estimatedPremium * LINE_PCT);
  const headroom = capacityHeadroom(ledger);
  const headroomPct = capacityHeadroomPct(ledger);

  const rules: RuleEvaluation[] = [];

  // CAP-001 — projected consumption fits in available capacity
  const fitPassed = consumption <= headroom;
  rules.push({
    ruleId: 'CAP-001',
    description: 'Projected consumption ≤ available capacity',
    passed: fitPassed,
    testedValue: `£${consumption.toLocaleString()} vs £${headroom.toLocaleString()} headroom`,
  });

  // CAP-002 — capacity margin > 10% of cap
  const marginPassed = headroomPct >= LOW_HEADROOM_PCT;
  rules.push({
    ruleId: 'CAP-002',
    description: `Capacity headroom ≥ ${(LOW_HEADROOM_PCT * 100).toFixed(0)}% of cap`,
    passed: marginPassed,
    testedValue: `${(headroomPct * 100).toFixed(1)}%`,
  });

  const outcome = !fitPassed ? 'decline' : !marginPassed ? 'refer' : 'pass';

  const rationale = !fitPassed
    ? 'Projected consumption exceeds available capacity. Decline.'
    : !marginPassed
      ? 'Capacity headroom below margin threshold. Refer to senior.'
      : `£${(headroom / 1_000_000).toFixed(2)}M headroom on £${(ledger.annualAggregateCap / 1_000_000).toFixed(0)}M cap.`;

  return {
    outcome,
    rationale,
    rules,
    metadata: {
      ledger,
      headroom,
      headroomPct,
      consumedYTD: ledger.consumedYTD,
      annualCap: ledger.annualAggregateCap,
      estimatedPremium,
      thisSubmissionConsumption: consumption,
      linePct: LINE_PCT,
      baseRate: BASE_RATE,
    },
  };
}
