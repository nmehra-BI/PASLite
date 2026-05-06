import { useState } from 'react';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { Checkbox, Modal, Radio } from './Modal';

const CATEGORIES = [
  { id: 'outside-appetite', label: 'Outside appetite' },
  { id: 'capacity-exhausted', label: 'Capacity exhausted' },
  { id: 'risk-quality', label: 'Risk quality' },
  { id: 'pricing', label: 'Pricing — broker target unrealistic' },
  { id: 'other', label: 'Other' },
] as const;

type Props = { onClose: () => void };

export function DeclineModal({ onClose }: Props) {
  const decline = useRanBerri((s) => s.declineSubmission);
  const [category, setCategory] = useState<typeof CATEGORIES[number]['id'] | null>(null);
  const [detail, setDetail] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = category !== null && detail.trim().length >= 8;

  function handleSubmit() {
    setError(null);
    if (!category) return;
    try {
      decline({
        reasonCategory: category,
        detail: detail.trim(),
        notifyBroker: notify,
        declinedBy: 'nm',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal title="Decline this submission" onClose={onClose} width={500}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        decline reason category
      </div>
      <div style={{ marginBottom: 14 }}>
        {CATEGORIES.map((c) => (
          <Radio
            key={c.id}
            checked={category === c.id}
            onChange={() => setCategory(c.id)}
            label={c.label}
          />
        ))}
      </div>

      <label
        htmlFor="decline-detail"
        className="eyebrow"
        style={{ display: 'block', marginBottom: 4 }}
      >
        detail (required)
      </label>
      <textarea
        id="decline-detail"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
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

      <div style={{ marginTop: 14 }}>
        <Checkbox
          checked={notify}
          onChange={() => setNotify((n) => !n)}
          label={
            <span>
              Send polite NTQ email to{' '}
              <span className="mono" style={{ fontSize: 11.5 }}>
                s.whitfield@surestep.co.uk
              </span>{' '}
              <span
                className="serif"
                style={{
                  fontStyle: 'italic',
                  color: 'var(--color-ink-faint)',
                  fontSize: 11.5,
                }}
              >
                (you&rsquo;ll review the email before it sends)
              </span>
            </span>
          }
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

      <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          Decline →
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
