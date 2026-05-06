import { Power } from 'lucide-react';
import { useRanBerri } from '@/store';
import {
  captureRunoffClaim,
  computeCancellationRefund,
  receiveCancellationRequest,
} from '@/lib/cancellation';
import { GREENLINE_RUNOFF_CLAIM } from '@/lib/fixtures';

export function CancellationIntakeButton() {
  const bind = useRanBerri((s) => s.bind);
  const cancellation = useRanBerri((s) => s.cancellation);
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  if (bind.phase !== 'committed') return null;
  if (cursor !== now) return null;
  if (cancellation.phase !== 'idle') return null;

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
          cancellation · inbox
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
          mid-term cancellations fire from here
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          receiveCancellationRequest();
          captureRunoffClaim({
            ref: GREENLINE_RUNOFF_CLAIM.ref,
            description: GREENLINE_RUNOFF_CLAIM.description,
            reserveAmount: GREENLINE_RUNOFF_CLAIM.reserveAmount,
            capturedBy: 'nm',
          });
          computeCancellationRefund();
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
        <Power size={11} strokeWidth={1.5} />
        Receive cancellation request
      </button>
    </div>
  );
}
