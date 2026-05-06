import type { AuditEvent } from '@/lib/audit';
import type { Submission } from '@/lib/fixtures/types';
import type { Field, SystemExtracted } from '@/lib/field';
import { extractField } from '@/lib/field';
import { isField, type ArtifactKey } from '@/lib/deps';
import { getAtPath, setAtPath } from '@/lib/paths';

/**
 * Reconstruct cockpit state from the audit log.
 *
 * The log is the canonical persistence form; the materialised state
 * in the store is derived. Replay is pure and deterministic: same log
 * in &rarr; same state out.
 *
 * Snapshot events (`submission.created`) reset state. Delta events
 * (`extraction.fieldExtracted`, `field.corrected`, `artifact.computed`,
 * `artifact.stale`) update specific paths. Other events update intake
 * metadata.
 */

export type ArtifactState = {
  computedAt: string | null;
  /** Set when an artifact transitions from computed → stale. */
  staleSince: string | null;
};

export type IntakeReplayState = {
  phase: 'idle' | 'receiving' | 'reading' | 'extracting' | 'complete';
  fieldCount: number | null;
  avgConfidence: number | null;
  completedAt: string | null;
};

export type ReplayResult = {
  submission: Submission | null;
  artifacts: Record<ArtifactKey, ArtifactState>;
  intake: IntakeReplayState;
};

export function freshArtifacts(): Record<ArtifactKey, ArtifactState> {
  return {
    enrichment: { computedAt: null, staleSince: null },
    conflicts: { computedAt: null, staleSince: null },
    rating: { computedAt: null, staleSince: null },
    quote: { computedAt: null, staleSince: null },
    recommendation: { computedAt: null, staleSince: null },
  };
}

const ALL_ARTIFACTS: readonly ArtifactKey[] = [
  'enrichment',
  'conflicts',
  'rating',
  'quote',
  'recommendation',
];

function freshIntake(): IntakeReplayState {
  return {
    phase: 'idle',
    fieldCount: null,
    avgConfidence: null,
    completedAt: null,
  };
}

export function replay(events: AuditEvent[]): ReplayResult {
  let submission: Submission | null = null;
  const artifacts = freshArtifacts();
  const intake = freshIntake();

  for (const e of events) {
    switch (e.kind) {
      case 'email.received':
        if (intake.phase === 'idle') intake.phase = 'receiving';
        break;

      case 'submission.created':
        // Snapshot. Deep-clone so subsequent mutations don't reach back into
        // the event payload.
        submission = structuredClone(e.submission);
        if (intake.phase === 'idle') intake.phase = 'receiving';
        break;

      case 'extraction.started':
        intake.phase = 'extracting';
        break;

      case 'extraction.fieldExtracted':
        if (submission) {
          applyExtraction(submission, e.fieldPath, e.value, {
            confidence: e.confidence,
            sourceRef: e.sourceRef,
            extractedAt: e.extractedAt,
            modelVersion: e.modelVersion,
          });
        }
        break;

      case 'extraction.completed':
        intake.phase = 'complete';
        intake.fieldCount = e.fieldCount;
        intake.avgConfidence = e.avgConfidence;
        intake.completedAt = e.at;
        break;

      case 'extraction.rerun':
        // Marker only; subsequent submission.created replaces state.
        break;

      case 'field.corrected':
        if (submission) {
          const cur = getAtPath(submission, e.fieldPath);
          if (isField(cur)) {
            setAtPath(submission, e.fieldPath, {
              ...cur,
              underwriterCorrected: {
                value: e.value,
                reason: e.reason,
                correctedBy: e.correctedBy,
                correctedAt: e.at,
              },
            });
          }
        }
        break;

      case 'artifact.computed':
        if (isArtifactKey(e.artifact)) {
          artifacts[e.artifact].computedAt = e.computedAt;
          artifacts[e.artifact].staleSince = null;
        }
        break;

      case 'artifact.stale':
        if (isArtifactKey(e.artifact)) {
          artifacts[e.artifact].computedAt = null;
          artifacts[e.artifact].staleSince = e.at;
        }
        break;

      // Pass-through (no state mutation in module 2 scope):
      case 'submission.received':
      case 'gap.flagged':
      case 'enrichment.completed':
      case 'conflict.flagged':
      case 'rating.computed':
      case 'quote.issued':
      case 'recommendation.generated':
      case 'decision.recorded':
        break;
    }
  }

  return { submission, artifacts, intake };
}

function isArtifactKey(s: string): s is ArtifactKey {
  return (ALL_ARTIFACTS as readonly string[]).includes(s);
}

/**
 * Apply an extracted value at a path on the submission tree.
 *
 *   - If the path resolves to a Field<T>, set systemExtracted on it.
 *   - If the path resolves to an aggregate (e.g. `sites`), walk into
 *     the structure and apply each leaf accordingly.
 *
 * The aggregate case is what lets the schedule emit a single event for
 * `sites` whose value is an array of plain Site-shaped records; replay
 * lifts each property into the corresponding Site's child Field<T>.
 *
 * Mutates `submission` in place.
 */
export function applyExtraction(
  submission: Submission,
  path: string,
  value: unknown,
  meta: Omit<SystemExtracted<unknown>, 'value'>,
): void {
  const node = getAtPath(submission, path);
  if (isField(node)) {
    setAtPath(
      submission,
      path,
      extractField(node as Field<unknown>, {
        value,
        confidence: meta.confidence,
        sourceRef: meta.sourceRef,
        extractedAt: meta.extractedAt,
        modelVersion: meta.modelVersion,
      }),
    );
    return;
  }
  if (Array.isArray(node) && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const sub = value[i];
      if (sub && typeof sub === 'object') {
        for (const [key, v] of Object.entries(sub as Record<string, unknown>)) {
          applyExtraction(submission, `${path}[${i}].${key}`, v, meta);
        }
      }
    }
    return;
  }
  // Otherwise: silently skip. The audit event still records the attempt.
}
