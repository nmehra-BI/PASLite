import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useRanBerri } from '@/store';
import { receiveMtaRequest, runMtaExtraction } from '@/lib/mta';

/**
 * Demo trigger for the inbound Manchester MTA. Lives on the post-bind
 * canvas; clicking loads the fixture, advances submission state to
 * 'mta-pending', and fires the extraction cinematic.
 *
 * Hidden once an MTA workflow is in progress.
 */
export function MtaIntakeButton() {
  const bind = useRanBerri((s) => s.bind);
  const mta = useRanBerri((s) => s.mta);
  const [running, setRunning] = useState(false);

  if (bind.phase !== 'committed') return null;
  if (mta.phase !== 'idle') return null;

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
          mta · inbox
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          mid-term adjustments fire from here · in production this would
          be a polled inbox
        </span>
      </div>
      <button
        type="button"
        disabled={running}
        onClick={async () => {
          if (running) return;
          setRunning(true);
          try {
            receiveMtaRequest();
            await runMtaExtraction({ cinematic: true });
          } finally {
            setRunning(false);
          }
        }}
        className="inline-flex items-center gap-1.5"
        style={{
          padding: '5px 11px',
          borderRadius: 'var(--radius-button)',
          fontFamily: 'var(--font-sans)',
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--color-bg)',
          background: 'var(--color-accent)',
          border: '0.5px solid var(--color-accent)',
        }}
      >
        <Inbox size={11} strokeWidth={1.5} />
        Receive MTA request
      </button>
    </div>
  );
}
