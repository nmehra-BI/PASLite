import { describe, expect, it } from 'vitest';
import { computeProRata } from './computeProRata';
import {
  buildPolicyContextDiff,
  computeDeltaRating,
} from './computeDelta';
import { getPolicyStateAt } from './getPolicyStateAt';
import { getGreenlineSubmission, getManchesterMtaRequest } from '@/lib/fixtures';

describe('computeProRata', () => {
  it('full term remaining → AP equals annual delta', () => {
    const r = computeProRata({
      annualDelta: 12_000,
      effectiveDate: '2026-05-15T00:00:00Z',
      policyInception: '2026-05-15T00:00:00Z',
      policyExpiry: '2027-05-15T00:00:00Z',
    });
    expect(r.daysInTerm).toBe(365);
    expect(r.daysRemaining).toBe(365);
    expect(r.proRatedAP).toBe(12_000);
  });

  it('half term remaining → AP halved', () => {
    const r = computeProRata({
      annualDelta: 12_000,
      effectiveDate: '2026-11-14T00:00:00Z',
      policyInception: '2026-05-15T00:00:00Z',
      policyExpiry: '2027-05-15T00:00:00Z',
    });
    expect(r.daysInTerm).toBe(365);
    expect(Math.abs(r.proRatedAP - 6_000)).toBeLessThanOrEqual(120);
    expect(r.fractionRemaining).toBeCloseTo(0.5, 1);
  });

  it('Manchester demo path: 1 Aug effective → ~288 days remaining', () => {
    const r = computeProRata({
      annualDelta: 11_050,
      effectiveDate: '2026-08-01T00:00:00+01:00',
      policyInception: '2026-05-15T12:00:00+01:00',
      policyExpiry: '2027-05-15T12:00:00+01:00',
    });
    expect(r.daysInTerm).toBe(365);
    expect(r.daysRemaining).toBeGreaterThanOrEqual(285);
    expect(r.daysRemaining).toBeLessThanOrEqual(290);
    expect(r.proRatedAP).toBeGreaterThan(8_000);
    expect(r.proRatedAP).toBeLessThan(9_500);
  });

  it('effective after expiry clamps to zero days remaining', () => {
    const r = computeProRata({
      annualDelta: 5_000,
      effectiveDate: '2027-06-01T00:00:00Z',
      policyInception: '2026-05-15T00:00:00Z',
      policyExpiry: '2027-05-15T00:00:00Z',
    });
    expect(r.daysRemaining).toBe(0);
    expect(r.proRatedAP).toBe(0);
  });
});

describe('buildPolicyContextDiff — Greenline + Manchester', () => {
  it('produces a 4-site after view with Manchester marked as added', () => {
    const sub = getGreenlineSubmission();
    const mta = getManchesterMtaRequest();
    const diff = buildPolicyContextDiff({ submission: sub, mta, boundPremium: 38_265 });

    expect(diff.before.siteCount).toBe(3);
    expect(diff.after.siteCount).toBe(4);
    expect(diff.after.sites[diff.after.addedSiteIndex]!.name).toBe('Manchester');
    expect(diff.deltas.siteCountAbs).toBe(1);
    expect(diff.deltas.turnoverAbs).toBeGreaterThan(0);
    expect(diff.deltas.sqmAbs).toBeGreaterThan(0);
  });
});

describe('computeDeltaRating — Greenline + Manchester', () => {
  it('produces a positive AP with a deterministic sha', () => {
    const sub = getGreenlineSubmission();
    sub.fireSuppressionDisclosed = {
      ...sub.fireSuppressionDisclosed,
      underwriterCorrected: {
        value: true,
        reason: 'broker confirmed',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };
    const mta = getManchesterMtaRequest();
    const r1 = computeDeltaRating({ submission: sub, mta, boundPremium: 38_265 });
    const r2 = computeDeltaRating({ submission: sub, mta, boundPremium: 38_265 });
    expect(r1.sha).toBe(r2.sha);
    expect(r1.proRatedAP).toBeGreaterThan(0);
    expect(r1.afterAnnualEquivalent).toBeGreaterThan(r1.beforePremium);
    expect(r1.beforeCells.length).toBeGreaterThan(0);
    expect(r1.afterCells.length).toBeGreaterThan(0);
  });
});

describe('getPolicyStateAt', () => {
  it('returns v1 / 0 endorsements when no MTAs applied', () => {
    const sub = getGreenlineSubmission();
    const r = getPolicyStateAt({
      submission: sub,
      boundPremium: 38_265,
      versions: [],
      asOf: '2026-06-01T00:00:00Z',
    });
    expect(r.versionLabel).toBe('v1');
    expect(r.endorsementCount).toBe(0);
    expect(r.cumulativeAP).toBe(0);
    expect(r.annualEquivalent).toBe(38_265);
    expect(r.siteCount).toBe(3);
  });

  it('folds an add-site MTA into the effective state once past its date', () => {
    const sub = getGreenlineSubmission();
    const versions = [
      {
        versionId: 'POL-29481-MTA-04',
        endorsementNumber: 1,
        effectiveDate: '2026-08-01T00:00:00+01:00',
        changeType: 'add-site' as const,
        proRatedAP: 8_720,
        afterAnnualEquivalent: 49_315,
        scheduleRef: 'POL-29481-MTA-04',
        signedBy: 'nm',
        signedAt: '2026-08-01T09:15:00+01:00',
      },
    ];

    const before = getPolicyStateAt({
      submission: sub,
      boundPremium: 38_265,
      versions,
      asOf: '2026-07-01T00:00:00Z',
    });
    expect(before.versionLabel).toBe('v1');
    expect(before.siteCount).toBe(3);
    expect(before.annualEquivalent).toBe(38_265);

    const after = getPolicyStateAt({
      submission: sub,
      boundPremium: 38_265,
      versions,
      asOf: '2026-09-01T00:00:00Z',
    });
    expect(after.versionLabel).toBe('v2');
    expect(after.endorsementCount).toBe(1);
    expect(after.siteCount).toBe(4);
    expect(after.annualEquivalent).toBe(49_315);
    expect(after.cumulativeAP).toBe(8_720);
  });
});
