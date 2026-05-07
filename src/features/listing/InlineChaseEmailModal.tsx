import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ListingEntry } from '@/lib/listing';
import { Button } from '@/components';
import { useRanBerri } from '@/store';

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
});

/**
 * Inline chase composition. AI-drafted body streams in, editable,
 * mock send emits chase.sent.
 */
export function InlineChaseEmailModal({
  entry,
  onClose,
  onSent,
}: {
  entry: ListingEntry;
  onClose: () => void;
  onSent: () => void;
}) {
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const subject = `Following up on ${entry.insuredName} quote — ${entry.ref}`;
  const fullBody = composeBody(entry);
  const [body, setBody] = useState('');
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    const words = fullBody.split(' ');
    let i = 0;
    setBody('');
    setStreaming(true);
    const tick = window.setInterval(() => {
      i += 1;
      setBody(words.slice(0, i).join(' '));
      if (i >= words.length) {
        setStreaming(false);
        window.clearInterval(tick);
      }
    }, 28);
    return () => window.clearInterval(tick);
  }, [fullBody]);

  function send() {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'chase.sent',
      entryRef: entry.ref,
      recipient: entry.brokerEmail,
      subject,
      body,
      sentBy: 'nm',
    });
    onSent();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-label="Compose chase"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.32)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ y: 8, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hairline"
        style={{
          width: 520,
          maxWidth: '92vw',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '18px 22px 16px',
          boxShadow: '0 12px 32px rgba(31, 30, 29, 0.18)',
        }}
      >
        <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
          <div>
            <div className="eyebrow">chase · email</div>
            <div
              className="serif"
              style={{
                fontSize: 15,
                fontWeight: 500,
                marginTop: 2,
                color: 'var(--color-ink)',
                letterSpacing: '-0.005em',
              }}
            >
              Chase {entry.brokerName}
            </div>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-ink-mute)',
                marginTop: 2,
              }}
            >
              regarding {entry.ref} · {entry.insuredName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 4, color: 'var(--color-ink-mute)' }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <label
          className="eyebrow"
          htmlFor="chase-subject"
          style={{ display: 'block', marginTop: 12, marginBottom: 4 }}
        >
          subject
        </label>
        <input
          id="chase-subject"
          readOnly
          value={subject}
          className="hairline mono"
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'var(--color-bg)',
            fontSize: 12,
            color: 'var(--color-ink-soft)',
            letterSpacing: '0.02em',
            borderRadius: 'var(--radius-button)',
          }}
        />

        <label
          className="eyebrow"
          htmlFor="chase-body"
          style={{ display: 'block', marginTop: 10, marginBottom: 4 }}
        >
          body (ai-drafted, editable)
        </label>
        <textarea
          id="chase-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="hairline"
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '8px 12px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)',
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-button)',
            letterSpacing: '-0.005em',
          }}
        />

        <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
          <Button variant="primary" size="sm" onClick={send} disabled={streaming || !body.trim()}>
            Send chase →
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function composeBody(entry: ListingEntry): string {
  const greet = `Hi ${entry.brokerName.split(' ')[0]},`;
  const sent = entry.lastActivityAt
    ? SHORT_DATE.format(new Date(entry.lastActivityAt))
    : 'recently';
  if (entry.phase === 'awaiting-broker' && entry.premium !== null) {
    return `${greet}\n\nFollowing up on the ${entry.insuredName} quote we sent on ${sent} at £${entry.premium.toLocaleString('en-GB')}. Has the insured had a chance to review? Happy to walk through the warranties or rating if helpful.\n\nBest,\nNishit`;
  }
  if (entry.phase === 'in-force-with-mta') {
    return `${greet}\n\nQuick chase on ${entry.ref} — ${entry.status}. Could you confirm where the evidence sits, or let me know if you'd like the cockpit to draft an extension request to the insured directly?\n\nBest,\nNishit`;
  }
  return `${greet}\n\nFollowing up on ${entry.ref} (${entry.insuredName}). Let me know if anything's pending from your side.\n\nBest,\nNishit`;
}
