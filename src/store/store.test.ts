import { beforeEach, describe, expect, it } from 'vitest';
import { useRanBerri } from './store';
import { createField, extractField, effectiveValue } from '@/lib/field';
import type { Submission } from '@/lib/fixtures';

function buildSubmission(): Submission {
  return {
    id: 'sub_test_1',
    folio: 'TEST-001',
    receivedAt: '2026-05-06T08:00:00Z',
    broker: createField('BrokerCo'),
    insured: {
      legalName: createField('Greenline Recycling Ltd'),
      tradingName: createField('Greenline'),
      companiesHouseNumber: createField('12345678'),
      yearsTrading: createField(8),
      turnover: extractField(createField(8_400_000), {
        value: 8_400_000,
        confidence: 0.94,
        sourceRef: 'slip:p1:line8',
        extractedAt: '2026-05-06T08:30:00Z',
        modelVersion: 'sonnet-4-7',
      }),
      turnoverPrior: createField(7_910_000),
    },
    cover: {
      inceptionDate: createField('2026-06-01'),
      expiryDate: createField('2027-05-31'),
      publicLiabilityLimit: createField(5_000_000),
      employersLiabilityLimit: createField(10_000_000),
      environmentalImpairmentLimit: createField(2_000_000),
      term: createField('12 months'),
    },
    sites: [],
    materials: createField<string[]>(['paper']),
    fireSuppressionDisclosed: createField(false),
    lossRuns: createField([]),
    statedLossRatio: createField(0.38),
    brokerTargetPremium: createField(45_000),
  };
}

function markEverythingComputed(): void {
  const s = useRanBerri.getState();
  s.markArtifactComputed('enrichment', '2026-05-06T08:31:00Z');
  s.markArtifactComputed('conflicts', '2026-05-06T08:31:30Z');
  s.markArtifactComputed('rating', '2026-05-06T08:32:00Z');
  s.markArtifactComputed('quote', '2026-05-06T08:32:15Z');
  s.markArtifactComputed('recommendation', '2026-05-06T08:32:30Z');
}

describe('applyCorrection — turnover £8.4M → £7.9M', () => {
  beforeEach(() => {
    useRanBerri.getState().reset();
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'broker', id: 'test' },
      kind: 'submission.created',
      submissionId: 'sub_test_1',
      folio: 'TEST-001',
      broker: 'BrokerCo',
      submission: buildSubmission(),
    });
    markEverythingComputed();
  });

  it('writes the underwriter layer back into the submission tree', () => {
    useRanBerri.getState().applyCorrection('insured.turnover', {
      value: 7_900_000,
      reason: 'Companies House FY24 accounts show £7.9M.',
      correctedBy: 'nm',
      correctedAt: '2026-05-06T09:15:00Z',
    });

    const t = useRanBerri.getState().submission!.insured.turnover;
    expect(t.brokerStated).toBe(8_400_000);
    expect(t.systemExtracted?.value).toBe(8_400_000);
    expect(t.underwriterCorrected?.value).toBe(7_900_000);
    expect(effectiveValue(t)).toBe(7_900_000);
  });

  it('invalidates the full closure (conflicts + triage + rating + quote + recommendation) — enrichment stays valid', () => {
    useRanBerri.getState().applyCorrection('insured.turnover', {
      value: 7_900_000,
      reason: 'Companies House FY24.',
      correctedBy: 'nm',
      correctedAt: '2026-05-06T09:15:00Z',
    });

    const a = useRanBerri.getState().artifacts;
    expect(a.enrichment.computedAt).toBe('2026-05-06T08:31:00Z');
    expect(a.conflicts.computedAt).toBeNull();
    expect(a.triage.computedAt).toBeNull();
    expect(a.rating.computedAt).toBeNull();
    expect(a.quote.computedAt).toBeNull();
    expect(a.recommendation.computedAt).toBeNull();
  });

  it('emits one field.corrected event plus one artifact.stale per invalidated artifact', () => {
    const before = useRanBerri.getState().auditLog.length;
    useRanBerri.getState().applyCorrection('insured.turnover', {
      value: 7_900_000,
      reason: 'Companies House FY24 accounts show £7.9M; broker copy was prior year.',
      correctedBy: 'nm',
      correctedAt: '2026-05-06T09:15:00Z',
    });

    const newEvents = useRanBerri.getState().auditLog.slice(before);
    // 1 field.corrected + 5 artifact.stale (conflicts/triage/rating/quote/recommendation)
    expect(newEvents).toHaveLength(6);

    const first = newEvents[0]!;
    expect(first.kind).toBe('field.corrected');
    if (first.kind === 'field.corrected') {
      expect(first.fieldPath).toBe('insured.turnover');
      expect(first.reason).toContain('£7.9M');
    }

    const staleArtifacts = newEvents.slice(1).map((e) => {
      if (e.kind !== 'artifact.stale') throw new Error('expected artifact.stale');
      return e.artifact;
    });
    expect(new Set(staleArtifacts)).toEqual(
      new Set(['conflicts', 'triage', 'rating', 'quote', 'recommendation']),
    );
  });
});

