/**
 * Build the BindCertificate from the materialised store state at
 * commit time. Pure — given the same inputs it produces the same
 * certificate, so the certificate is replayable.
 */

import { effectiveValue } from '@/lib/field';
import { capacityHeadroom, type CapacityLedger } from '@/lib/fixtures/capacityLedger';
import type { Submission } from '@/lib/fixtures';
import type { BindCertificate, HashRecord } from './types';
import { HASH_LABELS } from './types';
import { buildHashInputsFromSubmission } from './validateHashes';

export function generateBindCertificate(input: {
  submission: Submission;
  policyRef: string;
  premium: number;
  hashes: HashRecord[];
  capacity: CapacityLedger;
  capacityConsumption: number;
  signedBy: string;
  signedAt: string;
}): BindCertificate {
  const { submission, policyRef, premium, hashes, capacity, capacityConsumption } = input;

  const insuredName = (effectiveValue(submission.insured.legalName) as string | null) ?? '—';
  const inceptionDate = (effectiveValue(submission.cover.inceptionDate) as string | null) ?? '';
  const expiryDate = (effectiveValue(submission.cover.expiryDate) as string | null) ?? '';
  const term = (effectiveValue(submission.cover.term) as string | null) ?? '12 months';
  const { warranties } = buildHashInputsFromSubmission(submission);

  return {
    policyRef,
    insuredName,
    inceptionDate,
    expiryDate,
    term,
    premium,
    hashes: hashes.map((h) => {
      const label = HASH_LABELS.find((l) => l.id === h.id)!;
      return {
        id: h.id,
        label: label.certificateLabel,
        sha: h.artefactSha ?? '—',
        confirmedAt: h.confirmedAt ?? '',
        detail: detailForHash(h, premium),
      };
    }),
    warranties,
    capacity: {
      syndicate: capacity.syndicate,
      line: '65% line',
      consumption: capacityConsumption,
    },
    signedBy: input.signedBy,
    signedAt: input.signedAt,
  };

  // Suppress unused-locals lint complaint when capacityHeadroom is
  // referenced indirectly elsewhere.
  void capacityHeadroom;
}

function detailForHash(h: HashRecord, premium: number): string {
  switch (h.id) {
    case 'premium':
      return `${h.artefactSha ?? '—'} · rating engine v3.2 · £${premium.toLocaleString('en-GB')}`;
    case 'subjectivities':
      return `${h.artefactSha ?? '—'} · matches slip`;
    case 'sanctions':
      return `Experian clear · ${h.artefactSha ?? '—'}`;
    case 'capacity':
      return `Syndicate 2358 · 65% line · ${h.artefactSha ?? '—'}`;
  }
}
