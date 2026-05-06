import { describe, expect, it } from 'vitest';
import { computeSha } from './hashEngine';
import {
  buildHashInputsFromSubmission,
  validateHashes,
  GREENLINE_CONSUMPTION,
} from './validateHashes';
import { getCapacityLedger } from '@/lib/fixtures/capacityLedger';
import { getGreenlineSubmission } from '@/lib/fixtures';
import { deriveSubjectivities } from '@/lib/fixtures/subjectivities';

describe('computeSha — content-addressable digest', () => {
  it('produces a stable sha-prefixed 4-char hex', () => {
    const a = computeSha({ premium: 38_265, sha: 'sha-7f2a' });
    expect(a).toMatch(/^sha-[0-9a-f]{4}$/);
  });

  it('is deterministic — same input ⇒ same digest', () => {
    const payload = { warranties: ['EA permit', 'Fire suppression'] };
    expect(computeSha(payload)).toBe(computeSha(payload));
  });

  it('is sensitive — different inputs ⇒ different digests', () => {
    const a = computeSha({ x: 1 });
    const b = computeSha({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('is order-insensitive on object keys (canonical form)', () => {
    expect(computeSha({ a: 1, b: 2 })).toBe(computeSha({ b: 2, a: 1 }));
  });
});

describe('validateHashes — Greenline default state', () => {
  function inputs() {
    const submission = getGreenlineSubmission();
    submission.fireSuppressionDisclosed = {
      ...submission.fireSuppressionDisclosed,
      underwriterCorrected: {
        value: true,
        reason: 'broker confirmed',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };
    const { warranties } = buildHashInputsFromSubmission(submission);
    const ratingSha = computeSha({ premium: 38_265 });
    const slipSha = ratingSha; // sealed at quote time
    return {
      submission,
      ratingPremium: 38_265,
      ratingSha,
      quotedPremium: 38_265,
      quotedSlipSha: slipSha,
      warranties,
      warrantiesAtSendSha: computeSha(warranties),
      sanctionsRefreshedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      capacity: getCapacityLedger(),
      capacityConsumption: GREENLINE_CONSUMPTION,
    };
  }

  it('all four hashes match for the default Greenline path', () => {
    const checks = validateHashes(inputs());
    expect(checks).toHaveLength(4);
    for (const c of checks) {
      expect(c.matches).toBe(true);
    }
  });

  it('Hash 1 (premium) fails when rating sha drifts from slip sha', () => {
    const i = inputs();
    i.ratingSha = computeSha({ premium: 999_999 });
    const checks = validateHashes(i);
    const h1 = checks.find((c) => c.id === 'premium')!;
    expect(h1.matches).toBe(false);
    expect(h1.status).toBe('stale');
    expect(h1.citation).toContain('changed');
  });

  it('Hash 3 (sanctions) reports refresh-needed when older than 24h', () => {
    const i = inputs();
    i.sanctionsRefreshedAt = new Date(
      Date.now() - 25 * 60 * 60 * 1000,
    ).toISOString();
    const checks = validateHashes(i);
    const h3 = checks.find((c) => c.id === 'sanctions')!;
    expect(h3.status).toBe('refresh-needed');
    expect(h3.matches).toBe(false);
  });

  it('Hash 4 (capacity) blocks when consumption exceeds headroom', () => {
    const i = inputs();
    i.capacityConsumption = 50_000_000; // way above headroom
    const checks = validateHashes(i);
    const h4 = checks.find((c) => c.id === 'capacity')!;
    expect(h4.status).toBe('blocked');
    expect(h4.matches).toBe(false);
    expect(h4.primary).toContain('insufficient');
  });
});

describe('deriveSubjectivities — Greenline path', () => {
  it('produces two subjectivities with the expected types', () => {
    const sub = getGreenlineSubmission();
    const records = deriveSubjectivities(sub);
    expect(records).toHaveLength(2);
    expect(records[0]!.subjectivityType).toBe('permit-warranty');
    expect(records[1]!.subjectivityType).toBe('maintenance-warranty');
  });

  it('permit warranty references the Leeds permit and a critical date in term', () => {
    const sub = getGreenlineSubmission();
    const [permit] = deriveSubjectivities(sub);
    expect(permit!.criticalDate).not.toBeNull();
    expect(permit!.affectedSites.join(' ')).toMatch(/Leeds/i);
    expect(permit!.actionRequired).toMatch(/renewed permit evidence/i);
  });
});
