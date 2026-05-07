import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { recallAutonomousAction } from '@/lib/autonomy/runAutonomousAction';

type Override = 'refer' | 'decline' | 'pass' | 'manual';

/**
 * Module 14 — recall modal.
 *
 * Captures the underwriter's reason for recalling an autonomous
 * action and (optionally) the override they want applied. Reason
 * must be ≥10 chars; runAutonomousAction enforces this.
 */
export function RecallModal({
  entryRef,
  classId,
  recallExpiresAt,
  onClose,
  onRecalled,
}: {
  entryRef: string;
  classId: string;
  recallExpiresAt: string;
  onClose: () => void;
  onRecalled: () => void;
}) {
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState<Override>('refer');
  const [error, setError] = useState<string | null>(null);

  const expiresAt = new Date(recallExpiresAt);
  const expired = expiresAt.getTime() < Date.now();

  function submit() {
    if (expired) {
      setError('Recall window has closed.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }
    try {
      const ok = recallAutonomousAction({
        entryRef,
        reason,
        recalledBy: 'nm',
        overrideTo: override,
      });
      if (!ok) {
        setError('Could not recall — action may already be recalled or out of window.');
        return;
      }
      onRecalled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recall failed.');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      role="dialog"
      aria-label="Recall autonomous action"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="hairline"
        style={{
          width: 480,
          maxWidth: '90vw',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 22px',
        }}
      >
        <header
          className="flex items-baseline justify-between"
          style={{ marginBottom: 14 }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-faint)',
              }}
            >
              recall · {classId}
            </div>
            <h3
              className="serif"
              style={{
                fontSize: 18,
                fontWeight: 500,
                margin: '4px 0 0',
                color: 'var(--color-ink)',
                letterSpacing: '-0.012em',
              }}
            >
              Recall autonomous action on {entryRef}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: 4,
              color: 'var(--color-ink-mute)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>

        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            margin: '0 0 14px',
            lineHeight: 1.6,
            letterSpacing: '-0.005em',
          }}
        >
          The cockpit will reverse the autonomous decision and apply your
          override. The recall, with reason, becomes part of the audit trail
          and informs future band-tightening.{' '}
          {expired
            ? 'The recall window has closed; this submission can no longer be recalled.'
            : `Window closes ${expiresAt.toLocaleString('en-GB')}.`}
        </p>

        <label
          className="mono"
          style={{
            display: 'block',
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 4,
          }}
        >
          Reason for recall (≥ 10 chars)
        </label>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          rows={3}
          className="serif"
          placeholder="The cohort match looked clean but I want to verify the geography manually."
          style={{
            width: '100%',
            fontSize: 13,
            color: 'var(--color-ink)',
            background: 'var(--color-bg)',
            border: '0.5px solid var(--color-rule-mid)',
            borderRadius: 'var(--radius-button)',
            padding: '8px 10px',
            resize: 'vertical',
            letterSpacing: '-0.005em',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        />

        <label
          className="mono"
          style={{
            display: 'block',
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginTop: 12,
            marginBottom: 4,
          }}
        >
          Override to
        </label>
        <div className="flex items-center" style={{ gap: 6 }}>
          {(['refer', 'decline', 'pass', 'manual'] as Override[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOverride(o)}
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 'var(--radius-button)',
                border: `0.5px solid ${override === o ? 'var(--color-accent)' : 'var(--color-rule-mid)'}`,
                background: override === o ? 'var(--color-accent)' : 'transparent',
                color: override === o ? 'var(--color-bg)' : 'var(--color-ink-mute)',
                cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}
            >
              {o}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-danger)',
              marginTop: 10,
              letterSpacing: '-0.005em',
            }}
          >
            {error}
          </div>
        )}

        <footer
          className="hairline-t flex items-center justify-end"
          style={{ marginTop: 16, paddingTop: 12, gap: 8 }}
        >
          <button
            type="button"
            onClick={onClose}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 12px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-rule-mid)',
              background: 'transparent',
              color: 'var(--color-ink-mute)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={expired}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 12px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-accent)',
              background: expired ? 'var(--color-rule-mid)' : 'var(--color-accent)',
              color: 'var(--color-bg)',
              cursor: expired ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            Recall &amp; override
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
