import { useRanBerri } from '@/store';
import { effectiveValue } from '@/lib/field';
import type { LossRun } from '@/lib/fixtures';
import { runRating } from '@/lib/rating';
import { draftEmail } from '@/lib/email/draftEmail';

const SUBMISSION_ID = 'sub_greenline_2026_05';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const CELL_STAGGER_MS = 120;
const PRE_FINAL_PAUSE_MS = 200;
const SETTLE_MS = 200;

/**
 * Run the rating engine cinematically. Computes the full breakdown up
 * front (rules are deterministic) and reveals each cell to the audit
 * log + UI on a 120ms stagger; H58 lands with an extra 200ms pause to
 * make the verdict feel decisive.
 */
export async function runRatingCinematic(opts?: {
  rerun?: boolean;
}): Promise<void> {
  const main = useRanBerri.getState();
  const submission = main.submission;
  if (!submission) return;

  const priorIteration = main.rating.iteration ?? 1;
  const iteration = opts?.rerun ? priorIteration + 1 : priorIteration;

  if (opts?.rerun) {
    main.appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'rating.rerun',
      submissionId: SUBMISSION_ID,
      nextIteration: iteration,
    });
  }

  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'rating.started',
    submissionId: SUBMISSION_ID,
    iteration,
  });

  // Build the rating inputs from the live submission state.
  const turnover = (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
  const yearsInBusiness = (effectiveValue(submission.insured.yearsTrading) as number | null) ?? 0;
  const sites = submission.sites.length;
  const materials = (effectiveValue(submission.materials) as string[] | null) ?? [];
  const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
    | boolean
    | null;
  const fireSuppression: 'present' | 'absent' | 'undisclosed' =
    fsValue === true ? 'present' : fsValue === false ? 'absent' : 'undisclosed';
  const lossRatio = (effectiveValue(submission.statedLossRatio) as number | null) ?? 0;
  const lossRuns = (effectiveValue(submission.lossRuns) as LossRun[] | null) ?? [];
  const largestSingleClaim = lossRuns.reduce(
    (max, r) => Math.max(max, r.amount),
    0,
  );
  const brokerTargetPremium =
    (effectiveValue(submission.brokerTargetPremium) as number | null) ?? undefined;

  const computedAt = new Date().toISOString();
  const out = runRating(
    {
      turnover,
      siteCount: sites,
      materials,
      fireSuppression,
      lossRatio,
      largestSingleClaim,
      yearsInBusiness,
      brokerTargetPremium,
    },
    computedAt,
  );

  // Reveal cells one by one.
  for (let i = 0; i < out.cells.length; i++) {
    const cell = out.cells[i]!;
    const isFinal = cell.ref === 'H58';
    await sleep(isFinal ? PRE_FINAL_PAUSE_MS + CELL_STAGGER_MS : CELL_STAGGER_MS);
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'rating.cellComputed',
      submissionId: SUBMISSION_ID,
      ref: cell.ref,
      label: cell.label,
      op: cell.op,
      value: cell.value,
      format: cell.format,
      subtotalAfter: cell.subtotalAfter,
      formula: cell.formula,
      cellInputs: cell.inputs,
    });
  }

  await sleep(SETTLE_MS);
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'rating.completed',
    submissionId: SUBMISSION_ID,
    premium: out.premium,
    sha: iteration > 1 ? `${out.sha}-r${iteration}` : out.sha,
    version: out.version,
    tier: out.tier,
    iteration,
  });

  useRanBerri.getState().markArtifactComputed('rating');
}

/**
 * Generate the slip artefact + draft the broker email. Idempotent —
 * rerunning preserves the slip's user-edited fields (their
 * `slip.fieldEdited` events stay in the log). Emits
 * `slip.generated`, optionally `slip.regenerated` (with the list of
 * preserved field keys), plus `email.drafted` when there's no email
 * yet OR when `regenerate` is true.
 *
 * `revision: true` marks this regen as a revised-quote redraft (after
 * a sent quote went stale). The covering email opens with the prior
 * premium + sent date so the broker reads "we've revised" rather than
 * a fresh quote.
 */
