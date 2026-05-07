import { useEffect, useMemo } from 'react';
import { useRanBerri } from '@/store';
import {
  buildMorningBriefing,
  filterByTab,
  groupBySection,
  searchEntries,
} from '@/lib/listing';
import { useListingStore } from './listingStore';
import { HeroStrip } from './HeroStrip';
import { NavStrip } from './NavStrip';
import { ListSection } from './ListSection';

/**
 * The cockpit's home page. Editorial workspace surface — every row
 * is the cockpit speaking to the underwriter, and every action is
 * one click.
 */
export function ListingPage() {
  const entries = useListingStore((s) => s.entries);
  const filter = useListingStore((s) => s.filter);
  const query = useListingStore((s) => s.query);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);

  const filtered = useMemo(() => {
    let out = entries;
    if (filter !== 'all') out = filterByTab(out, filter);
    if (query.trim().length > 0) out = searchEntries(out, query);
    return out;
  }, [entries, filter, query]);

  const groups = useMemo(() => groupBySection(filtered), [filtered]);
  const briefing = useMemo(
    () =>
      buildMorningBriefing({
        underwriterName: 'Nishit',
        entries,
      }),
    [entries],
  );

  // Audit: log the listing view once per mount.
  useEffect(() => {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'listing.viewed',
      viewedBy: 'nm',
      entryCount: entries.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audit: search performed (debounced — only log non-empty queries
  // when they settle).
  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      appendAuditEvent({
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'listing.searchPerformed',
        viewedBy: 'nm',
        query,
        resultCount: filtered.length,
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [query, filtered.length, appendAuditEvent]);

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
      <HeroStrip briefing={briefing} />
      <NavStrip
        onNewSubmission={() => {
          window.location.hash = '#/submission/new';
        }}
      />
      <main style={{ flex: 1 }}>
        {groups.map((g, i) => {
          // Hide empty sections when a tab filter narrows the list,
          // but keep the "0 matching" hint when a search is active so
          // the user understands their query produced no hits.
          if (filter !== 'all' && g.count === 0) return null;
          return <ListSection key={g.key} group={g} index={i} />;
        })}
      </main>
      <Footer />
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
        MGA-PAS · folio 29481 · build 0.12
      </span>
    </div>
  );
}

function Footer() {
  return (
    <div
      className="hairline-t"
      style={{
        padding: '14px 36px',
        background: 'var(--color-bg)',
      }}
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
        the cockpit · listing surface · v0.12
      </p>
    </div>
  );
}
