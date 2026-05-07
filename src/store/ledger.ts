import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ExportPeriod,
  ExportRequest,
  LedgerFilters,
  GeneratedReport,
} from '@/lib/ledger/types';
import type { DecisionClassId } from '@/lib/autonomy/types';

/**
 * Module 15 store — ledger filter state, current export draft, and
 * cached generated report. Persisted across navigation so the user
 * can drill into a class and come back without losing filters.
 */
type LedgerState = {
  filters: LedgerFilters;
  exportDraft: ExportRequest;
  exportModalOpen: boolean;
  /** Phase of the export modal: 'configure' (form) → 'preparing'
   *  (cinematic) → 'ready' (preview / send / download). */
  exportPhase: 'configure' | 'preparing' | 'ready';
  generatedReport: GeneratedReport | null;
  /** Confirmation banner state after sending to capacity provider. */
  exportSent: { recipient: string; chainHash: string } | null;

  setTab: (tab: LedgerFilters['tab']) => void;
  setSearch: (s: string) => void;
  toggleClassFilter: (id: DecisionClassId) => void;
  resetFilters: () => void;

  // Export modal
  openExport: () => void;
  closeExport: () => void;
  setExportPeriod: (p: ExportPeriod) => void;
  setExportFormat: (f: 'csv' | 'json') => void;
  setExportRecipient: (r: ExportRequest['recipient']) => void;
  toggleExportClass: (id: DecisionClassId) => void;
  setExportPhase: (phase: LedgerState['exportPhase']) => void;
  setGeneratedReport: (r: GeneratedReport | null) => void;
  setExportSent: (sent: LedgerState['exportSent']) => void;
};

const DEFAULT_FILTERS: LedgerFilters = {
  tab: 'all',
  search: '',
  classes: [],
};

const DEFAULT_EXPORT_DRAFT: ExportRequest = {
  period: { kind: 'last-calendar-month' },
  classes: [
    'TRIAGE-AUTO-PASS',
    'TRIAGE-AUTO-DECLINE',
    'BIND-AUTO-COMMIT',
    'CONFLICT-AUTO-RESOLVE',
    'NTU-AUTO-CAPTURE',
  ],
  format: 'csv',
  recipient: 'capacity-provider',
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

export const useLedger = create<LedgerState>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      exportDraft: DEFAULT_EXPORT_DRAFT,
      exportModalOpen: false,
      exportPhase: 'configure',
      generatedReport: null,
      exportSent: null,

      setTab: (tab) =>
        set((s) => ({ filters: { ...s.filters, tab } })),
      setSearch: (search) =>
        set((s) => ({ filters: { ...s.filters, search } })),
      toggleClassFilter: (id) =>
        set((s) => {
          const cur = s.filters.classes;
          const next = cur.includes(id)
            ? cur.filter((c) => c !== id)
            : [...cur, id];
          return { filters: { ...s.filters, classes: next } };
        }),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      openExport: () =>
        set({ exportModalOpen: true, exportPhase: 'configure', generatedReport: null }),
      closeExport: () =>
        set({
          exportModalOpen: false,
          exportPhase: 'configure',
          generatedReport: null,
        }),
      setExportPeriod: (period) =>
        set((s) => ({ exportDraft: { ...s.exportDraft, period } })),
      setExportFormat: (format) =>
        set((s) => ({ exportDraft: { ...s.exportDraft, format } })),
      setExportRecipient: (recipient) =>
        set((s) => ({ exportDraft: { ...s.exportDraft, recipient } })),
      toggleExportClass: (id) =>
        set((s) => {
          const cur = s.exportDraft.classes;
          const next = cur.includes(id)
            ? cur.filter((c) => c !== id)
            : [...cur, id];
          return { exportDraft: { ...s.exportDraft, classes: next } };
        }),
      setExportPhase: (exportPhase) => set({ exportPhase }),
      setGeneratedReport: (generatedReport) => set({ generatedReport }),
      setExportSent: (exportSent) => set({ exportSent }),
    }),
    {
      name: 'ranberri.ledger.v0',
      storage: createJSONStorage(() => safeStorage()),
      partialize: (s) => ({
        filters: s.filters,
        exportDraft: s.exportDraft,
      }),
    },
  ),
);
