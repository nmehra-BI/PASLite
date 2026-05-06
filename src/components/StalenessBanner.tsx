import { AnimatePresence, motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import { ALL_ARTIFACTS } from '@/lib/deps';

const ARTIFACT_LABEL: Record<string, string> = {
  enrichment: 'Enrichment',
  conflicts: 'Conflicts',
  rating: 'Rating',
  quote: 'Quote',
  recommendation: 'Recommendation',
};

/**
 * Surfaces when at least one underwriter correction has fired but
 * downstream artifacts have not been recomputed. Module 2 has nothing
 * to rerun yet &mdash; this banner is the marker that downstream
 * modules will wire their rerun affordances into.
 */
export function StalenessBanner() {
  const submission = useRanBerri((s) => s.submission);
  const artifacts = useRanBerri((s) => s.artifacts);
  const auditLog = useRanBerri((s) => s.auditLog);

  if (!submission) return null;

  const hasCorrection = auditLog.some((e) => e.kind === 'field.corrected');
  if (!hasCorrection) return null;

  const stale = ALL_ARTIFACTS.filter((k) => artifacts[k].computedAt === null);
  if (stale.length === 0) return null;

  const labels = stale.map((k) => ARTIFACT_LABEL[k] ?? k);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        className="hairline-b"
        style={{
          background: 'var(--color-warn-bg)',
          padding: '10px 22px',
          flex: '0 0 auto',
        }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-warn)',
            }}
          >
            stale
          </span>
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-warn)',
            }}
          >
            Downstream artifacts are stale &mdash; rerun {labels.join(' · ')} when ready.
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
