/**
 * Bind ceremony orchestrator.
 *
 * The ceremony is event-sourced: each user action emits a single
 * audit event, and replay reconstructs the ceremony's state from
 * those events alone. The store wraps these in actions; this module
 * exposes the logic in a form callable from anywhere (tests, future
 * cinematics).
 */

import { useRanBerri } from '@/store';
import { computeSha } from './hashEngine';
import {
  buildHashInputsFromSubmission,
  GREENLINE_CONSUMPTION,
  validateHashes,
} from './validateHashes';
import { generateBindCertificate } from './generateBindCertificate';
import { generateSchedule } from './generateSchedule';
import { deriveSubjectivities } from '@/lib/fixtures/subjectivities';
import { getCapacityLedger } from '@/lib/fixtures/capacityLedger';
import { effectiveValue } from '@/lib/field';
import type { HashId } from './types';

/**
 * Start the ceremony — emits bind.ceremonyStarted and advances the
 * submission to bind-ceremony-pending state.
 */
export function startBindCeremony(actedBy: string = 'nm') {
  const { submission, appendAuditEvent, submissionState } = useRanBerri.getState();
  if (!submission) throw new Error('startBindCeremony: no active submission');
  if (
    submissionState !== 'quote-sent' &&
    submissionState !== 'bind-pending' &&
    submissionState !== 'rating-pending'
  ) {
    throw new Error(`startBindCeremony: cannot start in state '${submissionState}'`);
  }
  appendAuditEvent({
    actor: { kind: 'underwriter', id: actedBy },
    kind: 'bind.ceremonyStarted',
    submissionId: submission.id,
    startedBy: actedBy,
  });
}

export function confirmHash(hashId: HashId, confirmedBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, quote, rating } = state;
  if (!submission) throw new Error('confirmHash: no active submission');

  const { warranties } = buildHashInputsFromSubmission(submission);
  const checks = validateHashes({
    submission,
    ratingPremium: rating.output?.premium ?? null,
    ratingSha: rating.output?.sha ?? null,
    quotedPremium: quote.slipPremium,
    quotedSlipSha: quote.slipSha,
    warranties,
    warrantiesAtSendSha: computeSha(warranties),
    sanctionsRefreshedAt: state.enrichment.sources['Experian']?.returnedAt ?? null,
    capacity: getCapacityLedger(),
    capacityConsumption: GREENLINE_CONSUMPTION,
  });

  const check = checks.find((c) => c.id === hashId);
  if (!check) throw new Error(`confirmHash: unknown hash ${hashId}`);

  if (!check.matches && check.status !== 'refresh-needed') {
    appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'bind.hashFailed',
      submissionId: submission.id,
      hashId,
      expectedSha: check.expectedSha ?? '—',
      currentSha: check.currentSha,
      reason:
        check.status === 'stale'
          ? 'artefact drift since seal'
          : 'capacity exhausted',
    });
    return { ok: false as const, check };
  }

  appendAuditEvent({
    actor: { kind: 'underwriter', id: confirmedBy },
    kind: 'bind.hashConfirmed',
    submissionId: submission.id,
    hashId,
    artefactSha: check.currentSha,
    confirmedBy,
  });
  return { ok: true as const, check };
}

export function overrideHash(input: {
  hashId: HashId;
  reason: string;
  overriddenBy: string;
}) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, quote, rating } = state;
  if (!submission) throw new Error('overrideHash: no active submission');

  const { warranties } = buildHashInputsFromSubmission(submission);
  const checks = validateHashes({
    submission,
    ratingPremium: rating.output?.premium ?? null,
    ratingSha: rating.output?.sha ?? null,
    quotedPremium: quote.slipPremium,
    quotedSlipSha: quote.slipSha,
    warranties,
    warrantiesAtSendSha: computeSha(warranties),
    sanctionsRefreshedAt: state.enrichment.sources['Experian']?.returnedAt ?? null,
    capacity: getCapacityLedger(),
    capacityConsumption: GREENLINE_CONSUMPTION,
  });
  const check = checks.find((c) => c.id === input.hashId);
  if (!check) throw new Error(`overrideHash: unknown hash ${input.hashId}`);
  if (input.reason.trim().length < 20) {
    throw new Error('overrideHash: reason must be ≥20 chars');
  }
  appendAuditEvent({
    actor: { kind: 'underwriter', id: input.overriddenBy },
    kind: 'bind.hashOverridden',
    submissionId: submission.id,
    hashId: input.hashId,
    expectedSha: check.expectedSha ?? '—',
    currentSha: check.currentSha,
    reason: input.reason.trim(),
    overriddenBy: input.overriddenBy,
  });
}

