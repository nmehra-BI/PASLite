import { Search, Plus } from 'lucide-react';
import { useListingStore } from './listingStore';
import type { FilterTab } from '@/lib/listing';

const TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All submissions' },
  { key: 'in-flight', label: 'In flight' },
  { key: 'bound', label: 'Bound' },
  { key: 'closed', label: 'Recently terminated' },
];

export function NavStrip({ onNewSubmission }: { onNewSubmission: () => void }) {
  const filter = useListingStore((s) => s.filter);
  const setFilter = useListingStore((s) => s.setFilter);
  const searchOpen = useListingStore((s) => s.searchOpen);
  const setSearchOpen = useListingStore((s) => s.setSearchOpen);
  const query = useListingStore((s) => s.query);
  const setQuery = useListingStore((s) => s.setQuery);

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
          const active = filter === t.key;
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
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {searchOpen ? (
          <input
            autoFocus
            type="search"
            value={query}
            placeholder="ref, insured, broker"
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (!query) setSearchOpen(false);
            }}
            className="hairline"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink)',
              width: 220,
              letterSpacing: '0.04em',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="inline-flex items-center justify-center"
            style={{
              padding: 6,
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-ink-mute)',
              background: 'transparent',
              border: 0,
            }}
          >
            <Search size={14} strokeWidth={1.5} />
          </button>
        )}
        <button
          type="button"
          onClick={onNewSubmission}
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
          }}
        >
          <Plus size={11} strokeWidth={1.5} />
          New submission
        </button>
      </div>
    </nav>
  );
}
