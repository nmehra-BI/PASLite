import type { Field } from '@/lib/field';
import { pathMatches } from '@/lib/paths';

/**
 * The five derived artifacts the cockpit tracks. Each artifact has a
 * `computedAt` timestamp in the store; the graph below tells us which
 * artifacts go stale when a given field is corrected.
 */
export type ArtifactKey =
  | 'enrichment'
  | 'conflicts'
  | 'triage'
  | 'rating'
  | 'quote'
  | 'recommendation';

export const ALL_ARTIFACTS: readonly ArtifactKey[] = [
  'enrichment',
  'conflicts',
  'triage',
  'rating',
  'quote',
  'recommendation',
] as const;

export type Dependency = {
  /**
   * Submission field paths this artifact reads from. Supports the
   * `[*]` wildcard for array elements.
   */
  sources: string[];
  /**
   * Other artifacts that consume this artifact's output. When this
   * artifact goes stale, every entry in `downstream` does too.
   */
  downstream: ArtifactKey[];
};

/**
 * The DAG.
 *
 *     ┌──── enrichment ───┐
 *     │         │         │
 *     ▼         ▼         │
 *  conflicts ── rating ── quote ── recommendation
 *
 *  - enrichment reads identity + address fields (Companies House etc.)
 *  - conflicts compares broker vs system layers across identity + key
 *    risk fields; downstream of enrichment because reconciliation uses
 *    enriched values
 *  - rating reads exposure fields; downstream of conflicts because the
 *    reconciled values are what feed the rating engine
 *  - quote reads cover terms + the rating output
 *  - recommendation reads the quote + historical binders; no direct
 *    field sources of its own
 */
export const DEPENDENCY_GRAPH: Record<ArtifactKey, Dependency> = {
  enrichment: {
    sources: [
      'insured.legalName',
      'insured.tradingName',
      'insured.companiesHouseNumber',
      'sites[*].name',
      'sites[*].permitRef',
    ],
    downstream: ['conflicts', 'triage', 'rating', 'quote', 'recommendation'],
  },
  conflicts: {
    sources: [
      'insured.legalName',
      'insured.tradingName',
      'insured.companiesHouseNumber',
      'insured.yearsTrading',
      'insured.turnover',
      'insured.turnoverPrior',
      'sites[*].name',
      'sites[*].permitRef',
      'sites[*].permitExpiry',
      'lossRuns',
      'statedLossRatio',
    ],
    downstream: ['triage', 'rating', 'quote', 'recommendation'],
  },
  triage: {
    /**
     * Appetite + capacity inputs. Any change to these requires
     * re-running the four checks against the current submission.
     */
    sources: [
      'insured.turnover',
      'insured.yearsTrading',
      'sites[*].name',
      'sites[*].sqm',
      'materials',
      'fireSuppressionDisclosed',
    ],
    downstream: ['rating', 'quote', 'recommendation'],
  },
  rating: {
    sources: [
      'insured.turnover',
      'insured.yearsTrading',
      'cover.publicLiabilityLimit',
      'cover.employersLiabilityLimit',
      'cover.environmentalImpairmentLimit',
      'sites[*].sqm',
      'materials',
      'fireSuppressionDisclosed',
      'lossRuns',
    ],
    downstream: ['quote', 'recommendation'],
  },
  quote: {
    sources: ['cover.inceptionDate', 'cover.expiryDate', 'cover.term'],
    downstream: ['recommendation'],
  },
  recommendation: {
    sources: ['brokerTargetPremium'],
    downstream: [],
  },
};

/**
 * Returns the artifact closure that becomes stale when the field at
 * `correctedPath` changes.
 *
 * Conservative fallback: if no artifact registers `correctedPath` as a
 * source, every artifact is invalidated. The graph is an
 * **optimisation**, not a safety boundary &mdash; an unregistered field
 * must never silently leave a stale figure trusted.
 */
export function affectedArtifacts(correctedPath: string): Set<ArtifactKey> {
  const direct = new Set<ArtifactKey>();
  for (const key of ALL_ARTIFACTS) {
    const dep = DEPENDENCY_GRAPH[key];
    if (dep.sources.some((s) => pathMatches(s, correctedPath))) {
      direct.add(key);
    }
  }
  if (direct.size === 0) {
    return new Set(ALL_ARTIFACTS);
  }
  return closure(direct);
}

/**
 * Transitive closure over the downstream edges, starting from `seeds`.
 */
export function closure(seeds: Iterable<ArtifactKey>): Set<ArtifactKey> {
  const visited = new Set<ArtifactKey>(seeds);
  const queue: ArtifactKey[] = [...visited];
  while (queue.length) {
    const k = queue.shift()!;
    for (const d of DEPENDENCY_GRAPH[k].downstream) {
      if (!visited.has(d)) {
        visited.add(d);
        queue.push(d);
      }
    }
  }
  return visited;
}

/**
 * Runtime predicate: does `value` look like a Field<T>?
 *
 * Used by `applyCorrection` to guard against being pointed at a
 * non-field path. Boundary validation only &mdash; internal callers
 * trust the type system.
 */
export function isField(value: unknown): value is Field<unknown> {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    'brokerStated' in v &&
    'systemExtracted' in v &&
    'underwriterCorrected' in v
  );
}
