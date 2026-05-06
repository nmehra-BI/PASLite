import { describe, expect, it } from 'vitest';
import { replay } from './replay';
import type { AuditEvent } from '@/lib/audit';
import {
  getExtractionSchedule,
  getGreenlineBrokerSubmission,
  getGreenlineSubmission,
} from '@/lib/fixtures';
import { effectiveValue, effectiveLayer } from '@/lib/field';

const SUB_ID = 'sub_greenline_2026_05';
const MODEL = 'sonnet-4-7';
const EXTRACTED_AT = '2026-05-09T08:14:38Z';

let counter = 0;
const id = () => `evt_${(++counter).toString(36)}`;

function brokerCreated(at = '2026-05-09T08:14:00Z'): AuditEvent {
  return {
    id: id(),
    at,
    actor: { kind: 'broker', id: 'Sarah Whitfield' },
    kind: 'submission.created',
    submissionId: SUB_ID,
    folio: 'MGA-PAS · folio 29481',
    broker: 'Sarah Whitfield',
    submission: getGreenlineBrokerSubmission(),
  };
}

function fullExtractionEvents(): AuditEvent[] {
  const events: AuditEvent[] = [];
  events.push({
    id: id(),
    at: '2026-05-09T08:14:30Z',
    actor: { kind: 'system', modelVersion: MODEL },
    kind: 'extraction.started',
    submissionId: SUB_ID,
  });
  for (const step of getExtractionSchedule()) {
    events.push({
      id: id(),
      at: EXTRACTED_AT,
      actor: { kind: 'system', modelVersion: MODEL },
      kind: 'extraction.fieldExtracted',
      submissionId: SUB_ID,
      fieldPath: step.fieldPath,
      value: step.value,
      confidence: step.confidence,
      sourceRef: step.sourceRef,
      extractedAt: EXTRACTED_AT,
      modelVersion: MODEL,
    });
  }
  events.push({
    id: id(),
    at: EXTRACTED_AT,
    actor: { kind: 'system', modelVersion: MODEL },
    kind: 'extraction.completed',
    submissionId: SUB_ID,
    fieldCount: getExtractionSchedule().length,
    avgConfidence: 0.94,
  });
  return events;
}

