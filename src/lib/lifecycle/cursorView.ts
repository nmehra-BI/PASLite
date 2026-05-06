/**
 * Derive the historical view-state for a given lifecycle cursor.
 *
 * The lifecycle ribbon is the cockpit's time-travel surface: scrubbing
 * back to a prior milestone shows the policy as it was at that point.
 * For MVP this folds into three view kinds:
 *
 *   - 'live'     — cursor at the 'now' milestone; show full live state.
 *   - 'bind-v1'  — cursor at 'bind' AND ≥1 MTA committed; show v1
 *                  (no MTA workflow, no MTA-derived subjectivities,
 *                  bound premium in the identity strip).
 *   - 'pre-bind' — cursor at 'quote' / 'quoted' before bind; the
 *                  canvas's bound surface is hidden (decisioning view).
 *
 * The derivation reads only `cursor + now + policy.baseBindAt +
 * policy.versions.length` so it's cheap to call from anywhere.
 */

import type { LifecycleMilestone } from '@/lib/fixtures';

export type CursorViewKind = 'live' | 'bind-v1' | 'pre-bind';

export type CursorView = {
  kind: CursorViewKind;
  /** True when the cursor is off-now (sepia overlay applies). */
  scrubbed: boolean;
  /**
   * For filtering subjectivities: only records created at-or-before
   * this ISO are shown when the cursor is in a historical view.
   * Null means "no filter" (live view).
   */
  effectiveAt: string | null;
};

export function deriveCursorView(input: {
  cursor: LifecycleMilestone;
  now: LifecycleMilestone;
  baseBindAt: string | null;
  versionCount: number;
  /** Earliest committed MTA's signedAt, if any. Used as the upper
   *  bound for "v1" subjectivity filtering: anything created before
   *  the first MTA committed belongs to the bound state. */
  firstMtaSignedAt?: string | null;
}): CursorView {
  const scrubbed = input.cursor !== input.now;
  if (!scrubbed) return { kind: 'live', scrubbed, effectiveAt: null };
  if (input.cursor === 'bind' && input.versionCount > 0) {
    return {
      kind: 'bind-v1',
      scrubbed,
      // Filter is "strictly before the first MTA committed". This
      // avoids the 1-ms-cascade timestamp issue where bind-time
      // subjectivity.created events have an at slightly after
      // baseBindAt yet still belong to v1.
      effectiveAt: input.firstMtaSignedAt ?? input.baseBindAt,
    };
  }
  if (input.cursor === 'quote' || input.cursor === 'quoted') {
    return { kind: 'pre-bind', scrubbed, effectiveAt: null };
  }
  return { kind: 'live', scrubbed, effectiveAt: null };
}
