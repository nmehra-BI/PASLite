import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useListingStore } from './listingStore';

/**
 * Shown on the canvas after the user drilled from the listing AND a
 * terminal workflow committed (bind, MTA, cancellation, renewal).
 * Offers "Return to all submissions →" to close the loop.
 *
 * Stays mounted until the user either clicks the link or scrubs the
 * lifecycle ribbon — the latter being a strong signal they want to
 * stay on the canvas.
 */
export function BindCompletionBanner() {
  const drilled = useListingStore((s) => s.drilledFromListing);
  const setDrilled = useListingStore((s) => s.setDrilledFromListing);
  const bindPhase = useRanBerri((s) => s.bind.phase);
  const mtaPhase = useRanBerri((s) => s.mta.phase);
  const cancelPhase = useRanBerri((s) => s.cancellation.phase);
  const renewalPhase = useRanBerri((s) => s.renewal.phase);
  const [latestCommit, setLatestCommit] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Track the most-recent terminal commit so the banner shows the
    // appropriate label.
    if (renewalPhase === 'committed' || renewalPhase === 'sent') {
      setLatestCommit('Renewal issued');
      return;
    }
    if (cancelPhase === 'committed' || cancelPhase === 'sent') {
      setLatestCommit('Cancellation issued');
      return;
    }
    if (mtaPhase === 'committed' || mtaPhase === 'sent') {
      setLatestCommit('Endorsement issued');
      return;
    }
    if (bindPhase === 'committed') {
      setLatestCommit('Bound');
      return;
    }
    setLatestCommit(null);
  }, [bindPhase, mtaPhase, cancelPhase, renewalPhase]);

  // Show only when the underwriter drilled from the listing AND a
  // terminal commit has happened AND they haven't dismissed.
  const visible = !dismissed && drilled !== null && latestCommit !== null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          className="hairline-b"
          style={{
            position: 'relative',
            zIndex: 6,
            padding: '8px 22px',
            background: 'var(--color-success-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flex: '0 0 auto',
          }}
        >
          <div className="flex items-baseline gap-2">
            <Check
              size={11}
              strokeWidth={1.75}
              style={{ color: 'var(--color-success)', position: 'relative', top: 1 }}
            />
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-success)',
              }}
            >
              {latestCommit}
            </span>
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-success)',
                letterSpacing: '-0.005em',
              }}
            >
              {drilled?.ref ? `· ${drilled.ref}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                setDrilled(null);
                window.location.hash = '#/';
              }}
              className="serif inline-flex items-center gap-1"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-success)',
                background: 'transparent',
                border: '0.5px solid var(--color-success)',
                padding: '2px 10px',
                borderRadius: 'var(--radius-button)',
                cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}
            >
              <ArrowLeft size={11} strokeWidth={1.5} />
              Return to all submissions →
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--color-success)',
                background: 'transparent',
                border: 0,
                padding: '2px 6px',
                cursor: 'pointer',
                opacity: 0.7,
              }}
            >
              dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
