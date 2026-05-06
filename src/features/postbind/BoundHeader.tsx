import { motion, AnimatePresence } from 'framer-motion';
import { Pill } from '@/components';
import { useRanBerri } from '@/store';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * The post-bind canvas header. Animates SUB-29481 → POL-29481 with a
 * strikethrough-then-fade transition; once committed, locks to
 * "Bound · in force" with the bound metadata.
 */
export function BoundHeader() {
  const submission = useRanBerri((s) => s.submission);
  const bind = useRanBerri((s) => s.bind);
  const quote = useRanBerri((s) => s.quote);

  if (!submission) return null;
  const subId = submission.id;
  const polRef = bind.policyRef ?? subId.replace(/^SUB-/, 'POL-');
  const isBound = bind.phase === 'committed';
  const premium = quote.slipPremium ?? 0;
  const committedAtLabel = bind.committedAt
    ? DATE_FMT.format(new Date(bind.committedAt))
    : null;

  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{
        height: 56,
        padding: '0 28px',
        background: 'var(--color-surface)',
        flex: '0 0 auto',
      }}
    >
      <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
        <div
          className="serif"
          style={{
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '-0.012em',
            color: 'var(--color-ink)',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isBound ? (
              <motion.span
                key="bound"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
                style={{ color: 'var(--color-ink)' }}
              >
                {polRef}
              </motion.span>
            ) : (
              <motion.span
                key="sub"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ position: 'relative' }}
              >
                {subId}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          {isBound
            ? `in force · 12 months · £${premium.toLocaleString('en-GB')}`
            : 'pending bind'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {committedAtLabel && isBound && (
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
            }}
          >
            bound {committedAtLabel}
          </span>
        )}
        <Pill tone={isBound ? 'success' : 'warn'} mono>
          {isBound ? 'BOUND · IN FORCE' : 'BIND PENDING'}
        </Pill>
      </div>
    </div>
  );
}
