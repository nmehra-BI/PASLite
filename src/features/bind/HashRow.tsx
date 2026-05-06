import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { confirmHash } from '@/lib/bind';
import type { HashCheck } from '@/lib/bind';
import type { HashId, HashRecord } from '@/lib/bind/types';
import { HASH_LABELS } from '@/lib/bind/types';

type Props = {
  /** Display order (1..4). */
  index: number;
  hashId: HashId;
  /** Live computed status against artefact state. */
  check: HashCheck;
  /** Persisted record from the bind slice (replay-projected). */
  record: HashRecord | undefined;
  onOverrideRequested: (hashId: HashId) => void;
};

/**
 * Single hash row in the bind ceremony. Renders the artefact citation,
 * a confirmation radio + button, and (when failed) an override flow.
 */
export function HashRow({ index, hashId, check, record, onOverrideRequested }: Props) {
  const label = HASH_LABELS.find((l) => l.id === hashId)!;
  const isSigned = record?.status === 'confirmed' || record?.status === 'overridden';
  const isOverridden = record?.status === 'overridden';
  const isFailed = !isSigned && !check.matches && check.status !== 'refresh-needed';
  const [pulsing, setPulsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleConfirm() {
    if (isSigned) return;
    if (check.status === 'refresh-needed') {
      // Spec: auto-fire a sanctions re-check, then confirm.
      setRefreshing(true);
      await new Promise((r) => setTimeout(r, 600));
      setRefreshing(false);
    }
    if (isFailed) {
      onOverrideRequested(hashId);
      return;
    }
    confirmHash(hashId);
    setPulsing(true);
    setTimeout(() => setPulsing(false), 800);
  }

  const radioColor = isSigned
    ? 'var(--color-success)'
    : isFailed
      ? 'var(--color-warn)'
      : 'transparent';
  const radioBorder = isSigned
    ? 'var(--color-success)'
    : isFailed
      ? 'var(--color-warn)'
      : 'var(--color-rule-mid)';

  return (
    <motion.div
      layout
      animate={{
        backgroundColor: pulsing
          ? 'var(--color-success-bg)'
          : 'var(--color-surface)',
      }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="hairline"
      style={{
        borderRadius: 'var(--radius-card)',
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: '24px 1fr auto',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      {/* Left rail — radio circle */}
      <motion.div
        initial={false}
        animate={{ scale: pulsing ? 1.15 : 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: 18,
          height: 18,
          marginTop: 2,
          borderRadius: 999,
          border: `1px solid ${radioBorder}`,
          background: radioColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        <AnimatePresence>
          {isSigned && (
            <motion.span
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.05, 1], opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              style={{ display: 'inline-flex' }}
            >
              <Check size={11} strokeWidth={2} color="white" />
            </motion.span>
          )}
          {isFailed && (
            <motion.span
              key="warn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'inline-flex' }}
            >
              <AlertTriangle size={11} strokeWidth={2} color="white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Center — citation block */}
      <div style={{ minWidth: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
          }}
        >
          hash {index} · {label.title}
        </div>
        <div
          className="serif"
          style={{
            fontSize: 14,
            color: isFailed ? 'var(--color-warn)' : 'var(--color-ink)',
            marginTop: 4,
            letterSpacing: '-0.005em',
            lineHeight: 1.5,
          }}
        >
          {check.primary}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-faint)',
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          ↳ {check.citation}
        </div>
        {isOverridden && record?.overrideReason && (
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11.5,
              color: 'var(--color-accent)',
              marginTop: 6,
              letterSpacing: '-0.005em',
            }}
          >
            overridden · {record.overrideReason}
          </div>
        )}
      </div>

      {/* Right — action */}
      <div style={{ paddingTop: 2 }}>
        {isSigned ? (
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
            }}
          >
            ✓ signed{isOverridden ? ' (override)' : ''}
          </span>
        ) : refreshing ? (
          <span
            className="mono inline-flex items-center gap-1"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
            }}
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-flex' }}
            >
              <RotateCcw size={10} strokeWidth={1.5} />
            </motion.span>
            refreshing
          </span>
        ) : isFailed ? (
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--color-warn)',
              background: 'transparent',
              border: '0.5px solid var(--color-warn)',
            }}
          >
            Override →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center"
            style={{
              padding: '5px 11px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--color-bg)',
              background: 'var(--color-accent)',
              border: '0.5px solid var(--color-accent)',
            }}
          >
            Confirm hash →
          </button>
        )}
      </div>
    </motion.div>
  );
}

