/**
 * MTA workflow orchestrator.
 *
 * Like the bind orchestrator, each user action emits a single audit
 * event; replay reconstructs the workflow state from the log alone.
 * Most actions are thin wrappers that compute the relevant artefact
 * and emit. The ceremony is two hashes (delta-premium + capacity-
 * update) that mirror the bind ceremony's pattern at smaller scale.
 */

import { useRanBerri } from '@/store';
import {
  capacityHeadroom,
  getCapacityLedger,
  getManchesterMtaRequest,
  type MtaRequest,
} from '@/lib/fixtures';
import { computeSha, GREENLINE_CONSUMPTION } from '@/lib/bind';
import { computeDeltaRating } from './computeDelta';
import type { MtaHashId } from './types';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Trigger the inbound MTA request for the demo path. Stamps the
 * received timestamp at "now" so the lifecycle ribbon's playhead
 * reads correctly during the demo regardless of fixture date.
 */
export function receiveMtaRequest(opts?: {
  request?: MtaRequest;
  receivedAt?: string;
}) {
  const { submission, appendAuditEvent, bind } = useRanBerri.getState();
  if (!submission) throw new Error('receiveMtaRequest: no active submission');
  if (bind.phase !== 'committed') {
    throw new Error('receiveMtaRequest: policy is not bound');
  }
  const request = opts?.request ?? getManchesterMtaRequest();
  const stamped: MtaRequest = {
    ...request,
    receivedAt: opts?.receivedAt ?? new Date().toISOString(),
  };
  appendAuditEvent({
    actor: { kind: 'broker', id: stamped.brokerName },
    kind: 'mta.requestReceived',
    submissionId: submission.id,
    mtaId: stamped.id,
    broker: stamped.brokerName,
    subject: stamped.subject,
    effectiveDate: stamped.effectiveDate,
    changeType: stamped.changeType,
  });
  return stamped;
}

/**
 * Cinematic extraction — staggered field reveals via mta.extracted.
 * Real extraction would emit per-field events; for MVP we extract
 * the full record at once and emit one event with the field map.
 */
export async function runMtaExtraction(opts?: {
  request?: MtaRequest;
  cinematic?: boolean;
}) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent } = state;
  if (!submission) throw new Error('runMtaExtraction: no active submission');
  // Source the rich data from the fixture; layer in the live event
  // payload (id / policyRef / effectiveDate) the store has projected.
  const live = state.mta.request;
  const src: MtaRequest = live
    ? {
        ...getManchesterMtaRequest(),
        id: live.id,
        policyRef: live.policyRef,
        effectiveDate: live.effectiveDate,
        changeType: live.changeType,
        brokerName: live.brokerName,
        receivedAt: live.receivedAt,
        subject: live.subject,
      }
    : opts?.request ?? getManchesterMtaRequest();

  if (opts?.cinematic) await sleep(180);

  const fields = {
    effectiveDate: src.effectiveDate,
    changeType: src.changeType,
    newSite: src.newSite,
    newTurnover: src.newTurnover,
    newSiteCount: src.newSiteCount,
  };
  const confidences = Object.values(src.confidences);
  const avg = confidences.reduce((a, b) => a + b, 0) / Math.max(1, confidences.length);

  if (opts?.cinematic) await sleep(800);

  appendAuditEvent({
    actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
    kind: 'mta.extracted',
    submissionId: submission.id,
    mtaId: src.id,
    fields,
    avgConfidence: avg,
    fieldCount: 8,
  });

  // Flag the pending-permit gap.
  if (src.newSite.permitStatus === 'pending') {
    appendAuditEvent({
      actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
      kind: 'mta.gapFlagged',
      submissionId: submission.id,
      mtaId: src.id,
      gapId: 'GAP-MTA-001',
      description: `EA permit pending (${src.newSite.expectedPermitRef ?? '—'}) — material to add-site`,
    });
  }

  if (opts?.cinematic) await sleep(200);
}

export function resolveMtaGap(input: {
  gapId: string;
  choice: 'conditional' | 'wait' | 'decline';
  reason: string;
  resolvedBy: string;
}) {
  const { submission, appendAuditEvent, mta } = useRanBerri.getState();
  if (!submission) throw new Error('resolveMtaGap: no active submission');
  if (!mta.request) throw new Error('resolveMtaGap: no active mta request');
  if (input.reason.trim().length < 8) {
    throw new Error('resolveMtaGap: reason must be ≥8 chars');
  }
  appendAuditEvent({
    actor: { kind: 'underwriter', id: input.resolvedBy },
    kind: 'mta.gapResolved',
    submissionId: submission.id,
    mtaId: mta.request.id,
    gapId: input.gapId,
    choice: input.choice,
    reason: input.reason.trim(),
    resolvedBy: input.resolvedBy,
  });
}

