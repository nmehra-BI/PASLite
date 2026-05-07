/**
 * Module 13 — chapter list derivation.
 *
 * Given the cockpit's current submission state, return the list of
 * chapters in display order with their availability and section
 * state (pending / current / complete / failed). The chapter nav
 * and the SectionCollapse wrappers both consume this.
 */

import type { ChapterId } from '@/store/canvasUI';
import type { RanBerriState } from '@/store';

export type ChapterStatus = 'pending' | 'current' | 'complete' | 'failed';

export type ChapterDescriptor = {
  id: ChapterId;
  label: string;
  /** False when the chapter cannot exist on this submission yet
   *  (e.g. mta-04 before a bind). Affects nav rendering only. */
  available: boolean;
  status: ChapterStatus;
};

export function deriveChapters(s: RanBerriState): ChapterDescriptor[] {
  const intakePhase = s.enrichment.phase; // proxy for intake-complete
  const submission = s.submission;
  const enrichmentDone = s.enrichment.phase === 'settled';
  const triageDone = s.triage.phase === 'settled';
  const ratingDone = s.rating.phase === 'settled';
  const slipReady = s.quote.phase === 'slip-ready' || s.quote.phase === 'sent';
  const quoteSent = s.quote.phase === 'sent';
  const recommendationDone = s.recommendation.phase === 'settled';
  const ceremonyInProgress = s.bind.phase === 'in-progress';
  const bound = s.bind.phase === 'committed';
  const mtaActive = s.mta.phase !== 'idle';
  const mtaCommitted = s.mta.phase === 'committed' || s.mta.phase === 'sent';
  const cancellationActive =
    s.cancellation.phase !== 'idle' && s.cancellation.phase !== undefined;
  const cancelled =
    s.cancellation.phase === 'committed' || s.cancellation.phase === 'sent';
  const renewalActive = s.renewal.phase !== 'idle';
  const renewed = s.renewal.phase === 'committed' || s.renewal.phase === 'sent';

  const status = (
    available: boolean,
    complete: boolean,
    current: boolean,
  ): ChapterStatus =>
    !available ? 'pending' : complete ? 'complete' : current ? 'current' : 'pending';

  return [
    {
      id: 'extraction',
      label: 'Extraction',
      available: !!submission,
      status: status(!!submission, !!submission && intakePhase !== 'idle', !submission),
    },
    {
      id: 'enrichment',
      label: 'Enrichment',
      available: !!submission,
      status: status(!!submission, enrichmentDone, !enrichmentDone && !!submission),
    },
    {
      id: 'triage',
      label: 'Triage',
      available: enrichmentDone || triageDone,
      status: status(enrichmentDone || triageDone, triageDone, !triageDone && enrichmentDone),
    },
    {
      id: 'rating',
      label: 'Rating',
      available: triageDone || ratingDone,
      status: status(triageDone || ratingDone, ratingDone, !ratingDone && triageDone),
    },
    {
      id: 'quote',
      label: 'Quote',
      available: ratingDone || slipReady,
      status: status(ratingDone || slipReady, quoteSent, slipReady && !quoteSent),
    },
    {
      id: 'recommendation',
      label: 'Recommendation',
      available: quoteSent || recommendationDone,
      status: status(quoteSent || recommendationDone, recommendationDone && !ceremonyInProgress, recommendationDone && !ceremonyInProgress && !bound ? false : !recommendationDone && quoteSent),
    },
    {
      id: 'bind',
      label: 'Bind',
      available: ceremonyInProgress || bound,
      status: status(ceremonyInProgress || bound, bound, ceremonyInProgress),
    },
    {
      id: 'mta-04',
      label: 'MTA-04',
      available: mtaActive || mtaCommitted,
      status: status(mtaActive || mtaCommitted, mtaCommitted, mtaActive && !mtaCommitted),
    },
    {
      id: 'cancellation',
      label: 'Cancellation',
      available: cancellationActive,
      status: status(cancellationActive, cancelled, cancellationActive && !cancelled),
    },
    {
      id: 'renewal',
      label: 'Renewal',
      available: renewalActive,
      status: status(renewalActive, renewed, renewalActive && !renewed),
    },
  ];
}

/** Should the section default to expanded? Current = yes; complete or pending = no. */
export function defaultExpandedFor(status: ChapterStatus): boolean {
  return status === 'current';
}
