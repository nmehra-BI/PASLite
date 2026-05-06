import { motion } from 'framer-motion';
import { useState } from 'react';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';
import { Button } from '@/components';
import { SendModal } from './SendModal';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

/**
 * Banner shown across the canvas top once a quote has been sent.
 * Switches from info-bg to warn-bg if the underlying rating goes
 * stale after the send (the "sent quote is stale" pattern).
 */
export function QuoteSentBanner() {
  const submissionState = useRanBerri((s) => s.submissionState);
  const quote = useRanBerri((s) => s.quote);
  const ratingArtifact = useRanBerri((s) => s.artifacts.rating);
  const rating = useRanBerri((s) => s.rating);
  const recallQuote = useRanBerri((s) => s.recallQuote);
  const readOnly = useReadOnly();
  const [sendOpen, setSendOpen] = useState(false);

  if (submissionState !== 'quote-sent' || !quote.sentAt) return null;

  const isStale =
    quote.staleSinceSent !== null || ratingArtifact.staleSince !== null;

  const recipient =
    quote.email?.recipient.split('@')[0]?.replace(/[._]/g, ' ') ?? 'broker';
  const recipientName = recipient
    .split(' ')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="hairline-b"
        style={{
          background: isStale
            ? 'var(--color-warn-bg)'
            : 'var(--color-info-bg)',
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
              color: isStale ? 'var(--color-warn)' : 'var(--color-info)',
            }}
          >
            {isStale ? 'sent quote stale' : 'quote sent'}
          </span>
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 14,
              color: isStale ? 'var(--color-warn)' : 'var(--color-info)',
              letterSpacing: '-0.005em',
            }}
          >
            {isStale && rating.output
              ? `Sent quote is stale · current rating produces £${rating.output.premium.toLocaleString()} · consider sending a revised quote`
              : `Quote sent to ${recipientName} · ${new Date(
                  quote.sentAt,
                ).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })} · ${timeAgo(quote.sentAt)}`}
          </span>
          <span style={{ flex: 1 }} />
          {isStale && !readOnly && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSendOpen(true)}
            >
              Send revised quote
            </Button>
          )}
          {!readOnly && (
            <button
              type="button"
              title="v0.2 feature"
              onClick={() => recallQuote('nm')}
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12,
                color: isStale ? 'var(--color-warn)' : 'var(--color-info)',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
              }}
            >
              Recall
            </button>
          )}
        </div>
      </motion.div>
      {sendOpen && <SendModal onClose={() => setSendOpen(false)} />}
    </>
  );
}
