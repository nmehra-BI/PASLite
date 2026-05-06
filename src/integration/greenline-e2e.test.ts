/**
 * End-to-end pipeline test — Greenline submission journey.
 *
 * Drives every engine the cockpit calls in sequence and verifies the
 * intermediate state at each stage. This is the most concrete check
 * that the full demo journey works from a fresh store to a bound
 * policy with all artefacts in place.
 *
 * NOT a UI test — animations / cinematics are bypassed where possible
 * by calling the underlying lib functions directly. Where engines run
 * cinematically (extraction, enrichment, triage, rating,
 * recommendation), they are awaited in fake-timed mode.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { enableMapSet } from 'immer';
import { useRanBerri } from '@/store';
import { runExtraction } from '@/features/intake';
import { runEnrichment } from '@/features/enrichment';
import { runTriageCinematic } from '@/features/triage';
import { runRatingCinematic, generateSlipAndEmail } from '@/features/rating';
import { runRecommendationCinematic } from '@/features/recommendation';
import {
  computeSha,
  buildHashInputsFromSubmission,
  GREENLINE_CONSUMPTION,
  validateHashes,
  confirmHash,
  commitBind,
  sendSchedule,
  getLiveBindCertificate,
} from '@/lib/bind';
import { getCapacityLedger } from '@/lib/fixtures/capacityLedger';
import { effectiveValue } from '@/lib/field';

enableMapSet();

describe('Greenline submission — full E2E journey', () => {
  beforeEach(() => {
    useRanBerri.getState().reset();
  });

  it('runs the full pipeline from fresh store to bound policy', async () => {
    vi.useFakeTimers();

    // ============ STEP 1: SUBMISSION ARRIVAL ============
    const extractionPromise = runExtraction();
    await vi.runAllTimersAsync();
    await extractionPromise;

    let s = useRanBerri.getState();
    expect(s.submission).not.toBeNull();
    expect(s.submission!.id).toBe('sub_greenline_2026_05');
    const fieldExtractedEvents = s.auditLog.filter(
      (e) => e.kind === 'extraction.fieldExtracted',
    );
    // Spec says ~12 fields; the schedule may extract slightly more.
    expect(fieldExtractedEvents.length).toBeGreaterThanOrEqual(10);
    const completedEvent = s.auditLog.find((e) => e.kind === 'extraction.completed');
    expect(completedEvent).toBeDefined();

    // ============ STEP 2: ENRICHMENT + CONFLICT/GAP RESOLUTION ============
    const enrichmentPromise = runEnrichment();
    await vi.runAllTimersAsync();
    await enrichmentPromise;

    s = useRanBerri.getState();
    expect(s.enrichment.phase).toBe('settled');
    expect(s.enrichment.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(s.enrichment.gaps.length).toBeGreaterThanOrEqual(1);

    const turnoverConflict = s.enrichment.conflicts.find(
      (c) => c.id === 'conflict_turnover',
    );
    expect(turnoverConflict).toBeDefined();

    s.resolveConflict({
      conflictId: 'conflict_turnover',
      fieldPath: 'insured.turnover',
      choice: 'external',
      value: turnoverConflict!.externalValue,
      reason: 'Trust filed Companies House accounts over broker stated.',
      resolvedBy: 'nm',
    });

    const fireGap = s.enrichment.gaps.find((g) => g.id === 'gap_fireSuppression');
    expect(fireGap).toBeDefined();

    s.resolveGap({
      gapId: 'gap_fireSuppression',
      fieldPath: 'fireSuppressionDisclosed',
      choice: 'present',
      reason: 'Confirmed verbally with broker.',
      resolvedBy: 'nm',
    });

    s = useRanBerri.getState();
    expect(effectiveValue(s.submission!.fireSuppressionDisclosed)).toBe(true);

    // ============ STEP 3: TRIAGE ============
    const triagePromise = runTriageCinematic();
    await vi.runAllTimersAsync();
    await triagePromise;

    s = useRanBerri.getState();
    expect(s.triage.phase).toBe('settled');
    expect(s.triage.verdict).toBe('pass');
    expect(s.triage.checks).toHaveLength(4);
    for (const check of s.triage.checks) {
      const eff = check.override?.outcome ?? check.outcome;
      expect(eff).toBe('pass');
    }

    // Click "Proceed to rating →"
    s.proceedToRating();
    s = useRanBerri.getState();
    expect(s.submissionState).toBe('rating-pending');

    // ============ STEP 4: RATING ============
    const ratingPromise = runRatingCinematic();
    await vi.runAllTimersAsync();
    await ratingPromise;

    s = useRanBerri.getState();
    expect(s.rating.phase).toBe('settled');
    expect(s.rating.output).toBeTruthy();
    expect(s.rating.output!.premium).toBe(38_265);
    expect(s.rating.output!.sha).toBe('sha-7f2a');

    // ============ STEP 5: SLIP + SEND ============
    generateSlipAndEmail();
    s = useRanBerri.getState();
    expect(s.quote.phase).toBe('slip-ready');
    expect(s.quote.slipPremium).toBe(38_265);
    expect(s.quote.slipRef).toBe('POL-29481-Q1');
    expect(s.quote.email).not.toBeNull();
    // Verify the warranty text the slip is about to display includes
    // the Leeds permit warranty.
    const { warranties } = buildHashInputsFromSubmission(s.submission!);
    const leedsWarranty = warranties.find((w) => w.toLowerCase().includes('leeds'));
    expect(leedsWarranty).toBeDefined();
    expect(leedsWarranty).toMatch(/EAWML-99214/);

    // Send the quote.
    s.sendQuote({ sentBy: 'nm' });
    s = useRanBerri.getState();
    expect(s.submissionState).toBe('quote-sent');
    expect(s.quote.sentAt).not.toBeNull();

    // ============ STEP 6: RECOMMENDATION ============
    const recPromise = runRecommendationCinematic();
    await vi.runAllTimersAsync();
    await recPromise;

    s = useRanBerri.getState();
    expect(s.recommendation.phase).toBe('settled');
    expect(s.recommendation.primary).toBe('bind');
    expect(s.recommendation.confidence).toBe('high');
    expect(s.recommendation.headline).toContain('Recommend BIND');
    expect(s.recommendation.headline).toContain('RegentMGA');
    expect(s.recommendation.headline).toContain('Sarah');
    expect(s.recommendation.headline).toMatch(/hold firm above £/);
    expect(s.recommendation.factors.length).toBe(5);

    // Click [Bind →]
    s.actOnRecommendation({ action: 'bind', actedBy: 'nm' });
    s = useRanBerri.getState();
    expect(s.recommendation.action?.kind).toBe('bind');
    expect(s.bind.phase).toBe('in-progress');
    expect(s.submissionState).toBe('bind-pending');

    // ============ STEP 7: BIND CEREMONY ============
    // Compute the live hash checks the way the BindCeremony component does.
    const { warranties: hashWarranties } = buildHashInputsFromSubmission(s.submission!);
    const checks = validateHashes({
      submission: s.submission!,
      ratingPremium: s.rating.output!.premium,
      ratingSha: s.rating.output!.sha,
      quotedPremium: s.quote.slipPremium,
      quotedSlipSha: s.quote.slipSha,
      warranties: hashWarranties,
      warrantiesAtSendSha: computeSha(hashWarranties),
      sanctionsRefreshedAt:
        s.enrichment.sources['experian-sanctions']?.returnedAt ?? null,
      capacity: getCapacityLedger(),
      capacityConsumption: GREENLINE_CONSUMPTION,
    });
    expect(checks).toHaveLength(4);
    for (const c of checks) {
      expect(c.matches, `${c.id} should match for default Greenline path: ${c.primary}`).toBe(true);
    }

    // Click each of 4 hashes; each writes bind.hashConfirmed.
    confirmHash('premium', 'nm');
    confirmHash('subjectivities', 'nm');
    confirmHash('sanctions', 'nm');
    confirmHash('capacity', 'nm');
    s = useRanBerri.getState();
    expect(s.bind.hashes).toHaveLength(4);
    expect(s.bind.hashes.every((h) => h.status === 'confirmed')).toBe(true);
    for (const h of s.bind.hashes) {
      expect(h.artefactSha).toMatch(/^sha-[0-9a-f]{4}$/);
      expect(h.confirmedAt).toBeTruthy();
    }

    // ============ STEP 8: COMMIT BIND (seam fires) ============
    commitBind('nm');
    s = useRanBerri.getState();
    expect(s.bind.phase).toBe('committed');
    expect(s.bind.policyRef).toBe('POL-29481');
    expect(s.submissionState).toBe('bound');
    expect(s.lifecycle.now).toBe('bind');
    expect(s.lifecycle.cursor).toBe('bind');

    const bindCommitted = s.auditLog.find((e) => e.kind === 'bind.committed');
    expect(bindCommitted).toBeDefined();
    const scheduleGenerated = s.auditLog.find(
      (e) => e.kind === 'schedule.generated',
    );
    expect(scheduleGenerated).toBeDefined();
    expect(s.postBind.subjectivities.length).toBe(2);

    // ============ STEP 9: POST-BIND ARTEFACTS ============
    const cert = getLiveBindCertificate();
    expect(cert).not.toBeNull();
    expect(cert!.policyRef).toBe(s.bind.policyRef);
    expect(cert!.hashes).toHaveLength(4);
    expect(cert!.warranties.length).toBeGreaterThanOrEqual(1);
    expect(cert!.signedBy).toBe('nm');

    expect(s.postBind.subjectivities[0]!.subjectivityType).toBe('permit-warranty');
    expect(s.postBind.subjectivities[0]!.criticalDate).not.toBeNull();
    expect(s.postBind.subjectivities[1]!.subjectivityType).toBe(
      'maintenance-warranty',
    );

    // Send schedule to broker.
    sendSchedule('nm');
    s = useRanBerri.getState();
    expect(s.postBind.schedule.sentAt).not.toBeNull();

    // ============ STEP 10: AUDIT LOG ============
    // Full chronology should span email.received → bind.committed → schedule.sent.
    const kindsInOrder = s.auditLog.map((e) => e.kind);
    expect(kindsInOrder[0]).toBe('email.received');
    expect(kindsInOrder).toContain('bind.committed');
    expect(kindsInOrder).toContain('schedule.sent');
    expect(kindsInOrder).toContain('subjectivity.created');

    // ============ STEP 12: PERSISTENCE (replay round-trip) ============
    const log = [...s.auditLog];
    // Reset and replay from log alone — same state out.
    s.reset();
    // Manual replay test: feed the log back and compare.
    const { replay } = await import('@/store/replay');
    const r = replay(log);
    expect(r.submissionState).toBe('bound');
    expect(r.bind.phase).toBe('committed');
    expect(r.bind.policyRef).toBe(cert!.policyRef);
    expect(r.postBind.subjectivities).toHaveLength(2);
    expect(r.postBind.schedule.sentAt).not.toBeNull();

    vi.useRealTimers();
  });
});