describe('replay', () => {
  it('reconstructs an empty world from an empty log', () => {
    const r = replay([]);
    expect(r.submission).toBeNull();
    expect(r.intake.phase).toBe('idle');
    expect(r.artifacts.rating.computedAt).toBeNull();
  });

  it('reconstructs the broker shell from submission.created alone', () => {
    const r = replay([brokerCreated()]);
    expect(r.submission?.id).toBe(SUB_ID);
    expect(r.submission?.insured.turnover.brokerStated).toBe(8_420_000);
    expect(r.submission?.insured.turnover.systemExtracted).toBeNull();
    expect(r.intake.phase).toBe('receiving');
  });

  it('reconstructs the fully-populated tree from a complete extraction log', () => {
    const events = [brokerCreated(), ...fullExtractionEvents()];
    const r = replay(events);
    expect(r.submission).not.toBeNull();

    const sub = r.submission!;
    expect(sub.insured.turnover.systemExtracted?.value).toBe(8_420_000);
    expect(sub.insured.turnover.systemExtracted?.confidence).toBe(0.96);
    expect(sub.insured.turnover.systemExtracted?.sourceRef).toBe('slip:p2:l14');

    // Aggregate path: sites should be populated through the walk
    expect(sub.sites[0]!.name.systemExtracted?.value).toBe('Birmingham (HQ)');
    expect(sub.sites[1]!.permitRef.systemExtracted?.value).toBe('EAWML-99214');

    // Materials and lossRuns are Field<T> with array values
    expect(sub.materials.systemExtracted?.value).toEqual(
      (getGreenlineSubmission().materials.systemExtracted!.value),
    );
    expect(sub.fireSuppressionDisclosed.systemExtracted?.value).toBe(false);

    expect(r.intake.phase).toBe('complete');
    expect(r.intake.fieldCount).toBe(getExtractionSchedule().length);
  });

  it('layers an underwriter correction on top of an extracted field', () => {
    const events: AuditEvent[] = [
      brokerCreated(),
      ...fullExtractionEvents(),
      {
        id: id(),
        at: '2026-05-09T09:15:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'field.corrected',
        submissionId: SUB_ID,
        fieldPath: 'insured.turnover',
        value: 7_910_000,
        reason: 'Companies House FY24 accounts show £7.91M.',
        correctedBy: 'nm',
      },
      {
        id: id(),
        at: '2026-05-09T09:15:00Z',
        actor: { kind: 'system' },
        kind: 'artifact.stale',
        submissionId: SUB_ID,
        artifact: 'rating',
      },
    ];
    const r = replay(events);
    const turnover = r.submission!.insured.turnover;
    expect(turnover.brokerStated).toBe(8_420_000);
    expect(turnover.systemExtracted?.value).toBe(8_420_000);
    expect(turnover.underwriterCorrected?.value).toBe(7_910_000);
    expect(turnover.underwriterCorrected?.correctedBy).toBe('nm');
    expect(effectiveValue(turnover)).toBe(7_910_000);
    expect(effectiveLayer(turnover)).toBe('underwriter');

    expect(r.artifacts.rating.computedAt).toBeNull();
    expect(r.artifacts.rating.staleSince).toBe('2026-05-09T09:15:00Z');
  });

  it('preserves a correction across re-extraction (system-actor field.corrected)', () => {
    // Original extraction + correction
    const original: AuditEvent[] = [
      brokerCreated('2026-05-09T08:14:00Z'),
      ...fullExtractionEvents(),
      {
        id: id(),
        at: '2026-05-09T09:15:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'field.corrected',
        submissionId: SUB_ID,
        fieldPath: 'insured.turnover',
        value: 7_910_000,
        reason: 'Companies House FY24.',
        correctedBy: 'nm',
      },
    ];
    // Rerun: fresh submission.created, fresh extraction, system-actor restore
    const rerun: AuditEvent[] = [
      {
        id: id(),
        at: '2026-05-09T10:00:00Z',
        actor: { kind: 'system', modelVersion: MODEL },
        kind: 'extraction.rerun',
        submissionId: SUB_ID,
        preservedCorrections: 1,
      },
      brokerCreated('2026-05-09T10:00:00Z'),
      ...fullExtractionEvents(),
      {
        id: id(),
        at: '2026-05-09T09:15:00Z', // ORIGINAL correctedAt preserved
        actor: { kind: 'system', modelVersion: MODEL },
        kind: 'field.corrected',
        submissionId: SUB_ID,
        fieldPath: 'insured.turnover',
        value: 7_910_000,
        reason: 'Companies House FY24.',
        correctedBy: 'nm',
        note: 'preserved across rerun',
      },
    ];
    const r = replay([...original, ...rerun]);
    const turnover = r.submission!.insured.turnover;
    expect(turnover.systemExtracted?.value).toBe(8_420_000);
    expect(turnover.underwriterCorrected?.value).toBe(7_910_000);
    expect(turnover.underwriterCorrected?.correctedBy).toBe('nm');
    expect(turnover.underwriterCorrected?.correctedAt).toBe(
      '2026-05-09T09:15:00Z',
    );
    expect(effectiveValue(turnover)).toBe(7_910_000);
  });

  it('reconstructs enrichment phase + sources from the log', () => {
    const events: AuditEvent[] = [
      {
        id: id(),
        at: '2026-05-09T08:15:00Z',
        actor: { kind: 'system' },
        kind: 'enrichment.started',
        submissionId: SUB_ID,
      },
      {
        id: id(),
        at: '2026-05-09T08:15:00Z',
        actor: { kind: 'system' },
        kind: 'enrichment.sourceQueried',
        submissionId: SUB_ID,
        source: 'companies-house',
        queryRef: 'q1',
      },
      {
        id: id(),
        at: '2026-05-09T08:15:00.800Z',
        actor: { kind: 'system' },
        kind: 'enrichment.sourceReturned',
        submissionId: SUB_ID,
        source: 'companies-house',
        queryRef: 'q1',
        latencyMs: 800,
        payload: {
          id: 'companies-house',
          summary: 'turnover £7.91M (filed FY23)',
          verdict: 'conflict',
          payload: {
            status: 'active',
            registeredOffice: 'Birmingham',
            dateOfIncorporation: '2010-11-04',
            directors: [],
            latestFiling: { fyEnding: 'FY23', filedAt: '2025-03-31', turnover: 7_910_000 },
          },
          refreshedAt: '2026-05-09T08:15:00.800Z',
        },
        summary: 'turnover £7.91M (filed FY23)',
        verdict: 'conflict',
      },
      {
        id: id(),
        at: '2026-05-09T08:15:01Z',
        actor: { kind: 'system' },
        kind: 'enrichment.completed',
        submissionId: SUB_ID,
        sources: ['companies-house'],
        conflictCount: 1,
        gapCount: 0,
      },
    ];
    const r = replay(events);
    expect(r.enrichment.phase).toBe('settled');
    expect(r.enrichment.sources['companies-house']?.status).toBe('returned');
    expect(r.enrichment.sources['companies-house']?.latencyMs).toBe(800);
    expect(r.enrichment.conflictCountAtSettle).toBe(1);
  });

  it('reconstructs a conflict and preserves its resolution across re-detection', () => {
    const conflictEvent: AuditEvent = {
      id: id(),
      at: '2026-05-09T08:15:01Z',
      actor: { kind: 'system' },
      kind: 'conflict.detected',
      submissionId: SUB_ID,
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      brokerValue: 8_420_000,
      brokerSourceRef: 'slip:p2:l14',
      externalSource: 'companies-house',
      externalValue: 7_910_000,
      externalSourceRef: 'CH:filing:FY23',
      marginalia: 'FY24 not yet filed; common timing mismatch.',
    };
    const events: AuditEvent[] = [
      conflictEvent,
      {
        id: id(),
        at: '2026-05-09T09:18:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'conflict.resolved',
        submissionId: SUB_ID,
        conflictId: 'conflict_turnover',
        fieldPath: 'insured.turnover',
        choice: 'external',
        value: 7_910_000,
        reason: 'FY24 not yet filed; using FY23 for technical conservatism.',
        resolvedBy: 'nm',
      },
      // Re-detection (same conflict id) after a rerun
      { ...conflictEvent, id: id(), at: '2026-05-09T10:00:00Z' },
    ];
    const r = replay(events);
    expect(r.enrichment.conflicts).toHaveLength(1);
    const c = r.enrichment.conflicts[0]!;
    expect(c.id).toBe('conflict_turnover');
    expect(c.resolution?.value).toBe(7_910_000);
    expect(c.resolution?.choice).toBe('external');
    expect(c.resolution?.resolvedBy).toBe('nm');
  });

  it('reconstructs gap detection + resolution + requestSent', () => {
    const events: AuditEvent[] = [
      {
        id: id(),
        at: '2026-05-09T08:15:01Z',
        actor: { kind: 'system' },
        kind: 'gap.detected',
        submissionId: SUB_ID,
        gapId: 'gap_fireSuppression',
        fieldPath: 'fireSuppressionDisclosed',
        description: 'Fire suppression not disclosed.',
      },
      {
        id: id(),
        at: '2026-05-09T09:20:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'gap.resolved',
        submissionId: SUB_ID,
        gapId: 'gap_fireSuppression',
        fieldPath: 'fireSuppressionDisclosed',
        choice: 'request',
        value: null,
        reason: 'Asking broker to confirm before binding.',
        resolvedBy: 'nm',
      },
      {
        id: id(),
        at: '2026-05-09T09:20:00Z',
        actor: { kind: 'system' },
        kind: 'gap.requestSent',
        submissionId: SUB_ID,
        gapId: 'gap_fireSuppression',
        fieldPath: 'fireSuppressionDisclosed',
        recipient: 's.whitfield@surestep.co.uk',
      },
    ];
    const r = replay(events);
    expect(r.enrichment.gaps).toHaveLength(1);
    const g = r.enrichment.gaps[0]!;
    expect(g.resolution?.choice).toBe('request');
    expect(g.requestSent?.recipient).toBe('s.whitfield@surestep.co.uk');
  });

  it('conflict.dismissed marks the conflict dismissed (does not remove it)', () => {
    const events: AuditEvent[] = [
      brokerCreated(),
      {
        id: id(),
        at: '2026-05-09T08:15:01Z',
        actor: { kind: 'system' },
        kind: 'conflict.detected',
        submissionId: SUB_ID,
        conflictId: 'conflict_turnover',
        fieldPath: 'insured.turnover',
        brokerValue: 8_420_000,
        brokerSourceRef: 'slip:p2:l14',
        externalSource: 'companies-house',
        externalValue: 7_910_000,
        externalSourceRef: 'CH:filing:FY23',
        marginalia: '...',
      },
      {
        id: id(),
        at: '2026-05-09T08:18:00Z',
        actor: { kind: 'system' },
        kind: 'conflict.dismissed',
        submissionId: SUB_ID,
        conflictId: 'conflict_turnover',
        reason: 'no longer detected',
      },
    ];
    const r = replay(events);
    expect(r.enrichment.conflicts).toHaveLength(1);
    expect(r.enrichment.conflicts[0]!.dismissed).toBe(true);
    // Resolution slot stays null (it was never resolved)
    expect(r.enrichment.conflicts[0]!.resolution).toBeNull();
  });

  it('re-detection un-dismisses a conflict and preserves its prior resolution', () => {
    const detect = (): AuditEvent => ({
      id: id(),
      at: '2026-05-09T08:15:01Z',
      actor: { kind: 'system' },
      kind: 'conflict.detected',
      submissionId: SUB_ID,
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      brokerValue: 8_420_000,
      brokerSourceRef: 'slip:p2:l14',
      externalSource: 'companies-house',
      externalValue: 7_910_000,
      externalSourceRef: 'CH:filing:FY23',
      marginalia: '...',
    });
    const events: AuditEvent[] = [
      brokerCreated(),
      detect(),
      {
        id: id(),
        at: '2026-05-09T09:18:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'conflict.resolved',
        submissionId: SUB_ID,
        conflictId: 'conflict_turnover',
        fieldPath: 'insured.turnover',
        choice: 'external',
        value: 7_910_000,
        reason: 'FY24 not yet filed.',
        resolvedBy: 'nm',
      },
      {
        id: id(),
        at: '2026-05-09T09:30:00Z',
        actor: { kind: 'system' },
        kind: 'conflict.dismissed',
        submissionId: SUB_ID,
        conflictId: 'conflict_turnover',
        reason: 'reconciled',
      },
      // Re-detected on a later rerun
      { ...detect(), id: id(), at: '2026-05-09T10:00:00Z' },
    ];
    const r = replay(events);
    expect(r.enrichment.conflicts).toHaveLength(1);
    const c = r.enrichment.conflicts[0]!;
    expect(c.dismissed).toBe(false);
    expect(c.resolution?.value).toBe(7_910_000);
    expect(c.resolution?.choice).toBe('external');
  });

  it('reconstructs triage state + submission lifecycle from the log', () => {
    const events: AuditEvent[] = [
      brokerCreated(),
      ...fullExtractionEvents(),
      {
        id: id(),
        at: '2026-05-09T08:20:00Z',
        actor: { kind: 'system' },
        kind: 'triage.started',
        submissionId: SUB_ID,
      },
      {
        id: id(),
        at: '2026-05-09T08:20:01Z',
        actor: { kind: 'system' },
        kind: 'triage.checkEvaluated',
        submissionId: SUB_ID,
        check: 'appetite',
        outcome: 'pass',
        rationale: '6 of 6 rules met.',
        ruleIds: ['APP-001', 'APP-006'],
        rules: [],
      },
      {
        id: id(),
        at: '2026-05-09T08:20:02Z',
        actor: { kind: 'system' },
        kind: 'triage.completed',
        submissionId: SUB_ID,
        verdict: 'pass',
      },
      {
        id: id(),
        at: '2026-05-09T08:21:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'triage.checkOverridden',
        submissionId: SUB_ID,
        check: 'appetite',
        from: 'pass',
        to: 'refer',
        reason: 'see broker note attached',
        overriddenBy: 'nm',
      },
    ];
    const r = replay(events);
    expect(r.triage.phase).toBe('settled');
    expect(r.triage.checks).toHaveLength(1);
    expect(r.triage.checks[0]!.id).toBe('appetite');
    expect(r.triage.checks[0]!.override?.outcome).toBe('refer');
    expect(r.triage.verdict).toBe('pass'); // snapshot at completed
    expect(r.submissionState).toBe('active');
  });

  it('submission.referred sets the lifecycle state and referral record', () => {
    const events: AuditEvent[] = [
      brokerCreated(),
      {
        id: id(),
        at: '2026-05-09T09:00:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'submission.referred',
        submissionId: SUB_ID,
        reviewer: 'Sarah Patel',
        urgency: 'week',
        reason: 'edge case on rule APP-003.',
        referredBy: 'nm',
      },
    ];
    const r = replay(events);
    expect(r.submissionState).toBe('referred');
    expect(r.referral?.reviewer).toBe('Sarah Patel');
    expect(r.referral?.urgency).toBe('week');
  });

  it('submission.declined sets state + decline record', () => {
    const events: AuditEvent[] = [
      brokerCreated(),
      {
        id: id(),
        at: '2026-05-09T09:24:00Z',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'submission.declined',
        submissionId: SUB_ID,
        reasonCategory: 'outside-appetite',
        detail: 'turnover above cap.',
        notifyBroker: true,
        declinedBy: 'nm',
      },
    ];
    const r = replay(events);
    expect(r.submissionState).toBe('declined');
    expect(r.decline?.reasonCategory).toBe('outside-appetite');
    expect(r.decline?.notifyBroker).toBe(true);
  });

  it('artifact.computed clears staleSince', () => {
    const events: AuditEvent[] = [
      {
        id: id(),
        at: '2026-05-09T11:00:00Z',
        actor: { kind: 'system' },
        kind: 'artifact.stale',
        submissionId: SUB_ID,
        artifact: 'rating',
      },
      {
        id: id(),
        at: '2026-05-09T12:00:00Z',
        actor: { kind: 'system' },
        kind: 'artifact.computed',
        submissionId: SUB_ID,
        artifact: 'rating',
        computedAt: '2026-05-09T12:00:00Z',
      },
    ];
    const r = replay(events);
    expect(r.artifacts.rating.computedAt).toBe('2026-05-09T12:00:00Z');
    expect(r.artifacts.rating.staleSince).toBeNull();
  });
});
