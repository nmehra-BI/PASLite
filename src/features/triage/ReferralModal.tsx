import { useState } from 'react';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { Modal, Radio } from './Modal';

type Urgency = 'today' | 'week' | 'next-available';

const REVIEWERS = [
  { id: 'sp', name: 'Sarah Patel', title: 'Director, UW' },
  { id: 'jk', name: 'J. Khan', title: 'Senior UW' },
  { id: 'dh', name: 'D. Holloway', title: 'Director, Specialty' },
];

type Props = {
  onClose: () => void;
  /**
   * Optional hook fired *before* the referral state transition, only on
   * successful submit. Lets callers (e.g. recommendation VerdictPanel)
   * record an upstream event while the submission is still mutable.
   */
  onBeforeSubmit?: () => void;
};

export function ReferralModal({ onClose, onBeforeSubmit }: Props) {
  const refer = useRanBerri((s) => s.referToSenior);
  const [reviewerId, setReviewerId] = useState(REVIEWERS[0]!.id);
  const [urgency, setUrgency] = useState<Urgency>('week');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = reason.trim().length >= 8;
  const reviewer = REVIEWERS.find((r) => r.id === reviewerId)!;

  function handleSubmit() {
    setError(null);
    try {
      onBeforeSubmit?.();
      refer({
        reviewer: reviewer.name,
        urgency,
        reason: reason.trim(),
        referredBy: 'nm',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal title="Refer to senior underwriter" onClose={onClose} width={500}>
      <div style={{ marginBottom: 14 }}>
        <label
          className="eyebrow"
          htmlFor="reviewer"
          style={{ display: 'block', marginBottom: 4 }}
        >
          reviewer
        </label>
        <select
          id="reviewer"
          value={reviewerId}
          onChange={(e) => setReviewerId(e.target.value)}
          className="hairline"
          style={{
            width: '100%',
            background: 'var(--color-bg)',
            padding: '6px 10px',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-ink)',
            borderRadius: 'var(--radius-button)',
          }}
        >
          {REVIEWERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.title}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          urgency
        </div>
        <Radio
          checked={urgency === 'today'}
          onChange={() => setUrgency('today')}
          label="Today (before EOD)"
        />
        <Radio
          checked={urgency === 'week'}
          onChange={() => setUrgency('week')}
          label="This week"
        />
        <Radio
          checked={urgency === 'next-available'}
          onChange={() => setUrgency('next-available')}
          label="Next available"
        />
      </div>

      <label
        htmlFor="referral-reason"
        className="eyebrow"
        style={{ display: 'block', marginBottom: 4 }}
      >
        reason (required)
      </label>
      <textarea
        id="referral-reason"
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
        The submission will be locked until the senior returns it.
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
          Refer →
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
