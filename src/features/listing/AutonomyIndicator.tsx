import { useAutonomy } from '@/store/autonomy';

type Status = 'acted-upon' | 'exception' | 'eligible' | null;

/**
 * Module 14 — autonomy indicator for listing rows.
 *
 * Shows the cockpit's autonomy stance for a row at a glance:
 *   • acted-upon — AI fired an autonomous action; in recall window
 *   • exception  — AI flagged this for human review
 *   • eligible   — would be auto-acted if policy were enabled
 * Returns null when there is nothing to say.
 */
export function AutonomyIndicator({ entryRef }: { entryRef: string }) {
  const fired = useAutonomy((s) => s.firedByRef[entryRef]);
  const exception = useAutonomy((s) =>
    s.exceptions.find((e) => e.entryRef === entryRef),
  );

  let status: Status = null;
  let label = '';
  let title = '';
  let color = 'var(--color-ink-faint)';

  if (fired) {
    status = 'acted-upon';
    label = `auto · ${fired.action.toUpperCase()}`;
    title = `Cockpit acted autonomously (${fired.classId}). Recall available until ${new Date(fired.recallExpiresAt).toLocaleString('en-GB')}.`;
    color = 'var(--color-accent)';
  } else if (exception) {
    status = 'exception';
    label = 'in queue';
    title = `Flagged for review · ${exception.reason}`;
    color = 'var(--color-warn)';
  }

  if (!status) return null;

  return (
    <span
      className="mono inline-flex items-center gap-1"
      title={title}
      style={{
        fontSize: 9.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
        padding: '1px 6px',
        borderRadius: 'var(--radius-pill)',
        border: `0.5px solid ${color}`,
        fontWeight: 500,
      }}
    >
      <span aria-hidden style={{ fontSize: 10 }}>
        ⚡
      </span>
      {label}
    </span>
  );
}
