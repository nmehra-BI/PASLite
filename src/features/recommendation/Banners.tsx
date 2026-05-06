import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';

/**
 * Banner shown when the submission has been advanced to bind-pending
 * (module 8 hook) or ntu-pending (module 7 hook). Both are placeholder
 * states — the actual ceremonies live in their respective modules.
 */
export function PendingActionBanner() {
  const submissionState = useRanBerri((s) => s.submissionState);
  const action = useRanBerri((s) => s.recommendation.action);

  if (submissionState !== 'bind-pending' && submissionState !== 'ntu-pending') {
    return null;
  }

  const isBind = submissionState === 'bind-pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-b"
      style={{
        background: isBind ? 'var(--color-success-bg)' : 'var(--color-warn-bg)',
        padding: '12px 22px',
        flex: '0 0 auto',
      }}
    >
      <div
        className="flex items-baseline gap-3"
        style={{ flexWrap: 'wrap' }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isBind ? 'var(--color-success)' : 'var(--color-warn)',
          }}
        >
          {isBind ? 'bind-pending' : 'ntu-pending'}
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14,
            color: isBind ? 'var(--color-success)' : 'var(--color-warn)',
            letterSpacing: '-0.005em',
          }}
        >
          {isBind
            ? 'Bind ceremony will run in module 8. State advanced to bind-pending.'
            : 'NTU loss-capture will run in module 7. State advanced to NTU-pending.'}
        </span>
        {action && (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
            }}
          >
            {action.actedBy} · {new Date(action.actedAt).toLocaleString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </motion.div>
  );
}
