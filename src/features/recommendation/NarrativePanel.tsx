import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';

const STREAM_DURATION_MS = 1500;
const SUBMISSION_ID = 'sub_greenline_2026_05';

type Props = {
  headline: string | null;
  isCalculating: boolean;
};

/**
 * Right-column panel that holds the streaming headline narrative. This
 * is the second place in the product where streaming text is allowed
 * — like the email body in module 5, the AI is genuinely *writing*
 * here, not calculating.
 *
 * Mid-stream refresh recovers via the `recommendation.completed`
 * timestamp + a separate `recommendation.streamFinished` marker
 * (parallel to the email pattern). For module 6 we keep it simpler:
 * if `headline` is already populated and the most recent
 * recommendation.completed is older than ~3s when we mount, skip the
 * stream.
 */
export function NarrativePanel({ headline, isCalculating }: Props) {
  const auditLog = useRanBerri((s) => s.auditLog);
  const completedAt = useRanBerri((s) => s.recommendation.completedAt);

  const alreadyStreamed = useMemo(() => {
    if (!completedAt) return false;
    const ageMs = Date.now() - new Date(completedAt).getTime();
    // If completedAt is older than ~3s, the stream must have finished
    // already (or we hydrated post-refresh).
    if (ageMs > 3_000) return true;
    // Also consider: if a later event has fired since
    // recommendation.completed, the stream definitely settled.
    let lastCompleted = -1;
    let later = -1;
    for (let i = 0; i < auditLog.length; i++) {
      if (auditLog[i]!.kind === 'recommendation.completed') lastCompleted = i;
      if (i > lastCompleted) later = i;
    }
    return later > lastCompleted;
  }, [auditLog, completedAt]);

  const [streaming, setStreaming] = useState(!alreadyStreamed);
  const [visible, setVisible] = useState(alreadyStreamed ? headline ?? '' : '');

  useEffect(() => {
    if (!headline) {
      setVisible('');
      setStreaming(false);
      return;
    }
    if (alreadyStreamed) {
      setVisible(headline);
      setStreaming(false);
      return;
    }
    const words = headline.split(/(\s+)/);
    const totalSteps = words.length;
    const stepInterval = Math.max(15, STREAM_DURATION_MS / totalSteps);
    let i = 0;
    setVisible('');
    setStreaming(true);
    const handle = setInterval(() => {
      i++;
      if (i >= totalSteps) {
        setVisible(headline);
        setStreaming(false);
        clearInterval(handle);
        return;
      }
      setVisible(words.slice(0, i).join(''));
    }, stepInterval);
    return () => clearInterval(handle);
    // headline is the streaming source — re-stream when it changes
    // (e.g. recommendation rerun). alreadyStreamed gates whether to
    // skip on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="hairline"
      style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
        minHeight: 220,
      }}
    >
      <div className="eyebrow" style={{ color: 'var(--color-ink-mute)' }}>
        narrative
      </div>
      {isCalculating || !headline ? (
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--color-ink-mute)',
            marginTop: 8,
          }}
        >
          {isCalculating ? 'evaluating factors…' : 'awaiting recommendation…'}
        </div>
      ) : (
        <div
          className="serif"
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)',
            marginTop: 10,
            letterSpacing: '-0.005em',
            textDecoration: streaming ? 'underline' : 'none',
            textDecorationColor: 'var(--color-accent)',
            textDecorationStyle: 'dotted',
            textDecorationThickness: '0.5px',
            textUnderlineOffset: 4,
          }}
        >
          {visible}
        </div>
      )}
    </motion.div>
  );
}

export const RECOMMENDATION_SUBMISSION_ID = SUBMISSION_ID;
