import type { HistoricalBinder, LossToCompetitor } from '@/lib/fixtures';

/**
 * Risk profile attributes used for matching. Both submissions and
 * historical records project down to this shape.
 */
export type RiskProfile = {
  turnover: number;
  siteCount: number;
  materials: string[];
  fireSuppression: 'present' | 'absent' | 'undisclosed';
  priorLossRatio: number;
  geography: string[];
};

const W_TURNOVER = 0.3;
const W_SITES = 0.15;
const W_MATERIALS = 0.25;
const W_LR = 0.2;
const W_GEOGRAPHY = 0.1;

/** Normalise a material string to one of the known classes. */
function classifyMaterial(raw: string): 'paper' | 'plastics' | 'metals' | null {
  const l = raw.toLowerCase();
  if (l.includes('paper') || l.includes('cardboard')) return 'paper';
  if (l.includes('plastic')) return 'plastics';
  if (l.includes('metal')) return 'metals';
  return null;
}

function materialClasses(materials: string[]): Set<string> {
  const out = new Set<string>();
  for (const m of materials) {
    const c = classifyMaterial(m);
    if (c) out.add(c);
  }
  return out;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const unionSize = a.size + b.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

function turnoverSimilarity(a: number, b: number): number {
  const max = Math.max(a, b);
  if (max === 0) return 1;
  const delta = Math.abs(a - b) / max;
  return Math.max(0, 1 - delta);
}

function siteCountSimilarity(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return Math.max(0, 1 - delta / 5);
}

function lossRatioSimilarity(a: number, b: number): number {
  const delta = Math.abs(a - b);
  // 0 → identical band; 1 → opposite ends of [0,1]
  return Math.max(0, 1 - delta / 0.5);
}

/**
 * Weighted similarity score in [0, 1]. 1 = identical profile, 0 = no
 * meaningful overlap. The weights are tuned so the curated Greenline-
 * matching binders score above 0.7 and the outliers below 0.4.
 */
export function similarity(a: RiskProfile, b: RiskProfile): number {
  const score =
    W_TURNOVER * turnoverSimilarity(a.turnover, b.turnover) +
    W_SITES * siteCountSimilarity(a.siteCount, b.siteCount) +
    W_MATERIALS * jaccard(materialClasses(a.materials), materialClasses(b.materials)) +
    W_LR * lossRatioSimilarity(a.priorLossRatio, b.priorLossRatio) +
    W_GEOGRAPHY * jaccard(new Set(a.geography), new Set(b.geography));
  return score;
}

/** Project a historical binder down to a risk profile. */
export function profileFromBinder(b: HistoricalBinder): RiskProfile {
  return {
    turnover: b.turnover,
    siteCount: b.siteCount,
    materials: b.materials,
    fireSuppression: b.fireSuppression,
    priorLossRatio: b.priorLossRatio,
    geography: b.geography,
  };
}

/** Project a loss-to-competitor record down to a risk profile. */
export function profileFromLoss(l: LossToCompetitor): RiskProfile {
  return {
    turnover: l.turnover,
    siteCount: l.siteCount,
    materials: l.materials,
    fireSuppression: l.fireSuppression,
    priorLossRatio: l.priorLossRatio,
    geography: l.geography,
  };
}

/**
 * Rank a corpus by similarity to the target profile and return the top
 * N (records with score below `minScore` are filtered out so the
 * recommendation never cites genuinely-unlike records).
 */
export function topSimilar<T>(
  corpus: T[],
  toProfile: (r: T) => RiskProfile,
  target: RiskProfile,
  n: number,
  minScore = 0.5,
): Array<{ record: T; score: number }> {
  return corpus
    .map((record) => ({ record, score: similarity(toProfile(record), target) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
