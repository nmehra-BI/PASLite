import { ArrowLeft, Download, ExternalLink, RotateCcw, X } from 'lucide-react';
import { useCanvasUI } from '@/store/canvasUI';

/**
 * Module 13 — standardized inspector chrome.
 *
 * Opt-in primitives that any drawer component can wrap to get a
 * consistent header (back / breadcrumb / close), title section,
 * and footer (refresh / export / open-in). Existing drawers continue
 * to work without these primitives; new drawers and refactored
 * ones use them for consistency.
 */

export type InspectorChromeProps = {
  /** "RECOMMENDATION · FACTOR EVIDENCE" — small mono breadcrumb. */
  breadcrumb: string;
  /** Drawer title in serif 24px. */
  title: string;
  /** Optional italic-serif subtitle. */
  subtitle?: string;
  /** Close affordance. Required. */
  onClose: () => void;
  /** Footer affordances; render when defined. */
  onRefresh?: () => void;
  onExport?: () => void;
  onOpenIn?: { label: string; onClick: () => void };
  children: React.ReactNode;
};

export function InspectorChrome({
  breadcrumb,
  title,
  subtitle,
  onClose,
  onRefresh,
  onExport,
  onOpenIn,
  children,
}: InspectorChromeProps) {
  const history = useCanvasUI((s) => s.inspectorHistory);
  const popInspector = useCanvasUI((s) => s.popInspector);
  const showBack = history.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        className="hairline-b flex items-center"
        style={{
          padding: '10px 22px',
          flex: '0 0 auto',
          gap: 10,
          justifyContent: 'space-between',
        }}
      >
        {showBack ? (
          <button
            type="button"
            onClick={popInspector}
            className="serif inline-flex items-center gap-1"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-ink-mute)',
              background: 'transparent',
              border: 0,
              padding: '2px 6px',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
            aria-label="Back"
          >
            <ArrowLeft size={11} strokeWidth={1.5} />
            back
          </button>
        ) : (
          <span style={{ width: 60 }} aria-hidden />
        )}
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            flex: 1,
            textAlign: 'center',
          }}
        >
          {breadcrumb}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            padding: 4,
            color: 'var(--color-ink-mute)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
          }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <header style={{ padding: '16px 22px 12px', flex: '0 0 auto' }}>
        <h2
          className="serif"
          style={{
            fontSize: 24,
            fontWeight: 400,
            margin: 0,
            color: 'var(--color-ink)',
            letterSpacing: '-0.012em',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--color-ink-mute)',
              margin: '4px 0 0',
              letterSpacing: '-0.005em',
            }}
          >
            {subtitle}
          </p>
        )}
      </header>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 22px 18px',
          borderTop: '0.5px solid var(--color-rule-mid)',
        }}
      >
        {children}
      </div>

      {(onRefresh || onExport || onOpenIn) && (
        <footer
          className="hairline-t"
          style={{
            padding: '10px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: '0 0 auto',
          }}
        >
          {onRefresh && (
            <FooterButton onClick={onRefresh} icon={<RotateCcw size={11} strokeWidth={1.5} />}>
              Refresh
            </FooterButton>
          )}
          {onExport && (
            <FooterButton onClick={onExport} icon={<Download size={11} strokeWidth={1.5} />}>
              Export
            </FooterButton>
          )}
          {onOpenIn && (
            <FooterButton
              onClick={onOpenIn.onClick}
              icon={<ExternalLink size={11} strokeWidth={1.5} />}
            >
              {onOpenIn.label}
            </FooterButton>
          )}
        </footer>
      )}
    </div>
  );
}

function FooterButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="serif inline-flex items-center gap-1.5"
      style={{
        fontStyle: 'italic',
        fontSize: 12.5,
        color: 'var(--color-accent)',
        background: 'transparent',
        border: '0.5px solid var(--color-accent)',
        padding: '4px 10px',
        borderRadius: 'var(--radius-button)',
        cursor: 'pointer',
        letterSpacing: '-0.005em',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export { useCanvasUI as useInspectorHistory } from '@/store/canvasUI';
