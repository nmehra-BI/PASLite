import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { LedgerClassSummary } from '@/lib/ledger';

const FMT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const PCT = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Module 15 — per-class summary section on the main ledger page.
 * Editorial block (NOT a data table). Five stacked summaries; the
 * "[View all N →]" affordance drills into the class detail page.
 */
export function LedgerSection({
  summary,
  index,
  onDrill,
}: {
  summary: LedgerClassSummary;
  index: number;
  onDrill: () => void;
}) {
  const classSlug = summary.classId.toLowerCase();
  const isInactive = !summary.enabled || summary.count === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
      style={{
        padding: '20px 36px 22px',
        borderBottom: '0.5px solid var(--color-rule)',
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 16, marginBottom: 8 }}
      >
        <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
          <span
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isInactive ? 'var(--color-ink-faint)' : 'var(--color-ink-soft)',
              fontWeight: 500,
            }}
          >
            {summary.classId}
          </span>
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13.5,
              color: isInactive ? 'var(--color-ink-faint)' : 'var(--color-ink-mute)',
              letterSpacing: '-0.005em',
            }}
          >
            {isInactive
              ? '· not currently enabled'
              : `· ${summary.count} action${summary.count === 1 ? '' : 's'}`}
          </span>
        </div>
        {!isInactive && summary.count > 0 && (
          <button
            type="button"
            onClick={onDrill}
            className="serif inline-flex items-center gap-1"
            data-class-slug={classSlug}
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-rule-mid)',
              background: 'transparent',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
              flex: '0 0 auto',
            }}
          >
            View all {summary.count}
            <ArrowUpRight size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!isInactive && summary.mostRecent && (
        <>
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-soft)',
              letterSpacing: '-0.005em',
              lineHeight: 1.55,
            }}
          >
            most recent: {FMT_DATE.format(new Date(summary.mostRecent.firedAt))} ·{' '}
            <span className="mono" style={{ fontStyle: 'normal', fontSize: 11.5 }}>
              {summary.mostRecent.entryRef}
            </span>{' '}
            {summary.mostRecent.insuredName}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.04em',
              color: 'var(--color-ink-mute)',
              marginTop: 4,
            }}
          >
            recall rate: {PCT(summary.recallRate)}
            {summary.recalledCount > 0 && (
              <>
                {' '}
                <span style={{ color: 'var(--color-warn)' }}>
                  ({summary.recalledCount} recalled)
                </span>
              </>
            )}
          </div>
        </>
      )}
    </motion.section>
  );
}
