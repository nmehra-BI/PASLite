import type { Submission, SourceResult } from '@/lib/fixtures';
import type { GapRecord } from '@/store/replay';
import { checkAppetite } from './checkAppetite';
import { checkCapacity } from './checkCapacity';
import { checkSanctions } from './checkSanctions';
import { checkSubjectivities } from './checkSubjectivities';
import type { CheckId, TriageResult, TriageVerdict } from './types';

export type TriageRunResult = {
  results: Record<CheckId, TriageResult>;
  verdict: TriageVerdict;
};

/**
 * Pure synchronous orchestrator. The cinematic engine in
 * src/features/triage/triage-engine.ts wraps this with delays + audit
 * events, but the rules themselves are deterministic and side-effect
 * free.
 */
export function runTriage(
  submission: Submission,
  sources: SourceResult[],
  gaps: GapRecord[],
): TriageRunResult {
  const results: Record<CheckId, TriageResult> = {
    appetite: checkAppetite(submission, sources),
    capacity: checkCapacity(submission),
    subjectivities: checkSubjectivities(submission, gaps),
    sanctions: checkSanctions(sources),
  };

  const outcomes = Object.values(results).map((r) => r.outcome);
  const verdict: TriageVerdict = outcomes.includes('decline')
    ? 'decline'
    : outcomes.includes('refer')
      ? 'refer'
      : 'pass';

  return { results, verdict };
}

/**
 * Apply per-check overrides on top of raw results to compute the
 * effective verdict.
 */
export function deriveVerdict(
  results: Record<CheckId, TriageResult>,
  overrides: Partial<Record<CheckId, { outcome: TriageResult['outcome'] }>>,
): TriageVerdict {
  const effectives = (Object.keys(results) as CheckId[]).map(
    (k) => overrides[k]?.outcome ?? results[k].outcome,
  );
  if (effectives.includes('decline')) return 'decline';
  if (effectives.includes('refer')) return 'refer';
  return 'pass';
}

export const CHECK_ORDER: CheckId[] = [
  'appetite',
  'capacity',
  'subjectivities',
  'sanctions',
];
