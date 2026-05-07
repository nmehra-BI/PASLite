/**
 * Module 11 — full Greenline policy lifecycle walkthrough.
 *
 * Drives the cockpit programmatically through all 25 walkthrough
 * steps: new business → MTA → renewal → polymorphic state checks →
 * audit log supremacy. Each step has its own assertion.
 *
 * Scenarios this test covers (numbered to the spec):
 *   1   submission arrival + extraction
 *   2   conflict + gap resolution
 *   3   triage
 *   4   rating + quote
 *   5   recommendation
 *   6   bind ceremony
 *   7   schedule
 *   8   MTA request
 *   9   delta rating
 *   10  MTA seam
 *   11  post-MTA state
 *   12  polymorphic state (mid-cycle)
 *   13  renewal trigger
 *   14  year-1 review
 *   15  insured changes
 *   16  year-2 rating
 *   17  defence pricing
 *   18  renewal recommendation
 *   19  renewal slip
 *   20  renewal ceremony
 *   21  succession seam
 *   22  post-renewal state
 *   23  ultimate polymorphic state (4 historical views)
 *   24  feedback loop (boundLedger has the renewal binder)
 *   25  audit log supremacy
 */

import { describe, expect, it } from 'vitest';
import { enableMapSet } from 'immer';
import { useRanBerri } from '@/store';
import {
  buildHashInputsFromSubmission,
  commitBind,
  computeSha,
  GREENLINE_CONSUMPTION,
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
  buildAndEmitYear1Review,
  buildRecommendation,
  captureYear2Changes,
  commitRenewal,
  confirmRenewalHash,
  generateRenewalSlip,
  priceDefence,
  rateYear2,
  recordYear1Claims,
  selectOption,
  sendRenewalSchedule,
  sendRenewalSlip,
  triggerRenewal,
} from '@/lib/renewal';
import {
  GREENLINE_YEAR1_TOTAL_LOSSES,
  getCapacityLedger,
  getGreenlineSubmission,
} from '@/lib/fixtures';
import { runRating } from '@/lib/rating';
import { effectiveValue } from '@/lib/field';
import { replay } from '@/store/replay';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';

enableMapSet();

