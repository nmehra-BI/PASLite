import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Mail } from 'lucide-react';
import { useRanBerri } from '@/store';
import { sendRenewalSlip } from '@/lib/renewal';

const GBP = (n: number) => `£${n.toLocaleString('en-GB')}`;
const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Renewal slip panel — the year-2 quote slip that the broker sees.
 * Reuses the visual register from the new-business slip but cites
 * the predecessor policy. Send-to-broker fires the renewal.slipSent
 * event and arms the ceremony.
 */
export function RenewalSlipPanel() {
  const renewal = useRanBerri((s) => s.renewal);
  const bind = useRanBerri((s) => s.bind);
  const [sending, setSending] = useState(false);

  if (!renewal.slip.slipRef || renewal.slip.premium === null) return null;
  if (
    renewal.phase !== 'slip-ready' &&
    renewal.phase !== 'ceremony-in-progress' &&
    renewal.phase !== 'committed' &&
    renewal.phase !== 'sent' &&
    renewal.phase !== 'recommendation-ready'
  ) {
    return null;
  }

  const slip = renewal.slip;
  const priorPolicyRef = bind.policyRef ?? renewal.priorPolicyRef ?? '—';
  const sent = slip.sentAt !== null;

  async function onSend() {
    if (sending || sent) return;
    setSending(true);
    try {
      sendRenewalSlip();
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">renewal quote · slip generated</div>
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
          succeeds {priorPolicyRef} (year 1)
        </div>
      </header>

      <div
        className="hairline"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
          padding: '16px 20px',
        }}
      >
        <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
          <div>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-faint)',
              }}
            >
              renewal quote · {slip.slipRef}
            </div>
            <div
              className="serif"
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--color-ink)',
                letterSpacing: '-0.012em',
                marginTop: 4,
              }}
            >
              Greenline Recycling Ltd · year 2
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-faint)',
              }}
            >
              year-2 premium
            </div>
            <div
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: 'var(--color-accent)',
                letterSpacing: '0.02em',
                marginTop: 2,
              }}
            >
              {GBP(slip.premium ?? 0)}
            </div>
          </div>
        </div>

        <div
          className="hairline-t"
          style={{
            marginTop: 14,
            paddingTop: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <KV label="predecessor">{priorPolicyRef}</KV>
          <KV label="sha">{slip.sha ?? '—'}</KV>
          <KV label="inception">
            {renewal.year1Review
              ? DATE_FMT.format(
                  new Date(
                    new Date(
                      renewal.year1Review.brokerRelationship.note &&
                      renewal.expiryDate
                        ? renewal.expiryDate
                        : new Date().toISOString(),
                    ).getTime() + 60_000,
                  ),
                )
              : '—'}
          </KV>
          <KV label="basis">12-month succession · year 2</KV>
        </div>

        <div style={{ marginTop: 14 }}>
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-faint)',
              marginBottom: 6,
            }}
          >
            warranties
          </div>
          <ul
            className="serif"
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: 'var(--color-ink)',
              lineHeight: 1.6,
              letterSpacing: '-0.005em',
            }}
          >
            <li>Year-1 warranties carry forward unchanged</li>
            <li>
              <span style={{ color: 'var(--color-warn)' }}>NEW</span> · WEEE
              conditional warranty: sealed-store requirement, monthly stock-rotation
              evidence required for sites handling small electrical &amp;
              electronic equipment
            </li>
          </ul>
        </div>
      </div>

      {/* Send strip */}
      <div
        className="hairline-t"
        style={{
          marginTop: 18,
          paddingTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div className="flex items-baseline gap-2">
          <Mail size={12} strokeWidth={1.5} style={{ color: 'var(--color-ink-mute)' }} />
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-mute)',
              letterSpacing: '-0.005em',
            }}
          >
            recipient · s.whitfield@surestep.co.uk (Sarah Whitfield, SureStep Brokers)
          </span>
        </div>
        {sent ? (
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-success)',
              letterSpacing: '-0.005em',
            }}
          >
            ✓ sent {slip.sentAt ? TIME_FMT.format(new Date(slip.sentAt)) : ''}
          </span>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-1.5"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--color-bg)',
              background: sending ? 'var(--color-ink-faint)' : 'var(--color-accent)',
              border: '0.5px solid var(--color-accent)',
              cursor: sending ? 'wait' : 'pointer',
            }}
          >
            <Send size={11} strokeWidth={1.5} />
            Send renewal slip →
          </button>
        )}
      </div>
    </motion.section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 12,
          color: 'var(--color-ink)',
          letterSpacing: '0.04em',
        }}
      >
        {children}
      </div>
    </div>
  );
}
