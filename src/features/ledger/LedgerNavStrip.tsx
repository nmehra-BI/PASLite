import { Search, Download } from 'lucide-react';
import { useLedger } from '@/store/ledger';
import type { LedgerFilters } from '@/lib/ledger';

const TABS: Array<{ key: LedgerFilters['tab']; label: string }> = [
  { key: 'all', label: 'All actions' },
  { key: 'last-7-days', label: 'Last 7 days' },
  { key: 'last-30-days', label: 'Last 30 days' },
  { key: 'recalled', label: 'Recalled' },
  { key: 'at-risk', label: 'At risk' },
];

/**
 * Module 15 — ledger filter strip. Mirrors the listing page's
 * NavStrip pattern: tabs left, search + export right.
 */
export function LedgerNavStrip() {
  const filters = useLedger((s) => s.filters);
  const setTab = useLedger((s) => s.setTab);
  const setSearch = useLedger((s) => s.setSearch);
  const openExport = useLedger((s) => s.openExport);

  return (
    <nav
      className="hairline-b"
      style={{
        padding: '14px 36px',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
      }}
    >
      <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = filters.tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
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
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="hairline inline-flex items-center"
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-button)',
            background: 'var(--color-surface)',
            gap: 6,
          }}
        >
          <Search size={12} strokeWidth={1.5} style={{ color: 'var(--color-ink-faint)' }} />
          <input
            type="search"
            value={filters.search}
            placeholder="ref, insured, broker, class"
            onChange={(e) => setSearch(e.target.value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'var(--color-ink)',
              width: 220,
              letterSpacing: '0.04em',
            }}
          />
        </div>
        <button
          type="button"
          onClick={openExport}
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-bg)',
            background: 'var(--color-accent)',
            border: '0.5px solid var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          <Download size={11} strokeWidth={1.5} />
          Export
        </button>
      </div>
    </nav>
  );
}
