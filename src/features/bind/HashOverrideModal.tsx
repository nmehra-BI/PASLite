import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components';
import { overrideHash } from '@/lib/bind';
import { HASH_LABELS, type HashId } from '@/lib/bind/types';

type Props = {
  hashId: HashId;
  expectedSha: string;
  currentSha: string;
  onClose: () => void;
};

/**
 * Captures the underwriter's reason when overriding a failed hash.
 * Reason is required and ≥20 chars (enforced both here and in the
 * library orchestrator). The override writes a single audit event
 * with full provenance — that's what makes this lawful.
 */
export function HashOverrideModal({ hashId, expectedSha, currentSha, onClose }: Props) {
  const label = HASH_LABELS.find((l) => l.id === hashId)!;
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canSubmit = reason.trim().length >= 20;

  function handleSubmit() {
    setError(null);
    try {
      overrideHash({ hashId, reason: reason.trim(), overriddenBy: 'nm' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      role="dialog"
      aria-label={`Override ${label.title}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.32)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="hairline"
        style={{
          width: 480,
          maxWidth: '90vw',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '18px 22px 16px',
          boxShadow: '0 12px 32px rgba(31, 30, 29, 0.18)',
        }}
      >
        <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
          <div className="eyebrow">override hash · {label.id}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 4, color: 'var(--color-ink-mute)' }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div
          className="serif"
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-ink)',
            letterSpacing: '-0.012em',
            marginBottom: 4,
          }}
        >
          Confirm anyway with override
        </div>
        <div
          className="serif"
          style={{
            fontSize: 12.5,
            fontStyle: 'italic',
            color: 'var(--color-ink-mute)',
            lineHeight: 1.55,
            marginBottom: 14,
          }}
        >
          The artefact has changed since seal. Recording an override
          writes one audit event with full provenance — the bind
          becomes lawful but auditable.
        </div>

        <div
          className="hairline"
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-button)',
            background: 'var(--color-bg)',
            marginBottom: 14,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.04em',
              lineHeight: 1.6,
            }}
          >
            <div>expected: {expectedSha}</div>
            <div>current : {currentSha}</div>
          </div>
        </div>

        <label
          htmlFor="override-reason"
          className="eyebrow"
          style={{ display: 'block', marginBottom: 4 }}
        >
          reason (≥20 chars)
        </label>
        <textarea
          id="override-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
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
            lineHeight: 1.55,
            color: 'var(--color-ink-soft)',
            borderRadius: 'var(--radius-button)',
          }}
        />

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

        <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            Sign override →
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
