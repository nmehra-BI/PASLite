/**
 * Module 15 — capacity-provider export.
 *
 * Two formats: Lloyd's bordereau-style CSV (the contractual artifact)
 * and Anthropic-friendly JSON (richer audit trail). Both are pure
 * string builders — generation is deterministic for a given input
 * action list.
 *
 * Cryptographic chain hash: a sha-7 over the concatenated action IDs
 * + period bounds, deterministic and reproducible. This is the audit
 * tie-back the capacity provider uses to verify the export wasn't
 * tampered with after issuance.
 */

import { computeSha } from '@/lib/bind';
import type {
  AutonomyAction,
  ExportPeriod,
  ExportRequest,
  GeneratedReport,
} from './types';

const MGA_NAME = 'RanBerri Operations';
const CAPACITY_PROVIDER = 'Syndicate 2358';
const REPORT_VERSION = '1.0';

export function resolvePeriod(period: ExportPeriod, now: Date = new Date()): {
  fromISO: string;
  toISO: string;
} {
  const DAY_MS = 86_400_000;
  if (period.kind === 'last-7-days') {
    return {
      fromISO: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
      toISO: now.toISOString(),
    };
  }
  if (period.kind === 'last-30-days') {
    return {
      fromISO: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      toISO: now.toISOString(),
    };
  }
  if (period.kind === 'last-calendar-month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const from = new Date(y, m - 1, 1, 0, 0, 0);
    const to = new Date(y, m, 1, 0, 0, 0);
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }
  return { fromISO: period.from, toISO: period.to };
}

export function filterForExport(
  actions: AutonomyAction[],
  request: ExportRequest,
  now: Date = new Date(),
): AutonomyAction[] {
  const { fromISO, toISO } = resolvePeriod(request.period, now);
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return actions.filter((a) => {
    const t = new Date(a.firedAt).getTime();
    if (t < from || t >= to) return false;
    if (request.classes.length > 0 && !request.classes.includes(a.classId)) {
      return false;
    }
    return true;
  });
}

export function generateReport(
  actions: AutonomyAction[],
  request: ExportRequest,
  now: Date = new Date(),
): GeneratedReport {
  const filtered = filterForExport(actions, request, now);
  const { fromISO, toISO } = resolvePeriod(request.period, now);
  const chainHash = computeChainHash(filtered, fromISO, toISO);
  const recallCount = filtered.filter((a) => a.recalled).length;
  const atRiskCount = filtered.filter((a) => a.atRiskPatterns.length > 0).length;

  const filename =
    request.format === 'csv'
      ? `ranberri-autonomy-${slug(fromISO)}-to-${slug(toISO)}.csv`
      : `ranberri-autonomy-${slug(fromISO)}-to-${slug(toISO)}.json`;

  const body =
    request.format === 'csv'
      ? buildCsv(filtered, fromISO, toISO, chainHash, recallCount, atRiskCount, now)
      : buildJson(filtered, fromISO, toISO, chainHash, recallCount, atRiskCount, request, now);

  return {
    format: request.format,
    filename,
    body,
    actionCount: filtered.length,
    recallCount,
    atRiskCount,
    chainHash,
    period: { fromISO, toISO },
    classes: request.classes,
  };
}

function slug(iso: string): string {
  return iso.slice(0, 10);
}

/** sha-7 of a deterministic concatenation. */
function computeChainHash(
  actions: AutonomyAction[],
  fromISO: string,
  toISO: string,
): string {
  const input = `period:${fromISO}->${toISO}|count:${actions.length}|ids:${actions
    .map((a) => a.id)
    .join(',')}`;
  return computeSha({ kind: 'autonomy-ledger-chain', input });
}

const CSV_COLUMNS = [
  'action_id',
  'decision_class',
  'submission_or_policy_ref',
  'insured_name',
  'fired_at',
  'ai_confidence',
  'conditions_met',
  'conditions_not_met',
  'premium_gbp',
  'capacity_consumption_pct',
  'outcome',
  'recall_status',
  'recall_reason',
  'recall_actor',
  'at_risk_pattern',
  'audit_log_url',
];