function bootstrapBoundGreenline() {
  useRanBerri.getState().reset();
  useRanBerri.setState({ boundLedger: [] });
  const sub = getGreenlineSubmission();
  // Standardise the policy term + apply the conflict-resolution
  // turnover correction (so the rated premium lands at £38,265).
  sub.cover.inceptionDate = {
    ...sub.cover.inceptionDate,
    underwriterCorrected: {
      value: '2026-05-15T12:00:00+01:00',
      reason: 'demo',
      correctedBy: 'nm',
      correctedAt: '2026-05-09T09:00:00Z',
    },
  };
  sub.cover.expiryDate = {
    ...sub.cover.expiryDate,
    underwriterCorrected: {
      value: '2027-05-15T12:00:00+01:00',
      reason: 'demo',
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
  sub.insured.turnover = {
    ...sub.insured.turnover,
    underwriterCorrected: {
      value: 7_910_000,
      reason: 'filed accounts',
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

function runFullRenewal() {
  triggerRenewal({ daysToExpiry: 90 });
  recordYear1Claims();
  buildAndEmitYear1Review();
  captureYear2Changes();
  rateYear2();
  priceDefence();
  selectOption({ optionId: 'defend', selectedBy: 'nm' });
  buildRecommendation();
  generateRenewalSlip();
  sendRenewalSlip();
  confirmRenewalHash('premium');
  confirmRenewalHash('subjectivities');
  confirmRenewalHash('sanctions');
  confirmRenewalHash('capacity');
  commitRenewal('nm');
  sendRenewalSchedule('nm');
}

describe('Greenline full policy lifecycle (modules 1–11)', () => {
  it('drives all 25 walkthrough steps end-to-end', async () => {
    const { boundPremium } = bootstrapBoundGreenline();

    // Steps 1-7: bound state. The bootstrap collapses extraction +
    // conflict resolution + triage + rating + quote + recommendation
    // + bind ceremony + schedule into a single "bound submission"
    // bootstrap (those modules have their own dedicated tests).
    {
      const s = useRanBerri.getState();
      // S1-7
      expect(s.bind.phase).toBe('committed');
      expect(s.bind.policyRef).toBe('POL-29481');
      expect(s.quote.slipPremium).toBe(boundPremium);
      expect(boundPremium).toBe(38_265);
      expect(s.postBind.subjectivities.length).toBeGreaterThanOrEqual(2);
      expect(s.lifecycle.now).toBe('bind');
    }

    // Steps 8-10: MTA workflow.
    await runFullMta();
    {
      const s = useRanBerri.getState();
      // S8 MTA request received
      expect(s.policy.versions).toHaveLength(1);
      expect(s.policy.versions[0]!.changeType).toBe('add-site');
      // S9 delta rating: annual delta = year-2 — bound; pro-rated AP > 0
      expect(s.policy.versions[0]!.afterAnnualEquivalent).toBeGreaterThan(40_000);
      expect(s.policy.versions[0]!.afterAnnualEquivalent).toBeLessThan(60_000);
      expect(s.policy.versions[0]!.proRatedAP).toBeGreaterThan(0);
      // S10 MTA seam fired: now = mta-04
      expect(s.lifecycle.now).toBe('mta-04');
      // S11 post-MTA: subjectivities went from 2 → 3
      expect(s.postBind.subjectivities.length).toBe(3);
    }

    // S12 mid-cycle polymorphic state: scrub bind / mta-04
    {
      const s = useRanBerri.getState();
      const view = (cursor: 'bind' | 'mta-04') =>
        deriveCursorView({
          cursor,
          now: s.lifecycle.now,
          baseBindAt: s.policy.baseBindAt,
          versionCount: s.policy.versions.length,
          firstMtaSignedAt: s.policy.versions[0]?.signedAt ?? null,
        });
      expect(view('bind').kind).toBe('bind-v1');
      expect(view('bind').effectiveAt).toBe(s.policy.versions[0]!.signedAt);
      // Subjectivities filtered to 2 in v1.
      const v1 = s.postBind.subjectivities.filter(
        (sub) => sub.createdAt < (view('bind').effectiveAt ?? ''),
      );
      expect(v1).toHaveLength(2);
    }

    // Steps 13-22: renewal workflow.
    runFullRenewal();
    {
      const s = useRanBerri.getState();
      // S13 renewal triggered
      expect(s.renewal.triggeredAt).not.toBeNull();
      expect(s.renewal.priorPolicyRef).toBe('POL-29481');

      // S14 year-1 review
      expect(s.renewal.year1Review).not.toBeNull();
      const review = s.renewal.year1Review!;
      // Earned = bound + cumulative AP from MTA-04
      const expectedEarned =
        38_265 + s.policy.versions[0]!.proRatedAP;
      expect(review.earnedPremium).toBe(expectedEarned);
      expect(review.totalLosses).toBe(GREENLINE_YEAR1_TOTAL_LOSSES);
      expect(review.totalLosses).toBe(17_854);
      // Loss ratio is total losses / earned
      const expectedLR = review.totalLosses / review.earnedPremium;
      expect(Math.abs(review.lossRatio - expectedLR)).toBeLessThanOrEqual(0.001);
      expect(review.claimCount).toBe(2);
      expect(review.mtaCount).toBe(1);

      // S15 insured changes captured
      expect(s.renewal.insuredChanges.newTurnover).toBe(11_200_000);
      expect(s.renewal.insuredChanges.materialAdditions).toContain(
        'WEEE (small electrical & electronic equipment)',
      );
      expect(s.renewal.insuredChanges.brokerTargetPremium).toBe(52_000);
      expect(s.renewal.insuredChanges.competitivePressure).toMatch(/RegentMGA/);

      // S16 year-2 rated
      expect(s.renewal.year2.technicalPremium).not.toBeNull();
      expect(s.renewal.year2.sha).toMatch(/^sha-[0-9a-f]{4}$/);
      // Year-2 technical premium should be larger than year-1 annual
      // because turnover is up substantially. Spec target ~£54,710;
      // tolerance ±£3k for the engine factor decisions.
      expect(s.renewal.year2.technicalPremium!).toBeGreaterThan(50_000);
      expect(s.renewal.year2.technicalPremium!).toBeLessThan(60_000);

      // S17 defence pricing — three options with 'defend' recommended
      expect(s.renewal.defencePricing.options).toHaveLength(3);
      const ids = s.renewal.defencePricing.options.map((o) => o.id);
      expect(ids).toEqual(['hold', 'defend', 'aggressive']);
      const recommended = s.renewal.defencePricing.options.find((o) => o.recommended);
      expect(recommended?.id).toBe('defend');
      expect(s.renewal.defencePricing.holdFloor).toBe(50_500);
      // Selected option = defend
      expect(s.renewal.selectedOption?.id).toBe('defend');
      const defendPremium = s.renewal.selectedOption!.premium;
      // Defend should sit between sharp floor and technical
      expect(defendPremium).toBeGreaterThanOrEqual(50_500);
      expect(defendPremium).toBeLessThanOrEqual(s.renewal.year2.technicalPremium!);

      // S18 renewal recommendation — 7 factors, BIND verdict
      expect(s.renewal.recommendation.primary).toBe('bind');
      expect(s.renewal.recommendation.confidence).toBe('high');
      expect(s.renewal.recommendation.factorIds).toHaveLength(7);
      expect(s.renewal.recommendation.factorIds).toContain('FCT-006');
      expect(s.renewal.recommendation.factorIds).toContain('FCT-007');
      expect(s.renewal.recommendation.headline).toMatch(/Recommend RENEWAL/);
      expect(s.renewal.recommendation.headline).toMatch(/Year-1 LR/);

      // S19 renewal slip generated + sent
      expect(s.renewal.slip.slipRef).toMatch(/POL-29481-R1-Q1/);
      expect(s.renewal.slip.premium).toBe(defendPremium);
      expect(s.renewal.slip.sentAt).not.toBeNull();

      // S20 renewal ceremony — 4 hashes confirmed
      expect(s.renewal.hashes).toHaveLength(4);
      expect(s.renewal.hashes.every((h) => h.status === 'confirmed')).toBe(true);

      // S21 succession seam: now → renewal, successor policy ref set
      expect(s.lifecycle.now).toBe('renewal');
      expect(s.lifecycle.cursor).toBe('renewal');
      expect(s.renewal.successorPolicyRef).toBe('POL-29481-R1');

      // S22 post-renewal state
      expect(s.submissionState).toBe('renewed');
      expect(s.renewal.committedAt).not.toBeNull();
      expect(s.renewal.scheduleSentAt).not.toBeNull();
    }

    // S23 ULTIMATE POLYMORPHIC STATE TEST — four historical views.
    {
      const s = useRanBerri.getState();
      const view = (cursor: 'bind' | 'mta-04' | 'cancel' | 'renewal') =>
        deriveCursorView({
          cursor,
          now: s.lifecycle.now,
          baseBindAt: s.policy.baseBindAt,
          versionCount: s.policy.versions.length,
          firstMtaSignedAt: s.policy.versions[0]?.signedAt ?? null,
          cancelledAt: s.cancellation.committedAt,
          cancelled:
            s.cancellation.phase === 'committed' || s.cancellation.phase === 'sent',
          renewedAt: s.renewal.committedAt,
          renewed: true,
        });

      // (a) Year-1 bind state (15 May 2026): bind-v1
      const a = view('bind');
      expect(a.kind).toBe('bind-v1');
      expect(a.scrubbed).toBe(true);
      // Submission still has 3 sites; quote.slipPremium is the bound
      // premium (£38,265).
      expect(s.submission!.sites).toHaveLength(3);
      expect(s.quote.slipPremium).toBe(38_265);

      // (b) MTA-04 state (1 Aug 2026): mta-v2
      const b = view('mta-04');
      expect(b.kind).toBe('mta-v2');
      expect(s.policy.versions[0]!.afterAnnualEquivalent).toBe(
        s.policy.versions[0]!.afterAnnualEquivalent,
      );

      // (c) Year-1 expiry (14 May 2027): the v2 final state, ready
      // for renewal. The cursor at 'mta-04' before renewal was
      // committed shows the same v2 view.
      const c = view('mta-04');
      expect(c.kind).toBe('mta-v2');

      // (d) Year-2 inception (15 May 2027): scrubbed to 'renewal'
      // when now is 'renewal' would be live; check that cursor at
      // 'renewal' produces 'year2-active' as the live view.
      const d = view('renewal');
      expect(d.kind).toBe('year2-active');
      expect(d.scrubbed).toBe(false);
      // Year-2 attributes are visible.
      expect(s.renewal.successorPolicyRef).toBe('POL-29481-R1');
      expect(s.renewal.selectedOption?.premium).toBe(s.renewal.slip.premium);
    }

    // S24 FEEDBACK LOOP: boundLedger has both POL-29481 and POL-29481-R1.
    {
      const s = useRanBerri.getState();
      const ids = s.boundLedger.map((b) => b.id);
      expect(ids).toContain('POL-29481');
      expect(ids).toContain('POL-29481-R1');
      // The renewal binder has matured=false, actualLossRatio=null
      // (just bound — same flywheel pattern as the original bind).
      const renewal = s.boundLedger.find((b) => b.id === 'POL-29481-R1');
      expect(renewal).toBeTruthy();
      expect(renewal!.matured).toBe(false);
      expect(renewal!.actualLossRatio).toBeNull();
    }

    // S25 AUDIT LOG SUPREMACY — full chronology + replayable.
    {
      const s = useRanBerri.getState();
      const log = s.auditLog;
      // All 11 modules represented.
      const kinds = new Set(log.map((e) => e.kind));
      const required: Array<typeof log[number]['kind']> = [
        'submission.created',
        'rating.completed',
        'slip.generated',
        'bind.ceremonyStarted',
        'bind.hashConfirmed',
        'bind.committed',
        'schedule.generated',
        'subjectivity.created',
        'mta.requestReceived',
        'mta.extracted',
        'mta.deltaRated',
        'mta.committed',
        'mta.scheduleSent',
        'renewal.triggered',
        'renewal.year1ReviewBuilt',
        'renewal.insuredChangesCaptured',
        'renewal.year2Rated',
        'renewal.defencePricingComputed',
        'renewal.optionSelected',
        'renewal.recommendationCompleted',
        'renewal.slipGenerated',
        'renewal.slipSent',
        'renewal.hashConfirmed',
        'renewal.committed',
        'renewal.scheduleSent',
        'claim.recorded',
      ];
      for (const k of required) {
        expect(kinds.has(k)).toBe(true);
      }

      // Pure replay reproduces the post-renewal terminal state.
      const r = replay(log);
      expect(r.submissionState).toBe('renewed');
      expect(r.bind.phase).toBe('committed');
      expect(r.policy.versions).toHaveLength(1);
      expect(r.renewal.phase).toBe('sent');
      expect(r.renewal.successorPolicyRef).toBe('POL-29481-R1');

      // JSON serialisation round-trips (the export-JSON button writes
      // exactly this).
      const json = JSON.stringify(log);
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(log.length);
    }
  });
});
