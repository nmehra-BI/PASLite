import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { sendMtaSchedule } from '@/lib/mta';
import { getManchesterMtaRequest } from '@/lib/fixtures';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Post-MTA broker delivery — covering note, attachment list, send.
 * Pattern mirrors module 8's ScheduleSection but for the MTA.
 */
export function MtaScheduleSend() {
  const mta = useRanBerri((s) => s.mta);
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);

  if (!mta.schedule || !mta.request || !mta.delta) return null;
  if (mta.phase !== 'committed' && mta.phase !== 'sent') return null;

  const sent = mta.sentAt !== null;
  const fixture = getManchesterMtaRequest();
  const recipient = fixture.brokerEmail;
  const recipientName = mta.request.brokerName;
  const effectiveLabel = SHORT_DATE_FMT.format(new Date(mta.request.effectiveDate));

  const note =
    draftNote ??
    `Hi ${mta.request.brokerName.split(' ')[0]},

Confirming endorsement ${mta.schedule.scheduleRef.replace(/^.*MTA-/, 'MTA-')} for Greenline (${mta.request.policyRef}), adding ${fixture.newSite.name} with effect from ${effectiveLabel}. AP £${mta.delta.proRatedAP.toLocaleString('en-GB')} (pro-rated). New warranty around the ${fixture.newSite.name} permit attached. Schedule is revised; let me know if you'd like to walk through the math.

Best,
Nishit`;

  return (
    <section style={{ padding: '20px 28px 24px' }}>
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">endorsement · delivery</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          schedule revised — ready for broker handoff
        </div>
      </header>

      <div
        className="hairline"
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
        }}
      >
        <Attachment
          label={`endorsement-${mta.schedule.scheduleRef.toLowerCase()}.pdf`}
          sub="auto-generated"
        />
      </div>

      <div style={{ marginTop: 12 }}>
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

      <div style={{ marginTop: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          ai-drafted covering note
        </div>
        {editing ? (
          <textarea
            value={note}
            onChange={(e) => setDraftNote(e.target.value)}
            rows={9}
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

      <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
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
              onClick={() => setEditing(false)}
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
          <Button variant="primary" size="sm" onClick={() => sendMtaSchedule('nm')}>
            Send revised schedule →
          </Button>
        )}
      </div>

      <AnimatePresence>
        {sent && (
          <motion.div
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
              MTA-{mta.schedule.endorsementNumber.toString().padStart(2, '0')} schedule sent
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
              {DATE_FMT.format(new Date(mta.sentAt!))} · awaiting acknowledgement
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Attachment({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2">
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
