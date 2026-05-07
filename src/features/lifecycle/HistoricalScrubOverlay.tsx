import { motion, AnimatePresence } from 'framer-motion';
import { useRanBerri } from '@/store';
import { getMilestoneLabel } from './milestoneMeta';

/**
 * Historical-scrub treatment for the canvas.
 *
 * When `cursor !== now`, the canvas is "viewing the past". We apply a
 * sepia + grayscale CSS filter to the canvas region (via a parent-
 * level `data-scrubbed` attribute the wrapper consumes) and overlay
 * a slim "viewing historical state" banner with a "return to now"
 * affordance. This is honest about what's shown — the canvas content
 * is still the live state, just visually de-saturated to signal
 * "you've scrubbed off-now". Full state replay (re-rendering each
 * section as it was at the cursor's milestone) is post-MVP.
 */
export function HistoricalScrubOverlay() {
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const scrub = useRanBerri((s) => s.scrubLifecycle);
  const fullState = useRanBerri();
  const scrubbed = cursor !== now;
  const cursorLabel = getMilestoneLabel(cursor, fullState);

  return (
    <AnimatePresence>
      {scrubbed && (
        <motion.div
          key="scrub-banner"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="hairline-b"
          style={{
            position: 'relative',
            zIndex: 5,
            padding: '8px 22px',
            background: 'rgba(166, 113, 67, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flex: '0 0 auto',
          }}
        >
          <div className="flex items-baseline gap-3">
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
              }}
            >
              viewing historical state
            </span>
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-ink-mute)',
                letterSpacing: '-0.005em',
              }}
            >
              scrubbed to {cursorLabel} · canvas tinted to
              indicate you&rsquo;re off-now
            </span>
          </div>
          <button
            type="button"
            onClick={() => scrub(now)}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-accent)',
              padding: '2px 10px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-accent)',
              background: 'transparent',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            Return to now →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
