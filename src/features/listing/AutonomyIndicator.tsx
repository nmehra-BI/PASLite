import { useEffect, useState } from 'react';
import { useAutonomy } from '@/store/autonomy';

type Status = 'acted-upon' | 'exception' | 'scheduled' | null;

/**
 * Module 14 — autonomy indicator for listing rows.
 *
 * Shows the cockpit's autonomy stance for a row at a glance:
 *   • scheduled  — AI will auto-act in N seconds (countdown)
 *   • acted-upon — AI fired an autonomous action; in recall window
 *   • exception  — AI flagged this for human review
 * Returns null when there is nothing to say.
 */
export function AutonomyIndicator({ entryRef }: { entryRef: string }) {
  const scheduled = useAutonomy((s) => s.scheduledByRef[entryRef]);
  const fired = useAutonomy((s) => s.firedByRef[entryRef]);
  const exception = useAutonomy((s) =>
    s.exceptions.find((e) => e.entryRef === entryRef),
  );

  // Tick every second when a countdown is visible.
  const [, force] = useState(0);
  useEffect(() => {
    if (!scheduled) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [scheduled]);

  let status: Status = null;
  let label = '';
  let title = '';
  let color = 'var(--color-ink-faint)';

  if (fired && !fired.recalled) {
    status = 'acted-upon';
    label = `auto · ${fired.action.toUpperCase()}`;
    title = `Cockpit acted autonomously (${fired.classId}). Recall available until ${new Date(fired.recallExpiresAt).toLocaleString('en-GB')}.`;
    color = 'var(--color-accent)';
  } else if (scheduled) {
    const remaining = Math.max(
      0,
      Math.ceil((new Date(scheduled.firesAt).getTime() - Date.now()) / 1000),
    );
    const mm = Math.floor(remaining / 60);
    const ss = String(remaining % 60).padStart(2, '0');
    status = 'scheduled';
    label = mm > 0 ? `auto in ${mm}:${ss}` : `auto in ${ss}s`;
    title = `AI will auto-act on this submission in ${mm}:${ss} (${scheduled.classId}).`;
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
