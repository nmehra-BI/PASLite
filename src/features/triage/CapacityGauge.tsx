import { motion } from 'framer-motion';

type Props = {
  /** £ consumed YTD. */
  consumed: number;
  /** £ total annual aggregate cap. */
  cap: number;
  /** £ this submission's projected consumption. */
  thisSubmission: number;
};

const fmtM = (n: number) =>
  n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}M` : `£${n.toLocaleString()}`;

/**
 * Horizontal capacity-utilisation gauge. Filled portion is consumed
 * YTD; the projected consumption from this submission renders as a
 * thin coral marker only if it would push past 90% of cap.
 */
export function CapacityGauge({ consumed, cap, thisSubmission }: Props) {
  const consumedPct = Math.min(1, consumed / cap);
  const projectedConsumed = consumed + thisSubmission;
  const showProjection = projectedConsumed / cap >= 0.9;
  const projectedPct = Math.min(1, projectedConsumed / cap);
  const headroom = cap - consumed;
  const headroomPct = (headroom / cap) * 100;

  return (
    <div style={{ marginTop: 12 }}>
      <div
        className="hairline"
        style={{
          position: 'relative',
          width: '100%',
          height: 12,
          borderRadius: 'var(--radius-button)',
          background: 'var(--color-bg)',
          overflow: 'hidden',
        }}
        aria-label={`Capacity utilisation ${(consumedPct * 100).toFixed(1)}%`}
      >
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${consumedPct * 100}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%',
            background: 'var(--color-ink-soft)',
          }}
        />
        {showProjection && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${projectedPct * 100}%`,
              top: 0,
              bottom: 0,
              width: 1.5,
              background: 'var(--color-accent)',
            }}
          />
        )}
      </div>
      <div
        className="flex items-baseline justify-between"
        style={{ marginTop: 6 }}
      >
        <span
          className="serif"
          style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}
        >
          {fmtM(consumed)} of {fmtM(cap)} consumed
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--color-ink-mute)',
          }}
        >
          {fmtM(headroom)} headroom · {headroomPct.toFixed(1)}%
        </span>
      </div>
      <div
        className="serif"
        style={{
          marginTop: 4,
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-mute)',
        }}
      >
        This submission would consume ~{fmtM(thisSubmission)} (65% line on est. premium).
      </div>
    </div>
  );
}
