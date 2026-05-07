import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * The canonical chapter identifiers — one per module's canvas
 * section. Ordered as they appear vertically on the canvas.
 */
export type ChapterId =
  | 'extraction'
  | 'enrichment'
  | 'triage'
  | 'rating'
  | 'quote'
  | 'recommendation'
  | 'bind'
  | 'mta-04'
  | 'cancellation'
  | 'renewal';

export type SectionState = 'pending' | 'current' | 'complete' | 'failed';

/**
 * UI state for the cockpit canvas — collapse states, manual
 * overrides, active chapter detection, and inspector navigation
 * history. Persisted to localStorage so the user's manual
 * expansions survive refresh.
 *
 * Keep this entirely separate from the audit-log-driven domain
 * stores. This slice has zero replay implications; it's pure UI
 * state that can be wiped without losing meaning.
 */
type CanvasUIState = {
  /** Per-chapter collapse override: undefined = follow auto-default,
   *  true = user expanded, false = user collapsed. */
  manualOverrides: Partial<Record<ChapterId, boolean>>;
  /** The chapter whose section header is currently nearest the top
   *  of the viewport — drives the active-state styling in the
   *  chapter nav. Updated by IntersectionObserver. */
  activeChapter: ChapterId | null;
  /** True while the quick-jump modal is open. */
  quickJumpOpen: boolean;
  /** Inspector navigation history — when a drawer is opened from
   *  inside another drawer, we push so the back button works. */
  inspectorHistory: Array<{
    kind: string;
    title: string;
    payload?: unknown;
  }>;
  /** Reference-counted record of which chapter anchors are currently
   *  mounted in the DOM. The chapter nav uses this to disable buttons
   *  whose target isn't in the current canvas. */
  presentChapters: Partial<Record<ChapterId, number>>;

  setManualOverride: (chapter: ChapterId, expanded: boolean | undefined) => void;
  setActiveChapter: (chapter: ChapterId | null) => void;
  setQuickJumpOpen: (open: boolean) => void;
  collapseAllCompleted: () => void;
  expandAllSections: () => void;
  pushInspector: (entry: { kind: string; title: string; payload?: unknown }) => void;
  popInspector: () => void;
  clearInspectorHistory: () => void;
  registerChapterPresence: (chapter: ChapterId, mounted: boolean) => void;
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

const ALL_CHAPTERS: ChapterId[] = [
  'extraction',
  'enrichment',
  'triage',
  'rating',
  'quote',
  'recommendation',
  'bind',
  'mta-04',
  'cancellation',
  'renewal',
];

export const useCanvasUI = create<CanvasUIState>()(
  persist(
    (set) => ({
      manualOverrides: {},
      activeChapter: null,
      quickJumpOpen: false,
      inspectorHistory: [],
      presentChapters: {},
      setManualOverride: (chapter, expanded) =>
        set((s) => {
          const next = { ...s.manualOverrides };
          if (expanded === undefined) delete next[chapter];
          else next[chapter] = expanded;
          return { manualOverrides: next };
        }),
      setActiveChapter: (chapter) => set({ activeChapter: chapter }),
      setQuickJumpOpen: (open) => set({ quickJumpOpen: open }),
      collapseAllCompleted: () =>
        set(() => {
          const next: Partial<Record<ChapterId, boolean>> = {};
          for (const c of ALL_CHAPTERS) next[c] = false;
          return { manualOverrides: next };
        }),
      expandAllSections: () =>
        set(() => {
          const next: Partial<Record<ChapterId, boolean>> = {};
          for (const c of ALL_CHAPTERS) next[c] = true;
          return { manualOverrides: next };
        }),
      pushInspector: (entry) =>
        set((s) => ({ inspectorHistory: [...s.inspectorHistory, entry] })),
      popInspector: () =>
        set((s) => ({ inspectorHistory: s.inspectorHistory.slice(0, -1) })),
      clearInspectorHistory: () => set({ inspectorHistory: [] }),
      registerChapterPresence: (chapter, mounted) =>
        set((s) => {
          const cur = s.presentChapters[chapter] ?? 0;
          const next = mounted ? cur + 1 : Math.max(0, cur - 1);
          return {
            presentChapters: { ...s.presentChapters, [chapter]: next },
          };
        }),
    }),
    {
      name: 'ranberri.canvas-ui.v0',
      storage: createJSONStorage(() => safeStorage()),
      partialize: (s) => ({
        manualOverrides: s.manualOverrides,
      }),
    },
  ),
);

export const ALL_CHAPTER_IDS = ALL_CHAPTERS;
