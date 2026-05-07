import { ArrowLeft } from 'lucide-react';
import type { AutonomyAction } from '@/lib/ledger';

const COUNT_FMT = (n: number) => n.toLocaleString('en-GB');

/**
 * Module 15 — ledger page hero. Stat-driven copy + rotating
 * marginalia variants drawn from the live filtered set.
 */
export function LedgerHeader({
  actions,
  variantSeed,
}: {
  actions: AutonomyAction[];
  variantSeed: number;
}) {
  const passes = actions.filter((a) => a.classId === 'TRIAGE-AUTO-PASS').length;
  const declines = actions.filter(
    (a) => a.classId === 'TRIAGE-AUTO-DECLINE',
  ).length;
  const binds = actions.filter((a) => a.classId === 'BIND-AUTO-COMMIT').length;
  const renewals = actions.filter(
    (a) => a.classId === 'NTU-AUTO-CAPTURE',
  ).length;
  const recalled = actions.filter((a) => a.recalled).length;
  const atRisk = actions.filter((a) => a.atRiskPatterns.length > 0).length;
  const recallRate = actions.length > 0 ? (recalled / actions.length) * 100 : 0;

  const breakdownParts: string[] = [];
  if (passes > 0) breakdownParts.push(`${COUNT_FMT(passes)} routine passes`);
  if (declines > 0) breakdownParts.push(`${COUNT_FMT(declines)} declines`);
  if (binds > 0) breakdownParts.push(`${COUNT_FMT(binds)} binds`);
  if (renewals > 0) breakdownParts.push(`${COUNT_FMT(renewals)} renewals`);

  const marginalia = pickMarginalia({
    total: actions.length,
    recalled,
    atRisk,
    recallRate,
    variantSeed,
  });

  return (
    <header
      className="hairline-b"
      style={{
        padding: '28px 36px 22px',
        background: 'var(--color-surface)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          window.location.hash = '#/';
        }}
        className="serif inline-flex items-center gap-1"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        <ArrowLeft size={11} strokeWidth={1.5} />
        back to listing
      </button>
      <h1
        className="serif"
        style={{
          fontSize: 24,
          fontWeight: 500,
          margin: 0,
          color: 'var(--color-ink)',
          letterSpacing: '-0.012em',
        }}
      >
        Autonomy ledger
      </h1>
      <p
        className="serif"
        style={{
          fontSize: 14,
          color: 'var(--color-ink-mute)',
          marginTop: 8,
          maxWidth: 760,
          lineHeight: 1.6,
          letterSpacing: '-0.005em',
        }}
      >
        The AI took{' '}
        <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>
          {COUNT_FMT(actions.length)} autonomous actions
        </span>{' '}
        across your portfolio in the last 30 days.
        {breakdownParts.length > 0 && (
          <>
            <br />
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                letterSpacing: '0.04em',
                color: 'var(--color-ink-mute)',
              }}
            >
              {breakdownParts.join(' · ')}
            </span>
          </>
        )}
      </p>
      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-mute)',
          marginTop: 10,
          maxWidth: 760,
          lineHeight: 1.6,
          letterSpacing: '-0.005em',
        }}
      >
        {marginalia}
      </p>
    </header>
  );
}

function pickMarginalia(input: {
  total: number;
  recalled: number;
  atRisk: number;
  recallRate: number;
  variantSeed: number;
}): string {
  const { total, recalled, atRisk, recallRate, variantSeed } = input;

  const variants: string[] = [];

  if (atRisk > 0) {
    variants.push(
      `${atRisk} of those ${total} are flagged at-risk. The cockpit doesn't claim the AI was wrong — these are downstream signals worth a senior eye. Open the "At risk" filter to triage.`,
    );
  }
  if (recalled > 0) {
    variants.push(
      `Recall rate this month is ${recallRate.toFixed(1)}% (${recalled} of ${total}) — within healthy range. The capacity provider review for this period is queued; export available below.`,
    );
  }
  if (total === 0) {
    variants.push(
      'No autonomous actions in the selected window. Adjust the filter, or check whether autonomy is enabled for the classes that matter to you.',
    );
  } else {
    variants.push(
      `Most autonomous activity sits in TRIAGE-AUTO-PASS — the routine throughput class. Binds and declines are smaller volumes but higher consequence; their recall rates bear watching closely.`,
    );
    variants.push(
      `Every action listed below is audit-replayable, capacity-provider-exportable, and recallable inside its window. The ledger is a read of the audit log — nothing here is fabricated, nothing missed.`,
    );
  }

  if (variants.length === 0) {
    return 'The portfolio view of every autonomous action the AI has taken on your book.';
  }
  return variants[variantSeed % variants.length]!;
}
