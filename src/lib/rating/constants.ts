/**
 * Tier-2 W&R rating constants.
 *
 * These are the sealed factors of recyclesure_v3.2. Bumping the
 * version requires bumping `RATING_SHA` so the audit log carries the
 * new content hash and downstream replay knows it's a different sheet.
 */

export const RATING_VERSION = 'v3.2';
export const RATING_SHA = 'sha-7f2a';
export const RATING_TIER = 'Tier-2';

/** A1 — Tier-2 base rate (annualized). */
export const BASE_RATE = 0.0042; // 0.42%

/** C22 — site loading per additional site. */
export const SITE_LOAD_PER_EXTRA = 0.0095; // 0.95%

/** D31 — material hazard loadings, summed per class present. */
export const MATERIAL_FACTORS = {
  paper: 0.0,
  plastics: 0.015,
  metals: 0.006,
  /** Implicit umbrella factor when 2+ classes are handled together. */
  mixed: 0.012,
} as const;

/** D31-cap rule — material hazard load capped at 3.0%. */
export const MATERIAL_LOAD_CAP = 0.03;

/** E38 — fire-suppression treatment. */
export const FIRE_SUPPRESSION_LOADS = {
  present: 0,
  absent: 0.06,
  /** Undisclosed treated as absent — UW must resolve in module 3. */
  undisclosed: 0.06,
} as const;

/**
 * F44 — loss-credit bands. Keys are upper bounds (exclusive) for the
 * 5-year loss ratio; the engine picks the band whose upper bound the
 * LR is below.
 */
export const LOSS_RATIO_BANDS: Array<{ upper: number; factor: number }> = [
  { upper: 0.3, factor: -0.12 },
  { upper: 0.5, factor: -0.07 },
  { upper: 0.75, factor: 0 },
  { upper: 1.0, factor: 0.06 },
  { upper: Infinity, factor: 0.18 },
];

/** G51 — acquisition + expense load. */
export const ACQUISITION_LOAD = 0.18;

/**
 * Classify a material string into one of the known classes.
 * Returns null if the string doesn't match any known class.
 */
export function classifyMaterial(
  raw: string,
): 'paper' | 'plastics' | 'metals' | null {
  const l = raw.toLowerCase();
  if (l.includes('paper') || l.includes('cardboard')) return 'paper';
  if (l.includes('plastic')) return 'plastics';
  if (l.includes('metal')) return 'metals';
  return null;
}

/**
 * D31 — sum the per-class hazard loadings for the material array,
 * adding the implicit `mixed` factor when 2+ classes are handled.
 * Caps at MATERIAL_LOAD_CAP.
 */
export function materialHazardLoad(materials: string[]): number {
  const classes = new Set<'paper' | 'plastics' | 'metals'>();
  for (const m of materials) {
    const c = classifyMaterial(m);
    if (c) classes.add(c);
  }
  let sum = 0;
  for (const c of classes) sum += MATERIAL_FACTORS[c];
  if (classes.size >= 2) sum += MATERIAL_FACTORS.mixed;
  return Math.min(sum, MATERIAL_LOAD_CAP);
}

export function lossRatioFactor(lr: number): number {
  for (const band of LOSS_RATIO_BANDS) {
    if (lr < band.upper) return band.factor;
  }
  return LOSS_RATIO_BANDS[LOSS_RATIO_BANDS.length - 1]!.factor;
}
