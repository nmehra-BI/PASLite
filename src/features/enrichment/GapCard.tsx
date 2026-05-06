import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';
import type { GapRecord } from '@/store/replay';

type Choice = 'present' | 'absent' | 'request';

type Props = {
  gap: GapRecord;
};

const RECIPIENT = 's.whitfield@surestep.co.uk';

/**
 * Gap-resolution card. Structurally simpler than a conflict — there's
 * no second source to disagree, just a missing-but-required field. The
 * "Request from broker" option queues a mock task for follow-up.
 */
export function GapCard({ gap }: Props) {
  const resolveGap = useRanBerri((s) => s.resolveGap);
  const readOnly = useReadOnly();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !readOnly && choice !== null && reason.trim().length >= 8;

  function handleResolve() {
    setError(null);
    if (!choice) return;
    try {
      resolveGap({
        gapId: gap.id,
        fieldPath: gap.fieldPath,
        choice,
        reason: reason.trim(),
        resolvedBy: 'nm',
        recipient: choice === 'request' ? RECIPIENT : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const titleField = gap.fieldPath
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-mid"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
        maxWidth: 720,
      }}
    >
      <div className="eyebrow" style={{ color: 'var(--color-warn)' }}>
        {titleField} · GAP
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--color-ink-mute)',
          marginTop: 2,
        }}
      >
        broker did not disclose
      </div>

      <p
        className="serif"
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: 'var(--color-ink-soft)',
          marginTop: 14,
          marginBottom: 16,
        }}
      >
        Tier-2 rating assumes fire suppression present. Without disclosure,
        either request from broker or rate as absent (loading applies).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Radio
          checked={choice === 'present'}
          onChange={() => setChoice('present')}
          label="Mark as present (broker confirmed verbally)"
        />
        <Radio
          checked={choice === 'absent'}
          onChange={() => setChoice('absent')}
          label="Mark as absent (apply Tier-2 loading)"
        />
        <Radio
          checked={choice === 'request'}
          onChange={() => setChoice('request')}
          label={`Request from broker — queue email to ${RECIPIENT}`}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label
          className="eyebrow"
          htmlFor={`gap-reason-${gap.id}`}
          style={{ display: 'block', marginBottom: 4 }}
        >
          reason (required)
        </label>
        <textarea
          id={`gap-reason-${gap.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="for the audit trail."
          className="hairline"
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-bg)',
            padding: '6px 10px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--color-ink-soft)',
            borderRadius: 'var(--radius-button)',
          }}
        />
      </div>

      {error && (
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-danger)',
            margin: '8px 0 0',
          }}
        >
          {error}
        </p>
      )}

      <div style={{ marginTop: 12 }}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleResolve}
          disabled={!canSubmit}
        >
          Resolve →
        </Button>
      </div>
    </motion.div>
  );
}

function Radio({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '3px 0',
        fontSize: 13,
        color: checked ? 'var(--color-ink)' : 'var(--color-ink-soft)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          border: `0.5px solid ${
            checked ? 'var(--color-accent)' : 'var(--color-rule-mid)'
          }`,
          background: checked ? 'var(--color-accent)' : 'transparent',
          flex: '0 0 12px',
          display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </button>
  );
}
