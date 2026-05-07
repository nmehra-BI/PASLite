import { motion } from 'framer-motion';
import { Sparkle } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useConfig } from '@/config';
import { getManchesterMtaRequest } from '@/lib/fixtures';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * The revised schedule artefact — Lloyd's slip aesthetic, narrower
 * than the bind certificate. Reproduces the endorsement note, AP,
 * new annual equivalent, and the new warranty.
 */
export function MtaScheduleSection() {
  const submission = useRanBerri((s) => s.submission);
  const mta = useRanBerri((s) => s.mta);
  const bind = useRanBerri((s) => s.bind);
  const config = useConfig();

  if (!submission || !mta.request || !mta.schedule || !mta.delta) return null;
  if (
    mta.phase !== 'schedule-ready' &&
    mta.phase !== 'ceremony-in-progress' &&
    mta.phase !== 'committed' &&
    mta.phase !== 'sent'
  ) {
    return null;
  }

  const fixture = getManchesterMtaRequest();
  const policyRef = bind.policyRef ?? mta.request.policyRef;
  const effective = DATE_FMT.format(new Date(mta.request.effectiveDate));
  const newSiteName = fixture.newSite.name;
  const newSiteAddress = fixture.newSite.address;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">revised schedule</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          endorsement {mta.schedule.endorsementNumber} · {policyRef}
        </div>
      </header>

      <article
        style={{
          maxWidth: 720,
          padding: '28px 32px 30px',
          background: '#F8F5EC',
          border: '0.5px solid var(--color-rule-mid)',
          borderRadius: 'var(--radius-card)',
          fontFamily: 'var(--font-serif)',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        <div className="flex items-center gap-1.5" style={{ marginBottom: 16 }}>
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
            <SectionLabel>revised schedule</SectionLabel>
            <div
              className="serif"
              style={{
                fontSize: 14,
                fontStyle: 'italic',
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
              Greenline Recycling Ltd
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
              <span style={{ color: 'var(--color-ink)' }}>{mta.schedule.scheduleRef}</span>
            </div>
            <div>endorsement {mta.schedule.endorsementNumber}</div>
            <div>effective {effective}</div>
          </div>
        </div>

        <Divider />

        <Section label="endorsement note">
          <p
            className="serif"
            style={{
              fontSize: 13.5,
              color: 'var(--color-ink-soft)',
              lineHeight: 1.6,
              margin: 0,
              letterSpacing: '-0.005em',
            }}
          >
            {mta.schedule.endorsementNote}
          </p>
        </Section>

        <Section label="additional premium">
          <div
            className="serif"
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--color-ink)',
              letterSpacing: '-0.012em',
            }}
          >
            <span style={{ color: 'var(--color-accent)' }}>£</span>
            {mta.delta.proRatedAP.toLocaleString('en-GB')}
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--color-ink-mute)',
                marginLeft: 8,
              }}
            >
              · pro-rated ({mta.delta.daysRemaining} of {mta.delta.daysInTerm} days)
            </span>
          </div>
        </Section>

        <Section label="revised annual equivalent">
          £{mta.delta.afterAnnualEquivalent.toLocaleString('en-GB')}
        </Section>

        <Section label="added location">
          <div>{newSiteName} ({newSiteAddress})</div>
          <div>Materials: mixed dry recyclables</div>
          <div>Fire suppression: sprinkler + smoke detection</div>
          <div>EA permit: pending ({fixture.newSite.expectedPermitRef ?? '—'}) — see warranty</div>
        </Section>

        {mta.schedule.addedWarranty && (
          <Section label="additional warranty">
            <p
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--color-ink-soft)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              iii. {mta.schedule.addedWarranty}
            </p>
          </Section>
        )}

        <Section label="existing warranties (unchanged)">
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-ink-mute)',
              lineHeight: 1.55,
            }}
          >
            <li>i. Environment Agency permit must remain in force at all sites…</li>
            <li>ii. Fire suppression to be maintained at all sites…</li>
          </ul>
        </Section>

        <Divider />

        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 14,
            marginBottom: 0,
            lineHeight: 1.55,
          }}
        >
          This endorsement amends {policyRef} with effect from {effective}.
          All other terms and conditions remain in full force and effect.
        </p>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-mute)',
              textAlign: 'right',
              lineHeight: 1.55,
            }}
          >
            <div style={{ color: 'var(--color-ink)', fontStyle: 'normal' }}>{config.metadata.underwriterName}</div>
            <div>{config.metadata.underwriterTitle}</div>
            <div>{config.metadata.mgaDeskName}</div>
          </div>
        </div>
      </article>
    </motion.section>
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
    <section style={{ marginTop: 18 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ marginTop: 6, color: 'var(--color-ink)' }}>{children}</div>
    </section>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        marginTop: 18,
        height: 0.5,
        background: 'var(--color-rule-mid)',
      }}
    />
  );
}