export function generateSlipAndEmail(opts?: {
  regenerate?: boolean;
  revision?: boolean;
}): void {
  const main = useRanBerri.getState();
  const submission = main.submission;
  if (!submission) return;
  const ratingOutput = main.rating.output;
  if (!ratingOutput) return;

  const slipRef = `POL-29481-Q1`;

  // Capture prior version BEFORE we update the slip — used by the
  // revised email draft below.
  const priorVersion =
    opts?.revision && main.quote.sentAt && main.quote.slipPremium
      ? { premium: main.quote.slipPremium, sentAt: main.quote.sentAt }
      : null;

  if (opts?.regenerate) {
    const editKeys = Object.keys(main.quote.slipEdits);
    main.appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'slip.regenerated',
      submissionId: SUBMISSION_ID,
      preservedEdits: editKeys.length,
      preservedEditKeys: editKeys,
      revision: opts?.revision,
    });
  }

  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'slip.generated',
    submissionId: SUBMISSION_ID,
    slipRef,
    premium: ratingOutput.premium,
    sha: ratingOutput.sha,
  });

  // Draft the email if none exists yet, OR if we're regenerating
  // (revised quote requires a fresh draft).
  if (!main.quote.email || opts?.regenerate) {
    const broker =
      (effectiveValue(submission.broker) as string | null) ??
      'SureStep Brokers Ltd';
    const brokerTarget =
      (effectiveValue(submission.brokerTargetPremium) as number | null) ?? null;
    const lossRatio =
      (effectiveValue(submission.statedLossRatio) as number | null) ?? null;
    const inception =
      (effectiveValue(submission.cover.inceptionDate) as string | null) ?? null;
    const expiry =
      (effectiveValue(submission.cover.expiryDate) as string | null) ?? null;
    const leedsPermitWarranty = submission.sites.some((site) => {
      const name = effectiveValue(site.name) as string | null;
      const exp = effectiveValue(site.permitExpiry) as string | null;
      if (!name?.toLowerCase().includes('leeds') || !exp) return false;
      if (!inception || !expiry) return false;
      return exp >= inception && exp <= expiry;
    });

    const { subject, body } = draftEmail({
      submission,
      premium: ratingOutput.premium,
      brokerName: broker.split(' ')[0] === 'SureStep' ? 'Sarah' : broker,
      brokerTarget,
      lossRatio,
      leedsPermitWarranty,
      underwriter: 'Nishit',
      ref: slipRef,
      priorVersion,
    });

    main.appendAuditEvent({
      actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
      kind: 'email.drafted',
      submissionId: SUBMISSION_ID,
      subject,
      body,
      recipient: 's.whitfield@surestep.co.uk',
      revision: opts?.revision,
    });
  }

  useRanBerri.getState().markArtifactComputed('quote');
}

/**
 * Orchestrate a revised-quote send: rerun the rating cinematic if
 * stale, regenerate the slip with revision=true (which redrafts the
 * email with prior-version context), and resolve when the modal is
 * ready to open.
 */
export async function prepareRevisedQuote(): Promise<void> {
  const main = useRanBerri.getState();
  const ratingArtifact = main.artifacts.rating;
  if (ratingArtifact.staleSince !== null) {
    await runRatingCinematic({ rerun: true });
  }
  generateSlipAndEmail({ regenerate: true, revision: true });
}

/**
 * Mark a previously-sent quote as stale because the underlying
 * rating changed. Does NOT recall the quote — that's an explicit
 * underwriter action via `recallQuote`.
 */
export function markQuoteStale(reason: string): void {
  const main = useRanBerri.getState();
  if (main.quote.phase !== 'sent') return;
  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'quote.markedStale',
    submissionId: SUBMISSION_ID,
    reason,
  });
}
