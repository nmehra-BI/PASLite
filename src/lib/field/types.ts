/**
 * Three-layer Field<T>.
 *
 * Every extracted attribute on a submission carries three values:
 *
 *   brokerStated         — what the broker wrote on the slip. Immutable.
 *   systemExtracted      — what the AI parsed from that slip. Carries
 *                          confidence, source reference, model version.
 *   underwriterCorrected — explicit human override. Wins when present.
 *
 * The `effective` value is the one downstream computations use:
 *   underwriterCorrected.value ?? systemExtracted.value ?? brokerStated
 *
 * When an underwriter corrects a field, every artifact derived from that
 * field is marked stale. Recomputation is explicit (the user clicks
 * "rerun") — never automatic. This is regulated finance; predictability
 * beats convenience.
 */

export type ISO8601 = string;

export type SystemExtracted<T> = {
  value: T | null;
  confidence: number;
  sourceRef: string;
  extractedAt: ISO8601;
  modelVersion: string;
};

export type UnderwriterCorrected<T> = {
  value: T;
  reason: string;
  correctedBy: string;
  correctedAt: ISO8601;
};

export type Field<T> = {
  brokerStated: T | null;
  systemExtracted: SystemExtracted<T> | null;
  underwriterCorrected: UnderwriterCorrected<T> | null;
};

export type FieldLayer = 'broker' | 'system' | 'underwriter' | 'empty';
