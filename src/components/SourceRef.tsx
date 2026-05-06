import { useState } from 'react';

type Props = {
  sourceRef: string;
  modelVersion?: string;
  extractedAt?: string;
};

/**
 * Hover affordance that shows the citation behind an extracted value.
 * Always-on rendering would clutter the editorial layout, so we surface
 * the ref on hover as a small mono tooltip.
 */
export function SourceRef({ sourceRef, modelVersion, extractedAt }: Props) {
  const [open, setOpen] = useState(false);
  const time = extractedAt ? new Date(extractedAt) : null;
  const stamp = time
    ? `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
    : null;

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          color: 'var(--color-ink-faint)',
          letterSpacing: '0.04em',
          cursor: 'help',
        }}
      >
        {sourceRef}
      </span>
      {open && (
        <span
          role="tooltip"
          className="hairline mono"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--color-surface)',
            padding: '6px 8px',
            borderRadius: 'var(--radius-button)',
            fontSize: 10,
            color: 'var(--color-ink-soft)',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            zIndex: 30,
          }}
        >
          <span style={{ color: 'var(--color-ink)' }}>{sourceRef}</span>
          {modelVersion && <span style={{ marginLeft: 8 }}>· {modelVersion}</span>}
          {stamp && <span style={{ marginLeft: 8 }}>· {stamp}</span>}
        </span>
      )}
    </span>
  );
}
