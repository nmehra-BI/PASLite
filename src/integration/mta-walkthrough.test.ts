/**
 * Programmatic walkthrough of the six MTA scenarios. Mounts the
 * store directly (no React) and drives orchestrator actions in the
 * same order the demo would.
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
  applyMtaCorrection,
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
  getCapacityLedger,
  getGreenlineSubmission,
} from '@/lib/fixtures';
import { runRating } from '@/lib/rating';
import { runRecommendation } from '@/lib/recommendation';
import { effectiveValue } from '@/lib/field';
import { replay } from '@/store/replay';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';

enableMapSet();

function bootstrapBoundGreenline(): { boundPremium: number } {
  useRanBerri.getState().reset();
  useRanBerri.setState({ boundLedger: [] });
  const sub = getGreenlineSubmission();
  sub.fireSuppressionDisclosed = {
    ...sub.fireSuppressionDisclosed,
    underwriterCorrected: {
      value: true,
      reason: 'broker confirmed',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:15:00Z',
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

async function runFullMta() {
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

describe('Scenario 1 — happy path MTA', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('produces v2 with Manchester, 3 subjectivities, MTA-04 milestone, full event chain', async () => {
    await runFullMta();
    const s = useRanBerri.getState();

    // (a) policy state shows v2 with Manchester
    expect(s.submissionState).toBe('in-force-with-mta');
    expect(s.policy.versions).toHaveLength(1);
    expect(s.policy.versions[0]!.changeType).toBe('add-site');
    expect(s.policy.versions[0]!.endorsementNumber).toBe(4);
    expect(s.policy.versions[0]!.scheduleRef).toBe('POL-29481-MTA-04');

    // (b) subjectivities = 2 original + 1 new
    expect(s.postBind.subjectivities).toHaveLength(3);
    expect(
      s.postBind.subjectivities.some((sub) => sub.affectedSites.includes('Manchester')),
    ).toBe(true);

    // (c) lifecycle ribbon shows MTA-04 as current state
    expect(s.lifecycle.now).toBe('mta-04');

    // (d) audit log shows full mta.* event chain
    const kinds = s.auditLog.map((e) => e.kind);
    for (const k of [
      'mta.requestReceived',
      'mta.extracted',
      'mta.gapFlagged',
      'mta.gapResolved',
      'mta.deltaRated',
      'mta.capacityRechecked',
      'mta.scheduleGenerated',
      'mta.hashConfirmed',
      'mta.committed',
      'mta.scheduleSent',
    ]) {
      expect(kinds).toContain(k);
    }
  });
});

describe('Scenario 2 — historical scrub to bind state', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('reconstructs the v1 view: 3 sites, bound premium, 2 subjectivities', async () => {
    const { boundPremium } = bootstrapBoundGreenline();
    await runFullMta();

    useRanBerri.getState().scrubLifecycle('bind');
    const s = useRanBerri.getState();

    const firstMtaSignedAt = s.policy.versions[0]?.signedAt ?? null;
    const view = deriveCursorView({
      cursor: s.lifecycle.cursor,
      now: s.lifecycle.now,
      baseBindAt: s.policy.baseBindAt,
      versionCount: s.policy.versions.length,
      firstMtaSignedAt,
    });
    // Sepia overlay applies; the view is the v1 reconstruction.
    expect(view.kind).toBe('bind-v1');
    expect(view.scrubbed).toBe(true);
    expect(view.effectiveAt).toBe(firstMtaSignedAt);

    // Sites = 3 (Manchester is added at MTA time, not present in
    // the bound submission tree).
    expect(s.submission!.sites).toHaveLength(3);

    // Premium for v1 view = bound rating premium.
    expect(s.quote.slipPremium).toBe(boundPremium);

    // Subjectivities filtered to those created strictly before the
    // first MTA's signedAt = the 2 bound-state originals.
    const v1 = s.postBind.subjectivities.filter(
      (sub) => sub.createdAt < (firstMtaSignedAt ?? ''),
    );
    expect(v1).toHaveLength(2);
  });
});

describe('Scenario 3 — mid-MTA edit + stale propagation', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('correcting newTurnover stales delta/capacity/schedule and blocks ceremony until rerun', async () => {
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

    // Apply the underwriter correction mid-ceremony.
    applyMtaCorrection({
      fieldKey: 'newTurnover',
      nextValue: 15_000_000,
      reason: 'underwriter revised turnover projection during MTA review',
      correctedBy: 'nm',
    });

    const stale = useRanBerri.getState();
    expect(stale.mta.staleSince).not.toBeNull();
    expect(stale.mta.delta).toBeNull();
    expect(stale.mta.capacity).toBeNull();
    expect(stale.mta.schedule).toBeNull();
    expect(stale.mta.hashes).toHaveLength(0);
    expect(stale.mta.phase).toBe('context-review');
    expect(stale.mta.corrections.newTurnover).toBe(15_000_000);

    // commitMta should refuse before the ceremony rerun.
    expect(() => commitMta('nm')).toThrow();

    // Rerun the workflow against the corrected baseline.
    runDeltaRating();
    recheckCapacity();
    generateMtaSchedule();
    confirmMtaHash('delta-premium');
    confirmMtaHash('capacity-update');
    commitMta('nm');

    const fresh = useRanBerri.getState();
    expect(fresh.mta.staleSince).toBeNull();
    expect(fresh.mta.phase).toBe('committed');
    // The new annual-equivalent must reflect the £15M turnover.
    expect(fresh.policy.versions[0]!.afterAnnualEquivalent).toBeGreaterThan(60_000);
  });
});

describe('Scenario 4 — sequential MTAs', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('second MTA baselines off v2 annual equivalent and lands as v3', async () => {
    await runFullMta();
    const afterFirst = useRanBerri.getState();
    const v2AnnualEquivalent =
      afterFirst.policy.versions[0]!.afterAnnualEquivalent;

    // Start a second MTA. The orchestrator resets the mta slice.
    receiveMtaRequest();
    await runMtaExtraction({ cinematic: false });
    resolveMtaGap({
      gapId: 'GAP-MTA-001',
      choice: 'conditional',
      reason: 'second MTA — broker confirmed permit timeline as before',
      resolvedBy: 'nm',
    });
    runDeltaRating();

    const midSecond = useRanBerri.getState();
    // The second MTA's BEFORE baseline = v2 annual equivalent
    // (£49,315), not the original bound premium.
    expect(midSecond.mta.delta?.beforePremium).toBe(v2AnnualEquivalent);
    // Its id / endorsement number are distinct (MTA-05 if fixture
    // re-used after MTA-04).
    expect(midSecond.mta.request?.id).toBe('MTA-05');

    recheckCapacity();
    generateMtaSchedule();
    confirmMtaHash('delta-premium');
    confirmMtaHash('capacity-update');
    commitMta('nm');

    const afterSecond = useRanBerri.getState();
    // policy.versions should now have 2 entries.
    expect(afterSecond.policy.versions).toHaveLength(2);
    expect(afterSecond.policy.versions[1]!.endorsementNumber).toBe(5);
    expect(afterSecond.policy.versions[1]!.scheduleRef).toBe('POL-29481-MTA-05');
  });
});

describe('Scenario 5 — mid-ceremony refresh', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('hash 1 confirmation persists; hash 2 still requires confirmation', async () => {
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
    // "Refresh" — replay the persisted log into a fresh ReplayResult.
    const log = useRanBerri.getState().auditLog;
    const r = replay(log);
    expect(r.mta.hashes).toHaveLength(1);
    expect(r.mta.hashes[0]!.id).toBe('delta-premium');
    expect(r.mta.hashes[0]!.status).toBe('confirmed');
    expect(r.mta.phase).toBe('ceremony-in-progress');
    const confirms = log.filter((e) => e.kind === 'mta.hashConfirmed');
    expect(confirms).toHaveLength(1);
  });
});

describe('Scenario 6 — recommendation engine isolation', () => {
  beforeEach(() => bootstrapBoundGreenline());

  it('MTA does not pollute boundLedger or break the recommendation engine', async () => {
    await runFullMta();
    const s = useRanBerri.getState();

    // boundLedger has exactly one entry (Greenline bound). MTAs are
    // version updates, not new binds.
    expect(s.boundLedger).toHaveLength(1);
    expect(s.boundLedger[0]!.id).toBe('POL-29481');

    // Recommendation engine still works against (current submission +
    // boundLedger).
    const sub = s.submission!;
    const r = runRecommendation({
      submission: sub,
      ourPremium: 38_265,
      binders: [...s.boundLedger],
      losses: [],
      competitorIntel: [],
      fireSuppressionResolved: true,
      fireSuppressionRequested: false,
    });
    expect(r.factors.length).toBeGreaterThan(0);
  });
});
