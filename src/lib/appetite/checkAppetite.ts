import type { Submission } from '@/lib/fixtures';
import type { SourceResult, CompaniesHousePayload } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import { getActiveConfig } from '@/config';
import type { TriageResult, RuleEvaluation } from './types';

/** Bands and excluded materials are sourced from the active tenant
 *  config so a future tenant's appetite is changeable without code
 *  edits. The check predicates (rule logic) stay in code; the
 *  numerical bands and the excluded-material list are content. */
function readBands() {
  const cfg = getActiveConfig().appetite;
  return {
    turnoverMin: cfg.conditions.minTurnover ?? 1_000_000,
    turnoverMax: cfg.conditions.maxTurnover ?? 25_000_000,
    siteMin: cfg.conditions.minSites ?? 1,
    siteMax: cfg.conditions.maxSites ?? 5,
    excludedMaterials: cfg.materialClassesExcluded.map((m) => m.toLowerCase()),
  };
}

/**
 * APP-001..006 — bound underwriting authority for UK W&R Tier-2.
 *
 * Note: APP-001 (LOB) and APP-002 (jurisdiction) are static for this
 * MGA's product line — they're encoded as always-pass for the demo
 * but kept explicit so the audit trail is complete.
 */
export function checkAppetite(
  submission: Submission,
  sources: SourceResult[],
): TriageResult {
  const rules: RuleEvaluation[] = [];
  const bands = readBands();

  // APP-001 — Line of business
  rules.push({
    ruleId: 'APP-001',
    description: 'Line of business: UK waste & recycling',
    passed: true,
    testedValue: 'UK waste & recycling',
  });

  // APP-002 — Jurisdiction
  rules.push({
    ruleId: 'APP-002',
    description: 'Jurisdiction: GB',
    passed: true,
    testedValue: 'GB',
  });

  // APP-003 — Turnover band
  const turnover = effectiveValue(submission.insured.turnover) as
    | number
    | null;
  const turnoverPassed =
    turnover !== null && turnover >= bands.turnoverMin && turnover <= bands.turnoverMax;
  rules.push({
    ruleId: 'APP-003',
    description: `Turnover ∈ [£${bands.turnoverMin.toLocaleString()}, £${bands.turnoverMax.toLocaleString()}]`,
    passed: turnoverPassed,
    testedValue: turnover === null ? '—' : `£${turnover.toLocaleString()}`,
  });

  // APP-004 — Site count band
  const siteCount = submission.sites.length;
  const sitesPassed = siteCount >= bands.siteMin && siteCount <= bands.siteMax;
  rules.push({
    ruleId: 'APP-004',
    description: `Site count ∈ [${bands.siteMin}, ${bands.siteMax}]`,
    passed: sitesPassed,
    testedValue: String(siteCount),
  });

  // APP-005 — Excluded materials
  const materials = (effectiveValue(submission.materials) as string[] | null) ?? [];
  const lowerMaterials = materials.map((m) => m.toLowerCase());
  const hit = bands.excludedMaterials.find((bad) =>
    lowerMaterials.some((m) => m.includes(bad)),
  );
  rules.push({
    ruleId: 'APP-005',
    description: 'Materials must not include excluded classes',
    passed: !hit,
    testedValue: materials.length > 0 ? materials.join(', ') : '—',
  });

  // APP-006 — Companies House status
  const ch = sources.find((s) => s.id === 'companies-house');
  const chStatus = ch ? (ch.payload as CompaniesHousePayload).status : null;
  const statusPassed = chStatus === 'active';
  rules.push({
    ruleId: 'APP-006',
    description: 'Insured status at Companies House: active',
    passed: statusPassed,
    testedValue: chStatus ?? '—',
  });

  const passedCount = rules.filter((r) => r.passed).length;
  const allPassed = passedCount === rules.length;

  // APP-005 (excluded materials) is a hard decline; everything else
  // is a refer when violated.
  const declined = !rules.find((r) => r.ruleId === 'APP-005')!.passed;

  const outcome = allPassed ? 'pass' : declined ? 'decline' : 'refer';

  const rationale = allPassed
    ? `${passedCount} of ${rules.length} rules met.`
    : declined
      ? `Excluded material class detected (${hit ?? 'unknown'}). Decline by rule APP-005.`
      : `${passedCount} of ${rules.length} rules met. Refer to senior.`;

  return {
    outcome,
    rationale,
    rules,
    metadata: { passedCount, totalRules: rules.length },
  };
}
