import { useRanBerri } from '@/store';
import { DecisionTrail, LifecycleRibbon, TopBar } from '@/features/lifecycle';
import { QueueRail } from '@/features/queue';
import {
  ExtractionSequence,
  IntakeButton,
  runExtraction,
  useIntake,
} from '@/features/intake';
import { TerminalBanner } from '@/features/triage';
import { QuoteSentBanner } from '@/features/quote';
import { PendingActionBanner } from '@/features/recommendation';
import { StalenessBanner } from '@/components';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useState } from 'react';

/**
 * The workstation. Full viewport, no document-style scrolling.
 * Persistent left queue + right decision trail; the canvas in the
 * middle is the work surface and swaps content by phase:
 *
 *   intake idle              → IntakeButton (centered)
 *   receiving/reading/etc.   → ExtractionSequence (split layout)
 */
export function Cockpit() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        overflow: 'hidden',
      }}
    >
      <TopBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <QueueRail />
        <CanvasColumn />
        <DecisionTrail side="right" />
      </div>
    </div>
  );
}

function CanvasColumn() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: 'var(--color-bg)',
      }}
    >
      <CanvasSubject />
      <RibbonBand />
      <TerminalBanner />
      <QuoteSentBanner />
      <PendingActionBanner />
      <StalenessBanner />
      <CanvasBody />
    </main>
  );
}

function CanvasSubject() {
  const submission = useRanBerri((s) => s.submission);
  const submissionState = useRanBerri((s) => s.submissionState);
  const mode = useRanBerri((s) => s.ui.canvasMode);
  const setMode = useRanBerri((s) => s.setCanvasMode);
  const phase = useIntake((s) => s.phase);
  const [rerunning, setRerunning] = useState(false);
  const isActive = submissionState === 'active';

  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{
        height: 44,
        padding: '0 22px',
        background: 'var(--color-surface)',
        flex: '0 0 auto',
      }}
    >
      <div className="flex items-baseline gap-3">
        <span className="eyebrow">risk canvas</span>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 0.5,
            height: 12,
            background: 'var(--color-rule-mid)',
          }}
        />
        <span
          className="serif"
          style={{
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '-0.012em',
            color: 'var(--color-ink)',
          }}
        >
          {submission ? 'Greenline Recycling Ltd' : 'No risk active'}
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-ink-mute)',
          }}
        >
          {submission
            ? phase === 'complete'
              ? 'extraction settled'
              : 'one canvas per risk'
            : 'awaiting submission from queue'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {submission && phase === 'complete' && isActive && (
          <button
            type="button"
            onClick={async () => {
              if (rerunning) return;
              setRerunning(true);
              try {
                await runExtraction({ rerun: true });
              } finally {
                setRerunning(false);
              }
            }}
            disabled={rerunning}
            className="inline-flex items-center gap-1.5"
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 12.5,
              color: rerunning ? 'var(--color-ink-faint)' : 'var(--color-accent)',
            }}
          >
            <RotateCcw size={11} strokeWidth={1.5} />
            <span>rerun extraction</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          <ModeButton
            active={mode === 'compact'}
            onClick={() => setMode('compact')}
            title="Compact"
          >
            <Minimize2 size={13} strokeWidth={1.5} />
          </ModeButton>
          <ModeButton
            active={mode === 'expanded'}
            onClick={() => setMode('expanded')}
            title="Expanded"
          >
            <Maximize2 size={13} strokeWidth={1.5} />
          </ModeButton>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className="inline-flex items-center justify-center"
      style={{
        width: 24,
        height: 22,
        borderRadius: 'var(--radius-button)',
        background: active ? 'var(--color-sunken)' : 'transparent',
        color: active ? 'var(--color-ink)' : 'var(--color-ink-mute)',
      }}
    >
      {children}
    </button>
  );
}

function RibbonBand() {
  return (
    <div
      className="hairline-b"
      style={{
        background: 'var(--color-surface)',
        padding: '14px 28px 12px',
        flex: '0 0 auto',
      }}
    >
      <LifecycleRibbon compact />
    </div>
  );
}

function CanvasBody() {
  const phase = useIntake((s) => s.phase);
  if (phase === 'idle') {
    return (
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <IntakeButton />
      </div>
    );
  }
  return <ExtractionSequence />;
}
