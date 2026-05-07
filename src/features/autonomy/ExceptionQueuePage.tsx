import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useAutonomy } from '@/store/autonomy';
import { useConfig } from '@/config';
import { useRanBerri } from '@/store';
import { Pill } from '@/components';
import type {
  ExceptionPriority,
  ExceptionRecord,
} from '@/lib/autonomy/types';
import { lookupExceptionInsured } from './exceptionInsureds';

type CategoryFilter =
  | 'all'
  | 'confidence'
  | 'conflict'
  | 'capacity'
  | 'sanctions'
  | 'profile-edge'
  | 'broker-history';

const TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: 'All exceptions' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'conflict', label: 'Conflicts' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'sanctions', label: 'Sanctions' },
  { key: 'profile-edge', label: 'Profile edge' },
  { key: 'broker-history', label: 'Broker history' },
];

const PRIORITY_GROUPS: Array<{
  key: ExceptionPriority;
  title: string;
  marginalia: string;
}> = [
  {
    key: 'high',
    title: 'High priority',
    marginalia: 'flagged within the last 36 hours · review today',
  },
  {
    key: 'medium',
    title: 'Needs review this week',
    marginalia: 'edge cases the cockpit could not resolve confidently',
  },
  {
    key: 'low',
    title: 'Monitoring',
    marginalia: 'logged for pattern-tracking · no urgency',
  },
];

const TIME_FMT = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

function relativeTime(iso: string): string {
  const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (diffH < 36) return TIME_FMT.format(-Math.round(diffH), 'hour');
  return TIME_FMT.format(-Math.round(diffH / 24), 'day');
}

/**
 * Module 14 — Exception queue page (/exceptions).
 *
 * The underwriter's review surface for everything the AI flagged but
 * could not act on autonomously. Every row is one of: confidence
 * below band, conflict the cockpit can't resolve, capacity edge,
 * sanctions ambiguity, profile mismatch, or broker history thin.
 */
export function ExceptionQueuePage() {
  const exceptions = useAutonomy((s) => s.exceptions);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return exceptions;
    return exceptions.filter((e) => e.reasonCategory === filter);
  }, [exceptions, filter]);

  const grouped = useMemo(() => {
    const out: Record<ExceptionPriority, ExceptionRecord[]> = {
      high: [],
      medium: [],
      low: [],
    };
    for (const e of filtered) out[e.priority].push(e);
    return out;
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<ExceptionPriority, number> = { high: 0, medium: 0, low: 0 };
    for (const e of exceptions) c[e.priority]++;
    return c;
  }, [exceptions]);

  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <Masthead />

      <header
        className="hairline-b"
        style={{
          padding: '28px 36px 22px',
          background: 'var(--color-surface)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/';
          }}
          className="serif inline-flex items-center gap-1"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={11} strokeWidth={1.5} />
          back to listing
        </button>
        <h1
          className="serif"
          style={{
            fontSize: 24,
            fontWeight: 500,
            margin: 0,
            color: 'var(--color-ink)',
            letterSpacing: '-0.012em',
          }}
        >
          Exception queue
        </h1>
        <p
          className="serif"
          style={{
            fontSize: 14,
            color: 'var(--color-ink-mute)',
            marginTop: 6,
            maxWidth: 720,
            lineHeight: 1.6,
            letterSpacing: '-0.005em',
          }}
        >
          {exceptions.length} cases the cockpit could not resolve autonomously —{' '}
          <span style={{ color: 'var(--color-danger)' }}>
            {counts.high} high
          </span>
          ,{' '}
          <span style={{ color: 'var(--color-warn)' }}>
            {counts.medium} this week
          </span>
          , {counts.low} monitoring. Each one is worth a senior glance.
        </p>
      </header>

      <nav
        className="hairline-b"
        style={{
          padding: '14px 36px',
          background: 'var(--color-bg)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {TABS.map((t) => {
          const active = filter === t.key;
          const count =
            t.key === 'all'
              ? exceptions.length
              : exceptions.filter((e) => e.reasonCategory === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className="serif"
              style={{
                fontSize: 13,
                fontStyle: 'italic',
                color: active ? 'var(--color-ink)' : 'var(--color-ink-mute)',
                background: active ? 'var(--color-sunken)' : 'transparent',
                padding: '4px 12px',
                borderRadius: 'var(--radius-button)',
                border: 0,
                cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}
            >
              {t.label}
              <span
                className="mono"
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: 'var(--color-ink-faint)',
                  letterSpacing: '0.06em',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      <main style={{ flex: 1 }}>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          PRIORITY_GROUPS.map((g) => {
            const rows = grouped[g.key];
            if (rows.length === 0) return null;
            return <PriorityGroup key={g.key} group={g} rows={rows} />;
          })
        )}
      </main>

      <Footer />
    </div>
  );
}

