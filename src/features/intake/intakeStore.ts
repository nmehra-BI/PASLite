import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * The intake feature owns its own sub-store for the cinematic state
 * machine. UI-only state &mdash; the canonical submission lands in
 * the main `useRanBerri` store at `phase === 'complete'`.
 *
 * Phases:
 *   idle        — no submission active; the IntakeButton is shown
 *   receiving   — the email has been "opened"; UI begins splitting
 *   reading     — slip pages flash through (p1 → p4)
 *   extracting  — fields appear staggered; source lines highlight
 *   complete    — the editorial extracted view is rendered
 */
export type IntakePhase =
  | 'idle'
  | 'receiving'
  | 'reading'
  | 'extracting'
  | 'complete';

/**
 * The inspector can target three things: a Field<T> on the submission
 * tree, an enrichment source (raw payload), or a detected/resolved
 * conflict. At most one is active at a time.
 */
export type InspectorTarget =
  | { kind: 'field'; path: string }
  | { kind: 'source'; sourceId: string }
  | { kind: 'conflict'; conflictId: string };

export type IntakeUI = {
  phase: IntakePhase;
  /** Page currently visible in the slip preview (1..4). */
  slipPage: number;
  /** Source ref currently highlighted on the slip preview. */
  highlightedSourceRef: string | null;
  /** Field keys (path) revealed so far during extracting. */
  revealedFields: Set<string>;
  /** Field paths that should pulse warn (the gap). */
  pulsingFields: Set<string>;
  /** Inspector target — at most one active. */
  inspectorTarget: InspectorTarget | null;
  /** Last extraction completion timestamp. */
  completedAt: string | null;
  /** Avg confidence reported by the extractor at completion. */
  avgConfidence: number | null;
  /** Number of fields revealed at completion. */
  fieldCount: number | null;

  // actions
  setPhase: (phase: IntakePhase) => void;
  setSlipPage: (page: number) => void;
  setHighlightedSourceRef: (ref: string | null) => void;
  revealField: (path: string, opts?: { pulse?: boolean }) => void;
  clearPulse: (path: string) => void;
  openInspector: (path: string) => void;
  openSourceInspector: (sourceId: string) => void;
  openConflictInspector: (conflictId: string) => void;
  closeInspector: () => void;
  finalize: (opts: { avgConfidence: number; fieldCount: number; at: string }) => void;
  resetForRerun: () => void;
};

export const useIntake = create<IntakeUI>()(
  immer((set) => ({
    phase: 'idle',
    slipPage: 1,
    highlightedSourceRef: null,
    revealedFields: new Set(),
    pulsingFields: new Set(),
    inspectorTarget: null,
    completedAt: null,
    avgConfidence: null,
    fieldCount: null,

    setPhase: (phase) =>
      set((s) => {
        s.phase = phase;
      }),

    setSlipPage: (page) =>
      set((s) => {
        s.slipPage = page;
      }),

    setHighlightedSourceRef: (ref) =>
      set((s) => {
        s.highlightedSourceRef = ref;
      }),

    revealField: (path, opts) =>
      set((s) => {
        s.revealedFields.add(path);
        if (opts?.pulse) s.pulsingFields.add(path);
      }),

    clearPulse: (path) =>
      set((s) => {
        s.pulsingFields.delete(path);
      }),

    openInspector: (path) =>
      set((s) => {
        s.inspectorTarget = { kind: 'field', path };
      }),

    openSourceInspector: (sourceId) =>
      set((s) => {
        s.inspectorTarget = { kind: 'source', sourceId };
      }),

    openConflictInspector: (conflictId) =>
      set((s) => {
        s.inspectorTarget = { kind: 'conflict', conflictId };
      }),

    closeInspector: () =>
      set((s) => {
        s.inspectorTarget = null;
      }),

    finalize: ({ avgConfidence, fieldCount, at }) =>
      set((s) => {
        s.phase = 'complete';
        s.avgConfidence = avgConfidence;
        s.fieldCount = fieldCount;
        s.completedAt = at;
      }),

    resetForRerun: () =>
      set((s) => {
        s.phase = 'receiving';
        s.slipPage = 1;
        s.highlightedSourceRef = null;
        s.revealedFields = new Set();
        s.pulsingFields = new Set();
        s.completedAt = null;
        s.avgConfidence = null;
        s.fieldCount = null;
      }),
  })),
);
