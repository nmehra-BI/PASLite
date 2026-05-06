import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import { computeDeltaRating, type RatingCellRow } from '@/lib/mta';
import { getManchesterMtaRequest } from '@/lib/fixtures';

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Two-column delta rating display + pro-rata calculation block.
 * Renders once mta.delta has been computed.
 */
export function DeltaRatingSequence() {
  const submission = useRanBerri((s) => s.submission);
  const mta = useRanBerri((s) => s.mta);
  const quote = useRanBerri((s) => s.quote);

  const live = useMemo(() => {
    if (!submission || !mta.request) return null;
    return computeDeltaRating({
      submission,
      mta: getManchesterMtaRequest(),
      boundPremium: quote.slipPremium ?? 0,
    });
  }, [submission, mta.request, quote.slipPremium]);

  if (!mta.delta || !live || !mta.request) return null;
  if (
    mta.phase !== 'delta-rating' &&
    mta.phase !== 'capacity-rechecked' &&
    mta.phase !== 'schedule-ready' &&
    mta.phase !== 'ceremony-in-progress'
  ) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">delta rating</div>
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
          Tier-2 v3.2 · pro-rata applied
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          alignItems: 'flex-start',
        }}
      >
        <RatingColumn title="BEFORE PREMIUM" cells={live.beforeCells} finalLabel="ORIGINAL PREMIUM" />
        <RatingColumn title="AFTER PREMIUM" cells={live.afterCells} finalLabel="ANNUAL EQUIVALENT" />
      </div>

      <div
        className="hairline-t hairline-b"
        style={{
          marginTop: 18,
          padding: '14px 0',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 8,
          }}
        >
          delta · unexpired term
        </div>
        <KV label="Annual delta">
          £{mta.delta.afterAnnualEquivalent.toLocaleString('en-GB')} − £{mta.delta.beforePremium.toLocaleString('en-GB')} = £{mta.delta.annualDelta.toLocaleString('en-GB')}
        </KV>
        <KV label="Days remaining">
          {mta.delta.daysRemaining} of {mta.delta.daysInTerm} ({((mta.delta.daysRemaining / mta.delta.daysInTerm) * 100).toFixed(1)}%)
        </KV>
        <KV label="Effective date">{SHORT_DATE_FMT.format(new Date(mta.request.effectiveDate))}</KV>
        <KV label="Pro-rated AP">
          £{mta.delta.annualDelta.toLocaleString('en-GB')} × ({mta.delta.daysRemaining}/{mta.delta.daysInTerm}) = £{mta.delta.proRatedAP.toLocaleString('en-GB')}
        </KV>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: 'center',
        }}
      >
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
          additional premium
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 38,
            fontWeight: 400,
            letterSpacing: '-0.018em',
            color: 'var(--color-ink)',
            lineHeight: 1.05,
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>£</span>
          {mta.delta.proRatedAP.toLocaleString('en-GB')}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
            marginTop: 6,
          }}
        >
          (sealed v3.2 · {mta.delta.sha} · audit-replayable)
        </div>
      </div>
    </motion.section>
  );
}

function RatingColumn({
  title,
  cells,
  finalLabel,
}: {
  title: string;
  cells: RatingCellRow[];
  finalLabel: string;
}) {
  return (
    <div style={{ padding: '0 16px' }}>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr auto',
          rowGap: 4,
          columnGap: 10,
          alignItems: 'baseline',
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
        }}
      >
        {cells.map((c) => {
          const isFinal = c.ref === 'H58';
          return (
            <div
              key={c.ref}
              style={{
                display: 'contents',
              }}
            >
              <span style={{ color: 'var(--color-ink-faint)', letterSpacing: '0.04em' }}>
                {c.ref}
              </span>
              <span
                style={{
                  color: isFinal ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                  fontWeight: isFinal ? 500 : 400,
                }}
              >
                {isFinal ? finalLabel : c.label}
              </span>
              <span
                style={{
                  textAlign: 'right',
                  color: isFinal ? 'var(--color-accent)' : 'var(--color-ink)',
                  fontWeight: isFinal ? 500 : 400,
                }}
              >
                {formatCellValue(c)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCellValue(c: RatingCellRow): string {
  if (c.format === 'percent') return `${(c.value * 100).toFixed(2)}%`;
  if (c.format === 'multiplier') return c.value.toFixed(2);
  // currency
  const sign = c.value < 0 ? '−' : '';
  return `${sign}£${Math.abs(c.value).toLocaleString('en-GB')}`;
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 14,
        alignItems: 'baseline',
        marginBottom: 4,
      }}
    >
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          letterSpacing: '-0.005em',
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: 'var(--color-ink)',
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </span>
    </div>
  );
}
