import { motion } from 'framer-motion';
import { useRanBerri, type RanBerriState } from '@/store';
import {
  MILESTONE_LABEL,
  formatMilestoneDateLong,
  milestoneDate,
  viewingState,
} from './milestoneMeta';

/**
 * Status bar that lives directly below the lifecycle ribbon. Always
 * visible; tells the user exactly which state the canvas is showing.
 *
 *   ● VIEWING NOW · 9 May 2026 · POL-29481 in force
 *   ◐ VIEWING HISTORICAL STATE · 9 May 09:14 · at Quote stage      [Return to now →]
 *   ◯ VIEWING FORECAST · 8 May 2027 · at Renewal stage             [Return to now →]
 */
export function RibbonStatusBar() {
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const scrub = useRanBerri((s) => s.scrubLifecycle);
  const fullState = useRanBerri();

  const state = viewingState(cursor, now);
  const cursorDate = milestoneDate(cursor, fullState);
  const nowDate = milestoneDate(now, fullState);

  const cursorLabel = MILESTONE_LABEL[cursor];

  const eyebrowGlyph =
    state === 'now' ? '●' : state === 'historical' ? '◐' : '◯';
  const eyebrowText =
    state === 'now'
      ? 'VIEWING NOW'
      : state === 'historical'
        ? 'VIEWING HISTORICAL STATE'
        : 'VIEWING FORECAST';
  const eyebrowColor =
    state === 'now'
      ? 'var(--color-ink-mute)'
      : state === 'historical'
        ? 'var(--color-warn)'
        : 'var(--color-info)';

  const summary =
    state === 'now'
      ? `${formatMilestoneDateLong(nowDate)} · ${policyHeadline(fullState)}`
      : `${formatMilestoneDateLong(cursorDate)} · at ${cursorLabel} stage`;

  return (
    <div
      className="hairline-t"
      style={{
        background: '#FBF7EF',
        padding: '8px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flex: '0 0 auto',
        position: 'sticky',
        top: 0,
        zIndex: 3,
        minHeight: 36,
      }}
    >
      <motion.div
        className="flex items-baseline gap-3"
        layout
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        style={{ minWidth: 0 }}
      >
        <span
          aria-hidden
          style={{
            color: eyebrowColor,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          {eyebrowGlyph}
        </span>
        <motion.span
          key={eyebrowText}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: eyebrowColor,
            fontWeight: 500,
          }}
        >
          {eyebrowText}
        </motion.span>
        <motion.span
          key={summary}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-soft)',
            letterSpacing: '-0.005em',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary}
        </motion.span>
      </motion.div>
      {state !== 'now' && (
        <button
          type="button"
          onClick={() => scrub(now)}
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-accent)',
            padding: '4px 14px',
            borderRadius: 'var(--radius-button)',
            border: '0.5px solid var(--color-accent)',
            background: 'transparent',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
            flex: '0 0 auto',
          }}
        >
          Return to now →
        </button>
      )}
    </div>
  );
}

function policyHeadline(s: RanBerriState): string {
  const renewedRef = s.renewal.successorPolicyRef;
  if (
    renewedRef &&
    (s.renewal.phase === 'committed' || s.renewal.phase === 'sent')
  ) {
    return `${renewedRef} in force · year 2`;
  }
  if (
    s.cancellation.phase === 'committed' ||
    s.cancellation.phase === 'sent'
  ) {
    return `${s.bind.policyRef ?? '—'} cancelled`;
  }
  if (s.bind.phase === 'committed' && s.bind.policyRef) {
    return `${s.bind.policyRef} in force`;
  }
  if (s.submission) {
    return `${s.submission.id} pre-bind`;
  }
  return 'no submission active';
}
