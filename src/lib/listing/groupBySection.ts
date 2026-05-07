/**
 * Group listing entries by their section, in priority order:
 *
 *   needs-attention → awaiting-broker → in-force → recently-closed
 *
 * Within each section, entries sort by priority then last-activity
 * (most recent first within the same priority bucket).
 */

import type { ListingEntry, ListingPriority, ListingSection } from './types';

const SECTION_ORDER: ListingSection[] = [
  'needs-attention',
  'awaiting-broker',
  'in-force',
  'recently-closed',
];

const SECTION_LABEL: Record<ListingSection, string> = {
  'needs-attention': 'NEEDS YOUR ATTENTION',
  'awaiting-broker': 'AWAITING BROKER',
  'in-force': 'BOUND · IN FORCE',
  'recently-closed': 'RECENTLY CLOSED',
};

const PRIORITY_RANK: Record<ListingPriority, number> = {
  high: 0,
  medium: 1,
  watch: 2,
  steady: 3,
};

export type SectionGroup = {
  key: ListingSection;
  label: string;
  entries: ListingEntry[];
  count: number;
};

export function groupBySection(entries: ListingEntry[]): SectionGroup[] {
  return SECTION_ORDER.map((key) => {
    const filtered = entries.filter((e) => e.section === key);
    filtered.sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
    return {
      key,
      label: SECTION_LABEL[key],
      entries: filtered,
      count: filtered.length,
    };
  });
}

/** Filter entries by case-insensitive substring across ref, insured, broker. */
export function searchEntries(entries: ListingEntry[], query: string): ListingEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    e.ref.toLowerCase().includes(q) ||
    e.insuredName.toLowerCase().includes(q) ||
    e.brokerName.toLowerCase().includes(q),
  );
}

/** Filter entries by tab. 'all' = pass-through. */
export type FilterTab = 'all' | 'in-flight' | 'bound' | 'closed';

export function filterByTab(entries: ListingEntry[], tab: FilterTab): ListingEntry[] {
  if (tab === 'all') return entries;
  if (tab === 'in-flight') {
    return entries.filter(
      (e) => e.section === 'needs-attention' || e.section === 'awaiting-broker',
    );
  }
  if (tab === 'bound') return entries.filter((e) => e.section === 'in-force');
  if (tab === 'closed') return entries.filter((e) => e.section === 'recently-closed');
  return entries;
}
