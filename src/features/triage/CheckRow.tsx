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
  const effective = record?.override?.outcome ?? record?.outcome ?? null;
  const ruleIds = record?.ruleIds ?? [];

  const tone =
    effective === 'pass'
      ? 'success'
      : effective === 'refer'
        ? 'warn'
        : effective === 'decline'
          ? 'danger'
          : 'neutral';

  const Glyph =
    isEvaluating
      ? Loader2
      : effective === 'pass'
        ? Check
        : effective === 'refer'
          ? AlertTriangle
          : XCircle;

  const glyphColor =
    tone === 'success'
      ? 'var(--color-success)'
      : tone === 'warn'
        ? 'var(--color-warn)'
        : tone === 'danger'
          ? 'var(--color-danger)'
          : 'var(--color-ink-faint)';

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
            fontSize: 12.5,
            color:
              tone === 'warn'
                ? 'var(--color-warn)'
                : tone === 'danger'
                  ? 'var(--color-danger)'
                  : tone === 'success'
                    ? 'var(--color-ink)'
                    : 'var(--color-ink-mute)',
            fontWeight: effective ? 500 : 400,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            width: 64,
          }}
        >
          {isEvaluating ? '…' : effective ?? ''}
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
          {record?.override && (
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                color: 'var(--color-accent)',
                marginLeft: 8,
              }}
            >
              · overridden → {record.override.outcome}
            </span>
          )}
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
