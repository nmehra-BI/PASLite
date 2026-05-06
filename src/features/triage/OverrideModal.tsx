import { useState } from 'react';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { Modal, Radio } from './Modal';
import type { TriageOutcome } from '@/store/replay';

type Props = {
  checkId: 'appetite' | 'capacity' | 'subjectivities' | 'sanctions';
  currentOutcome: TriageOutcome;
  onClose: () => void;
};

const TITLE: Record<Props['checkId'], string> = {
  appetite: 'APPETITE',
  capacity: 'CAPACITY',
  subjectivities: 'SUBJECTIVITIES',
  sanctions: 'SANCTIONS',
};

export function OverrideModal({ checkId, currentOutcome, onClose }: Props) {
  const override = useRanBerri((s) => s.overrideTriageCheck);
  const otherOutcomes: TriageOutcome[] = (['pass', 'refer', 'decline'] as const).filter(
    (o) => o !== currentOutcome,
  );
  const [next, setNext] = useState<TriageOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = next !== null && reason.trim().length >= 8;

  function handleSubmit() {
    setError(null);
    if (!next) return;
    try {
      override({
        check: checkId,
        from: currentOutcome,
        to: next,
        reason: reason.trim(),
        overriddenBy: 'nm',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal title={`Override ${TITLE[checkId]} outcome`} onClose={onClose}>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-mute)',
          marginBottom: 14,
        }}
      >
        Current: <span style={{ textTransform: 'uppercase' }}>{currentOutcome}</span>
      </div>

      <div className="eyebrow" style={{ marginBottom: 6 }}>
        override to
      </div>
      <div style={{ marginBottom: 12 }}>
        {otherOutcomes.map((o) => (
          <Radio
            key={o}
            checked={next === o}
            onChange={() => setNext(o)}
            label={o.charAt(0).toUpperCase() + o.slice(1)}
          />
        ))}
      </div>

      <label
        htmlFor="override-reason"
        className="eyebrow"
        style={{ display: 'block', marginBottom: 4 }}
      >
        reason (required)
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
          lineHeight: 1.5,
          color: 'var(--color-ink-soft)',
          borderRadius: 'var(--radius-button)',
        }}
      />

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-faint)',
          margin: '8px 0 0',
          lineHeight: 1.5,
        }}
      >
        This will be recorded in the audit log and flagged in the
        submission&rsquo;s bind history.
      </p>

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

      <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          Override →
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
