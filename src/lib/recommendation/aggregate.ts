import type {
  RecommendationConfidence,
  RecommendationFactor,
  RecommendationVerdict,
} from './types';

/**
 * Combine factor votes into a directional verdict + confidence.
 *
 * Rules:
 *   • Any high-weight pro-refer or pro-ntu → REFER (regulatory red
 *     flag wins).
 *   • Majority pro-ntu (≥3 of 5) → NTU.
 *   • ≥4 pro-bind at moderate-high weight → BIND high confidence.
 *   • ≥3 pro-bind → BIND moderate confidence.
 *   • Otherwise REFER (mixed signals).
 */
export function aggregate(factors: RecommendationFactor[]): {
  primary: RecommendationVerdict;
  confidence: RecommendationConfidence;
} {
  const proBind = factors.filter((f) => f.vote === 'pro-bind');
  const proNtu = factors.filter((f) => f.vote === 'pro-ntu');
  const proRefer = factors.filter((f) => f.vote === 'pro-refer');

  // High-weight refer always wins.
  if (proRefer.some((f) => f.weight === 'high')) {
    return { primary: 'refer', confidence: 'high' };
  }

  // Majority pro-ntu → walk away.
  if (proNtu.length >= 3) {
    return { primary: 'ntu', confidence: 'moderate' };
  }

  // Strong-bind cohort: ≥4 pro-bind at moderate-or-better.
  const strongProBind = proBind.filter(
    (f) => f.weight === 'moderate' || f.weight === 'high',
  );
  if (strongProBind.length >= 4) {
    return { primary: 'bind', confidence: 'high' };
  }

  if (proBind.length >= 3) {
    return { primary: 'bind', confidence: 'moderate' };
  }

  // Mixed — refer.
  return { primary: 'refer', confidence: 'moderate' };
}
