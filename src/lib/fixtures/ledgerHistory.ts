/**
 * Module 15 — 30-day mock history of autonomous actions.
 *
 * The live autonomy store (module 14) only carries actions for
 * submissions currently being processed in the cockpit. The ledger
 * is portfolio-scale, so it needs a body of historical actions that
 * match the cockpit's narrative time. This fixture supplies them.
 *
 * Counts roughly match the design narrative:
 *   ~189 TRIAGE-AUTO-PASS  (3 recalled, 2 at-risk via similar-profile-referred)
 *   ~47  TRIAGE-AUTO-DECLINE (0 recalled)
 *   ~8   BIND-AUTO-COMMIT (1 recalled, 1 claim-within-30, 1 cancel-within-60)
 *   0    CONFLICT-AUTO-RESOLVE (not enabled in policy)
 *   0    NTU-AUTO-CAPTURE (not enabled in policy)
 *
 * Generation is deterministic — a tiny PRNG keyed off the entryRef
 * fills realistic premium / capacity / broker fields. The same
 * fixture loads identically across page reloads.
 */

import type { ExecutedAutonomousAction } from '@/lib/autonomy/types';
import type {
  AutonomyAction,
  LedgerClaim,
  LedgerOutcomeStatus,
} from '@/lib/ledger/types';

/** Anchor "now" matches the rest of the demo timeline. */
const NOW = new Date('2027-05-09T08:30:00+01:00');

const INSUREDS: Array<{
  ref: string;
  insured: string;
  broker: string;
  brokerHistory: number;
}> = [
  { ref: 'SUB-29503', insured: 'Mooredale Recycling Ltd', broker: 'SureStep Brokers Ltd', brokerHistory: 12 },
  { ref: 'SUB-29501', insured: 'Hartwell Materials Ltd', broker: 'SureStep Brokers Ltd', brokerHistory: 9 },
  { ref: 'SUB-29487', insured: 'Brackmoor Recycling Ltd', broker: 'Pendle & Co', brokerHistory: 8 },
  { ref: 'SUB-29442', insured: 'Northpoint Recovery', broker: 'Marlowe Insurance Brokers', brokerHistory: 5 },
  { ref: 'SUB-29388', insured: 'Pendle Recycling Ltd', broker: 'Caulfield Brokers', brokerHistory: 14 },
  { ref: 'SUB-29345', insured: 'Marlowe Materials', broker: 'SureStep Brokers Ltd', brokerHistory: 11 },
  { ref: 'SUB-29412', insured: 'Eastmoor Recycling', broker: 'SureStep Brokers Ltd', brokerHistory: 4 },
  { ref: 'SUB-29401', insured: 'Caulfield Recovery', broker: 'Caulfield Brokers', brokerHistory: 7 },
  { ref: 'SUB-29377', insured: 'Larksbury Materials', broker: 'Pendle & Co', brokerHistory: 6 },
  { ref: 'SUB-29355', insured: 'Holsworth Recycling Ltd', broker: 'Marlowe Insurance Brokers', brokerHistory: 3 },
  { ref: 'SUB-29320', insured: 'Drayton Salvage Ltd', broker: 'SureStep Brokers Ltd', brokerHistory: 10 },
  { ref: 'SUB-29302', insured: 'Smithwell Industries', broker: 'Pendle & Co', brokerHistory: 5 },
  { ref: 'SUB-29281', insured: 'Pelham Materials', broker: 'Caulfield Brokers', brokerHistory: 8 },
  { ref: 'SUB-29263', insured: 'Findhorn Materials Ltd', broker: 'SureStep Brokers Ltd', brokerHistory: 13 },
  { ref: 'SUB-29245', insured: 'Trevennon Recovery', broker: 'Marlowe Insurance Brokers', brokerHistory: 4 },
  { ref: 'SUB-29215', insured: 'Cromer Salvage Co', broker: 'Pendle & Co', brokerHistory: 6 },
  { ref: 'SUB-29198', insured: 'Vellaby Waste Services', broker: 'Caulfield Brokers', brokerHistory: 9 },
  { ref: 'SUB-29170', insured: 'Brackthorne Industries', broker: 'SureStep Brokers Ltd', brokerHistory: 11 },
];

