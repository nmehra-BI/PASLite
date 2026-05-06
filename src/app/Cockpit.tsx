import { useRanBerri } from '@/store';
import {
  DecisionTrail,
  LifecycleRibbon,
  TopBar,
} from '@/features/lifecycle';
import { QueueRail } from '@/features/queue';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * The workstation. Full viewport, no document-style scrolling. Persistent
 * left queue + right decision trail; the canvas in the middle is the work
 * surface.
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
      <CanvasBody />
    </main>
  );
}

function CanvasSubject() {
  const submission = useRanBerri((s) => s.submission);
  const mode = useRanBerri((s) => s.ui.canvasMode);
  const setMode = useRanBerri((s) => s.setCanvasMode);
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
          {submission ? 'one canvas per risk' : 'awaiting submission from queue'}
        </span>
      </div>
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
  const submission = useRanBerri((s) => s.submission);
  if (submission) return <ActiveBody />;
  return <EmptyBody />;
}

function ActiveBody() {
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 28px',
      }}
    >
      <div
        className="hairline"
        style={{
          padding: 16,
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
        }}
      >
        <div className="eyebrow mb-2">canvas body</div>
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            margin: 0,
          }}
        >
          Module&nbsp;2 fills this surface with the broker email, the
          extraction margin, and the sealed slip.
        </p>
      </div>
    </div>
  );
}

function EmptyBody() {
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
      }}
    >
      <div style={{ maxWidth: 560, textAlign: 'left' }}>
        <div className="eyebrow mb-3">no submission active</div>
        <h2
          className="serif"
          style={{
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '-0.018em',
            margin: 0,
            color: 'var(--color-ink)',
            lineHeight: 1.15,
          }}
        >
          The underwriter&rsquo;s{' '}
          <em
            style={{
              fontStyle: 'italic',
              color: 'var(--color-accent)',
              fontWeight: 400,
            }}
          >
            cockpit
          </em>
          , not another orchestration layer.
        </h2>
        <p
          className="serif"
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--color-ink-soft)',
            marginTop: 14,
            marginBottom: 0,
            maxWidth: '54ch',
          }}
        >
          One canvas per risk. AI proposes in the margin. Excel sealed
          underneath. Audit trail as the spine.
        </p>
        <div
          className="hairline-t mt-7 pt-4"
          style={{
            display: 'flex',
            gap: 24,
            color: 'var(--color-ink-mute)',
            fontSize: 12,
          }}
        >
          <Hint
            label="next"
            body={'A broker email arrives in the queue (module 2).'}
          />
          <Hint
            label="then"
            body="Extraction unfolds in the margin; the slip stays sealed."
          />
        </div>
      </div>
    </div>
  );
}

function Hint({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="eyebrow mb-1">{label}</div>
      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}
