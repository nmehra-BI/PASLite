import type { Submission } from '@/lib/fixtures';
import type { SourceResult, CompaniesHousePayload } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';

/**
 * A conflict is two sources disagreeing about the value of a single
 * Field<T>. The detector compares the submission's effective value
 * against each external source's payload.
 *
 * Module 3 only models cross-source conflicts. Self-conflicts (broker
 * doc disagreeing with itself) and temporal conflicts (broker data
 * stale) are out of scope per the design principle &mdash;
 * collapsing all three into one UI loses the cognitive win.
 */

export type DetectedConflict = {
  /** Stable id used by resolve events to point back to the detection. */
  id: string;
  fieldPath: string;
  brokerValue: unknown;
  brokerSourceRef: string;
  externalSource: string;
  externalValue: unknown;
  externalSourceRef: string;
  /** Italic-serif marginalia explaining the likely cause. */
  marginalia: string;
};

export function detectConflicts(
  submission: Submission,
  sources: SourceResult[],
): DetectedConflict[] {
  const out: DetectedConflict[] = [];

  const ch = sources.find((s) => s.id === 'companies-house');
  if (ch) {
    const payload = ch.payload as CompaniesHousePayload;
    const brokerTurnover = effectiveValue(submission.insured.turnover) as number | null;
    const filedTurnover = payload.latestFiling.turnover;
    if (
      brokerTurnover !== null &&
      typeof brokerTurnover === 'number' &&
      brokerTurnover !== filedTurnover
    ) {
      out.push({
        id: 'conflict_turnover',
        fieldPath: 'insured.turnover',
        brokerValue: brokerTurnover,
        brokerSourceRef:
          submission.insured.turnover.systemExtracted?.sourceRef ?? '',
        externalSource: 'companies-house',
        externalValue: filedTurnover,
        externalSourceRef: `CH:filing:${payload.latestFiling.fyEnding} · filed ${payload.latestFiling.filedAt}`,
        marginalia:
          'Broker may be quoting most recent management accounts (FY24). Filed accounts at CH are FY23 — FY24 not yet filed. Common timing mismatch.',
      });
    }
  }

  return out;
}