const DECLINE_INSUREDS: Array<{ ref: string; insured: string; broker: string }> = [
  { ref: 'SUB-29486', insured: 'Whaling Bros Demolition Ltd', broker: 'Marlowe Insurance Brokers' },
  { ref: 'SUB-29463', insured: 'Hazwaste Industrial Co', broker: 'Caulfield Brokers' },
  { ref: 'SUB-29435', insured: 'Riverside Disposal Ltd', broker: 'Pendle & Co' },
  { ref: 'SUB-29418', insured: 'Asbestos Solutions UK', broker: 'SureStep Brokers Ltd' },
  { ref: 'SUB-29384', insured: 'Heavy Metal Recovery', broker: 'Marlowe Insurance Brokers' },
];

const BIND_INSUREDS: Array<{
  ref: string;
  policyRef: string;
  insured: string;
  broker: string;
}> = [
  { ref: 'SUB-29498', policyRef: 'POL-29498', insured: 'Brackmoor Recycling Ltd', broker: 'Pendle & Co' },
  { ref: 'SUB-29472', policyRef: 'POL-29472', insured: 'Mooredale Recycling Ltd', broker: 'SureStep Brokers Ltd' },
  { ref: 'SUB-29455', policyRef: 'POL-29455', insured: 'Caulfield Recovery', broker: 'Caulfield Brokers' },
  { ref: 'SUB-29438', policyRef: 'POL-29438', insured: 'Northpoint Recovery', broker: 'Marlowe Insurance Brokers' },
  { ref: 'SUB-29421', policyRef: 'POL-29421', insured: 'Pendle Recycling Ltd', broker: 'Caulfield Brokers' },
  { ref: 'SUB-29404', policyRef: 'POL-29404', insured: 'Drayton Salvage Ltd', broker: 'SureStep Brokers Ltd' },
  { ref: 'SUB-29387', policyRef: 'POL-29387', insured: 'Marlowe Materials', broker: 'SureStep Brokers Ltd' },
  { ref: 'SUB-29371', policyRef: 'POL-29371', insured: 'Eastmoor Recycling', broker: 'SureStep Brokers Ltd' },
];

