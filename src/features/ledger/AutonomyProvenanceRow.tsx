import type { AutonomyAction } from '@/lib/ledger';

const FMT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const ACTION_HEADLINES: Record<string, string> = {
  pass: 'Auto-passed triage',
  decline: 'Auto-declined',
  bind: 'Auto-bound',
  ntu: 'Auto-recorded NTU',
  'resolve-conflict': 'Auto-resolved conflict',
  'resolve-gap': 'Auto-resolved gap',
  refer: 'Auto-referred',
};

/**
 * Module 15 — single autonomy action row inside the per-policy
 * provenance panel. Compact treatment: headline, timestamp, recall
 * status, downstream pointer.
 */
export function AutonomyProvenanceRow({ action }: { action: AutonomyAction }) {
  const headline = ACTION_HEADLINES[action.action] ?? `Auto-${action.action}`;
  const isRecalled = action.recalled;
  const recallExpired =
    !isRecalled && new Date(action.recallExpiresAt).getTime() < Date.now();

  const recallLine = isRecalled
    ? `recalled by ${action.recalledBy ?? '—'}${
        action.recalledAt
          ? ` at ${FMT_DATE.format(new Date(action.recalledAt))}`
          : ''
      } · "${action.recallReason ?? '—'}"`
    : recallExpired
      ? 'recall window closed · final'
      : `recall window open · ${action.classId}`;

  const downstream = action.recalled
    ? '↳ Submission then proceeded to manual review'
    : action.outcome === 'bound' && action.policyRef
      ? `↳ ${action.policyRef} in force`
      : action.outcome === 'cancelled'
        ? '↳ Policy cancelled'
        : action.outcome === 'declined'
          ? '↳ Submission declined'
          : '↳ In-flight';

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-button)',
        border: '0.5px solid var(--color-rule-mid)',
        background: 'var(--color-surface)',
        borderLeft: isRecalled
          ? '2px solid var(--color-warn)'
          : '2px solid var(--color-accent)',
      }}
    >
      <div
        className="serif"
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        ⚙ {headline}
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-mute)',
          marginTop: 3,
          letterSpacing: '-0.005em',
          lineHeight: 1.55,
        }}
      >
        {FMT_DATE.format(new Date(action.firedAt))} · {action.classId} ·
        confidence {action.confidence.toFixed(2)}
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: isRecalled ? 'var(--color-warn)' : 'var(--color-ink-mute)',
          marginTop: 3,
          letterSpacing: '-0.005em',
          lineHeight: 1.5,
        }}
      >
        {recallLine}
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-faint)',
          marginTop: 3,
          letterSpacing: '-0.005em',
        }}
      >
        {downstream}
      </div>
    </div>
  );
}
