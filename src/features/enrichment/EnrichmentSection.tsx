import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useIntake } from '@/features/intake';
import { ENRICHMENT_SOURCES } from '@/lib/fixtures';
import { runEnrichment } from './enrichment-engine';
import { SourceCard } from './SourceCard';
import { ConflictCard } from './ConflictCard';
import { GapCard } from './GapCard';
import { ConfirmedSourcesPanel } from './ConfirmedSourcesPanel';
import { ResolvedConflictRow, ResolvedGapRow } from './ResolvedRow';

/**
 * The enrichment section. Renders below the editorial extracted view
 * once the intake's extraction has settled.
 *
 *   - Auto-fires the cinematic on first reach of `intake.phase ===
 *     'complete'` AND `enrichment.staleSince === null` AND
 *     `enrichment.computedAt === null`.
 *   - Renders source cards during the cinematic; conflicts + gaps +
 *     confirmed panel after settlement.
 *   - "rerun enrichment" link explicitly re-fires; preserved
 *     resolutions stay in the materialised state because
 *     `conflict.resolved` and `gap.resolved` events live in the log.
 */
export function EnrichmentSection() {
  const intakePhase = useIntake((s) => s.phase);
  const submission = useRanBerri((s) => s.submission);
  const enrichment = useRanBerri((s) => s.enrichment);
  const enrichmentArtifact = useRanBerri((s) => s.artifacts.enrichment);
  const conflictsArtifact = useRanBerri((s) => s.artifacts.conflicts);
  const auditLog = useRanBerri((s) => s.auditLog);
  const firedForExtractionAtRef = useRef<number>(-1);
  const [running, setRunning] = useState(false);

  // Auto-fire enrichment once per `extraction.completed` event. This
  // covers both the first run (initial extraction) and re-extraction
  // (rerun) — the natural reading order is extraction → enrichment.
  // Field corrections do NOT fire a new extraction.completed and so do
  // NOT auto-fire here; the user clicks "rerun enrichment" instead.
  useEffect(() => {
    if (!submission) return;
    if (intakePhase !== 'complete') return;

    let lastExtractionCompleted = -1;
    let lastEnrichmentStarted = -1;
    for (let i = 0; i < auditLog.length; i++) {
      const e = auditLog[i]!;
      if (e.kind === 'extraction.completed') lastExtractionCompleted = i;
      if (e.kind === 'enrichment.started') lastEnrichmentStarted = i;
    }
    if (lastExtractionCompleted === -1) return;
    // Already fired since the most recent extraction.completed
    if (lastEnrichmentStarted > lastExtractionCompleted) return;
    // We already kicked it off this round (the engine writes the
    // started event but the log update may not have propagated yet)
    if (firedForExtractionAtRef.current === lastExtractionCompleted) return;

    firedForExtractionAtRef.current = lastExtractionCompleted;
    setRunning(true);
    void runEnrichment().finally(() => setRunning(false));
  }, [submission, intakePhase, auditLog]);

  if (!submission) return null;
  if (intakePhase !== 'complete') return null;

  const isQuerying = enrichment.phase === 'querying';
  const isSettled = enrichment.phase === 'settled';
  const unresolvedConflicts = enrichment.conflicts.filter((c) => !c.resolution);
  const resolvedConflicts = enrichment.conflicts.filter((c) => c.resolution);
  const unresolvedGaps = enrichment.gaps.filter((g) => !g.resolution);
  const resolvedGaps = enrichment.gaps.filter((g) => g.resolution);

  return (
    <section
      className="hairline-t"
      style={{ marginTop: 28, paddingTop: 22 }}
    >
      <Header
        running={running}
        isSettled={isSettled}
        isStale={
          enrichmentArtifact.staleSince !== null ||
          conflictsArtifact.staleSince !== null
        }
        conflictCount={unresolvedConflicts.length}
        gapCount={unresolvedGaps.length}
        confirmedCount={
          Object.values(enrichment.sources).filter(
            (s) => s.result?.verdict !== 'conflict',
          ).length
        }
        onRerun={async () => {
          if (running) return;
          setRunning(true);
          try {
            await runEnrichment({ rerun: true });
          } finally {
            setRunning(false);
          }
        }}
      />

      {/* Source cards — always rendered while sources are tracked. */}
      <div style={{ marginTop: 14 }}>
        {ENRICHMENT_SOURCES.map((meta) => (
          <SourceCard
            key={meta.id}
            meta={meta}
            status={enrichment.sources[meta.id]}
            flashOnReturn={!isQuerying}
          />
        ))}
      </div>

      <AnimatePresence>
        {isSettled && (
          <motion.div
            key="reconciliation"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
          >
            <Reconciliation
              unresolvedConflicts={unresolvedConflicts}
              resolvedConflicts={resolvedConflicts}
              unresolvedGaps={unresolvedGaps}
              resolvedGaps={resolvedGaps}
            />
            <ConfirmedSourcesPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Header({
  running,
  isSettled,
  isStale,
  conflictCount,
  gapCount,
  confirmedCount,
  onRerun,
}: {
  running: boolean;
  isSettled: boolean;
  isStale: boolean;
  conflictCount: number;
  gapCount: number;
  confirmedCount: number;
  onRerun: () => void;
}) {
  const subtitle = !isSettled
    ? 'querying 4 sources · in parallel'
    : isStale
      ? 'stale — upstream changed'
      : `${conflictCount} conflict${conflictCount === 1 ? '' : 's'} · ${gapCount} gap${gapCount === 1 ? '' : 's'} · ${confirmedCount} confirmed`;

  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div className="eyebrow">{isSettled ? 'reconciliation' : 'enriching'}</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: isStale ? 'var(--color-warn)' : 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {subtitle}
        </div>
      </div>
      {(isSettled || isStale) && (
        <button
          type="button"
          onClick={onRerun}
          disabled={running}
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: running ? 'var(--color-ink-faint)' : 'var(--color-accent)',
          }}
        >
          <RotateCcw size={11} strokeWidth={1.5} />
          <span>rerun enrichment</span>
        </button>
      )}
    </div>
  );
}

function Reconciliation({
  unresolvedConflicts,
  resolvedConflicts,
  unresolvedGaps,
  resolvedGaps,
}: {
  unresolvedConflicts: import('@/store/replay').ConflictRecord[];
  resolvedConflicts: import('@/store/replay').ConflictRecord[];
  unresolvedGaps: import('@/store/replay').GapRecord[];
  resolvedGaps: import('@/store/replay').GapRecord[];
}) {
  const hasResolved = resolvedConflicts.length + resolvedGaps.length > 0;
  return (
    <div style={{ marginTop: 22 }}>
      {hasResolved && (
        <div style={{ marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            resolved · {resolvedConflicts.length + resolvedGaps.length}
          </div>
          {resolvedConflicts.map((c) => (
            <ResolvedConflictRow key={c.id} conflict={c} />
          ))}
          {resolvedGaps.map((g) => (
            <ResolvedGapRow key={g.id} gap={g} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {unresolvedConflicts.map((c) => (
          <ConflictCard key={c.id} conflict={c} />
        ))}
        {unresolvedGaps.map((g) => (
          <GapCard key={g.id} gap={g} />
        ))}
      </div>
    </div>
  );
}
