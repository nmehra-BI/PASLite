import { useSyncStatus } from '@/lib/sync';
import type { SyncStatus as SyncStatusValue } from '@/lib/sync';

const TONE: Record<
  SyncStatusValue,
  { color: string; label: string; title: string }
> = {
  disabled: {
    color: 'transparent',
    label: '',
    title: '',
  },
  idle: {
    color: 'var(--color-success)',
    label: 'synced',
    title: 'Cockpit is in sync with paslite-server.',
  },
  connecting: {
    color: 'var(--color-ink-mute)',
    label: 'connecting',
    title: 'Reaching paslite-server…',
  },
  syncing: {
    color: 'var(--color-accent)',
    label: 'syncing',
    title: 'Replaying or pushing events…',
  },
  offline: {
    color: 'var(--color-warn)',
    label: 'offline',
    title:
      'paslite-server unreachable. Cockpit continues local-first; will retry.',
  },
  error: {
    color: 'var(--color-danger)',
    label: 'sync error',
    title: 'Sync layer hit a fatal error. Check server logs.',
  },
};

/**
 * Tiny connection indicator for the cockpit's TopBar. Hidden when
 * sync is disabled (no server configured), so the existing local-
 * only deployment looks identical.
 */
export function SyncStatus() {
  const status = useSyncStatus();
  if (status === 'disabled') return null;
  const tone = TONE[status];

  return (
    <span
      title={tone.title}
      aria-label={`Sync status: ${tone.label}`}
      className="inline-flex items-center"
      style={{
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        background: 'transparent',
        border: '0.5px solid var(--color-rule-mid)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: tone.color,
          // Subtle pulse when actively syncing.
          animation:
            status === 'syncing' ? 'paslite-sync-pulse 1.4s ease-in-out infinite' : undefined,
        }}
      />
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-mute)',
        }}
      >
        {tone.label}
      </span>
      <style>{`
        @keyframes paslite-sync-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}
