import type { SourceResult, SanctionsPayload } from '@/lib/fixtures';
import type { TriageResult, RuleEvaluation } from './types';

/**
 * SAN-001 — Bound authority does not permit binding sanctioned
 * entities. Direct hit ⇒ decline. Partial match ⇒ refer (compliance
 * review). All clean ⇒ pass.
 */
export function checkSanctions(sources: SourceResult[]): TriageResult {
  const rules: RuleEvaluation[] = [];

  const exp = sources.find((s) => s.id === 'experian-sanctions');
  if (!exp) {
    rules.push({
      ruleId: 'SAN-001',
      description: 'Sanctions screening result available',
      passed: false,
      testedValue: 'no screening data',
    });
    return {
      outcome: 'refer',
      rationale: 'No sanctions screening data; refer for review.',
      rules,
    };
  }

  const payload = exp.payload as SanctionsPayload;
  const hits = payload.lists.filter((l) => l.verdict === 'hit');
  const partials = payload.lists.filter((l) => l.verdict === 'partial-match');

  rules.push({
    ruleId: 'SAN-001',
    description: 'No direct hits across sanctions lists',
    passed: hits.length === 0,
    testedValue:
      hits.length === 0
        ? `clean across ${payload.lists.length} lists`
        : `${hits.length} hit(s)`,
  });

  rules.push({
    ruleId: 'SAN-002',
    description: 'No partial matches requiring compliance review',
    passed: partials.length === 0,
    testedValue:
      partials.length === 0 ? 'none' : `${partials.length} partial`,
  });

  const outcome =
    hits.length > 0 ? 'decline' : partials.length > 0 ? 'refer' : 'pass';

  const rationale =
    hits.length > 0
      ? 'Direct hit on sanctions list. Decline by rule SAN-001.'
      : partials.length > 0
        ? `${partials.length} partial match(es). Refer to compliance.`
        : `Clean across ${payload.lists.length} lists.`;

  return {
    outcome,
    rationale,
    rules,
    metadata: {
      lists: payload.lists,
      refreshedAt: payload.refreshedAt,
    },
  };
}
