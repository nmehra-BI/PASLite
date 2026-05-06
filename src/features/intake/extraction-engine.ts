import { useRanBerri } from '@/store';
import {
  GREENLINE_EMAIL,
  getExtractionSchedule,
  getGreenlineBrokerSubmission,
} from '@/lib/fixtures';
import type { Submission } from '@/lib/fixtures';
import type { Field, UnderwriterCorrected } from '@/lib/field';
import { getAtPath } from '@/lib/paths';
import { isField } from '@/lib/deps';
import { useIntake } from './intakeStore';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SUBMISSION_ID = 'sub_greenline_2026_05';
const FOLIO = 'MGA-PAS · folio 29481';
const MODEL_VERSION = 'sonnet-4-7';

const T_RECEIVE = 300;
const T_READ_PAGE = 150;
const T_PRE_EXTRACT = 200;
const T_HIGHLIGHT = 600;
const T_PULSE = 700;
const T_SETTLE = 300;

/**
 * The cinematic extraction sequence, driven through the audit log.
 *
 *   T+0.0s   button click → email.received + submission.created
 *            (broker layer); UI phase: receiving
 *   T+0.3s   reading: slip pages flash p1→p4
 *   T+1.2s   extracting: extraction.fieldExtracted per scheduled
 *            field, staggered ~150ms; the same event drives the
 *            store's materialised state and the audit trail
 *   T+3.5s   extraction.completed + gap.flagged
 *   T+3.8s   intake phase → complete
 *
 * Re-extraction emits a fresh `submission.created` (which replaces the
 * tree in replay) and re-emits the per-field events. Preserved
 * underwriter corrections are then re-applied via `restoreCorrection`,
 * which writes a `field.corrected` event with `actor: { kind:
 * 'system' }` and `note: 'preserved across rerun'`.
 */
export async function runExtraction(opts?: { rerun?: boolean }): Promise<void> {
  const intake = useIntake.getState();
  const main = useRanBerri.getState();

  const preserved = opts?.rerun ? collectCorrections(main.submission) : [];

  intake.resetForRerun();
  intake.setPhase('receiving');

  // ---- email arrives ----
  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'email.received',
    submissionId: SUBMISSION_ID,
    broker: GREENLINE_EMAIL.fromName,
    subject: GREENLINE_EMAIL.subject,
  });

  if (opts?.rerun) {
    main.appendAuditEvent({
      actor: { kind: 'system', modelVersion: MODEL_VERSION },
      kind: 'extraction.rerun',
      submissionId: SUBMISSION_ID,
      preservedCorrections: preserved.length,
    });
  }

  // Snapshot event: broker layer populated, no system or underwriter
  // layers yet. Replay treats this as a state replacement.
  main.appendAuditEvent({
    actor: { kind: 'broker', id: GREENLINE_EMAIL.fromName },
    kind: 'submission.created',
    submissionId: SUBMISSION_ID,
    folio: FOLIO,
    broker: GREENLINE_EMAIL.fromName,
    submission: getGreenlineBrokerSubmission(),
  });

  await sleep(T_RECEIVE);

  // ---- reading phase ----
  intake.setPhase('reading');
  for (let p = 1; p <= 4; p++) {
    intake.setSlipPage(p);
    await sleep(T_READ_PAGE);
  }

  await sleep(T_PRE_EXTRACT);

  // ---- extracting phase ----
  intake.setPhase('extracting');
  main.appendAuditEvent({
    actor: { kind: 'system', modelVersion: MODEL_VERSION },
    kind: 'extraction.started',
    submissionId: SUBMISSION_ID,
  });

  const schedule = getExtractionSchedule();
  const extractedAt = new Date().toISOString();
  let confidenceSum = 0;

  for (const step of schedule) {
    const page = pageFromSourceRef(step.sourceRef);
    if (page) intake.setSlipPage(page);
    intake.setHighlightedSourceRef(step.sourceRef);
    intake.revealField(step.fieldPath, { pulse: step.pulseGap });
    confidenceSum += step.confidence;

    main.appendAuditEvent({
      actor: { kind: 'system', modelVersion: MODEL_VERSION },
      kind: 'extraction.fieldExtracted',
      submissionId: SUBMISSION_ID,
      fieldPath: step.fieldPath,
      value: step.value,
      confidence: step.confidence,
      sourceRef: step.sourceRef,
      extractedAt,
      modelVersion: MODEL_VERSION,
    });

    if (step.pulseGap) {
      const pathToClear = step.fieldPath;
      setTimeout(() => useIntake.getState().clearPulse(pathToClear), T_PULSE);
    }

    await sleep(150);
    setTimeout(() => useIntake.getState().setHighlightedSourceRef(null), T_HIGHLIGHT);
  }

  // ---- gap + completion ----
  const fieldCount = schedule.length;
  const avg = confidenceSum / fieldCount;

  main.appendAuditEvent({
    actor: { kind: 'system', modelVersion: MODEL_VERSION },
    kind: 'extraction.completed',
    submissionId: SUBMISSION_ID,
    fieldCount,
    avgConfidence: avg,
  });

  main.appendAuditEvent({
    actor: { kind: 'system', modelVersion: MODEL_VERSION },
    kind: 'gap.flagged',
    submissionId: SUBMISSION_ID,
    fieldPath: 'fireSuppressionDisclosed',
    description: 'Fire suppression not disclosed on the slip.',
  });

  // ---- restore preserved corrections (rerun only) ----
  if (preserved.length > 0) {
    for (const { path, correction } of preserved) {
      try {
        useRanBerri.getState().restoreCorrection(path, correction, MODEL_VERSION);
      } catch {
        // Path no longer exists in the fresh tree — drop the
        // correction. Safe in module 2.
      }
    }
  }

  await sleep(T_SETTLE);
  intake.finalize({
    avgConfidence: avg,
    fieldCount,
    at: new Date().toISOString(),
  });
}

function pageFromSourceRef(ref: string): number | null {
  const m = ref.match(/^slip:p(\d+)/);
  if (!m) return null;
  return Number(m[1]);
}

type PreservedCorrection = {
  path: string;
  correction: UnderwriterCorrected<unknown>;
};

/**
 * Walk a Submission tree and collect every Field<T> that carries an
 * underwriterCorrected layer. Used by re-extraction to preserve human
 * overrides across a fresh AI run.
 *
 * Re-extraction OVERWRITES systemExtracted (the AI re-reads the slip),
 * but it must NEVER discard underwriterCorrected (the human override
 * always wins). That's the whole point of the three-layer model.
 */
function collectCorrections(
  submission: Submission | null,
): PreservedCorrection[] {
  if (!submission) return [];
  const out: PreservedCorrection[] = [];
  walk(submission, '', out);
  return out;
}

function walk(value: unknown, path: string, out: PreservedCorrection[]): void {
  if (value === null || typeof value !== 'object') return;

  if (isField(value)) {
    if (value.underwriterCorrected) {
      out.push({
        path,
        correction: value.underwriterCorrected as UnderwriterCorrected<unknown>,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walk(value[i], `${path}[${i}]`, out);
    }
    return;
  }

  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    walk(v, next, out);
  }
}

export function readField<T = unknown>(path: string): Field<T> | null {
  const sub = useRanBerri.getState().submission;
  if (!sub) return null;
  const v = getAtPath(sub, path);
  if (!isField(v)) return null;
  return v as Field<T>;
}
