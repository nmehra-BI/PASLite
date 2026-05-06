import { describe, expect, it } from 'vitest';
import {
  getCompetitiveIntel,
  getGreenlineSubmission,
  getHistoricalBinders,
  getLossesToCompetitors,
} from '@/lib/fixtures';
import { extractField, createField } from '@/lib/field';
import { runRecommendation, buildTargetProfile, similarity } from './index';

const greenlineInputs = () => {
  const sub = getGreenlineSubmission();
  // Resolve fire suppression as present (post-module-3 state).
  sub.fireSuppressionDisclosed = {
    ...sub.fireSuppressionDisclosed,
    underwriterCorrected: {
      value: true,
      reason: 'broker confirmed',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:15:00Z',
    },
  };
  return {
    submission: sub,
    ourPremium: 38_265,
    binders: getHistoricalBinders(),
    losses: getLossesToCompetitors(),
    competitorIntel: getCompetitiveIntel(),
    fireSuppressionResolved: true,
    fireSuppressionRequested: false,
  };
};

describe('runRecommendation — Greenline default state', () => {
  it('returns BIND high confidence', () => {
    const r = runRecommendation(greenlineInputs());
    expect(r.primary).toBe('bind');
    expect(r.confidence).toBe('high');
  });

  it('produces 5 factors with at least 4 pro-bind', () => {
    const r = runRecommendation(greenlineInputs());
    expect(r.factors).toHaveLength(5);
    const ids = r.factors.map((f) => f.id);
    expect(ids).toEqual([
      'FCT-001',
      'FCT-002',
      'FCT-003',
      'FCT-004',
      'FCT-005',
    ]);
    const proBind = r.factors.filter((f) => f.vote === 'pro-bind').length;
    expect(proBind).toBeGreaterThanOrEqual(4);
  });

  it('FCT-002 (historical performance) reflects a strong-bind matured cohort', () => {
    const r = runRecommendation(greenlineInputs());
    const f = r.factors.find((x) => x.id === 'FCT-002')!;
    const meta = f.metadata as { profitable: number; total: number };
    // The curated set is 11 profitable / 3 breakeven / 1 unprofitable
    // among the close matches; cluster boundary records may also
    // cross threshold by ±1, so accept a small range.
    expect(meta.total).toBeGreaterThanOrEqual(14);
    expect(meta.total).toBeLessThanOrEqual(18);
    expect(meta.profitable).toBeGreaterThanOrEqual(10);
    expect(f.rationale).toMatch(/\d+ of \d+ matured similar binders/);
  });

  it('FCT-003 (pricing) cites RegentMGA and at least 2 similar losses', () => {
    const r = runRecommendation(greenlineInputs());
    const f = r.factors.find((x) => x.id === 'FCT-003')!;
    expect(f.evidence.competitorNames).toContain('RegentMGA');
    expect((f.evidence.lossIds ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('headline includes the gold sentence: RegentMGA + lost-count + hold-floor', () => {
    const r = runRecommendation(greenlineInputs());
    expect(r.headline).toContain('Recommend BIND');
    expect(r.headline).toContain('RegentMGA');
    expect(r.headline).toMatch(/we've lost \d+ similar risks/);
    expect(r.headline).toMatch(/hold firm above £\d/);
    expect(r.headline).toContain('Sarah');
  });

  it('top similar binders has 7 close matches and includes Northpoint + Linley', () => {
    const r = runRecommendation(greenlineInputs());
    const ids = r.similarBinders.map((b) => b.id);
    expect(ids.length).toBe(7);
    // Two anchor matches that always rank in the top tier:
    expect(ids).toContain('BND-29104'); // Northpoint — closest turnover + Birmingham overlap
    expect(ids).toContain('BND-27451'); // Linley — same turnover band, exact LR
  });

  it('top similar losses contain the closest RegentMGA loss (Pendle)', () => {
    const r = runRecommendation(greenlineInputs());
    const ids = r.similarLosses.map((l) => l.id);
    // The generic top-5 by similarity may include strong-geography
    // matches from other competitors. The named RegentMGA cohort
    // lives in the headline gold sentence (tested separately).
    // Pendle is the closest profile and must make the generic top-5.
    expect(ids).toContain('NTU-19402');
  });

  it('competitorContext surfaces RegentMGA', () => {
    const r = runRecommendation(greenlineInputs());
    const names = r.competitorContext.map((c) => c.name);
    expect(names).toContain('RegentMGA');
  });
});

describe('similarity', () => {
  it('Greenline target profile is constructed from submission', () => {
    const sub = getGreenlineSubmission();
    const target = buildTargetProfile(sub);
    expect(target.turnover).toBe(8_420_000);
    expect(target.siteCount).toBe(3);
    expect(target.materials.length).toBeGreaterThan(0);
  });

  it('binders with similar profiles score higher than outliers', () => {
    const sub = getGreenlineSubmission();
    const target = buildTargetProfile(sub);
    const binders = getHistoricalBinders();
    const northpoint = binders.find((b) => b.id === 'BND-29104')!;
    const granite = binders.find((b) => b.id === 'BND-27450')!; // huge outlier
    const sNorth = similarity(
      {
        turnover: northpoint.turnover,
        siteCount: northpoint.siteCount,
        materials: northpoint.materials,
        fireSuppression: northpoint.fireSuppression,
        priorLossRatio: northpoint.priorLossRatio,
        geography: northpoint.geography,
      },
      target,
    );
    const sGranite = similarity(
      {
        turnover: granite.turnover,
        siteCount: granite.siteCount,
        materials: granite.materials,
        fireSuppression: granite.fireSuppression,
        priorLossRatio: granite.priorLossRatio,
        geography: granite.geography,
      },
      target,
    );
    expect(sNorth).toBeGreaterThan(sGranite);
  });
});

describe('FCT-003 hold-floor pricing rule', () => {
  it('Greenline default: stays neutral (£38,265 within ~10% of £36k hold floor)', () => {
    const r = runRecommendation(greenlineInputs());
    const f = r.factors.find((x) => x.id === 'FCT-003')!;
    expect(f.vote).not.toBe('pro-ntu');
    const meta = f.metadata as { wellAboveHoldFloor: boolean };
    expect(meta.wellAboveHoldFloor).toBe(false);
  });

  it('flips to pro-ntu when our premium is well above the sharp hold floor', () => {
    const inputs = greenlineInputs();
    // Push our premium materially above the demonstrated sharp hold
    // floor (RegentMGA's max similar win) — a price-loss is now
    // strongly indicated, so the factor must vote pro-ntu.
    inputs.ourPremium = 90_000;
    const r = runRecommendation(inputs);
    const f = r.factors.find((x) => x.id === 'FCT-003')!;
    const meta = f.metadata as { wellAboveHoldFloor: boolean; holdFloor: number };
    expect(meta.wellAboveHoldFloor).toBe(true);
    expect(meta.holdFloor).toBeGreaterThan(0);
    expect(f.vote).toBe('pro-ntu');
    expect(f.weight).toBe('high');
    expect(f.rationale).toMatch(/hold floor/i);
  });
});

describe('aggregate (override sensitivity)', () => {
  it('flips to NTU when 3+ factors are pro-ntu', () => {
    const inputs = greenlineInputs();
    // Bend turnover above the appetite cap to push some factors negative.
    inputs.submission.insured.turnover = extractField(
      createField<number>(50_000_000),
      {
        value: 50_000_000,
        confidence: 1,
        sourceRef: 'test',
        extractedAt: '2026-01-01T00:00:00Z',
        modelVersion: 'test',
      },
    );
    inputs.ourPremium = 250_000;
    const r = runRecommendation(inputs);
    expect(r.primary !== 'bind').toBe(true);
  });
});
