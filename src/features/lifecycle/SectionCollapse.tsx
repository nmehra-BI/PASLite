import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useCanvasUI, type ChapterId } from '@/store/canvasUI';
import type { ChapterStatus } from '@/lib/chapters';
import { defaultExpandedFor } from '@/lib/chapters';
import { useObserveChapter } from './ChapterNav';

/**
 * Generic collapse wrapper for a module's canvas section. Renders
 * either a one-line editorial summary (collapsed) or the full
 * children (expanded). Auto-defaults to expanded for the current
 * chapter and collapsed for completed ones; user manual overrides
 * persist via canvasUI.
 *
 * Each rendered section gets a [data-chapter="..."] header anchor
 * that ChapterNav uses for IntersectionObserver-based active
 * detection and click-to-scroll.
 */
export function SectionCollapse({
  chapter,
  status,
  summary,
  children,
}: {
  chapter: ChapterId;
  status: ChapterStatus;
  /** One-line editorial summary content rendered when collapsed. */
  summary: React.ReactNode;
  /** Full section content rendered when expanded. */
  children: React.ReactNode;
}) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  useObserveChapter(chapter, headerRef);

  const manual = useCanvasUI((s) => s.manualOverrides[chapter]);
  const setManual = useCanvasUI((s) => s.setManualOverride);

  // Pending sections never expand.
  if (status === 'pending') {
    return (
      <section
        ref={headerRef}
        data-chapter={chapter}
        style={{
          padding: '12px 28px',
          borderTop: '0.5px solid var(--color-rule)',
          borderBottom: '0.5px solid var(--color-rule)',
          background: 'var(--color-bg)',
          opacity: 0.5,
          filter: 'grayscale(0.4)',
          scrollMarginTop: 24,
        }}
        aria-disabled="true"
      >
        <SummaryRow chapter={chapter} status={status} expandable={false} onClick={() => {}}>
          {summary}
        </SummaryRow>
      </section>
    );
  }

  const expanded = manual !== undefined ? manual : defaultExpandedFor(status);
  const isCurrent = status === 'current';

  function toggle() {
    setManual(chapter, !expanded);
  }

  return (
    <section
      ref={headerRef}
      data-chapter={chapter}
      style={{
        borderTop: '0.5px solid var(--color-rule)',
        borderLeft: isCurrent ? '1.5px solid var(--color-accent)' : '0',
        background: 'var(--color-bg)',
        scrollMarginTop: 24,
      }}
    >
      <SummaryRow chapter={chapter} status={status} expandable expanded={expanded} onClick={toggle}>
        {summary}
      </SummaryRow>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SummaryRow({
  chapter,
  status,
  expandable,
  expanded,
  onClick,
  children,
}: {
  chapter: ChapterId;
  status: ChapterStatus;
  expandable: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const Glyph = STATUS_GLYPH[status];
  return (
    <motion.button
      type="button"
      onClick={expandable ? onClick : undefined}
      whileHover={expandable ? { backgroundColor: 'var(--color-sunken)' } : {}}
      transition={{ duration: 0.12 }}
      disabled={!expandable}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 28px',
        background: 'transparent',
        border: 0,
        cursor: expandable ? 'pointer' : 'default',
      }}
    >
      <span
        aria-hidden
        style={{
          color: STATUS_COLOR[status],
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          width: 14,
          display: 'inline-block',
        }}
      >
        {Glyph}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          width: 130,
          flex: '0 0 auto',
        }}
      >
        {CHAPTER_LABEL[chapter]}
      </span>
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-soft)',
          letterSpacing: '-0.005em',
          flex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </span>
      {expandable && (
        <motion.span
          aria-hidden
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-flex', color: 'var(--color-ink-faint)' }}
        >
          <ChevronRight size={13} strokeWidth={1.5} />
        </motion.span>
      )}
    </motion.button>
  );
}

const STATUS_GLYPH: Record<ChapterStatus, string> = {
  complete: '✓',
  current: '◷',
  pending: '◌',
  failed: '✗',
};

const STATUS_COLOR: Record<ChapterStatus, string> = {
  complete: 'var(--color-success)',
  current: 'var(--color-accent)',
  pending: 'var(--color-ink-faint)',
  failed: 'var(--color-danger)',
};

const CHAPTER_LABEL: Record<ChapterId, string> = {
  extraction: 'extraction',
  enrichment: 'enrichment',
  triage: 'triage',
  rating: 'rating',
  quote: 'quote',
  recommendation: 'recommendation',
  bind: 'bind',
  // Generic phase label; the per-MTA endorsement id renders inside
  // MtaSummary content rather than in the chapter chrome.
  'mta-04': 'mta',
  cancellation: 'cancellation',
  renewal: 'renewal',
};
