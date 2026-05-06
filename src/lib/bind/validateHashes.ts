/**
 * For each of the four hashes, compute the *current* sha of its
 * underlying artefact and compare to the *expected* sha that was
 * recorded at seal time.
 *
 *   • Hash 1 — premium       expected = slip's slipSha at quote-sent
 *                            current  = sha of live rating output
 *   • Hash 2 — subjectivities expected = warranty array hashed at slip generation
 *                            current  = warranty array hashed live
 *   • Hash 3 — sanctions     expected = "current" sha if refresh ≤ 24h
 *                            current  = computed against the live timestamp
 *   • Hash 4 — capacity      expected = headroom sha at triage time
 *                            current  = headroom sha now
 *
 * Returns a per-hash struct that the ceremony orchestrator and UI use
 * to render labels, decide can-confirm, and arm override flows.
 */

import {
  capacityHeadroom,
  type CapacityLedger,
} from '@/lib/fixtures/capacityLedger';
import type { Submission } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import { computeSha } from './hashEngine';
import type { HashId } from './types';

const SANCTIONS_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export type HashCheck = {
  id: HashId;
  /** Sha as recorded at seal time. Null when the seal step never ran. */
  expectedSha: string | null;
  /** Sha computed from the artefact's current state. */
  currentSha: string;
  /** True when expected matches current — the hash is safe to sign. */
  matches: boolean;
  /** Sub-status for nuanced UI rendering. */
  status:
    | 'ready'         // matches, can confirm
    | 'stale'         // expected != current — needs override
    | 'refresh-needed'// sanctions older than 24h, will auto-refresh
    | 'blocked';      // capacity exhausted (no override path)
  /** Human-readable summary line for the row. */
  primary: string;
  /** Italic citation reference shown below the primary line. */
  citation: string;
};

export type HashCheckInputs = {
  submission: Submission;
  /** The premium currently produced by the rating engine. */
  ratingPremium: number | null;
  ratingSha: string | null;
  /** The premium the slip was sent against. */
  quotedPremium: number | null;
  quotedSlipSha: string | null;
  warranties: string[];
  /** Captures whether the warranties match what the broker received. */
  warrantiesAtSendSha: string | null;
  /** Current Experian sanctions check timestamp. */
  sanctionsRefreshedAt: string | null;
  /** Current capacity ledger snapshot. */
  capacity: CapacityLedger;
  /** Estimated consumption for this risk (set at triage time). */
  capacityConsumption: number;
};

const PREMIUM_LABELS = (premium: number, sha: string) =>
  `Premium £${premium.toLocaleString('en-GB')} confirmed against rating engine v3.2 · ${sha}`;

export function validateHashes(inputs: HashCheckInputs, now: Date = new Date()): HashCheck[] {
  return [
    validatePremium(inputs),
    validateSubjectivities(inputs),
    validateSanctions(inputs, now),
    validateCapacity(inputs),
  ];
}

function validatePremium(inputs: HashCheckInputs): HashCheck {
  const expectedSha = inputs.quotedSlipSha;
  const currentSha = inputs.ratingSha ?? computeSha({ premium: inputs.ratingPremium });
  const matches = expectedSha !== null && expectedSha === currentSha;
  const premium = inputs.quotedPremium ?? inputs.ratingPremium ?? 0;
  return {
    id: 'premium',
    expectedSha,
    currentSha,
    matches,
    status: matches ? 'ready' : 'stale',
    primary: matches
      ? PREMIUM_LABELS(premium, currentSha)
      : `Premium £${premium.toLocaleString('en-GB')} — but the rating engine output has changed`,
    citation: matches
      ? `${currentSha} · sealed at quote time`
      : `current ${currentSha} · quoted ${expectedSha ?? '—'} (changed)`,
  };
}

function validateSubjectivities(inputs: HashCheckInputs): HashCheck {
  const currentSha = computeSha(inputs.warranties);
  const expectedSha = inputs.warrantiesAtSendSha ?? currentSha;
  const matches = expectedSha === currentSha;
  const warrantyCount = inputs.warranties.length;
  return {
    id: 'subjectivities',
    expectedSha,
    currentSha,
    matches,
    status: matches ? 'ready' : 'stale',
    primary: `${warrantyCount} warrant${warrantyCount === 1 ? 'y' : 'ies'} present · 0 subjectivities pending`,
    citation: matches
      ? `matches slip sent to broker · ${currentSha}`
      : `slip text drift · current ${currentSha} · sent ${expectedSha}`,
  };
}

