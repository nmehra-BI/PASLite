import { motion } from 'framer-motion';
import { formatGBP } from '@/lib/rating';

type Props = {
  premium: number | null;
  sha: string;
  version: string;
  tier: string;
  isCalculating: boolean;
};

export function RatingVerdict({
  premium,
  sha,
  version,
  tier,
  isCalculating,
}: Props) {
  return (
    <div
      className="hairline"
      style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
      }}
    >
      <div className="eyebrow" style={{ color: 'var(--color-ink-mute)' }}>
        verdict
      </div>
      <motion.div
        key={premium ?? 'pending'}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginTop: 8 }}
      >
        {isCalculating || premium === null ? (
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 16,
              color: 'var(--color-ink-mute)',
            }}
          >
            calculating&hellip;
          </div>
        ) : (
          <>
            <div
              className="serif"
              style={{
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: '-0.018em',
                color: 'var(--color-ink)',
                lineHeight: 1.05,
              }}
            >
              <span style={{ color: 'var(--color-accent)' }}>£</span>
              {(premium / 1000).toFixed(0)}
              <span
                style={{
                  fontSize: 22,
                  color: 'var(--color-ink-mute)',
                  letterSpacing: '-0.01em',
                }}
              >
                ,{premium.toString().slice(-3)}
              </span>
            </div>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--color-ink-mute)',
                marginTop: 2,
                letterSpacing: '-0.005em',
              }}
            >
              {formatGBP(premium)} / annum
            </div>
            <div
              className="serif"
              style={{
                fontSize: 12,
                color: 'var(--color-ink-soft)',
                marginTop: 8,
              }}
            >
              {tier} · 12-month term
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: 'var(--color-ink-faint)',
                letterSpacing: '0.06em',
                marginTop: 4,
              }}
            >
              technical price · sealed {version} · {sha}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
