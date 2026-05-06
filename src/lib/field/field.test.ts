import { describe, it, expect } from 'vitest';
import {
  createField,
  extractField,
  correctField,
  effectiveValue,
  effectiveLayer,
  isStale,
} from './field';

describe('Field<T> effectiveValue precedence', () => {
  it('returns null when no layer is populated', () => {
    const f = createField<number>();
    expect(effectiveValue(f)).toBeNull();
    expect(effectiveLayer(f)).toBe('empty');
  });

  it('returns brokerStated when only that layer is populated', () => {
    const f = createField<number>(100);
    expect(effectiveValue(f)).toBe(100);
    expect(effectiveLayer(f)).toBe('broker');
  });

  it('prefers systemExtracted over brokerStated', () => {
    const f = extractField(createField<number>(100), {
      value: 120,
      confidence: 0.92,
      sourceRef: 'slip:p2:line14',
      extractedAt: '2026-05-06T09:00:00Z',
      modelVersion: 'sonnet-4-7',
    });
    expect(effectiveValue(f)).toBe(120);
    expect(effectiveLayer(f)).toBe('system');
  });

  it('prefers underwriterCorrected over both other layers', () => {
    const base = extractField(createField<number>(100), {
      value: 120,
      confidence: 0.92,
      sourceRef: 'slip:p2:line14',
      extractedAt: '2026-05-06T09:00:00Z',
      modelVersion: 'sonnet-4-7',
    });
    const corrected = correctField(base, {
      value: 115,
      reason: 'Broker confirmed by phone',
      correctedBy: 'underwriter:nm',
      correctedAt: '2026-05-06T09:30:00Z',
    });
    expect(effectiveValue(corrected)).toBe(115);
    expect(effectiveLayer(corrected)).toBe('underwriter');
  });

  it('falls back to brokerStated when systemExtracted value is null', () => {
    const f = extractField(createField<number>(100), {
      value: null,
      confidence: 0.1,
      sourceRef: 'slip:p2',
      extractedAt: '2026-05-06T09:00:00Z',
      modelVersion: 'sonnet-4-7',
    });
    expect(effectiveValue(f)).toBe(100);
    expect(effectiveLayer(f)).toBe('broker');
  });

  it('isStale returns true when a field changed after the artifact was computed', () => {
    const f = correctField(createField<number>(100), {
      value: 115,
      reason: 'phone',
      correctedBy: 'underwriter:nm',
      correctedAt: '2026-05-06T10:00:00Z',
    });
    expect(isStale('2026-05-06T09:00:00Z', [f])).toBe(true);
    expect(isStale('2026-05-06T11:00:00Z', [f])).toBe(false);
  });

  it('isStale returns true when the artifact has never been computed', () => {
    const f = createField<number>(100);
    expect(isStale(null, [f])).toBe(true);
  });
});
