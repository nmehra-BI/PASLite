/**
 * Cancellation orchestrator.
 *
 * Each user action emits one audit event; replay reconstructs the
 * workflow state. Three-hash ceremony: refund-basis, runoff-claim,
 * bordereau.
 */

import { useRanBerri } from '@/store';
import { computeSha } from '@/lib/bind';
import { effectiveValue } from '@/lib/field';
import {
  getGreenlineCancellationRequest,
  type CancellationRequest,
} from '@/lib/fixtures/cancellationRequest';
import { computeRefundAndClawback } from './computeRefund';
import {
  REASON_RULES,
  SYNDICATE_LINE,
  type CancellationHashId,
  type RefundBasis,
} from './types';

export function receiveCancellationRequest(opts?: {
  request?: CancellationRequest;
  receivedAt?: string;
}) {
  const { submission, appendAuditEvent, bind } = useRanBerri.getState();
  if (!submission) throw new Error('receiveCancellationRequest: no active submission');
  if (bind.phase !== 'committed') {
    throw new Error('receiveCancellationRequest: policy is not bound');
  }
  const request = opts?.request ?? getGreenlineCancellationRequest();
  const stamped: CancellationRequest = {
    ...request,
    receivedAt: opts?.receivedAt ?? new Date().toISOString(),
  };
  appendAuditEvent({
    actor: { kind: 'broker', id: stamped.brokerName },
    kind: 'cancellation.requestReceived',
    submissionId: submission.id,
    cancellationId: stamped.id,
    broker: stamped.brokerName,
    subject: stamped.subject,
    effectiveDate: stamped.effectiveDate,
    reasonCategory: stamped.reasonCategory,
    reasonDetail: stamped.reasonDetail,
    ...(stamped.switchingTo ? { switchingTo: stamped.switchingTo } : {}),
  });
  // Auto-select the default basis per the rules table.
  const defaultBasis = REASON_RULES[stamped.reasonCategory].defaultBasis;
  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'cancellation.basisSelected',
    submissionId: submission.id,
    cancellationId: stamped.id,
    basis: defaultBasis,
  });
  return stamped;
}

export function overrideCancellationBasis(input: {
  to: RefundBasis;
  reason: string;
  overriddenBy: string;
}) {
  const { submission, appendAuditEvent, cancellation } = useRanBerri.getState();
  if (!submission) throw new Error('overrideCancellationBasis: no active submission');
  if (!cancellation.request) throw new Error('overrideCancellationBasis: no active request');
  if (input.reason.trim().length < 10) {
    throw new Error('overrideCancellationBasis: reason must be ≥10 chars');
  }
  const from = cancellation.basis ?? REASON_RULES[cancellation.request.reasonCategory].defaultBasis;
  appendAuditEvent({
    actor: { kind: 'underwriter', id: input.overriddenBy },
    kind: 'cancellation.basisOverridden',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    from,
    to: input.to,
    reason: input.reason.trim(),
    overriddenBy: input.overriddenBy,
  });
}

export function captureRunoffClaim(input: {
  ref: string;
  description: string;
  reserveAmount: number;
  capturedBy: string;
}) {
  const { submission, appendAuditEvent, cancellation } = useRanBerri.getState();
  if (!submission) throw new Error('captureRunoffClaim: no active submission');
  if (!cancellation.request) throw new Error('captureRunoffClaim: no active request');
  appendAuditEvent({
    actor: { kind: 'underwriter', id: input.capturedBy },
    kind: 'cancellation.runoffClaimCaptured',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    claimRef: input.ref,
    description: input.description,
    reserveAmount: input.reserveAmount,
    capturedBy: input.capturedBy,
  });
}

export function computeCancellationRefund() {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, cancellation, quote, policy } = state;
  if (!submission) throw new Error('computeCancellationRefund: no active submission');
  if (!cancellation.request) throw new Error('computeCancellationRefund: no active request');

  const inception = (effectiveValue(submission.cover.inceptionDate) as string | null) ?? '';
  const expiry = (effectiveValue(submission.cover.expiryDate) as string | null) ?? '';
  // Use the latest annual equivalent — i.e. v2 if an MTA committed.
  const annualPremium =
    policy.versions[policy.versions.length - 1]?.afterAnnualEquivalent ??
    quote.slipPremium ??
    0;

  const basis: RefundBasis =
    cancellation.basisOverride?.to ??
    cancellation.basis ??
    REASON_RULES[cancellation.request.reasonCategory].defaultBasis;

  const calc = computeRefundAndClawback({
    annualPremium,
    policyInception: inception,
    policyExpiry: expiry,
    cancellationEffective: cancellation.request.effectiveDate,
    basis,
    reason: cancellation.request.reasonCategory,
  });

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'cancellation.refundComputed',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    annualPremium: calc.annualPremium,
    daysRemaining: calc.daysRemaining,
    daysInTerm: calc.daysInTerm,
    basis: calc.basis,
    refund: calc.refund,
    commissionClawback: calc.commissionClawback,
    clawbackKind: calc.clawbackKind,
    bordereauNet: calc.bordereauNet,
    sha: calc.sha,
  });
  return calc;
}

