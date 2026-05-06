import { describe, expect, it } from 'vitest';
import { runRating } from './engine';
import {
  classifyMaterial,
  lossRatioFactor,
  materialHazardLoad,
} from './constants';

const greenlineInputs = {
  turnover: 7_910_000,
  siteCount: 3,
  materials: [
    'paper',
    'cardboard',
    'plastics (PET, HDPE)',
    'metals (aluminium, steel)',
  ],
  fireSuppression: 'present' as const,
  lossRatio: 0.38,
  largestSingleClaim: 180_000,
  yearsInBusiness: 12,
  brokerTargetPremium: 45_000,
};

describe('runRating — Greenline default state', () => {
  it('produces £38,265 with the expected cell chain', () => {
    const out = runRating(greenlineInputs);
    expect(out.premium).toBe(38_265);
    expect(out.sha).toBe('sha-7f2a');
    expect(out.tier).toBe('Tier-2');
    expect(out.version).toBe('v3.2');
    expect(out.cells).toHaveLength(8);

    const refs = out.cells.map((c) => c.ref);
    expect(refs).toEqual([
      'A1',
      'B14',
      'C22',
      'D31',
      'E38',
      'F44',
      'G51',
      'H58',
    ]);

    const byRef = Object.fromEntries(out.cells.map((c) => [c.ref, c]));
    expect(byRef.B14!.value).toBe(33_222);
    expect(byRef.C22!.value).toBe(631);
    expect(byRef.D31!.value).toBe(1_016);
    expect(byRef.E38!.value).toBe(0);
    expect(byRef.F44!.value).toBe(-2_441);
    expect(byRef.G51!.value).toBe(5_837);
    expect(byRef.H58!.value).toBe(38_265);
  });

  it('is deterministic — same inputs, same outputs', () => {
    const a = runRating(greenlineInputs, '2026-05-09T09:25:00Z');
    const b = runRating(greenlineInputs, '2026-05-09T09:25:00Z');
    expect(a.premium).toBe(b.premium);
    expect(a.cells.map((c) => c.value)).toEqual(b.cells.map((c) => c.value));
  });
});

describe('rating sensitivity', () => {
  it('£15M turnover lifts the premium', () => {
    const out = runRating({ ...greenlineInputs, turnover: 15_000_000 });
    expect(out.premium).toBeGreaterThan(38_265);
  });

  it('absent fire suppression adds a 6% loading', () => {
    const present = runRating(greenlineInputs);
    const absent = runRating({ ...greenlineInputs, fireSuppression: 'absent' });
    expect(absent.premium).toBeGreaterThan(present.premium);
  });

  it('LR ≥ 100% applies a +18% loading', () => {
    const out = runRating({ ...greenlineInputs, lossRatio: 1.05 });
    const f44 = out.cells.find((c) => c.ref === 'F44')!;
    expect(f44.value).toBeGreaterThan(0);
  });

  it('LR < 30% applies a −12% credit', () => {
    const out = runRating({ ...greenlineInputs, lossRatio: 0.18 });
    const f44 = out.cells.find((c) => c.ref === 'F44')!;
    expect(f44.value).toBeLessThan(0);
    expect(out.premium).toBeLessThan(38_265);
  });
});

describe('classifyMaterial / materialHazardLoad / lossRatioFactor', () => {
  it('classifies materials by substring match', () => {
    expect(classifyMaterial('paper')).toBe('paper');
    expect(classifyMaterial('cardboard')).toBe('paper');
    expect(classifyMaterial('plastics (PET, HDPE)')).toBe('plastics');
    expect(classifyMaterial('metals (aluminium, steel)')).toBe('metals');
    expect(classifyMaterial('asbestos')).toBeNull();
  });

  it('caps material hazard load at 3.0%', () => {
    const load = materialHazardLoad([
      'paper',
      'cardboard',
      'plastics',
      'metals',
    ]);
    expect(load).toBe(0.03);
  });

  it('uses bands for loss-ratio factor', () => {
    expect(lossRatioFactor(0.18)).toBe(-0.12);
    expect(lossRatioFactor(0.38)).toBe(-0.07);
    expect(lossRatioFactor(0.6)).toBe(0);
    expect(lossRatioFactor(0.9)).toBe(0.06);
    expect(lossRatioFactor(1.5)).toBe(0.18);
  });
});
