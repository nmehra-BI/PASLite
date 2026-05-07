import { useEffect, useMemo, useState } from 'react';
import { useRanBerri } from '@/store';
import { useAutonomy } from '@/store/autonomy';
import { useLedger } from '@/store/ledger';
import {
  aggregateByClass,
  queryAutonomyActions,
} from '@/lib/ledger';
import { LedgerHeader } from './LedgerHeader';
import { LedgerNavStrip } from './LedgerNavStrip';
import { LedgerSection } from './LedgerSection';
import { ExportModal } from './ExportModal';

/**
 * Module 15 — ledger main page. Aggregates the ~30-day fixture +
 * any live actions into per-class summaries, then renders one
 * editorial section per class. Filter state lives in useLedger;
 * filter changes re-derive the section list.
 */
export function LedgerPage() {
  const filters = useLedger((s) => s.filters);
  const policy = useAutonomy((s) => s.policy);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const [variantSeed] = useState(() => Math.floor(Math.random() * 1000));

  const filtered = useMemo(
    () => queryAutonomyActions(filters, new Date()),
    [filters],
  );
  const summaries = useMemo(
    () => aggregateByClass(filtered, policy),
    [filtered, policy],
  );

  // Audit: log the ledger view once per mount.
  useEffect(() => {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'ledger.viewed',
      viewedBy: 'nm',
      actionCount: filtered.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audit: log filter change (debounced — only when settled).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      appendAuditEvent({
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'ledger.filtered',
        viewedBy: 'nm',
        filter: filters.tab,
        searchQuery: filters.search.trim() || null,
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [filters.tab, filters.search, appendAuditEvent]);

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
      <LedgerHeader actions={filtered} variantSeed={variantSeed} />
      <LedgerNavStrip />
      <main style={{ flex: 1 }}>
        {filtered.length === 0 && filters.tab !== 'all' ? (
          <EmptyFilter />
        ) : (
          summaries.map((s, i) => (
            <LedgerSection
              key={s.classId}
              summary={s}
              index={i}
              onDrill={() => {
                window.location.hash = `#/ledger/${s.classId.toLowerCase()}`;
              }}
            />
          ))
        )}
      </main>
      <Footer />
      <ExportModal />
    </div>
  );
}

function Masthead() {
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
        RanBerri
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.06em',
          color: 'var(--color-ink-mute)',
        }}
      >
        autonomy · ledger · v0.15
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
        the cockpit · autonomy ledger · v0.15
      </p>
    </div>
  );
}

function EmptyFilter() {
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
      No actions match this filter. Try widening the date range or clearing
      search.
    </div>
  );
}
