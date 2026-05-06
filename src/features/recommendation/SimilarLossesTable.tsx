import type { LossToCompetitor } from '@/lib/fixtures';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function SimilarLossesTable({
  losses,
  compact = false,
  onRowClick,
}: {
  losses: LossToCompetitor[];
  compact?: boolean;
  onRowClick?: (loss: LossToCompetitor) => void;
}) {
  if (losses.length === 0) {
    return (
      <div
        className="serif"
        style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--color-ink-faint)' }}
      >
        No similar losses recorded.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <RowGrid compact={compact}>
        <Header compact={compact} />
      </RowGrid>
      {losses.map((l) => (
        <LossRow
          key={l.id}
          loss={l}
          compact={compact}
          onClick={onRowClick ? () => onRowClick(l) : undefined}
        />
      ))}
    </div>
  );
}

function RowGrid({
  compact,
  children,
  asButton,
  onClick,
}: {
  compact: boolean;
  children: React.ReactNode;
  asButton?: boolean;
  onClick?: () => void;
}) {
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: compact
      ? '70px 1fr 100px 100px 80px'
      : '80px 1fr 120px 100px 100px 100px',
    rowGap: 0,
    columnGap: 14,
    alignItems: 'baseline',
    padding: '4px 6px',
    borderRadius: 'var(--radius-button)',
    textAlign: 'left',
    width: '100%',
    background: 'transparent',
    cursor: asButton ? 'pointer' : 'default',
    transition: 'background 120ms cubic-bezier(0.4,0,0.2,1)',
  };
  if (asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-sunken)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {children}
      </button>
    );
  }
  return <div style={style}>{children}</div>;
}

function Header({ compact }: { compact: boolean }) {
  const cls = compact
    ? ['ID', 'Insured', 'Our quote', 'Theirs', 'Why']
    : ['ID', 'Insured', 'Lost', 'Our quote', 'Theirs', 'Why'];
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

function LossRow({
  loss,
  compact,
  onClick,
}: {
  loss: LossToCompetitor;
  compact: boolean;
  onClick?: () => void;
}) {
  return (
    <RowGrid compact={compact} asButton={!!onClick} onClick={onClick}>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-mute)', letterSpacing: '0.04em' }}
      >
        {loss.id}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--color-ink)' }}>
        {loss.insuredName}
      </span>
      {!compact && (
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
        >
          {DATE_FMT.format(new Date(loss.lostAt))}
        </span>
      )}
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-soft)', textAlign: 'right' }}
      >
        £{loss.ourQuotedPremium.toLocaleString('en-GB')}
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-ink-soft)', textAlign: 'right' }}
      >
        {loss.competitorWinningPremium
          ? `£${loss.competitorWinningPremium.toLocaleString('en-GB')}`
          : '—'}
        <span
          style={{
            fontStyle: 'italic',
            fontSize: 9.5,
            color: 'var(--color-ink-faint)',
            marginLeft: 4,
          }}
        >
          ({loss.confidenceInCompetitorPrice})
        </span>
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-ink-mute)',
          letterSpacing: '0.02em',
        }}
      >
        {loss.competitorWhoWon} · {loss.primaryReason}
      </span>
    </RowGrid>
  );
}
