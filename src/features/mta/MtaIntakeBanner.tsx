import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useRanBerri } from '@/store';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * "MTA REQUEST · POL-29481 · effective 1 Aug 2026"
 *
 * Hairline border, ink-mute color — routine business, not warn /
 * danger. Renders for the entire MTA workflow until commit.
 */
export function MtaIntakeBanner() {
  const mta = useRanBerri((s) => s.mta);
  const bind = useRanBerri((s) => s.bind);

  if (!mta.request) return null;
  if (mta.phase === 'idle') return null;
  if (mta.phase === 'committed' || mta.phase === 'sent') return null;

  const policyRef = bind.policyRef ?? mta.request.policyRef;
  const effectiveLabel = DATE_FMT.format(new Date(mta.request.effectiveDate));
  const receivedLabel = TIME_FMT.format(new Date(mta.request.receivedAt));

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-b"
      style={{
        background: 'var(--color-surface)',
        padding: '10px 22px',
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
        <Mail
          size={11}
          strokeWidth={1.5}
          style={{ color: 'var(--color-ink-mute)', position: 'relative', top: 1 }}
        />
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-mute)',
          }}
        >
          mta request
        </span>
        <span
          className="serif"
          style={{
            fontSize: 13,
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
          }}
        >
          {policyRef}
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
          · effective {effectiveLabel}
        </span>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'var(--color-ink-faint)',
          letterSpacing: '0.06em',
        }}
      >
        from: {mta.request.brokerName} · received {receivedLabel}
      </span>
    </motion.div>
  );
}
