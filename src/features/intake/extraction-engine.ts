import { useRanBerri } from '@/store';
import {
  GREENLINE_EMAIL,
  getExtractionSchedule,
  getGreenlineSubmission,
} from '@/lib/fixtures';
import type { Submission } from '@/lib/fixtures';
import type { Field, UnderwriterCorrected } from '@/lib/field';
import { getAtPath, setAtPath } from '@/lib/paths';
import { isField } from '@/lib/deps';
import { useIntake } from './intakeStore';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const T_RECEIVE = 300;
const T_READ_PAGE = 150;
const T_PRE_EXTRACT = 200;
const T_HIGHLIGHT = 600;
const T_PULSE = 700;
const T_SETTLE = 300;

/**
 * The cinematic extraction sequence.
 *
 *   T+0.0s   button click → phase: receiving, audit: email.received
 *   T+0.3s   phase: reading, slip pages flash p1→p4
 *   T+1.2s   phase: extracting, fields appear staggered (~150ms each)
 *   T+3.5s   audit: extraction.completed + gap.flagged for fire suppression
 *   T+3.8s   phase: complete; commit Submission to main store
 *
 * This is intentionally driven by setTimeout, not an animation library
 * &mdash; the timing of audit events and field reveals matters for
 * downstream modules.
 */
export async function runExtraction(opts?: { rerun?: boolean }): Promise<void> {
  const intake = useIntake.getState();
  const main = useRanBerri.getState();

  const preserved = opts?.rerun ? collectCorrections(main.submission) : [];

  intake.resetForRerun();
  intake.setPhase('receiving');

  // Audit: email arrived
  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'email.received',
    submissionId: 'sub_greenline_2026_05',
    broker: GREENLINE_EMAIL.fromName,
    subject: GREENLINE_EMAIL.subject,
  });

  if (opts?.rerun) {
    main.appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'extraction.rerun',
      submissionId: 'sub_greenline_2026_05',
      preservedCorrections: preserved.length,
    });
  }

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
    actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
    kind: 'extraction.started',
    submissionId: 'sub_greenline_2026_05',
  });

  const schedule = getExtractionSchedule();
  let confidenceSum = 0;
  for (const step of schedule) {
    // jump the slip preview to the right page so the highlight is visible
    const page = pageFromSourceRef(step.sourceRef);
    if (page) intake.setSlipPage(page);
    intake.setHighlightedSourceRef(step.sourceRef);
    intake.revealField(step.fieldPath, { pulse: step.pulseGap });
    confidenceSum += step.confidence;

    main.appendAuditEvent({
      actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
      kind: 'extraction.fieldExtracted',
      submissionId: 'sub_greenline_2026_05',
      fieldPath: step.fieldPath,
      confidence: step.confidence,
    });

    if (step.pulseGap) {
      // schedule the pulse to clear; don't await
      const pathToClear = step.fieldPath;
      setTimeout(() => useIntake.getState().clearPulse(pathToClear), T_PULSE);
    }

    await sleep(150);
    // fade out the highlight (visually it'll fade via CSS transition)
    setTimeout(() => useIntake.getState().setHighlightedSourceRef(null), T_HIGHLIGHT);
  }

  // ---- commit + flag gap + settle ----
  const fieldCount = schedule.length;
  const avg = confidenceSum / fieldCount;

  main.setSubmission(getGreenlineSubmission());

  // re-apply preserved underwriter corrections (rerun preserves human overrides)
  if (preserved.length > 0) {
    for (const { path, correction } of preserved) {
      try {
        useRanBerri.getState().applyCorrection(path, correction);
      } catch {
        // no-op: if the path no longer exists in the submission tree we
        // simply drop the correction. This is safe in module 2.
      }
    }
  }

  main.appendAuditEvent({
    actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
    kind: 'extraction.completed',
    submissionId: 'sub_greenline_2026_05',
    fieldCount,
    avgConfidence: avg,
  });

  // surface the fire-suppression gap as its own audit event
  main.appendAuditEvent({
    actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
    kind: 'gap.flagged',
    submissionId: 'sub_greenline_2026_05',
    fieldPath: 'fireSuppressionDisclosed',
    description: 'Fire suppression not disclosed on the slip.',
  });

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
 * NOTE: re-extraction OVERWRITES systemExtracted (the AI re-reads the
 * slip), but it must NEVER discard underwriterCorrected (the human
 * override always wins). That's the whole point of the three-layer
 * model.
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

/**
 * Read a Field<T> at a dotted path on the submission tree. Returns
 * null if no submission is loaded or the path does not resolve to a
 * Field.
 */
export function readField<T = unknown>(path: string): Field<T> | null {
  const sub = useRanBerri.getState().submission;
  if (!sub) return null;
  const v = getAtPath(sub, path);
  if (!isField(v)) return null;
  return v as Field<T>;
}

export const __test_only = { collectCorrections, walk, setAtPath };
