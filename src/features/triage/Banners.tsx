import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';

const URGENCY_LABEL: Record<'today' | 'week' | 'next-available', string> = {
  today: 'today',
  week: 'this week',
  'next-available': 'next available',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

const REASON_LABEL: Record<string, string> = {
  'outside-appetite': 'outside appetite',
  'capacity-exhausted': 'capacity exhausted',
  'risk-quality': 'risk quality',
  pricing: 'pricing',
  other: 'other',
};

/**
 * Top-of-canvas banner shown when the submission is in a terminal
 * state (referred or declined). Renders nothing while the submission
 * is active. Slides in from the top on transition.
 */
export function TerminalBanner() {
  const submissionState = useRanBerri((s) => s.submissionState);
  const referral = useRanBerri((s) => s.referral);
  const decline = useRanBerri((s) => s.decline);

  if (submissionState === 'active' || submissionState === 'rating-pending')
    return null;

  if (submissionState === 'referred' && referral) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="hairline-b"
        style={{
          background: 'var(--color-info-bg)',
          padding: '12px 22px',
          flex: '0 0 auto',
        }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-info)',
            }}
          >
            referred
          </span>
          <span
            className="serif"
            style={{
              fontSize: 14,
              fontStyle: 'italic',
              color: 'var(--color-info)',
            }}
          >
            Referred to {referral.reviewer} · awaiting review · urgency:{' '}
            {URGENCY_LABEL[referral.urgency]} · {timeAgo(referral.referredAt)}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            title="v0.2 feature"
            onClick={() =>
              alert('Recall referral — coming in v0.2.')
            }
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-info)',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
            }}
          >
            Recall referral
          </button>
        </div>
      </motion.div>
    );
  }

  if (submissionState === 'declined' && decline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="hairline-b"
        style={{
          background: 'var(--color-danger-bg)',
          padding: '12px 22px',
          flex: '0 0 auto',
        }}
      >
        <div className="flex items-baseline gap-3" style={{ flexWrap: 'wrap' }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-danger)',
            }}
          >
            declined
          </span>
          <span
            className="serif"
            style={{
              fontSize: 14,
              fontStyle: 'italic',
              color: 'var(--color-danger)',
            }}
          >
            {REASON_LABEL[decline.reasonCategory] ?? decline.reasonCategory} ·{' '}
            {new Date(decline.declinedAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span style={{ flex: 1 }} />
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11.5,
              color: 'var(--color-danger)',
              opacity: 0.8,
            }}
          >
            Loss capture queued (module 7 — not yet built)
          </span>
        </div>
      </motion.div>
    );
  }

  return null;
}