function PriorityGroup({
  group,
  rows,
}: {
  group: { key: ExceptionPriority; title: string; marginalia: string };
  rows: ExceptionRecord[];
}) {
  return (
    <section style={{ padding: '20px 36px 4px' }}>
      <header style={{ marginBottom: 12 }}>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color:
              group.key === 'high'
                ? 'var(--color-danger)'
                : group.key === 'medium'
                  ? 'var(--color-warn)'
                  : 'var(--color-ink-faint)',
          }}
        >
          {group.title} · {rows.length}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {group.marginalia}
        </div>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => (
          <ExceptionRow key={r.entryRef} record={r} />
        ))}
      </div>
    </section>
  );
}

const PRIORITY_TONE: Record<
  ExceptionPriority,
  { label: string; color: string }
> = {
  high: { label: 'HIGH', color: 'var(--color-danger)' },
  medium: { label: 'MEDIUM', color: 'var(--color-warn)' },
  low: { label: 'LOW', color: 'var(--color-ink-mute)' },
};

const CATEGORY_LABEL: Record<ExceptionRecord['reasonCategory'], string> = {
  confidence: 'confidence',
  conflict: 'conflict',
  capacity: 'capacity',
  sanctions: 'sanctions',
  'profile-edge': 'profile edge',
  'broker-history': 'broker history',
};

function ExceptionRow({ record }: { record: ExceptionRecord }) {
  const resolveException = useAutonomy((s) => s.resolveException);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const tone = PRIORITY_TONE[record.priority];
  const insured = lookupExceptionInsured(record.entryRef);

  function onReview() {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'listing.actionTaken',
      viewedBy: 'nm',
      entryRef: record.entryRef,
      actionId: 'review-exception',
    });
    window.location.hash = `#/submission/${record.entryRef.toLowerCase()}`;
  }

  function onResolve() {
    resolveException(record.entryRef);
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'listing.actionTaken',
      viewedBy: 'nm',
      entryRef: record.entryRef,
      actionId: 'resolve-exception',
    });
  }

  return (
    <article
      style={{
        padding: '14px 0 16px',
        borderBottom: '0.5px solid var(--color-rule)',
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 16, marginBottom: 6 }}
      >
        <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              fontSize: 13,
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-mono)',
              width: 14,
              display: 'inline-block',
            }}
          >
            ⚡
          </span>
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--color-ink-soft)',
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            {record.entryRef}
          </span>
          <span
            className="serif"
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {insured}
          </span>
          <Pill
            tone={
              record.reasonCategory === 'sanctions'
                ? 'danger'
                : record.reasonCategory === 'capacity'
                  ? 'warn'
                  : 'accent'
            }
            mono
          >
            {CATEGORY_LABEL[record.reasonCategory].toUpperCase()}
          </Pill>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tone.color,
            fontWeight: 500,
            flex: '0 0 auto',
          }}
        >
          {tone.label}
        </span>
      </div>

      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-soft)',
          paddingLeft: 26,
          letterSpacing: '-0.005em',
          lineHeight: 1.55,
        }}
      >
        {record.reason}
      </div>

      {record.marginalia && (
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-faint)',
            paddingLeft: 26,
            marginTop: 3,
            letterSpacing: '-0.005em',
            lineHeight: 1.5,
          }}
        >
          {record.marginalia}
        </div>
      )}

      <div
        className="flex items-center"
        style={{ paddingLeft: 26, marginTop: 10, gap: 8 }}
      >
        <button
          type="button"
          onClick={onReview}
          className="inline-flex items-center gap-1"
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-bg)',
            background: 'var(--color-accent)',
            border: '0.5px solid var(--color-accent)',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}
        >
          Review &amp; resolve
          <ArrowUpRight size={11} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onResolve}
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            background: 'transparent',
            border: 0,
            padding: '4px 8px',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}
        >
          dismiss
        </button>
        <span
          className="mono"
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          flagged {relativeTime(record.flaggedAt)}
        </span>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div
      className="serif"
      style={{
        padding: '60px 36px',
        fontStyle: 'italic',
        fontSize: 14,
        color: 'var(--color-ink-mute)',
        textAlign: 'center',
        letterSpacing: '-0.005em',
      }}
    >
      No exceptions match this filter. The cockpit is clear.
    </div>
  );
}

function Masthead() {
  const config = useConfig();
  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{
        height: 44,
        padding: '0 36px',
        background: 'var(--color-surface)',
      }}
    >
      <span
        className="serif"
        style={{
          fontSize: 14.5,
          fontWeight: 500,
          letterSpacing: '-0.018em',
          color: 'var(--color-ink)',
        }}
      >
        {config.branding.productName}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.06em',
          color: 'var(--color-ink-mute)',
        }}
      >
        autonomy · exception queue · v0.14
      </span>
    </div>
  );
}

function Footer() {
  return (
    <div
      className="hairline-t"
      style={{ padding: '14px 36px', background: 'var(--color-bg)' }}
    >
      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-faint)',
          margin: 0,
          letterSpacing: '-0.005em',
        }}
      >
        the cockpit · exception queue · v0.14
      </p>
    </div>
  );
}