export function runDeltaRating() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, mta, quote } = state;
  if (!submission) throw new Error('runDeltaRating: no active submission');
  if (!mta.request) throw new Error('runDeltaRating: no active mta request');

  const breakdown = computeDeltaRating({
    submission,
    mta: getManchesterMtaRequest(),
    boundPremium: quote.slipPremium ?? 0,
  });

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'mta.deltaRated',
    submissionId: submission.id,
    mtaId: mta.request.id,
    beforePremium: breakdown.beforePremium,
    afterAnnualEquivalent: breakdown.afterAnnualEquivalent,
    annualDelta: breakdown.annualDelta,
    daysRemaining: breakdown.daysRemaining,
    daysInTerm: breakdown.daysInTerm,
    proRatedAP: breakdown.proRatedAP,
    sha: breakdown.sha,
  });
  return breakdown;
}

export function recheckCapacity() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, mta } = state;
  if (!submission) throw new Error('recheckCapacity: no active submission');
  if (!mta.request) throw new Error('recheckCapacity: no active mta request');
  if (!mta.delta) throw new Error('recheckCapacity: delta rating must run first');

  const ledger = getCapacityLedger();
  // 65% line on the new annual-equivalent.
  const newTotalConsumption = Math.round(mta.delta.afterAnnualEquivalent * 0.65);
  const deltaConsumption = newTotalConsumption - GREENLINE_CONSUMPTION;
  const headroomAfter = capacityHeadroom(ledger) - deltaConsumption;
  const sufficient = headroomAfter >= 0;

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'mta.capacityRechecked',
    submissionId: submission.id,
    mtaId: mta.request.id,
    deltaConsumption,
    newTotalConsumption,
    sufficient,
  });
  return { deltaConsumption, newTotalConsumption, sufficient, headroomAfter };
}

/**
 * Generate the revised schedule artefact + emit. The schedule is a
 * deterministic projection of submission + MTA + delta breakdown.
 */
export function generateMtaSchedule() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, mta, bind, policy } = state;
  if (!submission) throw new Error('generateMtaSchedule: no active submission');
  if (!mta.request) throw new Error('generateMtaSchedule: no active mta request');
  if (!mta.delta) throw new Error('generateMtaSchedule: delta rating required');

  const policyRef = bind.policyRef ?? mta.request.policyRef;
  const endorsementNumber = policy.versions.length + 1;
  const scheduleRef = `${policyRef}-MTA-0${endorsementNumber}`;
  const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const effectiveLabel = SHORT_DATE_FMT.format(new Date(mta.request.effectiveDate));

  const fixture = getManchesterMtaRequest();
  const endorsementNote = `This endorsement adds ${fixture.newSite.name} (${fixture.newSite.address}) as the ${ordinal(fixture.newSiteCount)} insured location and adjusts the annual premium to reflect updated turnover and site count. All other terms of ${policyRef} remain unchanged.`;
  const expectedPermitDeadline = computePermitDeadline(mta.request.effectiveDate);
  const addedWarranty = `Environment Agency permit for the new ${fixture.newSite.name} location (${fixture.newSite.expectedPermitRef ?? 'pending'}) must be in force within 60 days of the endorsement effective date (i.e., by ${SHORT_DATE_FMT.format(expectedPermitDeadline)}). Failure to obtain the permit in this period voids cover at the ${fixture.newSite.name} location.`;

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'mta.scheduleGenerated',
    submissionId: submission.id,
    mtaId: mta.request.id,
    scheduleRef,
    endorsementNote,
    addedWarranty,
  });
  return { scheduleRef, endorsementNumber, endorsementNote, addedWarranty, effectiveLabel };
}

export function confirmMtaHash(hashId: MtaHashId, confirmedBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, mta } = state;
  if (!submission) throw new Error('confirmMtaHash: no active submission');
  if (!mta.request) throw new Error('confirmMtaHash: no active mta request');

  const sha =
    hashId === 'delta-premium'
      ? mta.delta?.sha ?? computeSha({ unset: 'delta' })
      : computeSha({
          syndicate: 'Synd 2358',
          newTotalConsumption: mta.capacity?.newTotalConsumption ?? 0,
        });

  appendAuditEvent({
    actor: { kind: 'underwriter', id: confirmedBy },
    kind: 'mta.hashConfirmed',
    submissionId: submission.id,
    mtaId: mta.request.id,
    hashId,
    artefactSha: sha,
    confirmedBy,
  });
}

