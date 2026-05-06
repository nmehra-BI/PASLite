/**
 * Hand-curated competitor profiles. In production these would be
 * derived from the losses/binders databases at query time; for the
 * MVP they're a small static set so the recommendation engine has
 * named competitors with realistic pricing behaviour to cite.
 */

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

export function getCompetitiveIntel(): CompetitorProfile[] {
  return [
    {
      name: 'RegentMGA',
      estimatedAggressiveness: 'sharp',
      typicalDiscount: { min: -0.15, max: -0.08 },
      losses: 12,
      binders: 0,
      notes:
        'Consistently undercuts on Tier-2 W&R; LR pattern unknown but suspected high.',
    },
    {
      name: 'Caulfield Underwriting',
      estimatedAggressiveness: 'disciplined',
      typicalDiscount: { min: -0.02, max: 0.01 },
      losses: 8,
      binders: 0,
      notes:
        'Broker-relationship driven; pricing rarely the deciding factor.',
    },
    {
      name: 'Boltree Specialty',
      estimatedAggressiveness: 'unknown',
      typicalDiscount: null,
      losses: 4,
      binders: 0,
      notes: 'Rarely encountered in this segment; trades on broader sub-limits.',
    },
  ];
}
