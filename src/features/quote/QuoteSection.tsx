import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';
import { generateSlipAndEmail, markQuoteStale } from '@/features/rating';
import { QuoteSlip } from './QuoteSlip';
import { SendModal } from './SendModal';

/**
 * The slip section. Visible when the quote phase is slip-ready, sending
 * or sent. Below the slip: [Send to broker →] (primary) and [Save as
 * draft] (secondary). Auto-drafts the email if it's never been drafted.
 */
export function QuoteSection() {
  const submission = useRanBerri((s) => s.submission);
  const quote = useRanBerri((s) => s.quote);
  const ratingArtifact = useRanBerri((s) => s.artifacts.rating);
  const rating = useRanBerri((s) => s.rating);
  const readOnly = useReadOnly();
  const [sendOpen, setSendOpen] = useState(false);
  const staleHandledRef = useRef<string | null>(null);

  // Auto-mark a sent quote as stale when its underlying rating
  // becomes stale. Idempotent — only fires once per stale transition.
  useEffect(() => {
    if (quote.phase !== 'sent') return;
    const staleKey = ratingArtifact.staleSince;
    if (!staleKey) return;
    if (staleHandledRef.current === staleKey) return;
    if (quote.staleSinceSent) return;
    staleHandledRef.current = staleKey;
    markQuoteStale('upstream rating change after send');
  }, [quote.phase, quote.staleSinceSent, ratingArtifact.staleSince]);

  // Auto-regenerate the slip when rating becomes fresh again after a
  // re-rate cycle. Triggered by the sequence:
  //   slip-ready → rating.rerun → rating.completed → regen
  useEffect(() => {
    if (!submission) return;
    if (rating.phase !== 'settled' || !rating.output) return;
    if (quote.phase !== 'slip-ready') return;
    if (quote.slipPremium === rating.output.premium) return;
    // Premium has shifted under the slip — regenerate.
    generateSlipAndEmail({ regenerate: true });
  }, [
    submission,
    rating.phase,
    rating.output?.premium,
    quote.phase,
    quote.slipPremium,
  ]);

  if (!submission) return null;
  if (quote.phase === 'idle') return null;
  if (quote.phase !== 'slip-ready' && quote.phase !== 'sending' && quote.phase !== 'sent')
    return null;

  return (
    <section
      className="hairline-t"
      style={{ marginTop: 28, paddingTop: 22 }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}
      >
        <div>
          <div className="eyebrow">quote slip</div>
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 14.5,
              color: 'var(--color-ink-mute)',
              marginTop: 2,
              letterSpacing: '-0.005em',
            }}
          >
            {quote.phase === 'sent'
              ? `sent ${quote.sentAt ? new Date(quote.sentAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}`
              : 'institutional · ready to review'}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <QuoteSlip />
      </motion.div>

      {quote.phase === 'slip-ready' && !readOnly && (
        <div
          className="flex items-center gap-2"
          style={{ marginTop: 16, justifyContent: 'center' }}
        >
          <Button
            variant="primary"
            size="md"
            onClick={() => setSendOpen(true)}
          >
            Send to broker →
          </Button>
          <Button variant="secondary" size="md" onClick={() => undefined}>
            Save as draft
          </Button>
        </div>
      )}

      {sendOpen && <SendModal onClose={() => setSendOpen(false)} />}
    </section>
  );
}
