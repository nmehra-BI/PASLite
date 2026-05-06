import { Check, Pencil } from 'lucide-react';
import { useIntake } from '@/features/intake';
import type { ConflictRecord, GapRecord } from '@/store/replay';

const formatPretty = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return `£${v.toLocaleString()}`;
  if (typeof v === 'boolean') return v ? 'present' : 'absent';
  return String(v);
};

const formatStamp = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const fieldName = (path: string) => path.split('.').pop() ?? path;

export function ResolvedConflictRow({
  conflict,
  onReopen,
}: {
  conflict: ConflictRecord;
  /** Tap to re-open the resolution form pre-filled with the prior choice. */
  onReopen?: (conflictId: string) => void;
}) {
  const openInspector = useIntake((s) => s.openConflictInspector);
  const r = conflict.resolution!;
  const handleClick = () => {
    if (onReopen) onReopen(conflict.id);
    else openInspector(conflict.id);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-baseline gap-3 group"
      title={onReopen ? 'click to revise resolution' : 'click for full provenance'}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        margin: '0 -12px',
        borderRadius: 'var(--radius-button)',
        cursor: 'pointer',
      }}
    >
      <Check
        size={13}
        strokeWidth={1.75}
        style={{ color: 'var(--color-success)', alignSelf: 'center' }}
      />
      <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>
        <span style={{ fontWeight: 500 }}>
          {capitalize(fieldName(conflict.fieldPath))}
        </span>{' '}
        · resolved at{' '}
        <span className="mono">{formatPretty(r.value)}</span>
      </span>
      <span style={{ flex: 1 }} />
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-mute)',
        }}
      >
        &ldquo;{r.reason}&rdquo;
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--color-ink-faint)',
          letterSpacing: '0.04em',
        }}
      >
        {r.resolvedBy} · {formatStamp(r.resolvedAt)}
      </span>
      {onReopen && (
        <Pencil
          size={11}
          strokeWidth={1.5}
          style={{
            color: 'var(--color-ink-faint)',
            alignSelf: 'center',
            opacity: 0.6,
          }}
        />
      )}
    </button>
  );
}

export function ResolvedGapRow({ gap }: { gap: GapRecord }) {
  const r = gap.resolution!;
  const choiceLabel =
    r.choice === 'present'
      ? 'present'
      : r.choice === 'absent'
        ? 'absent'
        : 'requested from broker';
  return (
    <div
      className="flex items-baseline gap-3"
      style={{ padding: '8px 0' }}
    >
      <Check
        size={13}
        strokeWidth={1.75}
        style={{ color: 'var(--color-success)', alignSelf: 'center' }}
      />
      <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>
        <span style={{ fontWeight: 500 }}>{capitalize(fieldName(gap.fieldPath))}</span>{' '}
        · {choiceLabel}
      </span>
      <span style={{ flex: 1 }} />
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-mute)',
        }}
      >
        &ldquo;{r.reason}&rdquo;
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--color-ink-faint)',
          letterSpacing: '0.04em',
        }}
      >
        {r.resolvedBy} · {formatStamp(r.resolvedAt)}
      </span>
      {gap.requestSent && (
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11,
            color: 'var(--color-accent)',
          }}
        >
          email queued
        </span>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, ' $1');
}
