import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { sendSchedule } from '@/lib/bind';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Post-bind: the schedule + AI-drafted covering note ready for
 * broker handoff. Read-only by default; covering note is editable
 * before send. Once sent, locks to status banner.
 */
export function ScheduleSection() {
  const submission = useRanBerri((s) => s.submission);
  const bind = useRanBerri((s) => s.bind);
  const schedule = useRanBerri((s) => s.postBind.schedule);
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);

  const policyRef = bind.policyRef ?? '—';
  const recipient = schedule.recipient ?? '—';
  const recipientName = useMemo(() => {
    if (!recipient.includes('@')) return recipient;
    return recipient.includes('whitfield')
      ? 'Sarah Whitfield'
      : recipient;
  }, [recipient]);

  if (!submission || bind.phase !== 'committed') return null;

  const note = draftNote ?? schedule.coveringNote ?? '';
  const sent = schedule.sentAt !== null;

  return (
    <section
      style={{
        padding: '20px 28px 24px',
      }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">schedule · delivery</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          ready for broker handoff
        </div>
      </header>

      <div
        className="hairline"
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Attachment label={`schedule-${policyRef.toLowerCase()}.pdf`} sub="1 page · auto-generated" />
        <Attachment
          label={`bind-certificate-${policyRef.toLowerCase()}.pdf`}
          sub="auto-generated"
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.06em',
            color: 'var(--color-ink-mute)',
            marginBottom: 4,
          }}
        >
          recipient: <span style={{ color: 'var(--color-ink)' }}>{recipientName} &lt;{recipient}&gt;</span>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          ai-drafted covering note
        </div>
        {editing ? (
          <textarea
            value={note}
            onChange={(e) => setDraftNote(e.target.value)}
            rows={10}
            className="hairline"
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '10px 12px',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--color-ink-soft)',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-button)',
            }}
          />
        ) : (
          <pre
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--color-ink-soft)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-serif)',
              margin: 0,
            }}
          >
            {note}
          </pre>
        )}
      </div>

      <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
        {!sent && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit covering note
          </Button>
        )}
        {!sent && editing && (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                // Persist the edit by writing it through schedule.generated
                // re-emit (idempotent regen) — simpler: stash on local
                // state and let the next sendSchedule pick it up.
                if (draftNote !== null) {
                  useRanBerri.getState().appendAuditEvent({
                    actor: { kind: 'underwriter', id: 'nm' },
                    kind: 'schedule.generated',
                    submissionId: submission.id,
                    policyRef,
                    coveringNote: draftNote,
                    recipient,
                  });
                }
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftNote(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        )}
        {!sent && !editing && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => sendSchedule('nm')}
          >
            Send schedule →
          </Button>
        )}
      </div>

      <AnimatePresence>
        {sent && (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="hairline"
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 'var(--radius-button)',
              background: 'var(--color-success-bg)',
              borderColor: 'transparent',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.06em',
                color: 'var(--color-success)',
                textTransform: 'uppercase',
              }}
            >
              schedule sent
            </span>
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--color-success)',
                marginLeft: 10,
              }}
            >
              {DATE_FMT.format(new Date(schedule.sentAt!))} · awaiting broker
              acknowledgement
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Attachment({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <Paperclip size={12} strokeWidth={1.5} style={{ color: 'var(--color-ink-mute)' }} />
      <span
        className="mono"
        style={{
          fontSize: 11.5,
          color: 'var(--color-ink)',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-faint)',
          marginLeft: 4,
        }}
      >
        · {sub}
      </span>
    </div>
  );
}
