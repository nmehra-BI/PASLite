import type { Field, FieldLayer, SystemExtracted, UnderwriterCorrected } from './types';

export function createField<T>(brokerStated: T | null = null): Field<T> {
  return {
    brokerStated,
    systemExtracted: null,
    underwriterCorrected: null,
  };
}

export function extractField<T>(
  field: Field<T>,
  extracted: SystemExtracted<T>,
): Field<T> {
  return { ...field, systemExtracted: extracted };
}

export function correctField<T>(
  field: Field<T>,
  correction: UnderwriterCorrected<T>,
): Field<T> {
  return { ...field, underwriterCorrected: correction };
}

export function clearCorrection<T>(field: Field<T>): Field<T> {
  return { ...field, underwriterCorrected: null };
}

/**
 * The value used downstream. Precedence:
 *   underwriterCorrected > systemExtracted > brokerStated
 */
export function effectiveValue<T>(field: Field<T>): T | null {
  if (field.underwriterCorrected) return field.underwriterCorrected.value;
  if (field.systemExtracted && field.systemExtracted.value !== null) {
    return field.systemExtracted.value;
  }
  return field.brokerStated;
}

export function effectiveLayer<T>(field: Field<T>): FieldLayer {
  if (field.underwriterCorrected) return 'underwriter';
  if (field.systemExtracted && field.systemExtracted.value !== null) return 'system';
  if (field.brokerStated !== null) return 'broker';
  return 'empty';
}

/**
 * A field is "dirty" when an underwriter correction sits on top of an
 * extracted value. Downstream artifacts derived before the correction
 * should be marked stale.
 */
export function isCorrected<T>(field: Field<T>): boolean {
  return field.underwriterCorrected !== null;
}

/**
 * A derived artifact (enrichment, rating, quote, recommendation) is stale
 * when its inputs were captured before the most recent correction
 * timestamp on any of its source fields.
 */
export function isStale(
  artifactComputedAt: string | null,
  sourceFields: Array<Field<unknown>>,
): boolean {
  if (!artifactComputedAt) return true;
  const computedAt = Date.parse(artifactComputedAt);
  for (const f of sourceFields) {
    if (f.underwriterCorrected) {
      if (Date.parse(f.underwriterCorrected.correctedAt) > computedAt) return true;
    }
    if (f.systemExtracted) {
      if (Date.parse(f.systemExtracted.extractedAt) > computedAt) return true;
    }
  }
  return false;
}
