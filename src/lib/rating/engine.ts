import {
  ACQUISITION_LOAD,
  BASE_RATE,
  FIRE_SUPPRESSION_LOADS,
  MATERIAL_LOAD_CAP,
  RATING_SHA,
  RATING_TIER,
  RATING_VERSION,
  SITE_LOAD_PER_EXTRA,
  lossRatioFactor,
  materialHazardLoad,
} from './constants';
import type { Cell, RatingInputs, RatingOutput } from './types';

/**
 * Run the Tier-2 W&R rating engine against the inputs.
 *
 * Pure function. Same inputs → same outputs. Each cell rounds to whole
 * pounds before the running subtotal carries forward — actuaries hate
 * fractional pence drift across float-precision boundaries.
 */
export function runRating(
  inputs: RatingInputs,
  computedAt: string = new Date().toISOString(),
): RatingOutput {
  const cells: Cell[] = [];

  // A1 — Base rate
  cells.push({
    ref: 'A1',
    label: 'Base rate · Tier-2',
    op: '',
    value: BASE_RATE,
    format: 'percent',
    subtotalAfter: null,
    formula: `Annual base rate for ${RATING_TIER} W&R risks: ${(BASE_RATE * 100).toFixed(2)}%.`,
    inputs: [],
  });

  // B14 — Turnover × base rate
  const b14 = Math.round(inputs.turnover * BASE_RATE);
  cells.push({
    ref: 'B14',
    label: '× Turnover',
    op: '×',
    value: b14,
    format: 'currency',
    subtotalAfter: b14,
    formula: `Annual turnover (£${inputs.turnover.toLocaleString()}) multiplied by Tier-2 base rate (${(BASE_RATE * 100).toFixed(2)}%).`,
    inputs: [
      {
        label: 'turnover',
        path: 'insured.turnover',
        value: inputs.turnover,
      },
    ],
  });

  // C22 — Site loading
  const siteLoadFactor = Math.max(0, inputs.siteCount - 1) * SITE_LOAD_PER_EXTRA;
  const c22 = Math.round(b14 * siteLoadFactor);
  const afterC22 = b14 + c22;
  cells.push({
    ref: 'C22',
    label: '+ Site loading',
    op: '+',
    value: c22,
    format: 'currency',
    subtotalAfter: afterC22,
    formula: `(${inputs.siteCount} − 1) × ${(SITE_LOAD_PER_EXTRA * 100).toFixed(2)}% × £${b14.toLocaleString()} = £${c22.toLocaleString()}.`,
    inputs: [
      { label: 'siteCount', path: 'sites', value: inputs.siteCount },
    ],
  });

  // D31 — Material hazard load (capped)
  const matFactor = materialHazardLoad(inputs.materials);
  const d31 = Math.round(afterC22 * matFactor);
  const afterD31 = afterC22 + d31;
  cells.push({
    ref: 'D31',
    label: `+ Material hazard ${matFactor >= MATERIAL_LOAD_CAP ? '(D31-cap)' : ''}`,
    op: '+',
    value: d31,
    format: 'currency',
    subtotalAfter: afterD31,
    formula: `${(matFactor * 100).toFixed(1)}% applied to £${afterC22.toLocaleString()}${
      matFactor >= MATERIAL_LOAD_CAP ? ' (sum of class loadings would exceed 3.0% — capped)' : ''
    }.`,
    inputs: [
      {
        label: 'materials',
        path: 'materials',
        value: inputs.materials,
      },
    ],
  });

  // E38 — Fire-suppression treatment
  const fsFactor = FIRE_SUPPRESSION_LOADS[inputs.fireSuppression];
  const e38 = Math.round(afterD31 * fsFactor);
  const afterE38 = afterD31 + e38;
  cells.push({
    ref: 'E38',
    label:
      inputs.fireSuppression === 'present'
        ? '+ Fire suppression (present)'
        : `+ Fire suppression (${inputs.fireSuppression})`,
    op: '+',
    value: e38,
    format: 'currency',
    subtotalAfter: afterE38,
    formula:
      inputs.fireSuppression === 'present'
        ? 'Fire suppression confirmed at all sites; no loading applied.'
        : `${(fsFactor * 100).toFixed(0)}% loading applied (suppression ${inputs.fireSuppression}).`,
    inputs: [
      {
        label: 'fireSuppression',
        path: 'fireSuppressionDisclosed',
        value: inputs.fireSuppression,
      },
    ],
  });

  // F44 — Loss-ratio credit
  const lrFactor = lossRatioFactor(inputs.lossRatio);
  const f44 = Math.round(afterE38 * lrFactor);
  const afterF44 = afterE38 + f44;
  cells.push({
    ref: 'F44',
    label:
      lrFactor < 0
        ? `− Loss credit (LR ${(inputs.lossRatio * 100).toFixed(0)}%)`
        : lrFactor > 0
          ? `+ Loss load (LR ${(inputs.lossRatio * 100).toFixed(0)}%)`
          : `· Loss neutral (LR ${(inputs.lossRatio * 100).toFixed(0)}%)`,
    op: lrFactor < 0 ? '−' : lrFactor > 0 ? '+' : '',
    value: f44,
    format: 'currency',
    subtotalAfter: afterF44,
    formula: `${(lrFactor * 100).toFixed(0)}% applied to £${afterE38.toLocaleString()} based on five-year loss ratio of ${(inputs.lossRatio * 100).toFixed(0)}%.`,
    inputs: [
      { label: 'lossRatio', path: 'statedLossRatio', value: inputs.lossRatio },
    ],
  });

  // G51 — Acquisition + expense load
  const g51 = Math.round(afterF44 * ACQUISITION_LOAD);
  cells.push({
    ref: 'G51',
    label: '+ Acquisition & expense',
    op: '+',
    value: g51,
    format: 'currency',
    subtotalAfter: afterF44 + g51,
    formula: `${(ACQUISITION_LOAD * 100).toFixed(0)}% applied to £${afterF44.toLocaleString()}.`,
    inputs: [],
  });

  // H58 — Gross premium
  const h58 = afterF44 + g51;
  cells.push({
    ref: 'H58',
    label: 'GROSS PREMIUM',
    op: '',
    value: h58,
    format: 'currency',
    subtotalAfter: h58,
    formula: 'Final gross premium, including acquisition and expense load.',
    inputs: [],
  });

  return {
    premium: h58,
    cells,
    sha: RATING_SHA,
    version: RATING_VERSION,
    tier: RATING_TIER,
    computedAt,
  };
}
