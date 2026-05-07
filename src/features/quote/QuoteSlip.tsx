import { useMemo } from 'react';
import { Sparkle } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useConfig } from '@/config';
import { effectiveValue, type Field } from '@/lib/field';
import type { Site } from '@/lib/fixtures';
import { EditableField } from './EditableField';
import { WarrantiesList } from './WarrantiesList';

function readField<T>(f: Field<T> | undefined, fallback: T | null = null): T | null {
  if (!f) return fallback;
  return effectiveValue(f) ?? fallback;
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * The Lloyd's-style quote slip. Source Serif 4 body; mono refs;
 * italic warranties; small coral mark + RanBerri wordmark in the
 * top-left corner; signature block bottom-right.
 *
 * Aesthetic notes:
 *   - Paper background (one tone warmer than canvas)
 *   - 32px internal padding, max ~720px width, centered
 *   - Section labels mono uppercase tracked 0.12em ink-faint
 *   - Premium displayed in serif 36px with coral £ accent
 */
export function QuoteSlip() {
  const submission = useRanBerri((s) => s.submission);
  const quote = useRanBerri((s) => s.quote);
  const ratingArtifact = useRanBerri((s) => s.artifacts.rating);
  const isRatingStale = ratingArtifact.staleSince !== null;
  const config = useConfig();
  const capacityProviderName = config.metadata.capacityProvider.name;
  const capacityLineLabel = `${(config.capacity.capacityProviderAllocation * 100).toFixed(0)}% line`;
  const underwriterName = config.metadata.underwriterName;

  const insuredName = readField(submission?.insured.legalName, null) ?? '—';
  const chn = readField(submission?.insured.companiesHouseNumber, null) ?? '—';
  const inceptionRaw = readField(submission?.cover.inceptionDate, null);
  const expiryRaw = readField(submission?.cover.expiryDate, null);
  const term = readField(submission?.cover.term, '12 months') ?? '12 months';
  const folio = submission?.folio ?? 'MGA-PAS · folio 29481';
  const slipRef = quote.slipRef ?? 'POL-29481-Q1';
  const sites = submission?.sites ?? [];
  const siteList = sites.map((s: Site) => effectiveValue(s.name)).filter(Boolean).join(', ');
  const premium = quote.slipPremium ?? 0;

  const inception = inceptionRaw
    ? DATE_FMT.format(new Date(inceptionRaw))
    : '—';
  const inceptionTime = inceptionRaw
    ? new Date(inceptionRaw).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const expiry = expiryRaw ? DATE_FMT.format(new Date(expiryRaw)) : '—';

  const generatedStamp = useMemo(() => {
    const d = new Date();
    return `${SHORT_DATE_FMT.format(d)} · ${d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })} BST`;
  }, []);

  // Default warranties derived from submission state.
  const leedsPermitWarning = sites.find((s) => {
    const n = effectiveValue(s.name) as string | null;
    if (!n?.toLowerCase().includes('leeds')) return false;
    const exp = effectiveValue(s.permitExpiry) as string | null;
    return exp && inceptionRaw && expiryRaw && exp >= inceptionRaw && exp <= expiryRaw;
  });
  const leedsPermitText = leedsPermitWarning
    ? `Environment Agency permit must remain in force throughout the policy term at all insured locations. Particular attention is drawn to permit ${effectiveValue(leedsPermitWarning.permitRef) as string} (Leeds) which expires ${SHORT_DATE_FMT.format(new Date(effectiveValue(leedsPermitWarning.permitExpiry) as string))}; renewal evidence must be provided to the MGA within 14 days of expiry.`
    : 'Environment Agency permit must remain in force throughout the policy term at all insured locations.';

  const fireSuppressionText =
    'Fire suppression at all sites to be maintained as disclosed and confirmed at inception. Material change to be notified to the MGA within 7 days.';

  return (
    <article
      role="article"
      aria-label="Quote slip"
      style={{
        position: 'relative',
        maxWidth: 720,
        margin: '0 auto',
        padding: '32px 36px 36px',
        background: '#F8F5EC', // a touch warmer than --color-bg
        border: '0.5px solid var(--color-rule-mid)',
        borderRadius: 'var(--radius-card)',
        fontFamily: 'var(--font-serif)',
        fontSize: 14,
        lineHeight: 1.55,
        color: 'var(--color-ink)',
        letterSpacing: '-0.005em',
      }}
    >
      {/* RanBerri mark · top-left */}
      <div
        className="flex items-center gap-1.5"
        style={{ marginBottom: 18 }}
      >
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

      {/* Title block */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <SectionLabel>quote slip</SectionLabel>
          <div
            className="serif"
            style={{
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: '-0.012em',
              marginTop: 4,
            }}
          >
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                color: 'var(--color-ink-mute)',
              }}
            >
              SureStep · in respect of
            </span>
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
            {insuredName}
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
            <span style={{ color: 'var(--color-ink)' }}>{slipRef}</span>
          </div>
          <div>{folio}</div>
          <div>{generatedStamp}</div>
        </div>
      </div>

      <Divider />

      <Section label="the insured">
        <div>{insuredName} · Companies House <Mono>{chn}</Mono></div>
        <div>{siteList || '—'}</div>
        <div>UK waste &amp; recycling operator</div>
      </Section>

      <Section label="coverage">
        <div>
          <EditableField
            fieldKey="coverageDescription"
            defaultValue="Tier-2 commercial property & third-party liability"
          />
        </div>
        <KV label="Inception">{`${inception}, ${inceptionTime} BST`}</KV>
        <KV label="Term">
          <EditableField fieldKey="term" defaultValue={term} />
        </KV>
        <KV label="Expiry">{expiry}</KV>
        <KV label="Aggregate">
          <EditableField fieldKey="aggregate" defaultValue="£10,000,000" />
        </KV>
      </Section>

      <Section label="premium">
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: '-0.018em',
            color: 'var(--color-ink)',
            lineHeight: 1.05,
            marginBottom: 4,
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>£</span>
          {premium ? premium.toLocaleString('en-GB') : '—'}
          <span
            style={{
              fontSize: 16,
              color: 'var(--color-ink-mute)',
              fontStyle: 'italic',
              marginLeft: 8,
            }}
          >
            / annum
          </span>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          (sealed against rating engine {quote.slipSha ?? 'sha-7f2a'})
          {isRatingStale && (
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                color: 'var(--color-warn)',
                marginLeft: 8,
                letterSpacing: '-0.005em',
              }}
            >
              · slip is based on stale rating
            </span>
          )}
        </div>
      </Section>

      <Section label="warranties">
        <WarrantiesList defaults={[leedsPermitText, fireSuppressionText]} />
      </Section>

      <Section label="subjectivities">
        <EditableField fieldKey="subjectivities" defaultValue="None" italic />
      </Section>

      <Section label="capacity">
        <div>{capacityProviderName} · {capacityLineLabel}</div>
      </Section>

      <Divider />

      <div
        className="serif"
        style={{
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          marginTop: 12,
          lineHeight: 1.55,
        }}
      >
        This quote is valid for{' '}
        <EditableField fieldKey="validity" defaultValue="21 days" /> from the
        date of issue. Subject to underwriting at bind. Brokerage at standard
        market terms.
      </div>

      <div
        style={{
          marginTop: 36,
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
          <div style={{ color: 'var(--color-ink)', fontStyle: 'normal' }}>
            <EditableField fieldKey="signatureName" defaultValue={underwriterName} />
          </div>
          <div>Senior underwriter</div>
          <div>MGA UK W&amp;R desk</div>
        </div>
      </div>
    </article>
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

function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr',
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

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 12,
        color: 'var(--color-ink)',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </span>
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
