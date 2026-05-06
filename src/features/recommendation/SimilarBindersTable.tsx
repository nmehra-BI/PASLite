import type { HistoricalBinder } from '@/lib/fixtures';

type Props = {
  binders: HistoricalBinder[];
  /** Compact layout for inline use inside detail cards. */
  compact?: boolean;
};

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function SimilarBindersTable({ binders, compact = false }: Props) {
  if (binders.length === 0) {
    return (
      <div
        className="serif"
        style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--color-ink-faint)' }}
      >
        No similar binders.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact
          ? '70px 1fr 90px 60px 60px'
          : '80px 1fr 110px 70px 70px 80px',
        rowGap: 4,
        columnGap: 14,
        alignItems: 'baseline',
      }}
    >
      <Header compact={compact} />
      {binders.map((b) => (
        <BinderRow key={b.id} binder={b} compact={compact} />
      ))}
    </div>
  );
}

function Header({ compact }: { compact: boolean }) {
  const cls = compact
    ? ['ID', 'Insured', 'Bound', 'Turnover', 'LR']
    : ['ID', 'Insured', 'Bound', 'Turnover', 'Sites', 'LR'];
  return (
    <>
      {cls.map((label, i) => (
        <span
          key={i}
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
          }}
        >
          {label}
        </span>
      ))}
    </>
  );
}

function BinderRow({
  binder,
  compact,
}: {
  binder: HistoricalBinder;
  compact: boolean;
}) {
  const lr = binder.actualLossRatio;
  const lrText =
    lr !== null
      ? `${Math.round(lr * 100)}%`
      : binder.matured === false
        ? 'in-force'
        : '—';
  return (
    <>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-mute)', letterSpacing: '0.04em' }}
      >
        {binder.id}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--color-ink)' }}>
        {binder.insuredName}
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
      >
        {DATE_FMT.format(new Date(binder.boundAt))}
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-soft)', textAlign: 'right' }}
      >
        £{(binder.turnover / 1_000_000).toFixed(1)}M
      </span>
      {!compact && (
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--color-ink-soft)', textAlign: 'right' }}
        >
          {binder.siteCount}
        </span>
      )}
      <span
        className="mono"
        style={{
          fontSize: 11,
          color:
            lr === null
              ? 'var(--color-ink-faint)'
              : lr <= 0.5
                ? 'var(--color-success)'
                : lr <= 0.75
                  ? 'var(--color-warn)'
                  : 'var(--color-danger)',
          textAlign: 'right',
          fontWeight: 500,
        }}
      >
        {lrText}
      </span>
    </>
  );
}
