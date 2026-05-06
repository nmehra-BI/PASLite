import { describe, expect, it } from 'vitest';
import { CHECK_ORDER, deriveVerdict, runTriage } from './runTriage';
import { getGreenlineSubmission } from '@/lib/fixtures';
import type { SourceResult } from '@/lib/fixtures';
import { createField } from '@/lib/field';

const cleanSources: SourceResult[] = [
  {
    id: 'companies-house',
    summary: 'turnover £7.91M (filed FY23)',
    verdict: 'conflict',
    payload: {
      status: 'active',
      registeredOffice: 'Birmingham',
      dateOfIncorporation: '2010-11-04',
      directors: [{ name: 'J. Greenline', role: 'director', status: 'active' }],
      latestFiling: { fyEnding: 'FY23', filedAt: '2025-03-31', turnover: 7_910_000 },
    },
    refreshedAt: '2026-05-09T08:15:00Z',
  },
  {
    id: 'experian-sanctions',
    summary: 'clean',
    verdict: 'confirmed',
    payload: {
      lists: [
        { name: 'UK Treasury', verdict: 'clean' },
        { name: 'OFAC', verdict: 'clean' },
        { name: 'EU Consolidated', verdict: 'clean' },
        { name: 'UN Sanctions', verdict: 'clean' },
      ],
      refreshedAt: '2026-05-09T08:15:00Z',
    },
    refreshedAt: '2026-05-09T08:15:00Z',
  },
];

describe('runTriage — Greenline default state', () => {
  it('all four checks pass when all data is in band and disclosures resolved', () => {
    const sub = getGreenlineSubmission();
    // Resolve fire suppression as present (otherwise SUB-001 refers).
    sub.fireSuppressionDisclosed = {
      ...sub.fireSuppressionDisclosed,
      underwriterCorrected: {
        value: true,
        reason: 'broker confirmed verbally',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };
    const { results, verdict } = runTriage(sub, cleanSources, []);
    expect(results.appetite.outcome).toBe('pass');
    expect(results.capacity.outcome).toBe('pass');
    expect(results.subjectivities.outcome).toBe('pass');
    expect(results.sanctions.outcome).toBe('pass');
    expect(verdict).toBe('pass');
  });

  it('CHECK_ORDER lists checks in cinematic order', () => {
    expect(CHECK_ORDER).toEqual([
      'appetite',
      'capacity',
      'subjectivities',
      'sanctions',
    ]);
  });
});

describe('checkAppetite — boundaries', () => {
  it('refers when turnover is below the band', () => {
    const sub = getGreenlineSubmission();
    sub.insured.turnover = {
      ...sub.insured.turnover,
      underwriterCorrected: {
        value: 500_000,
        reason: 'corrected',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };
    const { results } = runTriage(sub, cleanSources, []);
    expect(results.appetite.outcome).toBe('refer');
  });

  it('refers when turnover is above the band (£30M)', () => {
    const sub = getGreenlineSubmission();
    sub.insured.turnover = {
      ...sub.insured.turnover,
      underwriterCorrected: {
        value: 30_000_000,
        reason: 'corrected',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };
    const { results, verdict } = runTriage(sub, cleanSources, []);
    expect(results.appetite.outcome).toBe('refer');
    expect(verdict).toBe('refer');
  });

  it('declines when materials include an excluded class', () => {
    const sub = getGreenlineSubmission();
    sub.materials = createField<string[]>(['paper', 'asbestos']);
    const { results, verdict } = runTriage(sub, cleanSources, []);
    expect(results.appetite.outcome).toBe('decline');
    expect(verdict).toBe('decline');
  });
});

describe('checkSanctions — partial / hit', () => {
  it('refers on partial match', () => {
    const sub = getGreenlineSubmission();
    const sources: SourceResult[] = [
      ...cleanSources.filter((s) => s.id !== 'experian-sanctions'),
      {
        id: 'experian-sanctions',
        summary: 'partial match',
        verdict: 'conflict',
        payload: {
          lists: [
            { name: 'UK Treasury', verdict: 'partial-match' },
            { name: 'OFAC', verdict: 'clean' },
            { name: 'EU Consolidated', verdict: 'clean' },
            { name: 'UN Sanctions', verdict: 'clean' },
          ],
          refreshedAt: '2026-05-09T08:15:00Z',
        },
        refreshedAt: '2026-05-09T08:15:00Z',
      },
    ];
    const { results, verdict } = runTriage(sub, sources, []);
    expect(results.sanctions.outcome).toBe('refer');
    expect(verdict).toBe('refer');
  });

  it('declines on direct hit', () => {
    const sub = getGreenlineSubmission();
    const sources: SourceResult[] = [
      ...cleanSources.filter((s) => s.id !== 'experian-sanctions'),
      {
        id: 'experian-sanctions',
        summary: 'hit',
        verdict: 'conflict',
        payload: {
          lists: [
            { name: 'UK Treasury', verdict: 'hit' },
            { name: 'OFAC', verdict: 'clean' },
            { name: 'EU Consolidated', verdict: 'clean' },
            { name: 'UN Sanctions', verdict: 'clean' },
          ],
          refreshedAt: '2026-05-09T08:15:00Z',
        },
        refreshedAt: '2026-05-09T08:15:00Z',
      },
    ];
    const { results, verdict } = runTriage(sub, sources, []);
    expect(results.sanctions.outcome).toBe('decline');
    expect(verdict).toBe('decline');
  });
});

describe('deriveVerdict', () => {
  const passResults = {
    appetite: { outcome: 'pass' as const, rationale: '', rules: [] },
    capacity: { outcome: 'pass' as const, rationale: '', rules: [] },
    subjectivities: { outcome: 'pass' as const, rationale: '', rules: [] },
    sanctions: { outcome: 'pass' as const, rationale: '', rules: [] },
  };

  it('overrides flip the verdict (pass → refer when one check overridden to refer)', () => {
    expect(
      deriveVerdict(passResults, { appetite: { outcome: 'refer' } }),
    ).toBe('refer');
  });

  it('decline beats refer beats pass', () => {
    expect(
      deriveVerdict(passResults, {
        appetite: { outcome: 'refer' },
        capacity: { outcome: 'decline' },
      }),
    ).toBe('decline');
  });
});
