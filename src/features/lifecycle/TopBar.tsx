import { Sparkle } from 'lucide-react';
import { useRanBerri } from '@/store';
import { Pill } from '@/components';

/**
 * The workstation top bar. Thin, dense, no marketing copy. Reads
 * left-to-right as: identity → context → environment.
 */
export function TopBar() {
  const submission = useRanBerri((s) => s.submission);
  const folio = submission?.folio ?? 'MGA-PAS · folio 29481';
  const insured = submission ? 'Greenline Recycling Ltd' : null;

  return (
    <header
      className="hairline-b flex items-center justify-between"
      style={{
        height: 44,
        padding: '0 18px',
        background: 'var(--color-surface)',
        flex: '0 0 auto',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkle
            size={13}
            strokeWidth={1.25}
            style={{ color: 'var(--color-accent)' }}
            aria-hidden
          />
          <span
            className="serif"
            style={{
              fontSize: 14.5,
              fontWeight: 500,
              letterSpacing: '-0.018em',
              color: 'var(--color-ink)',
            }}
          >
            RanBerri
          </span>
        </div>
        <Divider />
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-mute)',
            letterSpacing: '0.06em',
          }}
        >
          {folio}
        </span>
        {insured && (
          <>
            <Divider />
            <span
              className="serif"
              style={{
                fontSize: 13,
                color: 'var(--color-ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {insured}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Pill tone="warn" mono>
          STAGING
        </Pill>
        <Divider />
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-mute)',
            letterSpacing: '0.06em',
          }}
        >
          nm · uw
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.04em',
          }}
        >
          0.1.0
        </span>
      </div>
    </header>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 0.5,
        height: 14,
        background: 'var(--color-rule-mid)',
      }}
    />
  );
}
