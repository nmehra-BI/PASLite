/**
 * Data flywheel — bound submissions compound the same-MGA evidence
 * pool used by future recommendations.
 *
 * Demonstrates step 13 of the walkthrough: after Greenline binds, a
 * second submission with a similar profile finds Greenline in its
 * FCT-001 strong-match cohort because the bound ledger was augmented.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { enableMapSet } from 'immer';
import { useRanBerri } from '@/store';
import { getGreenlineSubmission, getHistoricalBinders } from '@/lib/fixtures';
import { deriveBoundLedgerEntry } from '@/lib/bind';
import { runRecommendation } from '@/lib/recommendation';

enableMapSet();

describe('data flywheel — bound binders compound', () => {
  beforeEach(() => {
    useRanBerri.getState().reset();
    // reset() preserves boundLedger by design; clear it explicitly here.
    useRanBerri.setState({ boundLedger: [] });
  });

  it('appending a bound entry surfaces it in a similar profile recommendation', () => {
    // Step 1: simulate Greenline as bound by appending its derived
    // entry to the ledger directly. (The full bind ceremony is exercised
    // in greenline-e2e.test.ts; here we just need a populated ledger.)
    const greenline = getGreenlineSubmission();
    // Resolve fire suppression so derive picks 'present'.
    greenline.fireSuppressionDisclosed = {
      ...greenline.fireSuppressionDisclosed,
      underwriterCorrected: {
        value: true,
        reason: 'broker confirmed',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };
    const entry = deriveBoundLedgerEntry({
      submission: greenline,
      policyRef: 'POL-29481',
      premium: 38_265,
      signedBy: 'nm',
      signedAt: '2026-05-09T14:14:14Z',
    });
    expect(entry.id).toBe('POL-29481');
    expect(entry.matured).toBe(false);
    expect(entry.actualLossRatio).toBeNull();

    useRanBerri.setState({ boundLedger: [entry] });

    // Step 2: a "second submission" (we reuse Greenline as the target
    // profile because it's the closest similarity match — fixture
    // surgery would be needed to fully simulate Mooredale, but the
    // important assertion is that the bound entry appears in similar
    // binders for any close-profile target).
    const target = getGreenlineSubmission();
    target.fireSuppressionDisclosed = {
      ...target.fireSuppressionDisclosed,
      underwriterCorrected: {
        value: true,
        reason: 'broker confirmed',
        correctedBy: 'nm',
        correctedAt: '2026-05-09T09:15:00Z',
      },
    };

    const allBinders = [
      ...getHistoricalBinders(),
      ...useRanBerri.getState().boundLedger,
    ];

    const r = runRecommendation({
      submission: target,
      ourPremium: 38_265,
      binders: allBinders,
      losses: [],
      competitorIntel: [],
      fireSuppressionResolved: true,
      fireSuppressionRequested: false,
    });

    // The bound Greenline (POL-29481) must appear in the similar
    // binders surfaced by the engine — that's the moat compounding.
    const binderIds = r.similarBinders.map((b) => b.id);
    expect(binderIds).toContain('POL-29481');
  });

  it('reset() preserves boundLedger; the next demo session sees prior binds', () => {
    const greenline = getGreenlineSubmission();
    const entry = deriveBoundLedgerEntry({
      submission: greenline,
      policyRef: 'POL-29481',
      premium: 38_265,
      signedBy: 'nm',
      signedAt: '2026-05-09T14:14:14Z',
    });
    useRanBerri.setState({ boundLedger: [entry] });

    useRanBerri.getState().reset();

    expect(useRanBerri.getState().boundLedger).toHaveLength(1);
    expect(useRanBerri.getState().boundLedger[0]!.id).toBe('POL-29481');
  });
});
