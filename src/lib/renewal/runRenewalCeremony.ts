/**
 * Renewal orchestrator.
 *
 * The renewal workflow is the most ceremonially weighty post-bind
 * action: it succeeds the policy. Same audit-event pattern as bind /
 * MTA / cancellation — each user action emits a single event, replay
 * reconstructs the workflow.
 */

import { useRanBerri } from '@/store';
import { getActiveConfig } from '@/config';
import { computeSha } from '@/lib/bind';
import { effectiveValue } from '@/lib/field';
import {
  GREENLINE_YEAR1_CLAIMS,
  getGreenlineYear2,
  type GreenlineYear2,
} from '@/lib/fixtures';
import { buildYear1Review } from './year1Review';
import { computeYear2Rating } from './computeYear2Rating';
import { computeDefencePricing } from './computeDefencePricing';
import { buildRenewalRecommendation } from './recommendation';

const SHARP_COMPETITOR_HOLD_FLOOR = 50_500;

/** Resolve the primary sharp competitor from the active tenant
 *  config. Returns null when no competitor is profiled as 'sharp';
 *  callers fall back to a generic phrase. */
function getSharpCompetitorName(): string | null {
  const competitors = getActiveConfig().competitors.competitors;
  return competitors.find((c) => c.profile === 'sharp')?.name ?? null;
}

export function triggerRenewal(opts?: { daysToExpiry?: number }) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, bind } = state;
  if (!submission) throw new Error('triggerRenewal: no active submission');
  if (bind.phase !== 'committed') throw new Error('triggerRenewal: policy is not bound');
  const priorPolicyRef = bind.policyRef ?? submission.id;
  const renewalId = 'RNW-01';
  const targetInception =
    (effectiveValue(submission.cover.expiryDate) as string | null) ??
    new Date().toISOString();
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'renewal.triggered',
    submissionId: submission.id,
    renewalId,
    priorPolicyRef,
    daysToExpiry: opts?.daysToExpiry ?? 90,
    targetInception,
  });
  return { renewalId, priorPolicyRef, targetInception };
}

export function recordYear1Claims() {
  const { submission, appendAuditEvent, bind } = useRanBerri.getState();
  if (!submission || !bind.policyRef) return;
  for (const c of GREENLINE_YEAR1_CLAIMS) {
    appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'claim.recorded',
      submissionId: submission.id,
      policyRef: bind.policyRef,
      claimRef: c.ref,
      siteName: c.siteName,
      date: c.date,
      category: c.category,
      paid: c.paid,
      reserved: c.reserved,
      status: c.status,
      notes: c.notes,
    });
  }
}

export function buildAndEmitYear1Review() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, bind, quote, policy, postBind, renewal } = state;
  if (!submission) throw new Error('buildAndEmitYear1Review: no active submission');
  if (!renewal.renewalId) throw new Error('buildAndEmitYear1Review: not triggered');
  void bind;

  const cumulativeAP = policy.versions.reduce((a, v) => a + v.proRatedAP, 0);
  const review = buildYear1Review({
    auditLog: state.auditLog,
    boundPremium: quote.slipPremium ?? 0,
    cumulativeAP,
    subjectivitiesTotal: postBind.subjectivities.length,
  });

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'renewal.year1ReviewBuilt',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    earnedPremium: review.earnedPremium,
    totalLosses: review.totalLosses,
    lossRatio: review.lossRatio,
    claimCount: review.claimCount,
    mtaCount: review.mtaCount,
    subjectivitiesSatisfied: review.subjectivitiesSatisfied,
  });
  return review;
}

export function captureYear2Changes(opts?: { changes?: GreenlineYear2 }) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.renewalId)
    throw new Error('captureYear2Changes: not triggered');
  const changes = opts?.changes ?? getGreenlineYear2();
  appendAuditEvent({
    actor: { kind: 'broker', id: 'Sarah Whitfield' },
    kind: 'renewal.insuredChangesCaptured',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    newTurnover: changes.newTurnover,
    materialAdditions: changes.materialAdditions,
    brokerTargetPremium: changes.brokerTargetPremium,
    competitivePressure: changes.competitivePressure,
    notes: changes.notes,
  });
  return changes;
}