/** Tiny seeded PRNG for deterministic field generation. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashRef(ref: string): number {
  let h = 5381;
  for (let i = 0; i < ref.length; i++) h = (h * 33) ^ ref.charCodeAt(i);
  return h >>> 0;
}

function isoOffset(daysAgo: number, hour: number, minute: number): string {
  const d = new Date(NOW.getTime() - daysAgo * 86_400_000);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const PASS_CONDITIONS = [
  'confidence ≥ 0.95',
  'premium ≤ £50,000',
  'capacity consumption ≤ 10%',
  'broker history ≥ 3',
];
const DECLINE_CONDITIONS = [
  'confidence ≥ 0.99',
  'appetite failure categorical',
];
const BIND_CONDITIONS = [
  'confidence ≥ 0.97',
  'premium ≤ £30,000',
  'capacity consumption ≤ 5%',
  'profile match ≥ 5',
  'cohort avg loss ≤ 45%',
  'broker history ≥ 10',
];

/** Build the 189 TRIAGE-AUTO-PASS actions, spread across 30 days. */
function buildPasses(): AutonomyAction[] {
  const out: AutonomyAction[] = [];
  let count = 0;
  const target = 189;
  // 3 recalls — at index 18, 64, 117
  const recallIndices = new Set([18, 64, 117]);
  // 2 similar-profile-referred at-risk — at index 7, 92
  const atRiskIndices = new Set([7, 92]);
  while (count < target) {
    const insured = INSUREDS[count % INSUREDS.length]!;
    const refSuffix = String(29503 - count).padStart(5, '0');
    const ref = `SUB-${refSuffix}`;
    const rng = mulberry32(hashRef(ref));
    const daysAgo = Math.floor((count / target) * 30);
    const hour = 8 + Math.floor(rng() * 10); // 08–18
    const minute = Math.floor(rng() * 60);
    const firedAt = isoOffset(daysAgo, hour, minute);
    const recallExpiresAt = new Date(
      new Date(firedAt).getTime() + 4 * 3_600_000,
    ).toISOString();
    const isRecalled = recallIndices.has(count);
    const recallReason = isRecalled
      ? [
          'wanted to verify capacity directly with the broker',
          'cohort match looked clean but I want to verify geography manually',
          'broker history shifted recently — manual check first',
        ][count % 3]!
      : null;
    const recalledAt = isRecalled
      ? new Date(new Date(firedAt).getTime() + (30 + Math.floor(rng() * 60)) * 60_000).toISOString()
      : null;

    const premium = 18_000 + Math.floor(rng() * 30_000);
    const capacity = 0.02 + rng() * 0.07;

    const isAtRisk = atRiskIndices.has(count);

    out.push({
      id: `act-pass-${count.toString().padStart(3, '0')}`,
      entryRef: ref,
      insuredName: insured.insured,
      brokerName: insured.broker,
      brokerHistoryCount: insured.brokerHistory,
      classId: 'TRIAGE-AUTO-PASS',
      action: 'pass',
      policyVersion: 'v1.0 · 2026-05-09',
      firedAt,
      conditionsMet: PASS_CONDITIONS,
      conditionsBlocked: [],
      confidence: 0.95 + rng() * 0.04,
      byAi: 'Sonnet',
      recallExpiresAt,
      recalled: isRecalled,
      recalledAt,
      recallReason,
      recalledBy: isRecalled ? 'nm' : null,
      premium,
      capacityConsumption: capacity,
      outcome: isRecalled ? 'in-flight' : pickPassOutcome(rng()),
      policyRef: null,
      cancelledAt: null,
      claim: null,
      atRiskPatterns: isAtRisk
        ? [
            {
              pattern: 'similar-profile-referred',
              description:
                'Similar-profile cohort had 3 of 5 referred by underwriters this week — band may be loose for this segment.',
            },
          ]
        : [],
    });
    count++;
  }
  return out;
}

function pickPassOutcome(r: number): LedgerOutcomeStatus {
  if (r < 0.45) return 'bound';
  if (r < 0.55) return 'declined';
  return 'in-flight';
}

/** Build TRIAGE-AUTO-DECLINE actions — 47 of them, 0 recalled. */
function buildDeclines(): AutonomyAction[] {
  const out: AutonomyAction[] = [];
  for (let i = 0; i < 47; i++) {
    const seed = DECLINE_INSUREDS[i % DECLINE_INSUREDS.length]!;
    const refSuffix = String(29486 - i).padStart(5, '0');
    const ref = `SUB-${refSuffix}-D`;
    const rng = mulberry32(hashRef(ref));
    const daysAgo = Math.floor((i / 47) * 30);
    const hour = 8 + Math.floor(rng() * 10);
    const minute = Math.floor(rng() * 60);
    const firedAt = isoOffset(daysAgo, hour, minute);
    const recallExpiresAt = new Date(
      new Date(firedAt).getTime() + 24 * 3_600_000,
    ).toISOString();
    out.push({
      id: `act-decline-${i.toString().padStart(3, '0')}`,
      entryRef: ref,
      insuredName: seed.insured,
      brokerName: seed.broker,
      brokerHistoryCount: 1 + Math.floor(rng() * 6),
      classId: 'TRIAGE-AUTO-DECLINE',
      action: 'decline',
      policyVersion: 'v1.0 · 2026-05-09',
      firedAt,
      conditionsMet: DECLINE_CONDITIONS,
      conditionsBlocked: [],
      confidence: 0.99 + rng() * 0.009,
      byAi: 'Sonnet',
      recallExpiresAt,
      recalled: false,
      recalledAt: null,
      recallReason: null,
      recalledBy: null,
      premium: null,
      capacityConsumption: null,
      outcome: 'declined',
      policyRef: null,
      cancelledAt: null,
      claim: null,
      atRiskPatterns: [],
    });
  }
  return out;
}

