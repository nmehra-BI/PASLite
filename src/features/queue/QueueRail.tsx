import { useRanBerri } from '@/store';

/**
 * The persistent left rail: the underwriter's queue / inbox. Empty in
 * module 1; module 2 seeds the Greenline submission as the first row.
 *
 * The affordance has to be visible from the start &mdash; even empty &mdash;
 * because the workstation's job is to make the queue feel like home.
 */
export function QueueRail() {
  const submission = useRanBerri((s) => s.submission);
  return (
    <aside
      className="hairline-r"
      style={{
        width: 268,
        flex: '0 0 268px',
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        className="hairline-b flex items-center justify-between"
        style={{ padding: '12px 16px', height: 44, flex: '0 0 auto' }}
      >
        <div className="eyebrow">inbox</div>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          {submission ? '1 active' : '0 active'}
        </span>
      </div>

      <div
        className="hairline-b flex items-center gap-2"
        style={{ padding: '8px 16px', flex: '0 0 auto' }}
      >
        <FilterChip active>open</FilterChip>
        <FilterChip>referred</FilterChip>
        <FilterChip>quoted</FilterChip>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {submission ? (
          <QueueRow
            broker="—"
            insured="Greenline Recycling Ltd"
            folio={submission.folio}
            received="just now"
            active
          />
        ) : (
          <Empty />
        )}
      </div>

      <div
        className="hairline-t"
        style={{
          padding: '10px 16px',
          flex: '0 0 auto',
          background: 'var(--color-bg)',
        }}
      >
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-faint)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          one canvas per risk
        </p>
      </div>
    </aside>
  );
}

function FilterChip({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        color: active ? 'var(--color-ink)' : 'var(--color-ink-mute)',
        background: active ? 'var(--color-sunken)' : 'transparent',
        borderRadius: 'var(--radius-pill)',
      }}
    >
      {children}
    </span>
  );
}

function QueueRow({
  broker,
  insured,
  folio,
  received,
  active = false,
}: {
  broker: string;
  insured: string;
  folio: string;
  received: string;
  active?: boolean;
}) {
  return (
    <div
      style={{
        padding: '10px 16px',
        background: active ? 'var(--color-sunken)' : 'transparent',
        borderLeft: active
          ? '1.5px solid var(--color-accent)'
          : '1.5px solid transparent',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        {insured}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'var(--color-ink-mute)',
          letterSpacing: '0.04em',
          marginTop: 1,
        }}
      >
        {folio} · {broker}
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-faint)',
          marginTop: 2,
        }}
      >
        {received}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ padding: '24px 16px' }}>
      <div
        className="hairline"
        style={{
          padding: '14px 14px',
          borderStyle: 'dashed',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-bg)',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          empty
        </div>
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          No submissions in queue. The first broker email arrives in
          module&nbsp;2.
        </p>
      </div>
    </div>
  );
}
