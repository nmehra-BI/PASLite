/**
 * Competitor profiles. Names + pricing patterns + notes flow from
 * the active tenant config (see `competitors.competitors`); the
 * loss/binder counts are local to the fixture (cross-MGA binder
 * visibility is a separate concern).
 *
 * In production the per-competitor stats would be derived from the
 * losses/binders databases at query time; for the MVP they're a
 * small static set keyed by competitor id.
 */

import { getActiveConfig } from '@/config';

export type CompetitorProfile = {
  name: string;
  estimatedAggressiveness: 'sharp' | 'disciplined' | 'unknown';
  /** Typical discount range relative to our quote, as decimals. */
  typicalDiscount: { min: number; max: number } | null;
  /** Number of times we lost to them (in the losses fixture). */
  losses: number;
  /** Reserved for future cross-MGA binder visibility. */
  binders: number;
  /** Short editorial summary the recommendation can quote. */
  notes: string;
};

const STATS_BY_ID: Record<string, { losses: number; binders: number }> = {
  'COMP-REGENTMGA': { losses: 12, binders: 0 },
  'COMP-CAULFIELD': { losses: 8, binders: 0 },
  'COMP-BOLTREE': { losses: 4, binders: 0 },
};

const PROFILE_LABEL: Record<string, CompetitorProfile['estimatedAggressiveness']> = {
  sharp: 'sharp',
  aggressive: 'sharp',
  standard: 'disciplined',
  conservative: 'unknown',
};

export function getCompetitiveIntel(): CompetitorProfile[] {
  const config = getActiveConfig();
  return config.competitors.competitors.map((c) => {
    const stats = STATS_BY_ID[c.id] ?? { losses: 0, binders: 0 };
    return {
      name: c.name,
      estimatedAggressiveness: PROFILE_LABEL[c.profile] ?? 'unknown',
      typicalDiscount:
        c.profile === 'conservative'
          ? null
          : { min: c.typicalDiscountRange.min, max: c.typicalDiscountRange.max },
      losses: stats.losses,
      binders: stats.binders,
      notes: c.patternNotes,
    };
  });
}
