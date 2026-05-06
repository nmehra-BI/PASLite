import { motion } from 'framer-motion';
import { ConfidenceDot, SourceRef } from '@/components';
import {
  effectiveLayer,
  effectiveValue,
  type Field,
  type FieldLayer,
} from '@/lib/field';
import { useIntake } from './intakeStore';

type Props<T> = {
  /** Path on the submission tree, e.g. 'insured.turnover'. */
  path: string;
  field: Field<T>;
  /** Pretty value, optionally pre-formatted by the caller. */
  format?: (value: T) => string;
  /** Tone override (e.g. warn for the gap value). */
  tone?: 'default' | 'warn';
  /** Inline label shown to the left of the value. */
  inlineLabel?: string;
};

/**
 * Editorial render of a single Field<T>: value + confidence dot + source
 * citation on hover. Click anywhere to open the inspector.
 *
 * Marginalia: when the field carries an underwriter correction, a
 * small italic serif "corrected from <prior value>" appears beneath
 * the corrected value.
 */
export function FieldLine<T>({ path, field, format, tone = 'default', inlineLabel }: Props<T>) {
  const openInspector = useIntake((s) => s.openInspector);
  const isPulsing = useIntake((s) => s.pulsingFields.has(path));

  const layer: FieldLayer = effectiveLayer(field);
  const value = effectiveValue(field) as T | null;
  const rendered = formatValue(value, format);

  const confidence = field.systemExtracted?.confidence ?? null;
  const sourceRef = field.systemExtracted?.sourceRef ?? null;
  const corrected = field.underwriterCorrected;

  const valueColor =
    tone === 'warn' ? 'var(--color-warn)' : 'var(--color-ink)';

  return (
    <motion.button
      type="button"
      onClick={() => openInspector(path)}
      initial={{ opacity: 0, y: 4 }}
      animate={
        isPulsing
          ? {
              opacity: 1,
              y: 0,
              backgroundColor: [
                'rgba(0,0,0,0)',
                'rgba(140, 90, 20, 0.18)',
                'rgba(0,0,0,0)',
              ],
            }
          : { opacity: 1, y: 0 }
      }
      transition={{ duration: isPulsing ? 0.7 : 0.28, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        padding: '5px 8px',
        margin: '0 -8px',
        borderRadius: 'var(--radius-button)',
        background:
          tone === 'warn' && !isPulsing ? 'var(--color-warn-bg)' : 'transparent',
        cursor: 'pointer',
        position: 'relative',
        borderBottom: corrected
          ? '0.5px solid var(--color-accent)'
          : '0.5px solid transparent',
      }}
      whileHover={{ backgroundColor: 'rgba(31, 30, 29, 0.03)' }}
    >
      {inlineLabel && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--color-ink-faint)',
            minWidth: 56,
          }}
        >
          {inlineLabel}
        </span>
      )}
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          className="serif"
          style={{
            fontSize: 14.5,
            color: valueColor,
            letterSpacing: '-0.005em',
          }}
        >
          {rendered}
        </span>
        {corrected && (
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11.5,
              color: 'var(--color-ink-mute)',
            }}
          >
            corrected from {formatValue(field.systemExtracted?.value ?? field.brokerStated, format)}
          </span>
        )}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {layer === 'underwriter' && (
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              color: 'var(--color-accent)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            uw
          </span>
        )}
        {confidence !== null && <ConfidenceDot confidence={confidence} />}
        {sourceRef && (
          <SourceRef
            sourceRef={sourceRef}
            modelVersion={field.systemExtracted?.modelVersion}
            extractedAt={field.systemExtracted?.extractedAt}
          />
        )}
      </span>
    </motion.button>
  );
}

function formatValue<T>(value: T | null | undefined, format?: (v: T) => string): string {
  if (value === null || value === undefined) return '—';
  if (format) return format(value as T);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
