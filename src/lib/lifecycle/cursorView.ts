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

export type CursorViewKind = 'live' | 'bind-v1' | 'pre-bind' | 'mta-v2' | 'cancelled';

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
  /** Earliest committed MTA's signedAt, if any. */
  firstMtaSignedAt?: string | null;
  /** Cancellation committedAt, if any. */
  cancelledAt?: string | null;
  /** True when the policy is currently cancelled (now == 'cancel'). */
  cancelled?: boolean;
}): CursorView {
  const scrubbed = input.cursor !== input.now;

  // 'cancel' as the live cursor (now) means the policy is in its
  // terminal state. The full cancellation surface renders.
  if (!scrubbed) {
    if (input.cursor === 'cancel') return { kind: 'cancelled', scrubbed, effectiveAt: null };
    return { kind: 'live', scrubbed, effectiveAt: null };
  }

  // Scrubbed back to 'bind' with later events on the timeline →
  // reconstruct the v1 view. Filter "strictly before the first MTA
  // committed" (or before the cancellation if no MTA exists), so
  // bind-time cascade events still belong to v1 even if their `at`
  // is 1 ms after baseBindAt.
  if (input.cursor === 'bind' && (input.versionCount > 0 || input.cancelled)) {
    const upper = input.firstMtaSignedAt ?? input.cancelledAt ?? input.baseBindAt;
    return { kind: 'bind-v1', scrubbed, effectiveAt: upper ?? null };
  }

  // Scrubbed to 'mta-04' while now is 'cancel' → v2 reconstruction
  // (the MTA state, before cancellation).
  if (input.cursor === 'mta-04' && input.cancelled) {
    return { kind: 'mta-v2', scrubbed, effectiveAt: input.cancelledAt ?? null };
  }

  if (input.cursor === 'quote' || input.cursor === 'quoted') {
    return { kind: 'pre-bind', scrubbed, effectiveAt: null };
  }

  return { kind: 'live', scrubbed, effectiveAt: null };
}
