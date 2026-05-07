import { motion } from 'framer-motion';
import { Sparkle, X } from 'lucide-react';
import { useConfig } from '@/config';
import { getLiveBindCertificate } from '@/lib/bind';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

const PRECISE_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * The formal bind certificate. Renders in the Lloyd's slip aesthetic
 * (Source Serif 4 body, mono refs, italic warranties, paper-warm
 * background). Reproduces every hash with its sha and confirmed
 * timestamp — the artefact a compliance auditor would request.
 */
export function BoundCertificate({ onClose }: { onClose: () => void }) {
  const cert = getLiveBindCertificate();
  const config = useConfig();
  if (!cert) return null;

  const inception = cert.inceptionDate
    ? DATE_FMT.format(new Date(cert.inceptionDate))
    : '—';
  const inceptionTime = cert.inceptionDate
    ? TIME_FMT.format(new Date(cert.inceptionDate))
    : '—';
  const signed = cert.signedAt ? new Date(cert.signedAt) : new Date();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-label="Bind certificate"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.32)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '4vh 0',
        overflowY: 'auto',
      }}
    >
      <motion.article
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: 720,
          width: 'calc(100% - 32px)',
          padding: '32px 36px 36px',
          background: '#F8F5EC',
          border: '0.5px solid var(--color-rule-mid)',
          borderRadius: 'var(--radius-card)',
          fontFamily: 'var(--font-serif)',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
          boxShadow: '0 12px 40px rgba(31, 30, 29, 0.18)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            padding: 6,
            color: 'var(--color-ink-mute)',
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-1.5" style={{ marginBottom: 18 }}>
          <Sparkle
            size={11}
            strokeWidth={1.25}
            style={{ color: 'var(--color-accent)' }}
            aria-hidden
          />
          <span
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-faint)',
            }}
          >
            {config.branding.productName}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div>
            <SectionLabel>bind certificate</SectionLabel>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--color-ink-mute)',
                marginTop: 6,
              }}
            >
              in respect of
            </div>
            <div
              className="serif"
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.012em',
                marginTop: 2,
              }}
            >
              {cert.insuredName}
            </div>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
              textAlign: 'right',
              lineHeight: 1.7,
            }}
          >
            <div>
              <span style={{ color: 'var(--color-ink-faint)' }}>REF:</span>{' '}
              <span style={{ color: 'var(--color-ink)' }}>{cert.policyRef}</span>
            </div>
            <div>Bind ceremony complete</div>
            <div>{DATE_FMT.format(signed)} · {TIME_FMT.format(signed)} BST</div>
          </div>
        </div>

        <Divider />

        <Section label="the insured">
          <div>{cert.insuredName}</div>
        </Section>

        <Section label="policy">
          <KV label="Reference">
            <span className="mono" style={{ fontSize: 12 }}>{cert.policyRef}</span>
          </KV>
          <KV label="Inception">{`${inception}, ${inceptionTime} BST`}</KV>
          <KV label="Term">{cert.term}</KV>
          <KV label="Premium">£{cert.premium.toLocaleString('en-GB')} / annum</KV>
        </Section>

        <Section label="hashes confirmed">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cert.hashes.map((h, i) => (
              <div key={h.id}>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-ink),',
                    letterSpacing: '0.04em',
                  }}
                >
                  Hash {i + 1} · {h.label}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-ink-mute)',
                    letterSpacing: '0.04em',
                    marginLeft: 12,
                    marginTop: 2,
                  }}
                >
                  {h.detail} · signed{' '}
                  {h.confirmedAt
                    ? PRECISE_TIME_FMT.format(new Date(h.confirmedAt))
                    : '—'}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="warranties">
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-soft)',
              lineHeight: 1.6,
            }}
          >
            {cert.warranties.map((w, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {w}
              </li>
            ))}
          </ul>
        </Section>

        <Section label="capacity">
          <div>
            {cert.capacity.syndicate} · {cert.capacity.line} · £
            {cert.capacity.consumption.toLocaleString('en-GB')} consumed
          </div>
        </Section>

        <Divider />

        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 14,
            lineHeight: 1.55,
          }}
        >
          Signed by{' '}
          <span style={{ fontStyle: 'normal', color: 'var(--color-ink)' }}>
            {cert.signedBy}, Senior Underwriter
          </span>
          <br />
          {DATE_FMT.format(signed)}, {PRECISE_TIME_FMT.format(signed)} BST
        </div>

        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-faint)',
            marginTop: 18,
            marginBottom: 0,
            lineHeight: 1.6,
          }}
        >
          This certificate is the immutable record of the bind ceremony.
          Hashes are content-addressable; the policy can be audit-replayed
          to its bind state at any future date.
        </p>
      </motion.article>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-faint)',
      }}
    >
      {children}
    </span>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ marginTop: 8, color: 'var(--color-ink)' }}>{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 10,
        marginTop: 2,
      }}
    >
      <span
        className="serif"
        style={{
          color: 'var(--color-ink-mute)',
          fontStyle: 'italic',
          fontSize: 13,
        }}
      >
        {label}:
      </span>
      <span style={{ fontSize: 14 }}>{children}</span>
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        marginTop: 20,
        height: 0.5,
        background: 'var(--color-rule-mid)',
      }}
    />
  );
}