function buildCsv(
  actions: AutonomyAction[],
  fromISO: string,
  toISO: string,
  chainHash: string,
  recalls: number,
  atRisk: number,
  now: Date,
): string {
  const rows: string[] = [];
  // Row 1: report metadata
  rows.push(
    csvLine([
      `# RanBerri Autonomy Bordereau`,
      `mga=${MGA_NAME}`,
      `capacity_provider=${CAPACITY_PROVIDER}`,
      `period=${fromISO}/${toISO}`,
      `generated_at=${now.toISOString()}`,
    ]),
  );
  // Row 2: report version + provisional signature
  rows.push(
    csvLine([
      `# version=${REPORT_VERSION}`,
      `signature=${chainHash}`,
      `actions=${actions.length}`,
      `recalls=${recalls}`,
      `at_risk=${atRisk}`,
    ]),
  );
  // Row 3: column headers
  rows.push(CSV_COLUMNS.join(','));
  // Data rows
  for (const a of actions) {
    rows.push(
      csvLine([
        a.id,
        a.classId,
        a.policyRef ?? a.entryRef,
        a.insuredName,
        a.firedAt,
        a.confidence.toFixed(3),
        a.conditionsMet.join('; '),
        a.conditionsBlocked.join('; '),
        a.premium !== null ? a.premium.toString() : '',
        a.capacityConsumption !== null
          ? (a.capacityConsumption * 100).toFixed(2)
          : '',
        a.outcome,
        a.recalled ? 'recalled' : isWithinWindow(a) ? 'within-window' : 'final',
        a.recallReason ?? '',
        a.recalledBy ?? '',
        a.atRiskPatterns.map((p) => p.pattern).join('; '),
        `cockpit://audit/${a.entryRef}`,
      ]),
    );
  }
  // Footer rows
  rows.push(
    csvLine([
      `# summary`,
      `total_actions=${actions.length}`,
      `recall_rate=${actions.length > 0 ? ((recalls / actions.length) * 100).toFixed(2) + '%' : '0%'}`,
      `at_risk_count=${atRisk}`,
    ]),
  );
  rows.push(csvLine([`# chain_hash`, chainHash]));
  return rows.join('\n');
}

function buildJson(
  actions: AutonomyAction[],
  fromISO: string,
  toISO: string,
  chainHash: string,
  recalls: number,
  atRisk: number,
  request: ExportRequest,
  now: Date,
): string {
  const payload = {
    report: {
      version: REPORT_VERSION,
      generatedAt: now.toISOString(),
      mga: MGA_NAME,
      capacityProvider: CAPACITY_PROVIDER,
      recipient: request.recipient,
      period: { from: fromISO, to: toISO },
      summary: {
        totalActions: actions.length,
        recalls,
        recallRate:
          actions.length > 0
            ? Number(((recalls / actions.length) * 100).toFixed(2))
            : 0,
        atRisk,
      },
      actions: actions.map((a) => ({
        id: a.id,
        decisionClass: a.classId,
        submission: a.entryRef,
        policy: a.policyRef,
        insured: a.insuredName,
        broker: a.brokerName,
        timestamp: a.firedAt,
        confidence: Number(a.confidence.toFixed(3)),
        conditionsMet: a.conditionsMet,
        conditionsBlocked: a.conditionsBlocked,
        premium: a.premium,
        capacityConsumption: a.capacityConsumption,
        outcome: a.outcome,
        recall: a.recalled
          ? {
              actor: a.recalledBy,
              reason: a.recallReason,
              timestamp: a.recalledAt,
            }
          : null,
        atRiskPatterns: a.atRiskPatterns.map((p) => ({
          pattern: p.pattern,
          description: p.description,
        })),
        auditLogReference: `cockpit://audit/${a.entryRef}`,
      })),
      chainHash,
    },
  };
  return JSON.stringify(payload, null, 2);
}

function csvLine(cells: string[]): string {
  return cells.map(escapeCsv).join(',');
}

function escapeCsv(s: string): string {
  if (s === '') return '';
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isWithinWindow(a: AutonomyAction): boolean {
  return new Date(a.recallExpiresAt).getTime() > Date.now() && !a.recalled;
}
