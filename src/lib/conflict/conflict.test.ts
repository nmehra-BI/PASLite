import { describe, expect, it } from 'vitest';
import { detectConflicts, detectGaps } from './index';
import { getGreenlineSubmission } from '@/lib/fixtures';
import type { CompaniesHousePayload, SourceResult } from '@/lib/fixtures';
import { extractField, createField } from '@/lib/field';

const chPayload: CompaniesHousePayload = {
  status: 'active',
  registeredOffice: 'Birmingham',
  dateOfIncorporation: '2010-11-04',
  directors: [],
  latestFiling: { fyEnding: 'FY23', filedAt: '2025-03-31', turnover: 7_910_000 },
};

const chResult: SourceResult = {
  id: 'companies-house',
  summary: 'turnover £7.91M (filed FY23) — conflict with broker',
  verdict: 'conflict',
  payload: chPayload,
  refreshedAt: '2026-05-09T08:15:00Z',
};

describe('detectConflicts', () => {
  it('flags a turnover conflict when broker £8.42M and CH £7.91M', () => {
    const sub = getGreenlineSubmission();
    const conflicts = detectConflicts(sub, [chResult]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.fieldPath).toBe('insured.turnover');
    expect(conflicts[0]!.brokerValue).toBe(8_420_000);
    expect(conflicts[0]!.externalValue).toBe(7_910_000);
    expect(conflicts[0]!.externalSource).toBe('companies-house');
  });

  it('does not flag a conflict when the broker number matches CH', () => {
    const sub = getGreenlineSubmission();
    // Override broker turnover to match CH via underwriter correction
    sub.insured.turnover = {
      ...sub.insured.turnover,
      underwriterCorrected: {
        value: 7_910_000,
        reason: 'manual',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:00:00Z',
      },
    };
    expect(detectConflicts(sub, [chResult])).toHaveLength(0);
  });

  it('returns empty when no Companies House source present', () => {
    const sub = getGreenlineSubmission();
    expect(detectConflicts(sub, [])).toHaveLength(0);
  });
});

describe('detectGaps', () => {
  it('flags fireSuppression when broker did not state', () => {
    const sub = getGreenlineSubmission();
    const gaps = detectGaps(sub);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.fieldPath).toBe('fireSuppressionDisclosed');
  });

  it('does not flag once the broker layer is populated', () => {
    const sub = getGreenlineSubmission();
    sub.fireSuppressionDisclosed = extractField(createField<boolean>(true), {
      value: true,
      confidence: 0.95,
      sourceRef: 'slip:p4',
      extractedAt: '2026-05-09T08:14:38Z',
      modelVersion: 'sonnet-4-7',
    });
    expect(detectGaps(sub)).toHaveLength(0);
  });
});