export function rateYear2() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal, policy, quote } = state;
  if (!submission || !renewal.renewalId)
    throw new Error('rateYear2: not triggered');
  if (!renewal.year1Review) throw new Error('rateYear2: year-1 review missing');
  if (renewal.insuredChanges.newTurnover === null)
    throw new Error('rateYear2: changes not captured');

  const year1Annual =
    policy.versions[policy.versions.length - 1]?.afterAnnualEquivalent ??
    quote.slipPremium ??
    0;

  const materials =
    (effectiveValue(submission.materials) as string[] | null) ?? [];
  // Add WEEE class if it's in the year-2 changes.
  const year2Materials = [
    ...materials,
    ...renewal.insuredChanges.materialAdditions,
  ];

  // Year-2 site count = current sites + any from MTAs (already
  // reflected in policy.versions).
  const year2Sites =
    submission.sites.length +
    policy.versions.filter((v) => v.changeType === 'add-site').length -
    policy.versions.filter((v) => v.changeType === 'remove-site').length;

  const result = computeYear2Rating({
    newTurnover: renewal.insuredChanges.newTurnover,
    siteCount: year2Sites,
    materials: year2Materials,
    fireSuppression: 'present',
    year1LR: renewal.year1Review.lossRatio,
    yearsInBusiness:
      ((effectiveValue(submission.insured.yearsTrading) as number | null) ?? 0) + 1,
    largestSingleClaim: 0,
    year1AnnualEquivalent: year1Annual,
  });

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'renewal.year2Rated',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    technicalPremium: result.technicalPremium,
    sha: result.sha,
    deltaFromYear1Annual: result.deltaFromYear1Annual,
  });
  return result;
}

export function priceDefence() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.renewalId)
    throw new Error('priceDefence: not triggered');
  if (renewal.year2.technicalPremium === null)
    throw new Error('priceDefence: year-2 not rated');
  const result = computeDefencePricing({
    technicalPremium: renewal.year2.technicalPremium,
    sharpCompetitorHoldFloor: SHARP_COMPETITOR_HOLD_FLOOR,
    sharpCompetitorName: getSharpCompetitorName() ?? undefined,
    brokerTarget: renewal.insuredChanges.brokerTargetPremium,
  });
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'renewal.defencePricingComputed',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    options: result.options,
    holdFloor: result.holdFloor,
  });
  return result;
}

export function selectOption(input: {
  optionId: 'hold' | 'defend' | 'aggressive';
  selectedBy: string;
}) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.renewalId)
    throw new Error('selectOption: not triggered');
  const option = renewal.defencePricing.options.find((o) => o.id === input.optionId);
  if (!option) throw new Error(`selectOption: unknown option ${input.optionId}`);
  appendAuditEvent({
    actor: { kind: 'underwriter', id: input.selectedBy },
    kind: 'renewal.optionSelected',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    optionId: input.optionId,
    premium: option.premium,
    selectedBy: input.selectedBy,
  });
}

export function buildRecommendation() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.renewalId)
    throw new Error('buildRecommendation: not triggered');
  if (!renewal.year1Review || !renewal.selectedOption || renewal.year2.technicalPremium === null)
    throw new Error('buildRecommendation: prerequisites missing');

  const r = buildRenewalRecommendation({
    year1Review: renewal.year1Review,
    year2TechnicalPremium: renewal.year2.technicalPremium,
    selectedDefencePremium: renewal.selectedOption.premium,
    sharpCompetitorHoldFloor: SHARP_COMPETITOR_HOLD_FLOOR,
    brokerTargetPremium: renewal.insuredChanges.brokerTargetPremium,
    brokerSentiment: renewal.year1Review.brokerRelationship.sentiment,
    materialAdditions: renewal.insuredChanges.materialAdditions,
  });
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'renewal.recommendationCompleted',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    primary: r.primary,
    confidence: r.confidence,
    headline: r.headline,
    factorIds: r.factors.map((f) => f.id),
  });
  return r;
}