/** Build BIND-AUTO-COMMIT actions — 8 of them, 1 recalled, 1 with
 *  a claim within 30 days, 1 with cancel within 60 days. */
function buildBinds(): AutonomyAction[] {
  const out: AutonomyAction[] = [];
  for (let i = 0; i < 8; i++) {
    const seed = BIND_INSUREDS[i]!;
    const rng = mulberry32(hashRef(seed.ref));
    const daysAgo = 2 + i * 3; // spread across 30 days
    const hour = 9 + Math.floor(rng() * 7);
    const minute = Math.floor(rng() * 60);
    const firedAt = isoOffset(daysAgo, hour, minute);
    const recallExpiresAt = new Date(
      new Date(firedAt).getTime() + 12 * 3_600_000,
    ).toISOString();
    const isRecalled = i === 0;
    const isClaimRisk = i === 1;
    const isCancelRisk = i === 2;
    const recalledAt = isRecalled
      ? new Date(new Date(firedAt).getTime() + 90 * 60_000).toISOString()
      : null;

    const premium = 22_000 + Math.floor(rng() * 7_500);
    const capacity = 0.02 + rng() * 0.025;

    const claim: LedgerClaim | null = isClaimRisk
      ? {
          ref: 'CLM-29472-001',
          category: 'slip-and-trip',
          filedAt: new Date(new Date(firedAt).getTime() + 18 * 86_400_000).toISOString(),
          reserve: 8_200,
        }
      : null;

    const cancelledAt = isCancelRisk
      ? new Date(new Date(firedAt).getTime() + 42 * 86_400_000).toISOString()
      : null;

    const outcome: LedgerOutcomeStatus = isRecalled
      ? 'in-flight'
      : isCancelRisk
        ? 'cancelled'
        : 'bound';

    out.push({
      id: `act-bind-${i.toString().padStart(3, '0')}`,
      entryRef: seed.ref,
      insuredName: seed.insured,
      brokerName: seed.broker,
      brokerHistoryCount: 10 + Math.floor(rng() * 6),
      classId: 'BIND-AUTO-COMMIT',
      action: 'bind',
      policyVersion: 'v1.0 · 2026-05-09',
      firedAt,
      conditionsMet: BIND_CONDITIONS,
      conditionsBlocked: [],
      confidence: 0.97 + rng() * 0.02,
      byAi: 'Sonnet',
      recallExpiresAt,
      recalled: isRecalled,
      recalledAt,
      recallReason: isRecalled ? 'want to verify the cohort margin myself before commit' : null,
      recalledBy: isRecalled ? 'nm' : null,
      premium,
      capacityConsumption: capacity,
      outcome,
      policyRef: isRecalled ? null : seed.policyRef,
      cancelledAt,
      claim,
      atRiskPatterns: [],
    });
  }
  return out;
}

const ALL_ACTIONS: AutonomyAction[] = [
  ...buildPasses(),
  ...buildDeclines(),
  ...buildBinds(),
];

export function getLedgerHistory(): AutonomyAction[] {
  // Deep clone so callers can't mutate the canonical list.
  return JSON.parse(JSON.stringify(ALL_ACTIONS)) as AutonomyAction[];
}

/** Project the fixture rows into ExecutedAutonomousAction shape so
 *  the per-policy provenance panel can use the same code path as the
 *  live autonomy store. Only the 8 BIND-AUTO-COMMIT entries surface
 *  policy refs, so this is the useful subset. */
export function getLedgerHistoryAsExecuted(): Record<
  string,
  ExecutedAutonomousAction
> {
  const out: Record<string, ExecutedAutonomousAction> = {};
  for (const a of ALL_ACTIONS) {
    out[a.entryRef] = {
      entryRef: a.entryRef,
      classId: a.classId,
      action: a.action,
      policyVersion: a.policyVersion,
      firedAt: a.firedAt,
      conditionsMet: a.conditionsMet,
      confidence: a.confidence,
      byAi: a.byAi,
      recallExpiresAt: a.recallExpiresAt,
      recalled: a.recalled,
      recalledAt: a.recalledAt,
      recallReason: a.recallReason,
    };
  }
  return out;
}
