import { AnimatePresence, motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import { ALL_ARTIFACTS, affectedArtifacts, type ArtifactKey } from '@/lib/deps';

const ARTIFACT_LABEL: Record<ArtifactKey, string> = {
  enrichment: 'Enrichment',
  conflicts: 'Conflicts',
  rating: 'Rating',
  quote: 'Quote',
  recommendation: 'Recommendation',
};

/**
 * Surfaces the artifacts that need rerunning. Targeted, not blanket:
 *
 *   - Artifacts that were computed and then made stale (staleSince
 *     populated) are listed.
 *   - Plus the dep-graph closure of every `field.corrected` event
 *     for which we have not yet seen a subsequent `<artifact>.computed`
 *     for the affected artifacts.
 *
 * In module 2 nothing has been computed yet, so the second clause does
 * the work: only artifacts the corrections actually affected appear.
 * Once modules 3-5 wire `markArtifactComputed`, the first clause takes
 * over and the second becomes a backstop for never-computed artifacts.
 */
export function StalenessBanner() {
  const submission = useRanBerri((s) => s.submission);
  const artifacts = useRanBerri((s) => s.artifacts);
  const auditLog = useRanBerri((s) => s.auditLog);

  if (!submission) return null;

  const pending = new Set<ArtifactKey>();

  // (1) Artifacts that transitioned computed → stale.
  for (const k of ALL_ARTIFACTS) {
    if (artifacts[k].staleSince !== null) pending.add(k);
  }

  // (2) Dep-graph closure of every correction whose effect hasn't been
  // resolved by a subsequent recompute. We walk the log and, for each
  // field.corrected at time T, mark each artifact in the closure
  // pending unless an artifact.computed for that artifact at time
  // > T exists later in the log.
  for (let i = 0; i < auditLog.length; i++) {
    const e = auditLog[i]!;
    if (e.kind !== 'field.corrected') continue;
    const closure = affectedArtifacts(e.fieldPath);
    for (const k of closure) {
      const recomputedAfter = auditLog
        .slice(i + 1)
        .some(
          (later) =>
            later.kind === 'artifact.computed' && later.artifact === k,
        );
      if (!recomputedAfter) pending.add(k);
    }
  }

  if (pending.size === 0) return null;

  const labels = ALL_ARTIFACTS.filter((k) => pending.has(k)).map(
    (k) => ARTIFACT_LABEL[k],
  );

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
            Downstream artifacts pending rerun &mdash; {labels.join(' · ')}.
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