describe('resolveConflict — restoring conflicts artifact freshness', () => {
  beforeEach(() => {
    useRanBerri.getState().reset();
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'broker', id: 'test' },
      kind: 'submission.created',
      submissionId: 'sub_test_1',
      folio: 'TEST-001',
      broker: 'BrokerCo',
      submission: buildSubmission(),
    });
    // Pretend extraction + enrichment have already settled.
    const s = useRanBerri.getState();
    s.markArtifactComputed('enrichment', '2026-05-06T08:31:00Z');
    s.markArtifactComputed('conflicts', '2026-05-06T08:32:00Z');
    s.markArtifactComputed('rating', '2026-05-06T08:33:00Z');
    s.markArtifactComputed('quote', '2026-05-06T08:34:00Z');
    s.markArtifactComputed('recommendation', '2026-05-06T08:35:00Z');
  });

  it('writes the underwriter layer, stales rating/quote/recommendation, but keeps conflicts fresh', () => {
    useRanBerri.getState().resolveConflict({
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      choice: 'external',
      value: 7_910_000,
      reason: 'FY24 not yet filed.',
      resolvedBy: 'nm',
    });

    const after = useRanBerri.getState();
    expect(after.submission!.insured.turnover.underwriterCorrected?.value).toBe(
      7_910_000,
    );
    // Rating / quote / recommendation are stale — turnover changed.
    expect(after.artifacts.rating.staleSince).not.toBeNull();
    expect(after.artifacts.quote.staleSince).not.toBeNull();
    expect(after.artifacts.recommendation.staleSince).not.toBeNull();
    // Conflicts is FRESH — the resolution we just emitted is the latest
    // declaration of conflict state.
    expect(after.artifacts.conflicts.staleSince).toBeNull();
    expect(after.artifacts.conflicts.computedAt).not.toBeNull();
  });

  it('emits the expected event sequence: conflict.resolved, field.corrected, artifact.stale × N, artifact.computed (conflicts)', () => {
    const before = useRanBerri.getState().auditLog.length;
    useRanBerri.getState().resolveConflict({
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      choice: 'external',
      value: 7_910_000,
      reason: 'FY24 not yet filed.',
      resolvedBy: 'nm',
    });
    const newEvents = useRanBerri.getState().auditLog.slice(before);
    const kinds = newEvents.map((e) => e.kind);
    expect(kinds[0]).toBe('conflict.resolved');
    expect(kinds[1]).toBe('field.corrected');
    // The cascade includes conflicts (turnover ∈ conflicts.sources)
    const staleArtifacts = newEvents
      .filter((e) => e.kind === 'artifact.stale')
      .map((e) => (e.kind === 'artifact.stale' ? e.artifact : ''));
    expect(staleArtifacts).toContain('conflicts');
    expect(staleArtifacts).toContain('rating');
    // The follow-up artifact.computed restores conflicts
    const last = newEvents[newEvents.length - 1]!;
    expect(last.kind).toBe('artifact.computed');
    if (last.kind === 'artifact.computed') {
      expect(last.artifact).toBe('conflicts');
    }
  });

  it('a second resolveConflict on the same id appends new events (audit is append-only)', () => {
    useRanBerri.getState().resolveConflict({
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      choice: 'external',
      value: 7_910_000,
      reason: 'first reason: at least 8 chars.',
      resolvedBy: 'nm',
    });
    const afterFirst = useRanBerri.getState().auditLog.length;
    useRanBerri.getState().resolveConflict({
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      choice: 'broker',
      value: 8_400_000,
      reason: 'changed mind: trust broker.',
      resolvedBy: 'nm',
    });
    const afterSecond = useRanBerri.getState().auditLog.length;
    expect(afterSecond).toBeGreaterThan(afterFirst);
    // Latest field.corrected wins in materialised state
    const t = useRanBerri.getState().submission!.insured.turnover;
    expect(t.underwriterCorrected?.value).toBe(8_400_000);
    expect(t.underwriterCorrected?.reason).toContain('trust broker');
  });
});

describe('applyCorrection — guards', () => {
  beforeEach(() => useRanBerri.getState().reset());

  it('throws when no submission is active', () => {
    expect(() =>
      useRanBerri.getState().applyCorrection('insured.turnover', {
        value: 1,
        reason: 'x',
        correctedBy: 'nm',
        correctedAt: '2026-05-06T09:00:00Z',
      }),
    ).toThrow(/no active submission/);
  });

  it('throws when the path does not resolve to a Field', () => {
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'broker', id: 'test' },
      kind: 'submission.created',
      submissionId: 'sub_test_1',
      folio: 'TEST-001',
      broker: 'BrokerCo',
      submission: buildSubmission(),
    });
    expect(() =>
      useRanBerri.getState().applyCorrection('insured', {
        value: 1,
        reason: 'x',
        correctedBy: 'nm',
        correctedAt: '2026-05-06T09:00:00Z',
      }),
    ).toThrow(/does not resolve to a Field/);
  });
});
