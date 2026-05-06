import { useRanBerri } from '@/store';
import { CHECK_ORDER, runTriage, type CheckId } from '@/lib/appetite';

const SUBMISSION_ID = 'sub_greenline_2026_05';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Stagger between check resolutions during the cinematic. */
const STAGGER_MS = 300;
const SETTLE_MS = 200;

/**
 * The triage cinematic. Runs the four checks (synchronously, since
 * the rules are pure) but reveals the results to the audit log + UI
 * at staggered intervals so the demo reads as deliberate evaluation.
 */
export async function runTriageCinematic(opts?: {
  rerun?: boolean;
}): Promise<void> {
  const main = useRanBerri.getState();
  const submission = main.submission;
  if (!submission) return;

  // Snapshot prior verdict for the verdict-changed signal.
  const priorVerdict = main.triage.verdict;

  if (opts?.rerun) {
    main.appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'triage.rerun',
      submissionId: SUBMISSION_ID,
    });
  }

  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'triage.started',
    submissionId: SUBMISSION_ID,
  });

  // Compute all four results up front (rules are pure + deterministic).
  // We then reveal them sequentially.
  const sources = Object.values(main.enrichment.sources)
    .map((s) => s.result)
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const gaps = main.enrichment.gaps;
  const computed = runTriage(submission, sources, gaps);

  for (const check of CHECK_ORDER) {
    await sleep(STAGGER_MS);
    const result = computed.results[check];
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'triage.checkEvaluated',
      submissionId: SUBMISSION_ID,
      check,
      outcome: result.outcome,
      rationale: result.rationale,
      ruleIds: result.rules.map((r) => r.ruleId),
      rules: result.rules,
      metadata: result.metadata,
    });
  }

  await sleep(SETTLE_MS);

  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'triage.completed',
    submissionId: SUBMISSION_ID,
    verdict: computed.verdict,
  });

  // Verdict-changed notice fires if the rerun produced a different
  // verdict than the prior settled one.
  if (priorVerdict && priorVerdict !== computed.verdict) {
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'triage.verdictChanged',
      submissionId: SUBMISSION_ID,
      from: priorVerdict,
      to: computed.verdict,
      cause: explainCause(computed, opts?.rerun ?? false),
    });
  }

  useRanBerri.getState().markArtifactComputed('triage');
}

function explainCause(
  computed: { results: Record<CheckId, { outcome: string }> },
  rerun: boolean,
): string {
  // Pick the strongest signal: the first decline or refer in canonical order.
  for (const check of CHECK_ORDER) {
    const o = computed.results[check].outcome;
    if (o === 'decline') return `${check} declined on rerun`;
    if (o === 'refer') return `${check} now refers`;
  }
  return rerun ? 'all checks now pass on rerun' : 'all checks pass';
}
