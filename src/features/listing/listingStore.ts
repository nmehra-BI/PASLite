import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FilterTab } from '@/lib/listing';
import { getListingDemo } from '@/lib/fixtures/listingDemo';
import type { ListingEntry } from '@/lib/listing/types';

/**
 * Sub-store for the listing page state. Keeps its own slice off the
 * main RanBerri store so the listing's UI state (filter, search,
 * chase receipts) doesn't pollute the audit-log replay.
 */
type ListingStoreState = {
  entries: ListingEntry[];
  filter: FilterTab;
  query: string;
  searchOpen: boolean;
  setFilter: (f: FilterTab) => void;
  setQuery: (q: string) => void;
  setSearchOpen: (o: boolean) => void;
  /** Stamp lastChaseAt on a given ref. Idempotent. */
  recordChase: (ref: string) => void;
};

function safeStorage(): Storage {
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as { localStorage?: Storage }).localStorage
  ) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
    key: (i) => Array.from(mem.keys())[i] ?? null,
  };
}

export const useListingStore = create<ListingStoreState>()(
  persist(
    (set) => ({
      entries: getListingDemo(),
      filter: 'all',
      query: '',
      searchOpen: false,
      setFilter: (f) => set({ filter: f }),
      setQuery: (q) => set({ query: q }),
      setSearchOpen: (o) => set({ searchOpen: o }),
      recordChase: (ref) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.ref === ref ? { ...e, lastChaseAt: new Date().toISOString() } : e,
          ),
        })),
    }),
    {
      name: 'ranberri.listing.v0',
      storage: createJSONStorage(() => safeStorage()),
      partialize: (s) => ({ filter: s.filter, entries: s.entries }),
    },
  ),
);
