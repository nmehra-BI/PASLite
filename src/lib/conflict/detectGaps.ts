import type { Submission } from '@/lib/fixtures';

/**
 * A gap is a missing-but-required field. Module 2's extraction already
 * flags fireSuppressionDisclosed via a `gap.flagged` event; module 3's
 * detector simply enumerates the current gaps from the submission tree
 * itself (a Field whose brokerStated is null and whose systemExtracted
 * is an inferred fallback rather than an extracted value).
 */

export type DetectedGap = {
  id: string;
  fieldPath: string;
  description: string;
};

export function detectGaps(submission: Submission): DetectedGap[] {
  const gaps: DetectedGap[] = [];

  // Fire suppression: broker did not state, system inferred.
  const fs = submission.fireSuppressionDisclosed;
  if (fs.brokerStated === null) {
    gaps.push({
      id: 'gap_fireSuppression',
      fieldPath: 'fireSuppressionDisclosed',
      description: 'Fire suppression not disclosed on the slip.',
    });
  }

  return gaps;
}
