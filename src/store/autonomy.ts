import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  getAutonomyMetrics,
  getExceptionQueueSeed,
  getSeedAutonomyPolicy,
} from '@/lib/fixtures';
import type {
  AutonomyPolicy,
  DecisionClassConfig,
  DecisionClassId,
  DecisionClassMetrics,
  ExceptionRecord,
  ExecutedAutonomousAction,
  ScheduledAutonomousAction,
} from '@/lib/autonomy/types';

/**
 * Module 14 store — autonomy policy + scheduled / fired / recalled
 * actions + exception queue. Separate slice so the listing /
 * cockpit core stays untouched.
 */
type AutonomyState = {
  policy: AutonomyPolicy;
  metrics: Record<DecisionClassId, DecisionClassMetrics>;
  scheduledByRef: Record<string, ScheduledAutonomousAction>;
  firedByRef: Record<string, ExecutedAutonomousAction>;
  exceptions: ExceptionRecord[];

  // Policy mutations
  toggleClass: (id: DecisionClassId, enabled: boolean, by: string) => void;
  updateClass: (id: DecisionClassId, patch: Partial<DecisionClassConfig>, by: string) => void;

  // Action lifecycle
  scheduleAction: (a: ScheduledAutonomousAction) => void;
  fireAction: (a: ExecutedAutonomousAction) => void;
  recallAction: (entryRef: string, reason: string, at: string) => void;

  // Exceptions
  pushException: (r: ExceptionRecord) => void;
  resolveException: (entryRef: string) => void;
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

export const useAutonomy = create<AutonomyState>()(
  persist(
    (set) => ({
      policy: getSeedAutonomyPolicy(),
      metrics: getAutonomyMetrics(),
      scheduledByRef: {},
      firedByRef: {},
      exceptions: getExceptionQueueSeed(),

      toggleClass: (id, enabled, _by) =>
        set((s) => {
          const cls = s.policy.decisionClasses[id];
          if (!cls) return s;
          return {
            policy: {
              ...s.policy,
              decisionClasses: {
                ...s.policy.decisionClasses,
                [id]: { ...cls, enabled },
              },
            },
          };
        }),

      updateClass: (id, patch, _by) =>
        set((s) => {
          const cls = s.policy.decisionClasses[id];
          if (!cls) return s;
          return {
            policy: {
              ...s.policy,
              decisionClasses: {
                ...s.policy.decisionClasses,
                [id]: { ...cls, ...patch },
              },
            },
          };
        }),

      scheduleAction: (a) =>
        set((s) => ({
          scheduledByRef: { ...s.scheduledByRef, [a.entryRef]: a },
        })),

      fireAction: (a) =>
        set((s) => {
          const nextScheduled = { ...s.scheduledByRef };
          delete nextScheduled[a.entryRef];
          return {
            scheduledByRef: nextScheduled,
            firedByRef: { ...s.firedByRef, [a.entryRef]: a },
          };
        }),

      recallAction: (entryRef, reason, at) =>
        set((s) => {
          const fired = s.firedByRef[entryRef];
          if (!fired) return s;
          return {
            firedByRef: {
              ...s.firedByRef,
              [entryRef]: {
                ...fired,
                recalled: true,
                recalledAt: at,
                recallReason: reason,
              },
            },
          };
        }),

      pushException: (r) =>
        set((s) => {
          if (s.exceptions.some((e) => e.entryRef === r.entryRef)) return s;
          return { exceptions: [r, ...s.exceptions] };
        }),

      resolveException: (entryRef) =>
        set((s) => ({
          exceptions: s.exceptions.filter((e) => e.entryRef !== entryRef),
        })),
    }),
    {
      name: 'ranberri.autonomy.v0',
      storage: createJSONStorage(() => safeStorage()),
      partialize: (s) => ({
        policy: s.policy,
        scheduledByRef: s.scheduledByRef,
        firedByRef: s.firedByRef,
        exceptions: s.exceptions,
      }),
    },
  ),
);
