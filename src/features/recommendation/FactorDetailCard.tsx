import type { RecommendationFactorRecord } from '@/store/replay';
import { lookupBinder, lookupCompetitor, lookupLoss } from './recommendation-engine';
import { SimilarBindersTable } from './SimilarBindersTable';
import { SimilarLossesTable } from './SimilarLossesTable';
import { CompetitiveIntelCard } from './CompetitiveIntelCard';

const MARGINALIA: Record<string, string> = {
  'FCT-001':
    'Profile match strength is weighted by turnover, site count, materials, loss-ratio band and geography. The top 7 sit in the deep-dive panel.',
  'FCT-002':
    'The 7% unprofitable rate is below market average for this segment (~12% across all UK W&R Tier-2 over 5 years per market data). Strong evidence the MGA’s underwriting is well-calibrated for this profile.',
  'FCT-003':
    'Competitive intelligence based on 25 NTU records logged over the last 18 months. Coverage is incomplete; broker-reported competitor prices are estimates.',
  'FCT-004':
    'Open subjectivities are flagged; warranties expiring in-term are surfaced for active monitoring rather than blocking bind.',
  'FCT-005':
    'Broker history at the MGA: bound-rate, average matured LR, and cumulative submission volume.',
};

export function FactorDetailCard({ record }: { record: RecommendationFactorRecord }) {
  const evidence = record.evidence;
  const meta = (record.metadata ?? {}) as Record<string, unknown>;

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        padding: '14px 22px 18px',
        borderTop: '0.5px solid var(--color-rule)',
      }}
    >
      <div className="eyebrow mb-3" style={{ color: 'var(--color-ink-mute)' }}>
        evidence
      </div>

      {record.id === 'FCT-002' && <FCT002Evidence meta={meta} />}
      {record.id === 'FCT-003' && (
        <FCT003Evidence
          ourPremium={meta.ourPremium as number | undefined}
          brokerTarget={meta.brokerTarget as number | null | undefined}
          sharpName={meta.sharpCompetitorName as string | null | undefined}
        />
      )}
      {record.id === 'FCT-001' && <FCT001Evidence meta={meta} />}
      {record.id === 'FCT-004' && <FCT004Evidence meta={meta} />}
      {record.id === 'FCT-005' && <FCT005Evidence meta={meta} />}

      {/* Citations: similar binders / similar losses / competitor cards */}
      {evidence.binderIds && evidence.binderIds.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            top {evidence.binderIds.length} most similar
          </div>
          <SimilarBindersTable
            binders={evidence.binderIds.map(lookupBinder).filter(Boolean) as NonNullable<ReturnType<typeof lookupBinder>>[]}
            compact
          />
        </div>
      )}
      {evidence.lossIds && evidence.lossIds.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            competitive context
          </div>
          <SimilarLossesTable
            losses={evidence.lossIds.map(lookupLoss).filter(Boolean) as NonNullable<ReturnType<typeof lookupLoss>>[]}
            compact
          />
        </div>
      )}
      {evidence.competitorNames && evidence.competitorNames.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            competitor profile
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {evidence.competitorNames
              .map(lookupCompetitor)
              .filter(Boolean)
              .map((c) => (
                <CompetitiveIntelCard key={c!.name} profile={c!} />
              ))}
          </div>
        </div>
      )}

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          marginTop: 14,
          maxWidth: '64ch',
          lineHeight: 1.5,
        }}
      >
        {MARGINALIA[record.id] ?? ''}
      </p>
    </div>
  );
}

