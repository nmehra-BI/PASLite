import type { LifecycleMilestone } from '@/lib/fixtures';
import { RibbonTooltip } from './RibbonTooltip';
import {
  MILESTONE_LABEL,
  formatMilestoneDateLong,
  viewingState,
} from './milestoneMeta';

/**
 * Hover tooltip for a single ribbon milestone. Contextual copy:
 *   - completed (before now)        → "View policy state at X"
 *   - current (now)                 → "Currently viewing: X"
 *   - future (after now)            → "Forecast view at X"
 */
export function MilestoneTooltip({
  visible,
  milestone,
  now,
  date,
}: {
  visible: boolean;
  milestone: LifecycleMilestone;
  now: LifecycleMilestone;
  date: string | null;
}) {
  const label = MILESTONE_LABEL[milestone];
  const state = viewingState(milestone, now);
  const headline =
    state === 'now'
      ? `Currently viewing: ${label}`
      : state === 'historical'
        ? `View policy state at ${label}`
        : `Forecast view at ${label}`;
  const dateLine = formatMilestoneDateLong(date);

  return (
    <RibbonTooltip visible={visible}>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
        }}
      >
        {headline}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--color-ink-mute)',
          letterSpacing: '0.04em',
          marginTop: 3,
        }}
      >
        {dateLine}
      </div>
    </RibbonTooltip>
  );
}
