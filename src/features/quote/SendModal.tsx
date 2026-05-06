import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { QuoteSlip } from './QuoteSlip';
import { EmailDraftEditor } from './EmailDraftEditor';

type Props = { onClose: () => void };

/**
 * Two-column overlay: slip preview on the left (decorative; slightly
 * desaturated), email composition on the right. NOT a popup modal —
 * the spec defends this choice because the broker email reads better
 * with the slip co-present.
 */
export function SendModal({ onClose }: Props) {
  const sendQuote = useRanBerri((s) => s.sendQuote);
  const [sending, setSending] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    // Mock the network round-trip.
    await new Promise<void>((r) => setTimeout(r, 600));
    try {
      sendQuote({ sentBy: 'nm' });
    } finally {
      setSending(false);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-label="Send quote to broker"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1280,
          margin: '24px auto',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          border: '0.5px solid var(--color-rule-mid)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: 0,
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1,
            padding: 6,
            color: 'var(--color-ink-mute)',
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* Left column — slip preview, slightly desaturated */}
        <div
          className="hairline-r"
          style={{
            overflow: 'auto',
            background: 'var(--color-bg)',
            padding: 20,
          }}
        >
          <div
            style={{
              opacity: 0.85,
              filter: 'saturate(0.95)',
              pointerEvents: 'none',
              transform: 'scale(0.92)',
              transformOrigin: 'top center',
            }}
          >
            <QuoteSlip />
          </div>
        </div>

        {/* Right column — email composition */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'var(--color-surface)',
          }}
        >
          <EmailDraftEditor onStreamComplete={() => setStreamComplete(true)} />

          {/* Action bar */}
          <div
            className="hairline-t flex items-center justify-end gap-2"
            style={{
              padding: '12px 22px',
              flex: '0 0 auto',
              background: 'var(--color-bg)',
            }}
          >
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="secondary" size="md" onClick={onClose}>
              Save draft
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              disabled={sending || !streamComplete}
            >
              {sending ? 'Sending…' : 'Send →'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