function FCT002Evidence({ meta }: { meta: Record<string, unknown> }) {
  const profitable = (meta.profitable as number) ?? 0;
  const breakeven = (meta.breakeven as number) ?? 0;
  const unprofitable = (meta.unprofitable as number) ?? 0;
  const total = (meta.total as number) ?? 0;
  const pct = (n: number) => (total === 0 ? '—' : `${Math.round((n / total) * 100)}%`);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '210px 60px 60px',
        rowGap: 4,
        columnGap: 14,
        alignItems: 'baseline',
      }}
    >
      <div
        className="serif"
        style={{ fontSize: 13, color: 'var(--color-ink-soft)', gridColumn: '1 / -1', marginBottom: 4 }}
      >
        {total} matured binders matching this profile (turnover band, site
        count, mixed dry materials, fire suppression):
      </div>
      <Row label="Profitable (LR ≤ 50%)" value={profitable} pct={pct(profitable)} />
      <Row label="Breakeven (LR 50-75%)" value={breakeven} pct={pct(breakeven)} />
      <Row label="Unprofitable (LR > 75%)" value={unprofitable} pct={pct(unprofitable)} />
    </div>
  );
}

function Row({ label, value, pct }: { label: string; value: number; pct: string }) {
  return (
    <>
      <span
        className="serif"
        style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}
      >
        {label}
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {value}
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-faint)' }}
      >
        {pct}
      </span>
    </>
  );
}

function FCT001Evidence({ meta }: { meta: Record<string, unknown> }) {
  const count = (meta.strongMatchCount as number) ?? 0;
  const threshold = ((meta.threshold as number) ?? 0).toFixed(2);
  return (
    <div
      className="serif"
      style={{ fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.55 }}
    >
      {count} historical binders cross the strong-match threshold (similarity ≥ {threshold}).
    </div>
  );
}

function FCT003Evidence({
  ourPremium,
  brokerTarget,
  sharpName,
}: {
  ourPremium: number | undefined;
  brokerTarget: number | null | undefined;
  sharpName: string | null | undefined;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        rowGap: 4,
        columnGap: 14,
        alignItems: 'baseline',
      }}
    >
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Our premium
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        £{(ourPremium ?? 0).toLocaleString('en-GB')}
      </span>
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Broker target
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {brokerTarget ? `£${brokerTarget.toLocaleString('en-GB')}` : '—'}
      </span>
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Sharp competitor
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {sharpName ?? '—'}
      </span>
    </div>
  );
}

function FCT004Evidence({ meta }: { meta: Record<string, unknown> }) {
  const issues = (meta.issues as string[]) ?? [];
  const fsConfirmed = meta.fireSuppressionConfirmed as boolean;
  const permit = meta.permitExpiresInTerm as
    | { siteName: string; expiry: string; permitRef: string }
    | null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        className="serif"
        style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}
      >
        Fire suppression: <span style={{ color: 'var(--color-ink)' }}>{fsConfirmed ? 'confirmed at all sites' : 'not confirmed'}</span>
      </div>
      {permit && (
        <div className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
          Permit warranty: <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>{permit.permitRef}</span>{' '}
          ({permit.siteName}) expires {permit.expiry}
        </div>
      )}
      {issues.length === 0 ? (
        <div
          className="serif"
          style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-ink-mute)' }}
        >
          No open subjectivity flags.
        </div>
      ) : (
        <div className="serif" style={{ fontSize: 13, color: 'var(--color-warn)' }}>
          {issues.length} open: {issues.join('; ')}
        </div>
      )}
    </div>
  );
}

function FCT005Evidence({ meta }: { meta: Record<string, unknown> }) {
  const broker = (meta.brokerName as string) ?? 'unknown';
  const prior = (meta.priorSubmissions as number) ?? 0;
  const bound = (meta.bound as number) ?? 0;
  const ntu = (meta.ntu as number) ?? 0;
  const declined = (meta.declined as number) ?? 0;
  const lr = (meta.averageBoundLossRatio as number) ?? 0;
  const winRate = (meta.winRate as number) ?? 0;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        rowGap: 4,
        columnGap: 14,
        alignItems: 'baseline',
      }}
    >
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Broker
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>{broker}</span>
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Prior submissions
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {prior}
      </span>
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Outcomes
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {bound} bound · {ntu} NTU · {declined} declined
      </span>
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Win rate
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {prior > 0 ? `${(winRate * 100).toFixed(0)}%` : '—'}
      </span>
      <span className="serif" style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
        Avg bound LR
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
        {prior > 0 ? `${(lr * 100).toFixed(0)}%` : '—'}
      </span>
    </div>
  );
}