/**
 * Commit the MTA. Emits mta.committed (with provenance) plus the
 * cascade: subjectivity.created (for the new permit warranty if
 * any).
 */
export function commitMta(signedBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, mta, policy } = state;
  if (!submission) throw new Error('commitMta: no active submission');
  if (!mta.request) throw new Error('commitMta: no active mta request');
  if (!mta.delta) throw new Error('commitMta: no delta rating');
  if (!mta.schedule) throw new Error('commitMta: no schedule artefact');

  const allConfirmed =
    mta.hashes.length === 2 &&
    mta.hashes.every((h) => h.status === 'confirmed' || h.status === 'overridden');
  if (!allConfirmed) throw new Error('commitMta: both hashes must be confirmed');

  const endorsementNumber = policy.versions.length + 1;

  appendAuditEvent({
    actor: { kind: 'underwriter', id: signedBy },
    kind: 'mta.committed',
    submissionId: submission.id,
    mtaId: mta.request.id,
    scheduleRef: mta.schedule.scheduleRef,
    endorsementNumber,
    proRatedAP: mta.delta.proRatedAP,
    afterAnnualEquivalent: mta.delta.afterAnnualEquivalent,
    effectiveDate: mta.request.effectiveDate,
    signedBy,
    hashes: mta.hashes.map((h) => ({
      id: h.id,
      sha: h.artefactSha ?? '—',
      confirmedAt: h.confirmedAt ?? new Date().toISOString(),
    })),
  });

  // New conditional subjectivity for the Manchester permit (re-uses
  // the existing subjectivity.created event from module 8). Rich
  // site/permit details are sourced from the fixture since the
  // replay-projected request only carries event-payload fields.
  const fixture = getManchesterMtaRequest();
  const deadline = computePermitDeadline(mta.request.effectiveDate);
  const newSiteName = fixture.newSite.name;
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'subjectivity.created',
    submissionId: submission.id,
    subjectivityId: `SUBJ-${endorsementNumber + 100}`,
    subjectivityType: 'permit-warranty',
    description: `${newSiteName} EA permit must be in force within 60 days of MTA effective date (${mta.request.effectiveDate.slice(0, 10)})`,
    affectedSites: [newSiteName],
    criticalDate: deadline.toISOString(),
    actionRequired: `Obtain ${fixture.newSite.expectedPermitRef ?? 'EA permit'} by ${deadline.toISOString().slice(0, 10)}`,
    autoMonitor: true,
  });
}

export function sendMtaSchedule(sentBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, mta } = state;
  if (!submission) throw new Error('sendMtaSchedule: no active submission');
  if (!mta.request) throw new Error('sendMtaSchedule: no active mta request');
  if (!mta.schedule) throw new Error('sendMtaSchedule: no schedule artefact');
  if (mta.sentAt) return;

  const fixture = getManchesterMtaRequest();
  const coveringNote = `Hi ${mta.request.brokerName.split(' ')[0]},\n\nConfirming endorsement ${mta.schedule.scheduleRef.replace(/^.*MTA-/, 'MTA-')} for Greenline (${mta.request.policyRef}), adding ${fixture.newSite.name} with effect from ${formatDate(mta.request.effectiveDate)}. AP £${(mta.delta?.proRatedAP ?? 0).toLocaleString('en-GB')} (pro-rated). New warranty around the ${fixture.newSite.name} permit attached. Schedule is revised; let me know if you'd like to walk through the math.\n\nBest,\nNishit`;

  appendAuditEvent({
    actor: { kind: 'underwriter', id: sentBy },
    kind: 'mta.scheduleSent',
    submissionId: submission.id,
    mtaId: mta.request.id,
    scheduleRef: mta.schedule.scheduleRef,
    recipient: fixture.brokerEmail,
    coveringNote,
    sentBy,
  });
}

function ordinal(n: number): string {
  if (n === 1) return 'first';
  if (n === 2) return 'second';
  if (n === 3) return 'third';
  if (n === 4) return 'fourth';
  if (n === 5) return 'fifth';
  return `${n}th`;
}

function computePermitDeadline(effectiveISO: string): Date {
  const d = new Date(effectiveISO);
  d.setDate(d.getDate() + 60);
  return d;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}
