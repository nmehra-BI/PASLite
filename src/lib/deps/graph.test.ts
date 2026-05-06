import { describe, expect, it } from 'vitest';
import {
  ALL_ARTIFACTS,
  affectedArtifacts,
  closure,
  isField,
} from './graph';

describe('affectedArtifacts', () => {
  it('correcting turnover invalidates conflicts + triage + rating + quote + recommendation, but not enrichment', () => {
    const result = affectedArtifacts('insured.turnover');
    expect(result).toEqual(
      new Set(['conflicts', 'triage', 'rating', 'quote', 'recommendation']),
    );
    expect(result.has('enrichment')).toBe(false);
  });

  it('correcting Companies House number invalidates enrichment and the full downstream closure', () => {
    expect(affectedArtifacts('insured.companiesHouseNumber')).toEqual(
      new Set([
        'enrichment',
        'conflicts',
        'triage',
        'rating',
        'quote',
        'recommendation',
      ]),
    );
  });

  it('correcting an inception date invalidates only quote and recommendation', () => {
    expect(affectedArtifacts('cover.inceptionDate')).toEqual(
      new Set(['quote', 'recommendation']),
    );
  });

  it('correcting a site sqm invalidates triage + rating + downstream', () => {
    expect(affectedArtifacts('sites[0].sqm')).toEqual(
      new Set(['triage', 'rating', 'quote', 'recommendation']),
    );
    expect(affectedArtifacts('sites[7].sqm')).toEqual(
      new Set(['triage', 'rating', 'quote', 'recommendation']),
    );
  });

  it('correcting a permit reference invalidates enrichment + conflicts + triage + downstream', () => {
    expect(affectedArtifacts('sites[0].permitRef')).toEqual(
      new Set([
        'enrichment',
        'conflicts',
        'triage',
        'rating',
        'quote',
        'recommendation',
      ]),
    );
  });

  it('correcting lossRuns invalidates conflicts + downstream (cascades into triage via conflicts)', () => {
    expect(affectedArtifacts('lossRuns')).toEqual(
      new Set(['conflicts', 'triage', 'rating', 'quote', 'recommendation']),
    );
  });

  it('correcting materials invalidates triage + rating + downstream', () => {
    expect(affectedArtifacts('materials')).toEqual(
      new Set(['triage', 'rating', 'quote', 'recommendation']),
    );
  });

  it('falls back to invalidating every artifact for an unregistered path', () => {
    expect(affectedArtifacts('mystery.field')).toEqual(new Set(ALL_ARTIFACTS));
  });
});

describe('closure', () => {
  it('returns the seeds plus everything reachable downstream', () => {
    expect(closure(['rating'])).toEqual(
      new Set(['rating', 'quote', 'recommendation']),
    );
  });

  it('triage closure is rating + quote + recommendation', () => {
    expect(closure(['triage'])).toEqual(
      new Set(['triage', 'rating', 'quote', 'recommendation']),
    );
  });

  it('handles a multi-seed input', () => {
    expect(closure(['enrichment', 'quote'])).toEqual(
      new Set([
        'enrichment',
        'conflicts',
        'triage',
        'rating',
        'quote',
        'recommendation',
      ]),
    );
  });
});

describe('isField', () => {
  it('accepts a well-formed Field shape', () => {
    expect(
      isField({
        brokerStated: 1,
        systemExtracted: null,
        underwriterCorrected: null,
      }),
    ).toBe(true);
  });

  it('rejects plain values and missing layers', () => {
    expect(isField(null)).toBe(false);
    expect(isField(8_400_000)).toBe(false);
    expect(isField({ brokerStated: 1 })).toBe(false);
  });
});