export function generateRenewalSlip() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal, bind } = state;
  if (!submission || !renewal.renewalId || !renewal.selectedOption)
    throw new Error('generateRenewalSlip: prerequisites missing');
  const priorPolicyRef = bind.policyRef ?? submission.id;
  const slipRef = `${priorPolicyRef}-R1-Q1`;
  const sha = computeSha({
    engine: 'recyclesure_v3.2',
    year: 2,
    premium: renewal.selectedOption.premium,
    priorPolicyRef,
  });
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'renewal.slipGenerated',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    slipRef,
    premium: renewal.selectedOption.premium,
    sha,
  });
  return { slipRef, premium: renewal.selectedOption.premium, sha };
}

export function sendRenewalSlip() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.renewalId || !renewal.slip.slipRef)
    throw new Error('sendRenewalSlip: prerequisites missing');
  appendAuditEvent({
    actor: { kind: 'underwriter', id: 'nm' },
    kind: 'renewal.slipSent',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    slipRef: renewal.slip.slipRef,
    recipient: 's.whitfield@surestep.co.uk',
  });
}

export function confirmRenewalHash(
  hashId: 'premium' | 'subjectivities' | 'sanctions' | 'capacity',
  confirmedBy: string = 'nm',
) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.renewalId || !renewal.slip.sha)
    throw new Error('confirmRenewalHash: prerequisites missing');
  // Use the renewal slip sha for premium hash; computed shas for the
  // others.
  const sha =
    hashId === 'premium'
      ? renewal.slip.sha
      : computeSha({ kind: hashId, year: 2, premium: renewal.slip.premium });
  appendAuditEvent({
    actor: { kind: 'underwriter', id: confirmedBy },
    kind: 'renewal.hashConfirmed',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    hashId,
    artefactSha: sha,
    confirmedBy,
  });
}

export function commitRenewal(signedBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal, bind } = state;
  if (!submission || !renewal.renewalId)
    throw new Error('commitRenewal: prerequisites missing');
  if (renewal.hashes.length !== 4)
    throw new Error('commitRenewal: all four hashes must be confirmed');
  if (!renewal.hashes.every((h) => h.status === 'confirmed' || h.status === 'overridden'))
    throw new Error('commitRenewal: hashes not all signed');

  const priorPolicyRef = bind.policyRef ?? submission.id;
  const successorPolicyRef = `${priorPolicyRef}-R1`;
  const inceptionDate = renewal.year1Review
    ? // Year-2 inception = year-1 expiry + 1 minute (succession).
      new Date(
        new Date(
          (effectiveValue(submission.cover.expiryDate) as string | null) ??
            new Date().toISOString(),
        ).getTime() + 60_000,
      ).toISOString()
    : new Date().toISOString();
  const expiryDate = new Date(
    new Date(inceptionDate).getTime() + 365 * 86_400_000,
  ).toISOString();

  appendAuditEvent({
    actor: { kind: 'underwriter', id: signedBy },
    kind: 'renewal.committed',
    submissionId: submission.id,
    renewalId: renewal.renewalId,
    priorPolicyRef,
    successorPolicyRef,
    premium: renewal.selectedOption?.premium ?? 0,
    inceptionDate,
    expiryDate,
    signedBy,
  });
}

export function sendRenewalSchedule(sentBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, renewal } = state;
  if (!submission || !renewal.successorPolicyRef)
    throw new Error('sendRenewalSchedule: not committed');
  appendAuditEvent({
    actor: { kind: 'underwriter', id: sentBy },
    kind: 'renewal.scheduleSent',
    submissionId: submission.id,
    renewalId: renewal.renewalId ?? '—',
    successorPolicyRef: renewal.successorPolicyRef,
    recipient: 's.whitfield@surestep.co.uk',
    sentBy,
  });
}
