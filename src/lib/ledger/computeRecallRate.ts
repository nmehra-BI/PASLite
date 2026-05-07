/**
 * Module 15 — per-class recall rate.
 */

import type { AutonomyAction } from './types';

export function computeRecallRate(actions: AutonomyAction[]): {
  recalled: number;
  total: number;
  rate: number;
} {
  if (actions.length === 0) return { recalled: 0, total: 0, rate: 0 };
  const recalled = actions.filter((a) => a.recalled).length;
  return {
    recalled,
    total: actions.length,
    rate: recalled / actions.length,
  };
}
