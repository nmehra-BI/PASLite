import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { ListingAction, ListingEntry } from '@/lib/listing';
import { useListingStore } from './listingStore';
import { useRanBerri } from '@/store';
import { InlineChaseEmailModal } from './InlineChaseEmailModal';

const PRIORITY_TONE: Record<
  ListingEntry['priority'],
  { label: string; color: string }
> = {
  high: { label: 'HIGH', color: 'var(--color-danger)' },
  medium: { label: 'MEDIUM', color: 'var(--color-warn)' },
  watch: { label: 'WATCH', color: 'var(--color-accent)' },
  steady: { label: 'STEADY', color: 'var(--color-ink-mute)' },
};

const GLYPH: Record<ListingEntry['glyph'], { char: string; color: string }> = {
  action: { char: '⛌', color: 'var(--color-danger)' },
  conflict: { char: '⚠', color: 'var(--color-warn)' },
  watch: { char: '◷', color: 'var(--color-accent)' },
  steady: { char: '◌', color: 'var(--color-ink-mute)' },
  closed: { char: '✓', color: 'var(--color-success)' },
  declined: { char: '✗', color: 'var(--color-ink-faint)' },
};

export function SubmissionRow({ entry }: { entry: ListingEntry }) {
  const [chaseOpen, setChaseOpen] = useState(false);
  const recordChase = useListingStore((s) => s.recordChase);
  const setDrilledFromListing = useListingStore((s) => s.setDrilledFromListing);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const glyph = GLYPH[entry.glyph];
  const priority = PRIORITY_TONE[entry.priority];

  const recentlyChased =
    entry.lastChaseAt !== null &&
    Date.now() - new Date(entry.lastChaseAt).getTime() < 60 * 60_000;

  function onAction(action: ListingAction) {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'listing.actionTaken',
      viewedBy: 'nm',
      entryRef: entry.ref,
      actionId: action.id,
    });
    if (action.id === 'chase-broker') {
      setChaseOpen(true);
      return;
    }
    if (action.id === 'mark-evidence-received') {
      // Inline: stamp the row with a chase receipt to imply progress.
      recordChase(entry.ref);
      return;
    }
    if (action.drillsToCanvas) {
      setDrilledFromListing({ ref: entry.ref });
      navigateToCanvas(entry.ref);
    }
  }

  function onOpen() {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'listing.actionTaken',
      viewedBy: 'nm',
      entryRef: entry.ref,
      actionId: 'open-canvas',
    });
    setDrilledFromListing({ ref: entry.ref });
    navigateToCanvas(entry.ref);
  }

  return (
    <>
      <motion.div
        layout
        whileHover={{ backgroundColor: 'var(--color-sunken)' }}
        transition={{ duration: 0.12 }}
        style={{
          padding: '14px 36px 16px',
          borderBottom: '0.5px solid var(--color-rule)',
        }}
      >
        <div
          className="flex items-baseline justify-between"
          style={{ gap: 16, marginBottom: 6 }}
        >
          <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                fontSize: 13,
                color: glyph.color,
                fontFamily: 'var(--font-mono)',
                width: 14,
                display: 'inline-block',
              }}
            >
              {glyph.char}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--color-ink-soft)',
                letterSpacing: '0.06em',
                fontWeight: 500,
              }}
            >
              {entry.ref}
            </span>
            <span
              className="serif"
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: 'var(--color-ink)',
                letterSpacing: '-0.005em',
              }}
            >
              {entry.insuredName}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-faint)',
              }}
            >
              {entry.lob}
            </span>
          </div>
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: priority.color,
              fontWeight: 500,
              flex: '0 0 auto',
            }}
          >
            {priority.label}
          </span>
        </div>

        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-soft)',
            paddingLeft: 26,
            letterSpacing: '-0.005em',
            lineHeight: 1.55,
          }}
        >
          {entry.status}
        </div>
        {entry.context && (
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-ink-faint)',
              paddingLeft: 26,
              marginTop: 3,
              letterSpacing: '-0.005em',
              lineHeight: 1.5,
            }}
          >
            {entry.context}
          </div>
        )}

        <div
          className="flex items-center"
          style={{
            paddingLeft: 26,
            marginTop: 10,
            gap: 8,
          }}
        >
          {entry.actions.map((a) => (
            <ActionButton
              key={a.id}
              action={a}
              recentlyChased={recentlyChased && a.id === 'chase-broker'}
              chaseAt={entry.lastChaseAt}
              onClick={() => onAction(a)}
            />
          ))}
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1"
            aria-label="Open in canvas"
            style={{
              marginLeft: 'auto',
              padding: '4px 8px',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-ink-mute)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <ArrowUpRight size={11} strokeWidth={1.5} />
            open
          </button>
        </div>
      </motion.div>

      {chaseOpen && (
        <InlineChaseEmailModal
          entry={entry}
          onClose={() => setChaseOpen(false)}
          onSent={() => {
            recordChase(entry.ref);
            setChaseOpen(false);
          }}
        />
      )}
    </>
  );
}

function ActionButton({
  action,
  recentlyChased,
  chaseAt,
  onClick,
}: {
  action: ListingAction;
  recentlyChased: boolean;
  chaseAt: string | null;
  onClick: () => void;
}) {
  if (recentlyChased) {
    const mins = chaseAt
      ? Math.max(1, Math.floor((Date.now() - new Date(chaseAt).getTime()) / 60_000))
      : 1;
    return (
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-mute)',
          padding: '4px 10px',
          background: 'var(--color-sunken)',
          borderRadius: 'var(--radius-button)',
          letterSpacing: '-0.005em',
        }}
      >
        Chased {mins}m ago
      </span>
    );
  }

  const tones: Record<
    ListingAction['tone'],
    React.CSSProperties
  > = {
    primary: {
      color: 'var(--color-bg)',
      background: 'var(--color-accent)',
      border: '0.5px solid var(--color-accent)',
    },
    secondary: {
      color: 'var(--color-ink)',
      background: 'transparent',
      border: '0.5px solid var(--color-rule-mid)',
    },
    ghost: {
      color: 'var(--color-ink-mute)',
      background: 'transparent',
      border: 0,
    },
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 'var(--radius-button)',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        ...tones[action.tone],
      }}
    >
      {action.label}
    </motion.button>
  );
}

function navigateToCanvas(ref: string) {
  const target = ref.startsWith('POL-')
    ? `policy/${ref}`
    : `submission/${ref}`;
  window.location.hash = `#/${target}`;
}
