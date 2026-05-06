import { useRanBerri } from '@/store';
import { effectiveValue } from '@/lib/field';
import {
  getCompetitiveIntel,
  getHistoricalBinders,
  getLossesToCompetitors,
} from '@/lib/fixtures';
import { runRecommendation } from '@/lib/recommendation';
import { projectCompetitorSwitches } from '@/lib/recommendation/competitorSwitches';

const SUBMISSION_ID = 'sub_greenline_2026_05';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const FACTOR_STAGGER_MS = 300;
const PRE_NARRATIVE_PAUSE_MS = 400;
const SETTLE_MS = 200;

/**
 * The recommendation cinematic. Computes the recommendation
 * synchronously (rules are pure) and reveals each factor on a 300ms
 * stagger. After all five factors land, the headline is emitted with
 * `recommendation.completed` and the narrative panel streams it in
 * word-by-word (handled by the UI component, similar to module 5's
 * email body).
 */
export async function runRecommendationCinematic(opts?: {
  rerun?: boolean;
}): Promise<void> {
  const main = useRanBerri.getState();
  const submission = main.submission;
  if (!submission) return;
  const ratingOutput = main.rating.output;
  if (!ratingOutput) return;

  const priorIteration = main.recommendation.iteration ?? 1;
  const iteration = opts?.rerun ? priorIteration + 1 : priorIteration;
  const priorPrimary = main.recommendation.primary;

  if (opts?.rerun) {
    main.appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'recommendation.rerun',
      submissionId: SUBMISSION_ID,
      nextIteration: iteration,
    });
  }

  main.appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'recommendation.started',
    submissionId: SUBMISSION_ID,
    iteration,
  });

  // Build inputs from current state.
  const fireSuppressionResolved = main.enrichment.gaps.some(
    (g) =>
      g.fieldPath === 'fireSuppressionDisclosed' &&
      g.resolution !== null &&
      g.resolution.choice !== 'request',
  );
  const fireSuppressionRequested = main.enrichment.gaps.some(
    (g) =>
      g.fieldPath === 'fireSuppressionDisclosed' && g.requestSent !== null,
  );

  // Same-MGA evidence: fixture ledger + any binders bound in this or
  // prior demo sessions (the data flywheel). Each bind compounds the
  // signal for the next risk's recommendation.
  const allBinders = [...getHistoricalBinders(), ...main.boundLedger];

  const competitorSwitches = projectCompetitorSwitches(main.auditLog);

  const recommendation = runRecommendation({
    submission,
    ourPremium: ratingOutput.premium,
    binders: allBinders,
    losses: getLossesToCompetitors(),
    competitorIntel: getCompetitiveIntel(),
    fireSuppressionResolved,
    fireSuppressionRequested,
    competitorSwitches,
  });

  // Reveal factors one by one.
  for (const factor of recommendation.factors) {
    await sleep(FACTOR_STAGGER_MS);
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'recommendation.factorEvaluated',
      submissionId: SUBMISSION_ID,
      factorId: factor.id,
      label: factor.label,
      vote: factor.vote,
      weight: factor.weight,
      rationale: factor.rationale,
      evidence: factor.evidence,
      metadata: factor.metadata,
    });
  }

  await sleep(PRE_NARRATIVE_PAUSE_MS);

  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'recommendation.completed',
    submissionId: SUBMISSION_ID,
    primary: recommendation.primary,
    confidence: recommendation.confidence,
    headline: recommendation.headline,
    similarBinderIds: recommendation.similarBinders.map((b) => b.id),
    similarLossIds: recommendation.similarLosses.map((l) => l.id),
    competitorNames: recommendation.competitorContext.map((c) => c.name),
  });

  if (priorPrimary && priorPrimary !== recommendation.primary) {
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'recommendation.verdictChanged',
      submissionId: SUBMISSION_ID,
      from: priorPrimary,
      to: recommendation.primary,
    });
  }

  await sleep(SETTLE_MS);
  useRanBerri.getState().markArtifactComputed('recommendation');
}

// Re-export for convenience so callers can compute headline/factor
// data without firing the cinematic (e.g. for the deep-dive inspector).
export { runRecommendation } from '@/lib/recommendation';

// Helper consumers use to fetch the cited records — searches the
// fixture pool first, then the runtime bound ledger.
export function lookupBinder(id: string) {
  const fixture = getHistoricalBinders().find((b) => b.id === id);
  if (fixture) return fixture;
  return useRanBerri.getState().boundLedger.find((b) => b.id === id);
}
export function lookupLoss(id: string) {
  return getLossesToCompetitors().find((l) => l.id === id);
}
export function lookupCompetitor(name: string) {
  return getCompetitiveIntel().find((c) => c.name === name);
}

/**
 * Convenience to look up the broker name for the headline / inspector
 * (it's the same string the email-draft helper uses).
 */
export function brokerLabel(): string | null {
  const sub = useRanBerri.getState().submission;
  if (!sub) return null;
  return (effectiveValue(sub.broker) as string | null) ?? null;
}
