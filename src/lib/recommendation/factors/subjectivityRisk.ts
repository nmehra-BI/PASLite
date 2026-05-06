import type { Submission } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import type { RecommendationFactor } from '../types';

/**
 * FCT-004 — Subjectivity risk.
 *
 * Looks at unresolved warranties and disclosure caveats. Material
 * warranties (e.g. permit expiring within term) trigger a soft signal
 * but don't block bind. Open disclosures with no resolution and no
 * broker-request marker push toward refer.
 */
export function evaluateSubjectivityRisk(
  submission: Submission,
  fireSuppressionResolved: boolean,
  fireSuppressionRequested: boolean,
  permitExpiresInTerm: { siteName: string; expiry: string; permitRef: string } | null,
): RecommendationFactor {
  const fs = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fsConfirmed = fs === true;

  const issues: string[] = [];
  if (!fsConfirmed && !fireSuppressionResolved && !fireSuppressionRequested) {
    issues.push('fire suppression unresolved');
  }
  if (permitExpiresInTerm) {
    issues.push(
      `permit ${permitExpiresInTerm.permitRef} (${permitExpiresInTerm.siteName}) expires within term`,
    );
  }

  const vote: RecommendationFactor['vote'] =
    issues.length === 0
      ? 'pro-bind'
      : issues.length === 1 && permitExpiresInTerm
        ? 'pro-bind'
        : 'pro-refer';

  const weight: RecommendationFactor['weight'] =
    issues.length === 0
      ? 'moderate'
      : issues.length === 1
        ? 'moderate'
        : 'high';

  const rationale =
    issues.length === 0
      ? 'No open subjectivities; warranty load manageable.'
      : permitExpiresInTerm && fsConfirmed
        ? 'Permit warranty manageable; fire suppression confirmed.'
        : `${issues.length} open subjectivity flag${issues.length === 1 ? '' : 's'}: ${issues.join('; ')}.`;

  return {
    id: 'FCT-004',
    label: 'Subjectivity risk',
    vote,
    weight,
    rationale,
    evidence: {},
    metadata: {
      fireSuppressionConfirmed: fsConfirmed,
      fireSuppressionRequested,
      permitExpiresInTerm,
      issues,
    },
  };
}