/**
 * Commit the bind. Emits bind.committed plus the cascade:
 * schedule.generated, subjectivity.created × N, decision.recorded.
 */
export function commitBind(signedBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, bind, quote } = state;
  if (!submission) throw new Error('commitBind: no active submission');
  if (bind.phase !== 'in-progress') {
    throw new Error(`commitBind: ceremony not in progress (phase=${bind.phase})`);
  }
  const allConfirmed =
    bind.hashes.length === 4 &&
    bind.hashes.every((h) => h.status === 'confirmed' || h.status === 'overridden');
  if (!allConfirmed) {
    throw new Error('commitBind: not all four hashes signed');
  }

  // POL-29481 from SUB-29481 / folio 29481
  const submissionId = submission.id;
  const policyRef = submissionId.startsWith('SUB-')
    ? submissionId.replace(/^SUB-/, 'POL-')
    : `POL-${submissionId}`;

  const premium = quote.slipPremium ?? 0;

  appendAuditEvent({
    actor: { kind: 'underwriter', id: signedBy },
    kind: 'bind.committed',
    submissionId,
    policyRef,
    premium,
    signedBy,
    hashes: bind.hashes.map((h) => ({
      id: h.id,
      sha: h.artefactSha ?? '—',
      confirmedAt: h.confirmedAt ?? new Date().toISOString(),
    })),
  });

  // Generate schedule artefact and emit.
  const schedule = generateSchedule({ submission, policyRef, premium });
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'schedule.generated',
    submissionId,
    policyRef,
    coveringNote: schedule.coveringNote,
    recipient: schedule.recipient,
  });

  // Create subjectivities.
  const subjects = deriveSubjectivities(submission);
  for (const s of subjects) {
    appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'subjectivity.created',
      submissionId,
      subjectivityId: s.id,
      subjectivityType: s.subjectivityType,
      description: s.description,
      affectedSites: s.affectedSites,
      criticalDate: s.criticalDate,
      actionRequired: s.actionRequired,
      autoMonitor: s.autoMonitor,
    });
  }

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'decision.recorded',
    submissionId,
    outcome: 'bound',
  });
}

export function sendSchedule(sentBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, postBind, bind } = state;
  if (!submission) throw new Error('sendSchedule: no active submission');
  if (!bind.policyRef) throw new Error('sendSchedule: no policy ref');
  if (postBind.schedule.sentAt) return; // idempotent
  appendAuditEvent({
    actor: { kind: 'underwriter', id: sentBy },
    kind: 'schedule.sent',
    submissionId: submission.id,
    policyRef: bind.policyRef,
    recipient: postBind.schedule.recipient ?? '—',
    coveringNote: postBind.schedule.coveringNote ?? '',
    sentBy,
  });
}

/**
 * Build the live BindCertificate (used by the post-bind inspector).
 * Returns null until the bind has actually committed.
 */
export function getLiveBindCertificate() {
  const state = useRanBerri.getState();
  const { submission, bind, quote } = state;
  if (!submission || bind.phase !== 'committed' || !bind.policyRef) return null;
  return generateBindCertificate({
    submission,
    policyRef: bind.policyRef,
    premium: quote.slipPremium ?? 0,
    hashes: bind.hashes,
    capacity: getCapacityLedger(),
    capacityConsumption: GREENLINE_CONSUMPTION,
    signedBy: bind.signedBy ?? 'N. Sharma',
    signedAt: bind.committedAt ?? new Date().toISOString(),
  });
}

/** Used by tests and Inspector to derive insured display name. */
export function getInsuredName(): string | null {
  const submission = useRanBerri.getState().submission;
  if (!submission) return null;
  return (effectiveValue(submission.insured.legalName) as string | null) ?? null;
}
