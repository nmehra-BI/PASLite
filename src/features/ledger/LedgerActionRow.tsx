import { ArrowUpRight, RotateCcw, Settings2 } from 'lucide-react';
import type { AutonomyAction } from '@/lib/ledger';
import { AtRiskAnnotation } from './AtRiskAnnotation';

const FMT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const GBP = (n: number | null) => (n === null ? '—' : `£${n.toLocaleString('en-GB')}`);
const PCT = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

/**
 * Module 15 — single action row in the class detail view.
 * Editorial register: ⚙ glyph + mono ref + serif insured + italic
 * status; recalled rows get a warn left-border + RECALLED tag.
 */
export function LedgerActionRow({
  action,
  onOpenSubmission,
  onRecall,
}: {
  action: AutonomyAction;
  onOpenSubmission: () => void;
  onRecall?: () => void;
}) {
  const isRecalled = action.recalled;
  const recallableNow =
    !isRecalled && new Date(action.recallExpiresAt).getTime() > Date.now();
  const remainingMin = Math.max(
    0,
    Math.floor(
      (new Date(action.recallExpiresAt).getTime() - Date.now()) / 60_000,
    ),
  );
  const remainingH = Math.floor(remainingMin / 60);
  const remainingM = remainingMin % 60;

  const borderLeft = isRecalled
    ? '2px solid var(--color-warn)'
    : action.atRiskPatterns.length > 0
      ? '2px solid var(--color-warn)'
      : '2px solid transparent';

  return (
    <article
      style={{
        padding: '14px 16px 14px 14px',
        borderLeft,
        borderBottom: '0.5px solid var(--color-rule)',
        background: isRecalled ? 'rgba(195, 153, 79, 0.04)' : 'transparent',
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 16, marginBottom: 6 }}
      >
        <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              fontSize: 13,
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-mono)',
              width: 14,
              display: 'inline-block',
            }}
          >
            <Settings2 size={12} strokeWidth={1.5} style={{ display: 'inline' }} />
          </span>
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-faint)',
            }}
          >
            {action.classId}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--color-ink-soft)',
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            {action.entryRef}
          </span>
          <span
            className="serif"
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {action.insuredName}
          </span>
        </div>
        {isRecalled && (
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-warn)',
              fontWeight: 500,
              flex: '0 0 auto',
            }}
          >
            RECALLED · {recallAge(action.recalledAt)}
          </span>
        )}
      </div>

      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-soft)',
          paddingLeft: 26,
          letterSpacing: '-0.005em',
          lineHeight: 1.55,
        }}
      >
        AI auto-{action.action}ed at {FMT_DATE.format(new Date(action.firedAt))} ·
        confidence {action.confidence.toFixed(2)} · {action.conditionsMet.length} of{' '}
        {action.conditionsMet.length} mustMatch
      </div>

      <div
        className="mono"
        style={{
          paddingLeft: 26,
          marginTop: 4,
          fontSize: 11,
          letterSpacing: '0.04em',
          color: 'var(--color-ink-mute)',
        }}
      >
        Premium: {GBP(action.premium)} · Capacity: {PCT(action.capacityConsumption)} ·
        Broker: {action.brokerHistoryCount} prior · Status:{' '}
        <span style={{ color: 'var(--color-ink-soft)' }}>
          {outcomeLabel(action)}
        </span>
      </div>

      {action.recalled && action.recallReason && (
        <div
          className="serif"
          style={{
            paddingLeft: 26,
            marginTop: 4,
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-mute)',
            lineHeight: 1.5,
          }}
        >
          ↳ recalled by {action.recalledBy ?? '—'} ·{' '}
          &ldquo;{action.recallReason}&rdquo;
        </div>
      )}

      <div style={{ paddingLeft: 26 }}>
        <AtRiskAnnotation patterns={action.atRiskPatterns} />
      </div>

      <div
        className="flex items-center"
        style={{ paddingLeft: 26, marginTop: 10, gap: 8 }}
      >
        <button
          type="button"
          onClick={onOpenSubmission}
          className="serif inline-flex items-center gap-1"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            padding: '4px 10px',
            borderRadius: 'var(--radius-button)',
            border: '0.5px solid var(--color-rule-mid)',
            background: 'transparent',
            color: 'var(--color-ink-mute)',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}
        >
          <ArrowUpRight size={11} strokeWidth={1.5} />
          open submission
        </button>
        {action.atRiskPatterns
          .filter((p) => p.link)
          .map((p) => (
            <a
              key={p.pattern}
              href={p.link!.href}
              className="serif inline-flex items-center gap-1"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 'var(--radius-button)',
                border: '0.5px solid var(--color-rule-mid)',
                background: 'transparent',
                color: 'var(--color-ink-mute)',
                cursor: 'pointer',
                letterSpacing: '-0.005em',
                textDecoration: 'none',
              }}
            >
              <ArrowUpRight size={11} strokeWidth={1.5} />
              {p.link!.label.replace(/^↗\s*/, '')}
            </a>
          ))}
        {recallableNow && onRecall && (
          <button
            type="button"
            onClick={onRecall}
            className="serif inline-flex items-center gap-1"
            style={{
              marginLeft: 'auto',
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-accent)',
              background: 'transparent',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            <RotateCcw size={11} strokeWidth={1.5} />
            Recall ({remainingH}h {remainingM.toString().padStart(2, '0')}m)
          </button>
        )}
      </div>
    </article>
  );
}

function recallAge(at: string | null): string {
  if (!at) return 'just now';
  const ms = Date.now() - new Date(at).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  const min = Math.max(1, Math.floor(ms / 60_000));
  return `${min}m ago`;
}

function outcomeLabel(a: AutonomyAction): string {
  if (a.recalled) return 'recalled · returned to manual review';
  switch (a.outcome) {
    case 'bound':
      return a.policyRef
        ? `bound · ${a.policyRef}`
        : 'bound · policy in force';
    case 'cancelled':
      return 'cancelled';
    case 'declined':
      return 'declined';
    case 'in-flight':
      return 'in-flight · proceeded to next stage';
    case 'ntu':
      return 'NTU · loss recorded';
    case 'renewed':
      return 'renewed · year-2 in force';
    default:
      return a.outcome;
  }
}
