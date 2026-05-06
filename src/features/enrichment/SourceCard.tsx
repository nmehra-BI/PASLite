import { motion } from 'framer-motion';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { SourceMeta } from '@/lib/fixtures';
import type { SourceStatus } from '@/store/replay';
import { useIntake } from '@/features/intake';

type Props = {
  meta: SourceMeta;
  status: SourceStatus | undefined;
  /** Optional flash on first return (used to draw attention to a conflict). */
  flashOnReturn?: boolean;
};

/**
 * One row in the source list during the cinematic. Stays visible after
 * settlement; tap opens the inspector with the raw payload.
 */
export function SourceCard({ meta, status, flashOnReturn = false }: Props) {
  const openSource = useIntake((s) => s.openSourceInspector);
  const verdict = status?.result?.verdict ?? null;
  const summary = status?.result?.summary ?? null;
  const isQuerying = status?.status === 'querying' || !status;
  const isReturned = status?.status === 'returned';

  const tone =
    verdict === 'conflict'
      ? 'warn'
      : verdict === 'confirmed' || verdict === 'no-prior'
        ? 'success'
        : 'neutral';

  const stamp = status?.returnedAt
    ? new Date(status.returnedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <motion.button
      type="button"
      onClick={() => isReturned && openSource(meta.id)}
      initial={false}
      animate={
        flashOnReturn && verdict === 'conflict'
          ? {
              backgroundColor: [
                'rgba(0,0,0,0)',
                'rgba(140, 90, 20, 0.18)',
                'rgba(0,0,0,0)',
              ],
            }
          : { backgroundColor: 'rgba(0,0,0,0)' }
      }
      transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 160px 1fr auto',
        gap: 14,
        alignItems: 'baseline',
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        margin: '0 -12px',
        borderRadius: 'var(--radius-button)',
        cursor: isReturned ? 'pointer' : 'default',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 16 }}>
        {isQuerying ? (
          <Loader2
            size={12}
            strokeWidth={1.5}
            className="animate-spin"
            style={{ color: 'var(--color-ink-faint)' }}
          />
        ) : verdict === 'conflict' ? (
          <AlertTriangle
            size={12}
            strokeWidth={1.75}
            style={{ color: 'var(--color-warn)' }}
          />
        ) : (
          <Check
            size={13}
            strokeWidth={1.75}
            style={{ color: 'var(--color-success)' }}
          />
        )}
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        {meta.name}
      </span>
      <span
        className="serif"
        style={{
          fontStyle: isQuerying ? 'italic' : 'normal',
          fontSize: 13,
          color:
            tone === 'warn'
              ? 'var(--color-warn)'
              : tone === 'success'
                ? 'var(--color-ink-soft)'
                : 'var(--color-ink-mute)',
        }}
      >
        {isQuerying ? 'querying…' : (summary ?? '—')}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--color-ink-faint)',
          letterSpacing: '0.06em',
        }}
      >
        {stamp ? `${meta.service} · ${stamp}` : meta.service}
      </span>
    </motion.button>
  );
}
