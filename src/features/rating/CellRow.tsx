import { motion } from 'framer-motion';
import type { CellReplayRecord } from '@/store/replay';
import { formatGBP, formatGBPSigned, formatPercent } from '@/lib/rating';

type Props = {
  cell: CellReplayRecord;
  onOpen: (ref: string) => void;
  isFinal?: boolean;
};

function formatValue(c: CellReplayRecord): string {
  if (c.format === 'percent') return formatPercent(c.value, 2);
  if (c.format === 'multiplier') return `${c.value.toFixed(3)}x`;
  if (c.op === '+' || c.op === '−') return formatGBPSigned(c.value);
  return formatGBP(c.value);
}

export function CellRow({ cell, onOpen, isFinal = false }: Props) {
  const valueText = formatValue(cell);
  const subtotalText =
    cell.subtotalAfter !== null && cell.format === 'currency' && !isFinal
      ? formatGBP(cell.subtotalAfter)
      : null;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(cell.ref)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ backgroundColor: 'rgba(31, 30, 29, 0.03)' }}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 100px 100px',
        gap: 14,
        alignItems: 'baseline',
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        margin: '0 -8px',
        borderRadius: 'var(--radius-button)',
        cursor: 'pointer',
        background: 'transparent',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: isFinal ? 'var(--color-accent)' : 'var(--color-ink-mute)',
          letterSpacing: '0.06em',
          fontWeight: isFinal ? 500 : 400,
        }}
      >
        {cell.ref}
      </span>
      <span
        className="mono"
        style={{
          fontSize: isFinal ? 13 : 12.5,
          color: isFinal ? 'var(--color-ink)' : 'var(--color-ink-soft)',
          fontWeight: isFinal ? 500 : 400,
          letterSpacing: '0.005em',
        }}
      >
        {cell.label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: isFinal ? 14 : 12.5,
          color: isFinal ? 'var(--color-accent)' : 'var(--color-ink)',
          fontWeight: isFinal ? 500 : 400,
          letterSpacing: '0.005em',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valueText}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--color-ink-faint)',
          textAlign: 'right',
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {subtotalText ?? ''}
      </span>
    </motion.button>
  );
}
