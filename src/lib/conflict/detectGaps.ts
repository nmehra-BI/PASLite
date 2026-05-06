import type { Submission } from '@/lib/fixtures';

/**
 * A gap is a missing-but-required field. The detector returns
 * **structural** gaps from the submission tree only: a Field whose
 * brokerStated is null AND whose underwriterCorrected is null.
 *
 * Once an underwriter has resolved a gap as `present` or `absent`,
 * the underwriter layer is populated and the gap is no longer
 * structural — detectGaps stops reporting it. The engine then emits
 * `gap.dismissed` so the materialised gap record gets cleared from
 * the active list.
 *
 * The `request` resolution is special: it doesn't populate the
 * underwriter layer (the field stays unknown), so detectGaps still
 * reports it. The engine filters those out by checking against the
 * existing gap.resolved events in the audit-derived state.
 */

export type DetectedGap = {
  id: string;
  fieldPath: string;
  description: string;
};

export function detectGaps(submission: Submission): DetectedGap[] {
  const gaps: DetectedGap[] = [];

  const fs = submission.fireSuppressionDisclosed;
  if (fs.brokerStated === null && fs.underwriterCorrected === null) {
    gaps.push({
      id: 'gap_fireSuppression',
      fieldPath: 'fireSuppressionDisclosed',
      description: 'Fire suppression not disclosed on the slip.',
    });
  }

  return gaps;
}
