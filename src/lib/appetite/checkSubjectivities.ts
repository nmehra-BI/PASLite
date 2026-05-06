import type { Submission } from '@/lib/fixtures';
import type { GapRecord } from '@/store/replay';
import type { TriageResult, RuleEvaluation } from './types';

/**
 * SUB-001 — Required disclosures must be present, resolved, or
 * pending broker response. The fire-suppression gap from module 3 is
 * the canonical example.
 */
export function checkSubjectivities(
  _submission: Submission,
  gaps: GapRecord[],
): TriageResult {
  const rules: RuleEvaluation[] = [];

  const activeUnresolved = gaps.filter(
    (g) => !g.dismissed && !g.resolution && !g.requestSent,
  );

  // SUB-001 — every gap is resolved or queued
  rules.push({
    ruleId: 'SUB-001',
    description: 'All required disclosures resolved or queued',
    passed: activeUnresolved.length === 0,
    testedValue:
      activeUnresolved.length === 0
        ? 'all addressed'
        : `${activeUnresolved.length} unresolved`,
  });

  // SUB-002 — fire suppression specific (informational metadata)
  const fireGap = gaps.find((g) => g.fieldPath === 'fireSuppressionDisclosed');
  const fireResolved =
    fireGap?.resolution !== null && fireGap?.resolution !== undefined;
  const fireRequested = !!fireGap?.requestSent;
  const fireOk =
    fireGap === undefined || fireGap.dismissed || fireResolved || fireRequested;
  rules.push({
    ruleId: 'SUB-002',
    description: 'Fire suppression disclosure addressed',
    passed: fireOk,
    testedValue: fireGap?.resolution
      ? `resolved as ${fireGap.resolution.choice}`
      : fireGap?.requestSent
        ? `request queued to ${fireGap.requestSent.recipient}`
        : fireGap?.dismissed
          ? 'no longer required'
          : fireGap
            ? 'unresolved'
            : 'no gap',
  });

  const allPassed = rules.every((r) => r.passed);
  const outcome = allPassed ? 'pass' : 'refer';

  const rationale = allPassed
    ? fireRequested
      ? 'Subjectivities addressed. Rate with assumption; revise on broker response.'
      : 'All required disclosures resolved.'
    : `${activeUnresolved.length} disclosure(s) unresolved. Refer to senior.`;

  return {
    outcome,
    rationale,
    rules,
    metadata: { activeUnresolvedCount: activeUnresolved.length, fireRequested },
  };
}
