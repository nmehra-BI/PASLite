import { describe, it, expect } from 'vitest';
import { getLedgerHistory } from '@/lib/fixtures';
import { applyAtRiskDetection, detectAtRisk } from './detectAtRisk';
import { computeRecallRate } from './computeRecallRate';
import { aggregateByClass } from './aggregateByClass';
import { generateReport, resolvePeriod } from './generateReport';
import { SEED_AUTONOMY_POLICY } from '@/lib/fixtures/autonomyPolicy';
import type { ExportRequest } from './types';

describe('ledger fixture shape', () => {
  it('produces the expected counts per class', () => {
    const all = getLedgerHistory();
    const passes = all.filter((a) => a.classId === 'TRIAGE-AUTO-PASS');
    const declines = all.filter((a) => a.classId === 'TRIAGE-AUTO-DECLINE');
    const binds = all.filter((a) => a.classId === 'BIND-AUTO-COMMIT');
    expect(passes.length).toBe(189);
    expect(declines.length).toBe(47);
    expect(binds.length).toBe(8);
    expect(all.length).toBe(189 + 47 + 8);
  });

  it('includes the seeded recalls and at-risk patterns', () => {
    const all = getLedgerHistory();
    const passes = all.filter((a) => a.classId === 'TRIAGE-AUTO-PASS');
    expect(passes.filter((a) => a.recalled).length).toBe(3);
    const passAtRisk = passes.filter((a) => a.atRiskPatterns.length > 0).length;
    expect(passAtRisk).toBe(2);

    const binds = all.filter((a) => a.classId === 'BIND-AUTO-COMMIT');
    expect(binds.filter((a) => a.recalled).length).toBe(1);
    expect(binds.filter((a) => a.claim !== null).length).toBe(1);
    expect(binds.filter((a) => a.cancelledAt !== null).length).toBe(1);
  });
});

describe('detectAtRisk', () => {
  it('flags a bind followed by a claim within 30 days', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const flagged = all.filter((a) =>
      a.atRiskPatterns.some((p) => p.pattern === 'claim-within-30'),
    );
    expect(flagged.length).toBe(1);
    expect(flagged[0]!.classId).toBe('BIND-AUTO-COMMIT');
  });

  it('flags a bind followed by cancellation within 60 days', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const flagged = all.filter((a) =>
      a.atRiskPatterns.some((p) => p.pattern === 'cancel-within-60'),
    );
    expect(flagged.length).toBe(1);
  });

  it('preserves carried similar-profile-referred patterns', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const flagged = all.filter((a) =>
      a.atRiskPatterns.some((p) => p.pattern === 'similar-profile-referred'),
    );
    expect(flagged.length).toBe(2);
  });

  it('detectAtRisk on a clean action returns no patterns', () => {
    const all = getLedgerHistory();
    const clean = all.find(
      (a) =>
        a.classId === 'TRIAGE-AUTO-PASS' &&
        !a.recalled &&
        a.atRiskPatterns.length === 0,
    )!;
    expect(detectAtRisk(clean)).toEqual([]);
  });
});

describe('computeRecallRate', () => {
  it('matches the fixture seed for TRIAGE-AUTO-PASS', () => {
    const all = getLedgerHistory();
    const passes = all.filter((a) => a.classId === 'TRIAGE-AUTO-PASS');
    const r = computeRecallRate(passes);
    expect(r.total).toBe(189);
    expect(r.recalled).toBe(3);
    expect(r.rate).toBeCloseTo(3 / 189, 6);
  });
});

describe('aggregateByClass', () => {
  it('returns five class summaries in canonical order', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const summaries = aggregateByClass(all, SEED_AUTONOMY_POLICY);
    expect(summaries.map((s) => s.classId)).toEqual([
      'TRIAGE-AUTO-PASS',
      'TRIAGE-AUTO-DECLINE',
      'CONFLICT-AUTO-RESOLVE',
      'BIND-AUTO-COMMIT',
      'NTU-AUTO-CAPTURE',
    ]);
    expect(summaries[0]!.count).toBe(189);
    expect(summaries[2]!.count).toBe(0);
    expect(summaries[2]!.enabled).toBe(false);
    expect(summaries[3]!.count).toBe(8);
  });
});

describe('generateReport', () => {
  it('produces a deterministic chain hash for the same input', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const req: ExportRequest = {
      period: { kind: 'last-30-days' },
      classes: ['TRIAGE-AUTO-PASS', 'BIND-AUTO-COMMIT'],
      format: 'csv',
      recipient: 'capacity-provider',
    };
    const at = new Date('2027-05-09T08:30:00+01:00');
    const r1 = generateReport(all, req, at);
    const r2 = generateReport(all, req, at);
    expect(r1.chainHash).toBe(r2.chainHash);
    expect(r1.actionCount).toBe(r2.actionCount);
  });

  it('CSV includes the bordereau column structure + chain hash footer', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const req: ExportRequest = {
      period: { kind: 'last-30-days' },
      classes: ['BIND-AUTO-COMMIT'],
      format: 'csv',
      recipient: 'capacity-provider',
    };
    const r = generateReport(all, req, new Date('2027-05-09T08:30:00+01:00'));
    const lines = r.body.split('\n');
    expect(lines[0]).toMatch(/RanBerri Autonomy Bordereau/);
    expect(lines[1]).toMatch(/version=1\.0/);
    expect(lines[2]).toContain('action_id');
    expect(lines[2]).toContain('decision_class');
    expect(lines[2]).toContain('chain'.length > 0 ? 'audit_log_url' : '');
    expect(lines[lines.length - 1]).toMatch(/chain_hash/);
  });

  it('JSON format produces a parseable payload with the expected shape', () => {
    const all = applyAtRiskDetection(getLedgerHistory());
    const req: ExportRequest = {
      period: { kind: 'last-7-days' },
      classes: ['TRIAGE-AUTO-PASS'],
      format: 'json',
      recipient: 'mga-archive',
    };
    const r = generateReport(all, req, new Date('2027-05-09T08:30:00+01:00'));
    const parsed = JSON.parse(r.body);
    expect(parsed.report.version).toBe('1.0');
    expect(parsed.report.mga).toBeDefined();
    expect(parsed.report.summary.totalActions).toBe(r.actionCount);
    expect(Array.isArray(parsed.report.actions)).toBe(true);
    expect(parsed.report.chainHash).toBe(r.chainHash);
  });

  it('resolvePeriod for last-7-days returns a 7-day window', () => {
    const now = new Date('2027-05-09T12:00:00Z');
    const { fromISO, toISO } = resolvePeriod({ kind: 'last-7-days' }, now);
    const span = new Date(toISO).getTime() - new Date(fromISO).getTime();
    expect(span).toBe(7 * 86_400_000);
  });
});
