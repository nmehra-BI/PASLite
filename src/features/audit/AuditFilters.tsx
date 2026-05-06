import type { AuditEventKind } from '@/lib/audit';

export type AuditFilterKey =
  | 'all'
  | 'extraction'
  | 'corrections'
  | 'resolutions'
  | 'hashes'
  | 'bind'
  | 'mta'
  | 'cancellation';

const FILTER_LABELS: Array<{ key: AuditFilterKey; label: string }> = [
  { key: 'all', label: 'all events' },
  { key: 'extraction', label: 'extraction' },
  { key: 'corrections', label: 'corrections' },
  { key: 'resolutions', label: 'resolutions' },
  { key: 'hashes', label: 'hashes' },
  { key: 'bind', label: 'bind events' },
  { key: 'mta', label: 'mta events' },
  { key: 'cancellation', label: 'cancellation' },
];

export function eventMatchesFilter(
  kind: AuditEventKind,
  filter: AuditFilterKey,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'extraction') return kind.startsWith('extraction.');
  if (filter === 'corrections') {
    return (
      kind === 'field.corrected' ||
      kind === 'triage.checkOverridden' ||
      kind === 'bind.hashOverridden'
    );
  }
  if (filter === 'resolutions') {
    return (
      kind === 'conflict.resolved' ||
      kind === 'gap.resolved' ||
      kind === 'conflict.dismissed' ||
      kind === 'gap.dismissed' ||
      kind === 'gap.requestSent'
    );
  }
  if (filter === 'hashes') {
    return (
      kind === 'bind.hashConfirmed' ||
      kind === 'bind.hashFailed' ||
      kind === 'bind.hashOverridden' ||
      kind === 'mta.hashConfirmed' ||
      kind === 'mta.hashOverridden' ||
      kind === 'cancellation.hashConfirmed' ||
      kind === 'cancellation.hashOverridden'
    );
  }
  if (filter === 'bind') return kind.startsWith('bind.') || kind.startsWith('schedule.');
  if (filter === 'mta') return kind.startsWith('mta.');
  if (filter === 'cancellation') {
    return (
      kind.startsWith('cancellation.') ||
      kind === 'bordereau.entryWritten' ||
      kind === 'competitor.switchRecorded'
    );
  }
  return false;
}

type Props = {
  active: AuditFilterKey;
  onChange: (next: AuditFilterKey) => void;
};

export function AuditFilters({ active, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap"
      style={{ gap: 6 }}
    >
      {FILTER_LABELS.map((f) => {
        const isActive = active === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '3px 9px',
              borderRadius: 'var(--radius-pill)',
              background: isActive
                ? 'var(--color-ink)'
                : 'var(--color-sunken)',
              color: isActive ? 'var(--color-bg)' : 'var(--color-ink-mute)',
              border: '0.5px solid transparent',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
