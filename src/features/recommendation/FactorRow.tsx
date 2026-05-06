import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, CircleSlash, Loader2, X } from 'lucide-react';
import type { RecommendationFactorRecord } from '@/store/replay';
import { FactorDetailCard } from './FactorDetailCard';

type Props = {
  /** When `record` is undefined, the factor is in 'evaluating' state. */
  record: RecommendationFactorRecord | undefined;
  factorId: string;
  defaultLabel: string;
};

const VOTE_GLYPH = {
  'pro-bind': Check,
  'pro-ntu': X,
  'pro-refer': AlertTriangle,
  neutral: CircleSlash,
} as const;

const VOTE_COLOR = {
  'pro-bind': 'var(--color-success)',
  'pro-ntu': 'var(--color-danger)',
  'pro-refer': 'var(--color-warn)',
  neutral: 'var(--color-ink-mute)',
} as const;

const VOTE_LABEL = {
  'pro-bind': 'PRO-BIND',
  'pro-ntu': 'PRO-NTU',
  'pro-refer': 'PRO-REFER',
  neutral: 'NEUTRAL',
} as const;

const WEIGHT_LABEL = {
  high: 'high',
  moderate: 'mod',
  low: 'low',
} as const;

export function FactorRow({ record, factorId, defaultLabel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isEvaluating = !record;
  const Glyph = isEvaluating ? Loader2 : VOTE_GLYPH[record.vote];
  const glyphColor = isEvaluating ? 'var(--color-ink-faint)' : VOTE_COLOR[record.vote];

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
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-mute)',
            letterSpacing: '0.06em',
            width: 64,
          }}
        >
          {factorId}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
            width: 200,
          }}
        >
          {record?.label ?? defaultLabel}
        </span>
        <span
          style={{
            fontSize: 11.5,
            color: isEvaluating ? 'var(--color-ink-faint)' : VOTE_COLOR[record.vote],
            fontWeight: 500,
            letterSpacing: '0.04em',
            width: 90,
          }}
        >
          {isEvaluating ? '…' : VOTE_LABEL[record.vote]}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-mute)',
            letterSpacing: '0.06em',
            width: 36,
          }}
        >
          {isEvaluating ? '' : WEIGHT_LABEL[record.weight]}
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
            <FactorDetailCard record={record} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