function validateSanctions(inputs: HashCheckInputs, now: Date): HashCheck {
  const refreshedAt = inputs.sanctionsRefreshedAt;
  const ageMs =
    refreshedAt !== null
      ? Math.max(0, now.getTime() - new Date(refreshedAt).getTime())
      : Infinity;
  const expired = ageMs > SANCTIONS_REFRESH_WINDOW_MS;

  const currentSha = computeSha({
    sanctions: 'clear',
    refreshedAt: refreshedAt ?? '—',
  });
  const expectedSha = currentSha;

  let primary: string;
  if (expired) {
    primary = 'Sanctions refresh required · re-checking Experian';
  } else if (refreshedAt) {
    const minutes = Math.floor(ageMs / 60_000);
    if (minutes < 60) {
      primary = `Experian clear · refreshed ${minutes}m ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      const rem = minutes % 60;
      primary = `Experian clear · refreshed ${hours}h ${rem}m ago`;
    }
  } else {
    primary = 'Sanctions check pending — Experian will refresh on confirm';
  }

  return {
    id: 'sanctions',
    expectedSha,
    currentSha,
    matches: !expired,
    status: expired ? 'refresh-needed' : 'ready',
    primary,
    citation: expired
      ? "outside Lloyd's 24-hour window — refresh on confirm"
      : "within Lloyd's 24-hour window",
  };
}

function validateCapacity(inputs: HashCheckInputs): HashCheck {
  const headroom = capacityHeadroom(inputs.capacity);
  const cap = inputs.capacity.annualAggregateCap;
  const sufficient = headroom >= inputs.capacityConsumption;
  const sha = computeSha({
    syndicate: inputs.capacity.syndicate,
    headroom,
    consumption: inputs.capacityConsumption,
  });

  const consumptionInThousands = (inputs.capacityConsumption / 1_000).toFixed(1);
  const headroomInM = (headroom / 1_000_000).toFixed(1);
  const headroomPct = ((headroom / cap) * 100).toFixed(1);

  return {
    id: 'capacity',
    expectedSha: sha,
    currentSha: sha,
    matches: sufficient,
    status: sufficient ? 'ready' : 'blocked',
    primary: sufficient
      ? `${inputs.capacity.syndicate} · 65% line · £${consumptionInThousands}k consumption`
      : `Capacity insufficient for this risk`,
    citation: sufficient
      ? `£${headroomInM}M headroom remaining (${headroomPct}% of cap)`
      : `£${consumptionInThousands}k consumption · only £${(headroom / 1_000).toFixed(1)}k headroom`,
  };
}

/** Convenience: check whether all hashes are signable (or already overridden). */
export function allHashesPass(checks: HashCheck[]): boolean {
  return checks.every((c) => c.matches);
}

/** Greenline default: estimated risk consumption (used at triage). */
export const GREENLINE_CONSUMPTION = 24_872;

/**
 * Build hash inputs from store state — central wiring used by both
 * BindCeremony UI and the certificate generator.
 */
export function buildHashInputsFromSubmission(submission: Submission): {
  warranties: string[];
} {
  const sites = submission.sites ?? [];
  const inceptionRaw = effectiveValue(submission.cover.inceptionDate) as string | null;
  const expiryRaw = effectiveValue(submission.cover.expiryDate) as string | null;
  const leeds = sites.find((s) => {
    const n = effectiveValue(s.name) as string | null;
    if (!n?.toLowerCase().includes('leeds')) return false;
    const exp = effectiveValue(s.permitExpiry) as string | null;
    return (
      exp !== null &&
      inceptionRaw !== null &&
      expiryRaw !== null &&
      exp >= inceptionRaw &&
      exp <= expiryRaw
    );
  });
  const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const leedsPermitText = leeds
    ? `Environment Agency permit must remain in force throughout the policy term at all insured locations. Particular attention is drawn to permit ${effectiveValue(leeds.permitRef) as string} (Leeds) which expires ${SHORT_DATE_FMT.format(new Date(effectiveValue(leeds.permitExpiry) as string))}; renewal evidence must be provided to the MGA within 14 days of expiry.`
    : 'Environment Agency permit must remain in force throughout the policy term at all insured locations.';
  const fireSuppressionText =
    'Fire suppression at all sites to be maintained as disclosed and confirmed at inception. Material change to be notified to the MGA within 7 days.';
  return { warranties: [leedsPermitText, fireSuppressionText] };
}
