import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useRanBerri } from '@/store';
import {
  buildAndEmitYear1Review,
  recordYear1Claims,
  triggerRenewal,
} from '@/lib/renewal';

/**
 * Module 11 — demo trigger for the renewal workflow. Lives on the
 * post-bind canvas; clicking fires the renewal trigger event,
 * records the year-1 claims that have accumulated since bind, and
 * builds the year-1 review. Hidden once renewal is in progress or
 * already committed.
 */
export function RenewalIntakeButton() {
  const bind = useRanBerri((s) => s.bind);
  const renewal = useRanBerri((s) => s.renewal);
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const [running, setRunning] = useState(false);

  if (bind.phase !== 'committed') return null;
  if (cursor !== now) return null; // not actionable in historical scrub
  if (renewal.phase !== 'idle') return null;

  async function onTrigger() {
    if (running) return;
    setRunning(true);
    try {
      triggerRenewal({ daysToExpiry: 90 });
      // Record the year-1 claims that accumulated under the policy,
      // then build the year-1 review off the (now-complete) audit log.
      recordYear1Claims();
      // Small pause so the trigger event lands before we project the
      // review off the log — keeps the cinematic intelligible.
      await new Promise((r) => setTimeout(r, 220));
      buildAndEmitYear1Review();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        margin: '14px 28px 0',
        padding: '12px 16px',
        borderRadius: 'var(--radius-card)',
        border: '0.5px dashed var(--color-rule-mid)',
        background: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
          }}
        >
          renewal · year 2
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          demo · 90 days to expiry · trigger the year-2 succession workflow
        </span>
      </div>
      <button
        type="button"
        onClick={onTrigger}
        disabled={running}
        className="inline-flex items-center gap-1.5"
        style={{
          padding: '6px 12px',
          borderRadius: 'var(--radius-button)',
          fontFamily: 'var(--font-sans)',
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--color-bg)',
          background: running ? 'var(--color-ink-faint)' : 'var(--color-accent)',
          border: '0.5px solid var(--color-accent)',
          cursor: running ? 'wait' : 'pointer',
        }}
      >
        <CalendarClock size={11} strokeWidth={1.75} />
        Receive renewal trigger
      </button>
    </div>
  );
}
