import { motion } from 'framer-motion';

type Props = {
  confidence: number;
  /** Animate in on mount with a slight overshoot. */
  animate?: boolean;
  size?: number;
};

/**
 * Tone thresholds:
 *   ≥ 0.95  success
 *   ≥ 0.85  warn
 *   < 0.85  danger
 */
function tone(c: number): { fg: string; label: string } {
  if (c >= 0.95) return { fg: 'var(--color-success)', label: 'high' };
  if (c >= 0.85) return { fg: 'var(--color-warn)', label: 'medium' };
  return { fg: 'var(--color-danger)', label: 'low' };
}

export function ConfidenceDot({ confidence, animate = false, size = 5 }: Props) {
  const t = tone(confidence);
  const dot = (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: t.fg,
        verticalAlign: 'middle',
      }}
      aria-hidden
    />
  );
  if (animate) {
    return (
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.05, 1], opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1], times: [0, 0.7, 1] }}
        style={{ display: 'inline-block', lineHeight: 0 }}
        title={`Confidence ${(confidence * 100).toFixed(0)}% (${t.label})`}
      >
        {dot}
      </motion.span>
    );
  }
  return (
    <span
      style={{ display: 'inline-block', lineHeight: 0 }}
      title={`Confidence ${(confidence * 100).toFixed(0)}% (${t.label})`}
    >
      {dot}
    </span>
  );
}
