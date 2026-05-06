import type { ReactNode } from 'react';
import { useRanBerri } from '@/store';
import { DecisionTrail } from './DecisionTrail';
import { Pill } from '@/components';
import { Maximize2, Minimize2, X } from 'lucide-react';

type Props = {
  body?: ReactNode;
  inspector?: ReactNode;
};

/**
 * Canvas — the main composition shell.
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  Canvas header strip                                       │
 *   ├──────────┬──────────────────────────────┬──────────────────┤
 *   │          │                              │                  │
 *   │  rail    │  body                        │  inspector slot  │
 *   │  (trail) │  (filled by later modules)   │  (drawer)        │
 *   │          │                              │                  │
 *   └──────────┴──────────────────────────────┴──────────────────┘
 *
 * Modes: closed | compact | expanded.
 *  - closed:    rail visible, no body, no inspector
 *  - compact:   rail + body
 *  - expanded:  rail + body + inspector
 */
export function Canvas({ body, inspector }: Props) {
  const mode = useRanBerri((s) => s.ui.canvasMode);
  const setMode = useRanBerri((s) => s.setCanvasMode);

  const showInspector = mode === 'expanded' && inspector !== undefined;
  const showBody = mode !== 'closed';

  return (
    <section className="mx-auto max-w-[1280px] px-8 pb-20">
      <div
        className="hairline-mid overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <CanvasHeader mode={mode} setMode={setMode} />

        <div
          className="grid"
          style={{
            gridTemplateColumns: showInspector
              ? 'minmax(240px, 280px) 1fr minmax(280px, 340px)'
              : showBody
                ? 'minmax(240px, 280px) 1fr'
                : '1fr',
            minHeight: 540,
          }}
        >
          <DecisionTrail />
          {showBody && (
            <div
              className="hairline-r"
              style={{
                padding: '0',
                background: 'var(--color-bg)',
              }}
            >
              {body ?? <CanvasBodyPlaceholder />}
            </div>
          )}
          {showInspector && (
            <div style={{ background: 'var(--color-surface)' }}>{inspector}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function CanvasHeader({
  mode,
  setMode,
}: {
  mode: 'closed' | 'compact' | 'expanded';
  setMode: (m: 'closed' | 'compact' | 'expanded') => void;
}) {
  const submission = useRanBerri((s) => s.submission);
  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{
        padding: '14px 22px',
        background: 'var(--color-surface)',
      }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="serif"
          style={{
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.012em',
            color: 'var(--color-ink)',
          }}
        >
          {submission ? 'Greenline Recycling Ltd' : 'Risk canvas'}
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
          }}
        >
          {submission ? 'one canvas per risk' : 'awaiting submission'}
        </span>
        <Pill mono tone="neutral">
          {submission?.folio ?? 'NO-FOLIO'}
        </Pill>
      </div>
      <div className="flex items-center gap-1">
        <CanvasModeButton
          active={mode === 'closed'}
          onClick={() => setMode('closed')}
          title="Rail only"
        >
          <X size={14} strokeWidth={1.5} />
        </CanvasModeButton>
        <CanvasModeButton
          active={mode === 'compact'}
          onClick={() => setMode('compact')}
          title="Compact"
        >
          <Minimize2 size={14} strokeWidth={1.5} />
        </CanvasModeButton>
        <CanvasModeButton
          active={mode === 'expanded'}
          onClick={() => setMode('expanded')}
          title="Expanded"
        >
          <Maximize2 size={14} strokeWidth={1.5} />
        </CanvasModeButton>
      </div>
    </div>
  );
}

function CanvasModeButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
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
        width: 26,
        height: 24,
        borderRadius: 'var(--radius-button)',
        background: active ? 'var(--color-sunken)' : 'transparent',
        color: active ? 'var(--color-ink)' : 'var(--color-ink-mute)',
      }}
    >
      {children}
    </button>
  );
}

function CanvasBodyPlaceholder() {
  return (
    <div
      className="flex h-full flex-col items-start justify-start"
      style={{ padding: '40px 44px' }}
    >
      <div className="eyebrow mb-4">module 1 · shell</div>
      <h2
        className="serif"
        style={{
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: '-0.015em',
          margin: 0,
          color: 'var(--color-ink)',
        }}
      >
        The body of the canvas is intentionally empty.
      </h2>
      <p
        className="prose-editorial mt-4 max-w-[58ch]"
        style={{ color: 'var(--color-ink-soft)' }}
      >
        Module&nbsp;2 fills this space &mdash; the broker email lands at the
        top, the AI extraction unfolds in the margin, and the slip stays sealed
        underneath. The decision trail on the left will populate as events
        arrive. The lifecycle ribbon above scrubs through the policy&rsquo;s
        full life.
      </p>
      <div
        className="hairline mt-8"
        style={{
          padding: '14px 16px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          maxWidth: 540,
        }}
      >
        <div className="eyebrow mb-2">what comes next</div>
        <ul
          className="serif"
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13.5,
            color: 'var(--color-ink-soft)',
            lineHeight: 1.7,
          }}
        >
          <li>Module 2 &mdash; submission intake &amp; field extraction</li>
          <li>Module 3 &mdash; external enrichment &amp; conflict resolution</li>
          <li>Module 4 &mdash; rating engine &amp; quote slip</li>
          <li>Module 5 &mdash; bind recommendation</li>
          <li>Module 6 &mdash; bind / refer / NTU outcome capture</li>
        </ul>
      </div>
    </div>
  );
}
