/**
 * Module 10 — programmatic walkthrough of the seven cancellation
 * scenarios. Mounts the store directly, drives orchestrator actions
 * in the same order the demo would, and verifies the data model.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { enableMapSet } from 'immer';
import { useRanBerri } from '@/store';
import {
  commitBind,
  computeSha,
  GREENLINE_CONSUMPTION,
  buildHashInputsFromSubmission,
  validateHashes,
} from '@/lib/bind';
import {
  commitMta,
  confirmMtaHash,
  generateMtaSchedule,
  receiveMtaRequest,
  recheckCapacity,
  resolveMtaGap,
  runDeltaRating,
  runMtaExtraction,
  sendMtaSchedule,
} from '@/lib/mta';
import {
  captureRunoffClaim,
  commitCancellation,
  computeCancellationRefund,
  confirmCancellationHash,
  overrideCancellationBasis,
  receiveCancellationRequest,
  sendCancellationEndorsement,
} from '@/lib/cancellation';
import {
  GREENLINE_RUNOFF_CLAIM,
  getCapacityLedger,
  getGreenlineCancellationRequest,
  getGreenlineSubmission,
} from '@/lib/fixtures';
import { runRating } from '@/lib/rating';
import { runRecommendation } from '@/lib/recommendation';
import { projectCompetitorSwitches } from '@/lib/recommendation/competitorSwitches';
import { effectiveValue } from '@/lib/field';
import { replay } from '@/store/replay';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';

enableMapSet();

function bootstrapBoundGreenline() {
  useRanBerri.getState().reset();
  useRanBerri.setState({ boundLedger: [] });
  const sub = getGreenlineSubmission();
  // Override the policy term with explicit clean dates so the
  // cancellation math lines up. 15 May 2026 → 15 May 2027 = 365 days.
  sub.cover.inceptionDate = {
    ...sub.cover.inceptionDate,
    underwriterCorrected: {
      value: '2026-05-15T12:00:00+01:00',
      reason: 'demo: standardise inception',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:00:00Z',
    },
  };
  sub.cover.expiryDate = {
    ...sub.cover.expiryDate,
    underwriterCorrected: {
      value: '2027-05-15T12:00:00+01:00',
      reason: 'demo: standardise expiry',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:00:00Z',
    },
  };
  sub.fireSuppressionDisclosed = {
    ...sub.fireSuppressionDisclosed,
    underwriterCorrected: {
      value: true,
      reason: 'broker confirmed',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:15:00Z',
    },
  };
  // Apply the conflict-resolution correction to turnover so the rated
  // bound premium lands at the spec's £38,265 (not the broker-stated
  // £40,732). The full demo runs the conflict-resolution step before
  // rating; this bootstrap collapses that.
  sub.insured.turnover = {
    ...sub.insured.turnover,
    underwriterCorrected: {
      value: 7_910_000,
      reason: 'demo: post-conflict-resolution turnover from filed accounts',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:20:00Z',
    },
  };

  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'broker', id: 'Sarah Whitfield' },
    kind: 'submission.created',
    submissionId: sub.id,
    folio: sub.folio,
    broker: 'Sarah Whitfield',
    submission: sub,
  });
  const rating = runRating({
    turnover: (effectiveValue(sub.insured.turnover) as number | null) ?? 0,
    siteCount: sub.sites.length,
    materials: (effectiveValue(sub.materials) as string[] | null) ?? [],
    fireSuppression: 'present',
    lossRatio: (effectiveValue(sub.statedLossRatio) as number | null) ?? 0,
    largestSingleClaim: 0,
    yearsInBusiness: (effectiveValue(sub.insured.yearsTrading) as number | null) ?? 0,
  });
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'rating.completed',
    submissionId: sub.id,
    premium: rating.premium,
    sha: rating.sha,
    version: rating.version,
    tier: rating.tier,
    iteration: 1,
  });
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'slip.generated',
    submissionId: sub.id,
    slipRef: 'POL-29481-Q1',
    premium: rating.premium,
    sha: rating.sha,
  });
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'underwriter', id: 'nm' },
    kind: 'bind.ceremonyStarted',
    submissionId: sub.id,
    startedBy: 'nm',
  });
  const inputs = {
    submission: sub,
    ratingPremium: rating.premium,
    ratingSha: rating.sha,
    quotedPremium: rating.premium,
    quotedSlipSha: rating.sha,
    warranties: buildHashInputsFromSubmission(sub).warranties,
    warrantiesAtSendSha: computeSha(buildHashInputsFromSubmission(sub).warranties),
    sanctionsRefreshedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    capacity: getCapacityLedger(),
    capacityConsumption: GREENLINE_CONSUMPTION,
  };
  const checks = validateHashes(inputs);
  for (const c of checks) {
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'bind.hashConfirmed',
      submissionId: sub.id,
      hashId: c.id,
      artefactSha: c.currentSha,
      confirmedBy: 'nm',
    });
  }
  commitBind('nm');
  return { boundPremium: rating.premium };
}

async function runMta() {
  receiveMtaRequest();
  await runMtaExtraction({ cinematic: false });
  resolveMtaGap({
    gapId: 'GAP-MTA-001',
    choice: 'conditional',
    reason: 'broker confirmed install date matches permit application timeline',
    resolvedBy: 'nm',
  });
  runDeltaRating();
  recheckCapacity();
  generateMtaSchedule();
  confirmMtaHash('delta-premium');
  confirmMtaHash('capacity-update');
  commitMta('nm');
  sendMtaSchedule('nm');
}

function runFullCancellation(opts?: { skipSend?: boolean }) {
  receiveCancellationRequest();
  captureRunoffClaim({
    ref: GREENLINE_RUNOFF_CLAIM.ref,
    description: GREENLINE_RUNOFF_CLAIM.description,
    reserveAmount: GREENLINE_RUNOFF_CLAIM.reserveAmount,
    capturedBy: 'nm',
  });
  computeCancellationRefund();
  confirmCancellationHash('refund-basis');
  confirmCancellationHash('runoff-claim');
  confirmCancellationHash('bordereau');
  commitCancellation('nm');
  if (!opts?.skipSend) sendCancellationEndorsement('nm');
}

describe('Scenario 1 — full Greenline cancellation (insured-non-renewal, short-rate)', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('produces the expected refund / clawback / bordereau / lifecycle / audit chain', () => {
    runFullCancellation();
    const s = useRanBerri.getState();

    // Refund: short-rate basis with cl.14 7.5% penalty applied to
    // pro-rata. Spec calls out ~£28,356; tolerance for rounding /
    // calendar-day arithmetic is ±£200.
    expect(s.cancellation.calc).not.toBeNull();
    expect(Math.abs(s.cancellation.calc!.refund - 28_356)).toBeLessThanOrEqual(200);

    // Commission clawback (partial — voluntary): ~£4,554. Calibrated
    // through SLIP_BROKERAGE_RATE × PARTIAL_CLAWBACK_FACTOR.
    expect(Math.abs(s.cancellation.calc!.commissionClawback - 4_554)).toBeLessThanOrEqual(50);
    expect(s.cancellation.calc!.clawbackKind).toBe('partial');

    // Bordereau net = -refund × 65% line ≈ -£18,432.
    expect(Math.abs(s.cancellation.calc!.bordereauNet - -18_432)).toBeLessThanOrEqual(200);
    expect(s.cancellation.bordereau).not.toBeNull();
    expect(s.cancellation.bordereau!.netMovement).toBe(s.cancellation.calc!.bordereauNet);
    expect(s.cancellation.bordereau!.line).toBe(0.65);

    // Lifecycle ribbon: Cancel is now; Renewal hidden.
    expect(s.lifecycle.now).toBe('cancel');
    expect(s.submissionState).toBe('cancelled');

    // Audit log carries the full mta.* … cancellation.* … chain.
    const kinds = s.auditLog.map((e) => e.kind);
    for (const k of [
      'cancellation.requestReceived',
      'cancellation.basisSelected',
      'cancellation.runoffClaimCaptured',
      'cancellation.refundComputed',
      'cancellation.hashConfirmed',
      'cancellation.committed',
      'cancellation.endorsementSent',
      'bordereau.entryWritten',
      'competitor.switchRecorded',
    ]) {
      expect(kinds).toContain(k);
    }

    // Three hashes signed.
    expect(s.cancellation.hashes).toHaveLength(3);
    expect(s.cancellation.hashes.every((h) => h.status === 'confirmed')).toBe(true);
  });
});

describe('Scenario 2 — override basis from short-rate to pro-rata', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('refund recalculates higher (no penalty) and basisOverridden event lands with provenance', () => {
    receiveCancellationRequest();
    captureRunoffClaim({
      ref: GREENLINE_RUNOFF_CLAIM.ref,
      description: GREENLINE_RUNOFF_CLAIM.description,
      reserveAmount: GREENLINE_RUNOFF_CLAIM.reserveAmount,
      capturedBy: 'nm',
    });
    computeCancellationRefund();
    const baseline = useRanBerri.getState().cancellation.calc!.refund;

    overrideCancellationBasis({
      to: 'pro-rata',
      reason: 'commercial gesture for relationship preservation',
      overriddenBy: 'nm',
    });
    computeCancellationRefund();
    const overridden = useRanBerri.getState().cancellation.calc!.refund;
    expect(overridden).toBeGreaterThan(baseline);
    // pro-rata = short-rate / (1 - 0.075) within rounding.
    expect(Math.abs(overridden - Math.round(baseline / 0.925))).toBeLessThanOrEqual(50);

    // Audit event with full provenance.
    const log = useRanBerri.getState().auditLog;
    const evt = log.find((e) => e.kind === 'cancellation.basisOverridden');
    expect(evt).toBeTruthy();
    if (evt && evt.kind === 'cancellation.basisOverridden') {
      expect(evt.from).toBe('short-rate');
      expect(evt.to).toBe('pro-rata');
      expect(evt.reason).toContain('commercial gesture');
      expect(evt.overriddenBy).toBe('nm');
    }

    expect(useRanBerri.getState().cancellation.basisOverride).not.toBeNull();
    expect(useRanBerri.getState().cancellation.basisOverride!.from).toBe('short-rate');
    expect(useRanBerri.getState().cancellation.basisOverride!.to).toBe('pro-rata');
  });
});

describe('Scenario 3 — polymorphic state engine', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('reconstructs Bind v1, MTA-04 v2, and Cancel terminal correctly', async () => {
    const { boundPremium } = bootstrapBoundGreenline();
    await runMta();
    runFullCancellation();

    const s = useRanBerri.getState();
    const ctx = (cursor: 'bind' | 'mta-04' | 'cancel') =>
      deriveCursorView({
        cursor,
        now: s.lifecycle.now,
        baseBindAt: s.policy.baseBindAt,
        versionCount: s.policy.versions.length,
        firstMtaSignedAt: s.policy.versions[0]?.signedAt ?? null,
        cancelledAt: s.cancellation.committedAt,
        cancelled: s.cancellation.phase === 'committed' || s.cancellation.phase === 'sent',
      });

    // Cancel is now → live view, kind 'cancelled'.
    useRanBerri.getState().scrubLifecycle('cancel');
    const liveCancel = ctx('cancel');
    expect(liveCancel.kind).toBe('cancelled');
    expect(liveCancel.scrubbed).toBe(false);

    // Scrub to Bind → bind-v1: 3 sites, £38,265, only 2 subjectivities.
    useRanBerri.getState().scrubLifecycle('bind');
    const v1 = ctx('bind');
    expect(v1.kind).toBe('bind-v1');
    expect(v1.scrubbed).toBe(true);
    expect(s.submission!.sites).toHaveLength(3);
    expect(s.quote.slipPremium).toBe(boundPremium);
    const v1Subjectivities = s.postBind.subjectivities.filter(
      (sub) => sub.createdAt < (v1.effectiveAt ?? ''),
    );
    expect(v1Subjectivities.length).toBe(2);

    // Scrub to MTA-04 → mta-v2: v2 annual equivalent, all subjectivities
    // including the Manchester permit warranty.
    useRanBerri.getState().scrubLifecycle('mta-04');
    const v2 = ctx('mta-04');
    expect(v2.kind).toBe('mta-v2');
    expect(v2.scrubbed).toBe(true);
    expect(s.policy.versions[0]!.afterAnnualEquivalent).toBeGreaterThan(40_000);
    const v2Subjectivities = s.postBind.subjectivities;
    expect(v2Subjectivities.length).toBe(3);
  });
});

describe('Scenario 4 — refresh after cancellation', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('terminal state, run-off claim, endorsement, and historical scrub all replay', async () => {
    await runMta();
    runFullCancellation();
    const log = useRanBerri.getState().auditLog;

    // "Refresh" = pure replay.
    const r = replay(log);

    expect(r.submissionState).toBe('cancelled');
    expect(r.cancellation.phase).toBe('sent');
    expect(r.cancellation.endorsementRef).toMatch(/^POL-29481-CAN-/);
    expect(r.cancellation.runoffClaim).not.toBeNull();
    expect(r.cancellation.runoffClaim!.reserveAmount).toBe(6_500);
    expect(r.cancellation.bordereau).not.toBeNull();
    // Policy versions still intact (MTA committed pre-cancellation).
    expect(r.policy.versions).toHaveLength(1);
    // Lifecycle 'now' was set by the live reducer; replay only owns
    // submission state. The live reducer's lifecycle.now writes are
    // re-derived deterministically from the same log on rehydrate.
  });
});

describe('Scenario 5 — non-payment triggers full clawback', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('£8,222 full clawback (not £4,554 partial); short-rate basis', () => {
    const req = getGreenlineCancellationRequest();
    req.reasonCategory = 'non-payment';
    req.reasonDetail = 'Premium 60 days overdue; demand letters issued.';
    req.switchingTo = null;

    receiveCancellationRequest({ request: req });
    captureRunoffClaim({
      ref: 'CLM-29481-002',
      description: 'No open claims at cancellation.',
      reserveAmount: 0,
      capturedBy: 'nm',
    });
    computeCancellationRefund();
    confirmCancellationHash('refund-basis');
    confirmCancellationHash('runoff-claim');
    confirmCancellationHash('bordereau');
    commitCancellation('nm');

    const s = useRanBerri.getState();
    expect(s.cancellation.calc!.clawbackKind).toBe('full');
    // Full clawback ≈ £8,222 (annual × 21.5%).
    expect(Math.abs(s.cancellation.calc!.commissionClawback - 8_222)).toBeLessThanOrEqual(20);
    // Refund still computed on short-rate (default for non-payment).
    expect(s.cancellation.calc!.basis).toBe('short-rate');
  });
});

describe('Scenario 6 — void ab initio', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('zero refund, full clawback, no bordereau premium movement', () => {
    const req = getGreenlineCancellationRequest();
    req.reasonCategory = 'mga-cause-misrep';
    req.reasonDetail = 'Material misrepresentation discovered; voiding ab initio.';
    req.switchingTo = null;

    receiveCancellationRequest({ request: req });
    captureRunoffClaim({
      ref: 'CLM-29481-VOID',
      description: 'Void ab initio — no run-off liability assumed.',
      reserveAmount: 0,
      capturedBy: 'nm',
    });
    computeCancellationRefund();
    confirmCancellationHash('refund-basis');
    confirmCancellationHash('runoff-claim');
    confirmCancellationHash('bordereau');
    commitCancellation('nm');

    const s = useRanBerri.getState();
    expect(s.cancellation.calc!.basis).toBe('void-ab-initio');
    expect(s.cancellation.calc!.refund).toBe(0);
    // Full clawback ≈ £8,222.
    expect(s.cancellation.calc!.clawbackKind).toBe('full');
    expect(Math.abs(s.cancellation.calc!.commissionClawback - 8_222)).toBeLessThanOrEqual(20);
    // No premium movement on the bordereau.
    expect(s.cancellation.calc!.bordereauNet).toBe(0);
    // Void ab initio does NOT trigger a competitor.switchRecorded.
    const log = useRanBerri.getState().auditLog;
    expect(log.some((e) => e.kind === 'competitor.switchRecorded')).toBe(false);
  });
});

describe('Scenario 7 — recommendation feedback loop', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('competitor switch surfaces in FCT-003 metadata as a mid-term switch distinct from NTUs', () => {
    runFullCancellation();
    const log = useRanBerri.getState().auditLog;
    const switches = projectCompetitorSwitches(log);

    expect(switches).toHaveLength(1);
    expect(switches[0]!.toCompetitor).toBe('RegentMGA');
    expect(switches[0]!.policyRef).toBe('POL-29481');

    // Reset and run a new submission's recommendation; the engine
    // still works and reads the projected switches from the augmented
    // pool (in production these'd be persisted across submissions in
    // the same way boundLedger is).
    const sub = useRanBerri.getState().submission!;
    const r = runRecommendation({
      submission: sub,
      ourPremium: 38_265,
      binders: [],
      losses: [],
      competitorIntel: [],
      fireSuppressionResolved: true,
      fireSuppressionRequested: false,
      competitorSwitches: switches,
    });
    expect(r.factors.length).toBeGreaterThan(0);
    const fct3 = r.factors.find((f) => f.id === 'FCT-003');
    expect(fct3).toBeTruthy();
    const meta = (fct3!.metadata ?? {}) as Record<string, unknown>;
    expect(Array.isArray(meta.midTermSwitches)).toBe(true);
    expect((meta.midTermSwitches as unknown[]).length).toBe(1);
  });
});
