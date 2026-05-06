import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, Loader2, XCircle } from 'lucide-react';
import type { TriageCheckRecord } from '@/store/replay';
import { CheckDetailCard } from './CheckDetailCard';

const CHECK_TITLE: Record<string, string> = {
  appetite: 'APPETITE',
  capacity: 'CAPACITY',
  subjectivities: 'SUBJECTIVITIES',
  sanctions: 'SANCTIONS',
};

type Props = {
  /** When `record` is undefined, the check is in the "evaluating" state. */
  record: TriageCheckRecord | undefined;
  /** ID for the row even before the record exists (during cinematic). */
  checkId: 'appetite' | 'capacity' | 'subjectivities' | 'sanctions';
  /** Read-only mode disables expand-to-override. */
  readOnly?: boolean;
};

/**
 * One check row. Collapsed by default; expands to a detail card on
 * click after the check has resolved.
 */
export function CheckRow({ record, checkId, readOnly = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isEvaluating = !record;
  // The row's primary glyph + status pill keep the ORIGINAL outcome
  // visible — provenance matters. The override appears as a separate
  // appendix to the right so both states are read at once.
  const original = record?.outcome ?? null;
  const overrideOutcome = record?.override?.outcome ?? null;
  const hasOverride = overrideOutcome !== null;
  const effective = overrideOutcome ?? original;
  const ruleIds = record?.ruleIds ?? [];

  const originalTone = toneFor(original);
  const effectiveTone = toneFor(effective);

  const Glyph = isEvaluating
    ? Loader2
    : original === 'pass'
      ? Check
      : original === 'refer'
        ? AlertTriangle
        : XCircle;

  const glyphColor = colorFor(originalTone);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: '0.5px solid var(--color-rule)',
      }}
    >
      <button
        type="button"
        onClick={() => record && setExpanded((e) => !e)}
        disabled={isEvaluating}
        className="flex items-baseline gap-3"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 4px',
          cursor: record ? 'pointer' : 'default',
          background: 'transparent',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, width: 14 }}>
          <Glyph
            size={isEvaluating ? 12 : 13}
            strokeWidth={isEvaluating ? 1.5 : 1.75}
            className={isEvaluating ? 'animate-spin' : ''}
            style={{ color: glyphColor }}
          />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
            width: 130,
          }}
        >
          {CHECK_TITLE[checkId] ?? checkId.toUpperCase()}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            width: 140,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: colorFor(originalTone, 'pill'),
              fontWeight: original ? 500 : 400,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              textDecoration: hasOverride ? 'line-through' : 'none',
              textDecorationColor: 'var(--color-ink-faint)',
              opacity: hasOverride ? 0.7 : 1,
            }}
          >
            {isEvaluating ? '…' : original ?? ''}
          </span>
          {hasOverride && overrideOutcome && (
            <>
              <span
                className="serif"
                style={{
                  fontStyle: 'italic',
                  fontSize: 11,
                  color: 'var(--color-accent)',
                  letterSpacing: '-0.005em',
                }}
              >
                overridden →
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: colorFor(effectiveTone, 'pill'),
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {overrideOutcome}
              </span>
            </>
          )}
        </span>
        <span
          className="serif"
          style={{
            flex: 1,
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            fontStyle: isEvaluating ? 'italic' : 'normal',
          }}
        >
          {isEvaluating ? 'evaluating…' : record?.rationale ?? ''}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          rule {ruleIds[0] ?? ''}
          {ruleIds.length > 1 ? `..${ruleIds[ruleIds.length - 1]!.slice(-3)}` : ''}
        </span>
        {record && (
          <ChevronRight
            size={11}
            strokeWidth={1.5}
            style={{
              color: 'var(--color-ink-faint)',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 200ms',
            }}
          />
        )}
      </button>
      <AnimatePresence>
        {expanded && record && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <CheckDetailCard record={record} readOnly={readOnly} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Tone = 'success' | 'warn' | 'danger' | 'neutral';

function toneFor(outcome: 'pass' | 'refer' | 'decline' | null): Tone {
  if (outcome === 'pass') return 'success';
  if (outcome === 'refer') return 'warn';
  if (outcome === 'decline') return 'danger';
  return 'neutral';
}

function colorFor(tone: Tone, kind: 'glyph' | 'pill' = 'glyph'): string {
  if (tone === 'success')
    return kind === 'pill' ? 'var(--color-ink)' : 'var(--color-success)';
  if (tone === 'warn') return 'var(--color-warn)';
  if (tone === 'danger') return 'var(--color-danger)';
  return kind === 'pill' ? 'var(--color-ink-mute)' : 'var(--color-ink-faint)';
}
