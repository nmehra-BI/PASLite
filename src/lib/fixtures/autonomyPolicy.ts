/**
 * Module 14 — seed autonomy policy.
 *
 * Defines the canonical policy structure: TRIAGE-AUTO-PASS +
 * TRIAGE-AUTO-DECLINE enabled by default; the more consequential
 * CONFLICT-AUTO-RESOLVE, BIND-AUTO-COMMIT, NTU-AUTO-CAPTURE disabled
 * and require explicit underwriter + capacity-provider sign-off.
 *
 * The `approvedBy` strings (capacity provider, MGA owner) are tenant
 * metadata. They default to the W&R values for backward compatibility
 * but can be overridden by passing options to getSeedAutonomyPolicy()
 * — the W&R tenant config calls this with its own metadata so the
 * policy round-trips through config without a circular import.
 */

import type { AutonomyPolicy } from '@/lib/autonomy/types';

export type SeedAutonomyPolicyOptions = {
  capacityProvider?: string;
  mgaOwner?: string;
};

const DEFAULT_CAPACITY_PROVIDER = 'Syndicate 2358';
const DEFAULT_MGA_OWNER = 'RanBerri Operations';

export const SEED_AUTONOMY_POLICY: AutonomyPolicy = {
  version: 'v1.0 · 2026-05-09',
  approvedBy: {
    capacityProvider: DEFAULT_CAPACITY_PROVIDER,
    mgaOwner: DEFAULT_MGA_OWNER,
    effectiveDate: '2026-05-09T00:00:00+01:00',
    expiresAt: '2027-05-09T00:00:00+01:00',
  },
  decisionClasses: {
    'TRIAGE-AUTO-PASS': {
      id: 'TRIAGE-AUTO-PASS',
      label: 'Auto-pass triage',
      description:
        'Auto-pass triage when AI confidence is high, premium is in band, capacity headroom is healthy, and the broker has a track record.',
      enabled: true,
      autonomyBands: {
        mustMatch: {
          confidenceMin: 0.95,
          premiumRangeMax: 50_000,
          capacityConsumptionMax: 0.10,
          brokerHistoryMin: 3,
        },
        cannotExceed: {
          sanctionsAlertLevelMax: 'clear',
          anyOverrideRequired: true,
        },
      },
      autonomousAction: 'pass',
      notifyUnderwriter: 'on-action',
      recallWindowHours: 4,
    },
    'TRIAGE-AUTO-DECLINE': {
      id: 'TRIAGE-AUTO-DECLINE',
      label: 'Auto-decline triage',
      description:
        'Auto-decline when triage clearly fails on appetite — outside LOB, geographic exclusion, sanctions hit. Higher confidence threshold required for terminal action.',
      enabled: true,
      autonomyBands: {
        mustMatch: {
          confidenceMin: 0.99,
          appetiteFailureCategorical: true,
        },
      },
      autonomousAction: 'decline',
      notifyUnderwriter: 'on-action',
      recallWindowHours: 24,
    },
    'CONFLICT-AUTO-RESOLVE': {
      id: 'CONFLICT-AUTO-RESOLVE',
      label: 'Auto-resolve conflicts',
      description:
        'Auto-resolve routine conflicts: timing-mismatches, trivial £-amount mismatches, well-understood data-source lag. Off by default — enable only with explicit sign-off.',
      enabled: false,
      autonomyBands: {
        mustMatch: {
          conflictType: 'timing-mismatch',
          gapAmountAbs: 1_000_000,
          gapAmountPercent: 0.10,
          sourceConfidenceMin: 0.97,
        },
      },
      autonomousAction: 'resolve-conflict',
      notifyUnderwriter: 'always',
      recallWindowHours: 4,
    },
    'BIND-AUTO-COMMIT': {
      id: 'BIND-AUTO-COMMIT',
      label: 'Auto-commit bind',
      description:
        'Auto-bind when recommendation is BIND with high confidence, premium is sub-£30k, capacity headroom > 20%, profile match strong, broker is well-known. The highest-stakes autonomy class — capacity provider sign-off required.',
      enabled: false,
      autonomyBands: {
        mustMatch: {
          confidenceMin: 0.97,
          premiumRangeMax: 30_000,
          capacityConsumptionMax: 0.05,
          profileMatchMin: 5,
          lossesAvgMax: 0.45,
          brokerHistoryMin: 10,
        },
        cannotExceed: {
          anyConflictUnresolved: true,
          anyGapUnresolved: true,
          anyOverrideRequired: true,
          capacityHeadroomBelow: 0.20,
        },
      },
      autonomousAction: 'bind',
      notifyUnderwriter: 'always',
      recallWindowHours: 12,
      maxPerDay: 5,
      maxPerMonth: 50,
    },
    'NTU-AUTO-CAPTURE': {
      id: 'NTU-AUTO-CAPTURE',
      label: 'Auto-capture NTU',
      description:
        'Auto-trigger NTU loss-capture when broker explicitly confirms loss to a known competitor with confirmed pricing.',
      enabled: false,
      autonomyBands: {
        mustMatch: {
          brokerExplicitlyConfirmedNTU: true,
          competitorIdentifiedFromKnownList: true,
          competitorPriceConfirmed: true,
        },
      },
      autonomousAction: 'ntu',
      notifyUnderwriter: 'on-action',
      recallWindowHours: 24,
    },
  },
};

export function getSeedAutonomyPolicy(
  opts?: SeedAutonomyPolicyOptions,
): AutonomyPolicy {
  const cloned = JSON.parse(JSON.stringify(SEED_AUTONOMY_POLICY)) as AutonomyPolicy;
  if (opts?.capacityProvider) cloned.approvedBy.capacityProvider = opts.capacityProvider;
  if (opts?.mgaOwner) cloned.approvedBy.mgaOwner = opts.mgaOwner;
  return cloned;
}
