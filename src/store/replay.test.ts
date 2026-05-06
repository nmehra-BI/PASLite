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