export function confirmCancellationHash(
  hashId: CancellationHashId,
  confirmedBy: string = 'nm',
) {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, cancellation } = state;
  if (!submission) throw new Error('confirmCancellationHash: no active submission');
  if (!cancellation.request) throw new Error('confirmCancellationHash: no active request');

  const sha =
    hashId === 'refund-basis'
      ? cancellation.calc?.sha ?? computeSha({ unset: 'refund' })
      : hashId === 'runoff-claim'
        ? computeSha({
            ref: cancellation.runoffClaim?.ref ?? null,
            reserve: cancellation.runoffClaim?.reserveAmount ?? 0,
          })
        : computeSha({
            net: cancellation.calc?.bordereauNet ?? 0,
            line: SYNDICATE_LINE,
          });

  appendAuditEvent({
    actor: { kind: 'underwriter', id: confirmedBy },
    kind: 'cancellation.hashConfirmed',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    hashId,
    artefactSha: sha,
    confirmedBy,
  });
}

/**
 * Commit the cancellation. Emits cancellation.committed +
 * bordereau.entryWritten + (optionally) competitor.switchRecorded
 * if the broker named a competitor.
 */
export function commitCancellation(signedBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, cancellation, policy } = state;
  if (!submission) throw new Error('commitCancellation: no active submission');
  if (!cancellation.request) throw new Error('commitCancellation: no active request');
  if (!cancellation.calc) throw new Error('commitCancellation: no refund calc');

  const allConfirmed =
    cancellation.hashes.length === 3 &&
    cancellation.hashes.every(
      (h) => h.status === 'confirmed' || h.status === 'overridden',
    );
  if (!allConfirmed) throw new Error('commitCancellation: all three hashes must be confirmed');

  const policyRef = state.bind.policyRef ?? cancellation.request.id;
  const endorsementNumber = policy.versions.length + 1;
  const endorsementRef = `${policyRef}-CAN-${endorsementNumber.toString().padStart(2, '0')}`;

  appendAuditEvent({
    actor: { kind: 'underwriter', id: signedBy },
    kind: 'cancellation.committed',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    endorsementRef,
    endorsementNumber,
    effectiveDate: cancellation.request.effectiveDate,
    basis: cancellation.calc.basis,
    refund: cancellation.calc.refund,
    commissionClawback: cancellation.calc.commissionClawback,
    bordereauNet: cancellation.calc.bordereauNet,
    signedBy,
    hashes: cancellation.hashes.map((h) => ({
      id: h.id,
      sha: h.artefactSha ?? '—',
      confirmedAt: h.confirmedAt ?? new Date().toISOString(),
    })),
  });

  appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'bordereau.entryWritten',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    netMovement: cancellation.calc.bordereauNet,
    syndicate: 'Synd 2358',
    line: SYNDICATE_LINE,
  });

  // If the broker named a competitor, write a feedback signal that
  // surfaces in FCT-003. Skip on void-ab-initio (no premium movement
  // means there's no "switch" to record — the policy never existed).
  if (cancellation.request.switchingTo && cancellation.calc.basis !== 'void-ab-initio') {
    const retainedPremium = cancellation.calc.annualPremium - cancellation.calc.refund;
    appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'competitor.switchRecorded',
      submissionId: submission.id,
      policyRef,
      toCompetitor: cancellation.request.switchingTo,
      cancelledAt: cancellation.request.effectiveDate,
      retainedPremium,
      switchType: 'mid-term-switch',
      notes: cancellation.request.reasonDetail,
    });
  }
}

export function sendCancellationEndorsement(sentBy: string = 'nm') {
  const state = useRanBerri.getState();
  const { submission, appendAuditEvent, cancellation } = state;
  if (!submission) throw new Error('sendCancellationEndorsement: no active submission');
  if (!cancellation.request) throw new Error('sendCancellationEndorsement: no active request');
  if (!cancellation.endorsementRef) throw new Error('sendCancellationEndorsement: not committed');
  if (cancellation.sentAt) return;
  const coveringNote = `Hi ${cancellation.request.broker.split(' ')[0]},

Confirming cancellation endorsement ${cancellation.endorsementRef} for ${state.bind.policyRef ?? '—'}, effective ${cancellation.request.effectiveDate.slice(0, 10)} per ${REASON_RULES[cancellation.request.reasonCategory].label}. Refund £${(cancellation.calc?.refund ?? 0).toLocaleString('en-GB')} on ${cancellation.calc?.basis ?? 'short-rate'} basis. Endorsement and bordereau entry attached.

Best,
Nishit`;

  appendAuditEvent({
    actor: { kind: 'underwriter', id: sentBy },
    kind: 'cancellation.endorsementSent',
    submissionId: submission.id,
    cancellationId: cancellation.request.id,
    endorsementRef: cancellation.endorsementRef,
    recipient: cancellation.request.broker.toLowerCase().includes('whitfield')
      ? 's.whitfield@surestep.co.uk'
      : '—',
    coveringNote,
    sentBy,
  });
}
